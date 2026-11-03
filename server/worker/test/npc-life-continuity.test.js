import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const filename=fileURLToPath(new URL('../../../npc_life_justice.js',import.meta.url));
const context={window:{}};
vm.runInNewContext(readFileSync(filename,'utf8'),context,{filename});
const {recordAnnualEvent,latestLifeMoment,eligibleLifeTrigger}=context.window.LifeJustice;
const make=()=>({career:'회사원',maritalStatus:'미혼',children:0,wealth:50,jobHistory:[],financialHistory:[],relationshipHistory:[],historyEvents:[]});

test('annual change persists one canonical job and dated timeline entry',()=>{
 const p=make(),e={week:52,type:'직업',change:'기술직으로 직업을 옮김',career:'기술직'};
 assert.equal(recordAnnualEvent(p,e,2028),true);
 assert.equal(p.career,'기술직');
 assert.equal(p.jobHistory.length,1);
 assert.equal(p.jobHistory[0].year,2028);
 assert.equal(latestLifeMoment(p,51),null,'future history is never disclosed');
 assert.equal(latestLifeMoment(p,52).text,e.change);
 assert.equal(recordAnnualEvent(p,e,2028),false,'no duplicate on repeat');
 assert.equal(p.jobHistory.length,1);
});
test('family milestones update current status and timeline without inventing a spouse ID',()=>{
 const p=make();
 recordAnnualEvent(p,{week:53,type:'혼인',change:'혼인하여 가족 관계가 형성됨',marital:'기혼'},2028);
 assert.equal(p.maritalStatus,'기혼');
 assert.equal(p.partnerId,undefined);
 recordAnnualEvent(p,{week:54,type:'출생',change:'자녀 1명과 생활함',children:1},2028);
 assert.equal(p.children,1);
 recordAnnualEvent(p,{week:80,type:'이혼',change:'별거와 이혼을 경험함',marital:'이혼'},2029);
 assert.equal(p.maritalStatus,'이혼');
 assert.equal(p.relationshipHistory.length,3);
 assert.equal(latestLifeMoment(p,80).text,'별거와 이혼을 경험함');
});
test('money and social history persist only observed events, not guesses about liability',()=>{
 const p=make();
 assert.equal(recordAnnualEvent(p,{week:3,type:'재산',change:'경제 상황 변화',wealth:29},2027),true);
 assert.equal(p.wealth,29);assert.equal(p.financialHistory[0].wealth,29);
 recordAnnualEvent(p,{week:4,type:'관계',change:'교우관계 변화'},2027);
 assert.equal(p.relationshipHistory.at(-1).type,'교류 변화');
 assert.equal(p.legalStatus,undefined);
 assert.equal(p.custodyHistory,undefined);
});
test('old saves and malformed events safely preserve existing profile',()=>{
 const p={career:'회사원'};
 assert.equal(latestLifeMoment(p,100),null);
 assert.equal(recordAnnualEvent(p,{type:'직업'},2028),false);
 assert.equal(recordAnnualEvent(null,{week:3,type:'직업'},2028),false);
 assert.equal(p.career,'회사원');
});

test('case snapshots freeze lived biography and ignore events from the future',()=>{
 const path=fileURLToPath(new URL('../../../continuity_engine.js',import.meta.url));
 const source=readFileSync(path,'utf8');
 const local={};vm.runInNewContext(source+';this.ContinuityEngine=ContinuityEngine;',local,{filename:path});
 const person={name:'김모',role:'증인',career:'기술직',wealth:42,alive:true,legalStatus:'사회 복귀',
  maritalStatus:'기혼',children:1,residence:'월세 빌라',
  historyEvents:[{week:54,type:'직업',change:'기술직으로 이직'},{week:120,type:'재산',change:'경제 상황 변화'}]};
 const snap=local.ContinuityEngine.snapshots({who:['p1'],side:[]},{p1:person},80)[0];
 assert.equal(snap.career,'기술직');
 assert.equal(snap.maritalStatus,'기혼');
 assert.equal(snap.children,1);
 assert.equal(snap.lastLifeEvent.week,54);
 person.career='다른 직업';person.children=2;
 assert.equal(snap.career,'기술직');
 assert.equal(snap.children,1);
});

test('life-trigger civil participation needs chronology, a living person and freedom',()=>{
 const e={week:70,type:'직업',change:'직업 변경',consumed:false},p={alive:true,custodyHistory:[]};
 assert.equal(eligibleLifeTrigger(e,p,92),false,'too recent for incident at filing minus 22 weeks');
 assert.equal(eligibleLifeTrigger(e,p,93),true,'event safely predates incident');
 assert.equal(eligibleLifeTrigger({...e,consumed:true},p,93),false);
 assert.equal(eligibleLifeTrigger(e,{alive:false},93),false);
 assert.equal(eligibleLifeTrigger(e,{alive:true,role:'변호사'},93),false,'one person cannot be both returning claimant and counsel');
 assert.equal(eligibleLifeTrigger(e,null,93),false);
 assert.equal(eligibleLifeTrigger(e,{alive:true,custodyHistory:[{kind:'징역형',startWeek:20,releaseWeek:140}]},93),false);
 assert.equal(eligibleLifeTrigger(e,p,383),false,'expired life context');
});
