/* THE VERDICT — Advanced Courtroom Conflict Engine v1.
 * Authored dialogue only. Claims must cite submitted evidence or testimony
 * already on the trial record. No legal verdict or proof score is generated.
 */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./advanced_case_engine.js'):root.VerdictAdvancedCase);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.VerdictCourtroomConflict=api;
})(typeof window!=='undefined'?window:null,function(Case){
 'use strict';
 if(!Case)throw Error('Advanced Case Engine is required');
 const copy=x=>JSON.parse(JSON.stringify(x));
 const phases=['claim','rebuttal','counter','intervention'];
 const intensity=['analytical','firm','heated'];
 function validate(script){
  if(!script||!Array.isArray(script.lines)||!script.lines.length)throw Error('Authored courtroom lines required');
  const ids=new Set();
  for(const line of script.lines){
   if(!line.id||ids.has(line.id))throw Error('Missing/duplicate line id');
   ids.add(line.id);
   if(!phases.includes(line.phase)||!line.speaker||typeof line.text!=='string'||!line.text.trim())throw Error('Invalid authored dialogue '+line.id);
   if(!intensity.includes(line.intensity||'analytical'))throw Error('Invalid intensity');
   if(!Array.isArray(line.support)||!line.support.length)throw Error('Line needs referenced court record '+line.id);
   for(const item of line.support){
    if(!item||!['evidence','testimony','argument'].includes(item.type)||!item.id)throw Error('Invalid support reference');
   }
   if(line.replyTo&&typeof line.replyTo!=='string')throw Error('Invalid reply target');
   if(line.phase==='intervention'&&line.speaker!=='judge')throw Error('Judge alone intervenes');
  }
  for(const line of script.lines)if(line.replyTo&&!ids.has(line.replyTo))throw Error('Unknown reply target '+line.replyTo);
  return true;
 }
 function lineAvailable(state,line,script){
  const lock=Case.read(state),history=state.proceedings||[];
  if(history.some(p=>p.type==='order'&&p.action==='courtroom-line'&&p.lineId===line.id))return false;
  if(line.replyTo&&!history.some(p=>p.type==='order'&&p.action==='courtroom-line'&&p.lineId===line.replyTo))return false;
  return line.support.every(ref=>{
   if(ref.type==='evidence')return lock.evidence.some(e=>e.id===ref.id)&&history.some(p=>p.type==='submission'&&p.evidenceId===ref.id);
   if(ref.type==='testimony')return history.some(p=>p.type==='testimony'&&p.seq===Number(ref.id));
   return history.some(p=>p.type==='order'&&p.action==='courtroom-line'&&p.lineId===ref.id);
  });
 }
 function choices(state,script){
  validate(script);
  return script.lines.filter(line=>lineAvailable(state,line,script)).map(x=>({id:x.id,phase:x.phase,speaker:x.speaker,intensity:x.intensity||'analytical',text:x.text}));
 }
 function play(state,script,lineId){
  validate(script);
  const line=script.lines.find(x=>x.id===lineId);
  if(!line||!lineAvailable(state,line,script))throw Error('Courtroom line unavailable');
  const next=Case.append(state,{type:'order',action:'courtroom-line',lineId:line.id,phase:line.phase,speaker:line.speaker,
   text:line.text,intensity:line.intensity||'analytical',support:copy(line.support)});
  return next;
 }
 function history(state){Case.read(state);return copy((state.proceedings||[]).filter(p=>p.type==='order'&&p.action==='courtroom-line'))}
 return Object.freeze({validate,choices,play,history});
});
