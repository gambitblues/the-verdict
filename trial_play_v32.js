/* v3.2 interactive trial-day integration. Loaded after v3.1 UI and trial core. */
'use strict';
(()=>{
const core=window.VerdictTrialCore;if(!core)return;
const oldCourt=court,oldClick=clicker,oldConclude=conclude,oldHome=home;
const esc=x=>h(String(x??''));
function current(){const c=CASES.find(x=>x.id===ui.caseId);return c&&S.cases[c.id]?{c,st:S.cases[c.id]}:null}
function ensure(c,st){
 if(st.trial32)return st.trial32;
 const details=(c.story?.evidenceDetails||[]).slice(0,5);
 const evidence=details.length?details.map((e,i)=>({id:'ev'+i,title:e.title||'기록 '+(i+1)})):[{id:'ev0',title:'핵심 자료'},{id:'ev1',title:'상대방 제출 자료'},{id:'ev2',title:'현장 기록'}];
 const rolling=core.roll({id:c.contentPack?.archetypeId||c.id,evidence,witnesses:[{id:'w0'}]},c.id+':'+(S.rng||1),[])||{rolled:{truth:'reason',flaws:{},attitudes:{},style:'meticulous'}};
 const t={version:1,evidence:evidence.map((e,i)=>({...e,strength:35+core.hash(c.id+':strength:'+i)%31,flawType:rolling.rolled.flaws[e.id]||'none',flaw:rolling.rolled.flaws[e.id]==='none'?0:20+core.hash(c.id+':flaw:'+i)%61,revealed:0,admitted:false})),truth:rolling.rolled.truth,style:rolling.rolled.style,decisions:[],energy:4,day:0,media:core.pressStart(c.importance||1,/살인/.test(c.tag||'')?20:0),gauge:{P:0,D:0,margin:0},review:null};
 st.trial32=t;return t;
}
function press(c,t,delta){t.media=core.pressAdvance(t.media,{surface:50+delta,news:Math.abs(delta)>15?8:0,twist:false});}
function chooseAction(kind,id,action){
 const x=current();if(!x||x.st.verdict)return;
 const {c,st}=x,t=ensure(c,st);
 if(t.energy<=0){toast('오늘의 조사 체력을 모두 사용했어요.');return}
 let d={kind,action,id,day:t.day},item=t.evidence.find(e=>e.id===id);
 if(kind==='investigate'){
  if(!item)return;
  item.revealed=core.reveal({revealed:{[id]:item.revealed}},id);
  d.revealed=item.revealed;
 }else if(kind==='evidence'){
  if(!item)return;
  item.admitted=action!=='exclude';
  d={...d,flawType:item.flawType,flawKnown:item.revealed>=1,core:true};
 }else if(kind==='objection'){
  d.leading=true;t.objection=action;
 }else if(kind==='delay'){
  d.baseless=t.style==='delay';t.delay=action;
 }else if(kind==='witness'){
  t.witnessLevel=Math.min(2,(t.witnessLevel||0)+1);
  d.revealed=t.witnessLevel;
 }
 t.decisions.push(d);t.energy--;
 t.gauge=core.gauge(t.evidence,Number(t.objection==='reject'),t.evidence.filter(e=>!e.admitted).length*5);
 t.skill=core.decisionScore(t.decisions,t.gauge.margin,null);
 press(c,t,kind==='evidence'?(action==='exclude'?-10:10):kind==='witness'?12:0);
 log('재판일 결정',c.name,kind+' · '+action+' · '+(item?.title||id));
 save();render();
}
function trialPanel(c,st){
 const t=ensure(c,st),g=t.gauge,bar=(label,v)=>'<div class="trial-meter"><div class="trial-meter-title">'+label+' <b>'+v+'/100</b></div><div class="trial-meter-track"><i style="width:'+Math.max(0,Math.min(100,v))+'%"></i></div></div>';
 const btn=(type,id,action,label)=>'<button class="btn outline mini" data-action="trial32" data-type="'+type+'" data-id="'+esc(id)+'" data-choice="'+action+'" '+(t.energy<=0?'disabled':'')+'>'+label+'</button>';
 const cards=t.evidence.map(e=>'<div class="trial-evidence"><b>'+esc(e.title)+'</b><small> 증거 힘 '+e.strength+' · 증거의 흠 '+(e.revealed===0?'?':e.revealed<1?'범위 '+Math.max(0,e.flaw-15)+'~'+Math.min(100,e.flaw+15):e.flaw+' ('+esc(e.flawType)+')')+'</small><div class="trial-buttons">'+btn('investigate',e.id,'inspect','조사하기')+btn('evidence',e.id,'use','증거 쓴다')+btn('evidence',e.id,'exclude','증거 뺀다')+'</div></div>').join('');
 return '<section class="panel trial-v32"><h3>⚖ 재판일 작전실</h3><p class="muted small">판사의 선택이 증거의 힘과 남은 의문을 바꿉니다. 숨겨진 진실은 보여주지 않습니다.</p><p><b>조사 체력 '+t.energy+'/4</b> · 재판일 '+(t.day+1)+' · 결정 '+t.decisions.length+'회</p>'+bar('증거로 보여준 정도',g.P)+bar('아직 남은 의문',g.D)+'<div class="trial-grid">'+cards+'</div><div class="trial-buttons">'+btn('witness','w0','question','증인에게 질문')+btn('objection','ob','accept','이의 받아들이기')+btn('objection','ob','reject','이의 넘어가기')+btn('delay','delay','accept','재판일 미뤄주기')+btn('delay','delay','reject','미루기 거절')+'</div><p class="muted small">판결 실력 변화 '+(t.skill||0)+'점 · 화제성 '+t.media.H+' · 여론 '+t.media.O+' · 분열 '+t.media.S+'</p>'+(t.decisions.length?'<p class="small">최근 선택: '+esc(t.decisions.at(-1).kind+' / '+t.decisions.at(-1).action)+'</p>':'')+'</section>';
}
court=function(){let html=oldCourt(),x=current();if(!x||x.st.verdict)return html;return html.replace('<section class="panel action-panel">',trialPanel(x.c,x.st)+'<section class="panel action-panel">')};
clicker=function(e){
 const el=e.target.closest('[data-action]');if(el?.dataset.action==='trial32'){e.preventDefault();e.stopPropagation();chooseAction(el.dataset.type,el.dataset.id,el.dataset.choice);return}
 return oldClick(e);
};
conclude=function(id){
 const x=current(),t=x&&ensure(x.c,x.st);
 oldConclude(id);
 if(!x||!t||!x.st.verdict)return;
 const st=x.st,c=x.c;const guilty=/guilty|유죄|인용|책임/.test(String(id));
 t.gauge=core.gauge(t.evidence,Number(t.objection==='reject'),t.evidence.filter(e=>!e.admitted).length*5);
 t.skill=core.decisionScore(t.decisions,t.gauge.margin,guilty?'guilty':'not_guilty');
 t.review=core.review(Math.max(0,Math.min(100,70+t.skill)),Math.max(0,100-Math.abs(t.media.O-(guilty?65:-65))),50);
 st.trialReview={skill:t.skill,review:t.review,proof:t.gauge.P,doubt:t.gauge.D,publicOpinion:{...t.media}};
 const viewpoints=[['법리 중심','증거와 남은 의문을 따진 재판부 판단'],['피해자 중심','피해와 회복을 둘러싼 논쟁'],['탐사 보도','사건 기록의 빈자리와 후속 취재']];
 for(const [outlet,subject]of viewpoints)news(c.name+' · '+subject,'재판부의 '+(guilty?'책임 인정':'책임 불인정')+' 판단에 여러 관점이 엇갈린다. 당시 여론 방향 '+t.media.O+'점.',outlet);
 S.trial32History??=[];S.trial32History.unshift({caseId:c.id,week:S.week,title:c.name,verdict:id,review:t.review,skill:t.skill,media:{...t.media}});
 save();render();
};
})();