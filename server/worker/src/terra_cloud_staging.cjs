/* Cloudflare-only Terra staging: model calls use the EXISTING Worker OPENAI_API_KEY.
 * This module is never exposed to player routes. It deliberately NEVER admits
 * or publishes generated cases: Chromium QA cannot run inside a Worker.
 */
'use strict';
const {generate}=require('./terra_case_generator.cjs');
const CloudTrialQA=require('./terra_cloud_trial_qa.cjs');
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
/* 2026-11-08: several premises per category, so a steady trickle does not keep producing the same story.
 * The refill picks one at random; the generator still has to invent independent people, places and records. */
const VARIANTS=Object.freeze({
 civil:[THEMES.civil,'인테리어 공사 하자와 잔금 지급을 두고 작업 일지·사진·메신저 기록이 엇갈리는 가상의 민사 사건',
  '중고차 거래 뒤 드러난 침수 이력과 판매자의 고지 여부를 다투는 가상의 민사 사건','반려동물 위탁 중 다친 사고의 책임과 돌봄 기록을 다투는 가상의 민사 사건',
  '공동 창업자 사이의 지분 약속과 투자금 반환을 두고 회의록과 송금 기록이 엇갈리는 가상의 민사 사건'],
 financial:[THEMES.financial,'법인카드 사용 내역과 출장 기록이 맞지 않아 업무 관련성을 다투는 가상의 횡령 사건',
  '거래처 리베이트로 의심되는 현금 흐름과 영업 기록을 다투는 가상의 배임 사건','투자 동호회 운영자가 받은 돈의 성격(투자금인지 빌린 돈인지)을 다투는 가상의 사기 사건',
  '퇴사한 직원이 가져간 고객 장부와 영업 비밀 여부를 다투는 가상의 사건'],
 property:[THEMES.property,'무인 세탁소 기계에서 사라진 현금과 출입 기록을 다투는 가상의 절도 사건',
  '택배 보관함에서 바뀐 물건과 수거 시각 기록을 다투는 가상의 재산 사건','공사장 자재 반출이 허락된 것이었는지를 다투는 가상의 절도 사건',
  '렌터카 반납 뒤 발견된 손상의 발생 시점을 다투는 가상의 재물손괴 사건'],
 family:[THEMES.family,'부모 부양 약속을 조건으로 한 증여의 취소를 다투는 가상의 가족 사건',
  '형제가 함께 운영하던 가게의 권리와 명의를 다투는 가상의 가족 사건','돌아가신 부모의 마지막 메모가 유언으로 볼 수 있는지를 다투는 가상의 상속 사건',
  '면접교섭 약속이 지켜지지 않은 경위를 양쪽 기록으로 다투는 가상의 가사 사건'],
 violence:[THEMES.violence,'아파트 주차장 시비 끝에 생긴 골절의 원인과 순서를 다투는 가상의 상해 사건',
  '술자리 뒤 계단에서 넘어진 사람의 부상이 밀쳐서 생긴 것인지를 다투는 가상의 사건','배달 기사와 손님 사이 몸싸움에서 누가 먼저 손을 댔는지를 다투는 가상의 폭행 사건',
  '스포츠 경기 중 반칙과 고의 폭행의 경계를 다투는 가상의 상해 사건'],
 reputation:[THEMES.reputation,'지역 맛집 리뷰에 적힌 위생 문제 글이 사실인지와 비방 목적을 다투는 가상의 사건',
  '학부모 단체 대화방에 올라온 교사에 관한 글의 전파 범위를 다투는 가상의 명예훼손 사건','유튜브 영상 속 편집된 발언이 허위 사실인지를 다투는 가상의 사건',
  '퇴사자 익명 후기 사이트 글의 작성자와 내용의 진실성을 다투는 가상의 사건'],
 public:[THEMES.public,'공공 체육시설 위탁 업체 선정에서 평가 점수 수정 경위를 다투는 가상의 사건',
  '불법 건축물 단속 정보가 미리 새어 나갔는지를 다투는 가상의 공무상비밀누설 사건','보조금 정산 서류의 영수증이 실제 지출과 맞는지를 다투는 가상의 사건',
  '민원 처리 지연이 고의였는지 업무 과중이었는지를 다투는 가상의 직무유기 사건'],
 professional:['병원 수술 동의서의 설명 내용과 실제 설명 시각을 다투는 가상의 의료 사건','세무 대리인이 신고에서 누락한 소득을 두고 책임 범위를 다투는 가상의 사건',
  '건축 감리 보고서와 실제 시공 사진이 맞지 않아 책임을 다투는 가상의 사건','약국 조제 기록과 복약 지도 내용을 다투는 가상의 사건']
});
const premiseFor=(category,random)=>{const list=VARIANTS[category]||[THEMES[category]];const h=[...String(random())].reduce((a,ch)=>Math.imul(a^ch.charCodeAt(0),16777619)>>>0,2166136261);return list[h%list.length]};
const allowed=Object.keys(VARIANTS);
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
async function runCloudStaging(env,{fetcher=fetch,now=()=>new Date(),random=()=>crypto.randomUUID(),generateCase=generate,trialQA=CloudTrialQA.run}={}){
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
  const result=await generateCase({id,category,premise:premiseFor(category,random)+
   ' — 증거 및 목격자의 관찰 범위를 구분하고 완전히 독립적인 가상 사실관계를 작성한다.'},{
   fetcher,apiKey:env.OPENAI_API_KEY,model:p.model});
  if(!result.ok||!result.candidate||!result.worldSheet)return {stage:'quarantine',created:0};
  // The browser QA remains a separate final gate, but an obviously broken
  // world must not even enter the private staging table.
  const trial=trialQA(result.worldSheet);
  if(!trial.ok)return {stage:'quarantine',created:0};
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
async function readiness(env,{fetcher=fetch}={}){
 const status={scheduled:env.TERRA_REFILL_ENABLED==='1',privateStock:false,draftStorage:false,budgetLedger:false,modelConfigured:!!env.MODEL_CASE};
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return status;
 try{await stockCounts(env,fetcher);status.privateStock=true}catch{}
 try{const x=await rpc(env,fetcher,'terra_pending_counts',{});status.draftStorage=!!x&&typeof x==='object'}catch{}
 try{const x=await rpc(env,fetcher,'refill_budget_snapshot',{});status.budgetLedger=Array.isArray(x)&&x.length>0}catch{}
 return status;
}
module.exports={runCloudStaging,policy,THEMES,VARIANTS,premiseFor,readiness};
