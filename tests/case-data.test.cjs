/* v8.2.3 case data on demand: the index the game loads at start + case-data/<id>.json must add up to exactly the full
 * written cases (curated_cases.js) and the full world sheets (world_sheets.js), and loading must be idempotent.
 * Run: node tests/case-data.test.cjs */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
const fetchLocal=url=>{const f=path.join(root,url.replace(/^\.\//,''));let n=0;return Promise.resolve({ok:fs.existsSync(f),status:fs.existsSync(f)?200:404,json:()=>{n++;return Promise.resolve(JSON.parse(fs.readFileSync(f,'utf8')))}})};
(async()=>{
 /* full builds, as tests and tools see them */
 const full={window:{}};vm.createContext(full);vm.runInContext(fs.readFileSync(path.join(root,'curated_cases.js'),'utf8'),full);vm.runInContext(fs.readFileSync(path.join(root,'world_sheets.js'),'utf8'),full);
 const FC=full.window.VerdictCurated.cases,FS=full.window.VerdictSheets.cases;
 /* the game's start: index files only, then fetch */
 let fetched=0;const lazy={window:{},fetch:u=>{fetched++;return fetchLocal(u)},localStorage:{getItem:()=>null},console};lazy.window.fetch=lazy.fetch;
 vm.createContext(lazy);
 for(const f of ['curated_index.js','match_engine.js','world_sheets_index.js','match_play.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),lazy,{filename:f});
 const V=lazy.window.VerdictCurated,SH=lazy.window.VerdictSheets;
 assert.ok(V.lazy,'the game build is the lazy one');
 const start=fs.statSync(path.join(root,'curated_index.js')).size+fs.statSync(path.join(root,'world_sheets_index.js')).size;
 const fullSize=fs.statSync(path.join(root,'curated_cases.js')).size+fs.statSync(path.join(root,'world_sheets.js')).size;
 assert.ok(start<fullSize*0.2,`start-up data should be small (${Math.round(start/1024)}KB vs ${Math.round(fullSize/1024)}KB)`);
 assert.equal(Object.keys(V.cases).length,72,'every case is known from the start (pool, offers)');
 for(const id of Object.keys(V.cases)){assert.ok(!V.isLoaded(id),id+' not loaded yet');assert.ok(V.cases[id].logline,id+': offer line in the index')}
 assert.ok(Object.values(SH.cases).every(s=>s.stub),'sheets are stubs at start');
 /* load everything twice: same objects, no extra fetches the second time */
 await V.loadAll();const after=fetched;await V.loadAll();assert.equal(fetched,after,'a loaded case is never fetched again');
 for(const id of Object.keys(FC)){const a=JSON.parse(JSON.stringify(V.cases[id])),b=JSON.parse(JSON.stringify(FC[id]));assert.deepEqual(a,b,id+': index + case-data = full case')}
 for(const id of Object.keys(FS)){assert.ok(!SH.cases[id].stub,id+': sheet loaded');assert.deepEqual(JSON.parse(JSON.stringify(SH.cases[id])),JSON.parse(JSON.stringify(FS[id])),id+': sheet file = full sheet')}
 const sheetOnly=Object.keys(V.cases).filter(id=>!FC[id]);assert.equal(sheetOnly.length,12);
 for(const id of sheetOnly){const c=V.cases[id];assert.ok(c.evidence?.length>=3&&c.witnesses?.length&&c.truth,id+': sheet case becomes a full written-case shape')}
 /* every fetchable file is in the offline list */
 const m=JSON.parse(fs.readFileSync(path.join(root,'case-data','manifest.json'),'utf8')).files;
 for(const f of fs.readdirSync(path.join(root,'case-data')).filter(f=>f!=='manifest.json'))assert.ok(m.includes(f),f+' missing from case-data/manifest.json (offline)');
 for(const f of m)assert.ok(fs.existsSync(path.join(root,'case-data',f)),f+' is listed for offline but does not exist (one missing file makes the worker cache nothing)');
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(/curated_index\.js/.test(html)&&!/curated_cases\.js/.test(html),'the game loads the index, not the full file');
 assert.ok(/case-data\/manifest\.json/.test(sw),'the service worker keeps case data for offline play');
 console.log(`PASS case data on demand · start ${Math.round(start/1024)}KB (was ${Math.round(fullSize/1024)}KB) · 72 cases · ${fetched} files fetched once`);
})().catch(e=>{console.error(e);process.exit(1)});
