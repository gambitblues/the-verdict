import {adjudicateFullSentence} from './shared_ancillary.js';
import {evaluateSharedTrial} from './shared_trial_grade.js';
/* THE VERDICT P4 shared-world judgment validation.
 * Input contains ONLY the judge's chosen disposition and citation keys.
 * The server verifies each cited item was actually disclosed in court.
 * The canonical order and audit hash are generated server-side.
 */
const CRIMINAL=new Set(['guilty','acquittal','partial']);
const CIVIL=new Set(['claim_granted','claim_denied','partial','settled']);
const DECISION=new Set(['decision_yes','decision_no']);
const WORDS={
 guilty:'피고인을 유죄로 인정한다.',
 acquittal:'피고인에게 무죄를 선고한다.',
 partial:'일부 청구 또는 혐의에 한하여 인정한다.',
 claim_granted:'원고의 청구를 인용한다.',
 claim_denied:'원고의 청구를 기각한다.',
 settled:'당사자들의 화해를 확인한다.',
 decision_yes:'신청을 인용한다.',
 decision_no:'신청을 기각한다.'
};
export function validateSharedJudgment(sheet,actions,input){
 if(!sheet||typeof sheet!=='object'||!Array.isArray(actions)||!input||typeof input!=='object')
  return {error:'judgment_invalid'};
 const kind=sheet.card?.kind;
 const choices=kind==='criminal'?CRIMINAL:kind==='decision'?DECISION:CIVIL;
 const result=input.result;
 if(!choices.has(result))return {error:'judgment_choice_invalid'};
 if(!Array.isArray(input.citations)||input.citations.length<1||input.citations.length>20)
  return {error:'citations_required'};
 const allowed=new Map();
 for(const r of sheet.records||[]){
  if(r.first===true)allowed.set('initial:'+r.id,r.title||r.id);
 }
 for(const a of actions){
  if(a.response?.status!=='done')continue;
  if(a.action_type==='question')allowed.set('question:'+a.action_key,'증인신문 '+a.action_key);
  if(a.action_type==='order_result')allowed.set('order:'+a.action_key,a.response.title||a.action_key);
 }
 const citations=[...new Set(input.citations)];
 if(citations.length!==input.citations.length||citations.some(c=>typeof c!=='string'||!allowed.has(c)))
  return {error:'citation_not_in_record'};
 // Native evidence treatment: a chair may exclude evidence from use in the verdict.
 // The latest *server recorded* hearing controls, not a client-supplied decision.
 const rulings=new Map();
 for(const action of actions){
  if(action.action_type==='evidence_decision'&&
   ['use','conditional','exclude'].includes(action.response?.decision)&&
   typeof action.response.recordId==='string'){
   const id=action.response.recordId;
   if(!rulings.has(id)||Number(action.hearing_index||0)>=rulings.get(id).hearing)
    rulings.set(id,{hearing:Number(action.hearing_index||0),decision:action.response.decision});
  }
 }
 if(citations.some(c=>c.startsWith('initial:')||c.startsWith('order:')?
   rulings.get(c.split(':').slice(1).join(':'))?.decision==='exclude':false))
  return {error:'excluded_evidence_cannot_be_cited'};
 const validReasons=new Set(['strong','flawed','illegal','discord','consistent','doubt']);
 const reasons=input.reasons===undefined?[]:input.reasons;
 if(!Array.isArray(reasons)||reasons.length>6||
  new Set(reasons).size!==reasons.length||reasons.some(x=>!validReasons.has(x)))
  return {error:'verdict_reasons_invalid'};
 // The wording intentionally contains no client-authored facts, fabricated sentence
 // or untrusted legal determination beyond the judge's selected lawful option.
 const order=WORDS[result];
 const evidence=citations.map(k=>({key:k,title:String(allowed.get(k)).slice(0,150)}));
 return {result,order,citations,evidence,reasons};
}
/* Fail closed when scored grading is enabled: no phantom sentence, evidence
 * grading metadata, public-opinion result or unauthorized monetary award. */
export function adjudicateSharedJudgment(sheet,actions,input,seed,options={}){
 const decision=validateSharedJudgment(sheet,actions,input);
 if(decision.error)return decision;
 const sentence=adjudicateFullSentence(sheet,decision.result,input.sentence,decision.citations,options.branch);
 if(sentence.error)return {error:sentence.error};
 const judgment={...decision,order:sentence.order||decision.order,
  sentence:sentence.sentence};
 const grade=evaluateSharedTrial(sheet,actions,judgment,sentence,seed);
 if(grade.error)return {error:grade.error};
 return {...judgment,grade};
}
export async function sharedJudgmentHash(caseId,judgeId,judgment){
 const text=JSON.stringify({caseId,judgeId,result:judgment.result,order:judgment.order,citations:judgment.citations,reasons:judgment.reasons,...(judgment.sentence?{sentence:judgment.sentence}:{}),...(judgment.grade?{skill:judgment.grade.score,review:judgment.grade.review}:{})});
 const bytes=new TextEncoder().encode(text);
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
