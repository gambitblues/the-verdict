/* THE VERDICT — deterministic post-trial lives, optional follow-up lawsuits.
 * Does not alter the locked truth, game save, first-trial evidence or verdict.
 * No external AI/API calls. A shared-world scheduler may adopt potential claims later.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.VerdictCaseAfterlife=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const WORLD=['did','didnt','reason'];
function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h>>>0}
function roll(s,label){return hash(s.caseId+':'+s.seed+':'+s.month+':'+label)%1000}
function addFact(s,f){if(!s.facts.includes(f))s.facts.push(f)}
function addEvent(s,id,detail){if(s.events.some(e=>e.id===id))return false;s.events.push({id,month:s.month,detail});return true}
function claim(s,id,party,category,reason){
 if(s.litigations.some(x=>x.id===id))return false;
 s.litigations.push({id,originCaseId:s.caseId,month:s.month,party,category,status:'potential',reason,assignedTo:null});
 return true;
}
/* pregnancyFromIncident is authored and legally/factually verified, never inferred from conviction or semen alone.
 * confirmedFather may be set only by separately grounded parentage evidence (never by a verdict).
 */
function init(options){
 if(!options||!options.caseId||!WORLD.includes(options.truth)||options.seed==null)throw Error('afterlife initial facts');
 const policy=options.policy||{};
 if(typeof policy.pregnancyFromIncident!=='boolean')throw Error('pregnancyFromIncident must be explicitly authored');
 if(policy.pregnancyFromIncident&&options.truth!=='did')throw Error('incident conception contradicts locked world');
 if(policy.confirmedFather!=null&&!['partner','accused','other'].includes(policy.confirmedFather))throw Error('invalid confirmed father');
 if(policy.pregnancyFromIncident&&policy.confirmedFather==='partner')throw Error('confirmed father conflicts with incident conception');
 if(policy.incidentPregnancyExcluded===true&&policy.pregnancyFromIncident)throw Error('incident pregnancy explicitly excluded');
 const data={format:'verdict-case-afterlife/v1',caseId:String(options.caseId),seed:String(options.seed),
  truth:options.truth,verdict:clone(options.verdict??null),month:0,people:clone(options.people||[]),
  policy:{pregnancyFromIncident:policy.pregnancyFromIncident,incidentPregnancyExcluded:policy.incidentPregnancyExcluded===true,
   laterPregnancyPossible:policy.laterPregnancyPossible===true,confirmedFather:policy.confirmedFather||null,
   partnerPresent:policy.partnerPresent===true,petitionAllowed:policy.petitionAllowed!==false,
   rates:{pregnancy:policy.rates?.pregnancy??120,dispute:policy.rates?.dispute??280,divorce:policy.rates?.divorce??170,
    parentage:policy.rates?.parentage??240}},
  facts:[],events:[],litigations:[]};
 for(const n of Object.values(data.policy.rates))if(!Number.isInteger(n)||n<0||n>1000)throw Error('invalid event chance');
 if(data.policy.incidentPregnancyExcluded)addFact(data,'incident_pregnancy_excluded');
 if(data.policy.pregnancyFromIncident)addFact(data,'incident_conception_locked');
 if(data.policy.confirmedFather)addFact(data,'father_verified_'+data.policy.confirmedFather);
 return data;
}
function advance(current,months=1){
 if(!current||current.format!=='verdict-case-afterlife/v1'||!WORLD.includes(current.truth))throw Error('invalid afterlife state');
 if(!Number.isInteger(months)||months<1||months>120)throw Error('invalid month advance');
 const s=clone(current),p=s.policy,r=p.rates;
 for(let i=0;i<months;i++){
  s.month++;
  /* A pregnancy after the initial litigation is a future, independent life event.
     clinic-001 explicitly excludes pregnancy from the procedure; do not silently overturn it. */
  if(!s.facts.includes('pregnancy_confirmed')&&!s.facts.includes('pregnancy_ruled_out')&&
    (p.pregnancyFromIncident||(p.laterPregnancyPossible&&roll(s,'pregnancy')<r.pregnancy))){
   addFact(s,'pregnancy_confirmed');addFact(s,p.pregnancyFromIncident?'pregnancy_linked_to_origin':'pregnancy_later_unrelated');
   addEvent(s,'pregnancy-confirmed','임신 사실 확인. 친부·사건 관련성은 이 사실만으로 확정되지 않음');
  }
  if(s.facts.includes('pregnancy_confirmed')&&!s.facts.includes('birth_recorded')){
   const event=s.events.find(e=>e.id==='pregnancy-confirmed');
   if(event&&s.month>=event.month+9){addFact(s,'birth_recorded');addEvent(s,'birth','출생 기록 생성');}
  }
  if(!p.partnerPresent)continue;
  /* Divorce may arise independently of a pregnancy and is a petition, not a court judgment. */
  if(!s.events.some(e=>e.id==='marital-conflict')&&s.month>=2&&roll(s,'marital-conflict')<r.dispute)
   addEvent(s,'marital-conflict','과거 재판과 가족관계에 관한 부부 갈등');
  if(p.petitionAllowed&&s.events.some(e=>e.id==='marital-conflict')&&
    !s.litigations.some(e=>e.id===s.caseId+':divorce')&&roll(s,'divorce')<r.divorce)
   claim(s,s.caseId+':divorce','partner','family','혼인관계 파탄 주장. 법정 사유는 별도 심사');
  if(p.petitionAllowed&&s.facts.includes('birth_recorded')&&!s.litigations.some(e=>e.id===s.caseId+':parentage')&&
    roll(s,'parentage')<r.parentage)
   claim(s,s.caseId+':parentage','eligible-party','family','친자관계 다툼 가능성. 적격·제소기간·법적 친자 추정은 별도 심사');
 }
 return s;
}
function assignPotential(state,claimId,judgeId){
 if(!judgeId||typeof judgeId!=='string')throw Error('judge required');
 const s=clone(state),c=s.litigations.find(x=>x.id===claimId);
 if(!c||c.status!=='potential'||c.assignedTo)throw Error('claim not available');
 c.status='assigned';c.assignedTo=judgeId;
 return s;
}
return Object.freeze({init,advance,assignPotential});
});
