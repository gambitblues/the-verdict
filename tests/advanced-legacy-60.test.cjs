const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Case=require('../advanced_case_engine.js'),W=require('../advanced_witness_engine.js'),A=require('../advanced_legacy_adapter.js');
global.window={VERDICT_CURATED_PARTS:[],VERDICT_CURATED_DETAIL:[]};
new Function('window','CasePackEngine',fs.readFileSync(path.join(__dirname,'../curated_cases.js'),'utf8'))(global.window,{pool:()=>[]});
const cases=global.window.VerdictCurated.cases;assert.equal(Object.keys(cases).length,60);
const items=A.all(cases);assert.equal(items.length,60);
let check=0;
for(const item of items){assert.equal(item.provenance.type,'original_fiction');assert.equal(item.adaptation.timestampStatus,'synthetic_requires_editorial_review');
 for(const truth of ['did','didnt','reason']){
 let state=A.start(item,'legacy-smoke',truth);
 const lock=Case.read(state);assert.equal(lock.caseId,item.id);
 assert.equal(lock.truth,truth);assert.equal(lock.events.length,3);
 assert.equal(lock.witnesses.length,3);assert.equal(lock.evidence.length,3);
 W.validateState(state);
 state=W.ask(state,{witnessId:'witness-0',questionId:'opening'});
 assert.equal(state.proceedings.length,1);
 assert.equal(JSON.stringify(Case.read(state)),JSON.stringify(lock));
 check++;
 }}
console.log('PASS 60 legacy cases × 3 fixed truths: '+check+' migrated Advanced draft paths; legacy content untouched');
