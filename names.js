/* THE VERDICT — Korean names.
 * Surnames follow their real frequency (김·이·박 are common, 제갈·남궁 are rare).
 * Given names depend on gender and birth year: someone born in 1958 is 영숙 or 정호, someone born in 2001 is 서연 or 민준.
 * In the open world, the least-used of a few candidates wins and full names are not repeated, so the cast does not
 * fill up with the same given name under different surnames.
 * For family members, pass only `seed`: the name is then a pure function of the seed, so a relative that was tidied
 * away comes back with the same name.
 */
'use strict';
const VerdictNames=(()=>{
 const SURNAMES=[['김',2140],['이',1470],['박',840],['최',470],['정',440],['강',240],['조',210],['윤',210],['장',200],['임',170],
  ['한',150],['오',150],['서',140],['신',140],['권',140],['황',140],['안',140],['송',130],['류',120],['전',110],['홍',110],['고',90],
  ['문',90],['양',90],['손',90],['배',80],['백',80],['허',70],['유',60],['남',50],['심',50],['노',50],['하',50],['곽',40],['성',40],
  ['차',40],['주',40],['우',40],['구',40],['민',35],['진',35],['나',30],['지',30],['엄',30],['채',25],['원',25],['천',25],['방',22],
  ['공',20],['현',20],['함',18],['변',18],['염',17],['여',15],['추',15],['도',15],['소',15],['석',14],['선',12],['설',10],['마',9],
  ['길',9],['연',9],['위',8],['표',8],['명',6],['기',6],['반',6],['왕',5],['금',5],['옥',5],['육',4],['인',4],['맹',4],['제',4],
  ['모',4],['탁',4],['국',3],['어',3],['은',3],['편',3],['용',3],['예',2],['경',2],['봉',2],['태',2],['목',2],['형',2],['피',2],
  ['두',2],['감',2],['제갈',2],['남궁',2],['황보',2],['선우',2],['독고',1],['사공',1]];
 const TWO=new Set(SURNAMES.filter(x=>x[0].length===2).map(x=>x[0]));
 const TOTAL=SURNAMES.reduce((a,x)=>a+x[1],0);
 const w=s=>s.split(' ');
 /* [birth years up to, male names, female names] */
 const ERAS=[
  [1964,w('영수 영호 영철 정호 성호 상철 광수 종수 영길 병철 동수 재호 춘식 용호 정수 진호 상훈 성수 기철 만수 경호 철수 명수 순철 태식 덕수 길수 창호 한수 봉수 영민 성철 동철 재수 용수 승철 형수 종철 문수 대호 판석 기남 영배 홍식'),
         w('영숙 정숙 순자 영자 영희 정희 미숙 경숙 순희 명숙 옥순 춘자 혜숙 경자 정자 영순 숙자 말순 금순 현숙 미자 선희 은숙 경희 정순 순옥 복순 화자 영옥 인숙 숙희 명자 연희 순영 귀남 점순 정애 희숙 양자 금자 봉순 길자')],
  [1974,w('성진 정훈 상현 준호 성민 동현 재훈 영준 승현 현철 성훈 기현 정민 태호 상우 진우 성우 종현 민수 재민 형준 석진 대성 병훈 창민 광현 우성 용준 경민 상민 동욱 재석 진혁 승호 정석 민호 태준 현수 기훈 장호 병수 윤석'),
         w('미경 은정 지연 현정 수진 미영 은영 선영 혜진 정은 지영 미정 은주 소영 경아 연주 선미 혜영 수정 윤희 미라 정미 혜경 은희 지혜 수연 은경 미선 진희 경미 현주 선주 혜원 은미 정아 영미 주희 미진 성희 유경 명희 경란')],
  [1984,w('지훈 성민 현우 준혁 동훈 정우 상훈 민철 재현 승민 진호 우진 태현 준영 형석 성현 민석 재원 경훈 상욱 현석 지원 영훈 대현 종민 병준 승훈 동민 정환 용석 인호 세훈 성욱 진석 기범 철민 원석 민규 태욱 상진 준기 현진'),
         w('지은 수진 혜진 은지 지현 민정 유진 지혜 은영 소연 혜원 지영 수연 미진 보람 아름 슬기 은비 선영 다영 진아 혜림 정은 수경 윤정 예진 나영 현주 가영 소희 민지 하나 효진 희정 세영 유리 미나 은혜 주연 다혜 영은 수희')],
  [1994,w('민준 현준 지훈 준호 성민 동현 승현 민재 도현 준영 상현 재훈 우현 태윤 건우 성훈 진우 주원 영재 현수 민성 재민 경민 지환 승우 태민 종현 수호 석현 정민 동욱 은호 한별 원준 기현 주호 영민 형우 준서 호진 상빈 규현'),
         w('지원 수빈 유진 민지 지수 서연 예진 혜원 지은 수연 은비 다은 하은 지민 예린 소영 유나 채원 가은 서영 다혜 미소 나연 수아 보미 주희 세희 은지 혜린 아영 예지 한나 소정 다인 연주 은서 지아 소윤 효정 민아 슬비 가람')],
  [2004,w('민준 지호 현우 준서 도윤 건우 우진 시우 지훈 승민 성현 동건 태현 민혁 예준 주원 하준 준혁 은호 승현 지환 재윤 윤호 성빈 시윤 태준 정훈 지성 민규 수현 도훈 한결 이준 연우 서준 유찬 재원 은찬 진혁 우빈 경준 찬영'),
         w('서연 민서 지민 서윤 지유 하은 수아 예은 채원 지원 윤서 서현 다인 예린 수민 은서 하린 지아 유진 나은 가윤 서영 혜인 소율 채은 다연 연서 지수 예서 시은 아린 소윤 수빈 주아 유나 하윤 은채 다현 현지 세은 가현 효린')],
  [9999,w('서준 하준 도윤 시우 은우 이안 지호 예준 유준 주원 수호 지안 선우 이준 로운 시윤 도하 은호 하율 준우 우주 건우 태오 윤우 이현 한결 지후 율 서진 연우 도현 하람 은찬 라온 재이 시후 유찬 단우 이든 온유 다온 해찬'),
         w('서아 하윤 지안 지우 서윤 하은 아린 하린 수아 지아 시아 나은 유나 아윤 채아 이서 서하 윤슬 예나 다온 소율 리아 연우 로아 지유 채원 이나 다인 소이 서우 예린 하율 시은 루아 봄 가온 아인 나윤 새봄 라희 단비 여름')]
 ];
 const female=g=>/여/.test(String(g||''));
 const eraOf=y=>{const n=Number(y)||1985;let i=ERAS.findIndex(e=>n<=e[0]);return i<0?ERAS.length-1:i};
 function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;h^=h>>>16;h=Math.imul(h,2246822507)>>>0;h^=h>>>13;return h>>>0}
 const seeded=seed=>{let n=hash(seed)||1;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}};
 function surname(r){let x=r()*TOTAL;for(const [s,k] of SURNAMES){x-=k;if(x<0)return s}return '김'}
 function given(r,gender,bornYear){
  // mostly the person's own generation, sometimes the one next to it
  let i=eraOf(bornYear);const roll=r();if(roll<.15&&i>0)i--;else if(roll>.85&&i<ERAS.length-1)i++;
  const list=ERAS[i][female(gender)?2:1];return list[Math.floor(r()*list.length)];
 }
 const split=name=>{const n=String(name||'');const two=n.slice(0,2);return TWO.has(two)&&n.length>2?[two,n.slice(2)]:[n.slice(0,1),n.slice(1)]};
 let counts=null,full=null;
 function index(people){counts=new Map();full=new Set();for(const p of Object.values(people||{})){if(!p?.name)continue;full.add(p.name);const g=split(p.name)[1];counts.set(g,(counts.get(g)||0)+1)}}
 /* make({gender,bornYear,rand,people,surname}) for the open world; make({gender,bornYear,seed,surname}) for family. */
 function make(o={}){
  if(o.seed!=null){const r=seeded(o.seed);const s=o.surname||surname(r);return s+given(r,o.gender,o.bornYear)}
  const r=o.rand||Math.random;
  if(!counts||o.people&&!full)index(o.people);
  let best=null;
  for(let k=0;k<12;k++){
   const s=o.surname||surname(r),g=given(r,o.gender,o.bornYear),n=s+g;
   if(full.has(n))continue;
   const score=(counts.get(g)||0)+r()*0.5;
   if(!best||score<best.score)best={n,g,score};
   if(k>=3&&best)break; // the least-used of four fresh candidates
  }
  const pick=best||{n:(o.surname||surname(r))+given(r,o.gender,o.bornYear)+'',g:''};
  full.add(pick.n);counts.set(pick.g,(counts.get(pick.g)||0)+1);
  return pick.n;
 }
 function forget(){counts=null;full=null}
 return {make,split,index,forget,ERAS,SURNAMES};
})();
