/* Beta v1.7 — playable hearings: short real-time delays, purpose and multi-session judgment */
'use strict';
(()=>{
const KEY_DELAY='verdict_hearing_v17';
const reasonDefs={brief:{title:'양측 추가 서면',mins:10,description:'쟁점을 정리하고 반박 서면을 비교합니다.'},witness:{title:'증인 소환',mins:20,description:'출석 여부와 진술의 직접 경험 범위를 확인합니다.'},evidence:{title:'추가 증거 제출',mins:30,description:'자료 원본과 확보 경위를 검토합니다.'},expert:{title:'현장 검증·전문 감정',mins:60,description:'기술적 자료와 기존 진술을 대조합니다.'}};
function bucket(c){return c.importance>=4?'major':c.importance>=2?'regular':'minor'}
function waits(c){return bucket(c)==='major'?[20,40,60,120,240]:bucket(c)==='regular'?[10,20,40,60]:[10,20,30]}
function minHearings(c){return bucket(c)==='major'?4:bucket(c)==='regular'?2:1}
const fmt=ms=>{const m=Math.max(0,Math.ceil(ms/60000));return m>=60?Math.floor(m/60)+'시간 '+(m%60)+'분':m+'분'};
function eachReady(){
 let updated=0;
 for(const c of CASES){const st=S.cases[c.id],t=st?.liveHearing;if(!t||st.verdict||t.done||Date.now()<t.until)continue;
 t.done=true;
 st.hearingHistory??=[];
 st.hearingHistory.push({week:S.week,kind:'resumed',text:'['+reasonDefs[t.reason].title+'] 후속 심리 가능 · 자료의 진실성은 별도 검토'});
 st.lastHearingNotice=reasonDefs[t.reason].description;
 st.pendingResearch=null;st.nextHearingWeek=null;updated++;
 }
 if(updated)save();
 return updated;
}
function hold(st){return !!(st?.liveHearing&&!st.liveHearing.done&&Date.now()<st.liveHearing.until)}
function schedule(c,reason){
 const st=S.cases[c.id];if(!st||st.verdict||hold(st))return;
 const defs=reasonDefs[reason];if(!defs)return;
 const num=(st.hearingHistory||[]).filter(x=>x.kind==='resumed').length;
 const delays=waits(c);const minutes=Math.max(defs.mins,delays[Math.min(num,delays.length-1)]);
 st.liveHearing={reason,minutes,until:Date.now()+minutes*60000,done:false};
 st.nextHearingWeek=null;st.hearingHistory??=[];st.hearingHistory.push({week:S.week,kind:'scheduled',text:defs.title+' · 현실 '+minutes+'분 후 후속 심리'});
 st.pendingResearch={kind:defs.title,requestedWeek:S.week,realDue:st.liveHearing.until};
 save();render();toast(defs.title+' · '+minutes+'분 뒤 후속 심리');
}
const beforeCourt=court;
court=function(){
 eachReady();
 let html=beforeCourt();
 const c=CASES.find(v=>v.id===ui.caseId),st=c&&S.cases[c.id];if(!c||!st||st.verdict)return html;
 const t=st.liveHearing,awaiting=hold(st),count=(st.hearingHistory||[]).filter(v=>v.kind==='resumed').length,min=minHearings(c);
 const phaseLabel=bucket(c)==='major'?'중대 사건':bucket(c)==='regular'?'일반 사건':'경미 사건';
 let block='<section class="panel live-hearing-panel"><div class="row between"><h3>🗓 재판 진행 · '+phaseLabel+'</h3><span class="chip">'+count+'/'+min+'회 기일 완료</span></div>';
 if(awaiting)block+='<p><b>'+reasonDefs[t.reason].title+'</b>에 대한 준비가 진행 중입니다.</p><p>다음 심리까지 약 '+fmt(t.until-Date.now())+' 남았습니다.</p><button class="btn outline full" data-action="liveRefresh">기일 상태 확인</button>';
 else if(st.phase===3&&count>=min)block+='<p>필요한 후속 심리를 진행했습니다. 판결을 검토할 수 있습니다.</p>';
 else{
  block+='<p class="muted small">기일 연기 사유를 선택하세요. 대기하는 동안 다른 사건을 심리할 수 있습니다. 이미 수락한 사건은 사라지지 않습니다.</p><div class="live-hearing-choices">';
  for(const [id,d] of Object.entries(reasonDefs)){const delay=Math.max(d.mins,waits(c)[Math.min(count,waits(c).length-1)]);block+='<button class="btn outline" data-action="livePostpone" data-reason="'+id+'"><b>'+d.title+'</b><small> '+delay+'분 · '+d.description+'</small></button>';}
  block+='</div>';
 }
 if(st.phase===3&&count<min)block+='<p class="notice">선고 전 추가 심리 '+(min-count)+'회가 필요합니다. 같은 날 모든 단계를 종결할 수 없습니다.</p>';
 block+='</section>';
 // Remove legacy weekly scheduling buttons and skip button while preserving other court UI.
 html=html.replace(/<section class="panel calendar-panel">[\s\S]*?<\/section>/,'');
 const mark='<section class="panel action-panel">';
 return html.includes(mark)?html.replace(mark,block+mark):block+html;
};
const prevStep=courtStep,prevConclude=conclude,prevClick=clicker;
courtStep=function(i){eachReady();if(hold(S.cases[ui.caseId])){toast('다음 심리 기일을 기다려야 합니다.');return;}return prevStep(i)};
conclude=function(id){eachReady();const c=CASES.find(v=>v.id===ui.caseId),st=c&&S.cases[c.id];if(!c||!st)return;if(hold(st)){toast('후속 심리 준비 중입니다.');return;}if((st.hearingHistory||[]).filter(v=>v.kind==='resumed').length<minHearings(c)){toast('추가 기일에서 증거와 반박을 검토해야 선고할 수 있습니다.');return;}return prevConclude(id)};
clicker=function(e){const el=e.target.closest('[data-action]');if(!el)return;
 if(el.dataset.action==='livePostpone'){const c=CASES.find(v=>v.id===ui.caseId);if(c)schedule(c,el.dataset.reason);return;}
 if(el.dataset.action==='liveRefresh'){eachReady();render();return;}
 if(el.dataset.action==='postpone'){const c=CASES.find(v=>v.id===ui.caseId);if(c)schedule(c,'evidence');return;}
 if(el.dataset.action==='skipHearing'){toast('현실시간 기일 시스템에서는 기일 건너뛰기를 사용하지 않습니다.');return;}
 return prevClick(e);
};
const st=document.createElement('style');st.textContent='.live-hearing-panel{border:1px solid #b7a68e;background:#f8f6f0}.live-hearing-choices{display:grid;grid-template-columns:1fr 1fr;gap:8px}.live-hearing-choices button{text-align:left;line-height:1.6;white-space:normal}.live-hearing-choices small{display:block;color:#6a7881}@media(max-width:540px){.live-hearing-choices{grid-template-columns:1fr}}';document.head.appendChild(st);
})();