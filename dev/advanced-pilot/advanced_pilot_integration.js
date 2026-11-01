/* Advanced pilot integration — independent of legacy UI and saves. */
(function(root,factory){
 const a=typeof module==='object'&&module.exports;
 const api=factory(a?require('../../advanced_case_engine.js'):root.VerdictAdvancedCase,
 a?require('../../advanced_witness_engine.js'):root.VerdictWitnessEngine,
 a?require('../../advanced_timeline_evidence.js'):root.VerdictTimelineEvidence,
 a?require('../../advanced_courtroom_conflict.js'):root.VerdictCourtroomConflict,
 a?require('./advanced_pilot_clinic.js'):root.VerdictAdvancedPilot);
 if(a)module.exports=api;if(root)root.VerdictPilotIntegration=api;
})(typeof window!=='undefined'?window:null,function(C,W,T,F,P){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x));
 function start(seed,truth){const state=C.create(P.definition,seed,truth);return {state,manifest:copy(P.manifest(C.read(state).truth)),dialogue:copy(P.dialogue)}}
 function check(p){W.validateState(p.state);T.inspect(p.state,p.manifest);F.validate(p.dialogue);return true}
 function ask(p,args){check(p);return {...p,state:W.ask(p.state,args)}}
 function evidence(p,id){check(p);return {...p,state:T.submit(p.state,p.manifest,id)}}
 function say(p,id){check(p);return {...p,state:F.play(p.state,p.dialogue,id)}}
 // World progression is not a consequence of the verdict. It must be explicitly
 // recorded and be consistent with fixed authored future facts.
 function future(p,{date,birthRecorded,paternityDisputed,authorizedClaimant,existingParentageReviewed}){
  check(p);
  if(typeof date!=='string'||date<P.followUp.minimumDate)return {available:false,reason:'minimum_date'};
  if(!birthRecorded||!paternityDisputed||!authorizedClaimant||!existingParentageReviewed)return {available:false,reason:'facts_or_standing_missing'};
  return {available:true,caseId:P.followUp.id,independentProceeding:true,sourceCaseId:C.read(p.state).caseId,
   notice:'유전자 검사와 친자관계 소송의 당사자 적격을 별도 심리해야 합니다. 형사 유죄 또는 무죄에서 자동 추론하지 않습니다.'};
 }
 return Object.freeze({start,check,ask,evidence,say,future});
});
