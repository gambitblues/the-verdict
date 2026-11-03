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
   window.VerdictAuth={online:true,user:{id},
    async api(path){
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
  const event=await page.evaluate(()=>window.VerdictSharedWorld.events[0]);
  return {page,event};
 }
 const a=await judge('judge-a'),b=await judge('judge-b');
 assert.deepEqual(a.event,b.event,'independent judges must see identical server facts');
 await a.page.close();await b.page.close();
 const anonymous=await browser.newPage();
 await anonymous.setContent('<html><head></head><body></body></html>');
 await anonymous.evaluate(()=>{window.VerdictAuth={online:false,user:null}});
 await anonymous.addScriptTag({content:source});
 assert.equal(await anonymous.locator('#verdict-shared-world').count(),0,'unauthenticated judge sees no panel');
 await anonymous.close();
 console.log('PASS P4 shared world UI: two judges, read-only, XSS-safe, deduplicated, anonymous blocked');
}finally{await browser.close()}
