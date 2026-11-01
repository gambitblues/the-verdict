const assert=require('node:assert/strict');
const A=require('../advanced_case_engine.js');
const def={id:'qa-hallway',version:1,variants:{}};
for(const truth of ['did','didnt','reason'])def.variants[truth]={
 events:[{id:'hallway',at:'00:43',place:'숙박시설 복도',action:'두 사람이 복도를 이동했다.'}],
 evidence:[{id:'camera',kind:'CCTV',source:'시설 원본 저장장치',excerpt:'00:43 복도 이동'}],
 witnesses:[{id:'clerk',observedEventIds:['hallway'],memory:'이동 방법에 대한 기억이 다름'}]
};
assert.equal(A.validate(def),true);
const a=A.create(def,'seed1');const b=A.create(def,'seed1');assert.deepEqual(a,b);
const truth=A.read(a);assert.equal(truth.events[0].place,'숙박시설 복도');
const updated=A.append(a,{type:'testimony',witnessId:'clerk',text:'업혀 들어갔다고 기억합니다.'});
assert.equal(updated.proceedings.length,1);assert.equal(a.proceedings.length,0);
assert.deepEqual(A.read(updated),truth);
const loaded=JSON.parse(JSON.stringify(updated));assert.deepEqual(A.read(loaded),truth);
const c=A.compare({subject:'B',eventId:'hallway',proposition:'walking',value:'self',interval:[43,43]},
 {subject:'B',eventId:'hallway',proposition:'walking',value:'carried',interval:[43,43]});
assert.equal(c.type,'direct_conflict');
assert.equal(A.compare({subject:'B',eventId:'hallway',proposition:'walking',value:'self',interval:[43,43]},
 {subject:'B',eventId:'hallway',proposition:'walking',value:'carried',interval:[49,49]}).type,'different_scope');
assert.equal(A.compare({subject:'B',eventId:'hallway',proposition:'walking',value:'self'},
 {subject:'B',eventId:'hallway',proposition:'consent',value:'yes'}).type,'different_issue');
assert.throws(()=>A.append(a,{type:'submission',evidenceId:'invented'}),/Unknown evidence/);
assert.throws(()=>A.validate({id:'bad',version:1,variants:{}}),/Three/);
console.log('PASS Advanced case integrity, deterministic seeds, save/load, testimony and contradiction scopes');
