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
 function greeting(memory){
  if(!memory||memory.cases<1)return '';
  if(strategy(memory)==='cautious')return '재판장님, 지난 재판에서 제 이의가 여러 차례 받아들여지지 않았습니다. 이번에는 신청 근거를 더 분명히 말씀드리겠습니다.';
  if(strategy(memory)==='assertive')return '재판장님, 지난번처럼 쟁점을 분명히 하겠습니다. 필요한 경우 이의를 제기하겠습니다.';
  return '재판장님, 이전 재판에서도 뵈었습니다. 이번 사건은 기록에 따라 차분히 말씀드리겠습니다.';
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
 root.VerdictCourtMemory={snapshot,greeting,strategy,adaptCards};
})(typeof window!=='undefined'?window:globalThis);
