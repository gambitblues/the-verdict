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