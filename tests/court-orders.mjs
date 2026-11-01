/* Judge's orders between hearings (v6.2). Run: node tests/court-orders.mjs
 * A. Through the real screen on a case with written follow-ups: orders listed with target, type and issue; two per
 *    hearing; results arrive when the next hearing opens ("지난 기일 이후 변화"); new evidence carries its own text;
 *    an ordered witness can be questioned; reloading never duplicates anything.
 * B. 60 cases × 30 seeds (SEEDS=n) played through every hearing the case allows, asking questions so follow-up nodes
 *    open: no duplicate orders or results, results only from written material (with provenance), resolving twice
 *    changes nothing, ordered witnesses are new living adults, only a criminal defence may decline, decision cases only
 *    get on-the-spot questions. Reports how often a case-specific choice is open (gate 90%), the share of orders that
 *    come from the case's own nodes (gate 50%) and each outcome (none·partial·late·declined, 20+ each).
 * D. 20 representative cases (10 of importance 4~5) through the real screen for 3~5 hearings.
 * C. Starting over wipes the old career and both player slots. */
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.cwd(),SEEDS=Number(process.env.SEEDS||30);
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
 // ---- B: 60 cases × 30 seeds, played through every hearing the case allows ----
 const B=await page.evaluate(SEEDS=>{window.save=()=>true;window.age=()=>40; /* thousands of trials move the calendar decades: keep the judge below retirement */
  const TP=VerdictTrialPlay,O=TP.orders,C=VerdictCurated,bad=[],year_=year();
  let trials=0,issued=0,ownIssued=0,hearings=0,meaningful=0,lastDays={},kinds={},byDay={},maxDay=0;
  const add=(o,k,n=1)=>o[k]=(o[k]||0)+n;
  for(const aid of C.ids){const cand=CasePackEngine.pool(S).find(x=>x.a.id===aid),dec=!!C.cases[aid].decision;
   for(let n=0;n<SEEDS;n++){const c=createGeneratedCase(cand);if(!c){bad.push(aid+': create');continue}
    S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};const st=S.cases[c.id],t=TP.ensure(c,st);trials++;
    const tag=aid+'#'+n,cast=new Set([...c.who,c.side?.[0],t.opponent,...t.witnesses.map(w=>w.id)].filter(Boolean)),last=dec?1:t.minDays+2;
    for(let d=1;d<=last;d++){
     if(!TP.openSession(c,st))break;O.resolve(c,t);
     for(const x of t.changes?.day===t.day?t.changes.items:[]){add(kinds,x.kind);if(/\{[A-Z]|undefined|null|NaN/.test(x.text))bad.push(tag+': template leak in a result: '+x.text.slice(0,60))}
     // ask what can be asked today, a different witness first on each seed
     for(let k=0;k<12&&t.qLeft>0;k++){const i=(k+n)%t.witnesses.length,q=TP.questions(c,t,i).find(v=>!t.witnesses[i].askedIds.includes(v.id));if(q)TP.ask(c,t,i,q.id)}
     const av=O.available(c,t),own=av.filter(o=>o.key.startsWith('f:'));
     if(new Set(av.map(o=>o.key)).size!==av.length)bad.push(tag+': duplicate order keys');
     if(d<last){hearings++;add(byDay,d);if(own.length||dec)meaningful++}
     // case-specific orders first, then whatever is left, rotating with the seed
     const pick=[...own,...av.filter(o=>!o.key.startsWith('f:'))];
     for(let k=0;k<2&&pick.length;k++){const o=pick.splice(n%pick.length&&k?n%pick.length:0,1)[0];if(O.issue(c,t,o.key)){issued++;if(o.key.startsWith('f:'))ownIssued++}}
     if(!dec&&O.issue(c,t,O.available(c,t)[0]?.key||'x'))bad.push(tag+': third order in one hearing');
     if(dec)for(const x of t.changes?.items||[])add(kinds,'now-'+x.kind);
     t.daysDone++;t.day++;t.qLeft=t.qpd;t.nextAt=0;maxDay=Math.max(maxDay,d);
    }
    add(lastDays,dec?'decision':Math.min(t.daysDone,6));
    if(!dec){O.resolve(c,t);const ev=t.evidence.length,w=t.witnesses.length;O.resolve(c,t);if(t.evidence.length!==ev||t.witnesses.length!==w)bad.push(tag+': resolving twice changed the trial')}
    if(dec&&(t.courtOrders||[]).some(o=>!o.now))bad.push(tag+': a decision case got a between-hearings order');
    const keys=(t.courtOrders||[]).map(o=>o.key);if(new Set(keys).size!==keys.length)bad.push(tag+': same order given twice');
    if(keys.length>6)bad.push(tag+': too many orders');
    const fev=t.evidence.filter(e=>e.follow).map(e=>e.follow),fw=t.witnesses.filter(w=>w.follow).map(w=>w.follow);
    if(new Set(fev).size!==fev.length||new Set(fw).size!==fw.length)bad.push(tag+': one order produced two results');
    for(const w of t.witnesses){const ex=w.extra||[];if(new Set(ex).size!==ex.length)bad.push(tag+': recall questions opened twice')}
    for(const o of t.courtOrders||[]){if(o.outcome)add(kinds,'final-'+o.outcome);if(o.outcome==='declined'&&!(c.kind==='criminal'&&o.to==='d'))bad.push(tag+': only the criminal defence may decline')}
    for(const e of t.evidence)if(e.follow&&!(e.detail?.excerpt&&e.detail?.how&&e.detail?.title&&e.detail?.caveat&&e.detail.excerpt!=='기록 없음'))bad.push(tag+': ordered evidence without its text or provenance');
    for(const w of t.witnesses)if(w.follow){const p=NPC[w.id];if(!(w.detail?.q?.length>=3&&p))bad.push(tag+': ordered witness without questions');else{if(year()-p.bornYear<20)bad.push(tag+": ordered witness is "+(year()-p.bornYear));if(cast.has(w.id))bad.push(tag+': ordered witness already has a role in this case');if(p.alive===false)bad.push(tag+': ordered witness is dead')}}
    st.referred=true}}
  return {trials,issued,ownIssued,hearings,meaningful,lastDays,kinds,byDay,maxDay,bad:[...new Set(bad)]}},SEEDS);
 if(B.bad.length){const g={};for(const b of B.bad){const k=b.replace(/^[^:]+: /,'').slice(0,50);g[k]=(g[k]||0)+1}console.log(g);console.log(B.bad.slice(0,15).join('\n'))}
 assert.equal(B.bad.length,0,B.bad.length+' order problems');
 assert.equal(B.trials,60*SEEDS);
 const ratio=B.meaningful/B.hearings,own=B.ownIssued/B.issued;
 console.log(`  ✓ B ${B.trials} trials · ${B.hearings} hearings with orders open · case-specific choice available ${(ratio*100).toFixed(1)}% · orders given ${B.issued}, from the case's own nodes ${(own*100).toFixed(1)}%`);
 console.log(`    hearings reached ${JSON.stringify(B.lastDays)} · results ${JSON.stringify(B.kinds)}`);
 assert.ok(ratio>=0.9,'a case-specific choice should be open in 90%+ of hearings');
 assert.ok(own>=0.5,'at least half of the orders given should come from the case\'s own nodes');
 // ---- B2: a defence that will not hand material over in a criminal trial — what it says and what it changes ----
 const B2=await page.evaluate(()=>{const TP=VerdictTrialPlay,O=TP.orders,C=VerdictCurated,bad=[];let declined=0,partial=0,tried=0;
  for(const aid of C.ids.filter(id=>C.cases[id].charge)){const cand=CasePackEngine.pool(S).find(x=>x.a.id===aid);
   for(let n=0;n<60&&declined<40;n++){const c=createGeneratedCase(cand);if(!c)continue;S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};const st=S.cases[c.id],t=TP.ensure(c,st);
    for(let d=1;d<=3;d++){if(!TP.openSession(c,st))break;O.resolve(c,t);
     for(let k=0;k<12&&t.qLeft>0;k++){const i=k%t.witnesses.length,q=TP.questions(c,t,i).find(v=>!t.witnesses[i].askedIds.includes(v.id));if(q)TP.ask(c,t,i,q.id)}
     const o=O.available(c,t).find(x=>x.to==='d'&&x.key.startsWith('f:')&&x.type!=='explain'&&x.type!=='recall');if(o&&O.issue(c,t,o.key))tried++;
     t.daysDone++;t.day++;t.qLeft=t.qpd;t.nextAt=0}
    TP.openSession(c,st);O.resolve(c,t);
    for(const o of t.courtOrders||[]){
     if(o.outcome==='declined'){declined++;const ev=t.evidence.find(e=>e.follow===o.follow),x=(t.log||[]).map(l=>l.text||'').join(' ');
      if(ev)bad.push(aid+': a refused order still produced evidence');if(!/불리하게 볼 수도 없어요/.test(x))bad.push(aid+': refusal must say it cannot count against the accused');
      if(t.heard.some(h=>h.q===o.key))bad.push(aid+': refusal recorded as testimony')}
     if(o.outcome==='partial'){partial++;const ev=t.evidence.find(e=>e.follow===o.follow);if(ev&&!(/\(일부\)/.test(ev.title)&&/단정할 수 없다/.test(ev.detail.caveat)))bad.push(aid+': partial material must say it is partial')}}
    st.referred=true}}
  return {declined,partial,tried,bad:[...new Set(bad)]}});
 assert.equal(B2.bad.length,0,B2.bad.join('; '));
 console.log(`  ✓ B2 defence orders in criminal trials ${B2.tried} · refused ${B2.declined} (no evidence, no penalty, said so) · partial ${B2.partial}`);
 B.kinds.declined=(B.kinds.declined||0)+B2.declined;
 for(const k of ['none','partial','late','declined'])assert.ok((B.kinds[k]||0)>=20,`outcome "${k}" seen only ${B.kinds[k]||0} times (need 20+)`);
 // ---- D: 20 representative cases through the real screen, 3~5 hearings each ----
 const D=await page.evaluate(()=>{const C=VerdictCurated;const imp=id=>CasePackEngine.pool(S).find(x=>x.a.id===id)?.a?.importance||3;
  const ids=C.ids.filter(id=>!C.cases[id].decision);return [...ids.filter(id=>imp(id)>=4).slice(0,10),...ids.filter(id=>imp(id)<4).slice(0,10)]});
 let walked=0,changesSeen=0,maxHearing=0;
 for(const aid of D){
  const id=await page.evaluate(a=>{for(const c of S.generatedCases)S.cases[c.id].referred=true;const cand=CasePackEngine.pool(S).find(x=>x.a.id===a);const c=createGeneratedCase(cand);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};c.week=S.week;ui.tab='court';ui.caseId=c.id;render();return c.id},aid);
  await page.locator('.t4-tabs').waitFor();
  for(let d=0;d<5;d++){
   await tab('day');const ob=page.locator('.t4-dock [data-kind="open"]');if(!(await ob.count()))break;await ob.click();await answer();
   if(d>0&&await page.locator('.t4-changes').count())changesSeen++;
   await tab('witness');
   for(let k=0;k<2;k++){const q=page.locator('.t4 .t4-q:not([disabled]):not(.cf):not(.face):not(.order)').first();if(await q.count()){await q.dispatchEvent('click');await answer()}}
   await tab('day');const sm=page.locator('.t4-orders summary');
   if(await sm.count()){await page.evaluate(()=>{const d=document.querySelector('.t4-orders');if(d)d.open=true});const o=page.locator('.t4-q.order').first();if(await o.count()){await o.dispatchEvent('click');await answer()}}
   const end=page.locator('.t4-dock [data-action="t4end"]');if(!(await end.count()))break;await end.click();await answer();
   await page.evaluate(i=>{S.cases[i].trial4.nextAt=0;render()},id);maxHearing=Math.max(maxHearing,d+1);
  }
  const r=await page.evaluate(i=>{const t=S.cases[i].trial4;return {days:t.daysDone,orders:(t.courtOrders||[]).length}},id);
  assert.ok(r.days>=3,aid+': should reach at least 3 hearings on screen (got '+r.days+')');assert.ok(r.orders>=2,aid+': orders were given on screen');
  walked++;
 }
 assert.ok(changesSeen>=walked,'results of earlier orders should show at later hearings');
 console.log(`  ✓ D ${walked} cases on screen (importance 4~5: 10) · up to ${maxHearing} hearings · result cards ${changesSeen}`);
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
