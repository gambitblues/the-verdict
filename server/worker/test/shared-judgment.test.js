import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSharedJudgment,sharedJudgmentHash} from '../src/shared_judgment.js';

const sheet={card:{kind:'criminal'},records:[{id:'r1',title:'처음 공개된 감정서',first:true},{id:'r2',title:'나중에 낸 CCTV',first:false}]};
const actions=[
 {action_type:'question',action_key:'q1',response:{status:'done',answer:'보았습니다'}},
 {action_type:'order',action_key:'r2',response:{status:'declined',title:'CCTV'}},
 {action_type:'order_result',action_key:'r3',response:{status:'done',title:'제출 자료'}}
];
test('P4 verdict uses only disclosed and successfully obtained evidence',async()=>{
 const x=validateSharedJudgment(sheet,actions,{result:'guilty',citations:['initial:r1','question:q1','order:r3'],order:'ATTACK'});
 assert.equal(x.order,'피고인을 유죄로 인정한다.');
 assert.deepEqual(x.citations,['initial:r1','question:q1','order:r3']);
 assert.ok(!JSON.stringify(x).includes('ATTACK'));
 const hash=await sharedJudgmentHash('case-p4','judge-a',x);
 assert.match(hash,/^[0-9a-f]{64}$/);
 assert.equal(hash,await sharedJudgmentHash('case-p4','judge-a',x));
 assert.notEqual(hash,await sharedJudgmentHash('case-p4','judge-b',x));
});
test('P4 verdict rejects fake testimony, unreleased exhibits and unauthorized result',()=>{
 const check=(result,citations)=>validateSharedJudgment(sheet,actions,{result,citations});
 assert.equal(check('guilty',['initial:r2']).error,'citation_not_in_record');
 assert.equal(check('guilty',['order:r2']).error,'citation_not_in_record');
 assert.equal(check('guilty',['question:unknown']).error,'citation_not_in_record');
 assert.equal(check('guilty',['initial:r1','initial:r1']).error,'citation_not_in_record');
 assert.equal(check('claim_granted',['initial:r1']).error,'judgment_choice_invalid');
 assert.equal(check('guilty',[]).error,'citations_required');
});
