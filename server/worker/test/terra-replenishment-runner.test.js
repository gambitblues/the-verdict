import test from 'node:test';import assert from 'node:assert/strict';
import Runner from '../src/terra_replenishment_runner.cjs';
const budget={minPerCategory:1,targetPerCategory:1,maxNewCasesPerRun:1,maxCallsToday:4,usedCallsToday:0,
 maxUsdToday:2,usedUsdToday:0,maxEstimatedUsdPerCase:1};
const base=()=>({loadSnapshot:async()=>({inventory:[],inFlight:[],budget}),
 acquireLease:async()=>({ok:true,token:'lease-test'}),releaseLease:async()=>{},
 reserveBudget:async()=>({ok:true,id:'reservation-1'}),
 generateCandidate:async()=>({ok:true,candidate:{id:'terra-test-011',status:'draft'},sheet:{status:'draft'}}),
 runBrowserQA:async()=>({ok:true,passed:true}),
 reverify:async()=>({ok:true,decision:'stock'}),
 admit:async()=>({ok:true,id:'terra-test-011'})});
test('production never starts without server-only operations',async()=>{
 const result=await Runner.runBatch({ops:{},runId:'refill-test-0001'});assert.equal(result.ok,false);
});
test('budget reservation precedes any generation and release happens after',async()=>{
 const order=[],ops=base();
 for(const name of ['acquireLease','loadSnapshot','reserveBudget','generateCandidate','runBrowserQA','reverify','admit','releaseLease']){
  const prev=ops[name];ops[name]=async(...args)=>{order.push(name);return prev(...args)};
 }
 const r=await Runner.runBatch({ops,runId:'refill-test-0002'});
 assert.equal(r.ok,true,JSON.stringify(r));assert.deepEqual(order,
 ['acquireLease','loadSnapshot','reserveBudget','generateCandidate','runBrowserQA','reverify','admit','releaseLease']);
});
test('no AI generation on denied budget; lease still released',async()=>{
 let generated=0,released=0;const ops=base();
 ops.reserveBudget=async()=>({ok:false});ops.generateCandidate=async()=>{generated++;throw Error('not expected')};
 ops.releaseLease=async()=>{released++};
 const out=await Runner.runBatch({ops,runId:'refill-test-0003'});
 assert.equal(out.ok,false);assert.equal(generated,0);assert.equal(released,1);
});
test('a missing browser QA blocks admission',async()=>{
 let admissions=0;const ops=base();ops.runBrowserQA=async()=>({ok:false});
 ops.admit=async()=>{admissions++;throw Error('invalid')};
 const out=await Runner.runBatch({ops,runId:'refill-test-0004'});
 assert.equal(out.ok,false);assert.equal(admissions,0);assert.equal(out.processed[0].decision,'quarantine');
});
test('concurrent worker cannot generate when exclusive lease fails',async()=>{
 let requested=0;const ops=base();
 ops.acquireLease=async()=>({ok:false});ops.generateCandidate=async()=>{requested++};
 const out=await Runner.runBatch({ops,runId:'refill-test-0005'});
 assert.equal(out.stage,'busy');assert.equal(requested,0);
});

test('budget accounting failure halts further batches',async()=>{
 let calls=0;const ops=base();const snap=ops.loadSnapshot;
 ops.loadSnapshot=async()=>({...await snap(),budget:{...budget,maxNewCasesPerRun:2,maxCallsToday:12,maxUsdToday:3}});
 ops.closeReservation=async()=>{throw Error('ledger offline')};
 ops.generateCandidate=async()=>{calls++;return {ok:true,candidate:{id:'terra-test-011',status:'draft'},sheet:{status:'draft'}}};
 const result=await Runner.runBatch({ops,runId:'refill-test-0006'});
 assert.equal(calls,1);assert.equal(result.ok,false);
 assert.ok(result.processed.some(x=>x.decision==='reservation-close-failed'));
});
