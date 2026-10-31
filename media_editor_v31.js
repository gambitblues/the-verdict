/* THE VERDICT media editor v3 — 20 fictional outlets and case-grounded public reactions */
'use strict';
(()=>{
const OUTLETS=[
'서울법정일보','코리아재판뉴스','오늘의법','중앙사회신문','동부종합일보','한빛경제','산업과법','민생24','시민포커스','라디오정의',
'현장타임즈','로컬이슈','대한저널','재판브리핑','시사돋보기','데이터사회','청년프레스','팩트노트','사회안전통신','오늘의쟁점'
];
const categories={homicide:'강력범죄',sexual:'성범죄',violence:'폭력',financial:'금융·경제',property:'재산',reputation:'온라인 표현',civil:'민사',family:'가사',professional:'노동·의료',public:'행정'};
const fragments=['증거먼저','기록중심','동네주민','법대졸업생','청년취준','회사원','뉴스독자','자영업자','초등학부모','정말궁금','도심산책','밤샘열람','검증중','퇴근길','냉정한눈','법조꿈나무','경제생활','평범한하루','헛소문싫어','인권먼저','균형잡기','원문읽기','시간표확인','증인질문','증거보자'];
const suffix=['_01','_한강','_서울','_88','_법린이','_kt','_나무','_바다','_달','_소금','_용기','_긴급'];
const hash=v=>{let x=2166136261;for(const ch of String(v))x=Math.imul(x^ch.charCodeAt(0),16777619)>>>0;return x>>>0};
const esc=v=>h(String(v??''));
const take=(arr,key)=>arr[hash(key)%arr.length];
function react(c,idx=0){
 const st=S.cases[c.id]||{},closed=!!st.verdict;
 const ev=c.story?.evidenceDetails||[],item=ev[idx%Math.max(1,ev.length)]||{};
 const subject=item.title||'당사자 진술',matter=c.kind==='criminal'?'공소사실':'청구 원인';
 const rel=c.story?.relation||'당사자의 관계',category=c.contentPack?.category||c.story?.pack?.category||'civil';
 const opening=[
  '아직 사실관계가 밝혀지지 않았다면 누군가를 범인처럼 말하는 건 위험해.',
  '피해를 호소한 사람의 목소리를 가볍게 넘기면 안 되지.',
  '검사가 어떤 근거로 기소했는지부터 알려줬으면.',
  '고소·청구가 제기됐다고 책임이 자동 인정되는 건 아니잖아.',
  '이런 사건은 법원에서 충분히 기록을 봐야 할 것 같아.',
  '상대방의 반론이 단순 변명인지 근거 있는 반박인지 궁금하다.',
  '현장을 직접 봤다는 증인의 말도 정확한 시간을 따져야 해.',
  '사건보다 자극적인 제목만 소비하는 분위기가 걱정된다.',
  '피해 회복이 필요하다면 별개로 지원 방법도 고민해야지.',
  '법조인의 유명세와 판결의 질은 정말 별개의 문제야.',
  '증거가 부족한 사건일수록 무죄추정 원칙이 중요해.',
  '진술이 모순된다면 왜 그런 차이가 생겼는지 들어보고 싶다.'
 ];
 const inspection=[
  subject+'의 제출 여부와 원본성을 확인해 봤을까?',
  subject+'만으로 '+matter+'의 모든 요건을 설명할 수 있을까?',
  rel+'라는 사정만으로 법적 책임을 단정할 수는 없어.',
  '시간대별 이동·연락 기록이 어느 진술과 일치하는지도 중요하지.',
  '의혹이 알려지면 당사자들이 겪을 생활 변화도 생각해야 해.',
  '진술자의 직접 경험과 전해 들은 이야기는 다르다.',
  '보도 자료의 일부 발췌 때문에 해석이 달라질 수도 있겠어.',
  '반대신문을 통해 드러날 새로운 정보가 있을지 궁금하다.',
  '아직 공개되지 않은 자료가 있다면 판단을 유보하고 싶다.',
  '법정의 증거능력과 온라인 여론의 확신은 같지 않지.'
 ];
 const closing=closed?[
 '선고 이유가 구체적으로 공개됐으면 좋겠다.',
 '이 결과가 삶에 어떤 변화를 남길지 궁금하다.',
 '판결이 확정돼도 사건 자체가 사라지는 것은 아니지.',
 '법관의 검토 과정이 충분했는지 계속 보게 된다.'
 ]:[
 '기일이 진행되면 다시 판단하겠어.',
 '지금은 한쪽의 설명만 믿기 어렵다.',
 '추가 증거가 나오면 생각이 달라질 수도 있겠다.',
 '내가 판사라면 쉽게 결론 못 내릴 듯.',
 '양측 주장을 다 보고 이야기하자.'
 ];
 const seed=hash(c.id+'-'+idx),message=opening[seed%opening.length]+' '+inspection[Math.floor(seed/3)%inspection.length]+' '+closing[Math.floor(seed/11)%closing.length];
 return {text:message,frame:categories[category]||'사법'};
}
function articles(){
 const entries=[...openCases(),...completed().slice(-12)].filter(c=>c.generated||c.contentPack).slice(0,18);
 const out=[];
 for(const c of entries){
  const st=S.cases[c.id],e=c.story?.evidenceDetails||[],labels=['수사·재판 진행','원본자료 확보 쟁점','반론과 증언','피해와 회복','쟁점 정리'];
  for(let i=0;i<5;i++){
   const key=c.id+'-'+i,co=react(c,i),p=e[i%e.length],angle=take(labels,key);
   const outlet=OUTLETS[(out.length)%OUTLETS.length],proof=p?.title||'핵심 증거';
   const title=(st?.verdict?'[판결 후] ':'')+c.name.replace(/\s*·.*$/,'')+'… '+[ '재판부에 첫 배당',proof+' 원본성 쟁점','검사·원고와 피고 측 논쟁','증인신문에서 무엇이 드러날까','다음 기일과 판결 전망'][i];
   out.push({caseId:c.id,outlet,title,body:co.text,day:st?.closedWeek||c.week,index:i,frame:co.frame});
  }
 }
 return out;
}
function comments(c,qty,offset=0){
 const items=[];
 for(let i=0;i<qty;i++){
  const index=i+offset,id=c.id+'-comment-'+index,handle=fragments[hash(id)%fragments.length]+suffix[(Math.floor(hash(id)/fragments.length))%suffix.length];
  const val=react(c,index);
  items.push({id,handle,text:val.text,likes:hash(id+'likes')%302,reply:hash(id+'reply')%28});
 }
 return items;
}
const card=a=>'<article class="tv-media-card"><div class="tv-media-head"><b>'+esc(a.outlet)+'</b><span>가상 보도 · '+esc(a.frame)+'</span></div><strong>'+esc(a.title)+'</strong><p>'+esc(a.body)+'</p></article>';
function newsFeed(limit=30){
 const list=articles().slice(0,limit);
 return '<div class="tv-news-list">'+(list.length?list.map(card).join(''):'<p class="muted">진행 중 사건의 보도가 여기에 쌓입니다.</p>')+'</div>';
}
function socialFeed(limit=48){
 const cs=[...openCases(),...completed().slice(-6)].filter(c=>c.generated||c.contentPack).slice(0,10);
 const result=[];
 for(const c of cs)result.push(...comments(c,Math.max(8,Math.ceil(limit/Math.max(1,cs.length)))));
 return '<div class="tv-community">'+result.slice(0,limit).map(x=>
  '<article class="tv-post"><div class="tv-user"><b>@'+esc(x.handle)+'</b><small>가상 커뮤니티</small></div>'+
  '<p>'+esc(x.text)+'</p><small>공감 '+x.likes+' · 답글 '+x.reply+'</small></article>').join('')+'</div>';
}
window.VerdictMedia={outlets:OUTLETS,articles,comments,newsFeed,socialFeed};
})();