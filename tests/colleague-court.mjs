/* 2026-11-08 colleague court (the light shared world) — against a fake Supabase (no network needed).
 * Run: node tests/colleague-court.mjs
 *  1. No login: a witness who was separately indicted gets a court-news article only after my verdict, a few game
 *     weeks later, with the result written for this case's hidden world. Before the verdict: nothing.
 *  2. Two signed-in players: each appears to the other only as a colleague judge (people map + card).
 *  3. A case on one bench is never offered to the other; a colleague's verdict arrives as court news (title without
 *     the other world's names, no comments thread).
 *  4. If both took the same case at once, the one who has not opened it yet hands it over, with a news line.
 *  5. No hidden truth, record or save data is sent to the server. */
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}
 if(f.endsWith('/config.js')){r.writeHead(200,{'content-type':'text/javascript'});return r.end("window.VERDICT_CONFIG={supabaseUrl:'https://sb.test',supabaseAnonKey:'anon',apiBase:'',ai:false};")}
 try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end()}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const url='http://127.0.0.1:'+server.address().port+'/';

/* fake Supabase with 037 semantics */
const USERS={'a@x.kr':{id:'00000000-0000-0000-0000-00000000000a',pw:'pw-a'},'b@x.kr':{id:'00000000-0000-0000-0000-00000000000b',pw:'pw-b'}};
const judgesT=new Map(),casesT=[],sent=[],couplesT=[],cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
const who=req=>{const t=(req.headers()['authorization']||'').replace('Bearer ','');return Object.values(USERS).find(u=>'tok-'+u.id===t)};
async function routes(ctx){
 await ctx.route('https://sb.test/**',async route=>{const req=route.request(),u=new URL(req.url()),j=(d,s=200)=>route.fulfill({status:s,headers:{...cors,'content-type':'application/json'},body:JSON.stringify(d)});
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(u.pathname==='/auth/v1/token'){const b=JSON.parse(req.postData()||'{}');
   if(u.searchParams.get('grant_type')==='password'){const x=USERS[b.email];if(!x||x.pw!==b.password)return j({error_description:'Invalid login credentials'},400);return j({access_token:'tok-'+x.id,refresh_token:'ref-'+x.id,expires_in:3600,user:{id:x.id,email:b.email}})}
   const id=String(b.refresh_token).replace('ref-','');return j({access_token:'tok-'+id,refresh_token:'ref-'+id,expires_in:3600,user:{id,email:Object.keys(USERS).find(k=>USERS[k].id===id)}})}
  const me=who(req);if(!me)return j({message:'JWT'},401);const uid=me.id;
  const body=JSON.parse(req.postData()||'{}');if(u.pathname.startsWith('/rest/v1/rpc/court')||u.pathname.startsWith('/rest/v1/court'))sent.push({path:u.pathname,body});
  if(u.pathname==='/rest/v1/rpc/claim_player')return j(true);
  if(u.pathname==='/rest/v1/saves')return j([]);
  if(u.pathname==='/rest/v1/rpc/save_put')return j([{ok:true,conflict:false,rev:1,updated_at:new Date().toISOString(),device:'d'}]);
  if(u.pathname==='/rest/v1/rpc/court_judge_put'){judgesT.set(uid,{user_id:uid,judge_name:body.p_name,bench:body.p_bench,gender:body.p_gender});return j(true)}
  if(u.pathname==='/rest/v1/rpc/court_case_sync'){const refused=[];
   for(let i=casesT.length-1;i>=0;i--)if(casesT[i].judge_id===uid&&casesT[i].state==='open'&&!body.p_open.includes(casesT[i].case_key))casesT.splice(i,1);
   for(const k of body.p_open){if(casesT.some(r=>r.case_key===k&&r.state==='open'&&r.judge_id!==uid)){refused.push(k);continue}
    const mine=casesT.find(r=>r.case_key===k&&r.judge_id===uid);if(mine)Object.assign(mine,{state:'open',judged_at:null,summary:null});else casesT.push({case_key:k,judge_id:uid,state:'open',judged_at:null,summary:null})}
   return j(refused)}
  if(u.pathname==='/rest/v1/rpc/court_case_judge'){const mine=casesT.find(r=>r.case_key===body.p_key&&r.judge_id===uid),at=new Date().toISOString();
   if(mine)Object.assign(mine,{state:'judged',judged_at:at,summary:body.p_summary});else casesT.push({case_key:body.p_key,judge_id:uid,state:'judged',judged_at:at,summary:body.p_summary});return j(true)}
  if(u.pathname==='/rest/v1/court_cases'){const not=u.searchParams.get('judge_id')?.replace('neq.','');return j(casesT.filter(r=>r.judge_id!==not))}
  if(u.pathname==='/rest/v1/court_judges')return j([...judgesT.values()]);
  if(u.pathname==='/rest/v1/court_couples')return j(couplesT.filter(r=>r.user_id===uid||r.spouse===uid));
  return j({},404)});
}
const W=Number(process.env.VIEW_W||390);   // VIEW_W=412 / 884 for the other screen checks
const browser=await chromium.launch({headless:true});
const loaded=(p,name)=>p.waitForFunction(n=>typeof S!=='undefined'&&(n==null||S.name===n),name??null,{timeout:30000});
async function career(p,name){await p.locator('#profile-continue').click();await p.locator('#playerName').fill(name);await p.locator('[data-action="start"]').last().click();
 await p.waitForFunction(n=>typeof S!=='undefined'&&S.name===n&&S.legalWorld?.firstFour===true,name,{timeout:30000});await p.evaluate(()=>VerdictCurated.loadAll())}
/* take a case into my bench by its case id (as accepting an offer does) */
const take=(p,key)=>p.evaluate(k=>{const cand=CasePackEngine.pool(S).find(x=>x.a.id===k);if(!cand)return null;
 const c=createGeneratedCase(cand);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};c.week=Math.min(c.week,S.week);
 VerdictTrialPlay.ensure(c,S.cases[c.id]);return c.id},key);
/* deliver a verdict without the 5-step window (the verdict path itself is covered by verdict-v82/v83) */
const decide=(p,id,label,dir='convict',appeal)=>p.evaluate(([id,label,dir,appeal])=>{const st=S.cases[id],t=st.trial4;t.daysDone=t.daysDone||3;
 t.final={label,dir,sentence:dir==='convict'?'징역 2년':'',at:Date.now()};st.verdict='v';st.closedWeek=S.week;
 if(appeal!==undefined)st.appeal=appeal?{by:appeal,week:S.week,at:Date.now(),status:'filed'}:false},[id,label,dir,appeal]);   // appeal: force the seed's decision in a test
try{
 /* 1. separately indicted witness, no login */
 const solo=await (await browser.newContext({viewport:{width:W,height:844}})).newPage();const errs=[];solo.on('pageerror',e=>errs.push(e.message));
 await solo.goto(url,{waitUntil:'networkidle'});await career(solo,'혼자 판사');
 const id=await take(solo,'adv-cr-020');assert.ok(id,'the drunk-driving case with the witness indicted for harbouring is in the pool');
 const before=await solo.evaluate(id=>{S.week+=20;VerdictColleagues.separateTick();S.week-=20;return (S.colleagues?.news||[]).length},id);
 assert.equal(before,0,'nothing about the witness before my verdict, however much time passes');
 await decide(solo,id,'유죄');
 const r=await solo.evaluate(id=>{VerdictColleagues.separateTick();const early=(S.colleagues.news||[]).length;S.week+=9;VerdictColleagues.separateTick();
  const t=S.cases[id].trial4,w=NPC[t.witnesses[0].id];return {early,news:S.colleagues.news,name:w.name,truth:t.truth,feed:VerdictMedia.newsFeed(60)}},id);
 assert.equal(r.early,0,'a few game weeks after the verdict, not at once');
 assert.equal(r.news.length,1);const art=r.news[0];
 assert.match(art.title,new RegExp(r.name));assert.match(art.body,/범인도피/);
 assert.match(art.body,{did:/벌금 300만 원/,didnt:/무죄/,reason:/벌금 400만 원/}[r.truth],'the result follows this case\'s own world');
 assert.ok(!/\{|undefined/.test(art.title+art.body),'all names filled: '+art.body);
 assert.ok(r.feed.includes('따로 받던 재판 결론'),'shown with the other articles');
 await solo.evaluate(()=>{ui.tab='tablet';ui.tabletTab='news';render()});
 await solo.screenshot({path:'qa-visuals/colleague-witness-news-'+W+'.png'});
 // a criminal verdict that is appealed, with no colleague: an NPC appellate bench a few game weeks later
 const ap=await take(solo,'adv-cr-016');await decide(solo,ap,'유죄','convict','d');
 const apr=await solo.evaluate(id=>{VerdictColleagues.appealTick();const early=(S.colleagues.news||[]).some(x=>x.index==='apr'+0||/항소심 —/.test(x.title));S.week+=13;VerdictColleagues.appealTick();
  return {early,news:(S.colleagues.news||[]).filter(x=>/항소심 —/.test(x.title)).map(x=>x.title+' | '+x.body),st:S.cases[id].appeal}},ap);
 assert.equal(apr.early,false,'not at once');assert.equal(apr.news.length,1);assert.match(apr.news[0],/항소심 재판부\(.+ 판사\)|항소심 재판부는/);assert.equal(apr.st.status,'decided');
 // verdicts are decided once; with no forced value the seed decides and the result is kept
 const freeId=await take(solo,'adv-cr-001');await decide(solo,freeId,'무죄','acquit');
 const once=await solo.evaluate(id=>{VerdictColleagues.decideAppeals();const a=JSON.stringify(S.cases[id].appeal);VerdictColleagues.decideAppeals();return [a,JSON.stringify(S.cases[id].appeal)]},freeId);
 assert.equal(once[0],once[1]);assert.ok(once[0]==='false'||/"by":"p"/.test(once[0]),'an acquittal can only be appealed by the prosecution: '+once[0]);
 assert.deepEqual(errs,[]);await solo.context().close();
 console.log('  ✓ appeals without a colleague: an NPC appellate bench decides a few game weeks later; decided once');
 console.log('  ✓ separately indicted witness: news only after my verdict, weeks later, result from the case\'s world');

 /* 2–3. two players */
 const ctxA=await browser.newContext({viewport:{width:W,height:844}});await routes(ctxA);const a=await ctxA.newPage();
 const ctxB=await browser.newContext({viewport:{width:W,height:844}});await routes(ctxB);const b=await ctxB.newPage();
 const eA=[],eB=[];a.on('pageerror',e=>eA.push(e.message));b.on('pageerror',e=>eB.push(e.message));
 const login=async(p,email,pw)=>{await p.goto(url+'?auth=1',{waitUntil:'networkidle'});await p.locator('#verdict-login input[type=email]').fill(email);
  await p.locator('#verdict-login input[type=password]').fill(pw);await p.locator('#verdict-login button[type=submit]').click()};
 await login(a,'a@x.kr','pw-a');await career(a,'김가람');
 await a.evaluate(()=>VerdictColleagues.sync());   // A's first four reach the server (the game does this within seconds)
 await login(b,'b@x.kr','pw-b');await career(b,'이나래');
 /* a sheet case neither judge has yet (the first four are random) */
 const free=async()=>{const used=new Set([...(await a.evaluate(()=>CASES.map(c=>c.contentPack?.archetypeId))),...(await b.evaluate(()=>CASES.map(c=>c.contentPack?.archetypeId))),...casesT.map(r=>r.case_key)]);
  return b.evaluate(u=>Object.keys(VerdictSheets.cases).find(k=>/^adv-/.test(k)&&!u.includes(k)&&CasePackEngine.pool(S).some(x=>x.a.id===k)),[...used])};
 const K1=await free(),T1=await b.evaluate(k=>VerdictSheets.cases[k].card.title,K1);
 const caseA=await take(a,K1);await a.evaluate(()=>VerdictColleagues.sync());
 assert.ok(casesT.some(r=>r.case_key===K1&&r.state==='open'),'A holds the case on the server');
 await b.evaluate(()=>VerdictColleagues.sync());
 const seenB=await b.evaluate(k1=>({taken:[...VerdictColleagues.taken()],offered:VerdictDocket.freshPool().some(x=>x.a.id===k1),people:VerdictColleagues.people().map(p=>NPC[p.id].name+'|'+p.role)}),K1);
 assert.ok(seenB.taken.includes(K1),'B knows A holds it (with A\'s first four cases)');assert.equal(seenB.offered,false,'a case on a colleague\'s bench is never offered');
 assert.equal(seenB.people.length,1);assert.match(seenB.people[0],/^김가람\|판사/,'A is a colleague judge in B\'s world');
 await b.evaluate(()=>{ui.tab='people';render()});
 assert.match(await b.locator('main').innerText(),/김가람/,'shown with the court colleagues');
 await b.screenshot({path:'qa-visuals/colleague-people-'+W+'.png'});
 // A delivers the verdict → B reads it as court news
 await decide(a,caseA,'유죄');await a.evaluate(()=>VerdictColleagues.sync());
 const judged=casesT.find(r=>r.case_key===K1&&r.state==='judged');assert.ok(judged);
 assert.ok(['days','kind','label','sentence','title'].every(k=>k in judged.summary)&&Object.keys(judged.summary).every(k=>['days','kind','label','sentence','title','appeal'].includes(k)),JSON.stringify(Object.keys(judged.summary)));
 const names=await a.evaluate(id=>{const c=CASES.find(x=>x.id===id);return [...(c.who||[]),...S.cases[id].trial4.witnesses.map(w=>w.id)].map(i=>NPC[i]?.name).filter(Boolean)},caseA);
 assert.ok(names.every(n=>!JSON.stringify(sent).includes(n)),'no names of A\'s world reach the server');
 // the only world that ever leaves is the one an appeal or a linked case needs, after the verdict
 const scrub=b=>JSON.parse(JSON.stringify(b),(k,v)=>k==='world'?undefined:v);
 assert.ok(!/truth|did|didnt|reason|worlds|seed|skill/.test(JSON.stringify(sent.map(s=>scrub(s.body)))),'no hidden truth or scores');
 await b.evaluate(()=>VerdictColleagues.sync());
 const newsB=await b.evaluate(()=>VerdictMedia.articles().filter(x=>x.court&&/ 판사, '/.test(x.title)));   // (a first case that collided is handed over with its own line)
 assert.equal(newsB.length,1,JSON.stringify(newsB.map(x=>x.title)));assert.ok(newsB[0].title.includes(`김가람 판사, '${T1}' 사건 선고`),newsB[0].title);assert.match(newsB[0].body,/"유죄" \(징역 2년\)/);
 await b.evaluate(()=>{ui.tab='tablet';ui.tabletTab='news';render()});
 const card=b.locator('.wf-news-compact',{hasText:"김가람 판사, '"});
 assert.equal(await card.count(),1);assert.equal(await card.locator('[data-action="wfopen"]').count(),0,'no comment thread on court news');
 await b.screenshot({path:'qa-visuals/colleague-news-'+W+'.png'});
 assert.equal(await b.evaluate(k1=>VerdictDocket.freshPool().some(x=>x.a.id===k1),K1),false,'a case the colleague judged is not offered while fresh cases remain');
 console.log('  ✓ two players: colleague judge in the people map, held cases never offered, verdicts read as court news');

 /* 4. same case taken on both benches at once: the one not yet opened goes over */
 const K2=await free();
 await take(a,K2);await a.evaluate(()=>VerdictColleagues.sync());
 const caseB=await take(b,K2);await b.evaluate(()=>VerdictColleagues.sync());
 const yielded=await b.evaluate(id=>({referred:S.cases[id].referred,news:VerdictMedia.articles().some(x=>/옆 재판부가 맡기로/.test(x.title))}),caseB);
 assert.equal(yielded.referred,true);assert.equal(yielded.news,true);
 console.log('  ✓ same case on two benches at once: the unopened one goes to the colleague, with a news line');
 // a new judge's first four: a case that turns out to be on a colleague's bench is replaced, so four remain
 const zKey=await b.evaluate(()=>{const used=new Set(CASES.map(c=>c.contentPack?.archetypeId));return CasePackEngine.pool(S).map(x=>x.a.id).find(k=>!used.has(k)&&/^[a-z0-9-]+$/.test(k))});
 const z=await take(b,zKey);
 const openBefore=await b.evaluate(id=>{const f=S.legalWorld.firstFourCaseIDs=[...(S.legalWorld.firstFourCaseIDs||[]).slice(0,3),id];return openCases().length},z);
 casesT.push({case_key:zKey,judge_id:USERS['a@x.kr'].id,state:'open',judged_at:null,summary:null});
 await b.evaluate(()=>VerdictColleagues.sync());
 const sw=await b.evaluate(id=>({referred:S.cases[id].referred,first:S.legalWorld.firstFourCaseIDs,open:openCases().length}),z);
 assert.equal(sw.referred,true);assert.ok(!sw.first.includes(z)&&sw.first.length===4,'replaced in the first four');assert.equal(sw.open,openBefore,'still the same number of cases');
 console.log('  ✓ first four: a case already on a colleague\'s bench is replaced by another one');

 /* 5. stage 3 — a witness's own trial goes to the colleague, in the same story, and comes back as my witness's news */
 const parent=await take(a,'adv-cr-020');
 await a.evaluate(id=>{const t=S.cases[id].trial4;t.truth='reason'},parent);
 await decide(a,parent,'일부만 유죄');await a.evaluate(()=>VerdictColleagues.sync());
 const sent5=casesT.find(r=>r.case_key==='adv-cr-020'&&r.state==='judged');
 assert.deepEqual(sent5.summary.links,[{case:'link-cr-020-w1',world:'reason'}],'the linked case and the world that follows from mine');
 await a.evaluate(()=>{S.week+=12;VerdictColleagues.separateTick()});
 assert.equal(await a.evaluate(()=>(S.colleagues.news||[]).filter(x=>/따로 받던 재판/.test(x.title)&&/범인도피/.test(x.body)).length),0,'while a colleague may take it, my world waits');
 assert.equal(await a.evaluate(()=>CasePackEngine.pool(S).some(x=>x.a.id==='link-cr-020-w1')),false,'linked cases never join the open pool');
 await b.evaluate(()=>VerdictColleagues.sync());
 const offer=await b.evaluate(()=>{const o=S.realtimeInbox.offers.find(x=>x.linked&&x.status==='available'&&x.options[0].archetypeId==='link-cr-020-w1');return o&&{slot:o.slot,opt:o.options[0],news:VerdictMedia.articles().some(x=>/우리 법원에 접수/.test(x.title))}});
 assert.ok(offer,'B is offered the witness\'s own trial');assert.equal(offer.opt.archetypeId,'link-cr-020-w1');
 assert.match(offer.opt.logline,/옆 재판부 김가람 판사가 선고한 '운전석 에어백의 다른 DNA' 재판의 증인/);assert.equal(offer.news,true);
 const spin=await b.evaluate(slot=>{while(openCases().length>=VerdictDocket.MAX_ACTIVE)S.cases[openCases()[0].id].referred=true;   // a free seat on B's bench
  const btn=document.createElement('button');btn.dataset.action='acceptDocket';btn.dataset.slot=slot;btn.dataset.opt='0';document.body.append(btn);btn.click();btn.remove();
  const c=CASES.find(x=>x.contentPack?.archetypeId==='link-cr-020-w1');if(!c)return null;S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};
  const t=VerdictTrialPlay.ensure(c,S.cases[c.id]);return {id:c.id,truth:t.truth,link:c.link}},offer.slot);
 assert.ok(spin,'accepted from the docket');assert.equal(spin.truth,'reason','the same story: the world follows A\'s case');
 assert.equal(spin.link.judge,USERS['a@x.kr'].id);
 await b.evaluate(id=>{ui.tab='court';ui.caseId=id;ui.t4tab='case';render()},spin.id);await b.locator('.t4-tabs').waitFor();
 const courtText=await b.locator('main').innerText();assert.match(courtText,/범인도피/);assert.ok(!/\{[A-Z]/.test(courtText),'names filled in the linked case');
 await b.screenshot({path:'qa-visuals/colleague-linked-case-'+W+'.png'});
 await decide(b,spin.id,'유죄');await b.evaluate(()=>VerdictColleagues.sync());
 const back=casesT.find(r=>r.case_key==='link-cr-020-w1'&&r.state==='judged');assert.deepEqual(back.summary.from,{judge:USERS['a@x.kr'].id,parent:'adv-cr-020'});
 await a.evaluate(()=>VerdictColleagues.sync());
 const told=await a.evaluate(()=>VerdictMedia.articles().filter(x=>x.court&&((/따로 받던 재판/.test(x.title)&&/범인도피/.test(x.body))||/동승자의 대답/.test(x.title))).map(x=>x.title+' | '+x.body));
 assert.equal(told.length,1,JSON.stringify(told));assert.match(told[0],/이나래 판사가 "유죄"/,'my witness\'s result is the colleague\'s verdict');
 assert.ok(!/벌금 400만 원/.test(told[0]),'not the NPC-judge version');
 console.log('  ✓ stage 3: the witness\'s own trial is offered to the colleague in the same world, and comes back as my witness\'s news');
 assert.deepEqual(eA,[]);assert.deepEqual(eB,[]);

 /* 6. appeals between the two judges: A's criminal verdict is appealed, B hears it in the same world, A reads the result */
 const K3=await free();const ac=await take(a,K3);
 await a.evaluate(id=>{S.cases[id].trial4.truth='didnt'},ac);
 await decide(a,ac,'유죄','convict','d');await a.evaluate(()=>VerdictColleagues.sync());
 const sentA=casesT.find(r=>r.case_key===K3&&r.state==='judged');
 assert.deepEqual(sentA.summary.appeal,{by:'d',world:'didnt',first:{label:'유죄',sentence:'징역 2년'}},'the appeal goes out with the verdict');
 await b.evaluate(()=>VerdictColleagues.sync());
 const apo=await b.evaluate(k=>{const o=S.realtimeInbox.offers.find(x=>x.linked&&x.status==='available'&&x.options[0].archetypeId===k);return o&&{slot:o.slot,opt:o.options[0]}},K3);
 assert.ok(apo,'B is offered the appeal');assert.match(apo.opt.title,/\(항소심\)$/);assert.match(apo.opt.logline,/김가람 판사가 1심에서 "유죄" \(징역 2년\)을 선고한 사건/);
 const bc=await b.evaluate(slot=>{while(openCases().length>=VerdictDocket.MAX_ACTIVE)S.cases[openCases()[0].id].referred=true;
  const btn=document.createElement('button');btn.dataset.action='acceptDocket';btn.dataset.slot=slot;btn.dataset.opt='0';document.body.append(btn);btn.click();btn.remove();
  const c=CASES.slice().reverse().find(x=>x.appeal);if(!c)return null;S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};const t=VerdictTrialPlay.ensure(c,S.cases[c.id]);
  ui.tab='court';ui.caseId=c.id;ui.t4tab='case';render();return {id:c.id,truth:t.truth,appeal:c.appeal}},apo.slot);
 assert.ok(bc,'accepted');assert.equal(bc.truth,'didnt','the same world as the first trial');assert.equal(bc.appeal.by,'d');
 await b.locator('.t4-appeal').waitFor();assert.match(await b.locator('.t4-appeal').innerText(),/1심: 같은 법원 김가람 판사 · "유죄" \(징역 2년\) · 항소한 쪽: 피고인/);
 await b.screenshot({path:'qa-visuals/colleague-appeal-'+W+'.png'});
 await decide(b,bc.id,'무죄','acquit');
 assert.equal(await b.evaluate(id=>{VerdictColleagues.decideAppeals();return S.cases[id].appeal},bc.id),false,'an appellate judgment is never appealed again');
 await b.evaluate(()=>VerdictColleagues.sync());
 assert.deepEqual(casesT.find(r=>r.case_key===K3&&r.judge_id===USERS['b@x.kr'].id&&r.state==='judged').summary.appealOf,{judge:USERS['a@x.kr'].id,parent:K3});
 await a.evaluate(()=>VerdictColleagues.sync());
 const res=await a.evaluate(id=>({st:S.cases[id].appeal,news:VerdictMedia.articles().filter(x=>/항소심 —/.test(x.title)).map(x=>x.title+' | '+x.body),generic:VerdictMedia.articles().some(x=>/이나래 판사, '/.test(x.title)&&x.title.includes(S.cases[id].trial4?'':''))}),ac);
 assert.equal(res.st.status,'decided');assert.ok(res.news.some(n=>/1심 판결 바뀜/.test(n)&&/이나래 판사가 "무죄"/.test(n)),JSON.stringify(res.news));
 console.log('  ✓ appeals between judges: offered to the colleague, same world, banner in the courtroom, result back as news, never appealed twice');
 /* 7. (2026-11-10) a couple of judges set on the server (DB 040): sex and age, spouse first among colleagues, every
  *    verdict of the spouse on their card, and a child counted in real days from the same date — the same in both games */
 const ida=USERS['a@x.kr'].id,idb=USERS['b@x.kr'].id,since=new Date(Date.now()-31*86400000).toISOString();
 couplesT.push({user_id:ida,spouse:idb,sex:'남',age:35,since},{user_id:idb,spouse:ida,sex:'여',age:35,since});
 for(const p of [a,b])await p.evaluate(()=>VerdictColleagues.sync());
 const cp=p=>p.evaluate(()=>{const sp=VerdictColleagues.people()[0],kid=NPC.couple_child_0;
  return {age:age(),spouseAge:sp&&year()-NPC[sp.id].bornYear,sex:NPC.self.gender,spouse:sp&&NPC[sp.id].spouseOfPlayer,role:sp&&NPC[sp.id].role,kid:kid?.name,kids:S.couple.kids,msg:S.msgs.some(m=>/태어났어요/.test(m.body)),list:VerdictColleagues.spouseVerdicts().length}});
 const ca=await cp(a),cb=await cp(b);
 assert.equal(ca.age,35);assert.equal(cb.age,35);assert.equal(ca.spouseAge,35,'the spouse on my card is 35 too');assert.equal(cb.spouseAge,35);assert.equal(ca.sex,'남');assert.equal(cb.sex,'여');
 assert.ok(ca.spouse&&cb.spouse&&/^배우자/.test(ca.role),'the spouse comes first among the court colleagues: '+ca.role);
 /* v11 P0: children follow the game calendar, not the wall clock (the couple was set 31 real days ago: still no child) */
 assert.ok(!ca.kid&&!cb.kid&&!ca.msg,'no child before the game calendar reaches the birth date');
 const plan=await a.evaluate(()=>VerdictColleagues.familyPlan(S.couple.pair||[VerdictAuth.user.id,S.couple.spouse].sort().join(':')));
 assert.equal(JSON.stringify(plan),JSON.stringify(await b.evaluate(()=>VerdictColleagues.familyPlan([VerdictAuth.user.id,S.couple.spouse].sort().join(':')))),'one family plan in both games');
 // A plays far ahead: A meets the first child; B, still at the start, does not see A's future
 await a.evaluate(d=>{S.week=Math.ceil((d+1)/7);VerdictColleagues.familyTick()},plan[0].day);await b.evaluate(()=>VerdictColleagues.familyTick());
 const ka=await cp(a),kb0=await cp(b);assert.ok(ka.kid&&ka.msg,'A\'s calendar reached the birth');assert.ok(!kb0.kid,'B has not reached that date yet');
 await b.evaluate(d=>{S.week=Math.ceil((d+1)/7)+3;VerdictColleagues.familyTick()},plan[0].day);const kb=await cp(b);
 assert.equal(kb.kid,ka.kid,'the same child (name) in both games');
 const born=await Promise.all([a,b].map(p=>p.evaluate(()=>[NPC.couple_child_0.bornDay,NPC.couple_child_0.gender,NPC.couple_child_0.bornYear].join())));assert.equal(born[0],born[1],'same birth date and sex');
 for(const p of [a,b])await p.evaluate(()=>{VerdictColleagues.familyTick();save()});assert.equal((await cp(a)).kids,1,'never born twice');
 Object.assign(ca,{kid:ka.kid});
 assert.ok(ca.list>0,'my spouse\'s verdicts are on their card');
 await a.evaluate(()=>VerdictColleagues.sync());assert.equal((await cp(a)).kids,1,'no second child before its time');
 assert.equal(await a.evaluate(()=>age()-35),await a.evaluate(()=>year()-2027),'my age moves with my calendar');
 await a.evaluate(()=>{const sp=VerdictColleagues.people()[0];popupNPC(sp.id)});
 assert.match(await a.locator('#modal-root').innerText(),/배우자 · 같은 법원 판사[\s\S]*판결 기록 \d+건/);
 await a.screenshot({path:'qa-visuals/couple-card-'+W+'.png'});console.log('    card: '+(await a.locator('#modal-root').innerText()).replace(/\s+/g,' ').slice(0,700));
 console.log(`  ✓ couple of judges: 35 years old, spouse first, ${ca.list} verdicts on the card, child ${ca.kid} in both games`);
 console.log('PASS: colleague court (separate-witness news, colleague judges, no shared cases, verdict news)');
}finally{await browser.close();server.close()}
