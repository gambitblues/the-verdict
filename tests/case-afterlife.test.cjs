/* Case afterlife — no replay of locked facts, optional litigation, independent people decisions. */
const assert=require('node:assert/strict');
const A=require('../case_afterlife_engine.js');
const sheet=require('../world-sheets/cases/clinic-001.json');
const make=(truth,extra={})=>A.init({caseId:sheet.id,seed:'long-career-42',truth,verdict:{result:'not-guilty'},
 people:[{key:'A',name:'의사'},{key:'B',name:'환자'},{key:'W4',name:'배우자'}],
 policy:{pregnancyFromIncident:false,incidentPregnancyExcluded:true,partnerPresent:true,
 rates:{pregnancy:0,dispute:1000,divorce:1000,parentage:1000},...extra}});
for(const truth of ['did','didnt','reason']){
 const before=make(truth),later=A.advance(before,24);
 assert.equal(before.month,0,'input stays immutable');
 assert.equal(later.truth,truth);assert.deepEqual(later.verdict,before.verdict);
 assert.ok(later.facts.includes('incident_pregnancy_excluded'));
 assert.ok(!later.events.some(x=>x.id==='pregnancy-confirmed'));
 assert.ok(later.litigations.some(x=>x.id==='clinic-001:divorce'));
 assert.ok(!later.litigations.some(x=>x.id==='clinic-001:parentage'));
 assert.deepEqual(A.advance(before,24),later,'deterministic across replays');
 const chosen=A.assignPotential(later,'clinic-001:divorce','judge-B');
 assert.equal(chosen.litigations.find(x=>x.id==='clinic-001:divorce').assignedTo,'judge-B');
 assert.throws(()=>A.assignPotential(chosen,'clinic-001:divorce','judge-A'));
}
assert.throws(()=>make('did',{pregnancyFromIncident:true}),/excluded/);
assert.throws(()=>make('didnt',{pregnancyFromIncident:true,incidentPregnancyExcluded:false}),/contradicts/);
const laterPregnancy=make('didnt',{laterPregnancyPossible:true,rates:{pregnancy:1000,dispute:1000,divorce:1000,parentage:1000}});
const future=A.advance(laterPregnancy,24);
assert.ok(future.facts.includes('pregnancy_later_unrelated'));
assert.ok(future.facts.includes('birth_recorded'));
assert.ok(future.litigations.some(x=>x.id==='clinic-001:parentage'));
assert.ok(!future.facts.includes('pregnancy_linked_to_origin'));
const noClaim=make('reason',{rates:{pregnancy:0,dispute:0,divorce:0,parentage:0}});
assert.equal(A.advance(noClaim,36).litigations.length,0);
const one=A.advance(make('did'),8),two=A.advance(one,16);
assert.deepEqual(two,A.advance(make('did'),24),'month stepping must not change outcome');
console.log('PASS case afterlife · truth lock · pregnancy provenance · alternative/zero petitions · exclusive judge assignment');
