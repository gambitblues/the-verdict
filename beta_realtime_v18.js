/* THE VERDICT v1.8 — offline real-time docket and case offers */
'use strict';
(()=>{
const DAY=86400000,HOUR=3600000,START_H=10,END_H=21,MAX_ACCEPT=4,MAX_ACTIVE=12;
const dateKey=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const esc=v=>h(String(v??''));
function initClock(){
 if(!S.name)return null;
 if(!S.realtimeInbox){S.realtimeInbox={enabled:true,startedAt:Date.now(),lastSync:Date.now(),dayProgress:0,offers:[],acceptedByDay:{},otherCourt:[],processedSlots:{}};save();}
 return S.realtimeInbox;
}
function candidates(){return CasePackEngine.pool(S)}
function choosePreview(slot){
 const pool=candidates();if(!pool.length)return {title:'사실관계 조사 사건',tag:'일반 사건',id:null};
 let hash=2166136261;for(const ch of String(slot))hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
 const a=pool[hash%pool.length];return {title:a.a.title,tag:a.a.tag,archetypeId:a.a.id,packId:a.pack.packId};
}
function sync(){
 const db=initClock();if(!db)return;
 const now=Date.now(),last=Math.max(db.startedAt,Math.min(now,db.lastSync||now));
 const elapsed=now-last;
 // Three actual hours correspond to one game day; simulation is applied in weeks.
 db.dayProgress=(db.dayProgress||0)+elapsed/(3*HOUR);
 let weeks=Math.min(104,Math.floor(db.dayProgress/7));
 db.dayProgress-=weeks*7;
 for(let i=0;i<weeks&&!S.ended;i++)advanceWeek(true);
 // Generate offers for up to the last 7 calendar days; older offers are summarized as reassigned.
 const since=Math.max(last,now-7*DAY);
 const cursor=new Date(since);cursor.setMinutes(0,0,0);
 let transferred=0;
 for(let t=cursor.getTime();t<=now;t+=HOUR){
   const d=new Date(t),hour=d.getHours();if(hour<START_H||hour>END_H)continue;
   const slot=dateKey(t)+'T'+String(hour).padStart(2,'0'),day=dateKey(t);
   if(db.processedSlots[slot])continue;db.processedSlots[slot]=true;
   const info=choosePreview(slot),deadline=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1,10).getTime();
   const entry={slot,day,created:t,expires:deadline,status:deadline<=now?'transferred':'available',...info};
   if(entry.status==='available')db.offers.push(entry);
   else {transferred++;db.otherCourt.push({slot,title:entry.title,day});}
 }
 for(const o of db.offers){if(o.status==='available'&&now>=o.expires){o.status='transferred';transferred++;db.otherCourt.push({slot:o.slot,title:o.title,day:o.day});}}
 db.offers=db.offers.filter(o=>o.status==='available'||o.status==='accepted').slice(-180);
 db.otherCourt=db.otherCourt.slice(-300);
 const slots=Object.keys(db.processedSlots);if(slots.length>400){const keep=new Set(slots.slice(-250));for(const k of slots)if(!keep.has(k))delete db.processedSlots[k];}
 if(transferred){news('다른 재판부 배당 · '+transferred+'건', '배당 수락 기한이 지난 사건 '+transferred+'건이 다른 재판부로 이관되었습니다. 사건 결과는 추후 법원 뉴스로 확인할 수 있습니다.');}
 db.lastSync=now;save();
}
const baseHome=home;
function inbox(){
 const db=S.realtimeInbox;if(!db?.enabled)return '';
 const now=Date.now(),today=dateKey(now),used=db.acceptedByDay[today]||0;
 const pending=db.offers.filter(o=>o.status==='available'&&o.expires>now).sort((a,b)=>b.created-a.created);
 const active=openCases().length;
 return '<section class="panel realtime-docket"><div class="row between"><h3>📨 오늘의 사건 배당함</h3><span class="chip">'+used+'/'+MAX_ACCEPT+'건 수락</span></div><p class="muted small">매일 10:00~22:00, 정각마다 새 사건 제안. 하루 최대 4건 · 진행 사건 최대 12건 · 다음 날 10:00 미수락 자동 이관.</p><p class="muted small">진행 중 '+active+'/'+MAX_ACTIVE+'건 · 현재 선택 가능 '+pending.length+'건 · 다른 재판부 이관 기록 '+db.otherCourt.length+'건</p>'+
 (pending.length?pending.slice(0,12).map(o=>'<article class="docket-entry"><div><strong>'+esc(o.title)+'</strong><small>'+esc(o.tag)+' · 접수 '+new Date(o.created).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+'</small></div><button class="btn primary mini" data-action="acceptDocket" data-slot="'+esc(o.slot)+'" '+(used>=MAX_ACCEPT||active>=MAX_ACTIVE?'disabled':'')+'>수락</button></article>').join(''):'<p class="muted small">현재 수락 가능한 제안이 없습니다. 다음 업무시간에 새 사건이 도착합니다.</p>')+
 (db.otherCourt.length?'<details><summary>📰 다른 재판부 이관 사건</summary>'+db.otherCourt.slice(-8).reverse().map(o=>'<p class="small">'+esc(o.day)+' · '+esc(o.title)+'</p>').join('')+'</details>':'')+'</section>';
}
home=function(){return inbox()+baseHome()};
const baseClick=clicker;
clicker=function(e){const b=e.target.closest('[data-action]');if(!b)return;
 if(b.dataset.action==='acceptDocket'){
   sync();const db=S.realtimeInbox,o=db.offers.find(x=>x.slot===b.dataset.slot);
   const today=dateKey(Date.now());if(!o||o.status!=='available'||Date.now()>=o.expires)return toast('이관되었거나 수락할 수 없는 사건입니다.');
   if((db.acceptedByDay[today]||0)>=MAX_ACCEPT)return toast('오늘의 배당 수락은 4건까지입니다.');
   if(openCases().length>=MAX_ACTIVE)return toast('현재 담당 사건이 12건입니다. 기존 사건을 먼저 처리하세요.');
   const candidate=candidates().find(x=>x.a.id===o.archetypeId&&x.pack.packId===o.packId);
   let c;try{c=createGeneratedCase(candidate||null)}catch(err){console.error(err);toast('사건 구성 오류로 배당하지 못했습니다.');return;}
   if(!c)return toast('현재 사건을 배당할 수 없습니다.');
   o.status='accepted';o.caseId=c.id;db.acceptedByDay[today]=(db.acceptedByDay[today]||0)+1;
   remember(c.who[0],'배당 수락',c.name+'의 재판이 시작됨',c.id);save();ui.caseId=c.id;changeTab('court');toast('사건 수락 · '+c.name);return;
 }
 if(['nextWeek','skip'].includes(b.dataset.action)){toast('실시간 커리어 모드에서는 주간 스킵이 비활성화됩니다.');return;}
 return baseClick(e);
};
const sty=document.createElement('style');sty.textContent='.realtime-docket{border:1px solid #c09f6f;background:#f8f6f0}.docket-entry{background:white;border:1px solid #ded8cb;border-radius:10px;margin:8px 0;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px}.docket-entry small{display:block;color:#667786;margin-top:4px}';document.head.appendChild(sty);
function awaken(){if(!S.name)return;sync();render();}
const previousStart=clicker;
clicker=function(e){previousStart(e);if(e.target.closest('[data-action="start"]')){initClock();sync();render();}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',awaken);else awaken();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)awaken()});
window.addEventListener('focus',awaken);
})();