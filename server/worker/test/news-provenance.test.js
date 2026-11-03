import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const filename=fileURLToPath(new URL('../../../game_runtime.js',import.meta.url));
const runtime=readFileSync(filename,'utf8');
const start=runtime.indexOf('function news(title,body,category=');
const end=runtime.indexOf('function message(',start);
assert.ok(start>=0&&end>start,'extract production news writer');
function make(){
 const state={week:42,news:[]};
 const ctx={S:state,CASES:[{id:'c1'}]};
 vm.runInNewContext(runtime.slice(start,end)+';this.emitNews=news;',ctx,{filename});
 return {state,emit:ctx.emitNews};
}
test('source links retain only a published case id and public event stage',()=>{
 const {state,emit}=make();
 emit('새 사건 배당','사건명 · 죄명','법원 접수',{caseId:'c1',stage:'filed',privateTruth:'secret',evidence:['hidden']});
 assert.equal(state.news.length,1);
 assert.equal(state.news[0].caseId,'c1');
 assert.equal(state.news[0].caseStage,'filed');
 assert.equal(state.news[0].privateTruth,undefined);
 assert.equal(state.news[0].evidence,undefined);
 assert.equal(state.news[0].week,42);
});
test('old articles and unknown case identifiers have no navigation target',()=>{
 const {state,emit}=make();
 emit('일상 소식','본문');
 emit('외부 임의 소스','본문','법조일보',{caseId:'wrong',stage:'verdict'});
 assert.equal(state.news[0].caseId,undefined);
 assert.equal(state.news[1].caseId,undefined);
});
test('news and community feeds link through existing guarded court navigation',()=>{
 assert.match(runtime,/S\.news\.map\(n=>[\s\S]*?data-action=\\"openCase\\"/);
 assert.match(runtime,/S\.news\.filter\(x=>x\.category!==[\s\S]*?data-action=\\"openCase\\"/);
 assert.match(runtime,/case'openCase':ui\.caseId=el\.dataset\.id;changeTab\('court'\)/);
});
