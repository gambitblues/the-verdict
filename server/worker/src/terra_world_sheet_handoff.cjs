/* THE VERDICT P3-8 — authored Terra candidate -> complete world sheet handoff.
 * Never synthesize the locked truth, legal statute, witness observations or evidence.
 * The full world-sheet content MUST be authored and supplied explicitly.
 * This is a pure staging operation; it does not register a case or touch saves.
 */
'use strict';
const {createHash}=require('node:crypto');
const {validateDraft}=require('./terra_case_pipeline.cjs');
const TRUTHS=['did','didnt','reason'];
const clone=x=>JSON.parse(JSON.stringify(x));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const RECORD_KEYS=['id','title','kind','by','how','first'];
function prepareWorldSheet(candidate,authored){
 const errors=[];
 const base=validateDraft(candidate);
 if(!base.ok)errors.push(...base.errors);
 if(!authored||typeof authored!=='object'||Array.isArray(authored))return {ok:false,errors:[...errors,'작성 완료된 world-sheet 객체가 필요합니다.']};
 if(candidate?.status!=='review')errors.push('검수 완료된 review 사건만 world-sheet 전환 후보가 됩니다.');
 if(authored.format!=='verdict-world-sheet/v1'||authored.id!==candidate?.id)errors.push('원본 세계 시트의 포맷 및 사건 ID가 달라졌습니다.');
 if(authored.status!=='draft')errors.push('전환 시 세계 시트는 draft여야 합니다. 자동 배당을 금지합니다.');
 if(!same(
  [authored.card?.kind,authored.card?.category,authored.card?.title,authored.card?.summary],
  [candidate?.card?.kind,candidate?.card?.category,candidate?.card?.title,candidate?.card?.summary]
 ))errors.push('사건 카드의 유형·제목·요지를 임의로 변경할 수 없습니다.');
 if(!['A','B'].every(k=>authored.people?.some(p=>p.key===k)))errors.push('당사자 A, B의 상세 인물 설정이 필요합니다.');
 if(!['A','B'].every(k=>nonempty(authored.worlds?.did?.knows?.[k])))errors.push('잠긴 세계에서 당사자의 실제 지식이 필요합니다.');
 if(!Array.isArray(authored.common?.timeline)||!authored.common.timeline.length||!/^\\d{4}-\\d{2}-\\d{2}$/.test(authored.common.date||''))errors.push('사건 발생일 및 공통 시간표를 작성해야 합니다.');
 const fromRecords=candidate?.records||[],toRecords=authored.records||[];
 if(!Array.isArray(toRecords)||toRecords.length!==fromRecords.length||fromRecords.some((r,i)=>RECORD_KEYS.some(k=>r[k]!==toRecords[i]?.[k])))
  errors.push('자료의 ID·제목·종류·제출자·확보경위·최초 공개 여부를 보존해야 합니다.');
 const allIds=fromRecords.map(r=>r.id);
 if(toRecords.some(r=>r.first===false&&!nonempty(r.unlock)))errors.push('후속 자료에는 법원의 확보 주문이 필요합니다.');
 const cw=candidate?.witnesses||[];
 if(cw.some(w=>!authored.people?.some(p=>p.key===w.id&&p.role===w.role)))errors.push('작성된 증인 ID와 역할을 보존해야 합니다.');
 if(authored.card?.kind==='criminal'){
  const ch=authored.card.charge||{};
  if(!nonempty(ch.name)||!nonempty(ch.law)||!Number.isFinite(ch.min)||!Number.isFinite(ch.max)||ch.max<ch.min)
   errors.push('형사 죄명·법조문·법정형을 명시하고 검증해야 합니다.');
 }else if(authored.card?.kind==='civil'){
  const claim=authored.card.claim||{};
  if(!nonempty(claim.what)||!Number.isFinite(claim.amount)||!Array.isArray(claim.fair)||claim.fair.length!==2)
   errors.push('민사 청구와 금액을 검증해야 합니다.');
 }else if(authored.card?.kind==='decision'){
  if(!['what','yes','no'].every(k=>nonempty(authored.card.decision?.[k])))errors.push('결정형 신청과 주문이 필요합니다.');
 }
 for(const truth of TRUTHS){
  const a=candidate?.worlds?.[truth]||{},w=authored.worlds?.[truth]||{};
  for(const k of ['act','motive','cause'])if(!same(a[k],w[k]))errors.push(truth+': 원본에 잠긴 '+k+'를 자동으로 바꿀 수 없습니다.');
  for(const id of allIds)if(!same(a.records?.[id],w.records?.[id]))errors.push(truth+': 증거 원문이 변경됨 '+id);
  for(const wi of cw)if(!same(a.witnesses?.[wi.id],w.saw?.[wi.id]))errors.push(truth+': 증인의 실제 관찰이 변경됨 '+wi.id);
  if(!nonempty(w.legal)||!w.knows||!['A','B'].every(k=>nonempty(w.knows[k])))
   errors.push(truth+': 법적 검토와 당사자 지식이 필요합니다.');
  if(!Array.isArray(w.timeline)||!w.timeline.length)errors.push(truth+': 사건 시간표가 필요합니다.');
  if(authored.card?.kind==='criminal'&&
   !['means','degree','count','setting','harm','victim','planning','after'].every(k=>nonempty(w.sentencing?.[k])))
   errors.push(truth+': 8개 양형 인자가 필요합니다.');
 }
 const source=authored.source||{};
 if(!['original','real_case'].includes(source.type))errors.push('공개 출처는 창작 또는 검증된 공식 판례여야 합니다.');
 if(candidate?.source?.type==='original'&&source.type!=='original')errors.push('창작 사건을 판례로 변경할 수 없습니다.');
 if(source.type==='real_case'&&(!nonempty(source.caseNumber)||!/^https:\/\//.test(source.url||'')||source.fictionalized!==true))
  errors.push('공식 판례 출처·비실명 각색 확인이 필요합니다.');
 if(errors.length)return {ok:false,errors};
 const sheet=clone(authored);
 // Never silently promote a candidate into the offer pool.
 sheet.status='draft';
 return {ok:true,errors:[],sheet,candidateHash:sha(candidate),sheetHash:sha(sheet),next:'independent-world-sheet-QA'};
}
module.exports={prepareWorldSheet};
