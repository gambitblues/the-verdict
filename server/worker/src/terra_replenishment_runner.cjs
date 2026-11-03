/* THE VERDICT P3-15 — fail-closed, unattended replenishment orchestration.
 * No network, timers, database or model calls at import. An authenticated
 * server MUST inject lease, budget reservation, generation, browser QA,
 * independent verification and admission operations.
 */
'use strict';
const {plan}=require('./terra_replenishment_plan.cjs');
const REQUIRED=['loadSnapshot','acquireLease','reserveBudget','generateCandidate','runBrowserQA','reverify','admit','releaseLease'];
function validDeps(ops){return ops&&REQUIRED.every(x=>typeof ops[x]==='function');}
function safeResult(decision,reasons=[],extra={}){return {decision,reasons,...extra};}
async function runBatch({ops,policy={},runId}={}){
 if(!validDeps(ops))return {ok:false,stage:'configuration',errors:['독립 인증된 재고·예산·QA·적재 작업이 모두 연결되어야 합니다.'],processed:[]};
 if(!/^refill-[a-z0-9-]{6,80}$/.test(runId||''))return {ok:false,stage:'configuration',errors:['고유 실행 ID가 필요합니다.'],processed:[]};
 const lease=await ops.acquireLease(runId);
 if(!lease||lease.ok!==true||typeof lease.token!=='string'||!lease.token) return {ok:false,stage:'busy',errors:['단일 실행 잠금을 획득하지 못했습니다.'],processed:[]};
 const processed=[];let accountingFailed=false;
 try{
  const snapshot=await ops.loadSnapshot(lease.token);
  if(!snapshot||!Array.isArray(snapshot.inventory)||!Array.isArray(snapshot.inFlight)||!snapshot.budget)
   return {ok:false,stage:'snapshot',errors:['신뢰할 수 있는 현재 재고·비용 상태를 조회하지 못했습니다.'],processed};
  // Budget is retrieved from server-side ledger, never the invoking client.
  const effective={...policy,...snapshot.budget};
  const planned=plan({inventory:snapshot.inventory,inFlight:snapshot.inFlight,policy:effective});
  if(!planned.ok)return {ok:false,stage:'planning',errors:planned.errors,processed};
  for(const [index,request] of planned.requests.entries()){
   if(accountingFailed)break;
   let reservation;
   try{
    reservation=await ops.reserveBudget({runId,leaseToken:lease.token,request,ordinal:index,
     maxUsd:effective.maxEstimatedUsdPerCase,maxCalls:4});
    if(!reservation||reservation.ok!==true||typeof reservation.id!=='string') {
     processed.push({category:request.category,decision:'budget-blocked'});
     break; // Never start an unreserved AI request.
    }
    const generated=await ops.generateCandidate({request,reservation,leaseToken:lease.token,runId});
    if(!generated||generated.ok!==true||generated.candidate?.status!=='draft'||generated.sheet?.status!=='draft'){
     processed.push({category:request.category,decision:'quarantine',reason:'generation-failed'});break;
    }
    // Browser test must check the exact sheet, not just a fixture case.
    const browser=await ops.runBrowserQA({candidate:generated.candidate,sheet:generated.sheet,leaseToken:lease.token});
    if(!browser?.ok||browser.passed!==true){
     processed.push({category:request.category,decision:'quarantine',reason:'browser-failed'});break;
    }
    const verified=await ops.reverify({candidate:generated.candidate,sheet:generated.sheet,
     qa:generated.qa,browserQa:browser,leaseToken:lease.token});
    if(!verified?.ok||verified?.decision!=='stock'){
     processed.push({category:request.category,decision:verified?.decision==='audit'?'audit':'quarantine',reason:'verification-failed'});break;
    }
    const admitted=await ops.admit({candidate:generated.candidate,sheet:generated.sheet,
     verified,leaseToken:lease.token,runId});
    if(!admitted?.ok||!admitted.id||admitted.id!==generated.candidate.id){
     processed.push({category:request.category,decision:'quarantine',reason:'admission-failed'});break;
    }
    processed.push({category:request.category,id:admitted.id,decision:'stock'});
   }catch(e){
    processed.push({category:request.category,decision:'quarantine',reason:'operation-error'});
    break; // fail closed; do not reveal hidden truth / provider error to caller.
   }finally{
    if(reservation?.id&&typeof ops.closeReservation==='function'){
     try{await ops.closeReservation({reservation,runId,leaseToken:lease.token})}
     catch{accountingFailed=true;processed.push({category:request.category,decision:'reservation-close-failed'});}
    }
   }
  }
  return {ok:processed.every(x=>x.decision==='stock'),stage:'completed',planned:planned.requests.length,processed};
 }finally{
  await ops.releaseLease({runId,leaseToken:lease.token});
 }
}
module.exports={runBatch,REQUIRED};
