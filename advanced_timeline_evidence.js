/* THE VERDICT — Advanced Timeline & Evidence v1.
 * Deterministic comparisons of authored, immutable case records.
 * Device time is corrected only when a verified offset is explicitly authored.
 * No automated legal findings, guilt inference or new factual claims.
 */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./advanced_case_engine.js'):root.VerdictAdvancedCase);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.VerdictTimelineEvidence=api;
})(typeof window!=='undefined'?window:null,function(Case){
 'use strict';
 if(!Case)throw Error('Advanced Case Engine is required');
 const clone=x=>JSON.parse(JSON.stringify(x));
 function minute(s){
  if(typeof s!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?:Z|[+-]\d\d:\d\d)?$/.test(s))throw Error('Timestamp must include ISO date and timezone');
  const n=Date.parse(s);if(!Number.isFinite(n))throw Error('Invalid timestamp');
  return n/60000;
 }
 // Record timestamp is actual time plus device offset in minutes.
 function time(record,devices={}){
  if(!record||!record.at)throw Error('Missing record time');
  const d=record.deviceId&&devices[record.deviceId];
  if(record.deviceId&&!d)throw Error('Unknown recording device '+record.deviceId);
  const offset=d?.offsetMinutes??0;
  if(!Number.isFinite(offset))throw Error('Invalid clock offset');
  const uncertainty=record.uncertaintyMinutes??0;
  if(!Number.isFinite(uncertainty)||uncertainty<0)throw Error('Invalid uncertainty');
  const center=minute(record.at)-offset;
  return {from:center-uncertainty,to:center+uncertainty,offsetMinutes:offset,uncertaintyMinutes:uncertainty};
 }
 function validateManifest(manifest){
  if(!manifest||!Array.isArray(manifest.records))throw Error('Evidence records required');
  const devices=manifest.devices||{},seen=new Set();
  for(const [id,device] of Object.entries(devices)){
   if(!id||!Number.isFinite(device.offsetMinutes))throw Error('Invalid device offset');
  }
  for(const r of manifest.records){
   if(!r.id||seen.has(r.id))throw Error('Duplicate/missing record id');
   seen.add(r.id);time(r,devices);
   if(!r.source||!r.provenance||!r.kind)throw Error('Missing evidence provenance');
   if(r.eventId&&typeof r.eventId!=='string')throw Error('Invalid event id');
  }
  return true;
 }
 function inspect(state,manifest){
  const locked=Case.read(state);validateManifest(manifest);
  const events=new Set(locked.events.map(e=>e.id));
  const knownEvidence=new Set(locked.evidence.map(e=>e.id));
  for(const r of manifest.records){
   if(r.eventId&&!events.has(r.eventId))throw Error('Unknown referenced event '+r.eventId);
   if(!knownEvidence.has(r.id))throw Error('Record not in locked evidence '+r.id);
  }
  return manifest.records.map(r=>({id:r.id,eventId:r.eventId||null,range:time(r,manifest.devices||{}),
    source:r.source,kind:r.kind,provenance:r.provenance}));
 }
 function contrast(a,b,devices={}){
  const x=time(a,devices),y=time(b,devices);
  const overlap=Math.max(x.from,y.from)<=Math.min(x.to,y.to);
  if(a.eventId&&b.eventId&&a.eventId!==b.eventId)return {type:'different_event',overlap:false};
  return {type:overlap?'time_compatible':'time_disjoint',overlap,first:x,second:y};
 }
 function submit(state,manifest,evidenceId){
  const records=inspect(state,manifest),r=records.find(x=>x.id===evidenceId);
  if(!r)throw Error('Unknown manifest evidence');
  if(state.proceedings.some(x=>x.type==='submission'&&x.evidenceId===evidenceId))return state;
  return Case.append(state,{type:'submission',evidenceId,kind:r.kind,source:r.source,provenance:r.provenance});
 }
 return Object.freeze({minute,time,validateManifest,inspect,contrast,submit});
});
