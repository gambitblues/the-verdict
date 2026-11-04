import test from 'node:test';
import assert from 'node:assert/strict';
import {npcDeliberationPrompt,validateNpcOpinion} from '../src/p5_npc_deliberation.js';
const sheet={
 card:{kind:'criminal',title:'교통사고 사망'},
 records:[{id:'r1',title:'사고감정서',first:true}],
 worlds:{did:{records:{r1:'SEALED_TRUE_NOT_FOR_AI'},act:'SEALED_ACT'}},
 questions:[{id:'q1',a:{did:'SECRET_ANSWER'}}]
};
test('NPC AI receives disclosed record only, no sealed truth or human votes',()=>{
 const p=npcDeliberationPrompt(sheet,[
  {action_type:'question',action_key:'q1',response:{status:'done',answer:'마지막 신호를 보았습니다.'}},
  {action_type:'order',action_key:'r2',response:{status:'delayed',title:'비공개 CCTV'}},
  {action_type:'order_result',action_key:'r3',response:{status:'done',text:'실제 제출된 동영상'}}
 ],{name:'정의로운 재판관',privateRelations:['INTERNAL']});
 assert.ok(p.input.includes('실제 제출된 동영상'));
 assert.ok(!JSON.stringify(p).includes('SEALED_'));
 assert.ok(!JSON.stringify(p).includes('SECRET_'));
 assert.ok(!JSON.stringify(p).includes('INTERNAL'));
 assert.ok(!JSON.stringify(p).includes('비공개 CCTV'));
 assert.equal(p.schema.name,'p5_npc_deliberation');
 assert.deepEqual(p.schema.schema.properties.choice.enum,['guilty','acquittal','partial']);
});
test('NPC sees disclosed text with court-adjudicated admissibility, never unreleased truth',()=>{
 const p=npcDeliberationPrompt(sheet,[{
  action_type:'evidence_decision',action_key:'r1:1',hearing_index:1,
  response:{status:'done',recordId:'r1',decision:'exclude'}
 }],{name:'재판관'},[{id:'r1',title:'사고감정서',text:'법정에서 제출된 감정서 내용'}]);
 assert.ok(p.input.includes('법정에서 제출된 감정서 내용'));
 assert.ok(p.input.includes('"admissibility":"exclude"'));
 assert.ok(p.instructions.includes('must not support a finding of fact'));
 assert.ok(!p.input.includes('SEALED_TRUE_NOT_FOR_AI'));
});
test('NPC structured opinion cannot set an unauthorized outcome',()=>{
 assert.deepEqual(validateNpcOpinion('civil',{choice:'partial',reason:'공개된 자료만으로 판단하면 일부만 인정할 수 있습니다.'}),{
  choice:'partial',reason:'공개된 자료만으로 판단하면 일부만 인정할 수 있습니다.'
 });
 assert.equal(validateNpcOpinion('criminal',{choice:'claim_granted',reason:'제공된 사유가 충분히 있습니다.'}).error,'invalid_npc_opinion');
 assert.equal(validateNpcOpinion('criminal',{choice:'guilty',reason:'짧음'}).error,'invalid_npc_opinion');
});
