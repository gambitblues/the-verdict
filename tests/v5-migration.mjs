/* v5.7 → current save migration, from a real v5.7.0 save (tests/fixtures/v5.7-save.json, built by playing the
 * v5.7.0 build with tests/fixtures/make-v5-fixture.mjs). Runs twice: plain JSON and Z1-compressed main save.
 * Checks: load → resume the trial in progress → verdict → reload → read the old record, while NPC IDs, relations,
 * family links, past news and the finished verdict stay unchanged, and the second player slot survives. */
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.cwd();
const fixture=JSON.parse(await readFile(path.join(base,'tests','fixtures','v5.7-save.json'),'utf8'));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end('')}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const url='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({headless:true});
const old=JSON.parse(fixture.localStorage.the_verdict_alpha_1);
const {finished,inProgress}=fixture.meta;
try{
 for(const mode of ['plain','compressed']){
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  await ctx.addInitScript(({store,mode})=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');localStorage.clear();
   for(const [k,v] of Object.entries(store))localStorage.setItem(k,v);
   if(mode==='compressed')localStorage.setItem('v5-compress-pending','1')},{store:fixture.localStorage,mode});
  const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(url,{waitUntil:'networkidle'});
  if(mode==='compressed'){
   // rewrite the main save in the compressed form the store uses for big careers, then reload
   await page.evaluate(()=>{const json=localStorage.getItem('the_verdict_alpha_1');const bytes=fflate.deflateSync(fflate.strToU8(json),{level:4});
    let s='Z1:';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]+256);localStorage.setItem('the_verdict_alpha_1',s);localStorage.removeItem('v5-compress-pending')});
   assert.ok((await page.evaluate(()=>localStorage.getItem('the_verdict_alpha_1').startsWith('Z1:'))),'compressed fixture not written');
   await page.reload({waitUntil:'networkidle'});
  }
  await page.locator('#verdict-entry').waitFor();
  await page.locator('#profile-continue').click();
  await page.waitForFunction(()=>typeof S!=='undefined'&&S.name,null,{timeout:30000});
  await page.waitForTimeout(1600); // v6 boot: case pack install, bench
  const now=await page.evaluate(()=>({name:S.name,cases:S.generatedCases.map(c=>c.id),npc:Object.keys(S.npcDB||{}),relations:S.relations,
   family:Object.fromEntries(Object.entries(S.npcDB||{}).map(([k,v])=>[k,v.familyIds||[]])),news:S.news.map(n=>n.title),journal:S.journal.length,
   packs:(S.casePacks||[]).map(p=>p.packId),pool:CasePackEngine.pool(S).length}));
  assert.equal(now.name,old.name,mode+': judge name changed');
  assert.deepEqual(now.cases,old.generatedCases.map(c=>c.id),mode+': case list changed');
  for(const id of Object.keys(old.npcDB||{}))assert.ok(now.npc.includes(id),mode+': NPC '+id+' lost');
  for(const [k,v] of Object.entries(old.relations))assert.equal(now.relations[k],v,mode+': relation '+k+' changed on load');
  for(const [k,v] of Object.entries(old.npcDB||{}))assert.deepEqual(now.family[k],v.familyIds||[],mode+': family links of '+k+' changed');
  for(const t of old.news.map(n=>n.title))assert.ok(now.news.includes(t),mode+': past news "'+t+'" lost');
  assert.ok(now.journal>=old.journal.length,mode+': career journal shrank');
  assert.ok(now.packs.includes('v6-new-30'),mode+': v6 case pack not installed into the old save');
  assert.equal(now.pool,60,mode+': expected the 60-case pool after migration');
  // the finished verdict and its judgment are untouched
  const fin=await page.evaluate(id=>({v:S.cases[id].verdict,order:S.cases[id].trial4?.final?.judgment?.order,skill:S.cases[id].trial4?.final?.skill}),finished);
  assert.equal(fin.v,old.cases[finished].verdict,mode+': finished verdict changed');
  assert.equal(fin.order,old.cases[finished].trial4.final.judgment.order,mode+': judgment order changed');
  assert.equal(fin.skill,old.cases[finished].trial4.final.skill,mode+': past skill score changed');
  // resume the trial in progress and take it to a verdict
  const answer=async()=>{for(let k=0;k<8;k++){await page.waitForTimeout(120);const b=page.locator('#modal-root [data-kind="card"][data-choice="reject"]');if(await b.count()){await b.first().click();continue}const d=page.locator('#modal-root [data-action="dismiss"]');if(await d.count()){await d.first().click();continue}break}};
  const tab=async id=>{await answer();await page.locator(`.t4-tab[data-tab="${id}"]`).click();await answer()};
  await page.evaluate(id=>{ui.tab='court';ui.caseId=id;render()},inProgress);
  await page.locator('.t4-tabs').waitFor();
  const resumed=await page.evaluate(id=>{const t=S.cases[id].trial4;return {asked:t.heard.length,decided:t.evidence.filter(e=>e.decision).length,synced:!!t.flawSynced}},inProgress);
  const oldT=old.cases[inProgress].trial4;
  assert.equal(resumed.asked,oldT.heard.length,mode+': testimony heard before the update was lost');
  assert.equal(resumed.decided,oldT.evidence.filter(e=>e.decision).length,mode+': evidence decisions lost');
  assert.ok(resumed.synced,mode+': written-case flaws were not checked on load');
  const min=await page.evaluate(id=>S.cases[id].trial4.minDays,inProgress);
  for(let d=0;d<min+1;d++){
   if(await page.evaluate(id=>S.cases[id].trial4.daysDone>=S.cases[id].trial4.minDays,inProgress))break;
   await tab('day');const ob=page.locator('.t4-dock [data-kind="open"]');if(await ob.count())await ob.click();await answer();
   const end=page.locator('.t4-dock [data-action="t4end"]');if(await end.count()){await end.click();await answer()}
   await page.evaluate(id=>{S.cases[id].trial4.nextAt=0;render()},inProgress);
  }
  await tab('verdict');await page.locator('.t4-verdict [data-action="t4verdict"]').first().click();
  const cite=page.locator('.t4-cite').first();if(await cite.count())await cite.click();
  await page.locator('.t4-verdict [data-action="t4confirm"]').click();await page.waitForTimeout(500);await answer();
  assert.ok(await page.evaluate(id=>!!S.cases[id].verdict,inProgress),mode+': resumed trial could not reach a verdict');
  // save, restart, read the old record
  await page.evaluate(()=>{save();VerdictStore.flush()});
  await page.reload({waitUntil:'networkidle'});
  await page.locator('#verdict-entry').waitFor();await page.locator('#profile-continue').click();
  await page.waitForFunction(()=>typeof S!=='undefined'&&S.name,null,{timeout:30000});
  await page.evaluate(id=>{ui.tab='court';ui.caseId=id;render()},finished);
  await page.locator('.t4-tabs').waitFor();await page.locator('.t4-tab[data-tab="log"]').click();
  assert.ok(await page.locator('.t4-timeline li').count()>=1,mode+': old trial record not readable');
  const after=await page.evaluate(()=>({slot2:!!localStorage.getItem('verdict_player_save_2'),verdicts:Object.values(S.cases).filter(s=>s.verdict).length}));
  assert.ok(after.slot2,mode+': second player slot lost');
  assert.ok(after.verdicts>=2,mode+': verdicts not kept after restart');
  assert.equal(errs.length,0,mode+': page errors: '+errs.join('; '));
  console.log(`PASS (${mode}): v5.7 save → v${await page.evaluate(()=>window.VERDICT_VERSION)} · ${now.npc.length} NPCs, ${now.news.length} news, resumed trial to verdict, record readable after restart`);
  await ctx.close();
 }
}finally{await browser.close();server.close()}
