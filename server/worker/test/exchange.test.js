import test from 'node:test';
import assert from 'node:assert/strict';
import {exchangePrompt,checkExchange} from '../src/prompts.js';

const p={names:['박민수'],openingA:'검사는 박민수의 2026.12.21 진술에 이의를 신청했다.',
 openingB:'변호인은 박민수의 2026.12.21 진술에 이의가 없다고 말했다.'};

test('exchange handles only filed objection and reply with separated sides',()=>{
 const r=exchangePrompt(p);
 assert.equal(r.error,undefined);
 assert.ok(r.instructions.includes('이의 신청'));
 assert.equal(r.input.includes(p.openingA)&&r.input.includes(p.openingB),true);
 assert.ok(!r.input.includes('truth'));
});
test('exchange rejects changed polarity, dates and parties',()=>{
 assert.equal(checkExchange(p,{openingA:p.openingA,openingB:p.openingB}).ok,true);
 assert.equal(checkExchange(p,{openingA:p.openingA,openingB:p.openingB.replace('없다고','있다고')}).why,'polarity');
 assert.equal(checkExchange(p,{openingA:p.openingA.replace('21','22'),openingB:p.openingB}).why,'dates');
 assert.equal(checkExchange(p,{openingA:p.openingA.replace('박민수','정은수'),openingB:p.openingB}).why,'person_dropped');
});
