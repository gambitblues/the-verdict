/* THE VERDICT v0.5 — offline, rule-based legal and narrative enrichment.
 * Educational game simulation, NOT a validated legal expert system.
 * The historical truth is immutable; public assertions and proof differ.
 */
'use strict';
const DeepCaseEngine=(()=>{
 const P={
 rent:['임대차보증금 반환 청구','임대차와 보증금 지급','반환기 도래·미반환','공제 항목의 발생·범위','민법 임대차 관련 조항'],
 fraud:['사기죄','기망·거짓 설명','상대방의 처분행위·재산 이동','기망의 고의·인과관계','형법 제347조'],
 assault:['폭행·상해 관련 혐의','피고인의 구체적 유형력 행사','상해 발생·인과관계(상해 기소 시)','정당방위 등 위법성 관련 사정','형법 제260조·제257조 등'],
 murder:['살인죄','사망과 원인','피고인의 행위·인과관계','살인의 고의','형법 제250조'],
 sexual:['성폭력 관련 혐의','기소된 특정 행위','해당 죄명의 강제성·상태·연령 등 요건','행위자 특정과 증명의 충분성','형법 제297조 이하·성폭력처벌법 관련 규정'],
 stalking:['스토킹처벌법 위반','특정 접근·연락 행위','상대방 의사·불안 등 요건','반복성·행위자 특정','스토킹범죄의 처벌 등에 관한 법률'],
 embezzle:['횡령 관련 혐의','타인의 재물 보관·관리 지위','권한 없는 사용·처분','고의·불법영득의사','형법 제355조·제356조 등'],
 celebrity:['전속계약 분쟁','계약 내용과 의무','정산·이행의 정도','위반·해지 요건·손해','민법 계약·채무불이행 관련 규정'],
 affair:['혼인관계 관련 손해배상','행위 당시 보호되는 혼인관계','상대방 인식과 부정행위 경위','위법행위·손해 및 인과관계','민법 제750조·제751조 관련'],
 inherit:['상속·유언 관련 청구','상속 관계·유언 형식','작성 당시 의사와 진정성','재산 범위·권리 귀속','민법 상속·유언 관련 규정'],
 defamation:['명예훼손 관련 혐의','특정 가능한 표현과 공연성','사실 적시 및 적용 법률','공익성·위법성 등 사유','형법 제307조·제310조 또는 정보통신망법'],
 medical:['의료 과오 손해배상','당시 진료·설명 의무','주의의무 위반 여부','손해 발생과 상당인과관계','민법 제750조·제390조 관련'],
 bribe:['뇌물 관련 혐의','공무원 등 신분·직무','금품 수수·약속과 직무관련성','고의 및 직무상 대가관계의 쟁점','형법 제129조 이하'],
 accident:['교통사고 관련 혐의','운전·사고 발생과 행위자','구체적 주의의무·위반','상해 결과·인과관계와 특례 검토','교통사고처리 특례법·형법 관련'],
 contract:['계약 불이행 손해배상','유효한 계약·변경 합의','의무 불이행·귀책 사유','손해 및 인과관계·구제','민법 제390조 등'],
 harassment:['직장 괴롭힘 관련 손해배상','행위와 직장 관계','업무상 적정범위·피해','위법성 및 손해·인과관계','근로기준법 제76조의2·민법 제750조 관련'],
 fire:['방화 관련 혐의','소훼 대상과 발화 원인','피고인 행위·인과관계','고의와 적용 죄명의 위험 요건','형법 제164조 이하'],
 construction:['건설 하자·도급 분쟁','도급 범위와 시공 내용','하자·귀책 발생 시점','보수 범위·손해액','민법 도급 관련 규정'],
 privacy:['정보유출 관련 혐의','정보 및 접근·전송 행위','해당 법률의 권한·보호요건','행위자 특정·고의','개인정보 보호법 등 적용 조문 확인 필요']
 };
 const SEX_SUB={0:['강간 혐의','폭행·협박과 행위의 관계','기소된 행위·행위자 특정','증거와 법률상 증명 기준','형법 제297조 관련'],1:['강제추행 혐의','문제 된 신체 접촉·행위자','폭행·협박 등 법률상 요건','증거 신빙성과 위법성 관련 쟁점','형법 제298조 관련'],2:['준강간 혐의','당시 피해자의 상태','그 상태를 이용한 행위인지','행위자 특정·고의 및 입증','형법 제299조 관련']};
 const COURT_ROLES=['법원 직원','판사','검사','변호사','수사관'];
 const identity=(p)=>({id:p.id||null,name:p.name,role:p.role,job:p.career||p.role,education:p.education||'',family:p.family||'',wealth:p.wealth??50,temperament:p.personality||'',goals:p.goals||['직장 유지','가족 보호'],status:p.socialStatus||'일반 시민',availability:p.schedule||'평일 직장 근무',relationships:p.relationships||'',memoryKeys:[]});
 const clip=(v,min,max)=>Math.max(min,Math.min(max,v));
 const choose=(arr,r)=>arr[Math.floor(r()*arr.length)];
 const consentMotive=(p,criminal,side,r)=>{
  const main=['개인 평판을 지키려는 마음','경제적 피해를 줄이려는 목적','관계가 더 악화되는 일을 피하고 싶은 마음','자기 기억이 옳다는 확신','법적 불이익에 대한 두려움'];
  const extra=p.wealth<30?'당장의 비용 부담':p.wealth>70?'대외 이미지와 직업상의 손실':'장기적인 갈등과 생활 안정';
  const person=p.riskTolerance>70?'위험을 감수하더라도 기존 입장 고수':p.responsibility>70?'문서와 기록 중심의 확인':'대화를 통해 먼저 해결하려는 성향';
  return {primary:choose(main,r),constraint:extra,style:person,role:side,goal:criminal&&side==='피고인'?'혐의와 증거 다툼':'분쟁 해결과 비용 관리'};
 };
 function lawFor(key,index){let base=P[key]||P.contract;return key==='sexual'?(SEX_SUB[index]||SEX_SUB[0]):base;}
 function enrichCase(c,ctx){
  const s=c.story; if(!s)return c;
  const r=ctx.r,bp=ctx.blueprint,key=bp.key;
  const statute=lawFor(key,ctx.instance),people=ctx.people;
  const claim=people[c.who[0]],resp=people[c.who[1]];
  const criminal=s.criminal,ev=s.evidenceDetails;
  const elements=statute.slice(1,4).map((x,i)=>({id:`E${i+1}`,text:x,proof:[],sufficiency:'미판단'}));
  for(let i=0;i<ev.length;i++){
   const e=ev[i];e.elementId=elements[i%elements.length].id;
   e.sourceOwner= i%3===0?'사건 관계인':i%3===1?(criminal?'수사기관':'원고 측'):'제3자';
   e.collectionStatus=e.available?'법정 제출 가능':'수집·제출되지 않음';
   e.admissibility= !e.available?'미제출':e.origin==='디지털 원본 미확인'?'진정성 다툼':e.status==='증거능력 관련 다툼 있음'?'적법성 다툼':'검토 대상';
   e.reliabilityNote=e.quality>=75?'출처가 비교적 분명함':e.quality>=50?'일부 한계가 있음':'보강 확인이 필요한 자료';
   elements[i%elements.length].proof.push(e.id);
  }
  const aMotive=consentMotive(claim,criminal,criminal?'피고인':'원고',r);
  const bMotive=consentMotive(resp,criminal,criminal?'피해자':'피고',r);
  const knowledge={
   [c.who[0]]:{known:[s.trigger,`${bp.legal} 관련 자신의 입장`],unknown:[`상대방의 개인적 의도`,...ev.filter(e=>!e.available).map(e=>e.title)]},
   [c.who[1]]:{known:[s.relation,`자신이 경험한 경위`],unknown:[`상대방의 개인적 기억`]},
   [s.witness]:{known:['자신이 직접 관찰했거나 작성한 자료의 범위'],unknown:['현장에 없었을 때 발생한 일']}
  };
  const inst=criminal?s.investigator:null;
  const police=inst?people[inst.detective]:null;
  const investigation=criminal?{
   officer:inst.detective,experienceYears:Math.max(1,Math.round(inst.skill/6)),skill:inst.skill,workload:inst.workload,
   collected:ev.filter(e=>e.available).map(e=>e.id),uncollected:ev.filter(e=>!e.available).map(e=>e.id),
   procedure:`${police?.name||'담당 수사관'}은 관련 기록을 제출했으나 미확보 자료와 입증 한계는 별도로 남아 있습니다.`
  }:null;
  const counts=ev.filter(e=>e.available).length;
  const worldProfiles={
   claimant:identity({...claim,id:c.who[0]}),respondent:identity({...resp,id:c.who[1]}),
   counselA:identity({...people[c.side[0]],id:c.side[0]}),counselB:identity({...people[c.side[1]],id:c.side[1]}),
   witness:identity({...people[s.witness],id:s.witness}),
   investigator:s.investigator?identity({...people[s.investigator.detective],id:s.investigator.detective}):null
  };
  const motiveA=aMotive.primary+', '+aMotive.constraint;
  const motiveB=bMotive.primary+', '+bMotive.constraint;
  s.deep={version:'0.5',key,charge:statute[0],legalSource:statute[4],elements,worldProfiles,
   motivations:{a:aMotive,b:bMotive},knowledge,investigation,
   casePhysics:{incidentAt:s.timeline[1]?.week,caseFiledAt:s.timeline.find(x=>x.kind==='소장 접수'||x.kind==='공소 제기')?.week,claimantWealth:claim.wealth,respondentWealth:resp.wealth},
   originalStance:{a:criminal?'검찰의 공소사실에 다툼이 있음':'청구 취지와 법적 근거 주장',b:criminal?'혐의의 주요 부분을 다툼':'청구의 사실관계와 범위 다툼'},
   groundTruthLocked:true,availableEvidenceCount:counts,
   narrative:{origin:`${s.relation}. ${bp.premises[ctx.instance]}`,
    cause:`${s.trigger}. ${motiveA}와(과) ${motiveB}이(가) 분쟁을 복잡하게 만들었다.`,
    inquiry:`${criminal?'수사기관은':'소송 당사자들은'} ${counts}개의 자료를 확보했다. 미확보된 자료는 제출된 것처럼 다루지 않는다.`,
    hearing:`${statute[1]}·${statute[2]}·${statute[3]}의 각 판단에서 증거가 뒷받침하는 범위를 분리한다.`},
   negotiation:{eligible:!criminal&&!!s.settlement?.possible,claim:Math.round(s.amount),
     initialOffer:criminal?null:Math.round((s.settlement?.proposal||s.amount*.65)),
     claimantFloor:Math.round(s.amount*(.45+claim.wealth/650)),
     respondentCeiling:Math.round(s.amount*(.38+resp.wealth/550)),state:'미협의'},
   prospectiveReview:{appealPossible:true,requiresTimelyFiling:true,retrialExceptional:criminal,potentialNewEvidence:criminal&&r()<.05?'새로 확인될 가능성이 있는 기존 자료의 원본':null},
   auditTrail:[]};
  // Generate buttons from legal elements and submitted evidence. No mandatory 3-act plot twist.
  const a=c.side[0],b=c.side[1],w=s.witness;
  const mk=(label,short,who,sourceIds,flag,elementIndex)=>({label,short,who,sourceIds,flag,
   legalElementId:elements[elementIndex].id,
   says:'제출된 자료의 범위를 확인하겠습니다.',clue:short});
  c.stages=[
   {prompt:'제1차 심리 · 법률상 주장과 관련 자료를 구분합니다',actions:[
    mk(`${statute[1]} 관련 증거의 출처 확인`,'기초 자료 확인',a,[ev[0].id],'foundation',0),
    mk(`${criminal?'피고인 측':'피고 측'}의 첫 반론 듣기`,'상대방 반론 확인',b,[],'response',1),
    mk(`${statute[2]} 관련 자료의 제출 여부 확인`,'입증자료 제출 현황',a,[ev[1].id],'disclosure',1)]},
   {prompt:'제2차 심리 · 증거의 한계와 진술을 대조합니다',actions:[
    mk(`${ev[1].title}의 확보·작성 경위 확인`,'증거 확보 경위',criminal?s.investigator.detective:w,[ev[1].id],'chain',1),
    mk(`양측 진술과 ${ev[2].title} 대조`,'증거와 반론 비교',b,[ev[2].id],'cross',2),
    mk('참고인의 직접 경험 범위를 확인','목격 범위 확인',w,[],'witness',0)]},
   {prompt:'최종 심리 · 사실 인정과 법률 요건을 분리합니다',actions:[
    mk(`${statute[3]}에 관한 증명 검토`,'법적 요건 평가',a,[ev[0].id,ev[2].id],'elements',2),
    mk(criminal?'변호인의 증거능력 이의 확인':'조정 가능성 및 당사자 의사 확인',criminal?'적법성·진정성 검토':'합의 조건 검토',b,[ev[2].id],'negotiation',2),
    mk('양측 최종 의견을 듣고 심리 마무리','최종 의견',a,[],'closing',1)]}
  ];
  c.legal=statute[0];c.sub=`${statute[0]} · ${criminal?'형사 공소사실':'청구 규모 '+s.amount.toLocaleString('ko-KR')+'만 원'}`;
  c.ideal=`${statute[1]}, ${statute[2]}, ${statute[3]}을(를) 개별 판단해야 합니다. 결과는 확보·채택된 증거와 적용 법리를 함께 검토해 결정합니다.`;
  c.intro=`${bp.premises[ctx.instance]} ${s.trigger} ${bp.packOrigin?.incident?.aftermath||''} 사건 당사자는 ${claim.name}과(와) ${resp.name}입니다. ${criminal?'검찰은 해당 혐의로 기소했습니다.':'원고는 청구를 제기했고 피고가 다투고 있습니다.'}`;
  s.publicDossier.issues=elements.map(x=>x.text);
  return c;
 }
 function actionResponse(c,action,st){
  const d=c.story.deep, e=(action.sourceIds||[]).map(id=>c.story.evidenceDetails.find(x=>x.id===id)).filter(Boolean),
   actor=d.worldProfiles.counselA.id===action.who?d.worldProfiles.counselA:d.worldProfiles.counselB.id===action.who?d.worldProfiles.counselB:d.worldProfiles.witness.id===action.who?d.worldProfiles.witness:d.worldProfiles.investigator?.id===action.who?d.worldProfiles.investigator:null;
  const name=actor?.name||'담당자';
  const records=e.map(x=>x.available?`${x.title}: ${x.origin}, ${x.reliabilityNote}`:`${x.title}: 현재 제출되지 않아 확인 불가능`).join(' / ');
  const prior=st.actions?.length?`앞선 심리에서 '${st.actions.at(-1).short}' 내용을 검토했습니다. `:'';
  let line='';
  switch(action.flag){
   case 'foundation':line=`${records}. 출처를 확인하는 것과 사실의 진위를 인정하는 것은 다릅니다.`;break;
   case 'response':line=`${d.worldProfiles.respondent.name} 측은 상대방 주장 중 인정하는 부분과 다투는 부분을 나눠 설명합니다. ${d.motivations.b.style}입니다.`;break;
   case 'disclosure':line=`${records}. 제출되지 않은 자료는 재판에서 확인한 증거가 아닙니다.`;break;
   case 'chain':line=`${records}. ${d.investigation?d.investigation.procedure:'당사자가 제출·보존 경위를 설명해야 합니다.'}`;break;
   case 'cross':line=`${records}. 이 자료가 없거나 신빙성이 낮다면 기존 주장만으로 판단할 수 없습니다.`;break;
   case 'witness':line=`제가 직접 보거나 작성한 범위만 말씀드리겠습니다. 관찰하지 못한 내용은 단정하지 않겠습니다.`;break;
   case 'elements':line=`${d.charge}에서 ${d.elements.map(x=>x.text).join(', ')}을 각각 검토해야 합니다. ${records}.`;break;
   case 'negotiation':line=d.negotiation.eligible?`법원이 화해·조정을 권할 수 있으나, 합의는 양측의 자발적 의사가 있어야 합니다. 현재 제안 범위는 ${d.negotiation.initialOffer.toLocaleString('ko-KR')}만 원입니다.`:`${records}. 형사사건에서 당사자 합의 여부는 범죄 성립 판단과 구별됩니다.`;break;
   case 'closing':line=`현재 제출된 자료로 판단해 주십시오. 미확보 자료를 이미 검토한 것처럼 취급하지 않겠습니다.`;break;
   default:line=`${records}.`;
  }
  return `${name}: “${prior}${line}”`;
 }
 function afterAction(c,st,action){
  const d=c.story.deep; if(!d)return;
  const seen=new Set(st.actions.flatMap(x=>x.sourceIds||[]));
  const e=c.story.evidenceDetails.filter(x=>seen.has(x.id)&&x.available);
  const contradict=e.some(x=>x.stance<0&&x.quality>=63),support=e.some(x=>x.stance>0&&x.quality>=63);
  st.positionHistory??=[];
  let plaintiff='최초 주장 유지',defendant='최초 반론 유지';
  if(contradict){plaintiff='불리한 자료의 범위에 관해 추가 설명',defendant='상대방 자료의 모순 지적';}
  else if(support){plaintiff='확보된 자료로 주장 구체화',defendant='자료의 한계 및 반대 사정 제시';}
  if(action.flag==='negotiation'&&d.negotiation.eligible){plaintiff+=' · 조정 의사 타진';defendant+=' · 지급 여력 확인';}
  st.positions={claimant:plaintiff,respondent:defendant};
  st.positionHistory.push({week:st.actions.at(-1).week,action:action.flag,claimant:plaintiff,respondent:defendant,seen:[...seen]});
 }
 function settle(c,st){
  const d=c.story?.deep;if(!d||!d.negotiation.eligible||st.phase<2)return {ok:false,reason:'이 단계에서는 조정을 진행할 수 없습니다.'};
  const x=d.negotiation;
  if(x.respondentCeiling<x.claimantFloor)return {ok:false,reason:'현재 양측의 수용 가능한 금액 범위가 달라 조정이 성립하지 않았습니다.'};
  const amount=Math.round((x.respondentCeiling+x.claimantFloor)/2);
  x.state='성립';return {ok:true,amount,reason:'양측이 지급 범위에 동의했습니다. 재판상 화해로 종결되며 본안 판결은 없습니다.'};
 }
 function check(c){
  const errors=[],warnings=[],d=c.story?.deep,s=c.story;
  if(!d)return {pass:false,errors:['심화 사건 모델 누락'],warnings};
  const put=(yes,x)=>{if(!yes)errors.push(x)};
  put(d.elements?.length===3,'세부 법률 구성요건 누락');
  put(d.legalSource?.length>2,'법률 출처 누락');
  put(d.groundTruthLocked===true,'사건 진실 잠금 누락');
  put(d.casePhysics.incidentAt<=d.casePhysics.caseFiledAt&&d.casePhysics.caseFiledAt<=c.week,'사건 발생·접수·배당 순서 오류');
  put(d.elements.every(el=>el.proof.every(id=>s.evidenceDetails.some(e=>e.id===id))),'법률 요건과 증거의 연결 오류');
  put(s.evidenceDetails.every(e=>e.available||e.admissibility==='미제출'),'미확보 자료가 제출됨');
  put(s.evidenceDetails.every(e=>e.elementId&&e.sourceOwner&&e.collectionStatus),'증거 출처·요건 매핑 누락');
  put(d.worldProfiles.claimant.name&&d.worldProfiles.respondent.name,'당사자 정보 누락');
  put(c.stages.every(z=>z.actions.every(a=>d.elements.some(el=>el.id===a.legalElementId))),'질문과 요건 연결 오류');
  put(d.negotiation.eligible===false||!s.criminal,'형사사건에 민사 합의 판결 혼입');
  put(d.motivations.a.primary&&d.motivations.b.primary,'행동 동기 누락');
  put(s.timeline.every(t=>t.week<=c.week),'미래 사건의 심리 기록 유입');
  if(s.evidenceDetails.some(x=>!x.available))warnings.push('미확보 자료 존재: 미제출로 처리');
  if(d.charge.includes('성폭력')||d.charge.includes('강간')||d.charge.includes('추행'))warnings.push('죄명별 법률 요건은 추가 전문 감수가 필요');
  return {pass:!errors.length,errors,warnings,checks:12};
 }
 function evaluate(c,selected,choice,fallback){
  const d=c.story?.deep;if(!d)return fallback;
  const seen=new Set(selected.flatMap(a=>a.sourceIds||[]));
  const reviewed=c.story.evidenceDetails.filter(e=>seen.has(e.id)&&e.available);
  const coverage=d.elements.filter(el=>el.proof.some(id=>reviewed.some(e=>e.id===id))).length;
  const evidenceScore=reviewed.reduce((sum,e)=>sum+e.stance*e.quality/100,0);
  const proof=c.story.proofStrength;
  const likely=c.kind==='criminal'?(proof>.76?'guilty':proof>.52&&c.verdicts.some(v=>v.id==='partial')?'partial':'notguilty'):(proof>.72?'full':proof>.43?'partial':'dismiss');
  const match=choice===likely;
  const score=clip(50+(match?18:0)+coverage*6+Math.min(reviewed.length,3)*3+(selected.some(x=>x.flag==='chain')?5:0)+(selected.some(x=>x.flag==='elements')?5:0),10,97);
  return {score,expected:likely,reviewed:reviewed.length,why:`${d.charge}의 쟁점 ${d.elements.length}개 중 ${coverage}개가 이번 심리에서 검토한 제출 증거와 연결되었습니다. 미제출 증거는 판단 자료에서 제외했습니다. 증거의 질·입증 대상·법적 요건을 함께 검토해야 합니다. (${d.legalSource} 참고, 게임용 평가)`};
 }
 return {profiles:P,version:'0.5',enrichCase,actionResponse,afterAction,settle,check,evaluate};
})();
