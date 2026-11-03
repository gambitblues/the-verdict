/* THE VERDICT — private login (Supabase Auth) in front of the judge's profile screen.
 *
 * - Only invited players sign in with email and password; there is no sign-up here (sign-up is also switched off in
 *   Supabase, and the server keeps its own invite list).
 * - The session stays on this device (refresh token) until the player logs out.
 * - Each Supabase user has their own careers: the game's local save keys are swapped per user on this device and
 *   copied to the `saves` table, so the same account continues on another device.
 * - A save made before login can be moved once into the first account that signs in here.
 * - The game itself is unchanged: it starts only after sign-in, reading the same local keys it always has.
 *   On a local test server (localhost / 127.0.0.1, without ?auth=1) the gate is skipped so the test suite runs as before.
 */
(()=>{
'use strict';
const CFG=window.VERDICT_CONFIG||{};
const GAME=['./names.js','./deep_case_engine.js','./story_engine.js','./case_pack_engine.js','./curated_index.js','./continuity_engine.js','./npc_life_justice.js','./family_engine.js','./save_store.js','./court_visuals.js','./career_balance.js','./avatar_system.js','./game_runtime.js','./game_hearings.js','./game_professions.js','./game_ui.js','./trial_core.js','./hearing_events.js','./media_desk.js','./match_engine.js','./world_sheets_index.js','./match_play.js','./trial_play.js','./world_feed.js','./people_map.js','./v6_world.js','./ai_bridge.js','./app_install.js'];
const SESSION='vauth_session',OWNER='vauth_owner',LEGACY='vauth_legacy_done',MOD=(u,s)=>`vauth_mod:${u}:${s}`,PUSHED=(u,s)=>`vauth_fp:${u}:${s}`;
const KEY='the_verdict_alpha_1',ACTIVE='verdict_player_active',slotKey=id=>'verdict_player_save_'+id;
const WORK=/^(the_verdict|verdict_)/;   // every key the game owns (the game's own wipe uses the same pattern)
const stash=uid=>`vu:${uid}:`;
const local=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)&&!/[?&]auth=1\b/.test(location.search);

/* ---------- start the game exactly as the old page did ---------- */
function profiles(){   // was the inline bootstrap in index.html: the active profile's save goes to the main key
 const active=localStorage.getItem(ACTIVE)||'1',main=localStorage.getItem(KEY);
 if(!localStorage.getItem(ACTIVE)){if(main)localStorage.setItem(slotKey('1'),main);localStorage.setItem(ACTIVE,'1')}
 else if(main&&!localStorage.getItem(slotKey(active)))localStorage.setItem(slotKey(active),main);
 const saved=localStorage.getItem(slotKey(active));if(saved!==null)localStorage.setItem(KEY,saved);else localStorage.removeItem(KEY);
}
/* The game files expect to run during page load (several wait for DOMContentLoaded). They are added here in order and
 * see a page that is still loading; when the last one has run, DOMContentLoaded fires for them as it used to. */
function boot(){
 profiles();
 try{Object.defineProperty(document,'readyState',{configurable:true,get:()=>'loading'})}catch{}
 let i=0;const next=()=>{if(i>=GAME.length){try{delete document.readyState}catch{}document.dispatchEvent(new Event('DOMContentLoaded'));return}
  const s=document.createElement('script');s.src=GAME[i++];s.async=false;s.onload=next;s.onerror=()=>{console.warn('script failed',s.src);next()};document.body.appendChild(s)};
 next();
}

/* ---------- Supabase Auth over plain fetch (no library: the app also runs offline as a PWA) ---------- */
const H=extra=>({apikey:CFG.supabaseAnonKey,'content-type':'application/json',...extra});
let session=null;try{session=JSON.parse(localStorage.getItem(SESSION)||'null')}catch{}
const keep=s=>{session=s?{access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600),user:{id:s.user?.id,email:s.user?.email}}:null;
 if(session)localStorage.setItem(SESSION,JSON.stringify(session));else localStorage.removeItem(SESSION)};
async function signIn(email,password){
 const r=await fetch(`${CFG.supabaseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:H(),body:JSON.stringify({email,password})});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error_description||d.msg||'로그인하지 못했어요');keep(d);return session;
}
async function refresh(){
 const r=await fetch(`${CFG.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:H(),body:JSON.stringify({refresh_token:session.refresh_token})});
 const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error('expired');e.auth=true;throw e}keep(d);return session;
}
async function token(){
 if(!session)throw new Error('not signed in');
 if(session.expires_at-60<Date.now()/1000)await refresh();
 return session.access_token;
}
const rest=async(path,opt={})=>fetch(`${CFG.supabaseUrl}/rest/v1/${path}`,{...opt,headers:H({authorization:`Bearer ${await token()}`,...(opt.headers||{})})});

/* ---------- this device's saves, per user ---------- */
const workKeys=()=>{const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(WORK.test(k))out.push(k)}return out};
const hasGame=()=>!!(localStorage.getItem(KEY)||localStorage.getItem(slotKey('1'))||localStorage.getItem(slotKey('2')));
function putAway(uid){for(const k of workKeys()){localStorage.setItem(stash(uid)+k,localStorage.getItem(k));localStorage.removeItem(k)}}
function bringBack(uid){const p=stash(uid),ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(p))ks.push(k)}
 for(const k of ks){localStorage.setItem(k.slice(p.length),localStorage.getItem(k));localStorage.removeItem(k)}}
function legacyName(){try{const v=localStorage.getItem(KEY)||localStorage.getItem(slotKey('1'));const s=v&&!v.startsWith('Z1:')?JSON.parse(v):null;return s?.name||''}catch{return ''}}
/* make the game's local keys belong to this user (asks once about a save made before login) */
async function claimDevice(uid){
 const owner=localStorage.getItem(OWNER);
 if(owner===uid)return;
 if(owner){putAway(owner)}
 else if(hasGame()&&!localStorage.getItem(LEGACY)){
  const name=legacyName();
  const move=await ask(`이 기기에 로그인 전에 하던 게임이 있어요${name?` (${esc(name)} 판사)`:''}.<br>지금 로그인한 계정으로 옮길까요?`,'이 계정으로 옮기기','옮기지 않기');
  localStorage.setItem(LEGACY,'1');
  if(move){localStorage.setItem(OWNER,uid);for(const s of ['1','2'])localStorage.setItem(MOD(uid,s),String(Date.now()));return}
  putAway('legacy');
 }else if(!owner)putAway('legacy');
 bringBack(uid);localStorage.setItem(OWNER,uid);
}

/* ---------- cloud copy of the two profile slots ---------- */
const fp=v=>{if(v==null)return '0';let h=2166136261;const step=Math.max(1,Math.floor(v.length/20000));for(let i=0;i<v.length;i+=step)h=Math.imul(h^v.charCodeAt(i),16777619);return v.length+':'+(h>>>0)};
const slotValue=s=>s===(localStorage.getItem(ACTIVE)||'1')?(localStorage.getItem(KEY)??localStorage.getItem(slotKey(s))):localStorage.getItem(slotKey(s));
async function pull(uid){
 const r=await rest(`saves?select=slot,data,updated_at&user_id=eq.${uid}`);if(!r.ok)return;
 for(const row of await r.json()){const t=Date.parse(row.updated_at)||0,mine=Number(localStorage.getItem(MOD(uid,row.slot))||0);
  if(t>mine+1000){localStorage.setItem(slotKey(row.slot),row.data);if(row.slot===(localStorage.getItem(ACTIVE)||'1'))localStorage.setItem(KEY,row.data);
   localStorage.setItem(MOD(uid,row.slot),String(t));localStorage.setItem(PUSHED(uid,row.slot),fp(row.data))}}
}
let pushing=false;
async function push(uid){
 if(pushing||!session||!navigator.onLine)return;pushing=true;
 try{try{window.VerdictStore?.flush()}catch{}
  for(const s of ['1','2']){const v=slotValue(s);if(v==null)continue;const f=fp(v);if(f===localStorage.getItem(PUSHED(uid,s)))continue;
   const now=new Date().toISOString();
   const r=await rest('saves',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:uid,slot:s,data:v,game_ver:window.VERDICT_VERSION||'',updated_at:now})});
   if(r.ok){localStorage.setItem(PUSHED(uid,s),f);localStorage.setItem(MOD(uid,s),String(Date.parse(now)))}}
 }catch(e){if(e.auth)expired()}finally{pushing=false}
}
function sync(uid){setInterval(()=>push(uid),20000);addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')push(uid)})}

/* ---------- screens ---------- */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function card(html){let box=document.getElementById('verdict-login');if(!box){box=document.createElement('div');box.id='verdict-login';document.body.appendChild(box)}
 box.innerHTML=`<div class="entry-card"><div style="font-size:28px">⚖️</div><div class="entry-title">THE VERDICT</div>${html}</div>`;return box}
const close=()=>document.getElementById('verdict-login')?.remove();
function ask(html,yes,no){return new Promise(res=>{const b=card(`<p class="entry-sub">${html}</p><button class="entry-btn primary" data-a="y">${esc(yes)}</button><button class="entry-btn" data-a="n">${esc(no)}</button>`);
 b.querySelector('[data-a="y"]').onclick=()=>res(true);b.querySelector('[data-a="n"]').onclick=()=>res(false)})}
function loginForm(msg=''){
 const b=card(`<div class="entry-sub">초대받은 판사만 들어올 수 있어요.</div>
  <form id="vl-form" autocomplete="on"><label class="vl-label">이메일<input class="vl-input" type="email" name="email" autocomplete="username" required></label>
  <label class="vl-label">비밀번호<input class="vl-input" type="password" name="password" autocomplete="current-password" required></label>
  <p class="vl-msg" role="alert">${esc(msg)}</p><button class="entry-btn primary" type="submit">로그인</button></form>
  <div class="entry-info">계정은 초대로만 만들어져요. 비밀번호를 잊었다면 관리자에게 물어보세요.</div>`);
 const f=b.querySelector('#vl-form');
 f.onsubmit=async e=>{e.preventDefault();const btn=f.querySelector('button');btn.disabled=true;btn.textContent='확인 중…';
  try{await signIn(f.email.value.trim(),f.password.value);await enter()}
  catch(err){btn.disabled=false;btn.textContent='로그인';f.querySelector('.vl-msg').textContent=/invalid/i.test(err.message)?'이메일이나 비밀번호가 맞지 않아요.':err.message}};
}
function expired(){keep(null);loginForm('로그인이 만료됐어요. 다시 로그인해 주세요.')}

/* after sign-in: check the invite, make the device's saves this user's, bring the cloud copy, start the game */
async function enter(){
 const uid=session.user.id;
 try{const r=await rest('rpc/claim_player',{method:'POST',body:'{}'});if(r.ok&&(await r.json())===false){keep(null);return loginForm('초대된 계정이 아니에요.')}}
 catch(e){if(e.auth)return expired()}   // offline: carry on with the session this device already had
 await claimDevice(uid);
 card('<div class="entry-sub">기록을 불러오는 중…</div>');
 await Promise.race([pull(uid).catch(()=>{}),new Promise(r=>setTimeout(r,6000))]);
 close();boot();sync(uid);logoutButton();
}
async function logout(){
 const uid=session?.user?.id;if(!uid)return;
 try{window.VerdictStore?.flush()}catch{}
 await Promise.race([push(uid),new Promise(r=>setTimeout(r,5000))]);
 try{await fetch(`${CFG.supabaseUrl}/auth/v1/logout`,{method:'POST',headers:H({authorization:`Bearer ${session.access_token}`})})}catch{}
 try{window.VerdictStore?.halt()}catch{}
 putAway(uid);localStorage.removeItem(OWNER);keep(null);location.reload();
}
/* a small sign-out line on the judge's profile screen */
function logoutButton(){
 const add=()=>{const box=document.querySelector('#verdict-entry .entry-card');if(!box||box.querySelector('.vl-out'))return;
  const d=document.createElement('div');d.className='entry-info vl-out';d.innerHTML=`${esc(session?.user?.email||'')} · <button type="button" class="vl-link">로그아웃</button>`;
  d.querySelector('button').onclick=logout;box.appendChild(d)};
 new MutationObserver(add).observe(document.body,{childList:true});add();
}

const st=document.createElement('style');st.textContent=`#verdict-login{position:fixed;inset:0;z-index:100000;background:rgba(8,18,30,.98);color:#f6f0e6;display:flex;align-items:center;justify-content:center;padding:20px}
#verdict-login .entry-card{width:min(420px,100%);padding:30px 24px;background:linear-gradient(145deg,#192c40,#253b4d);border:1px solid #987f62;border-radius:22px}
#verdict-login .entry-title{font-size:30px;letter-spacing:2px;font-weight:800;margin:0 0 10px}#verdict-login .entry-sub{color:#c6d1d7;font-size:14px;line-height:1.7;margin-bottom:18px}
#verdict-login .entry-btn{display:block;width:100%;padding:15px;border-radius:12px;margin:11px 0;border:1px solid #8eabb7;background:#29475e;color:#fff;font-size:16px;font-weight:700}
#verdict-login .entry-btn.primary{background:#b88d58;color:#132032;border-color:#d4ad78}#verdict-login .entry-btn:disabled{opacity:.5}
#verdict-login .entry-info{font-size:12px;color:#b6c5cc;margin-top:14px;line-height:1.7}
.vl-label{display:block;font-size:13px;color:#c6d1d7;margin:10px 0 0}.vl-input{display:block;width:100%;margin-top:6px;padding:13px 12px;border-radius:10px;border:1px solid #6d8796;background:#0f1f2e;color:#fff;font-size:16px;box-sizing:border-box}
.vl-msg{min-height:18px;color:#ffb4a2;font-size:13px;margin:10px 0 0}.vl-link{background:none;border:0;color:#e9c891;text-decoration:underline;font:inherit;padding:0;cursor:pointer}`;
document.head.appendChild(st);

window.VerdictAuth={
 get user(){return local?null:session?.user||null},
 /* call THE VERDICT API (Cloudflare Worker) as the signed-in player */
 async api(path,body,{timeout=12000}={}){
  if(local||!session||!CFG.apiBase)throw new Error('ai_unavailable');
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),timeout);
  try{const r=await fetch(CFG.apiBase+path,{method:body?'POST':'GET',signal:ctl.signal,headers:{authorization:`Bearer ${await token()}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
   return await r.json()}finally{clearTimeout(t)}
 },
 logout
};

if(local){boot();return}
if(!CFG.supabaseUrl||!CFG.supabaseAnonKey){card('<div class="entry-sub">로그인 서버 설정이 아직 없어요. config.js에 Supabase 주소와 공개 키를 넣어 주세요.</div>');return}
if(session?.refresh_token){
 card('<div class="entry-sub">로그인 확인 중…</div>');
 (async()=>{try{await token()}catch(e){if(e.auth)return expired()}enter()})();   // offline with a saved session: play on this device
}else loginForm();
})();
