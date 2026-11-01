/* Legacy -> Advanced v1 adapter: additive, no changes to legacy case IDs/saves.
 * Authored fiction does NOT need a real court citation; provenance is declared.
 * Invented timestamps are explicitly marked as adaptation, not source facts.
 */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./advanced_case_engine.js'):root.VerdictAdvancedCase);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.VerdictLegacyAdvanced=api;})(typeof window!=='undefined'?window:null,function(Case){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const truthKeys=['did','didnt','reason'];
const get=(obj,k)=>obj&&typeof obj[k]==='string'?obj[k]:typeof obj==='string'?obj:'';
const specific=(x)=>String(x||'').replace(/\{(A|B|W1|W2|W3|L)(?:\|[^}]+)?\}/g,(_,n)=>({A:'피고인',B:'상대방',W1:'증인 1',W2:'증인 2',W3:'증인 3',L:'변호인'}[n]));
const hash=s=>{let h=2166136261;for(const ch of s)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return h>>>0};
function convert(c){
 if(!c||!c.id||!c.truth||!truthKeys.every(t=>c.truth[t])||!Array.isArray(c.evidence)||!Array.isArray(c.witnesses))throw Error('Incomplete legacy case');
 const n=hash(c.id),date='2026-'+String(n%10+1).padStart(2,'0')+'-'+String((n>>>8)%27+1).padStart(2,'0');
 const place=specific(c.story?.location||c.location||c.logline||c.summary||'창작 사건의 주요 현장').slice(0,85);
 const events=[
 {id:'e-arrival',at:date+'T20:05+09:00',place,action:specific(c.summary||c.logline||'당사자가 현장에 있었다')},
 {id:'e-critical',at:date+'T20:25+09:00',place,action:'진실별 실제 사건 행위는 잠금 기록에 고정됨'},
 {id:'e-report',at:date+'T21:05+09:00',place,action:specific(c.claims?.[0]||'사건이 신고 또는 분쟁으로 이어졌다')}
 ];
 const variants={};
 for(const t of truthKeys){
 const es=clone(events);es[1].action=specific(c.truth[t]);
 const evidence=c.evidence.map((e,i)=>({id:'evidence-'+i,kind:e.title||'사건 자료',source:'기존 창작 사건 자료집',excerpt:specific(get(e.excerpt,t)||get(e.shows,t)||e.shows||e.title||''),caveat:specific(e.caveat||''),provenance:'기존 창작 기록: 확보 경위 추가 감수 필요'}));
 const witnesses=c.witnesses.map((w,i)=>({id:'witness-'+i,role:w.role||'증인',observedEventIds:['e-arrival'],interest:w.stake||'',script:{opening:{prompt:`${w.role||'증인'}은 사건 현장에서 무엇을 직접 관찰했습니까?`,confrontEvidenceIds:['evidence-'+Math.min(i,evidence.length-1)],responses:{initial:{text:specific(get(w.answers,t)||get(w.says,t)||w.says||'제가 직접 본 상황만 설명하겠습니다.'),knowledgeSource:'memory',eventId:'e-arrival'},clarify:{text:'앞서 말한 것은 제가 직접 목격한 범위입니다. 직접 보지 않은 부분은 모릅니다.',knowledgeSource:'memory'},confront:{text:'제 기억과 기록에 차이가 있다면, 원본 기록 시각과 관찰 위치를 확인해야 합니다.',knowledgeSource:'document'}}}}));
 variants[t]={events:es,evidence,witnesses};
 }
 return {id:c.id,version:1,title:specific(c.logline||c.id),provenance:{type:'original_fiction',courtJudgmentRequired:false,realCaseVerified:false},adaptation:{generatedDate:date,locationSource:c.location?'location':'narrative',timestampStatus:'synthetic_requires_editorial_review',witnessObservationStatus:'provisional',enhancementStatus:'draft'},legacy:{story:specific(c.summary||''),acts:clone(c.acts||[]),endings:clone(c.endings||{}),followUps:clone(c.followUps||[])},definition:{id:c.id,version:1,variants}};
}
function all(cases){const values=Array.isArray(cases)?cases:Object.values(cases);const out=values.map(convert);if(new Set(out.map(x=>x.id)).size!==out.length)throw Error('Duplicate original ID');return out}
function start(item,seed,truth){return Case.create(item.definition,seed,truth)}
return Object.freeze({convert,all,start});
});
