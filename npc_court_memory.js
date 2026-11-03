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
   // The persistent log contains rulings from every hearing; cards only hold the current day.
   const rulings=(t.log||[]).filter(e=>e.kind==='이의');
   if(rulings.length){
    for(const entry of rulings){
     const line=String(entry.text||'');
     if(/받아들이지 않음|기각/.test(line))rejected++;
     else if(/받아들임/.test(line))accepted++;
    }
   }else{
    // Backward compatibility for older trial saves that lack decision logs.
    for(const card of t.cards||[]){
     if(card.type!=='objection')continue;
     if(card.choice==='accept')accepted++;
     else if(card.choice==='reject')rejected++;
    }
   }
   // The trial log survives from previous sessions, unlike t.cards (current hearing only).
   // A card's historic outcome is not inferred from the verdict or from unrelated actions.
   const at=Number(t.startedAt)||0;
   if(!last||at>last.at)last={id,at};
  }
  if(!hearings)return null;
  return {cases:hearings,accepted,rejected,lastCaseId:last?.id||null};
 }
 /* Relationship means observable courtroom familiarity, not personal friendship or
  * moral approval. It uses prior completed hearings and past objection rulings only. */
 function relationship(memory){
  if(!memory||memory.cases<1)return 'new';
  const won=Number(memory.accepted)||0,lost=Number(memory.rejected)||0;
  if(memory.cases>=3&&won>=2&&lost>=2)return 'rival';
  if(lost>=3&&lost>=won+2)return 'guarded';
  if(memory.cases>=2&&won>=3&&won>=lost+2)return 'respectful';
  return 'familiar';
 }
 function greeting(memory,style){
  const rel=relationship(memory);
  if(rel==='new')return '';
  if(rel==='rival')return '재판장님, 이 법정에서 여러 번 의견이 엇갈렸습니다. 이번에도 필요한 부분은 끝까지 다투겠습니다.';
  if(rel==='guarded')return '재판장님, 지난 재판에서 제 이의가 여러 차례 받아들여지지 않았습니다. 이번에는 신청 근거를 더 분명히 말씀드리겠습니다.';
  if(rel==='respectful')return '재판장님, 이전 재판에서도 쟁점을 충분히 살펴주셨습니다. 오늘도 필요한 부분만 분명히 말씀드리겠습니다.';
  if(style==='aggressive')return '재판장님, 다시 뵙습니다. 이번 사건에서도 쟁점은 분명하게 다투겠습니다.';
  if(style==='meticulous')return '재판장님, 다시 뵙습니다. 오늘은 제출된 기록부터 차근차근 짚겠습니다.';
  return '재판장님, 이전 재판에서도 뵈었습니다. 이번 사건은 기록에 따라 말씀드리겠습니다.';
 }
 /* Only after an actual ruling. A different relationship changes the response,
  * never the underlying court ruling or the admissibility of a witness's answer. */
 function rulingReaction(memory,choice){
  const rel=relationship(memory);
  if(rel==='new'||!['accept','reject'].includes(choice))return '';
  if(choice==='accept'){
   if(rel==='rival')return '이 부분은 기록에서 분명히 구분해 두겠습니다.';
   if(rel==='guarded')return '재판부 판단에 따르겠습니다. 다음 질문은 더 신중히 하겠습니다.';
   if(rel==='respectful')return '감사합니다. 해당 부분은 더 묻지 않겠습니다.';
   return '알겠습니다. 질문을 정리하겠습니다.';
  }
  if(rel==='rival')return '이견은 기록에 남기고, 다음 질문으로 넘어가겠습니다.';
  if(rel==='guarded')return '알겠습니다. 이후에는 근거를 더 명확히 제시하겠습니다.';
  if(rel==='respectful')return '취지는 알겠습니다. 다음 쟁점으로 넘어가겠습니다.';
  return '알겠습니다. 신문을 계속하겠습니다.';
 }
 /* A repeated courtroom history changes how often an opponent raises an objection,
  * never whether that objection has merit. This is deterministic per case/day.
  * Do not inspect the hidden truth, future evidence, or any judge's verdict. */
 function strategy(memory){
  if(!memory||memory.cases<1)return 'steady';
  if(memory.rejected>=2&&memory.rejected>memory.accepted)return 'cautious';
  if(memory.accepted>=2&&memory.accepted>memory.rejected)return 'assertive';
  return 'steady';
 }
 function chance(seed){
  let h=2166136261;
  for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}
  return (h>>>0)/4294967296;
 }
 function adaptCards(cards,memory,seed,day){
  const existing=Array.isArray(cards)?cards:[],mode=strategy(memory);
  if(mode==='steady')return existing;
  // Fewer discretionary objections after repeated overrulings.
  if(mode==='cautious')
   return existing.filter(c=>c.type!=='objection'||chance(seed+':p2:careful:'+day+':'+c.id)>=0.5);
  // A lawyer whose objections were repeatedly sustained is more willing to raise
  // one at this hearing; the regular trial engine still determines its legal merit.
  if(existing.some(c=>c.type==='objection')||chance(seed+':p2:confident:'+day)>=0.3)return existing;
  return [...existing,{id:'d'+day+'-obj',type:'objection',choice:null}];
 }
 root.VerdictCourtMemory={snapshot,greeting,relationship,rulingReaction,strategy,adaptCards};
})(typeof window!=='undefined'?window:globalThis);
