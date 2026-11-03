/* THE VERDICT — private login (Supabase Auth) in front of the judge's profile screen.
 *
 * - Only invited players sign in with email and password; there is no sign-up (also switched off in Supabase).
 * - Sign-in counts only when the server confirms both the password and the invite list. If either cannot be checked
 *   (server error, no connection), the player is not let in.
 * - Playing offline is allowed only for the player whose saves are already on this device, whose invite was confirmed
 *   online within the last OFFLINE_DAYS days, and only until the connection returns: then the check runs again and a
 *   refused account is signed out at once. Offline there are no cloud saves and no AI.
 * - Each Supabase user has their own careers: the game's local save keys are swapped per user on this device and kept
 *   in the `saves` table through `save_put`, which never overwrites a newer save from another device without asking.
 * - Before a save on this device is replaced or moved (old pre-login save, a cloud copy taking over), the original is
 *   kept in this browser's IndexedDB ("verdict-backups"); replaced cloud saves are also kept server-side (save_backups).
 * - The game itself is unchanged: it starts only after sign-in, reading the same local keys it always has.
 *   On a local test server (localhost / 127.0.0.1, without ?auth=1) the gate is skipped so the test suite runs as before.
 */
(()=>{
'use strict';
const CFG=window.VERDICT_CONFIG||{};
const GAME=['./names.js','./deep_case_engine.js','./story_engine.js','./case_pack_engine.js','./curated_index.js','./continuity_engine.js','./npc_life_justice.js','./family_engine.js','./save_store.js','./court_visuals.js','./career_balance.js','./avatar_system.js','./game_runtime.js','./game_hearings.js','./game_professions.js','./game_ui.js','./trial_core.js','./hearing_events.js','./media_desk.js','./match_engine.js','./world_sheets_index.js','./match_play.js','./trial_play.js','./world_feed.js','./people_map.js','./v6_world.js','./ai_bridge.js','./app_install.js'];
const OFFLINE_DAYS=7;
const SESSION='vauth_session',OWNER='vauth_owner',LEGACY='vauth_legacy_done',VERIFIED='vauth_verified',DEVICE='vauth_device';
const REV=(u,s)=>`vauth_rev:${u}:${s}`,PUSHED=(u,s)=>`vauth_fp:${u}:${s}`;
const KEY='the_verdict_alpha_1',ACTIVE='verdict_player_active',slotKey=id=>'verdict_player_save_'+id;
const WORK=/^(the_verdict|verdict_)/;   // every key the game owns (the game's own wipe uses the same pattern)
const stash=uid=>`vu:${uid}:`;
const local=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)&&!/[?&]auth=1\b/.test(location.search);
let online=false;   // true once the server confirmed this session in this visit

/* ---------- start the game exactly as the old page did ---------- */
function profiles(){   // was the inline bootstrap in index.html: the active profile's save goes to the main key
 const active=localStorage.getItem(ACTIVE)||'1',main=localStorage.getItem(KEY);
 if(!localStorage.getItem(ACTIVE)){if(main)localStorage.setItem(slotKey('1'),main);localStorage.setItem(ACTIVE,'1')}
 else if(main&&!localStorage.getItem(slotKey(active)))localStorage.setItem(slotKey(active),main);
 const saved=localStorage.getItem(slotKey(active));if(saved!==null)localStorage.setItem(KEY,saved);else localStorage.removeItem(KEY);
}
/* The game files expect to run during page load (several wait for DOMContentLoaded). They are added here in order and
 * see a page that is still loading; when the last one has run, DOMContentLoaded fires for them as it used to. */
let booted=false;
function boot(){
 if(booted)return;booted=true;profiles();
 try{Object.defineProperty(document,'readyState',{configurable:true,get:()=>'loading'})}catch{}
 let i=0;const next=()=>{if(i>=GAME.length){try{delete document.readyState}catch{}document.dispatchEvent(new Event('DOMContentLoaded'));return}
  const s=document.createElement('script');s.src=GAME[i++];s.async=false;s.onload=next;s.onerror=()=>{console.warn('script failed',s.src);next()};document.body.appendChild(s)};
 next();
}

/* ---------- backups in IndexedDB (bigger than localStorage; never cleared by the game) ---------- */
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('verdict-backups',1);r.onupgradeneeded=()=>r.result.createObjectStore('b',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function backup(kind,uid,keys){
 try{const db=await idb(),at=Date.now(),id=`${kind}:${uid||'-'}:${at}`;
  await new Promise((res,rej)=>{const tx=db.transaction('b','readwrite');tx.objectStore('b').put({id,kind,uid:uid||null,at,keys});tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});
  if(kind!=='legacy'){   // keep the newest 10 of each kind per player; the pre-login save is kept for good
   const all=await new Promise(res=>{const q=db.transaction('b').objectStore('b').getAll();q.onsuccess=()=>res(q.result||[])});
   const mine=all.filter(x=>x.kind===kind&&x.uid===(uid||null)).sort((a,b)=>b.at-a.at).slice(10);
   if(mine.length){const tx=db.transaction('b','readwrite');for(const x of mine)tx.objectStore('b').delete(x.id)}}
  return id}catch(e){console.warn('backup failed',e);return null}
}
const snapshot=pred=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(pred(k))o[k]=localStorage.getItem(k)}return o};

/* ---------- Supabase Auth over plain fetch (no library: the app also runs offline as a PWA) ---------- */
const H=extra=>({apikey:CFG.supabaseAnonKey,'content-type':'application/json',...extra});
let session=null;try{session=JSON.parse(localStorage.getItem(SESSION)||'null')}catch{}
const keep=s=>{session=s?{access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600),user:{id:s.user?.id,email:s.user?.email}}:null;
 if(session)localStorage.setItem(SESSION,JSON.stringify(session));else localStorage.removeItem(SESSION)};
const refused=msg=>Object.assign(new Error(msg),{refused:true});        // the server said no
const unreachable=()=>Object.assign(new Error('offline'),{offline:true}); // no answer at all
async function call(url,opt){try{return await fetch(url,opt)}catch{throw unreachable()}}
async function signIn(email,password){
 const r=await call(`${CFG.supabaseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:H(),body:JSON.stringify({email,password})});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw r.status>=500?unreachable():refused(/invalid/i.test(d.error_description||d.msg||'')?'이메일이나 비밀번호가 맞지 않아요.':'로그인하지 못했어요.');
 keep(d);return session;
}
async function refresh(){
 const r=await call(`${CFG.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:H(),body:JSON.stringify({refresh_token:session.refresh_token})});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw r.status>=500?unreachable():refused('로그인이 만료됐어요. 다시 로그인해 주세요.');keep(d);return session;
}
async function token(){if(!session)throw refused('로그인이 필요해요.');if(session.expires_at-60<Date.now()/1000)await refresh();return session.access_token}
const rest=async(path,opt={})=>call(`${CFG.supabaseUrl}/rest/v1/${path}`,{...opt,headers:H({authorization:`Bearer ${await token()}`,...(opt.headers||{})})});
/* the online check: a valid session AND the invite list says yes. Anything else is a refusal or "no answer". */
async function verify(){
 const r=await rest('rpc/claim_player',{method:'POST',body:'{}'});
 if(r.status===401||r.status===403)throw refused('로그인이 만료됐어요. 다시 로그인해 주세요.');
 if(!r.ok)throw unreachable();
 if((await r.json())!==true)throw refused('초대된 계정이 아니에요.');
 online=true;localStorage.setItem(VERIFIED,JSON.stringify({uid:session.user.id,at:Date.now()}));
}
function offlineAllowed(){
 try{const v=JSON.parse(localStorage.getItem(VERIFIED)||'null');
  return !!v&&v.uid===session?.user?.id&&localStorage.getItem(OWNER)===v.uid&&Date.now()-v.at<OFFLINE_DAYS*864e5}catch{return false}
}

/* ---------- this device's saves, per user ---------- */
const workKeys=()=>{const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(WORK.test(k))out.push(k)}return out};
const hasGame=()=>!!(localStorage.getItem(KEY)||localStorage.getItem(slotKey('1'))||localStorage.getItem(slotKey('2')));
function putAway(uid){for(const k of workKeys()){localStorage.setItem(stash(uid)+k,localStorage.getItem(k));localStorage.removeItem(k)}}
function bringBack(uid){const p=stash(uid),ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(p))ks.push(k)}
 for(const k of ks){localStorage.setItem(k.slice(p.length),localStorage.getItem(k));localStorage.removeItem(k)}}
function legacyName(){try{const v=localStorage.getItem(KEY)||localStorage.getItem(slotKey('1'));const s=v&&!v.startsWith('Z1:')?JSON.parse(v):null;return s?.name||''}catch{return ''}}
/* make the game's local keys belong to this user (asks once about a save made before login; the original is backed up first) */
async function claimDevice(uid){
 const owner=localStorage.getItem(OWNER);
 if(owner===uid)return;
 if(owner){putAway(owner)}
 else if(hasGame()&&!localStorage.getItem(LEGACY)){
  const name=legacyName(),saved=await backup('legacy',null,snapshot(k=>WORK.test(k)));
  if(!saved){card(`<div class="entry-sub">이 기기의 기존 게임을 안전하게 보관하지 못했어요. 저장 공간을 확인한 뒤 다시 시도해 주세요.</div>`);throw new Error('backup')}
  const move=await ask(`이 기기에 로그인 전에 하던 게임이 있어요${name?` (${esc(name)} 판사)`:''}.<br>지금 로그인한 계정으로 옮길까요?<br><small>어느 쪽을 골라도 원래 기록은 이 기기에 따로 보관돼요.</small>`,'이 계정으로 옮기기','옮기지 않기');
  localStorage.setItem(LEGACY,'1');
  if(move){localStorage.setItem(OWNER,uid);for(const s of ['1','2'])localStorage.removeItem(REV(uid,s));return}
  putAway('legacy');
 }else if(!owner)putAway('legacy');
 bringBack(uid);localStorage.setItem(OWNER,uid);
}

/* ---------- cloud copy of the two profile slots, with versions ---------- */
const fp=v=>{if(v==null)return '0';let h=2166136261;const step=Math.max(1,Math.floor(v.length/20000));for(let i=0;i<v.length;i+=step)h=Math.imul(h^v.charCodeAt(i),16777619);return v.length+':'+(h>>>0)};
const activeSlot=()=>localStorage.getItem(ACTIVE)||'1';
const slotValue=s=>s===activeSlot()?(localStorage.getItem(KEY)??localStorage.getItem(slotKey(s))):localStorage.getItem(slotKey(s));
function writeSlot(s,v){localStorage.setItem(slotKey(s),v);if(s===activeSlot())localStorage.setItem(KEY,v)}
const dirty=(uid,s)=>{const v=slotValue(s);return v!=null&&fp(v)!==localStorage.getItem(PUSHED(uid,s))};
const deviceId=()=>{let d=localStorage.getItem(DEVICE);if(!d){const ua=navigator.userAgent;d=(/iPhone/.test(ua)?'iPhone':/iPad/.test(ua)?'iPad':/Android/.test(ua)?'Android':/Mac/.test(ua)?'Mac':/Windows/.test(ua)?'PC':'기기')+'-'+Math.random().toString(36).slice(2,6);localStorage.setItem(DEVICE,d)}return d};
const devName=d=>String(d||'다른 기기').replace(/-\w+$/,'');
/* the player picks when both sides changed; nothing is lost either way */
async function settle(uid,s,row){
 const take=await ask(`프로필 ${s}: 다른 기기(${esc(devName(row.device))})에서 ${new Date(row.updated_at).toLocaleString('ko-KR')}에 이어 한 기록이 있어요.<br>이 기기에도 아직 올리지 않은 기록이 있어요. 어느 쪽으로 이어 할까요?<br><small>고르지 않은 쪽도 지워지지 않고 보관돼요.</small>`,'다른 기기 기록으로 이어 하기','이 기기 기록 유지');
 if(take){await backup('replaced',uid,{[slotKey(s)]:slotValue(s)});await adopt(uid,s,row);return 'cloud'}
 await put(uid,s,true);return 'local';
}
async function adopt(uid,s,row){
 let data=row.data;if(data==null){const r=await rest(`saves?select=data&user_id=eq.${uid}&slot=eq.${s}`);data=(await r.json())?.[0]?.data}
 if(data==null)return;writeSlot(s,data);localStorage.setItem(REV(uid,s),String(row.rev));localStorage.setItem(PUSHED(uid,s),fp(data));
}
async function pull(uid){
 const r=await rest(`saves?select=slot,rev,device,updated_at&user_id=eq.${uid}`);if(!r.ok)return;
 for(const row of await r.json()){const known=Number(localStorage.getItem(REV(uid,row.slot))||0);
  if(Number(row.rev)===known)continue;                              // in step (local changes, if any, go up next)
  if(slotValue(row.slot)==null||!dirty(uid,row.slot)){if(slotValue(row.slot)!=null)await backup('replaced',uid,{[slotKey(row.slot)]:slotValue(row.slot)});await adopt(uid,row.slot,row)}
  else await settle(uid,row.slot,row);
 }
}
let pushing=false,held=new Set();
async function put(uid,s,force=false){
 const v=slotValue(s);if(v==null)return;
 const r=await rest('rpc/save_put',{method:'POST',body:JSON.stringify({p_slot:s,p_data:v,p_base_rev:Number(localStorage.getItem(REV(uid,s))||0),p_game_ver:window.VERDICT_VERSION||'',p_device:deviceId(),p_force:force})});
 if(r.status===401||r.status===403)throw refused('로그인이 만료됐어요. 다시 로그인해 주세요.');
 if(!r.ok)return;
 const row=(await r.json())?.[0];if(!row)return;
 if(row.ok){localStorage.setItem(REV(uid,s),String(row.rev));localStorage.setItem(PUSHED(uid,s),fp(v));held.delete(s);return}
 if(row.conflict){held.add(s);return row}
}
async function push(uid,{ask:askNow=true}={}){
 if(pushing||!online||!session)return;pushing=true;
 try{try{window.VerdictStore?.flush()}catch{}
  for(const s of ['1','2']){if(!dirty(uid,s)||held.has(s)&&!askNow)continue;
   const c=await put(uid,s);
   if(c?.conflict&&askNow){const which=await settle(uid,s,c);if(which==='cloud'){try{window.VerdictStore?.halt()}catch{}location.reload();return}}}
 }catch(e){if(e.refused)signOutNow(e.message)}finally{pushing=false}
}
function sync(uid){setInterval(()=>push(uid),20000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')push(uid,{ask:false})})}

/* ---------- screens ---------- */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function card(html){let box=document.getElementById('verdict-login');if(!box){box=document.createElement('div');box.id='verdict-login';document.body.appendChild(box)}
 box.innerHTML=`<div class="entry-card"><div style="font-size:28px">⚖️</div><div class="entry-title">THE VERDICT</div>${html}</div>`;return box}
const close=()=>document.getElementById('verdict-login')?.remove();
function ask(html,yes,no){return new Promise(res=>{const b=card(`<p class="entry-sub">${html}</p><button class="entry-btn primary" data-a="y">${esc(yes)}</button><button class="entry-btn" data-a="n">${esc(no)}</button>`);
 b.querySelector('[data-a="y"]').onclick=()=>{close();res(true)};b.querySelector('[data-a="n"]').onclick=()=>{close();res(false)}})}
function loginForm(msg=''){
 const b=card(`<div class="entry-sub">초대받은 판사만 들어올 수 있어요.</div>
  <form id="vl-form" autocomplete="on"><label class="vl-label">이메일<input class="vl-input" type="email" name="email" autocomplete="username" required></label>
  <label class="vl-label">비밀번호<input class="vl-input" type="password" name="password" autocomplete="current-password" required></label>
  <p class="vl-msg" role="alert">${esc(msg)}</p><button class="entry-btn primary" type="submit">로그인</button></form>
  <div class="entry-info">계정은 초대로만 만들어져요. 비밀번호를 잊었다면 관리자에게 물어보세요.</div>`);
 const f=b.querySelector('#vl-form');
 f.onsubmit=async e=>{e.preventDefault();const btn=f.querySelector('button');btn.disabled=true;btn.textContent='확인 중…';
  const fail=m=>{keep(null);btn.disabled=false;btn.textContent='로그인';f.querySelector('.vl-msg').textContent=m};
  try{await signIn(f.email.value.trim(),f.password.value);await verify()}           // both must pass, online, now
  catch(err){return fail(err.offline?'서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.':err.message)}
  enter().catch(()=>{})};
}
/* the server refused this account: put its saves away and go back to the login screen */
function signOutNow(msg){
 const uid=session?.user?.id;try{window.VerdictStore?.halt()}catch{}
 if(uid&&localStorage.getItem(OWNER)===uid){putAway(uid);localStorage.removeItem(OWNER)}
 keep(null);localStorage.removeItem(VERIFIED);
 if(booted){sessionStorage.setItem('vauth_msg',msg||'');location.reload()}else loginForm(msg);
}
function offlineBanner(){const d=document.createElement('div');d.id='vl-offline';d.textContent='오프라인으로 하는 중이에요 · 인터넷이 연결되면 계정을 다시 확인하고 기록을 올려요';document.body.appendChild(d);
 addEventListener('online',async()=>{try{await verify();d.remove();const uid=session.user.id;sync(uid);await pull(uid).catch(()=>{});push(uid)}catch(e){if(e.refused)signOutNow(e.message)}})}

/* after the online check (or a permitted offline start): make the device's saves this user's, bring the cloud copy, start */
async function enter(){
 const uid=session.user.id;
 await claimDevice(uid);
 if(online){card('<div class="entry-sub">기록을 불러오는 중…</div>');
  try{await Promise.race([pull(uid),new Promise(r=>setTimeout(r,8000))])}catch(e){if(e.refused)return signOutNow(e.message)}
  close();sync(uid)}
 else{close();offlineBanner()}
 boot();logoutButton();
}
async function logout(){
 const uid=session?.user?.id;if(!uid)return;
 try{window.VerdictStore?.flush()}catch{}
 if(online)await Promise.race([push(uid,{ask:true}),new Promise(r=>setTimeout(r,8000))]);
 if(online&&['1','2'].some(s=>dirty(uid,s))&&!await ask('아직 올리지 못한 기록이 있어요.<br><small>이 기기에는 그대로 남아 있고, 다음에 이 계정으로 로그인하면 올라가요.</small>','그래도 로그아웃','취소'))return;
 try{await fetch(`${CFG.supabaseUrl}/auth/v1/logout`,{method:'POST',headers:H({authorization:`Bearer ${session.access_token}`})})}catch{}
 try{window.VerdictStore?.halt()}catch{}
 putAway(uid);localStorage.removeItem(OWNER);keep(null);location.reload();
}
/* a small sign-out line on the judge's profile screen */
function logoutButton(){
 const add=()=>{const box=document.querySelector('#verdict-entry .entry-card');if(!box||box.querySelector('.vl-out'))return;
  const d=document.createElement('div');d.className='entry-info vl-out';d.innerHTML=`${esc(session?.user?.email||'')}${online?'':' (오프라인)'} · <button type="button" class="vl-link">로그아웃</button>`;
  d.querySelector('button').onclick=logout;box.appendChild(d)};
 new MutationObserver(add).observe(document.body,{childList:true});add();
}

const st=document.createElement('style');st.textContent=`#verdict-login{position:fixed;inset:0;z-index:100000;background:rgba(8,18,30,.98);color:#f6f0e6;display:flex;align-items:center;justify-content:center;padding:20px}
#verdict-login .entry-card{width:min(420px,100%);padding:30px 24px;background:linear-gradient(145deg,#192c40,#253b4d);border:1px solid #987f62;border-radius:22px}
#verdict-login .entry-title{font-size:30px;letter-spacing:2px;font-weight:800;margin:0 0 10px}#verdict-login .entry-sub{color:#c6d1d7;font-size:14px;line-height:1.7;margin-bottom:18px}
#verdict-login .entry-sub small{color:#9fb2bc}
#verdict-login .entry-btn{display:block;width:100%;padding:15px;border-radius:12px;margin:11px 0;border:1px solid #8eabb7;background:#29475e;color:#fff;font-size:16px;font-weight:700}
#verdict-login .entry-btn.primary{background:#b88d58;color:#132032;border-color:#d4ad78}#verdict-login .entry-btn:disabled{opacity:.5}
#verdict-login .entry-info{font-size:12px;color:#b6c5cc;margin-top:14px;line-height:1.7}
.vl-label{display:block;font-size:13px;color:#c6d1d7;margin:10px 0 0}.vl-input{display:block;width:100%;margin-top:6px;padding:13px 12px;border-radius:10px;border:1px solid #6d8796;background:#0f1f2e;color:#fff;font-size:16px;box-sizing:border-box}
.vl-msg{min-height:18px;color:#ffb4a2;font-size:13px;margin:10px 0 0}.vl-link{background:none;border:0;color:#e9c891;text-decoration:underline;font:inherit;padding:0;cursor:pointer}
#vl-offline{position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top,0px) + 6px);z-index:9000;background:#3b3220;color:#f3e2c0;border:1px solid #8a7444;border-radius:10px;padding:6px 10px;font-size:12px;text-align:center}`;
document.head.appendChild(st);

window.VerdictAuth={
 get user(){return local?null:session?.user||null},
 get online(){return online},
 /* call THE VERDICT API (Cloudflare Worker) as the signed-in player; only after this visit's online check */
 async api(path,body,{timeout=15000}={}){
  if(local||!session||!online||!CFG.apiBase)throw new Error('ai_unavailable');
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),timeout);
  try{const r=await fetch(CFG.apiBase+path,{method:body?'POST':'GET',signal:ctl.signal,headers:{authorization:`Bearer ${await token()}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
   if(r.status===401||r.status===403){signOutNow('계정을 다시 확인해야 해요. 다시 로그인해 주세요.');throw new Error('refused')}
   return await r.json()}finally{clearTimeout(t)}
 },
 logout
};

if(local){boot();return}
if(!CFG.supabaseUrl||!CFG.supabaseAnonKey){card('<div class="entry-sub">로그인 서버 설정이 아직 없어요. config.js에 Supabase 주소와 공개 키를 넣어 주세요.</div>');return}
const shown=sessionStorage.getItem('vauth_msg');sessionStorage.removeItem('vauth_msg');
if(session?.refresh_token){
 card('<div class="entry-sub">로그인 확인 중…</div>');
 (async()=>{
  try{await token();await verify()}
  catch(e){
   if(e.refused)return signOutNow(e.message);
   if(!offlineAllowed())return loginForm('서버에 연결하지 못했어요. 인터넷에 연결한 뒤 다시 로그인해 주세요.');
  }
  enter().catch(()=>{});
 })();
}else loginForm(shown||'');
})();
