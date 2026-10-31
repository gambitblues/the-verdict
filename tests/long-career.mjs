import { chromium } from 'playwright';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
/* Long career check (manual, takes several minutes): node tests/long-career.mjs [years]
 * Plays a whole career at about ten cases a year through the normal verdict path and checks every five years that
 * ages, deaths, family links and legal careers stay consistent, old cases still open, and the save stays small. */
const YEARS=Number(process.argv[2]||40);

const base=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async (req,res)=>{
  const file=path.resolve(base,'.'+decodeURI(req.url.split('?')[0]).replace(/\/$/,'/index.html'));
  if(!file.startsWith(base)){res.writeHead(403);return res.end('Forbidden');}
  try{const content=await readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(content)}
  catch{res.writeHead(404);res.end('Not found')}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const url='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errs=[];page.on('pageerror',err=>errs.push(err.message));
const YEAR=(year)=>{
 const out={created:0,concluded:0,errors:[]};
 for(let w=0;w<52;w++){
  try{advanceWeek(true)}catch(e){out.errors.push('advance:'+e.message)}
  if(w%6===0){ // roughly 8–9 new cases a year
   try{const c=createGeneratedCase();if(c)out.created++}catch(e){out.errors.push('create:'+e.message)}
  }
  // conclude every open case older than 3 weeks through the normal verdict path
  for(const c of CASES){
   const st=S.cases[c.id];
   if(!st||st.verdict||st.referred||c.week>S.week-3)continue;
   try{
    ui.caseId=c.id;
    const t=VerdictTrialPlay.ensure(c,st);
    t.evidence.forEach(e=>{e.revealed=2;e.decision=e.flawType==='illegal'?'exclude':'use'});
    t.witnesses.forEach(w=>{w.asked=1;w.revealed=1});
    st.phase=3;st.liveHearing=null;st.nextHearingWeek=null;st.hearingHistory=(st.hearingHistory||[]);
    while(st.hearingHistory.filter(v=>v.kind==='resumed').length<4)st.hearingHistory.push({kind:'resumed',week:S.week});
    S.actions=0;
    const opt=c.verdicts[Math.floor(rand()*c.verdicts.length)];
    conclude(opt.id);
    if(st.verdict)out.concluded++;
   }catch(e){out.errors.push('conclude:'+c.id+':'+e.message)}
  }
 }
 ui.modal=null;
 return out;
};
const VIEW=()=>{const errs=[];const done=completed().slice(0,4);
 for(const c of done){try{ui.caseId=c.id;ui.tab='court';ui.modal=null;render();
  for(const b of [...document.querySelectorAll('[data-t4tab],[data-action=t4tab]')]){b.click()}
 }catch(e){errs.push(c.id+':'+e.message)}}
 try{const ids=Object.keys(NPC).filter(k=>k!=='self');for(let i=0;i<5;i++){const id=ids[Math.floor(Math.random()*ids.length)];ui.npcId=id;popupNPC(id)}ui.modal=null;document.getElementById('modal-root').innerHTML=''}catch(e){errs.push('npc:'+e.message)}
 ui.tab='home';render();
 return {errs,archived:S.generatedCases.filter(c=>c.archived).length};};
const CHECK=()=>{
 const issues=[];const yr=year();
 const people=Object.entries(NPC);
 // 1. ages and life state
 for(const [id,p] of people){
  if(p.bornYear&&(yr-p.bornYear<0||(p.alive!==false&&yr-p.bornYear>110)))issues.push(`age:${id}:${p.name}:${yr-p.bornYear}`);
  if(p.alive===false&&p.deathYear&&p.deathYear>yr)issues.push(`death-in-future:${id}`);
 }
 // 2. one person, one role per case; dead people do not appear in new cases
 for(const c of CASES){
  const st=S.cases[c.id];if(!st)continue;
  const roles={};
  const add=(id,r)=>{if(!id)return;(roles[id]??=[]).push(r)};
  (c.who||[]).forEach((id,i)=>add(id,i?'party2':'party1'));
  (c.side||[]).forEach((id,i)=>add(id,i?'counsel2':'counsel1'));
  (st.trial4?.witnesses||[]).forEach(w=>add(w.id,'witness'));
  for(const [id,r] of Object.entries(roles))if(r.length>1)issues.push(`multi-role:${c.id}:${NPC[id]?.name}:${r.join('+')}`);
  for(const id of c.who||[]){const p=NPC[id];if(p&&p.alive===false&&p.deathWeek!=null&&p.deathWeek<c.week)issues.push(`dead-party:${c.id}:${p.name}`)}
 }
 // 3. family links point both ways
 for(const [id,p] of people){
  if(p.spouse&&NPC[p.spouse]&&NPC[p.spouse].spouse&&NPC[p.spouse].spouse!==id)issues.push(`spouse-asym:${p.name}`);
  for(const k of (Array.isArray(p.children)?p.children:[]))if(NPC[k]&&NPC[k].parents&&Array.isArray(NPC[k].parents)&&!NPC[k].parents.includes(id))issues.push(`child-asym:${p.name}`);
 }
 // 4. legal professionals: one active job at a time
 for(const [id,p] of people){const lc=p.legalCareer;const ko={lawyer:'변호',judge:'판사',prosecutor:'검사'}[lc?.role]||lc?.role;if(lc&&lc.role&&p.role&&/판사|검사|변호/.test(p.role)&&!p.role.includes(String(ko).replace(/ .*/,'')))issues.push(`career-mismatch:${p.name}:${p.role}/${lc.role}`)}
 const keys={};for(const [,p] of people)for(const k of Object.keys(p))keys[k]=(keys[k]||0)+1;
 return {year:yr,age:age(),npc:people.length,cases:CASES.length,done:completed().length,issues,save:localStorage.getItem('the_verdict_alpha_1')?.length,json:VerdictStore.decode(localStorage.getItem('the_verdict_alpha_1')).length,ok:!!VerdictStore.read('the_verdict_alpha_1')?.cases,keys:Object.keys(keys).filter(k=>/spouse|child|parent|family|alive|death|legal|career/.test(k))};
};
try{
 page.on('dialog',d=>d.accept());
 await page.goto(url,{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();
 await page.locator('#playerName').fill('장기 검증');
 await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.name,{timeout:30000});
 for(let y=0;y<YEARS;y++){
  const r=await page.evaluate(YEAR,y);
  if(y%5===4||y===YEARS-1){
   await page.evaluate(()=>{save();VerdictStore.flush()});
   const v=await page.evaluate(VIEW),c=await page.evaluate(CHECK);
   console.log(`year ${y+1} · age ${c.age} · people ${c.npc} · cases ${c.cases} · stored ${c.save} chars (json ${c.json}) · issues ${c.issues.length}`);
   assert.deepEqual(v.errs,[],'old cases and records must open');
   assert.ok(c.ok,'save must read back');
   assert.deepEqual(c.issues,[],'world must stay consistent');
   assert.ok(c.save<3000000,'save must stay well under the browser limit');
  }
  if(r.errors.length&&!/advance/.test(r.errors[0]))throw new Error(r.errors[0]);
 }
 assert.deepEqual(errs,[]);
 console.log('PASS: long career');
}finally{await browser.close();server.close()}
