// v8.3: a case's own witness questions and court orders (from its world sheet), ancillary orders with a criminal
// conviction (only where the law allows; the rest greyed with the reason), civil remedies besides money (only what was
// claimed), and the parties' lives after the judgment in the case's own words.
// Run: ln -sfn "$(npm root -g)" node_modules && node tests/verdict-v83.mjs; rm node_modules   (SHOT=dir for screenshots)
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {courtUI} from './lib/court-ui.mjs';
const base=process.cwd(),SHOT=process.env.SHOT||'';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end('')}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:SHOT?2:1});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
const U=courtUI(page);
const shot=async n=>{if(SHOT)await page.screenshot({path:`${SHOT}/v83-${n}.png`})};
const newCase=async(aid,truth)=>{await U.settle();const id=await page.evaluate(aid=>{for(const c of S.generatedCases)S.cases[c.id].referred=true;const cand=CasePackEngine.pool(S).find(x=>x.a.id===aid);const c=createGeneratedCase(cand);
 S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};c.week=S.week;ui.tab='court';ui.caseId=c.id;save();render();return c.id},aid);
 await page.locator('.t4-tabs').waitFor();if(truth)await page.evaluate(t=>{S.cases[ui.caseId].trial4.truth=t;save()},truth);return id};
const toVerdict=()=>page.evaluate(()=>{const t=S.cases[ui.caseId].trial4;t.daysDone=t.minDays;t.evidence.forEach(e=>e.decision='use');ui.t4tab='verdict';ui.vsheet=ui.caseId;ui.vstep=0;render()});
const pickOption=async re=>{const id=await page.evaluate(src=>{const re=new RegExp(src),c=CASES.find(x=>x.id===ui.caseId);return (c.verdicts.find(o=>re.test(o.label))||c.verdicts[0]).id},re.source);
 await page.locator(`[data-action="t4verdict"][data-id="${id}"]`).click();await page.locator('.t4-steps li').nth(1).waitFor()};
const next=()=>page.locator('.t4-sheet-foot [data-action="t4sheet"]').last().click();
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('v8.3 검증');
 await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});
 await page.waitForFunction(()=>(S.generatedCases||[]).length>0,null,{timeout:30000});await U.settle();

 // ---- A. the case's own questions come first; a question tied to an order opens only when that record arrives
 // v10.1: a party may file the hallway video on its own at the first hearing (filing card). This part checks the order
 // path, so it uses a case where that did not happen (a different case id gives a different filing roll).
 for(let n=0;n<6;n++){
  await newCase('adv-cr-001','didnt');
  await U.tab('day');await U.openSession();
  if(!await page.evaluate(()=>S.cases[ui.caseId].trial4.evidence.some(e=>e.follow==='s3')))break;
 }
 await U.tab('witness');await page.evaluate(()=>{ui.t4w=0;render()});
 const first=await page.locator('.t4-pager .t4-card').first().locator('.t4-q').first().innerText();
 assert.match(first,/1월 11일 받은 30만 원/,'the sheet\'s own question is first');
 const hidden=await page.evaluate(()=>{const c=CASES.find(x=>x.id===ui.caseId),t=S.cases[ui.caseId].trial4;return VerdictTrialPlay.qBy?null:t.witnesses.length});
 const before=await page.evaluate(()=>{ui.t4w=1;render();return [...document.querySelectorAll('.t4-pager .t4-card')].map(c=>c.innerText).join(' ')});
 assert.ok(!/영상에서 다시 보면/.test(before),'the video question waits for the hallway video');
 await U.tab('orders');const own=await page.locator('.t4-q.order').allInnerTexts();
 assert.ok(own.some(t=>/4층 복도 영상/.test(t)),'the sheet\'s own order wording');
 assert.equal(await U.order(page.locator('.t4-q.order').filter({hasText:'4층 복도 영상'}).first()),1);
 await U.tab('day');await U.endSession();await page.evaluate(()=>{S.cases[ui.caseId].trial4.nextAt=0;render()});
 await U.tab('day');await U.openSession();
 // The court may grant a one-hearing delay even when the world's fixed result is 'done'.
 // Assert that a delay is truly pending (not a lost order), then finish the next hearing.
 let orderState=await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4,o=t.courtOrders[0];return {day:t.day,due:o?.due,status:o?.status,outcome:o?.outcome,delayed:o?.delayed}});
 if(orderState.outcome===null){
  assert.equal(orderState.status,'pending','a null order outcome must still be pending');
  assert.equal(orderState.delayed,true,'the order must be explicitly marked delayed');
  assert.equal(orderState.due,orderState.day+1,'a late order must be due the next hearing');
  await U.tab('day');await U.endSession();await page.evaluate(()=>{S.cases[ui.caseId].trial4.nextAt=0;render()});
  await U.tab('day');await U.openSession();
  orderState=await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4,o=t.courtOrders[0];return {day:t.day,due:o?.due,status:o?.status,outcome:o?.outcome,delayed:o?.delayed}});
 }
 assert.equal(orderState.status,'done','the order is eventually completed');
 assert.equal(orderState.outcome,'done','didnt world: the defence hands the video over');
 await U.tab('witness');const after=await page.evaluate(()=>{ui.t4w=1;render();return document.querySelector('.t4-pager')?.innerText||''});
 assert.match(after,/영상에서 다시 보면/,'the video question opens once the video is in');
 await shot('own-questions');
 console.log('  ✓ own questions first, an order-gated question opens after the record arrives, own order wording and result');

 // ---- B. ancillary orders with a sex-crime conviction
 await newCase('adv-cr-006','did');await toVerdict();await pickOption(/유죄|성립|인정/);
 const sent=await page.locator('.t4-sheet-body').innerText();
 for(const w of ['성폭력 치료프로그램 이수명령','취업제한명령','공개·고지명령','부착명령','신상정보 등록'])assert.ok(sent.includes(w),'ancillary order listed: '+w);
 assert.match(sent,/검사가 부착명령을 청구하지 않아/,'an unavailable order says why');
 assert.equal(await page.locator('[data-k="addon"][data-v="tag"]').count(),0,'the unavailable order cannot be pressed');
 await page.locator('[data-k="addon"][data-v="program"]').click();await page.locator('[data-k="addonN"][data-v="program:1"]').click();
 assert.equal(await page.evaluate(()=>ui.t4v.addons.program),60,'hours move by the step');
 await page.evaluate(()=>document.querySelector('.t4-addons')?.scrollIntoView({block:'center'}));await shot('addons');
 await next();await page.locator('.t4-cite').first().click();await next();
 const doc=await page.locator('.t4-judgment').innerText();
 assert.match(doc,/60시간의 성폭력 치료프로그램 이수를 명한다/);assert.match(doc,/신상정보 등록대상자가 된다/);
 assert.ok(!/취업제한을 명한다/.test(doc),'an order not chosen is not in the judgment');
 await next();await page.locator('[data-action="t4confirm"]').click();await page.waitForFunction(()=>!!S.cases[ui.caseId].verdict);
 const items=await page.evaluate(()=>S.cases[ui.caseId].trial4.final.items.filter(i=>/^addon:/.test(i.key)).map(i=>i.key+':'+i.points));
 assert.ok(items.includes('addon:job:-2'),'leaving out an order the law expects costs points ('+items+')');
 const life=await page.locator('.t4').first().innerText();assert.match(life,/판결 뒤 당사자들의 삶[\s\S]*해고/,'the case\'s own after-life lines');
 console.log('  ✓ ancillary orders: listed by law, unavailable greyed with the reason, chosen in the judgment, expected ones scored, life after');

 // ---- C. civil remedy besides money, only what was claimed
 await newCase('v6-civil-shaded-roof','reason');await toVerdict();await pickOption(/일부/);
 assert.ok(await page.locator('[data-k="remedy"][data-v="lower"]').count(),'the claimed remedy is offered');
 await page.locator('[data-k="remedy"][data-v="lower"]').click();await page.locator('.t4-addons').scrollIntoViewIfNeeded();await shot('remedy');
 await next();await page.locator('.t4-cite').first().click();await next();
 const doc2=await page.locator('.t4-judgment').innerText();
 assert.match(doc2,/지급하라\. 피고는 그 건물 옥상의 태양광 구조물 꼭대기를 지금보다 1미터 낮추라\./);assert.match(doc2,/나머지 청구를 기각한다/);
 await next();await page.locator('[data-action="t4confirm"]').click();await page.waitForFunction(()=>!!S.cases[ui.caseId].verdict);
 const ritems=await page.evaluate(()=>S.cases[ui.caseId].trial4.final.items.filter(i=>/^remedy:/.test(i.key)).map(i=>i.points));
 assert.deepEqual(ritems,[3],'a remedy the record supports scores');
 assert.deepEqual(await page.evaluate(()=>S.cases[ui.caseId].sentenced.remedies),['lower'],'the remedy is kept with the judgment');
 console.log('  ✓ civil remedy: offered as claimed, in the order with the money, scored by the record');

 // ---- D. a criminal case with no extras is unchanged
 await newCase('v6-violence-rescue-push');await toVerdict();await pickOption(/유죄|인정/);
 assert.equal(await page.locator('.t4-addons').count(),0,'no extras block where the case has none');
 assert.deepEqual(errs,[]);
 console.log('PASS: v8.3 own questions, own orders, ancillary orders, remedies, life after');
}catch(e){console.error(e);console.error('page errors',errs);process.exitCode=1}
finally{await browser.close();server.close()}
