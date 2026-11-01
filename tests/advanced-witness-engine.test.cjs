const assert=require('node:assert/strict');
const A=require('../advanced_case_engine.js'),W=require('../advanced_witness_engine.js');
const make=()=>({id:'witness-regression',version:1,variants:Object.fromEntries(['did','didnt','reason'].map(t=>[t,{
 events:[{id:'hall',at:'00:43',place:'복도',action:'이동'}],
 evidence:[{id:'camera',kind:'CCTV',source:'원본',excerpt:'복도에서 스스로 이동'}],
 witnesses:[{id:'clerk',observedEventIds:['hall'],traits:{memoryAccuracy:48,memoryConfidence:88,honesty:75,pressureSensitivity:66,interest:30},
 script:{q1:{prompt:'어떻게 이동했습니까?',confrontEvidenceIds:['camera'],responses:{
 initial:{text:'업혀 들어간 것으로 기억합니다.',knowledgeSource:'memory',eventId:'hall'},
 clarify:{text:'정확히 그 순간을 본 것인지 자신이 없습니다.',knowledgeSource:'memory',eventId:'hall'},
 confront:{text:'영상 속 시간대에는 걸어 들어가는 모습이 보입니다. 제 기억과 다릅니다.',knowledgeSource:'document',eventId:'hall'},
 recall:{text:'다른 손님과 혼동했을 가능성이 있습니다.',knowledgeSource:'memory',eventId:'hall'}
 }}}}]}]))});
const d=make();const s=A.create(d,'same-seed','reason'),initialLock=s.lock;
assert.deepEqual(W.options(s,'clerk','q1'),['initial']);
assert.throws(()=>W.ask(s,{witnessId:'clerk',questionId:'q1',mode:'confront'}),/unavailable/);
const s1=W.ask(s,{witnessId:'clerk',questionId:'q1'});
assert.deepEqual(W.options(s1,'clerk','q1'),['clarify']);
const s2=A.append(s1,{type:'submission',evidenceId:'camera'});
assert.deepEqual(W.options(s2,'clerk','q1'),['clarify','confront']);
const s3=W.ask(s2,{witnessId:'clerk',questionId:'q1',mode:'confront'});
assert.equal(W.history(s3,'clerk').length,2);
const s4=A.append(s3,{type:'order',action:'recall',witnessId:'clerk'});
assert.ok(W.options(s4,'clerk','q1').includes('recall'));
const s5=W.ask(s4,{witnessId:'clerk',questionId:'q1',mode:'recall'});
assert.equal(s5.lock,initialLock);assert.equal(A.read(s5).truth,'reason');
assert.deepEqual(W.history(JSON.parse(JSON.stringify(s5)),'clerk'),W.history(s5,'clerk'));
assert.throws(()=>W.ask(s5,{witnessId:'clerk',questionId:'invented'}),/Unknown authored/);
const bad=make().variants.did.witnesses[0];
bad.script.q1.responses.initial={text:'현장을 봤습니다',knowledgeSource:'direct',eventId:'absent'};
assert.throws(()=>W.validateWitness(bad),/Impossible direct observation/);
console.log('PASS: authored witness responses, locked truth, observation guard, confrontation, recall, replay');
