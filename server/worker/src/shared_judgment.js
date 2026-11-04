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
  if(a.action_type==='order')allowed.set('order:'+a.action_key,a.response.title||a.action_key);
 }
 const citations=[...new Set(input.citations)];
 if(citations.length!==input.citations.length||citations.some(c=>typeof c!=='string'||!allowed.has(c)))
  return {error:'citation_not_in_record'};
 // The wording intentionally contains no client-authored facts, fabricated sentence
 // or untrusted legal determination beyond the judge's selected lawful option.
 const order=WORDS[result];
 const evidence=citations.map(k=>({key:k,title:String(allowed.get(k)).slice(0,150)}));
 return {result,order,citations,evidence};
}
export async function sharedJudgmentHash(caseId,judgeId,judgment){
 const text=JSON.stringify({caseId,judgeId,result:judgment.result,order:judgment.order,citations:judgment.citations});
 const bytes=new TextEncoder().encode(text);
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
