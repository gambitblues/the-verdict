/* THE VERDICT multi-profile launcher, device-local until cloud backend configured */
'use strict';
(()=>{
const KEY='the_verdict_alpha_1',ACTIVE='verdict_player_active',slot=id=>'verdict_player_save_'+id;
const selected=()=>localStorage.getItem(ACTIVE)||'1';
const backup=()=>{const main=localStorage.getItem(KEY);if(main)localStorage.setItem(slot(selected()),main);else localStorage.removeItem(slot(selected()));};
function profileName(id){try{const s=JSON.parse(localStorage.getItem(slot(id))||'null');return s?.name||'저장된 게임 없음';}catch{return '저장 파일 확인 필요';}}
function change(id){if(!['1','2'].includes(id))return;backup();localStorage.setItem(ACTIVE,id);const v=localStorage.getItem(slot(id));if(v)localStorage.setItem(KEY,v);else localStorage.removeItem(KEY);location.reload();}
const originalSave=save;
save=function(){originalSave();backup()};
const originalClick=clicker;
clicker=function(e){const action=e.target.closest('[data-action]')?.dataset.action;if(action==='resetConfirm'){localStorage.removeItem(slot(selected()));}originalClick(e);};
function show(){
if(document.getElementById('verdict-entry'))document.getElementById('verdict-entry').remove();
backup();
const id=selected(),has=!!S.name;
const box=document.createElement('div');box.id='verdict-entry';
box.innerHTML='<div class="entry-card"><div style="font-size:28px">⚖️</div><div class="entry-title">THE VERDICT</div><div class="entry-sub">40년 법관 커리어 · 플레이어별 독립된 세계관</div><div class="entry-switch"><button type="button" data-profile="1" class="entry-btn '+(id==='1'?'primary':'')+'">플레이어 1<small>'+escapeHtml(profileName('1'))+'</small></button><button type="button" data-profile="2" class="entry-btn '+(id==='2'?'primary':'')+'">플레이어 2<small>'+escapeHtml(profileName('2'))+'</small></button></div><button class="entry-btn primary" id="profile-continue">'+(has?'이어서 하기':'새 커리어 시작')+'</button><button class="entry-btn" id="profile-reset">이 슬롯에서 새 게임</button><button class="entry-btn" id="profile-import">저장 파일 불러오기 (JSON)</button><div class="entry-info">현재: 플레이어 '+id+' · 이 기기에만 저장됨<br>다른 기기와 동기화하려면 별도의 클라우드 로그인이 필요해요.</div></div>';
document.body.appendChild(box);
const scene=document.createElement('div');scene.className='verdict-brand-scene';scene.setAttribute('aria-label','일러스트 법정과 판사');scene.innerHTML='<span class="scene-flag">🇰🇷</span><span class="scene-seal">⚖</span><span class="scene-judge">👨🏻‍⚖️</span><span class="scene-bench"></span><span class="scene-caption">THE VERDICT · JUDICIAL LIFE</span>';const subtitle=box.querySelector('.entry-sub');if(subtitle)subtitle.insertAdjacentElement('afterend',scene);
box.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>change(b.dataset.profile));
box.querySelector('#profile-continue').onclick=()=>box.remove();
box.querySelector('#profile-reset').onclick=()=>{if(has&&!confirm('플레이어 '+id+'의 저장 기록을 삭제하고 새로 시작할까요? 먼저 백업을 권장합니다.'))return;localStorage.removeItem(slot(id));localStorage.removeItem(KEY);location.reload();};
box.querySelector('#profile-import').onclick=()=>{box.remove();const inp=document.getElementById('importFile');if(inp)inp.click();else {ui.tabletTab='backup';changeTab('tablet');document.getElementById('importFile')?.click();}};
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const st=document.createElement('style');st.textContent='.entry-switch{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:14px 0 22px}.entry-switch .entry-btn{margin:0;padding:13px 5px}.entry-switch small{display:block;opacity:.8;font-size:11px;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';document.head.appendChild(st);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show);else show();
})();