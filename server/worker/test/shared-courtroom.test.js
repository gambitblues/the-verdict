import test from 'node:test';
import assert from 'node:assert/strict';
import {courtroomPlan,courtActionId} from '../src/shared_courtroom.js';

const sheet={id:'case-p4',questions:[
 {id:'first',w:'W1',q:'무슨 일을 봤나요?',a:{did:'봤다',didnt:'안 봤다',reason:'잘 모르겠다'}},
 {id:'follow',w:'W1',q:'그다음은?',after:'W1:first',a:{did:'후속 진술'}},
 {id:'video-q',w:'W2',q:'영상을 확인했나요?',after:'r2',a:{did:'영상 진술'}}
 ],records:[
 {id:'r1',title:'처음 제출',first:true},{id:'r2',title:'미공개 CCTV',first:false}
 ],orders:[{record:'r2',result:{did:'done',didnt:'declined',reason:'delayed'}}],
 worlds:{
  did:{records:{r2:'선택된 세계의 CCTV'}},
  didnt:{records:{r2:'OTHER BRANCH CCTV'}},
  reason:{records:{r2:'이월할 자료'}}
 }};
test('selected sealed branch alone determines witness answer',()=>{
 const did=courtroomPlan(sheet,'did',[],'question','first');
 const no=courtroomPlan(sheet,'didnt',[],'question','first');
 assert.equal(did.response.answer,'봤다');
 assert.equal(no.response.answer,'안 봤다');
 assert.ok(!JSON.stringify(did).includes('OTHER BRANCH'));
 assert.ok(!Object.hasOwn(did.response,'branch'));
 assert.equal(courtActionId(sheet.questions[0],0,'question'),'first');
 assert.equal(courtroomPlan(sheet,'did',[],'question','nope').error,'action_not_found');
});
test('prerequisite questions and court orders unlock only after successful result',()=>{
 assert.equal(courtroomPlan(sheet,'did',[],'question','follow').error,'prerequisite_missing');
 assert.equal(courtroomPlan(sheet,'did',[],'question','video-q').error,'prerequisite_missing');
 const ordered=courtroomPlan(sheet,'did',[],'order','r2');
 assert.deepEqual(ordered.response,{status:'done',recordId:'r2',title:'미공개 CCTV',text:'선택된 세계의 CCTV'});
 const action=[{action_type:'order',action_key:'r2',response:ordered.response}];
 assert.equal(courtroomPlan(sheet,'did',action,'question','video-q').response.answer,'영상 진술');
 assert.equal(courtroomPlan(sheet,'did',[{action_type:'question',action_key:'first',response:{status:'done'}}],'question','follow').response.answer,'후속 진술');
});
test('declined or delayed order never leaks locked evidence',()=>{
 for(const [branch,state] of [['didnt','declined'],['reason','delayed']]){
  const out=courtroomPlan(sheet,branch,[],'order','r2');
  assert.equal(out.response.status,state);
  assert.ok(!Object.hasOwn(out.response,'text'));
  assert.equal(courtroomPlan(sheet,branch,[{action_type:'order',action_key:'r2',response:out.response}],'question','video-q').error,'prerequisite_missing');
 }
});
test('bad action names or unavailable worlds fail closed',()=>{
 assert.equal(courtroomPlan(sheet,'did',[],'order','unknown').error,'action_not_found');
 assert.equal(courtroomPlan(sheet,'wrong',[],'order','r2').error,'sealed_case_invalid');
 assert.equal(courtroomPlan(sheet,'did',[],'delete','r2').error,'invalid_action');
});
