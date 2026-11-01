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
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end('')}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.addInitScript(()=>{try{localStorage.setItem('verdict_match_off','1')}catch{}});   // this test covers the scripted trial; match trials: tests/match-play.mjs
const errs=[];page.on('pageerror',e=>errs.push(e.message));
const answer=async()=>{for(let k=0;k<8;k++){await page.waitForTimeout(100);const b=page.locator('#modal-root [data-kind="card"][data-choice="reject"]');if(await b.count()){await b.first().click();continue}const d=page.locator('#modal-root [data-action="dismiss"]');if(await d.count()){await d.first().click();continue}break}};
const tab=async id=>{await answer();await page.locator(`.t4-tab[data-tab="${id}"]`).click();await answer()};
const open=async id=>{await page.evaluate(i=>{ui.tab='court';ui.caseId=i;render()},id);await page.locator('.t4-tabs').waitFor()};
const startSession=async()=>{await tab('day');const ob=page.locator('.t4-dock [data-kind="open"]');if(await ob.count())await ob.click();await answer()};
const useAll=async()=>{await tab('evidence');for(let k=0;k<3;k++){const u=page.locator('.t4 [data-kind="decide"][data-choice="use"]:not([disabled])').first();if(await u.count())await u.click();await answer();const nx=page.locator('.t4-pagenav [data-action="t4page"]:not([disabled])').last();if(await nx.count())await nx.click()}};
const verdict=async(first=true)=>{/* a trial where nothing was heard or used yet has nothing to cite: use the evidence first, as a player would */await page.evaluate(()=>{const t=S.cases[ui.caseId]?.trial4;if(t&&!t.heard.length&&!t.evidence.some(e=>e.decision==='use'))t.evidence.forEach(e=>e.decision='use')});await tab('verdict');await page.locator('[data-action="t4sheet"][data-v="open"]').click();await page.locator('.t4-verdict [data-action="t4verdict"]')[first?'first':'last']().click();for(let k=0;k<4&&!(await page.locator('.t4-sheet .t4-cite').count());k++)await page.locator('.t4-sheet-foot .btn.primary').click();if(await page.locator('.t4-sheet .t4-cite').count())await page.locator('.t4-sheet .t4-cite').first().click();for(let k=0;k<4&&!(await page.locator('.t4-verdict [data-action="t4confirm"]').count());k++)await page.locator('.t4-sheet-foot .btn.primary').click();await page.locator('.t4-verdict [data-action="t4confirm"]').click();await page.waitForTimeout(400);await answer()};
const make=aid=>page.evaluate(a=>{const cand=CasePackEngine.pool(S).find(x=>x.a.id===a);const c=createGeneratedCase(cand);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};c.week=S.week;save();return c.id},aid);
const finishDays=async id=>{for(let d=0;d<6;d++){if(await page.evaluate(i=>{const t=S.cases[i].trial4;return t.daysDone>=t.minDays},id))break;await startSession();
 const end=page.locator('.t4-dock [data-action="t4end"]');if(await end.count()){await end.click();await answer()}await page.evaluate(i=>{S.cases[i].trial4.nextAt=0;render()},id)}};
const results=[];const ok=m=>{results.push(m);console.log('  ✓ '+m)};
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('v6 검증');
 await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});
 await page.waitForFunction(()=>!!S.bench?.assoc&&(S.casePacks||[]).some(p=>p.packId==='v6-new-30'),null,{timeout:10000});
 assert.equal(await page.evaluate(()=>CasePackEngine.pool(S).length-(window.VerdictSheets?.pack?.archetypes?.length||0)),60);   // 60 curated + the world-sheet cases (v8)
 // free up the docket so test cases can be created
 await page.evaluate(()=>{for(const c of S.generatedCases)S.cases[c.id].referred=true;save()});

 // 1 decision case
 for(const aid of ['v6-family-guardian-signature','v6-family-adoption-record','v6-family-two-journals','v6-public-lottery-rank']){
  const id=await make(aid);await open(id);
  const info=await page.evaluate(i=>{const c=CASES.find(x=>x.id===i),t=VerdictTrialPlay.ensure(c,S.cases[i]);return {min:t.minDays,labels:c.verdicts.map(v=>v.id)}},id);
  assert.equal(info.min,1,aid+': decision case must take one hearing');assert.deepEqual(info.labels,['full','dismiss'],aid+': decision has exactly two outcomes');
  if(aid==='v6-public-lottery-rank'){await startSession();await useAll();
   await page.locator('.t4-dock [data-action="t4end"]').click();await answer();
   assert.equal(await page.locator('.t4-dock [data-kind="open"]').count(),0,'no second hearing for a decision case');
   assert.ok(await page.locator('.t4-dock [data-tab="verdict"]').count()>=1,'decision case goes straight to the decision');
   await tab('verdict');assert.equal(await page.locator('.t4-step').count(),0,'no amount or sentence controls in a decision');
   await verdict(true);
   const ord=await page.evaluate(i=>S.cases[i].trial4.final.judgment.order,id);
   assert.match(ord,/변경한 당첨 순위 결정을 취소한다/,'decision order text');
  }
  await page.evaluate(i=>{if(!S.cases[i].verdict)S.cases[i].referred=true},id);
 }
 ok('결정형 4건: 심리 1회, 결정 2가지, 금액 없음, 주문 문구');

 // 2 + 3 people-driven witnesses, confrontation, face-off
 const cid=await make('v6-homicide-cold-storage');await open(cid);await startSession();await useAll();
 const beh=await page.evaluate(i=>{const c=CASES.find(x=>x.id===i),t=S.cases[i].trial4;return t.witnesses.map((w,k)=>{const p=NPC[w.id];
  const r=VerdictTrialCore.attitudeOf({traits:p.traits,age:new Date().getFullYear()&&(year()-p.bornYear),stake:[VerdictCurated.cases[c.contentPack.archetypeId].witnesses[k].stake,VerdictCurated.cases[c.contentPack.archetypeId].witnesses[k].story,VerdictCurated.cases[c.contentPack.archetypeId].witnesses[k].role].join(' ')},t.seed+':'+k);
  return {stored:w.attitude,replay:r.attitude,because:w.because}})},cid);
 for(const b of beh)assert.equal(b.stored,b.replay,'witness attitude must replay from the NPC, stake and seed');
 ok('증인 태도: 저장된 값이 인물 성향·이해관계·시드로 그대로 재현됨 ('+beh.map(b=>b.stored).join(', ')+')');
 // bench advice on every evidence card
 await tab('evidence');assert.ok(await page.locator('.t4-bench').count()>=1,'bench advice on evidence card');
 const adv=await page.locator('.t4-bench').first().innerText();assert.match(adv,/배석판사|재판연구원/);
 ok('재판부 의견이 증거 카드에 표시됨');
 // force a contradiction on the issue of evidence e0 (side p): the witness answered the other way
 await page.evaluate(i=>{const t=S.cases[i].trial4;t.qLeft=8;t.heard.push({w:1,q:'q1',side:'d',issue:'i1',day:t.day});t.witnesses[1].askedIds.push('q1');render()},cid);
 await tab('witness');await page.evaluate(()=>{ui.t4w=1;render()});
 const cfBtn=page.locator('.t4 .t4-q.cf:not([disabled])').first();assert.ok(await cfBtn.count(),'show-evidence button appears for a contradiction');
 const before=await page.evaluate(i=>S.cases[i].trial4.qLeft,cid);await cfBtn.click();await answer();
 const cf=await page.evaluate(i=>{const t=S.cases[i].trial4;return {left:t.qLeft,entry:t.heard.find(h=>String(h.q).startsWith('cf:')),truth:t.truth}},cid);
 assert.equal(cf.left,before-1,'showing evidence costs one question');assert.ok(cf.entry?.text,'confrontation recorded with text');
 if(['p','d','m'].includes(cf.entry.side)&&cf.entry.side!=='n')assert.equal(cf.entry.side,{did:'p',didnt:'d',reason:'m'}[cf.truth],'admission follows the truth');
 assert.ok(await page.locator('.t4-qa.v6').count()>=1,'confrontation shown on the witness card');
 ok('증거로 반박: 버튼 표시, 신문 1회 차감, 결과 기록·표시 ('+cf.entry.label+')');
 await page.evaluate(i=>{const t=S.cases[i].trial4;t.heard.push({w:0,q:'q3',side:'p',issue:'i3',day:t.day},{w:2,q:'q2',side:'d',issue:'i3',day:t.day});t.qLeft=4;render()},cid);
 await tab('witness');const face=page.locator('.t4-q.face:not([disabled])').first();assert.ok(await face.count(),'face-off offered when two witnesses contradict');
 await face.click();await answer();
 const fo=await page.evaluate(i=>{const t=S.cases[i].trial4;return {left:t.qLeft,faced:t.faced,entry:t.heard.find(h=>String(h.q).startsWith('face:'))}},cid);
 assert.equal(fo.left,2,'face-off costs two questions');assert.deepEqual(fo.faced,['i3']);assert.ok(fo.entry?.label);
 assert.equal(await page.locator('.t4-q.face').count(),0,'face-off happens once per issue');
 ok('대질 신문: 엇갈림에서 열림, 신문 2회 차감, 쟁점당 1회 ('+fo.entry.label+')');

 // 4 bench growth and promotion
 const skill0=await page.evaluate(()=>S.bench.assoc.skill);
 await finishDays(cid);await open(cid);await verdict(true);
 const skill1=await page.evaluate(()=>S.bench.assoc.skill);assert.ok(skill1>skill0,'associate judge grows after a verdict');
 const assoc=await page.evaluate(()=>S.bench.assoc.id);
 await page.evaluate(()=>{S.bench.assoc.cases=5;S.bench.assoc.since=VerdictCalendar.today()-4*365});
 const cid2=await make('v6-homicide-parking-14');await open(cid2);await finishDays(cid2);await open(cid2);await verdict(false);
 const promo=await page.evaluate(a=>({alumni:S.bench.alumni.map(x=>x.id),now:S.bench.assoc.id,role:NPC[a].role}),assoc);
 assert.ok(promo.alumni.includes(assoc)&&promo.now!==assoc,'associate judge moves on after years and cases');assert.equal(promo.role,'단독판사');
 await page.evaluate(()=>{ui.tab='people';ui.pmTab='map';render()});
 assert.ok((await page.locator('.pm-row').allInnerTexts()).some(t=>t.includes('전 배석판사')),'former associate shown as a colleague');
 ok('재판부: 판결 뒤 실력 상승, 3년·4건 뒤 단독판사로 이동, 인맥에 법원 동료로 표시');

 // 5 years later: truth told by a person
 const truthRes=await page.evaluate(i=>{const t=S.cases[i].trial4,skill=t.final.skill;t.revealAt=1;t.final.gameDay=VerdictCalendar.today()-400;VerdictTrialPlay.tick();
  return {told:t.truthTold,thread:(S.threads||[]).find(x=>x.id==='truth:'+i),skill:t.final.skill,was:skill}},cid);
 assert.ok(truthRes.told&&truthRes.thread,'a person tells the truth by message');assert.equal(truthRes.skill,truthRes.was,'scores never change');
 await open(cid);assert.ok(await page.locator('.t4-truth').count(),'result page shows the truth told years later');
 ok('몇 년 뒤의 진실: 인물 문자, 선고 이후 화면 표시, 점수 불변');

 // 6 expert reuse
 const reuse=await page.evaluate(()=>{const id=Object.keys(NPC).find(k=>NPC[k].role==='단독판사')||Object.keys(NPC)[0];
  S.legalWorld.experts=[{id:Object.keys(S.npcDB)[3],field:'산불감식전문가',since:year(),lastCase:'x',cases:1}];
  const c={id:'probe',who:[],side:[]};let hits=0;for(let k=0;k<40;k++){c.id='probe'+k;if(VerdictV6.expertFor('산불 감식 전문가',c))hits++}return hits});
 assert.ok(reuse>5&&reuse<40,'registered experts are sometimes, not always, called again ('+reuse+'/40)');
 ok('전문가 재등장: 같은 분야 역할에서 일부 사건에 다시 불림 ('+reuse+'/40)');

 // 7 pressure messages
 const kinds={};
 for(const [k,choice] of [['exjudge','report'],['classmate','refuse'],['local','ignore']]){
  const id=await make('v6-financial-ghost-payroll');await open(id);await startSession();
  // a natural message may already have arrived when the session opened; replace it with the kind under test
  await page.evaluate(([i,k])=>{S.threads=(S.threads||[]).filter(x=>x.id!=='pressure:'+i);S.pressure.log=S.pressure.log.filter(e=>e.caseId!==i);VerdictV6.onSessionOpen(CASES.find(c=>c.id===i),S.cases[i].trial4,k)},[id,k]);
  const th=await page.evaluate(i=>(S.threads||[]).find(x=>x.id==='pressure:'+i),id);assert.ok(th,'pressure message for '+k);
  const rel0=await page.evaluate(f=>S.relations[f]??30,th.from);
  await page.evaluate(([i,c])=>VerdictWorld.answer('pressure:'+i,c),[id,choice]);
  kinds[k]=await page.evaluate(([i,f])=>({rel:S.relations[f],entry:S.pressure.log.find(e=>e.caseId===i),status:NPC[f].legalStatus,lc:!!NPC[f].legalCareer,role:NPC[f].role,ex:NPC[f].exJudge}),[id,th.from]);
  if(choice==='report'){assert.ok(kinds[k].rel<=Math.max(0,rel0-20),'reporting costs the relation');assert.equal(kinds[k].status,'징계 절차 중','reported lawyer faces discipline '+JSON.stringify(kinds[k]))}
  if(choice==='refuse')assert.ok(kinds[k].rel<=Math.max(0,rel0-6),'refusal lowers the relation '+JSON.stringify({rel0,now:kinds[k].rel,entry:kinds[k].entry}));
  if(choice==='ignore'){await useAll();await finishDays(id);await open(id);await verdict(true);
   const before=await page.evaluate(()=>S.news.length);
   await page.evaluate(i=>{S.cases[i].trial4.final.gameDay=VerdictCalendar.today()-200;S.pressure.log.find(e=>e.caseId===i).surfaced=null;VerdictV6.pressureTick()},id);
   kinds[k].surfaced=await page.evaluate(i=>S.pressure.log.find(e=>e.caseId===i).surfaced,id);
   assert.ok(typeof kinds[k].surfaced==='boolean','ignored request is checked after the verdict');
   if(kinds[k].surfaced)assert.ok(await page.evaluate(n=>S.news.length>n,before),'surfaced request reaches the news')}
  else await page.evaluate(i=>{S.cases[i].referred=true},id);
 }
 ok('청탁 문자: 전관 변호사 보고→징계 회부, 동기 거절→관계 하락, 지역 유력자 무시→판결 뒤 기사 여부 판정('+kinds.local.surfaced+')');

 // 8 personnel season
 await page.evaluate(()=>{ui.modal=null;S.week=Math.max(S.week,Math.ceil((Date.UTC(2028,1,3)-Date.UTC(2027,2,1))/604800000));S.realtimeInbox.dayProgress=0;render();VerdictV6.seasonTick()});
 await page.locator('#modal-root [data-action="v6dept"][data-dept="family"]').waitFor();
 assert.ok(await page.locator('#modal-root .v6-book').count(),'yearbook shown in the season');
 await page.locator('#modal-root [data-action="v6dept"][data-dept="family"]').click();
 const dept=await page.evaluate(()=>({dept:S.season.dept,asked:S.season.asked,label:VerdictV6.deptLabel()}));
 assert.equal(dept.dept,'family');assert.equal(dept.label,'가사부');
 const share=await page.evaluate(()=>{let fam=0,all=0;for(let k=0;k<400;k++){for(const o of VerdictDocket.offerPair('2029-01-01T'+k)){all++;if(o.category==='family')fam++}}return fam/all});
 assert.ok(share>0.12,'family cases come more often after choosing 가사부 ('+share.toFixed(2)+')');
 assert.ok(share<0.8,'other cases still come');
 ok('인사철: 2월 연감 + 희망 부서 선택, 가사 사건 배당 비율 '+(share*100).toFixed(0)+'% (기본 약 10%)');

 assert.equal(errs.length,0,'page errors: '+errs.join('; '));
 console.log('PASS: v6 flow · '+results.length+' checks');
}finally{await browser.close();server.close()}
