/* THE VERDICT v2.1 — nonintrusive saves with IndexedDB recovery snapshots */
'use strict';
(()=>{
const DB='the-verdict-saves',STORE='snapshots',KEY='the_verdict_alpha_1',PREFIX='verdict_player_save_',ACTIVE='verdict_player_active';
const who=()=>localStorage.getItem(ACTIVE)||'1';
let dbPromise=null,writing=Promise.resolve(),lastOkay=null;
function openDB(){if(!('indexedDB'in window))return Promise.reject(Error('IndexedDB unsupported'));
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});return dbPromise;}
async function records(id){const db=await openDB();return new Promise((res,rej)=>{const t=db.transaction(STORE,'readonly');const q=t.objectStore(STORE).getAll();q.onsuccess=()=>res(q.result.filter(x=>x.player===id).sort((a,b)=>b.time-a.time));q.onerror=()=>rej(q.error)});}
async function put(data,id){const db=await openDB();const previous=await records(id);return new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE),ts=Date.now();s.put({id:id+'-'+ts,player:id,time:ts,data});for(const x of previous.slice(2))s.delete(x.id);tx.oncomplete=()=>res(ts);tx.onerror=()=>rej(tx.error)})}
function valid(raw){try{const o=JSON.parse(raw);return [1,2,3,4,5].includes(Number(o.version))&&o.cases&&o.market&&Array.isArray(o.journal)}catch{return false}}
function status(s){lastOkay=s;const el=document.getElementById('verdict-save-status');if(el)el.textContent=s}
function snapshot(){const data=localStorage.getItem(KEY);if(!data||!valid(data))return Promise.reject(Error('invalid save'));
 const id=who();localStorage.setItem(PREFIX+id,data);
 writing=writing.catch(()=>{}).then(()=>put(data,id)).then(ts=>{status('저장 완료 · '+new Date(ts).toLocaleTimeString('ko-KR'));return ts}).catch(e=>{status('저장 확인 실패 · 백업 권장');throw e});return writing;}
const previousSave=save;
let lastBackup=0;
save=function(){previousSave();const now=Date.now();if(now-lastBackup>60000){lastBackup=now;snapshot().catch(e=>console.warn('Snapshot:',e))}};
function uiPanel(){
 const parent=document.querySelector('.quick-top');if(!parent||parent.querySelector('[data-action="safeSave"]'))return;
 const button=document.createElement('button');button.className='btn outline mini';button.dataset.action='safeSave';button.textContent='💾 저장';
 const flag=document.createElement('span');flag.id='verdict-save-status';flag.className='small muted';flag.textContent=lastOkay||'자동 저장 사용 중';
 parent.prepend(flag);parent.prepend(button);
}
const baseRender=render;render=function(){baseRender();uiPanel()};
const click=clicker;
clicker=function(e){const b=e.target.closest('[data-action]');if(!b)return;
 if(b.dataset.action==='safeSave'){status('저장 중…');snapshot().catch(()=>toast('저장에 실패했습니다. 저장 관리에서 백업을 확인하세요.'));return;}
 if(b.dataset.action==='saveRecovery'){recovery().catch(()=>toast('복구할 수 있는 기록이 없습니다.'));return;}
 if(b.dataset.action==='advancedBackup'){ui.tabletTab='backup';changeTab('tablet');return;}
 return click(e);
};
async function recovery(){const xs=await records(who()),good=xs.find(x=>valid(x.data));if(!good)throw Error('no valid snapshot');if(!confirm('최근 정상 저장본으로 복구할까요? 현재 진행 상황을 덮어씁니다.'))return;localStorage.setItem(KEY,good.data);localStorage.setItem(PREFIX+who(),good.data);location.reload();}
const prevTablet=tabletInner;
tabletInner=function(){if(ui.tabletTab!=='backup')return prevTablet();
 return '<h2>💾 저장 관리</h2><p class="muted">판결과 사건 진행은 자동으로 저장됩니다. 기기 내 최근 정상 저장본을 보관합니다.</p><div class="save-buttons"><button class="btn primary" data-action="safeSave">지금 저장</button><button class="btn outline" data-action="saveRecovery">최근 저장 복구</button></div><details class="mt"><summary>고급 백업 · 기기 간 파일 이동</summary><div class="save-buttons"><button class="btn outline" data-action="export">백업 파일 내보내기</button><button class="btn outline" data-action="import">파일에서 불러오기</button></div><input id="importFile" type="file" accept="application/json,.json" class="hidden"><p class="muted small">파일은 직접 보관해야 합니다. 온라인 계정 동기화는 아직 지원하지 않습니다.</p></details>';
};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&S.name)snapshot().catch(()=>{})});
document.addEventListener('DOMContentLoaded',()=>{if(S.name){snapshot().catch(()=>{});uiPanel();}});
})();