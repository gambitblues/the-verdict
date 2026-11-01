/* THE VERDICT — Advanced Case Engine foundation v1.
 * Pure data engine: no mutation of legacy cases, no automatic legal conclusions.
 * The locked record represents authored fiction, not a judicial finding.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.VerdictAdvancedCase=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const hash=text=>{let h=2166136261;for(const ch of String(text))h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return h>>>0};
 const required=(v,label)=>{if(v===undefined||v===null||v==='')throw Error('Missing '+label);return v};
 function validate(def){
  if(!def||typeof def!=='object')throw Error('Invalid case definition');
  required(def.id,'id');required(def.version,'version');
  if(!def.variants||!['did','didnt','reason'].every(t=>def.variants[t]))throw Error('Three authored truth variants required');
  for(const truth of ['did','didnt','reason']){
   const v=def.variants[truth];
   if(!Array.isArray(v.events)||!v.events.length)throw Error('Events required for '+truth);
   if(!Array.isArray(v.evidence))throw Error('Evidence required for '+truth);
   if(!Array.isArray(v.witnesses))throw Error('Witnesses required for '+truth);
   const ids=new Set();
   for(const ev of v.events){required(ev.id,'event.id');required(ev.place,'event.place');required(ev.at,'event.at');required(ev.action,'event.action');if(ids.has(ev.id))throw Error('Duplicate event '+ev.id);ids.add(ev.id)}
   const evidenceIds=new Set();
   for(const ev of v.evidence){required(ev.id,'evidence.id');required(ev.kind,'evidence.kind');required(ev.source,'evidence.source');if(evidenceIds.has(ev.id))throw Error('Duplicate evidence '+ev.id);evidenceIds.add(ev.id)}
   for(const w of v.witnesses){required(w.id,'witness.id');if(!Array.isArray(w.observedEventIds))throw Error('observedEventIds required');for(const id of w.observedEventIds)if(!ids.has(id))throw Error('Witness observed unknown event '+id)}
  }
  return true;
 }
 function create(def,seed,truthOverride){
  validate(def);required(seed,'seed');
  const truth=truthOverride||['did','didnt','reason'][hash(def.id+':'+seed)%3];
  if(!['did','didnt','reason'].includes(truth))throw Error('Invalid truth');
  const v=clone(def.variants[truth]);
  const immutable=Object.freeze({caseId:def.id,version:def.version,seed:String(seed),truth,events:v.events,evidence:v.evidence,witnesses:v.witnesses});
  const seal=JSON.stringify(immutable);
  return {schema:'verdict-advanced-state/v1',lock:seal,proceedings:[],revision:0};
 }
 function read(state){const x=JSON.parse(state.lock);if(!x.caseId||!x.truth||!Array.isArray(x.events))throw Error('Invalid case lock');return x}
 function append(state,entry){
  const frozen=read(state);if(!entry||!['testimony','submission','objection','order','finding'].includes(entry.type))throw Error('Invalid proceeding');
  if(entry.type==='testimony'&&!frozen.witnesses.some(w=>w.id===entry.witnessId))throw Error('Unknown witness');
  if(entry.type==='submission'&&!frozen.evidence.some(e=>e.id===entry.evidenceId))throw Error('Unknown evidence');
  const next=clone({schema:state.schema,lock:state.lock,proceedings:state.proceedings,revision:state.revision});
  next.proceedings.push({...clone(entry),seq:next.proceedings.length+1});
  next.revision++;return next;
 }
 // Compare propositions only when same subject, event and temporal scope.
 // Never infer consent, intoxication, intent, or guilt from walking footage.
 function compare(a,b){
  if(!a||!b||!a.proposition||!b.proposition)return {type:'insufficient',reason:'비교할 명제가 부족합니다.'};
  if(a.subject!==b.subject||a.eventId!==b.eventId)return {type:'different_scope',reason:'인물 또는 사건 시점이 달라 직접 모순으로 볼 수 없습니다.'};
  if(a.interval&&b.interval&&(a.interval[1]<b.interval[0]||b.interval[1]<a.interval[0]))
   return {type:'different_scope',reason:'관찰 시간대가 서로 다릅니다.'};
  if(a.proposition!==b.proposition)return {type:'different_issue',reason:'서로 다른 사실을 설명하므로 추가 확인이 필요합니다.'};
  if(a.value===b.value)return {type:'consistent',reason:'두 자료의 해당 진술은 양립합니다.'};
  if(a.uncertain||b.uncertain)return {type:'possible_conflict',reason:'기록의 불확실성 때문에 직접 모순으로 단정할 수 없습니다.'};
  return {type:'direct_conflict',reason:'동일한 대상·시점·명제에 관해 기록 내용이 충돌합니다. 원본과 관찰 경위를 확인하세요.'};
 }
 return Object.freeze({validate,create,read,append,compare});
});
