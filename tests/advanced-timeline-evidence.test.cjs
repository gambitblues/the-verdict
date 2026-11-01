const assert=require('node:assert/strict');
const C=require('../advanced_case_engine.js'),T=require('../advanced_timeline_evidence.js');
const variants={};
for(const truth of ['did','didnt','reason'])variants[truth]={
 events:[{id:'corridor',at:'2026-06-12T00:43+09:00',place:'숙박시설 복도',action:'두 사람이 이동함'}],
 evidence:[{id:'cctv',kind:'CCTV',source:'원본 저장장치'},{id:'entry',kind:'출입기록',source:'프런트 출입 단말'}],
 witnesses:[{id:'clerk',observedEventIds:['corridor']}]
};
const state=C.create({id:'time-case',version:1,variants},'fixed','did');
const manifest={devices:{cam:{offsetMinutes:-7}},records:[
 {id:'cctv',kind:'CCTV',source:'원본 저장장치',provenance:'관리자 보존본',eventId:'corridor',deviceId:'cam',at:'2026-06-12T00:36+09:00'},
 {id:'entry',kind:'출입기록',source:'프런트 출입 단말',provenance:'단말 로그 원본',eventId:'corridor',at:'2026-06-12T00:43+09:00'}
]};
assert.equal(T.inspect(state,manifest).length,2);
assert.equal(T.contrast(manifest.records[0],manifest.records[1],manifest.devices).type,'time_compatible');
assert.equal(T.contrast(manifest.records[0],manifest.records[1],{}).type,'time_disjoint');
const next=T.submit(state,manifest,'cctv');assert.equal(next.proceedings[0].evidenceId,'cctv');
assert.equal(T.submit(next,manifest,'cctv').proceedings.length,1);
assert.equal(next.lock,state.lock);
assert.deepEqual(T.inspect(JSON.parse(JSON.stringify(next)),manifest),T.inspect(state,manifest));
assert.throws(()=>T.minute('00:43'),/timezone/);
assert.throws(()=>T.inspect(state,{records:[{id:'new',at:'2026-06-12T00:43+09:00',source:'x',provenance:'x',kind:'x'}]}),/not in locked/);
assert.throws(()=>T.inspect(state,{records:[{...manifest.records[0],eventId:'invented'}],devices:manifest.devices}),/Unknown referenced/);
console.log('PASS Advanced timeline clock offset, provenance, locked evidence, deterministic submission');
