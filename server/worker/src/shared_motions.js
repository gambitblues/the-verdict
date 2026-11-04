/* Native opponent motions shared across two authenticated judges.
 * All proposals are deterministic per case/hearing and generated on the trusted
 * Worker. Browser sees a motion type/label, never its legal validity before reply.
 */
import '../../../trial_core.js';
const T=globalThis.VerdictTrialCore;
const MOTIONS={objection:'상대측의 증거·신문 이의신청',delay:'상대측의 기일 연기 신청'};
export function sharedMotions(sheet,caseId,hearingIndex){
 if(sheet?.format!=='verdict-world-sheet/v1'||typeof caseId!=='string'||
  !Number.isInteger(hearingIndex)||hearingIndex<1||hearingIndex>200)return [];
 const style=T.STYLES.includes(sheet.card?.opponentStyle)?
  sheet.card.opponentStyle:T.pick(T.STYLES,caseId+':opponent-style');
 return T.cards({style},hearingIndex,caseId+':shared-trial')
  .filter(card=>card.type==='objection'||card.type==='delay')
  .map(card=>({id:card.id,type:card.type,label:MOTIONS[card.type],valid:card.valid===true}));
}
export function publicSharedMotions(sheet,caseId,hearingIndex,actions=[]){
 return sharedMotions(sheet,caseId,hearingIndex).map(({id,type,label})=>({
  id,type,label,answered:actions.some(a=>a.action_type==='motion'&&a.action_key===id)
 }));
}
export function sharedMotionDecision(sheet,caseId,hearingIndex,key,choice){
 if(!['accept','reject'].includes(choice))return {error:'motion_choice_invalid'};
 const motion=sharedMotions(sheet,caseId,hearingIndex).find(c=>c.id===key);
 if(!motion)return {error:'motion_not_available'};
 return {key,response:{status:'done',type:motion.type,valid:motion.valid,choice}};
}
