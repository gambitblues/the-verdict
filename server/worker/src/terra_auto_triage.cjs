/* P3-13: automated triage for unattended case production.
 * This module decides whether a draft is eligible for an isolated, unpublished
 * inventory. It does not grant publication privileges or mutate world sheets.
 */
'use strict';
const {createHash}=require('node:crypto');
const {validateDraft}=require('./terra_case_pipeline.cjs');
const {prepareWorldSheet}=require('./terra_world_sheet_handoff.cjs');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const HIGH_RISK=new Set(['homicide','sexual','professional']);
const FAIL_MARKERS=/검증 필요|확인 필요|TODO|TBD|원문 확인|추후 작성|placeholder/i;
function triage({candidate,sheet,qa,browserQa,inventory=[],policy={}}={}){
 const reasons=[],warnings=[],record={};
 if(!candidate||!sheet)return {decision:'quarantine',reasons:['사건 후보와 세계 시트가 모두 필요합니다.']};
 // Never count an AI-generated review flag as a human approval.
 const draft=validateDraft(candidate);
 if(!draft.ok)reasons.push(...draft.errors);
 if(candidate.status!=='draft'||sheet.status!=='draft')reasons.push('자동 제작 사건은 미승인 draft 상태여야 합니다.');
 const staged=prepareWorldSheet({...candidate,status:'review'},sheet);
 if(!staged.ok)reasons.push(...staged.errors);
 const ch=hash({...candidate,status:'review'}),sh=hash(sheet);
 if(!qa||qa.stage!=='staged-draft'||qa.id!==candidate.id||qa.candidateHash!==ch||qa.sheetHash!==sh||qa.trial?.simulations!==18||qa.trial?.expected!==18)
  reasons.push('서명 대상과 일치하는 18회 재판 검증 기록이 없습니다.');
 if(qa?.warnings?.length)warnings.push(...qa.warnings);
 // A browser test is not the same as a prototype simulation.
 if(!browserQa||browserQa.id!==candidate.id||browserQa.sheetHash!==sh||browserQa.stage!=='browser-courtroom-QA'||!browserQa.passed)
  reasons.push('현행 6개 메뉴 브라우저 선고 완주 검증이 필요합니다.');
 const allText=JSON.stringify({source:sheet.source,card:sheet.card,worlds:sheet.worlds,open:sheet.open});
 if(FAIL_MARKERS.test(allText))reasons.push('미해결 검증 항목 또는 임시 문구가 남아 있습니다.');
 const fingerprint=draft.fingerprint;
 if(!Array.isArray(inventory)||inventory.some(x=>x.id===candidate.id||x.fingerprint===fingerprint))
  reasons.push('승인 재고에 중복 사건이 있거나 재고 형식이 올바르지 않습니다.');
 if(!Number.isInteger(policy.maxPerCategory)||policy.maxPerCategory<1||policy.maxPerCategory>500)
  reasons.push('사건 유형별 자동 재고 제한이 설정되지 않았습니다.');
 else if(inventory.filter(x=>x.category===candidate.card?.category).length>=policy.maxPerCategory)
  reasons.push('유형별 승인 재고 한도에 도달했습니다.');
 if(reasons.length)return {decision:'quarantine',reasons,warnings};
 if(HIGH_RISK.has(candidate.card.category)||policy.sampleAudit===true)
  return {decision:'audit',reasons:['고위험 분야 또는 표본 감사 대상'],warnings};
 // Even the 'pass' outcome is an unpublished inventory candidate, NOT public ready.
 record.id=candidate.id;record.category=candidate.card.category;record.fingerprint=fingerprint;
 record.candidateHash=ch;record.sheetHash=sh;record.status='staged-approved';record.published=false;
 return {decision:'stock',reasons:[],warnings,item:record};
}
module.exports={triage,HIGH_RISK};
