import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const load=(name,expression,context)=>{const file=fileURLToPath(new URL('../../../'+name,import.meta.url));vm.runInNewContext(readFileSync(file,'utf8')+';this.__subject='+expression+';',context,{filename:file});return context.__subject};
const life=load('npc_life_justice.js','window.LifeJustice',{window:{}});
const prior={id:'prior',kind:'criminal',who:['repeat']};
const state=(verdict,closedWeek=25,extra={})=>({verdict,closedWeek,...extra});
const person=(extra={})=>({alive:true,role:'피고인',bornYear:1990,custodyHistory:[],...extra});

test('previous conviction qualifies, but acquittal and unfinished trials never count',()=>{
 assert.equal(life.repeatDefendant(prior,state('guilty'),person(),100),true);
 assert.equal(life.repeatDefendant(prior,state('partial'),person(),100),true);
 assert.equal(life.repeatDefendant(prior,state('notguilty'),person(),100),false);
 assert.equal(life.repeatDefendant(prior,state(null),person(),100),false);
 assert.equal(life.repeatDefendant(prior,state('guilty',90),person(),100),false);
 assert.equal(life.repeatDefendant(prior,state('guilty'),person({alive:false}),100),false);
});
test('actual sentence overrides vague verdict label, and custody release predates incident',()=>{
 assert.equal(life.repeatDefendant(prior,state('guilty',25,{sentenced:{kind:'crim',side:-1,type:'none'}}),person(),100),false);
 assert.equal(life.repeatDefendant(prior,state('guilty',25,{sentenced:{kind:'crim',side:1,type:'fine'}}),person(),100),true);
 const custody=releaseWeek=>person({custodyHistory:[{kind:'징역형',caseId:'prior',startWeek:25,releaseWeek}]});
 assert.equal(life.repeatDefendant(prior,state('guilty'),custody(78),100),true);
 assert.equal(life.repeatDefendant(prior,state('guilty'),custody(79),100),false);
 assert.equal(life.repeatDefendant(prior,state('guilty'),custody(110),100),false);
});
test('repeat actor definitely appears in another independently generated criminal story',()=>{
 const engine=load('story_engine.js','StoryEngine',{});
 const bp={kind:'criminal',key:'fraud',titles:['사기 관련 사건'],premises:['서로 다른 계약을 두고 다툼이 발생했다.'],docs:['계약서','거래 기록','통화 녹음'],tag:'형사·사기',legal:'사기',importance:2,icon:'⚖'};
 function build(oldCriminal){
  let seq=0;const people={repeat:{name:'다시 기소된 사람',role:'피고인',wealth:40},a:{name:'검사',role:'검사',wealth:60},b:{name:'변호사',role:'변호사',wealth:45}};
  const makeNPC=role=>{const id='n'+(++seq);people[id]={name:id,role,wealth:50};return id};
  return engine.build({caseId:'new-case',blueprint:bp,instance:0,loc:'서울',now:'2028-01-01',week:100,r:()=>0.4,makeNPC,
    oldCriminal,priorDecision:null,prosecutorPool:['a'],counselPool:['b'],people});
 }
 const again=build(prior),first=build(null);
 assert.equal(again.who[0],'repeat');
 assert.notEqual(first.who[0],'repeat');
 assert.equal(again.qa.pass,true,again.qa.errors?.join(', '));
 assert.equal(first.qa.pass,true,first.qa.errors?.join(', '));
 assert.equal(again.story.privateTruth.kind,first.story.privateTruth.kind);
 assert.equal(again.story.proofStrength,first.story.proofStrength);
});
