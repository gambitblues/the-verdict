/* v1.9 — other-court decisions and evolving judicial expertise. */
'use strict';
(()=>{
const safe=s=>h(String(s??''));
const categories={homicide:'강력·형사',sexual:'성범죄',violence:'폭력·형사',financial:'경제·금융',property:'재산범죄',reputation:'명예·정보',civil:'민사·계약',family:'가사·상속',professional:'기업·전문직',public:'공공·행정'};
function scores(){
 const tally={};for(const c of CASES){const st=S.cases[c.id];if(!st?.verdict)continue;
 const k=c.contentPack?.category||c.story?.pack?.category||c.story?.deep?.key||'civil';
 tally[k]??={cases:0,score:0};tally[k].cases++;tally[k].score+=Math.max(0,Number(st.grade)||0);
 }
 const out=Object.entries(tally).map(([key,v])=>({key,title:categories[key]||key,count:v.cases,score:Math.round(v.score/v.cases),level:Math.min(5,Math.floor(v.cases/3)+1)})).sort((a,b)=>b.count-a.count);
 S.specialties=out;return out;
}
function resolveCourts(){
 const db=S.realtimeInbox;if(!db?.enabled)return;
 db.resolvedSlots??={};db.otherCourtDecisions??=[];
 const now=Date.now();let updated=0;
 for(const entry of db.otherCourt){
  if(db.resolvedSlots[entry.slot])continue;
  const arrival=new Date(entry.day+'T10:00:00').getTime();
  const seed=[...entry.slot].reduce((a,c)=>Math.imul(a^c.charCodeAt(0),16777619)>>>0,2166136261);
  const hours=8+(seed%89);if(now<arrival+hours*3600000)continue;
  const verdicts=entry.kind==='criminal'?['증거 부족으로 무죄','일부 혐의 유죄','공소사실 전부 유죄','공소기각']:['청구 일부 인용','청구 기각','청구 전부 인용','조정 성립','소송상 화해'];
  const result=verdicts[seed%verdicts.length];
  let connection=null;
  const ids=Object.keys(S.npcDB||{});
  if(ids.length&&seed%7===0){const id=ids[seed%ids.length];if(NPC[id]){connection=id;remember(id,'타 재판부 기록',entry.title+' · '+result,'other-'+entry.slot);}}
  const record={slot:entry.slot,title:entry.title,day:entry.day,result,week:S.week,connection,category:'법원 판결'};
  db.resolvedSlots[entry.slot]=true;db.otherCourtDecisions.push(record);entry.result=result;
  if(updated<3||connection){news('다른 재판부 판결 · '+entry.title,result+(connection?' · '+NPC[connection].name+'의 기존 이력이 간접적으로 연결됨':''),'법조일보');}
  updated++;
 }
 if(updated){db.otherCourtDecisions=db.otherCourtDecisions.slice(-300);save();}
}
const oldHome=home;
home=function(){
 resolveCourts();const arr=scores();const db=S.realtimeInbox;
 let html='<section class="panel judicial-specialty"><h3>🎓 법관 전문 분야</h3><p class="muted small">실제 판결 경험이 누적될수록 해당 분야의 배당 가능성이 높아집니다.</p>';
 html+=arr.length?arr.slice(0,5).map(s=>'<p><b>'+safe(s.title)+'</b> · '+s.count+'건 · 평균 판단 '+s.score+'점 · 숙련 '+s.level+'/5</p>').join(''):'<p class="muted small">아직 완료한 사건이 없습니다.</p>';
 if(db?.otherCourtDecisions?.length){html+='<details><summary>⚖ 다른 재판부의 최근 판결</summary>'+db.otherCourtDecisions.slice(-8).reverse().map(d=>'<p class="small">'+safe(d.title)+' · '+safe(d.result)+(d.connection&&NPC[d.connection]?' · 👤 '+safe(NPC[d.connection].name):'')+'</p>').join('')+'</details>';}
 html+='</section>';return oldHome()+html;
};
const oldConclude=conclude;
conclude=function(id){const c=CASES.find(x=>x.id===ui.caseId),was=c&&S.cases[c.id]?.verdict;oldConclude(id);if(c&&!was&&S.cases[c.id]?.verdict){scores();save();}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(S.name){resolveCourts();scores();render();}});else if(S.name){resolveCourts();scores();render();}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.name){resolveCourts();render();}});
const style=document.createElement('style');style.textContent='.judicial-specialty{border:1px solid #b7c4ce;background:#f6f8fa}.judicial-specialty p{line-height:1.5}';document.head.appendChild(style);
})();