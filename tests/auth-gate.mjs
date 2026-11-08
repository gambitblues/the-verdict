/* v8.7.1 private login, per-user saves and the AI bridge — against fake Supabase and API servers (no network needed).
 * Run: node tests/auth-gate.mjs
 *  1. ?auth=1 shows the login screen first: the game (and its profile screen) is not loaded, there is no sign-up.
 *  2. Refused: wrong password, uninvited account, invite list that cannot be checked (server error).
 *  3. A save made before login is backed up, then offered once to the first account; moving it keeps the career.
 *  4. The profile screen shows the account and a logout button; logging out uploads and puts that player's saves away.
 *  5. The second player starts with their own empty career; the first player's career comes back on their next login.
 *  6. Same account on two devices: a newer save from the other device is never overwritten silently; the player picks,
 *     and the side not picked is kept (this browser's backups / the server's save_backups).
 *  7. Offline: only the player who owns this device's saves, confirmed online within 7 days; no cloud, no AI; when the
 *     connection returns and the server refuses the account, it is signed out at once.
 *  8. The AI bridge calls the API with the player's token and only visible text; without a confirmed login, no call.
 *  9. (2026-11-08) Login is optional: "로그인 없이 혼자 하기" plays this device's own career (no cloud, no AI), is
 *     remembered, and never mixes with an account's career. A signed-in reset keeps the old career first (device + server). */
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

/* fake Supabase: two invited players, one stranger; saves with versions like save_put in 001_init.sql */
const USERS={'a@x.kr':{id:'uid-a',pw:'pw-a'},'b@x.kr':{id:'uid-b',pw:'pw-b'},'c@x.kr':{id:'uid-c',pw:'pw-c',stranger:true}};
const cloud=new Map(),serverBackups=[],aiCalls=[],cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
const net={down:false,claimBroken:false,refuse:new Set()};
const who=req=>{const t=(req.headers()['authorization']||'').replace('Bearer ','');return Object.entries(USERS).find(([,u])=>'tok-'+u.id===t)};
async function routes(ctx){
 await ctx.route('https://sb.test/**',async route=>{const req=route.request(),u=new URL(req.url()),j=(d,s=200)=>route.fulfill({status:s,headers:{...cors,'content-type':'application/json'},body:JSON.stringify(d)});
  if(net.down)return route.abort('internetdisconnected');
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(u.pathname==='/auth/v1/token'){const b=JSON.parse(req.postData()||'{}');
   if(u.searchParams.get('grant_type')==='password'){const x=USERS[b.email];if(!x||x.pw!==b.password)return j({error_description:'Invalid login credentials'},400);
    return j({access_token:'tok-'+x.id,refresh_token:'ref-'+x.id,expires_in:3600,user:{id:x.id,email:b.email}})}
   const id=String(b.refresh_token).replace('ref-',''),e=Object.keys(USERS).find(k=>USERS[k].id===id);return j({access_token:'tok-'+id,refresh_token:'ref-'+id,expires_in:3600,user:{id,email:e}})}
  if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204,headers:cors});
  const me=who(req);if(!me)return j({message:'JWT'},401);const uid=me[1].id;
  if(u.pathname==='/rest/v1/rpc/claim_player'){if(net.claimBroken)return j({message:'boom'},500);return j(!me[1].stranger&&!net.refuse.has(uid))}
  if(u.pathname==='/rest/v1/saves'&&req.method()==='GET'){const id=u.searchParams.get('user_id').replace('eq.','');assert.equal(id,uid,'a player only asks for their own saves');
   const slot=u.searchParams.get('slot')?.replace('eq.','');
   return j([...cloud.values()].filter(r=>r.user_id===id&&(!slot||r.slot===slot)).map(r=>u.searchParams.get('select')==='data'?{data:r.data}:{slot:r.slot,rev:r.rev,device:r.device,updated_at:r.updated_at}))}
  if(u.pathname==='/rest/v1/rpc/save_put'){const b=JSON.parse(req.postData()),k=uid+':'+b.p_slot,cur=cloud.get(k),now=new Date().toISOString();
   if(!cur){cloud.set(k,{user_id:uid,slot:b.p_slot,data:b.p_data,rev:1,device:b.p_device,updated_at:now});return j([{ok:true,conflict:false,rev:1,updated_at:now,device:b.p_device}])}
   if(cur.rev!==b.p_base_rev&&!b.p_force)return j([{ok:false,conflict:true,rev:cur.rev,updated_at:cur.updated_at,device:cur.device}]);
   if(cur.rev!==b.p_base_rev)serverBackups.push({...cur});
   Object.assign(cur,{data:b.p_data,rev:cur.rev+1,device:b.p_device,updated_at:now});return j([{ok:true,conflict:false,rev:cur.rev,updated_at:now,device:b.p_device}])}
  if(u.pathname==='/rest/v1/rpc/reset_player_career'){   // like 036: the saves go to the backups first
   for(const [k,r] of [...cloud]){if(r.user_id!==uid)continue;serverBackups.push({...r,reason:'reset'});cloud.delete(k)}return j(true)}
  if(u.pathname==='/rest/v1/save_backups'){const id=u.searchParams.get('user_id').replace('eq.','');assert.equal(id,uid);
   return j(serverBackups.filter(b=>b.user_id===id).map(b=>({slot:b.slot,data:b.data,rev:b.rev,device:b.device,created_at:b.updated_at})).reverse())}
  return j({},404)});
 await ctx.route('https://api.test/**',async route=>{const req=route.request();if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  const me=who(req),body=JSON.parse(req.postData()||'{}');aiCalls.push({path:new URL(req.url()).pathname,user:me?.[1].id,body});
  if(!me)return route.fulfill({status:401,headers:{...cors,'content-type':'application/json'},body:'{"error":"no_token"}'});
  route.fulfill({status:200,headers:{...cors,'content-type':'application/json'},body:JSON.stringify({ok:true,result:{text:'(AI) '+body.answer}})})});
}
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:844}});await routes(ctx);
const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
const login=async(p,email,pw)=>{await p.locator('#verdict-login input[type=email]').fill(email);await p.locator('#verdict-login input[type=password]').fill(pw);await p.locator('#verdict-login button[type=submit]').click()};
const msg=(p,re)=>p.waitForFunction(r=>new RegExp(r).test(document.querySelector('.vl-msg')?.textContent||''),re.source);
const loaded=(p,name)=>p.waitForFunction(n=>typeof S!=='undefined'&&(n==null||S.name===n),name??null,{timeout:30000});
const backups=p=>p.evaluate(()=>new Promise(res=>{const r=indexedDB.open('verdict-backups',1);r.onupgradeneeded=()=>r.result.createObjectStore('b',{keyPath:'id'});r.onsuccess=()=>{const q=r.result.transaction('b').objectStore('b').getAll();q.onsuccess=()=>res(q.result.map(x=>({kind:x.kind,uid:x.uid,keys:Object.keys(x.keys)})))}}));
const gameSave=p=>p.evaluate(()=>{save();VerdictStore.flush()});
try{
 // a career started before login (test server, no gate)
 await page.goto(url,{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('옛 판사');await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.name==='옛 판사'&&S.legalWorld?.firstFour===true,null,{timeout:30000});await gameSave(page);

 // 1. the gate comes first
 await page.goto(url+'?auth=1',{waitUntil:'networkidle'});await page.locator('#verdict-login form').waitFor();
 assert.equal(await page.evaluate(()=>typeof S),'undefined','the game is not loaded before login');
 assert.equal(await page.locator('#verdict-entry').count(),0,'the profile screen waits for login');
 assert.ok(!/가입|sign up/i.test(await page.locator('#verdict-login').innerText()),'no sign-up');
 console.log('  ✓ login screen before the profile screen, game not loaded, no sign-up');

 // 2. refused
 await login(page,'a@x.kr','wrong');await msg(page,/맞지 않아요/);
 await login(page,'c@x.kr','pw-c');await msg(page,/초대된 계정이 아니에요/);
 net.claimBroken=true;await login(page,'a@x.kr','pw-a');await msg(page,/서버에 연결하지 못했어요/);net.claimBroken=false;
 net.down=true;await login(page,'a@x.kr','pw-a');await msg(page,/서버에 연결하지 못했어요/);net.down=false;
 assert.equal(await page.evaluate(()=>typeof S),'undefined');assert.equal(await page.evaluate(()=>localStorage.getItem('vauth_session')),null,'no half-made session is kept');
 console.log('  ✓ refused: wrong password, uninvited, invite check failing, no connection');

 // 3. first login: the old save is backed up, offered and moved
 await login(page,'a@x.kr','pw-a');
 await page.locator('#verdict-login [data-a="y"]').waitFor();assert.match(await page.locator('#verdict-login').innerText(),/옛 판사/);
 assert.ok((await backups(page)).some(b=>b.kind==='legacy'&&b.keys.includes('the_verdict_alpha_1')),'the pre-login save is backed up before anything moves');
 await page.locator('#verdict-login [data-a="y"]').click();await loaded(page,'옛 판사');
 console.log('  ✓ the save made before login: backed up, then moved into the first account');

 // 8. AI bridge: token + visible text only; the reworded answer is shown
 await page.locator('#verdict-entry .vl-out').waitFor();assert.match(await page.locator('#verdict-entry .vl-out').innerText(),/a@x\.kr/);
 const ai=await page.evaluate(async()=>{await VerdictCurated.loadAll();for(const g of S.generatedCases)S.cases[g.id].referred=true;
  const cand=CasePackEngine.pool(S)[0],c=createGeneratedCase(cand);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};
  const t=VerdictTrialPlay.ensure(c,S.cases[c.id]);VerdictTrialPlay.openSession(c,S.cases[c.id]);
  const q=VerdictTrialPlay.questions(c,t,0)[0];await VerdictAI.npc(c,t,{w:0,q:q.id,question:'그날 무엇을 보셨습니까?',answer:'창고 문이 열려 있었어요.'});
  t.witnesses[0].attitude='protect';   // hidden attitude: must not reach the server (v8.7.4)
  await VerdictAI.npc(c,t,{w:0,q:q.id+'-x',side:'d',question:'다시 묻겠습니다.',answer:'창고 문이 열려 있었어요.'});
  return {shown:t.ai?.['0:'+q.id+':n']}});
 assert.equal(ai.shown,'(AI) 창고 문이 열려 있었어요.');
 const call=aiCalls.at(-1);assert.equal(call.user,'uid-a');assert.equal(call.path,'/ai/npc');assert.ok(call.body.names.length>=2,'case names go along for the person check');
 assert.equal(call.body.attitude,'honest','a hidden attitude (protect) is never sent; only a visible change of story is');
 assert.ok(!/truth|did|didnt|reason|score/.test(Object.keys(call.body).join(',')),'no hidden truth in the request: '+Object.keys(call.body));
 console.log('  ✓ AI answer: the player\'s token and visible text only, shown in the game');

 // 4. logout uploads and puts away
 await gameSave(page);await page.locator('#verdict-entry [data-vl="out"]').click();await page.locator('#verdict-login form').waitFor();
 assert.equal(cloud.get('uid-a:1')?.rev,1,'player A\'s slot 1 is in the cloud');
 let keys=await page.evaluate(()=>Object.keys(localStorage));
 assert.ok(!keys.some(k=>/^(the_verdict|verdict_)/.test(k)),'nothing of player A is left in the game\'s working keys');
 assert.ok(keys.some(k=>k.startsWith('vu:uid-a:')),'player A\'s saves are kept on this device under A');
 console.log('  ✓ logout: cloud copy made, saves put away under the player');

 // 5. second player, then A again
 await login(page,'b@x.kr','pw-b');await loaded(page);
 assert.equal(await page.locator('#verdict-login [data-a="y"]').count(),0,'the old-save question is asked only once');
 assert.notEqual(await page.evaluate(()=>S.name),'옛 판사','player B does not see player A\'s career');
 await page.locator('#verdict-entry [data-vl="out"]').click();await page.locator('#verdict-login form').waitFor();
 await login(page,'a@x.kr','pw-a');await loaded(page,'옛 판사');
 console.log('  ✓ two players, separate careers on one device');

 // 6. same account on a second device
 const ctx2=await browser.newContext({viewport:{width:390,height:844}});await routes(ctx2);const p2=await ctx2.newPage();
 await p2.goto(url+'?auth=1',{waitUntil:'networkidle'});await login(p2,'a@x.kr','pw-a');await loaded(p2,'옛 판사');
 await p2.reload({waitUntil:'networkidle'});await loaded(p2,'옛 판사');   // login kept after a reload
 await p2.evaluate(()=>{S.name='태블릿 판사';save();VerdictStore.flush()});
 await p2.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await p2.evaluate(async()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'))});
 await p2.waitForFunction(()=>true);await new Promise(r=>setTimeout(r,800));
 assert.equal(cloud.get('uid-a:1').rev,2,'the tablet\'s save went up as rev 2');
 // the phone (page) still knows rev 1 and has its own change
 await page.evaluate(()=>{S.name='휴대폰 판사';save();VerdictStore.flush()});
 await page.locator('#verdict-login [data-a="y"]').waitFor({timeout:30000});
 assert.match(await page.locator('#verdict-login').innerText(),/다른 기기/);
 assert.equal(cloud.get('uid-a:1').rev,2,'the newer save was not overwritten while asking');
 await page.locator('#verdict-login [data-a="y"]').click();   // continue from the other device
 await page.waitForLoadState('networkidle');await loaded(page,'태블릿 판사');
 assert.ok((await backups(page)).some(b=>b.kind==='replaced'&&b.uid==='uid-a'),'the phone\'s own record is kept in this browser before being replaced');
 // and the other way: keep this device's record → the cloud's is kept on the server first
 await p2.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'})});
 await page.evaluate(()=>{S.name='휴대폰 판사 2';save();VerdictStore.flush()});
 await p2.evaluate(()=>{S.name='태블릿 판사 2';save();VerdictStore.flush()});
 await p2.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'))});await new Promise(r=>setTimeout(r,800));
 await page.locator('#verdict-login [data-a="n"]').waitFor({timeout:30000});await page.locator('#verdict-login [data-a="n"]').click();
 await page.waitForFunction(()=>true);await new Promise(r=>setTimeout(r,800));
 assert.ok(serverBackups.some(b=>/태블릿 판사 2/.test(b.data)),'the tablet\'s newer save was kept on the server before the phone\'s replaced it');
 // bring the tablet's record back from the server's backups (profile screen → 보관된 기록)
 await page.reload({waitUntil:'networkidle'});await loaded(page,'휴대폰 판사 2');
 await page.locator('#verdict-entry [data-vl="bk"]').click();await page.locator('#verdict-login [data-i="0"]').waitFor();
 const listText=await page.locator('#verdict-login').innerText();assert.match(listText,/태블릿 판사 2/);assert.match(listText,/서버/);
 const idx=await page.evaluate(()=>[...document.querySelectorAll('#verdict-login [data-i]')].findIndex(b=>/태블릿 판사 2/.test(b.textContent)&&/서버/.test(b.textContent)));
 await page.locator(`#verdict-login [data-i="${idx}"]`).click();await page.locator('#verdict-login [data-a="y"]').click();
 await page.waitForLoadState('networkidle');await loaded(page,'태블릿 판사 2');
 assert.match(cloud.get('uid-a:1').data,/태블릿 판사 2/,'the restored record is uploaded');
 assert.ok((await backups(page)).filter(b=>b.kind==='replaced').length>=2,'the record it replaced was kept first');
 await ctx2.close();
 console.log('  ✓ two devices: no silent overwrite; the player picks; the other side is backed up and can be restored');

 // 7. offline rules
 const ctx3=await browser.newContext({viewport:{width:390,height:844}});await routes(ctx3);const p3=await ctx3.newPage();const e3=[];p3.on('pageerror',e=>e3.push(e.message));
 await p3.goto(url+'?auth=1',{waitUntil:'networkidle'});await login(p3,'b@x.kr','pw-b');await loaded(p3);
 net.down=true;await p3.reload({waitUntil:'domcontentloaded'});await loaded(p3);
 assert.equal(await p3.locator('#vl-offline').count(),1,'recently confirmed owner of this device: may play offline');
 assert.equal(await p3.evaluate(async()=>{try{await VerdictAuth.api('/ai/npc',{});return 'called'}catch(e){return e.message}}),'ai_unavailable','no AI offline');
 // the confirmation is too old → no offline play
 await p3.evaluate(()=>{const v=JSON.parse(localStorage.getItem('vauth_verified'));v.at-=8*864e5;localStorage.setItem('vauth_verified',JSON.stringify(v))});
 await p3.reload({waitUntil:'domcontentloaded'});await msg(p3,/서버에 연결하지 못했어요/);assert.equal(await p3.evaluate(()=>typeof S),'undefined');
 // fresh confirmation, offline again, then the connection returns and the server refuses the account
 net.down=false;await p3.reload({waitUntil:'networkidle'});await loaded(p3);
 net.down=true;await p3.reload({waitUntil:'domcontentloaded'});await loaded(p3);
 net.down=false;net.refuse.add('uid-b');await p3.evaluate(()=>window.dispatchEvent(new Event('online')));
 await p3.locator('#verdict-login form').waitFor({timeout:15000});await msg(p3,/초대된 계정이 아니에요/);
 keys=await p3.evaluate(()=>Object.keys(localStorage));assert.ok(!keys.some(k=>/^(the_verdict|verdict_)/.test(k))&&!keys.includes('vauth_session'),'signed out, saves put away');
 net.refuse.clear();await ctx3.close();
 console.log('  ✓ offline: only the recent owner, no AI, signed out at once when the server refuses');

 // 7b. (v8.7.4) back online while the game runs, and another device saved meanwhile: the newer cloud save is taken,
 //     the running game is stopped from writing its older state back, and the page restarts on the newer save
 const ctx5=await browser.newContext({viewport:{width:390,height:844}});await routes(ctx5);const p5=await ctx5.newPage();
 await p5.goto(url+'?auth=1',{waitUntil:'networkidle'});await login(p5,'b@x.kr','pw-b');await loaded(p5);
 await p5.evaluate(()=>{S.name='오프라인 판사';save();VerdictStore.flush()});
 await p5.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await p5.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'))});
 await new Promise(r=>setTimeout(r,800));
 await p5.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'})});
 const up=cloud.get('uid-b:1');assert.ok(up,'player B\'s save is in the cloud');
 net.down=true;await p5.reload({waitUntil:'domcontentloaded'});await loaded(p5,'오프라인 판사');
 const newer=await p5.evaluate(()=>{const v=VerdictStore.parse(localStorage.getItem('verdict_player_save_1'));v.name='다른 기기 판사';return JSON.stringify(v)});
 cloud.set('uid-b:1',{...up,data:newer,rev:up.rev+1,device:'PC-zz',updated_at:new Date().toISOString()});
 net.down=false;await p5.evaluate(()=>window.dispatchEvent(new Event('online')));
 // if this device also changed something while offline the player is asked first; take the other device's record
 await p5.waitForFunction(()=>document.querySelector('#verdict-login [data-a="y"]')||(typeof S!=='undefined'&&S.name==='다른 기기 판사'),null,{timeout:30000});
 if(await p5.locator('#verdict-login [data-a="y"]').count())await p5.locator('#verdict-login [data-a="y"]').click();
 await loaded(p5,'다른 기기 판사');await p5.waitForLoadState('networkidle');
 await p5.evaluate(()=>{save();VerdictStore.flush()});await new Promise(r=>setTimeout(r,500));
 assert.match(cloud.get('uid-b:1').data,/다른 기기 판사/,'the newer save from the other device was not overwritten by the older game in memory');
 await ctx5.close();
 console.log('  ✓ back online: a newer cloud save restarts the game on it, never overwritten by the old one in memory');

 // 7c. (v8.7.4) no login server configured (the public build's default): the game opens as a solo offline game
 const solo=await (await browser.newContext()).newPage();
 await solo.route('**/config.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:"window.VERDICT_CONFIG={supabaseUrl:'',supabaseAnonKey:'',apiBase:'',ai:true};"}));
 await solo.goto(url+'?auth=1',{waitUntil:'networkidle'});await loaded(solo);
 assert.equal(await solo.locator('#verdict-login').count(),0,'no login wall without a login server');
 assert.equal(await solo.evaluate(async()=>{try{await VerdictAuth.api('/ai/npc',{});return 'called'}catch(e){return e.message}}),'ai_unavailable');
 await solo.context().close();
 console.log('  ✓ no login server set: plays as before (solo, offline, no AI)');

 // 9. optional login: play without an account, then sign in, then come back as the guest
 const ctx6=await browser.newContext({viewport:{width:390,height:844}});await routes(ctx6);const g=await ctx6.newPage();const e6=[];g.on('pageerror',e=>e6.push(e.message));
 const aiBefore=aiCalls.length;
 await g.goto(url+'?auth=1',{waitUntil:'networkidle'});await g.locator('#verdict-login [data-vl="guest"]').click();
 await g.locator('#profile-continue').click();await g.locator('#playerName').fill('손님 판사');await g.locator('[data-action="start"]').last().click();
 await g.waitForFunction(()=>typeof S!=='undefined'&&S.name==='손님 판사'&&S.legalWorld?.firstFour===true,null,{timeout:30000});await gameSave(g);
 assert.equal(await g.evaluate(async()=>{try{await VerdictAuth.api('/ai/npc',{});return 'called'}catch(e){return e.message}}),'ai_unavailable');
 assert.equal(await g.evaluate(()=>VerdictAuth.user),null);
 await g.reload({waitUntil:'networkidle'});await loaded(g,'손님 판사');
 assert.equal(await g.locator('#verdict-login').count(),0,'the choice is remembered');
 await g.locator('#verdict-entry .vl-out [data-vl="in"]').click();await g.locator('#verdict-login form').waitFor();
 await login(g,'a@x.kr','pw-a');await g.locator('#verdict-login [data-a="n"]').waitFor();
 assert.match(await g.locator('#verdict-login').innerText(),/손님 판사/,'a first login offers to move the guest career');
 await g.locator('#verdict-login [data-a="n"]').click();await loaded(g);
 assert.notEqual(await g.evaluate(()=>S.name),'손님 판사','the account does not get the guest career it did not take');
 assert.equal(cloud.has('uid-a:1')&&cloud.get('uid-a:1').data.includes('손님 판사'),false,'the guest career never reaches the cloud');
 // a signed-in reset keeps the current career on this device and on the server before starting over
 await g.locator('#verdict-entry #profile-reset').click();await g.locator('[data-reset-confirm]').click();
 for(let i=0;i<100&&!serverBackups.some(b=>b.user_id==='uid-a'&&b.reason==='reset');i++)await new Promise(r=>setTimeout(r,100));
 await g.waitForLoadState('networkidle');
 assert.ok((await backups(g)).some(b=>b.kind==='replaced'&&b.uid==='uid-a'&&b.keys.includes('verdict_player_save_1')),'the reset career is kept on this device');
 assert.ok(serverBackups.some(b=>b.user_id==='uid-a'&&b.reason==='reset'),'and on the server');
 await g.waitForFunction(()=>window.VerdictAuth?.online===true,null,{timeout:30000});
 g.evaluate(()=>VerdictAuth.logout()).catch(()=>{});await g.locator('#verdict-login form').waitFor();
 await g.locator('#verdict-login [data-vl="guest"]').click();await loaded(g,'손님 판사');
 assert.equal(aiCalls.length,aiBefore,'no AI call while playing without login');
 assert.deepEqual(e6,[]);await ctx6.close();
 console.log('  ✓ optional login: guest career on this device only, remembered, kept apart from accounts; reset keeps a copy');

 // 8b. no login, no AI
 const before=aiCalls.length;const p4=await (await browser.newContext()).newPage();
 await p4.goto(url,{waitUntil:'networkidle'});assert.equal(await p4.evaluate(async()=>{try{await VerdictAuth.api('/ai/npc',{});return 'called'}catch(e){return e.message}}),'ai_unavailable');
 assert.equal(aiCalls.length,before);
 console.log('  ✓ without login the AI is never called');
 assert.deepEqual(errs,[]);
 console.log('PASS: private login, per-user saves, conflicts, offline rules, AI bridge');
}finally{await browser.close();server.close()}
