/* Match trials in the game (v8). Run: node tests/match-play.mjs
 * A. Sheet cases are in the offer pool; a new sheet-only case (adv-cr-006) and a curated one with a sheet
 *    (murder-campus-conflict) open with the match engine: the truth is the trial's own, the sheet is not copied into
 *    the save, witnesses are the sheet's people (sex and roles), the court log shows no raw name tokens.
 * B. Through the real screen: open a session, ask, confront, order; end the day; the next session brings the order's
 *    record; reload keeps everything; after the minimum sessions the verdict goes through the career pipeline
 *    (st.verdict, grade, judgment, press) and the hidden grade stays hidden until the truth comes out.
 * C. Every sheet case × several seeds through the screen-free path (create → attach → play → verdict) without errors.
 * D. An old trial (no t.match) of a curated case with a sheet keeps the old engine. */
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end('')}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const url='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
const shot=process.env.SHOTS?async n=>page.screenshot({path:`qa-visuals/match-${n}.png`,fullPage:false}):async()=>{};
const close=async()=>{for(let k=0;k<6;k++){await page.waitForTimeout(80);const d=page.locator('#modal-root .modal-veil');if(!await d.count())break;const b=page.locator('#modal-root [data-action="dismiss"], #modal-root .modal-actions button').last();if(await b.count())await b.dispatchEvent('click');else await page.evaluate(()=>{ui.modal='';render()})}};
const tab=async id=>{await close();await page.locator(`.t4-tab[data-tab="${id}"]`).click();await close()};
const boot=async()=>{await page.locator('#verdict-entry').waitFor();await page.locator('#profile-continue').click();await page.waitForFunction(()=>typeof S!=='undefined'&&S.name,null,{timeout:30000})};
const make=id=>page.evaluate(id=>{const cand=CasePackEngine.pool(S).find(x=>x.a.id===id);if(!cand)return null;const c=createGeneratedCase(cand);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};c.week=S.week;save();return c.id},id);
try{
 await page.goto(url,{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('매치 검증');
 await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});
 // ---- A ----
 const pool=await page.evaluate(()=>{const ids=new Set(CasePackEngine.pool(S).map(x=>x.a.id));return {sheets:Object.keys(VerdictSheets.cases).filter(id=>ids.has(id)).length,all:Object.keys(VerdictSheets.cases).length,size:ids.size}});
 assert.equal(pool.sheets,pool.all,'every sheet case can be offered');console.log(`  ✓ pool: ${pool.size} cases, ${pool.sheets} with a world sheet`);
 const off=await page.evaluate(()=>VerdictDocket.offerPair('2099-01-01T10').length);assert.ok(off>=1);
 await page.evaluate(()=>{for(const c of S.generatedCases)S.cases[c.id].referred=true});
 const id=await make('adv-cr-006');assert.ok(id,'sheet-only case created');
 await page.evaluate(i=>{ui.tab='court';ui.caseId=i;render()},id);await page.locator('.t4-tabs').waitFor();
 const a=await page.evaluate(i=>{const c=CASES.find(x=>x.id===i),t=S.cases[i].trial4,s=VerdictSheets.cases['adv-cr-006'];
  return {match:!!t.match,truth:t.match?.truth===t.truth,saveHasSheet:JSON.stringify(S).includes(s.worlds.did.act.slice(0,30)),wn:t.witnesses.length,sw:s.people.filter(p=>/^W/.test(p.key)).length,
   A:NPC[c.who[0]].gender,B:NPC[c.who[1]].gender,roles:t.witnesses.map(w=>w.role)}},id);
 assert.ok(a.match&&a.truth,'match engine attached with the trial truth');assert.ok(!a.saveHasSheet,'the sheet is not copied into the save');
 assert.equal(a.wn,a.sw,'witnesses are the sheet people');assert.ok(/남/.test(a.A)&&/여/.test(a.B),'parties follow the sheet sex');
 console.log('  ✓ sheet case opens with the match engine:',a.roles.join(' · '));
 const caseText=await page.locator('.t4-page').innerText();assert.ok(!/\{[A-Z]\d?(\|[가-힣]+)?\}/.test(caseText),'no raw tokens on the case page');
 await shot('case');
 // ---- B ----
 await page.locator('.t4-dock [data-kind="open"]').click();await close();await tab('day');
 assert.ok(await page.locator('.mp-act').count()>=3,'actions are offered');await shot('day');
 const clickAct=async type=>{const b=page.locator(`.mp-act[data-a*='"type":"${type}"']`).first();if(!await b.count())return false;await b.evaluate(e=>e.closest('details')&&(e.closest('details').open=true));await b.click();await close();return true};
 assert.ok(await clickAct('ask'));assert.ok(await clickAct('order'));await clickAct('ask');await clickAct('confront')||await clickAct('ask');
 const left=await page.evaluate(i=>S.cases[i].trial4.match.actions,id);assert.equal(left,0,'four actions used');
 const day1=await page.locator('.mp-log').innerText();assert.ok(!/\{[A-Z]\d?(\|[가-힣]+)?\}/.test(day1),'no raw tokens in the court log');
 await page.locator('.t4-dock [data-action="t4end"]').click();await close();
 await page.evaluate(i=>{S.cases[i].trial4.nextAt=0;save();VerdictStore.flush()},id);
 await page.reload({waitUntil:'networkidle'});await boot();
 await page.evaluate(i=>{ui.tab='court';ui.caseId=i;render()},id);await page.locator('.t4-tabs').waitFor();
 const ordered=await page.evaluate(i=>Object.values(S.cases[i].trial4.match.records).filter(r=>r.status==='ordered').length,id);
 await page.locator('.t4-dock [data-kind="open"]').click();await page.waitForTimeout(150);await shot('open2');await close();
 const after=await page.evaluate(i=>{const m=S.cases[i].trial4.match;return {day:m.day,inNew:Object.values(m.records).filter(r=>r.status==='in'&&r.day===2).length,late:m.log.filter(l=>['지연','제출 거부'].includes(l.tag)).length}},id);
 assert.equal(after.day,2,'second session');assert.ok(ordered===0||after.inNew+after.late>=1,'the ordered record came back (or was late / declined)');
 console.log(`  ✓ session 2 opened after reload: ${after.inNew} new record(s), ${after.late} late/declined`);
 await tab('evidence');await shot('records');
 await tab('day');for(let k=0;k<4;k++)if(!await clickAct('confront')&&!await clickAct('ask')&&!await clickAct('party'))await clickAct('order');
 await page.locator('.t4-dock [data-action="t4end"]').click();await close();
 await tab('verdict');await shot('verdict');
 await page.locator('[data-action="mpv"][data-k="choice"][data-v="did"]').click();
 const sent=page.locator('[data-action="mpv"][data-k="sent"]');if(await sent.count())await sent.nth(1).click();
 await page.locator('[data-action="mpgo"]').click();await page.waitForTimeout(200);await shot('sentenced');await close();
 const v=await page.evaluate(i=>{const st=S.cases[i],t=st.trial4;return {verdict:st.verdict,grade:st.grade,final:!!t.final,judg:t.final?.judgment?.order,done:t.match.done?.grade}},id);
 assert.ok(v.verdict&&v.grade>0&&v.final&&v.judg&&v.done,'verdict recorded through the career pipeline');
 const res=await page.locator('.t4-page').innerText();assert.ok(!res.includes(v.done),'the hidden grade stays hidden after sentencing');
 console.log(`  ✓ verdict: ${v.judg} · 실력 ${v.grade}`);
 // ---- C ----
 const many=await page.evaluate(()=>{const out=[];for(const sid of Object.keys(VerdictSheets.cases))for(let k=0;k<3;k++){
  S.rng=(S.rng||1)+7;const cand=CasePackEngine.pool(S).find(x=>x.a.id===sid);let c;try{c=createGeneratedCase(cand)}catch(e){out.push(sid+': '+e.message);continue}
  S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};const st=S.cases[c.id];const t=VerdictTrialPlay.ensure(c,st);
  if(!t.match){out.push(sid+': no match');continue}
  const s=VerdictSheets.cases[sid];for(let d=0;d<3;d++){let a;while(t.match.actions>0&&(a=VerdictMatch.available(s,t.match)).length)VerdictMatch.act(s,t.match,a[(d*3+k)%a.length]);VerdictMatch.endDay(s,t.match)}
  const g=VerdictMatch.verdict(s,t.match,['did','didnt','reason'][k]);if(!g.grade)out.push(sid+': no grade');st.referred=true}
  return out});
 assert.deepEqual(many,[],'every sheet case plays');console.log(`  ✓ ${Object.keys(await page.evaluate(()=>VerdictSheets.cases)).length} sheet cases × 3 seeds play to a verdict`);
 // ---- D ----
 const old=await page.evaluate(()=>{const cand=CasePackEngine.pool(S).find(x=>x.a.id==='murder-campus-conflict');const c=createGeneratedCase(cand);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};
  const st=S.cases[c.id];const t=VerdictTrialPlay.ensure(c,st);const had=!!t.match;delete t.match;t.minDays=3;ui.tab='court';ui.caseId=c.id;render();return {had,id:c.id}});
 assert.ok(old.had,'curated case with a sheet starts as a match trial');
 assert.ok(await page.locator('.t4-tab[data-tab="witness"]').count(),'an old trial without t.match keeps the old screen');
 console.log('  ✓ curated case with a sheet → match trial; an old trial stays on the old engine');
 // ---- E: phone, folded and unfolded Fold widths ----
 const sid=await make('adv-cr-010');await page.evaluate(i=>{ui.tab='court';ui.caseId=i;render()},sid);await page.locator('.t4-tabs').waitFor();
 await page.locator('.t4-dock [data-kind="open"]').click();await close();
 for(const [w,h] of [[390,844],[412,915],[884,1104]]){await page.setViewportSize({width:w,height:h});
  for(const tb of ['case','day','evidence','log','verdict']){await tab(tb);
   const over=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(over<=1,`${w}px ${tb}: no sideways scroll (${over})`);
   if(process.env.SHOTS&&['day','verdict'].includes(tb))await page.screenshot({path:`qa-visuals/match-${w}-${tb}.png`})}}
 console.log('  ✓ 390 · 412 · 884px: no sideways scroll on the match pages');
 assert.deepEqual(errs,[],'no page errors');
 console.log('PASS match play');
}finally{await browser.close();server.close()}
