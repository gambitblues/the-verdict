/* Narrative Layer 100 — non-invasive, save-preserving court storyline reader. */
'use strict';
(()=>{
let arcs=new Map(),status='loading';
function esc(s){return h(String(s??''));}
async function load(){
 try{const url=new URL('./content-packs/narrative-100-v1.json',location.href);const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw Error('HTTP '+r.status);
 const j=await r.json();if(j.format!=='the-verdict-narrative-layer/v1'||!Array.isArray(j.arcs)||j.arcs.length!==100)throw Error('서사팩 형식 오류');
 arcs=new Map(j.arcs.map(a=>[a.id,a]));status='ready';if(typeof render==='function')render();
 }catch(e){status='error';console.warn('Narrative pack unavailable:',e);}
}
function panel(c,st){
 const a=arcs.get(c.contentPack?.archetypeId||c.story?.pack?.archetypeId||c.story?.packOrigin?.id);
 if(!a)return '';
 const hearings=(st.hearingHistory||[]).filter(x=>x.kind==='resumed').length;
 const sections=[
 [a.act1.label,a.act1.scene,a.act1.pressure],
 [a.act2.label,a.act2.scene,a.act2.question],
 [a.act3.label,a.act3.claim,a.act3.defense+' '+a.act3.issue],
 ];
 if(hearings>=1)sections.push([a.act4.label,a.act4.exhibit,a.act4.counter]);
 if(hearings>=2)sections.push([a.act5.label,a.act5.exhibit,a.act5.turn]);
 const rows=sections.map((s,i)=>'<article class="verdict-arc-act"><strong>'+esc(s[0])+'</strong><p>'+esc(s[1])+'</p><small>'+esc(s[2])+'</small></article>').join('');
 const future=st.verdict?'<article class="verdict-arc-act"><strong>'+esc(a.aftermath.label)+'</strong><p>'+esc(a.aftermath.immediate)+'</p><small>'+esc(a.aftermath.note)+'</small></article>':'<p class="muted small">새 기일을 진행하면 추가 사건 분석이 열립니다. 서사 해석은 증거 자체가 아닙니다.</p>';
 return '<section class="panel verdict-narrative-layer"><h3>📖 사건의 흐름 · 5막 기록</h3><p class="muted small">기록된 사실·쟁점의 스토리 요약이며 판결 정답은 없습니다.</p>'+rows+future+'</section>';
}
const prior=court;
court=function(){const original=prior();const c=CASES.find(x=>x.id===ui.caseId),st=c&&S.cases[c.id];if(!c||!st||!arcs.size)return original;const extra=panel(c,st);if(!extra)return original;const marker='<section class="panel action-panel">';return original.includes(marker)?original.replace(marker,extra+marker):extra+original;};
const style=document.createElement('style');style.textContent='.verdict-narrative-layer{background:linear-gradient(135deg,#faf8f3,#eff2f3);border:1px solid #ccbca8}.verdict-arc-act{border-left:3px solid #ad8662;margin:12px 0;padding:10px 14px;background:#fff;border-radius:8px}.verdict-arc-act p{margin:8px 0;line-height:1.65}.verdict-arc-act small{color:#61717c;line-height:1.6;display:block}';document.head.appendChild(style);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();