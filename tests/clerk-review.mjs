// v8.7.4 재판연구원 의견 and 판결 작성 검토 (verdict tab).
//  - the clerk card appears only when a verdict is possible, folds open, reads only the court record (same words for
//    the same record), never names a verdict, and its buttons show unchecked material and the legal standard
//  - the draft review in 미리보기/선고 flags reasons that do not support the chosen conclusion (advice: may proceed)
//  - a legally impossible order (stale/edited screen state) blocks the sentence; fixing it lets the judge sentence
// Run: ln -sfn "$(npm root -g)" node_modules && node tests/clerk-review.mjs; rm node_modules
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {courtUI} from './lib/court-ui.mjs';
const base=process.cwd(),SHOT=process.env.SHOT||'';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end()}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const browser=await chromium.launch({headless:true});
const W=Number(process.env.W||390);
const page=await browser.newPage({viewport:{width:W,height:W>600?1004:844},deviceScaleFactor:SHOT?2:1});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
const U=courtUI(page);
const shot=async n=>{if(SHOT)await page.screenshot({path:`${SHOT}/clerk-${W}-${n}.png`,fullPage:false})};
const newCase=async aid=>{await U.settle();return page.evaluate(aid=>{for(const c of S.generatedCases)S.cases[c.id].referred=true;const cand=CasePackEngine.pool(S).find(x=>x.a.id===aid);const c=createGeneratedCase(cand);
 S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};c.week=S.week;ui.tab='court';ui.caseId=c.id;save();render();return c.id},aid)};
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('연구원 검증');
 await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});
 await page.waitForFunction(()=>(S.generatedCases||[]).length>0,null,{timeout:30000});await U.settle();
 await newCase('v6-homicide-cold-storage');await page.locator('.t4-tabs').waitFor();

 // not yet: no clerk card before the minimum hearings
 await page.evaluate(()=>{ui.t4tab='verdict';render()});
 assert.equal(await page.locator('.t4-clerk').count(),0,'no clerk opinion before a verdict is possible');

 // a record: one side's evidence used, the rest undecided
 await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4;t.daysDone=t.minDays;t.evidence.forEach((e,i)=>{e.decision=i<2?'use':null});ui.t4tab='verdict';ui.clerk=null;render()});
 await page.locator('.t4-clerk').waitFor();
 assert.equal(await page.locator('.t4-clerk-body').count(),0,'folded at first');
 await page.locator('.t4-clerk-head').click();await page.locator('.t4-clerk-body').waitFor();
 const said=await page.locator('.t4-clerk-body').innerText();
 assert.ok(said.split('\n').filter(l=>/[.다]$/.test(l.trim())).length<=4,'short: a few sentences');
 assert.ok(!/(유죄|무죄|인용|기각)(을|를|이|가)?\s*(선고|해야|하셔야|하는 게)/.test(said),'never tells the judge which verdict to give');
 const truth=await page.evaluate(()=>S.cases[ui.caseId].trial4.truth);
 assert.ok(!said.includes(String(truth)),'no hidden truth');
 await shot('open');
 // same record → same words
 await page.evaluate(()=>render());assert.equal(await page.locator('.t4-clerk-body p').first().innerText(),said.split('\n')[0]);
 // unchecked material
 await page.locator('.t4-clerk [data-v="gaps"]').click();
 assert.match(await page.locator('.t4-clerk-list').innerText(),/쓸지 정하지 않은 증거/);
 await shot('gaps');
 // legal standard
 await page.locator('.t4-clerk [data-v="law"]').click();
 assert.match(await page.locator('.t4-clerk-list').innerText(),/합리적인 의심/);
 assert.match(await page.locator('.t4-clerk-list').innerText(),/법정형/);
 // evidence button goes to the evidence tab (six menus unchanged)
 await page.locator('.t4-clerk [data-tab="evidence"]').click();
 assert.equal(await page.evaluate(()=>ui.t4tab),'evidence');
 assert.equal(await page.locator('.t4-tab').count(),6,'still six trial menus');
 console.log('  ✓ clerk opinion: only after the minimum hearings, folded, record-only, gaps and legal standard, evidence link');

 // draft review: guilty with only defence-side reasons → advice, may still sentence
 const info=await page.evaluate(()=>{const c=CASES.find(x=>x.id===ui.caseId),t=S.cases[ui.caseId].trial4;
  t.evidence.forEach(e=>e.decision='use');
  const guilty=c.verdicts.find(o=>VerdictTrialCore.direction(o,c.kind)==='convict')?.id;
  return {guilty}});
 await page.evaluate(()=>{ui.t4tab='verdict';ui.vsheet=ui.caseId;ui.vstep=0;render()});
 await page.locator(`[data-action="t4verdict"][data-id="${info.guilty}"]`).click();await page.locator('.t4-steps li').nth(1).waitFor();
 await page.locator('.t4-sheet-foot [data-action="t4sheet"]').last().click();   // → 판결 이유
 const keys=await page.evaluate(()=>[...document.querySelectorAll('.t4-cite')].map(b=>b.dataset.v));
 const side=await page.evaluate(()=>{const c=CASES.find(x=>x.id===ui.caseId),t=S.cases[ui.caseId].trial4;return VerdictTrialPlay.citables(c,t).map(i=>[i.key,i.side])});
 const con=side.filter(([,s])=>s==='d').map(([k])=>k);
 if(con.length){
  for(const k of con)await page.locator(`.t4-cite[data-v="${k}"]`).click();
  await page.locator('.t4-sheet-foot [data-action="t4sheet"]').last().click();   // → 미리보기
  await page.locator('.t4-review').waitFor();
  assert.match(await page.locator('.t4-review').innerText(),/뒷받침하는 자료가 없어요/);
  await shot('review-advice');
  await page.locator('.t4-sheet-foot [data-action="t4sheet"]').last().click();   // → 선고
  assert.equal(await page.locator('[data-action="t4confirm"]').isDisabled(),false,'advice only: the judge may still sentence');
  await page.locator('.t4-sheet-foot [data-action="t4sheet"]').first().click();await page.locator('.t4-sheet-foot [data-action="t4sheet"]').first().click();
  for(const k of con)await page.locator(`.t4-cite[data-v="${k}"]`).click();
 }
 const pro=side.filter(([,s])=>s==='p').map(([k])=>k).slice(0,2);assert.ok(pro.length||keys.length);
 for(const k of (pro.length?pro:keys.slice(0,1)))await page.locator(`.t4-cite[data-v="${k}"]`).click();
 await page.locator('.t4-sheet-foot [data-action="t4sheet"]').last().click();
 await page.locator('.t4-sheet-foot [data-action="t4sheet"]').last().click();   // → 선고
 // a stale/edited state outside the law: 징역 above the statutory maximum → blocked
 const cap=await page.evaluate(()=>{const v=ui.t4v;v.type='prison';v.months=99*12;render();return v.months});
 assert.equal(cap,1188);
 await page.locator('.t4-review.bad').waitFor();
 assert.match(await page.locator('.t4-review.bad').innerText(),/선고할 수 없어요/);
 assert.equal(await page.locator('[data-action="t4confirm"]').isDisabled(),true,'a legally impossible order cannot be sentenced');
 await page.evaluate(()=>VerdictTrialPlay.confirm?.());
 assert.equal(await page.evaluate(()=>!!S.cases[ui.caseId].verdict),false,'confirm itself refuses too');
 await shot('review-block');
 await page.evaluate(()=>{ui.t4v.months=36;render()});
 await page.locator('[data-action="t4confirm"]').click();await page.waitForFunction(()=>!!S.cases[ui.caseId].verdict);
 console.log('  ✓ draft review: reasons vs conclusion advice (may proceed), impossible orders blocked, then sentenced');
 assert.deepEqual(errs,[]);
 console.log('PASS: clerk opinion and draft review');
}finally{await browser.close();server.close()}
