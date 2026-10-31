/* THE VERDICT — media outlets, one clock home, tablet. */

;/* media_editor_v31.js */
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

;/* ui_experience_v31.js */
/* THE VERDICT — one clock, concise home and a player-facing tablet */
'use strict';
(()=>{
const esc=x=>h(String(x??''));
const tabletBase=tabletInner,baseShell=shell,priorClick=clicker;
const APP=[['news','📰','기사'],['social','＃','여론'],['rank','🏆','법조계 랭킹'],['messages','💬','메시지'],['archives','⚖','판결 기록'],['career','🎖','나의 커리어'],['notes','📝','메모'],['save','💾','저장']];
function clockData(){
 const d=new Date(),worldDays=Math.max(0,S.week*7+(S.realtimeInbox?.dayProgress||0));
 const gameDay=new Date(Date.UTC(2027,2,1)+worldDays*86400000);
 const gameDate=[gameDay.getUTCFullYear(),String(gameDay.getUTCMonth()+1).padStart(2,'0'),String(gameDay.getUTCDate()).padStart(2,'0')].join('.');
 const format=()=>d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
 const hour=d.getHours(),candidate=new Date(d);candidate.setMinutes(0,0,0);
 if(hour>=21)candidate.setDate(candidate.getDate()+1),candidate.setHours(10);
 else if(hour<10)candidate.setHours(10);
 else candidate.setHours(hour+1);
 return {time:format(),gameDate,next:candidate.toLocaleString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}),weekday:d.toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'})};
}
function priority(){
 const db=S.realtimeInbox,now=Date.now();
 const offers=(db?.offers||[]).filter(o=>o.status==='available'&&o.expires>now).sort((a,b)=>b.created-a.created);
 const limit=db?.acceptedByDay?.[new Date().toLocaleDateString('sv-SE')]||0;
 return '<section class="panel tv-inbox"><div class="row between"><h3>📨 신규 사건</h3><small>오늘 '+limit+'/4건 선택</small></div>'+
 (offers.length?offers.slice(0,4).map(o=>'<div class="tv-offer"><div><b>'+esc(o.title)+'</b><small>'+esc(o.tag)+'</small></div><button class="btn primary mini" data-action="acceptDocket" data-slot="'+esc(o.slot)+'" '+(limit>=4||openCases().length>=12?'disabled':'')+'>수락</button></div>').join(''):'<p class="muted small">새로운 사건은 매일 10:00–22:00 사이에 들어옵니다.</p>')+'</section>';
}
function hearingCard(c){
 const st=S.cases[c.id],waiting=st?.liveHearing&&!st.liveHearing.done&&st.liveHearing.until>Date.now();
 return '<button class="tv-case" data-action="openCase" data-id="'+esc(c.id)+'"><span class="tv-case-tag">'+esc(c.kind==='criminal'?'형사':'민사·가사')+'</span><strong>'+esc(c.name)+'</strong><small>'+(window.VerdictTrialPlay?esc(VerdictTrialPlay.stage(c,st).text):(waiting?'후속 기일 준비 중':st?.phase>=3?'선고 검토':'심리 진행 중'))+'</small><span aria-hidden="true">›</span></button>';
}
home=function(){
 if(!S.name)return '<div class="panel">판사 프로필을 생성해 커리어를 시작하세요.</div>';
 const t=clockData(),cases=openCases().slice(0,5),articles=window.VerdictMedia?.articles().slice(0,4)||[];
 return '<div class="tv-home"><section class="tv-welcome"><div><span class="eyebrow">THE VERDICT · JUDICIAL CAREER</span><h2>오늘도 법정은 열립니다.</h2><p>'+esc(S.name)+' 판사 · '+esc(S.post)+' · 진행 중 '+openCases().length+'건</p></div><div class="tv-judge-photo">'+avatar('self')+'</div></section>'+
 '<section class="tv-clock"><div><small>실제 현재시간</small><strong class="tv-clock-local">'+esc(t.time)+'</strong><span>'+esc(t.weekday)+'</span></div><div><small>게임 세계의 날짜</small><strong>'+esc(t.gameDate)+'</strong><span>현실 3시간 = 게임 1일</span></div><div><small>다음 배당</small><strong class="tv-clock-next">'+esc(t.next)+'</strong><span>10:00–22:00 · 매시 정각</span></div></section>'+
 priority()+
 '<section class="tv-open-cases"><div class="row between"><h3>⚖ 진행 중인 재판</h3><button class="btn ghost mini" data-action="tab" data-tab="courtList">전체 사건</button></div>'+
 (cases.length?cases.map(hearingCard).join(''):'<p class="muted">배당된 사건이 없습니다.</p>')+'</section>'+
 '<section class="tv-headlines"><div class="row between"><h3>📰 오늘의 기사</h3><button class="btn ghost mini" data-action="tablet" data-sub="news">기사 더보기</button></div>'+
 (articles.length?articles.map(a=>'<button class="tv-headline" data-action="tablet" data-sub="news"><small>'+esc(a.outlet)+'</small><b>'+esc(a.title)+'</b></button>').join(''):'<p class="muted small">사건이 발생하면 언론 보도가 기록됩니다.</p>')+'</section></div>';
};
function ranking(){
 const ids=(S.legalWorld?.people||[]).filter(id=>NPC[id]?.legalCareer);
 const categories=[['judge','판사'],['prosecutor','검사'],['lawyer','변호사']];
 const sorted=(role)=>ids.filter(id=>NPC[id].legalCareer.role===role).sort((a,b)=>(NPC[b].legalCareer.fame||0)-(NPC[a].legalCareer.fame||0)||NPC[b].legalCareer.trialSkill-NPC[a].legalCareer.trialSkill);
 return '<div class="tv-ranking"><h2>🏆 법조계 랭킹</h2><p class="muted small">가상 법조인의 인지도·실력·대표 사건이 누적돼. 유명세는 법적 책임과 별개야.</p>'+
 '<div class="tv-my-fame"><b>나의 법조계 인지도</b><strong>'+(S.legalWorld?.playerFame||0)+'/100</strong></div>'+
 categories.map(([role,label])=>'<section class="tv-rank-group"><h3>'+label+'</h3>'+
 (sorted(role).slice(0,8).map((id,i)=>{
 const p=NPC[id],c=p.legalCareer,firm=(S.legalWorld?.firms||[]).find(f=>f.id===c.firmId);
 return '<button class="tv-rank-person" data-action="npc" data-id="'+esc(id)+'"><b>'+String(i+1)+'. '+esc(p.name)+'</b><span>'+(firm?esc(firm.name)+' · ':'')+'경력 '+c.years+'년</span><strong>인지도 '+(c.fame||0)+'</strong></button>';
 }).join('')||'<p class="muted small">해당 분야 인물이 아직 없습니다.</p>')+'</section>').join('')+
 '<details class="tv-law-firms"><summary>전체 로펌 명부 및 등급</summary>'+(S.legalWorld?.firms||[]).map(x=>'<p>'+esc(x.name)+' · 등급 '+x.tier+'/5</p>').join('')+'</details></div>';
}
tabletInner=function(){
 if(ui.tabletTab==='rank')return ranking();
 if(ui.tabletTab==='news')return '<h2>📰 법조·사회 뉴스</h2><p class="muted small">가상 언론사 20곳의 사건별 보도. 각 기사는 게임 내 사건에 기반합니다.</p>'+(window.VerdictMedia?.newsFeed(70)||'');
 if(ui.tabletTab==='social')return '<h2>＃ 시민광장 · 여론</h2><p class="muted small">가상 이용자들의 의견입니다. 댓글 수나 여론은 증거가 아닙니다.</p>'+(window.VerdictMedia?.socialFeed(90)||'');
 if(ui.tabletTab==='settings')return '<h2>⚙ 설정 · 기기 이전</h2><p>진행은 자동 저장되고, 브라우저를 닫아도 같은 기기에서 이어할 수 있어요.</p><details><summary>고급 백업 / 다른 기기로 파일 옮기기</summary><div class="save-buttons"><button class="btn outline" data-action="export">파일로 백업</button><button class="btn outline" data-action="import">백업 파일 불러오기</button></div><input id="importFile" type="file" accept="application/json,.json"></details><p class="muted small">브라우저 데이터 삭제 또는 시크릿 모드에서는 저장이 사라질 수 있습니다. 계정 간 클라우드 동기화는 아직 지원하지 않습니다.</p>';
 return tabletBase();
};
tablet=function(){
 const visible=APP.filter(a=>a[0]!=='save');
 return heading('나의 태블릿','기록과 인물, 뉴스를 확인합니다.')+
 '<div class="tv-tablet-top"><span>THE VERDICT OS</span><span>자동 저장 켜짐</span></div>'+
 '<div class="tv-tablet-apps">'+visible.map(([id,icon,label])=>'<button class="tv-tablet-app'+(ui.tabletTab===id?' selected':'')+'" data-action="tablet" data-sub="'+id+'"><span>'+icon+'</span><b>'+label+'</b></button>').join('')+
 '<button class="tv-tablet-app" data-action="safeSave"><span>💾</span><b>저장</b></button></div>'+
 '<div class="tv-save-status" id="verdict-save-status">자동 저장 중 · 브라우저를 닫아도 같은 기기에서 이어할 수 있어요.</div>'+
 '<section class="panel tv-tablet-body">'+tabletInner()+'</section>'+
 '<button class="tv-settings-link" data-action="tablet" data-sub="settings">⚙ 설정 · 기기 이전</button>';
};
shell=function(content){
 let out=baseShell(content);
 out=out.replace(/<div class="quick-top">[\s\S]*?<\/div>/,'');
 out=out.replace(/<span class="date-pill">[\s\S]*?<\/span>/,'<span class="date-pill">⏱ '+esc(clockData().time)+'</span>');
 out=out.replace(/<div class="side-bottom">[\s\S]*?<\/div>/,
  '<div class="side-bottom">실시간 커리어 · 자동 저장<br><span class="muted">현실 3시간 = 게임 1일</span></div>');
 return out;
};
clicker=function(e){
 const el=e.target.closest('[data-action]');
 if(el?.dataset.action==='saveHub'||el?.dataset.action==='snsHub'){
   ui.tabletTab=el.dataset.action==='saveHub'?'settings':'social';changeTab('tablet');return;
 }
 return priorClick(e);
};
function updateClocks(){
 const root=document.querySelector('.tv-clock');if(!root)return;
 const data=clockData();
 const now=root.querySelector('.tv-clock-local'),next=root.querySelector('.tv-clock-next');
 if(now)now.textContent=data.time;
 if(next)next.textContent=data.next;
}
setInterval(updateClocks,60000);
})();

;/* court_reasoning_v31.js */
/* THE VERDICT hearing decision refinement — inspect evidence and choose reasoning, not single-tap progression. */
'use strict';
(()=>{
const previousClick=clicker,previousCourt=court,oldEvaluate=StoryEngine.evaluate;
const esc=v=>h(String(v??''));
const strategies=[
 {id:'origin',label:'원본·취득 경위를 확인한다',summary:'자료의 작성 시각, 보관자, 누락 구간부터 심리',flag:'chain'},
 {id:'contradiction',label:'서로 다른 진술을 대조한다',summary:'검사·원고와 피고 측 설명의 충돌을 신문',flag:'cross'},
 {id:'alternative',label:'다른 가능성도 검증한다',summary:'행위자 특정, 인과관계 및 반대 증거까지 검토',flag:'elements'}
];
function showOptions(c,index){
 const st=S.cases[c.id],a=c.stages?.[st.phase]?.actions?.[index];
 if(!a)return;
 ui.pendingHearing={caseId:c.id,index,phase:st.phase};
 const details=c.story?.evidenceDetails||[],e=details[Math.min(st.phase,details.length-1)];
 const proof=e?.title||'재판 기록';
 const html='<div class="tv-court-deliberation"><b>선택한 심리</b><p>'+esc(a.label||a.short)+'</p><div class="notice">핵심 자료: '+esc(proof)+'</div><p>어떤 관점에서 심리할까요? 선택은 판사의 심리 기록에 남습니다.</p>'+
 strategies.map(x=>'<button class="tv-reason" data-action="courtReason" data-method="'+x.id+'"><b>'+esc(x.label)+'</b><small>'+esc(x.summary)+'</small></button>').join('')+'</div>';
 modal('재판부의 검토 방향',html,'<button class="btn outline full" data-action="dismiss">나중에 결정</button>');
}
clicker=function(e){
 const b=e.target.closest('[data-action]');if(!b)return;
 if(b.dataset.action==='courtStep'){
   const c=CASES.find(x=>x.id===ui.caseId);
   if(!c?.stages?.[S.cases[c.id]?.phase])return previousClick(e);
   showOptions(c,Number(b.dataset.i));return;
 }
 if(b.dataset.action==='courtReason'){
  const pending=ui.pendingHearing,c=pending&&CASES.find(x=>x.id===pending.caseId),st=c&&S.cases[c.id],m=strategies.find(x=>x.id===b.dataset.method);
  if(!m||!c||!st||st.phase!==pending.phase||st.verdict||st.liveHearing&&!st.liveHearing.done&&st.liveHearing.until>Date.now())return;
  st.reasonedChoices??=[];
  const a=c.stages[st.phase].actions[pending.index];
  if(!a)return;
  st.reasonedChoices.push({phase:st.phase,method:m.id,label:m.label,action:a.label,week:S.week});
  ui.pendingHearing=null;ui.modal=null;
  const previous=st.actions.length;
  courtStep(pending.index);
  if(st.actions.length>previous){
    st.actions[st.actions.length-1].says+=' 판사는 '+m.label+'는 검토 기준을 명시했다.';
    st.clues.push('심리 관점: '+m.summary);
    save();render();
  }
  return;
 }
 return previousClick(e);
};
StoryEngine.evaluate=function(c,selected,decision){
 const result=oldEvaluate(c,selected,decision);
 if(!result)return result;
 const st=S.cases[c.id],choices=st?.reasonedChoices||[];
 const variety=new Set(choices.map(x=>x.method)).size;
 return {...result,score:Math.min(100,result.score+Math.min(5,variety+Math.max(0,choices.length-2))),
 why:(result.why||'')+' 판사가 기록한 심리 방향 '+choices.length+'건과 검토 관점 '+variety+'유형을 확인했다.'};
};
court=function(){
 let text=previousCourt(),c=CASES.find(x=>x.id===ui.caseId),st=c&&S.cases[c.id];
 if(!c||!st||st.verdict||st.phase!==3)return text;
 const min=c.importance>=4?4:c.importance>=2?2:1,done=(st.hearingHistory||[]).filter(x=>x.kind==='resumed').length;
 const waiting=st.liveHearing&&!st.liveHearing.done&&st.liveHearing.until>Date.now();
 if(done>=min&&!waiting)return text;
 text=text.replace(/(<button\b[^>]*\bdata-action="verdict"[^>]*)(>)/g,'$1 disabled aria-disabled="true"$2');
 const reason=waiting?'다음 기일이 아직 도래하지 않았습니다.':'추가 기일 '+(min-done)+'회가 필요합니다.';
 text=text.replace('<section class="panel action-panel">','<section class="panel action-panel"><p class="notice">🔒 선고 대기 · '+esc(reason)+'</p>');
 return text;
};
})();
