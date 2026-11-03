import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const filename=fileURLToPath(new URL('../../../npc_life_justice.js',import.meta.url));
const context={window:{}};
vm.runInNewContext(readFileSync(filename,'utf8'),context,{filename});
const {recordAnnualEvent,latestLifeMoment}=context.window.LifeJustice;
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
