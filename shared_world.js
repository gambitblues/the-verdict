/* P4 shared chronology: public facts only. Does not touch S, NPC, save files or hidden truths.
 * Load after auth_gate.js has installed VerdictAuth. Local/offline stays single-player.
 */
(()=>{'use strict';
const LIMIT=50;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let events=[],cursor=0,loading=false,owner='',panel=null,button=null,clock=null,npcs=[];
const seen=new Set();
function user(){const a=window.VerdictAuth;return a?.online&&a?.user?.id?a.user.id:null}
function reset(next){owner=next;events=[];cursor=0;clock=null;npcs=[];seen.clear();render()}
function valid(ev){
 return ev&&Number.isSafeInteger(ev.event_id)&&ev.event_id>0&&
  typeof ev.event_key==='string'&&typeof ev.event_type==='string'&&
  Number.isInteger(ev.game_day)&&ev.game_day>=0&&
  ev.public_data&&typeof ev.public_data==='object'&&!Array.isArray(ev.public_data);
}
function text(ev){
 const d=ev.public_data,kind={
  incident_reported:'사건 발생',investigation_opened:'수사 개시',indictment_filed:'기소',
  case_assigned:'사건 배당',hearing_opened:'공판',judgment_published:'판결',
  appeal_reported:'항소',aftermath_published:'후속 소식',npc_public_update:'인물 소식'
 }[ev.event_type]||'공개 기록';
 return {kind,title:String(d.title||d.eventLabel||kind),summary:String(d.summary||d.judgment||''),
  gameDay:ev.game_day,caseId:String(ev.case_id||d.publicCaseId||''),key:ev.event_key};
}
function render(){
 if(!panel)return;
 const list=panel.querySelector('[data-world-list]');if(!list)return;
 const meta=panel.querySelector('[data-world-clock]');if(meta)meta.textContent=clock?'공통 세계 날짜: 게임 '+clock.game_day+'일 (동기화 버전 '+clock.version+')':'공통 세계 날짜: 서버 확인 전';
 const people=panel.querySelector('[data-world-npcs]');if(people)people.innerHTML=npcs.length?'<strong>세계 공통 인물 '+npcs.length+'명</strong>'+npcs.slice(0,25).map(n=>'<p>'+esc(n.public_profile?.name||n.npc_id)+' · '+esc(n.public_profile?.profession||n.public_profile?.publicRole||'')+' · '+esc(n.life_status==='dead'?'사망':n.life_status==='alive'?'생존':'상태 미상')+'</p>').join(''):'';
 if(!events.length){list.innerHTML='<p class="vsw-empty">아직 공개된 세계 연혁이 없습니다.</p>';return}
 list.innerHTML=events.slice(-120).reverse().map(e=>{
  const x=text(e);
  return `<article class="vsw-event"><small>게임 ${x.gameDay}일 · ${esc(x.kind)} · ${esc(x.caseId)}</small><strong>${esc(x.title)}</strong>${x.summary?`<p>${esc(x.summary)}</p>`:''}</article>`
 }).join('');
}
async function refresh(){
 const u=user();if(!u){if(owner)reset('');return false}
 if(owner!==u)reset(u);
 if(loading)return false;
 loading=true;
 try{
  let count=0;
  for(let page=0;page<10;page++){
   const result=await window.VerdictAuth.api('/world/events?after='+cursor,undefined,{timeout:10000});
   if(!result?.ok||!Array.isArray(result.events))throw new Error('world_unavailable');
   for(const e of result.events){
    if(!valid(e)||e.event_id<=cursor)continue;
    if(!seen.has(e.event_key)){seen.add(e.event_key);events.push(e);count++}
    cursor=e.event_id;
   }
   if(result.events.length<LIMIT)break;
  }
  if(events.length>500){events=events.slice(-500);seen.clear();for(const e of events)seen.add(e.event_key)}
  // Missing P4 tables on older QA deployments must not break local trials or the public log.
  try{const c=await window.VerdictAuth.api('/world/clock',undefined,{timeout:8000});if(c?.ok&&c.clock)clock=c.clock}catch{}
  try{const n=await window.VerdictAuth.api('/world/npcs',undefined,{timeout:8000});if(n?.ok&&Array.isArray(n.npcs))npcs=n.npcs.slice(0,50)}catch{}
  if(panel){panel.querySelector('[data-world-status]').textContent='공개 기록 '+events.length+'건';render()}
  return true;
 }catch(e){if(panel)panel.querySelector('[data-world-status]').textContent='세계 연결을 확인할 수 없습니다. 개인 재판은 계속할 수 있습니다.';return false}
 finally{loading=false}
}
function toggle(){if(!panel)return;const visible=panel.hidden;panel.hidden=!visible;if(visible)refresh()}
function mount(){
 if(document.querySelector('#verdict-shared-world'))return;
 const root=document.createElement('div');root.id='verdict-shared-world';root.innerHTML=
 `<button type="button" class="vsw-button" aria-label="공유 세계 연혁 열기" aria-expanded="false">🌐 공유 세계</button>
 <section class="vsw-panel" aria-label="공유 세계 공개 연혁" hidden>
  <header><strong>공유 세계</strong><button type="button" data-world-close aria-label="닫기">닫기</button></header>
  <p class="vsw-note">두 판사가 함께 보는 공개 사건·판결 연혁입니다. 개인 관계와 숨은 진실은 표시되지 않습니다.</p>
  <p data-world-status aria-live="polite">연결 확인 중</p>
  <p data-world-clock></p>
  <div data-world-list></div>
  <div data-world-npcs></div>
  <button type="button" data-world-refresh>새로고침</button>
 </section>`;
 document.body.appendChild(root);button=root.querySelector('.vsw-button');panel=root.querySelector('.vsw-panel');
 const set=()=>{toggle();button.setAttribute('aria-expanded',String(!panel.hidden))};
 button.onclick=set;root.querySelector('[data-world-close]').onclick=set;
 root.querySelector('[data-world-refresh]').onclick=()=>refresh();
 const style=document.createElement('style');style.textContent=
 '#verdict-shared-world{position:fixed;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 80px);z-index:7500;font:inherit}' +
 '.vsw-button{padding:9px 13px;border-radius:22px;background:#182e42;color:#fff;border:1px solid #a8926c;box-shadow:0 2px 12px #0004;cursor:pointer}' +
 '.vsw-panel{position:absolute;right:0;bottom:48px;width:min(390px,calc(100vw - 24px));max-height:min(70vh,600px);overflow:auto;padding:15px;border-radius:14px;box-sizing:border-box;background:#f6f5f0;color:#1b2a36;border:1px solid #b6a58a;box-shadow:0 8px 30px #0005}' +
 '.vsw-panel[hidden]{display:none}.vsw-panel header{display:flex;justify-content:space-between;align-items:center}.vsw-panel button{cursor:pointer}.vsw-note{font-size:12px;line-height:1.5;color:#5e6972}' +
 '.vsw-panel [data-world-status]{font-size:12px}.vsw-event{padding:10px 0;border-top:1px solid #d6d3ca}.vsw-event small{display:block;color:#65737d}.vsw-event strong{display:block;margin:4px 0}.vsw-event p{margin:4px 0;font-size:13px;line-height:1.5}';
 document.head.appendChild(style);
}
function start(){
 if(!user())return;
 mount();refresh();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 addEventListener('online',()=>refresh());
 setInterval(()=>{if(!document.hidden)refresh()},60000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.VerdictSharedWorld={refresh,get events(){return events.map(x=>({...x,public_data:{...x.public_data}}))},get cursor(){return cursor},get clock(){return clock?{...clock}:null},get npcs(){return npcs.map(n=>({...n,public_profile:{...n.public_profile}}))}};
})();
