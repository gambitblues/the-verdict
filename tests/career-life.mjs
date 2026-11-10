/* v11 — 법관의 삶과 커리어 (career_life.js + world_feed texts + trial_play issue memo). Run: node tests/career-life.mjs
 * A. 핵심 쟁점 메모: on the case page, 2~4 lines in four plain states, never a direction or a verdict word.
 * B. 문자: over two game years — at most two texts a game month, one person at most every 45 days, each from a real
 *    event; replies change trust a little and leave only the memory chosen; conversations grouped by person with
 *    unread marks; a person's card links to the conversation.
 * C. 법관 성향: withheld below five verdicts, then lines that match the record; cached (not recomputed per render).
 * D. 5년 회고 once at five years, kept in the career screen; 판결 뒤 이야기 only where something really happened.
 * E. 쟁점 태그: a new case recalls an old one judged a year before with the same issue, without its outcome.
 * Screens at 390px are saved under qa-visuals/ for a look. */
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
async function shots(name,opts={}){for(const [w,h] of [[390,844],[412,915],[884,1104]]){await page.setViewportSize({width:w,height:h});await page.evaluate(()=>render());await page.waitForTimeout(150);await page.screenshot({path:`qa-visuals/${name}-${w}.png`,...opts})}await page.setViewportSize({width:390,height:844});await page.evaluate(()=>render())}
const errs=[];page.on('pageerror',e=>errs.push(e.message));
try{
 await page.goto(url,{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('삶 판사');await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});await page.evaluate(()=>VerdictCurated.loadAll());
 await page.evaluate(()=>{ui.modal=null;document.getElementById('modal-root').innerHTML=''});

 /* A */
 const A=await page.evaluate(()=>{const TP=VerdictTrialPlay;const c=openCases()[0];const st=S.cases[c.id];const t=TP.ensure(c,st);TP.openSession(c,st);
  for(let k=0;k<4&&t.qLeft>0;k++){const i=k%t.witnesses.length,q=TP.questions(c,t,i).find(v=>!t.witnesses[i].askedIds.includes(v.id));if(q)TP.ask(c,t,i,q.id)}
  ui.tab='court';ui.caseId=c.id;render();document.querySelector('[data-action="t4tab"][data-tab="case"]')?.click();const m=document.querySelector('.t4-memo');return {dbg:(document.querySelector('main')?.innerText||'').slice(0,300)+' || cur='+String(!!VerdictTrialPlay.curOf(c))+' case='+String(!!document.querySelector('.t4-case')),has:!!m,items:m?[...m.querySelectorAll('li')].map(li=>li.innerText):[],text:m?.innerText||''}});
 assert.ok(A.has,'the case page has the issue memo: '+A.dbg);assert.ok(A.items.length>=2&&A.items.length<=4,'2~4 lines: '+A.items.length);
 assert.ok(A.items.every(x=>/기록으로 확인되는 사실|진술·증거가 엇갈림|추가 자료가 필요함|아직 확인되지 않음|기록에 근거가 있음/.test(x)),'four plain states only: '+A.items.join(' | '));
 assert.ok(!/유죄|무죄|인용|기각|검찰 쪽|변호인 쪽|원고 쪽|피고 쪽/.test(A.text),'no direction, no verdict word');
 const fold=await page.evaluate(()=>{const r=document.querySelector('.t4-memo')?.getBoundingClientRect();return r?r.top:9999});assert.ok(fold<844,'the memo is on the first screen at 390px: '+fold);
 await shots('v11-issue-memo');
 console.log('  ✓ A issue memo: '+A.items.length+' lines, plain states, no direction');

 /* C (below five verdicts) */
 const c0=await page.evaluate(()=>VerdictCareerLife.judgeProfile());assert.equal(c0.lines,null,'withheld below five verdicts');

 /* judge a few cases quickly (the verdict path itself is covered by verdict-v82/v83) */
 const judged=await page.evaluate(()=>{const TP=VerdictTrialPlay,ids=[];const pool=CasePackEngine.pool(S).filter(x=>VerdictCurated.cases[x.a.id]);
  for(let n=0;n<7;n++){const c=createGeneratedCase(pool[n*3%pool.length]);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};const st=S.cases[c.id],t=TP.ensure(c,st);
   TP.openSession(c,st);for(const e of t.evidence)e.decision=n%2?'exclude':'use';
   for(let k=0;k<6&&t.qLeft>0;k++){const i=k%t.witnesses.length,q=TP.questions(c,t,i).find(v=>!t.witnesses[i].askedIds.includes(v.id));if(q)TP.ask(c,t,i,q.id)}
   const o=TP.orders.available(c,t)[0];if(o)TP.orders.issue(c,t,o.key);
   t.daysDone=3;t.final={label:'판결',dir:'acquit',items:[{key:'cite:0'},{key:'cite:1'}],at:Date.now()};st.verdict='v';st.closedWeek=S.week;c.week=Math.min(c.week,S.week);ids.push(c.id)}
  return ids});
 const C=await page.evaluate(()=>{const a=VerdictCareerLife.judgeProfile();const b=VerdictCareerLife.judgeProfile();return {a,same:a===b}});
 assert.ok(C.a.lines&&C.a.title,'a profile from five verdicts on');assert.ok(C.same,'cached until the next verdict');
 assert.ok(/형사|민사|가사/.test(C.a.lines.field));
 console.log(`  ✓ C judge profile from ${C.a.n} verdicts: ${C.a.title} · ${Object.values(C.a.lines).join(' · ')}`);

 /* B: two game years of weekly saves */
 const B=await page.evaluate(()=>{const start=S.week,log=[];S.relations.hyun=60;
  for(let w=0;w<104;w++){S.week=start+w;const before=(S.threads||[]).length;save();if((S.threads||[]).length>before){const th=S.threads[0];log.push({day:VerdictCalendar.today(),from:th.from,id:th.id,text:th.lines[0].text,kind:th.kind})}}
  return {log,used:S.social?.used}});
 const soc=B.log.filter(x=>x.kind==='social');
 assert.ok(soc.length>=3,'a few texts over two game years: '+soc.length);
 const byMonth={};for(const x of soc){const m=Math.floor(x.day/30);byMonth[m]=(byMonth[m]||0)+1}
 assert.ok(Object.values(byMonth).every(n=>n<=2),'at most two a game month');
 for(const p of new Set(soc.map(x=>x.from))){const d=soc.filter(x=>x.from===p).map(x=>x.day);for(let i=1;i<d.length;i++)assert.ok(d[i]-d[i-1]>=45,'one person at most every 45 days')}
 assert.ok(!soc.some(x=>/\{|undefined|NaN/.test(x.text)),'texts filled');
 assert.ok(!soc.some(x=>/제닛|배우자|아내|남편/.test(x.text)),'no spouse talk without a spouse');
 // reply: trust moves a little; a memo is a memo, not an event that happened
 const R=await page.evaluate(()=>{const th=S.threads.find(x=>x.kind==='social'&&!x.picked);if(!th)return null;const before=S.relations[th.from];
  const ch=th.choices[0];const btn=document.createElement('button');btn.dataset.action='wfreply';btn.dataset.id=th.id;btn.dataset.choice=ch[0];document.body.append(btn);btn.click();btn.remove();
  return {from:th.from,delta:S.relations[th.from]-before,picked:th.picked,lines:th.lines.length,memo:(S.memories[th.from]||[]).slice(-1)[0]?.body||'',want:ch[3].memo||''}});
 assert.ok(R&&R.picked&&R.lines===3,'a reply and an answer');assert.ok(R.delta>=0&&R.delta<=4,'trust moves a little');if(R.want)assert.equal(R.memo,R.want);
 // conversations by person
 const V=await page.evaluate(()=>{ui.tab='tablet';ui.tabletTab='messages';ui.msgWith=null;render();const list=[...document.querySelectorAll('.wf-contact')].map(b=>({id:b.dataset.id,unread:b.querySelector('.wf-unread')?.textContent||''}));
  const first=list.find(x=>x.id==='hyun')||list[0];ui.msgWith=first.id;render();const convo=document.querySelector('.wf-convo')?.innerText||'';ui.msgWith=null;render();
  const after=[...document.querySelectorAll('.wf-contact')].find(b=>b.dataset.id===first.id)?.querySelector('.wf-unread')?.textContent||'';return {n:list.length,first,convo,after,ids:list.map(x=>x.id)}});
 assert.ok(V.n>=2&&new Set(V.ids).size===V.ids.length,'one row per person');assert.ok(V.convo.length>10,'the conversation opens');
 await page.evaluate(()=>{ui.msgWith=null;render()});await shots('v11-messages');
 await page.evaluate(()=>{ui.msgWith='hyun';render()});await shots('v11-conversation');
 const card=await page.evaluate(()=>{ui.msgWith=null;popupNPC('hyun');return document.getElementById('modal-root').innerText});
 assert.match(card,/🤝 인연[\s\S]*법원 동기/);assert.match(card,/문자 대화 보기/);
 await page.evaluate(()=>{const b=[...document.querySelectorAll('#modal-root [data-action="wfwith"]')][0];b.click()});
 assert.equal(await page.evaluate(()=>[ui.tab,ui.tabletTab,ui.msgWith,!!ui.modal].join()),'tablet,messages,hyun,false','the card opens the conversation');
 console.log(`  ✓ B texts: ${soc.length} in two game years (≤2 a month, ≥45 days per person), reply ok, ${V.n} conversations, card → conversation`);

 /* D: five years, retro once; after-verdict story only with real events */
 const D=await page.evaluate(ids=>{S.week=Math.ceil(5*365/7)+1;S.lifeTick=null;save();const r1=JSON.stringify(S.retros);S.lifeTick=null;save();
  const c=CASES.find(x=>x.id===ids[0]);S.cases[c.id].appeal={by:'p',status:'decided',week:S.week-10,result:{judge:'김항소',npc:true,changed:false}};
  const name=String(c.name).split(' · ')[0];(S.colleagues??={news:[]}).news??=[];S.colleagues.news.unshift({court:true,title:`[법원 소식] ${name} 항소심 — 1심 판결 유지`,day:S.week-10});
  ui.tab='tablet';ui.tabletTab='career';render();const career=document.body.innerText;ui.tabletTab='archives';render();const arch=document.body.innerText;
  return {retro:S.retros,once:r1===JSON.stringify(S.retros),career,arch,ev:VerdictCareerLife.afterEvents(c).map(x=>x.text),other:VerdictCareerLife.afterEvents(CASES.find(x=>x.id===ids[1])).length}},judged);
 assert.ok(D.retro?.[5]&&D.once,'one retro at five years');assert.match(D.career,/5년 단위 회고[\s\S]*법관 5년 차/);assert.match(D.career,/판단 성향/);
 assert.ok(D.ev.length===2&&/항소심/.test(D.ev[1]),'verdict then the appeal: '+D.ev.join(' / '));assert.equal(D.other,1,'a case with nothing after it has only its verdict');
 assert.match(D.arch,/판결 뒤 이야기/);
 await page.evaluate(()=>{ui.tabletTab='career';render()});await shots('v11-career',{fullPage:true});
 console.log('  ✓ D retro at five years (once), after-verdict story only with real events');

 /* E: a recalled issue */
 const E=await page.evaluate(ids=>{const L=VerdictCareerLife;const old=CASES.find(x=>x.id===ids[0]);const tags=L.tagsOf(old);if(!tags.length)return {skip:true};
  S.cases[old.id].closedWeek=S.week-60;
  const cand=CasePackEngine.pool(S).find(x=>{const v=VerdictCurated.cases[x.a.id];if(!v||x.a.id===old.contentPack?.archetypeId)return false;const c=createGeneratedCase(x);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};const ok=L.tagsOf(c).some(t=>tags.includes(t));if(!ok)S.cases[c.id].referred=true;else window._e=c;return ok});
  const c=window._e;if(!c)return {skip:true};const html=L.echo(c);return {html,names:ids.map(i=>String(CASES.find(x=>x.id===i).name).split(' · ')[0].replace(/\s*\(\d{4}[.\-]\d{1,2}[.\-]\d{1,2}\)/g,'').trim())}},judged);
 if(!E.skip){assert.match(E.html,/예전에 다룬 쟁점/);const nm=(E.html.match(/예전에 다룬 쟁점 · '([^']+)'/)||[])[1];assert.ok(nm&&E.names.includes(nm),'an old case of mine: '+nm);assert.ok(!E.html.includes('판결:'),'never the old outcome');assert.match(E.html,/같은 결론일 필요는 없어요/)}
 console.log('  ✓ E recalled issue: '+(E.skip?'(no shared tag in this run)':'shown without the old outcome'));
 const W=await page.evaluate(()=>{const L=VerdictCareerLife,pool=CasePackEngine.pool(S),w=pool.map(x=>L.issueWeight(x.a));
  const past=completed().filter(c=>S.cases[c.id]?.trial4&&!S.cases[c.id].referred).length;return {past,up:w.filter(x=>x>1).length,n:w.length,max:Math.max(...w)}});
 if(W.past>=5){assert.ok(W.up>0&&W.up<W.n,'some (not all) offered cases bring back an old issue: '+W.up+'/'+W.n);assert.equal(W.max,1.5,'a light nudge only')}
 console.log(`  ✓ P3 supply: ${W.up}/${W.n} candidate cases weighted ×1.5 for an old issue (${W.past} verdicts)`);
 assert.deepEqual(errs,[],'page errors: '+errs.join('; '));
 console.log('PASS: v11 career life (issue memo, texts, judge profile, retro, after-verdict story, issue tags)');
}finally{await browser.close();server.close()}
