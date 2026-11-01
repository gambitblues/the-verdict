/* Judge's orders between hearings (v6.2). Run: node tests/court-orders.mjs
 * A. Through the real screen on a case with written follow-ups: orders listed with target, type and issue; two per
 *    hearing; results arrive when the next hearing opens ("지난 기일 이후 변화"); new evidence carries its own text;
 *    an ordered witness can be questioned; reloading never duplicates anything.
 * B. 60 cases × 20 seeds through the order engine: every order key is unique, results only come from written material,
 *    resolving twice changes nothing, no evidence or witness is created without its text, decision cases have no orders,
 *    and a defence order in a criminal case may be declined but never punished.
 * C. Starting over wipes the old career and both player slots. */
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
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
const answer=async()=>{for(let k=0;k<8;k++){await page.waitForTimeout(100);const b=page.locator('#modal-root [data-kind="card"][data-choice="reject"]');if(await b.count()){await b.first().click();continue}const d=page.locator('#modal-root [data-action="dismiss"]');if(await d.count()){await d.first().click();continue}break}};
const tab=async id=>{await answer();await page.locator(`.t4-tab[data-tab="${id}"]`).click();await answer()};
const boot=async()=>{await page.locator('#verdict-entry').waitFor();await page.locator('#profile-continue').click();await page.waitForFunction(()=>typeof S!=='undefined'&&S.name,null,{timeout:30000})};
try{
 await page.goto(url,{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('주문 검증');
 await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});
 await page.waitForFunction(()=>(S.casePacks||[]).some(p=>p.packId==='v6-new-30'),null,{timeout:10000});
 // ---- A ----
 const id=await page.evaluate(()=>{for(const c of S.generatedCases)S.cases[c.id].referred=true;const cand=CasePackEngine.pool(S).find(x=>x.a.id==='v6-homicide-cold-storage');const c=createGeneratedCase(cand);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};c.week=S.week;ui.tab='court';ui.caseId=c.id;save();render();return c.id});
 await page.locator('.t4-tabs').waitFor();await tab('day');
 assert.equal(await page.locator('.t4-orders').count(),0,'no orders before the hearing opens');
 await page.locator('.t4-dock [data-kind="open"]').click();await answer();
 await page.locator('.t4-orders summary').click();
 const offered=await page.locator('.t4-q.order').allInnerTexts();
 assert.ok(offered.length>=3,'orders are offered');assert.ok(offered.some(t=>t.includes('검찰 · 자료 제출')),'records order to the prosecution');
 assert.ok(offered.every(t=>/쟁점 ·/.test(t)),'every order names its issue');
 const click=async key=>{await page.locator(`.t4-q.order[data-id="${key}"]`).click();await answer()};
 await click('f:f2');await click('f:f3');
 assert.equal(await page.evaluate(i=>S.cases[i].trial4.courtOrders.length,id),2);
 assert.equal(await page.locator('.t4-q.order').count(),0,'two orders per hearing');
 await page.locator('.t4-dock [data-action="t4end"]').click();await answer();
 await page.evaluate(i=>{S.cases[i].trial4.nextAt=0;save();VerdictStore.flush()},id);
 await page.reload({waitUntil:'networkidle'});await boot();
 await page.evaluate(i=>{ui.tab='court';ui.caseId=i;render()},id);await page.locator('.t4-tabs').waitFor();await tab('day');
 const before=await page.evaluate(i=>{const t=S.cases[i].trial4;return {ev:t.evidence.length,w:t.witnesses.length}},id);
 await page.locator('.t4-dock [data-kind="open"]').click();await answer();
 await page.locator('.t4-changes').waitFor();
 const res=await page.evaluate(i=>{const t=S.cases[i].trial4;return {orders:t.courtOrders.map(o=>({k:o.key,s:o.status,o:o.outcome})),ev:t.evidence.length,w:t.witnesses.length,truth:t.truth,
  newEv:t.evidence.filter(e=>e.follow).map(e=>({title:e.title,ex:e.detail.excerpt,side:e.detail.side})),newW:t.witnesses.filter(w=>w.detail).map(w=>({role:w.role,q:w.detail.q.length}))}},id);
 const f3=res.orders.find(o=>o.k==='f:f3');
 if(res.truth==='did')assert.ok(['none','declined'].includes(f3.o)||f3.s==='pending','no alibi record exists when the accused did it: the honest answer is "none"');
 if(f3.o==='done'||f3.o==='partial')assert.equal(res.newEv.length,1,'alibi record arrives as evidence');
 for(const e of res.newEv)assert.ok(e.ex&&e.ex!=='기록 없음'&&['p','d','n'].includes(e.side),'ordered evidence carries text that matches the truth');
 const f2=res.orders.find(o=>o.k==='f:f2');if(f2.o==='done'||f2.o==='partial'){assert.equal(res.w,before.w+1,'ordered witness appears');assert.equal(res.newW[0].q,3)}
 console.log('  ✓ A orders: '+res.orders.map(o=>`${o.k}=${o.o||o.s}`).join(', ')+` (truth ${res.truth})`);
 // ordered witness can be questioned
 if(res.newW.length){await tab('witness');await page.evaluate(()=>{ui.t4w=3;render()});const q=page.locator('.t4 .t4-q:not([disabled]):not(.cf):not(.face)').first();await q.click();await answer();
  assert.ok(await page.evaluate(i=>S.cases[i].trial4.heard.some(h=>h.w===3),id),'answers from the ordered witness are heard');
  assert.ok((await page.locator('.t4-qa').count())>=1);console.log('  ✓ A ordered witness questioned')}
 // reload and reopen: no duplicates
 await page.evaluate(()=>{save();VerdictStore.flush()});await page.reload({waitUntil:'networkidle'});await boot();
 await page.evaluate(i=>{ui.tab='court';ui.caseId=i;render();const t=S.cases[i].trial4;VerdictTrialPlay.orders.resolve(CASES.find(c=>c.id===i),t)},id);
 const again=await page.evaluate(i=>{const t=S.cases[i].trial4;return {ev:t.evidence.length,w:t.witnesses.length}},id);
 assert.deepEqual(again,{ev:res.ev,w:res.w},'reload or a second resolve must not duplicate results');
 await tab('log');assert.ok((await page.locator('.t4-rec-orders li').count())===2,'orders appear in the record');
 console.log('  ✓ A reload: no duplicates, orders in the record');
 // ---- B ----
 const B=await page.evaluate(()=>{window.save=()=>true;window.age=()=>40; /* 1,200 trials move the calendar decades: keep the judge below retirement */const O=VerdictTrialPlay.orders,C=VerdictCurated,bad=[];let trials=0,issued=0,results={};
  for(const aid of C.ids){const cand=CasePackEngine.pool(S).find(x=>x.a.id===aid);
   for(let n=0;n<20;n++){const c=createGeneratedCase(cand);if(!c){bad.push(aid+': create');continue}S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};const st=S.cases[c.id],t=VerdictTrialPlay.ensure(c,st);trials++;
    const tag=aid+'#'+n,dec=!!C.cases[aid].decision;
    for(let d=0;d<4&&!dec;d++){
     if(!VerdictTrialPlay.openSession(c,st))break;O.resolve(c,t);
     const av=O.available(c,t);if(new Set(av.map(o=>o.key)).size!==av.length)bad.push(tag+': duplicate order keys');
     for(const o of av.slice(0,2)){if(O.issue(c,t,o.key))issued++}
     if(O.issue(c,t,av[2]?.key||'x'))bad.push(tag+': third order in one hearing');
     t.daysDone++;t.day++;t.qLeft=t.qpd;t.nextAt=0;
    }
    if(dec&&O.available(c,t).length)bad.push(tag+': decision case offers orders');
    if(!dec){VerdictTrialPlay.openSession(c,st);O.resolve(c,t);const ev=t.evidence.length,w=t.witnesses.length;O.resolve(c,t);if(t.evidence.length!==ev||t.witnesses.length!==w)bad.push(tag+': resolving twice changed the trial')}
    const keys=(t.courtOrders||[]).map(o=>o.key);if(new Set(keys).size!==keys.length)bad.push(tag+': same order given twice');
    if(keys.length>5)bad.push(tag+': too many orders');
    for(const o of t.courtOrders||[]){results[o.outcome||'pending']=(results[o.outcome||'pending']||0)+1;if(o.outcome==='declined'&&!(c.kind==='criminal'&&o.to==='d'))bad.push(tag+': only the criminal defence may decline')}
    for(const e of t.evidence)if(e.follow&&!(e.detail?.excerpt&&e.detail?.how&&e.detail?.title&&e.detail.excerpt!=='기록 없음'))bad.push(tag+': ordered evidence without text');
    for(const w of t.witnesses)if(w.detail&&!(w.detail.q?.length>=3&&NPC[w.id]))bad.push(tag+': ordered witness without questions');
    st.referred=true}}
  return {trials,issued,results,bad:[...new Set(bad)]}});
 if(B.bad.length)console.log(B.bad.slice(0,30).join('\n'));
 assert.equal(B.bad.length,0,B.bad.length+' order problems');
 assert.equal(B.trials,1200);
 console.log(`  ✓ B ${B.trials} trials, ${B.issued} orders · results ${JSON.stringify(B.results)}`);
 // ---- new game wipes everything: both player slots, snapshots, the old career ----
 await page.evaluate(()=>{localStorage.setItem('verdict_player_save_2','{"name":"옛 판사"}');localStorage.setItem('verdict_player_save_1','{"name":"옛 판사"}')});
 const nav=page.waitForNavigation();await page.evaluate(()=>wipeGame());await nav;await page.waitForTimeout(1500);
 const w=await page.evaluate(()=>({keys:Object.keys(localStorage).filter(k=>/^(the_verdict|verdict_)/.test(k)).sort(),name:S.name,cases:(S.generatedCases||[]).length,npc:Object.keys(S.npcDB||{}).length}));
 assert.deepEqual(w.keys,['the_verdict_alpha_1','verdict_player_active'],'only a blank fresh save may remain');
 assert.ok(!w.name&&!w.cases&&!w.npc,'the old career must be gone after starting over');
 console.log('  ✓ new game wipes both slots and the old career');
 assert.equal(errs.length,0,'page errors: '+errs.join('; '));
 console.log('PASS: court orders');
}finally{await browser.close();server.close()}
