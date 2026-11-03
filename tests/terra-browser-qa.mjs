/* P3-12: real six-tab browser QA against a staged world sheet.
 * Builds a PRIVATE temporary copy of the game entry + generated index, never
 * edits source world-sheets/cases, generated production assets, or player saves.
 * Run: node tests/terra-browser-qa.mjs --sheet /path/to/world-sheet.json
 * Fixture: node tests/terra-browser-qa.mjs --fixture clinic-001
 */
import {chromium} from 'playwright';
import {courtUI} from './lib/court-ui.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=process.cwd(),args=process.argv.slice(2);
if(args.length!==2||!['--sheet','--fixture'].includes(args[0]))throw Error('사용법: --sheet path/to/sheet.json 또는 --fixture clinic-001');
const input=args[0]==='--fixture'?path.join(root,'world-sheets','cases',args[1]+'.json'):path.resolve(args[1]);
const candidate=JSON.parse(fs.readFileSync(input,'utf8'));
if(candidate.format!=='verdict-world-sheet/v1'||!/^[-a-z0-9]+$/.test(candidate.id)||!['draft','review','ready'].includes(candidate.status))
 throw Error('올바른 세계 시트 ID·형식·상태가 필요합니다.');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'verdict-terra-browser-'));
let browser,server;
try{
 // Symlink immutable production assets. Only the candidate and generated
 // indexes are real files in the sandbox; no writes are made to the repo.
 const exclude=new Set(['tests','world-sheets','case-data','world_sheets.js','world_sheets_index.js','pending','qa-visuals','.git','node_modules']);
 for(const entry of fs.readdirSync(root,{withFileTypes:true})){
  if(exclude.has(entry.name))continue;
  fs.symlinkSync(path.join(root,entry.name),path.join(temp,entry.name),entry.isDirectory()?'dir':'file');
 }
 fs.mkdirSync(path.join(temp,'tests'));
 fs.copyFileSync(path.join(root,'tests','build-sheets.cjs'),path.join(temp,'tests','build-sheets.cjs'));
 fs.mkdirSync(path.join(temp,'world-sheets','cases'),{recursive:true});
 for(const name of fs.readdirSync(path.join(root,'world-sheets','cases')).filter(x=>x.endsWith('.json'))){
  if(name===candidate.id+'.json')continue;
  fs.symlinkSync(path.join(root,'world-sheets','cases',name),path.join(temp,'world-sheets','cases',name));
 }
 // Only sandbox data is marked review so the normal game builder will
 // include it. The source sheet stays draft and unapproved.
 fs.writeFileSync(path.join(temp,'world-sheets','cases',candidate.id+'.json'),
  JSON.stringify({...candidate,status:'review'},null,2)+'\n',{flag:'wx'});
 fs.mkdirSync(path.join(temp,'case-data'));
 for(const name of fs.readdirSync(path.join(root,'case-data')).filter(x=>x.endsWith('.json')&&x!=='manifest.json'&&x!=='sheet-'+candidate.id+'.json'))
  fs.symlinkSync(path.join(root,'case-data',name),path.join(temp,'case-data',name));
 const built=spawnSync(process.execPath,[path.join(temp,'tests','build-sheets.cjs')],{cwd:temp,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
 if(built.status!==0)throw Error('임시 세계 시트 빌드 실패: '+(built.stderr||built.stdout).slice(-900));
 const index=fs.readFileSync(path.join(temp,'world_sheets_index.js'),'utf8');
 if(!index.includes(candidate.id))throw Error('검증 대상 사건이 게임 사건 목록에 나타나지 않음');
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
 server=http.createServer((req,res)=>{
  let loc;
  try{loc=decodeURIComponent(req.url.split('?')[0]);}catch{res.writeHead(400);return res.end()}
  const file=path.resolve(temp,'.'+loc.replace(/\/$/,'/index.html'));
  if(!file.startsWith(temp+path.sep)){res.writeHead(403);return res.end()}
  fs.readFile(file,(e,bytes)=>{if(e){res.writeHead(404);return res.end('Not found')}
   res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes)});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/';
 browser=await chromium.launch({headless:true});
 const results=[];
 for(const trialNo of [0,1,2]){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage(),pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  try{
   await page.goto(url,{waitUntil:'networkidle'});
   await page.locator('#profile-continue').click();
   await page.locator('#playerName').fill('신규 사건 QA '+trialNo);
   await page.locator('[data-action="start"]').last().click();
   await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});
   await page.evaluate(()=>VerdictCurated.loadAll());
   const caseId=await page.evaluate(targetId=>{
    for(const item of S.generatedCases)if(S.cases[item.id])S.cases[item.id].referred=true;
    const cand=CasePackEngine.pool(S).find(x=>x.a.id===targetId);
    if(!cand)throw Error('사건 배당 후보 없음: '+targetId);
    const c=createGeneratedCase(cand);
    S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};
    c.week=S.week;ui.tab='court';ui.caseId=c.id;render();return c.id;
   },candidate.id);
   await page.locator('.t4-tabs').waitFor();
   const U=courtUI(page);
   const tabs=await page.locator('.t4-tab').evaluateAll(nodes=>nodes.map(x=>x.dataset.tab));
   assert.deepEqual(tabs,['case','day','evidence','witness','orders','verdict']);
   const raw=/\{[A-Z]\d?(?:[>|][^}]*)?\}|\[object Object\]|undefined/;
   await U.tab('case');await U.settle();
   assert.ok(!raw.test(await page.locator('.t4-page').innerText()),'공개 사건 설명 미치환');
   const n=await page.evaluate(id=>S.cases[id].trial4.minDays,caseId);
   let heard=false,observed=false;
   for(let d=0;d<n;d++){
    await U.tab('day');await U.openSession();await U.settle();
    await U.tab('evidence');
    const evidenceText=await page.locator('.t4-page').innerText();
    assert.ok(!raw.test(evidenceText),'증거 문장 미치환');
    observed||=await page.locator('.t4-excerpt').count()>0;
    const use=page.locator('.t4 [data-kind="decide"][data-choice="conditional"]:not([disabled])').first();
    if(await use.count()){await use.click();await U.settle()}
    await U.tab('witness');
    const ask=page.locator('.t4-pager .t4-q:not([disabled])').first();
    if(await ask.count()){await U.ask(ask);heard=true}
    await U.tab('orders');
    if(d===0){const order=page.locator('.t4-q.order').first();if(await order.count())await U.order(order)}
    await U.endSession();
    await page.evaluate(id=>{S.cases[id].trial4.nextAt=0;render()},caseId);
   }
   assert.ok(observed&&heard,'증거 및 증인신문에 접근해야 합니다');
   await U.tab('verdict');await U.settle();
   await page.locator('[data-action="t4sheet"][data-v="open"]').click();
   await page.locator('.t4-verdict [data-action="t4verdict"]').last().click();
   for(let k=0;k<4&&!(await page.locator('.t4-sheet .t4-cite').count());k++)await page.locator('.t4-sheet-foot .btn.primary').click();
   await page.locator('.t4-sheet .t4-cite').first().click();
   for(let k=0;k<6;k++){
    const go=page.locator('.t4-sheet [data-action="t4confirm"], .t4-sheet-foot .btn.primary').last();
    if(!await go.count())break;
    await go.click();
    if(await page.evaluate(id=>!!S.cases[id].verdict,caseId))break;
    const f=page.locator('.t4-sheet [data-action="t4factor"], .t4-sheet [data-action="t4sent"]').first();
    if(await f.count())await f.click();
   }
   const outcome=await page.evaluate(id=>({done:!!S.cases[id].verdict,final:!!S.cases[id].trial4.final,truth:S.cases[id].trial4.truth}),caseId);
   assert.ok(outcome.done&&outcome.final,'실제 판결문 확정 실패');
   assert.deepEqual(pageErrors,[],'브라우저 오류 발생');
   results.push({trial:trialNo+1,days:n,tabs:tabs.length,truth:outcome.truth,verdict:true});
   console.log('✓ '+candidate.id+' 실제 공판 '+(trialNo+1)+'회: '+n+'기일 · 여섯 메뉴 · 선고 완료');
  }finally{await context.close()}
 }
 assert.equal(results.length,3);
 console.log(JSON.stringify({ok:true,id:candidate.id,stage:'browser-courtroom-QA',results},null,2));
}finally{
 if(browser)await browser.close();
 if(server)await new Promise(resolve=>server.close(resolve));
 fs.rmSync(temp,{recursive:true,force:true});
}
