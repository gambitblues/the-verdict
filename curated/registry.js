
/* ---- registry: lookup, name filling, and the 30-case draw ---- */
(()=>{
const list=window.VERDICT_CURATED_PARTS||[];
const cases=Object.fromEntries(list.map(c=>[c.id,c]));
function batchim(w){const s=String(w||'').trim(),last=s.slice(-1);if(/[0-9]/.test(last))return '013678'.includes(last);const c=last.charCodeAt(0);if(c<0xAC00||c>0xD7A3)return false;return (c-0xAC00)%28!==0}
function rieul(w){const s=String(w||'').trim(),last=s.slice(-1),c=last.charCodeAt(0);return c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28===8}
const PAIRS={'이':['이','가'],'가':['이','가'],'은':['은','는'],'는':['은','는'],'을':['을','를'],'를':['을','를'],'과':['과','와'],'와':['과','와'],'아':['아','야'],'야':['아','야']};
function particle(name,p){
 if(p==='으로'||p==='로')return name+(batchim(name)&&!rieul(name)?'으로':'로');
 const pair=PAIRS[p];return name+(pair?(batchim(name)?pair[0]:pair[1]):p);
}
/* {A} → name, {A|이} → name + 이/가. Unknown keys stay readable as a role word.
 * {A>B} → what B calls A as an older sibling-like person, by both sexes: 형·오빠·누나·언니 (names._sex). */
const KIN={'남남':'형','남여':'오빠','여남':'누나','여여':'언니'};
function kin(names,who,by){const sx=names._sex||{},a=sx[who],b=sx[by];return KIN[(a||'남')+(b||'남')]||'형'}
function fill(text,names){
 return String(text||'').replace(/\{([A-Z][0-9]?)(?:>([A-Z][0-9]?))?(?:\|([가-힣]+))?\}/g,(m,key,by,p)=>{
  const n=by?kin(names,key,by):(names[key]||({A:'피고인',B:'상대방',L:'변호사'}[key]||'증인'));return p?particle(n,p):n});
}
/* Courtroom detail (curated/detail*.js) is merged into each case: evidence and witnesses line up by index. */
for(const d of window.VERDICT_CURATED_DETAIL||[]){const c=cases[d.id];if(!c)continue;
 c.evidence=c.evidence.map((e,i)=>({...e,...(d.evidence?.[i]||{})}));
 c.witnesses=c.witnesses.map((w,i)=>({...w,...(d.witnesses?.[i]||{})}));
 for(const k of ['charge','demand','claim','decision','issues','followUps','late','rebut','closing'])if(d[k]!=null)c[k]=d[k];
}
/* Follow-up nodes for later hearings (curated/follow*.js), appended to any written in the detail files. */
for(const d of window.VERDICT_CURATED_FOLLOW||[]){const c=cases[d.id];if(c)c.followUps=[...(c.followUps||[]),...d.nodes]}
/* Gender facts a story depends on. A/B: fixed gender; AB: same or opposite to each other;
 * W: witness index → sameA / sameB / diffA / diffB. Everything else stays random. */
const SEX={
 'beta-homicide-009':{AB:'same',W:{0:'sameA',1:'sameA'}},   // dorm roommates, the dorm supervisor and the student next door
 'beta-family-003':{AB:'diff'},                              // separated parents
 'beta-family-011':{AB:'diff'},                              // former couple who lived together
 'beta-sexual-009':{AB:'diff'},                              // former couple
 'stalking-repeat-contact':{AB:'diff'},                      // met on a blind date
 'beta-reputation-004':{A:'여'},                             // a mom-cafe regular
 'beta-violence-003':{W:{1:'diffB'}},                        // the victim's spouse
 'v6-family-two-journals':{AB:'diff'}                        // separated parents
};
for(const [id,s] of Object.entries(SEX))if(cases[id])cases[id].sex=s;
/* Sex crimes, stalking, marriage, divorce, custody and affairs: the two parties are always of opposite sex.
 * Matched by id, charge, claim and summary so new cases in these categories follow the rule automatically. */
const OPPOSITE=/sexual|stalking|affair|divorce|추행|강간|성폭력|성희롱|촬영물|스토킹|이혼|혼인|부부|불륜|외도|상간|면접교섭|양육|사실혼/;
for(const c of Object.values(cases)){const text=[c.id,c.charge?.name,c.claim?.what,c.summary].join(' ');
 if(OPPOSITE.test(text)&&!c.sex?.AB)c.sex={...(c.sex||{}),AB:'diff'}}
/* Who the parties are, as the story describes them: job, age range, degree, marriage, children.
 * same:'A' = same age as A (roommates, classmates). Applied once when the case is created. */
const PROFILE={
 'murder-campus-conflict':{A:{job:'대학생 (동아리 회장)',age:[23,26],deg:'대학 재학',mar:'미혼'},B:{job:'대학생 (신입 부원)',age:[19,21],deg:'대학 재학',mar:'미혼'}},
 'beta-homicide-005':{A:{job:'요양시설 간호조무사',age:[34,58],deg:'전문학사'},B:{job:'은퇴한 초등학교 교사',age:[83,83],deg:'학사',mar:'사별'}},
 'beta-homicide-009':{A:{job:'공대 3학년',age:[21,24],deg:'대학 재학',mar:'미혼'},B:{job:'대학생',age:[21,24],deg:'대학 재학',mar:'미혼',same:'A'}},
 'beta-homicide-010':{A:{job:'무직 (부모 간병)',age:[38,52]},B:{job:'무직 (투병)',age:[70,84],mar:'사별',kids:3}},
 'beta-homicide-017':{A:{job:'전 스타트업 대표',age:[36,48],deg:'학사'},B:{job:'배달·대리운전 기사',age:[33,47],kids:2,younger:'A'}},
 'sexual-party-allegation':{A:{job:'회사 팀장',age:[40,50],deg:'학사'},B:{job:'회사원 (신입)',age:[23,29],deg:'학사',mar:'미혼'}},
 'beta-sexual-005':{A:{job:'회사원',age:[36,50],deg:'학사',mar:'기혼',kids:2},B:{job:'대학원생',age:[24,32],deg:'학사',mar:'미혼'}},
 'beta-sexual-007':{A:{job:'대학교수',age:[46,62],deg:'박사',mar:'기혼'},B:{job:'박사과정 대학원생',age:[28,38],deg:'석사'}},
 'beta-sexual-009':{A:{job:'게임 개발자',age:[26,38],deg:'학사',mar:'미혼'},B:{job:'디자이너',age:[25,36],deg:'학사',mar:'미혼'}},
 'beta-sexual-014':{A:{job:'회사원',age:[26,32],deg:'학사'},B:{job:'회사원 (선임)',age:[32,45],deg:'학사'}},
 'inherit-family-records':{A:{job:'공장 운영',age:[52,62],mar:'기혼'},B:{job:'프리랜서 번역가',age:[42,52],deg:'학사'}},
 'beta-family-003':{A:{job:'택배 기사',age:[33,48],mar:'별거 중',kids:1},B:{job:'회사원',age:[32,46],mar:'별거 중',kids:1}},
 'beta-family-011':{A:{job:'IT 회사 직원',age:[28,40],deg:'학사',mar:'미혼'},B:{job:'일러스트레이터',age:[27,40],mar:'미혼'}},
 'fraud-community-investment':{A:{job:'카페 운영 (폐업)',age:[45,55]},B:{job:'퇴직 회사원',age:[45,55],same:'A'}},
 'beta-financial-004':{A:{job:'분양대행사 팀장',age:[38,52]},B:{job:'회사원',age:[28,36],mar:'기혼',kids:0}},
 'beta-financial-005':{A:{job:'복지단체 회계 담당',age:[35,58]},B:{job:'아동복지단체 대표',age:[45,65]}},
 'fire-small-business':{A:{job:'분식집 사장',age:[50,59],mar:'기혼'},B:{job:'건물주',age:[58,76]}},
 'beta-property-003':{A:{job:'대학생',age:[21,26],deg:'대학 재학',mar:'미혼'},B:{job:'출판 편집자',age:[28,50],deg:'학사'}},
 'beta-property-009':{A:{job:'중고 명품 위탁판매점 대표',age:[30,39]},B:{job:'회사원',age:[36,52],mar:'이혼'}},
 'defamation-edited-video':{A:{job:'유튜버',age:[25,40]},B:{job:'인터넷 방송인',age:[24,38]}},
 'beta-reputation-002':{A:{job:'AI 음성 합성 개발자',age:[21,29],mar:'미혼'},B:{job:'가수',age:[24,36]}},
 'beta-reputation-004':{A:{job:'회사원',age:[32,45],mar:'기혼',kids:2},B:{job:'국숫집 사장',age:[48,68]}},
 'medical-delayed-notification':{A:{job:'학원 강사 (휴직)',age:[40,44],deg:'학사',mar:'이혼',kids:1},B:{job:'검진센터 병원장',age:[48,66],deg:'박사'}},
 'beta-professional-002':{A:{job:'설비 정비공 (하청)',age:[35,55],deg:'고졸'},B:{job:'부품회사 대표',age:[48,66]}},
 'beta-professional-003':{A:{job:'배터리 회사 대표',age:[48,66]},B:{job:'전 기술 임원',age:[48,58],deg:'석사'}},
 'stalking-repeat-contact':{A:{job:'공무원',age:[30,39],deg:'학사',mar:'미혼'},B:{job:'디자인 회사 직원',age:[26,36],deg:'학사',mar:'미혼'}},
 'beta-violence-003':{A:{job:'택시 기사',age:[40,64]},B:{job:'회사원 (재택근무)',age:[31,42],mar:'기혼',kids:2}},
 'bribe-consulting-contract':{A:{job:'시청 도시개발과장',age:[58,59],deg:'학사',mar:'기혼'},B:{job:'건설 컨설팅 업체 대표',age:[42,60]}},
 'beta-public-005':{A:{job:'구청 환경과 9급 공무원',age:[24,32],deg:'학사'},B:{job:'은퇴한 교사',age:[63,76],deg:'학사'}},
 'rent-unpaid-deposit':{A:{job:'회사원',age:[28,36],mar:'미혼'},B:{job:'임대업',age:[63,78]}},
 /* v6 · cases 31~60 */
 'v6-homicide-cold-storage':{A:{job:'물류센터 야간 현장 관리자',age:[38,52],deg:'전문학사'},B:{job:'냉동창고 하청 작업자',age:[34,48],mar:'기혼',kids:2}},
 'v6-homicide-sea-rescue':{A:{job:'해양경찰 구조대 현장 지휘관',age:[44,55],deg:'학사',mar:'기혼'},B:{job:'해양경찰 구조대원',age:[29,38]}},
 'v6-homicide-parking-14':{A:{job:'수제 맥주 양조장 공동 대표',age:[34,46],deg:'학사'},B:{job:'수제 맥주 양조장 공동 대표',age:[34,46],deg:'학사'}},
 'v6-homicide-ridge-fire':{A:{job:'표고버섯 농부',age:[55,68],deg:'고졸',mar:'기혼'},B:{job:'농부',age:[66,80],deg:'고졸'}},
 'v6-homicide-care-corridor':{A:{job:'장애인 공동생활시설 시설장',age:[48,62],deg:'학사'},B:{job:'시설 입소자',age:[30,55],mar:'미혼',kids:0}},
 'v6-sexual-taxi-gap':{A:{job:'개인택시 기사',age:[48,62],deg:'고졸'},B:{job:'광고회사 직원',age:[26,34],deg:'학사',mar:'미혼'}},
 'v6-sexual-consent-form':{A:{job:'독립 영상 제작사 대표',age:[38,52],deg:'학사'},B:{job:'배우',age:[25,33],deg:'학사',mar:'미혼'}},
 'v6-sexual-lecture-memo':{A:{job:'음대 교수',age:[50,62],deg:'박사',mar:'기혼'},B:{job:'성악 전공 4학년',age:[22,25],deg:'대학 재학',mar:'미혼'}},
 'v6-sexual-hotel-record':{A:{job:'해외영업팀 팀장',age:[40,48],deg:'학사',mar:'기혼'},B:{job:'해외영업팀 대리',age:[28,33],deg:'학사'}},
 'v6-sexual-closed-gym':{A:{job:'실업팀 지도자',age:[45,58],deg:'학사',mar:'기혼'},B:{job:'실업팀 선수',age:[24,29],deg:'학사',mar:'미혼'}},
 'v6-family-guardian-signature':{A:{job:'회사원',age:[50,60],deg:'학사',mar:'기혼'},B:{job:'무직 (부모 돌봄)',age:[48,58]}},
 'v6-family-adoption-record':{A:{job:'번역가',age:[32,40],deg:'학사'},B:{job:'입양 기관 기록관리 책임자',age:[50,62],deg:'석사'}},
 'v6-family-two-journals':{A:{job:'회사원 (단축 근무)',age:[34,44],deg:'학사',mar:'별거 중',kids:1},B:{job:'회사원',age:[35,46],deg:'학사',mar:'별거 중',kids:1}},
 'v6-financial-ghost-payroll':{A:{job:'제조업체 재무 담당 상무',age:[50,58],deg:'학사',mar:'기혼'},B:{job:'제조업체 대표',age:[55,64],deg:'학사'}},
 'v6-financial-2359-trade':{A:{job:'상장사 경영지원 전무',age:[50,60],deg:'석사',mar:'기혼'},B:{job:'퇴직 회사원 (소액주주 모임 대표)',age:[60,70]}},
 'v6-financial-fake-receipts':{A:{job:'병원 구매팀 직원',age:[38,50],deg:'전문학사'},B:{job:'병원장',age:[56,70],deg:'박사'}},
 'v6-property-flood-gate':{A:{job:'한복집 사장 (상인회장)',age:[56,68]},B:{job:'시설 관리업체 대표',age:[45,60],deg:'학사'}},
 'v6-property-returned-painting':{A:{job:'출판사 편집자 (화가의 유족)',age:[48,62],deg:'학사'},B:{job:'미술품 수집가',age:[55,72],deg:'석사'}},
 'v6-property-greenhouse':{A:{job:'딸기 농부',age:[42,56],deg:'학사',mar:'기혼'},B:{job:'물류 창고 개발 사업가',age:[45,60],deg:'학사'}},
 'v6-reputation-whistleblower':{A:{job:'폐수처리 설비 기사',age:[36,48],deg:'전문학사',mar:'기혼',kids:2},B:{job:'환경 시민단체 대표',age:[45,60],deg:'석사'}},
 'v6-reputation-48-hours':{A:{job:'중학교 과학 교사',age:[38,48],deg:'석사'},B:{job:'지역 신문 사회부 기자',age:[29,38],deg:'학사'}},
 'v6-reputation-meeting-tape':{A:{job:'철물점 사장 (재개발 추진위 총무)',age:[58,70]},B:{job:'편의점 점원 (세입자 모임 대표)',age:[34,48]}},
 'v6-professional-robot':{A:{job:'물류센터 피킹 작업자',age:[29,45]},B:{job:'물류센터 운영사 대표',age:[45,58],deg:'석사'}},
 'v6-professional-late-brief':{A:{job:'자영업자',age:[48,60]},B:{job:'변호사',age:[40,50],deg:'학사'}},
 'v6-professional-shift-minutes':{A:{job:'부품 공장 근로자 (근로자 대표)',age:[42,54],deg:'고졸'},B:{job:'부품 회사 대표',age:[45,60],deg:'학사'}},
 'v6-violence-rescue-push':{A:{job:'자전거 가게 사장',age:[42,58]},B:{job:'회사원',age:[30,45]}},
 'v6-violence-final-bout':{A:{job:'회사원 (아마추어 격투기 선수)',age:[24,32],mar:'미혼'},B:{job:'헬스 트레이너 (아마추어 격투기 선수)',age:[24,32],mar:'미혼'}},
 'v6-public-landslide-alert':{A:{job:'과수원 농부',age:[52,68]},B:{job:'군청 재난안전과장',age:[48,58],deg:'학사'}},
 'v6-public-lottery-rank':{A:{job:'식당 주방 직원',age:[34,44],kids:2},B:{job:'주택공사 선정 담당 부장',age:[48,58],deg:'학사'}},
 'v6-civil-shaded-roof':{A:{job:'은퇴한 회사원',age:[62,76],mar:'기혼'},B:{job:'상가 건물주',age:[48,65]}}
};
for(const [id,p] of Object.entries(PROFILE))if(cases[id])cases[id].profile=p;
window.VerdictCurated={cases,ids:Object.keys(cases),fill,particle,active:list.length>0};
if(typeof CasePackEngine!=='undefined'&&list.length){
 const basePool=CasePackEngine.pool;
 CasePackEngine.pool=save=>{const all=basePool(save),cur=all.filter(x=>cases[x.a.id]);return cur.length?cur:all};
 CasePackEngine.choose=(save,random)=>{const a=CasePackEngine.pool(save);return a.length?a[Math.floor(random()*a.length)]:null};
}
})();
