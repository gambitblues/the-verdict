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
import {publicCaseSheet,initialEvidence} from './public_case_projection.js';
import {courtroomPlan} from './shared_courtroom.js';
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

 // P4-1: public-only, read-only shared chronology. Use the caller's JWT so
 // Supabase RLS verifies invitation; never read case_stock or world_secrets.
 if(url.pathname==='/world/events'&&req.method==='GET'){
  const afterRaw=url.searchParams.get('after')||'0';
  if(!/^(0|[1-9][0-9]{0,15})$/.test(afterRaw))return json({error:'bad_cursor'},400,head);
  const after=Number(afterRaw);
  if(!Number.isSafeInteger(after))return json({error:'bad_cursor'},400,head);
  const endpoint=`${env.SUPABASE_URL}/rest/v1/shared_world_events?select=event_id,event_key,case_id,event_type,game_day,public_data,judge_id,created_at&event_id=gt.${after}&order=event_id.asc&limit=50`;
  let response;
  try{response=await fetcher(endpoint,{headers:{apikey:env.SUPABASE_ANON_KEY,authorization:`Bearer ${who.token}`}})}
  catch{return json({error:'world_unavailable'},503,head)}
  if(!response.ok)return json({error:'world_unavailable'},503,head);
  let events;try{events=await response.json()}catch{return json({error:'world_unavailable'},503,head)}
  if(!Array.isArray(events))return json({error:'world_unavailable'},503,head);
  return json({ok:true,events,next:events.length?events[events.length-1].event_id:after},200,head);
 }

 // P4-2: shared clock and objective NPC biographies are read via the player's JWT.
 // Private relationship memories never belong in these server records.
 if(req.method==='GET'&&(url.pathname==='/world/clock'||url.pathname==='/world/npcs')){
  const clock=url.pathname==='/world/clock';
  const after=url.searchParams.get('after')||'';
  if(!clock&&!/^[a-zA-Z0-9:_-]{0,120}$/.test(after))return json({error:'bad_cursor'},400,head);
  const path=clock
   ?'shared_world_clock?select=id,game_day,version&limit=1'
   :'shared_npc_public?select=npc_id,public_profile,life_status,effective_day,version&npc_id=gt.'+encodeURIComponent(after)+'&order=npc_id.asc&limit=50';
  let response;
  try{response=await fetcher(`${env.SUPABASE_URL}/rest/v1/${path}`,{
   headers:{apikey:env.SUPABASE_ANON_KEY,authorization:`Bearer ${who.token}`}})}
  catch{return json({error:'world_unavailable'},503,head)}
  if(!response.ok)return json({error:'world_unavailable'},503,head);
  let rows;try{rows=await response.json()}catch{return json({error:'world_unavailable'},503,head)}
  if(!Array.isArray(rows))return json({error:'world_unavailable'},503,head);
  if(clock)return json({ok:true,clock:rows[0]||null},200,head);
  return json({ok:true,npcs:rows,next:rows.length?rows[rows.length-1].npc_id:after},200,head);
 }

 // P4-4: globally reserved two-case docket. Disabled until the QA migration,
 // server-side sheet adjudication and explicit release gate are complete.
 if(url.pathname==='/world/offers'||url.pathname==='/world/accept'){
  if(env.P4_SHARED_DOCKET_ENABLED!=='1')return json({error:'feature_disabled'},404,head);
  if(req.method!=='POST')return json({error:'method_not_allowed'},405,head);
  let input;try{input=await req.json()}catch{return json({error:'bad_json'},400,head)}
  if(typeof input?.slot!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}$/.test(input.slot))
   return json({error:'bad_slot'},400,head);
  const accept=url.pathname==='/world/accept';
  if(accept&&(typeof input?.caseId!=='string'||!/^[a-z][a-z0-9-]{3,79}$/.test(input.caseId)))
   return json({error:'bad_case_id'},400,head);
  const rpc=accept?'shared_docket_accept':'shared_docket_offer';
  const payload={p_judge:uid,p_slot:input.slot,...(accept?{p_case_id:input.caseId}:{})};
  let response;
  try{response=await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/${rpc}`,{
    method:'POST',headers:svc(env),body:JSON.stringify(payload)})}
  catch{return json({error:'docket_unavailable'},503,head)}
  if(!response.ok)return json({error:response.status===403?'docket_forbidden':'docket_conflict'},response.status===403?403:409,head);
  let rows;try{rows=await response.json()}catch{return json({error:'docket_unavailable'},503,head)}
  if(!Array.isArray(rows))return json({error:'docket_unavailable'},503,head);
  // Never return case_stock.sheet, verification, world_secrets, or hidden truth.
  return json(accept?{ok:true,assignment:rows[0]||null}:{ok:true,offers:rows},200,head);
 }

 // P4-5: project the assigned case's PUBLIC courtroom material, never the sealed sheet.
 if(url.pathname==='/world/case'&&req.method==='GET'){
  const id=url.searchParams.get('caseId')||'';
  if(!/^[a-z][a-z0-9-]{3,79}$/.test(id))return json({error:'bad_case_id'},400,head);
  const endpoint=`${env.SUPABASE_URL}/rest/v1/case_stock?select=case_id,assigned_to,state,sheet&case_id=eq.${encodeURIComponent(id)}&limit=1`;
  let response;
  try{response=await fetcher(endpoint,{headers:svc(env)})}
  catch{return json({error:'case_unavailable'},503,head)}
  if(!response.ok)return json({error:'case_unavailable'},503,head);
  let rows;try{rows=await response.json()}catch{return json({error:'case_unavailable'},503,head)}
  const row=Array.isArray(rows)?rows[0]:null;
  // Return identical not-found responses for unknown cases and other judge's cases.
  if(!row||row.state!=='assigned'||row.assigned_to!==uid)return json({error:'case_not_found'},404,head);
  try{return json({ok:true,case:publicCaseSheet(row.sheet,id)},200,head)}
  catch{return json({error:'case_unavailable'},503,head)}
 }

 // P4-6: first-day evidence only, selected using the locked server-side truth.
 // No later document, alternative world, witness answer or truth label is sent.
 if(url.pathname==='/world/case/initial'&&req.method==='GET'){
  const id=url.searchParams.get('caseId')||'';
  if(!/^[a-z][a-z0-9-]{3,79}$/.test(id))return json({error:'bad_case_id'},400,head);
  try{
   const caseResp=await fetcher(
    `${env.SUPABASE_URL}/rest/v1/case_stock?select=case_id,assigned_to,state,sheet&case_id=eq.${encodeURIComponent(id)}&limit=1`,
    {headers:svc(env)});
   if(!caseResp.ok)return json({error:'case_unavailable'},503,head);
   const rows=await caseResp.json(),row=Array.isArray(rows)?rows[0]:null;
   if(!row||row.state!=='assigned'||row.assigned_to!==uid)return json({error:'case_not_found'},404,head);
   const truthResp=await fetcher(
    `${env.SUPABASE_URL}/rest/v1/world_secrets?select=truth&case_id=eq.${encodeURIComponent(id)}&limit=1`,
    {headers:svc(env)});
   if(!truthResp.ok)return json({error:'case_unavailable'},503,head);
   const branches=await truthResp.json(),branch=Array.isArray(branches)?branches[0]?.truth?.branch:null;
   if(!branch)return json({error:'case_not_sealed'},409,head);
   return json({ok:true,caseId:id,records:initialEvidence(row.sheet,id,branch)},200,head);
  }catch{return json({error:'case_unavailable'},503,head)}
 }

 // P4: an inactive judge never automatically loses a hearing when the shared
 // chronology advances. This is a PERSONAL, RLS-protected calendar read.
 if(url.pathname==='/world/catchup'&&req.method==='GET'){
  if(env.P4_SHARED_DOCKET_ENABLED!=='1')return json({error:'feature_disabled'},404,head);
  const headers={apikey:env.SUPABASE_ANON_KEY,authorization:`Bearer ${who.token}`};
  try{
   const [clockResp,progressResp,hearingsResp]=await Promise.all([
    fetcher(`${env.SUPABASE_URL}/rest/v1/shared_world_clock?select=game_day,version&id=eq.main&limit=1`,{headers}),
    fetcher(`${env.SUPABASE_URL}/rest/v1/shared_judge_progress?select=last_seen_world_day,protected_until_day&judge_id=eq.${encodeURIComponent(uid)}&limit=1`,{headers}),
    fetcher(`${env.SUPABASE_URL}/rest/v1/shared_judge_hearings?select=case_id,hearing_index,due_game_day,state,revised_by_catchup&judge_id=eq.${encodeURIComponent(uid)}&state=eq.scheduled&order=due_game_day.asc&limit=50`,{headers})
   ]);
   if(!clockResp.ok||!progressResp.ok||!hearingsResp.ok)return json({error:'calendar_unavailable'},503,head);
   const [clocks,progresses,hearings]=await Promise.all([clockResp.json(),progressResp.json(),hearingsResp.json()]);
   if(!Array.isArray(clocks)||!Array.isArray(progresses)||!Array.isArray(hearings))
    return json({error:'calendar_unavailable'},503,head);
   const today=Number(clocks[0]?.game_day??0);
   const earliest=hearings.length?Math.min(...hearings.map(h=>Number(h.due_game_day)).filter(Number.isFinite)):today;
   const last=Number(progresses[0]?.last_seen_world_day??Math.min(today,earliest));
   if(!Number.isSafeInteger(today)||!Number.isSafeInteger(last))return json({error:'calendar_unavailable'},503,head);
   return json({ok:true,worldDay:today,previousDay:last,lagDays:Math.max(0,today-last),
    protectedUntil:progresses[0]?.protected_until_day??today,
    pending:hearings},200,head);
  }catch{return json({error:'calendar_unavailable'},503,head)}
 }
 if(url.pathname==='/world/resume'&&req.method==='POST'){
  if(env.P4_SHARED_DOCKET_ENABLED!=='1')return json({error:'feature_disabled'},404,head);
  let result;
  try{result=await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/shared_judge_resume`,{
   method:'POST',headers:svc(env),body:JSON.stringify({p_judge:uid})})}
  catch{return json({error:'calendar_unavailable'},503,head)}
  if(!result.ok)return json({error:'calendar_unavailable'},503,head);
  let rows;try{rows=await result.json()}catch{return json({error:'calendar_unavailable'},503,head)}
  if(!Array.isArray(rows))return json({error:'calendar_unavailable'},503,head);
  return json({ok:true,resume:rows[0]||null},200,head);
 }

 // QA courtroom status is read-only: the browser cannot open or move a hearing.
 if(url.pathname==='/world/court/status'&&req.method==='GET'){
  if(env.P4_COURT_ACTIONS_ENABLED!=='1')return json({error:'feature_disabled'},404,head);
  const id=url.searchParams.get('caseId')||'';
  if(!/^[a-z][a-z0-9-]{3,79}$/.test(id))return json({error:'bad_case_id'},400,head);
  try{
   const query=async path=>{
    const r=await fetcher(`${env.SUPABASE_URL}/rest/v1/${path}`,{headers:svc(env)});
    if(!r.ok)throw Error('unavailable');
    const rows=await r.json();if(!Array.isArray(rows))throw Error('unavailable');
    return rows;
   };
   const [cases,hearings,clocks]=await Promise.all([
    query(`case_stock?select=assigned_to,state&case_id=eq.${encodeURIComponent(id)}&limit=1`),
    query(`shared_judge_hearings?select=hearing_index,state,completed_game_day&case_id=eq.${encodeURIComponent(id)}&judge_id=eq.${encodeURIComponent(uid)}&state=eq.completed&order=hearing_index.desc&limit=1`),
    query('shared_world_clock?select=game_day&id=eq.main&limit=1')
   ]);
   if(cases[0]?.assigned_to!==uid||cases[0]?.state!=='assigned')
    return json({error:'case_not_found'},404,head);
   const day=clocks[0]?.game_day,hearing=hearings[0]||null;
   return json({ok:true,caseId:id,worldDay:day,
     hearingIndex:hearing&&hearing.completed_game_day===day?hearing.hearing_index:null,
     canAct:!!hearing&&hearing.completed_game_day===day},200,head);
  }catch{return json({error:'court_unavailable'},503,head)}
 }

 // P4: Witness / court order action is evaluated only against the sealed
 // server sheet. No arbitrary witness answer, document text or truth is accepted
 // from the browser. This endpoint is DISABLED unless independent QA opts in.
 if(url.pathname==='/world/court/action'&&req.method==='POST'){
  if(env.P4_COURT_ACTIONS_ENABLED!=='1')return json({error:'feature_disabled'},404,head);
  let input;try{input=await req.json()}catch{return json({error:'bad_json'},400,head)}
  const caseId=input?.caseId,kind=input?.kind,key=input?.key,hearing=input?.hearingIndex;
  if(typeof caseId!=='string'||!/^[a-z][a-z0-9-]{3,79}$/.test(caseId)||
     !['question','order'].includes(kind)||typeof key!=='string'||
     !/^[a-zA-Z0-9:_-]{1,80}$/.test(key)||
     !Number.isInteger(hearing)||hearing<1||hearing>200)
   return json({error:'invalid_action'},400,head);
  const encoded=encodeURIComponent(caseId);
  const lookup=async path=>{
   const r=await fetcher(`${env.SUPABASE_URL}/rest/v1/${path}`,{headers:svc(env)});
   if(!r.ok)throw Error('store_unavailable');
   const v=await r.json();if(!Array.isArray(v))throw Error('store_unavailable');
   return v;
  };
  try{
   const [cases,hearings]=await Promise.all([
    lookup(`case_stock?select=case_id,assigned_to,state,sheet&case_id=eq.${encoded}&limit=1`),
    lookup(`shared_judge_hearings?select=hearing_index,state,completed_game_day&case_id=eq.${encoded}&judge_id=eq.${encodeURIComponent(uid)}&hearing_index=eq.${hearing}&limit=1`)
   ]);
   const row=cases[0],open=hearings[0];
   if(!row||row.assigned_to!==uid||row.state!=='assigned')return json({error:'case_not_found'},404,head);
   if(!open||open.state!=='completed')return json({error:'hearing_not_open'},409,head);
   const [truth,actions]=await Promise.all([
    lookup(`world_secrets?select=truth&case_id=eq.${encoded}&limit=1`),
    lookup(`shared_court_actions?select=action_type,action_key,response&case_id=eq.${encoded}&order=created_at.asc&limit=250`)
   ]);
   const branch=truth[0]?.truth?.branch;
   if(!['did','didnt','reason'].includes(branch))return json({error:'case_not_sealed'},409,head);
   const plan=courtroomPlan(row.sheet,branch,actions,kind,key);
   if(plan.error)return json({error:plan.error},409,head);
   const saved=await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/shared_court_action_record`,{
    method:'POST',headers:svc(env),
    body:JSON.stringify({p_case:caseId,p_judge:uid,p_hearing:hearing,p_type:kind,
      p_key:plan.key,p_response:plan.response})});
   if(!saved.ok)return json({error:'court_action_conflict'},409,head);
   const result=await saved.json();
   if(!result||typeof result!=='object'||Array.isArray(result))
    return json({error:'court_unavailable'},503,head);
   return json({ok:true,caseId,kind,key,response:result},200,head);
  }catch{return json({error:'court_unavailable'},503,head)}
 }
 // The player's prior courtroom results are isolated from the public news feed.
 if(url.pathname==='/world/court/history'&&req.method==='GET'){
  if(env.P4_COURT_ACTIONS_ENABLED!=='1')return json({error:'feature_disabled'},404,head);
  const id=url.searchParams.get('caseId')||'';
  if(!/^[a-z][a-z0-9-]{3,79}$/.test(id))return json({error:'bad_case_id'},400,head);
  try{
   const q=await fetcher(`${env.SUPABASE_URL}/rest/v1/case_stock?select=assigned_to,state&case_id=eq.${encodeURIComponent(id)}&limit=1`,{headers:svc(env)});
   if(!q.ok)return json({error:'court_unavailable'},503,head);
   const rows=await q.json();
   if(!Array.isArray(rows)||rows[0]?.assigned_to!==uid||rows[0]?.state!=='assigned')
    return json({error:'case_not_found'},404,head);
   const r=await fetcher(`${env.SUPABASE_URL}/rest/v1/shared_court_actions?select=action_type,action_key,response,hearing_index,game_day&case_id=eq.${encodeURIComponent(id)}&order=created_at.asc&limit=250`,{headers:svc(env)});
   if(!r.ok)return json({error:'court_unavailable'},503,head);
   const actions=await r.json();if(!Array.isArray(actions))return json({error:'court_unavailable'},503,head);
   return json({ok:true,caseId:id,actions},200,head);
  }catch{return json({error:'court_unavailable'},503,head)}
 }

 // Read-only health check for the existing invited judges. Never returns
 // private case material, budget amounts, service credentials or model output.
 if(url.pathname==='/terra/status'&&req.method==='GET'){
  const state=await TerraCloud.readiness(env,{fetcher});
  return json({ok:true,...state},200,head);
 }

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
