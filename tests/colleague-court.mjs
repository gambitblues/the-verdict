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
const judgesT=new Map(),casesT=[],sent=[],cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
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
const decide=(p,id,label)=>p.evaluate(([id,label])=>{const st=S.cases[id],t=st.trial4;t.daysDone=t.daysDone||3;
 t.final={label,dir:1,sentence:'징역 2년',at:Date.now()};st.verdict='v';st.closedWeek=S.week},[id,label]);
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
 assert.match(art.body,{did:/벌금 500만 원/,didnt:/무죄/,reason:/벌금 700만 원/}[r.truth],'the result follows this case\'s own world');
 assert.ok(!/\{|undefined/.test(art.title+art.body),'all names filled: '+art.body);
 assert.ok(r.feed.includes('따로 받던 재판 결론'),'shown with the other articles');
 await solo.evaluate(()=>{ui.tab='tablet';ui.tabletTab='news';render()});
 await solo.screenshot({path:'qa-visuals/colleague-witness-news-'+W+'.png'});
 assert.deepEqual(errs,[]);await solo.context().close();
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
 assert.deepEqual(Object.keys(judged.summary).sort(),['days','kind','label','sentence','title']);
 const names=await a.evaluate(id=>{const c=CASES.find(x=>x.id===id);return [...(c.who||[]),...S.cases[id].trial4.witnesses.map(w=>w.id)].map(i=>NPC[i]?.name).filter(Boolean)},caseA);
 assert.ok(names.every(n=>!JSON.stringify(sent).includes(n)),'no names of A\'s world reach the server');
 assert.ok(!/truth|did|didnt|reason|worlds|seed|skill/.test(JSON.stringify(sent.map(s=>s.body))),'no hidden truth or scores');
 await b.evaluate(()=>VerdictColleagues.sync());
 const newsB=await b.evaluate(()=>VerdictMedia.articles().filter(x=>x.court&&/ 판사, '/.test(x.title)));   // (a first case that collided is handed over with its own line)
 assert.equal(newsB.length,1,JSON.stringify(newsB.map(x=>x.title)));assert.ok(newsB[0].title.includes(`김가람 판사, '${T1}' 사건 선고`),newsB[0].title);assert.match(newsB[0].body,/"유죄" \(징역 2년\)/);
 await b.evaluate(()=>{ui.tab='tablet';ui.tabletTab='news';render()});
 const card=b.locator('.wf-news-compact',{hasText:'김가람 판사'});
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
 assert.deepEqual(eA,[]);assert.deepEqual(eB,[]);
 console.log('PASS: colleague court (separate-witness news, colleague judges, no shared cases, verdict news)');
}finally{await browser.close();server.close()}
