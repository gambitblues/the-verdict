import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const filename=fileURLToPath(new URL('../../../npc_court_memory.js',import.meta.url));
const ctx={};vm.runInNewContext(readFileSync(filename,'utf8'),ctx);
const {snapshot,greeting}=ctx.VerdictCourtMemory;
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
