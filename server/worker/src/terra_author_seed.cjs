/* Human-authored case seed intake. No legacy world-sheet files are modified.
 * Pure structural gate: semantic/legal accuracy must be reviewed by a human.
 */
'use strict';
const CATEGORY=new Set(['homicide','sexual','violence','financial','property','reputation','civil','family','professional','public']);
const KIND=new Set(['criminal','civil','decision']);
const nonblank=(v,n=8)=>typeof v==='string'&&v.trim().length>=n;
const safeId=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{3,79}$/.test(x);
function validateAuthorSeed(seed){
 const errors=[],warnings=[],err=s=>errors.push(s);
 if(!seed||typeof seed!=='object'||Array.isArray(seed))return {ok:false,errors:['사건 기획안은 JSON 객체여야 합니다.'],warnings};
 if(seed.format!=='verdict-author-seed/v1')err('새 사건 기획안 형식이 아닙니다.');
 if(!safeId(seed.id))err('사건 ID는 영문 소문자로 시작하고 영문·숫자·하이픈만 사용하세요.');
 if(seed.status!=='draft')err('집필 기획안은 draft만 가능합니다. 승인/배당은 별도 검수합니다.');
 if(!CATEGORY.has(seed.category)||!KIND.has(seed.kind))err('사건 분야 또는 재판 유형을 확인하세요.');
 if(!nonblank(seed.title)||!nonblank(seed.opening,45))err('제목과 최초 사건 요지(45자 이상)가 필요합니다.');
 const facts=Array.isArray(seed.immutableFacts)?seed.immutableFacts:[];
 if(facts.length<3||facts.length>30)err('변하지 않는 사실을 3~30개 작성하세요.');
 const ids=new Set();
 for(const f of facts){
  if(!f||!/^f[0-9]+$/.test(f.id||'')||ids.has(f.id)||!nonblank(f.fact,15)||f.certainty!=='confirmed')
   err('고정 사실은 중복 없는 f1, f2… ID, 15자 이상의 확인된 사실로 작성하세요.');
  if(f?.id)ids.add(f.id);
 }
 const people=Array.isArray(seed.people)?seed.people:[];
 if(people.length<2||people.length>15||!people.some(p=>p.id==='A')||!people.some(p=>p.id==='B'))
  err('당사자 A/B 등 인물 2~15명을 적어 주세요.');
 const personIds=new Set();
 for(const p of people){
  if(!p||!/^([AB]|W[1-9][0-9]?)$/.test(p.id||'')||personIds.has(p.id)||!nonblank(p.role,2)||!nonblank(p.knowledge,10))
   err('인물마다 중복 없는 A/B/W1… 식별자, 역할, 알고 있는 범위를 작성하세요.');
  if(p?.id)personIds.add(p.id);
 }
 const leads=Array.isArray(seed.evidenceLeads)?seed.evidenceLeads:[];
 if(leads.length<2||leads.length>20)err('증거 단서를 2~20개 적어 주세요.');
 const leadIds=new Set();
 for(const lead of leads){
  if(!lead||!/^e[0-9]+$/.test(lead.id||'')||leadIds.has(lead.id)||
     !nonblank(lead.title,3)||!nonblank(lead.source,3)||
     !nonblank(lead.reveals,10)||!nonblank(lead.limit,10)||
     !['confirmed','possible','unavailable'].includes(lead.exists))
   err('증거 단서는 e1… ID·존재 상태·출처·관찰 범위·한계가 필요합니다.');
  if(lead?.id)leadIds.add(lead.id);
 }
 if(!Array.isArray(seed.contestedQuestions)||seed.contestedQuestions.length<1||
    seed.contestedQuestions.some(q=>!nonblank(q,8)))err('재판의 쟁점을 한 가지 이상 적어 주세요.');
 if(!Array.isArray(seed.unknowns)||seed.unknowns.some(q=>!nonblank(q,8)))err('미확정 사항은 unknowns에 문장으로 적어 주세요.');
 if(seed.source?.type!=='original'||!nonblank(seed.source.note,12))
  err('현재 간편 입력은 직접 창작한 가상 사건만 지원합니다. 실재 판례는 별도 출처 검증이 필요합니다.');
 if(seed.opening?.length>2400||JSON.stringify(seed).length>24000)err('기획안이 너무 깁니다.');
 if(seed.unknowns?.length)warnings.push('미확정 사항은 Terra가 확정해선 안 됩니다. 집필자 재검토가 필요합니다.');
 if(leads.some(l=>l.exists!=='confirmed'))warnings.push('존재가 미확인된 자료는 실제 증거로 채택하기 전에 검증해야 합니다.');
 return {ok:errors.length===0,errors,warnings};
}
function seedToTerraInput(seed){
 const result=validateAuthorSeed(seed);
 if(!result.ok)throw Error(result.errors.join(' | '));
 const immutable=seed.immutableFacts.map(f=>({id:f.id,text:f.fact}));
 const instructions={
  authorSeedFormat:seed.format,kind:seed.kind,title:seed.title,
  opening:seed.opening,immutableFacts:immutable,
  people:seed.people,evidenceLeads:seed.evidenceLeads,
  contestedQuestions:seed.contestedQuestions,unknowns:seed.unknowns,
  authorNotes:seed.authorNotes||'',
  productionRules:[
   'immutableFacts의 사실은 수정하거나 반대로 주장하지 않는다.',
   'possible/unavailable 단서는 실제 존재하는 증거로 확정하지 않는다.',
   'unknowns는 허락 없이 결정적인 사건 사실로 채워 넣지 않는다.',
   '확인된 사실로부터 도출할 수 없는 새로운 범죄·사망·음주 사실을 창작하지 않는다.',
   '세 개의 가상 세계 분기를 작성하더라도 공통 고정 사실은 모두 유지한다.',
   '증거 출처, 관찰 가능 범위, 법적 판단을 구분하고 법률 검증이 필요하면 open에 남긴다.'
  ]
 };
 return {id:seed.id,category:seed.category,
  premise:'집필자 고정 사실과 미확정 사항을 준수하는 사건 확장이다. JSON 기획안:\n'+JSON.stringify(instructions)};
}
module.exports={validateAuthorSeed,seedToTerraInput};
