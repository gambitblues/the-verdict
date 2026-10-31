/* THE VERDICT v2.8 — fame, career legacy, media visibility and reputation */
'use strict';
(()=>{
 const priorConclude=conclude,priorHome=home,priorPeople=people,priorNPC=popupNPC;
 const cap=v=>Math.min(100,Math.max(0,Math.round(v)));
 const htm=v=>h(String(v??''));
 function award(id,caseObj,grade,role,success){
  const p=NPC[id],lc=p?.legalCareer;if(!lc)return;
  lc.fame=cap((lc.fame||0)+Math.max(2,Math.round(caseObj.importance*2.2+(grade>=80?3:0)+(success===true?3:0))));
  lc.caseCount=(lc.caseCount||0)+1;
  lc.notableCases??=[];
  const entry={caseId:caseObj.id,title:caseObj.name,year:year(),importance:caseObj.importance,role,verdict:S.cases[caseObj.id]?.verdict,grade};
  lc.notableCases.unshift(entry);lc.notableCases=lc.notableCases.slice(0,30);
  if(success===true)lc.goodOutcomes=(lc.goodOutcomes||0)+1;
  if(success===false)lc.unsuccessfulOutcomes=(lc.unsuccessfulOutcomes||0)+1;
  const old=lc.fameLabel||'무명';
  lc.fameLabel=lc.fame>=80?'전국적 인지도':lc.fame>=55?'법조계 유명인':lc.fame>=30?'지역 법조계 주목':'일반 법조인';
  if(old!==lc.fameLabel&&lc.fame>=30){
    remember(id,'법조계 평판',lc.fameLabel+' · '+caseObj.name,caseObj.id);
    if(caseObj.importance>=4)news('법조계 인물 · '+p.name,p.name+' '+p.career+'이(가) '+caseObj.name+'으로 언론의 주목을 받았다. 법률적 실력과 대중 인지도는 구별해야 한다.','법조 뉴스');
  }
 }
 conclude=function(choice){
  const c=CASES.find(x=>x.id===ui.caseId),had=c&&S.cases[c.id]?.verdict;
  const ret=priorConclude(choice);
  if(!c||had||!S.cases[c.id]?.verdict||!c.legalRepresentation)return ret;
  const st=S.cases[c.id],r=c.legalRepresentation,criminal=c.kind==='criminal';
  const winPro=criminal?st.verdict==='guilty':st.verdict==='full';
  const winDef=criminal?st.verdict==='notguilty':st.verdict==='dismiss';
  if(r.prosecutor)award(r.prosecutor,c,st.grade,'검사',winPro);
  if(r.claimant)award(r.claimant,c,st.grade,'원고 대리인',winPro);
  if(r.defendant)award(r.defendant,c,st.grade,'피고 측 변호사',winDef);
  S.legalWorld??={};S.legalWorld.playerFame=cap((S.legalWorld.playerFame||0)+Math.max(1,c.importance*2)+(st.grade>=80?2:0));
  S.legalWorld.playerNotableCases??=[];
  S.legalWorld.playerNotableCases.unshift({id:c.id,title:c.name,year:year(),grade:st.grade});
  S.legalWorld.playerNotableCases=S.legalWorld.playerNotableCases.slice(0,60);
  save();return ret;
 };
 function leaders(){
  const members=(S.legalWorld?.people||[]).filter(id=>NPC[id]?.legalCareer);
  return members.sort((a,b)=>(NPC[b].legalCareer.fame||0)-(NPC[a].legalCareer.fame||0))
   .slice(0,5).map((id,i)=>{
     const p=NPC[id],lc=p.legalCareer;
     return '<button class="court-fame-person" data-action="npc" data-id="'+htm(id)+'"><span>'+String(i+1)+'.</span><b>'+htm(p.name)+'</b><small>'+htm(p.career)+' · 인지도 '+(lc.fame||0)+'/100</small></button>';
   }).join('');
 }
 home=function(){
  const html=priorHome(),f=S.legalWorld?.playerFame||0;
  return html+'<section class="panel court-fame-summary"><div class="row between"><h3>🏅 법조계 평판</h3><span class="chip">나의 인지도 '+f+'/100</span></div><p class="muted small">유명세는 재판의 규모·언론 노출·경력으로 쌓이고 시간이 지나면 줄어듭니다. 공정한 판단력과는 별도입니다.</p><details><summary>주목받는 법조인 TOP 5</summary>'+leaders()+'</details></section>';
 };
 people=function(){
  const html=priorPeople();
  return html+'<section class="panel court-fame-directory"><h3>📣 법조계 인지도</h3><p class="muted small">잘 알려진 검사와 변호사도 무조건 유능하거나 옳은 것은 아닙니다.</p>'+leaders()+'</section>';
 };
 popupNPC=function(id){
  const p=NPC[id],lc=p?.legalCareer;
  if(!lc)return priorNPC(id);
  const recent=(lc.notableCases||[]).slice(0,4).map(x=>'<p class="small">'+htm(x.year)+' · '+htm(x.title)+' · '+htm(x.role)+'</p>').join('');
  const firm=p.career==='변호사'?'<p>'+htm(lc.firmId||'국선 명부')+'</p>':'';
  modal(p.name+' · '+p.career,
    '<div class="court-fame-profile"><b>'+htm(lc.fameLabel||'일반 법조인')+'</b><p>대중 인지도 '+(lc.fame||0)+'/100 · 관여 사건 '+(lc.caseCount||0)+'건</p>'+
    '<p>공판·변론 능력 '+lc.trialSkill+'/100 · 증거 분석 '+lc.evidenceSkill+'/100 · 경력 '+lc.years+'년</p>'+
    firm+'<details><summary>대표 사건과 과거 경력</summary>'+recent+
    (lc.careerHistory||[]).slice(-5).reverse().map(x=>'<p class="small">'+htm(x.year)+' · '+htm(x.reason)+'</p>').join('')+
    '</details></div>','<button class="btn primary full" data-action="dismiss">닫기</button>');
 };
})();