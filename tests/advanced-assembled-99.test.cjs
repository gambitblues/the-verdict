const assert=require('node:assert/strict');
const p=require('../advanced-content/assembled-99.cjs');
const Case=require('../advanced_case_engine.js'),W=require('../advanced_witness_engine.js'),T=require('../advanced_timeline_evidence.js'),F=require('../advanced_courtroom_conflict.js');
assert.equal(p.cases.length,99);
assert.equal(p.cases.filter(x=>x.qa.caseSpecificEditorial).length,94);
assert.equal(p.cases.filter(x=>x.qa.individualizedAuthorship).length,5);
let count=0;
for(const c of p.cases)for(const truth of ['did','didnt','reason']){
 let s=Case.create(c.definition,'test-seed',truth);W.validateState(s);T.inspect(s,c.manifest);F.validate(c.dialogue);
 s=W.ask(s,{witnessId:'w01',questionId:'opening'});s=F.play(s,c.dialogue,'q');s=F.play(s,c.dialogue,'a');
 s=T.submit(s,c.manifest,'doc02');for(const k of ['c','e','p','d'])s=F.play(s,c.dialogue,k);
 assert.equal(F.history(s).length,6);assert.equal(Case.read(s).truth,truth);count++;
}
console.log('PASS Advanced editorial assembly 99 cases x 3 truths: '+count);
