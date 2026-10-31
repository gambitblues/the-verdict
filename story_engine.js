/* THE VERDICT — v0.4 offline, deterministic causal case-builder.
 * No network, no pretrained model, no assertion that legal decisions have been professionally certified.
 * Builds an immutable incident, witnesses, proof, negotiation and a public court dossier.
 */
'use strict';
const StoryEngine = (()=>{
 const LAW={
 rent:['임대차 관계','계약 종료·반환 범위','손상·공제 사유'],
 fraud:['기망에 해당하는 설명','처분행위·재산상 손해','고의·인과관계'],
 assault:['행위자 및 접촉 경위','폭행 또는 상해의 결과','인과관계·위법성'],
 murder:['사망 원인','행위자 특정','고의와 증명의 충분성'],
 sexual:['문제 된 행위와 적용 죄명','당시의 강제성·의사 등 구성요건','진술과 객관 자료의 증명력'],
 stalking:['상대방 의사·접근 행위','반복·지속성','특정과 증명'],
 embezzle:['재산 보관·관리 지위','재산 처분·사용','고의 및 권한 범위'],
 celebrity:['전속계약 의무','정산·활동 자료','위반과 구제 범위'],
 affair:['행위 시점의 혼인 관계','청구 상대의 인식과 행위','손해와 책임 범위'],
 inherit:['상속·유언의 존재','문서의 진정성·의사능력','상속재산과 권리 범위'],
 defamation:['발언 내용과 대상','공연성·사실 적시 여부','위법성 판단 관련 사정'],
 medical:['당시 진료·설명 내용','주의의무 위반 여부','손해·인과관계'],
 bribe:['직무상 관련성','금품 등의 이동 경위','대가관계와 고의'],
 accident:['사고 발생·행위자 특정','주의의무 위반','사상 결과·인과관계'],
 contract:['계약·변경 합의','불이행과 귀책','손해·구제 범위'],
 harassment:['행동의 구체적 내용·반복성','업무상 적정 범위','불이익·손해와 인과관계'],
 fire:['발화 원인·장소','행위자 특정','고의와 위험·결과'],
 construction:['도급 내용과 시공 범위','하자의 발생 원인','보수 비용과 책임'],
 privacy:['접근 및 전달 행위','권한과 정보의 성격','행위자·고의']
 };
 const TRIGGERS={
 rent:['임대차 종료 직후 정산을 요청함','퇴거 점검 이후 수리비 청구가 시작됨','보증금 반환 예정일이 지남'],
 fraud:['투자 설명과 실제 자금 사용이 어긋남','계약 당시 제시된 거래 조건이 이행되지 않음','송금 이후 연락이 끊기며 반환을 요구함'],
 assault:['금전 문제로 언쟁하던 중 접촉이 생김','공공장소에서 다툼 이후 상해가 확인됨','행사장 동선에서 충돌 장면이 촬영됨'],
 murder:['피해자 사망 전후 마지막 동선이 쟁점임','피해자와 이전 갈등을 겪은 사람의 이동 기록이 발견됨','사망 현장 주변의 통화기록이 수사 단서가 됨'],
 sexual:['사건 당일 만남의 경위에 다툼이 있음','사건 이후 연락 내용의 해석이 대립함','목격자들이 확인한 시간대가 서로 다름'],
 stalking:['연락 중단 요청 이후 접근 정황이 보고됨','반복된 방문의 목적을 두고 다툼이 생김','여러 계정에서 메시지가 이어졌다는 신고가 접수됨'],
 embezzle:['단체 계좌의 지출을 감사하다 이상 내역을 발견함','승인받지 않은 지출 내역이 내부 회계에 잡힘','후원금과 장부 지출이 일치하지 않음'],
 celebrity:['정산 시점에 수익 분배표가 제출되지 않음','활동 거절과 계약 해지 통지가 이어짐','기획사의 비용 공제 기준에 이의가 제기됨'],
 affair:['별거 시점 전후의 메시지가 쟁점이 됨','부정행위 주장과 혼인관계 파탄 시점이 충돌함','제3자의 혼인관계 인식 여부에 다툼이 생김'],
 inherit:['사망 직전 작성된 문서가 발견됨','재산 이전 내역이 상속 개시 후 확인됨','가족들이 유언의 진정성을 다투기 시작함'],
 defamation:['게시물 원본과 편집본이 다르게 퍼짐','공개 발언 이후 당사자가 정정 요청을 함','공익 제보라고 주장하는 글이 확산함'],
 medical:['검사 결과 통지 시점에 다툼이 생김','치료 결과 이후 진료기록의 해석이 엇갈림','설명의무 이행 범위를 두고 이견이 생김'],
 bribe:['계약 체결 전후 금전 이동이 확인됨','공직 관련 결재와 지급 일시가 근접함','자문 계약의 실제 이행을 두고 이견이 있음'],
 accident:['사고 시각의 신호와 차량 속도가 다투어짐','현장 이탈 이후 사고 인식 여부가 문제 됨','사고 당시 조도가 낮아 시야가 쟁점이 됨'],
 contract:['납기 변경 약속의 존재가 다투어짐','계약 해제 통지가 늦게 전달됨','추가 작업의 비용 부담을 두고 의견이 엇갈림'],
 harassment:['업무 지시 메시지의 맥락에 다툼이 생김','전보 이후 업무 배제 주장과 인사기록이 충돌함','퇴직 면담의 자발성에 이견이 생김'],
 fire:['발화 추정 시점과 출입 기록이 대조됨','보험 갱신 직후 화재 원인 조사에 착수함','전기적 발화와 인위적 원인 가능성을 비교함'],
 construction:['입주 뒤 첫 누수 신고가 접수됨','공사 변경 요청 뒤 정산에서 누락이 발생함','준공 뒤 균열 원인에 대한 감정이 시작됨'],
 privacy:['고객 정보가 퇴사 후 외부에 유통됨','권한이 제한된 문서 접근 기록이 확인됨','계정 사용자가 누구인지 문제 됨']
 };
 const MOTIVES=['경제적 부담을 빨리 해결하려 함','법적 책임을 부인하고 싶어 함','관계 악화를 피하려 함','평판 손상을 걱정함','직장과 가족에게 문제가 알려질까 두려워함','자신이 옳다고 강하게 믿음','빠른 합의를 선호하지만 원칙은 지키려 함'];
 const PATTERNS=['원본 보존','기록 일부 누락','시간대 혼선','제3자 작성 자료','디지털 자료 편집 가능성','진술과 문서 불일치','감정 결과의 한계','기관 자료 지연'];
 const PROOF_TYPES=['계약·문서','계좌·금전','메신저·통화','영상·사진','감정·진단','진술','기관 기록'];
 const CONTEXTS=['상호 연락','경제 사정','당시 목격 범위','자료 작성 경위','합의·변제 노력','정황과 직접증거의 차이'];
 const EVIDENCE_SOURCE=['원본 확보','등본 또는 발급 기록','제출 사본','공식 감정 결과','제3자 진술','디지털 원본 미확인'];
 const SOCIAL=['일반 시민','공무원','자영업자','중소기업 직원','회사 관리자','전문직 종사자','유명인·방송인','사업 운영자'];
 const PLACE={rent:['아파트','다가구주택','오피스텔'],fraud:['사무실','카페','온라인 거래'],assault:['식당','주차장','행사장'],murder:['주거지','상가','산책로'],sexual:['지인 모임 장소','주거지','숙박시설'],stalking:['주거지 주변','직장 인근','온라인 공간'],embezzle:['회사 사무실','조합 사무실','단체 사무실'],celebrity:['기획사','공연장','연습실'],affair:['주거지','출장지','숙박시설'],inherit:['자택','병원','법무사 사무실'],defamation:['온라인 커뮤니티','방송국','회사'],medical:['병원','응급실','진료실'],bribe:['관공서','사무실','회의실'],accident:['교차로','일반 도로','주차장'],contract:['납품처','현장 사무실','회사'],harassment:['사무실','회사 회의실','업무 메신저'],fire:['창고','점포','주택'],construction:['공사현장','신축 건물','상가'],privacy:['회사','서버실','재택 근무지']};
 const pick=(a,r)=>a[Math.floor(r()*a.length)];
 const between=(a,b,r)=>a+Math.floor(r()*(b-a+1));
 const cap=(n,a,b)=>Math.max(a,Math.min(b,n));
 const fmt=(x)=>`${Math.round(x)}만 원`;
 function findEvidenceCategory(title){if(/계좌|송금|금융|매출|정산|지출|세금/.test(title))return PROOF_TYPES[1];if(/CCTV|영상|사진|블랙박스/.test(title))return PROOF_TYPES[3];if(/연락|통화|메시지|대화|메일/.test(title))return PROOF_TYPES[2];if(/진료|감정|부검|진단|검사/.test(title))return PROOF_TYPES[4];if(/진술|증언|목격/.test(title))return PROOF_TYPES[5];if(/로그|공문|행정|등록/.test(title))return PROOF_TYPES[6];return PROOF_TYPES[0]}
 function build(ctx){
  const {caseId,blueprint:bp,instance:index,loc,now,week,r,makeNPC,oldCriminal,priorDecision,prosecutorPool,counselPool,people}=ctx;
  const criminal=bp.kind==='criminal',title=bp.titles[index],base=bp.premises[index];
  const value=pick([350,900,1800,2800,5200,8400,12000,26000,53000],r),
   trigger=bp.packOrigin?.trigger||pick(TRIGGERS[bp.key]||TRIGGERS.contract,r), pattern=bp.packOrigin?.incident?.action||pick(PATTERNS,r), motive=bp.packOrigin?.motive||pick(MOTIVES,r);
  const prev=oldCriminal&&r()<.20?oldCriminal:null;
  const a=prev?.who?.[0]||makeNPC(criminal?'피고인':'원고');
  const b=makeNPC(criminal?'피해자':'피고');
  const pa=people[a],pb=people[b];
  if(bp.key==='murder'){pb.alive=false;pb.deathWeek=week;pb.careerAtDeath=pb.career;}
  const actual=pick(['다툼의 핵심 행위가 있었다','핵심 행위는 있었지만 주장된 범위가 다르다','현재 주장과 다른 경위가 있었다'],r);
  const truthKind=['substantial','partial','contradicted'][between(0,2,r)];
  const agency=criminal?{name:`${loc.split(' ')[0]} 수사팀`,detective:makeNPC('담당 수사관'),skill:between(37,93,r),workload:between(15,90,r),integrity:between(60,98,r)}:null;
  const proc=criminal?pick(prosecutorPool,r):null;
  const pros=criminal?people[proc]:null;
  const prosecutor={id:proc,years:criminal?between(2,22,r):0,trialSkill:criminal?cap(35+Math.round((pros?.proficiency||65)*.5)+between(-13,13,r),35,95):0};
  const ca=criminal?proc:pick(counselPool,r),cb=pick(counselPool,r);
  const defence=people[cb];const claimant=people[ca];
  const wealthA=pa.wealth??between(15,80,r),wealthB=pb.wealth??between(15,80,r);
  const lawyerA={id:ca,years:between(1,26,r),quality:criminal?prosecutor.trialSkill:cap(between(30,80,r)+Math.round(wealthA/8),25,95),funding:criminal?'공적 소추':wealthA>65?'사선 소송대리인':'일반 소송대리인'};
  const lawyerB={id:cb,years:between(1,26,r),quality:cap(between(29,77,r)+Math.round(wealthB/9),25,95),funding:wealthB<30&&criminal?'국선변호인 선임 가능성 검토':wealthB>70?'사선 변호인':'법률 지원·사선 혼재'};
  const eventWeek=week-between(7,22,r),investigationWeek=week-between(4,6,r),claimWeek=week-between(1,2,r);
  const d=new Date(Date.UTC(2027,2,1)+eventWeek*604800000);const dateText=`${d.getUTCFullYear()}.${String(d.getUTCMonth()+1).padStart(2,'0')}.${String(d.getUTCDate()).padStart(2,'0')}`;
  // Separate facts (never edited after creation) from assertions and what the player may read.
  const timeline=[
   {week:eventWeek-5,kind:'배경',fact:`${pa.name}·${pb.name} 사이의 연락·거래 관계가 형성됨`},
   {week:eventWeek,kind:'사건',fact:`${title} 관련 사건 발생 · ${trigger}`},
   {week:eventWeek+1,kind:'초기 기록',fact:`${pattern} 문제가 수사 또는 소송 준비 과정에서 드러남`},
   {week:investigationWeek,kind:criminal?'수사':'소송 준비',fact:criminal?'관련 진술·문서·물적 자료가 확보되거나 누락됨':'관련 계약·진술·자료를 양측이 수집함'},
   {week:claimWeek,kind:criminal?'공소 제기':'소장 접수',fact:criminal?'검찰에서 공소사실과 증거 목록을 정리함':'원고가 청구 취지와 청구 원인을 제출함'},
   {week:week,kind:'심리',fact:'재판부에 사건이 배당되고 첫 심리가 진행됨'}
  ].sort((a,b)=>a.week-b.week);
  // Evidence probative value is independent of either party's wealth or personality.
  const evidences=bp.docs.map((d,i)=>{
   const type=findEvidenceCategory(d),designed=bp.packOrigin?.evidence?.[i];
   const available=r()<(criminal?0.39+agency.skill/230+prosecutor.trialSkill/600:0.42+(lawyerA.quality+lawyerB.quality)/360);
   const origin=available?pick(EVIDENCE_SOURCE.slice(0,5),r):pick(EVIDENCE_SOURCE.slice(2),r);
   const auth=origin==='디지털 원본 미확인'?0.36:origin==='원본 확보'?0.95:origin==='공식 감정 결과'?0.90:origin==='제출 사본'?0.64:0.79;
   const quality=cap(Math.round((auth*100 + between(-14,13,r) -(criminal?agency.workload/15:0))),20,99);
   const support=(truthKind==='substantial'?(i===2&&r()<.3?-1:1):truthKind==='partial'?(i===0?1:i===1?0:-1):(i===0&&r()<.28?1:-1));
   const relevance=between(45,98,r);
   const concern=designed?.limitation||(origin==='디지털 원본 미확인'||quality<55?'원본·취득 경위 확인 필요':origin==='제출 사본'?'진정성·전체 맥락 다툼 가능':'입증 범위 확인 필요');
   const status=type==='메신저·통화'&&r()<.15?'증거능력 관련 다툼 있음':'증거능력 별도 확인 필요';
   return {id:`EV${i+1}`,title:d,type,origin,week:eventWeek+between(0,4,r),quality,relevance,available,stance:support,
    concern,status,chain:available?'취득 경위와 보관자 확인 가능':'취득 과정 일부 누락',
    scope:designed?.proves||`${(LAW[bp.key]||LAW.contract)[i]}`,summary:`${origin} · ${concern}`};
  });
  const personReliability=between(40,90,r),witness=makeNPC('사실관계 참고인');
  const settle = criminal?{possible:false,reason:'피해 회복이나 합의는 공소 여부·양형 등과 구별해서 다룸'}:{possible:r()<.75,proposal:Math.round(value*(.5+r()*.4)),
   influence:cap(Math.round((wealthA+wealthB)/2),10,90),reason:'당사자의 지급 능력·관계·소송비용을 바탕으로 임의 협의 가능성 평가'};
  const progress=`${pa.name}(${pa.role})은(는) ${bp.legal} 관련 주장을 제기했습니다. ${pb.name}(${pb.role})은(는) 중요한 부분을 다투고 있습니다.`;
  const intro=(criminal?`검찰은 ${pa.name}을(를) ${bp.tag.replace('형사·','')} 관련 혐의로 기소했습니다. `:`${pa.name}이(가) ${pb.name}을(를) 상대로 ${bp.tag.replace(/.*·/,'')} 사건을 제기했습니다. `)+base+` ${trigger} 사건 시점은 ${loc} ${pick(PLACE[bp.key]||PLACE.contract,r)}에서 약 ${week-eventWeek}주 전입니다.`;
  const relation=bp.packOrigin?.relationship||pick(['과거 일면식이 있는 사이','업무 또는 거래로 연결된 사이','가까운 사이였다가 갈등이 생김','사건 전 직접적 관계가 거의 없었음'],r);
  const publicDossier={
   circumstance:base,relation,amount:value,financial:{claimant:wealthA,respondent:wealthB},
   allegedCause:trigger,
   situation:`${pattern}. ${pick(CONTEXTS,r)} 관련 기록을 따져야 합니다.`,
   investigators:criminal?{name:agency.name,experience:agency.skill,workload:agency.workload,summary:agency.skill<55?'조사 인력이 부족해 일부 자료가 누락됨':agency.skill>75?'원본과 출처를 비교적 충실히 확보함':'핵심 문서와 진술 위주로 조사함'}:null,
   claimantRepresentation:lawyerA,respondentRepresentation:lawyerB,
   plea:criminal?`${pa.name}에 대한 공소사실의 증명 여부`: `${fmt(value)} 상당의 청구와 그 범위`,
   settlement:settle,
   issues:LAW[bp.key]||LAW.contract
  };
  let availableProof=evidences.filter(e=>e.available).reduce((s,e)=>s+e.stance*e.quality*e.relevance/10000,0);
  // Police/prosecution quality affects how much is uncovered; it NEVER directly determines guilt.
  let strength=cap(.5+availableProof*.23+(truthKind==='substantial'?.14:truthKind==='partial'?0:-.14),.08,.93);
  if(evidences.filter(x=>x.available).length===0)strength=Math.min(strength,.31);
  const proofClass=strength>=(criminal?.72:.61)?'high':strength>=(criminal?.46:.39)?'mixed':'weak';
  const primary=proofClass==='high'?`현재 제출된 자료가 주장의 핵심 부분을 비교적 강하게 뒷받침합니다.`:proofClass==='mixed'?`증거에 지지되는 부분과 설명이 부족한 부분이 함께 있습니다.`:`주요 주장의 핵심 요건을 입증하기에 자료가 부족합니다.`;
  // Emitted lines are locked to the constructed evidence, not generated afresh after a click.
  const speak=(person,text)=>`"${text}${person?.personality?.includes('직설적')?' 제 입장은 분명합니다.':person?.personality?.includes('신중')?' 확인할 수 없는 부분은 단정하지 않겠습니다.':''}"`;
  const brief=(e)=>`${e.title}의 출처는 '${e.origin}'이며, ${e.concern}입니다.`;
  const action=(label,who,e,label2,extra,flag)=>({label,short:label2,who,flag,sourceIds:e?[e.id]:[],
   says:speak(people[who],extra||brief(e)),clue:extra||brief(e)});
  const legal=LAW[bp.key]||LAW.contract;
  const stages=[
   {prompt:'1차 심리 · 주장과 원본을 구분해 확인하세요',actions:[
    action(`${evidences[0].title}의 원본·작성 시점 확인`,ca,evidences[0],'원본·시점',`${brief(evidences[0])} ${evidences[0].available?'작성 당시 기록 일부를 대조할 수 있습니다.':'원본 확보가 완전하지 않습니다.'}`,'doc'),
    action(criminal?'피고인 측 입장 정리':'양측 계약·거래 관계 확인',cb,null,'당사자 관계',`${pb.name} 측은 ${motive}. 현재 인정하는 부분과 다투는 부분을 구분해 달라고 요청합니다.`,'position'),
    action('쟁점별 첫 주장 정리',ca,evidences[1],'기본 서면',`${legal[0]}에 관한 주장을 제기했습니다. ${evidences[1].available?evidences[1].title+'을(를) 제출했습니다.':evidences[1].title+'은(는) 확보하지 못했습니다.'}`,'pleading')]},
   {prompt:'2차 심리 · 증거가 실제로 무엇을 증명하는지 확인하세요',actions:[
    action(criminal?'담당 수사관의 자료 확보 경위 확인':'기록 작성자의 보존·제출 경위 확인',criminal?agency.detective:witness,evidences[1], '확보 경위',`${criminal?`담당 수사관의 조사 역량은 ${agency.skill}/100입니다. `:''}${brief(evidences[1])} 보관 경위와 주장 내용은 따로 판단해야 합니다.`,'chain'),
    action('증거와 양측의 진술 모순 대조',cb,evidences[2],'모순 검토',`${evidences[2].available?brief(evidences[2]):evidences[2].title+'은(는) 원본이 확보되지 않았습니다.'} 기록의 존재와 입증력은 구별해야 합니다.`,'cross'),
    action('참고인에게 직접 알고 있는 범위 확인',witness,null,'참고인 진술',`제가 직접 확인한 부분과 전해 들은 부분은 구별하겠습니다. 제 기억의 정확성은 ${personReliability}/100 수준으로 평가될 수 있습니다.`,'witness')]},
   {prompt:'최종 심리 · 적용 법리와 절차를 점검하세요',actions:[
    action('법률상 요건별로 확인된 자료 검토',ca,evidences[0],'법적 요건',`${legal.join(' · ')}을 각각 나누어 보아야 합니다. ${primary}`,'elements'),
    action(criminal?'변호인의 증거능력 이의와 반론 확인':'합의·조정 의향 및 지급 가능성 확인',cb,evidences[2],criminal?'증거능력 검토':'조정 가능성',criminal?`${evidences[2].status}. 원본과 취득 경위를 검토해야 합니다.`:settle.possible?`${fmt(settle.proposal)} 수준의 조정안을 검토했으나 상대방 의사는 아직 확정되지 않았습니다.`:'현재 유효한 합의 제안은 없으며 본안 판단을 요청합니다.','final'),
    action('최종 의견을 듣고 변론 종결 검토',ca,null,'최종 의견',`${legal[2]}에 대해 검토해 주십시오. 법정에서 인정된 사실과 실제 발생한 사실을 혼동하지 않아야 합니다.`,'closing')]}
  ];
  const outcomes=criminal?[
   {id:'guilty',label:'유죄',note:'증거로 충분히 보여줬다'},
   {id:'partial',label:'일부만 유죄',note:'증거로 보여준 부분만 인정한다'},
   {id:'notguilty',label:'무죄',note:'아직 남은 의문이 커서 책임을 묻기 어렵다'}
  ]:[
   {id:'full',label:'원고 승소',note:'원고의 요구를 모두 인정한다'},
   {id:'partial',label:'원고 일부 승소',note:`증거로 확인된 만큼만 인정한다 (청구 ${fmt(value)})`},
   {id:'dismiss',label:'원고 패소',note:'요구를 뒷받침할 증거가 모자라다'}
  ];
  const hasMultiple=bp.key==='fraud'||bp.key==='embezzle'||bp.key==='stalking'||bp.key==='bribe';
  if(criminal&&!hasMultiple)outcomes.splice(1,1); // don't invent partial guilt in single-count case
  const relatedCaseId=prev?.id||null;
  const story={engine:'causal-v0.4',privateTruth:{kind:truthKind,actual,notes:'사실 자체와 법정에서 인정 가능한 증명은 별개'},
   trigger,storyMotif:`${bp.packOrigin?.id||bp.key}|${index}|${pattern}|${trigger}|${relation}|${truthKind}`,timeline,relation,place:pick(PLACE[bp.key]||PLACE.contract,r),
   arc:{begin:bp.packOrigin?.incident?.cause||`${relation} · ${title} 관련 갈등이 시작됐다.`,development:bp.packOrigin?`${bp.packOrigin.incident.action} ${bp.packOrigin.incident.aftermath}`:`${trigger}. ${pattern} 문제가 수사·소송 준비 중 드러났다.`,trial:`${bp.legal} 쟁점에 관하여 서면과 반론이 제출됐다.`,resolution:'법정에서 확인한 증거에 따라 판단이 달라진다.'},
   roleA:a,roleB:b,witness,investigator:agency,prosecutor,lawyerA,lawyerB,criminal,financial:{a:wealthA,b:wealthB},
   initialDispute:progress,amount:value,publicDossier,evidenceDetails:evidences,proofStrength:strength,proofClass,
   pack:bp.packOrigin?{packId:bp.packOrigin.packId,version:bp.packOrigin.version,archetypeId:bp.packOrigin.id,category:bp.packOrigin.category,causalTags:bp.packOrigin.causalTags,incident:bp.packOrigin.incident}:null,
   targetClaim:criminal?'공소사실':'청구 원인',settlement:settle,validation:null};
  const caseObj={id:caseId,week,icon:bp.icon,tag:bp.tag,level:cap(Math.round(1+bp.importance/2+between(-1,1,r)),1,5),importance:bp.importance,
   name:`${title} · ${loc} (${dateText})`,sub:`${bp.legal} · ${fmt(value)} 쟁점 규모`,who:[a,b],side:[ca,cb],intro,
   evidence:evidences.map(e=>`${e.available?'제출':'미확보'} · ${e.title} · ${e.origin}`),stages,verdicts:outcomes,ideal:`${primary} 쟁점 '${legal.join(', ')}'의 사실 인정 범위와 증거의 신빙성을 개별적으로 검토해야 합니다.`,
   outcome:`${bp.tag} · 1심`,legal:bp.legal,kind:bp.kind,scenario:proofClass,originEvent:`${eventWeek}주차 · ${loc}`,relatedCaseId,
   precedentId:priorDecision?.id||null,generated:true,contentWarning:['murder','sexual'].includes(bp.key)?'중대 형사사건 · 성인용 법정 기록':null,
   story,qa:null};
  if(typeof DeepCaseEngine!=='undefined')DeepCaseEngine.enrichCase(caseObj,ctx);
  const qa=validate(caseObj);caseObj.qa=qa;story.validation={pass:qa.errors.length===0,warnings:qa.warnings.length,checks:qa.checks};
  return caseObj;
 }
 function validate(c){
  const errors=[],warnings=[],s=c.story||{},e=s.evidenceDetails||[],t=s.timeline||[];
  const assert=(test,msg)=>{if(!test)errors.push(msg)};
  assert(!!c.id,'사건 ID 누락');
  assert(!!c.name&&!!c.legal&&!!c.intro,'기본 이야기 정보 누락');
  assert(c.who?.length===2&&new Set(c.who).size===2,'당사자 ID 중복');
  assert(c.side?.length===2,'대리인/검사 누락');
  assert(t.length>=5&&t.every((x,i)=>!i||x.week>=t[i-1].week),'사건 시간 순서 모순');
  assert(t.at(-1)?.week===c.week,'재판 주차 불일치');
  assert(e.length>=3&&e.every(x=>x.id&&x.title&&x.origin&&x.scope),'증거 기본 정보 누락');
  assert(e.every(x=>x.week>=t[0].week && x.week<=c.week),'증거 작성 시각이 사건 전후 범위를 벗어남');
  assert(new Set(e.map(x=>x.id)).size===e.length,'증거 ID 중복');
  const known=new Set(e.map(x=>x.id));
  assert(c.stages?.length===3&&c.stages.every(st=>st.actions?.length===3),'기본 심리 흐름 누락');
  assert((c.stages||[]).every(st=>st.actions.every(a=>a.who&&a.says&&a.clue&&(a.sourceIds||[]).every(id=>known.has(id)))),'심리 선택이 근거를 잃음');
  assert(s.criminal=== (c.kind==='criminal'),'민·형사 절차 분류 불일치');
  assert(s.criminal?!s.settlement?.possible:!!s.settlement,'형사/민사 조정 가능 여부 오류');
  assert(c.verdicts?.length>=2&&new Set(c.verdicts.map(v=>v.id)).size===c.verdicts.length,'판결 선택지 중복·누락');
  assert(s.proofStrength>=0&&s.proofStrength<=1,'증거 강도 유효범위 오류');
  assert(s.criminal===!!s.investigator,'수사 담당자 배치 오류');
  assert(s.criminal===!!s.prosecutor?.id,'형사 사건 검사 배치 오류');
  assert(!s.timeline.some(x=>x.week>c.week),'미래 사건 기록이 현재 재판에 등장');
  assert(!s.settlement?.possible||s.settlement.proposal<=s.amount,'합의 제안액이 청구 규모를 초과');
  assert(s.financial.a>=0&&s.financial.b>=0,'당사자 재력 범위 오류');
  assert(s.arc?.begin&&s.arc?.development&&s.arc?.trial,'기승전 단계 누락');
  if(e.some(x=>x.status==='증거능력 관련 다툼 있음'))warnings.push('증거능력은 법원에서 별도 검토해야 함');
  if(e.some(x=>!x.available))warnings.push('증거 원본 또는 취득 경위 일부 미확보');
  if(s.criminal&&c.verdicts.some(v=>v.id==='partial')&&!['기망행위·재산상 손해·고의·인과관계','보관관계·불법영득의사','반복적 접근·상대방 의사','직무관련성·대가관계'].includes(c.legal))warnings.push('일부 유죄의 공소사실 개수 검토 필요');
  if(typeof DeepCaseEngine!=='undefined'&&c.story?.deep){const extra=DeepCaseEngine.check(c);errors.push(...extra.errors);warnings.push(...extra.warnings);}
  return {pass:errors.length===0,errors,warnings,checks:c.story?.deep?33:21};
 }
 function evaluate(c,selected,decision){
  const s=c.story;if(!s)return null;
  const evidenceSeen=new Set((selected||[]).flatMap(x=>x.sourceIds||[]));
  const reviewed=s.evidenceDetails.filter(e=>evidenceSeen.has(e.id));
  const reviews=reviewed.length;
  const flags=new Set((selected||[]).map(x=>x.flag));
  const proof=s.proofStrength;
  const criminal=s.criminal;
  const expected=criminal?(proof>=.72?'guilty':proof>=.46&&c.verdicts.some(v=>v.id==='partial')?'partial':'notguilty'):(proof>=.64?'full':proof>=.36?'partial':'dismiss');
  const nuance=flags.has('elements')&&flags.has('chain')?10:flags.has('elements')||flags.has('chain')?6:0;
  const score=cap(49+(decision===expected?33:decision==='partial'?8:-15)+reviews*3+nuance+(flags.has('cross')?3:0),10,100);
  const why=`법정에서 확보된 증거의 종합 강도는 ${Math.round(proof*100)}/100(게임용 지표)이며, ${reviews}/${s.evidenceDetails.length}개 증거의 취득·내용을 직접 검토했습니다. ${s.proofClass==='weak'?'주요 사실의 입증 부족 위험이 큽니다.':s.proofClass==='mixed'?'충돌하는 정황을 나누어 판단해야 합니다.':'주요 요건을 뒷받침하는 자료가 비교적 충실합니다.'}`;
  const base={score,expected,why,reviewed:reviews};
  return typeof DeepCaseEngine!=='undefined'?DeepCaseEngine.evaluate(c,selected,decision,base):base;
 }
 return {version:'0.5',profiles:LAW,build,validate,evaluate};
})();
