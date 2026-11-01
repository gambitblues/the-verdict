const assert=require('node:assert/strict');
const Core=require('../advanced_case_engine.js'),App=require('../dev/advanced-pilot/advanced_pilot_integration.js');
for(const truth of ['did','didnt','reason']){
 let p=App.start('2026-001',truth),start=JSON.stringify(Core.read(p.state));
 assert.equal(App.check(p),true);
 assert.equal(App.future(p,{date:'2027-05-01',birthRecorded:false,paternityDisputed:true,authorizedClaimant:true,existingParentageReviewed:true}).available,false);
 assert.equal(App.future(p,{date:'2027-05-01',birthRecorded:true,paternityDisputed:true,authorizedClaimant:true,existingParentageReviewed:true}).available,true);
 p=App.ask(p,{witnessId:'nurseA',questionId:'return_time'});
 assert.equal(p.state.proceedings[0].type,'testimony');
 p=App.say(p,'question');p=App.say(p,'answer');
 assert.throws(()=>App.say(p,'show_cctv'),/unavailable/);
 p=App.evidence(p,'cctv');
 p=App.ask(p,{witnessId:'nurseA',questionId:'return_time',mode:'confront'});
 for(const id of ['show_cctv','explain','prosecution','defense'])p=App.say(p,id);
 assert.equal(p.state.proceedings.filter(x=>x.action==='courtroom-line').length,6);
 assert.equal(JSON.stringify(Core.read(p.state)),start);
 assert.equal(App.check({...p,state:JSON.parse(JSON.stringify(p.state))}),true);
 const duplicate=App.evidence(p,'cctv');assert.equal(duplicate.state.proceedings.length,p.state.proceedings.length);
 assert.deepEqual(App.start('2026-001',truth),App.start('2026-001',truth));
}
console.log('PASS Advanced clinic pilot: all truths, causality, evidence, witnesses, save/load, gated family sequel');
