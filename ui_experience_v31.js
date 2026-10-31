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
 if(hour>=22)candidate.setDate(candidate.getDate()+1),candidate.setHours(10);
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
 return '<button class="tv-case" data-action="openCase" data-id="'+esc(c.id)+'"><span class="tv-case-tag">'+esc(c.kind==='criminal'?'형사':'민사·가사')+'</span><strong>'+esc(c.name)+'</strong><small>'+(waiting?'후속 기일 준비 중':st?.phase>=3?'선고 검토':'심리 진행 중')+'</small><span aria-hidden="true">›</span></button>';
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