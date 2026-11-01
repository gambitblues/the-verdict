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
return Object.freeze({award,fame,clamp});
});
