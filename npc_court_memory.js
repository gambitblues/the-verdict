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
  if(lost>=2&&lost>=won+2)return 'guarded';
  if(memory.cases>=2&&won>=3&&won>=lost+2)return 'respectful';
  return 'familiar';
 }
 function greeting(memory,style){
  const rel=relationship(memory);
  if(rel==='new')return '';
  if(rel==='rival')return '재판장님, 이 법정에서 여러 번 의견이 엇갈렸습니다. 이번에도 필요한 부분은 끝까지 다투겠습니다.';
  if(rel==='guarded')return '재판장님, 지난 재판에서 제 이의가 여러 차례 받아들여지지 않았습니다. 이번에는 신청 근거를 더 분명히 말씀드리겠습니다.';
  if(rel==='respectful')return '재판장님, 이전 재판에서도 쟁점을 충분히 살펴주셨습니다. 오늘도 필요한 부분만 분명히 말씀드리겠습니다.';
  if(strategy(memory)==='assertive')return '재판장님, 지난번처럼 쟁점을 분명히 하겠습니다. 필요한 경우 이의를 제기하겠습니다.';
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
  // Final avalanche prevents sequential day labels from clustering on one side
  // of the threshold; the same case/day still produces exactly the same roll.
  h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;
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
 /* Role-specific previous court participation. A witness counts only if the
  * judge actually heard their testimony; merely being assigned is not enough.
  * The supplied case roster is the current player's roster, never a global NPC log. */
 function participation(cases,roster,currentCaseId,personId,role){
  if(!personId||!['prosecutor','witness'].includes(role)||!Array.isArray(roster))return null;
  let count=0,heardCount=0;
  for(const c of roster){
   if(!c||c.id===currentCaseId)continue;
   const st=cases?.[c.id],trial=st?.trial4;
   if(!st?.verdict||!trial)continue;
   if(role==='prosecutor'){
    if(c.side?.[0]!==personId||!(c.kind==='criminal'||c.kind==='crim'||/형사/.test(String(c.kind||''))))continue;
    count++;
   }else{
    const indices=[];
    for(let i=0;i<(trial.witnesses||[]).length;i++)if(trial.witnesses[i]?.id===personId)indices.push(i);
    if(!indices.length)continue;
    const hearing=(trial.heard||[]).filter(h=>indices.includes(h.w)&&!h.struck&&!h.tainted);
    if(!hearing.length)continue;
    count++;
    heardCount+=hearing.length;
   }
  }
  return count?{role,cases:count,heard:heardCount}:null;
 }
 function participationLine(memory,style){
  if(!memory?.cases)return '';
  if(memory.role==='prosecutor')
   return memory.cases>1?'검사: 재판장님, 이전 사건들에서도 뵈었습니다. 이번 사건의 공소사실과 증거를 말씀드리겠습니다.'
    :'검사: 재판장님, 지난 사건에 이어 다시 뵙습니다. 이번 사건의 증거부터 말씀드리겠습니다.';
  if(memory.role==='witness')
   return memory.cases>1?'이전에도 이 법정에서 증언한 적이 있습니다. 오늘은 질문에 맞춰 답하겠습니다.'
    :'지난 사건에서도 이 법정에서 증언했습니다. 오늘도 제가 아는 범위에서 답하겠습니다.';
  return '';
 }
 root.VerdictCourtMemory={snapshot,greeting,relationship,rulingReaction,strategy,adaptCards,participation,participationLine};
})(typeof window!=='undefined'?window:globalThis);
