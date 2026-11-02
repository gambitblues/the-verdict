// v8.2 courtroom checks: objections during questioning (before / after the answer), weak vs excluded testimony,
// the five-step verdict window (6-month terms, suspension years, death and life where the law allows, damages in
// 100만 원 steps and typed amounts), the '판결' button opening the window, and the judgment reaching people's lives.
// Run: ln -sfn "$(npm root -g)" node_modules && node tests/verdict-v82.mjs; rm node_modules
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
const modalUp=()=>page.locator('#modal-root .modal').waitFor();
const modalGone=()=>page.waitForFunction(()=>!ui.modal);
const shot=async n=>{if(SHOT)await page.screenshot({path:`${SHOT}/v82-${n}.png`})};
const newCase=async aid=>{await U.settle();return page.evaluate(aid=>{for(const c of S.generatedCases)S.cases[c.id].referred=true;const cand=CasePackEngine.pool(S).find(x=>x.a.id===aid);const c=createGeneratedCase(cand);
 S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};c.week=S.week;ui.tab='court';ui.caseId=c.id;save();render();return c.id},aid)};
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('판결 검증');
 await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});
 await page.waitForFunction(()=>(S.generatedCases||[]).length>0,null,{timeout:30000});await U.settle();

 // ---- A. objections during questioning
 let id=await newCase('v6-homicide-cold-storage');
 await page.locator('.t4-tabs').waitFor();
 await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4;t.cards=[{id:'b1',type:'objection',dressed:true,skillSet:true,valid:false,otype:'relevance',w:0,live:true,at:1}];save();render()});
 await page.locator('.t4-tab[data-tab="day"]').click();await U.openSession();
 assert.equal(await page.locator('#modal-root [data-kind="card"]').count(),0,'a live objection does not come up before the session');
 await page.evaluate(()=>{ui.t4tab='witness';ui.t4w=0;render()});
 const q0=await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4;return t.qLeft});
 await page.locator('.t4-pager .t4-q:not([disabled])').first().click();await modalUp();
 const before=await page.locator('#modal-root .t4-excerpt').innerText();
 assert.ok(/답하기 전에/.test(before)&&!/답변/.test(before),'leading/relevance objection is ruled on before the answer');
 assert.ok(await page.locator('#modal-root [data-choice="reject"]').innerText().then(t=>/증인이 답함/.test(t)),'plain choice labels');
 await shot('objection-before');
 await page.locator('#modal-root [data-kind="card"][data-choice="reject"]').click();await modalGone();
 let st=await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4;return {q:t.qLeft,heard:t.heard.length}});
 assert.equal(st.q,q0-1,'overruled: the witness answers and the question is used');assert.equal(st.heard,1,'answer in the record');
 // hearsay: ruled after the answer
 await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4;t.cards.push({id:'a1',type:'objection',dressed:true,skillSet:true,valid:true,otype:'hearsay',w:0,live:true,at:1});save();ui.t4w=1;render()});
 await page.locator('.t4-pager .t4-q:not([disabled])').first().click();await modalUp();
 const after=await page.locator('#modal-root .t4-excerpt').innerText();
 assert.ok(/답변/.test(after),'hearsay objection shows the answer');
 await page.locator('#modal-root [data-kind="card"][data-choice="accept"]').click();await modalGone();
 st=await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4;return {tainted:t.heard.filter(h=>h.tainted).length,obj:t.witnesses.flatMap(w=>w.objections||[]).map(o=>o.kept)}});
 assert.equal(st.tainted,0,'sustained hearsay never reaches the record');assert.deepEqual(st.obj,[false],'kept on the witness as struck');
 // kept over an objection: weak, citable, half weight
 await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4;t.cards.push({id:'a2',type:'objection',dressed:true,skillSet:true,valid:true,otype:'hearsay',w:2,live:true,at:1});save();ui.t4w=2;render()});
 await page.locator('.t4-pager .t4-q:not([disabled])').first().click();await modalUp();
 await page.locator('#modal-root [data-kind="card"][data-choice="reject"]').click();await modalGone();
 assert.equal(await page.evaluate(()=>S.cases[ui.caseId].trial4.heard.filter(h=>h.tainted).length),1,'overruled hearsay stays (weak)');
 console.log('  ✓ objections: before the answer (leading/relevance), after it (hearsay); sustained = out, overruled = kept');

 // ---- B. verdict window: murder (death and life allowed, no suspension)
 id=await newCase('v6-homicide-parking-14');await page.locator('.t4-tabs').waitFor();
 await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4;t.daysDone=t.minDays;t.evidence.forEach(e=>e.decision='use');
  t.heard.push({w:0,q:'obj:x',side:'p',issue:'i1',day:1,tainted:true,label:'전해 들은 말',ask:'그날 무엇을 들었습니까?',said:'그렇게 됐다고 들었습니다.'});save();render()});
 await page.evaluate(()=>{ui.t4tab='verdict';ui.vsheet=ui.caseId;ui.vstep=0;render()});

 const guilty=await page.evaluate(()=>{const c=CASES.find(x=>x.id===ui.caseId);return c.verdicts.find(o=>/유죄|인정/.test(o.label)&&!/무죄/.test(o.label))?.id||c.verdicts[0].id});
 await page.locator(`[data-action="t4verdict"][data-id="${guilty}"]`).click();await page.locator('.t4-steps li').nth(1).waitFor();
 const steps=await page.locator('.t4-steps li').allInnerTexts();
 assert.equal(steps.length,5,'five steps: 결론 주문 이유 미리보기 선고');
 const types=await page.locator('.t4-sheet-body [data-k="type"]').allInnerTexts();
 assert.ok(types.includes('사형')&&types.includes('무기징역'),'murder offers death and life');assert.ok(!types.includes('징역(집행유예)'),'no suspension above 3 years');
 assert.ok(/집행유예/.test(await page.locator('.t4-sheet-body').innerText()),'says why suspension is not offered');
 const m0=await page.evaluate(()=>ui.t4v.months);await page.locator('.t4-sheet-body [data-k="months"][data-v="6"]').click();
 assert.equal(await page.evaluate(()=>ui.t4v.months),m0+6,'prison moves in 6 months');assert.equal((m0+6)%6,0,'on the 6-month grid');
 await shot('verdict-sentence');
 await page.locator('.t4-sheet-body [data-k="type"][data-v="death"]').click();
 await page.locator('.t4-sheet-foot [data-action="t4sheet"]').last().click();   // → 판결 이유
 await page.locator('.t4-cite').first().click();
 assert.ok(await page.locator('.t4-cite.weak').count()>=1,'the weak testimony is listed and marked');
 await page.locator('.t4-sheet-foot [data-action="t4sheet"]').last().click();   // → 미리보기
 assert.ok(/사형에 처한다/.test(await page.locator('.t4-judgment').innerText()),'preview shows the judgment with its order');
 await shot('verdict-preview');
 await page.locator('.t4-sheet-foot [data-action="t4sheet"]').last().click();   // → 선고
 assert.equal(await page.locator('.t4-sheet-body').innerText().then(t=>/남길 말/.test(t)),false,'no words-to-the-parties choice');
 await page.locator('[data-action="t4confirm"]').click();await page.waitForFunction(()=>!!S.cases[ui.caseId].verdict);
 let life=await page.evaluate(id=>{const c=CASES.find(x=>x.id===id),p=NPC[c.who[0]];return {res:p.residence,status:p.legalStatus,career:p.career,text:document.querySelector('.t4')?.innerText||''}},id);
 assert.equal(life.res,'교정시설');assert.match(life.status,/사형/);assert.equal(life.career,'복역 중');
 console.log('  ✓ murder: 5 steps, death/life offered, no suspension, 6-month terms, preview, life after the verdict');

 // ---- C. civil: 100만 원 steps, typed amount, rest of the claim dismissed, money moves
 id=await newCase('v6-civil-shaded-roof');await page.locator('.t4-tabs').waitFor();
 await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4;t.daysDone=t.minDays;t.evidence.forEach(e=>e.decision='use');ui.t4tab='verdict';ui.vsheet=ui.caseId;ui.vstep=0;render()});
 const part=await page.evaluate(()=>{const c=CASES.find(x=>x.id===ui.caseId);return (c.verdicts.find(o=>/일부/.test(o.label))||c.verdicts[0]).id});
 await page.locator(`[data-action="t4verdict"][data-id="${part}"]`).click();await page.locator('.t4-steps li').nth(1).waitFor();
 if(await page.locator('[data-k="amount"]').count()){
  const a0=await page.evaluate(()=>ui.t4v.amount);await page.locator('[data-k="amount"][data-v="1"]').click();
  assert.equal(await page.evaluate(()=>ui.t4v.amount),a0+10,'+100만 원');
  await page.locator('[data-t4input="setAmount"]').fill('1234');await page.locator('[data-t4input="setAmount"]').press('Enter');await page.waitForFunction(()=>ui.t4v.amount===1234);
  assert.equal(await page.evaluate(()=>ui.t4v.amount),1234,'typed amount (만 원)');
  await shot('verdict-amount');
 }
 const B0=await page.evaluate(id=>{const c=CASES.find(x=>x.id===id);return NPC[c.who[1]].wealth},id);
 await page.locator('.t4-sheet-foot [data-action="t4sheet"]').last().click();await page.locator('.t4-cite').first().click();
 await page.locator('.t4-sheet-foot [data-action="t4sheet"]').last().click();
 const doc=await page.locator('.t4-judgment').innerText();assert.match(doc,/지급하라/);assert.match(doc,/나머지 청구를 기각한다/);
 await page.locator('.t4-sheet-foot [data-action="t4sheet"]').last().click();await page.locator('[data-action="t4confirm"]').click();await page.waitForFunction(()=>!!S.cases[ui.caseId].verdict);
 const B1=await page.evaluate(id=>{const c=CASES.find(x=>x.id===id);return NPC[c.who[1]].wealth},id);
 assert.ok(B1<B0,'the defendant pays: wealth goes down');
 console.log('  ✓ civil: 100만 원 steps, typed amount, rest dismissed, money moves');

 // ---- D. '판결' on the dock opens the verdict window
 id=await newCase('v6-violence-rescue-push');await page.locator('.t4-tabs').waitFor();
 await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4;t.daysDone=t.minDays;t.day=t.minDays+1;t.nextAt=Date.now()+60000;ui.t4tab='day';ui.vsheet=null;render()});
 const vb=page.locator('.t4-dock [data-tab="verdict"][data-sheet]');assert.ok(await vb.count(),'dock offers 판결');await vb.first().click();
 assert.ok(await page.locator('.t4-sheet').count(),'판결 opens the verdict window directly');
 console.log('  ✓ 판결 button opens the window');
 // ---- E. ending a session asks first; 계속 진행하기 keeps the session open (v8.2.1)
 id=await newCase('v6-violence-final-bout');await page.locator('.t4-tabs').waitFor();
 await page.evaluate(()=>{ui.t4tab='day';ui.vsheet=null;render()});await U.openSession();
 await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4;t.cards=[];save();render()});   // no delay requests in the way of the end button
 const day0=await page.evaluate(()=>S.cases[ui.caseId].trial4.daysDone);
 await page.locator('.t4-dock [data-action="t4end"]').click();await modalUp();
 assert.match(await page.locator('#modal-root').innerText(),/마칠까요/,'asks before ending');await shot('end-confirm');
 await page.locator('#modal-root [data-action="dismiss"]').first().click();await modalGone();
 assert.equal(await page.evaluate(()=>S.cases[ui.caseId].trial4.daysDone),day0,'계속 진행하기 keeps the session');
 await page.locator('.t4-dock [data-action="t4end"]').click();await page.locator('#modal-root [data-action="t4end"][data-ok]').click();await page.waitForFunction(d=>S.cases[ui.caseId].trial4.daysDone===d+1,day0);await U.settle();
 assert.equal(await page.evaluate(()=>S.cases[ui.caseId].trial4.daysDone),day0+1,'마치기 ends it');
 console.log('  ✓ ending a session asks first');
 // ---- F. sheet cases: the accuser's version, closing and sentencing request; no victim where there is none (v8.2.3)
 id=await newCase('adv-cr-001');await page.locator('.t4-tabs').waitFor();await page.evaluate(()=>{ui.t4tab='case';ui.vsheet=null;render()});
 const casePage=await page.locator('.t4-case').innerText();
 assert.match(casePage,/공소사실/,'the prosecution\'s version is on the case page');assert.match(casePage,/피해자\s*따로 없음/,'a victimless case says so');
 await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4;t.daysDone=t.minDays;ui.t4tab='verdict';render()});
 const close=await page.locator('.t4-closing').first().innerText();assert.match(close,/"[^"]{10,}"/,'closing argument is there');assert.match(close,/구형: \S+/,'sentencing request is there');
 console.log('  ✓ sheet case: 공소사실, closing, 구형, no made-up victim');
 assert.deepEqual(errs,[]);
 console.log('PASS: v8.2 courtroom and verdict');
}catch(e){console.error(e);console.error('page errors',errs);process.exitCode=1}
finally{await browser.close();server.close()}
