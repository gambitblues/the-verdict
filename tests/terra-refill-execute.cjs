/* P3-15 operator-only replenishment adapter. Explicit --execute required.
 * Secrets only in server environment. No browser route or automatic schedule.
 * Requires SQL migrations 003 and 004, Playwright+Chromium and installed Node.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cp=require('node:child_process');
const {runBatch}=require('../server/worker/src/terra_replenishment_runner.cjs');
const {produce}=require('./terra-generate.cjs');
const {evaluate}=require('./terra-handoff-qa.cjs');
const Stock=require('../server/worker/src/terra_stock_service.cjs');
const {triage}=require('../server/worker/src/terra_auto_triage.cjs');
const THEMES=Object.freeze({
 homicide:'가상의 의료기관에서 사망 진단 시점과 당사자별 관찰 기록이 충돌하고, 과실과 사망 원인을 구분해야 하는 사건',
 sexual:'성인 사이 과거 만남 이후 신고된 비동의 접촉 사건에서 연락 기록, 현장 동선, 의학 소견의 한계가 다투어지는 사건',
 violence:'가상의 상업 시설 출입 과정에서 다툼과 상해가 발생해 폭행 경위와 객관적 흔적을 다투는 사건',
 financial:'지역 기업의 계약 대금 지급 지시가 변경되어 송금 권한과 손해 발생 경위가 다투어지는 사건',
 property:'공동 사용 시설물의 파손과 관리 의무를 놓고 실제 손상 발생 시점과 책임이 다투어지는 사건',
 reputation:'공개된 업무상 발언의 정확한 원문과 게시 범위, 사실관계가 다투어지는 명예훼손 사건',
 civil:'가상의 임대차 계약에서 누수 수리와 비용 보전의 책임 및 손해 규모가 다투어지는 민사 사건',
 family:'성인 가족 구성원의 상속재산 처분과 실제 의사를 두고 증여 및 권리관계가 다투어지는 사건',
 professional:'가상 전문직의 당시 설명·점검 의무와 후속 손해 사이의 인과관계를 다투는 사건',
 public:'지방 행정기관의 허가 처리 순서와 결재 권한, 이해관계가 쟁점인 사건'
});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function config(env){
 const required=['OPENAI_API_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
 if(required.some(k=>!env[k]))throw Error('실행 불가: 서버 API 키 또는 DB 인증이 없습니다.');
 const number=(name)=>{const n=Number(env[name]);if(!env[name]||!Number.isFinite(n)||n<=0)throw Error('설정 누락: '+name);return n};
 return {url:env.SUPABASE_URL,key:env.SUPABASE_SERVICE_ROLE_KEY,apiKey:env.OPENAI_API_KEY,
 model:env.TERRA_CASE_MODEL||'gpt-6.1-terra',
 policy:{minPerCategory:number('TERRA_MIN_STOCK'),targetPerCategory:number('TERRA_TARGET_STOCK'),
 maxNewCasesPerRun:number('TERRA_MAX_BATCH'),maxCallsToday:number('TERRA_MAX_CALLS_DAY'),
 maxUsdToday:number('TERRA_MAX_USD_DAY'),maxEstimatedUsdPerCase:number('TERRA_MAX_USD_CASE'),
 maxPerCategory:number('TERRA_MAX_STOCK_CATEGORY')}};
}
function client(c,fetcher){
 return {url:c.url,serviceKey:c.key,fetcher};
}
async function getTable(c,fetcher,name,qs=''){
 const response=await fetcher(c.url.replace(/\/$/,'')+'/rest/v1/'+name+'?'+qs,{
  headers:{authorization:'Bearer '+c.key,apikey:c.key,accept:'application/json'}});
 if(!response.ok)throw Error('private DB unavailable: '+response.status);
 const rows=await response.json();
 if(!Array.isArray(rows)||rows.length>=1000)throw Error('incomplete DB stock scan');
 return rows;
}
async function serverSnapshot(c,fetcher,root){
 const rows=await getTable(c,fetcher,'case_stock','select=case_id,category,state&limit=1000');
 const budget=await Stock.rpc(client(c,fetcher),'refill_budget_snapshot',{});
 const total=Array.isArray(budget)?budget[0]:null;
 if(!total||!Number.isFinite(Number(total.used_usd))||!Number.isFinite(Number(total.used_calls)))throw Error('budget snapshot unavailable');
 const local=path.join(root,'pending');
 const inFlight=fs.existsSync(local)?fs.readdirSync(local,{withFileTypes:true})
  .filter(x=>x.isDirectory()&&/^terra-[a-z0-9-]+$/.test(x.name))
  .map(x=>{try{const a=read(path.join(local,x.name,'candidate.json'));return {id:a.id,category:a.card.category}}catch{return null}}).filter(Boolean):[];
 return {inventory:rows.map(x=>({id:x.case_id,category:x.category})),inFlight,budget:{
  ...c.policy,usedCallsToday:Number(total.used_calls),usedUsdToday:Number(total.used_usd)}};
}
function makeOperations({c,fetcher=fetch,root=process.cwd()}){
 const env=client(c,fetcher),token=crypto.randomBytes(32).toString('hex');
 return {
  acquireLease:async runId=>({ok:await Stock.rpc(env,'refill_lease_claim',{p_run:runId,p_token:token,p_seconds:1800}),token}),
  releaseLease:async({runId,leaseToken})=>Stock.rpc(env,'refill_lease_release',{p_run:runId,p_token:leaseToken}),
  loadSnapshot:async()=>serverSnapshot(c,fetcher,root),
  reserveBudget:async({runId,leaseToken,request,maxUsd,maxCalls})=>{
   const id=await Stock.rpc(env,'refill_budget_reserve',{p_run:runId,p_token:leaseToken,p_category:request.category,
    p_usd:maxUsd,p_calls:maxCalls,p_max_day_usd:c.policy.maxUsdToday,p_max_day_calls:c.policy.maxCallsToday});
   return {ok:id!=null,id:String(id||'')};
  },
  generateCandidate:async({request,reservation,runId})=>{
   // A unique ID per reserved run; no overwriting previous case drafts.
   const id=('terra-'+request.category+'-'+runId.replace(/^refill-/,'')+'-'+reservation.id).slice(0,79);
   const seed={id,category:request.category,premise:THEMES[request.category]+' — 제작번호 '+reservation.id+'에 맞는 독립적이고 중복되지 않는 사실관계를 구성한다.'};
   const out=await produce({seed,root,fetcher,apiKey:c.apiKey,model:c.model});
   if(!out.ok)return {ok:false};
   const folder=path.join(root,'pending',id);
   return {ok:true,candidate:read(path.join(folder,'candidate.json')),sheet:read(path.join(folder,'world-sheet.json')),
    qa:read(path.join(folder,'qa-result.json'))};
  },
  runBrowserQA:async({candidate})=>{
   const input=path.join(root,'pending',candidate.id,'world-sheet.json');
   const job=cp.spawnSync(process.execPath,[path.join(root,'tests','terra-browser-qa.mjs'),'--sheet',input],{
    cwd:root,encoding:'utf8',timeout:240000,maxBuffer:1024*1024});
   if(job.status!==0)return {ok:false};
   const report=read(path.join(root,'pending',candidate.id,'browser-qa.json'));
   return {...report,ok:report.ok===true};
  },
  reverify:async({candidate,sheet,qa,browserQa})=>{
   const final=evaluate({...candidate,status:'review'},sheet);
   if(!final.ok)return {ok:false,decision:'quarantine'};
   const decision=triage({candidate,sheet,qa,browserQa,inventory:[],
    policy:{maxPerCategory:c.policy.maxPerCategory}});
   return {ok:decision.decision==='stock',decision:decision.decision};
  },
  admit:async({candidate,sheet})=>{
   const folder=path.join(root,'pending',candidate.id);
   const qa=read(path.join(folder,'qa-result.json')),browserQa=read(path.join(folder,'browser-qa.json'));
   const outcome=await Stock.admitVerified({env,candidate,sheet,qa,browserQa,inventory:[],
    policy:{maxPerCategory:c.policy.maxPerCategory},
    reverify:async({candidate,sheet})=>{
     const q=evaluate({...candidate,status:'review'},sheet);
     return {ok:q.ok,sheetHash:q.sheetHash,candidateHash:q.candidateHash};
    }});
   return {ok:outcome.ok,id:outcome.id};
  },
  closeReservation:async({reservation,runId,leaseToken})=>{
   // Charge worst-case reservation even if provider fails, until real usage reconciliation exists.
   return Stock.rpc(env,'refill_budget_close',{p_id:Number(reservation.id),p_run:runId,p_token:leaseToken,
    p_actual_usd:c.policy.maxEstimatedUsdPerCase,p_actual_calls:4});
  }
 };
}
async function main(args=process.argv.slice(2),env=process.env){
 if(args.length!==1||args[0]!=='--execute')throw Error('실행 명령: node tests/terra-refill-execute.cjs --execute');
 const c=config(env),runId='refill-'+crypto.randomBytes(8).toString('hex');
 const report=await runBatch({ops:makeOperations({c}),policy:c.policy,runId});
 // Never print provider raw responses or hidden sheet facts.
 console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error('사건 보충 실행 중단: '+String(e.message).slice(0,180));process.exitCode=1});
module.exports={config,makeOperations,serverSnapshot,THEMES};
