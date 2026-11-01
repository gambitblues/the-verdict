/* Builds tests/fixtures/v5.7-save.json by actually playing the v5.7.0 build (commit 03b1699).
 * Run from a checkout of that commit:  node <path>/make-v5-fixture.mjs <v5.7 checkout dir> <output.json>
 * The fixture holds every localStorage key the game wrote: slot 1 with one finished verdict and one trial in progress
 * (session open, questions asked, evidence decided), plus a second player slot. */
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const base=path.resolve(process.argv[2]),out=process.argv[3];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end('')}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844}});
const answer=async()=>{for(let k=0;k<8;k++){await page.waitForTimeout(120);const b=page.locator('#modal-root [data-kind="card"][data-choice="reject"]');if(await b.count()){await b.first().click();continue}const d=page.locator('#modal-root [data-action="dismiss"]');if(await d.count()){await d.first().click();continue}break}};
const tab=async id=>{await answer();await page.locator(`.t4-tab[data-tab="${id}"]`).click();await answer()};
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('이행 검증');
 await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});
 const ids=await page.evaluate(()=>S.generatedCases.filter(c=>!S.cases[c.id]?.referred).map(c=>c.id));
 const play=async(id,finish)=>{
  await page.evaluate(i=>{ui.tab='court';ui.caseId=i;render()},id);await page.locator('.t4-tabs').waitFor();
  const min=await page.evaluate(i=>S.cases[i].trial4.minDays,id);
  for(let d=0;d<(finish?min:1);d++){
   await tab('day');const ob=page.locator('.t4-dock [data-kind="open"]');if(await ob.count())await ob.click();await answer();
   await tab('evidence');const u=page.locator('.t4 [data-kind="decide"][data-choice="conditional"]:not([disabled])').first();if(await u.count())await u.click();await answer();
   await tab('witness');for(let k=0;k<2;k++){const a=page.locator('.t4 .t4-q:not([disabled])').first();if(await a.count()){await a.click();await answer()}}
   if(!finish)return;
   await page.locator('.t4-dock [data-action="t4end"]').click();await answer();
   await page.evaluate(i=>{S.cases[i].trial4.nextAt=0;render()},id);
  }
  await tab('verdict');await page.locator('.t4-verdict [data-action="t4verdict"]').first().click();
  await page.locator('.t4-cite').first().click();await page.locator('.t4-verdict [data-action="t4confirm"]').click();await page.waitForTimeout(400);await answer();
 };
 await play(ids[0],true);   // finished verdict
 await play(ids[1],false);  // trial in progress, session open
 await page.evaluate(()=>{save();VerdictStore.flush()});
 await page.waitForTimeout(500);
 const dump=await page.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k)}return o});
 // a second player slot with the same career (slot switching must keep both)
 dump['verdict_player_save_2']=dump['the_verdict_alpha_1'];
 const S0=JSON.parse(dump['the_verdict_alpha_1']);
 const meta={version:'5.7.0',commit:'03b1699',finished:ids[0],inProgress:ids[1],cases:S0.generatedCases.length,npcs:Object.keys(S0.npcDB||{}).length,news:S0.news.length,size:dump['the_verdict_alpha_1'].length};
 await writeFile(out,JSON.stringify({meta,localStorage:dump}));
 console.log('fixture written',JSON.stringify(meta));
}finally{await browser.close();server.close()}
