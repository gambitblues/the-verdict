import test from 'node:test';
import assert from 'node:assert/strict';
import {datesIn,checkArticle} from '../src/prompts.js';

const p={
 title:'법원, 2026.12.21 사건 선고',
 body:'2026.12.21 발생한 사건을 법원이 심리했다. 증거를 검토한 뒤 당사자에게 판결 내용을 전달했다.',
};
const body='법원은 2026년 12월 21일 발생한 사건의 증거와 당사자 진술을 살펴봤다고 설명했다. 이어 법원은 관련 절차에 따라 사건을 심리했고 당사자들에게 최종 판단 내용을 전달했다고 밝혔다.';
test('same calendar day across Korean and dotted notation',()=>{
 assert.deepEqual(datesIn('2026.12.21'),datesIn('2026년 12월 21일'));
 assert.equal(checkArticle(p,{title:'법원 사건 선고',body}).ok,true);
});
test('changed or omitted date is rejected',()=>{
 assert.equal(checkArticle(p,{title:'법원 사건 선고',body:body.replace('21일','22일')}).why,'dates');
 assert.equal(checkArticle(p,{title:'법원 사건 선고',body:body.replace('2026년 12월 21일','당일')}).why,'dates');
});
test('new unrelated number remains blocked',()=>{
 assert.equal(checkArticle(p,{title:'법원 사건 선고',body:body+' 추가로 999건이 접수됐다.'}).why,'numbers');
});
