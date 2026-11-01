/* Legacy -> Advanced adapter (v2): additive, legacy case IDs and saves untouched.
 * Every line comes from the authored legacy case. Nothing generic is added:
 * - questions and truth-dependent answers are the legacy witness questions (plus recall questions from follow-up nodes);
 * - modes the legacy case never wrote (clarify / confront) are left out instead of filled with stock sentences;
 * - {A|이}-style name tokens are kept, so the game fills real names and particles when it shows the text.
 * What the legacy format does not have (clock times, places, who saw which moment) is marked as needing authoring,
 * never invented as fact. The item keeps only the legacy case id, not a copy of the case (save size).
 */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./advanced_case_engine.js'):root.VerdictAdvancedCase);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.VerdictLegacyAdvanced=api;})(typeof window!=='undefined'?window:null,function(Case){
'use strict';
const TRUTHS=['did','didnt','reason'];
const R=(v,t)=>v&&typeof v==='object'&&!Array.isArray(v)?v[t]:v;
const kindOf=c=>c.charge?'criminal':c.decision?'decision':'civil';
function evidenceOf(e,id,t){
 return {id,kind:e.kind||e.title||'자료',title:e.title||e.kind,source:e.by||'',when:e.when||'',provenance:e.how||'',
  excerpt:R(e.excerpt,t)||R(e.shows,t)||'',shows:R(e.shows,t)||'',caveat:e.caveat||'',issue:e.issue||null,side:R(e.side,t)||null};
}
function scriptOf(c,w,i,t){
 const script={};
 for(const q of w.q||[])script[q.id]={prompt:q.q,issue:q.issue,hidden:!!q.hidden,next:q.next||[],
  responses:{initial:{text:R(q.a,t),knowledgeSource:'memory'}}};
 for(const f of c.followUps||[])if(f.type==='recall'&&f.recall&&f.recall.w===i)
  for(const q of f.recall.q||[])script[f.id+'-'+q.id]={prompt:q.q,issue:q.issue,order:f.id,
   responses:{initial:{text:R(q.a,t),knowledgeSource:'memory'}}};
 return script;
}
function convert(c){
 if(!c||!c.id||!c.truth||!TRUTHS.every(t=>c.truth[t])||!Array.isArray(c.evidence)||!Array.isArray(c.witnesses))throw Error('Incomplete legacy case '+(c&&c.id));
 const variants={};
 for(const t of TRUTHS){
  const events=[
   {id:'e-background',at:'unknown',place:'unknown',action:c.summary},
   {id:'e-critical',at:'unknown',place:'unknown',action:c.truth[t]},
   {id:'e-dispute',at:'unknown',place:'unknown',action:(c.claims||[])[0]||c.logline}
  ];
  const evidence=c.evidence.map((e,i)=>evidenceOf(e,'evidence-'+i,t));
  if(c.late)evidence.push(evidenceOf(c.late,'late',t));
  const witnesses=c.witnesses.map((w,i)=>({id:'witness-'+i,role:w.role,story:w.story,stake:w.stake,says:R(w.says,t),lead:w.lead,
   observedEventIds:[],script:scriptOf(c,w,i,t)}));
  variants[t]={events,evidence,witnesses};
 }
 return {id:c.id,version:1,kind:kindOf(c),title:c.logline,
  provenance:{type:'original_fiction',courtJudgmentRequired:false,realCaseVerified:false},
  adaptation:{source:'curated',legacyCaseId:c.id,textTokens:'kept',timestampStatus:'needs_authoring',placeStatus:'needs_authoring',witnessObservationStatus:'needs_authoring',clarifyConfront:'not_authored'},
  definition:{id:c.id,version:1,variants}};
}
function all(cases){const values=Array.isArray(cases)?cases:Object.values(cases);const out=values.map(convert);if(new Set(out.map(x=>x.id)).size!==out.length)throw Error('Duplicate original ID');return out}
function start(item,seed,truth){return Case.create(item.definition,seed,truth)}
return Object.freeze({convert,all,start});
});
