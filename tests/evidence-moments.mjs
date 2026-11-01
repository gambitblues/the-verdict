/* v6.6 visual review of evidence shapes and witness-stand moments. Run: node tests/evidence-moments.mjs
 * 1. Every evidence record of the 60 written cases (base, late and follow-up material) is classified into one of eleven
 *    shapes; the plain fallback stays rare. One real example of each shape is rendered at 390px into
 *    qa-visuals/evidence-gallery.png for a human look, and each shape must carry its own marks (rows, bubbles, clauses...).
 * 2. Witness moments: playing every case through its hearings, answers are told apart as an ordinary answer, a story
 *    that starts to change, a clash with another witness or with the witness's own earlier words; showing evidence and
 *    face-offs give their own moments. Each moment renders with its own title and colour, and the witness card keeps a
 *    short history. Presentation only: rendering never changes the trial. */
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end('')}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
await mkdir(path.join(base,'qa-visuals'),{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('시각 검수');
 await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});
 // ---- 1. evidence shapes ----
 const G=await page.evaluate(()=>{const C=VerdictCurated,V=VerdictVisuals,by={},ex={};let n=0;
  const add=(k,t,x)=>{const ty=V.evType(k,t);by[ty]=(by[ty]||0)+1;n++;(ex[ty]??=[]).push({k,t,x})};
  for(const id of C.ids){const c=C.cases[id];const X=v=>typeof v==='object'?[v.reason,v.didnt,v.did].find(x=>x&&x!=='기록 없음'):v;
   for(const e of c.evidence)add(e.kind,e.title,e.excerpt);if(c.late)add(c.late.kind,c.late.title,c.late.excerpt);
   for(const f of c.followUps||[])if(f.evidence)add(f.evidence.kind,f.evidence.title,X(f.evidence.excerpt))}
  const fill=s=>String(s).replace(/\{([A-Z]\d?)(?:\|[^}]*)?\}/g,(m,k)=>({A:'한서준',B:'이도윤'}[k]||'증인'));
  const box=document.createElement('div');box.id='gallery';box.style.cssText='position:absolute;inset:0 auto auto 0;width:390px;padding:12px;background:#f3eee4;z-index:99999';
  box.innerHTML=Object.keys(ex).sort().map(ty=>{const e=ex[ty][0];return `<h3 style="font:700 13px sans-serif;margin:14px 0 4px">${ty} · ${by[ty]}건</h3>`+V.evidence({id:'e1',title:fill(e.t),decision:'use'},{kind:e.k,by:'검찰'},fill(e.x),'사건 당일')}).join('');
  document.body.append(box);
  const marks={audio:'.cv-transcript',call:'.cv-rows',message:'.cv-bubble',video:'.cv-rec',contract:'.cv-clauses',photo:'.cv-photo-frame',money:'.cv-ledger-head',report:'.cv-findings',log:'.cv-log-head',note:'.t4-excerpt',official:'.cv-letterhead'};
  const missing=Object.entries(marks).filter(([ty,sel])=>!box.querySelector(`.cv-${ty} ${sel}`)).map(x=>x[0]);
  const looks=new Set([...box.querySelectorAll('.cv-evidence .cv-paper')].map(p=>{const s=getComputedStyle(p);return s.backgroundColor+s.backgroundImage.slice(0,40)+s.borderTopColor}));
  return {by,n,missing,looks:looks.size}});
 await page.locator('#gallery').screenshot({path:path.join(base,'qa-visuals','evidence-gallery.png')});
 await page.evaluate(()=>document.getElementById('gallery').remove());
 const types=Object.keys(G.by).filter(k=>k!=='document');
 assert.ok(types.length>=11,'all eleven evidence shapes are in use ('+types.join(',')+')');
 assert.ok((G.by.document||0)/G.n<=0.03,'plain fallback stays under 3% ('+(G.by.document||0)+'/'+G.n+')');
 assert.deepEqual(G.missing,[],'each shape shows its own marks');
 assert.ok(G.looks>=8,'shapes must look different from one another (distinct paper styles: '+G.looks+')');
 console.log(`  ✓ evidence shapes · ${G.n} records → ${JSON.stringify(G.by)} · ${G.looks} distinct papers · gallery in qa-visuals/evidence-gallery.png`);
 // ---- 2. moments ----
 const M=await page.evaluate(()=>{window.save=()=>true;window.age=()=>40;const TP=VerdictTrialPlay,C=VerdictCurated,V=VerdictVisuals,seen={},html={};let bad=[];
  for(const aid of C.ids){const cand=CasePackEngine.pool(S).find(x=>x.a.id===aid);
   for(let n=0;n<4;n++){const c=createGeneratedCase(cand);if(!c)continue;S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};const st=S.cases[c.id],t=TP.ensure(c,st);
    for(let d=1;d<=3;d++){if(!TP.openSession(c,st))break;
     for(let k=0;k<14&&t.qLeft>0;k++){const i=(k+n)%t.witnesses.length,q=TP.questions(c,t,i).find(v=>!t.witnesses[i].askedIds.includes(v.id));if(!q)continue;
      const pre={n:t.heard.length,flip:t.witnesses.map(w=>!!w.flipped)},trial=JSON.stringify(t.heard.length);TP.ask(c,t,i,q.id);const m=TP.moment(c,t,'ask',i,pre);
      seen[m.moment]=(seen[m.moment]||0)+1;
      if(!html[m.moment]){V.record(c.id,'ask','테스트 답변',m.actor,m.moment);html[m.moment]=V.event(c.id)}}
     t.daysDone++;t.day++;t.qLeft=t.qpd;t.nextAt=0}
    for(const w of t.witnesses)if((w.moments||[]).some(x=>!['flip','shift','clash','admit','correct','revert','hold','yield','standoff'].includes(x)))bad.push(aid+': unknown moment kept');
    st.referred=true}}
  for(const m of ['admit','correct','revert','hold','yield','standoff']){V.record('x','confront','테스트',null,m);html[m]=V.event('x')}
  const titles={},classes={};for(const [m,h] of Object.entries(html)){const d=document.createElement('div');d.innerHTML=h;const ev=d.firstElementChild;titles[m]=ev.querySelector('b').textContent;classes[m]=[...ev.classList].find(x=>x.startsWith('cv-m-'))||''}
  return {seen,titles,classes,bad}});
 assert.deepEqual(M.bad,[]);
 for(const m of ['answer','flip','clash','shift'])assert.ok(M.seen[m]>0,`moment "${m}" should happen while playing the 60 cases (seen ${JSON.stringify(M.seen)})`);
 assert.equal(new Set(Object.values(M.titles)).size,Object.keys(M.titles).length,'every moment has its own title');
 for(const m of ['flip','shift','clash'])assert.ok(/flip|clash/.test(M.classes[m]),m+' is marked as a warning');
 for(const m of ['admit','correct','revert','yield'])assert.equal(M.classes[m],'cv-m-turn',m+' is a turn');
 for(const m of ['hold','standoff'])assert.equal(M.classes[m],'cv-m-hold',m+' is holding firm');
 console.log(`  ✓ witness moments while playing · ${JSON.stringify(M.seen)} · ${Object.keys(M.titles).length} distinct titles`);
 assert.deepEqual(errs,[]);
 console.log('PASS: evidence shapes and witness moments');
}finally{await browser.close();server.close()}
