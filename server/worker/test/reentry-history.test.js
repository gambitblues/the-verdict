import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const file=fileURLToPath(new URL('../../../npc_life_justice.js',import.meta.url));
const ctx={window:{}};
vm.runInNewContext(readFileSync(file,'utf8'),ctx,{filename:file});
const L=ctx.window.LifeJustice;
const person=()=>({
 name:'가상 인물',career:'복역 중',role:'회사원',wealth:45,residence:'교정시설',
 custodyHistory:[{kind:'징역형',caseId:'case-1',startWeek:10,releaseWeek:40,termWeeks:30,originalCareer:'회사원'}],
 jobHistory:[{year:2027,job:'복역 중',reason:'판결'}],historyEvents:[],financialHistory:[],relationshipHistory:[],
 traits:{conscientiousness:75}
});
function tick(p,w){
 const memories=[],logs=[];
 L.weekTick({}, {p},w,(...a)=>memories.push(a),()=>{},(...a)=>logs.push(a));
 return {memories,logs};
}
test('sentence release creates exactly one dated life event and current profile state',()=>{
 const p=person();
 assert.equal(tick(p,39).memories.length,0);
 const first=tick(p,40);
 assert.equal(first.memories.length,1);
 assert.equal(p.legalStatus,'출소 · 사회 복귀');
 assert.equal(p.career,'구직·사회 복귀 준비');
 assert.equal(p.residence,'출소자 임시 거처');
 assert.equal(p.historyEvents.length,1);
 assert.equal(p.historyEvents[0].type,'출소');
 assert.equal(p.historyEvents[0].sourceCaseId,'case-1');
 assert.equal(p.jobHistory.at(-1).job,p.career);
 assert.equal(tick(p,40).memories.length,0);
 assert.equal(p.historyEvents.length,1);
});
test('six-month reentry status, job change and history persist only once',()=>{
 const p=person();
 tick(p,40);
 assert.equal(tick(p,65).memories.length,0);
 assert.equal(tick(p,66).memories.length,1);
 assert.equal(p.reentry.completed,true);
 assert.equal(p.career,'중소기업 취업');
 assert.equal(p.jobHistory.at(-1).job,'중소기업 취업');
 assert.equal(p.historyEvents.length,2);
 assert.equal(p.historyEvents[1].type,'사회 복귀');
 assert.equal(L.latestLifeMoment(p,66).type,'사회 복귀');
 assert.equal(tick(p,67).memories.length,0);
 assert.equal(p.jobHistory.length,3);
});
test('a new active prison sentence prevents premature reintegration',()=>{
 const p=person();
 tick(p,40);
 p.custodyHistory.push({kind:'징역형',caseId:'case-2',startWeek:55,releaseWeek:90,termWeeks:35});
 p.career='복역 중';
 tick(p,66);
 assert.equal(p.reentry.completed,false);
 assert.equal(p.career,'복역 중');
});
