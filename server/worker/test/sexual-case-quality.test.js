import assert from 'node:assert/strict';
import Q from '../src/sexual_case_quality.cjs';
const content='시각과 당사자의 서로 다른 진술 및 객관적 기록의 한계를 검토한다.';
const fixture=()=>({
 scenarioType:'forcible',interaction:content,consentContext:content,capacityContext:content,
 forceOrPressure:'접촉 경위, 상호 위치, 제압 여부와 물리적인 시간·공간 가능성을 대조한다.',
 medicalFindings:'감정 가능한 손상과 확인되지 않은 손상을 각각 구분해 기록한다.',
 medicalLimits:'손상의 유무만으로 동의 여부나 범죄 성립 여부를 단정하지 않는다.',
 evidenceLimits:'증언과 기록의 시간차, DNA 검출의 출처와 한계를 구별해 확인한다.',
 aftermath:'사건 이후 신고와 진료, 관계 변화에 관한 독립 기록을 확보한다.',
 worlds:Object.fromEntries(['did','didnt','reason'].map(k=>[k,{mechanism:content,observations:content,alternativeExplanation:content}]))
});
assert.equal(Q.validate(fixture()).ok,true);
const absent=fixture();delete absent.forceOrPressure;assert.equal(Q.validate(absent).ok,false);
const oneWorld=fixture();delete oneWorld.worlds.reason;assert.equal(Q.validate(oneWorld).ok,false);
const presume=fixture();presume.medicalLimits='상처가 없으므로 허위 신고이다';
assert.equal(Q.validate(presume).ok,false);
const falseReport=fixture();falseReport.scenarioType='false-report';
assert.equal(Q.validate(falseReport).warnings.length,1);
console.log('PASS sensitive-case realism gate · force, consent, injuries, alternative worlds');
