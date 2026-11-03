import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

// Offline career integration: a disposable fictional state only, never a live save.
function load(file,expression,context){
 const filename=fileURLToPath(new URL('../../../'+file,import.meta.url));
 vm.runInNewContext(readFileSync(filename,'utf8')+';this.__export='+expression+';',context,{filename});
 return context.__export;
}
const L=load('npc_life_justice.js','window.LifeJustice',{window:{}});
const C=load('continuity_engine.js','ContinuityEngine',{});
const E=load('story_engine.js','StoryEngine',{});
const M=load('npc_court_memory.js','globalThis.VerdictCourtMemory',{});
function world(){
 let seq=0;
 const NPC={old:{name:'김가상',role:'회사원',career:'회사원',alive:true,wealth:50,maritalStatus:'미혼',
  custodyHistory:[],historyEvents:[],jobHistory:[],financialHistory:[],relationshipHistory:[]},
  counsel1:{name:'변호사 1',role:'변호사',wealth:55},counsel2:{name:'변호사 2',role:'변호사',wealth:45}};
 const makeNPC=role=>{const id='new'+(++seq);NPC[id]={name:'가상'+seq,role,wealth:40,alive:true};return id};
 const bp={kind:'civil',key:'contract',titles:['새 계약 분쟁'],premises:['별개의 계약을 두고 다툼이 발생했다.'],
  docs:['계약서','거래 기록','메신저 대화'],tag:'민사·계약',legal:'계약',importance:2,icon:'📃'};
 return {NPC,makeNPC,bp};
}
test('life change -> new real litigant -> saved snapshot -> later change preserves earlier case',()=>{
 const w=world();
 const event={week:50,type:'직업',career:'기술직',change:'기술직으로 근무 환경이 변경됨'};
 assert.equal(L.recordAnnualEvent(w.NPC.old,event,2028),true);
 assert.equal(L.eligibleLifeTrigger({week:50,consumed:false},w.NPC.old,100),true);
 const c=E.build({caseId:'p2-new-civil',blueprint:w.bp,instance:0,loc:'서울',now:'2029-01-01',week:100,r:()=>0.4,
  makeNPC:w.makeNPC,oldCriminal:null,lifeActorId:'old',priorDecision:null,prosecutorPool:[],
  counselPool:['counsel1','counsel2'],people:w.NPC});
 assert.equal(c.qa.pass,true,c.qa.errors?.join(', '));
 assert.equal(c.who[0],'old');
 assert.equal(C.audit(c,w.NPC,100,[]).pass,true);
 const snap=C.snapshots(c,w.NPC,100).find(x=>x.id==='old');
 assert.equal(snap.career,'기술직');
 assert.equal(snap.lastLifeEvent.week,50);
 L.recordAnnualEvent(w.NPC.old,{week:153,type:'직업',career:'자영업자',change:'자영업 전환'},2030);
 assert.equal(snap.career,'기술직');
 const restored=JSON.parse(JSON.stringify({c,snap}));
 assert.equal(restored.snap.career,'기술직');
 assert.equal(restored.c.who[0],'old');
});
test('a recurrent opponent remembers only the completed prior trial, and replay stays deterministic',()=>{
 const cases={old:{verdict:'full',trial4:{opponent:'counsel1',log:[
  {kind:'이의',text:'관련성 없음: 받아들임'},{kind:'이의',text:'유도신문: 받아들임'}]}}};
 const mem=M.snapshot(cases,'new','counsel1');
 assert.equal(mem.accepted,2);
 assert.equal(M.strategy(mem),'assertive');
 const a=M.adaptCards([],mem,'p2-new-civil',1),b=M.adaptCards([],mem,'p2-new-civil',1);
 assert.equal(JSON.stringify(a),JSON.stringify(b));
 assert.equal(M.snapshot(cases,'new','other'),null);
});
