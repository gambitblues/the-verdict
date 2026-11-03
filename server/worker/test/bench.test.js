import test from 'node:test';
import assert from 'node:assert/strict';
import {benchPrompt,checkBench} from '../src/prompts.js';

const source='쟁점 사고 경위 — 검사·원고 측 자료 1건, 변호·피고 측 자료 1건. 증거 현장 기록: 2026.12.21에 박민수가 있었다. 남은 확인: 미결정 증거 1건.';
const p={source,names:['박민수']};
test('bench request includes only the supplied public-record memo',()=>{
 const r=benchPrompt(p);
 assert.equal(r.error,undefined);
 assert.equal(r.input,source);
 assert.ok(!r.input.includes('truth'));
});
test('bench accepts unchanged facts and equivalent dates',()=>{
 assert.equal(checkBench(p,{text:source.replace('2026.12.21','2026년 12월 21일')}).ok,true);
});
test('bench rejects changed issue counts, dates, names, and missing output',()=>{
 assert.equal(checkBench(p,{text:source.replace('자료 1건','자료 2건')}).why,'numbers');
 assert.equal(checkBench(p,{text:source.replace('2026.12.21','2026.12.22')}).why,'dates');
 assert.equal(checkBench(p,{text:source.replace('박민수','정성훈')}).why,'person_dropped');
 assert.equal(checkBench(p,{text:''}).why,'empty');
});
