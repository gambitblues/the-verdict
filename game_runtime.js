/* THE VERDICT — core runtime: world, NPCs, cases, saves, home and tablet. Source of truth (legacy patch files were merged here). */

;/* source: game.js */
/* THE VERDICT — independent offline-first single-player mobile PWA. No API keys, accounts, servers or live AI. */
'use strict';
const KEY='the_verdict_alpha_1'; // compatible with alpha 0.1 save files
const SECTORS=[
 {id:'sem',name:'반도체',icon:'▦',beta:1.12},{id:'ship',name:'조선',icon:'⚓',beta:.88},
 {id:'beauty',name:'화장품',icon:'✿',beta:.96},{id:'def',name:'방산',icon:'⬡',beta:.88},
 {id:'ent',name:'엔터',icon:'♫',beta:1.24},{id:'cons',name:'건설',icon:'▥',beta:.83},
 {id:'auto',name:'자동차',icon:'◈',beta:.96},{id:'bat',name:'2차전지',icon:'ϟ',beta:1.38},
 {id:'bio',name:'바이오',icon:'✚',beta:1.42},{id:'energy',name:'전력·에너지',icon:'☀',beta:.94}
];
const NPC={
 self:{name:'나',role:'판사',hair:2,skin:0,suit:0},
 hyun:{name:'김현우',role:'법원 동기',hair:2,skin:0,suit:0,personality:'차분하고 신중함',origin:'지방 중소도시 출신',bond:'같은 기수로 연수를 받음'},
 senior:{name:'윤태성',role:'선배 판사',hair:1,skin:1,suit:2,personality:'원칙주의, 낮은 표현성',origin:'법조인 집안 출신',bond:'첫 배당 재판부 선배'},
 jiyu:{name:'오지유',role:'원고 측 변호사',hair:4,skin:0,suit:3,personality:'꼼꼼하고 직설적',origin:'대학 시절 장학금으로 공부',bond:'초임 시절 첫 민사사건에서 만남'},
 seon:{name:'백선우',role:'피고 측 변호사',hair:3,skin:1,suit:1,personality:'예리하고 절차를 중시함',origin:'교사 가정 출신',bond:'여러 민사 재판에서 만남'},
 soo:{name:'정수연',role:'검사',hair:4,skin:0,suit:2,personality:'집요하고 논리적',origin:'맞벌이 가정, 자매 두 명',bond:'형사 공판에서 주로 만남'},
 jun:{name:'나준호',role:'검사',hair:1,skin:2,suit:0,personality:'직관적이며 경쟁적',origin:'3남매 중 장남',bond:'동기 검사들과의 모임에서 만남'},
 reporter:{name:'한민지',role:'법조 기자',hair:4,skin:1,suit:4,personality:'외향적이며 취재에 적극적',origin:'지역 신문사 경력',bond:'법원 브리핑에서 처음 만남'},
 tenant:{name:'박지은',role:'임차인·원고',hair:4,skin:0,suit:4,personality:'신중하나 경제 문제에는 단호',origin:'지방 출신 직장인',bond:'전세금 반환 사건 당사자'},
 owner:{name:'이민철',role:'임대인·피고',hair:1,skin:1,suit:1,personality:'방어적, 재정 압박',origin:'자영업 가정 출신',bond:'전세금 반환 사건 당사자'},
 builder:{name:'고명식',role:'공사업자·증인',hair:3,skin:2,suit:5,personality:'낯가림, 실무에는 정확',origin:'가업을 이어 소규모 업체 운영',bond:'수리비 견적 증인'},
 actor:{name:'강하준',role:'배우·피고인',hair:3,skin:0,suit:1,personality:'이미지 관리에 민감',origin:'연극 배우 출신',bond:'폭행 사건 피고인'},
 singer:{name:'차유라',role:'가수·원고',hair:4,skin:0,suit:4,personality:'성실하고 감정 표현에 솔직',origin:'10대 시절부터 연습생',bond:'전속계약 분쟁 당사자'},
 ceo:{name:'허진욱',role:'사업가·피고인',hair:2,skin:1,suit:1,personality:'설득적이지만 위험 감수 성향',origin:'사업을 여러 번 시작함',bond:'투자 사건 피고인'}
};
NPC.mina={name:'서민아',role:'출판 편집자',career:'출판 편집자',bornYear:1994,hair:4,skin:0,suit:3,personality:'배려 깊지만 자신의 일을 중요하게 여김',origin:'맞벌이 가정 출신',education:'대학 문헌정보학 전공',family:'형제 1명',bond:'친구의 책 모임에서 알게 된 사람'};
NPC.taeo={name:'최태오',role:'건축 설계자',career:'건축 설계자',bornYear:1992,hair:1,skin:1,suit:2,personality:'차분하며 약속을 중시함',origin:'자영업 가정 출신',education:'대학 건축학 전공',family:'남매 2명',bond:'지인의 전시회에서 만난 사람'};
// Persistent civic world: jobs, generations and relationships continue beyond any single lawsuit.
const WORLD_ROSTER={
 chiefJustice:{name:'문지호',role:'고위 법관',career:'법원 고위직',bornYear:1968,hair:2,skin:1,suit:1,personality:'절차와 독립성을 중시함',origin:'교사 가정에서 성장',education:'법학 교육',family:'형제 2명',wealth:78,goals:['사법행정 안정','판결의 일관성'],schedule:'사법행정 및 공적 일정'},
 tribunal:{name:'서혜원',role:'헌법재판소 관계자',career:'헌법 연구 담당',bornYear:1976,hair:4,skin:0,suit:3,personality:'신중하고 논증에 엄격함',origin:'연구자 가정',education:'법학·헌법 연구',family:'형제 1명',wealth:65,goals:['헌법 가치 연구'],schedule:'재판·연구 일정'},
 ministry:{name:'강재혁',role:'법무부 정책 담당자',career:'법무부 공직자',bornYear:1977,hair:1,skin:2,suit:2,personality:'조정과 합의를 선호',origin:'중소도시 공무원 가정',education:'법률·행정',family:'남매 2명',wealth:62,goals:['제도 개선'],schedule:'정부 업무·출장'},
 policeLead:{name:'오성민',role:'형사',career:'경찰 강력팀',bornYear:1982,hair:2,skin:1,suit:5,personality:'현장 증거를 중시함',origin:'소도시 상인 가정',education:'경찰 교육',family:'형제 1명',wealth:42,goals:['사건 해결','동료 신뢰'],schedule:'수사·당직'},
 firmHead:{name:'정연서',role:'로펌 대표 변호사',career:'로펌 대표',bornYear:1978,hair:4,skin:0,suit:3,personality:'분석적이고 경쟁심이 강함',origin:'사업가 가정',education:'법학',family:'외동',wealth:88,goals:['로펌 성장'],schedule:'의뢰인 상담·재판'},
 business:{name:'이강현',role:'기업인',career:'중견기업 대표',bornYear:1980,hair:2,skin:1,suit:0,personality:'위험 감수와 평판 관리',origin:'가업을 승계',education:'경영학',family:'형제 2명',wealth:92,goals:['사업 확장'],schedule:'회사·해외 출장'},
 politician:{name:'배하린',role:'정치인',career:'국회의원',bornYear:1983,hair:4,skin:0,suit:2,personality:'협상력이 높고 대외활동 활발',origin:'노동자 가정',education:'사회과학',family:'남매 2명',wealth:61,goals:['정책 과제','지역구 관리'],schedule:'국회·지역 일정'},
 celebrityHost:{name:'유찬영',role:'연예인',career:'방송인',bornYear:1991,hair:3,skin:0,suit:4,personality:'외향적이지만 사생활에는 신중',origin:'예술가 가정',education:'예술 전공',family:'형제 1명',wealth:73,goals:['활동 지속'],schedule:'촬영·행사'},
 investigativeReporter:{name:'신가온',role:'기자',career:'탐사보도 기자',bornYear:1989,hair:4,skin:1,suit:4,personality:'사실 확인을 반복하고 원칙적',origin:'지역 언론인 가정',education:'언론학',family:'남매 1명',wealth:41,goals:['보도 검증'],schedule:'현장 취재·마감'},
 civicLeader:{name:'양도윤',role:'시민단체 관계자',career:'시민단체 활동가',bornYear:1988,hair:1,skin:2,suit:5,personality:'끈기 있고 갈등을 회피하지 않음',origin:'맞벌이 가정',education:'사회복지학',family:'외동',wealth:27,goals:['사회적 지원'],schedule:'상담·현장 활동'}
};
Object.assign(NPC,WORLD_ROSTER);
const CATEGORIES=['집','사무실 집기','옷','시계','차량','가방','액세서리','구두'];
const SHOP_TIERS=['실속','입문','일상','중급','중상급','프리미엄','고급','하이엔드','컬렉터','플래그십'];
const SHOP_BRANDS=['모노','오르딘','벨렌','로베르','아르덴','발테르','세비안','에르빈','메종 루아','발토르'];
const SHOP_DATA={
 '집':{icon:'🏠',names:['법원 근처 작은 월세방','채광 좋은 원룸','역세권 오피스텔','도심 투룸 전세','서재가 있는 소형 아파트','신축 중형 아파트','조망 좋은 아파트','복층 주택','단독주택','도심 고급 주택'],prices:[350,920,2400,5500,11500,22000,39000,68000,125000,230000]},
 '사무실 집기':{icon:'🪑',names:['문서 정리대','데스크 조명','필기구 스탠드','모니터 받침','가죽 메모 패드','원목 책장','인체공학 의자','원목 서재 데스크','서류 보관 캐비닛','클래식 서재 가구 세트'],prices:[8,18,32,58,86,120,175,240,350,490]},
 '옷':{icon:'👔',names:['기본 셔츠·슬랙스','베이직 울 정장','차콜 세퍼레이트','모던 네이비 슈트','고급 울 블레이저','이탈리안 울 슈트','맞춤 쓰리피스','수제 비스포크 슈트','캐시미어 포멀 코트','스페셜 오더 테일러링'],prices:[12,42,64,90,125,180,260,420,650,900]},
 '시계':{icon:'⌚',names:['쿼츠 데일리 워치','심플 3핸즈','필드 워치','클래식 파일럿','자동 기계식 시계','드레스 워치','빈티지 크로노그래프','스몰 세컨즈','한정 생산 워치','컴플리케이션 워치'],prices:[10,38,90,190,360,570,790,1450,2800,4900]},
 '차량':{icon:'🚙',names:['경차','소형 하이브리드','국산 준중형 세단','중형 세단','패밀리 SUV','수입 중형 세단','대형 세단','고급 그랜드 투어러','수입 스포츠 쿠페','희소 고성능 스포츠카'],prices:[980,2050,2600,3500,4900,7200,9600,11800,13700,28000]},
 '가방':{icon:'💼',names:['캔버스 서류가방','심플 나일론 백','가죽 토트백','클래식 브리프백','사피아노 브리프케이스','프리미엄 가죽 가방','수제 가죽 도큐먼트 백','헤리티지 브리프케이스','한정판 여행 가방','맞춤 제작 레더 케이스'],prices:[8,18,36,60,90,140,215,380,700,1200]},
 '액세서리':{icon:'✨',names:['심플 키홀더','실버 타이핀','가죽 카드지갑','클래식 벨트','실버 커프링크','프리미엄 벨트','수제 커프링크','희소 소재 넥타이핀','공방 한정 액세서리','장인 제작 커프링크'],prices:[3,14,26,45,72,98,150,250,420,800]},
 '구두':{icon:'👞',names:['베이직 로퍼','기본 더비','가죽 옥스퍼드','브라운 윙팁','스웨이드 더비','프리미엄 페니로퍼','핸드메이드 옥스퍼드','맞춤 더비 슈즈','수제 홀컷 슈즈','비스포크 구두'],prices:[9,16,28,42,68,95,128,210,320,490]}
};
// Preserve original alpha v0.2 item IDs so older save files can still load.
const LEGACY_ITEMS={
 home_1:{cat:'집',i:1},home_2:{cat:'집',i:3},office_1:{cat:'사무실 집기',i:1},office_2:{cat:'사무실 집기',i:7},clothes_1:{cat:'옷',i:1},clothes_2:{cat:'옷',i:6},watch_1:{cat:'시계',i:1},watch_2:{cat:'시계',i:6},car_1:{cat:'차량',i:1},car_2:{cat:'차량',i:8},bag_1:{cat:'가방',i:1},bag_2:{cat:'가방',i:6},acc_1:{cat:'액세서리',i:1},acc_2:{cat:'액세서리',i:5},shoes_1:{cat:'구두',i:1},shoes_2:{cat:'구두',i:6}
};
const SHOP_VISUALS={
 '집':['🏘️','🏠','🏢','🏡','🏠','🏢','🏙️','🏘️','🏡','🏰'],
 '사무실 집기':['🗂️','💡','✒️','🖥️','📓','📚','💺','🪑','🗄️','🛋️'],
 '옷':['👕','👔','🧥','👔','🧥','👔','🧥','👔','🧥','🧥'],
 '시계':['⌚','⌚','⌚','⌚','⌚','⌚','⌚','⌚','⌚','⌚'],
 '차량':['🚗','🚙','🚘','🚘','🚙','🚗','🚘','🚗','🏎️','🏎️'],
 '가방':['🎒','💼','👜','💼','💼','👜','🧳','💼','🧳','💼'],
 '액세서리':['🗝️','✨','💳','👔','💠','💠','💠','✨','💎','💎'],
 '구두':['👞','👞','👞','👞','👞','👞','👞','👞','👞','👞']
};
const ITEMS=CATEGORIES.flatMap((cat,ci)=>SHOP_TIERS.map((tier,i)=>{
 const info=SHOP_DATA[cat], legacy=Object.entries(LEGACY_ITEMS).find(([k,v])=>v.cat===cat&&v.i===i);
 const id=legacy?.[0]||`catalog_${ci}_${i}`,price=info.prices[i];
 const monthly=cat==='차량'?Math.round(price*.0018):cat==='집'&&i<=3?[30,45,65,90][i]:cat==='집'?Math.round(price*.0005):0;
 return {id,cat,tier,grade:i+1,name:info.names[i],brand:`${SHOP_BRANDS[i]} ${({집:'리빙',차량:'모터스','사무실 집기':'워크',옷:'테일러',시계:'타임',가방:'레더',액세서리:'아틀리에',구두:'슈즈'})[cat]}`,price,icon:SHOP_VISUALS[cat][i],monthly,
  desc:cat==='집'?(i<=3?'임차 보증금·계약금 간소화 모델':'매입가 · 유지비 별도'):cat==='차량'?'이동 편의와 유지비가 달라지는 차량':cat==='사무실 집기'?'내 사무실에 표시되는 개인 소품':'캐릭터에 착용·전시할 수 있는 수집품',
  flashy:(cat==='차량'&&i>=8)||(cat==='시계'&&i>=8)};
}));
// NPC biography and consequence engine: stable identities, no live AI dependencies.
const LifeJustice=window.LifeJustice;
const CASES=[
 {id:'deposit',week:0,icon:'🏠',tag:'생활·민사',level:2,importance:2,name:'돌려받지 못한 전세금 8,000만 원',sub:'퇴거 후 보증금과 수리비를 둘러싼 다툼',who:['tenant','owner'],side:['jiyu','seon'],intro:'임차인은 계약 종료 후 보증금 8,000만 원을 받지 못했다며 청구했습니다. 임대인은 집의 훼손에 따른 수리비 공제를 주장합니다.',evidence:['임대차계약서 · 보증금 8,000만 원','원고 제출 입주 전 사진 · 촬영 시점 다툼','피고 제출 수리 견적서 · 총 1,200만 원'],
 stages:[
 {prompt:'첫 번째 심리 · 어떤 자료부터 확인할까요?',actions:[
 {label:'입주 전 사진의 원본을 확인한다',short:'사진 촬영 시점 검토',who:'jiyu',says:'"원본 촬영일은 입주 이틀 전입니다. 사진 속 욕실 벽면의 누수 자국이 보입니다."',clue:'입주 전 욕실 누수 흔적 확인',flag:'photo'},
 {label:'퇴거 당시의 사진을 살펴본다',short:'퇴거 현장 사진 확인',who:'seon',says:'"퇴거 사진에는 현관문의 찌그러진 부분이 확인됩니다. 다만 벽면 누수는 기존 하자인지 다투고 있습니다."',clue:'현관문 손상 사진 확인',flag:'exit'},
 {label:'계약서 원상회복 조항을 확인한다',short:'계약서 내용 검토',who:'jiyu',says:'"통상적인 사용에 따른 노후는 임차인의 부담으로 정하지 않았습니다. 어느 손상이 새로 생겼는지가 중요합니다."',clue:'계약서 원상회복 조항 검토',flag:'contract'}]},
 {prompt:'두 번째 심리 · 수리비의 근거를 확인하세요',actions:[
 {label:'공사업자에게 견적 내용을 묻는다',short:'미시공 항목 확인',who:'builder',says:'"1,200만 원은 견적 총액입니다. 그중 700만 원 규모의 공사는 실제 진행하지 않았습니다."',clue:'견적 1,200만 원 중 미시공 700만 원',flag:'builder'},
 {label:'임대인에게 수리 영수증을 요구한다',short:'실지출 자료 확인',who:'seon',says:'"현재 제출된 영수증은 현관문 교체 100만 원분입니다. 나머지는 견적만 있습니다."',clue:'현관문 교체 실지출 100만 원',flag:'receipt'},
 {label:'임차인에게 입주 당시 상태를 묻는다',short:'초기 하자 진술',who:'tenant',says:'"입주할 때 욕실 벽에 자국이 있었어요. 집주인에게도 문자로 알렸습니다. 현관문은 이사 과정에서 손상됐을 수 있습니다."',clue:'임차인의 하자 통지 진술',flag:'tenant'}]},
 {prompt:'세 번째 심리 · 책임 범위를 정리합니다',actions:[
 {label:'현관문 수리비에 관한 양측 의견 듣기',short:'수리 책임의 범위',who:'jiyu',says:'"현관문 손상과 100만 원 지출은 다투지 않겠습니다. 기존 누수 수리비까지 부담할 수는 없습니다."',clue:'양측이 현관문 수리비 100만 원에 동의',flag:'agreement'},
 {label:'견적과 실제 지출의 차이를 다시 확인',short:'공제 범위 재검토',who:'builder',says:'"현관문 수리 100만 원은 완료됐습니다. 누수 공사와 미시공 항목은 그 비용을 임차인에게 청구할 근거를 제가 알지 못합니다."',clue:'실제 공사 내역과 견적의 차이 확인',flag:'scope'},
 {label:'양측의 화해·조정 의향 확인',short:'조정 가능성 확인',who:'seon',says:'"피고는 최소한 현관문 수리비를 공제해야 한다고 보고 있습니다. 나머지 금액은 협의 여지가 있습니다."',clue:'일부 반환에 관한 조정 여지',flag:'settle'}]}
 ],verdicts:[{id:'partial',label:'7,900만 원 반환',note:'현관문 수리비 100만 원만 공제',score:94},{id:'full',label:'8,000만 원 전액 반환',note:'손해 공제 전부 불인정',score:62},{id:'deduct',label:'6,800만 원 반환',note:'견적서 1,200만 원 전액 공제',score:27}],ideal:'양측이 인정한 현관문 교체비 100만 원 이외에는 원고 책임과 지출의 근거가 충분하지 않습니다. 따라서 7,900만 원 반환 판단이 가장 설득력 있습니다.',outcome:'임대차 보증금 반환 청구 일부 인용'},
 {id:'camera',week:1,icon:'📷',tag:'생활·민사',level:1,importance:1,name:'중고 카메라의 숨겨진 결함',sub:'거래 직후 작동하지 않은 카메라',who:['tenant','owner'],side:['jiyu','seon'],intro:'원고는 중고 카메라를 95만 원에 구매했으나 촬영 중 기기가 반복적으로 꺼진다며 환불을 요구합니다. 판매자는 정상 제품이었다고 주장합니다.',evidence:['거래 채팅 · "정상 작동" 문구','송금 내역 · 95만 원','구매 다음 날 촬영한 작동 영상'],
 stages:[
 {prompt:'어떤 정보를 먼저 살펴볼까요?',actions:[
 {label:'판매 글의 표현을 확인한다',short:'성능 보장 내용',who:'jiyu',says:'"판매 글에는 정상 작동하며 기능상 하자가 없다고 적혀 있습니다."',clue:'판매 글에서 정상 작동을 명시',flag:'ad'},
 {label:'구매 당시 외관 사진을 확인한다',short:'외관과 기능 구분',who:'seon',says:'"외관이 양호했던 것은 맞습니다. 그러나 외관만으로 내부 기능을 알 수는 없습니다."',clue:'외관만으로 기능 결함 판단 불가',flag:'looks'},
 {label:'판매자에게 사전 점검 여부 묻기',short:'판매자 진술 확인',who:'owner',says:'"떠나기 전 전원은 켰지만 연속 촬영까지 해보진 않았습니다."',clue:'판매자는 연속 촬영 점검을 하지 않음',flag:'test'}]},
 {prompt:'결함이 언제 발생했는지 검토하세요',actions:[
 {label:'수리센터의 점검 내역 확인',short:'기술 점검서',who:'jiyu',says:'"점검서에는 기존 납땜 흔적과 메인보드 접촉 불량이 기록돼 있습니다."',clue:'장기간 진행된 접촉 불량 가능성',flag:'repair'},
 {label:'구매자 사용 방식 확인',short:'구매 이후 사용',who:'tenant',says:'"받은 날 몇 장을 찍었고 다음 날 야외 촬영에서 반복적으로 꺼졌습니다."',clue:'인도 직후 결함 발생',flag:'soon'},
 {label:'판매자 반박 서면 확인',short:'판매자 반박',who:'seon',says:'"피고는 구매자가 사용 중 충격을 주었을 가능성을 주장하지만 관련 자료는 제출하지 않았습니다."',clue:'구매자 과실 주장에 증거 없음',flag:'none'}]},
 {prompt:'이제 청구의 범위를 정리합니다',actions:[
 {label:'반품과 대금 반환 의향을 확인한다',short:'원상회복',who:'jiyu',says:'"원고는 카메라를 돌려주고 매매대금 95만 원을 돌려받는 방식에 동의합니다."',clue:'물건 반환 조건의 대금 반환에 동의',flag:'return'},
 {label:'부분 환불에 관한 의견을 듣는다',short:'조정 검토',who:'seon',says:'"피고는 수리비 정도의 공제는 협의할 수 있으나 전액 환불은 부담스럽다고 합니다."',clue:'부분 환불 의견 확인',flag:'offer'},
 {label:'거래 당시 설명 내용을 최종 확인',short:'기능 고지 여부',who:'owner',says:'"이전부터 가끔 꺼지는 현상이 있었지만, 일시적인 줄 알았습니다."',clue:'판매자가 기존 이상 증상을 알고 있었음',flag:'knowledge'}]}
 ],verdicts:[{id:'refund',label:'반품 조건으로 95만 원 반환',note:'계약 해제 및 대금 반환',score:94},{id:'partial',label:'40만 원만 반환',note:'일부 수리비 수준 배상',score:54},{id:'dismiss',label:'원고 청구 기각',note:'구매자 책임 판단',score:20}],ideal:'기존부터 발생하던 기능 결함과 정상 작동 고지, 인도 직후 증상이 핵심입니다. 이 가상 사건에서는 반품 조건의 대금 반환이 가장 설득력 있습니다.',outcome:'중고거래 매매계약 해제 분쟁'},
 {id:'actor',week:3,icon:'🎬',tag:'연예계·형사',level:3,importance:5,name:'유명 배우의 폭행 혐의',sub:'행사장 복도에서 벌어진 몸싸움',who:['actor','jun'],side:['soo','seon'],intro:'배우 강하준이 행사장 보안요원을 밀쳐 다치게 했다는 공소사실로 기소됐습니다. 피고인은 위협을 피하기 위한 행동이었다고 주장합니다.',evidence:['행사장 CCTV · 복도 일부만 촬영','보안요원 진단서 · 2주','현장 직원 진술서 · 시작 장면 미목격'],
 stages:[
 {prompt:'폭행의 경위를 먼저 확인하세요',actions:[
 {label:'CCTV의 행동 순서를 확인한다',short:'접촉 선후관계',who:'soo',says:'"영상에는 피고인이 보안요원을 먼저 밀치는 장면이 있습니다. 그러나 접촉 직전 상황은 화면 밖입니다."',clue:'피고인의 밀치는 행동 확인, 이전 장면 없음',flag:'cctv'},
 {label:'피고인의 진술을 듣는다',short:'정당방위 주장',who:'actor',says:'"상대가 길을 막고 팔을 잡으려 했어요. 겁이 나서 밀었습니다."',clue:'피고인은 위협에 대한 대응이라고 주장',flag:'actor'},
 {label:'보안요원의 주장 확인',short:'피해자 진술',who:'soo',says:'"보안요원은 출입 제한을 안내했을 뿐 신체적으로 위협한 적이 없다고 진술했습니다."',clue:'보안요원은 위협 행위를 부인',flag:'security'}]},
 {prompt:'상해와 폭행의 인과관계를 검토하세요',actions:[
 {label:'진단서와 치료 기록 확인',short:'상해 정도 확인',who:'soo',says:'"진단서는 2주 치료를 기재하지만, 진료 기록만으로 넘어지며 다친 부위가 모두 피고인의 밀침 때문인지는 확정하기 어렵습니다."',clue:'상해와 폭행 사이 일부 인과관계 불명확',flag:'medical'},
 {label:'현장 직원의 진술을 듣는다',short:'목격 범위 확인',who:'seon',says:'"직원은 몸싸움 뒤에 도착해 다친 모습을 보았지만, 시작 장면은 보지 못했습니다."',clue:'직원은 사건 시작을 목격하지 못함',flag:'staff'},
 {label:'피고인의 당시 동선을 확인한다',short:'행사장 출입 기록',who:'seon',says:'"피고인은 제한구역에 들어가려다 제지당했습니다. 출입 제한 안내는 이전에도 받았습니다."',clue:'피고인은 출입 제한 구역 접근 중',flag:'entry'}]},
 {prompt:'어떤 범위까지 증명됐는지 정리하세요',actions:[
 {label:'양측에 정당방위 요건에 관한 의견 묻기',short:'위협의 객관적 근거',who:'seon',says:'"변호인은 팔을 잡으려 했다는 피고인 진술을 강조하지만, 접촉 직전의 객관적 기록은 없습니다."',clue:'정당방위 주장에 객관적 확인 부족',flag:'defense'},
 {label:'검사에게 공소사실 구분을 요구한다',short:'폭행과 상해의 구분',who:'soo',says:'"검찰은 상해를 주장하며, 예비적으로 폭행 사실에 대한 판단도 요청합니다."',clue:'폭행 자체와 상해 결과 구분',flag:'scope'},
 {label:'증거를 다시 정리해 변론을 마친다',short:'증거의 한계 점검',who:'jun',says:'"영상으로 밀친 사실은 확인되지만, 접촉 전 상황과 상해 원인은 다툼이 남아 있습니다."',clue:'폭행 증명과 상해 증명을 구분할 필요',flag:'summary'}]}
 ],verdicts:[{id:'assault',label:'폭행 부분 유죄 · 벌금형',note:'상해 결과의 증명은 부족',score:87},{id:'injury',label:'상해까지 유죄 · 징역형',note:'상해에 대한 인과관계 인정',score:44},{id:'innocent',label:'공소사실 전부 무죄',note:'정당방위 주장 전부 인정',score:33}],ideal:'영상에는 피고인의 밀치는 행위가 보입니다. 다만 상해 결과와의 인과관계는 다툼이 있어, 이 가상 증거 구조에서는 폭행 부분만 인정하는 판단이 더 타당합니다.',outcome:'유명 배우 행사장 폭행 사건 1심'},
 {id:'idol',week:5,icon:'🎤',tag:'연예계·민사',level:3,importance:4,name:'아이돌의 전속계약 해지 소송',sub:'정산 누락과 활동 제한을 둘러싼 갈등',who:['singer','ceo'],side:['jiyu','seon'],intro:'가수 차유라가 수년간 정산자료를 받지 못했다며 전속계약 해지를 주장합니다. 기획사는 정산자료가 지연됐을 뿐이라고 반박합니다.',evidence:['전속계약서 · 정산 조항','활동 정산자료 · 일부 기간 공백','수차례 발송한 자료 요청 메시지'],
 stages:[
 {prompt:'계약의 중요 의무를 확인하세요',actions:[
 {label:'정산자료 제공 조항 확인',short:'계약 조항',who:'jiyu',says:'"계약서에는 분기마다 정산자료를 제공하고 수익 배분 내역을 설명하도록 정했습니다."',clue:'분기별 정산자료 제공 의무',flag:'terms'},
 {label:'기획사의 자료 지연 이유 확인',short:'회사 사정',who:'seon',says:'"담당자가 교체되며 기록 정리가 늦었습니다. 다만 수차례 요청을 받은 것은 인정합니다."',clue:'기획사는 반복 요청과 지연을 인정',flag:'delay'},
 {label:'가수의 활동 내역 확인',short:'정산 대상 확인',who:'singer',says:'"해외 공연과 광고가 있었는데 수익 배분을 확인할 방법이 없었어요."',clue:'상당한 활동 내역 존재',flag:'work'}]},
 {prompt:'정산 누락이 어느 정도인지 검토하세요',actions:[
 {label:'회계 자료의 공백 기간 확인',short:'자료 누락 범위',who:'jiyu',says:'"회계자료에서 8개 분기의 정산 근거가 빠져 있습니다. 일부 수익 지급 내역도 확인되지 않습니다."',clue:'8개 분기 정산 근거 누락',flag:'account'},
 {label:'기획사에 자료 제출 가능 시점 확인',short:'시정 가능성',who:'seon',says:'"일부 자료는 복구할 수 있지만 누락 기간 전체를 복구할 수 있는지는 장담하지 못합니다."',clue:'정산자료 전부 복구 불확실',flag:'restore'},
 {label:'가수에게 계약 유지 의사 확인',short:'신뢰관계',who:'singer',says:'"여러 번 요청했는데도 설명을 못 들었어요. 지금은 회사를 신뢰하기 어렵습니다."',clue:'신뢰관계 회복 어렵다는 진술',flag:'trust'}]},
 {prompt:'해지 요건과 법률 효과를 검토하세요',actions:[
 {label:'시정 요구와 경과 시간 확인',short:'시정 최고',who:'jiyu',says:'"가수는 계약상의 시정 요구 절차에 따라 서면으로 통지했고 기획사는 기간 내 충분한 자료를 제공하지 못했습니다."',clue:'시정 요구 뒤에도 의무 미이행',flag:'notice'},
 {label:'기획사에게 이행 가능성을 최종 확인',short:'회복 가능성',who:'seon',says:'"회사도 앞으로 투명한 정산을 약속하지만 기존 누락 내역은 확인하지 못한 부분이 있습니다."',clue:'장기간 미이행 상태 지속',flag:'promise'},
 {label:'양측 조정 가능성 확인',short:'조정 검토',who:'jiyu',says:'"당사자는 정산 자료만이 아니라 관계 전체가 파탄됐다고 보며 해지를 원합니다."',clue:'조정에 관한 견해 차이',flag:'mediate'}]}
 ],verdicts:[{id:'end',label:'전속계약 해지 인정',note:'중요한 정산 의무의 장기간 불이행',score:91},{id:'keep',label:'전속계약 유지',note:'시정 기회를 더 부여',score:43},{id:'damage',label:'손해만 일부 인정',note:'해지 효력은 인정하지 않음',score:55}],ideal:'장기간 정산자료 제공 의무 미이행과 시정 요구에도 회복되지 않은 점이 핵심입니다. 이 가상 설정에서는 해지를 인정하는 판단이 더 설득력 있습니다.',outcome:'전속계약 효력 확인 소송'},
 {id:'fraud',week:7,icon:'📊',tag:'경제·형사',level:4,importance:4,name:'사라진 공동 투자금 3억 원',sub:'투자 실패인가, 처음부터 속인 것인가',who:['ceo','tenant'],side:['jun','seon'],intro:'사업가 허진욱은 물류 사업 투자금 3억 원을 받은 뒤 일부를 기존 채무 변제에 사용했습니다. 검찰은 투자 당시부터 사용 목적을 속였다고 주장합니다.',evidence:['투자 설명서 · 창고 확장 목적','입금 후 계좌 거래 내역','사업계획서와 실제 계약 자료'],
 stages:[
 {prompt:'투자 당시 약속을 먼저 확인하세요',actions:[
 {label:'투자 설명서의 자금 사용 목적 확인',short:'약속한 용도',who:'jun',says:'"설명서에는 창고 확장과 차량 구매에 사용한다고 적혀 있습니다. 채무 상환 용도는 언급되지 않았습니다."',clue:'투자금의 약정 용도 확인',flag:'promise'},
 {label:'피고인의 설명 듣기',short:'사업 실패 주장',who:'ceo',says:'"사업은 실제로 추진했지만 상황이 나빠져 기존 채무부터 막아야 했습니다."',clue:'피고인은 실제 사업 추진을 주장',flag:'intent'},
 {label:'투자자의 진술 확인',short:'투자 결정 경위',who:'jiyu',says:'"원고는 투자 설명서에 적힌 차량 계약이 체결된 줄 알고 송금했다고 진술했습니다."',clue:'투자자는 구체적 사업 계약을 신뢰',flag:'victim'}]},
 {prompt:'돈의 흐름을 확인하세요',actions:[
 {label:'은행 거래 내역 대조',short:'사용처 추적',who:'jun',says:'"입금 후 2억 원이 피고인의 기존 개인 채무 상환에 사용됐습니다. 나머지 1억 원은 사업 비용으로 쓰였습니다."',clue:'2억 원 채무 상환, 1억 원 사업 비용',flag:'bank'},
 {label:'실제 사업 계약 확인',short:'계약 성립 여부',who:'seon',says:'"일부 물류 거래는 진행됐지만 설명서상 대형 창고 임대계약은 당시 체결되지 않았습니다."',clue:'중요한 창고 계약 미체결',flag:'contracts'},
 {label:'기존 채무 발생 시점 확인',short:'투자 전 채무',who:'jun',says:'"투자 전에 이미 상환기한이 도래한 개인 채무가 있었고, 피고인은 이를 알고 있었습니다."',clue:'투자 당시 기존 채무 알고 있었음',flag:'prior'}]},
 {prompt:'기망의 범위를 정리하세요',actions:[
 {label:'검사에게 범죄 고의 입증 근거 확인',short:'사전 인식',who:'jun',says:'"검찰은 계약 미체결 사실과 채무 만기를 알면서도 확정된 사업인 것처럼 설명했다고 주장합니다."',clue:'투자 당시 기망 여부가 핵심',flag:'charge'},
 {label:'변호인에게 실제 사업 증빙 확인',short:'일부 사업 실행',who:'seon',says:'"사업 비용 1억 원의 실제 집행 자료는 확인됩니다. 모든 돈을 편취하려 했다는 단정에는 이의를 제기합니다."',clue:'실제 사업 집행 정황도 존재',flag:'business'},
 {label:'쟁점 금액 구분해 최종 의견 받기',short:'일부·전부 구분',who:'jun',says:'"검찰은 전액을 기소했지만, 적어도 채무 변제에 쓰인 2억 원 부분의 설명이 쟁점입니다."',clue:'2억 원 부분과 1억 원 구분 필요',flag:'partial'}]}
 ],verdicts:[{id:'some',label:'2억 원 부분 사기 유죄',note:'기망이 확인되는 범위를 제한',score:86},{id:'all',label:'3억 원 전부 사기 유죄',note:'사업 집행 부분까지 포함',score:54},{id:'none',label:'전부 무죄',note:'전액을 단순 투자 실패로 판단',score:25}],ideal:'이미 알고 있던 채무 만기와 사업계약 체결 여부를 속인 부분이 중요합니다. 실제 사업에 투입된 1억 원에 대해서는 별도 판단이 필요해, 범위를 나누는 결론이 타당합니다.',outcome:'투자금 편취 혐의 형사재판'},
 {id:'alley',week:10,icon:'🌙',tag:'미스터리·형사',level:5,importance:5,name:'비 오는 밤의 골목 사건',sub:'오래된 살인 사건의 재판',who:['owner','jun'],side:['soo','seon'],intro:'3년 전 골목에서 발생한 사망 사건의 피고인이 기소됐습니다. 검찰은 목격 진술과 위치 기록을 근거로 들지만, 피고인은 현장에 있었을 뿐 범행하지 않았다고 부인합니다.',evidence:['사건 인근 CCTV · 인물 특정 불가','목격자 진술 · 거리 40m, 야간','피고인 휴대전화 위치 자료'],
 stages:[
 {prompt:'피고인의 현장 존재와 범행을 구별하세요',actions:[
 {label:'CCTV 식별 가능 범위 확인',short:'영상의 한계',who:'soo',says:'"화면에는 비슷한 체격의 인물이 보이지만, 얼굴은 식별할 수 없습니다."',clue:'영상만으로 피고인 특정 불가',flag:'cctv'},
 {label:'목격 환경을 확인한다',short:'시야와 날씨',who:'seon',says:'"목격자는 비 오는 밤 40m 떨어진 곳에서 잠시 사람을 봤다고 말했습니다."',clue:'목격 조건이 열악함',flag:'view'},
 {label:'피고인 진술 검토',short:'현장 존재 이유',who:'owner',says:'"그 길을 지나간 건 맞지만 피해자를 본 기억은 없습니다."',clue:'현장 근처 통행 자체는 인정',flag:'there'}]},
 {prompt:'객관 자료의 증명 범위를 확인하세요',actions:[
 {label:'휴대전화 위치 기록의 정밀도 확인',short:'위치 오차',who:'soo',says:'"기지국 기록은 인근 수백 미터 범위에 있었음을 보여주지만 사건 장소를 특정하지는 못합니다."',clue:'기지국 정보만으로 현장 특정 불가',flag:'cell'},
 {label:'목격자의 첫 진술과 최근 진술 비교',short:'진술 변화',who:'seon',says:'"첫 진술에는 옷 색을 확신하지 못한다고 했지만 최근에는 검은 외투였다고 단언합니다."',clue:'목격자 진술의 확신 정도 변화',flag:'witness'},
 {label:'다른 물적 증거 제출 여부 확인',short:'물적 증거',who:'soo',says:'"피고인과 범행을 직접 연결하는 DNA나 지문 증거는 확보되지 않았습니다."',clue:'범행 직접 연결 물증 없음',flag:'physical'}]},
 {prompt:'합리적인 의심이 남는지 검토하세요',actions:[
 {label:'검사에게 간접증거 연결 논리 확인',short:'간접증거 종합',who:'soo',says:'"검찰은 위치와 외형, 당시 동선의 유사성을 종합하자고 주장하지만 각 자료에는 한계가 있습니다."',clue:'간접증거에 개별 한계 존재',flag:'chain'},
 {label:'변호인에게 대안 설명 확인',short:'다른 가능성',who:'seon',says:'"당시 골목은 인근 지하철역의 귀갓길이었습니다. 피고인처럼 지나간 사람은 많았습니다."',clue:'현장 근처 통행에 여러 가능성',flag:'alternate'},
 {label:'양측의 최종 의견 듣기',short:'증명 정도',who:'jun',says:'"쟁점은 사건 현장에 있었느냐가 아니라, 범행을 했다는 사실이 합리적 의심 없이 증명되었느냐입니다."',clue:'범행 증명의 충분성 판단 필요',flag:'burden'}]}
 ],verdicts:[{id:'innocent',label:'무죄 · 범죄의 증명 부족',note:'직접 특정할 증거 부족',score:92},{id:'guilty',label:'살인 유죄 · 중형',note:'간접증거만으로 범행 인정',score:22},{id:'lower',label:'더 낮은 형량으로 유죄',note:'의심이 남지만 유죄 판단',score:26}],ideal:'피고인의 인근 통행 가능성은 있지만, 증거로 범행 자체가 합리적 의심 없이 증명됐다고 보기는 어렵습니다. 이 가상 사건에서는 무죄가 타당합니다.',outcome:'미제 살인 사건 1심'}
];
const WEEK_EVENTS={
 1:{id:'lunch',title:'선배 판사의 점심 제안',body:'윤태성 판사가 점심을 함께하며 재판 업무에 관한 조언을 나누자고 제안했습니다.',who:'senior',opts:[{t:'점심에 참석하고 사건 진행의 고민을 듣는다',rel:{senior:6},prof:2,reply:'업무를 대하는 태도를 좋게 평가받았습니다.'},{t:'기록 검토를 마치고 다음을 기약한다',rel:{senior:0},prof:1,reply:'일정을 정리하고 서면을 검토했습니다.'}]},
 3:{id:'coworker',title:'동기의 늦은 메시지',body:'김현우 판사가 최근 재판에서 겪은 어려움을 털어놓았습니다. 가벼운 조언을 구하는 연락입니다.',who:'hyun',opts:[{t:'경험을 공유하고 진지하게 대화한다',rel:{hyun:7},prof:1,reply:'동기와의 신뢰가 조금 깊어졌습니다.'},{t:'짧게 응원하고 대화를 마친다',rel:{hyun:2},prof:0,reply:'관계에는 큰 변화가 없었습니다.'}]},
 5:{id:'press',title:'법조 기자의 취재 요청',body:'한민지 기자가 사회적 관심 사건에 관해 비공식 의견을 물었습니다. 현재 담당 사건의 구체적 내용은 외부에 밝힐 수 없습니다.',who:'reporter',opts:[{t:'사건 설명은 거절하고 공개된 법원 자료를 안내한다',rel:{reporter:4},prof:4,reply:'취재 윤리를 존중하는 대화로 마무리됐습니다.'},{t:'정중히 답변을 거절한다',rel:{reporter:0},prof:2,reply:'기자는 요청을 철회했습니다.'}]},
 8:{id:'seminar',title:'신임 법관 연구 모임',body:'법원 내 연구 모임에서 전자증거의 신빙성에 관한 토론회가 열립니다.',who:'hyun',opts:[{t:'토론에 참여해 판례를 공부한다',rel:{hyun:3},prof:6,reply:'전자증거를 바라보는 관점을 넓혔습니다.'},{t:'대신 진행 중 사건의 쟁점을 정리한다',rel:{hyun:0},prof:2,reply:'맡은 사건의 쟁점을 다시 검토했습니다.'}]},
 12:{id:'review',title:'분기별 업무 면담',body:'선배 판사가 재판 진행 속도와 판결문 작성에 관해 짧게 면담을 요청했습니다.',who:'senior',opts:[{t:'주요 판결 근거를 정리해 면담한다',rel:{senior:4},prof:5,reply:'판결 이유를 설득력 있게 설명했습니다.'},{t:'미완료 사건 중심으로 업무 개선 방안을 공유한다',rel:{senior:3},prof:4,reply:'사건 적체를 관리하는 방안을 논의했습니다.'}]}
};
/* PROCEDURAL WORLD ENGINE v0.2 — locally seeded; no network, no live AI.
 * Each generated case is immutable and serialized into the device's save.
 * Fresh facts / persons / evidence / hearing actions are chosen before play.
 */
// names come from names.js (gender, birth year, real surname frequency, least-used given names)
const TEMPERAMENTS=['세부사항에 집착하지만 갈등을 피함','상대의 의도를 의심하는 편','상황에 따라 말을 아끼는 편','자신감이 높고 표현이 직설적','부담이 커지면 방어적으로 변함','관계가 나빠지는 것을 두려워함','원칙에 강하지만 타협도 고려함','감정 표현이 솔직하고 급한 편','차분하게 기록을 정리하는 편'];
const UPBRINGINGS=['자영업 가정의 장녀·장남으로 성장','맞벌이 가정에서 자람','어릴 때 여러 지역으로 이사 다님','조부모와 함께 자란 시기가 있음','부모의 사업 실패를 경험','형제자매와 가까운 관계','부모와 오랫동안 갈등을 겪음','안정적인 직장인 가정에서 성장'];
const EDUCATIONS=['고등학교 졸업 후 취업','전문대 졸업 후 현장 실무 경력','지방 4년제 대학 졸업','서울 소재 대학 졸업','자격증을 취득해 전문직 종사','가업을 이어 실무 경험 축적'];
const RELATION_STYLES=['친구는 적지만 오래 유지함','직장 내 교류가 넓음','가족과는 가깝고 동료와 거리를 둠','과거 친구와 드물게 연락함','어려운 일이 생기면 가족에게 의지함'];
const PROFESSIONS=['직장인','자영업자','프리랜서','공무원','회사 임원','방송인','연구원','배달업 종사자','디자이너','건설업 종사자','서비스업 종사자'];
const LOCATIONS=['서울 마포구','서울 송파구','서울 성북구','인천 연수구','경기 성남시','경기 고양시','부산 해운대구','대전 서구','대구 수성구','광주 북구','경기 수원시','세종시'];
const JURISDICTIONS=['서울','인천','수원','부산','대전','대구','광주'];
const CASE_BLUEPRINTS=[
 {key:'rent',tag:'민사·임대차',icon:'🏢',legal:'임대차 보증금·원상회복',importance:2,kind:'civil',titles:['퇴거한 집의 반환되지 않은 보증금','계약 종료 뒤 남겨진 수리비 분쟁','벽면 누수와 원상회복의 범위'],premises:['계약이 끝났지만 보증금 일부가 반환되지 않았다. 임대인은 시설물 손상에 따른 비용 공제를 주장한다.','세입자는 퇴거했고 집주인은 예상보다 큰 복구비를 청구한다. 입주 당시의 상태를 두고 주장이 엇갈린다.','집주인은 누수 보수비를 청구하지만 세입자는 건물 노후로 생긴 하자라고 맞선다.'],docs:['임대차계약서와 반환 요청 내역','입주·퇴거 사진과 관리 기록','수리비 산정서와 지출 자료'],questions:['손상이 언제 발생했는지 확인','견적과 실제 공사를 대조','계약서의 수리비 부담 조항 검토']},
 {key:'fraud',tag:'형사·사기',icon:'📊',legal:'기망행위·편취 범의',importance:4,kind:'criminal',titles:['허위 매출을 내세운 공동 투자','사라진 창업자금과 투자설명서','정산하지 않은 사업 투자금'],premises:['투자 유치 당시 제시한 매출 규모와 실제 계좌 내역이 달랐다. 검찰은 처음부터 변제 의사가 없었다고 주장한다.','사업가가 투자금을 받은 뒤 다른 채무에 일부 사용했다. 피고인은 일시적인 자금 융통이었다고 반박한다.','사업 성과가 과장된 자료를 근거로 투자금이 모집되었다. 자료 작성 당시 피고인의 인식이 다투어진다.'],docs:['투자설명서와 사업계획서','투자금 계좌 입출금','계약 전후 메시지와 회계자료'],questions:['투자 당시 설명과 실제 거래 비교','자금 용도 변경 경위 확인','피해자와 피고인의 계약 당시 인식 확인']},
 {key:'assault',tag:'형사·폭행',icon:'🥊',legal:'폭행 행위·정당방위',importance:3,kind:'criminal',titles:['야간 식당 앞의 충돌','행사장 복도에서의 몸싸움','주차장 언쟁 뒤 발생한 상해'],premises:['현장에서 다툰 두 사람 중 한 명이 다쳤다. 피고인은 상대가 먼저 위협했다고 주장한다.','다툼을 제지하던 중 한 사람이 넘어졌다. 사건 시작 장면을 촬영한 자료가 없다.','주차 문제로 언쟁하다 밀치는 장면이 촬영됐다. 그 이전 행동과 고의가 쟁점이다.'],docs:['현장 CCTV 편집본','상해 진단서','목격자 진술과 출동 기록'],questions:['신체 접촉 전후 장면 확인','목격자 진술의 관찰 범위 검토','상해와 피고인 행동의 인과관계 판단']},
 {key:'murder',tag:'형사·살인',icon:'🔍',legal:'살인의 고의·범인 특정',importance:5,kind:'criminal',titles:['새벽 통화 이후의 사망 사건','아파트에서 발견된 사망자','강변 산책로의 마지막 목격'],premises:['피해자가 사망한 날 피고인과 다툰 기록이 있다. 검찰은 현장 주변 이동 기록을 근거로 기소했다.','사망 당시 동선과 시간대가 불명확하다. 피고인은 우연히 현장 근처에 있었다고 주장한다.','흉기에 의한 사망이 확인됐지만 범인을 직접 목격한 사람은 없다. 물증과 진술의 연결성이 핵심이다.'],docs:['부검 감정과 사망 추정 시각','주변 이동·통화 기록','현장 감식 결과와 목격 진술'],questions:['사망 추정 시각과 동선 대조','법과학 감정의 증명 범위 확인','제3자 출입 가능성과 진술의 일관성 판단']},
 {key:'sexual',tag:'형사·성폭력',icon:'⚖️',legal:'동의 여부·진술 신빙성',importance:5,kind:'criminal',titles:['회식 뒤의 숙박시설 사건','지인 모임 이후의 성폭력 혐의','늦은 밤 귀가길에 있었던 일'],premises:['피해자는 동의하지 않은 성적 접촉이 있었다고 진술하고 피고인은 동의한 상황이었다고 다툰다. 양측의 사후 행동과 당시 객관 자료가 쟁점이다.','친분이 있던 두 사람 사이의 성범죄 혐의다. 사건 전후 연락 내용과 진술의 신빙성을 두고 공방이 이어진다.','사건 당일 함께 있었던 사실은 인정되지만 행위의 경위에 관하여 주장이 대립한다.'],docs:['사건 직후 신고·상담 기록','연락 내역과 이동 기록','의료·감정 자료의 존재 및 한계'],questions:['각 진술의 핵심 쟁점 확인','사건 전후 연락·이동 자료 검토','증거능력과 입증 범위를 구분']},
 {key:'stalking',tag:'형사·스토킹',icon:'📱',legal:'반복적 접근·상대방 의사',importance:3,kind:'criminal',titles:['헤어진 연인의 반복된 연락','집 앞에서 이어진 기다림','온라인 계정으로 계속된 연락'],premises:['관계가 끝난 뒤 반복적인 연락과 방문이 있었다. 피고인은 대화를 마무리하려 했다고 진술한다.','상대방이 연락을 거부한 후에도 여러 차례 주변에 나타났다는 혐의다. 접근의 반복성과 의사가 다투어진다.','새 계정으로 연락한 내역이 제출됐다. 피고인은 자신의 계정인지 기억이 나지 않는다고 한다.'],docs:['연락 차단 및 통화 기록','출입구 CCTV·위치 자료','접근 중단 요청과 답변'],questions:['반복성 및 시간대 확인','접촉 중단 의사 전달 여부 확인','피고인 계정·동선 특정']},
 {key:'embezzle',tag:'형사·횡령',icon:'💼',legal:'보관관계·불법영득의사',importance:4,kind:'criminal',titles:['조합 계좌에서 빠져나간 돈','회사 법인카드의 사적 사용','비영리단체의 사라진 후원금'],premises:['단체 자금이 개인 계좌로 이체됐다. 피고인은 일시적인 업무상 지출이었다고 주장한다.','법인카드 지출 중 개인적인 용도로 보이는 내역이 발견됐다. 사용 권한과 반환 의사가 쟁점이다.','후원금 일부가 사업 목적 외 계좌로 이동했다. 회계 책임자의 고의 여부가 다투어진다.'],docs:['법인 계좌 거래 명세','내부 지출 승인 규정','영수증·반환 내역'],questions:['자금 관리 권한 확인','지출 목적과 증빙 대조','승인 및 반환 경위 확인']},
 {key:'celebrity',tag:'연예계·민사',icon:'🎤',legal:'전속계약 해지·정산',importance:4,kind:'civil',titles:['정산서 없는 월드투어 계약','배우 전속계약의 해지 통보','앨범 수익 배분을 둘러싼 분쟁'],premises:['연예인은 수익 정산이 누락됐다며 계약 해지를 주장한다. 소속사는 정산 시점만 늦어진 것이라고 반박한다.','배우가 활동 기회를 부당하게 제한당했다며 계약 해제를 요구한다. 기획사는 관리상의 정당한 사유가 있었다고 주장한다.','매출 자료와 정산 통지가 일치하지 않아 소송이 제기됐다. 회계기간과 공제 항목이 쟁점이다.'],docs:['전속계약 및 정산 조항','활동·매출·비용 자료','정산 요청과 회신 메시지'],questions:['정산 누락의 기간과 금액 확인','계약의 의무 위반 정도 검토','시정 요청 이후 조치 확인']},
 {key:'affair',tag:'가사·손해배상',icon:'💔',legal:'부정행위·손해배상 책임',importance:3,kind:'civil',titles:['오래된 메시지가 남긴 혼인 파탄','출장 동행 기록의 의미','이혼 직전의 손해배상 청구'],premises:['혼인 중 배우자의 부정행위로 정신적 피해를 입었다는 청구다. 상대방은 이미 혼인관계가 파탄된 상태였다고 주장한다.','동행 기록과 친밀한 메시지가 제출됐다. 당시 관계의 성격과 혼인 상태가 다투어진다.','이혼 절차가 진행되는 사이 제3자를 상대로 손해배상 청구가 제기됐다. 행위 시점과 인식 여부가 쟁점이다.'],docs:['혼인 생활 및 별거 관련 자료','메시지·숙박·교통 내역','혼인관계 경위에 관한 진술'],questions:['행위 시점의 혼인 상태 확인','제출된 메시지의 전체 맥락 확인','손해배상 범위와 인과관계 검토']},
 {key:'inherit',tag:'가사·상속',icon:'📜',legal:'유언의 효력·상속분',importance:3,kind:'civil',titles:['돌아가신 아버지의 유언장','한쪽 자녀에게 이전된 재산','사망 직전 변경된 수익자'],premises:['유언장 진정성과 작성 당시 의사능력을 두고 형제자매 사이에 다툼이 있다.','생전에 특정 자녀에게 이전된 자산이 상속 분쟁의 핵심이 됐다. 그 성격과 금액이 쟁점이다.','사망 전 수익자 변경의 적법성과 당시 의사능력이 문제 됐다.'],docs:['유언장·등기·금융기록','진료기록의 작성 시점','가족 간 연락과 증인 진술'],questions:['작성 경위와 서명 진정성 확인','사망 전 재산 이동 경위 검토','당시 의사능력에 관한 자료 대조']},
 {key:'defamation',tag:'형사·명예훼손',icon:'🗣️',legal:'표현 내용·공연성·위법성',importance:3,kind:'criminal',titles:['온라인 게시글이 만든 소문','지역 커뮤니티의 폭로 글','생방송 인터뷰의 한 문장'],premises:['온라인에 올린 글로 타인의 사회적 평가가 훼손됐다는 고소가 제기됐다. 피고인은 공익을 위한 제보였다고 주장한다.','지역 커뮤니티에 특정인을 지목한 게시물이 올라왔다. 사실 여부와 공표 목적을 두고 다툰다.','생방송 발언의 맥락이 편집돼 퍼졌다. 피고인은 전체 발언 취지가 달랐다고 항변한다.'],docs:['게시물 원본·조회 범위','관련 사실 확인 자료','게시 전후 연락·정정 내역'],questions:['발언 원문과 맥락 검토','구체적 사실 적시 여부 검토','공익 목적 등 관련 사정 확인']},
 {key:'medical',tag:'민사·손해배상',icon:'🏥',legal:'주의의무·인과관계',importance:3,kind:'civil',titles:['수술 뒤 나타난 합병증','응급실 진료 지연의 책임','검사 결과를 전달받지 못한 환자'],premises:['치료 뒤 예상치 못한 결과가 발생했다. 환자는 설명과 처치가 부족했다고 주장하고 의료진은 알려진 위험이라고 반박한다.','응급 진료의 지연으로 상태가 악화됐다는 손해배상 청구다. 당시 응급실 상황과 인과관계가 쟁점이다.','검사 결과 통지가 늦어 적절한 치료 시기를 놓쳤다는 주장이다. 기록의 작성 시점을 확인해야 한다.'],docs:['의무기록·설명 동의서','전문가 감정의견','진료 시간표·검사 결과'],questions:['당시 설명·처치 수준 확인','결과와 조치 사이 인과관계 검토','의료 감정의 한계 확인']},
 {key:'bribe',tag:'형사·부패',icon:'🏛️',legal:'직무관련성·대가관계',importance:5,kind:'criminal',titles:['입찰 전날의 고액 송금','고위 공직자의 가족 계좌','정책 자문료를 둘러싼 의혹'],premises:['공공사업 결정 전후 고액의 돈이 오간 사실이 확인됐다. 피고인은 정당한 자문료라고 주장한다.','공직자 가족과 기업 사이 거래가 수사 대상이 됐다. 직무 관련성 여부가 다투어진다.','특정 업체의 입찰 참여에 도움을 줬다는 혐의다. 금품과 직무행위의 연결성이 쟁점이다.'],docs:['입찰 관련 내부 문건','계좌·계약서·세금계산서','관련자 통화 내역'],questions:['금전 지급 시점과 직무행위 비교','자문·계약 이행 여부 확인','진술 간 대가관계 주장 대조']},
 {key:'accident',tag:'형사·교통',icon:'🚗',legal:'주의의무·사고 경위',importance:2,kind:'criminal',titles:['교차로의 마지막 신호','비 오는 날의 뺑소니 의혹','어두운 골목에서의 교통사고'],premises:['교차로 사고로 보행자가 다쳤다. 차량 운전자는 신호를 지켰다고 주장한다.','사고 후 현장을 떠난 사실은 인정하지만 충돌을 몰랐다는 입장이다.','야간 교통사고의 시야와 제동 거리, 보행자의 이동 경로가 다투어진다.'],docs:['교통 CCTV와 블랙박스','차량 감정·현장 사진','신호 체계와 피해 진단'],questions:['사고 시각별 신호 확인','운전자 시야와 제동 가능 거리 검토','사고 인식 여부와 행동 대조']},
 {key:'contract',tag:'민사·계약',icon:'📄',legal:'계약 불이행·손해배상',importance:2,kind:'civil',titles:['납품 하루 전 취소된 계약','설계 변경으로 미뤄진 준공','계약 해제 통보와 위약금'],premises:['납품 일정을 지키지 못해 손해가 발생했다는 청구다. 양측은 납기 변경 합의가 있었는지 다툰다.','공사 도중 설계가 변경되며 공기가 늦어졌다. 추가 비용 부담이 쟁점이다.','한쪽 당사자가 계약을 해제하고 위약금을 청구했다. 계약 위반의 중대성과 통지 시점이 문제 됐다.'],docs:['계약서·변경 합의서','이행 일정과 이메일','손해산정 자료'],questions:['이행 기한과 변경 합의 확인','계약 위반 사유의 귀책 검토','청구 손해액과 인과관계 대조']},
 {key:'harassment',tag:'민사·직장',icon:'🏢',legal:'직장 내 괴롭힘·손해',importance:3,kind:'civil',titles:['사내 단체대화방의 지시','전보 뒤 제기된 괴롭힘 주장','퇴직 사유를 둘러싼 분쟁'],premises:['직원이 반복적인 모욕과 부당한 지시로 피해를 입었다고 주장한다. 회사는 업무상 지도였다고 반박한다.','전보 이후 업무 배제가 있었다는 손해배상 청구가 제기됐다. 인사 조치 이유와 실제 업무 배분이 쟁점이다.','퇴직 과정에서 강압이 있었다는 주장이다. 면담 기록과 동료 진술이 엇갈린다.'],docs:['업무 메신저·메일','인사·근태 기록','동료 진술·상담 기록'],questions:['업무상 지시 범위와 반복성 검토','대화 원문과 전후 상황 확인','실제 불이익과 손해 범위 확인']},
 {key:'fire',tag:'형사·방화',icon:'🔥',legal:'방화 고의·발화 원인',importance:4,kind:'criminal',titles:['새벽 창고의 화재','폐업 직전 발생한 점포 화재','보험금 청구 전날의 불'],premises:['건물 화재의 발화 지점 근처에서 피고인의 흔적이 발견됐다. 피고인은 우연한 방문이었다고 주장한다.','사업 종료를 앞두고 점포에 불이 났다. 방화와 전기적 발화 가능성이 다투어진다.','화재 보험 가입 후 얼마 지나지 않아 큰 화재가 발생했다. 범행 고의와 사고 가능성을 구분해야 한다.'],docs:['소방 화재조사서','보험계약·사업 재정자료','출입 CCTV와 이동 기록'],questions:['발화 원인 감정의 한계 확인','출입 시각과 현장 동선 검토','재정 동기와 실제 행동을 구분']},
 {key:'construction',tag:'민사·건설',icon:'🏗️',legal:'하자보수·계약책임',importance:3,kind:'civil',titles:['준공 후 발견된 균열','공사비 정산에서 빠진 항목','신축 상가의 누수'],premises:['입주 후 하자가 발견됐다. 시공사는 관리상 문제라며 책임을 부인한다.','완공된 공사의 추가 비용을 둘러싼 분쟁이다. 추가 공사 지시의 존재가 쟁점이다.','신축 건물에서 반복적인 누수가 생겼다. 하자 원인과 보수 범위가 다투어진다.'],docs:['도급계약과 공사 일지','현장 감정서와 사진','하자보수 요청·답신'],questions:['하자 발생 시기 확인','공사 시공 범위와 변경 지시 검토','보수 비용과 원인 관계 확인']},
 {key:'privacy',tag:'형사·정보범죄',icon:'🔐',legal:'정보 접근 권한·고의',importance:3,kind:'criminal',titles:['퇴사 후 유출된 고객 명단','비공개 자료에 접근한 직원','유명인의 연락처를 판매한 혐의'],premises:['내부 자료가 외부에 전달됐다. 피고인은 정상적인 업무 인수인계였다고 주장한다.','접근 권한이 제한된 자료를 열람한 흔적이 확인됐다. 권한과 사용 목적이 쟁점이다.','민감한 고객 정보가 제3자에게 전달됐다. 전송 주체와 고의가 다투어진다.'],docs:['접근 로그와 다운로드 이력','내부 정보보안 규정','전달 내역·계정 사용자 기록'],questions:['접근 권한의 범위 확인','접속 계정과 실제 사용자 구분','전송 경로와 목적 검토']}
];
function choose(a){return a[Math.floor(rand()*a.length)]}
/* Legacy contacts retire or die over a long career; fall back to the living legal roster, then to a new hire. */
const alive=id=>NPC[id]&&NPC[id].alive!==false;
function livePool(ids,role,label,serial){const live=ids.filter(alive);if(live.length)return live;
 const roster=(S.legalWorld?.people||[]).filter(id=>alive(id)&&NPC[id].legalCareer?.role===role);if(roster.length)return roster;
 return [freshNPC(label,serial,'law')]}
function freshNPC(role,caseSerial,category){
 const id=`person_${caseSerial}_${Math.floor(rand()*1e8)}`,gender=rand()<.5?'여':'남';
 const bornYear=year()-(23+Math.floor(rand()*46));
 const origin=choose(UPBRINGINGS),education=choose(EDUCATIONS),family=choose(['외동','형제 1명','남매 2명','형제자매 3명']);
 const responsibility=Math.round(22+rand()*75),risk=Math.round(12+rand()*80),conflict=Math.round(20+rand()*65);
 const economy=origin.includes('사업 실패')?15+Math.floor(rand()*47):10+Math.floor(rand()*87);
 const data={name:VerdictNames.make({gender,bornYear,rand,people:NPC}),role,ageAtStart:year()-bornYear,bornYear,
  gender,hair:Math.floor(rand()*5),skin:Math.floor(rand()*3),suit:Math.floor(rand()*6),
  personality:choose(TEMPERAMENTS),origin,education,relationships:choose(RELATION_STYLES),
  career:role.includes('변호')?'변호사':role.includes('수사')?'경찰관':category==='celebrity'?(rand()<.5?'연예기획사 관계자':'연예인'):category==='bribe'?'공직·정책 관련 종사자':category==='medical'?'의료기관 종사자':category==='construction'?'건설업 종사자':category==='embezzle'?'법인·단체 회계 관련자':choose(PROFESSIONS),family,
  mbti:choose(['ISTJ','ISFP','ENFP','ESTJ','INFJ','INTP','ESFJ','ENTJ']),blood:choose(['A','B','AB','O']),
  responsibility,riskTolerance:risk,conflictStyle:conflict,wealth:economy,proficiency:Math.floor(35+rand()*62),
  parents:choose(['부모와 자주 연락','부모와 장기간 소원','한부모 가정 출신','부모 모두 생존, 왕래 드묾']),
  friendships:choose(['소수의 오래된 친구','직장 동료 중심','다양한 인적 관계','사교 관계가 제한적']),
  bond:'사건 기록으로 처음 연결됨',
  socialStatus:role.includes('수사')?'수사기관':role.includes('변호')?'법조계':role.includes('검사')?'검찰':choose(['일반 시민','기업 종사자','지역사회 구성원','전문직·공직','문화·연예계'],),
  schedule:role.includes('수사')?'사건 수사와 당직 일정':role.includes('변호')?'법정·사무실 출근 일정':'평일 직장 또는 개인 영업 일정',
  goals:[choose(['경제적 안정','가족과의 관계 회복','커리어 발전','사회적 평판 유지']),choose(['분쟁의 조기 해결','자기 판단의 정당성 인정','불확실성 감소','생활 유지'])],
  reputation:Math.round(15+rand()*65),debts:Math.max(0,Math.round((65-economy)*rand())),
  socialNetwork:[],historyEvents:[]};
 LifeJustice.enrich(data,rand,year());
 if(window.VerdictAvatars){
  const assigned=new Set(Object.values(S.npcDB||{}).map(p=>p.avatarSeedId).filter(Boolean));
  data.avatarSeedId=window.VerdictAvatars.assignNew(id,data,year()-bornYear,assigned).id;
 }
 NPC[id]=data;S.npcDB[id]=data;S.relations[id]=15+Math.floor(rand()*20);S.memories[id]=[];return id;
}
function remember(id,type,body,caseId){
 if(!id||!NPC[id])return;
 S.memories[id]??=[];
 if(!S.memories[id].some(m=>m.caseId===caseId&&m.type===type&&m.body===body))S.memories[id].push({week:S.week,type,body,caseId});
}
function getPriorByKey(key){return completed().filter(c=>c.story?.deep?.key===key||(!c.story?.deep&&c.legal===key)).slice(-8).at(-1)}
function createGeneratedCase(selectedCandidate=null){
 if(age()>=75||openCases().length>=12)return null;
 const serial=++S.caseSerial;
 const candidate=selectedCandidate||(CasePackEngine.pool(S).length&&(window.VerdictCurated?.active||rand()<.82)?CasePackEngine.choose(S,rand):null);
 const bp=candidate?CasePackEngine.blueprint(candidate.pack,candidate.a):choose(CASE_BLUEPRINTS);
 const i=Math.floor(rand()*bp.premises.length), loc=choose(LOCATIONS);
 // Recurrence is a genuinely NEW incident, involving a previously tried individual.
 // Conviction/acquittal does not imply guilt in the new matter.
 const previous=completed().filter(c=>c.kind==='criminal'&&c.generated&&c.who?.[0]
   &&NPC[c.who[0]]?.alive!==false
   &&LifeJustice.isFree(NPC[c.who[0]],S.week)
   &&year()-(NPC[c.who[0]].bornYear||year())<83
   &&S.week-(S.cases[c.id]?.closedWeek||0)>(S.cases[c.id]?.verdict==='guilty'?(c.story?.deep?.key==='murder'?624:208):52)).slice(-60);
 const recidivist=bp.kind==='criminal'&&previous.length&&rand()<.18?choose(previous):null;
 const prior=getPriorByKey(bp.key),caseId=`proc-${year()}-${String(serial).padStart(6,'0')}`;
 const lifePool=(S.lifeTriggers||[]).filter(x=>!x.consumed&&NPC[x.id]?.alive!==false&&S.week-x.week>=1&&S.week-x.week<312);
 const appropriate=lifePool.filter(x=>(x.type==='이혼'&&['affair','inherit','contract','defamation'].includes(bp.key))||(x.type==='재산'&&['fraud','rent','contract','embezzle'].includes(bp.key))||(x.type==='직업'&&['harassment','contract','privacy','celebrity'].includes(bp.key)));
 const lifeSeed=appropriate.length&&rand()<.65?choose(appropriate):null;
 const c=StoryEngine.build({caseId,blueprint:bp,instance:i,loc,now:day(),week:S.week,r:rand,
  makeNPC:(role)=>freshNPC(role,serial,bp.key),oldCriminal:recidivist,priorDecision:prior,
  prosecutorPool:livePool(['soo','jun'],'prosecutor','검사',serial),counselPool:livePool(['jiyu','seon'],'lawyer','변호사',serial),people:NPC});
 if(lifeSeed){
  lifeSeed.consumed=true;
  c.lifeConnection={npcId:lifeSeed.id,originWeek:lifeSeed.week,type:lifeSeed.type,detail:lifeSeed.change};
  // Background is context, not proof or automatic guilt; keep evidence and the incident immutable.
  c.story.lifeContext=`${NPC[lifeSeed.id].name}의 과거 생활 변화: ${lifeSeed.change}. 이 변화가 현재 사건의 법적 책임을 증명하지는 않습니다.`;
  c.story.lifeRelated=true;
 }
 window.VerdictSex?.fix(c);
 const continuity=ContinuityEngine.audit(c,NPC,S.week,CASES);
 c.continuityAudit=continuity;
 if(!continuity.pass){S.caseSerial--;throw new Error(`사건 연속성 검증 실패: ${continuity.errors.join(', ')}`)};
 if(!c.qa.pass){S.caseSerial--;throw new Error(`사건 스토리 검증 실패: ${c.qa.errors.join(', ')}`)}
 c.contentPack=c.story?.pack?{...c.story.pack}:null;
 CASES.push(c);S.generatedCases.push(c);
 S.cases[caseId]={phase:0,actions:[],clues:[],flags:[],verdict:null,grade:null,closedWeek:null,positions:null,positionHistory:[],review:null};
 c.participantSnapshots=ContinuityEngine.snapshots(c,NPC,S.week);
 for(const id of c.who)remember(id,'새로운 사건',`${caseId} · ${c.name} 사건 당사자로 등장`,caseId);
 if(c.story.investigator)remember(c.story.investigator.detective,'수사 업무',`${caseId} 사건 수사자료 확보`,caseId);
 if(recidivist)remember(c.who[0],'별개 사건',`과거 ${recidivist.id} 재판과 무관하게 새로운 사실관계를 심리함`,caseId);
 if(prior)remember(c.who[0],'참조할 과거 판결',`${prior.id}의 법적 쟁점을 참조하되 구속력·차이점 검토 필요`,caseId);
 const quality=c.story.evidenceDetails.map(e=>`${e.id}:${e.quality}`).join(', ');
 log('사건 배당',c.name,`${caseId} · 고유 사건 · 검증 ${c.qa.checks}항목 통과`);
 news('새 사건 배당',`${c.name} · ${c.legal}`,'법원 접수');
 S.qaLog??=[];S.qaLog.push({id:caseId,week:S.week,pass:c.qa.pass,warnings:c.qa.warnings,proof:c.story.proofClass,evidenceQuality:quality,deepAudit:c.story.deep?.version||null});
 return c;
}
function openCases(){return CASES.filter(c=>c.week<=S.week&&!S.cases[c.id]?.verdict&&!S.cases[c.id]?.referred)}
function age(){return 35+year()-2027-(month()<2?1:0)}
function yearsServed(){return year()-2027}
function currentPost(){
 const y=yearsServed();const p=S.professional;
 if(y>=26&&p>=75)return '상급법원 원로 법관';
 if(y>=19&&p>=70)return '고등법원 부장판사';
 if(y>=12&&p>=62)return '지방법원 부장판사';
 if(y>=6&&p>=54)return '중견 법관';
 return '지방법원 판사';
}
// Life-history engine: deterministic on saved RNG; events persist and may seed new disputes.
function annualNPCLives(){
 LifeJustice.annualLifeTick(S,NPC,year(),S.week,remember,news,rand);
 FamilyEngine.annualTick(S,NPC,year(),S.week,remember,rand);
 const ids=Object.keys(S.npcDB||{}).filter(id=>NPC[id]&&NPC[id].alive!==false&&LifeJustice.isFree(NPC[id],S.week)&&year()-(NPC[id].bornYear||year())<78);
 S.lifeTriggers??=[];
 for(let i=0;i<Math.min(5,ids.length);i++){
  const id=choose(ids),p=NPC[id];if(!p||p.alive===false||p.lastLifeYear===year())continue;
  p.lastLifeYear=year();p.life??={marital:'미혼',career:p.career,wealth:p.wealth,partner:null,children:0};
  const life=p.life,roll=rand();let change='',type='일상';
  if(roll<.18&&life.marital==='미혼'&&year()-(p.bornYear||year())>=24){life.marital='기혼';life.partner='가상 배우자';type='혼인';change='혼인하여 새로운 가족 관계가 형성됨';}
  else if(roll<.29&&life.marital==='기혼'){life.marital='이혼';type='이혼';change='별거와 이혼을 경험하며 가족 관계가 변화함';}
  else if(roll<.42&&life.marital==='기혼'&&life.children<3){life.children++;type='출생';change=`자녀 ${life.children}명과 함께 생활함`;}
  else if(roll<.66){const sector=p.role.includes('수사')?'수사기관':p.role.includes('변호')?'법률서비스':p.role.includes('검사')?'검찰':null;const next=sector||choose(PROFESSIONS);p.career=next;life.career=next;type='직업';change=`근무·직업 환경이 ${next}(으)로 변경됨`;}
  else if(roll<.88){const delta=Math.round((rand()-.52)*28);p.wealth=clamp(p.wealth+delta,0,100);life.wealth=p.wealth;type='재산';change=`경제 상황이 ${delta<0?'악화':'변화'}되어 생활 선택이 달라짐`;}
  else{p.relationships=choose(RELATION_STYLES);type='관계';change='교우관계와 가족 교류 방식에 변화가 생김';}
  const event={week:S.week,id,type,change,wealth:p.wealth,career:p.career,marital:life.marital};
  p.historyEvents??=[];p.historyEvents.push(event);remember(id,'생활 변화',change,'life-'+year()+'-'+id);
  if(['이혼','재산','직업'].includes(type)&&rand()<.38){S.lifeTriggers.push({...event,consumed:false});}
  if(rand()<.06)news('인물 근황',`${p.name}: ${change}`,'지역 소식');
 }
}
function makeAnnualEvent(){
 const y=yearsServed();if(y<1||S.milestones.includes(y))return;
 S.milestones.push(y);annualNPCLives();
 const post=currentPost(),oldPost=S.post||'지방법원 판사';S.post=post;
 if(oldPost!==post){message('senior',`${y}년 차 인사에서 보직이 바뀌었군요. 축하합니다. 새로운 책임도 따를 겁니다.`);news('법원 정기 인사 발표',`${S.name||'한 법관'}의 직책이 ${post}(으)로 변경됐다.`);}
 const title=y%5===0?`${y}년 차 커리어 정리`:'연례 법관 경력 기록';
 log('커리어',title,`${post} · 법조 경력 ${y}년 · 누적 판결 ${completed().length}건`);
 if(y%5===0)message('hyun',`벌써 ${y}년이 흘렀네. 첫 발령이 엊그제 같은데. 예전에 내렸던 판결들 기억나?`);
 if(y%2===0){const id=choose(Object.keys(WORLD_ROSTER)),p=NPC[id];remember(id,'사회 경력',`${year()}년 · ${p.career} 직무 관련 활동 지속`,'world-'+year());news('가상 사회',`${p.name}(${p.career})의 주요 사회 활동 소식이 전해졌다.`,'사회 소식');}
 if(y%3===0){const x=choose(['hyun','senior','jiyu','seon','soo','jun','reporter'].filter(alive));modifyRel(x,rand()<.5?-2:2);remember(x,'커리어',`${y}년 차 인사·사회 변화 속 관계 재정립`,'career-'+y)}
 // 항소·재심은 연차별 무작위가 아니라 사건별 제출·심리 기한으로 관리합니다.
}
function moveOldCasesToOtherCourt(){
 for(const c of CASES){
  const st=S.cases[c.id];if(!st||st.verdict||st.referred||c.week>S.week)continue;
  const old=S.week-c.week;
  if(old>=((st.phase||0)>0?52:20)){
   st.referred=true;st.referredWeek=S.week;
   log('사건 배당 변경',`${c.name} · 다른 재판부 진행`,
      `이 사건은 오래 심리하지 않아 다른 재판부로 배당되었습니다. 같은 사건은 재접수되지 않습니다.`);
   if(c.who?.[0])remember(c.who[0],'사건 경과',`${c.id} 사건이 다른 재판부에서 진행됨`,c.id);
  }
 }
}
function ensureGeneratedCases(){
 if(S.realtimeInbox?.enabled)return;
 moveOldCasesToOtherCourt();
 // Fixed introductory 6 cases coexist with unlimited-by-count, bounded-by-variety procedural cases.
 if(S.week<14||age()>=75)return;
 if(openCases().length>=4)return;
 if(!S.realtimeInbox?.enabled&&S.week>=S.nextCaseWeek){createGeneratedCase();S.nextCaseWeek=S.week+6+Math.floor(rand()*5);}
}
function finalizeCareer(){if(S.ended)return;
 S.ended=true;const count=completed().length;log('은퇴','75세 · 법관 커리어 종료',`총 ${count}건 판결 · 최종 직위 ${currentPost()} · 판결은 기록으로 남습니다.`);
 news('한 법조인의 40년',`${S.name||'법관'}이 75세를 맞아 커리어를 마무리했다. 판결과 인연의 기록이 남았다.`);}
function worldTick(){
 if(age()>=75){finalizeCareer();return;}
 ensureGeneratedCases();
 if(year()!==S.lastYear){S.lastYear=year();makeAnnualEvent();}
 // Once every 9 months, background court decisions also occur without player involvement.
 if(S.week>0&&S.week%39===0){let b=choose(CASE_BLUEPRINTS),title=`${choose(JURISDICTIONS)} 지역 다른 재판부 · ${b.titles[Math.floor(rand()*b.titles.length)]}`;
   news('다른 법원의 판결 소식',`${title}. 게임 세계의 다른 법원에서도 사건이 진행 중이다.`,'사법 동향');}
}

const START=new Date(Date.UTC(2027,2,1));
// Every new career gets its own world: cases, people and their lives start from a random seed.
const freshSeed=()=>{try{const a=new Uint32Array(1);crypto.getRandomValues(a);return (a[0]>>>0)||37519}catch{return (Date.now()^Math.floor(Math.random()*4294967296))>>>0||37519}};
const newState=()=>({version:5,casePacks:[],removedPackIds:[],lifeTriggers:[],qaLog:[],generatedCases:[],npcDB:{},memories:{},caseSerial:0,nextCaseWeek:14,lastYear:2027,post:'지방법원 판사',milestones:[],ended:false,name:'',style:0,week:0,actions:0,cash:1250,salary:340,notes:'',owned:[],equipped:{},romance:{person:null,stage:'single',lastYear:-1},market:Object.fromEntries(SECTORS.map(x=>[x.id,100])),holdings:{},traded:-1,rng:freshSeed(),relations:{hyun:66,senior:48,jiyu:39,seon:32,soo:39,jun:35,reporter:25,tenant:20,owner:18,builder:20,actor:10,singer:10,ceo:10},professional:50,publicity:12,cases:Object.fromEntries(CASES.map(c=>[c.id,{phase:0,actions:[],clues:[],flags:[],verdict:null,grade:null,closedWeek:null}])),journal:[{week:0,type:'커리어',title:'신임 판사 발령',body:'법조인으로서 첫 커리어가 시작되었습니다.'}],news:[{week:0,title:'신임 법관 인사 발령 발표',body:'전국 각급 법원에서 신임 법관이 새로운 업무를 시작했다.',category:'법조일보'}],msgs:[{week:0,from:'hyun',body:'첫 발령 축하해! 서로 잘 버텨보자. 시간 나면 연락해.'}],events:[]});
let S;
try{
 const loaded=VerdictStore.read(KEY);
 S=loaded?.cases&&loaded?.market&&([1,2,3,4,5].includes(loaded.version))?loaded:newState();
}catch{S=newState()}
if(S.version===1){
 S.version=3;S.generatedCases=[];S.npcDB={};S.memories={};S.caseSerial=0;
 S.nextCaseWeek=Math.max(14,S.week+1);S.lastYear=yearFromWeek(S.week);
 S.post='지방법원 판사';S.milestones=[];S.ended=false;
}
function yearFromWeek(w){return new Date(Date.UTC(2027,2,1)+w*604800000).getUTCFullYear()}
for(const [id,profile] of Object.entries(S.npcDB||{}))NPC[id]=profile;
LifeJustice.hydrate(S,NPC);
FamilyEngine.hydrate(S,NPC);
for(const c of S.generatedCases||[]){
 if(!CASES.some(x=>x.id===c.id))CASES.push(c);
 if(!S.cases[c.id])S.cases[c.id]={phase:0,actions:[],clues:[],flags:[],verdict:null,grade:null,closedWeek:null};
}
S.qaLog??=[];S.casePacks??=[];S.removedPackIds??=[];S.lifeTriggers??=[];S.version=5;S.memories??={};S.milestones??=[];S.equipped??={};S.romance??={person:null,stage:'single',lastYear:-1};S.relations.mina??=28;S.relations.taeo??=28;for(const cs of Object.values(S.cases||{})){if(cs.verdict&&cs.review&&cs.review.status!=='재판상 화해로 종결'){cs.review={status:'게임 내 최종 판결 · 즉시 확정',filingDeadline:null};if(cs.precedent)cs.precedent.authority='게임 세계의 확정 판결 기록';}} S.post??='지방법원 판사';S.nextCaseWeek??=14;S.caseSerial??=0;S.ended??=false;

const ui={archiveQuery:'',tab:'home',caseId:'deposit',shopCat:'집',assetTab:'shop',tabletTab:'news',npcId:'hyun',modal:null,lastResult:null};
const money=n=>`${Math.round(n).toLocaleString('ko-KR')}만 원`;
const nice=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:1});
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=(w=S.week)=>{const d=new Date(START.getTime()+w*604800000);return `${d.getUTCFullYear()}.${String(d.getUTCMonth()+1).padStart(2,'0')}.${String(d.getUTCDate()).padStart(2,'0')}`};
const year=(w=S.week)=>new Date(START.getTime()+w*604800000).getUTCFullYear();
const month=(w=S.week)=>new Date(START.getTime()+w*604800000).getUTCMonth();
const actualCases=()=>CASES.filter(c=>c.week<=S.week);
const caseOpen=c=>c.week<=S.week;
const completed=()=>CASES.filter(c=>S.cases[c.id]?.verdict);
const lvl=()=>1+Math.max(0,year()-2027);
const equippedItem=cat=>ITEMS.find(i=>i.id===S.equipped?.[cat]);
const mainResidence=()=>equippedItem('집');
const mainCar=()=>equippedItem('차량');
const officeItems=()=>S.owned.map(id=>ITEMS.find(i=>i.id===id)).filter(i=>i?.cat==='사무실 집기').slice(-4);
const actionMax=()=>4; // no fatigue/comfort stat; housing is lifestyle only
const actionsLeft=()=>Math.max(0,actionMax()-S.actions);
const cap=(str,max=80)=>str.length>max?str.slice(0,max)+'…':str;
const grade=(n)=>n>=80?'탄탄한 판단':n>=55?'다툼의 여지':'법리 검토 필요';
/* Long careers keep every case, but a verdict older than half a year keeps only what the record, the result tab
 * and later cases read. The heavy hearing scripts are dropped so a 40-year save stays well under the browser limit. */
function archiveOld(all){let n=0;for(const c of S.generatedCases||[]){const st=S.cases?.[c.id];if(c.archived||!st?.verdict||st.closedWeek==null||(!all&&st.closedWeek>S.week-26))continue;
 const d=c.story?.deep;if(d)c.story.deep={key:d.key,version:d.version,legalSource:d.legalSource,motivations:d.motivations?{a:{primary:d.motivations.a?.primary},b:{primary:d.motivations.b?.primary}}:undefined,elements:(d.elements||[]).map(e=>({id:e.id,label:e.label}))};
 if(c.story?.evidenceDetails)c.story.evidenceDetails=c.story.evidenceDetails.map(e=>({id:e.id,title:e.title,type:e.type}));
 if(Array.isArray(c.stages))c.stages=c.stages.map(x=>({prompt:x.prompt,actions:[]}));
 delete c.participantSnapshots;
 if(st.trial4){const t=st.trial4;t.log=(t.log||[]).slice(-12)}
 c.archived=true;n++}
 if(n){FamilyEngine.prune(S,NPC);trimPeople()}return n}
// Yearly wealth snapshots are kept for the last five years; events with a reason other than the yearly snapshot stay.
function trimPeople(){const cap=(a,n)=>Array.isArray(a)&&a.length>n?a.slice(-n):a;
 for(const p of Object.values(S.npcDB||{})){if(!p)continue;
  if(p.financialHistory?.length>8){const yearly=p.financialHistory.filter(x=>x.reason==='연도별 재산 상태 기록');const keep=new Set(yearly.slice(-5));p.financialHistory=cap(p.financialHistory.filter(x=>x.reason!=='연도별 재산 상태 기록'||keep.has(x)),12)}
  p.jobHistory=cap(p.jobHistory,8);p.relationshipHistory=cap(p.relationshipHistory,12);p.familyCaseHistory=cap(p.familyCaseHistory,6)}
 for(const id of Object.keys(S.memories||{}))S.memories[id]=cap(S.memories[id],12)}
/* Start over on this slot: stop all writes first, then clear the save, its slot copy and its snapshots. */
/* New game = clean slate on this device (until accounts exist): every save slot, the slot copies, the automatic
 * snapshots in IndexedDB and every other game key are removed, so nothing from an earlier game can come back. */
function wipeGame(){VerdictStore.halt();
 try{const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^(the_verdict|verdict_)/.test(k))keys.push(k)}keys.forEach(k=>localStorage.removeItem(k));localStorage.setItem('verdict_player_active','1')}catch{}
 try{sessionStorage.clear()}catch{}
 const done=()=>location.reload();Promise.race([window.VerdictSnapshots?VerdictSnapshots.clearAll():Promise.resolve(),new Promise(r=>setTimeout(r,3000))]).then(done,done)}
function save(){const build=()=>JSON.stringify({...S,casePacks:(S.casePacks||[]).filter(p=>p.packId!=='starter-diverse-2026')});
 try{archiveOld(false)}catch(e){console.warn('archive',e)}
 VerdictStore.save(KEY,build)}
VerdictStore.onError(()=>{try{archiveOld(true);S.qaLog=(S.qaLog||[]).slice(-50);S.news=(S.news||[]).slice(0,300);localStorage.setItem(KEY,VerdictStore.encode(JSON.stringify({...S,casePacks:(S.casePacks||[]).filter(p=>p.packId!=='starter-diverse-2026')})));toast('저장 공간을 정리해 저장했습니다.')}catch{toast('브라우저 저장 공간이 가득 찼습니다. 설정에서 백업 파일을 저장해주세요.')}});
function log(type,title,body){S.journal.unshift({week:S.week,type,title,body});/* 30년 커리어 전체 보존 */}
function news(title,body,category='법조일보'){S.news.unshift({week:S.week,title,body,category});/* 과거 뉴스 보존 */}
function message(from,body){S.msgs.unshift({week:S.week,from,body});/* 과거 메시지 보존 */}
function modifyRel(id,delta){S.relations[id]=clamp((S.relations[id]||20)+delta,0,100)}
function rand(){let x=S.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;S.rng=x>>>0;return(S.rng>>>0)/4294967296}
function abbr(n){return n>=10000?`${(n/10000).toFixed(1)}억`:nice(n)}
function avatar(id='self',customStyle=null){
 if(window.VerdictAvatars){const person=NPC[id]||NPC.self;const currentAge=id==='self'?age():(person.bornYear?year()-person.bornYear:(person.age||45));const outfit=id==='self'?equippedItem('옷'):null;const coat=outfit?['#3a4e64','#293a53','#354858','#54465a','#5b5c65','#344556','#4d5668','#34383f','#403943','#313f55'][outfit.grade-1]:null;return window.VerdictAvatars.render(id,person,{age:currentAge,coat,hairIndex:customStyle==null?undefined:customStyle,role:/판사/.test(person.role)?'judge':/의사|간호/.test(person.role)?'doctor':'civilian'});}

 const p=NPC[id]||NPC.self;const hair=customStyle??(id==='self'?S.style:p.hair);
 const skins=['#efc5a7','#e7b993','#c58f6a'];const coats=['#314c70','#3b5569','#584656','#b08079','#a0706b','#557c81'];
 const outfit=id==='self'?equippedItem('옷'):null,shoes=id==='self'?equippedItem('구두'):null,watch=id==='self'?equippedItem('시계'):null,bag=id==='self'?equippedItem('가방'):null,acc=id==='self'?equippedItem('액세서리'):null;
 const skin=skins[p.skin%skins.length],coat=outfit?['#3a4e64','#293a53','#354858','#54465a','#5b5c65','#344556','#4d5668','#34383f','#403943','#313f55'][outfit.grade-1]:coats[p.suit%coats.length];const haircolors=['#352d30','#40312e','#3b2b37','#4d3027','#382b2c'];const hc=haircolors[hair%5];
 const haircap=hair===4?`<path d="M17 49 Q8 5 49 9 Q101 4 97 54 L91 75 Q88 54 80 41 L27 42 L22 75Z" fill="${hc}"/>`:
  hair===1?`<path d="M19 51 Q8 21 31 13 Q56 -1 84 17 L97 44 Q78 32 61 28 Q38 39 19 51" fill="${hc}"/>`:
  hair===3?`<path d="M17 49 Q8 23 32 13 Q50 1 68 12 Q89 2 97 45 L88 36 Q68 25 55 38 Q35 30 17 49" fill="${hc}"/>`:
  hair===0?`<path d="M18 48 Q13 9 59 10 Q98 8 94 48 Q77 21 51 35 Q33 22 18 48" fill="${hc}"/>`:
  `<path d="M16 46 Q11 10 50 9 Q96 7 97 46 Q81 31 65 34 Q37 23 16 46" fill="${hc}"/>`;
 const mouth=hair===4?'M48 65q8 7 16 0':'M50 65q6 4 12 0';
 return `<span class="avatar" aria-hidden="true"><svg viewBox="0 0 112 175" xmlns="http://www.w3.org/2000/svg"><ellipse cx="56" cy="170" rx="37" ry="4" fill="#24304a" opacity=".12"/>
 <path d="M39 110 L38 156 L54 156 L57 111Z M59 111 L58 156 L76 156 L74 110Z" fill="#303d4c"/>
 <path d="M35 154 Q35 150 53 153 L57 167 L34 167Z M59 154 Q66 151 77 154 L81 167 L58 167Z" fill="${shoes?(shoes.grade>5?'#5d321f':'#3d3532'):'#2c333a'}"/>
 <path d="M23 112 Q15 82 35 82 L78 82 Q99 84 89 113 L83 116 H29Z" fill="${coat}"/><path d="M46 79 L56 89 L67 79 L73 86 L60 116 H52 L39 86Z" fill="#f9f9f5"/><path d="M56 87l-6 7 6 18 6-18z" fill="${acc?'#9eb8cf':'#c99a5f'}"/><path d="M23 95 Q13 99 18 110 L28 112Z" fill="${skin}"/><path d="M88 96 Q97 101 92 112 L83 111Z" fill="${skin}"/>${watch?`<circle cx="20" cy="108" r="4.2" fill="#d4b567" stroke="#4b5665" stroke-width="1"/>`:""}${bag?`<path d="M84 108 Q111 111 106 143 L84 143Z" fill="${bag.grade>=6?'#513b2d':'#6d5961'}"/><path d="M91 110 Q99 95 105 113" fill="none" stroke="#dcc4a2" stroke-width="3"/>`:""}<rect x="48" y="70" width="16" height="18" rx="7" fill="${skin}"/><ellipse cx="19" cy="53" rx="5" ry="9" fill="${skin}"/><ellipse cx="93" cy="53" rx="5" ry="9" fill="${skin}"/><ellipse cx="56" cy="49" rx="39" ry="37" fill="${skin}"/>${haircap}<path d="M33 51q8-5 16 0M65 51q8-5 16 0" stroke="${hc}" stroke-width="2.2" fill="none" stroke-linecap="round"/><ellipse cx="42" cy="55" rx="2.7" ry="3.4" fill="#283344"/><ellipse cx="72" cy="55" rx="2.7" ry="3.4" fill="#283344"/><circle cx="37" cy="64" r="6" fill="#e99b96" opacity=".25"/><circle cx="78" cy="64" r="6" fill="#e99b96" opacity=".25"/><path d="${mouth}" stroke="#ac6d67" stroke-width="2" fill="none" stroke-linecap="round"/></svg></span>`;
}
function shell(content){
 const nav=[['home','⌂','홈'],['court','⚖','법정'],['people','♟','인맥'],['assets','◈','자산'],['tablet','▦','태블릿']];
 return `<div class="shell"><aside class="sidebar"><div><div class="logo"><span class="logo-mark">⚖</span><div>THE VERDICT<div class="tagline">LIFE OF JUSTICE · LOCAL v0.3</div></div></div></div>
 <div class="sidebar-user">${avatar('self')}<div class="side-profile"><strong>${h(S.name||'신임 판사')}</strong><small>${h(S.post)} · ${age()}세</small></div></div>
 <div><div class="side-label">MY CHAMBERS</div><nav class="nav-stack">${nav.map(([id,i,t])=>`<button class="nav-btn ${ui.tab===id?'active':''}" data-action="tab" data-tab="${id}"><i>${i}</i>${t}</button>`).join('')}</nav></div>
 <div class="side-bottom">⚑ ${h(day())}<br><strong>${age()}세 · WEEK ${S.week+1}</strong> · 심리 여력 ${actionsLeft()}/${actionMax()}<br><span class="xs">이 기기에만 저장 · 싱글플레이</span></div></aside>
 <main class="main"><header class="topbar"><div><div class="eyebrow">THE VERDICT / JUDICIAL LIFE <span class="ver-badge">v${h(window.VERDICT_VERSION||"")}</span></div><div class="xs muted">당신의 판결이 인생이 된다</div></div><div class="top-right"><span class="date-pill">▦ ${h(day())}</span></div></header>${content}</main>
 <nav class="bottom-nav">${nav.map(([id,i,t])=>`<button data-action="tab" data-tab="${id}" class="${ui.tab===id?'active':''}" aria-label="${t}"><span>${i}</span>${t}</button>`).join('')}</nav></div>`;
}
function heading(title,sub=''){return `<div><h1 class="page-title">${h(title)}</h1>${sub?`<div class="muted small">${h(sub)}</div>`:''}</div>`}
function section(title,detail=''){return `<div class="section-title"><h2>${h(title)}</h2>${detail?`<span>${h(detail)}</span>`:''}</div>`}
function chips(c){return `<span class="chip">${h(c.tag)}</span><span class="chip ${c.importance>=4?'red':'gold'}">중요도 ${c.importance}/5</span>`}
function status(c){const st=S.cases[c.id];return st.verdict?'판결 완료':st.referred?'타 재판부 진행':st.phase?'심리 진행':'신규 배당'}
function caseCard(c){const s=S.cases[c.id];return `<div class="case-card"><div class="case-icon">${c.icon}</div><div class="case-info"><div class="eyebrow">${h(c.tag)} · ${h(c.id)}</div><h3>${h(c.name)}</h3><p>${h(c.sub)}</p><div class="case-meta"><span class="chip ${c.importance>3?'red':'gold'}">중요도 ${c.importance}</span><span class="chip">${h(status(c))}</span></div></div><div class="case-side"><button class="btn mini ${s.verdict?'outline':'primary'}" data-action="openCase" data-id="${c.id}">${s.verdict?'기록':'재판 진행'} →</button><small>${s.verdict?day(s.closedWeek):'심리 '+s.phase+'/3'}</small></div></div>`}
function officeScene(){
 const display=officeItems(),home=mainResidence(),car=mainCar(),partner=S.romance.person?NPC[S.romance.person]:null;
 return `<div class="office-scene" aria-label="구매한 집기와 착용 아이템이 표시되는 내 사무실">
 <div class="office-wall"><div class="scene-window"><span>☁</span><span>☀</span></div><div class="scene-nameplate">${h(S.name||'신임 판사')} · ${h(S.post)}</div></div>
 <div class="office-plant"><span>🌿</span></div><div class="office-shelf">${display.map(i=>`<span title="${h(i.name)}">${i.grade>=7?'📚':i.icon}</span>`).join('')||'<span>📚</span><span>🗂️</span>'}</div>
 <div class="office-chair">▤</div><div class="office-person">${avatar('self')}</div><div class="office-desk"><span>📑</span><span>${display.length?display.at(-1).icon:'🖊️'}</span><span>☕</span></div>
 <div class="office-floor"></div><div class="office-overlay"><span>🏠 ${h(home?.name||'현재 기본 숙소')}</span><span>🚘 ${h(car?.name||'개인 차량 없음')}</span>${partner?`<span>♥ ${h(partner.name)} · ${h(({met:'알아가는 중',dating:'연애 중',married:'배우자'})[S.romance.stage]||'지인')}</span>`:''}</div>
 </div>`;
}
function home(){const open=openCases();const mainCase=open[0];const prof=Math.round(clamp(S.professional,0,100));const cr=Math.round(clamp(S.publicity,0,100));
 return `<div class="stack" style="gap:16px">
 ${heading('나의 사무실',`${S.post} · ${age()}세 · 법조 경력 ${yearsServed()}년 · ${day()}`)}
 ${officeScene()}
 <div class="row between" style="flex-wrap:wrap;gap:8px"><span class="small muted">소유한 집기와 착용한 옷·가방·시계·구두가 반영됩니다.</span><button class="btn outline mini" data-action="tab" data-tab="assets">사무실·캐릭터 꾸미기 →</button></div>
 <div class="grid four"><div class="stat-card"><label>현재 경력</label><strong>${age()}세</strong><small>${h(S.post)}</small></div><div class="stat-card"><label>보유 현금</label><strong>${abbr(S.cash)}만</strong><small>월 급여 ${money(S.salary)}</small></div><div class="stat-card"><label>법률 전문성</label><strong>${prof}<span class="small"> / 100</span></strong><small>판결과 연구 활동으로 성장</small></div><div class="stat-card"><label>진행 중 사건</label><strong>${open.length}건</strong><small>완료 ${completed().length}건</small></div></div>
 <div class="weekly-banner"><div><strong>◷ 가상 시간 · ${age()}세 / 75세</strong><p>심리 기회 ${actionsLeft()}/${actionMax()} · 미완료 사건 ${open.length}건 · 새로운 사건은 계속 생성</p><div class="mini-track">${Array.from({length:actionMax()},(_,i)=>`<span class="${i<actionsLeft()?'on':''}"></span>`).join('')}</div></div><div class="time-controls"><button class="btn primary" data-action="nextWeek" ${S.ended?'disabled':''}>+1주</button><button class="btn outline" data-action="skip" data-n="4" ${S.ended?'disabled':''}>+4주</button><button class="btn outline" data-action="skip" data-n="13" ${S.ended?'disabled':''}>다음 사건까지</button></div></div>
 ${WEEK_EVENTS[S.week]&&!S.events.includes(WEEK_EVENTS[S.week].id)?`<div class="panel row between"><div><div class="eyebrow">RELATIONSHIP EVENT</div><strong>${h(WEEK_EVENTS[S.week].title)}</strong><div class="small muted">인물과의 관계에 영향을 주는 이벤트</div></div><button class="btn gold mini" data-action="event">확인</button></div>`:''}
 ${section('나의 사건함',`미완료 ${open.length}건`)}<div class="case-list">${open.length?open.slice(0,3).map(caseCard).join(''):'<div class="panel"><b>현재 진행 중인 재판이 없습니다.</b><p class="muted small">다음 주로 이동하면 새 사건이 배당될 수 있습니다.</p></div>'}</div>
 <div class="grid two"><div class="panel"><div class="row between"><b>📰 오늘의 뉴스</b><button class="btn ghost mini" data-action="tablet" data-sub="news">더 보기</button></div>${S.news.slice(0,2).map(n=>`<div class="news-card"><div class="news-icon">▤</div><div><b>${h(n.title)}</b><p>${h(day(n.week))} · ${h(n.category)}</p></div></div>`).join('')}</div>
 <div class="panel"><div class="row between"><b>👥 가까운 사람</b><button class="btn ghost mini" data-action="tab" data-tab="people">관계 보기</button></div>${Object.entries(S.relations).filter(([id])=>['hyun','senior','jiyu'].includes(id)).map(([id,v])=>`<div class="row mt">${avatar(id)}<div style="flex:1"><b class="small">${NPC[id].name}</b><div class="xs muted">${NPC[id].role} · 신뢰 ${v}</div><div class="bar"><span style="width:${v}%"></span></div></div></div>`).join('')}</div></div>
 <div class="notice">인과관계 기반 사건 엔진 v0.4 · 총 접수 ${CASES.length}건 · 생성 ${S.generatedCases.length}건 · 중복 재생성 없음. 자유 입력·실시간 AI API·멀티플레이 없음. 기록은 이 기기에만 저장됩니다.</div>
 </div>`;
}
function casesPage(){const available=openCases().sort((a,b)=>b.importance-a.importance||a.week-b.week);const locked=CASES.filter(c=>c.week>S.week);return `${heading('사건 배당함','접수된 사건을 확인하고 이번 주 심리할 사건을 선택하세요.')}
 <div class="grid three mt2"><div class="stat-card"><label>미완료 사건</label><strong>${available.length}건</strong></div><div class="stat-card"><label>완료 사건</label><strong>${completed().length}건</strong></div><div class="stat-card"><label>금주 심리 여력</label><strong>${actionsLeft()}/${actionMax()}</strong></div></div>
 ${section('진행 중인 사건','모든 판결 완료 사건은 태블릿에서 열람')}<div class="case-list">${available.length?available.map(caseCard).join(''):'<div class="panel">배당된 사건이 없습니다. 시간을 진행해 보세요.</div>'}</div>
`}
function court(){const available=openCases();let c=CASES.find(x=>x.id===ui.caseId&&caseOpen(x)&&!S.cases[x.id]?.referred);if(!c)c=available[0];if(!c)return `${heading('법정','아직 배당된 사건이 없습니다.')}`;ui.caseId=c.id;const st=S.cases[c.id];const left=actionsLeft();const last=st.actions.at(-1);const p=st.phase;
 let body=st.verdict?resultCase(c):`<div class="panel"><div class="row between"><div class="eyebrow">COURT RECORD / ${h(c.tag)}</div><span class="chip">심리 ${p}/3</span></div>
 <div class="court-backdrop" aria-label="미니어처 법정 장면"><div class="judge-stand">${avatar('self')}<div class="judge-bench">⚖</div></div><div class="side-stand left">${avatar(c.side[0])}<label>${c.tag.includes('형사')?'검사':'원고 측'}</label></div><div class="side-stand right">${avatar(c.side[1])}<label>피고 측</label></div></div>
 <div class="progress-rail">${[0,1,2,3].map(i=>`<span class="${p>=i?'done':''}"></span>`).join('')}</div><p class="court-brief">${h(c.intro)}</p>${c.contentWarning?`<div class="notice">${h(c.contentWarning)} · 실제 증거의 입증 범위를 중심으로 진행</div>`:''}${c.relatedCaseId?`<div class="notice">연관 인물의 별개 사건: ${h(c.relatedCaseId)} · 이전 유무죄로 이번 혐의를 판단하지 않습니다.</div>`:''}${c.precedentId?`<div class="notice">📚 유사 법률 쟁점의 과거 판결: ${h(c.precedentId)} · 기록 참고 가능 (구속력 자동 발생 아님)</div>`:''}
 ${c.story?`<details class="case-dossier"><summary>📋 사건 구성·수사·변호 정보 자세히 보기</summary><div class="dossier-content"><p><b>인물 관계</b> · ${h(c.story.relation)}</p>${c.story.lifeContext?`<p><b>과거 인생 기록</b> · ${h(c.story.lifeContext)}</p>`:''}<p><b>사건 경과</b> · ${h(c.story.arc.begin)} ${h(c.story.arc.development)} ${h(c.story.arc.trial)}</p><p><b>청구·공소 쟁점</b> · ${h(c.story.publicDossier.plea)}</p><p><b>핵심 쟁점</b> · ${h(c.story.publicDossier.issues.join(' / '))}</p><p><b>법률 대리</b> · ${h(NPC[c.side[0]]?.name)} (${c.story.lawyerA.years}년 차, ${h(c.story.lawyerA.funding)}) / ${h(NPC[c.side[1]]?.name)} (${c.story.lawyerB.years}년 차, ${h(c.story.lawyerB.funding)})</p>${c.story.investigator?`<p><b>담당 수사팀</b> · ${h(c.story.investigator.name)} · ${h(c.story.publicDossier.investigators.summary)}</p>`:''}<p><b>관계·경제 상황</b> · 당사자의 경제·가족 환경은 협의와 방어 활동에 영향을 줄 수 있으나 유무죄를 정하지 않습니다.</p><p><b>서면 상황</b> · ${h(c.story.publicDossier.situation)}</p>${c.story.deep?`<p><b>적용 법률(참고)</b> · ${h(c.story.deep.legalSource)}. 조문·판례 적용은 사건 발생 당시 기준으로 별도 검증이 필요합니다.</p><p><b>법률 요건</b> · ${c.story.deep.elements.map(x=>h(x.text)).join(' / ')}</p><p><b>주장에 영향을 주는 동기</b> · ${h(c.story.deep.motivations.a.primary)} / ${h(c.story.deep.motivations.b.primary)}</p><p><b>공개되지 않은 실제 진실</b> · 플레이어에게 제공되지 않으며 사건 기록에 고정</p>`:''}</div></details>`:''}
 ${last?`<div class="dialog">${avatar(last.who)}<div class="speech"><strong>${h(NPC[last.who]?.name||'사건 관계인')} · ${h(NPC[last.who]?.role||'관계인')}</strong><p>${h(last.says)}</p></div></div>`:
 `<div class="dialog">${avatar(c.side[0])}<div class="speech"><strong>${c.tag.includes('형사')?'검사':'원고 측 변호사'}</strong><p>"재판장님, 양측의 제출 자료와 주요 주장을 확인해 주십시오."</p></div></div>`}
 <div class="prompt-label">${p<3?h(c.stages[p].prompt):'최종 변론이 마무리되었습니다'}</div>
 ${p<3?c.stages[p].actions.map((a,i)=>`<button class="choice" data-action="courtStep" data-i="${i}" ${left===0?'disabled':''}><span class="choice-index">${i+1}</span><span><strong>${h(a.label)}</strong><small>${h(a.short)}</small></span><span style="margin-left:auto;color:#9badb0">›</span></button>`).join(''):
 `<div class="detail">검토한 증거와 당사자의 주장으로 판결할 수 있습니다. 중요한 자료를 보지 못했을 수 있다는 점도 고려하세요.</div>${c.verdicts.map((v,i)=>`<button class="choice" data-action="verdict" data-choice="${v.id}" ${left===0?'disabled':''}><span class="choice-index">⚖</span><span><strong>${h(v.label)}</strong><small>${h(v.note)}</small></span><span style="margin-left:auto;color:#9badb0">›</span></button>`).join('')}`}
 ${c.story?.deep&&!c.story.criminal&&p>=2&&p<=3?`<button class="btn outline full mt" data-action="proposeSettlement" ${left===0?'disabled':''}>🤝 양측에 화해·조정 의사 확인</button>`:''}
 ${st.positions?`<div class="detail mt"><b>이번 심리로 바뀐 입장</b><br>원고·검찰: ${h(st.positions.claimant)}<br>피고 측: ${h(st.positions.respondent)}</div>`:''}
 ${left===0?'<div class="notice mt">이번 주 심리 여력을 모두 사용했습니다. 다음 주로 진행한 뒤 계속할 수 있습니다.</div>':''}</div>`;
 return `${heading('나의 법정',`${c.name} · 사건 중요도 ${c.importance}/5`)}<div class="row between mt2" style="flex-wrap:wrap"><button class="btn outline mini" data-action="tab" data-tab="courtList">← 사건 선택</button><span class="pill">이번 주 심리 ${left}/${actionMax()}</span></div><div class="grid two court-columns mt"><div>${body}</div><div class="stack"><div class="panel"><div class="row between"><b>📎 증거함</b><span class="chip">${c.evidence.length+st.clues.length}개 항목</span></div><div class="evidence-list mt">${c.evidence.map((e,i)=>{const d=c.story?.evidenceDetails?.[i];return `<div class="evidence"><b>📄 ${h(e)}</b><small>${d?.available?"기본 제출 자료":"현재 자료 미확보"} · 기록 ${i+1}</small>${d?`<details class="evidence-detail"><summary>증거 정보 확인</summary><div class="xs muted">유형: ${h(d.type)} · 출처: ${h(d.origin)}<br>증명 대상: ${h(d.scope)}<br>작성·보존 상태: ${h(d.chain)}<br>${h(d.status)}<br>${h(d.concern)}${d.elementId?`<br>요건 연결: ${h(d.elementId)} · 제출 상태: ${h(d.collectionStatus)} · 신빙성: ${h(d.reliabilityNote)} · 적법성: ${h(d.admissibility)}`:''}</div></details>`:''}</div>`}).join('')}${st.clues.map((e,i)=>`<div class="evidence" style="background:#f0f6f2;border-color:#cfdfd6"><b>✓ ${h(e)}</b><small>내가 확인한 심리 결과 ${i+1}</small></div>`).join('')}</div></div>
 <div class="panel"><b>👤 사건 관계인</b><div class="grid two mt">${[...c.side,...c.who].filter((x,i,a)=>a.indexOf(x)===i).map(id=>`<div class="row" style="gap:5px">${avatar(id)}<div><b class="small">${h(NPC[id].name)}</b><div class="xs muted">${h(NPC[id].role)}</div></div></div>`).join('')}</div></div>
 <div class="panel"><b>📔 심리 기록</b>${st.actions.length?`<div class="timeline mt">${st.actions.map((a,i)=>`<div class="timeline-item"><small>심리 ${i+1}</small><b>${h(a.label)}</b><p>${h(a.says)}</p></div>`).join('')}</div>`:'<p class="muted small">진행한 심문이 여기에 기록됩니다.</p>'}</div>
 <div class="notice">현실적 법적 쟁점에서 착안한 **완전한 가상 사건**입니다. 재판 절차는 게임 속도에 맞춰 단순화했습니다.</div></div></div>`;
}
function resultCase(c){const st=S.cases[c.id];const v=c.verdicts.find(v=>v.id===st.verdict)|| (st.verdict==='settled'?{label:'재판상 화해 성립',note:'양측의 동의에 따른 분쟁 종결'}:null);return `<div class="panel"><div class="result-head"><div class="eyebrow gold-text">JUDGMENT DELIVERED · ${day(st.closedWeek)}</div><h2>⚖ ${h(v?.label||'판결')}</h2><div class="small" style="color:#d5e7e8">${h(c.outcome)}</div></div><div class="grid two mt"><div class="stat-card"><label>법리 평가</label><strong>${st.grade}/100</strong><small>${grade(st.grade)}</small></div><div class="stat-card"><label>조사한 쟁점</label><strong>${st.clues.length}건</strong><small>선택한 심리 기록</small></div></div><div class="result-note"><b>판결 해설</b><br>${h(st.judgementAnalysis||c.ideal)}<br><br><b>나의 선택:</b> ${h(v?.label||'')}<br><b>사건 처리:</b> ${h(st.review?.status||'최종 판결')}<br><b>참고:</b> 다른 결론에도 합리적인 설명이 있을 수 있으며, 이 평가는 가상 사건용 게임 평가입니다.</div><div class="row mt" style="flex-wrap:wrap"><button class="btn primary" data-action="tab" data-tab="cases">다른 사건 보기 →</button><button class="btn outline" data-action="tablet" data-sub="archives">판결 기록</button></div></div>`}
function people(){const contacts=['hyun','senior','jiyu','seon','soo','jun','reporter','actor',...Object.keys(WORLD_ROSTER)];const ordered=contacts.sort((a,b)=>(S.relations[b]||0)-(S.relations[a]||0));const p=NPC[ui.npcId]||NPC.hyun;const rel=S.relations[ui.npcId]||0;
 return `${heading('인간관계 네트워크','관계는 판결의 정답을 바꾸지 않지만, 당신의 커리어와 이야기를 바꿉니다.')}
 <div class="grid two mt2"><div class="panel"><div class="eyebrow">SOCIAL PYRAMID</div><h3 style="margin:6px 0 15px">법조계와 사회의 관계망</h3>
 <div class="stack" style="gap:6px;align-items:center">${[['국가 최고위층','대법관 · 장관 · 정치인',50,'#344b68'],['사법·법조 핵심','법원장 · 고위 법조인',65,'#47637c'],['전문직 네트워크','판사 · 검사 · 변호사',80,'#637f91'],['가까운 인연','동기 · 선배 · 대학 친구',92,'#7c9ca1'],['시민·언론·사회','사건 당사자 · 기자',100,'#91a9aa']].map(([name,d,w,c])=>`<div style="width:${w}%;background:${c};border-radius:8px;padding:11px 5px;text-align:center;color:white"><b class="small">${name}</b><div class="xs" style="opacity:.83">${d}</div></div>`).join('')}</div>
 </div>
 <div class="panel"><div class="row between"><b>관계 인물</b><span class="chip">확인된 관계 ${ordered.length}명</span></div><div class="stack mt" style="gap:8px">${ordered.map(id=>`<button class="npc-card" data-action="npc" data-id="${id}" style="text-align:left;width:100%;${id===ui.npcId?'border-color:#80b5aa;background:#f1f7f3':''}">${avatar(id)}<span style="flex:1"><b>${h(NPC[id].name)}</b><small>${h(NPC[id].role)} · 신뢰 ${S.relations[id]||0}</small><span class="bar" style="display:block;margin-top:6px"><span style="width:${S.relations[id]||0}%"></span></span></span><span>›</span></button>`).join('')}</div></div></div>
 <div class="panel mt2"><div class="row align-start">${avatar(ui.npcId)}<div><div class="eyebrow">NPC DOSSIER</div><h2 style="margin:3px 0">${h(p.name)}</h2><span class="chip">${h(p.role)}</span></div><div style="margin-left:auto;text-align:right"><span class="muted xs">관계 신뢰</span><div class="big-number">${rel}</div></div></div><div class="grid three mt2"><div class="detail"><b>성향</b><br>${h(p.personality||'관찰 중')}</div><div class="detail"><b>성장 환경</b><br>${h(p.origin||'정보 없음')}</div><div class="detail"><b>플레이어와의 인연</b><br>${h(p.bond||'아직 정보 없음')}</div></div><p class="muted small mt">혈액형이나 MBTI만으로 인물의 행동을 정하지 않습니다. 가족·경제·교육·과거 경험과 실제 사건의 맥락이 함께 영향을 줍니다.</p></div>`}
function shop(){const arr=ITEMS.filter(x=>x.cat===ui.shopCat);return `<div class="shop-tabs">${CATEGORIES.map(cat=>`<button class="shop-tab ${ui.shopCat===cat?'active':''}" data-action="category" data-cat="${h(cat)}">${h(cat)}</button>`).join('')}</div>
 <div class="goods-grid mt">${arr.map(x=>`<div class="good-card"><div class="item-visual"><span>${x.icon}</span></div><div class="eyebrow">${h(x.brand)}</div><b>${h(x.name)}</b><small>${h(x.desc)}</small><div class="price">${money(x.price)}</div><button class="btn full ${S.owned.includes(x.id)?'outline':'primary'} mini" data-action="purchase" data-id="${x.id}" ${S.owned.includes(x.id)||S.cash<x.price?'disabled':''}>${S.owned.includes(x.id)?'소유 중':S.cash<x.price?'잔액 부족':'구매하기'}</button></div>`).join('')}</div>`}
function investedValue(){return SECTORS.reduce((sum,x)=>sum+(S.holdings[x.id]||0)*S.market[x.id],0)}
function portfolio(){const invested=investedValue();return `<div class="grid two"><div class="stat-card"><label>보유 섹터 평가액</label><strong>${money(invested)}</strong><small>가상 시장 지수로 평가</small></div><div class="stat-card"><label>주간 거래</label><strong>${S.traded===S.week?'완료':'가능'}</strong><small>1주일에 주문 1회</small></div></div>
 <div class="panel mt"><div class="row between"><b>10개 산업 섹터</b><span class="chip">주간 시장 자동 변동</span></div>${SECTORS.map(x=>{const own=S.holdings[x.id]||0;const v=own*S.market[x.id];return `<div class="sector-row"><span class="sector-icon">${x.icon}</span><div style="flex:1"><b>${x.name}</b><small>지수 ${S.market[x.id].toFixed(1)} · 보유 ${nice(v)}만 원</small></div><span class="small ${S.market[x.id]>=100?'up':'down'}">${S.market[x.id]>=100?'+':''}${(S.market[x.id]-100).toFixed(1)}%</span></div>`}).join('')}</div>
 <div class="panel mt"><b>📈 이번 주 주문</b><p class="small muted">수익률은 가상 세계의 주간 경제 상황을 따라 변합니다. 한 주에 매수 또는 매도 주문을 한 번만 할 수 있습니다.</p><div class="form-grid mt"><div class="control-wrap"><label>투자 섹터</label><select class="control" id="sectorSelect">${SECTORS.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></div><div class="control-wrap"><label>금액 · 만 원</label><input type="number" class="control" id="sectorAmount" min="10" step="10" value="100" inputmode="numeric"></div></div><div class="grid two mt"><button class="btn primary full" data-action="trade" data-side="buy" ${S.traded===S.week?'disabled':''}>선택 섹터 매수</button><button class="btn outline full" data-action="trade" data-side="sell" ${S.traded===S.week?'disabled':''}>선택 섹터 매도</button></div></div>`}
function ownedItems(){return `<div class="panel"><b>나의 소장품 · ${S.owned.length}개</b><p class="muted small">구매한 모든 물품은 커리어 기록에 남습니다.</p>${S.owned.length?`<div class="grid two mt">${S.owned.map(id=>{const x=ITEMS.find(x=>x.id===id);return x?`<div class="npc-card"><div class="item-visual" style="width:60px;height:60px;margin:0;font-size:31px;flex-shrink:0"><span>${x.icon}</span></div><div><b>${h(x.name)}</b><small>${h(x.brand)} · ${money(x.price)}</small></div></div>`:''}).join('')}</div>`:'<div class="empty"><i>🧳</i><strong>아직 구매한 물건이 없습니다.</strong><span class="small">시간이 지나며 나만의 컬렉션을 만들어보세요.</span></div>'}</div>`}
function assets(){const total=S.cash+investedValue();return `${heading('자산과 생활','보조 타이쿤 · 돈보다 중요한 것은 당신의 판결과 선택입니다.')}
 <div class="grid three mt2"><div class="stat-card"><label>총 금융자산</label><strong>${money(total)}</strong><small>현금 + 10개 섹터 평가액</small></div><div class="stat-card"><label>가용 현금</label><strong>${money(S.cash)}</strong><small>월 급여 ${money(S.salary)}</small></div><div class="stat-card"><label>생활 편의</label><strong>${comfort()}/3</strong><small>2 이상이면 주간 심리 여력 +1</small></div></div>
 <div class="shop-tabs mt2">${[['shop','🛍 쇼핑'],['stocks','📈 섹터 투자'],['owned','🗃 소장품']].map(([id,t])=>`<button class="shop-tab ${ui.assetTab===id?'active':''}" data-action="assetTab" data-sub="${id}">${t}</button>`).join('')}</div>
 <div class="mt">${ui.assetTab==='shop'?shop():ui.assetTab==='stocks'?portfolio():ownedItems()}</div><div class="notice mt">쇼핑은 8개 분야로 제한됩니다. 고가 소비가 무조건 유리하지 않으며, 일부 소비는 주변 NPC의 사회적 인식에도 영향을 줍니다. 시장 거래는 주간 1회로 제한됩니다.</div>`}
const APPS=[['news','📰','뉴스','#6589b3'],['messages','💬','문자','#55ac9c'],['archives','⚖','판결 기록','#c8a266'],['social','＃','SNS','#947fc0'],['notes','📝','메모','#e1b66f'],['photos','🖼','사진첩','#c57f91'],['career','🎖','커리어','#759a9c'],['packs','📚','사건팩','#5389a1'],['backup','💾','백업·공유','#747caa']];
function tablet(){return `${heading('나의 태블릿','문자부터 판결문까지. 법조인으로 살아온 모든 순간이 이곳에 쌓입니다.')}
 <div class="panel mt2" style="background:#e9eee9"><div class="row between"><b>THE VERDICT OS</b><span class="chip">${h(day())}</span></div><p class="muted small" style="margin-bottom:0">보관된 사건 기록 ${completed().length}건 · 메시지 ${S.msgs.length}개 · 뉴스 ${S.news.length}개</p></div>
 <div class="app-grid mt2">${APPS.map(([id,icon,name,color])=>`<button class="app-tile" data-action="tablet" data-sub="${id}"><span class="app-icon" style="background:${color};${ui.tabletTab===id?'outline:3px solid #debd7a;outline-offset:2px':''}">${icon}</span><span>${name}</span></button>`).join('')}</div>
 <div class="panel mt2">${tabletInner()}</div>`}
function tabletInner(){switch(ui.tabletTab){
 case 'news':return `<div class="row between"><h3 class="no-margin">📰 뉴스</h3><span class="chip">${S.news.length}건</span></div><div class="feed-list mt">${S.news.map(n=>`<div class="feed"><div class="feed-label">${h(n.category)} · ${day(n.week)}</div><b>${h(n.title)}</b><p>${h(n.body)}</p></div>`).join('')}</div>`;
 case 'social':return `<h3 class="no-margin">＃ 시민광장</h3><p class="small muted">가상의 온라인 여론입니다. 실제 법률적 판단과 여론의 방향은 다를 수 있습니다.</p>${S.news.filter(x=>x.category!=='법조일보').length?`<div class="feed-list mt">${S.news.filter(x=>x.category!=='법조일보').map(n=>`<div class="feed"><div class="feed-label">${h(n.category)} · ${day(n.week)}</div><b>${h(n.title)}</b><p>${h(n.body)}</p></div>`).join('')}</div>`:'<div class="empty"><i>＃</i><strong>아직 관심을 끄는 게시글이 없습니다.</strong><span class="small">화제성 있는 판결 이후 커뮤니티 글이 올라올 수 있습니다.</span></div>'}`;
 case 'messages':return `<h3 class="no-margin">💬 문자</h3><div class="feed-list mt">${S.msgs.map(m=>`<div class="feed"><div class="row">${avatar(m.from)}<div><b>${h(NPC[m.from]?.name||'알림')}</b><div class="xs muted">${day(m.week)}</div></div></div><p class="mt">${h(m.body)}</p></div>`).join('')}</div>`;
 case 'archives':{
 const q=ui.archiveQuery.trim().toLowerCase();
 const matched=completed().filter(c=>!q||[c.id,c.name,c.tag,c.legal||'',day(S.cases[c.id].closedWeek)].join(' ').toLowerCase().includes(q)).sort((a,b)=>S.cases[b.id].closedWeek-S.cases[a.id].closedWeek);
 return `<h3 class="no-margin">⚖ 나의 판결·판례 기록</h3><p class="muted small">모든 판결은 다시 접수되지 않고 기록으로 남습니다. 비슷한 새 사건에는 선례로 참조될 수 있어요.</p><div class="form-grid mt"><input id="archiveQuery" class="control" value="${h(ui.archiveQuery)}" placeholder="사건명 · 사건 ID · 법률 쟁점 검색"><button class="btn primary" data-action="archiveSearch">검색</button></div><p class="small muted">검색 결과 ${matched.length}건 · 최근 30건까지 표시</p>${matched.length?`<div class="case-list mt">${matched.slice(0,30).map(caseCard).join('')}</div>`:'<div class="empty"><i>⚖</i><strong>해당하는 판결 기록이 없습니다.</strong></div>'}`;
 }
 case 'notes':return `<h3 class="no-margin">📝 개인 메모</h3><p class="muted small">직접 적은 생각은 자동 저장됩니다. 기기 내에만 저장되므로 백업을 권장합니다.</p><textarea class="control" id="personalNotes" style="min-height:170px;resize:vertical;line-height:1.7" placeholder="잊고 싶지 않은 사건, 인물, 나만의 판단 기준…">${h(S.notes)}</textarea><button class="btn primary mt" data-action="saveNotes">메모 저장</button>`;
 case 'photos':return `<h3 class="no-margin">🖼 사진첩 · 삶의 기록</h3><div class="grid two mt"><div class="good-card"><div class="item-visual"><span>🏛️</span></div><b>첫 발령 기념</b><small>2027.03.01 · 신임 법관</small></div>${S.romance.stage==='married'?`<div class="good-card"><div class="item-visual">💍</div><b>${h(NPC[S.romance.person]?.name||'배우자')}과 결혼</b><small>${day(S.week)} 이전 · 개인 기록</small></div>`:''}${S.owned.map(id=>{const item=ITEMS.find(x=>x.id===id);return item?`<div class="good-card"><div class="item-visual"><span>${item.icon}</span></div><b>${h(item.name)}</b><small>${h(item.brand)} · 구매 기록</small></div>`:''}).join('')}</div>`;
 case 'career':return `<h3 class="no-margin">🎖 35세 → 75세 커리어 · 현재 ${age()}세</h3><p class="muted small">${h(S.post)} · 누적 생성 사건 ${S.generatedCases.length}건 · 최종 엔딩 75세 ${S.ended?'(완료)':''}</p><div class="grid three mt"><div class="stat-card"><label>완료 판결</label><strong>${completed().length}건</strong></div><div class="stat-card"><label>법률 전문성</label><strong>${Math.round(S.professional)}</strong></div><div class="stat-card"><label>사회적 인지도</label><strong>${Math.round(S.publicity)}</strong></div></div><div class="timeline mt2">${S.journal.map(e=>`<div class="timeline-item"><small>${day(e.week)} · ${h(e.type)}</small><b>${h(e.title)}</b><p>${h(e.body)}</p></div>`).join('')}</div>`;
 case 'packs':{
 const stats=CasePackEngine.stats(S),labels={'homicide':'살인·치사·연쇄범죄','sexual':'성범죄·성적 자기결정권','violence':'폭행·상해·스토킹','financial':'사기·횡령·배임','property':'절도·재산·교통·방화','reputation':'명예훼손·디지털·연예','civil':'계약·임대차·손해배상','family':'이혼·양육·상속','professional':'기업·노동·의료','public':'정치·부패·행정·헌법'};
 const list=(S.casePacks||[]).map(p=>`<div class="feed"><div class="row between"><b>${h(p.title)}</b><span class="chip">v${h(p.version)}</span></div><small>${h(p.packId)} · ${(p.archetypes||[]).length}개 원형 · ${p.enabled!==false?'활성':'비활성'}</small><p class="small muted">${h(p.description||'직접 추가한 사건 콘텐츠')}</p><div class="row" style="gap:7px;flex-wrap:wrap"><button class="btn outline mini" data-action="packToggle" data-id="${h(p.packId)}">${p.enabled!==false?'비활성화':'활성화'}</button><button class="btn outline mini" data-action="packExport" data-id="${h(p.packId)}">JSON 저장</button><button class="btn outline mini" data-action="packRemove" data-id="${h(p.packId)}">삭제</button></div></div>`).join('');
 return `<h3 class="no-margin">📚 사건 콘텐츠 라이브러리</h3><p class="small muted">JSON 원형 팩을 추가하면 이후 생성되는 사건에 적용됩니다. 이미 생성·선고된 사건과 NPC 기록은 바뀌지 않습니다.</p>
 <div class="grid two mt"><div class="stat-card"><label>활성 원형</label><strong>${stats.enabled}개</strong></div><div class="stat-card"><label>설치 팩</label><strong>${stats.packs}개</strong></div></div>
 <div class="row mt" style="gap:8px;flex-wrap:wrap"><button class="btn primary mini" data-action="packImport">+ JSON 사건팩 불러오기</button><button class="btn outline mini" data-action="packRefresh">기본 팩 업데이트 확인</button></div><input id="casePackFile" class="hidden" type="file" accept=".json,application/json">
 <div class="notice mt">500개는 최종 제작 목표이며, 현재 설치된 원형 개수와 다릅니다. 사건팩은 판결 정답을 저장하지 않습니다. 브라우저 파일 백업에도 설치된 JSON 팩이 함께 보존됩니다.</div>
 <div class="feed-list mt">${list||'<p class="muted small">아직 설치된 추가 팩이 없습니다. 위 버튼에서 JSON을 가져오세요.</p>'}</div>
 <h4>500개 목표 구성과 현재 활성 수량</h4><div class="detail">${Object.entries(stats.targets).map(([id,target])=>`<div class="row between"><span>${labels[id]}</span><b>${stats.counts[id]} / ${target}</b></div>`).join('')}</div><p class="small muted">기존 기본 생성기(19분야)는 별도로 유지됩니다. 추가 팩이 설치되면 향후 사건의 약 82%에서 활성 JSON 원형을 우선 사용합니다.</p>`;
 }
 case 'backup':return `<h3 class="no-margin">💾 내 기록 백업·복원</h3><p class="small muted">게임 데이터는 오직 이 기기 브라우저에 저장됩니다. 서버 계정이나 친구와의 연결은 없습니다. 앱 데이터 삭제·기기 변경에 대비해 백업 파일을 보관하세요.</p>
 <div class="grid two mt"><button class="btn primary" data-action="export">게임 기록 백업</button><button class="btn outline" data-action="import">기록 불러오기</button></div><input id="importFile" type="file" accept="application/json,.json" class="hidden">
 <hr class="muted-line"><b>이 기기에서 새로 시작하기</b><p class="small muted">두 슬롯의 진행 기록과 자동 저장본까지 이 기기의 게임 기록을 모두 삭제합니다. 필요하면 먼저 백업하세요.</p><button class="btn outline mini" data-action="reset">게임 초기화</button>`;
 default:return `<h3>태블릿 앱을 선택하세요.</h3>`;
 }}

// All gameplay below runs locally. Game states never leave the device.
function people(){
 const ids=Object.keys(NPC).filter(x=>x!=='self').slice(-20);
 const ranks=[['국가 최고위층','대법관 · 장관 · 정치인',50,'#344b68'],['법조 핵심','법원장 · 고위 법조인',65,'#47637c'],['전문직 인맥','판사 · 검사 · 변호사',80,'#637f91'],['가까운 인연','동기 · 선배 · 대학 친구',92,'#7c9ca1'],['시민 · 언론','사건 당사자 · 기자',100,'#91a9aa']];
 return `${heading('인간관계','인물들의 신뢰, 인연, 변화하는 경력이 쌓입니다.')}
 ${romancePanel()}
 <div class="mt2"><div class="panel"><div class="row between"><b>주요 인물</b><span class="chip">${ids.length}명</span></div><div class="stack mt">${ids.map(id=>`<button data-action="npc" data-id="${id}" class="npc-card" style="text-align:left;width:100%;cursor:pointer">${avatar(id)}<span style="flex:1;min-width:0"><b>${h(NPC[id].name)}</b><small>${h(NPC[id].role)} · 신뢰 ${S.relations[id]??20}</small><span class="bar"><span style="width:${S.relations[id]??20}%"></span></span></span><span>›</span></button>`).join('')}</div></div></div>`;
}

/* Romance is hidden for now; it will return later as a natural story event. Data (S.romance) is kept. */
const ROMANCE_ON=false;
function romancePanel(){
 if(!ROMANCE_ON)return '';
 const r=S.romance,person=r.person&&NPC[r.person],stage=r.stage;
 const opts=stage==='single'?`<div class="row" style="flex-wrap:wrap"><button class="btn outline mini" data-action="meetPartner" data-id="mina">서민아와 교류</button><button class="btn outline mini" data-action="meetPartner" data-id="taeo">최태오와 교류</button></div>`:
 stage==='met'?`<button class="btn gold mini" data-action="romanceStep" data-step="dating" ${r.lastYear===year()?'disabled':''}>서로 알아가며 연애 시작</button>`:
 stage==='dating'?`<button class="btn gold mini" data-action="romanceStep" data-step="married" ${r.lastYear===year()?'disabled':''}>결혼에 대한 의견 나누기</button>`:'';
 return `<div class="panel mt2"><div class="row between"><b>♥ 나의 인연</b><span class="chip">${stage==='married'?'결혼':stage==='dating'?'연애':stage==='met'?'알아가는 중':'싱글'}</span></div>
 ${person?`<div class="npc-card mt">${avatar(r.person)}<span><b>${h(person.name)}</b><small>${h(person.career||person.role)} · ${year()-person.bornYear}세</small></span><button class="btn ghost mini" data-action="npc" data-id="${r.person}">기억</button></div>`:`<p class="small muted">연애와 결혼은 선택이에요. 평생 혼자 살아도 커리어 진행에 불이익은 없습니다.</p>`}
 ${stage==='married'?`<p class="small muted">결혼은 사진첩·메시지·커리어 연표에 기록됩니다. 배우자도 자신의 일을 계속합니다.</p>`:`<p class="small muted">관계의 다음 단계는 가상으로 1년 이상 경과한 뒤 선택할 수 있습니다.</p>${opts}`}
 </div>`;
}
function meetPartner(id){if(S.romance.stage!=='single'||!['mina','taeo'].includes(id))return;S.romance={person:id,stage:'met',lastYear:year()};modifyRel(id,12);remember(id,'첫 만남',`${S.name||'판사'}와 개인적인 자리에서 알게 됨`,'personal-'+S.week);log('인간관계',`${NPC[id].name}과 만남`,'서로 알아가기 시작했다.');message(id,'오늘 만나서 반가웠어요. 좋은 하루 보내세요.');save();render();}
function romanceStep(step){let r=S.romance;if(!r.person||r.lastYear>=year())return;const previous=r.stage;if(previous==='met'&&step==='dating'){r.stage='dating';r.lastYear=year();modifyRel(r.person,15);remember(r.person,'연애',`서로의 삶과 일에 대해 더 알아가며 연인이 됨`,'personal-'+S.week);log('인간관계',`${NPC[r.person].name}과 연애 시작`,'일과 별개로 서로의 삶을 존중하며 관계를 이어가기로 했다.');message(r.person,'서로 바쁘더라도 함께할 시간을 만들어보자.');}
 else if(previous==='dating'&&step==='married'){r.stage='married';r.lastYear=year();modifyRel(r.person,10);remember(r.person,'결혼',`${S.name||'판사'}와 결혼`,'personal-'+S.week);log('인생',`${NPC[r.person].name}과 결혼`,'둘이 함께 살아가기로 결정했다.');message(r.person,'우리 앞으로도 서로를 존중하며 살아가자.');news('개인 기록',`${S.name||'한 법관'}의 결혼 소식이 가까운 지인들에게 전해졌다.`,'개인 기록');}
 else return;save();render();toast('관계와 인생 기록에 반영되었습니다.');}

function assetPage(){
 const total=investedValue();
 return `${heading('자산과 소유품','간소한 경제생활. 재판과 커리어가 게임의 중심입니다.')}
 <div class="grid three mt2"><div class="stat-card"><label>보유 현금</label><strong>${money(S.cash)}</strong></div><div class="stat-card"><label>투자자산</label><strong>${money(total)}</strong></div><div class="stat-card"><label>월 급여</label><strong>${money(S.salary)}</strong></div></div>
 <div class="panel mt2"><b>현재 생활·착용</b><p class="small muted">집 ${h(mainResidence()?.name||'기본 숙소')} · 차 ${h(mainCar()?.name||'미보유')}</p><div class="row" style="flex-wrap:wrap">${['옷','시계','가방','액세서리','구두'].map(cat=>`<span class="chip">${cat}: ${h(equippedItem(cat)?.name||'기본')}</span>`).join('')}</div></div>
 <div class="row mt2" style="flex-wrap:wrap"><button class="btn ${ui.assetTab==='shop'?'primary':'outline'}" data-action="assetTab" data-sub="shop">🛍 쇼핑</button><button class="btn ${ui.assetTab==='invest'?'primary':'outline'}" data-action="assetTab" data-sub="invest">📈 섹터 투자</button></div>
 ${ui.assetTab==='invest'?portfolio():shop()}`;
}
function shop(){
 const items=ITEMS.filter(x=>x.cat===ui.shopCat);
 return `${section('물건 고르기','카테고리별 10개 · 1~10등급 가상 브랜드')}<div class="shop-tabs">${CATEGORIES.map(cat=>`<button class="shop-tab ${cat===ui.shopCat?'active':''}" data-action="shopCat" data-cat="${h(cat)}">${h(cat)}</button>`).join('')}</div>
 <div class="goods-grid mt">${items.map(item=>`<div class="good-card"><div class="item-visual"><span>${item.icon}</span></div><b>${h(item.name)}</b><small>${h(item.brand)} · ${h(item.desc)}</small><span class="chip">${item.tier} · ${item.grade}등급</span><div class="price">${money(item.price)}</div>${S.owned.includes(item.id)?`<button class="btn ${S.equipped?.[item.cat]===item.id?'outline':'primary'} full mini" data-action="equip" data-id="${item.id}" ${S.equipped?.[item.cat]===item.id?'disabled':''}>${S.equipped?.[item.cat]===item.id?'사용 중':item.cat==='집'?'거주 설정':item.cat==='차량'?'운행 설정':item.cat==='사무실 집기'?'사무실에 배치':'착용하기'}</button>`:`<button class="btn primary full mini" data-action="buy" data-id="${item.id}" ${S.cash<item.price?'disabled':''}>${S.cash<item.price?'잔고 부족':'구매하기'}</button>`}</div>`).join('')}</div>
 <div class="panel mt2"><b>나의 소유품 · ${S.owned.length}개</b><p class="small muted">물건은 판결 능력을 직접 높이지 않습니다. 집과 차량은 생활 편의, 고가 소비는 주변의 주관적 반응에 영향을 줄 수 있습니다.</p><div class="row" style="flex-wrap:wrap">${S.owned.length?S.owned.map(id=>{const i=ITEMS.find(x=>x.id===id);return i?`<span class="chip">${i.icon} ${h(i.name)}</span>`:''}).join(''):'<span class="muted small">아직 구매한 물건이 없습니다.</span>'}</div></div>`;
}
function investedValue(){return Object.entries(S.holdings||{}).reduce((a,[id,units])=>a+Number(units||0)*(S.market[id]||100),0)}
function portfolio(){
 return `<div class="grid two mt2"><div class="stat-card"><label>보유 섹터 평가액</label><strong>${money(investedValue())}</strong><small>가상 주간 시장</small></div><div class="stat-card"><label>이번 주 거래</label><strong>${S.traded===S.week?'완료':'가능'}</strong><small>주 1회 주문만 가능</small></div></div>
 <div class="panel mt2"><b>10개 산업 섹터</b><p class="small muted">개별 기업이 아닌 섹터 지수에 투자합니다. 게임 속 경제가 매주 움직입니다.</p>${SECTORS.map(x=>{const v=S.market[x.id],u=Number(S.holdings[x.id]||0);return `<div class="sector-row"><div class="sector-icon">${x.icon}</div><div style="flex:1"><b>${x.name}</b><small>지수 ${nice(v)} · 보유 ${money(u*v)}</small></div><span class="${v>=100?'up':'down'}">${v>=100?'+':''}${nice((v-100))}%</span></div>`}).join('')}</div>
 <div class="panel mt"><b>이번 주 주문</b><p class="small muted">일주일에 매수 또는 매도 한 번. 주문 후 다음 주까지 기다려야 합니다.</p><div class="form-grid mt"><div class="control-wrap"><label for="sectorSelect">투자 섹터</label><select id="sectorSelect" class="control">${SECTORS.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></div><div class="control-wrap"><label for="sectorAmount">금액 · 만 원</label><input id="sectorAmount" type="number" class="control" min="10" max="100000" step="10" value="100" inputmode="decimal"></div></div><div class="grid two mt"><button class="btn primary full" data-action="trade" data-side="buy" ${S.traded===S.week?'disabled':''}>매수</button><button class="btn outline full" data-action="trade" data-side="sell" ${S.traded===S.week?'disabled':''}>매도</button></div></div>`;
}
function resultCase(c){
 const st=S.cases[c.id],v=c.verdicts.find(x=>x.id===st.verdict)||c.verdicts[0];
 return `<div class="result-head"><div class="eyebrow" style="color:#cfdfda">판결 선고 · ${h(day(st.closedWeek??S.week))}</div><h2>${h(v.label)}</h2><p>판결 검토 결과: ${grade(st.grade??50)}</p><div class="big-number">${st.grade??0}<span style="font-size:14px"> / 100</span></div></div>
 <div class="result-note"><b>판결 검토 메모</b><p>${h(c.ideal)}</p><p>선택한 판단: ${h(v.note)}</p></div>
 <div class="reaction mt"><strong>📰 판결 후 가상 사회 반응</strong><p>${h(c.name)}에 관한 판결이 알려지며 법조 커뮤니티에서 의견이 나뉘고 있습니다.</p></div>
 <div class="mt"><b>이 사건에서 확인한 내용</b><div class="evidence-list mt">${st.clues.length?st.clues.map(x=>`<div class="evidence">✓ ${h(x)}</div>`).join(''):'<p class="small muted">확인한 단서가 없습니다.</p>'}</div></div>
 <button class="btn outline full mt2" data-action="tab" data-tab="courtList">사건함으로 돌아가기</button>`;
}
function courtList(){return casesPage()}
function render(){
 let page='';switch(ui.tab){case'home':page=home();break;case'courtList':page=courtList();break;case'court':page=court();break;case'people':page=people();break;case'assets':page=assetPage();break;case'tablet':page=tablet();break;default:ui.tab='home';page=home()}
 const root=document.querySelector('#app');if(root)root.innerHTML=shell(page);
 const m=document.querySelector('#modal-root');if(m)m.innerHTML=ui.modal||'';
}
function toast(msg){
 const t=document.querySelector('#toast');if(!t)return;
 t.textContent=msg;t.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('visible'),2900);
}
function changeTab(tab){ui.tab=tab;render();window.scrollTo({top:0,behavior:'instant'})}
function modal(title,body,buttons){
 ui.modal=`<div class="modal-veil" role="presentation"><div class="modal" role="dialog" aria-modal="true"><h2>${h(title)}</h2><div>${body}</div><div class="modal-actions">${buttons||'<button class="btn primary full" data-action="dismiss">확인</button>'}</div></div></div>`;render();
}
function popupNPC(id){const x=NPC[id];if(!x)return;modal(x.name,`<div class="row align-start">${avatar(id)}<div style="flex:1"><b>${h(x.role)}</b><p>${x.bornYear?`${year()-x.bornYear}세 · `:''}신뢰 ${S.relations[id]??20} / 100</p></div></div><div class="detail mt"><b>성향</b><br>${h(x.personality||'조용한 성격')}<br><b>성장 배경</b><br>${h(x.origin||'가상 인물')}<br><b>교육·가족</b><br>${h(x.education||'정보 없음')} · ${h(x.family||'정보 없음')}<br><b>현재 직업</b><br>${h(x.career||'정보 없음')}<br><b>관계 성향</b><br>${h(x.relationships||'정보 없음')}<br><b>나와의 관계</b><br>${h(x.bond||'업무상 인연')}</div><div class="detail mt"><b>개인 생애 정보</b><br>${h(LifeJustice.summary(x,year(),S.week))}<br><b>사법·복역 기록</b><br>${h(LifeJustice.custodySummary(x,S.week))}</div><div class="detail mt"><b>기억 기록 (${(S.memories[id]||[]).length})</b>${(S.memories[id]||[]).slice(-8).reverse().map(m=>`<p>${h(day(m.week))} · ${h(m.type)} · ${h(m.body)}</p>`).join('')||'<p>아직 기록이 없습니다.</p>'}</div>`,null)}
function popupEvent(){const evt=WEEK_EVENTS[S.week];if(!evt||S.events.includes(evt.id))return;
 modal(evt.title,`<div class="row align-start">${avatar(evt.who)}<p>${h(evt.body)}</p></div><div class="mt">${evt.opts.map((o,i)=>`<button class="choice" data-action="eventChoose" data-i="${i}"><span class="choice-index">${i+1}</span><strong>${h(o.t)}</strong></button>`).join('')}</div>`,`<button class="btn outline full" data-action="dismiss">나중에 결정</button>`);
}
function courtStep(index){
 const c=CASES.find(x=>x.id===ui.caseId);if(!c||!caseOpen(c)||S.cases[c.id]?.referred)return;
 const st=S.cases[c.id];if(st.verdict||st.phase>=3||actionsLeft()<1)return;
 const a=c.stages[st.phase].actions[index];if(!a)return;
 const prev=st.actions.at(-1);
 const context=c.story&&prev?` 앞선 심리에서 ${prev.short}을(를) 확인했지만, 이 자료의 입증 범위는 별도로 판단해야 합니다.`:'';
 const spoken=c.story?.deep?DeepCaseEngine.actionResponse(c,a,st):a.says+(context?context:'');
 const applied={...a,says:spoken,week:S.week};
 st.phase++;st.actions.push(applied);st.clues.push(a.clue);st.flags.push(a.flag);S.actions++;
 if(c.story?.deep)DeepCaseEngine.afterAction(c,st,a);
 log('재판',`${c.name} · ${a.short}`,a.clue);
 save();render();toast('심리 내용이 기록되었습니다.');
}
function conclude(id){
 const c=CASES.find(x=>x.id===ui.caseId);if(!c||S.cases[c.id]?.referred)return;
 const st=S.cases[c.id];if(st.verdict||st.phase!==3||actionsLeft()<1)return;
 const v=c.verdicts.find(x=>x.id===id);if(!v)return;
 const evaluated=StoryEngine.evaluate(c,st.actions,v.id);st.verdict=v.id;st.closedWeek=S.week;st.grade=evaluated?.score??Math.min(100,Math.max(10,v.score+(st.flags.length>=3?3:0)));st.judgementAnalysis=evaluated?.why||null;
 S.actions++;window.VerdictCareerBalance.award(S,c.id,st.grade,c.importance,year());
 modifyRel(c.side[0],st.grade>=70?3:-2);modifyRel(c.side[1],st.grade>=70?2:-3);
 const messageText=`${c.name}에서 ${v.label} 판결이 선고됐다. 재판부 판단 요지: ${v.note}.`;
 news(`${c.name} · 최종 선고`,messageText);
 if(c.importance>=4)news(`시민광장 반응: ${c.name}`,`판결 결과를 놓고 네티즌들의 평가가 엇갈리고 있다. 법률적 판단과 대중 여론은 별개라는 목소리도 나온다.`,'시민광장');
 log('판결',c.name,`${v.label} · 검토 점수 ${st.grade}점`);
 for(const npcId of [...new Set([...(c.who||[]),...(c.side||[])])])remember(npcId,'판결',`${c.name} · ${v.label}`,c.id);
 st.precedent={decision:v.label,issue:c.legal||c.tag,week:S.week,authority:'게임 세계의 확정 판결 기록'};
 st.review={status:'게임 내 최종 판결 · 즉시 확정',filingDeadline:null};
 st.finalImpact={week:S.week,judgment:v.id,news:true,relationships:true,sourceCaseId:c.id};
 const lifeConsequence=LifeJustice.applyVerdict(S,NPC,c,st,v,year(),S.week,remember,news);
 st.lifeConsequence=lifeConsequence;
 FamilyEngine.onJudgment(S,NPC,c,st,v,year(),S.week,remember);
 for(const npcId of c.who||[]){const person=NPC[npcId];if(!person)continue;person.caseOutcomes??=[];person.caseOutcomes.push({caseId:c.id,week:S.week,judgment:v.label});}

 if(c.relatedCaseId){
   const past=CASES.find(x=>x.id===c.relatedCaseId);
   if(past)news('연관 사건 기록 재조명',`${NPC[c.who[0]]?.name||'당사자'}의 별개 사건 판결이 내려졌다. 과거 ${past.id}과 다른 사실관계를 토대로 심리했다.`);
 }
 if(c.importance>=4&&rand()<.45)message('reporter',`${c.name} 판결에 대한 시민들의 관심이 큽니다. 공식적으로 공개된 판결 이유를 중심으로 보도하겠습니다.`);

 if(completed().length===3){message('senior','벌써 중요한 재판을 여럿 맡았군요. 근거를 잘 정리하는 습관을 유지하세요.');log('커리어','초임 판사 경험 축적','주요 판결 3건을 완료했습니다.');}
 save();render();toast('판결이 기록되었습니다. 태블릿에서 다시 열람할 수 있습니다.');
}
function proposeSettlement(){
 const c=CASES.find(x=>x.id===ui.caseId);if(!c||!c.story?.deep||S.cases[c.id].verdict)return;
 const st=S.cases[c.id],r=DeepCaseEngine.settle(c,st);
 if(!r.ok){modal('화해·조정 검토',`<p>${h(r.reason)}</p><p>양측의 자발적 의사 없이 법원이 조정을 강제할 수는 없습니다.</p>`);return;}
 st.verdict='settled';st.closedWeek=S.week;st.grade=75;st.judgementAnalysis=`${r.amount.toLocaleString('ko-KR')}만 원 지급에 관한 양측 합의가 성립했습니다. 법원의 본안 판단은 없으며 판례로 등록되지 않습니다.`;
 st.review={status:'재판상 화해로 종결',filingDeadline:null};S.actions++;
 log('화해',c.name,st.judgementAnalysis);news('재판상 화해',`${c.name}: 당사자들이 분쟁을 합의로 마무리했다.`,'법원 접수');
 [...new Set([...(c.who||[]),...(c.side||[])])].forEach(id=>remember(id,'화해',`${c.id} 분쟁은 화해로 종결됨`,c.id));
 save();render();toast('화해가 기록됐습니다.');
}
function processReviews(){/* v0.7: no simulated appeals. A player's verdict is final within this fictional world. */}
function advanceWeek(silent=false){
 if(S.ended)return false;
 if(!silent&&WEEK_EVENTS[S.week]&&!S.events.includes(WEEK_EVENTS[S.week].id)){popupEvent();return false;}
 const oldMonth=month(),oldYear=year(),prev=S.week;
 S.week++;S.actions=0;
 if(month()!==oldMonth){
  S.cash+=S.salary;
  const carCost=(mainCar()?.monthly||0)+(mainResidence()?.monthly||0);
  const living=145+carCost;S.cash-=living;
  if(S.cash<0){S.cash=Math.max(-5000,S.cash);if(S.week%26===0)news('가계 지출 부담',`${S.name||'법관'}의 소득과 지출 균형을 다시 검토할 필요가 있다.`,'개인 기록');}
  if(!silent||S.week%13===0)log('재정',`${day()} 월 급여`,`${money(S.salary)} 지급 · 생활비 ${money(living)} 지출`);
 }
 if(year()!==oldYear){S.salary+=Math.min(26,11+Math.floor(yearsServed()/5));}
 SECTORS.forEach((x,i)=>{
  const cycle=Math.sin(S.week/20+i*.8)*.009;
  const eco=Math.sin(S.week/44)*.006;
  let shock=(S.week%31===0&&i===4)?-.033:0;
  S.market[x.id]=clamp(Math.round(S.market[x.id]*(1+(rand()-.5)*.07*x.beta+cycle+eco+shock)*100)/100,15,950);
 });
 if(S.week%26===0){
  const who=choose(['hyun','senior','jiyu','seon','soo','jun'].filter(alive).concat(['hyun']));
  message(who,`${Math.floor(S.week/52)}년 가까이 법원에서 일하고 있네. 최근 사건은 잘 마무리됐어?`);
  remember(who,'관계','연락을 주고받음','letter-'+S.week);
 }
 LifeJustice.weekTick(S,NPC,S.week,remember,news,log);
 FamilyEngine.weekTick(S,NPC,S.week,remember);
 worldTick();processReviews();
 if(prev===0)log('시간','첫 주 종료','첫 법관 근무 주간을 마쳤습니다.');
 if(!silent){save();render();toast(`새로운 주 · ${day()}`);}
 return true;
}
function fastForward(n){
 if(S.ended)return toast('75세 커리어 엔딩에 도달했습니다. 태블릿에서 기록을 확인하세요.');
 const until=Math.min(52,Math.max(1,n));let moved=0;
 const before=S.generatedCases.length;
 for(let i=0;i<until;i++){
  if(WEEK_EVENTS[S.week]&&!S.events.includes(WEEK_EVENTS[S.week].id))break;
  if(!advanceWeek(true))break;
  moved++;
  if(n>=13&&(S.generatedCases.length>before||openCases().some(c=>c.week===S.week)))break;
 }
 save();render();toast(`${moved}주 진행 · 현재 ${age()}세 / ${day()}`);
 if(!S.ended&&WEEK_EVENTS[S.week]&&!S.events.includes(WEEK_EVENTS[S.week].id)){popupEvent();return;}
 if(S.ended)modal('75세 · THE VERDICT 커리어 엔딩',`<p><b>${h(S.name||'판사')}</b>의 40년 법조 인생이 기록으로 남았습니다.</p><div class="grid two"><div class="stat-card"><label>완료 판결</label><strong>${completed().length}건</strong></div><div class="stat-card"><label>생성 사건</label><strong>${S.generatedCases.length}건</strong></div></div><p>최종 보직: ${h(S.post)} · 남겨진 사건과 인물 기억은 태블릿에서 볼 수 있습니다.</p>`,null);
}
function eventChoose(i){const evt=WEEK_EVENTS[S.week],o=evt?.opts[i];if(!o)return;
 Object.entries(o.rel||{}).forEach(([id,v])=>modifyRel(id,v));S.professional=clamp(S.professional+(o.prof||0),0,100);
 S.events.push(evt.id);log('인간관계',evt.title,o.reply);message(evt.who,o.reply);ui.modal=null;save();render();toast('나의 관계 기록에 반영되었습니다.');
}
function purchase(id){const item=ITEMS.find(x=>x.id===id);if(!item||S.owned.includes(id)||S.cash<item.price)return;
 S.cash-=item.price;S.owned.push(id);if(item.cat!=='사무실 집기')S.equipped[item.cat]=id;log('소비',`${item.name} 구매`,`${item.brand} · ${money(item.price)}`);
 if(item.flashy&&lvl()<5){modifyRel('senior',-3);modifyRel('hyun',2);message('hyun','그 스포츠카 샀어? 눈에 띄긴 하는데, 출퇴근이 재미있겠네.');}
 save();render();toast(`${item.name} 구매 완료. 사진첩에 기록되었습니다.`);
}
function equip(id){const i=ITEMS.find(x=>x.id===id);if(!i||!S.owned.includes(id))return;S.equipped[i.cat]=i.id;log('소유품',`${i.name} 사용 설정`,`${i.cat} · ${i.tier}`);save();render();toast('사무실·캐릭터 화면에 반영했습니다.');}
function trade(side){
 if(S.traded===S.week)return toast('이번 주 거래 기회를 이미 사용했습니다.');
 const id=document.querySelector('#sectorSelect')?.value,amount=Number(document.querySelector('#sectorAmount')?.value);
 const s=SECTORS.find(x=>x.id===id),price=S.market[id];
 if(!s||!Number.isFinite(amount)||amount<=0||!Number.isFinite(price)||price<=0)return toast('거래 정보를 확인해 주세요.');
 if(side==='buy'&&amount>S.cash)return toast('현금이 부족합니다.');
 const held=Number(S.holdings[id]||0),total=held*price;if(side==='sell'&&amount>total+.01)return toast('보유 수량보다 많은 금액입니다.');
 S.holdings[id]=held+(side==='buy'?amount:-amount)/price;
 S.cash+=(side==='buy'?-amount:amount);S.traded=S.week;
 log('투자',`${s.name} 섹터 ${side==='buy'?'매수':'매도'}`,`${money(amount)} · 가상 지수 ${nice(price)}`);
 save();render();toast('이번 주 거래가 기록되었습니다.');
}
function downloadJSON(object,name){
 const blob=new Blob([JSON.stringify(object,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function importCasePack(file){
 if(!file)return;
 if(file.size>3*1024*1024)return modal('사건팩 용량 오류','<p>JSON은 3MB 이하여야 합니다.</p>');
 const reader=new FileReader();reader.onload=()=>{
  let pack;try{pack=JSON.parse(reader.result)}catch{return modal('JSON 읽기 실패','<p>파일이 올바른 JSON 형식이 아닙니다.</p>');}
  const result=CasePackEngine.install(S,pack);
  if(!result.ok)return modal('사건팩 검증 실패',`<p>${result.errors.map(h).join(' / ')}</p>`);
  log('콘텐츠 업데이트',`${pack.title} ${result.installed==='updated'?'업데이트':'설치'}`,`${result.count}개 원형 · ${pack.version}`);save();render();
  modal('사건팩 설치 완료',`<p><b>${h(pack.title)}</b> · ${result.count}개 원형</p><p>새로 생성될 사건부터 적용되며 이미 기록된 판결은 그대로 유지됩니다.</p>${result.warnings.length?`<p>${result.warnings.map(h).join('; ')}</p>`:''}`);
 };
 reader.readAsText(file);
}
async function loadPackManifest(notify){
 if(location.protocol!=='http:'&&location.protocol!=='https:')return;
 try{
  const path=new URL('./content-packs/index.json',location.href);
  const res=await fetch(path.href,{cache:'no-cache'});if(!res.ok)throw Error('콘텐츠 목록 응답 없음');
  const index=await res.json();if(index.format!=='the-verdict-casepack-index/v1'||!Array.isArray(index.packs)||index.packs.length>30)throw Error('목록 포맷 오류');
  let count=0,errors=[];
  for(const pathPart of index.packs){
   if(typeof pathPart!=='string'||!/^\.\/[a-z0-9-]+\.json$/.test(pathPart)){errors.push('허용되지 않은 팩 파일 경로');continue;}
   const url=new URL(pathPart,path);if(url.origin!==location.origin){errors.push('타 사이트 주소');continue;}
   try{
    const r=await fetch(url.href,{cache:'no-cache'});if(!r.ok)throw Error('파일 다운로드 실패');
    const pack=await r.json();const old=(S.casePacks||[]).find(x=>x.packId===pack.packId);
    if(S.removedPackIds.includes(pack.packId)||old&&old.version===pack.version)continue;
    const install=CasePackEngine.install(S,pack);
    if(install.ok){count++;log('콘텐츠 업데이트',`${pack.title} 설치`,`${pack.version} · ${install.count}개 원형`);}else errors.push(...install.errors);
   }catch(e){errors.push(e.message||'팩 불러오기 실패');}
  }
  if(count){save();render();}
  if(notify)modal('사건팩 업데이트 확인',`<p>설치·업데이트한 팩 ${count}개</p>${errors.length?`<p>${errors.map(h).join(' / ')}</p>`:'<p>새로운 버전이 없다면 기존 콘텐츠가 그대로 유지됩니다.</p>'}`);
 }catch(e){if(notify)modal('업데이트 확인 실패',`<p>${h(e.message||'네트워크 연결 상태를 확인하세요.')}</p><p>기존 다운로드 및 수동 JSON 사건팩은 계속 이용할 수 있습니다.</p>`);}
}
function exportSave(){
 const data=JSON.stringify({app:'the-verdict-singleplayer',exportedAt:new Date().toISOString(),save:S},null,2);
 const blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`the-verdict-save-week-${S.week+1}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 toast('이 기기의 저장 파일을 내려받습니다.');
}
function importSave(file){if(!file)return;
 const reader=new FileReader();reader.onload=()=>{
  try{const parsed=JSON.parse(reader.result);const data=parsed.save||parsed;
   if(![1,2,3,4,5].includes(Number(data.version))||!data.cases||!data.market||!Array.isArray(data.journal))throw Error('invalid');
   if(!confirm('현재 이 기기의 게임 기록을 백업 파일로 교체할까요?'))return;
   S=data;save();location.reload();
  }catch{toast('올바른 THE VERDICT 저장 파일이 아닙니다.')}
 };reader.readAsText(file);
}
function askReset(){modal('이 기기의 게임 초기화',`<p>두 슬롯의 판결, 커리어, 자산, 메모와 자동 저장본이 모두 삭제됩니다. 복구하려면 미리 저장 파일을 백업해야 합니다.</p>`,`<button class="btn outline" data-action="dismiss">취소</button><button class="btn primary" data-action="resetConfirm">전부 삭제</button>`)}
function setup(){
 modal('THE VERDICT에 오신 것을 환영합니다',`<p>법정에서 내린 판단이 커리어와 인간관계에 남는 싱글플레이 게임입니다. 모든 기록은 이 폰에만 저장됩니다.</p>
 <div class="control-wrap mt"><label for="playerName">판사 이름</label><input class="control" id="playerName" maxlength="16" placeholder="예: 정우진" autocomplete="off"></div>
 <p><b>캐릭터 헤어스타일</b></p><div class="row" style="flex-wrap:wrap">${[0,1,2,3,4].map(i=>`<button class="btn outline mini" data-action="style" data-i="${i}" aria-label="헤어스타일 ${i+1}">${avatar('self',i)}</button>`).join('')}</div>
 <p class="small muted">캐릭터는 나중에 변경할 수 있습니다. 로그인이나 서버 연결은 없습니다.</p>`,`<button class="btn primary full" data-action="start">커리어 시작하기 →</button>`);
}
function clicker(e){
 const el=e.target.closest('[data-action]');if(!el||el.disabled)return;
 const action=el.dataset.action;
 switch(action){
 case'tab':changeTab(el.dataset.tab);break;
 case'tablet':ui.tabletTab=el.dataset.sub;changeTab('tablet');break;
 case'openCase':ui.caseId=el.dataset.id;changeTab('court');break;
 case'courtStep':courtStep(Number(el.dataset.i));break;
 case'verdict':conclude(el.dataset.choice);break;
 case'proposeSettlement':proposeSettlement();break;
 case'nextWeek':advanceWeek();break;
 case'skip':fastForward(Number(el.dataset.n));break;
 case'archiveSearch':ui.archiveQuery=document.querySelector('#archiveQuery')?.value||'';render();break;
 case'assetTab':ui.assetTab=el.dataset.sub;render();break;
 case'shopCat':ui.shopCat=el.dataset.cat;render();break;
 case'npc':popupNPC(el.dataset.id);break;
 case'meetPartner':meetPartner(el.dataset.id);break;
 case'romanceStep':romanceStep(el.dataset.step);break;
 case'event':popupEvent();break;
 case'eventChoose':eventChoose(Number(el.dataset.i));break;
 case'buy':purchase(el.dataset.id);break;
 case'equip':equip(el.dataset.id);break;
 case'trade':trade(el.dataset.side);break;
 case'dismiss':ui.modal=null;render();break;
 case'export':exportSave();break;
 case'import':document.querySelector('#importFile')?.click();break;
 case'packImport':document.querySelector('#casePackFile')?.click();break;
 case'packRefresh':loadPackManifest(true);break;
 case'packToggle':{const p=(S.casePacks||[]).find(x=>x.packId===el.dataset.id);if(p){CasePackEngine.setEnabled(S,p.packId,p.enabled===false);save();render();}break;}
 case'packRemove':{const id=el.dataset.id;if(confirm('사건팩을 라이브러리에서 삭제할까요? 이미 발생한 사건과 판결은 유지됩니다.')){CasePackEngine.remove(S,id);if(!S.removedPackIds.includes(id))S.removedPackIds.push(id);save();render();}break;}
 case'packExport':{const p=(S.casePacks||[]).find(x=>x.packId===el.dataset.id);if(p){const out={...p};delete out.enabled;downloadJSON(out,`verdict-pack-${p.packId}-${p.version}.json`);}break;}

 case'saveNotes':S.notes=document.querySelector('#personalNotes')?.value||'';save();toast('이 기기에 메모를 저장했습니다.');break;
 case'reset':askReset();break;
 case'resetConfirm':wipeGame();break;
 case'style':S.style=Number(el.dataset.i);toast(`헤어스타일 ${S.style+1} 선택`);break;
 case'start':{const input=document.querySelector('#playerName');S.name=(input?.value||'').trim().slice(0,16)||'신임 판사';save();ui.modal=null;render();toast(`${S.name} 판사님의 첫 발령을 축하합니다.`);break;}
 }
}
function init(){
 document.addEventListener('click',clicker);
 document.addEventListener('change',e=>{if(e.target?.id==='importFile')importSave(e.target.files?.[0]);if(e.target?.id==='casePackFile')importCasePack(e.target.files?.[0])});
 document.addEventListener('input',e=>{if(e.target?.id==='personalNotes'){S.notes=e.target.value;save()}});
 worldTick();
 if(window.__VERDICT_STARTER_PACK&&!S.removedPackIds.includes(window.__VERDICT_STARTER_PACK.packId)){const r=CasePackEngine.install(S,window.__VERDICT_STARTER_PACK);if(r.ok)log('콘텐츠 업데이트','기본 사건팩 설치',`${r.count}개 원형 · ${window.__VERDICT_STARTER_PACK.version}`);}
 save();render();if(!S.name)setup();
 if(location.protocol==='http:'||location.protocol==='https:')loadPackManifest(false);
 if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
// Deferred patch scripts must finish before the first UI initialization.
if(document.readyState==='complete')init();else document.addEventListener('DOMContentLoaded',init,{once:true});


;/* source: beta_patch_v11.js */
/* THE VERDICT Beta UX 1.1 — additive, save-compatible UI and hearing scheduling. */
'use strict';
(() => {
 const BASE={home, court, shell, tabletInner, popupNPC, advanceWeek, fastForward, courtStep, conclude, clicker, setup};
 Object.assign(NPC,{jiyu:{...NPC.jiyu,gender:'여성'},soo:{...NPC.soo,gender:'여성'},reporter:{...NPC.reporter,gender:'여성'},tenant:{...NPC.tenant,gender:'여성'},singer:{...NPC.singer,gender:'여성'},mina:{...NPC.mina,gender:'여성'},seon:{...NPC.seon,gender:'남성'},jun:{...NPC.jun,gender:'남성'},senior:{...NPC.senior,gender:'남성'},builder:{...NPC.builder,gender:'남성'},owner:{...NPC.owner,gender:'남성'},taeo:{...NPC.taeo,gender:'남성'}});
 const busy=st=>Number.isInteger(st?.nextHearingWeek)&&S.week<st.nextHearingWeek;
 const hash=x=>{let v=2166136261;for(let i=0;i<String(x).length;i++)v=Math.imul(v^String(x).charCodeAt(i),16777619)>>>0;return v>>>0};
 const clockDate=(week=S.week)=>day(week).replaceAll('.','-');
 const caseSummary=c=>{
  const st=c.story,ar=st?.arc,pack=st?.pack||c.contentPack,incident=pack?.incident;
  const bits=[c.intro,st?.relation?`당사자 관계: ${st.relation}`:'',incident?.cause?`발단: ${incident.cause}`:'',incident?.action?`사건: ${incident.action}`:'',ar?.begin,ar?.development,ar?.trial,st?.lifeContext].filter(Boolean);
  return [...new Set(bits)].map(s=>h(s)).join(' ');
 };
 const roleTag=(id,c)=>c.side?.[0]===id?(c.kind==='criminal'?'검사':'원고 대리인'):c.side?.[1]===id?'피고 측 변호인':c.who?.[0]===id?(c.kind==='criminal'?'피고인':'원고'):c.who?.[1]===id?(c.kind==='criminal'?'피해자·관계인':'피고'):'증인·관계인';
 function photo(id){
  if(window.VerdictVisuals){const p=NPC[id]||{};return VerdictVisuals.portrait(id,p,p.bornYear?Math.max(8,year()-p.bornYear):35)}
  const p=NPC[id]||NPC.self,seed=hash(id+'-portrait-1'),male=p.gender?/남/.test(p.gender):![4,5].includes(p.hair),yr=p.bornYear||1986,ageN=Math.max(8,Math.min(95,year()-yr));
  const shades=['#edd0b7','#dcb394','#bb8768','#edbb98','#c99678'];const skin=shades[(seed>>>2)%shades.length];
  const hair=['#252c32','#3c2d2b','#4c3b35','#302927','#6b4c3e','#85817a'][Math.min(5,Math.floor(ageN/70)+(seed%5))];
  const coat=/(검사|판사|변호사|법원|공직|교수|대표|의원)/.test(p.role||'')?['#1d3553','#283d50','#3d3637'][seed%3]:['#425b69','#755b62','#455350','#62616d'][seed%4];
  const woman=!male,short=ageN<17,senior=ageN>55;
  const faceW=(seed%3-1)*3,eyeY=86+(seed%4-2),line=senior?`<path d="M41 87L54 87 M99 87L111 86 M55 121l10 2 M92 122l10-2" fill="none" stroke="#a97962" stroke-opacity=".36" stroke-width="1.4"/>`:'';
  const hairstyle=woman?`<path d="M31 91Q12 22 80 20Q145 22 128 98L136 155Q121 164 111 149L112 58Q80 39 49 63L47 146Q24 160 20 148Z" fill="${hair}"/>`:`<path d="M30 77Q22 39 53 28Q85 12 114 31Q135 49 126 79Q109 60 90 57Q61 66 39 56Z" fill="${hair}"/>`;
  return `<span class="id-portrait" title="${h(p.name)} · ${h(p.role)}" role="img" aria-label="${h(p.name)} 증명사진형 프로필"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 194" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="bg${seed}" x2="1" y2="1"><stop stop-color="#d8e2e6"/><stop offset="1" stop-color="#a9bdc5"/></linearGradient><linearGradient id="fc${seed}" x2=".75" y2="1"><stop stop-color="${skin}"/><stop offset="1" stop-color="#b97d62"/></linearGradient></defs><rect width="160" height="194" fill="url(#bg${seed})"/><path d="M0 164Q60 152 160 158L160 194H0Z" fill="#f1efeb" opacity=".35"/><path d="M-5 204Q2 150 49 144L111 144Q160 147 167 204Z" fill="${coat}"/><path d="M63 142L80 182L98 142Z" fill="#f7f5f2"/><path d="M80 159l-6 10 6 24 6-24z" fill="${short?'#9ba9ae':'#7c5660'}"/><path d="M67 124L66 151Q80 161 94 151L92 124Z" fill="${skin}"/>${hairstyle}<ellipse cx="80" cy="91" rx="46" ry="60" fill="url(#fc${seed})"/><ellipse cx="35" cy="96" rx="6" ry="12" fill="${skin}"/><ellipse cx="125" cy="96" rx="6" ry="12" fill="${skin}"/>${woman?`<path d="M37 64Q37 29 80 27Q120 25 126 68Q98 48 65 55Q48 66 37 64Z" fill="${hair}"/>`:`<path d="M33 75Q26 31 72 31Q109 25 125 64L122 75Q90 50 65 60Q45 67 33 75Z" fill="${hair}"/>`}<path d="M50 ${eyeY}Q62 ${eyeY-5} 72 ${eyeY} M90 ${eyeY}Q101 ${eyeY-5} 113 ${eyeY}" fill="none" stroke="#4d3e3b" stroke-width="2.6"/><ellipse cx="62" cy="${eyeY+5}" rx="3.1" ry="3.5" fill="#25313a"/><ellipse cx="102" cy="${eyeY+5}" rx="3.1" ry="3.5" fill="#25313a"/><path d="M81 94l-4 17q3 3 9 0" fill="none" stroke="#b1795e" stroke-width="1.8"/><path d="M67 124q13 7 27 0" fill="none" stroke="#9c665f" stroke-width="2.5" stroke-linecap="round"/>${line}${senior?`<path d="M35 108q4 5 7 8 M118 108q-4 6-7 8" stroke="#ab8066" opacity=".4" fill="none"/>`:''}<rect x="0.5" y="0.5" width="159" height="193" stroke="#ffffff" stroke-opacity=".42" fill="none"/></svg></span>`;
 }
 window.verdictPhoto=photo;
 const personButton=(id,c,extra='')=>{const p=NPC[id]||{name:'미상',role:'관계인'};return `<button class="verdict-person" data-action="npc" data-id="${h(id)}">${photo(id)}<span class="person-copy"><strong>${h(p.name)}</strong><span>${h(c?roleTag(id,c):p.role)}</span><small>${p.bornYear?`${year()-p.bornYear}세 · `:''}${h(p.career||p.role||'')}</small>${extra?`<small>${h(extra)}</small>`:''}</span><span class="profile-link">인물 기록 ›</span></button>`};
 function advocates(c,st){
  const pub=c.story?.publicDossier||{};
  const left=st.positions?.claimant||pub.plea||`${c.intro} 제출된 자료를 기초로 청구와 공소사실을 인정해 달라는 입장입니다.`;
  const right=st.positions?.respondent||pub.situation||`상대방은 사실관계와 책임 범위를 다투고 있습니다. 주장별 근거와 반박 증거를 확인해야 합니다.`;
  return `<div class="adversarial"><article class="adv-card prosecution"><div class="adv-head"><span class="adv-label">${c.kind==='criminal'?'검사 측 의견':'원고 측 주장'}</span>${personButton(c.side[0],c)}</div><p>${h(left)}</p></article><article class="adv-card defense"><div class="adv-head"><span class="adv-label">${c.kind==='criminal'?'변호인 측 의견':'피고 측 반박'}</span>${personButton(c.side[1],c)}</div><p>${h(right)}</p></article></div>`;
 }
 function witnesses(c){const set=new Set(),arr=[];for(const stage of c.stages||[])for(const a of stage.actions||[])if(a.who&&!c.side.includes(a.who)&&!c.who.includes(a.who)&&!set.has(a.who)&&NPC[a.who]){set.add(a.who);arr.push(a.who)};const det=c.story?.investigator?.detective;if(det&&!set.has(det)&&NPC[det])arr.push(det);return arr;}
 function scheduling(c,st){const holding=busy(st);const due=st.nextHearingWeek||0;return `<section class="panel calendar-panel"><div class="row between"><h3 class="no-margin">🗓 기일 관리 · 재판 일정</h3><span class="chip ${holding?'gold':'green'}">${holding?'기일 대기':'심리 가능'}</span></div><div class="hearing-status"><div><small>현재 날짜</small><strong>${h(day())}</strong></div><div><small>다음 기일</small><strong>${holding?h(day(due)):'미지정'}</strong></div><div><small>심리 단계</small><strong>${Math.min(st.phase+1,4)} / 4</strong></div></div>${holding?`<p class="notice">${h(day(due))}에 공판이 재개됩니다. 남은 ${due-S.week}주 동안 사건 기록과 다른 사건을 살펴볼 수 있습니다.</p><button class="btn primary full" data-action="skipHearing" data-id="${h(c.id)}">다음 기일까지 시간 진행 →</button>`:`<p class="muted small">당사자에게 자료를 보완하게 하거나 증인신문을 위한 다음 기일을 지정할 수 있습니다. 새로운 자료는 기존 사건의 사실과 증거 출처에 연결됩니다.</p><div class="hearing-actions"><button class="btn outline mini" data-action="postpone" data-weeks="2">2주 후</button><button class="btn outline mini" data-action="postpone" data-weeks="4">1개월 후</button><button class="btn outline mini" data-action="postpone" data-weeks="8">2개월 후</button></div>`}${(st.hearingHistory||[]).length?`<details class="hearing-history"><summary>과거 기일 ${st.hearingHistory.length}건 보기</summary>${st.hearingHistory.slice(-6).reverse().map(x=>`<p class="small">${h(day(x.week))} · ${h(x.text)}</p>`).join('')}</details>`:''}</section>`;}
 function evidencePanel(c,st){const delivered=new Set(st.deliveredEvidence||[]);return `<section class="panel evidence-panel"><div class="row between"><h3 class="no-margin">📎 제출·확보 증거</h3><span class="chip">${c.evidence.length+st.clues.length}건 기록</span></div><div class="evidence-compact">${c.evidence.map((title,i)=>{const d=c.story?.evidenceDetails?.[i],got=d?.available||delivered.has(i);return `<div class="evidence-row"><div><b>${h(title)}</b><small>${got?'제출·확보':'미확보·추가 확인'} · ${h(d?.origin||'사건 기록')}</small>${d?`<details><summary>입증 범위와 한계</summary><p>${h(d.scope||'')}<br>${h(d.concern||d.status||'')}</p></details>`:''}</div><span class="evidence-status ${got?'complete':''}">${got?'확보':'확인 중'}</span></div>`}).join('')}${st.clues.map((e,i)=>`<div class="evidence-row clue"><span>✓</span><div><b>${h(e)}</b><small>제${i+1}차 심리에서 확인한 기록</small></div></div>`).join('')}</div></section>`;}
 function courtNew(){const available=openCases();let c=CASES.find(x=>x.id===ui.caseId&&caseOpen(x)&&!S.cases[x.id]?.referred);if(!c)c=available[0];if(!c)return heading('법정','배당된 사건이 없습니다.');ui.caseId=c.id;
  const st=S.cases[c.id],hold=busy(st),p=st.phase,left=actionsLeft(),readOnly=!!st.verdict;
  const everyone=[...new Set([...c.who,...c.side,...witnesses(c)])];
  const persons=`<section class="panel"><div class="row between"><h3 class="no-margin">사건 관계인 · 증인</h3><span class="chip">${everyone.length}명</span></div><div class="people-photo-grid">${everyone.map(id=>personButton(id,c)).join('')}</div></section>`;
  const stage=readOnly?resultCase(c):`<section class="panel action-panel"><div class="row between"><h3 class="no-margin">${p<3?'심리·증거 조사':'판결 선택'}</h3><span class="chip">심리 여력 ${left}/4</span></div><p class="prompt-label">${p<3?h(c.stages[p].prompt):'기존 심리 기록과 법적 요건을 검토하고 판결하세요.'}</p>${hold?`<div class="notice">다음 기일 ${h(day(st.nextHearingWeek))}까지 심리가 일시 정지되었습니다.</div>`:p<3?c.stages[p].actions.map((a,i)=>`<button class="choice" data-action="courtStep" data-i="${i}" ${left===0?'disabled':''}><span class="choice-index">${i+1}</span><span><strong>${h(a.label)}</strong><small>${h(a.short)}</small></span><span class="chevron">›</span></button>`).join(''):`<p class="muted small">실제 사건의 진실과 입증 가능한 사실은 별개입니다. 선고 후 게임에서는 최종 확정됩니다.</p>${c.verdicts.map(v=>`<button class="choice" data-action="verdict" data-choice="${h(v.id)}" ${left===0?'disabled':''}><span class="choice-index">⚖</span><span><strong>${h(v.label)}</strong><small>${h(v.note)}</small></span><span class="chevron">›</span></button>`).join('')}`}${c.story?.deep&&!c.story.criminal&&p>=2&&!hold?`<button class="btn outline full mt" data-action="proposeSettlement" ${left===0?'disabled':''}>당사자 화해·조정 의사 확인</button>`:''}</section>`;
  return `<div class="beta-court"><div class="row between beta-title"><div>${heading('나의 법정',`사건번호 ${c.id} · ${c.tag}`)}</div><button class="btn outline mini" data-action="tab" data-tab="courtList">다른 사건</button></div><section class="court-hero"><div class="hero-judge">⚖</div><div class="hero-main"><div class="eyebrow">CASE FILE · ${h(c.tag)}</div><h2>${h(c.name)}</h2><p>${h(c.sub)}</p><div class="court-meta"><span>사건 중요도 ${c.importance}/5</span><span>${h(status(c))}</span><span>${h(day(c.week))} 배당</span></div></div></section><section class="panel case-narrative"><div class="row between"><h3 class="no-margin">01 · 무슨 사건인가?</h3><span class="chip">사건 개요</span></div><p>${caseSummary(c)}</p>${c.story?.publicDossier?.issues?.length?`<p class="legal-issue"><strong>핵심 다툼</strong> ${h(c.story.publicDossier.issues.join(' · '))}</p>`:''}${c.contentWarning?`<p class="notice">${h(c.contentWarning)}</p>`:''}${c.relatedCaseId?`<p class="muted small">이전 등장 인물의 별개 사건: ${h(c.relatedCaseId)}. 현재 사건의 유무죄는 독립 판단합니다.</p>`:''}</section><section class="case-advocates"><div class="row between"><h3 class="no-margin">02 · 양측의 주장</h3><span class="chip">쟁점 비교</span></div>${advocates(c,st)}</section><div class="court-new-grid"><div class="court-main-col">${scheduling(c,st)}${stage}${st.actions.length?`<section class="panel"><h3>심리 진행 기록</h3><div class="timeline">${st.actions.map((a,i)=>`<div class="timeline-item"><small>${h(day(a.week))} · 심리 ${i+1}</small><b>${h(a.label)}</b><p>${h(a.says)}</p><button class="btn mini outline" data-action="npc" data-id="${h(a.who)}">${h(NPC[a.who]?.name||'관계인')} 프로필</button></div>`).join('')}</div></section>`:''}</div><div class="court-side-col">${persons}${evidencePanel(c,st)}</div></div></div>`;
 }
 function snsItems(){const base=S.news.slice(0,25),cases=openCases().slice(0,5);const chatter=Array.from({length:Math.min(14,Math.max(1,S.week+1))},(_,i)=>{const c=CASES[(i+S.week)%Math.max(1,CASES.length)]||cases[0];return {week:Math.max(0,S.week-i),title:c?`[의견] ${c.name} 관련 자료가 더 필요할까?`:'[잡담] 오늘 법정 기록',body:c?`${c.sub} 사건을 두고 게시판에서 의견이 갈리고 있습니다. 확인되지 않은 사실은 단정하지 말자는 의견도 있습니다.`:'법원 업무와 사회 이슈를 이야기하는 게시판입니다.',caseId:c?.id||null,src:'시민광장'};});const virtual=[...chatter,...base.map((x,i)=>({week:x.week,title:x.title,body:x.body,caseId:null,src:x.category||'법조일보'})),...cases.map(x=>({week:x.week,title:`[법정] ${x.name}`,body:x.sub,caseId:x.id,src:'사건토론'}))].sort((a,b)=>b.week-a.week);return virtual.slice(0,24);}
 const nicks=['팩트체크중','유동_법알못','민트초코재판','상식적인사람','퇴근길댓글러','기록주의자','현직은아님','불꽃토론러','지켜보는중','판례찾는사람'];
 const templates=['이건 제목만 보고 판단할 문제가 아님. 증거가 뭔지 봐야지','양쪽 얘기를 다 들어봐야 하는 사건 같은데?','기사에 빠진 사실관계가 꽤 있을 듯','증거가 확실한지부터 따져봐야 하는 거 아님?','현실에서도 이런 분쟁이 많을 것 같음','아직 결론 내리기 이르다고 봄','과거 사정이 이번 사건의 책임을 자동으로 정하진 않지','저 부분은 추가 조사 결과 나오면 봐야겠다','댓글마다 판단이 다르네 ㅋㅋ','법원 기록과 기사 제목은 구분해야 한다고 생각함'];
 function snsFeed(limit=12){return `<div class="sns-feed">${snsItems().slice(0,limit).map((p,i)=>{const seed=hash(p.title+p.week),view=230+(seed%9400),votes=9+(seed%420),comments=3+seed%37;return `<article class="sns-post"><div class="sns-post-top"><span class="forum-label">${h(p.src)} · THE VERDICT 게시판</span><span>${h(day(p.week))}</span></div><h3>${h(p.title)}</h3><p>${h(p.body)}</p><div class="sns-stats">조회 ${view.toLocaleString()} · 추천 ${votes} · 댓글 ${comments}</div><div class="sns-comments">${[0,1,2,3].map(k=>{const n=nicks[(seed+k*3)%nicks.length],msg=templates[(seed+k*5)%templates.length];return `<div class="sns-comment"><span class="sns-vote">▲ ${2+(seed+k)%44}</span><div><b>${h(n)}</b><p>${h(msg)}</p></div></div>`}).join('')}</div></article>`}).join('')}</div>`;}
 function homeNew(){const open=openCases(),next=open.slice().sort((a,b)=>(S.cases[a.id]?.nextHearingWeek||0)-(S.cases[b.id]?.nextHearingWeek||0))[0],due=open.filter(c=>busy(S.cases[c.id]));
  return `<div class="beta-home"><div class="beta-title">${heading('오늘의 재판 업무',`${h(S.post)}${window.VerdictV6?.deptLabel?.()?' · '+h(window.VerdictV6.deptLabel()):''} · ${age()}세 · 법조 경력 ${yearsServed()}년`)}</div><div class="dashboard-hero"><div><span class="eyebrow">THE VERDICT · JUDICIAL LIFE</span><h2>판결은 끝나도, 사람들의 인생은 계속됩니다.</h2><p>오늘은 ${h(day())}. 처리 중인 사건 ${open.length}건 · 다음 기일 대기 ${due.length}건</p><div class="dashboard-actions"><button class="btn gold" data-action="tab" data-tab="courtList">⚖ 배당 사건 보기</button><button class="btn outline" data-action="tablet" data-sub="social">＃ 시민 반응</button><button class="btn outline" data-action="tablet" data-sub="backup">💾 저장 관리</button></div></div><div class="dashboard-hero-badge">${photo('self')}<small>${h(S.name||'신임 판사')} 판사</small></div></div><div class="metric-grid"><div class="metric"><small>오늘 날짜</small><strong>${h(day())}</strong><span>가상 주간 ${S.week+1}주차</span></div><div class="metric"><small>처리할 사건</small><strong>${open.length}건</strong><span>완료 판결 ${completed().length}건</span></div><div class="metric"><small>주간 심리 여력</small><strong>${actionsLeft()} / ${actionMax()}</strong><span>일주일마다 갱신</span></div><div class="metric"><small>법률 전문성</small><strong>${Math.round(S.professional)} / 100</strong><span>판결 경험으로 성장</span></div></div><section class="panel time-board"><div class="row between"><div><h3 class="no-margin">⏱ 가상 시간과 일정</h3><p class="muted small">${h(day(S.week))} 현재 · 판사는 65세에 커리어 종료</p></div><span class="chip">${age()} / 65세</span></div><div class="timeline-dates"><span>${h(day(Math.max(0,S.week-1)))}</span><strong>${h(day())}</strong><span>${h(day(S.week+1))}</span></div><div class="week-ruler"><span></span><span class="selected"></span><span></span></div>${S.lastAdvance?`<p class="advance-note">최근 진행: ${S.lastAdvance.moved}주 · ${h(day(S.lastAdvance.from))} → ${h(day(S.lastAdvance.to))} · 신규 사건 ${S.lastAdvance.newCases}건</p>`:''}<div class="time-controls"><button class="btn primary" data-action="nextWeek">+ 1주 진행</button><button class="btn outline" data-action="skip" data-n="4">+ 4주 진행</button><button class="btn outline" data-action="skip" data-n="13">다음 사건까지</button></div></section><section><div class="row between section-title"><h2>진행 중인 재판</h2><button class="btn ghost mini" data-action="tab" data-tab="courtList">사건 전체 보기 →</button></div><div class="case-list">${open.length?open.slice(0,4).map(c=>`<div class="beta-case">${caseCard(c)}${busy(S.cases[c.id])?`<small class="date-alert">🗓 ${h(day(S.cases[c.id].nextHearingWeek))} 심리 재개 예정</small>`:''}</div>`).join(''):'<div class="panel">오늘 진행할 사건이 없습니다. 시간을 진행해보세요.</div>'}</div></section><section class="home-sns"><div class="row between section-title"><h2>＃ 오늘의 여론</h2><button class="btn ghost mini" data-action="tablet" data-sub="social">게시판 전체 보기 →</button></div>${snsFeed(2)}</section></div>`;
 }
 /* How person k is related to person x, from x's point of view: 모친, 아들, 배우자 … */
function kinLabel(x,k){const r=x.relationships?.[k]?.kind,o=NPC[k];if(!r||!o)return '가족';const f=/여/.test(o.gender||'');
 const view=o.familyAnchor===x.id?r:x.familyAnchor===k?({parent:'child',child:'parent'}[r]||r):(x.parentIds||[]).includes(k)?'parent':(o.parentIds||[]).includes(x.id)?'child':r;
 return {parent:f?'모친':'부친',child:f?'딸':'아들',sibling:f?'자매':'형제',spouse:'배우자'}[view]||'가족'}
function npcModal(id){const x=NPC[id];if(!x)return;FamilyEngine.ensure(S,NPC,id,year());ui.npcId=id;const life=(LifeJustice.summary(x,year(),S.week)),custody=LifeJustice.custodySummary(x,S.week),fam=(x.familyIds||[]).filter(k=>NPC[k]).slice(0,12);const history=(x.jobHistory||[]).slice(-4).reverse();const trust=S.relations[id]??20;
  modal(`${x.name} · 인물 기록`, `<div class="beta-person-modal"><div class="person-top">${photo(id)}<div><b>${h(x.role||'관계인')}</b><p>${h(x.gender||'성별 미상')} · ${x.bornYear?year()-x.bornYear+'세':'나이 미상'} · ${h(x.maritalStatus||'혼인 미상')}</p><div class="chip">판사와의 관계 ${trust}/100</div></div></div><div class="profile-data"><div><small>성향·성격</small><p>${h(x.personality||'성격 정보는 조사 기록 참조')} · MBTI ${h(x.mbti||'-')}</p></div><div><small>성장·가정</small><p>${h(x.parentsOrigin||x.origin||'미기록')} · 부모 재력 ${x.parentWealth??'미상'}/100</p></div><div><small>학력·직업</small><p>${h(x.degree||x.education||'-')} · ${h(x.educationField||'')} / ${h(x.career||x.role||'')}</p></div><div><small>개인 경제·가족</small><p>재력 ${x.wealth??'미상'}/100 · ${h(LifeJustice.sibText(x))} · 자녀 ${x.children??0}명</p></div></div><div class="detail"><b>현재 생애 상태</b><p>${h(life)}</p><b>형 집행 기록</b><p>${h(custody)}</p></div>${fam.length?`<h4>가족·직접 관계</h4><div class="family-cards">${fam.map(k=>`<button class="family-card" data-action="npc" data-id="${h(k)}">${avatar(k)}<span><small>${h(kinLabel(x,k))}</small><b>${h(NPC[k].name)}</b><em>${NPC[k].alive===false?'고인':h(NPC[k].career||NPC[k].role||'')}${NPC[k].bornYear?` · ${year()-NPC[k].bornYear}세`:''}</em></span></button>`).join('')}</div>`:''}${history.length?`<h4>직업 변천</h4>${history.map(j=>`<p class="muted small">${j.year} · ${h(j.job)} — ${h(j.reason)}</p>`).join('')}`:''}<h4>기억과 사건 이력</h4>${(S.memories[id]||[]).slice(-6).reverse().map(m=>`<p class="muted small">${h(day(m.week))} · ${h(m.type)} · ${h(m.body)}</p>`).join('')||'<p class="muted small">기록된 접점 없음</p>'}</div>`);
 }
 function sessionSetup(){modal('THE VERDICT · 새 커리어',`<p>당신이 내린 판결은 NPC의 생애와 사회에 영향을 줍니다. 2027년, 35세 신임 판사로 시작합니다.</p><div class="control-wrap mt"><label for="playerName">판사 이름</label><input class="control" id="playerName" maxlength="16" placeholder="예: 정우진" autocomplete="off"></div><p class="muted small">인물 증명사진과 복장은 성별·나이·직업에 따라 자동 생성됩니다. 꾸미기는 베타에서 숨겨졌습니다.</p>`,`<button class="btn primary full" data-action="start">재판 경력 시작하기 →</button>`);}
 function scheduleCase(weeks){const c=CASES.find(x=>x.id===ui.caseId),st=c&&S.cases[c.id];if(!c||!st||st.verdict||busy(st))return;st.nextHearingWeek=S.week+weeks;st.hearingHistory??=[];st.hearingHistory.push({week:S.week,kind:'scheduled',text:`${weeks}주 후(${day(st.nextHearingWeek)}) 기일 지정 · 서면/증인/자료 보완 검토`});st.pendingResearch={requestedWeek:S.week,dueWeek:st.nextHearingWeek,kind:'추가 자료 확인',caseId:c.id};log('재판 일정',`${c.name} 기일 연기`,`${day(st.nextHearingWeek)} 재개 예약`);save();render();toast(`다음 재판 ${day(st.nextHearingWeek)} · ${weeks}주 후`);}
 function settleDueHearing(){let count=0;for(const c of CASES){const st=S.cases[c.id];if(!st||st.verdict||!st.nextHearingWeek||st.nextHearingWeek>S.week||st.hearingReturnedWeek===st.nextHearingWeek)continue;
  st.hearingReturnedWeek=st.nextHearingWeek;st.hearingHistory??=[];const details=c.story?.evidenceDetails||[],delivered=new Set(st.deliveredEvidence||[]);const index=details.findIndex((d,i)=>d&&!d.available&&!delivered.has(i));let desc='기존 제출 자료에 관한 추가 검토가 끝났습니다. 새로운 사실이 자동으로 인정되지는 않습니다.';
  if(index>=0){st.deliveredEvidence??=[];st.deliveredEvidence.push(index);desc=`기존 사건의 미확보 자료 확인: ${c.evidence[index]}. ${details[index].scope||'입증 범위는 별도로 검토해야 합니다.'}`;st.clues.push(`기일 속행 · ${c.evidence[index]} 보완 회신`);}
  else if(c.stages?.some(stage=>stage.actions?.some(a=>a.who&&!c.side.includes(a.who)&&!c.who.includes(a.who)&&NPC[a.who]))){const w=c.stages.flatMap(stage=>stage.actions||[]).find(a=>a.who&&!c.side.includes(a.who)&&!c.who.includes(a.who)&&NPC[a.who]);desc=`${NPC[w.who].name}의 증인·관계인 조사를 위한 출석 기일이 도래했습니다. 진술 내용은 심리에서 직접 확인해야 합니다.`;}
  st.hearingHistory.push({week:S.week,kind:'resumed',text:desc});st.lastHearingNotice=desc;st.nextHearingWeek=null;st.pendingResearch=null;log('재판 재개',`${c.name} · 기일 도래`,desc);count++;
 }if(count)save();return count;}
 let lastMove=null;
 const alteredAdvance=(silent=false)=>{const before=S.week,count=S.generatedCases?.length||0,ok=BASE.advanceWeek(silent);if(!ok)return false;const resumed=settleDueHearing();S.lastAdvance={from:before,to:S.week,moved:1,newCases:(S.generatedCases?.length||0)-count,resumed};save();if(!silent){render();if(resumed)toast(`${day()} · ${resumed}건의 재판 재개`);}return true;};
 home=homeNew;court=courtNew;popupNPC=npcModal;tabletInner=function(){if(ui.tabletTab==='social')return `<h2>＃ 시민광장 · 커뮤니티 반응</h2><p class="muted small">실제 온라인 게시물과 무관한 가상의 반응입니다. 댓글은 판결이나 증거 사실을 대신하지 않습니다.</p>${snsFeed(18)}`;if(ui.tabletTab==='backup')return `<h2>💾 게임 저장·불러오기</h2><p class="muted small">이 기기에는 자동 저장됩니다. 기기 변경이나 새 게임 시작 전에는 별도의 JSON 백업을 만들어 주세요.</p><div class="save-buttons"><button class="btn primary" data-action="export">💾 세이브 파일 저장</button><button class="btn outline" data-action="import">📂 세이브 불러오기</button><button class="btn outline" data-action="reset">↻ 새 게임 · 판사 초기화</button></div><input id="importFile" type="file" accept="application/json,.json" class="hidden"><div class="notice mt">새 게임은 현 기기 기록을 삭제합니다. 판결·NPC·사건팩 기록이 모두 초기화되니 백업이 필요합니다.</div>`;return BASE.tabletInner();};setup=sessionSetup;advanceWeek=alteredAdvance;
 fastForward=function(n){const from=S.week,count=S.generatedCases.length;BASE.fastForward(n);if(S.week>from){S.lastAdvance={from,to:S.week,moved:S.week-from,newCases:S.generatedCases.length-count,resumed:0};save();render();toast(`${day(from)} → ${day()} · ${S.week-from}주 진행`);}};
 courtStep=function(i){const st=S.cases[ui.caseId];if(busy(st)){toast('아직 재판 재개 기일이 아닙니다.');return;}BASE.courtStep(i)};
 conclude=function(id){const st=S.cases[ui.caseId];if(busy(st)){toast('다음 기일 이전에는 선고할 수 없습니다.');return;}BASE.conclude(id)};
 clicker=function(e){const el=e.target.closest('[data-action]');if(!el)return;switch(el.dataset.action){case'postpone':scheduleCase(Number(el.dataset.weeks));break;case'skipHearing':{const st=S.cases[el.dataset.id],num=st?.nextHearingWeek-S.week;if(num>0)fastForward(Math.min(52,num));break;}case'saveHub':ui.tabletTab='backup';changeTab('tablet');break;case'snsHub':ui.tabletTab='social';changeTab('tablet');break;default:BASE.clicker(e);}}
 // Global functions in the original classic script are reassigned before init() installs listeners.
 shell=function(content){const html=BASE.shell(content);return html.replace('LIFE OF JUSTICE · LOCAL v0.3','LIFE OF JUSTICE · BETA 1.1').replace('<div class="side-label">MY CHAMBERS</div>','<div class="side-label">JUDICIAL DESK</div>').replace(/\['assets','◈','자산'\]/g,'').replace('<header class="topbar">',`<header class="topbar"><div class="quick-top"><button class="btn outline mini" data-action="saveHub">💾 저장·새 게임</button><button class="btn outline mini" data-action="snsHub">＃ SNS</button></div>`).replace(/<button class="nav-btn [^"]*" data-action="tab" data-tab="assets"[\s\S]*?<\/button>/g,'').replace(/<button data-action="tab" data-tab="assets"[\s\S]*?<\/button>/g,'');};
})();

;/* source: beta_patch_v12.js */
'use strict';
(()=>{
 const formerCourt=court,formerClicker=clicker,formerManifest=loadPackManifest;
 function allocate(){
   const d=S.cases?.deposit;
   if(S.firstAllocationVersion||!S.name||S.week!==0||S.generatedCases?.length||d?.verdict||d?.actions?.length)return;
   S.firstAllocationVersion=12;if(d)d.referred=true;
   try{let c=createGeneratedCase();if(c){ui.caseId=c.id;S.nextCaseWeek=Math.max(8,S.nextCaseWeek||0)}}
   catch(e){if(d)d.referred=false;S.firstAllocationVersion=null;console.warn(e)}
   save();render();
 }
 loadPackManifest=async function(notify){const out=await formerManifest(notify);allocate();return out};
 const get=id=>NPC[id]?.name||'성명 미상';
 const parties=c=>{
  const criminal=c.kind==='criminal';
  return '<section class="panel lawsuit-parties"><h3>당사자와 소송대리인 구분</h3><div class="lawsuit-grid"><div><small>'+(criminal?'검사 측':'원고 · 청구인')+'</small><strong>'+h(criminal?get(c.side[0]):get(c.who[0]))+'</strong><p>'+(criminal?'검사 · 공소유지':'원고 본인')+'</p><small>'+h(criminal?'피해자 '+get(c.who[1]):'원고 소송대리인 '+get(c.side[0]))+'</small></div><div><small>'+(criminal?'피고인':'피고 · 청구 상대방')+'</small><strong>'+h(get(criminal?c.who[0]:c.who[1]))+'</strong><p>'+(criminal?'공소사실에 대한 방어':'원고의 청구 상대방')+'</p><small>변호인·대리인 '+h(get(c.side[1]))+'</small></div></div></section>';
 };
 function sheet(c,side){
   const st=S.cases[c.id]||{},pro=side==='claim',cr=c.kind==='criminal',adv=get(c.side[pro?0:1]),pub=c.story?.publicDossier||{},dets=c.story?.evidenceDetails||[];
   const title=cr?(pro?'검사 의견서':'변호인 의견서'):(pro?'원고 준비서면':'피고 준비서면');
   const v=pro?(st.positions?.claimant||pub.plea||c.intro):(st.positions?.respondent||pub.situation||'청구 또는 공소사실 중 입증되지 않은 부분을 다툽니다.');
   const general=pro?'청구 또는 공소사실을 이루는 개별 요건에 관하여 증명 가능한 사실을 제시하고, 제출자료가 뒷받침하는 범위에서 판단받고자 합니다.':'상대방의 주장과 입증된 사실은 구분되어야 합니다. 제출자료의 작성 경위, 사실 인정의 범위 및 법률상 책임의 연결을 엄격히 심리해 주시기 바랍니다.';
   const end=pro?'제출된 자료가 인정되는 범위에서 청구 또는 공소사실에 관하여 판단하여 주시기 바랍니다.':'증명되지 않은 부분에 대한 청구나 공소사실은 받아들이지 말아 주시기 바랍니다.';
   const issues=(pub.issues?.length?pub.issues:[c.sub,c.tag]).filter(Boolean);
   const evidence=c.evidence.map((e,i)=>'<p><b>자료 '+(i+1)+': '+h(e)+'</b></p><p>관련성: '+h(dets[i]?.scope||'쟁점과 관계된 제출 기록')+'. 확인할 한계: '+h(dets[i]?.concern||dets[i]?.status||'원본성과 작성 시점, 상대방의 다툼을 추가 확인할 필요가 있습니다.')+'</p>').join('');
   return '<div class="paper-controls"><span>사건 '+h(c.id)+' · '+h(title)+'</span><button class="btn outline mini" data-action="printBrief">인쇄</button></div><article class="statement-paper"><header><small>THE VERDICT · 가상 재판 기록</small><h2>'+h(title)+'</h2><p>사건번호: '+h(c.id)+'</p><p>사건명: '+h(c.name)+'</p><p>민사 당사자 / 형사 관계인: '+h(get(c.who[0]))+' · '+h(get(c.who[1]))+'</p><p>제출자: '+h(adv)+'</p></header><section><h3>1. 서면의 취지</h3><p>'+h(general)+'</p><p>'+h(end)+'</p></section><section><h3>2. 사건의 경위</h3><p>'+h(c.intro)+'</p><p>'+h(c.story?.relation||'당사자 사이 관계 및 관련 행위는 제출된 기록에 따라 확인할 필요가 있습니다.')+'</p></section><section><h3>3. 당사자 측 구체적 주장</h3><p>'+h(v)+'</p><p>'+h(general)+'</p></section><section><h3>4. 법률상 다툼</h3>'+issues.map((x,i)=>'<p><b>쟁점 '+(i+1)+'. </b>'+h(x)+'. 이 쟁점의 판단에 필요한 사실과 증명 책임을 구분할 필요가 있습니다.</p>').join('')+'</section><section><h3>5. 제출 자료별 입증 취지와 한계</h3>'+evidence+'</section><section><h3>6. 필요한 추가 심리</h3><p>자료 원본의 존재 여부, 작성 시점, 관계인의 직접 경험 및 진술 변화, 반대 자료의 신빙성을 각각 확인해야 합니다. 필요할 경우 사실조회·증인신문·감정을 위하여 기일을 속행할 수 있습니다.</p><p>아직 제출되지 않은 자료를 이미 확인된 증거로 취급해서는 안 되며, 행위의 존재와 법적 책임 사이의 인과관계를 독립적으로 검토해 주시기 바랍니다.</p></section><section><h3>7. 결론</h3><p>'+h(end)+'</p><p>본 서면은 이 사건의 당사자 측 주장으로, 재판부의 사실 인정이나 판결을 미리 확정하지 않습니다.</p></section><footer>'+h(day())+'<br>'+h(adv)+'<br><b>THE VERDICT 재판부 귀중</b></footer></article>';
 }
 court=function(){
  let out=formerCourt(),c=CASES.find(x=>x.id===ui.caseId);
  if(!c||!out.includes('case-advocates'))return out;
  out=out.replace('<section class="case-advocates">',parties(c)+'<section class="case-advocates">');
  for(const [kind,label] of [['prosecution',c.kind==='criminal'?'검사 의견서':'원고 준비서면'],['defense',c.kind==='criminal'?'변호인 의견서':'피고 준비서면']]){
    const a=out.indexOf('<article class="adv-card '+kind+'">');if(a<0)continue;
    const e=out.indexOf('</article>',a);if(e<0)continue;
    out=out.slice(0,e)+'<button class="btn outline full" data-action="openBrief" data-side="'+(kind==='prosecution'?'claim':'respond')+'">📄 '+label+' 전문 읽기 →</button>'+out.slice(e);
  }return out;
 };
 clicker=function(e){
  const a=e.target.closest('[data-action]');
  if(a?.dataset.action==='openBrief'){
   const c=CASES.find(x=>x.id===ui.caseId);if(c)modal('소송 서면 · '+(a.dataset.side==='claim'?'청구·공소 측':'반박·방어 측'),sheet(c,a.dataset.side),'');
   return;
  }if(a?.dataset.action==='printBrief'){window.print();return}
  formerClicker(e);if(a?.dataset.action==='start')allocate();
 };
 if(S.name&&S.week===0&&S.casePacks?.length)allocate();
})();

;/* source: beta_patch_v13.js */
/* THE VERDICT Beta 1.3 — evolving hearings and compact written arguments. */
'use strict';
(()=>{
 const priorCourt=court,priorClick=clicker,priorAdvance=advanceWeek,priorFast=fastForward;
 const esc=s=>h(String(s??''));
 function witnessIds(c){const seen=new Set();return (c.stages||[]).flatMap(s=>s.actions||[]).map(a=>a.who).filter(id=>id&&NPC[id]&&!c.who.includes(id)&&!c.side.includes(id)&&!seen.has(id)&&seen.add(id));}
 function sync(c,st){
  if(!st||st.verdict)return;
  st.hearingRevelations??=[];
  const hist=st.hearingHistory||[];
  const consumed=new Set(st.hearingRevelations.map(e=>e.hearingWeek));
  for(const ev of hist){if(ev.kind!=='resumed'||consumed.has(ev.week))continue;
   const n=st.hearingRevelations.length,details=c.story?.evidenceDetails||[];
   const available=(st.deliveredEvidence||[]).filter(i=>!st.hearingRevelations.some(e=>e.evidenceIndex===i));
   const i=available.length?available[0]:null;
   const people=witnessIds(c), witness=people.length?people[n%people.length]:null;
   let type,body,proof='';
   if(i!==null){const d=details[i]||{};type='추가 자료';body=`${c.evidence[i]}의 제출·확보 경위가 확인됐습니다. ${d.scope||'사실관계와의 관련성을 검토해야 합니다.'}`;proof=d.concern||'증명력과 작성 경위를 상대방이 다툴 수 있습니다.';}
   else if(witness){type='증인·관계인';body=`${NPC[witness].name}(${NPC[witness].role||'관계인'})의 출석 및 진술 확인 단계입니다. 기존 기록과 진술의 일치 여부를 신문해야 합니다.`;proof='증인 출석만으로 진술 내용이 사실이라고 인정되지는 않습니다.';}
   else{type='상대방 반박';body='상대방이 기존 주장과 제출 자료의 신빙성에 대한 추가 검토를 요청했습니다.';proof='별도의 새로운 증거가 입증된 것으로 취급하지 않습니다.';}
   const item={hearingWeek:ev.week,type,body,proof,evidenceIndex:i,witnessId:witness};
   st.hearingRevelations.push(item);consumed.add(ev.week);
  }
 }
 function newArguments(c,st){const pub=c.story?.publicDossier||{};const ev=st.hearingRevelations||[];
  const claim=st.positions?.claimant||pub.plea||'제출한 자료에 따라 청구 또는 공소사실을 인정해 달라는 입장입니다.';
  const respond=st.positions?.respondent||pub.situation||'사실관계와 증거의 신빙성 및 책임 범위를 다툽니다.';
  const latest=ev.slice(-2);const contested=(c.story?.publicDossier?.issues||[]).slice(0,2);
  const format=(side)=>`<div class="compact-brief"><h3>${side==='claim'?(c.kind==='criminal'?'검사 의견 요약':'원고 준비서면 요약'):(c.kind==='criminal'?'변호인 의견 요약':'피고 준비서면 요약')}</h3><p><strong>주장</strong> ${esc(side==='claim'?claim:respond)}</p><p><strong>쟁점</strong> ${esc(contested.join(' · ')||c.sub||c.tag)}</p><p><strong>증거</strong> ${esc((c.evidence||[]).slice(0,2).join(' · ')||'추가 확인 필요')}</p>${latest.length?`<p><strong>새 기일 업데이트</strong> ${esc(latest.map(x=>x.type+' — '+x.body).join(' / '))}</p><p><strong>${side==='claim'?'입증 보완':'반박·검토'}</strong> ${esc(latest[latest.length-1].proof)}</p>`:'<p class="muted"><strong>진행 상황</strong> 아직 추가 기일의 보완 자료가 없습니다.</p>'}<p class="muted small">요약문은 각 측의 주장이지, 법원이 인정한 사실이나 확정 판결이 아닙니다.</p></div>`;
  return `<section class="panel new-hearing-briefs"><div class="row between"><h3 class="no-margin">📄 양측 준비서면 · 기일별 갱신</h3><span class="chip">요약본</span></div><div class="two-briefs">${format('claim')}${format('respond')}</div></section>`;
 }
 function chronology(c,st){const ev=st.hearingRevelations||[];return `<section class="panel hearing-progress"><h3>⚖ 기일별 진행기록</h3>${!ev.length?'<p class="muted small">기일을 지정하면 추가 조사 및 반박 상황이 다음 재판에서 기록됩니다.</p>':ev.slice().reverse().map((e,i)=>`<article class="hearing-reveal"><small>${esc(day(e.hearingWeek))} · 제${ev.length-i+1}회 기일 · ${esc(e.type)}</small><p>${esc(e.body)}</p><p class="muted small">입증상 주의: ${esc(e.proof)}</p>${e.witnessId?`<button class="btn outline mini" data-action="npc" data-id="${esc(e.witnessId)}">👤 ${esc(NPC[e.witnessId]?.name)} 프로필</button>`:''}</article>`).join('')}</section>`;}
 court=function(){let out=priorCourt();const c=CASES.find(x=>x.id===ui.caseId),st=c&&S.cases[c.id];if(!c||!st||!out.includes('beta-court'))return out;sync(c,st);
  const insertion=newArguments(c,st)+chronology(c,st);
  out=out.replace('<section class="panel action-panel">',insertion+'<section class="panel action-panel">');
  if(!out.includes('new-hearing-briefs'))out=out.replace('<section class="panel calendar-panel">',insertion+'<section class="panel calendar-panel">');
  out=out.replace(/<button class="btn outline full brief-open"[\s\S]*?<\/button>/g,'');
  return out;
 };
 advanceWeek=function(...args){const result=priorAdvance(...args);for(const c of CASES){const st=S.cases[c.id];if(st?.hearingHistory?.length)sync(c,st);}return result;};
 fastForward=function(...args){const r=priorFast(...args);for(const c of CASES){const st=S.cases[c.id];if(st?.hearingHistory?.length)sync(c,st);}save();return r;};
 clicker=function(e){priorClick(e);};
})();

;/* source: beta_patch_v14.js */
/* Beta 1.4 witness questioning — uses only existing case testimony. */
'use strict';
(()=>{
const previousCourt=court,previousClick=clicker;
const escape=s=>h(String(s??''));
const available=c=>{const seen=new Set();return(c.stages||[]).flatMap(s=>s.actions||[]).filter(a=>a.who&&NPC[a.who]&&!c.who.includes(a.who)&&!c.side.includes(a.who)&&!seen.has(a.who)&&seen.add(a.who));};
function response(a,type){
if(type==='account')return {q:'당시 직접 보고 들은 내용은 무엇입니까?',text:a.says||'구체적인 진술은 기록에 기재되지 않았습니다.',note:'기존 기록에 있는 진술입니다. 진위 여부는 아직 판단되지 않았습니다.'};
if(type==='source')return {q:'그 사실은 어떻게 알게 됐습니까?',text:'기존 기록에서 확인되는 근거: '+(a.clue||'인지 경위 확인 필요'),note:'직접 목격인지 전달받은 내용인지 추가 검토가 필요합니다.'};
return {q:'이 진술을 뒷받침하는 독립된 증거가 있습니까?',text:'관련 증거: '+(a.clue||'별도로 확인된 자료 없음'),note:'이는 기존 단서이며 진술의 진실성을 자동 입증하지 않습니다.'};
}
function panel(c,st){
const acts=available(c);st.witnessExams??={};
if(!acts.length)return '<section class="panel"><h3>👥 증인·목격자 신문</h3><p class="muted small">현재 사건에 특정된 증인이 없습니다. 실제 기록과 무관한 인물을 추가하지 않습니다.</p></section>';
return '<section class="panel witness-exams"><h3>👥 증인·목격자 신문</h3><p class="muted small">기록에 존재하는 진술만 사용합니다. 인물 카드를 누르면 생애 기록을 열 수 있습니다.</p>'+
acts.map((a,i)=>{const id=a.who,p=NPC[id],records=st.witnessExams[id]||[],done=new Set(records.map(r=>r.type));
const photo=window.verdictPhoto?.(id)||'👤';
return '<article class="witness-person"><button class="witness-name" data-action="npc" data-id="'+escape(id)+'">'+photo+'<span><strong>'+escape(p.name)+'</strong><small>'+escape(p.role||'관계인')+' · 프로필 보기 ›</small></span></button><p class="muted small">관련 기록: '+escape(a.short||a.label||'사실관계 확인')+'</p><div class="witness-questions">'+[['account','사건 당시'],['source','인지 경위'],['proof','증거 대조']].map(([type,label])=>'<button class="btn outline mini" data-action="witnessQuestion" data-id="'+escape(id)+'" data-index="'+i+'" data-type="'+type+'" '+(done.has(type)||st.verdict?'disabled':'')+'>'+(done.has(type)?'✓ ':'')+label+' 질문</button>').join('')+'</div>'+records.map(r=>'<div class="witness-answer"><b>Q. '+escape(r.question)+'</b><p>A. '+escape(r.answer)+'</p><small>'+escape(r.note)+' · '+escape(day(r.week))+'</small></div>').join('')+'</article>';}).join('')+'</section>';
}
court=function(){let html=previousCourt();const c=CASES.find(x=>x.id===ui.caseId),st=c&&S.cases[c.id];if(!c||!st||!html.includes('beta-court'))return html;return html.replace('<section class="panel action-panel">',panel(c,st)+'<section class="panel action-panel">');};
clicker=function(e){const b=e.target.closest('[data-action]');if(b?.dataset.action==='witnessQuestion'){
const c=CASES.find(x=>x.id===ui.caseId),st=c&&S.cases[c.id];if(!c||!st||st.verdict)return;
if(Number.isInteger(st.nextHearingWeek)&&S.week<st.nextHearingWeek){toast('재판 재개 기일 이후 신문할 수 있습니다.');return;}
const a=available(c)[Number(b.dataset.index)],id=b.dataset.id,type=b.dataset.type;if(!a||a.who!==id)return;
st.witnessExams??={};const records=st.witnessExams[id]??=[];if(records.some(r=>r.type===type))return;
const t=response(a,type);records.push({type,question:t.q,answer:t.text,note:t.note,week:S.week});st.clues.push(NPC[id].name+' 증인신문: '+t.note);save();render();toast('증인신문 기록 저장');return;}previousClick(e);};
const css='.witness-person{background:#fff;border:1px solid #d5dbdf;border-radius:13px;padding:14px;margin:12px 0}.witness-name{border:0;background:transparent;cursor:pointer;text-align:left;display:flex;align-items:center;gap:12px;color:inherit}.witness-name .id-portrait{width:48px;height:60px;flex-shrink:0}.witness-name small{display:block;color:#728092}.witness-questions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.witness-answer{padding:11px;margin-top:8px;border-left:3px solid #6d97a7;background:#f0f5f6;border-radius:8px;line-height:1.5}.witness-answer p{margin:8px 0}.witness-answer small{color:#607080}';
const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
})();

;/* source: player_profiles_v20.js */
/* THE VERDICT multi-profile launcher, device-local until cloud backend configured */
'use strict';
(()=>{
const KEY='the_verdict_alpha_1',ACTIVE='verdict_player_active',slot=id=>'verdict_player_save_'+id;
const selected=()=>localStorage.getItem(ACTIVE)||'1';
// The active profile lives only in KEY; its slot copy is written when the player switches profiles.
// (Copying on every save doubled the storage a long career needs.)
const backup=()=>{VerdictStore.flush();const main=localStorage.getItem(KEY);if(main)localStorage.setItem(slot(selected()),main);else localStorage.removeItem(slot(selected()));};
const release=()=>{try{if(localStorage.getItem(KEY))localStorage.removeItem(slot(selected()))}catch{}};
function profileName(id){try{const s=VerdictStore.parse(localStorage.getItem(id===selected()?KEY:slot(id)));return s?.name||'저장된 게임 없음';}catch{return '저장 파일 확인 필요';}}
function change(id){if(!['1','2'].includes(id))return;backup();localStorage.setItem(ACTIVE,id);const v=localStorage.getItem(slot(id));if(v)localStorage.setItem(KEY,v);else localStorage.removeItem(KEY);location.reload();}
const originalSave=save;
save=function(){originalSave();release()};
const originalClick=clicker;
clicker=function(e){const action=e.target.closest('[data-action]')?.dataset.action;if(action==='resetConfirm'){localStorage.removeItem(slot(selected()));}originalClick(e);};
function show(){
if(document.getElementById('verdict-entry'))document.getElementById('verdict-entry').remove();
release();
const id=selected(),has=!!S.name;
const box=document.createElement('div');box.id='verdict-entry';
box.innerHTML='<div class="entry-card"><div style="font-size:28px">⚖️</div><div class="entry-title">THE VERDICT</div><div class="entry-sub">40년 법관 커리어 · 플레이어별 독립된 세계관</div><div class="entry-ver">v'+(window.VERDICT_VERSION||'')+' · '+(window.VERDICT_RELEASED||'')+' 업데이트</div><div class="entry-switch"><button type="button" data-profile="1" class="entry-btn '+(id==='1'?'primary':'')+'">플레이어 1<small>'+escapeHtml(profileName('1'))+'</small></button><button type="button" data-profile="2" class="entry-btn '+(id==='2'?'primary':'')+'">플레이어 2<small>'+escapeHtml(profileName('2'))+'</small></button></div><button class="entry-btn primary" id="profile-continue">'+(has?'이어서 하기':'새 커리어 시작')+'</button><button class="entry-btn" id="profile-reset">이 슬롯에서 새 게임</button><button class="entry-btn" id="profile-import">저장 파일 불러오기 (JSON)</button><div class="entry-info">현재: 플레이어 '+id+' · 이 기기에만 저장됨<br>다른 기기와 동기화하려면 별도의 클라우드 로그인이 필요해요.</div></div>';
document.body.appendChild(box);
const scene=document.createElement('div');scene.className='verdict-brand-scene';scene.setAttribute('aria-label','일러스트 법정과 판사');scene.innerHTML='<span class="scene-flag">🇰🇷</span><span class="scene-seal">⚖</span><span class="scene-judge">👨🏻‍⚖️</span><span class="scene-bench"></span><span class="scene-caption">THE VERDICT · JUDICIAL LIFE</span>';const subtitle=box.querySelector('.entry-sub');if(subtitle)subtitle.insertAdjacentElement('afterend',scene);
box.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>change(b.dataset.profile));
box.querySelector('#profile-continue').onclick=()=>box.remove();
// no confirm(): some in-app browsers block it silently, which made this button do nothing. Ask with a second tap instead.
const resetBtn=box.querySelector('#profile-reset');let armed=false;
resetBtn.onclick=()=>{if(has&&!armed){armed=true;resetBtn.textContent='한 번 더 누르면 이 기기의 모든 기록을 지우고 새로 시작해요';resetBtn.classList.add('danger');setTimeout(()=>{armed=false;resetBtn.textContent='이 슬롯에서 새 게임';resetBtn.classList.remove('danger')},6000);return}resetBtn.disabled=true;resetBtn.textContent='새 게임 준비 중…';wipeGame()};
box.querySelector('#profile-import').onclick=()=>{box.remove();const inp=document.getElementById('importFile');if(inp)inp.click();else {ui.tabletTab='backup';changeTab('tablet');document.getElementById('importFile')?.click();}};
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const st=document.createElement('style');st.textContent='.entry-switch{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:14px 0 22px}.entry-switch .entry-btn{margin:0;padding:13px 5px}.entry-switch small{display:block;opacity:.8;font-size:11px;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';document.head.appendChild(st);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show);else show();
})();

;/* source: beta_narrative_v15.js */
/* Narrative Layer 100 — non-invasive, save-preserving court storyline reader. */
'use strict';
(()=>{
let arcs=new Map(),status='loading';
function esc(s){return h(String(s??''));}
async function load(){
 try{const url=new URL('./content-packs/narrative-100-v1.json',location.href);const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw Error('HTTP '+r.status);
 const j=await r.json();if(j.format!=='the-verdict-narrative-layer/v1'||!Array.isArray(j.arcs)||j.arcs.length!==100)throw Error('서사팩 형식 오류');
 arcs=new Map(j.arcs.map(a=>[a.id,a]));status='ready';if(typeof render==='function')render();
 }catch(e){status='error';console.warn('Narrative pack unavailable:',e);}
}
function panel(c,st){
 const a=arcs.get(c.contentPack?.archetypeId||c.story?.pack?.archetypeId||c.story?.packOrigin?.id);
 if(!a)return '';
 const hearings=(st.hearingHistory||[]).filter(x=>x.kind==='resumed').length;
 const sections=[
 [a.act1.label,a.act1.scene,a.act1.pressure],
 [a.act2.label,a.act2.scene,a.act2.question],
 [a.act3.label,a.act3.claim,a.act3.defense+' '+a.act3.issue],
 ];
 if(hearings>=1)sections.push([a.act4.label,a.act4.exhibit,a.act4.counter]);
 if(hearings>=2)sections.push([a.act5.label,a.act5.exhibit,a.act5.turn]);
 const rows=sections.map((s,i)=>'<article class="verdict-arc-act"><strong>'+esc(s[0])+'</strong><p>'+esc(s[1])+'</p><small>'+esc(s[2])+'</small></article>').join('');
 const future=st.verdict?'<article class="verdict-arc-act"><strong>'+esc(a.aftermath.label)+'</strong><p>'+esc(a.aftermath.immediate)+'</p><small>'+esc(a.aftermath.note)+'</small></article>':'<p class="muted small">새 기일을 진행하면 추가 사건 분석이 열립니다. 서사 해석은 증거 자체가 아닙니다.</p>';
 return '<section class="panel verdict-narrative-layer"><h3>📖 사건의 흐름 · 5막 기록</h3><p class="muted small">기록된 사실·쟁점의 스토리 요약이며 판결 정답은 없습니다.</p>'+rows+future+'</section>';
}
const prior=court;
court=function(){const original=prior();const c=CASES.find(x=>x.id===ui.caseId),st=c&&S.cases[c.id];if(!c||!st||!arcs.size)return original;const extra=panel(c,st);if(!extra)return original;const marker='<section class="panel action-panel">';return original.includes(marker)?original.replace(marker,extra+marker):extra+original;};
const style=document.createElement('style');style.textContent='.verdict-narrative-layer{background:linear-gradient(135deg,#faf8f3,#eff2f3);border:1px solid #ccbca8}.verdict-arc-act{border-left:3px solid #ad8662;margin:12px 0;padding:10px 14px;background:#fff;border-radius:8px}.verdict-arc-act p{margin:8px 0;line-height:1.65}.verdict-arc-act small{color:#61717c;line-height:1.6;display:block}';document.head.appendChild(style);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
