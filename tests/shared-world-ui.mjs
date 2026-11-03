/* P4 offline browser-level QA for read-only shared-world UI. No credentials or database.
 * Run: node tests/shared-world-ui.mjs
 */
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const source=await readFile(new URL('../shared_world.js',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true});
try{
 async function judge(id){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.setContent('<!doctype html><html><head></head><body><main>기존 법정은 유지</main></body></html>');
  await page.evaluate(id=>{
   window.VERDICT_CONFIG={p4SharedWorld:true,p4SharedDocket:true};
   window.__p4_lag=id==='judge-b'?11:0;
   window.VerdictAuth={online:true,user:{id},
    async api(path){
     if(path==='/world/catchup')return {ok:true,worldDay:33,previousDay:33-window.__p4_lag,lagDays:window.__p4_lag,protectedUntil:33,pending:[{case_id:'case-'+id,hearing_index:1,due_game_day:24,state:'scheduled'}]};
     if(path==='/world/resume'){window.__p4_lag=0;return {ok:true,resume:{world_day:33,protected_until_day:35,rescheduled_hearings:1}}}
     if(path==='/world/offers')return {ok:true,offers:[{case_id:'case-'+id,category:'civil',option_index:0},{case_id:'alt-'+id,category:'public',option_index:1}]};
     if(path==='/world/accept')return {ok:true,assignment:{case_id:'case-'+id}};
     if(path.startsWith('/world/case/initial'))return {ok:true,caseId:'case-'+id,records:[{id:'r1',title:'제출된 계약서',kind:'문서',text:'첫날 공개된 계약 내용'}]};
     if(path.startsWith('/world/case'))return {ok:true,case:{caseId:'case-'+id,card:{title:'법정의 계약 분쟁',summary:'원고의 계약 청구'},records:[{id:'r1',title:'제출된 계약서',first:true}]}};
     if(path.startsWith('/world/events'))return {ok:true,events:[{
      event_id:19,event_key:'case-assigned:p4-case',case_id:'p4-case',
      event_type:'case_assigned',game_day:33,public_data:{
       title:'<img src=x onerror=alert(1)> 공유 사건',summary:'두 판사에게 같은 공개 정보'
      }
     }]};
     if(path==='/world/clock')return {ok:true,clock:{id:'main',game_day:33,version:4}};
     if(path==='/world/npcs')return {ok:true,npcs:[{npc_id:'npc:test-001',public_profile:{name:'김가람',profession:'변호사'},life_status:'alive',effective_day:32,version:2}]};
     throw Error('unexpected '+path);
    }};
  },id);
  await page.addScriptTag({content:source});
  await page.waitForFunction(()=>window.VerdictSharedWorld?.events?.length===1);
  await page.getByRole('button',{name:'공유 세계 연혁 열기'}).click();
  assert.equal(await page.locator('.vsw-event img').count(),0,'HTML-looking news must be text only');
  assert.match(await page.locator('.vsw-event strong').innerText(),/<img src=x/);
  assert.match(await page.locator('[data-world-clock]').innerText(),/33일/);
  assert.match(await page.locator('[data-world-npcs]').innerText(),/김가람/);
  assert.match(await page.locator('main').innerText(),/기존 법정은 유지/);
  await page.evaluate(()=>window.VerdictSharedWorld.refresh());
  assert.equal(await page.locator('.vsw-event').count(),1,'refresh does not duplicate');
  await page.getByRole('button',{name:'사건 후보 2건 확인'}).click();
  await page.locator('[data-world-accept]').first().waitFor();
  assert.equal(await page.locator('[data-world-accept]').count(),2);
  await page.locator('[data-world-accept]').first().click();
  await page.waitForFunction(()=>!!window.VerdictSharedWorld.selectedCase);
  assert.match(await page.locator('[data-world-offers-list]').innerText(),/첫날 공개된 계약 내용/);
  const picked=await page.evaluate(()=>window.VerdictSharedWorld.selectedCase.caseId);
  assert.equal(picked,'case-'+id);
  const event=await page.evaluate(()=>window.VerdictSharedWorld.events[0]);
  return {page,event};
 }
 const a=await judge('judge-a'),b=await judge('judge-b');
 assert.deepEqual(a.event,b.event,'independent judges must see identical server facts');
 assert.equal(await a.page.locator('[data-world-resume]:visible').count(),0,'active judge has no catchup button');
 await b.page.waitForFunction(()=>window.VerdictSharedWorld.catchup?.lagDays===11);
 assert.match(await b.page.locator('[data-world-lag]').innerText(),/11일/);
 await b.page.locator('[data-world-resume]').click();
 await b.page.waitForFunction(()=>window.VerdictSharedWorld.catchup?.lagDays===0);
 assert.match(await b.page.locator('[data-world-lag]').innerText(),/35일/);
 assert.equal(await b.page.locator('[data-world-resume]:visible').count(),0,'no infinite grace extension');
 assert.equal(await a.page.locator('[data-world-resume]:visible').count(),0,'A progress unaffected');
 await a.page.close();await b.page.close();
 const anonymous=await browser.newPage();
 await anonymous.setContent('<html><head></head><body></body></html>');
 await anonymous.evaluate(()=>{window.VerdictAuth={online:false,user:null}});
 await anonymous.addScriptTag({content:source});
 assert.equal(await anonymous.locator('#verdict-shared-world').count(),0,'unauthenticated judge sees no panel');
 await anonymous.close();
 console.log('PASS P4 shared world UI: two judges, read-only, XSS-safe, deduplicated, anonymous blocked');
}finally{await browser.close()}
