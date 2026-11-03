/* THE VERDICT — authoring quality gate for adult sexual-offence cases.
 * Narrative plausibility, not a forensic or legal determination. Never infer consent
 * or guilt from injuries, resistance, intoxication or a single biological trace.
 */
'use strict';
const TYPES=['forcible','incapacitated','coercion','consent-dispute','unwanted-contact','harassment','false-report'];
const has=x=>typeof x==='string'&&x.trim().length>=15;
function validate(quality){
 const errors=[],warnings=[];
 const err=x=>errors.push(x);
 if(!quality||typeof quality!=='object')return {ok:false,errors:['성범죄 고증 검토 항목이 없습니다.'],warnings};
 if(!TYPES.includes(quality.scenarioType))err('사건 유형을 구체적으로 분류해야 합니다.');
 const required=['interaction','consentContext','capacityContext','forceOrPressure','medicalFindings','medicalLimits','evidenceLimits','aftermath'];
 for(const k of required)if(!has(quality[k]))err(k+' 항목은 구체적인 사건 고증 설명이 필요합니다.');
 const worlds=quality.worlds||{};
 for(const w of ['did','didnt','reason']){
  if(!worlds[w]||!has(worlds[w].mechanism)||!has(worlds[w].observations)||!has(worlds[w].alternativeExplanation))
   err(w+' 세계의 행위·관찰·대안 설명을 각각 작성해야 합니다.');
 }
 if(quality.scenarioType==='forcible'&&!has(quality.forceOrPressure))err('물리적 강제력의 개연성을 별도 확인해야 합니다.');
 if(quality.scenarioType==='incapacitated'&&!has(quality.capacityContext))err('의식 및 의사결정 능력의 근거를 확인해야 합니다.');
 const combined=[quality.medicalFindings,quality.medicalLimits,quality.evidenceLimits].filter(Boolean).join(' ');
 if(/상처가 없으므로.*(동의|허위|무죄)|상처가 있으므로.*(강간|유죄)|저항하지 않았으므로.*동의|정액.*(유죄|범행 확정)/.test(combined))
  err('상해·저항·정액만으로 동의나 범죄 성립을 단정할 수 없습니다.');
 if(quality.scenarioType==='false-report')warnings.push('허위 신고는 별도 증거로 고의적 허위 진술을 입증해야 하며, 불기소나 무죄만으로 판단할 수 없습니다.');
 return {ok:errors.length===0,errors,warnings};
}
module.exports={TYPES,validate};
