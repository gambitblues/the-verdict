import test from 'node:test';
import assert from 'node:assert/strict';
import {freeOrderPrompt,verifyFreeOrderReply,freeOrderCatalog} from '../src/free_order_intent.js';

const sheet={
 records:[
  {id:'r-initial',title:'사고 최초 감정서',first:true},
  {id:'r-cctv',title:'식당 CCTV 원본',kind:'영상',first:false,unlock:'사고 전 식당 CCTV 원본',how:'영업장 보관'},
  {id:'r-phone',title:'통화기록',first:false,unlock:'통신사 기록'}
 ],
 orders:[{record:'r-cctv',ask:'식당 CCTV 요청'}],
 worlds:{did:{records:{'r-cctv':'NEVER_LEAK_THIS_HIDDEN_FACT'}},didnt:{act:'NEVER_LEAK_TRUTH'}}
};
test('free-order AI sees only public record descriptors and never any hidden branch',()=>{
 const p=freeOrderPrompt('사고 직전에 들렀던 식당의 CCTV 영상을 제출하도록 하세요.',sheet);
 assert.equal(p.catalog.length,2);
 assert.equal(p.catalog.some(r=>r.id==='r-initial'),false);
 assert.ok(p.input.includes('식당 CCTV'));
 assert.ok(!JSON.stringify(p).includes('NEVER_LEAK'));
 assert.equal(p.schema.name,'judicial_order_intent');
});
test('AI cannot invent evidence, cause, or a non-orderable record',()=>{
 assert.deepEqual(verifyFreeOrderReply(sheet,{intent:'request_record',recordId:'r-cctv',explanation:'CCTV 원본에 대한 주문'}),{
  ok:true,matched:true,recordId:'r-cctv'
 });
 assert.equal(verifyFreeOrderReply(sheet,{intent:'request_record',recordId:'r-nonexistent',explanation:''}).error,'fabricated_record');
 assert.equal(verifyFreeOrderReply(sheet,{intent:'request_record',recordId:'r-phone',explanation:''}).error,'record_not_orderable');
 assert.equal(verifyFreeOrderReply(sheet,{intent:'request_record',recordId:'r-initial',explanation:''}).error,'fabricated_record');
 assert.deepEqual(verifyFreeOrderReply(sheet,{intent:'outside_scope',recordId:'NONE',explanation:'기존 기록에 없음'}),{
  ok:true,matched:false,reason:'outside_scope'
 });
 assert.equal(verifyFreeOrderReply(sheet,{intent:'outside_scope',recordId:'r-cctv',explanation:''}).error,'invalid_unmapped_record');
});
test('ambiguous or exceptionally long orders cannot invoke the AI',()=>{
 assert.equal(freeOrderPrompt('자료 줘',sheet).error,'order_length_invalid');
 assert.equal(freeOrderPrompt('가'.repeat(601),sheet).error,'order_length_invalid');
 assert.equal(freeOrderPrompt('관련 자료를 제출하세요.',{records:[]}).error,'no_orderable_records');
});
