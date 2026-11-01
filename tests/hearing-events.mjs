/* Party materials on the hearing page (hearing_events.js) through the real screen, 390px and 412px (Fold folded).
 * The defendant question opens the case's own written questions (no stock dialogue); a reflection letter is recorded
 * once; civil cases see only the settlement material. Screenshots: qa-visuals/hearing-events-*.png */
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end()}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const url='http://127.0.0.1:'+server.address().port+'/';
await mkdir(path.join(base,'qa-visuals'),{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const [name,w,h] of [['iphone',390,844],['fold-folded',412,915]]){
  const page=await browser.newPage({viewport:{width:w,height:h},isMobile:true,hasTouch:true});
  await page.addInitScript(()=>{try{localStorage.setItem('verdict_match_off','1')}catch{}});   // this test covers the scripted trial; match trials: tests/match-play.mjs
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  const answer=async()=>{for(let k=0;k<8;k++){await page.waitForTimeout(80);const b=page.locator('#modal-root [data-kind="card"][data-choice="reject"]');if(await b.count()){await b.first().dispatchEvent('click');continue}const d=page.locator('#modal-root [data-action="dismiss"]');if(await d.count()){await d.first().dispatchEvent('click');continue}break}await page.evaluate(()=>{if(ui.modal){ui.modal='';render()}})};
  await page.goto(url,{waitUntil:'networkidle'});
  await page.locator('#profile-continue').click();await page.locator('#playerName').fill('공판 자료');
  await page.locator('[data-action="start"]').last().click();
  await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});
  await page.waitForFunction(()=>(S.casePacks||[]).some(p=>p.packId==='v6-new-30'),null,{timeout:10000});await answer();
  const open=async caseKey=>{const id=await page.evaluate(k=>{for(const c of S.generatedCases)S.cases[c.id].referred=true;const cand=CasePackEngine.pool(S).find(x=>x.a.id===k);const c=createGeneratedCase(cand);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};c.week=S.week;ui.tab='court';ui.caseId=c.id;save();render();return c.id},caseKey);
   await page.locator('.t4-tabs').waitFor();await page.locator('.t4-tab[data-tab="day"]').click();await answer();
   await page.locator('.t4-dock [data-kind="open"]').click();await answer();await page.locator('.t4-tab[data-tab="day"]').click();await answer();return id};
  // criminal
  const id=await open('v6-homicide-cold-storage');
  const labels=await page.locator('[data-action="t4hearing"]').allTextContents();
  assert.deepEqual(labels.sort(),['반성문 제출 및 내용 확인','피고인에게 직접 질문','합의·피해회복 자료 확인'].sort(),name+': three materials offered');
  await page.locator('[data-action="t4hearing"][data-id="defendant_question"]').click();await answer();
  assert.equal(await page.evaluate(()=>ui.t4tab),'witness',name+': defendant question opens the witness page');
  assert.ok(await page.locator('details.t4-party[open]').count(),name+': the case\'s own party questions are open');
  assert.equal(await page.evaluate(i=>(S.cases[i].hearingEvents||[]).length,id),0,name+': no stock dialogue recorded');
  await page.locator('.t4-tab[data-tab="day"]').click();await answer();
  await page.locator('[data-action="t4hearing"][data-id="reflection"]').click();await answer();
  assert.equal(await page.evaluate(i=>S.cases[i].hearingEvents.length,id),1,name+': reflection recorded');
  assert.equal(await page.locator('[data-action="t4hearing"][data-id="reflection"]').count(),0,name+': reflection offered once');
  const panel=page.locator('section.panel.t4:has-text("당사자가 낸 자료")');await panel.scrollIntoViewIfNeeded();
  const o=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));assert.ok(o.sw<=o.cw+1,name+': no sideways scroll');
  await panel.screenshot({path:`qa-visuals/hearing-events-${name}-criminal.png`});
  // civil: only the settlement material
  await open('v6-civil-shaded-roof');
  assert.deepEqual(await page.locator('[data-action="t4hearing"]').allTextContents(),['합의·피해회복 자료 확인'],name+': civil case sees settlement only');
  assert.deepEqual(errs,[],name+': no page errors');
  console.log('  ✓',name);
  await page.close();
 }
 console.log('PASS hearing-page party materials');
}finally{await browser.close();server.close()}
