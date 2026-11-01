/* v6 QA: all 60 authored cases against deterministic courtroom core. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const T=require('../trial_core.js');
global.window={VERDICT_CURATED_PARTS:[],VERDICT_CURATED_DETAIL:[]};
const source=fs.readFileSync(path.join(__dirname,'..','curated_cases.js'),'utf8');
const engine={pool:()=>[],choose:()=>null};
new Function('window','CasePackEngine',source)(global.window,engine);
const C=window.VerdictCurated;
assert.equal(C.ids.length,60);
let trials=0,checks=0;
for(const c of Object.values(C.cases)){
 assert.equal(c.evidence.length,3,c.id+' evidence count');
 assert.equal(c.witnesses.length,3,c.id+' witness count');
 assert.equal(c.acts.length,4,c.id+' act count');
 const defs={id:c.id,archetypeId:c.id,strict:true,
  evidence:c.evidence.map((e,i)=>({id:'e'+i,title:e.title,hintFlaw:e.flaw||'none'})),
  witnesses:c.witnesses.map((w,i)=>({id:'w'+i,role:w.role}))};
 for(let seed=0;seed<80;seed++){
  const d={...defs,truth:['did','didnt','reason'][seed%3]};
  const hist=seed%2?[{archetypeId:c.id,truth:'did',firstFlaw:d.evidence[0].hintFlaw}]:[];
  const t=T.roll(d,'qa:'+c.id+':'+seed,hist);
  const again=T.roll(d,'qa:'+c.id+':'+seed,hist);
  assert.deepEqual(t,again,'non-deterministic '+c.id);
  t.evidence.forEach((e,i)=>{assert.equal(e.flawType,d.evidence[i].hintFlaw,'flaw/text conflict '+c.id+' seed '+seed);checks++});
  assert.equal(new Set(t.witnesses.map(w=>w.id)).size,t.witnesses.length,'duplicate witness IDs '+c.id);
  t.witnesses.forEach(w=>{w.asked=1;for(const attitude of ['honest','fear','protect','flip']){w.attitude=attitude;const x=T.testimony(w,t.truth);assert(Number.isFinite(x.p)&&Number.isFinite(x.d),'bad testimony '+c.id);}});
  const g=T.gauge(t);assert(Number.isFinite(g.P)&&Number.isFinite(g.D),'bad gauge '+c.id);
  trials++;
 }
}
console.log('PASS: '+C.ids.length+' curated cases, '+trials+' seeded trials, '+checks+' evidence checks; deterministic testimony and unique witness IDs');
