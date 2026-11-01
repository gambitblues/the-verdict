/* THE VERDICT — Courtroom Conflict Engine v2: causal, authored exchanges.
 * Actual case truth remains locked. Nothing is randomly generated.
 * Each statement has a concrete purpose, an explicit record anchor, and
 * an optional prerequisite. A judicial warning requires a recorded trigger.
 */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./advanced_case_engine.js'):root.VerdictAdvancedCase);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.VerdictCourtroomConflict=api;
})(typeof window!=='undefined'?window:null,function(Case){
 'use strict';
 if(!Case)throw Error('Advanced Case Engine is required');
 const copy=x=>JSON.parse(JSON.stringify(x));
 const phases=['question','answer','confrontation','explanation','claim','rebuttal','counter','intervention'];
 const intensities=['analytical','firm','heated'];
 const purposes=['establish','clarify','test_memory','impeach','explain','argue','respond','manage_proceeding'];
 const supports=['evidence','testimony','argument'];
 function validate(script){
  if(!script||!Array.isArray(script.lines)||!script.lines.length)throw Error('Authored courtroom lines required');
  const ids=new Set();
  for(const l of script.lines){
   if(!l||!l.id||ids.has(l.id))throw Error('Missing/duplicate line id');
   ids.add(l.id);
   if(!phases.includes(l.phase)||!l.speaker||typeof l.text!=='string'||!l.text.trim())throw Error('Invalid authored dialogue '+l.id);
   if(!intensities.includes(l.intensity||'analytical'))throw Error('Invalid intensity '+l.id);
   if(!purposes.includes(l.purpose))throw Error('Missing/invalid purpose '+l.id);
   if(!l.issueId||!l.target||!l.target.fact)throw Error('Missing issue or specific factual target '+l.id);
   if(!Array.isArray(l.support)||!l.support.length)throw Error('Missing court record support '+l.id);
   for(const r of l.support)if(!r||!supports.includes(r.type)||!String(r.id||'').trim())throw Error('Invalid support reference '+l.id);
   if(l.replyTo&&typeof l.replyTo!=='string')throw Error('Invalid reply target');
   if(l.phase==='intervention'){
    if(l.speaker!=='judge'||!l.replyTo||!l.trigger||!['personal_attack','disruption','irrelevant_question','repeated_question'].includes(l.trigger))throw Error('Intervention must have recorded cause');
   }else if(l.speaker==='judge')throw Error('Judge lines require intervention phase');
   if(l.phase==='answer'&&l.speaker!=='witness')throw Error('Witness answer speaker required');
   if(l.phase==='confrontation'&&!l.support.some(r=>r.type==='evidence') )throw Error('Confrontation requires evidence');
  }
  for(const l of script.lines){
   if(l.replyTo&&!ids.has(l.replyTo))throw Error('Unknown reply target '+l.replyTo);
   if(l.phase==='intervention'){
    const parent=script.lines.find(x=>x.id===l.replyTo);
    if(!parent||parent.triggerEvent!==l.trigger)throw Error('Judicial warning trigger does not match authored cause '+l.id);
   }
  }
  return true;
 }
 function occurred(history,id){return history.some(p=>p.type==='order'&&p.action==='courtroom-line'&&p.lineId===id)}
 function available(state,l){
  const lock=Case.read(state),h=state.proceedings||[];
  if(occurred(h,l.id)||(l.replyTo&&!occurred(h,l.replyTo)))return false;
  return l.support.every(r=>{
   if(r.type==='evidence')return lock.evidence.some(e=>e.id===r.id)&&h.some(p=>p.type==='submission'&&p.evidenceId===r.id);
   if(r.type==='testimony')return h.some(p=>p.type==='testimony'&&String(p.seq)===String(r.id));
   return occurred(h,r.id);
  });
 }
 function choices(state,script){
  validate(script);
  return script.lines.filter(l=>available(state,l)).map(l=>({id:l.id,phase:l.phase,speaker:l.speaker,text:l.text,purpose:l.purpose,issueId:l.issueId,target:copy(l.target),intensity:l.intensity||'analytical'}));
 }
 function play(state,script,id){
  validate(script);const l=script.lines.find(x=>x.id===id);
  if(!l||!available(state,l))throw Error('Courtroom line unavailable');
  return Case.append(state,{type:'order',action:'courtroom-line',lineId:l.id,phase:l.phase,speaker:l.speaker,
   text:l.text,purpose:l.purpose,issueId:l.issueId,target:copy(l.target),replyTo:l.replyTo||null,
   intensity:l.intensity||'analytical',triggerEvent:l.triggerEvent||null,trigger:l.trigger||null,support:copy(l.support)});
 }
 function history(state){Case.read(state);return copy((state.proceedings||[]).filter(p=>p.type==='order'&&p.action==='courtroom-line'))}
 return Object.freeze({validate,choices,play,history});
});
