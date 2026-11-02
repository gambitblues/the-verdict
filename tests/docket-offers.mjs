// v8.5.1: the hourly offers never repeat a case. Over a long run of offers and accepted cases:
//  - no offer shows a case that is in progress, already decided, recently passed to another bench, or waiting in
//    another open offer (while fresh cases remain);
//  - the two options of one offer are different cases (and different titles);
//  - once every case has been seen, old decided cases may come back but never one in progress or in another open offer;
//  - an old offer that repeats a case (from before the fix) is re-drawn, and accepting a case already on the bench is refused;
//  - a save holding the same case twice in progress keeps one.
// Run: ln -sfn "$(npm root -g)" node_modules && node tests/docket-offers.mjs; rm node_modules
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end('')}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('배당 검증');
 await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});
 const r=await page.evaluate(()=>{
  const D=window.VerdictDocket,db=S.realtimeInbox,P=CasePackEngine.pool(S),N=P.length,title=id=>P.find(x=>x.a.id===id)?.a.title;
  const arch=c=>c.contentPack?.archetypeId,mine=()=>CASES.filter(c=>arch(c));
  const out={rounds:0,fresh:0,reused:0,problems:[]};
  db.offers=[];let k=0;
  for(let round=0;round<N*2;round++){
   const slot='2030-01-'+String(1+Math.floor(round/13)).padStart(2,'0')+'T'+String(10+round%13).padStart(2,'0')+':'+round;
   const goneT=new Set(db.otherCourt.slice(-60).map(x=>x.title));
   const seenBefore=new Set([...mine().map(arch),...P.filter(p=>goneT.has(p.a.title)).map(p=>p.a.id)]),open=new Set(openCases().map(arch));
   const other=new Set(db.offers.filter(o=>o.status==='available').flatMap(o=>o.options.map(x=>x.archetypeId)));
   const opts=D.offerPair(slot);out.rounds++;
   if(opts.length===2&&(opts[0].archetypeId===opts[1].archetypeId||opts[0].title===opts[1].title))out.problems.push('same case twice in one offer '+opts[0].title);
   for(const x of opts){
    if(open.has(x.archetypeId))out.problems.push('offered a case in progress: '+x.title);
    if(other.has(x.archetypeId))out.problems.push('offered a case waiting in another offer: '+x.title);
    if(seenBefore.has(x.archetypeId)){const freshLeft=P.filter(p=>!seenBefore.has(p.a.id)&&!open.has(p.a.id)&&!other.has(p.a.id)).length;if(freshLeft>=2)out.problems.push('repeated a decided case while '+freshLeft+' fresh remain: '+x.title);else out.reused++}else out.fresh++}
   db.offers.push({slot,status:'available',options:opts,expires:Date.now()+3600e3});
   if(db.offers.filter(o=>o.status==='available').length>3){const o=db.offers.find(o=>o.status==='available');o.status='transferred';for(const x of o.options)db.otherCourt.push({slot:o.slot,title:x.title,at:Date.now()})}
   // take one option of the oldest offer, then decide something so the bench never fills
   if(round%2===0){const o=db.offers.find(o=>o.status==='available'),x=o.options[k++%o.options.length];
    const cand=P.find(p=>p.a.id===x.archetypeId);const c=cand&&createGeneratedCase(cand);if(c){S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};o.status='accepted'}}
   for(const c of openCases().slice(0,Math.max(0,openCases().length-3)))S.cases[c.id].verdict='done';
   const dup=openCases().map(arch).filter(Boolean);if(new Set(dup).size!==dup.length)out.problems.push('two copies of a case in progress');
  }
  // an old offer that repeats a case on the bench is re-drawn by sync()
  const busyCase=openCases().find(arch),stale={slot:'stale',status:'available',expires:Date.now()+3600e3,options:[{archetypeId:arch(busyCase),title:title(arch(busyCase)),packId:'x'},{archetypeId:arch(busyCase),title:title(arch(busyCase)),packId:'x'}]};
  db.offers.push(stale);D.sync();
  out.staleFixed=!stale.options.some(x=>x.archetypeId===arch(busyCase));
  // a save with the same case twice in progress keeps one
  const twin=JSON.parse(JSON.stringify(busyCase));twin.id=busyCase.id+'-twin';CASES.push(twin);S.cases[twin.id]={phase:0,actions:[],clues:[],flags:[],verdict:null};
  D.sync();out.twinKept=openCases().filter(c=>arch(c)===arch(busyCase)).length;
  out.pool=N;return out});
 assert.deepEqual(r.problems,[],r.problems.slice(0,5).join(' / '));
 assert.ok(r.fresh>=r.pool-8,`every case is offered fresh before any comes back (fresh ${r.fresh} of ${r.pool})`);
 assert.ok(r.reused>0,'late in the run old decided cases come back instead of an empty docket');
 assert.ok(r.staleFixed,'an old offer repeating a case in progress is re-drawn');
 assert.equal(r.twinKept,1,'the same case twice in progress keeps one');
 // accepting a case already on the bench is refused in the UI
 const refused=await page.evaluate(()=>{const db=S.realtimeInbox,c=openCases().find(c=>c.contentPack?.archetypeId),id=c.contentPack.archetypeId,P=CasePackEngine.pool(S),x=P.find(p=>p.a.id===id);
  const o={slot:'2099-01-01T10',day:'2099-01-01',created:Date.now(),status:'available',expires:Date.now()+3600e3,options:[{archetypeId:id,title:x.a.title,packId:x.pack.packId}]};db.offers.push(o);
  const n=openCases().length,b=document.createElement('button');b.dataset.action='acceptDocket';b.dataset.slot=o.slot;b.dataset.opt='0';document.body.appendChild(b);b.click();b.remove();
  return {before:n,after:openCases().length,dup:openCases().filter(c=>c.contentPack?.archetypeId===id).length}});
 assert.equal(refused.dup,1,'accepting a case already in progress does not add a second copy');
 assert.deepEqual(errs,[]);
 console.log(`PASS: ${r.rounds} offers over a ${r.pool}-case pool — no repeats while fresh cases remain (${r.fresh} fresh, then ${r.reused} old ones back), stale offer re-drawn, twin case removed, duplicate accept refused`);
}catch(e){console.error(e);console.error('page errors',errs);process.exitCode=1}
finally{await browser.close();server.close()}
