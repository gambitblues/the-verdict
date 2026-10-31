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
 const criminal=c.kind==='criminal',s=S.cases[c.id]||{},closed=!!s.verdict;
 const e=(c.story?.evidenceDetails||[]),main=(e[idx%e.length]||{}),subject=main.title||'관련 기록';
 const category=c.contentPack?.category||c.story?.pack?.category||'civil';
 const frame=categories[category]||'사법';
 const lines=closed?[
 '판결이 나왔지만 '+subject+'의 해석은 다시 살펴볼 필요가 있어 보인다.',
 '재판 기록을 먼저 읽고 이번 판결의 이유를 판단해야 한다.',
 '당사자들의 이후 생활도 중요하지만 최종 선고와 사실 인정은 구별해야 한다.',
 '유명세보다는 증거와 법적 요건을 얼마나 검토했는지가 중요하다.'
 ]:[
 '어떤 쪽 말이 맞는지 '+subject+'의 원본을 봐야 알겠다.',
 '제목만으로는 판단하기 어렵다. '+subject+'이 실제로 무엇을 입증하는지가 핵심.',
 '목격자가 직접 본 내용과 전해 들은 내용을 구분했으면 좋겠다.',
 '단정적인 비난은 섣부르다. 양쪽 주장을 모두 확인해야 한다.',
 '증거가 확보되지 않았다면 더 조사해야 하지 않을까?',
 (criminal?'검사의 기소와 유죄 인정은 다르다.':'손해를 주장하는 것과 배상책임은 별개다.')+' 진행을 지켜보겠다.'
 ];
 return {text:lines[(idx+hash(c.id))%lines.length],frame};
}
function articles(){
 const entries=[...openCases(),...completed().slice(-12)].filter(c=>c.generated||c.contentPack).slice(0,18);
 const out=[];
 for(const c of entries){
  const st=S.cases[c.id],e=c.story?.evidenceDetails||[],labels=['수사·재판 진행','원본자료 확보 쟁점','반론과 증언','피해와 회복','쟁점 정리'];
  for(let i=0;i<5;i++){
   const key=c.id+'-'+i,co=react(c,i),p=e[i%e.length],angle=take(labels,key);
   const outlet=OUTLETS[(out.length)%OUTLETS.length],proof=p?.title||'핵심 증거';
   const title=(st?.verdict?'[판결 후] ':'')+c.name.replace(/\s*·.*$/,'')+'… '+(i===0?'재판 시작':i===1?proof+' 확인 필요':i===2?'양측 의견 충돌':i===3?'관련인 증언 주목': '최종 판단은 증거에');
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