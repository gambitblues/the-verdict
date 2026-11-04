import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSharedTrial} from '../src/shared_trial_grade.js';
import {adjudicateSharedJudgment} from '../src/shared_judgment.js';
const sheet={card:{kind:'civil',claim:{amount:1000,fair:[500,850]}},
 records:[{id:'r1',title:'계약서 원본',first:true,
 review:{strength:75,flaw:0,flawType:'none',side:'p'}}],
 questions:[]};
test('P4 server uses the exact native VerdictTrialCore.skill/evaluate implementation',()=>{
 const input={result:'claim_granted',citations:['initial:r1'],sentence:{amount:1000}};
 const one=adjudicateSharedJudgment(sheet,[],input,'case-score');
 const two=adjudicateSharedJudgment(sheet,[],input,'case-score');
 assert.equal(one.error,undefined);
 assert.equal(one.grade.method,'VerdictTrialCore.skill/evaluate');
 assert.equal(one.grade.score,69);
 assert.deepEqual(one.grade,two.grade);
 assert.equal(one.sentence.amount,1000);
 assert.match(one.order,/1,000만 원/);
});
test('P4 cannot invent grading values absent from authored evidence',()=>{
 const broken=structuredClone(sheet);delete broken.records[0].review;
 const result=adjudicateSharedJudgment(broken,[],{
  result:'claim_granted',citations:['initial:r1'],sentence:{amount:1000}
 },'case-score');
 assert.equal(result.error,'evidence_review_metadata_required');
});
test('P4 native score refuses undisclosed documents and illegal cite',()=>{
 const bad=adjudicateSharedJudgment(sheet,[],{
  result:'claim_granted',citations:['order:r2'],sentence:{amount:1000}
 },'case-score');
 assert.equal(bad.error,'citation_not_in_record');
 const illegal=structuredClone(sheet);
 illegal.records[0].review={strength:70,flaw:60,flawType:'illegal',side:'p'};
 const scored=adjudicateSharedJudgment(illegal,[],{
  result:'claim_granted',citations:['initial:r1'],sentence:{amount:1000}
 },'case-score');
 assert.ok(scored.grade.score<69);
});
