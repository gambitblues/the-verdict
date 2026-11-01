/* v6 end-to-end in a mobile browser. Run: node tests/v6-flow.mjs
 * 1 decision case: one hearing, then a money-free decision with the right order text
 * 2 people-driven witnesses: attitudes recorded from traits; the same NPC keeps the same attitude when replayed
 * 3 showing evidence to a witness and face-to-face examination, through the real buttons
 * 4 the bench: advice on evidence cards, growth after verdicts, promotion after years, colleague in the people map
 * 5 years later: a person from the trial tells the truth by message; the result page shows it; scores unchanged
 * 6 expert witnesses return: a registered expert is called again for a matching role
 * 7 pressure messages: refuse / report / ignore, and an ignored request surfacing months after the verdict
 * 8 personnel season: February yearbook + department choice that makes those cases come more often */
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
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
 await page.locator('#profile-continue').click();
 await page.locator('#playerName').fill('그래픽 검수');
 await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>S.legalWorld?.firstFour===true);
 await page.locator('.tv-case').first().click();
 await page.locator('.cv-court').waitFor();
 await mkdir('qa-visuals',{recursive:true});
 await page.screenshot({path:'qa-visuals/court-390.png',fullPage:false});
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:844});
  for(const name of ['evidence','witness']){
   await page.locator('.t4-tab[data-tab="'+name+'"]').click();
   assert(await page.locator(name==='evidence'?'.cv-evidence':'.cv-witness').isVisible());
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow '+width+' '+name);
   if(width===390)await page.screenshot({path:'qa-visuals/'+name+'-390.png',fullPage:false});
  }
 }
 // Rendering cannot change saves or engine inputs, and private truth never changes a portrait.
 const result=await page.evaluate(()=>{
  const c=CASES.find(x=>x.id===ui.caseId),t=S.cases[c.id].trial4,w=t.witnesses[0],p=NPC[w.id];
  const before=JSON.stringify(S),q=JSON.stringify(t),clean=x=>x.replace(/cvp[0-9]+/g,'cvp');
  const a=clean(VerdictVisuals.portrait(w.id,p,40));
  const b=clean(VerdictVisuals.portrait(w.id,{...p,traits:{honesty:0},truth:'didnt'},40));
  VerdictVisuals.scene(c,t,'witness','검수');VerdictVisuals.witness(w,p,0);
  const html=VerdictVisuals.evidence({id:'e0',title:'기록'},{kind:'문서'},'<script>unsafe</script>','');
  return {unchanged:before===JSON.stringify(S)&&q===JSON.stringify(t),same:a===b,escaped:html.includes('&lt;script&gt;')&&!html.includes('<script>')};
 });
 assert.deepEqual(result,{unchanged:true,same:true,escaped:true});
 await page.locator('[data-cv-toggle]').click();
 assert(await page.locator('.cv-stage').isVisible(),'expand court');
 await page.locator('[data-cv-toggle]').click();
 assert(!await page.locator('.cv-stage').isVisible(),'collapse court');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{VerdictVisuals.record(ui.caseId,'confront','기록에 있는 증거를 제시했습니다.');render()});
 assert.equal(await page.locator('.cv-arrive').evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.locator('[data-cv-dismiss]').click();
 assert.equal(await page.locator('.cv-event').count(),0);
 assert.equal(await page.evaluate(()=>VERDICT_VERSION),(await readFile(path.join(base,'index.html'),'utf8')).match(/VERDICT_VERSION='([\d.]+)'/)[1],'visuals must not change the game version on their own');
 assert.deepEqual(errs,[]);
 console.log('PASS: visual layer · 320/390/768/1280px · portraits · evidence · no state mutation · reduced motion');
}finally{await browser.close();server.close()}
