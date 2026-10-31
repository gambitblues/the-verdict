/* THE VERDICT hearing decision refinement — inspect evidence and choose reasoning, not single-tap progression. */
'use strict';
(()=>{
const previousClick=clicker,previousCourt=court,oldEvaluate=StoryEngine.evaluate;
const esc=v=>h(String(v??''));
const strategies=[
 {id:'origin',label:'원본·취득 경위를 확인한다',summary:'자료의 작성 시각, 보관자, 누락 구간부터 심리',flag:'chain'},
 {id:'contradiction',label:'서로 다른 진술을 대조한다',summary:'검사·원고와 피고 측 설명의 충돌을 신문',flag:'cross'},
 {id:'alternative',label:'다른 가능성도 검증한다',summary:'행위자 특정, 인과관계 및 반대 증거까지 검토',flag:'elements'}
];
function showOptions(c,index){
 const st=S.cases[c.id],a=c.stages?.[st.phase]?.actions?.[index];
 if(!a)return;
 ui.pendingHearing={caseId:c.id,index,phase:st.phase};
 const details=c.story?.evidenceDetails||[],e=details[Math.min(st.phase,details.length-1)];
 const proof=e?.title||'재판 기록';
 const html='<div class="tv-court-deliberation"><b>선택한 심리</b><p>'+esc(a.label||a.short)+'</p><div class="notice">핵심 자료: '+esc(proof)+'</div><p>어떤 관점에서 심리할까요? 선택은 판사의 심리 기록에 남습니다.</p>'+
 strategies.map(x=>'<button class="tv-reason" data-action="courtReason" data-method="'+x.id+'"><b>'+esc(x.label)+'</b><small>'+esc(x.summary)+'</small></button>').join('')+'</div>';
 modal('재판부의 검토 방향',html,'<button class="btn outline full" data-action="dismiss">나중에 결정</button>');
}
clicker=function(e){
 const b=e.target.closest('[data-action]');if(!b)return;
 if(b.dataset.action==='courtStep'){
   const c=CASES.find(x=>x.id===ui.caseId);
   if(!c?.stages?.[S.cases[c.id]?.phase])return previousClick(e);
   showOptions(c,Number(b.dataset.i));return;
 }
 if(b.dataset.action==='courtReason'){
  const pending=ui.pendingHearing,c=pending&&CASES.find(x=>x.id===pending.caseId),st=c&&S.cases[c.id],m=strategies.find(x=>x.id===b.dataset.method);
  if(!m||!c||!st||st.phase!==pending.phase||st.verdict||st.liveHearing&&!st.liveHearing.done&&st.liveHearing.until>Date.now())return;
  st.reasonedChoices??=[];
  const a=c.stages[st.phase].actions[pending.index];
  if(!a)return;
  st.reasonedChoices.push({phase:st.phase,method:m.id,label:m.label,action:a.label,week:S.week});
  ui.pendingHearing=null;ui.modal=null;
  const previous=st.actions.length;
  courtStep(pending.index);
  if(st.actions.length>previous){
    st.actions[st.actions.length-1].says+=' 판사는 '+m.label+'는 검토 기준을 명시했다.';
    st.clues.push('심리 관점: '+m.summary);
    save();render();
  }
  return;
 }
 return previousClick(e);
};
StoryEngine.evaluate=function(c,selected,decision){
 const result=oldEvaluate(c,selected,decision);
 if(!result)return result;
 const st=S.cases[c.id],choices=st?.reasonedChoices||[];
 const variety=new Set(choices.map(x=>x.method)).size;
 return {...result,score:Math.min(100,result.score+Math.min(5,variety+Math.max(0,choices.length-2))),
 why:(result.why||'')+' 판사가 기록한 심리 방향 '+choices.length+'건과 검토 관점 '+variety+'유형을 확인했다.'};
};
court=function(){
 let text=previousCourt(),c=CASES.find(x=>x.id===ui.caseId),st=c&&S.cases[c.id];
 if(!c||!st||st.verdict||st.phase!==3)return text;
 const min=c.importance>=4?4:c.importance>=2?2:1,done=(st.hearingHistory||[]).filter(x=>x.kind==='resumed').length;
 const waiting=st.liveHearing&&!st.liveHearing.done&&st.liveHearing.until>Date.now();
 if(done>=min&&!waiting)return text;
 text=text.replace(/(<button\b[^>]*\bdata-action="verdict"[^>]*)(>)/g,'$1 disabled aria-disabled="true"$2');
 const reason=waiting?'다음 기일이 아직 도래하지 않았습니다.':'추가 기일 '+(min-done)+'회가 필요합니다.';
 text=text.replace('<section class="panel action-panel">','<section class="panel action-panel"><p class="notice">🔒 선고 대기 · '+esc(reason)+'</p>');
 return text;
};
})();