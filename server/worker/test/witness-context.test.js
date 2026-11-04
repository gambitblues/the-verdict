import test from 'node:test';
import assert from 'node:assert/strict';
import {npcPrompt,checkNpc} from '../src/prompts.js';

test('case-specific witness context is included without inventing evidence',()=>{
 const p={caseName:'가상 임대차 보증금 반환',issue:'반환 약정과 지급시기',witnessName:'김현수',
 role:'계약 현장 목격자',witnessKnowledge:'계약서 서명 현장을 직접 봄',witnessInterest:'당사자와 지인',
 previousAnswers:[{question:'서명했나요?',answer:'서명하는 모습은 봤습니다.'}],
 question:'지급 날짜를 직접 확인했습니까?',answer:'저는 지급 날짜를 직접 확인하지 못했습니다.'};
 const prompt=npcPrompt(p);
 assert.match(prompt.input,/가상 임대차 보증금 반환/);
 assert.match(prompt.input,/반환 약정과 지급시기/);
 assert.match(prompt.input,/김현수/);
 assert.match(prompt.input,/서명하는 모습은 봤습니다/);
 assert.match(prompt.input,/지급 날짜를 직접 확인했습니까/);
 assert.match(prompt.instructions,/새로운/);
 assert.equal(checkNpc({...p,names:['김현수']},{text:'저는 지급 날짜를 직접 확인하지 못했습니다.'}).ok,true);
});

test('missing core question or answer never initiates generation',()=>{
 assert.equal(npcPrompt({caseName:'사건',answer:'답변'}).error,'missing_text');
 assert.equal(npcPrompt({question:'질문'}).error,'missing_text');
});
