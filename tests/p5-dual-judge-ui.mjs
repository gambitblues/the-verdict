/* Two independent authenticated judge tabs, one canonical shared case.
 * Browser-only QA. Never uses a live Supabase project or saves.
 */
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const script=await readFile(new URL('../shared_world.js',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true});
try{
 const make=async(role)=>{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.setContent('<!doctype html><html lang="ko"><body><main>개인 재판은 독립</main></body></html>');
  await page.evaluate(role=>{
   window.VERDICT_CONFIG={p4SharedWorld:true,p4SharedDocket:true,p4CourtActions:true,
    p4SharedVerdicts:true,p5JointPanel:true,p4TrialParity:true};
   window.ui={tab:'courtList',p4NativeCourt:false};
   window.__majority=false;
   window.__rulings=[];
   const uid=role==='chair'?'judge-a':'judge-b';
   const everyone=[
    {seat:'chair',kind:'human',role:'presiding',id:'judge-a',name:'A 판사'},
    {seat:'peer',kind:'human',role:'associate',id:'judge-b',name:'B 판사'},
    {seat:'npc',kind:'npc',role:'associate',id:'npc:p5-001',name:'김법관'}
   ];
   const caseSheet={caseId:'case-p5-together',card:{kind:'civil',title:'공유 계약 사건',summary:'계약 위반 다툼'},
    common:{facts:['양쪽 당사자가 계약서를 작성함']},
    records:[{id:'r1',first:true,title:'계약서 원본'}],
    questions:[{id:'q1',w:'W1',q:'계약일은 언제입니까?'}],
    orders:[{record:'r2',ask:'계좌원본을 제출하시오'}]};
   const history=window.__courtHistory=[{action_type:'question',action_key:'q1',hearing_index:1,game_day:8,
    response:{status:'done',answer:'계약일은 1월 2일입니다.'}}];
   window.VerdictAuth={online:true,user:{id:uid},async api(path,payload){
    if(path==='/world/court/evidence/decide'){
     if(role!=='chair')throw Error('associate may not rule');
     const response={status:'done',recordId:payload.recordId,decision:payload.decision};
     history.push({action_type:'evidence_decision',action_key:payload.recordId+':'+payload.hearingIndex,
      hearing_index:payload.hearingIndex,game_day:8,response});
     return {ok:true,ruling:response};
    }
    if(path==='/world/panel/slot')return {ok:true,occupied:true,limit:1,caseId:'case-p5-together',role};
    if(path.startsWith('/world/panel/case?'))return {ok:true,case:caseSheet,
     records:[{id:'r1',title:'계약서 원본',kind:'문서',text:'계약서 공개 내용'}],
     actions:history,role:role==='chair'?'chair':'associate',
     court:{worldDay:8,hearingIndex:1,canAct:true,canObserve:true,canOpenHearing:role==='chair'}};
    if(path.startsWith('/world/panel/bench?'))return {ok:true,bench:{
     caseId:'case-p5-together',myRole:role==='chair'?'chair':'associate',
     canOpenHearing:role==='chair',canPublishJudgment:role==='chair',seats:everyone}};
    if(path.startsWith('/world/panel/status?'))return {ok:true,state:window.__majority?'majority_ready':'deliberating',votesCast:window.__majority?3:0,myVote:null,majority:window.__majority?'claim_granted':null};
    if(path.startsWith('/world/panel/partners?'))return {ok:true,players:[],npcs:[]};
    if(path.startsWith('/world/events'))return {ok:true,events:[{
     event_id:5,event_key:'joint-shared-case',case_id:'case-p5-together',
     event_type:'case_assigned',game_day:8,public_data:{title:'공동 사건 배당'}
    }]};
    if(path==='/world/clock')return {ok:true,clock:{game_day:8,version:3}};
    if(path==='/world/npcs')return {ok:true,npcs:[]};
    if(path==='/world/catchup')return {ok:true,worldDay:8,previousDay:8,lagDays:0,pending:[]};
    throw Error('unexpected '+path);
   }};
   window.VerdictNativeCourtRender=()=>{
    document.querySelector('main').innerHTML=window.VerdictSharedWorld.nativeCourt();
   };
  },role);
  await page.addScriptTag({content:script});
  await page.evaluate(()=>window.VerdictSharedWorld.open());
  await page.waitForFunction(()=>window.VerdictSharedWorld?.selectedCase?.caseId==='case-p5-together');
  const root=page.locator('[data-world-native-root]');
  await root.locator('[data-court-tab="case"]').click();
  await page.waitForFunction(()=>document.querySelector('.vsw-bench')?.textContent?.includes('김법관'));
  return {page,root};
 };
 const a=await make('chair'),b=await make('associate');
 const snapshotA=await a.page.evaluate(()=>window.VerdictSharedWorld.courtSnapshot());
 const snapshotB=await b.page.evaluate(()=>window.VerdictSharedWorld.courtSnapshot());
 assert.equal(snapshotA.caseId,snapshotB.caseId,'same server case');
 assert.equal(snapshotA.hearingIndex,snapshotB.hearingIndex,'same hearing index');
 assert.deepEqual(snapshotA.evidence,snapshotB.evidence,'same public evidence');
 assert.deepEqual(snapshotA.actions,snapshotB.actions,'same immutable action ledger');
 assert.equal(snapshotA.role,'chair');
 assert.equal(snapshotB.role,'associate');
 assert.equal(snapshotA.actions.length,1);
 assert.equal(snapshotA.evidence[0].source,'initial');
 assert.ok(!JSON.stringify(snapshotA).includes('worlds'),'no sealed truth in public projection');
 assert.match(await a.root.innerText(),/나는 재판장/);
 assert.match(await b.root.innerText(),/나는 배석판사/);
 for(const v of [a,b]){
  assert.match(await v.root.innerText(),/김법관/);
  assert.match(await v.root.innerText(),/NPC · 재판장 권한 없음/);
  assert.match(await v.root.innerText(),/계약 위반 다툼/);
  await v.root.locator('[data-court-tab="evidence"]').click();
  assert.match(await v.root.innerText(),/계약서 공개 내용/);
  if(v===a)assert.equal(await v.root.locator('[data-world-evidence="r1"]').count(),3,'chair can decide admissibility');
  else assert.equal(await v.root.locator('[data-world-evidence="r1"]').count(),0,'associate observes without final evidentiary authority');
  await v.root.locator('[data-court-tab="witness"]').click();
  assert.match(await v.root.innerText(),/계약일은 1월 2일입니다/);
 }
 assert.equal(await a.root.locator('[data-court-kind="question"]').count(),1,'chair may question witness');
 assert.equal(await b.root.locator('[data-court-kind="question"]').count(),1,'human associate participates in witness questioning after chair opens hearing');
 await a.root.locator('[data-court-tab="evidence"]').click();
 await a.root.locator('[data-world-evidence="r1"][data-evidence-decision="conditional"]').click();
 await a.page.waitForFunction(()=>document.querySelector('[data-world-native-root]')?.textContent?.includes('조건부 채택'));
 assert.equal((await a.page.evaluate(()=>window.VerdictSharedWorld.courtSnapshot())).actions.length,2,
  'admissibility ruling belongs to same immutable court log');
 await a.root.locator('[data-court-tab="day"]').click();
 await b.root.locator('[data-court-tab="day"]').click();
 assert.equal(await a.root.locator('[data-world-begin]').count(),1,'human chair opens the hearing');
 assert.equal(await b.root.locator('[data-world-begin]').count(),0,'human associate cannot open a hearing');
 await b.root.locator('[data-court-tab="verdict"]').click();
 assert.equal(await b.root.locator('[data-p5-vote]').count(),1,'associate can submit an independent vote');
 assert.equal(await b.root.locator('button[data-world-verdict]').count(),0,'associate cannot finalize judgment');
 await b.page.evaluate(()=>window.__majority=true);
 await b.root.locator('[data-p5-refresh]').click();
 await b.page.waitForFunction(()=>document.querySelector('[data-world-native-root]')?.textContent?.includes('합의 결과가 확정됐습니다'));
 assert.equal(await b.root.locator('button[data-world-verdict]').count(),0,'associate may never publish even after majority');
 assert.equal(await a.page.locator('main').innerText().then(x=>x.includes('개인 재판은 독립')),false);
 await a.page.close();await b.page.close();
 console.log('PASS P4/P5 two judge UI: same court/evidence, human chair authority, NPC associate, peer vote only');
}finally{await browser.close()}
