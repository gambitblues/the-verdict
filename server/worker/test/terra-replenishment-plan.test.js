import test from 'node:test';import assert from 'node:assert/strict';
import P from '../src/terra_replenishment_plan.cjs';
const policy={minPerCategory:2,targetPerCategory:3,maxNewCasesPerRun:4,usedCallsToday:0,maxCallsToday:12,usedUsdToday:0,maxUsdToday:3,maxEstimatedUsdPerCase:1};
test('stock deficit plans only within both money and API-call caps',()=>{
 const s=P.plan({policy});
 assert.equal(s.ok,true);assert.equal(s.requests.length,3);
 assert.equal(s.requests.length<=Math.floor((policy.maxCallsToday-policy.usedCallsToday)/2),true);
});
test('in-flight candidates count against stock target',()=>{
 const work=[{id:'f-01',category:'financial'},{id:'f-02',category:'financial'}];
 const s=P.plan({policy:{...policy,minPerCategory:2},inFlight:work});
 assert.ok(s.ok);assert.ok(!s.requests.some(x=>x.category==='financial'));
});
test('fail closed if budget missing or depleted',()=>{
 assert.equal(P.plan({policy:{...policy,usedUsdToday:3}}).requests.length,0);
 assert.equal(P.plan({policy:{...policy,maxCallsToday:0}}).requests.length,0);
 assert.equal(P.plan({policy:{...policy,maxUsdToday:undefined}}).ok,false);
});
test('duplicate shared event ID rejects plan',()=>{
 const item={id:'same-case',category:'civil'};
 assert.equal(P.plan({policy,inventory:[item],inFlight:[item]}).ok,false);
});
