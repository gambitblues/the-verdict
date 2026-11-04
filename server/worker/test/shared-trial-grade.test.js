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

test('Shared evidence decisions and reasons use the same native legal skill rules',()=>{
 const base={result:'claim_granted',citations:['initial:r1'],sentence:{amount:1000}};
 const before=adjudicateSharedJudgment(sheet,[],base,'case-evidence');
 const ruled=adjudicateSharedJudgment(sheet,[{
  action_type:'evidence_decision',action_key:'r1:1',hearing_index:1,
  response:{status:'done',recordId:'r1',decision:'conditional'}
 }],{...base,reasons:['strong']},'case-evidence');
 assert.equal(ruled.error,undefined);
 assert.deepEqual(ruled.reasons,['strong']);
 assert.ok(ruled.grade.items.some(i=>i.key==='reason:strong'));
 assert.notEqual(ruled.grade.score,before.grade.score,'lawful conditions and stated reasons affect legal skill');
 const excluded=adjudicateSharedJudgment(sheet,[{
  action_type:'evidence_decision',action_key:'r1:1',hearing_index:1,
  response:{status:'done',recordId:'r1',decision:'exclude'}
 }],base,'case-evidence');
 assert.equal(excluded.error,'excluded_evidence_cannot_be_cited');
});

test('same native core recognizes consistent recorded testimony without fictional witness traits',()=>{
 const doc=structuredClone(sheet);doc.questions=[
  {id:'q1',q:'계약을 확인했습니까?',review:{side:'p'},issue:'contract'},
  {id:'q2',q:'계약금 지급을 보았습니까?',review:{side:'p'},issue:'contract'}
 ];
 const actions=[
  {action_type:'question',action_key:'q1',response:{status:'done',answer:'확인했습니다.'}},
  {action_type:'question',action_key:'q2',response:{status:'done',answer:'지급을 보았습니다.'}}
 ];
 const input={result:'claim_granted',citations:['initial:r1','question:q1','question:q2'],
  reasons:['consistent'],sentence:{amount:1000}};
 const d=adjudicateSharedJudgment(doc,actions,input,'parity-questions');
 assert.equal(d.error,undefined);
 assert.equal(d.grade.method,'VerdictTrialCore.skill/evaluate');
 const reason=d.grade.items.find(i=>i.key==='reason:consistent');
 assert.equal(reason?.points,4);
});
test('ruling without legal-evidence metadata is rejected, not silently assumed reliable',()=>{
 const doc=structuredClone(sheet);delete doc.records[0].review;
 const action={action_type:'evidence_decision',action_key:'r1:1',hearing_index:1,
  response:{status:'done',recordId:'r1',decision:'exclude'}};
 // Use testimony as the legal citation so the excluded record is not cited.
 doc.questions=[{id:'q1',q:'기록을 확인했습니까?',review:{side:'p'}}];
 const d=adjudicateSharedJudgment(doc,[action,{action_type:'question',action_key:'q1',
  response:{status:'done',answer:'확인했습니다.'}}],{
  result:'claim_denied',citations:['question:q1']
 },'ruling-metadata');
 assert.equal(d.error,'evidence_review_metadata_required');
});
