/* THE VERDICT — Witness Engine v1 (Advanced-only, authored testimony).
 * Never invent testimony: responses are authored per truth and question.
 * Observation facts remain inside Advanced Case lock; courtroom responses
 * and disclosure history are append-only. No legal/guilt inference.
 */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./advanced_case_engine.js'):root.VerdictAdvancedCase);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.VerdictWitnessEngine=api;
})(typeof window!=='undefined'?window:null,function(Case){
 'use strict';
 if(!Case)throw Error('Advanced Case Engine must load first');
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const modes=['initial','clarify','confront','recall'];
 const traitNames=['memoryAccuracy','memoryConfidence','honesty','pressureSensitivity','interest'];
 function validateWitness(w){
  if(!w||!w.id||!Array.isArray(w.observedEventIds))throw Error('Invalid witness');
  if(!w.script||typeof w.script!=='object')throw Error('Missing authored witness script '+w.id);
  const traits=w.traits||{};
  for(const name of traitNames)if(own(traits,name)&&(!Number.isInteger(traits[name])||traits[name]<0||traits[name]>100))throw Error('Invalid witness trait '+name);
  for(const [qid,q] of Object.entries(w.script)){
   if(!qid||!q||typeof q!=='object'||!q.prompt||!q.responses)throw Error('Invalid authored question '+qid);
   for(const mode of Object.keys(q.responses)){
    if(!modes.includes(mode))throw Error('Unknown response mode '+mode);
    const response=q.responses[mode];
    if(!response||typeof response.text!=='string'||!response.text.trim())throw Error('Empty authored response '+qid+'/'+mode);
    if(response.eventId&&!w.observedEventIds.includes(response.eventId)&&response.knowledgeSource==='direct')
     throw Error('Impossible direct observation '+qid);
    if(response.knowledgeSource&&!['direct','hearsay','inference','memory','document','unknown'].includes(response.knowledgeSource))throw Error('Invalid knowledge source');
   }
   if(!q.responses.initial)throw Error('Initial response required '+qid);
  }
  return true;
 }
 function validateState(state){
  const locked=Case.read(state);
  for(const w of locked.witnesses)if(w.script)validateWitness(w);
  return locked;
 }
 function options(state,witnessId,questionId){
  const lock=validateState(state),w=lock.witnesses.find(x=>x.id===witnessId);
  if(!w)throw Error('Unknown witness');
  if(!w.script)throw Error('No Advanced witness script for '+witnessId);
  const q=w.script[questionId];if(!q)throw Error('Unknown question');
  const prior=state.proceedings.filter(x=>x.type==='testimony'&&x.witnessId===witnessId&&x.questionId===questionId);
  return modes.filter(mode=>q.responses[mode]&&
   (mode==='initial'?prior.length===0:
    mode==='clarify'?prior.length>0:
    mode==='confront'?prior.length>0&&Array.isArray(q.confrontEvidenceIds)&&q.confrontEvidenceIds.some(id=>state.proceedings.some(x=>x.type==='submission'&&x.evidenceId===id)):
    prior.length>0&&state.proceedings.some(x=>x.type==='order'&&x.action==='recall'&&x.witnessId===witnessId)));
 }
 function ask(state,{witnessId,questionId,mode='initial'}){
  const locked=validateState(state),w=locked.witnesses.find(x=>x.id===witnessId);
  if(!w||!w.script||!w.script[questionId])throw Error('Unknown authored witness question');
  if(!options(state,witnessId,questionId).includes(mode))throw Error('Response unavailable: '+mode);
  const q=w.script[questionId],response=q.responses[mode];
  // Only authored literal lines; no mutation, interpolation or generated claims.
  return Case.append(state,{type:'testimony',witnessId,questionId,mode,text:response.text,
   knowledgeSource:response.knowledgeSource||'unknown',eventId:response.eventId||null});
 }
 function history(state,witnessId){
  const lock=validateState(state);
  if(!lock.witnesses.some(w=>w.id===witnessId))throw Error('Unknown witness');
  return copy(state.proceedings.filter(x=>x.type==='testimony'&&x.witnessId===witnessId));
 }
 return Object.freeze({validateWitness,validateState,options,ask,history});
});
