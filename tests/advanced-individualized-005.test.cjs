const assert=require('node:assert/strict');
const bundle=require('../advanced-content/individualized-overrides.cjs');
const Case=require('../advanced_case_engine.js'),W=require('../advanced_witness_engine.js'),T=require('../advanced_timeline_evidence.js'),F=require('../advanced_courtroom_conflict.js');
assert.equal(bundle.cases.length,99);
const special=bundle.cases.filter(c=>c.qa.individualizedAuthorship);
assert.equal(special.length,5);
let n=0;
for(const c of special){
 F.validate(c.dialogue);
 for(const truth of ['did','didnt','reason']){
  let s=Case.create(c.definition,'hand-authored-smoke',truth);W.validateState(s);T.inspect(s,c.manifest);
  s=W.ask(s,{witnessId:'w01',questionId:'opening'});
  s=F.play(s,c.dialogue,'q');s=F.play(s,c.dialogue,'a');
  assert.throws(()=>F.play(s,c.dialogue,'c'),/unavailable/);
  s=T.submit(s,c.manifest,'doc02');
  for(const id of ['c','e','p','d'])s=F.play(s,c.dialogue,id);
  assert.equal(Case.read(s).truth,truth);
  assert.equal(F.history(s).length,6);
  n++;
 }
}
console.log('PASS individually authored five cases x three truths:',n,'paths; remaining cases still templates');
