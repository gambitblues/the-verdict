import test from 'node:test';
import assert from 'node:assert/strict';
import {closingPrompt,checkClosing} from '../src/prompts.js';

const p={names:['박민수'],openingA:'검사는 2026.12.21에 박민수가 현장에 있었다고 주장했다.',
 openingB:'변호인은 2026.12.21에 박민수가 현장에 없었다고 주장했다.'};

test('closing reuses two disclosed sides, never any hidden case truth',()=>{
 const r=closingPrompt(p);
 assert.equal(r.error,undefined);
 assert.ok(r.instructions.includes('최종 변론'));
 assert.ok(r.input.includes(p.openingA));
 assert.ok(r.input.includes(p.openingB));
 assert.ok(!r.input.includes('truth'));
});
test('closing preserves dates, people and legal polarity',()=>{
 assert.equal(checkClosing(p,{openingA:p.openingA,openingB:p.openingB}).ok,true);
 assert.equal(checkClosing(p,{openingA:p.openingA,openingB:p.openingB.replace('없었다','있었다')}).why,'polarity');
 assert.equal(checkClosing(p,{openingA:p.openingA.replace('21','22'),openingB:p.openingB}).why,'dates');
 assert.equal(checkClosing(p,{openingA:p.openingA.replace('박민수','다른사람'),openingB:p.openingB}).why,'person_dropped');
});
