import test from 'node:test';
import assert from 'node:assert/strict';
import A from '../src/terra_auto_triage.cjs';
test('unverified AI-produced case never enters stock',()=>{
 const result=A.triage({candidate:{id:'terra-test-001',status:'draft',card:{category:'financial'}},sheet:{status:'draft'}});
 assert.equal(result.decision,'quarantine');assert.ok(result.reasons.length);
});
test('publication is never granted by classifier alone',()=>{
 const source=A.triage.toString();
 assert.ok(source.includes("published=false"));
 assert.ok(!source.includes("status='ready'"));
});
test('sensitive cases are explicitly marked for sampling/audit',()=>{
 assert.ok(A.HIGH_RISK.has('sexual'));assert.ok(A.HIGH_RISK.has('homicide'));assert.ok(A.HIGH_RISK.has('professional'));
});
