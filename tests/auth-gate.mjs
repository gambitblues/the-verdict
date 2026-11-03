/* v8.7 private login, per-user saves and the AI bridge — against fake Supabase and API servers (no network needed).
 * Run: node tests/auth-gate.mjs
 *  1. ?auth=1 shows the login screen first: the game (and its profile screen) is not loaded, there is no sign-up.
 *  2. A wrong password is refused with a plain message; an uninvited account is refused after sign-in.
 *  3. A save made before login is offered once to the first account; moving it keeps the career.
 *  4. The profile screen shows the account and a logout button; logging out puts that player's saves away.
 *  5. The second player starts with their own empty career; the first player's career comes back on their next login.
 *  6. Saves go to the cloud under the player's own id; the cloud copy is restored on a fresh device.
 *  7. The AI bridge calls the API with the player's token and only the visible text, and shows the reworded answer.
 *  8. Without login (no session) no AI call is made. */
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}
 if(f.endsWith('/config.js')){r.writeHead(200,{'content-type':'text/javascript'});return r.end("window.VERDICT_CONFIG={supabaseUrl:'https://sb.test',supabaseAnonKey:'anon',apiBase:'https://api.test',ai:true};")}
 try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end()}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const url='http://127.0.0.1:'+server.address().port+'/';

/* fake Supabase: two invited players, one stranger; saves kept in memory */
const USERS={'a@x.kr':{id:'uid-a',pw:'pw-a'},'b@x.kr':{id:'uid-b',pw:'pw-b'},'c@x.kr':{id:'uid-c',pw:'pw-c',stranger:true}};
const cloud=new Map(),aiCalls=[],cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
const who=req=>{const t=(req.headers()['authorization']||'').replace('Bearer ','');return Object.entries(USERS).find(([,u])=>'tok-'+u.id===t)};
async function routes(ctx){
 await ctx.route('https://sb.test/**',async route=>{const req=route.request(),u=new URL(req.url()),j=(d,s=200)=>route.fulfill({status:s,headers:{...cors,'content-type':'application/json'},body:JSON.stringify(d)});
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(u.pathname==='/auth/v1/token'){const b=JSON.parse(req.postData()||'{}');
   if(u.searchParams.get('grant_type')==='password'){const x=USERS[b.email];if(!x||x.pw!==b.password)return j({error_description:'Invalid login credentials'},400);
    return j({access_token:'tok-'+x.id,refresh_token:'ref-'+x.id,expires_in:3600,user:{id:x.id,email:b.email}})}
   const id=String(b.refresh_token).replace('ref-',''),e=Object.keys(USERS).find(k=>USERS[k].id===id);return j({access_token:'tok-'+id,refresh_token:'ref-'+id,expires_in:3600,user:{id,email:e}})}
  if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204,headers:cors});
  const me=who(req);if(!me)return j({message:'JWT'},401);
  if(u.pathname==='/rest/v1/rpc/claim_player')return j(!me[1].stranger);
  if(u.pathname==='/rest/v1/saves'&&req.method()==='GET'){const id=u.searchParams.get('user_id').replace('eq.','');assert.equal(id,me[1].id,'a player only asks for their own saves');
   return j([...cloud.values()].filter(r=>r.user_id===id))}
  if(u.pathname==='/rest/v1/saves'&&req.method()==='POST'){const row=JSON.parse(req.postData());assert.equal(row.user_id,me[1].id,'saves are written under the player\'s own id');cloud.set(row.user_id+':'+row.slot,row);return route.fulfill({status:201,headers:cors})}
  return j({},404)});
 await ctx.route('https://api.test/**',async route=>{const req=route.request();if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  const me=who(req),body=JSON.parse(req.postData()||'{}');aiCalls.push({path:new URL(req.url()).pathname,user:me?.[1].id,body});
  if(!me)return route.fulfill({status:401,headers:{...cors,'content-type':'application/json'},body:'{"error":"no_token"}'});
  route.fulfill({status:200,headers:{...cors,'content-type':'application/json'},body:JSON.stringify({ok:true,result:{text:'(AI) '+body.answer}})})});
}
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:844}});await routes(ctx);
const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
const login=async(email,pw)=>{await page.locator('#verdict-login input[type=email]').fill(email);await page.locator('#verdict-login input[type=password]').fill(pw);await page.locator('#verdict-login button[type=submit]').click()};
try{
 // a career started before login (test server, no gate)
 await page.goto(url,{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('옛 판사');await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.name==='옛 판사'&&S.legalWorld?.firstFour===true,null,{timeout:30000});
 await page.evaluate(()=>{save();VerdictStore.flush()});

 // 1. the gate comes first
 await page.goto(url+'?auth=1',{waitUntil:'networkidle'});
 await page.locator('#verdict-login form').waitFor();
 assert.equal(await page.evaluate(()=>typeof S),'undefined','the game is not loaded before login');
 assert.equal(await page.locator('#verdict-entry').count(),0,'the profile screen waits for login');
 assert.ok(!/가입|회원가입|sign up/i.test(await page.locator('#verdict-login').innerText()),'no sign-up');
 console.log('  ✓ login screen before the profile screen, game not loaded, no sign-up');

 // 2. refused
 await login('a@x.kr','wrong');await page.waitForFunction(()=>/맞지 않아요/.test(document.querySelector('.vl-msg')?.textContent||''));
 await login('c@x.kr','pw-c');await page.waitForFunction(()=>/초대된 계정이 아니에요/.test(document.querySelector('.vl-msg')?.textContent||''));
 assert.equal(await page.evaluate(()=>typeof S),'undefined');
 console.log('  ✓ wrong password and uninvited account are refused');

 // 3. first login: the old save is offered and moved
 await login('a@x.kr','pw-a');
 await page.locator('#verdict-login [data-a="y"]').waitFor();assert.match(await page.locator('#verdict-login').innerText(),/옛 판사/);
 await page.locator('#verdict-login [data-a="y"]').click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.name==='옛 판사',null,{timeout:30000});
 console.log('  ✓ the save made before login moved into the first account');

 // 4. account line and logout on the profile screen
 await page.locator('#verdict-entry .vl-out').waitFor();assert.match(await page.locator('#verdict-entry .vl-out').innerText(),/a@x\.kr/);
 // 7. AI bridge: token + visible text only; the reworded answer is shown
 const ai=await page.evaluate(async()=>{await VerdictCurated.loadAll();for(const g of S.generatedCases)S.cases[g.id].referred=true;
  const cand=CasePackEngine.pool(S)[0],c=createGeneratedCase(cand);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};
  const t=VerdictTrialPlay.ensure(c,S.cases[c.id]);VerdictTrialPlay.openSession(c,S.cases[c.id]);
  const q=VerdictTrialPlay.questions(c,t,0)[0];await VerdictAI.npc(c,t,{w:0,q:q.id,question:'그날 무엇을 보셨습니까?',answer:'창고 문이 열려 있었어요.'});
  return {shown:t.ai?.['0:'+q.id]}});
 assert.equal(ai.shown,'(AI) 창고 문이 열려 있었어요.');
 const call=aiCalls.at(-1);assert.equal(call.user,'uid-a');assert.equal(call.path,'/ai/npc');
 assert.ok(!/truth|did|didnt|reason/.test(Object.keys(call.body).join(',')),'no hidden truth in the request: '+Object.keys(call.body));
 console.log('  ✓ AI answer: called with the player\'s token and visible text only, shown in the game');

 // 6. cloud save under the player's id
 await page.evaluate(()=>{save();VerdictStore.flush();document.dispatchEvent(new Event('visibilitychange'))});
 await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'}));await page.evaluate(()=>window.dispatchEvent(new Event('visibilitychange')));
 await page.locator('#verdict-entry .vl-out button').click();   // logout pushes first
 await page.locator('#verdict-login form').waitFor();
 assert.ok(cloud.has('uid-a:1'),'player A\'s slot 1 is in the cloud');
 const keys=await page.evaluate(()=>Object.keys(localStorage));
 assert.ok(!keys.some(k=>/^(the_verdict|verdict_)/.test(k)),'nothing of player A is left in the game\'s working keys');
 assert.ok(keys.some(k=>k.startsWith('vu:uid-a:')),'player A\'s saves are kept on this device under A');
 console.log('  ✓ logout: cloud copy made, saves put away under the player');

 // 5. second player: own empty career; then A again
 await login('b@x.kr','pw-b');await page.waitForFunction(()=>typeof S!=='undefined',null,{timeout:30000});
 assert.equal(await page.locator('#verdict-login [data-a="y"]').count(),0,'the old-save question is asked only once');
 assert.notEqual(await page.evaluate(()=>S.name),'옛 판사','player B does not see player A\'s career');
 await page.locator('#verdict-entry .vl-out button').click();await page.locator('#verdict-login form').waitFor();
 await login('a@x.kr','pw-a');await page.waitForFunction(()=>typeof S!=='undefined'&&S.name==='옛 판사',null,{timeout:30000});
 console.log('  ✓ two players, separate careers on one device');

 // 6b. fresh device: the session and saves come from the cloud
 const ctx2=await browser.newContext({viewport:{width:390,height:844}});await routes(ctx2);const p2=await ctx2.newPage();
 await p2.goto(url+'?auth=1',{waitUntil:'networkidle'});await p2.locator('#verdict-login input[type=email]').fill('a@x.kr');await p2.locator('#verdict-login input[type=password]').fill('pw-a');await p2.locator('#verdict-login button[type=submit]').click();
 await p2.waitForFunction(()=>typeof S!=='undefined'&&S.name==='옛 판사',null,{timeout:30000});
 // stays signed in after a reload
 await p2.reload({waitUntil:'networkidle'});await p2.waitForFunction(()=>typeof S!=='undefined'&&S.name==='옛 판사',null,{timeout:30000});
 await ctx2.close();
 console.log('  ✓ another device: career restored from the cloud, login kept after reload');

 // 8. no login, no AI
 const before=aiCalls.length;const p3=await (await browser.newContext()).newPage();
 await p3.goto(url,{waitUntil:'networkidle'});const r=await p3.evaluate(async()=>{try{await VerdictAuth.api('/ai/npc',{});return 'called'}catch(e){return e.message}});
 assert.equal(r,'ai_unavailable');assert.equal(aiCalls.length,before);
 console.log('  ✓ without login the AI is never called');
 assert.deepEqual(errs,[]);
 console.log('PASS: private login, per-user saves, AI bridge');
}finally{await browser.close();server.close()}
