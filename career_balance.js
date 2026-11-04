/* Forty-year career progression — slow durable skill, slower legal reputation,
 * volatile public visibility. All deltas are per distinct completed case.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.VerdictCareerBalance=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const clamp=x=>Math.max(0,Math.min(100,Math.round(x*1000)/1000));
function award(state,caseId,grade,importance,year){
 state.careerProgress??={completed:{},lastVisibilityYear:year};
 const a=state.careerProgress;
 if(a.completed[caseId])return {applied:false};
 const years=Math.max(0,(Number(year)||2026)-(Number(a.lastVisibilityYear)||2026));
 state.publicity=clamp((Number(state.publicity)||0)*Math.pow(.82,Math.min(40,years)));
 a.lastVisibilityYear=Number(year)||2026;
 const skill=(Math.max(0,Math.min(100,grade))-50)/220+(grade>=80?.19:.04);
 const skillDelta=Math.max(.06,Math.min(.48,skill))*(1-(Number(state.professional)||0)/125);
 state.professional=clamp((Number(state.professional)||0)+skillDelta);
 const visibility=(importance>=4?1.0:importance>=3?.28:.06)*(grade>=80?1.1:.75);
 state.publicity=clamp(state.publicity+visibility);
 a.completed[caseId]=true;
 return {applied:true,skillDelta,visibility};
}
function fame(state,caseId,grade,importance){
 state.legalWorld??={};state.legalWorld.careerAwards??={};
 if(state.legalWorld.careerAwards[caseId])return false;
 const gain=(importance>=4?0.85:importance>=3?.38:.12)*(grade>=80?1.25:.8);
 state.legalWorld.playerFame=clamp((Number(state.legalWorld.playerFame)||0)+gain);
 state.legalWorld.careerAwards[caseId]=true;return true;
}

/* Formal nine-month evaluation. One immutable result per 39 in-game weeks,
 * computed only from judgments actually closed by the evaluation cut-off.
 * The player does not see individual-case scoring, and publicity is not a correctness proxy.
 */
const REVIEW_WEEKS=39;
const numberOrNull=x=>Number.isFinite(Number(x))&&x!==null&&x!==''?Number(x):null;
function evaluate(state,period){
 const start=(period-1)*REVIEW_WEEKS,end=period*REVIEW_WEEKS;
 const entries=Object.entries(state?.cases||{}).filter(([,s])=>
  s?.verdict&&Number.isFinite(Number(s.closedWeek))&&s.closedWeek!==null&&Number(s.closedWeek)>=start&&Number(s.closedWeek)<end);
 const values=entries.map(([id,s])=>{
  const f=s.trial4?.final||{};
  const score=numberOrNull(f.review??s.grade??f.skill);
  return {id,score:score==null?null:Math.max(0,Math.min(100,score)),
   reasons:Array.isArray(f.judgment?.issues)?f.judgment.issues.length:0,
   cited:(s.trial4?.evidence||[]).filter(e=>e.decision==='use'||e.decision==='conditional').length,
   hearings:Number(s.trial4?.daysDone)||0,
   resolved:true};
 });
 const scored=values.filter(v=>v.score!==null);
 const avg=scored.length?scored.reduce((n,v)=>n+v.score,0)/scored.length:null;
 const reasoning=values.filter(v=>v.reasons>0).length;
 const evidentiary=values.filter(v=>v.cited>0).length;
 const hearings=values.reduce((n,v)=>n+v.hearings,0);
 let result='평가 보류',narrative='이 기간에 심리가 종결된 사건이 없어 판단을 유보했다.';
 if(values.length){
  if(scored.length<Math.min(2,values.length)){
   result='평가 자료 부족';narrative='판결은 축적됐지만 기록의 평가 항목이 충분하지 않아 정식 등급을 유보했다.';
  }else{
   result=avg>=82?'우수':avg>=67?'안정':avg>=50?'보완 필요':'집중 개선';
   const tone=avg>=82?'법리와 사실 판단의 충실도가 높은 편이었다.':avg>=67?'기록에 근거한 안정적인 판단을 이어갔다.':avg>=50?'일부 사건에서 판단의 논거를 더 명확히 할 필요가 있었다.':'증거와 법리 검토의 체계적인 개선이 요구됐다.';
   narrative=values.length+'건의 판결을 마쳤다. '+tone+
    (reasoning?' 판결문에 쟁점별 검토가 남은 사건은 '+reasoning+'건이었다.':'')+
    (evidentiary?' 실제 채택 증거가 확인된 사건은 '+evidentiary+'건이었다.':'');
  }
 }
 return Object.freeze({period,startWeek:start,endWeek:end,caseCount:values.length,gradedCases:scored.length,
  hearingCount:hearings,reasonedCases:reasoning,citedCases:evidentiary,
  rating:result,narrative,
  // Audit only. Keep the internal average out of all normal user views.
  internalAverage:avg===null?null:Math.round(avg*10)/10,
  caseIds:values.map(v=>v.id)});
}
function advanceEvaluations(state,week){
 const reached=Math.max(0,Math.floor((Number(week)||0)/REVIEW_WEEKS));
 state.careerReviews??=[];
 const known=new Set(state.careerReviews.map(x=>x.period));
 const created=[];
 for(let period=1;period<=reached;period++){
  if(known.has(period))continue;
  const review=evaluate(state,period);
  state.careerReviews.push({...review});
  known.add(period);created.push(review);
  if(review.caseCount>0){
   state.journal??=[];
   state.journal.unshift({week:review.endWeek,type:'정기 법관 평가',
     title:review.rating+' · '+period+'차 정기 평가',
     body:review.narrative,reviewPeriod:period});
  }
 }
 return created;
}

return Object.freeze({award,fame,clamp,evaluate,advanceEvaluations,REVIEW_WEEKS});
});
