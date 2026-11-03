import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const filename=fileURLToPath(new URL('../../../npc_court_memory.js',import.meta.url));
const ctx={};vm.runInNewContext(readFileSync(filename,'utf8'),ctx);
const {snapshot,greeting,relationship,rulingReaction,strategy,adaptCards,participation,participationLine}=ctx.VerdictCourtMemory;
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

test('recurring courtroom relationship evolves from observed rulings, not verdict direction',()=>{
 const newcomer=null;
 const guarded={cases:1,accepted:0,rejected:2};
 const respect={cases:2,accepted:4,rejected:1};
 const rival={cases:3,accepted:3,rejected:3};
 assert.equal(relationship(newcomer),'new');
 assert.equal(relationship(guarded),'guarded');
 assert.equal(relationship(respect),'respectful');
 assert.equal(relationship(rival),'rival');
 assert.equal(relationship({cases:1,accepted:1,rejected:1}),'familiar');
 assert.equal(greeting(null),'');
 assert.match(greeting(rival),/여러 번 의견이 엇갈렸습니다/);
 assert.match(greeting(respect),/쟁점을 충분히/);
 assert.match(greeting(guarded),/신청 근거/);
});
test('counsel reaction is shown only after an actual objection ruling',()=>{
 const respect={cases:2,accepted:4,rejected:1};
 const rival={cases:3,accepted:3,rejected:3};
 const guarded={cases:1,accepted:0,rejected:2};
 assert.equal(rulingReaction(null,'accept'),'');
 assert.equal(rulingReaction(respect,null),'');
 assert.equal(rulingReaction(respect,'delay'),'');
 assert.match(rulingReaction(respect,'accept'),/더 묻지 않겠습니다/);
 assert.match(rulingReaction(rival,'reject'),/기록에 남기고/);
 assert.match(rulingReaction(guarded,'reject'),/더 명확히/);
 assert.notEqual(rulingReaction(respect,'accept'),rulingReaction(guarded,'accept'));
});
test('persona differentiates familiar counsel without inventing court history',()=>{
 const familiar={cases:1,accepted:1,rejected:1};
 assert.match(greeting(familiar,'meticulous'),/기록부터 차근차근/);
 assert.match(greeting(familiar,'aggressive'),/분명하게 다투겠습니다/);
 assert.equal(relationship(familiar),'familiar');
});

test('prosecutor returns only after a completed criminal case with same person id',()=>{
 const roster=[{id:'a',kind:'criminal',side:['p1']},{id:'b',kind:'civil',side:['p1']},{id:'c',kind:'criminal',side:['p2']},{id:'new',kind:'criminal',side:['p1']}];
 const data={a:{verdict:{},trial4:{}},b:{verdict:{},trial4:{}},c:{verdict:{},trial4:{}},new:{verdict:{},trial4:{}}};
 const prior=participation(data,roster,'new','p1','prosecutor');
 assert.equal(prior.cases,1);
 assert.match(participationLine(prior),/다시 뵙습니다/);
 assert.equal(participation(data,roster,'new','p3','prosecutor'),null);
});
test('witness only remembers completed prior testimony actually heard in court',()=>{
 const roster=[{id:'a'},{id:'b'},{id:'c'},{id:'new'}];
 const mk=(who,heard,done=true)=>({verdict:done?{}:null,trial4:{witnesses:[{id:who}],heard}});
 const data={a:mk('w1',[{w:0,q:'q1'}]),b:mk('w1',[]),c:mk('w1',[{w:0,q:'q2'}],false),
  new:mk('w1',[{w:0,q:'current'}])};
 const prior=participation(data,roster,'new','w1','witness');
 assert.equal(prior.cases,1);assert.equal(prior.heard,1);
 assert.match(participationLine(prior),/지난 사건/);
 assert.equal(participation(data,roster,'new','w2','witness'),null);
});
test('excluded or tainted answers do not count as a witness reappearing',()=>{
 const roster=[{id:'a'},{id:'new'}];
 const data={a:{verdict:{},trial4:{witnesses:[{id:'w1'}],heard:[{w:0,struck:true},{w:0,tainted:true}]}}};
 assert.equal(participation(data,roster,'new','w1','witness'),null);
 assert.equal(participationLine(null),'');
 assert.equal(participation(data,roster,'new','w1','invalid-role'),null);
});
