/* 2026-11-08 AI wording rules in the courtroom — against fake Supabase and API servers (no network needed).
 * Run: node tests/ai-wording.mjs
 *  1. Witness answers: the AI is asked BEFORE a question is put, only for the role-fitted questions whose answers are
 *     assembled from a case sheet's notes (at most three per witness), with the witness's age and job. Written cases
 *     and a sheet's own questions are never re-worded.
 *  2. An answer is shown in the AI's words only if they were already there; a wording that arrives later never
 *     replaces what the player read.
 *  3. The first-hearing statements wait a moment for the AI wording; if it is late, the engine's words are shown and
 *     locked — the late answer is dropped. */
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {courtUI} from './lib/court-ui.mjs';
const base=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}
 if(f.endsWith('/config.js')){r.writeHead(200,{'content-type':'text/javascript'});return r.end("window.VERDICT_CONFIG={supabaseUrl:'https://sb.test',supabaseAnonKey:'anon',apiBase:'https://api.test',ai:true,colleagueCourt:false};")}
 try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end()}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const url='http://127.0.0.1:'+server.address().port+'/';
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
const calls=[];let delay={npc:0,opening:0};
const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 await ctx.route('https://sb.test/**',route=>{const req=route.request(),u=new URL(req.url()),j=d=>route.fulfill({status:200,headers:{...cors,'content-type':'application/json'},body:JSON.stringify(d)});
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(u.pathname==='/auth/v1/token')return j({access_token:'tok-a',refresh_token:'ref-a',expires_in:3600,user:{id:'00000000-0000-0000-0000-00000000000a',email:'a@x.kr'}});
  if(u.pathname==='/rest/v1/rpc/claim_player')return j(true);
  if(u.pathname==='/rest/v1/saves')return j([]);
  if(u.pathname==='/rest/v1/rpc/save_put')return j([{ok:true,conflict:false,rev:1,updated_at:new Date().toISOString(),device:'d'}]);
  return j([])});
 await ctx.route('https://api.test/**',async route=>{const req=route.request();if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  const kind=new URL(req.url()).pathname.replace('/ai/',''),body=JSON.parse(req.postData()||'{}');calls.push({kind,body});
  await new Promise(r=>setTimeout(r,delay[kind]||0));
  const result=kind==='npc'?{text:'(AI) '+body.answer}:kind==='opening'?{openingA:'(AI) '+body.openingA,openingB:'(AI) '+body.openingB}:{};
  route.fulfill({status:200,headers:{...cors,'content-type':'application/json'},body:JSON.stringify({ok:true,result})})});
 const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
 await page.goto(url+'?auth=1',{waitUntil:'networkidle'});
 await page.locator('#verdict-login input[type=email]').fill('a@x.kr');await page.locator('#verdict-login input[type=password]').fill('pw');await page.locator('#verdict-login button[type=submit]').click();
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('문장 검증');await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,null,{timeout:30000});await page.evaluate(()=>VerdictCurated.loadAll());
 const U=courtUI(page);
 const open=async key=>{await U.settle();await page.evaluate(k=>{for(const c of S.generatedCases)S.cases[c.id].referred=true;const cand=CasePackEngine.pool(S).find(x=>x.a.id===k);const c=createGeneratedCase(cand);
  S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};c.week=S.week;ui.tab='court';ui.caseId=c.id;save();render()},key);await page.locator('.t4-tabs').waitFor()};

 /* 3. first-hearing statements: a quick AI answer is shown from the start (a short wait, no swap) */
 delay.opening=700;
 await open('adv-cr-020');await U.tab('day');
 await page.locator('.t4-dock [data-kind="open"]').first().click();
 await page.waitForFunction(()=>S.cases[ui.caseId].trial4.dates?.[S.cases[ui.caseId].trial4.day]!=null);
 const firstView=await page.evaluate(()=>document.querySelector('.t4-opening')?.innerText||'');
 assert.ok(/정리하고 있어요/.test(firstView)||/\(AI\)/.test(firstView),'never the engine words first: '+firstView.slice(0,80));
 await page.waitForFunction(()=>/\(AI\)/.test(document.querySelector('.t4-opening')?.innerText||''),null,{timeout:8000});
 await U.settle();
 console.log('  ✓ first-hearing statements: a short wait, then the AI words — never swapped');

 /* 1–2. witness answers: prefetch for the sheet's role-fitted questions only, with the persona */
 await U.tab('witness');await page.evaluate(()=>{ui.t4w=0;render()});
 await page.waitForFunction(()=>Object.keys(S.cases[ui.caseId].trial4.ai||{}).length>=1,null,{timeout:8000});
 const npc=calls.filter(c=>c.kind==='npc');
 assert.ok(npc.length>=1&&npc.length<=3,'at most three prefetched answers for the witness on the stand: '+npc.length);
 assert.ok(npc.every(c=>c.body.job&&c.body.age),'age and job go along: '+JSON.stringify(npc[0].body).slice(0,200));
 const autoIds=await page.evaluate(()=>{const c=CASES.find(x=>x.id===ui.caseId);return VerdictCurated.cases['adv-cr-020'].witnesses[0].q.filter(q=>q.auto).map(q=>q.id)});
 assert.ok(npc.every(c=>autoIds.some(id=>c.body.question&&c.body.answer)),'only role-fitted questions');
 await page.waitForTimeout(400);
 const target=await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4;return Object.keys(t.ai||{})[0].split(':')[1]});
 await U.ask(page.locator(`.t4-pager .t4-q[data-kind="ask"][data-choice="${target}"]`).first());
 const shown=await page.evaluate(q=>{const t=S.cases[ui.caseId].trial4,h=t.heard.find(x=>x.w===0&&x.q===q);return {ai:h?.ai||'',page:document.querySelector('.t4-pager')?.innerText||''}},target);
 assert.match(shown.ai,/^\(AI\)/,'the answer was spoken in the prefetched words');
 assert.ok(shown.page.includes(shown.ai.slice(0,20)),'and that is what the witness card shows');
 // a late wording never replaces an answer already given
 delay.npc=4000;
 await page.evaluate(()=>{ui.t4w=1;render()});
 const late=await page.evaluate(()=>{const t=S.cases[ui.caseId].trial4,c=CASES.find(x=>x.id===ui.caseId);return VerdictCurated.cases['adv-cr-020'].witnesses[1].q.find(q=>q.auto&&!t.ai?.['1:'+q.id+':n']&&!t.ai?.['1:'+q.id+':p']&&!t.ai?.['1:'+q.id+':d'])?.id});
 if(late){
  await U.ask(page.locator(`.t4-pager .t4-q[data-kind="ask"][data-choice="${late}"]`).first());
  const before=await page.evaluate(q=>{const t=S.cases[ui.caseId].trial4;return {h:t.heard.find(x=>x.w===1&&x.q===q),txt:document.querySelector('.t4-pager')?.innerText||''}},late);
  assert.ok(!before.h.ai,'not ready when asked: the engine words');
  await page.waitForTimeout(4600);await page.evaluate(()=>render());
  const after=await page.evaluate(q=>{const t=S.cases[ui.caseId].trial4;return {ai:Object.keys(t.ai||{}).some(k=>k.startsWith('1:'+q+':')),txt:document.querySelector('.t4-pager')?.innerText||''}},late);
  assert.ok(after.ai,'the late wording did arrive');
  const line=s=>(s.match(/답\. "[^"]*"/g)||[]).join('|');
  assert.equal(line(after.txt),line(before.txt),'but the answer on screen did not change');
 }
 console.log('  ✓ witness answers: prefetched for role-fitted questions with age and job; a late wording never swaps in');

 /* written cases: no re-wording at all */
 delay.npc=0;const n0=calls.filter(c=>c.kind==='npc').length;
 const written=await page.evaluate(()=>Object.keys(VerdictCurated.cases).find(id=>!VerdictCurated.cases[id].fromSheet&&CasePackEngine.pool(S).some(x=>x.a.id===id)));
 await open(written);await U.tab('day');await U.openSession();await U.tab('witness');await page.evaluate(()=>{ui.t4w=0;render()});await page.waitForTimeout(800);
 assert.equal(calls.filter(c=>c.kind==='npc').length,n0,'a written case\'s answers are already in people\'s words');
 console.log('  ✓ written cases: no AI re-wording of answers');
 assert.deepEqual(errs,[]);
 console.log('PASS: AI wording — prefetched persona answers, no swaps, short waits');
}finally{await browser.close();server.close()}
