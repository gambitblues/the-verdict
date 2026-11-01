/* v7.0.2 mobile / foldable / tablet / desktop layout check. Run: node tests/responsive.mjs
 * Viewports by CSS size, not by device name. For each: no sideways scroll on the main screens; the bottom bar (≤1100px)
 * is inside the screen, every button in it is at least 44px tall and tappable; the trial dock sits above the bar; the
 * first screen's start button can be reached; the verdict window fits. Also: folding/unfolding (resizing the same page)
 * keeps the game; the gap rule for Android home-screen launches lifts the bar and the dock by exactly the gap and
 * ignores the keyboard; pure rules of viewport_fix.js. Screenshots go to qa-visuals/responsive-*.png. */
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const base=process.cwd();
const V=require(path.join(base,'viewport_fix.js'));
// pure rules
assert.deepEqual(V.gapOf({innerHeight:900,vvHeight:900}),{gap:0,kb:false});
assert.deepEqual(V.gapOf({innerHeight:900,vvHeight:852}),{gap:48,kb:false},'hidden strip under the visible screen is lifted');
assert.deepEqual(V.gapOf({innerHeight:900,vvHeight:520,editing:true}),{gap:0,kb:true},'keyboard: no lift, bar hides');
assert.deepEqual(V.gapOf({innerHeight:900,vvHeight:600}),{gap:0,kb:false},'a large gap without typing is not a browser bar');
assert.deepEqual(V.gapOf({innerHeight:900,vvHeight:700,scale:2}),{gap:0,kb:false},'pinch zoom does not move the bar');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end('')}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const url='http://127.0.0.1:'+server.address().port+'/';
await mkdir(path.join(base,'qa-visuals'),{recursive:true});
const VIEWS=[['iphone',390,844],['android',360,780],['fold-folded',412,915],['fold-open',884,1004],['fold-open-landscape',1004,884],['tablet',1024,1366],['short-phone',390,640],['desktop',1280,800]];
const browser=await chromium.launch({headless:true});
const report=[];
try{
 for(const [name,w,h] of VIEWS){
  const page=await browser.newPage({viewport:{width:w,height:h},isMobile:w<=1100,hasTouch:w<=1100});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  const answer=async()=>{for(let k=0;k<8;k++){await page.waitForTimeout(60);const b=page.locator('#modal-root [data-kind="card"][data-choice="reject"]');if(await b.count()){await b.first().dispatchEvent('click');continue}const d=page.locator('#modal-root [data-action="dismiss"]');if(await d.count()){await d.first().dispatchEvent('click');continue}break}};
  const noSideways=async where=>{const o=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));assert.ok(o.sw<=o.cw+1,`${name}/${where}: sideways scroll ${o.sw}>${o.cw}`)};
  await page.goto(url,{waitUntil:'networkidle'});
  // first screen
  const card=await page.locator('#verdict-entry .entry-card').boundingBox();assert.ok(card.y>=0&&card.y+card.height<=h+1,`${name}: first screen card fits the screen`);
  await page.locator('#profile-continue').scrollIntoViewIfNeeded();const pc=await page.locator('#profile-continue').boundingBox();assert.ok(pc&&pc.y+pc.height<=h,`${name}: start button reachable`);
  if(w>=600)assert.ok(card.width>=Math.min(560,w*0.6),`${name}: first screen uses the wide screen (${Math.round(card.width)}px)`);
  await page.screenshot({path:`qa-visuals/responsive-${name}-0-entry.png`});await noSideways('entry');
  await page.locator('#profile-continue').click();await page.locator('#playerName').fill('반응형');
  await page.locator('[data-action="start"]').last().click();
  await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});await page.waitForTimeout(800);await answer();
  await page.evaluate(()=>{ui.modal='';ui.tab='home';render()});await noSideways('home');
  const navShown=await page.locator('.bottom-nav').isVisible();
  if(w<=1100){
   assert.ok(navShown,`${name}: bottom bar shown`);
   const nb=await page.locator('.bottom-nav').boundingBox();assert.ok(nb.y+nb.height<=h+1&&nb.y>h-140,`${name}: bottom bar inside the screen (${Math.round(nb.y)}+${Math.round(nb.height)} / ${h})`);
   for(const b of await page.locator('.bottom-nav button').all()){const bb=await b.boundingBox();assert.ok(bb.height>=44,`${name}: bar button ${Math.round(bb.height)}px tall`)}
   for(const tab of ['people','tablet','court','home']){await page.locator(`.bottom-nav [data-tab="${tab}"]`).click();await answer();assert.ok(await page.evaluate(t=>ui.tab===t||(t==='court'&&ui.tab==='courtList'),tab),`${name}: bar button ${tab} works`)}
  }else assert.ok(!navShown,`${name}: desktop has no bottom bar`);
  await page.screenshot({path:`qa-visuals/responsive-${name}-1-home.png`});
  await page.evaluate(()=>{ui.tab='courtList';render()});await noSideways('list');await page.screenshot({path:`qa-visuals/responsive-${name}-2-list.png`});
  const id=await page.evaluate(()=>{const c=S.generatedCases[0];ui.tab='court';ui.caseId=c.id;render();return c.id});
  await page.locator('.t4-tab[data-tab="day"]').dispatchEvent('click');await answer();await page.locator('.t4-dock [data-kind="open"]').dispatchEvent('click');await answer();
  for(const t of ['day','witness','evidence','orders']){await page.locator(`.t4-tab[data-tab="${t}"]`).dispatchEvent('click');await answer();await noSideways(t);
   const db=await page.locator('.t4-dock').boundingBox();assert.ok(db&&db.y+db.height<=h+1,`${name}/${t}: trial dock on screen`);
   if(w<=1100){const nb=await page.locator('.bottom-nav').boundingBox();assert.ok(db.y+db.height<=nb.y+1,`${name}/${t}: trial dock above the bottom bar`)}
   if(t==='day'||t==='witness')await page.screenshot({path:`qa-visuals/responsive-${name}-3-${t}.png`})}
  await page.evaluate(i=>{const t=S.cases[i].trial4;t.daysDone=t.minDays;t.evidence.forEach(e=>e.decision='use');render()},id);
  await page.locator('.t4-tab[data-tab="verdict"]').dispatchEvent('click');await answer();await page.locator('[data-action="t4sheet"][data-v="open"]').dispatchEvent('click');await page.waitForTimeout(150);
  const sh=await page.locator('.t4-sheet').boundingBox(),nx=await page.locator('.t4-sheet-foot .btn').last().boundingBox();
  assert.ok(sh.y>=0&&nx.y+nx.height<=h+1,`${name}: verdict window and its button fit`);
  await page.screenshot({path:`qa-visuals/responsive-${name}-4-verdict.png`});
  await page.locator('[data-action="t4sheet"][data-v="close"]').dispatchEvent('click');
  // Android home-screen launch: a 48px hidden strip lifts the bar and the dock by exactly that much
  if(w<=1100){const before=await page.evaluate(()=>[document.querySelector('.bottom-nav').getBoundingClientRect().bottom,document.querySelector('.t4-dock')?.getBoundingClientRect().bottom]);
   await page.evaluate(()=>document.documentElement.style.setProperty('--vv-gap','48px'));await page.waitForTimeout(50);
   const after=await page.evaluate(()=>[document.querySelector('.bottom-nav').getBoundingClientRect().bottom,document.querySelector('.t4-dock')?.getBoundingClientRect().bottom]);
   assert.equal(Math.round(before[0]-after[0]),48,`${name}: bar lifted by the hidden strip`);if(before[1]&&after[1])assert.equal(Math.round(before[1]-after[1]),48,`${name}: dock lifted with it`);
   await page.evaluate(()=>{document.documentElement.classList.add('kb-open')});assert.ok(!(await page.locator('.bottom-nav').isVisible()),`${name}: bar hides while typing`);
   await page.evaluate(()=>{document.documentElement.classList.remove('kb-open');document.documentElement.style.setProperty('--vv-gap','0px')})}
  // fold / unfold: same page, new size, game kept
  if(name==='fold-folded'){const before=await page.evaluate(()=>({name:S.name,cases:S.generatedCases.length}));await page.setViewportSize({width:884,height:1004});await page.waitForTimeout(300);
   const after=await page.evaluate(()=>({name:S.name,cases:S.generatedCases.length}));assert.deepEqual(after,before,'unfolding keeps the game');await noSideways('unfolded');
   const nb=await page.locator('.bottom-nav').boundingBox();assert.ok(nb.y+nb.height<=1005,'bar inside after unfolding');await page.setViewportSize({width:412,height:915});await page.waitForTimeout(200);await noSideways('folded again')}
  assert.deepEqual(errs,[],name+': page errors');
  report.push(`${name} ${w}×${h}`);await page.close();
 }
 console.log('PASS: responsive · '+report.join(' · '));
}finally{await browser.close();server.close()}
