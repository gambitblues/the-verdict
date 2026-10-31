/* THE VERDICT — playable trial loop (v4).
 * Owns the courtroom "재판" screen: trial days, evidence decisions, witnesses, opponent cards,
 * verdict with reasons, press/SNS reactions, delayed reviews and truth reveals.
 * Replaces the legacy 3-step hearing panel and the v3.2 trial panel.
 */
'use strict';
(()=>{
const T=window.VerdictTrialCore;
if(!T)return;

/* ---------- tuning ---------- */
const MIN=60000,HOUR=3600000,DAY=86400000;
const DAY_WAIT=10*MIN;            // real minutes between trial days
const DELAY_EXTRA=20*MIN;         // extra wait when a delay request is accepted
const REVIEW_AFTER=9*HOUR;        // 3 game days (3h real = 1 game day)
const REVEAL_MIN_DAYS=7,REVEAL_MAX_DAYS=30;
const ENERGY=4,EXTRA_DAYS=2;

const esc=x=>h(String(x??''));
const now=()=>Date.now();
const shortName=c=>String(c.name||'').split(' · ')[0];
const isCriminal=c=>c.kind==='criminal';

/* ---------- drama pack (witness roles & knowledge) ---------- */
let cast=new Map();
fetch(new URL('./content-packs/drama-100-v1.json',location.href)).then(r=>r.ok?r.json():null).then(d=>{
 if(d?.cases)cast=new Map(d.cases.map(a=>[a.id,a.cast||[]]));
}).catch(()=>{});

/* ---------- press desk ---------- */
const REPORTERS=[
 {id:'reporter',name:null,style:'law',outlet:'법조일보',label:'법리 중심'},
 {id:'rep_victim',name:'서은채',style:'victim',outlet:'중앙사회신문',label:'피해자 중심'},
 {id:'rep_tabloid',name:'구태오',style:'tabloid',outlet:'데일리이슈',label:'화제성 중심'},
 {id:'rep_probe',name:'윤도경',style:'probe',outlet:'탐사저널K',label:'탐사 보도'},
 {id:'rep_social',name:'마지훈',style:'balance',outlet:'오늘의법',label:'사회부'}
];
function desk(){
 S.press4??={reporters:{},nickname:null,reviews:[]};
 for(const r of REPORTERS)S.press4.reporters[r.id]??={mood:50};
 return S.press4;
}
const reporterName=r=>r.name||NPC.reporter?.name||'한민지';

const HEAD={
 victim:{1:['{c}, 피해자 가족 "이제야 숨을 쉰다"','{c} 판결, 피해 회복의 첫걸음'],'-1':['또 책임 불인정… {c} 피해자 측 "법이 우리를 외면했다"','{c}, 피해자 눈물 속 선고'],'0.5':['{c} 일부만 인정… 피해자 측 "절반의 정의"']},
 law:{1:['{c}, 증거 판단 거쳐 책임 인정','{c} 판결문이 보여준 증거의 무게'],'-1':['{c}, "증거가 모자라면 책임도 없다" 원칙 지켜','{c}, 남은 의문을 무겁게 본 재판부'],'-1f':['{c} 판결, 흠 있는 증거를 걸러낸 재판부','{c}, 증거의 흠을 법정에서 짚은 재판부'],'0.5':['{c}, 증명된 범위만 인정한 재판부']},
 tabloid:{1:['[속보] {c} 결국 책임 인정!','{c}, 법정이 술렁인 선고 순간'],'-1':['[충격] {c} 뒤집힌 결말','{c}, 누리꾼 "이게 맞나?"'],'0.5':['{c} 애매한 결론에 갑론을박']},
 probe:{1:['{c} 판결 뒤에도 남은 질문들','{c}, 법정에 나오지 않은 기록'],'-1':['{c} 무엇이 증명되지 못했나','{c}, 재판부가 지적한 증거의 빈자리'],'0.5':['{c}, 인정된 것과 인정되지 않은 것']},
 balance:{1:['{c} 선고, 엇갈리는 시민 반응','{c} 판결 이후 남은 과제'],'-1':['{c} 선고, 여론과 법정 사이','{c} 판결이 던진 질문'],'0.5':['{c}, 일부 인정 판결의 의미']}
};

/* ---------- state ---------- */
function opponentOf(c){return c.side?.[1]}
function styleOf(id){const p=NPC[id];if(!p)return T.pick(T.STYLES,'none');p.trialStyle??=T.pick(T.STYLES,'style:'+id);return p.trialStyle}

function witnessSeeds(c){
 const pack=cast.get(c.contentPack?.archetypeId)||[];
 if(pack.length)return pack.slice(0,3).map(p=>({role:p.role,knowledge:p.knowledge,interest:p.interest}));
 const ids=[c.story?.witness,c.story?.investigator?.detective].filter(id=>id&&NPC[id]&&!c.who?.includes(id)&&!c.side?.includes(id));
 return [...new Set(ids)].slice(0,2).map(id=>({existing:id,role:NPC[id].role||'사건 관계인',knowledge:'',interest:''}));
}
function evidenceSeeds(c){
 const d=(c.story?.evidenceDetails||[]).filter(e=>e.available!==false).slice(0,4);
 if(d.length)return d.map((e,i)=>({id:'e'+i,title:e.title,note:e.concern||'',scope:e.scope||''}));
 return (c.evidence||['핵심 자료','상대방 제출 자료','현장 기록']).slice(0,3).map((x,i)=>({id:'e'+i,title:String(x).split(' · ')[0],note:String(x).split(' · ')[1]||'',scope:''}));
}

function ensure(c,st){
 if(st.trial4)return st.trial4;
 const seed=c.id+':'+(S.rng||1);
 const witnesses=witnessSeeds(c).map((w,i)=>{
  let id=w.existing;
  if(!id){id=freshNPC(w.role,S.caseSerial||1,c.story?.deep?.key||c.contentPack?.category||'contract');NPC[id].role=w.role;NPC[id].caseWitnessRole=w.role;
   remember(id,'관련 사건',c.name+'의 증인으로 출석',c.id)}
  return {id,role:w.role,knowledge:w.knowledge,interest:w.interest};
 });
 const history=S.trial4History||[];
 const rolled=T.roll({id:c.id,archetypeId:c.contentPack?.archetypeId||c.id,truth:T.truthFromStory(c.story?.privateTruth?.kind),evidence:evidenceSeeds(c),witnesses},seed,history);
 const opponent=opponentOf(c),style=styleOf(opponent);
 const heat=/살인|치사/.test(c.tag)?20:/연예|celebrity/.test(c.tag+(c.contentPack?.category||''))?25:/성/.test(c.tag)?10:0;
 const t={...rolled,seed,opponent,style,day:1,daysDone:0,minDays:T.minDays(c.importance),energy:ENERGY,cards:[],nextAt:0,
  delayAccepted:false,twistUsed:false,log:[],media:T.pressStart(c.importance,{criminal:isCriminal(c),heatBonus:heat}),startedAt:now()};
 t.cards=T.cards(t,1,seed);
 st.trial4=t;
 S.trial4History=[...history,{archetypeId:rolled.archetypeId,truth:rolled.truth,firstFlaw:rolled.firstFlaw}].slice(-60);
 save();
 return t;
}
function current(){const c=CASES.find(x=>x.id===ui.caseId),st=c&&S.cases[c.id];return c&&st?{c,st}:null}
function waiting(t){return t.nextAt&&now()<t.nextAt}
function addLog(t,kind,text){t.log.unshift({day:t.day,kind,text,at:now()});t.log=t.log.slice(0,60)}

/* ---------- text ---------- */
const PLAIN={'유죄 인정':['유죄','증거로 충분히 보여줬다'],'공소사실 일부만 인정':['일부만 유죄','증거로 보여준 부분만 인정한다'],
 '무죄 · 범죄의 증명 부족':['무죄','아직 남은 의문이 커서 책임을 묻기 어렵다'],'원고 청구 인용':['원고 승소','원고의 요구를 모두 인정한다'],
 '원고 청구 일부 인용':['원고 일부 승소','증거로 확인된 만큼만 인정한다'],'원고 청구 기각':['원고 패소','요구를 뒷받침할 증거가 모자라다']};
const plainLabel=v=>PLAIN[v.label]?.[0]||v.label,plainNote=v=>PLAIN[v.label]?.[1]||v.note||'';
function witnessLine(w,t){
 const p=NPC[w.id],name=p?.name||'증인',knows=w.knowledge?w.knowledge.replace(/[.。]$/,''):'사건 당일 일부 장면을 봤다';
 const s=T.testimony(w,t.truth);
 if(s.kind==='vague')return `${name}: "잘… 기억이 나지 않습니다. 말씀드리기 어렵습니다."`;
 if(s.kind==='shield')return `${name}: "${knows}. 다만 그 사람이 그럴 사람은 아닙니다."`;
 if(s.kind==='flipped')return `${name}: "지난번에 드린 말씀은… 사실과 다릅니다. 제가 본 건 그게 아니었습니다."`;
 if(s.kind==='first')return `${name}: "${knows}. 분명히 봤습니다."`;
 if(s.p>s.d)return `${name}: "${knows}. 제가 본 것과 기록이 맞습니다."`;
 if(s.d>s.p)return `${name}: "${knows}. 그런데 기록에 적힌 것과는 다르게 기억합니다."`;
 return `${name}: "${knows}."`;
}
function cardText(card,t){
 const lawyer=NPC[t.opponent]?.name||'상대 변호사';
 if(card.type==='objection')return {title:'이의 제기',body:card.valid?`${lawyer} 변호사: "재판장님, 지금 질문은 답을 정해 놓고 묻는 질문입니다."`:`${lawyer} 변호사: "이의 있습니다! 증인을 흔들려는 질문입니다." (질문 자체는 사실을 묻는 내용이었다)`};
 if(card.type==='delay')return {title:'재판일 미루기 신청',body:card.valid?`${lawyer} 변호사: "새로 받은 자료를 검토할 시간이 필요합니다." (자료 제출 기록이 확인됨)`:`${lawyer} 변호사: "준비가 조금 더 필요합니다." (구체적인 이유는 밝히지 않음)`};
 return {title:'법정 밖 언론 플레이',body:`${lawyer} 변호사가 기자들에게 의뢰인의 억울함을 호소했다. 여론이 흔들린다.`};
}

/* ---------- actions ---------- */
function spend(t){if(t.energy<=0){toast('오늘 조사 체력을 다 썼어요. 재판일을 마치세요.');return false}t.energy--;return true}
function act(kind,id,choice){
 const x=current();if(!x||x.st.verdict)return;
 const {c,st}=x,t=ensure(c,st);
 if(waiting(t)){toast('다음 재판일을 기다리는 중입니다.');return}
 if(kind==='inspect'){
  const e=t.evidence.find(v=>v.id===id);if(!e||e.revealed>=2||!spend(t))return;
  e.revealed=T.reveal(e.revealed);
  addLog(t,'조사',e.revealed>=2?`${e.title}: ${T.LABEL.flaw[e.flawType]}${e.flawType!=='none'?` (흠 크기 ${e.flaw})`:''}`:`${e.title}: 흠의 크기 대략 확인`);
 }else if(kind==='decide'){
  const e=t.evidence.find(v=>v.id===id);if(!e||!T.LABEL.decision[choice]||e.decision===choice)return;
  if(!spend(t))return;
  e.decision=choice;
  if((choice==='exclude'||choice==='conditional')&&e.revealed>=1&&e.flawType!=='none')e.publicFlaw=true;
  addLog(t,'증거',`${e.title}: ${T.LABEL.decision[choice]}`);
 }else if(kind==='ask'){
  const w=t.witnesses.find(v=>v.id===id);if(!w||w.asked>=3||!spend(t))return;
  w.asked++;w.revealed=T.reveal(w.revealed);
  if(w.attitude==='flip'&&w.asked>=2&&!w.flipped){w.flipped=true;addLog(t,'번복',`${NPC[w.id]?.name||'증인'}이(가) 진술을 바꿨다`)}
  addLog(t,'증언',witnessLine(w,t));
 }else if(kind==='card'){
  const card=t.cards.find(v=>v.id===id);if(!card||card.choice||!['accept','reject'].includes(choice))return;
  card.choice=choice;
  if(card.type==='delay'&&choice==='accept')t.delayAccepted=true;
  addLog(t,card.type==='objection'?'이의':'미루기',`${cardText(card,t).title}: ${choice==='accept'?'받아들임':'받아들이지 않음'}`);
 }
 save();render();
}

function endDay(){
 const x=current();if(!x||x.st.verdict)return;
 const {c,st}=x,t=ensure(c,st);
 if(waiting(t))return;
 if(t.cards.some(v=>!v.choice)){toast('상대 측 신청에 먼저 답해 주세요.');return}
 const before={g:T.gauge(t),skill:T.skill(t).score,media:{...t.media}};
 let twist=null;
 if(!t.twistUsed&&t.day>=2&&T.unit(t.seed+':twist:'+t.day)<T.twistChance(c.importance)){
  t.twistUsed=true;
  const flip=t.witnesses.find(w=>w.attitude==='flip'&&!w.flipped);
  if(flip){flip.flipped=true;flip.asked=Math.max(flip.asked,1);twist=`${NPC[flip.id]?.name||'증인'}이(가) 갑자기 진술을 바꿨다`}
  else{const id='e'+t.evidence.length,ns=T.roll({id:c.id+'-late',evidence:[{id,title:'막판 제출 자료',note:'선고를 앞두고 새로 제출된 자료',scope:''}],witnesses:[],truth:t.truth},t.seed+':late',[]).evidence[0];
   t.evidence.push(ns);twist='선고를 앞두고 새 자료가 제출됐다'}
  addLog(t,'반전',twist);
 }
 const mediaCard=t.cards.some(v=>v.type==='media');
 t.media=T.pressDay(t.media,t,{twist:!!twist,news:t.media.H>=60?8:0,defenseMedia:mediaCard?8:0});
 for(const e of t.evidence)if(e.publicFlaw)e.airedCounted=true;
 const after={g:T.gauge(t),skill:T.skill(t).score,media:{...t.media}};
 t.daysDone++;
 const desk4=desk(),outlet=REPORTERS[T.hash(c.id+t.day)%REPORTERS.length];
 if(t.media.H>=55)news(`${shortName(c)} · 재판일 ${t.daysDone}`,twist?`${twist}. 법정 안팎이 술렁였다.`:`증거와 증언을 두고 양측 공방이 이어졌다. 화제성 ${t.media.H}.`,outlet.outlet);
 addLog(t,'재판일',`재판일 ${t.daysDone} 종료 · 증거로 보여준 정도 ${after.g.P} · 남은 의문 ${after.g.D}`);
 if(t.daysDone<t.minDays+EXTRA_DAYS){
  t.day++;t.energy=ENERGY;t.cards=T.cards(t,t.day,t.seed);
  t.nextAt=now()+DAY_WAIT+(t.delayAccepted?DELAY_EXTRA:0);t.delayAccepted=false;
 }else{t.cards=[];t.energy=0}
 st.hearingHistory??=[];st.hearingHistory.push({kind:'resumed',week:S.week,v4:true});
 save();
 const d=(a,b)=>{const v=b-a;return (v>0?'+':'')+v};
 modal(`재판일 ${t.daysDone} 결과`,
  `<div class="t4-result">${twist?`<p class="t4-twist">⚡ ${esc(twist)}</p>`:''}
  <div class="t4-delta"><span>증거로 보여준 정도</span><b>${after.g.P}</b><em>${d(before.g.P,after.g.P)}</em></div>
  <div class="t4-delta"><span>아직 남은 의문</span><b>${after.g.D}</b><em>${d(before.g.D,after.g.D)}</em></div>
  <div class="t4-delta"><span>판결 실력</span><b>${after.skill}</b><em>${d(before.skill,after.skill)}</em></div>
  <div class="t4-delta"><span>여론 (처벌·인정 요구)</span><b>${after.media.O}</b><em>${d(before.media.O,after.media.O)}</em></div>
  <div class="t4-delta"><span>화제성</span><b>${after.media.H}</b><em>${d(before.media.H,after.media.H)}</em></div>
  <p class="muted small">${t.daysDone>=t.minDays?'이제 판결할 수 있습니다. 재판일을 더 열 수도 있지만 사건이 밀립니다.':`판결까지 재판일 ${t.minDays-t.daysDone}번 더 필요합니다. 다음 재판일은 ${Math.round((t.nextAt-now())/MIN)}분 뒤 열립니다. 그동안 다른 사건을 진행하세요.`}</p></div>`);
}

/* ---------- verdict ---------- */
function askVerdict(optionId){
 const x=current();if(!x||x.st.verdict)return;
 const {c,st}=x,t=ensure(c,st),opt=c.verdicts.find(v=>v.id===optionId);if(!opt)return;
 if(t.daysDone<t.minDays){toast(`재판일 ${t.minDays-t.daysDone}번이 더 필요해요.`);return}
 ui.t4pending=optionId;
 modal('판결 이유 고르기',`<p><b>${esc(plainLabel(opt))}</b></p><p class="muted small">가장 중요하게 본 이유를 1~2개 고르세요. 판결 리뷰 점수는 이 이유가 재판 기록과 맞는지를 봅니다.</p>
 <div class="t4-reasons">${T.REASONS.map(([id,label])=>`<label class="t4-reason"><input type="checkbox" value="${id}"> ${esc(label)}</label>`).join('')}</div>`,
 `<button class="btn outline" data-action="dismiss">다시 생각하기</button><button class="btn primary" data-action="t4confirm">이 이유로 선고</button>`);
}
function confirmVerdict(){
 const x=current();if(!x||x.st.verdict||!ui.t4pending)return;
 const reasons=[...document.querySelectorAll('.t4-reason input:checked')].map(i=>i.value).slice(0,2);
 if(!reasons.length){toast('이유를 하나 이상 골라 주세요.');return}
 const {c,st}=x,t=ensure(c,st),opt=c.verdicts.find(v=>v.id===ui.t4pending);ui.t4pending=null;ui.modal=null;
 if(!opt)return;
 const dir=T.direction(opt,c.kind),res=T.skill(t,{dir,criminal:isCriminal(c),reasons});
 // Satisfy legacy gates once: the v4 loop already ran the trial days.
 st.phase=3;st.liveHearing=null;st.nextHearingWeek=null;st.hearingHistory??=[];
 while(st.hearingHistory.filter(v=>v.kind==='resumed').length<4)st.hearingHistory.push({kind:'resumed',week:S.week,v4:true});
 S.actions=0;
 const why=reasons.map(r=>T.REASONS.find(x=>x[0]===r)?.[1]).filter(Boolean).join(' · ');
 const prevEval=StoryEngine.evaluate;
 StoryEngine.evaluate=()=>({score:res.score,why:'판결 이유: '+why});
 try{conclude(opt.id)}finally{StoryEngine.evaluate=prevEval}
 if(!st.verdict){toast('선고를 기록하지 못했습니다. 다시 시도해 주세요.');console.warn('v4 verdict blocked',c.id);return}
 st.grade=res.score;
 after(c,st,t,opt,dir,reasons,res);
}

function after(c,st,t,opt,dir,reasons,res){
 const side=T.sideOf(dir),match=T.opinionMatch(t.media.O,dir),ev=T.evaluate(res.score,match,t,dir,t.seed);
 const d=desk(),heat=t.media.H,count=heat>=70?2:1;
 const pool=[...REPORTERS].sort((a,b)=>T.hash(c.id+a.id)-T.hash(c.id+b.id));
 if(c.importance>=4&&!pool.slice(0,count).some(r=>r.style==='law')){const i=pool.findIndex(r=>r.style==='law');pool.unshift(pool.splice(i,1)[0])}
 const headlines=pool.slice(0,count).map(r=>{
  const filtered=t.evidence.some(e=>e.publicFlaw);const key=side===1?'1':side===-1?(filtered&&HEAD[r.style]['-1f']?'-1f':'-1'):'0.5',lines=HEAD[r.style][key]||HEAD[r.style]['1'];
  const mood=d.reporters[r.id];
  const delta=r.style==='victim'?(side===1?6:-6):r.style==='law'?(res.score>=70?6:-4):r.style==='tabloid'?3:r.style==='probe'?(side===-1&&T.gauge(t).D>=35?5:-2):(match>=40&&match<=60?3:0);
  mood.mood=T.clamp(mood.mood+delta);
  const text=T.pick(lines,c.id+r.id).replace('{c}',shortName(c));
  news(text,`${reporterName(r)} 기자 · ${opt.label}. ${mood.mood<40?'재판부를 향한 비판적 시각이 담겼다.':mood.mood>65?'재판부의 판단 과정을 비교적 자세히 소개했다.':'판결 내용을 전하며 양측 반응을 함께 실었다.'}`,r.outlet);
  return {reporter:r.id,name:reporterName(r),outlet:r.outlet,label:r.label,text,mood:mood.mood};
 });
 // Media desk: fixed facts → anomalies → column / court beat / community, with running narratives.
 const MD=window.VerdictMediaDesk;let deskOut=null;
 if(MD){
  const g=T.gauge(t),oppNpc=NPC[t.opponent];
  deskOut=MD.react({caseId:c.id,caseName:c.name,category:c.tag+' '+(c.contentPack?.category||''),verdictLabel:plainLabel(opt),side,
   P:g.P,D:g.D,skill:res.score,match,H:t.media.H,O:t.media.O,S:t.media.S,importance:c.importance,daysDone:t.daysDone,minDays:t.minDays,
   illegalOut:t.evidence.some(e=>e.flawType==='illegal'&&e.decision==='exclude'),flip:t.witnesses.some(w=>w.flipped),twist:t.log.some(l=>l.kind==='반전'),
   judgeName:S.name||'재판장',opponent:{id:t.opponent||'none',name:oppNpc?.name||'상대',style:t.style,styleLabel:T.LABEL.style[t.style]},
   evidence:t.evidence.map(e=>({decision:e.decision,revealed:e.revealed,flawType:e.flawType}))},d.media);
  d.media=deskOut.state;
  news(deskOut.column.title,`${deskOut.column.writer} 칼럼 · ${deskOut.column.body}`,deskOut.column.outlet);
  news(deskOut.beat.title,`${deskOut.beat.writer} 기자 · ${deskOut.beat.body}`,deskOut.beat.outlet);
  news(`시민광장 · ${shortName(c)} (${deskOut.community.label})`,deskOut.community.comments.slice(0,2).map(x=>`"${x.text}"`).join(' / '),'시민광장');
 }
 const sns=deskOut?deskOut.community.comments:[];
 const opp=NPC[t.opponent];
 if(opp){opp.vsJudge??={win:0,lose:0};if(side===-1)opp.vsJudge.win++;else if(side===1)opp.vsJudge.lose++}
 t.final={option:opt.id,label:opt.label,dir,reasons,skill:res.score,items:res.items,match,review:ev.review,evaluators:ev.scores,
  reviewAt:now()+REVIEW_AFTER,reviewShown:false,headlines,sns,desk:deskOut&&{summary:deskOut.summary,anomalies:deskOut.anomalies,column:deskOut.column,beat:deskOut.beat,community:{mode:deskOut.community.mode,label:deskOut.community.label},narratives:deskOut.narratives},proof:T.gauge(t),media:{...t.media},at:now()};
 t.revealAt=now()+T.between(REVEAL_MIN_DAYS,REVEAL_MAX_DAYS,t.seed+':reveal')*DAY;
 st.trialReview={skill:res.score,review:ev.review,proof:t.final.proof.P,doubt:t.final.proof.D,publicOpinion:{...t.media}};
 save();render();
 modal('선고 완료',`<p><b>${esc(plainLabel(opt))}</b></p>
  <div class="t4-delta"><span>판결 실력</span><b>${res.score}</b></div>
  <div class="t4-delta"><span>여론과 맞은 정도</span><b>${match}</b></div>
  ${deskOut?`<h4>📋 판결 요약</h4><div class="t4-summary">${deskOut.summary.map(l=>`<div>${esc(l)}</div>`).join('')}</div>
  <h4>오늘의 1면</h4><p class="t4-headline"><small>${esc(deskOut.column.outlet)} · ${esc(deskOut.column.desk)}</small><br>${esc(deskOut.column.title)}</p><p class="t4-headline"><small>${esc(deskOut.beat.outlet)} · ${esc(deskOut.beat.desk)}</small><br>${esc(deskOut.beat.title)}</p>`:''}
  ${headlines.map(x=>`<p class="t4-headline"><small>${esc(x.outlet)} · ${esc(x.name)} 기자</small><br>${esc(x.text)}</p>`).join('')}
  <p class="muted small">판결 리뷰 점수는 게임 시간 3일 뒤(현실 약 9시간 뒤) 공개됩니다.</p>`);
}

/* ---------- time-based events ---------- */
function nickname(){
 const d=desk(),list=d.reviews;if(list.length<3)return;
 const acquit=list.filter(x=>x.side===-1).length/list.length,convict=list.filter(x=>x.side===1).length/list.length;
 const against=list.filter(x=>x.match<40).length/list.length,skill=list.reduce((a,x)=>a+x.skill,0)/list.length;
 const name=skill>=78?'원칙의 판사':against>=0.5?'여론에 흔들리지 않는 판사':acquit>=0.6?'의심의 재판장':convict>=0.7?'철벽 판사':'균형의 재판장';
 if(d.nickname!==name){d.nickname=name;news(`법조계가 부르는 이름 · "${name}"`,`${S.name||'재판장'} 판사의 판결 경향을 두고 언론이 붙인 별명이다.`,'법조일보')}
}
function tick(){
 if(!S?.name)return false;
 let changed=false;const t0=now();
 for(const c of CASES){
  const st=S.cases[c.id],t=st?.trial4;if(!t||!st.verdict||!t.final)continue;
  if(!t.final.reviewShown&&t0>=t.final.reviewAt){
   t.final.reviewShown=true;changed=true;
   const d=desk();d.reviews.push({caseId:c.id,skill:t.final.skill,review:t.final.review,match:t.final.match,side:T.sideOf(t.final.dir)});d.reviews=d.reviews.slice(-60);
   news(`판결 리뷰 · ${shortName(c)} ${t.final.review}점`,t.final.evaluators.map(e=>`${e.name} ${e.score}점`).join(' · '),'법조일보');
   nickname();
  }
  if(!t.truthShown&&t.revealAt&&t0>=t.revealAt){
   t.truthShown=true;changed=true;
   const crim=isCriminal(c);
   const fact=t.truth==='did'?(crim?'당시 피고인의 행위가 실제로 있었던 것으로 확인됐다':'당시 청구의 핵심 사실이 실제로 있었던 것으로 확인됐다')
    :t.truth==='didnt'?(crim?'당시 혐의가 사실이 아니었던 것으로 드러났다':'당시 주장된 사실이 없었던 것으로 드러났다')
    :'당시 알려지지 않았던 사정이 새로 확인됐다';
   news(`과거 사건 재조명 · ${shortName(c)}`,`후속 취재에서 ${fact}. 당시 판결은 "${t.final.label}", 여론 방향은 ${t.final.media.O}점이었다. 판결은 그대로 확정되어 있다.`,'탐사저널K');
  }
 }
 if(changed)save();
 return changed;
}

/* ---------- views ---------- */
function bar(label,v,cls){return `<div class="t4-meter ${cls||''}"><div><span>${label}</span><b>${v}</b></div><i><s style="width:${Math.max(0,Math.min(100,v))}%"></s></i></div>`}
function flawText(e,seed){
 if(e.revealed===0)return '흠: ?';
 if(e.revealed===1){const [lo,hi]=T.rangeOf(e.flaw,seed+e.id);return `흠 크기 약 ${lo}~${hi}`}
 return e.flawType==='none'?'흠 없음':`${T.LABEL.flaw[e.flawType]} · 흠 크기 ${e.flaw}`;
}
function evidenceCard(e,t,locked){
 const dis=locked||t.energy<=0?'disabled':'';
 const opt=(v,l)=>`<button class="t4-chip ${e.decision===v?'on':''}" data-action="t4" data-kind="decide" data-id="${esc(e.id)}" data-choice="${v}" ${dis||e.decision===v?'disabled':''}>${l}</button>`;
 return `<article class="t4-card"><header><b>${esc(e.title)}</b><span class="t4-tag">증거의 힘 ${e.strength}</span></header>
 ${e.note?`<p class="muted small">${esc(e.note)}</p>`:''}
 <p class="t4-flaw ${e.revealed>=2&&e.flawType!=='none'?'bad':''}">${esc(flawText(e,t.seed))}</p>
 <div class="t4-row"><button class="t4-chip ghost" data-action="t4" data-kind="inspect" data-id="${esc(e.id)}" ${dis||e.revealed>=2?'disabled':''}>🔎 조사하기</button></div>
 <div class="t4-row t4-choose"><span>이 증거를</span>${opt('use','쓴다')}${opt('conditional','조건 붙여 쓴다')}${opt('exclude','뺀다')}</div></article>`;
}
function witnessCard(w,t,locked){
 const p=NPC[w.id],dis=locked||t.energy<=0||w.asked>=3?'disabled':'';
 const att=w.revealed>=2?T.LABEL.attitude[w.attitude]:w.revealed===1?'태도: 살펴보는 중':'태도: ?';
 const rel=w.revealed>=2?`믿을 만한 정도 ${w.reliability}`:w.revealed===1?`믿을 만한 정도 약 ${T.rangeOf(w.reliability,t.seed+w.id).join('~')}`:'믿을 만한 정도 ?';
 return `<article class="t4-card"><header><button class="t4-name" data-action="npc" data-id="${esc(w.id)}">👤 ${esc(p?.name||'증인')}</button><span class="t4-tag">${esc(w.role)}</span></header>
 <p class="small">${esc(att)} · ${esc(rel)}</p>${w.asked?`<p class="t4-quote">${esc(witnessLine(w,t))}</p>`:''}
 <div class="t4-row"><button class="t4-chip ghost" data-action="t4" data-kind="ask" data-id="${esc(w.id)}" ${dis}>🗣 ${w.asked?'더 묻기':'질문하기'}</button><small class="muted">${w.asked}/3</small></div></article>`;
}
function cardBlock(card,t){
 const x=cardText(card,t);
 if(card.type==='media')return `<div class="t4-event media"><b>📣 ${esc(x.title)}</b><p>${esc(x.body)}</p></div>`;
 const done=card.choice;
 const labels=card.type==='objection'?['이의 받아들이기','넘어가기']:['미뤄주기','거절하기'];
 return `<div class="t4-event ${done?'done':''}"><b>${card.type==='objection'?'✋':'⏳'} ${esc(x.title)}</b><p>${esc(x.body)}</p>
 ${done?`<p class="small">→ ${done==='accept'?labels[0]:labels[1]}</p>`:`<div class="t4-row"><button class="btn mini primary" data-action="t4" data-kind="card" data-id="${esc(card.id)}" data-choice="accept">${labels[0]}</button><button class="btn mini outline" data-action="t4" data-kind="card" data-id="${esc(card.id)}" data-choice="reject">${labels[1]}</button></div>`}</div>`;
}
const HELP=`<details class="t4-help" open><summary>처음이라면 이것만 기억하세요</summary><ol><li><b>증거</b> 탭에서 조사하기로 흠을 확인하세요. 흠은 ? → 대략 → 정확한 값 순으로 드러나요.</li><li>증거를 <b>쓸지, 조건 붙여 쓸지, 뺄지</b> 정하세요. 불법으로 얻은 증거를 쓰면 판결 실력이 크게 깎여요.</li><li><b>증인</b> 탭에서 질문하면 태도가 드러나요. 두 번 물으면 말을 바꾸는 증인도 있어요.</li><li>상대 변호사의 신청은 <b>정당한지</b> 보고 답하세요.</li><li>체력을 다 쓰면 아래 <b>재판일 마치기</b>를 누르고, 정해진 횟수가 차면 <b>판결</b> 탭에서 선고하세요.</li></ol></details>`;
function tabsFor(c,st){
 const t=st.trial4;
 if(st.verdict)return [['result','선고 이후'],['case','사건'],['log','기록']];
 const pending=t.cards.filter(v=>!v.choice).length,undecided=t.evidence.filter(e=>!e.decision).length,ready=t.daysDone>=t.minDays&&!waiting(t);
 return [['case','사건'],['day','재판일',pending],['evidence','증거',undecided],['witness','증인'],['verdict','판결',ready?'!':0],['log','기록']];
}
function pager(kind,items,render,label){
 if(!items.length)return `<p class="muted">${label}이(가) 없습니다.</p>`;
 const key=kind==='evidence'?'t4ev':'t4w';let i=Math.max(0,Math.min(items.length-1,ui[key]||0));ui[key]=i;
 const dots=items.map((_,k)=>`<button class="t4-dot ${k===i?'on':''}" data-action="t4page" data-kind="${kind}" data-i="${k}" aria-label="${k+1}번째"></button>`).join('');
 return `<div class="t4-pager" data-kind="${kind}" data-n="${items.length}">${render(items[i])}
 <div class="t4-pagenav"><button class="t4-chip" data-action="t4page" data-kind="${kind}" data-i="${i-1}" ${i<=0?'disabled':''}>‹ 이전</button><div class="t4-dots">${dots}<span>${i+1} / ${items.length}</span></div><button class="t4-chip" data-action="t4page" data-kind="${kind}" data-i="${i+1}" ${i>=items.length-1?'disabled':''}>다음 ›</button></div></div>`;
}
function dayPage(c,st){
 const t=st.trial4,g=T.gauge(t),wait=waiting(t),sk=T.skill(t).score,opp=NPC[t.opponent],rec=opp?.vsJudge;
 const mins=wait?Math.max(1,Math.ceil((t.nextAt-now())/MIN)):0;
 return `<section class="panel t4"><div class="t4-head"><h3>재판일 ${Math.min(t.daysDone+1,t.minDays+EXTRA_DAYS)} <small>/ 최소 ${t.minDays}</small></h3><span class="t4-energy">${'●'.repeat(t.energy)}${'○'.repeat(ENERGY-t.energy)} 조사 체력</span></div>
 ${wait?`<div class="t4-wait">⏳ 다음 재판일까지 ${mins}분 · 그동안 다른 사건을 진행할 수 있어요.</div>`:''}
 ${bar('증거로 보여준 정도',g.P,'p')}${bar('아직 남은 의문',g.D,'d')}
 <div class="t4-stats"><span>판결 실력 <b>${sk}</b></span><span>화제성 <b>${t.media.H}</b></span><span>여론 <b>${t.media.O>0?'+':''}${t.media.O}</b></span></div>
 <p class="t4-opp">상대: ${esc(opp?.name||'변호인')} · ${esc(T.LABEL.style[t.style])}${rec&&(rec.win+rec.lose)?` · 내 법정 전적 ${rec.win}승 ${rec.lose}패`:''}</p>
 ${t.cards.length&&!wait?`<h4>상대 측 신청</h4>${t.cards.map(x=>cardBlock(x,t)).join('')}`:'<p class="muted small">오늘은 상대 측 신청이 없습니다.</p>'}
 ${t.log.length?`<div class="t4-log"><h4>방금 일어난 일</h4>${t.log.slice(0,3).map(l=>`<p><small>재판일 ${l.day} · ${esc(l.kind)}</small> ${esc(l.text)}</p>`).join('')}</div>`:''}
 ${!completed().length&&t.daysDone===0?HELP:''}</section>`;
}
function verdictPage(c,st){
 const t=st.trial4,wait=waiting(t),canVerdict=t.daysDone>=t.minDays&&!wait,g=T.gauge(t);
 return `<section class="panel t4 t4-verdict"><h3>⚖ 판결</h3>${canVerdict?'':`<p class="notice">${t.daysDone<t.minDays?`재판일이 ${t.minDays-t.daysDone}번 더 필요해요.`:'다음 재판일을 기다리는 중이에요.'}</p>`}
 ${bar('증거로 보여준 정도',g.P,'p')}${bar('아직 남은 의문',g.D,'d')}
 <p class="muted small">판결 실력은 증거와 의문으로만 매겨집니다. 여론과 숨겨진 진실은 점수에 들어가지 않아요.</p>
 ${c.verdicts.map(v=>`<button class="choice" data-action="t4verdict" data-id="${esc(v.id)}" ${canVerdict?'':'disabled'}><span class="choice-index">⚖</span><span><strong>${esc(plainLabel(v))}</strong><small>${esc(plainNote(v))}</small></span><span class="chevron">›</span></button>`).join('')}</section>`;
}
function dock(c,st){
 const t=st.trial4;if(st.verdict)return '';
 const wait=waiting(t),pending=t.cards.filter(v=>!v.choice).length,moreDays=t.daysDone<t.minDays+EXTRA_DAYS;
 if(wait)return `<div class="t4-dock"><span>⏳ 다음 재판일까지 ${Math.max(1,Math.ceil((t.nextAt-now())/MIN))}분</span><button class="btn outline mini" data-action="tab" data-tab="courtList">다른 사건</button></div>`;
 const main=pending?`<button class="btn primary" data-action="t4tab" data-tab="day">신청 ${pending}건 답하기</button>`
  :moreDays?`<button class="btn primary" data-action="t4end">${t.daysDone>=t.minDays?'재판일 더 열기':'재판일 마치기'}</button>`
  :`<button class="btn primary" data-action="t4tab" data-tab="verdict">판결하러 가기</button>`;
 return `<div class="t4-dock"><span class="t4-energy">${'●'.repeat(t.energy)}${'○'.repeat(ENERGY-t.energy)}</span>${t.daysDone>=t.minDays&&moreDays&&!pending?`<button class="btn outline" data-action="t4tab" data-tab="verdict">판결</button>`:''}${main}</div>`;
}
function resultPanel(c,st){
 const t=st.trial4,f=t?.final;if(!f)return '';
 const reviewed=f.reviewShown||now()>=f.reviewAt,dk=f.desk;
 const groups={anger:'분노',sympathy:'동정',cynic:'냉소',legal:'법리 옹호',flaw:'법리 옹호'};
 const comments=(f.sns||[]).map(x=>`<div class="t4-sns ${x.pol==='+'?'pos':x.pol==='-'||x.pol==='?'?'neg':''}"><b>${esc(x.nick)}</b>${x.cluster?` <span class="t4-tag">${groups[x.cluster]||''}</span>`:''}<p>${esc(x.text)}</p><small>▲ ${x.likes}</small>${x.reply?`<div class="t4-reply">↳ <b>${esc(x.reply.nick)}</b> ${esc(x.reply.text)}</div>`:''}</div>`).join('');
 return `<section class="panel t4"><h3>📰 선고 이후</h3>
 <div class="t4-stats"><span>판결 실력 <b>${f.skill}</b></span><span>여론과 맞은 정도 <b>${f.match}</b></span><span>판결 리뷰 <b>${reviewed?f.review:'공개 전'}</b></span></div>
 ${reviewed?`<p class="small">${f.evaluators.map(e=>`${esc(e.name)} ${e.score}점`).join(' · ')}</p>`:`<p class="muted small">판결 리뷰는 ${Math.max(1,Math.ceil((f.reviewAt-now())/HOUR))}시간 뒤 공개됩니다.</p>`}
 ${dk?`<h4>📋 판결 요약</h4><div class="t4-summary">${dk.summary.map(l=>`<div>${esc(l)}</div>`).join('')}</div>
 <article class="t4-article"><small>${esc(dk.column.outlet)} · ${esc(dk.column.desk)} · ${esc(dk.column.writer)}</small><h4>${esc(dk.column.title)}</h4><p>${esc(dk.column.body)}</p></article>
 <article class="t4-article beat"><small>${esc(dk.beat.outlet)} · ${esc(dk.beat.desk)} · ${esc(dk.beat.writer)} 기자</small><h4>${esc(dk.beat.title)}</h4><p>${esc(dk.beat.body)}</p></article>`:''}
 ${f.headlines?.length?`<h4>다른 매체</h4>${f.headlines.map(x=>`<p class="t4-headline"><small>${esc(x.outlet)} · ${esc(x.name)} 기자 (${esc(x.label)})</small><br>${esc(x.text)}</p>`).join('')}`:''}
 <h4>💬 시민광장${dk?` · <span class="t4-mode ${dk.community.mode}">${esc(dk.community.label)}</span>`:''}</h4>${comments}
 ${dk?.narratives?.length?`<h4>언론이 주목하는 흐름</h4>${dk.narratives.map(n=>`<p class="t4-narr l${n.level}">${esc(n.text)}</p>`).join('')}`:''}
 <details class="t4-log"><summary>판결 실력 계산 근거</summary>${f.items.map(i=>`<p>${i.points>0?'+':''}${i.points} · ${esc(i.text)}</p>`).join('')||'<p>가감 항목 없음</p>'}</details></section>`;
}

/* ---------- court screen takeover ---------- */
const priorCourt=court;
let lastCaseId=null;
court=function(){
 const html=priorCourt(),x=current();
 if(!x||!html.includes('court-screen-hearing'))return html;
 const {c,st}=x,tpl=document.createElement('template');tpl.innerHTML=html;
 for(const sel of ['.compact-case-witness','.witness-exams','.trial-v32','.live-hearing-panel','.action-panel'])tpl.content.querySelectorAll(sel).forEach(n=>n.remove());
 tpl.content.querySelectorAll('section.panel').forEach(s=>{if(s.querySelector('[data-action="activateWitnesses"],[data-action="dramaAsk"],[data-action="witnessQuestion"]'))s.remove()});
 const grab=sel=>{const n=tpl.content.querySelector(sel);return n?n.innerHTML:''};
 const overview=tpl.content.querySelector('.case-narrative');
 if(overview){overview.classList.remove('court-play-overview');overview.querySelectorAll('h3').forEach(h=>h.remove())}
 const overviewHtml=overview?overview.innerHTML:'';
 const argsHtml=grab('.court-screen-arguments'),evidHtml=grab('.court-screen-evidence'),histHtml=grab('.court-screen-history');
 const header=tpl.content.querySelector('.court-play-header');
 const t=st.verdict?st.trial4:ensure(c,st);
 if(lastCaseId!==c.id){lastCaseId=c.id;ui.t4ev=0;ui.t4w=0;ui.t4tab=st.verdict?'result':(t.daysDone===0&&!t.log.length?'case':'day')}
 const tabs=t?tabsFor(c,st):[['case','사건'],['log','기록']];
 if(!tabs.some(v=>v[0]===ui.t4tab))ui.t4tab=tabs[0][0];
 const status=header?.querySelector('.court-play-status');
 if(status&&t)status.innerHTML=st.verdict?`<span>선고 완료</span><span>재판일 ${t.daysDone}회</span>`:`<span>${waiting(t)?'다음 재판일 대기':t.daysDone>=t.minDays?'판결 가능':'재판 진행 중'}</span><span>재판일 ${t.daysDone}/${t.minDays}</span><span>중요도 ${c.importance}</span>`;
 const crim=isCriminal(c),who=c.who||[];
 const facts=[[crim?'피고인':'원고',NPC[who[crim?0:0]]?.name],[crim?'피해자':'피고',NPC[who[1]]?.name],['분류',c.tag],['상대 변호사',t?NPC[t.opponent]?.name:null],['최소 재판일',t?t.minDays+'번':null],['증거·증인',t?`증거 ${t.evidence.length}건 · 증인 ${t.witnesses.length}명`:null]].filter(v=>v[1]);
 const casePage=`<section class="panel t4 t4-case"><h3>무슨 사건인가?</h3>${overviewHtml||`<p>${esc(c.sub||'')}</p>`}
  <dl class="t4-facts">${facts.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
  ${argsHtml?`<details class="t4-more"><summary>검사·변호인 주장 자세히 보기</summary><div>${argsHtml}</div></details>`:''}
  ${!st.verdict?`<button class="btn primary full mt" data-action="t4tab" data-tab="${t.daysDone===0&&!t.log.length?'evidence':'day'}">${t.daysDone===0&&!t.log.length?'재판 시작하기 →':'재판으로 돌아가기 →'}</button>`:''}</section>`;
 const logPage=`<section class="panel t4"><h3>📋 재판 기록</h3>${t?.log?.length?t.log.map(l=>`<p class="small"><b>재판일 ${l.day} · ${esc(l.kind)}</b> ${esc(l.text)}</p>`).join(''):'<p class="muted">아직 기록이 없습니다.</p>'}
  ${evidHtml?`<details class="t4-more"><summary>제출된 증거 원문 기록</summary><div>${evidHtml}</div></details>`:''}
  ${histHtml?`<details class="t4-more"><summary>사건 자료와 이전 기록</summary><div>${histHtml}</div></details>`:''}</section>`;
 let page='';
 const wait=t&&waiting(t);
 if(ui.t4tab==='case')page=casePage;
 else if(ui.t4tab==='log')page=logPage;
 else if(ui.t4tab==='result')page=resultPanel(c,st);
 else if(ui.t4tab==='day')page=dayPage(c,st);
 else if(ui.t4tab==='evidence'){const done=t.evidence.filter(e=>e.decision).length;page=`<section class="panel t4"><div class="t4-head"><h3>증거</h3><span class="t4-tag">결정 ${done}/${t.evidence.length}</span></div>${pager('evidence',t.evidence,e=>evidenceCard(e,t,wait),'증거')}</section>`}
 else if(ui.t4tab==='witness')page=`<section class="panel t4"><div class="t4-head"><h3>증인</h3><span class="t4-tag">${t.witnesses.filter(w=>w.asked).length}/${t.witnesses.length}명 신문</span></div>${pager('witness',t.witnesses,w=>witnessCard(w,t,wait),'증인')}</section>`;
 else if(ui.t4tab==='verdict')page=verdictPage(c,st);
 const nav=`<nav class="t4-tabs" aria-label="재판 화면">${tabs.map(([id,label,badge])=>`<button class="t4-tab ${ui.t4tab===id?'on':''}" data-action="t4tab" data-tab="${id}">${label}${badge?`<i>${badge}</i>`:''}</button>`).join('')}</nav>`;
 return `<div class="court-play t4app">${header?header.outerHTML:''}${nav}<div class="t4-page">${page}</div>${t?dock(c,st):''}</div>`;
};
function swipeInit(){
 let sx=0,sy=0,box=null;
 document.addEventListener('touchstart',e=>{box=e.target.closest('.t4-pager');if(!box)return;sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
 document.addEventListener('touchend',e=>{if(!box)return;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
  if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5){const kind=box.dataset.kind,key=kind==='evidence'?'t4ev':'t4w',n=Number(box.dataset.n);
   const i=Math.max(0,Math.min(n-1,(ui[key]||0)+(dx<0?1:-1)));if(i!==ui[key]){ui[key]=i;render()}}box=null},{passive:true});
}
swipeInit();
const priorRender=render;
render=function(){priorRender();document.body.classList.toggle('t4-court',ui.tab==='court')};

/* Case list: plain words and the v4 trial-day counter. */
if(typeof courtList==='function'){
 const priorList=courtList;
 courtList=function(){
  let html=priorList();
  html=html.replace('접수된 사건을 확인하고 이번 주 심리할 사건을 선택하세요.','맡은 사건을 골라 재판을 이어가세요.')
   .replace(/<div class="stat-card"><label>금주 심리 여력<\/label><strong>[^<]*<\/strong><\/div>/,`<div class="stat-card"><label>판결 리뷰 평균</label><strong>${(()=>{const r=desk().reviews;return r.length?Math.round(r.reduce((a,x)=>a+x.review,0)/r.length)+'점':'-'})()}</strong></div>`)
   .replace(/시간을 진행해 보세요\./,'새 사건은 매일 10시~22시에 들어옵니다.')
   .replace(/가상 시간이 진행되면/,'시간이 흐르면');
  return html.replace(/data-id="([^"]+)"([\s\S]*?)심리 \d\/3/g,(m,id,mid)=>{const t=S.cases[id]?.trial4;return `data-id="${id}"${mid}${t?`재판일 ${t.daysDone}/${t.minDays}`:'재판 전'}`});
 };
}

/* ---------- clicks ---------- */
const priorClick=clicker;
clicker=function(e){
 const el=e.target.closest('[data-action]');
 const a=el?.dataset.action;
 if(a==='t4'){e.preventDefault();act(el.dataset.kind,el.dataset.id,el.dataset.choice);return}
 if(a==='t4end'){e.preventDefault();endDay();return}
 if(a==='t4tab'){e.preventDefault();ui.t4tab=el.dataset.tab;render();window.scrollTo({top:0,behavior:'instant'});return}
 if(a==='t4page'){e.preventDefault();const key=el.dataset.kind==='evidence'?'t4ev':'t4w';ui[key]=Number(el.dataset.i)||0;render();return}
 if(a==='t4verdict'){e.preventDefault();askVerdict(el.dataset.id);return}
 if(a==='t4confirm'){e.preventDefault();confirmVerdict();return}
 if(a==='verdict'||a==='courtStep'||a==='livePostpone'){e.preventDefault();return}
 return priorClick(e);
};

/* ---------- heartbeat ---------- */
setInterval(()=>{
 const changed=tick();
 if(ui.modal)return;
 const x=ui.tab==='court'&&current(),t=x&&x.st.trial4;
 if(changed||(t&&(waiting(t)||(t.final&&!t.final.reviewShown))))render();
},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&tick()&&!ui.modal)render()});
setTimeout(()=>{if(tick()&&!ui.modal)render()},1500);

window.VerdictTrialPlay={ensure,tick,REPORTERS};
})();
