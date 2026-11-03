/* THE VERDICT — P2 recurring courtroom opponent memory.
 * Only completed cases in the current player's save may contribute.
 * This is presentation data, never a change to objection validity, case truth, or verdict.
 * Pure, deterministic and API-free: reuse actual history instead of spending AI tokens.
 */
(function(root){
 'use strict';
 function snapshot(cases,currentCaseId,opponentId){
  if(!opponentId||!cases||typeof cases!=='object')return null;
  let hearings=0,accepted=0,rejected=0,last=null;
  for(const [id,st] of Object.entries(cases)){
   const t=st?.trial4;
   if(id===currentCaseId||!st?.verdict||!t||t.opponent!==opponentId)continue;
   hearings++;
   for(const card of t.cards||[]){
    if(card.type!=='objection')continue;
    if(card.choice==='accept')accepted++;
    else if(card.choice==='reject')rejected++;
   }
   // The trial log survives from previous sessions, unlike t.cards (current hearing only).
   // A card's historic outcome is not inferred from the verdict or from unrelated actions.
   const at=Number(t.startedAt)||0;
   if(!last||at>last.at)last={id,at};
  }
  if(!hearings)return null;
  return {cases:hearings,accepted,rejected,lastCaseId:last?.id||null};
 }
 function greeting(memory){
  if(!memory||memory.cases<1)return '';
  if(memory.rejected>=2)return '재판장님, 지난 재판에서 제 이의가 여러 차례 받아들여지지 않았습니다. 이번에는 신청 근거를 더 분명히 말씀드리겠습니다.';
  if(memory.accepted>=2)return '재판장님, 지난번처럼 쟁점을 분명히 하겠습니다. 필요한 경우 이의를 제기하겠습니다.';
  return '재판장님, 이전 재판에서도 뵈었습니다. 이번 사건은 기록에 따라 차분히 말씀드리겠습니다.';
 }
 root.VerdictCourtMemory={snapshot,greeting};
})(typeof window!=='undefined'?window:globalThis);
