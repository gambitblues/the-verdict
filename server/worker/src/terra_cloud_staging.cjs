/* Cloudflare-only Terra staging: model calls use the EXISTING Worker OPENAI_API_KEY.
 * This module is never exposed to player routes. It deliberately NEVER admits
 * or publishes generated cases: Chromium QA cannot run inside a Worker.
 */
'use strict';
const {generate}=require('./terra_case_generator.cjs');
const {TARGETS}=require('./terra_case_pipeline.cjs');
const THEMES=Object.freeze({
 civil:'상가 건물 누수 시점과 수리 의무, 현장 사진 및 계약서 사이의 모순을 다투는 가상의 민사 사건',
 financial:'용역 대금 송금 지시가 변경된 과정에서 지시 권한과 회계 자료를 다투는 가상의 금융 사건',
 property:'공유 공간의 설비 파손과 보관 의무에 관해 서로 다른 시점의 기록을 다투는 가상의 재산 사건',
 family:'성인 가족 간 증여 의사와 재산 처분 시점을 다투는 가상의 가족 사건',
 violence:'가상의 공공 장소에서 발생한 다툼의 순서와 상해 인과관계를 다투는 사건',
 reputation:'직장 내 게시글의 원문과 실제 공개 범위, 명예훼손 여부를 다투는 가상의 사건',
 public:'지방 행정 처리 과정에서 허가 신청 접수와 결재 순서가 다투어지는 가상의 사건'
});
const allowed=Object.keys(THEMES);
const idFor=(category,stamp,rand)=>'terra-'+category+'-'+stamp+'-'+rand;
function policy(env){
 const req=(name,min,max)=>{
  const raw=env[name],n=Number(raw);
  if(typeof raw!=='string'||!raw.trim()||!Number.isFinite(n)||n<min||n>max)throw Error('unsafe policy: '+name);
  return n;
 };
 if(env.TERRA_REFILL_ENABLED!=='1')return null;
 if(!env.OPENAI_API_KEY||!env.SUPABASE_SERVICE_ROLE_KEY||!/^https:\/\//.test(env.SUPABASE_URL||''))
  throw Error('missing existing Worker secrets');
 return {maxCalls:req('TERRA_MAX_CALLS_DAY',4,200),maxUsd:req('TERRA_MAX_USD_DAY',0.01,100),
  reserveUsd:req('TERRA_MAX_USD_CASE',0.01,10),target:req('TERRA_TARGET_STOCK',1,40),
  maxPerRun:req('TERRA_MAX_BATCH',1,2),model:env.MODEL_CASE||'gpt-6.1-terra'};
}
async function rpc(env,fetcher,name,body){
 const r=await fetcher(env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,
   authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json'},
  body:JSON.stringify(body)});
 if(!r.ok)throw Error('private database RPC '+name+': '+r.status);
 return r.json();
}
async function stockCounts(env,fetcher){
 // Fail closed on incomplete pagination. Exclude assigned/retired cases.
 const r=await fetcher(env.SUPABASE_URL.replace(/\/$/,'')+
  '/rest/v1/case_stock?select=case_id,category,state&limit=1000',{
  headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY}});
 if(!r.ok)throw Error('private stock unavailable');
 const rows=await r.json();
 if(!Array.isArray(rows)||rows.length>=1000)throw Error('private stock scan incomplete');
 return rows.filter(x=>x.state==='stock').reduce((a,x)=>{a[x.category]=(a[x.category]||0)+1;return a},{});
}
async function runCloudStaging(env,{fetcher=fetch,now=()=>new Date(),random=()=>crypto.randomUUID(),generateCase=generate}={}){
 const p=policy(env);
 if(!p)return {stage:'disabled',created:0};
 const runId='refill-'+random().replace(/[^a-z0-9-]/gi,'').toLowerCase().slice(0,40);
 const token=random()+random();
 let lease=false,booking=null,closed=true;
 try{
  lease=await rpc(env,fetcher,'refill_lease_claim',{p_run:runId,p_token:token,p_seconds:1800});
  if(!lease)return {stage:'busy',created:0};
  const counts=await stockCounts(env,fetcher);
  const pending=await rpc(env,fetcher,'terra_pending_counts',{});
  if(!pending||typeof pending!=='object')throw Error('pending stock count unavailable');
  const category=allowed.find(x=>(counts[x]||0)+(Number(pending[x])||0)<Math.min(TARGETS[x],p.target));
  if(!category)return {stage:'stock-sufficient',created:0};
  const stamp=now().toISOString().slice(0,10).replace(/-/g,'');
  const id=idFor(category,stamp,random().replace(/[^a-z0-9]/gi,'').toLowerCase().slice(0,12));
  // Reserve for ALL 4 possible model calls, incl. repairs. This path uses only
  // 2 calls; remaining reserved capacity is intentionally charged conservatively.
  booking=await rpc(env,fetcher,'refill_budget_reserve',{p_run:runId,p_token:token,
   p_category:category,p_usd:p.reserveUsd,p_calls:4,p_max_day_usd:p.maxUsd,p_max_day_calls:p.maxCalls});
  if(booking===null)return {stage:'budget-exhausted',created:0};
  const result=await generateCase({id,category,premise:THEMES[category]+
   ' — 증거 및 목격자의 관찰 범위를 구분하고 완전히 독립적인 가상 사실관계를 작성한다.'},{
   fetcher,apiKey:env.OPENAI_API_KEY,model:p.model});
  if(!result.ok||!result.candidate||!result.worldSheet)return {stage:'quarantine',created:0};
  // Keep hidden truth private, not in public world_state or player saves.
  const stored=await rpc(env,fetcher,'terra_stage_draft',{
   p_id:id,p_category:category,p_candidate:result.candidate,p_sheet:result.worldSheet,
   p_candidate_hash:result.candidateHash,p_sheet_hash:result.sheetHash});
  if(stored!==true)return {stage:'duplicate',created:0};
  return {stage:'staged-needs-browser-qa',created:1,caseId:id};
 }catch{
  return {stage:'failed-closed',created:0};
 }finally{
  if(booking!==null&&booking!==undefined&&lease){
   try{await rpc(env,fetcher,'refill_budget_close',{p_id:booking,p_run:runId,p_token:token,
    p_actual_usd:p.reserveUsd,p_actual_calls:4})}catch{closed=false}
  }
  if(lease){try{await rpc(env,fetcher,'refill_lease_release',{p_run:runId,p_token:token})}catch{}}
 }
}
module.exports={runCloudStaging,policy,THEMES};
