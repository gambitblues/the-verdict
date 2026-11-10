/* World-sheet cases in the normal courtroom (v8.1). Run: node tests/match-play.mjs
 * A. Every world sheet that is not one of the 60 written cases is registered in the written-case shape and joins the
 *    offer pool; the written cases with a sheet keep their own text.
 * B. A new sheet case (adv-cr-005) opens in the same courtroom as every other case: the six pages 사건 · 기일 · 증거 ·
 *    증인 · 주문 · 판결, no match-engine screen, no t.match. The case page shows 다툼 없는 사실 from the sheet; evidence
 *    shows the sheet's record text for the locked truth; witnesses answer from the sheet; the orders page offers the
 *    sheet's other records; played to a verdict through the normal verdict sheet.
 * C. Every sheet case × 3 seeds: created, trial state built, questions answered, orders resolved — no errors, no raw
 *    name tokens or [object Object] in what the screen would show.
 * D. A v8.0 save with a match-screen trial in progress restarts in the normal courtroom; a finished one stays readable. */
import { chromium } from 'playwright';
import {courtUI} from './lib/court-ui.mjs';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end('')}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const url='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
const shot=async n=>{if(process.env.SHOTS){await mkdir('qa-visuals',{recursive:true});await page.screenshot({path:`qa-visuals/sheet-${n}.png`})}};
const answer=()=>courtUI(page).settle();   // popups by kind, waiting on state (tests/lib/court-ui.mjs)
const tab=async id=>{await answer();await page.locator(`.t4-tab[data-tab="${id}"]`).click();await answer()};
const RAW=/\{[A-Z]\d?(?:[>|][^}]*)?\}|\[object Object\]|undefined/;
try{
 await page.goto(url,{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('시트 검증');
 await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});await page.evaluate(()=>VerdictCurated.loadAll());   // engine-level checks read every case at once; the game itself fetches one case at a time
 // ---- A ----
 const reg=await page.evaluate(()=>{const ids=Object.keys(VerdictSheets.cases).filter(id=>!VerdictSheets.cases[id].linked),pool=new Set(CasePackEngine.pool(S).map(x=>x.a.id));
  return {all:ids.length,inPool:ids.filter(id=>pool.has(id)).length,shaped:ids.filter(id=>VerdictCurated.cases[id]?.evidence?.length>=3&&VerdictCurated.cases[id]?.witnesses?.length>=2).length,
   fromSheet:ids.filter(id=>VerdictCurated.cases[id]?.fromSheet).length,written:ids.filter(id=>VerdictCurated.cases[id]&&!VerdictCurated.cases[id].fromSheet).length}});
 assert.equal(reg.inPool,reg.all,'every sheet case can be offered');
 assert.equal(await page.evaluate(()=>Object.keys(VerdictSheets.linked||{}).filter(id=>CasePackEngine.pool(S).some(x=>x.a.id===id)).length),0,'linked cases never join the open pool');
 assert.deepEqual(await page.evaluate(()=>Object.keys(VerdictSheets.linked||{}).filter(id=>!(VerdictCurated.cases[id]?.evidence?.length>=3&&VerdictCurated.cases[id]?.witnesses?.length>=2))),[],'linked cases are shaped for the courtroom too');assert.equal(reg.shaped,reg.all,'every sheet case has evidence and witnesses');
 console.log(`  ✓ ${reg.all} sheet cases: ${reg.fromSheet} from sheets + ${reg.written} written cases keep their own text, all in the pool`);
 // ---- B ----
 await page.evaluate(()=>{for(const c of S.generatedCases)S.cases[c.id].referred=true});
 const id=await page.evaluate(()=>{const cand=CasePackEngine.pool(S).find(x=>x.a.id==='adv-cr-005');const c=createGeneratedCase(cand);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};c.week=S.week;ui.tab='court';ui.caseId=c.id;save();render();return c.id});
 await page.locator('.t4-tabs').waitFor();
 const tabs=await page.locator('.t4-tab').evaluateAll(b=>b.map(x=>x.dataset.tab));
 assert.deepEqual(tabs,['case','day','evidence','witness','orders','verdict'],'the six courtroom pages');
 assert.equal(await page.evaluate(i=>!!S.cases[i].trial4?.match,id),false,'no match-engine state');
 await tab('case');const casePage=await page.locator('.t4-page').innerText();
 assert.ok(casePage.includes('다툼 없는 사실'),'case page shows the undisputed facts');assert.ok(!RAW.test(casePage),'case page has no raw tokens');await shot('case');
 const min=await page.evaluate(i=>S.cases[i].trial4.minDays,id);
 for(let d=0;d<min;d++){
  await tab('day');const open=page.locator('.t4-dock [data-kind="open"]');if(await open.count())await open.click();await answer();
  await tab('evidence');if(d===0)await shot('evidence');
  const ex=await page.locator('.t4-excerpt, .ev-doc, .t4-page').first().innerText();assert.ok(!RAW.test(ex),'evidence text resolved for the truth');
  const use=page.locator('.t4 [data-kind="decide"][data-choice="conditional"]:not([disabled])').first();if(await use.count())await use.click();await answer();
  await tab('witness');const ask=page.locator('.t4-pager .t4-q:not([disabled])').first();if(await ask.count())await ask.click();await answer();if(d===0)await shot('witness');
  assert.ok(await page.locator('.t4-qa').count()>=1,'a witness answered');
  await tab('orders');if(d===0){await shot('orders');const ord=await page.locator('.t4-q.order').allTextContents();assert.ok(ord.some(t=>t.includes('로그')||t.includes('자료')||t.includes('기록')),'orders offer the sheet records');
   const o=page.locator('.t4-q.order').first();if(await o.count()){await o.dispatchEvent('click');await answer()}}
  await page.locator('.t4-dock [data-action="t4end"]').click();await page.locator('#modal-root [data-action="t4end"][data-ok]').click();   /* v8.2.1: ending a session asks first */await answer();
  await page.evaluate(i=>{S.cases[i].trial4.nextAt=0;render()},id);
 }
 const txt=await page.evaluate(i=>JSON.stringify(S.cases[i].trial4.heard||[])+JSON.stringify(S.cases[i].trial4.evidence.map(e=>e.title)),id);assert.ok(!/\[object Object\]/.test(txt),'nothing unresolved in the trial record');
 await tab('verdict');await answer();
 await page.locator('[data-action="t4sheet"][data-v="open"]').click();await page.locator('.t4-verdict [data-action="t4verdict"]').last().click();
 for(let k=0;k<4&&!(await page.locator('.t4-sheet .t4-cite').count());k++)await page.locator('.t4-sheet-foot .btn.primary').click();
 await page.locator('.t4-sheet .t4-cite').first().click();
 for(let k=0;k<6;k++){const go=page.locator('.t4-sheet [data-action="t4confirm"], .t4-sheet-foot .btn.primary').last();if(!await go.count())break;await go.click();await page.waitForTimeout(120);if(await page.evaluate(i=>!!S.cases[i].verdict,id))break;const f=page.locator('.t4-sheet [data-action="t4factor"], .t4-sheet [data-action="t4sent"]').first();if(await f.count())await f.click()}
 const v=await page.evaluate(i=>({v:S.cases[i].verdict,final:!!S.cases[i].trial4.final}),id);
 assert.ok(v.v&&v.final,'verdict through the normal verdict sheet');await answer();
 console.log('  ✓ adv-cr-005 in the normal courtroom: six pages, undisputed facts, sheet evidence/witnesses/orders, verdict');
 // ---- C ----
 const many=await page.evaluate(()=>{const out=[];const VP=VerdictTrialPlay;
  for(const sid of Object.keys(VerdictSheets.cases))for(let k=0;k<3;k++){S.rng=(S.rng||1)+11;const cand=CasePackEngine.pool(S).find(x=>x.a.id===sid);let c;
   try{c=createGeneratedCase(cand)}catch(e){out.push(sid+': '+e.message);continue}
   S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};const st=S.cases[c.id];
   try{const t=VP.ensure(c,st);if(t.match)out.push(sid+': match state');
    const texts=[];t.witnesses.forEach((w,i)=>{for(const q of VP.questions(c,t,i))texts.push(VP.tell(c,t,typeof q.a==='object'?(q.a[t.truth]??q.a.reason):q.a))});
    for(const e of t.evidence)texts.push(e.title,e.note||'',e.scope||'');
    VP.orders.available(c,t);
    const bad=texts.find(x=>/\{[A-Z]\d?(?:[>|][^}]*)?\}|\[object Object\]|undefined/.test(x));if(bad)out.push(sid+': raw text '+bad.slice(0,60));
   }catch(e){out.push(sid+': '+e.message)}
   st.referred=true}
  return out});
 assert.deepEqual(many,[],'every sheet case builds a normal trial');
 console.log(`  ✓ ${reg.all} sheet cases × 3 seeds build normal trials (witness answers, evidence, orders)`);
 // ---- C2 v10.7: witnesses answer as the person they are; facts never invented, what was said never changes ----
 const C2=await page.evaluate(()=>{const VP=VerdictTrialPlay,bad=[],modes={},byTruth={};let owned=0,covers=0;
  for(const sid of Object.keys(VerdictSheets.cases))for(let k=0;k<6;k++){S.rng=(S.rng||1)+7;const cand=CasePackEngine.pool(S).find(x=>x.a.id===sid);if(!cand)continue;
   const c=createGeneratedCase(cand);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};const st=S.cases[c.id],t=VP.ensure(c,st),cur=VP.curOf(c);
   VP.openSession(c,st);t.qLeft=40;
   t.witnesses.forEach((w,i)=>{for(const q of VP.questions(c,t,i).slice(0,3))VP.ask(c,t,i,q.id)});
   const before=t.heard.map((h,j)=>({j,txt:(()=>{if(h.text)return h.text;const q=VP.qById(c,t,h.w,h.q);return q?VP.citables(c,t).find(x=>x.key==='h:'+j)?.text:''})()}));
   const bt=byTruth[t.truth]??={n:0,vague:0,hold:0,cf:0};
   for(const h of t.heard){if(/^(cf|face):/.test(h.q))continue;bt.n++;if(h.mode==='vague')bt.vague++}
   /* a reload keeps every word: the save round-trips through JSON and the court reads the same answers */
   {const keep=JSON.stringify(st.trial4),txt=VP.citables(c,t).map(x=>x.text).join('|');st.trial4=JSON.parse(keep);const t2=VP.ensure(c,st);
    if(VP.citables(c,t2).map(x=>x.text).join('|')!==txt)bad.push(sid+': answers changed after a reload')}
   for(const h of t.heard){modes[h.mode||'plain']=(modes[h.mode||'plain']||0)+1;
    if(h.mode==='cover'){covers++;const q=VP.qById(c,t,h.w,h.q),k=cur.witnesses[h.w].covers==='p'?'did':'didnt';if(!q||typeof q.a!=='object'||!(k in q.a))bad.push(sid+': a cover answer not borrowed from the sheet')}}
   // show a contradicting exhibit to a shielding witness until they own up; earlier words stay as they were
   t.witnesses.forEach((w,i)=>{if(w.attitude!=='protect'||!t.heard.some(h=>h.w===i&&h.mode==='cover'))return;
    for(const e of t.evidence){if(w.owned)break;const n=t.heard.length;VP.confront?.(c,t,i,e.id);}
    if(w.owned){owned++;const q=VP.questions(c,t,i).find(v=>!w.askedIds.includes(v.id)&&typeof v.a==='object');if(q){VP.ask(c,t,i,q.id);const h=t.heard[t.heard.length-1];if(h.mode==='cover')bad.push(sid+': still lying after owning up')}}});
   // every witness, shown every record: how often do they stand firm when it contradicts them?
   t.qLeft=99;t.witnesses.forEach((w,i)=>{for(const e of t.evidence){if(w.owned)break;const n=t.heard.length;VP.confront?.(c,t,i,e.id);const h=t.heard[n];if(h?.pressed){bt.cf++;if(/바꾸지 않은/.test(h.label||''))bt.hold++}}});
   for(const x of before){const now=VP.citables(c,t).find(y=>y.key==='h:'+x.j);if(now&&x.txt&&now.text!==x.txt)bad.push(sid+': an answer changed after it was given')}
   st.referred=true}
  return {bad:[...new Set(bad)].slice(0,10),modes,owned,covers,byTruth}});
 assert.deepEqual(C2.bad,[],'person-driven testimony');
 assert.ok((C2.modes.cover||0)>0&&(C2.modes.vague||0)>0,'shielding and frightened witnesses both appear: '+JSON.stringify(C2.modes));
 /* v10.9: a witness's manner is no answer key — how often witnesses hedge, and how often they stand firm when shown
  * a record that contradicts what they said, must look the same whichever way the case really went (a record that
  * agrees with them moves nobody, in any world) */
 const share=x=>Object.fromEntries(Object.entries(C2.byTruth).map(([k,v])=>[k,+(x(v)).toFixed(3)]));
 const vg=share(v=>v.vague/Math.max(1,v.n)),hd=share(v=>v.hold/Math.max(1,v.cf));
 const spread=o=>Math.max(...Object.values(o))-Math.min(...Object.values(o));
 assert.ok(spread(vg)<0.05,'hedging must not depend on the truth: '+JSON.stringify(vg));
 assert.ok(spread(hd)<0.15,'standing firm must not depend on the truth: '+JSON.stringify(hd));
 assert.ok((C2.modes.slip||0)>0,'an honest witness sometimes mixes something up');
 console.log(`  ✓ witnesses answer as the person they are · ${JSON.stringify(C2.modes)} · owned up after evidence ${C2.owned} · hedging by truth ${JSON.stringify(vg)} · standing firm ${JSON.stringify(hd)} · same words after reload`);
 // ---- D ----
 const d=await page.evaluate(()=>{const cand=CasePackEngine.pool(S).find(x=>x.a.id==='adv-cr-010');const c=createGeneratedCase(cand);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};
  const st=S.cases[c.id];const t=VerdictTrialPlay.ensure(c,st);t.match={format:'verdict-match/v1',truth:t.truth,log:[],records:{},witnesses:{}};ui.tab='court';ui.caseId=c.id;render();
  return {reset:!S.cases[c.id].trial4?.match,tabs:[...document.querySelectorAll('.t4-tab')].map(b=>b.dataset.tab).length}});
 assert.ok(d.reset&&d.tabs===6,'a v8.0 match trial without a verdict restarts in the normal courtroom');
 console.log('  ✓ v8.0 save with a match-screen trial in progress → normal courtroom');
 assert.deepEqual(errs,[],'no page errors');
 console.log('PASS sheet cases in the normal courtroom');
}finally{await browser.close();server.close()}
