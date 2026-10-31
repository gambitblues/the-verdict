/* THE VERDICT v0.6. Deterministic structural continuity, not a legal opinion. */
'use strict';
const ContinuityEngine=(()=>{
 const unique=xs=>[...new Set(xs.filter(Boolean))];
 function audit(c,people,week,existing){
  const errors=[],warnings=[],story=c.story||{},deep=story.deep||{},evid=story.evidenceDetails||[];
  if(!c.id||existing.some(x=>x.id===c.id))errors.push('사건 ID 중복');
  if(!c.who||unique(c.who).length!==2)errors.push('당사자 식별 오류');
  for(const id of unique([...(c.who||[]),...(c.side||[]),story.witness,story.investigator?.detective])){
   const p=people[id]; if(!p){errors.push('등록되지 않은 NPC '+id);continue;}
   if(p.alive===false && !(story.criminal && id===c.who?.[1]))errors.push('사망한 NPC가 현재 활동 인물로 배정 '+id);
   const y=Number(p.bornYear);if(Number.isFinite(y)&&y>2027+Math.floor(week/52.18))errors.push('출생 전 활동 '+id);
  }
  const events=story.timeline||[];
  for(let i=1;i<events.length;i++)if(Number.isFinite(events[i].week)&&Number.isFinite(events[i-1].week)&&events[i].week<events[i-1].week)errors.push('사건 연표 역순');
  const ids=evid.map(e=>e.id);if(unique(ids).length!==ids.length)errors.push('증거 ID 중복');
  for(const e of evid){
   if(!e.title||!e.origin)warnings.push('증거 설명 누락 '+e.id);
   if(e.available===false&&e.collectionStatus==='법정 제출 가능')errors.push('미확보 증거 제출 상태 충돌 '+e.id);
   if(e.quality!=null&&(e.quality<0||e.quality>100))errors.push('증거 신빙성 범위 오류');
  }
  if(deep.elements){for(const el of deep.elements){if(!(el.proof||[]).every(id=>ids.includes(id)))errors.push('존재하지 않는 증거 참조 '+el.id);}}
  if(story.criminal&&deep.negotiation?.eligible)errors.push('형사사건을 민사 조정으로 분류');
  if(c.relatedCaseId&&c.relatedCaseId===c.id)errors.push('자기 자신 연관 사건');
  if((c.stages||[]).some(st=>(st.actions||[]).some(a=>(a.sourceIds||[]).some(id=>!ids.includes(id)))))errors.push('심리 선택지의 존재하지 않는 증거');
  return {pass:errors.length===0,errors,warnings,checks:10,version:'0.6'};
 }
 function snapshots(c,people,week){return unique([...(c.who||[]),...(c.side||[]),c.story?.witness,c.story?.investigator?.detective]).map(id=>{let p=people[id]||{};return {id,name:p.name||id,role:p.role||'',career:p.career||'',wealth:p.wealth??null,alive:p.alive!==false,week};});}
 function originDocket(c,st,week){return {originalCaseId:c.id,originalCourt:'1심',firstJudgment:{week,verdict:st.verdict,grade:st.grade,explanation:st.judgementAnalysis||'',examinedEvidence:unique((st.actions||[]).flatMap(a=>a.sourceIds||[])),actionFlags:(st.actions||[]).map(a=>a.flag)},stages:[{level:'1심',week,status:'선고',result:st.verdict}],historyLinked:true};}
 function fileAppeal(c,st,v,week){const d=v.docket||originDocket(c,st,st.closedWeek??week);return {...d,appeal:{filedAt:v.appealFiledWeek,grounds:v.grounds,appellant:v.appellant,hearingCourt:'별도 항소심 재판부',playerControls:false},stages:[...d.stages,{level:'항소심',week,status:'계속 중',result:null}]};}
 function finishAppeal(c,st,v,changed,week){const d=v.docket||fileAppeal(c,st,v,week);return {...d,appeal:{...d.appeal,determinedAt:week,decision:changed?'원심 일부 변경':'원심 판단 유지',reason:v.reason},stages:d.stages.map(x=>x.level==='항소심'?{...x,week,status:'선고',result:changed?'원심 일부 변경':'원심 유지'}:x)};}
 return {audit,snapshots,originDocket,fileAppeal,finishAppeal};
})();
