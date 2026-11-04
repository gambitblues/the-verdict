/* P5 UI smoke: existing judge session → joint bench → private vote → NPC →
 * majority final judgment. No real accounts, API calls, or production saves. */
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await readFile(new URL('../shared_world.js',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.setContent('<!doctype html><html lang="ko"><body><main>개인 법정</main></body></html>');
 await page.evaluate(()=>{
  window.confirm=()=>true;
  window.VERDICT_CONFIG={
   p4SharedWorld:true,p4SharedDocket:true,p4CourtActions:true,
   p4SharedVerdicts:true,p4TrialParity:true,p5JointPanel:true
  };
  window.__p5={created:false,votes:0,published:false,requests:[]};
  window.VerdictAuth={online:true,user:{id:'judge-chair'},async api(path,body){
   window.__p5.requests.push(path);
   const state=window.__p5;
   if(path==='/world/panel/slot')return {ok:true,occupied:state.created,caseId:state.created?'case-p5':null,limit:1};
   if(path==='/world/panel/auto-assign'){state.created=true;return {ok:true,caseId:'case-p5',existing:false}}
   if(path==='/world/offers')return {ok:true,offers:[
    {case_id:'case-p5',category:'civil'},{case_id:'case-extra',category:'civil'}
   ]};
   if(path==='/world/accept')return {ok:true,assignment:{case_id:'case-p5'}};
   if(path.startsWith('/world/case/initial'))return {ok:true,records:[
    {id:'r1',title:'계약서 원본',text:'체결된 계약 내용',kind:'문서'}
   ]};
   if(path.startsWith('/world/case?'))return {ok:true,case:{
    caseId:'case-p5',card:{kind:'civil',title:'계약 불이행',
     summary:'계약상의 손해배상',claim:{amount:1000,fair:[500,850]}},
    records:[{id:'r1',title:'계약서 원본',first:true}],
    questions:[{id:'q1',w:'W1',q:'계약을 보셨습니까?'}],orders:[]
   }};
   if(path.startsWith('/world/court/status'))return {ok:true,canAct:false,hearingIndex:1,worldDay:8};
   if(path.startsWith('/world/court/history'))return {ok:true,actions:[
    {action_type:'question',action_key:'q1',hearing_index:1,
     response:{status:'done',answer:'계약 체결을 직접 봤습니다.'}}
   ]};
   if(path.startsWith('/world/panel/bench'))return {ok:true,bench:{
    caseId:'case-p5',myRole:'chair',canOpenHearing:true,canPublishJudgment:true,
    seats:[
     {seat:'chair',kind:'human',role:'presiding',id:'judge-chair',name:'내 판사'},
     {seat:'peer',kind:'human',role:'associate',id:'00000000-0000-0000-0000-00000000000b',name:'동료 판사'},
     {seat:'npc',kind:'npc',role:'associate',id:'npc:test-01',name:'NPC 배석'}
    ]}};
   if(path.startsWith('/world/panel/case?'))return {ok:true,
    role:'chair',court:{worldDay:8,hearingIndex:1,canAct:true,canObserve:true},
    case:{caseId:'case-p5',card:{kind:'civil',title:'계약 불이행',summary:'계약상의 손해배상',claim:{amount:1000,fair:[500,850]}},
     records:[{id:'r1',title:'계약서 원본',first:true}],
     questions:[{id:'q1',w:'W1',q:'계약을 보셨습니까?'}],orders:[]},
    records:[{id:'r1',title:'계약서 원본',text:'체결된 계약 내용',kind:'문서'}],
    actions:[{action_type:'question',action_key:'q1',hearing_index:1,
     response:{status:'done',answer:'계약 체결을 직접 봤습니다.'}}]
   };
   if(path.startsWith('/world/panel/status')){
    if(!state.created)throw Error('panel_not_found');
    return {ok:true,state:state.votes===3?'majority_ready':'deliberating',
     votesCast:state.votes,myVote:state.votes>=1?'claim_granted':null,
     majority:state.votes===3?'claim_granted':null};
   }
   if(path.startsWith('/world/panel/partners'))return {ok:true,players:[{
    id:'00000000-0000-0000-0000-00000000000b',name:'다른 기존 판사'
   }],npcs:[{id:'npc:test-01',name:'NPC 재판관'}]};
   if(path==='/world/panel/open'){
    if(body.peerId!=='00000000-0000-0000-0000-00000000000b'||body.npcId!=='npc:test-01')
     throw Error('wrong_members');
    state.created=true;return {ok:true,created:true};
   }
   if(path==='/world/panel/vote'){
    if(!state.created||body.choice!=='claim_granted'||!body.note)throw Error('bad_vote');
    state.votes=1;return {ok:true,created:true};
   }
   if(path==='/world/panel/npc/decide'){
    if(state.votes!==2)throw Error('human_votes_pending');
    state.votes=3;return {ok:true,submitted:true};
   }
   if(path==='/world/panel/finalize'){
    if(state.votes!==3||body.result!=='claim_granted'||
       !body.citations.includes('initial:r1')||body.sentence?.amount!==1000)
     throw Error('invalid_finalization');
    state.published=true;
    return {ok:true,judgment:{order:'피고는 원고에게 1,000만 원을 지급하라.',
     grade:{score:72,review:74}}};
   }
   if(path.startsWith('/world/events'))return {ok:true,events:[]};
   if(path==='/world/clock')return {ok:true,clock:{game_day:4,version:1}};
   if(path==='/world/npcs')return {ok:true,npcs:[]};
   if(path.startsWith('/world/catchup'))return {ok:true,catchup:{lagDays:0,worldDay:4,pending:[]}};
   throw Error('unexpected '+path);
  }};
 });
 await page.addScriptTag({content:source});
 // P5 auto assignment enters a dedicated sixth slot, not the personal 5 cases
 // and not a manually accepted hourly offer.
 await page.evaluate(()=>{
  window.ui={tab:'courtList',p4NativeCourt:false};
  window.VerdictNativeCourtRender=()=>{
   document.querySelector('main').innerHTML=window.VerdictSharedWorld.nativeCourt()
  };
  window.VerdictSharedWorld.open();
 });
 await page.waitForFunction(()=>window.VerdictSharedWorld?.selectedCase?.caseId==='case-p5');
 const root=page.locator('main [data-world-native-root]');
 await root.locator('[data-court-tab="verdict"]').click();
 await root.locator('[data-p5-refresh]').waitFor();
 assert.match(await root.innerText(),/NPC · 재판장 권한 없음/);
 assert.match(await root.innerText(),/나는 재판장/);
 await page.waitForFunction(()=>window.__p5.created===true);
 await root.locator('[data-p5-choice]').selectOption('claim_granted');
 await root.locator('[data-p5-note]').fill('제출된 계약서와 증인의 진술을 검토했습니다.');
 await root.locator('[data-p5-vote]').click();
 await page.waitForFunction(()=>window.__p5.votes===1);
 assert.match(await root.innerText(),/다른 재판관 의견 대기/);
 assert.equal(await root.locator('[data-p5-decide]').count(),0,'NPC waits for the second human');
 await page.evaluate(()=>{window.__p5.votes=2});
 await root.locator('[data-p5-refresh]').click();
 await root.locator('[data-p5-decide]').click();
 await page.waitForFunction(()=>window.__p5.votes===3);
 assert.match(await root.innerText(),/다수 의견 성립/);
 assert.equal(await root.locator('button[data-world-verdict]').count(),1,'delayed bench may finalize after global clock moves');
 await root.locator('[data-cite="initial:r1"]').check();
 await root.locator('[data-v-amount]').fill('1000');
 await root.locator('button[data-world-verdict]').click();
 await page.waitForFunction(()=>window.__p5.published===true);
 assert.doesNotMatch(await root.innerText(),/종합 평점 74점/,'individual grades remain hidden until the nine-month career review');
 assert.equal(await root.locator('[data-p5-vote]').count(),0);
 console.log('PASS P5 native court UI: private humans → metered NPC flow → majority → scored verdict');
 await page.close();
}finally{await browser.close()}
