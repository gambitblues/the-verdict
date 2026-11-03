/* Live check after deploying (run on your own computer; passwords are typed here, hidden, and go only to Supabase).
 *   cd server/worker
 *   VERDICT_API=https://the-verdict-api.<account>.workers.dev SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_ANON_KEY=<anon public key> node scripts/smoke.mjs
 * It asks for the two invited emails and passwords, then checks:
 *   1 both players can sign in; the AI server refuses calls without a token
 *   2 accounts are separate: each sees only their own saves, cannot write save rows directly, cannot touch the shared world,
 *     hidden truths or AI usage (nothing is written by this script)
 *   3 one article (title + 2~4 sentences, ~100~200 chars) and one witness answer through the real models
 *   4 the fallback path: a deliberately failed call returns fallback=true (needs ALLOW_TEST_FAIL="1" on the Worker for the test)
 *   5 tokens, estimated cost and today's usage */
import readline from 'node:readline';
const {VERDICT_API,SUPABASE_URL,SUPABASE_ANON_KEY}=process.env;
for(const [k,v] of Object.entries({VERDICT_API,SUPABASE_URL,SUPABASE_ANON_KEY}))if(!v){console.error('missing env '+k);process.exit(1)}

function prompt(q,hidden){return new Promise(res=>{const rl=readline.createInterface({input:process.stdin,output:process.stdout,terminal:true});
 if(hidden){rl._writeToOutput=s=>{if(s.includes(q))rl.output.write(q);else rl.output.write('*')}}
 rl.question(q,a=>{rl.close();if(hidden)process.stdout.write('\n');res(a.trim())})})}
const H=t=>({apikey:SUPABASE_ANON_KEY,'content-type':'application/json',...(t?{authorization:`Bearer ${t}`}:{})});
let failed=0;const check=(ok,label,extra='')=>{console.log(`${ok?'  ✓':'  ✗'} ${label}${extra?' — '+extra:''}`);if(!ok)failed++};

async function signIn(email,password){
 const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:H(),body:JSON.stringify({email,password})});
 const d=await r.json();if(!r.ok)throw new Error(d.error_description||'login failed');return d;
}
const api=async(t,path,body)=>{const r=await fetch(VERDICT_API+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(t?{authorization:`Bearer ${t}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json().catch(()=>({}))}};
const rest=(t,path,opt={})=>fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...opt,headers:{...H(t),...(opt.headers||{})}});

const players=[];
for(const n of [1,2]){const email=await prompt(`player ${n} email: `),pw=await prompt(`player ${n} password: `,true);players.push({email,...await signIn(email,pw)})}
const [A,B]=players;
console.log('\n1) sign-in and the AI gate');
check(true,'both players signed in');
for(const p of players){const r=await rest(p.access_token,'rpc/claim_player',{method:'POST',body:'{}'});check(r.ok&&(await r.json())===true,`${p.email} is on the invite list`)}
check((await api(null,'/ai/npc',{})).status===401,'AI without a token → 401');
const models=await api(A.access_token,'/ai/check');console.log('   models:',JSON.stringify(models.data.models));
check(Object.values(models.data.models||{}).every(m=>m.ok),'both configured models are usable with this key');

console.log('\n2) accounts are separate');
const own=async p=>(await (await rest(p.access_token,`saves?select=user_id,slot,rev&user_id=eq.${p.user.id}`)).json());
const rowsA=await own(A),rowsB=await own(B);
console.log(`   existing saves: A ${rowsA.length}, B ${rowsB.length} (the smoke test does not overwrite them)`);
const peek=await (await rest(A.access_token,`saves?select=slot&user_id=eq.${B.user.id}`)).json();check(Array.isArray(peek)&&peek.length===0,'A cannot read B\'s saves');
const direct=await rest(A.access_token,'saves',{method:'POST',body:JSON.stringify({user_id:B.user.id,slot:'2',data:'x'})});check(!direct.ok,'A cannot write a save row directly',String(direct.status));
const world=await rest(A.access_token,'world_state?id=eq.main',{method:'PATCH',body:'{"data":{"hack":1}}',headers:{prefer:'return=representation'}});
check(!world.ok||(await world.json()).length===0,'a player cannot change the shared world',String(world.status));
const secrets=await rest(A.access_token,'world_secrets?select=case_id');check(!secrets.ok,'a player cannot read hidden truths',String(secrets.status));
const reserve=await rest(A.access_token,'rpc/ai_reserve',{method:'POST',body:JSON.stringify({p_uid:A.user.id,p_kind:'x',p_model:'x',p_est:0,p_max_calls:999,p_max_usd:999})});check(!reserve.ok,'a player cannot reserve AI calls',String(reserve.status));
console.log('   (version conflicts are checked offline in server/supabase npm test; this script does not write saves)');

console.log('\n3) real AI calls');
const art=await api(A.access_token,'/ai/article',{outlet:'법조일보',reporter:'한지수',style:'사실 위주, 짧은 문장',lean:'p',phase:'before',caseName:'친목 모임의 공동투자금',names:['김혜진'],
 title:'동창 돈 3억, 7천만 원은 어디로',body:'동창 12명이 모은 3억 원 가운데 7천만 원이 개업 엿새 만에 빚 갚는 데 쓰였다. 검찰은 처음부터 속일 생각이었다고 본다. 김혜진 씨는 사업을 살리려 했다고 말한다.'});
check(art.data.ok===true,'article generated',art.data.ok?`${art.data.result.title} / ${art.data.result.body.length}자 · ${art.data.usage.input_tokens}+${art.data.usage.output_tokens} tokens · $${art.data.cost_usd}`:JSON.stringify(art.data));
if(art.data.ok)console.log('   제목:',art.data.result.title,'\n   본문:',art.data.result.body);
const npc=await api(A.access_token,'/ai/npc',{role:'카페 매니저',attitude:'honest',names:['김혜진'],question:'그날 현금은 어떻게 처리했습니까?',answer:'매일 밤 10시에 김혜진 대표님이 현금을 직접 가져갔어요. 3천만 원쯤 됐을 거예요.'});
check(npc.data.ok===true,'witness answer generated',npc.data.ok?`$${npc.data.cost_usd}`:JSON.stringify(npc.data));
if(npc.data.ok)console.log('   답:',npc.data.result.text);

console.log('\n4) fallback');
const fail=await api(B.access_token,'/ai/npc',{role:'증인',question:'무엇을 보셨습니까?',answer:'아무것도 못 봤어요.',test:'fail'});
check(fail.data.fallback===true,'a failed call tells the game to keep its own text',fail.data.fallback?'':'set ALLOW_TEST_FAIL="1" on the Worker for this check, then remove it');

console.log('\n5) usage today');
for(const p of players)console.log(`   ${p.email}:`,JSON.stringify((await api(p.access_token,'/ai/usage')).data));
console.log(failed?`\n${failed} check(s) failed`:'\nall checks passed');process.exit(failed?1:0);
