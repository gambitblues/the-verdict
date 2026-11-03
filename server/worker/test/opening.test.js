import test from 'node:test';
import assert from 'node:assert/strict';
import {openingPrompt,checkOpening} from '../src/prompts.js';

const p={names:['박민수'],openingA:'검사는 2026.12.21에 박민수가 현장에 있었다고 주장했다.',
 openingB:'변호인은 2026.12.21에 박민수가 현장에 없었다고 주장했다.'};

test('opening request contains only the two disclosed arguments',()=>{
 const r=openingPrompt(p);
 assert.equal(r.error,undefined);
 assert.ok(r.input.includes(p.openingA));
 assert.ok(r.input.includes(p.openingB));
 assert.ok(!r.input.includes('truth'));
});
test('identical facts with equivalent date formatting pass',()=>{
 const o={openingA:'검사는 2026년 12월 21일에 박민수가 현장에 있었다고 주장했다.',
 openingB:'변호인은 2026년 12월 21일에 박민수가 현장에 없었다고 주장했다.'};
 assert.equal(checkOpening(p,o).ok,true);
});
test('changing date, person, number or polarity is rejected independently',()=>{
 const good={openingA:p.openingA,openingB:p.openingB};
 assert.equal(checkOpening(p,{...good,openingA:good.openingA.replace('21','22')}).why,'dates');
 assert.equal(checkOpening(p,{...good,openingB:good.openingB.replace('없었다','있었다')}).why,'polarity');
 assert.equal(checkOpening(p,{...good,openingA:good.openingA.replace('박민수','이기훈')}).why,'person_dropped');
 assert.equal(checkOpening(p,{...good,openingA:good.openingA+' 999명도 있었다.'}).why,'numbers');
});
test('missing one side never succeeds',()=>{
 assert.equal(openingPrompt({...p,openingB:''}).error,'missing_text');
 assert.equal(checkOpening(p,{openingA:p.openingA,openingB:''}).why,'empty');
});

test('legal shorthand negative stance stays negative when expanded',()=>{
 const p={names:[],openingA:'특수상해 성립 — 맥주병을 깨뜨려 날카로운 쪽으로 팔을 그음.',
  openingB:'특수상해 불성립 — 병은 피해자가 먼저 들었다가 떨어뜨려 깨졌고, 피해자는 넘어지며 바닥의 파편에 팔을 베임.'};
 const out={openingA:p.openingA,openingB:p.openingB.replace('특수상해 불성립','특수상해는 성립하지 않음')};
 assert.equal(checkOpening(p,out).ok,true,'불성립과 성립하지 않음은 같은 부정 주장');
 assert.equal(checkOpening(p,{...out,openingB:out.openingB.replace('성립하지 않음','성립함')}).why,'polarity');
 assert.equal(checkOpening(p,{...out,openingA:out.openingA.replace('특수상해 성립','특수상해 불성립')}).why,'polarity');
});
