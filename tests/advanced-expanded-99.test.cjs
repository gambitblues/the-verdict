const assert=require('node:assert/strict');
const pack=require('../advanced-content/expand-99.cjs');
const Case=require('../advanced_case_engine.js'),Witness=require('../advanced_witness_engine.js'),Evidence=require('../advanced_timeline_evidence.js'),Court=require('../advanced_courtroom_conflict.js');
assert.equal(pack.cases.length,99);
const ids=new Set();let tested=0;
for(const item of pack.cases){
 assert.ok(!ids.has(item.id));ids.add(item.id);
 assert.equal(item.sourceFactsVerified,false);
 assert.equal(item.qa.fullPlaythrough,false);
 Court.validate(item.dialogue);
 for(const truth of ['did','didnt','reason']){
  const state=Case.create(item.definition,'qa-2026',truth);Witness.validateState(state);Evidence.inspect(state,item.manifest);
  const s1=Witness.ask(state,{witnessId:'w01',questionId:'opening'});
  const s2=Court.play(s1,item.dialogue,'q');
  const s3=Court.play(s2,item.dialogue,'a');
  assert.throws(()=>Court.play(s3,item.dialogue,'c'),/unavailable/);
  const s4=Evidence.submit(s3,item.manifest,'doc02');
  const s5=Court.play(s4,item.dialogue,'c');
  const s6=Court.play(s5,item.dialogue,'e');
  const s7=Court.play(s6,item.dialogue,'p');
  const s8=Court.play(s7,item.dialogue,'d');
  assert.equal(Court.history(s8).length,6);
  assert.equal(Case.read(s8).truth,truth);
  assert.equal(Case.read(s8).events.length,3);
  assert.equal(JSON.stringify(Case.read(s8)),JSON.stringify(Case.read(state)));
  tested++;
 }
}
console.log('PASS '+tested+' Advanced draft truth-paths (99 x 3), 99 evidence manifests, scripted witnesses, sequential courtroom checks');
