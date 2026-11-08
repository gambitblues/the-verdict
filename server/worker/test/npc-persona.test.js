/* 2026-11-08: a witness speaks like themselves — age, job and tie to the case go into the wording request */
import test from 'node:test';
import assert from 'node:assert/strict';
import {npcPrompt} from '../src/prompts.js';
test('witness wording carries the persona and keeps facts as the engine wrote them',()=>{
 const r=npcPrompt({question:'현장에 도착했을 때 무엇을 확인하셨습니까?',answer:'23시 58분에 도착했음. 동승자가 먼저 다가와 자기가 운전했다고 했음.',role:'출동 경찰관',age:'33',job:'지구대 경사 7년',witnessInterest:'현장 판단이 틀렸다는 말을 듣고 싶지 않음'});
 assert.match(r.input,/증인의 나이·직업: 33세 지구대 경사 7년/);
 assert.match(r.instructions,/나이·직업·이 사건과의 관계에 맞춥니다/);
 assert.match(r.instructions,/원래 답에 없는 사실은 더하지 않습니다/);
 const plain=npcPrompt({question:'q',answer:'제가 봤습니다.',role:'이웃'});
 assert.ok(!/증인의 나이·직업/.test(plain.input),'no empty persona line');
});
