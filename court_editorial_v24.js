/* THE VERDICT v2.4 — specific case summary, opposed submissions, and witnesses across 100 archetypes */
'use strict';
(()=>{
let editorial=new Map(),forensic={},ready=false;
const esc=v=>h(String(v??''));
const name=id=>NPC[id]?.name||'성명 미상';
function caseId(c){return c.contentPack?.archetypeId||c.story?.pack?.archetypeId||c.story?.packOrigin?.id||null}
function info(c){const a=editorial.get(caseId(c));return a?{a,f:forensic[a.id]||a.details||{},criminal:c.kind==='criminal'}:null}
function dispute(c,ctx){
 const {a,f,criminal}=ctx;
 const defendant=name(criminal?c.who?.[0]:c.who?.[1]),victim=name(criminal?c.who?.[1]:c.who?.[0]);
 const place=f.place||a.location||'사건 현장',time=f.when||'사건 발생일';
 const action=f.method||a.allegation;
 const short=criminal?
   ('피고인 '+defendant+': '+place+'에서 '+action+'. 피해자·신고인 '+victim+'; 행위와 증거가 쟁점이다.'):
   (victim+'이(가) '+defendant+'을(를) 상대로 '+a.allegation+'에 관하여 청구했다. 계약·행위와 손해의 입증 범위를 다툰다.');
 return short;
}
function witnesses(c,ctx){
 const st=S.cases[c.id]||{},base=[...new Set((c.stages||[]).flatMap(x=>x.actions||[]).map(x=>x.who).filter(id=>id&&NPC[id]&&!c.who?.includes(id)&&!c.side?.includes(id)))];
 const added=(st.drama?.castIds||[]).filter(id=>NPC[id]);
 const ids=[...new Set([...added,...base])].slice(0,3),roles=ctx.a.witnessRoles||[];
 const panel='<section class="panel compact-case-witness"><h3>👥 사건 관계인 · 증인</h3><div class="compact-witness-row">'+
 ids.map((id,i)=>'<button class="compact-witness-person" data-action="npc" data-id="'+esc(id)+'"><strong>'+esc(name(id))+'</strong><span>'+esc(roles[i]||'관계인')+'</span><small>인물 카드 ›</small></button>').join('')+
 (!ids.length?'<p class="muted small">아직 출석한 증인이 없습니다. 재판에서 증인 조사를 신청할 수 있습니다.</p>':'')+'</div></section>';
 return panel;
}
function sides(c,ctx){
 const {a,f,criminal}=ctx,defendant=name(criminal?c.who?.[0]:c.who?.[1]),claimant=name(criminal?c.who?.[1]:c.who?.[0]);
 const evidence=(c.evidence||[]).slice(0,2).join(' · '),weak=f.defense||a.defenseTheory||a.whyDefense;
 const claim=criminal?
  ('피고인 '+defendant+'이(가) '+(f.when||'사건 당일')+' '+(f.place||a.location||'사건 장소')+'에서 '+(f.method||a.allegation)+' 혐의. '+(f.motive?'범행 동기는 '+f.motive+'. ':'')+'입증 자료: '+evidence+'.'):
  ('원고 '+claimant+'은 '+a.allegation+'. 관련 증거: '+evidence+'.');
 const response=criminal?
  ('피고인 측은 '+weak+' 검찰의 주장만으로 고의·행위자 특정·인과관계가 모두 입증되지는 않았다고 반박한다.'):
  ('피고 '+defendant+' 측은 '+weak+' 청구 금액과 의무·손해의 관계를 다툰다.');
 return '<section class="case-advocates editorial-advocates"><div class="row between"><h3 class="no-margin">02 · 양측의 주장</h3><span class="chip">서면 확인</span></div><div class="adversarial">'+
  '<article class="adv-card prosecution"><strong class="adv-label">'+(criminal?'검사 측':'원고 측')+'</strong><p>'+esc(claim)+'</p><button class="btn outline full" data-action="editorialBrief" data-side="claim">📄 '+(criminal?'검사 의견서':'원고 준비서면')+' 전문</button></article>'+
  '<article class="adv-card defense"><strong class="adv-label">'+(criminal?'변호인 측':'피고 측')+'</strong><p>'+esc(response)+'</p><button class="btn outline full" data-action="editorialBrief" data-side="defend">📄 '+(criminal?'변호인 의견서':'피고 준비서면')+' 전문</button></article>'+
  '</div></section>';
}
function fullBrief(c,ctx,side){
 const {a,f,criminal}=ctx,pro=side==='claim';
 const defendant=name(criminal?c.who?.[0]:c.who?.[1]),claimant=name(criminal?c.who?.[1]:c.who?.[0]);
 const advocate=name(c.side?.[pro?0:1]),loc=f.place||a.location||'기록에 기재된 장소';
 const when=f.when||'사건 발생일',action=f.method||a.allegation,motive=f.motive||'당사자의 이해관계';
 const corePro=criminal?
   ('검사는 피고인 '+defendant+'이(가) '+when+', '+loc+'에서 '+claimant+'에게 '+action+' 혐의가 있다고 주장합니다. 범행 동기로 '+motive+'를 지목하며, 해당 행위와 피해 결과 사이의 인과관계 및 고의가 쟁점이라고 봅니다.'):
   ('원고 '+claimant+'은 '+a.allegation+'에 관하여 피고 '+defendant+'에게 책임이 있다고 주장합니다. 발생 장소는 '+loc+'이며, 손해의 범위와 원인이 다투어집니다.');
 const coreDef=criminal?
   ('변호인은 '+defendant+'의 방어권을 위해 다음 점을 다툽니다. '+(f.defense||a.defenseTheory||a.whyDefense)+' 피해 사실의 존재와 피고인의 범행 책임은 구분되어야 하고 검사는 합리적 의심을 배제할 수준으로 입증해야 합니다.'):
   ('피고 '+defendant+' 측은 '+(a.whyDefense||a.weakEvidence)+' 계약의 범위, 이행 경위, 손해 발생의 원인과 액수를 각각 다툽니다.');
 const proof=(c.evidence||[]).map((title,i)=>'<p><b>'+(i+1)+'. '+esc(title)+'</b> — '+esc(i===0?a.whyEvidence:i===1?a.weakEvidence:'작성자·원본·입증 범위 확인')+'</p>').join('');
 const expert=f.medicalEvidence||f.forensic||'증인의 직접 관찰 범위와 자료 원본성·진술의 시간적 일치 여부를 확인해야 합니다.';
 const demand=pro?(criminal?'가상 구형: '+(f.demand||a.demand||'개별 심리 후 구형'):'청구 취지: '+(a.demand||'손해배상 및 청구권 판단')):(criminal?'결론: 공소사실에 관한 증명 부족 부분은 무죄 판단을 구합니다.':'결론: 증명되지 않은 청구 부분은 기각을 구합니다.');
 const text=pro?corePro:coreDef,title=criminal?(pro?'검사 의견서':'변호인 의견서'):(pro?'원고 준비서면':'피고 준비서면');
 const paper='<div class="editorial-paper"><div class="paper-kicker">THE VERDICT · 가상 사건 기록</div><h3>'+title+'</h3><p><b>사건</b> '+esc(c.name)+' · '+esc(c.id)+'</p><p><b>제출인</b> '+esc(advocate)+'</p>'+
 '<h4>1. 사건의 경위와 주장</h4><p>'+esc(text)+'</p>'+
 '<h4>2. 증거와 반대 논점</h4>'+proof+
 '<p><b>감정·진료·정황 자료:</b> '+esc(expert)+'</p><p><b>상대방이 다투는 부분:</b> '+esc(f.defense||a.defenseTheory||a.whyDefense)+'</p>'+
 '<h4>3. '+(criminal?'구형 및 결론':'청구와 결론')+'</h4><p><b>'+esc(demand)+'</b></p>'+
 '<p class="muted small">법률상 죄명·구형은 게임을 위한 가상 주장입니다. 제시된 혐의는 확정된 사실이 아니며 재판부가 증거에 따라 판단합니다.</p></div>';
 modal(title,paper,'<button class="btn primary full" data-action="dismiss">서면 닫기</button>');
}
const formerCourt=court;
court=function(){
 let html=formerCourt(),c=CASES.find(x=>x.id===ui.caseId);if(!c)return html;
 const ctx=info(c);if(!ctx||!html.includes('case-narrative'))return html;
 const intro='<section class="panel case-narrative editorial-intro"><div class="row between"><h3 class="no-margin">01 · 무슨 사건인가?</h3><span class="chip">'+(ctx.criminal?'형사':'민사·가사')+'</span></div><p>'+esc(dispute(c,ctx))+'</p></section>';
 html=html.replace(/<section class="panel case-narrative">[\s\S]*?<\/section>/,intro);
 html=html.replace(/<section class="case-advocates">[\s\S]*?<\/section>/,sides(c,ctx)+witnesses(c,ctx));
 html=html.replace(/<section class="panel new-hearing-briefs">[\s\S]*?<\/section>/,'');
 html=html.replace(/<section class="panel verdict-narrative-layer">[\s\S]*?<\/section>/,'');
 html=html.replace(/<section class="panel deep-drama"><h3>📖 사건의 사람들과 선택<\/h3>[\s\S]*?<\/section>/,'');
 html=html.replace(/<section class="panel"><div class="row between"><h3 class="no-margin">사건 관계인 · 증인<\/h3>[\s\S]*?<\/section>/,'');
 const entries=(S.cases[c.id]?.hearingRevelations||[]).slice(-2);
 if(entries.length)html=html.replace('</section><section class="editorial-advocates">',
  '<p class="muted small">기일별 업데이트: '+esc(entries.map(v=>v.type+' · '+v.body).join(' / '))+'</p></section><section class="editorial-advocates">');

 return html;
};
function caseWitnessIds(c){
 const st=S.cases[c.id]||{},base=[...new Set((c.stages||[]).flatMap(x=>x.actions||[]).map(x=>x.who).filter(id=>id&&NPC[id]&&!c.who?.includes(id)&&!c.side?.includes(id)))];
 return [...new Set([...(st.drama?.castIds||[]).filter(id=>NPC[id]),...base])].slice(0,3);
}
const previousNPC=popupNPC;
popupNPC=function(id){
 const c=CASES.find(x=>x.id===ui.caseId),ctx=c&&info(c);
 if(!c||!ctx||!NPC[id])return previousNPC(id);
 const idx=caseWitnessIds(c).indexOf(id);
 if(idx<0)return previousNPC(id);
 const p=NPC[id],role=ctx.a.witnessRoles[idx]||p.role||'관계인';
 const short='<div class="compact-npc-modal"><div class="compact-npc-top">'+avatar(id)+'<div><b>'+esc(role)+'</b><p>'+esc(p.career||'관계인')+' · '+esc(p.bornYear?year()-p.bornYear+'세':'나이 미상')+'</p></div></div>'+
  '<p><b>이 사건에서의 역할:</b> '+esc(role)+'</p>'+
  '<p><b>확인할 사실:</b> '+esc(idx===0?(ctx.a.whyEvidence||c.evidence?.[0]||'사건 당시 상황'):idx===1?(ctx.a.secondEvidence||'관련 기록'):ctx.a.thirdEvidence||'원본성·시간 기록')+'</p>'+
  '<p><b>증언의 한계:</b> '+esc(ctx.f.defense||ctx.a.weakEvidence||'직접 경험 범위 확인')+'</p>'+
  '<details><summary>인물의 생애 정보 더 보기</summary><p>성격: '+esc(p.personality||'미상')+'</p><p>가족: '+esc(p.family||'미상')+'</p><p>과거 기억: '+esc((S.memories[id]||[]).slice(-2).map(x=>x.body).join(' · ')||'별도 기록 없음')+'</p></details></div>';
 modal(p.name+' · '+role,short,'<button class="btn primary full" data-action="dismiss">닫기</button>');
};
const oldClick=clicker;
clicker=function(e){const b=e.target.closest('[data-action]');if(b?.dataset.action==='editorialBrief'){
  const c=CASES.find(x=>x.id===ui.caseId),ctx=c&&info(c);if(ctx)fullBrief(c,ctx,b.dataset.side);return;
 }return oldClick(e)};
async function load(){
 try{
 const [r1,r2]=await Promise.all([
 fetch(new URL('./content-packs/court-editorial-100-v1.json',location.href),{cache:'no-cache'}),
 fetch(new URL('./content-packs/forensic-detail-33-v1.json',location.href),{cache:'no-cache'})
 ]);
 if(!r1.ok||!r2.ok)throw Error('콘텐츠 다운로드 오류');
 const a=await r1.json(),b=await r2.json();
 if(a.cases?.length!==100||Object.keys(b.cases||{}).length!==33)throw Error('100건 데이터 정합성 실패');
 editorial=new Map(a.cases.map(x=>[x.id,x]));forensic=b.cases;ready=true;render();
 }catch(e){console.warn('법정 사건 서사팩을 불러오지 못했습니다',e)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();