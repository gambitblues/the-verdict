import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const filename=fileURLToPath(new URL('../../../game_runtime.js',import.meta.url));
const source=readFileSync(filename,'utf8');
const start=source.indexOf('function publicIncidentOutcome(');
const end=source.indexOf('function ensureGeneratedCases(){',start);
assert.ok(start>=0&&end>start,'P3 incident lifecycle exists');

function fixture(outcome,kind='criminal'){
 const c={id:'incident-1',kind,name:'가상 사건 · 서울 성북구 (2027.09.01)',
  tag:kind==='criminal'?'형사·살인':'민사·계약',who:['p1','p2'],story:{investigator:{detective:'p3'}}};
 const S={week:22,pendingCases:[{case:c,incidentWeek:14,investigationWeek:17,filingWeek:22,
  publicOutcome:outcome,investigated:true}],generatedCases:[],worldIncidents:[],cases:{}};
 const CASES=[],NPC={},newsItems=[],remembered=[];
 const context={S,CASES,NPC,news:(...args)=>newsItems.push(args),
  remember:(...args)=>remembered.push(args),log:()=>{},
  ContinuityEngine:{snapshots:()=>[]}};
 vm.runInNewContext(source.slice(start,end)+';this.publicOutcome=publicIncidentOutcome;this.progress=progressPendingCases;',context,{filename});
 return {S,CASES,newsItems,remembered,publicOutcome:context.publicOutcome,progress:context.progress};
}
test('only some reported incidents take a non-court route',()=>{
 const w=fixture('court');
 assert.equal(w.publicOutcome('criminal',0.01),'investigation_closed');
 assert.equal(w.publicOutcome('criminal',0.1),'not_prosecuted');
 assert.equal(w.publicOutcome('criminal',0.19),'other_court');
 assert.equal(w.publicOutcome('civil',0.01),'settled');
 assert.equal(w.publicOutcome('civil',0.1),'withdrawn');
 assert.equal(w.publicOutcome('civil',0.19),'other_court');
 assert.equal(w.publicOutcome('criminal',0.22),'court');
 assert.equal(w.publicOutcome('civil',0.9),'court');
});
test('no-prosecution story closes without court trial, verdict, or hidden facts in article',()=>{
 const w=fixture('not_prosecuted');
 w.progress();
 assert.equal(w.CASES.length,0);
 assert.equal(w.S.generatedCases.length,0);
 assert.equal(Object.keys(w.S.cases).length,0);
 assert.equal(w.S.pendingCases.length,0);
 assert.equal(w.S.worldIncidents.length,1);
 assert.equal(w.S.worldIncidents[0].outcome,'not_prosecuted');
 assert.equal(w.newsItems.length,1);
 assert.equal(w.newsItems[0][3].stage,'closed');
 assert.match(w.newsItems[0][0],/불기소 처분/);
 assert.ok(!JSON.stringify(w.newsItems).includes('privateTruth'));
 w.progress();
 assert.equal(w.newsItems.length,1,'must not republish after reload/rerender');
});
test('civil settlement and other-court transfers never become this judge\'s case',()=>{
 for(const outcome of ['settled','withdrawn','other_court']){
  const w=fixture(outcome,'civil');
  w.progress();
  assert.equal(w.CASES.length,0);
  assert.equal(w.newsItems.length,1);
  assert.equal(w.S.worldIncidents[0].outcome,outcome);
 }
});
test('ordinary court route still preserves pre-generated case ID and court records',()=>{
 const w=fixture('court');
 w.progress();
 assert.equal(w.CASES.length,1);
 assert.equal(w.CASES[0].id,'incident-1');
 assert.equal(w.S.cases['incident-1'].verdict,null);
 assert.equal(w.S.worldIncidents.length,0);
 assert.equal(w.newsItems[0][3].stage,'filed');
});
