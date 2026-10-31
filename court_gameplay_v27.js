/* THE VERDICT v2.7 — focused courtroom user interface
   Keeps original court controls and events; rearranges their existing DOM nodes. */
'use strict';
(()=>{
 const priorCourt=court,priorClick=clicker;
 const tabs=[['hearing','⚖','심리·판결'],['arguments','📄','양측 주장'],['evidence','🔎','증거·증인'],['history','▤','재판 기록']];
 const esc=v=>h(String(v??''));
 let lastCase=null;
 function element(tag,className,html){
  const e=document.createElement(tag);if(className)e.className=className;if(html!==undefined)e.innerHTML=html;return e;
 }
 function findAll(root,selector){return Array.from(root.querySelectorAll(selector))}
 function move(target,node){if(node&&node.isConnected!==false)target.appendChild(node)}
 function groupDisclosure(title,node){
  const wrapper=element('details','court-detail-archive');
  wrapper.innerHTML='<summary>'+esc(title)+'</summary>';
  wrapper.appendChild(node);return wrapper;
 }
 court=function(){
  const prior=priorCourt(),c=CASES.find(x=>x.id===ui.caseId),st=c&&S.cases[c.id];
  if(!c||!st||!prior.includes('beta-court'))return prior;
  // Parse DOM, move each interactive existing component only once.
  const temp=document.createElement('template');temp.innerHTML=prior;
  const original=temp.content.querySelector('.beta-court');if(!original)return prior;
  if(lastCase!==c.id){ui.courtFocus='hearing';lastCase=c.id}
  const focus=tabs.some(t=>t[0]===ui.courtFocus)?ui.courtFocus:'hearing';
  const claim=original.querySelector('.case-advocates.editorial-advocates')||original.querySelector('.case-advocates');
  const overview=original.querySelector('.case-narrative');
  const action=original.querySelector('.action-panel');
  const hearing=original.querySelector('.live-hearing-panel');
  const counsel=original.querySelector('.counsel-ability');
  const parties=original.querySelector('.lawsuit-parties');
  const witnessSummary=original.querySelector('.compact-case-witness');
  const evidence=original.querySelector('.evidence-panel');
  // Identify the interactive witness panel by contents instead of a brittle CSS class name.
  const special=findAll(original,'section.panel').filter(x=>
   x!==overview&&x!==claim&&x!==action&&x!==hearing&&x!==counsel&&x!==parties&&x!==witnessSummary&&x!==evidence);
  const hearingExtra=special.filter(x=>!!x.querySelector('[data-action="witnessQuestion"],[data-action="dramaAsk"],[data-action="activateWitnesses"]'));
  const metadata=special.filter(x=>x.classList.contains('new-hearing-briefs')||x.classList.contains('verdict-arc')||x.classList.contains('deep-drama')||x.classList.contains('verdict-narrative-layer'));
  const logPanels=special.filter(x=>!hearingExtra.includes(x)&&!metadata.includes(x)&&!x.classList.contains('calendar-panel'));
  const ready=(st.hearingHistory||[]).filter(x=>x.kind==='resumed').length;
  const status=st.verdict?'선고 완료':st.liveHearing&&!st.liveHearing.done&&Date.now()<st.liveHearing.until?'다음 기일 대기':st.phase>=3?'선고 검토':'심리 '+Math.min(3,st.phase+1)+'/3';
  const header=element('header','court-play-header',
   '<div class="court-case-kicker">THE VERDICT <span>·</span> '+esc(c.kind==='criminal'?'형사 재판':'민사·가사 재판')+'</div>'+
   '<div class="court-play-title"><h2>'+esc(c.name)+'</h2><button class="btn outline mini" data-action="tab" data-tab="courtList">사건 목록</button></div>'+
   '<div class="court-play-status"><span>사건 '+esc(c.id)+'</span><span>'+esc(status)+'</span><span>기일 '+ready+'회</span></div>');
  const page=element('div','court-play');
  page.appendChild(header);
  if(overview){overview.classList.add('court-play-overview');page.appendChild(overview)}
  const nav=element('nav','court-play-tabs');
  nav.setAttribute('aria-label','재판 화면 메뉴');
  for(const [key,icon,label] of tabs){
   const b=element('button','court-play-tab'+(focus===key?' active':''),'<span aria-hidden="true">'+icon+'</span> '+label);
   b.type='button';b.dataset.action='courtFocus';b.dataset.focus=key;b.setAttribute('aria-pressed',String(focus===key));
   nav.appendChild(b);
  }
  page.appendChild(nav);
  const screens={};
  for(const [key] of tabs){
   const panel=element('section','court-screen court-screen-'+key);panel.hidden=focus!==key;
   panel.setAttribute('aria-label',tabs.find(x=>x[0]===key)[2]);page.appendChild(panel);screens[key]=panel;
  }
  if(hearing)screens.hearing.appendChild(hearing);
  if(action)screens.hearing.appendChild(action);
  if(!hearing&&!action)screens.hearing.appendChild(element('section','panel','<p>현재 진행할 심리가 없습니다. 사건 기록을 확인해 주세요.</p>'));
  if(claim)screens.arguments.appendChild(claim);
  if(parties)screens.arguments.appendChild(groupDisclosure('당사자·대리인 확인',parties));
  if(counsel)screens.arguments.appendChild(groupDisclosure('검사·변호사 경력과 능력',counsel));
  if(evidence)screens.evidence.appendChild(evidence);
  if(witnessSummary)screens.evidence.appendChild(witnessSummary);
  for(const x of hearingExtra)screens.evidence.appendChild(x);
  for(const x of metadata)if(!x.parentElement?.closest('.court-screen'))screens.history.appendChild(groupDisclosure(x.querySelector('h3')?.textContent||'사건 추가 자료',x));
  const extras=findAll(original,'section.panel').filter(x=>
   x!==overview&&x!==claim&&x!==hearing&&x!==action&&x!==parties&&x!==counsel&&x!==witnessSummary&&x!==evidence&&
   !hearingExtra.includes(x)&&!metadata.includes(x)&&!x.classList.contains('calendar-panel')&&
   !x.closest('.court-screen'));
  for(const node of [...logPanels,...extras])if(node.parentElement&&!node.closest('.court-screen')&&!node.classList.contains('calendar-panel'))
    screens.history.appendChild(groupDisclosure(node.querySelector('h3')?.textContent||'추가 기록',node));
  if(!screens.history.children.length)screens.history.appendChild(element('section','panel','<p>진행된 기일과 조사 기록이 쌓이면 여기에 표시됩니다.</p>'));
  if(!screens.evidence.children.length)screens.evidence.appendChild(element('section','panel','<p>추가 조사 자료가 아직 없습니다.</p>'));
  // On rerender, reset view focus only when a new case is selected.
  return page.outerHTML;
 };
 clicker=function(e){
  const b=e.target.closest('[data-action]');
  if(b?.dataset.action==='courtFocus'){
   if(!tabs.some(x=>x[0]===b.dataset.focus))return;
   ui.courtFocus=b.dataset.focus;render();return;
  }
  return priorClick(e);
 };
})();