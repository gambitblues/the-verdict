/* THE VERDICT Beta 1.6 — NPC witnesses and evolving case drama */
'use strict';
(()=>{
let arcs=new Map();
const esc=s=>h(String(s??''));
async function load(){
 try{const r=await fetch(new URL('./content-packs/drama-100-v1.json',location.href),{cache:'no-cache'});if(!r.ok)throw Error('HTTP '+r.status);
 const data=await r.json();if(data.format!=='the-verdict-case-drama/v1'||data.cases?.length!==100)throw Error('format');
 arcs=new Map(data.cases.map(a=>[a.id,a]));render();
 }catch(e){console.warn('Case drama unavailable',e)}
}
function detail(c){
 const a=arcs.get(c.contentPack?.archetypeId||c.story?.packOrigin?.id||c.story?.pack?.archetypeId);
 if(!a)return null;
 const st=S.cases[c.id];if(!st)return null;
 st.drama??={castIds:[],answers:{},postVerdict:false};
 if(!st.drama.castIds.length&&!st.verdict&&S.name){
   for(const p of a.cast){
     const id=freshNPC(p.role,S.caseSerial||1,c.story?.deep?.key||'contract');
     NPC[id].career=p.profile.career;
     NPC[id].bond=p.profile.relationship;
     NPC[id].caseWitnessRole=p.role;
     st.drama.castIds.push(id);
     remember(id,'관련 사건',c.name+' 사건에서 관련 인물로 기록됨',c.id);
   }
   save();
 }
 return {a,st,d:st.drama};
}
const prevCourt=court;
court=function(){
 const page=prevCourt();
 const c=CASES.find(x=>x.id===ui.caseId);if(!c||!S.name)return page;
 const x=detail(c);if(!x)return page;
 const {a,st,d}=x;
 const n=Math.min(2,(st.hearingHistory||[]).filter(v=>v.kind==='resumed').length);
 const points=a.turningPoints.filter(p=>p.stage===0||p.stage<=n+1).map(p=>'<article class="drama-act"><b>'+esc(p.heading)+'</b><p>'+esc(p.text)+'</p><small>'+esc(p.why)+'</small></article>').join('');
 const evis=a.factDisclosure.map((e,i)=>'<div class="drama-act"><b>'+esc(e.evidence)+'</b><p>'+esc(e.what)+'</p><small>'+esc(e.caveat)+' · '+(i<=n?'검토 가능한 자료':'추가 기일 검토 대상')+'</small></div>').join('');
 const people=a.cast.map((p,i)=>{
  const id=d.castIds[i];if(!id||!NPC[id])return '';
  const answers=d.answers[id]||[];
  return '<article class="drama-act"><button data-action="npc" data-id="'+esc(id)+'" class="btn outline">👤 '+esc(NPC[id].name)+' · '+esc(p.role)+' · 인물 정보</button><p>'+esc(p.knowledge)+'</p><small>이해관계: '+esc(p.interest)+'</small><div class="drama-buttons">'+[['memory','관찰 범위'],['interest','이해관계'],['cross','반대신문']].map(([type,title])=>'<button class="btn outline mini" data-action="dramaAsk" data-witness="'+esc(id)+'" data-i="'+i+'" data-type="'+type+'" '+(answers.some(v=>v.type===type)||st.verdict?'disabled':'')+'>'+title+'</button>').join('')+'</div>'+answers.map(v=>'<div class="drama-answer"><b>'+esc(v.q)+'</b><p>'+esc(v.a)+'</p><small>'+esc(day(v.week))+' · 검증 대상인 진술</small></div>').join('')+'</article>';
 }).join('');
 const follow=st.verdict?'<section class="panel"><h3>🗞 판결 이후의 관계</h3><p>'+esc(a.consequences.claimant)+'</p><p>'+esc(a.consequences.respondent)+'</p></section>':'';
 const block='<section class="panel deep-drama"><h3>📖 사건의 사람들과 선택</h3>'+points+'<h3>⚖ 양측의 논쟁</h3><p><b>검사·원고 측</b> '+esc(a.advocacy.claimant.theory)+'</p><p><b>변호인·피고 측</b> '+esc(a.advocacy.respondent.theory)+'</p><h3>🔎 증거와 해석</h3>'+evis+'</section><section class="panel deep-drama"><h3>👥 증인·관계인 신문</h3><p class="muted small">각 인물의 진술은 관찰 범위와 이해관계를 포함하며 자동으로 사실로 확정되지 않습니다.</p>'+people+'</section>'+follow;
 const marker='<section class="panel action-panel">';
 return page.includes(marker)?page.replace(marker,block+marker):page+block;
};
const prevClick=clicker;
clicker=function(e){
 const b=e.target.closest('[data-action="dramaAsk"]');if(!b)return prevClick(e);
 const c=CASES.find(x=>x.id===ui.caseId),x=c&&detail(c);if(!x||x.st.verdict)return;
 if(Number.isInteger(x.st.nextHearingWeek)&&S.week<x.st.nextHearingWeek){toast('다음 기일 이후 신문할 수 있습니다.');return;}
 const i=Number(b.dataset.i),p=x.a.cast[i],id=x.d.castIds[i];if(!p||id!==b.dataset.witness)return;
 const type=b.dataset.type,q=type==='memory'?'무엇을 직접 보고 들었습니까?':type==='interest'?'당사자와 어떤 이해관계가 있습니까?':'다른 증거와 불일치하는 부분은 무엇입니까?';
 const a=type==='memory'?p.testimony.first:type==='interest'?p.interest:p.testimony.cross;
 const records=x.d.answers[id]??(x.d.answers[id]=[]);if(records.some(v=>v.type===type))return;
 records.push({type,q,a,week:S.week});remember(id,'증인신문',c.name+' · '+a,c.id);save();render();
};
const prevConclude=conclude;
conclude=function(v){
 const c=CASES.find(x=>x.id===ui.caseId),x=c&&detail(c);
 prevConclude(v);
 if(!x||!x.st.verdict||x.d.postVerdict)return;
 x.d.postVerdict=true;
 for(const id of x.d.castIds)remember(id,'재판 종결',c.name+' 판결 선고 사실을 통지받음',c.id);
 S.news.unshift({week:S.week,title:'판결 이후의 관계 · '+c.name,body:x.a.consequences.network,category:'법조일보'});
 save();
};
const st=document.createElement('style');
st.textContent='.deep-drama{background:#f9f7f2}.drama-act{background:#fff;border:1px solid #dbd7d1;padding:12px;border-radius:10px;margin:10px 0}.drama-act p{line-height:1.6;margin:7px 0}.drama-act small{color:#657886}.drama-buttons{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.drama-answer{border-left:3px solid #a88b62;padding:10px;background:#f1f5f6;margin:8px 0}';
document.head.appendChild(st);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();