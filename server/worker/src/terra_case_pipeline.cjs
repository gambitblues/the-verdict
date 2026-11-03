/* THE VERDICT P3-6 — Terra authoring admission gate.
 * Pure data-only validation. No AI calls, network access or game save mutations.
 * Existing curated world sheets and legacy case packs are not migrated by this module.
 */
'use strict';

const SexualQuality=require('./sexual_case_quality.cjs');
const CaseRealism=require('./case_realism_quality.cjs');
const {createHash}=require('node:crypto');
const TARGETS=Object.freeze({homicide:85,sexual:80,violence:40,financial:50,property:45,reputation:45,civil:25,family:55,professional:45,public:30});
const TRUTHS=['did','didnt','reason'];
const REVIEW=['sourceVerified','fictionalizationChecked','legalChecked','timelineChecked','evidenceChecked','witnessChecked','allWorldsPlaytested','privacyChecked'];
const value=x=>typeof x==='string'&&x.trim().length>=8;
const serial=x=>JSON.parse(JSON.stringify(x));
const canonical=x=>String(x||'').toLowerCase().replace(/[^a-z0-9가-힣]+/g,' ').trim().replace(/\s+/g,' ');
const contentHash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const keyFor=x=>canonical([x?.card?.category,x?.card?.kind,x?.premise?.cause,x?.premise?.action,(x?.records||[]).map(r=>r.kind).sort().join(' ')].join(' '));
const validDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')&&!Number.isNaN(Date.parse(x+'T00:00:00Z'));
function validateDraft(candidate){
 const errors=[],warnings=[];
 const e=x=>errors.push(x);
 if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))return {ok:false,errors:['사건 초안은 객체여야 합니다.'],warnings:[]};
 if(candidate.format!=='verdict-terra-candidate/v1')e('Terra 초안 포맷이 다릅니다.');
 if(!/^[a-z][a-z0-9-]{3,79}$/.test(candidate.id||''))e('안전한 사건 ID가 필요합니다.');
 if(candidate.status!=='draft'&&candidate.status!=='review')e('생성 초안은 draft 또는 review만 가능합니다.');
 const card=candidate.card||{};
 if(!['criminal','civil','decision'].includes(card.kind)||!TARGETS.hasOwnProperty(card.category))e('사건 분류가 유효하지 않습니다.');
 if(!value(card.title)||!value(card.summary))e('공개 사건 제목/요지가 부족합니다.');
 const general=CaseRealism.validate(candidate);
 errors.push(...general.errors);warnings.push(...general.warnings);
 if(card.category==='sexual'){
  const realism=SexualQuality.validate(candidate.sexualRealism);
  errors.push(...realism.errors);warnings.push(...realism.warnings);
 }
 const source=candidate.source||{};
 if(!['original','precedent','article','secondary'].includes(source.type))e('출처 유형이 유효하지 않습니다.');
 if(source.type!=='original'){
  if(!value(source.title)||!value(source.publisher)||!/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(source.url||'')||!validDate(source.accessedAt)||!value(source.learning))e('출처 제목·기관·HTTPS URL·확인일·참고 쟁점이 필요합니다.');
 }
 if(source.type==='secondary')warnings.push('나무위키 등 2차 자료는 배경 참고만 가능하고, 법률 검증 근거가 될 수 없습니다.');
 if(source.type==='original'&&!value(source.note))e('순수 창작 사건은 창작 근거를 적어야 합니다.');
 const premise=candidate.premise||{};
 if(!value(premise.cause)||!value(premise.action)||!value(premise.aftermath))e('사건의 독립적인 인과관계 3단계가 필요합니다.');
 const scene=candidate.scene||{};
 if(!value(scene.location)||!value(scene.observed)||!value(scene.uncertainty))e('현장 관찰과 미확인 사실을 분리해야 합니다.');
 if(!Array.isArray(candidate.records)||candidate.records.length<3)e('서로 대조 가능한 증거 3개 이상이 필요합니다.');
 const records=Array.isArray(candidate.records)?candidate.records:[];
 const ids=records.map(x=>x?.id);
 if(ids.some(x=>!/^r-[a-z0-9-]{2,60}$/.test(x||''))||new Set(ids).size!==ids.length)e('증거 ID가 중복되거나 형식이 잘못됐습니다.');
 if(records.some(r=>!value(r?.title)||!value(r?.how)||!value(r?.limitation)||typeof r?.first!=='boolean'))e('증거의 제목·확보 경위·한계·공개 여부가 필요합니다.');
 if(!records.some(r=>r.first)||!records.some(r=>!r.first))e('처음부터 공개되는 증거와 후속 증거를 모두 마련해야 합니다.');
 const witnesses=Array.isArray(candidate.witnesses)?candidate.witnesses:[];
 if(!witnesses.length||witnesses.some(w=>!value(w?.role)||!value(w?.knowledgeLimit)))e('증인과 실제 관찰 한계를 기록해야 합니다.');
 const worlds=candidate.worlds||{};
 for(const truth of TRUTHS){
  const w=worlds[truth];
  if(!w||!value(w.act)||!value(w.cause)||!value(w.motive))e(truth+' 세계의 행위·원인·동기가 부족합니다.');
  if(!w||!w.records||ids.some(id=>!value(w.records[id])))e(truth+' 세계의 증거 원문이 부족합니다.');
  if(!w||!w.witnesses||witnesses.some(x=>!value(w.witnesses[x.id])))e(truth+' 세계의 증인 관찰이 부족합니다.');
  if(!Array.isArray(w?.timeline)||!w.timeline.length)e(truth+' 세계의 시간표가 없습니다.');
 }
 for(const [a,b] of [['did','didnt'],['did','reason'],['didnt','reason']]){
  if(worlds[a]&&worlds[b]&&ids.every(id=>canonical(worlds[a].records?.[id])===canonical(worlds[b].records?.[id])))
   e(a+' / '+b+' 세계를 구별할 증거 내용이 없습니다.');
 }
 const publicText=JSON.stringify({card,scene,source:{type:source.type,title:source.title,publisher:source.publisher}});
 for(const truth of TRUTHS){
  const act=worlds[truth]?.act;
  if(value(act)&&act.length>=40&&publicText.includes(act))e('숨겨진 세계의 행위가 공개 자료에 누출됐습니다.');
 }
 if(candidate.review!==undefined)e('초안에 운영자 승인 결과를 포함할 수 없습니다.');
 return {ok:!errors.length,errors,warnings,category:card.category,fingerprint:keyFor(candidate)};
}
function makeReview(candidate,checks,reviewer){
 if(!candidate||candidate.status!=='review')return {ok:false,errors:['검수 완료된 review 상태 사건만 승인 신청할 수 있습니다.'],warnings:[]};
 const result=validateDraft(candidate);
 if(!result.ok)return {ok:false,errors:result.errors,warnings:result.warnings};
 if(typeof reviewer!=='string'||reviewer.trim().length<2||!checks||REVIEW.some(k=>checks[k]!==true))return {ok:false,errors:['독립 검증자와 8개 검수 항목이 모두 필요합니다.'],warnings:result.warnings};
 return {ok:true,record:{id:candidate.id,reviewer:reviewer.trim(),checks:Object.fromEntries(REVIEW.map(k=>[k,true])),fingerprint:result.fingerprint,contentHash:contentHash(candidate),approvedAt:null},warnings:result.warnings};
}
function admit(candidate,approval,inventory=[]){
 const result=validateDraft(candidate);
 if(!result.ok)return {ok:false,errors:result.errors};
 if(candidate.status!=='review')return {ok:false,errors:['draft는 승인 재고에 등록할 수 없습니다.']};
 if(!approval||approval.id!==candidate.id||approval.fingerprint!==result.fingerprint||approval.contentHash!==contentHash(candidate)||(typeof approval.reviewer!=='string'||approval.reviewer.trim().length<2)||REVIEW.some(k=>approval.checks?.[k]!==true)||!validDate(approval.approvedAt))
  return {ok:false,errors:['승인 정보가 없거나 사건 내용과 일치하지 않습니다.']};
 if(!Array.isArray(inventory))return {ok:false,errors:['재고 형식이 잘못됐습니다.']};
 if(inventory.some(x=>x.id===candidate.id))return {ok:false,errors:['동일 사건 ID가 이미 등록됐습니다.']};
 if(inventory.some(x=>x.fingerprint===result.fingerprint))return {ok:false,errors:['기존 승인 사건과 인과·증거 구조가 중복됩니다.']};
 const count=inventory.filter(x=>x.category===result.category).length;
 if(count>=TARGETS[result.category])return {ok:false,errors:['500개 원형 제작 목표에서 해당 분야 한도를 초과했습니다.']};
 const item={id:candidate.id,category:result.category,fingerprint:result.fingerprint,approvedAt:approval.approvedAt,
  sourceType:candidate.source.type,worldSheet:serial(candidate),review:serial(approval)};
 item.worldSheet.status='ready';delete item.worldSheet.review;
 return {ok:true,item,inventory:[...inventory.map(serial),item],counts:Object.fromEntries(Object.keys(TARGETS).map(k=>[k,(k===result.category?1:0)+inventory.filter(x=>x.category===k).length]))};
}
module.exports={TARGETS,REVIEW,TRUTHS,validateDraft,makeReview,admit};
