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