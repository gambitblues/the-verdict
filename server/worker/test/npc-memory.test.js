import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const filename=fileURLToPath(new URL('../../../npc_court_memory.js',import.meta.url));
const ctx={};vm.runInNewContext(readFileSync(filename,'utf8'),ctx);
const {snapshot,greeting,strategy,adaptCards}=ctx.VerdictCourtMemory;
const ruling=(kind,text)=>({kind,text});
const st=(opponent,log,verdict=true)=>({verdict:verdict?{id:'done'}:null,trial4:{opponent,startedAt:10,log,cards:[]}});

test('only completed prior cases of same opponent produce memory',()=>{
 const data={old:st('lawyer-A',[ruling('이의','이의를 받아들이지 않음'),ruling('이의','이의: 기각')]),other:st('lawyer-B',[ruling('이의','이의: 받아들임')]),open:st('lawyer-A',[ruling('이의','이의: 받아들임')],false)};
 const m=snapshot(data,'new','lawyer-A');
 assert.equal(m.cases,1);assert.equal(m.accepted,0);assert.equal(m.rejected,2);assert.equal(m.lastCaseId,'old');
 assert.match(greeting(m),/여러 차례 받아들여지지/);
 assert.equal(snapshot(data,'new','new-lawyer'),null);
});
test('memory is based on saved court actions, not hidden truth or verdict result',()=>{
 const data={old:st('lawyer-A',[ruling('이의','이의: 받아들임'),ruling('이의','이의: 받아들임'),ruling('증언','이의를 받아들이지 않음')])};
 const m=snapshot(data,'new','lawyer-A');
 assert.equal(m.accepted,2);assert.equal(m.rejected,0);
 assert.match(greeting(m),/쟁점을 분명히/);
});
test('current and uncompleted cases do not enter a new case snapshot',()=>{
 const data={new:st('A',[ruling('이의','기각')]),unfinished:st('A',[ruling('이의','기각')],false)};
 assert.equal(snapshot(data,'new','A'),null);
});
test('older saves without log use adjudicated objection cards only',()=>{
 const data={old:{verdict:{},trial4:{opponent:'A',cards:[{type:'objection',choice:'accept'},{type:'delay',choice:'reject'}]}}};
 assert.equal(snapshot(data,'new','A').accepted,1);
 assert.equal(snapshot(data,'new','A').rejected,0);
});

test('prior losses reduce future objection attempts without changing other events',()=>{
 const m={cases:1,accepted:0,rejected:3};
 assert.equal(strategy(m),'cautious');
 let kept=0;
 for(let day=1;day<=50;day++){
  const input=[{id:'d'+day+'-obj',type:'objection',valid:true},{id:'d'+day+'-del',type:'delay'}];
  const a=adaptCards(input,m,'case-seed',day);
  assert.deepEqual(Array.from(a.filter(x=>x.type!=='objection'),x=>x.type),['delay']);
  assert.equal(adaptCards(input,m,'case-seed',day).length,a.length,'same trial/day must replay identically');
  if(a.some(x=>x.type==='objection'))kept++;
 }
 assert.ok(kept>0&&kept<50,'history makes some objections less frequent, not impossible');
});
test('prior sustained objections can add one objection but never duplicate existing one',()=>{
 const m={cases:2,accepted:4,rejected:0};
 assert.equal(strategy(m),'assertive');
 let added=0;
 for(let day=1;day<=50;day++){
  const base=[{id:'d'+day+'-del',type:'delay',valid:true}];
  const a=adaptCards(base,m,'case-seed',day);
  assert.equal(a.filter(x=>x.type==='objection').length<=1,true);
  assert.equal(a.find(x=>x.type==='delay')?.valid,true);
  if(a.some(x=>x.type==='objection'))added++;
  const already=[...base,{id:'d'+day+'-obj',type:'objection',valid:false}];
  assert.equal(adaptCards(already,m,'case-seed',day),already,'retain the original objection and its validity unchanged');
 }
 assert.ok(added>0&&added<50);
});
test('new and balanced-history opponents preserve the original daily events',()=>{
 const cards=[{id:'d1-obj',type:'objection',valid:false}];
 assert.equal(adaptCards(cards,null,'test',1),cards);
 assert.equal(adaptCards(cards,{cases:2,accepted:1,rejected:1},'test',1),cards);
 assert.equal(strategy({cases:2,accepted:1,rejected:1}),'steady');
});
