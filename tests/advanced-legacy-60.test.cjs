const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Case=require('../advanced_case_engine.js'),W=require('../advanced_witness_engine.js'),A=require('../advanced_legacy_adapter.js');
global.window={VERDICT_CURATED_PARTS:[],VERDICT_CURATED_DETAIL:[]};
new Function('window','CasePackEngine',fs.readFileSync(path.join(__dirname,'../curated_cases.js'),'utf8'))(global.window,{pool:()=>[]});
const cases=global.window.VerdictCurated.cases;assert.equal(Object.keys(cases).length,60);
const items=A.all(cases);assert.equal(items.length,60);
const lines=new Map(),add=(s,id)=>{if(!s||s.length<12)return;if(!lines.has(s))lines.set(s,new Set());lines.get(s).add(id)};
let check=0;
for(const item of items){
 assert.equal(item.provenance.type,'original_fiction');assert.equal(item.adaptation.timestampStatus,'needs_authoring');
 const legacy=cases[item.id],answers={};
 for(const truth of ['did','didnt','reason']){
  let state=A.start(item,'legacy-smoke',truth);
  const lock=Case.read(state);assert.equal(lock.caseId,item.id);assert.equal(lock.truth,truth);
  assert.equal(lock.events.length,3);assert.equal(lock.witnesses.length,3);assert.equal(lock.evidence.length,legacy.late?4:3);
  assert.equal(lock.events[1].action,legacy.truth[truth],'the hidden event is the authored truth');
  W.validateState(state);
  for(const w of lock.witnesses)for(const [qid,q] of Object.entries(w.script)){
   assert.ok(q.prompt&&q.responses.initial.text,item.id+' '+w.id+' '+qid+' is authored');
   assert.ok(!q.responses.clarify&&!q.responses.confront,'no stock clarify/confront lines');
   add(q.prompt,item.id);add(q.responses.initial.text,item.id);(answers[w.id+qid]??=new Set()).add(q.responses.initial.text);
  }
  for(const e of lock.evidence)add(e.excerpt,item.id);
  state=W.ask(state,{witnessId:'witness-0',questionId:lock.witnesses[0].script.q1?'q1':Object.keys(lock.witnesses[0].script)[0]});
  assert.equal(state.proceedings.length,1);
  assert.equal(JSON.stringify(Case.read(state)),JSON.stringify(lock));
  check++;
 }
 assert.ok(Object.values(answers).filter(s=>s.size>1).length>=2,item.id+': answers must change with the hidden truth');
 assert.ok(JSON.stringify(item).includes('{A'),item.id+': name tokens are kept for the game to fill');
 assert.ok(!('legacy' in item),'no copy of the legacy case (save size)');
}
const shared=[...lines].filter(([,ids])=>ids.size>=3);
assert.equal(shared.length,0,'lines repeated across cases: '+shared.slice(0,3).map(([s])=>s).join(' / '));
console.log('PASS 60 legacy cases × 3 fixed truths: '+check+' Advanced paths, '+lines.size+' authored lines, none repeated across cases');
