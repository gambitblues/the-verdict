/* THE VERDICT — live end-to-end check against the REAL Supabase project and Cloudflare Worker.
 * Run on your own computer (passwords are typed here, hidden, and go only to Supabase; nothing is written to disk
 * except screenshots and a report without secrets):
 *
 *   cd server/live && npm i && npx playwright install chromium
 *   SUPABASE_URL=https://<project>.supabase.co SUPABASE_ANON_KEY=<anon public key> \
 *   VERDICT_API=https://the-verdict-api.<account>.workers.dev node live-e2e.mjs
 *
 * It starts the develop build locally (http://127.0.0.1:<port>/?auth=1) with these three public values and checks:
 *   1 two players sign in; wrong password and (optionally) an uninvited account are refused; each player's save is
 *     theirs alone (checked through the database API with each player's own token)
 *   2 the same player on two browsers ("devices"): a newer save is not overwritten, the player picks, the other side is
 *     kept (server save_backups / browser backups) and can be brought back from "보관된 기록"
 *   3 one first-hearing statement pair and one witness answer from the real models; model id, tokens, cost; the failure path keeps the
 *     game's own text (API blocked in the browser; plus ALLOW_TEST_FAIL on the Worker if it is "1")
 *   4 over-rejection: 20 real witness answers from the game through the checks — how many are refused and why
 *   5 one full case in the game: a case on the bench → hearings → questions (AI answers) → verdict → AI judgment
 * SAFETY (v8.7.3): it runs only on TEST accounts — invite rows named 'TEST…' (checked by the server, is_test_player) —
 * that have no save, no kept save and no AI use yet. Anything else stops it before a single write. There is no way to
 * override this. Each run uses fresh browser profiles on a separate local address, so no browser save is touched.
 * Clear test data for another run with server/supabase/cleanup_test_accounts.sql (TEST rows only).
 * Reports and screenshots are made without emails, passwords, tokens or keys (masked on screen before every capture,
 * and the written report is scanned for them). Results: out/<time>/report.md, report.json and screenshots. */
import {chromium} from 'playwright';
import http from 'node:http';
import readline from 'node:readline';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {courtUI} from '../../tests/lib/court-ui.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {SUPABASE_URL,SUPABASE_ANON_KEY,VERDICT_API}=process.env;
for(const [k,v] of Object.entries({SUPABASE_URL,SUPABASE_ANON_KEY,VERDICT_API}))if(!v){console.error('missing env '+k);process.exit(1)}
const HEADED=process.argv.includes('--headed');
if(process.argv.includes('--allow-overwrite')){console.error('--allow-overwrite was removed: this check runs only on empty TEST accounts.');process.exit(2)}
const OUT=path.join(path.dirname(fileURLToPath(import.meta.url)),'out',new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(OUT,{recursive:true});

/* ---------- report ---------- */
const results=[],facts={};
const mask=e=>String(e).replace(/^(.).*?(@.*)$/,'$1***$2');
function record(id,name,status,detail='',shots=[]){results.push({id,name,status,detail,shots});console.log(`${status==='pass'?'✓':status==='skip'?'–':'✗'} ${id} ${name}${detail?' — '+detail:''}`)}
const ONLY=(process.env.ONLY||'').split(',').filter(Boolean);   // e.g. ONLY=1-3,5 to rerun parts (1-3 signs player 1 in)
async function step(id,name,fn){if(ONLY.length&&!ONLY.some(x=>id.startsWith(x)))return record(id,name,'skip','ONLY');try{const r=await fn();record(id,name,r?.status||'pass',r?.detail||'',r?.shots||[])}catch(e){record(id,name,'fail',String(e.message||e).split('\n')[0]+' @'+((String(e.stack).match(/(live-e2e|court-ui)\.mjs:\d+/g)||[]).slice(0,3).join(',')))}}
/* before every capture: empty password fields, mask e-mail addresses wherever they appear on screen */
const hideSecrets=p=>p.evaluate(()=>{const m=e=>e.replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+)/g,'$1***@$2');
 document.querySelectorAll('input[type=password]').forEach(i=>{i.value=''});document.querySelectorAll('input[type=email],input[name=email]').forEach(i=>{if(i.value)i.value=m(i.value)});
 const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);for(let n;(n=w.nextNode());)if(n.nodeValue.includes('@'))n.nodeValue=m(n.nodeValue)}).catch(()=>{});
const shot=async(p,n)=>{const f=`${n}.png`;await hideSecrets(p);await p.screenshot({path:path.join(OUT,f)});return f};

/* ---------- inputs (hidden) ---------- */
const piped=!process.stdin.isTTY,lines=[],waiters=[];
if(piped){const rl=readline.createInterface({input:process.stdin});rl.on('line',l=>{const w=waiters.shift();w?w(l.trim()):lines.push(l.trim())})}
function prompt(q,hidden){
 if(piped){process.stdout.write(q+'\n');return lines.length?Promise.resolve(lines.shift()):new Promise(r=>waiters.push(r))}
 return new Promise(res=>{const rl=readline.createInterface({input:process.stdin,output:process.stdout,terminal:true});
  if(hidden)rl._writeToOutput=s=>rl.output.write(s.includes(q)?q:'*');rl.question(q,a=>{rl.close();if(hidden)process.stdout.write('\n');res(a.trim())})})}
const P1={email:await prompt('player 1 email: ')},P1pw=await prompt('player 1 password: ',true);
const P2={email:await prompt('player 2 email: ')},P2pw=await prompt('player 2 password: ',true);
const SX={email:await prompt('(optional) an account that is NOT invited — email, or Enter to skip: ')};const SXpw=SX.email?await prompt('its password: ',true):'';

/* ---------- direct API helpers (the player's own token, like the browser) ---------- */
const H=t=>({apikey:SUPABASE_ANON_KEY,'content-type':'application/json',...(t?{authorization:`Bearer ${t}`}:{})});
async function signIn(email,password){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:H(),body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok)throw new Error(d.error_description||'login failed');return d}
const rest=(t,p,o={})=>fetch(`${SUPABASE_URL}/rest/v1/${p}`,{...o,headers:{...H(t),...(o.headers||{})}}).then(async r=>({status:r.status,ok:r.ok,data:await r.json().catch(()=>null)}));
const api=(t,p,b)=>fetch(VERDICT_API+p,{method:b?'POST':'GET',headers:{'content-type':'application/json',...(t?{authorization:`Bearer ${t}`}:{})},body:b?JSON.stringify(b):undefined}).then(async r=>({status:r.status,data:await r.json().catch(()=>({}))}));
const A=await signIn(P1.email,P1pw),B=await signIn(P2.email,P2pw);
const cloudOf=async(s,uid)=>(await rest(s.access_token,`saves?select=slot,rev,data,device,updated_at&user_id=eq.${uid}`)).data||[];
/* stop before any write unless both accounts are empty TEST accounts */
for(const [who,s] of [['player 1',A],['player 2',B]]){
 const test=await rest(s.access_token,'rpc/is_test_player',{method:'POST',body:'{}'});
 if(!test.ok||test.data!==true){console.error(`${who} is not a TEST account (its invite name must start with 'TEST'). Nothing was changed.`);process.exit(2)}
 const saves=(await rest(s.access_token,`saves?select=slot&user_id=eq.${s.user.id}`)).data||[],kept=(await rest(s.access_token,`save_backups?select=slot&user_id=eq.${s.user.id}`)).data||[];
 const used=(await rest(s.access_token,`ai_usage?select=id&user_id=eq.${s.user.id}&limit=1`)).data||[];
 if(saves.length||kept.length){console.error(`${who} already has saves (${saves.length}) or kept saves (${kept.length}). Use an empty TEST account or clear it with server/supabase/cleanup_test_accounts.sql. Nothing was changed.`);process.exit(2)}
 if(used.length)console.log(`(${who}: earlier AI use is counted in today's limit)`);
}
if(A.user.id===B.user.id){console.error('player 1 and player 2 must be different accounts.');process.exit(2)}

/* ---------- the develop build, served locally with the public config ---------- */
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(ROOT,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(ROOT)){r.writeHead(403);return r.end()}
 if(f.endsWith(path.sep+'config.js')){r.writeHead(200,{'content-type':'text/javascript'});return r.end(`window.VERDICT_CONFIG=${JSON.stringify({supabaseUrl:SUPABASE_URL,supabaseAnonKey:SUPABASE_ANON_KEY,apiBase:VERDICT_API,ai:true})};`)}
 if(f.endsWith(path.sep+'sw.js')){r.writeHead(404);return r.end()}   // no service worker during the test
 try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end()}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const URL0=`http://127.0.0.1:${server.address().port}/?auth=1`;
const browser=await chromium.launch({headless:!HEADED});
const device=async()=>{const ctx=await browser.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();p.errors=[];p.on('pageerror',e=>p.errors.push(e.message));return {ctx,p}};
const login=async(p,email,pw)=>{await p.goto(URL0,{waitUntil:'networkidle'});await p.locator('#verdict-login form').waitFor({timeout:20000});
 await p.locator('#verdict-login input[type=email]').fill(email);await p.locator('#verdict-login input[type=password]').fill(pw);await p.locator('#verdict-login button[type=submit]').click()};
const msg=p=>p.locator('.vl-msg').innerText().catch(()=>'');
const loaded=(p,name,timeout=60000)=>p.waitForFunction(n=>typeof S!=='undefined'&&(n==null||S.name===n),name??null,{timeout});
const answerPrompt=async(p,which,timeout=40000)=>{await p.locator(`#verdict-login [data-a="${which}"]`).waitFor({timeout});await p.locator(`#verdict-login [data-a="${which}"]`).click()};
const hidden=p=>p.evaluate(()=>{try{save();VerdictStore.flush()}catch{}Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange',{bubbles:true}))});
const visible=p=>p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'})});
const waitCloud=async(s,uid,pred,timeout=30000)=>{const t0=Date.now();while(Date.now()-t0<timeout){const rows=await cloudOf(s,uid);if(pred(rows))return rows;await new Promise(r=>setTimeout(r,1500))}throw new Error('cloud did not change in time')};
const newGame=async(p,name)=>{if(await p.locator('#verdict-login [data-a="n"]').count())await p.locator('#verdict-login [data-a="n"]').click();   // a pre-login save on this test browser: keep it out
 await p.locator('#profile-continue').waitFor({timeout:60000});
 if(await p.evaluate(()=>!!S.name))throw new Error('this test account already has a career on screen — stopping');
 await p.locator('#profile-continue').click();await p.locator('#playerName').fill(name);await p.locator('[data-action="start"]').last().click();
 await p.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,null,{timeout:60000})};

const A1=await device(),A2=await device(),B1=await device();
try{
 /* ---------- 1. two players, refusals, separate saves ---------- */
 await step('1-1','틀린 비밀번호 거절',async()=>{await login(A1.p,P1.email,'wrong-'+Date.now());await A1.p.waitForFunction(()=>/맞지 않아요/.test(document.querySelector('.vl-msg')?.textContent||''),null,{timeout:15000});
  return {detail:await msg(A1.p),shots:[await shot(A1.p,'1-1-wrong-password')]}});
 await step('1-2','초대되지 않은 계정 거절',async()=>{if(!SX.email)return {status:'skip',detail:'초대되지 않은 테스트 계정을 입력하지 않음'};
  await login(A1.p,SX.email,SXpw);await A1.p.waitForFunction(()=>/초대된 계정이 아니에요|맞지 않아요/.test(document.querySelector('.vl-msg')?.textContent||''),null,{timeout:15000});
  const m=await msg(A1.p);const w=await api((await signIn(SX.email,SXpw).catch(()=>({}))).access_token,'/ai/npc',{role:'증인',question:'?',answer:'네, 봤어요.'});
  if(!/초대된 계정이 아니에요/.test(m))throw new Error('메시지: '+m);if(w.status!==403)throw new Error('Worker '+w.status);
  return {detail:`화면: "${m}" · AI 서버 ${w.status}`,shots:[await shot(A1.p,'1-2-uninvited')]}});
 await step('1-3','플레이어 1 로그인·새 커리어·클라우드 저장',async()=>{await login(A1.p,P1.email,P1pw);await newGame(A1.p,'실검 A');await hidden(A1.p);
  const rows=await waitCloud(A,A.user.id,r=>r.some(x=>x.slot==='1'));await visible(A1.p);
  return {detail:`saves rev ${rows.find(x=>x.slot==='1').rev}`,shots:[await shot(A1.p,'1-3-player1-game')]}});
 await step('1-4','플레이어 2 로그인·새 커리어·클라우드 저장',async()=>{await login(B1.p,P2.email,P2pw);await newGame(B1.p,'실검 B');await hidden(B1.p);
  await waitCloud(B,B.user.id,r=>r.some(x=>x.slot==='1'));await visible(B1.p);return {shots:[await shot(B1.p,'1-4-player2-game')]}});
 await step('1-5','계정 분리 (DB 권한)',async()=>{
  const peekAB=(await rest(A.access_token,`saves?select=slot&user_id=eq.${B.user.id}`)).data,peekBA=(await rest(B.access_token,`saves?select=slot&user_id=eq.${A.user.id}`)).data;
  const write=await rest(A.access_token,'saves',{method:'POST',body:JSON.stringify({user_id:B.user.id,slot:'2',data:'x'})});
  const world=await rest(A.access_token,'world_state?id=eq.main',{method:'PATCH',body:'{"data":{"x":1}}',headers:{prefer:'return=representation'}});
  const secret=await rest(A.access_token,'world_secrets?select=case_id');const reserve=await rest(A.access_token,'rpc/ai_reserve',{method:'POST',body:JSON.stringify({p_uid:A.user.id,p_kind:'x',p_model:'x',p_est:0,p_max_calls:9,p_max_usd:9})});
  const anon=await rest(null,'saves?select=slot');
  const bad=[peekAB?.length&&'A가 B 세이브를 봄',peekBA?.length&&'B가 A 세이브를 봄',write.ok&&'A가 세이브를 직접 씀',world.ok&&world.data?.length&&'공유 세계 수정됨',secret.ok&&'숨은 진실 읽힘',reserve.ok&&'사용량 예약 호출됨',anon.ok&&anon.data?.length&&'비로그인이 세이브를 봄'].filter(Boolean);
  if(bad.length)throw new Error(bad.join(', '));
  return {detail:`남의 세이브 0행 · 직접 쓰기 ${write.status} · 공유 세계 ${world.status} · 숨은 진실 ${secret.status} · 사용량 예약 ${reserve.status} · 비로그인 ${anon.status}`}});
 await step('1-6','플레이어 2 화면에 플레이어 1 커리어가 없음',async()=>{const n=await B1.p.evaluate(()=>S.name);if(n!=='실검 B')throw new Error('B 화면: '+n);return {}});

 /* ---------- 2. same account on two devices ---------- */
 await step('2-1','두 번째 기기에서 같은 커리어 불러오기',async()=>{await login(A2.p,P1.email,P1pw);await loaded(A2.p,'실검 A');return {shots:[await shot(A2.p,'2-1-second-device')]}});
 await step('2-2','두 번째 기기가 먼저 저장 → 첫 기기 저장 시 충돌 확인 (덮어쓰지 않음)',async()=>{
  const r0=(await cloudOf(A,A.user.id)).find(x=>x.slot==='1').rev;
  await A2.p.evaluate(()=>{S.name='실검 A (두번째 기기)'});await hidden(A2.p);await waitCloud(A,A.user.id,r=>r.find(x=>x.slot==='1').rev>r0);await visible(A2.p);
  await A1.p.evaluate(()=>{S.name='실검 A (첫 기기)';save();VerdictStore.flush()});
  await A1.p.locator('#verdict-login [data-a="y"]').waitFor({timeout:40000});const text=await A1.p.locator('#verdict-login').innerText();
  const still=(await cloudOf(A,A.user.id)).find(x=>x.slot==='1');if(!/두번째 기기/.test(still.data))throw new Error('물어보는 동안 덮어써짐');
  return {detail:text.replace(/\s+/g,' ').slice(0,120),shots:[await shot(A1.p,'2-2-conflict-prompt')]}});
 await step('2-3','"이 기기 기록 유지" → 서버에 다른 기기 기록 보관',async()=>{
  await A1.p.locator('#verdict-login [data-a="n"]').click();await waitCloud(A,A.user.id,r=>/첫 기기/.test(r.find(x=>x.slot==='1').data));
  const bk=(await rest(A.access_token,`save_backups?select=data,reason,device&user_id=eq.${A.user.id}&order=id.desc&limit=5`)).data||[];
  if(!bk.some(b=>/두번째 기기/.test(b.data)))throw new Error('save_backups에 두 번째 기기 기록 없음');return {detail:`save_backups ${bk.length}개 (최근: ${bk[0].reason})`}});
 await step('2-4','"다른 기기 기록으로 이어 하기" → 이 기기 기록은 브라우저에 보관',async()=>{
  await A2.p.evaluate(()=>{S.name='실검 A (두번째 기기 2)';save();VerdictStore.flush()});await answerPrompt(A2.p,'y');
  await A2.p.waitForLoadState('networkidle');await loaded(A2.p,'실검 A (첫 기기)');
  const kept=await A2.p.evaluate(()=>new Promise(res=>{const r=indexedDB.open('verdict-backups',1);r.onsuccess=()=>{const q=r.result.transaction('b').objectStore('b').getAll();q.onsuccess=()=>res(q.result.filter(x=>x.kind==='replaced').length)}}));
  if(!kept)throw new Error('브라우저 보관 없음');return {detail:`브라우저 보관 ${kept}개`,shots:[await shot(A2.p,'2-4-took-cloud')]}});
 await step('2-5','보관된 기록 되돌리기 (서버 보관본)',async()=>{
  await A2.p.locator('#verdict-entry [data-vl="bk"]').click();await A2.p.locator('#verdict-login [data-i]').first().waitFor();const s1=await shot(A2.p,'2-5-kept-list');
  const idx=await A2.p.evaluate(()=>[...document.querySelectorAll('#verdict-login [data-i]')].findIndex(b=>/두번째 기기\)/.test(b.textContent)&&/서버/.test(b.textContent)));
  if(idx<0)throw new Error('목록에 서버 보관본 없음');await A2.p.locator(`#verdict-login [data-i="${idx}"]`).click();await answerPrompt(A2.p,'y');
  await A2.p.waitForLoadState('networkidle');await loaded(A2.p,'실검 A (두번째 기기)');await waitCloud(A,A.user.id,r=>/두번째 기기\)/.test(r.find(x=>x.slot==='1').data));
  return {detail:'되돌린 기록이 화면과 클라우드에 반영',shots:[s1,await shot(A2.p,'2-5-restored')]}});
 await A2.ctx.close();
 // the first device continues from the restored record
 await A1.p.reload({waitUntil:'networkidle'});if(await A1.p.locator('#verdict-login form').count()===0)await loaded(A1.p).catch(()=>{});

 /* ---------- 3. real AI calls ---------- */
 const AI={};
 await step('3-1','모델 ID와 사용 권한',async()=>{const r=await api(A.access_token,'/ai/check');facts.models=r.data.models;if(!Object.values(r.data.models||{}).every(m=>m.ok))throw new Error(JSON.stringify(r.data));return {detail:JSON.stringify(r.data.models)}});
 await step('3-2','토큰 없이 AI 호출 → 401',async()=>{const r=await api(null,'/ai/npc',{});if(r.status!==401)throw new Error(String(r.status));return {}});
 await step('3-3','첫 기일 양측 입장 1건 생성',async()=>{const r=await api(A.access_token,'/ai/opening',{names:['김혜진'],openingA:'검찰은 김혜진 씨가 동창 12명에게 받은 투자금 3억 원 가운데 7천만 원을 개업 엿새 만에 자기 빚을 갚는 데 썼다며 처음부터 속일 생각이었다고 주장합니다.',openingB:'김혜진 씨는 가게를 살리려고 잠시 돌려 쓴 돈이고 석 달 안에 갚을 계획이었다며 속일 생각은 없었다고 말합니다.'});
  AI.opening=r.data;if(!r.data.ok)throw new Error(JSON.stringify(r.data));
  return {detail:`${r.data.model} · 입력 ${r.data.usage.input_tokens} · 출력 ${r.data.usage.output_tokens} · $${r.data.cost_usd}`}});
 await step('3-4','NPC 답변 1건 생성',async()=>{const r=await api(A.access_token,'/ai/npc',{role:'카페 매니저',attitude:'honest',names:['김혜진'],question:'그날 현금은 어떻게 처리했습니까?',answer:'매일 밤 10시에 김혜진 대표님이 현금을 직접 가져갔어요. 3천만 원쯤 됐을 거예요.'});
  AI.npc=r.data;if(!r.data.ok)throw new Error(JSON.stringify(r.data));return {detail:`${r.data.model} · 입력 ${r.data.usage.input_tokens} · 출력 ${r.data.usage.output_tokens} · $${r.data.cost_usd} · "${r.data.result.text}"`}});
 await step('3-5','AI 오류 시 원래 문장 유지 (게임 화면, AI 서버 차단)',async()=>{
  const p=A1.p;await p.route(VERDICT_API+'/**',r=>r.abort());
  const res=await p.evaluate(async()=>{await VerdictCurated.loadAll();for(const g of S.generatedCases)S.cases[g.id].referred=true;const cand=CasePackEngine.pool(S)[0],c=createGeneratedCase(cand);
   S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};const st=S.cases[c.id],t=VerdictTrialPlay.ensure(c,st);VerdictTrialPlay.openSession(c,st);
   const q=VerdictTrialPlay.questions(c,t,0)[0];VerdictTrialPlay.ask(c,t,0,q.id);
   await VerdictAI.npc(c,t,{w:0,q:q.id,question:'질문',answer:'원래 답'});const out={ai:!!t.ai?.['0:'+q.id]};st.referred=true;save();return out});
  await p.unroute(VERDICT_API+'/**');if(res.ai)throw new Error('차단됐는데 AI 문장이 들어감');return {detail:'AI 문장 없음 → 엔진 문장 표시'}});
 await step('3-6','서버 쪽 실패 처리 (ALLOW_TEST_FAIL)',async()=>{const r=await api(B.access_token,'/ai/npc',{role:'증인',question:'무엇을 보셨습니까?',answer:'아무것도 못 봤어요.',test:'fail'});
  if(r.data.fallback===true)return {detail:'fallback=true'};if(r.data.ok)return {status:'skip',detail:'Worker ALLOW_TEST_FAIL이 "0"이라 건너뜀(정상 호출됨)'};throw new Error(JSON.stringify(r.data))});

 /* ---------- 4. over-rejection: 20 real witness answers from the game ---------- */
 await step('4-1','정상 문장 과잉 거부 확인 (증인 답변 20건)',async()=>{
  const ctx={window:{}};vm.createContext(ctx);vm.runInContext(await readFile(path.join(ROOT,'curated_cases.js'),'utf8'),ctx);const C=ctx.window.VerdictCurated;
  const NAMES={A:'김민준',B:'이서연',L:'최유진'},nameOf=k=>NAMES[k]||'박지훈';
  const fill=t=>String(t).replace(/\{([A-Z]\d?)(?:>([A-Z]\d?))?(?:\|([^}]*))?\}/g,(m,k,by,p)=>by?'형':p?C.particle(nameOf(k),p):nameOf(k));
  const pool=[];for(const id of C.ids){const c=C.cases[id];for(const w of c.witnesses||[])for(const q of w.q||[]){const a=typeof q.a==='string'?q.a:q.a?.did||q.a?.reason||q.a?.didnt;if(a&&q.q)pool.push({role:fill(w.role),question:fill(q.q),answer:fill(a)})}}
  const sample=pool.filter((_,i)=>i%Math.floor(pool.length/20)===0).slice(0,20);const rows=[];
  for(const s of sample){const r=await api(A.access_token,'/ai/npc',{...s,attitude:'honest',names:Object.values(NAMES)});rows.push({...s,ok:!!r.data.ok,why:r.data.why||r.data.error||'',text:r.data.result?.text||'',cost:r.data.cost_usd||0})}
  facts.overReject=rows;const ok=rows.filter(r=>r.ok).length,reasons={};for(const r of rows)if(!r.ok)reasons[r.why.split(':')[0]]=(reasons[r.why.split(':')[0]]||0)+1;
  return {status:ok>=14?'pass':'fail',detail:`${ok}/20 통과 · 거부 이유 ${JSON.stringify(reasons)} · 합계 $${rows.reduce((a,r)=>a+r.cost,0).toFixed(5)}`}});

 /* ---------- 5. one full case: bench → hearings → verdict → AI judgment ---------- */
 await step('5-1','사건 1건 완주 (배당부터 판결문까지)',async()=>{
  const p=A1.p,U=courtUI(p),shots=[];
  await p.evaluate(()=>{document.getElementById('verdict-entry')?.remove();ui.tab='home';render()});
  let id=null;const offer=p.locator('[data-action="acceptDocket"]:not([disabled])'),offered=await offer.count()>0;
  if(offered){await offer.first().click();await p.waitForFunction(()=>ui.tab==='court'&&!!ui.caseId,null,{timeout:15000});id=await p.evaluate(()=>ui.caseId);shots.push(await shot(p,'5-1-accepted'))}
  else id=await p.evaluate(()=>{const c=openCases().find(c=>!S.cases[c.id]?.referred&&!S.cases[c.id]?.verdict);ui.tab='court';ui.caseId=c.id;render();return c.id});
  const how=offered?'시간대 배당에서 수락':'처음 배당된 사건(이 시간에는 새 배당 없음)';
  await p.evaluate(()=>VerdictCurated.loadAll());await p.locator('.t4-tabs').waitFor({timeout:30000});
  for(let day=0;day<6;day++){
   const t=await p.evaluate(()=>{const t=S.cases[ui.caseId].trial4;return {done:t.daysDone,min:t.minDays}});if(t.done>=t.min)break;
   await p.evaluate(()=>{const t=S.cases[ui.caseId].trial4;t.nextAt=0;save();render()});await U.tab('day');
   if(!(await p.evaluate(()=>{const t=S.cases[ui.caseId].trial4;return t.dates?.[t.day]!=null})))await U.openSession();
   await p.evaluate(()=>{const t=S.cases[ui.caseId].trial4;t.evidence.forEach(e=>{if(!e.decision)e.decision='use'});save()});
   await U.tab('witness');
   for(let k=0;k<2;k++){
    if(!(await p.evaluate(()=>{const t=S.cases[ui.caseId].trial4;return t.dates?.[t.day]!=null}))){   // a ruling moved the hearing: open it again
     await p.evaluate(()=>{const t=S.cases[ui.caseId].trial4;t.nextAt=0;save();render()});await U.tab('day');await U.openSession();await U.tab('witness')}
    const q=p.locator('.t4-q[data-kind="ask"]:not([disabled])');if(!(await q.count()))break;
    try{await U.ask(q.first())}catch(e){const st=await p.evaluate(()=>{const t=S.cases[ui.caseId].trial4;return {tab:ui.t4tab,modal:String(ui.modal||'').slice(0,60),q:t.qLeft,open:t.dates?.[t.day]!=null,wait:t.nextAt>Date.now(),heard:t.heard.length,overlay:!!document.querySelector('#verdict-login,#verdict-entry')}});
     shots.push(await shot(p,'5-fail-ask'));throw new Error('질문 실패 '+JSON.stringify(st))}}
   if(day===0){await p.waitForFunction(()=>Object.keys(S.cases[ui.caseId].trial4.ai||{}).length>0,null,{timeout:45000}).catch(()=>{});shots.push(await shot(p,'5-2-witness-answer'))}
   await U.endSession();
  }
  const aiAnswers=await p.evaluate(()=>Object.keys(S.cases[ui.caseId].trial4.ai||{}).length);
  await p.evaluate(()=>{ui.t4tab='verdict';ui.vsheet=ui.caseId;ui.vstep=0;render()});
  await p.locator('[data-action="t4verdict"]').first().click();await p.locator('.t4-steps li').nth(1).waitFor();
  for(let k=0;k<8;k++){
   if(await p.locator('[data-action="t4confirm"]').count()){shots.push(await shot(p,'5-3-judgment-preview'));await p.locator('[data-action="t4confirm"]').click();break}
   if(await p.locator('.t4-cite').count()&&!(await p.locator('.t4-cite.on').count()))await p.locator('.t4-cite').first().click();
   await p.locator('.t4-sheet-foot [data-action="t4sheet"]').last().click();await p.waitForTimeout(300);
  }
  await p.waitForFunction(()=>!!S.cases[ui.caseId].verdict,null,{timeout:20000});await U.settle().catch(()=>{});
  const ai=await p.waitForFunction(()=>!!S.cases[ui.caseId].trial4.final?.judgmentAI,null,{timeout:90000}).then(()=>true).catch(()=>false);
  await p.evaluate(()=>{ui.modal=null;render()}).catch(()=>{});shots.push(await shot(p,'5-4-result-judgment'));
  facts.fullCase={how,aiAnswers,judgmentAI:ai};
  if(!ai)return {status:'fail',detail:`${how} · AI 답변 ${aiAnswers}건 · 판결문 AI 문장 실패(엔진 판결문 유지)`,shots};
  return {detail:`${how} · AI 답변 ${aiAnswers}건 · 판결문 AI 문장 적용`,shots};
 });
 await step('5-2','오늘 사용량 기록',async()=>{const u=[await api(A.access_token,'/ai/usage'),await api(B.access_token,'/ai/usage')];facts.usage=u.map(x=>x.data);
  const rows=(await rest(A.access_token,`ai_usage?select=kind,model,input_tokens,output_tokens,cost_usd,ok,reason&user_id=eq.${A.user.id}&order=id.desc&limit=60`)).data||[];facts.usageRows=rows;
  return {detail:`플레이어 1: ${u[0].data.today?.calls}회 $${Number(u[0].data.today?.usd||0).toFixed(5)} · 플레이어 2: ${u[1].data.today?.calls}회`}});
 for(const d of [A1,B1])if(d.p.errors.length)record('9-'+(d===A1?'1':'2'),'화면 오류','fail',d.p.errors.slice(0,3).join(' | '));
}finally{
 await browser.close();server.close();
 const pass=results.filter(r=>r.status==='pass').length,fail=results.filter(r=>r.status==='fail').length,skip=results.filter(r=>r.status==='skip').length;
 const md=[`# THE VERDICT 실연결 테스트 ${new Date().toLocaleString('ko-KR')}`,'',`플레이어: ${mask(P1.email)}, ${mask(P2.email)} · 통과 ${pass} · 실패 ${fail} · 건너뜀 ${skip}`,'',
  '| 항목 | 내용 | 결과 | 세부 | 화면 |','|---|---|---|---|---|',...results.map(r=>`| ${r.id} | ${r.name} | ${r.status==='pass'?'통과':r.status==='skip'?'건너뜀':'실패'} | ${String(r.detail).replace(/\|/g,'/')} | ${r.shots.map(f=>`[${f}](${f})`).join(' ')} |`),
  '','## 과잉 거부 표본',...(facts.overReject||[]).map(r=>`- ${r.ok?'통과':'거부('+r.why+')'} · ${r.role} · 원문: ${r.answer}${r.text?` → ${r.text}`:''}`),
  '','## AI 호출 기록 (최근)',...(facts.usageRows||[]).slice(0,30).map(r=>`- ${r.kind} · ${r.model} · ${r.input_tokens}+${r.output_tokens} · $${r.cost_usd} · ${r.ok?'성공':'실패 '+(r.reason||'')}`)].join('\n');
 /* last guard: nothing secret may be written. Every password, token and key of this run (and the full e-mails) is searched for and replaced. */
 const secrets=[P1pw,P2pw,SXpw,A.access_token,A.refresh_token,B.access_token,B.refresh_token,SUPABASE_ANON_KEY,P1.email,P2.email,SX.email].filter(x=>x&&String(x).length>=4);
 let found=0;const clean=t=>{for(const x of secrets){const parts=String(t).split(x);if(parts.length>1){found+=parts.length-1;t=parts.join('[가림]')}}return t};
 const jsonText=clean(JSON.stringify({results,facts},null,1)),mdText=clean(md);
 await writeFile(path.join(OUT,'report.md'),mdText);await writeFile(path.join(OUT,'report.json'),jsonText);
 if(found)console.log(`(report: ${found} secret value(s) found and replaced with [가림])`);
 console.log(`\nreport: ${path.join(OUT,'report.md')}`);process.exit(fail?1:0);
}
