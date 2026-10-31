import { chromium } from 'playwright';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

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
try{
 await page.goto(url,{waitUntil:'networkidle'});
 await page.locator('#verdict-entry').waitFor();
 await page.locator('#profile-continue').click();
 await page.locator('#playerName').waitFor();
 await page.locator('#playerName').fill('QA 판사');
 await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});
 const state=await page.evaluate(()=>({
  n:S.generatedCases.filter(c=>!S.cases[c.id]?.referred&&!S.cases[c.id]?.verdict).length,
  ids:S.generatedCases.filter(c=>!S.cases[c.id]?.referred).map(c=>c.contentPack?.archetypeId),
  outlets:window.VerdictMedia?.outlets.length,
  oldWeekControls:document.querySelectorAll('[data-action="nextWeek"],[data-action="skip"]').length,
  size:localStorage.getItem('the_verdict_alpha_1')?.length
 }));
 assert.equal(state.n,4,'expected first four cases');
 assert.equal(new Set(state.ids).size,4,'starter case archetype repeated');
 assert.equal(state.outlets,20,'expected 20 fictional media sources');
 assert.equal(state.oldWeekControls,0,'legacy week controls visible');
 assert.ok(state.size<190000,'static pack may still be duplicated in save');
 await page.locator('.tv-case').first().click();
 await page.locator('.court-play-tabs').waitFor();
 assert.equal(await page.locator('.court-play-tab').count(),4);
 await page.locator('[data-action="courtFocus"][data-focus="arguments"]').click();
 assert.ok(await page.locator('.court-screen-arguments').isVisible());
 await page.locator('[data-action="courtFocus"][data-focus="hearing"]').click();
 await page.locator('[data-action="courtStep"]').first().click();
 await page.locator('[data-action="courtReason"]').first().waitFor();
 await page.locator('[data-action="courtReason"]').first().click();
 const heard=await page.evaluate(()=>S.cases[ui.caseId]?.reasonedChoices?.length||0);
 assert.ok(heard>0,'judicial reasoning was not recorded');
 await page.locator('[data-action="tab"][data-tab="tablet"]').first().click();
 await page.locator('[data-action="tablet"][data-sub="rank"]').click();
 await page.locator('.tv-ranking').waitFor();
 assert.equal(errs.length,0,'page errors: '+errs.join('; '));
 console.log('PASS: mobile Chrome, 4 cases, 20 outlets, 4 court tabs, reasoned hearing, ranking, reduced save; '+JSON.stringify(state));
}finally{await browser.close();await new Promise(ok=>server.close(ok))}
