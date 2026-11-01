/* Dev screen of the match engine (dev/match-engine) at 390px: play a trial through to the verdict, run 30 trials.
 * Screenshots: qa-visuals/match-*.png */
import { chromium } from 'playwright';import http from 'node:http';import {readFile,mkdir} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const base=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]));if(!f.startsWith(base)){r.writeHead(403);return r.end()}try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end()}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));await mkdir('qa-visuals',{recursive:true});
const browser=await chromium.launch();
try{for(const id of ['clinic-001','gym-001','beta-homicide-017']){
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errs=[];page.on('pageerror',e=>errs.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/dev/match-engine/index.html`);await page.selectOption('#case',id);await page.click('#new');await page.waitForSelector('[data-a]');
 for(let d=0;d<3;d++){for(let k=0;k<4;k++){const b=page.locator('[data-a]').first();if(!(await b.count()))break;await b.click()}await page.click('#end')}
 assert.ok(await page.locator('.log p').count()>10,'the court record fills up');
 await page.screenshot({path:`qa-visuals/match-${id}-trial.png`,fullPage:false});
 await page.locator('[data-v]').first().click();assert.ok(await page.locator('.grade').count(),'verdict graded');
 await page.locator('.grade').scrollIntoViewIfNeeded();await page.screenshot({path:`qa-visuals/match-${id}-verdict.png`});
 await page.click('#bulk');await page.waitForSelector('#bulkout table');assert.equal(await page.locator('#bulkout tr').count(),31,'30 trials listed');
 const o=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));assert.ok(o.sw<=o.cw+1,'no sideways scroll');
 assert.deepEqual(errs,[]);console.log('  ✓',id);await page.close()}
 console.log('PASS match engine screen');
}finally{await browser.close();server.close()}
