/* THE VERDICT API — Cloudflare Worker (the-verdict-api)
 *
 * What it does
 *  - Checks every request against Supabase Auth (the player's access token) and an allow-list of invited players.
 *  - Calls the OpenAI Responses API with the server-side OPENAI_API_KEY. The key never reaches the browser.
 *  - Rewrites only the wording of what the game engine already decided: a witness's answer, a reporter's article,
 *    the sentences of a judgment. Facts, numbers, the verdict and the sentence stay the engine's; every reply is
 *    checked and the browser falls back to the engine's own text when a check fails.
 *  - Records model, tokens and estimated cost of each call (Supabase table ai_usage) and enforces daily limits.
 *
 * The hidden truth of a case is never sent here: the browser only sends text the player can already see.
 *
 * Secrets (wrangler secret put): OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Vars (wrangler.toml):           SUPABASE_URL, SUPABASE_ANON_KEY, ALLOWED_ORIGINS, ALLOWED_EMAILS,
 *                                 MODEL_CASE, MODEL_TALK, PRICES, DAILY_CALLS, DAILY_USD
 */
import TerraCloud from './terra_cloud_staging.cjs';
import {npcPrompt,articlePrompt,judgmentPrompt,checkNpc,checkArticle,checkJudgment,openingPrompt,checkOpening,benchPrompt,checkBench,closingPrompt,checkClosing,exchangePrompt,checkExchange,verifyPrompt} from './prompts.js';

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...headers}});

/* ---------- CORS: only the game's own pages ---------- */
function cors(req,env){
 const origin=req.headers.get('origin')||'';
 const allowed=String(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const ok=allowed.includes(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
 return ok?{'access-control-allow-origin':origin,'access-control-allow-headers':'authorization, content-type','access-control-allow-methods':'GET, POST, OPTIONS','vary':'origin'}:{};
}

const svc=env=>({apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'content-type':'application/json'});
/* ---------- auth: Supabase access token → user, then the invite list ---------- */
const userCache=new Map();   // token → {user, until}; a Worker instance lives briefly, so this only saves repeat lookups
export async function authUser(req,env,fetcher=fetch){
 const m=(req.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i);if(!m)return {error:'no_token',status:401};
 const token=m[1],hit=userCache.get(token);if(hit&&hit.until>Date.now())return {user:hit.user,token};
 const r=await fetcher(`${env.SUPABASE_URL}/auth/v1/user`,{headers:{authorization:`Bearer ${token}`,apikey:env.SUPABASE_ANON_KEY}});
 if(!r.ok)return {error:'bad_token',status:401};
 const user=await r.json();
 const invited=String(env.ALLOWED_EMAILS||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
 if(!user?.id||!invited.includes(String(user.email||'').toLowerCase()))return {error:'not_invited',status:403};
 // v8.7.1: the database invite list must agree too; if it cannot be checked, nothing is allowed
 let row=null;try{const q=await fetcher(`${env.SUPABASE_URL}/rest/v1/players?select=email&user_id=eq.${encodeURIComponent(user.id)}`,{headers:svc(env)});
  if(!q.ok)return {error:'invite_check_failed',status:503};row=(await q.json())?.[0]||null}catch{return {error:'invite_check_failed',status:503}}
 if(!row)return {error:'not_invited',status:403};
 userCache.set(token,{user,until:Date.now()+60000});if(userCache.size>50)userCache.delete(userCache.keys().next().value);
 return {user,token};
}

/* ---------- cost and usage ---------- */
export function priceOf(env,model){
 let table={};try{table=JSON.parse(env.PRICES||'{}')}catch{}
 return table[model]||table[String(model).replace(/-\d{8}$/,'')]||{in:0,out:0};
}
export function costOf(env,model,usage){const p=priceOf(env,model);return ((usage?.input_tokens||0)*p.in+(usage?.output_tokens||0)*p.out)/1e6}

async function usageToday(env,uid,fetcher){
 const r=await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/ai_usage_today`,{method:'POST',headers:svc(env),body:JSON.stringify({uid})});
 if(!r.ok)return null;const row=(await r.json())?.[0]||{};return {calls:Number(row.calls||0),usd:Number(row.usd||0)};
}
/* v8.7.1: a call first reserves its place in today's limit, counted at its worst-case price, inside one database
 * transaction per player — so parallel calls cannot pass the limit. undefined = the usage store could not be reached
 * (then no AI call is made at all), null = over the limit. */
export async function reserve(env,uid,kind,model,est,fetcher){
 try{const r=await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/ai_reserve`,{method:'POST',headers:svc(env),
   body:JSON.stringify({p_uid:uid,p_kind:kind,p_model:model,p_est:Number(est.toFixed(6)),p_max_calls:Number(env.DAILY_CALLS||300),p_max_usd:Number(env.DAILY_USD||1)})});
  if(!r.ok)return undefined;const id=await r.json();return id==null?null:id}catch{return undefined}
}
async function finish(env,id,row,fetcher){
 try{await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/ai_finish`,{method:'POST',headers:svc(env),body:JSON.stringify({p_id:id,...row})})}catch{}
}
/* worst case: the whole input at the input price and every allowed output token at the output price (×2 with the check) */
export const estimate=(env,model,chars,maxTokens,verify)=>{const p=priceOf(env,model);const one=(chars*1.2*p.in+maxTokens*p.out)/1e6;return verify?one*2.2:one};

/* ---------- OpenAI Responses API ---------- */
export function outputText(res){
 if(typeof res?.output_text==='string')return res.output_text;
 for(const item of res?.output||[])for(const c of item?.content||[])if(c?.type==='output_text'&&typeof c.text==='string')return c.text;
 return '';
}
export async function respond(env,{model,instructions,input,schema,maxTokens},fetcher=fetch){
 const body={model,instructions,input,max_output_tokens:maxTokens||600,store:false,
  text:{format:{type:'json_schema',name:schema.name,schema:schema.schema,strict:true}}};
 const r=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)return {ok:false,status:r.status,error:data?.error?.message||'openai_error',usage:data?.usage};
 let parsed=null;try{parsed=JSON.parse(outputText(data))}catch{}
 return {ok:!!parsed,data:parsed,usage:data.usage||{},model:data.model||model,error:parsed?null:'unparsable'};
}

/* each kind: which model, how to build the request, how to check the answer */
const KINDS={
 npc:{model:env=>env.MODEL_TALK,build:npcPrompt,check:checkNpc,maxTokens:400},
 article:{model:env=>env.MODEL_TALK,build:articlePrompt,check:checkArticle,maxTokens:700},
 judgment:{model:env=>env.MODEL_TALK,build:judgmentPrompt,check:checkJudgment,maxTokens:2600},
 opening:{model:env=>env.MODEL_TALK,build:openingPrompt,check:checkOpening,maxTokens:700},
 bench:{model:env=>env.MODEL_TALK,build:benchPrompt,check:checkBench,maxTokens:550},
 closing:{model:env=>env.MODEL_TALK,build:closingPrompt,check:checkClosing,maxTokens:700},
 exchange:{model:env=>env.MODEL_TALK,build:exchangePrompt,check:checkExchange,maxTokens:550}
};

export async function handle(req,env,fetcher=fetch){
 const url=new URL(req.url),head=cors(req,env);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:head});
 if(url.pathname==='/health')return json({ok:true,service:'the-verdict-api'},200,head);
 const who=await authUser(req,env,fetcher);
 if(who.error)return json({error:who.error},who.status,head);
 const uid=who.user.id;

 // which models this key can use (run once after deploy; also tells whether the configured IDs exist)
 if(url.pathname==='/ai/check'&&req.method==='GET'){
  const out={};
  for(const m of [env.MODEL_CASE,env.MODEL_TALK]){const r=await fetcher(`https://api.openai.com/v1/models/${encodeURIComponent(m)}`,{headers:{authorization:`Bearer ${env.OPENAI_API_KEY}`}});
   out[m]={ok:r.ok,status:r.status}}
  return json({models:out},200,head);
 }
 if(url.pathname==='/ai/usage'&&req.method==='GET'){
  const u=await usageToday(env,uid,fetcher);return json({today:u,limits:{calls:Number(env.DAILY_CALLS||300),usd:Number(env.DAILY_USD||1)}},200,head);
 }
 const kind=(url.pathname.match(/^\/ai\/(npc|article|judgment|opening|bench|closing|exchange)$/)||[])[1];
 if(!kind||req.method!=='POST')return json({error:'not_found'},404,head);

 let payload;try{payload=await req.json()}catch{return json({error:'bad_json'},400,head)}
 const K=KINDS[kind],built=K.build(payload||{});
 if(built.error)return json({error:built.error},400,head);
 const model=K.model(env),verify=env.VERIFY!=='0',started=Date.now();
 const id=await reserve(env,uid,kind,model,estimate(env,model,built.input.length+built.instructions.length,K.maxTokens,verify),fetcher);
 if(id===undefined)return json({error:'usage_unavailable'},503,head);      // cannot count it → do not call
 if(id===null)return json({error:'daily_limit'},429,head);
 // a deliberate failure for the live test of the fallback path (only when the deployment allows it)
 if(payload?.test==='fail'&&env.ALLOW_TEST_FAIL==='1'){await finish(env,id,{p_model:model,p_in:0,p_out:0,p_cost:0,p_ok:false,p_reason:'test_fail',p_ms:0},fetcher);return json({ok:false,fallback:true,why:'test_fail'},200,head)}
 const r=await respond(env,{model,...built,maxTokens:K.maxTokens},fetcher);
 let verdict=r.ok?K.check(payload,r.data):{ok:false,why:r.error},usage={input_tokens:r.usage?.input_tokens||0,output_tokens:r.usage?.output_tokens||0},cost=costOf(env,model,r.usage);
 if(verdict.ok&&verify&&verdict.compare){   // second opinion on meaning (people, facts, yes/no, what the witness means)
  const v=await respond(env,{model,...verifyPrompt(kind,...verdict.compare),maxTokens:200},fetcher);
  usage.input_tokens+=v.usage?.input_tokens||0;usage.output_tokens+=v.usage?.output_tokens||0;cost+=costOf(env,model,v.usage);
  if(!v.ok)verdict={ok:false,why:'verify_unavailable'};else if(!v.data.same)verdict={ok:false,why:'meaning: '+String(v.data.problem||'').slice(0,80)};
 }
 await finish(env,id,{p_model:r.model||model,p_in:usage.input_tokens,p_out:usage.output_tokens,p_cost:Number(cost.toFixed(6)),p_ok:verdict.ok,
  p_reason:verdict.ok?null:String(verdict.why||'').slice(0,120),p_ms:Date.now()-started},fetcher);
 if(!verdict.ok)return json({ok:false,fallback:true,why:verdict.why},200,head);   // the browser keeps the engine's text
 r.usage=usage;
 return json({ok:true,result:verdict.value,model:r.model||model,usage:r.usage,cost_usd:Number(cost.toFixed(6))},200,head);
}

export default {
 fetch:(req,env)=>handle(req,env).catch(e=>json({error:'server_error'},500,cors(req,env))),
 // Cloudflare scheduler is the only Terra entrypoint. No player-facing route,
 // no hidden-truth responses, and disabled unless TERRA_REFILL_ENABLED='1'.
 scheduled:(event,env,ctx)=>ctx.waitUntil(TerraCloud.runCloudStaging(env)
  .then(result=>console.log('terra-staging:',result.stage,'created:',result.created))
  .catch(()=>console.log('terra-staging: failed-closed')))
};
