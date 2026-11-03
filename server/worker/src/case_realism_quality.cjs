/* THE VERDICT P3-7 — cross-category narrative plausibility gate.
 * This validates authored causal detail and evidence provenance, not real-world truth.
 * A draft may be rough; an approval candidate must carry a completed review profile.
 */
'use strict';
const TYPES=Object.freeze({
 homicide:['mechanism','injuryOrCauseOfDeath','forensicLimits'],
 sexual:['consentOrCapacity','contactContext','medicalLimits'],
 violence:['contactMechanism','injuryOrNoInjury','medicalLimits'],
 financial:['moneyTrail','authorityOrRepresentation','lossOrBenefit'],
 property:['physicalOrDigitalTrail','ownershipOrDuty','lossOrDamage'],
 reputation:['originalStatement','publicationScope','contextOrTruth'],
 civil:['dutyOrContract','breachOrDispute','damagesOrRemedy'],
 family:['familyRelationship','legalStatus','partyChoices'],
 professional:['standardOfCare','causation','expertLimits'],
 public:['officialDuty','decisionTrail','benefitOrAbuse']
});
const str=x=>typeof x==='string'&&x.trim().length>=20;
const norm=x=>String(x||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const boiler=/원문 확인 필요|추후 작성|TODO|TBD|임시 문구|세계에서 .* 서로 다른 원문 내용|복붙|아직 미정/;
function validate(candidate){
 const errors=[],warnings=[];const fail=x=>errors.push(x);
 const category=candidate?.card?.category,required=TYPES[category]||[];
 const quality=candidate?.realism;
 const reviewing=candidate?.status==='review';
 if(!quality){
  (reviewing?fail:x=>warnings.push(x))('실제 배당 전 분야별 인과·증거 고증표(realism)가 필요합니다.');
 }else{
  for(const f of ['timelineMechanics','physicalScene','evidenceProvenance','witnessObservability','alternativeHypotheses','aftermathConsequences',...required])
   if(!str(quality[f]))fail('realism.'+f+': 사건별 구체적인 설명이 필요합니다.');
  if(quality.sensitiveDetailPolicy!=='non-graphic')fail('잔혹·성적 상황은 비선정적 사건기록 문체로 작성해야 합니다.');
 }
 const rec=candidate?.records||[],worlds=candidate?.worlds||{};
 const scene=candidate?.scene||{};
 if(norm(scene.observed)===norm(scene.uncertainty))fail('현장 관찰과 미확인 사항이 같은 문장입니다.');
 for(const r of rec){
  if(boiler.test([r.title,r.how,r.limitation].join(' ')))fail('증거에 미완성 문구가 있습니다: '+(r.id||'?'));
  if(norm(r.how)===norm(r.limitation))fail('확보 경위와 한계를 같은 문장으로 쓰면 안 됩니다: '+(r.id||'?'));
 }
 for(const t of ['did','didnt','reason']){
  const w=worlds[t]||{};
  for(const [id,raw] of Object.entries(w.records||{})){
   if(boiler.test(raw))fail(t+' '+id+': 미작성 증거 원문입니다.');
  }
  const vals=Object.values(w.records||{}).map(norm).filter(Boolean);
  if(vals.length>1&&new Set(vals).size!==vals.length)fail(t+': 서로 다른 증거에 동일 원문이 반복됩니다.');
  if(norm(w.act)===norm(w.cause)||norm(w.act)===norm(w.motive))fail(t+': 행위·원인·동기는 구분해야 합니다.');
 }
 return {ok:errors.length===0,errors,warnings};
}
module.exports={TYPES,validate};
