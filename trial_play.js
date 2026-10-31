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

/* ---------- curated story ---------- */
const curOf=c=>window.VerdictCurated?.cases[c.contentPack?.archetypeId||c.story?.packOrigin?.id];
function namesOf(c,t){
 const n={A:NPC[c.who?.[0]]?.name,B:NPC[c.who?.[1]]?.name,L:t?NPC[t.opponent]?.name:null};
 (t?.witnesses||[]).forEach((w,i)=>{n['W'+(i+1)]=NPC[w.id]?.name});
 return n;
}
const tell=(c,t,text)=>window.VerdictCurated?window.VerdictCurated.fill(text,namesOf(c,t)):String(text||'');
function endingKey(c,dir){const side=T.sideOf(dir);return isCriminal(c)?(side===-1?'acquit':'convict'):(side===-1?'respondent':'claimant')}

function witnessSeeds(c){
 const cur=curOf(c);
 if(cur)return cur.witnesses.map(w=>({role:w.role,knowledge:tell(c,null,w.says),interest:tell(c,null,w.stake),story:tell(c,null,w.story)}));
 const pack=cast.get(c.contentPack?.archetypeId)||[];
 if(pack.length)return pack.slice(0,3).map(p=>({role:p.role,knowledge:p.knowledge,interest:p.interest}));
 const ids=[c.story?.witness,c.story?.investigator?.detective].filter(id=>id&&NPC[id]&&!c.who?.includes(id)&&!c.side?.includes(id));
 return [...new Set(ids)].slice(0,2).map(id=>({existing:id,role:NPC[id].role||'사건 관계인',knowledge:'',interest:''}));
}
function evidenceSeeds(c){
 const cur=curOf(c);
 if(cur)return cur.evidence.map((e,i)=>({id:'e'+i,title:tell(c,null,e.title),note:tell(c,null,e.caveat),scope:tell(c,null,e.shows),hintFlaw:e.flaw}));
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
   if(w.story){NPC[id].backstory=w.story;NPC[id].bond=w.interest||NPC[id].bond}
   if(/할머니|어머니|딸|누나|언니|아내/.test(w.role))NPC[id].gender='여';else if(/할아버지|아버지|아들|형|오빠|남편/.test(w.role)&&!/형제/.test(w.role))NPC[id].gender='남';
   remember(id,'관련 사건',c.name+'의 증인으로 출석',c.id)}
  return {id,role:w.role,knowledge:w.knowledge,interest:w.interest,story:w.story||''};
 });
 const history=S.trial4History||[];
 const rolled=T.roll({id:c.id,archetypeId:c.contentPack?.archetypeId||c.id,truth:T.truthFromStory(c.story?.privateTruth?.kind),evidence:evidenceSeeds(c),witnesses},seed,history);
 rolled.witnesses.forEach((w,i)=>{w.story=witnesses[i]?.story||''});
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
const clock=ms=>new Date(ms).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
// 재판일 1은 / 재판일 2는: particle after a spoken Korean number
const numFinal=n=>[1,1,0,1,0,0,1,1,1,1][Math.abs(n)%10]||(n%10===0&&n>0);
const dayP=(n,p)=>`재판일 ${n}${numFinal(n)?p:{'은':'는','을':'를','이':'가'}[p]}`;
const minsLeft=t=>Math.max(1,Math.ceil((t.nextAt-now())/MIN));
/* One status for every place that shows a case: header, case list, home. */
function stage(c,st){
 const t=st?.trial4;
 if(st?.verdict)return {k:'done',text:'선고 완료',short:'선고 완료'};
 if(!t||(!t.daysDone&&!t.log.length))return {k:'new',text:'재판 전 · 바로 시작할 수 있어요',short:'재판 전'};
 if(t.daysDone>=t.minDays&&!t.cards.some(v=>!v.choice))return {k:'verdict',text:'⚖ 판결할 수 있어요',short:'판결 가능'};
 if(waiting(t))return {k:'wait',text:`⏳ 재판일 ${t.day} · ${clock(t.nextAt)} 열림 (${minsLeft(t)}분 뒤)`,short:`${minsLeft(t)}분 뒤 재판일 ${t.day}`};
 const pending=t.cards.filter(v=>!v.choice).length;
 if(pending)return {k:'req',text:`✋ 상대 측 신청 ${pending}건 · 답할 차례`,short:'상대 신청 답하기'};
 if(t.daysDone>=t.minDays)return {k:'verdict',text:'⚖ 판결할 수 있어요',short:'판결 가능'};
 return {k:'ready',text:`▶ 재판일 ${t.day} 진행할 수 있어요`,short:`재판일 ${t.day} 진행 가능`};
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
 if(waiting(t)){toast(`다음 재판일은 ${clock(t.nextAt)}에 열려요.`);return}
 const g0=T.gauge(t),k0=T.skill(t).score;let say='';
 if(kind==='inspect'){
  const e=t.evidence.find(v=>v.id===id);if(!e||e.revealed>=2||!spend(t))return;
  e.revealed=T.reveal(e.revealed);
  const f=flawInfo(e,t.seed);addLog(t,'조사',`${e.title}: ${f.head}`);say=`🔎 ${e.title} · ${f.head}`;
 }else if(kind==='decide'){
  const e=t.evidence.find(v=>v.id===id);if(!e||!T.LABEL.decision[choice]||e.decision===choice)return;
  if(!spend(t))return;
  e.decision=choice;
  if((choice==='exclude'||choice==='conditional')&&e.revealed>=1&&e.flawType!=='none')e.publicFlaw=true;
  addLog(t,'증거',`${e.title}: ${T.LABEL.decision[choice]}`);say=`📁 ${e.title} · ${T.LABEL.decision[choice]}`;
 }else if(kind==='ask'){
  const w=t.witnesses.find(v=>v.id===id);if(!w||w.asked>=3||!spend(t))return;
  w.asked++;w.revealed=T.reveal(w.revealed);
  if(w.attitude==='flip'&&w.asked>=2&&!w.flipped){w.flipped=true;addLog(t,'번복',`${NPC[w.id]?.name||'증인'}이(가) 진술을 바꿨다`)}
  addLog(t,'증언',witnessLine(w,t));say=`🗣 ${NPC[w.id]?.name||'증인'}의 증언을 들었어요`;
 }else if(kind==='card'){
  const card=t.cards.find(v=>v.id===id);if(!card||card.choice||!['accept','reject'].includes(choice))return;
  card.choice=choice;
  if(card.type==='delay'&&choice==='accept')t.delayAccepted=true;
  addLog(t,card.type==='objection'?'이의':'미루기',`${cardText(card,t).title}: ${choice==='accept'?'받아들임':'받아들이지 않음'}`);
  say=card.type==='delay'?(choice==='accept'?'⏳ 미뤄주기로 했어요 · 다음 재판일이 20분 늦게 열려요':'⏳ 미루기를 거절했어요 · 예정대로 진행해요'):(choice==='accept'?'✋ 이의를 받아들였어요':'✋ 이의를 넘겼어요');
 }
 // show what changed, so every action visibly moves the trial
 const g1=T.gauge(t),k1=T.skill(t).score,d=(n,a,b)=>a!==b?`${n} ${b>a?'+':''}${b-a}`:'';
 // 판결 실력 is not shown during the trial: whether each call was right is revealed with the verdict
 const moved=[d('증거로 보여준 정도',g0.P,g1.P),d('남은 의문',g0.D,g1.D)].filter(Boolean).join(' · ');
 if(say)toast(say+(moved?' → '+moved:'')+(t.energy===0&&kind!=='card'?' · 체력을 다 썼어요. 재판일을 마치세요':''));
 save();
 if(kind==='card'&&t.cards.some(v=>!v.choice))return askRequests(true);
 if(kind==='card')ui.modal=null;
 render();
}

/* The other side's requests come up as a pop-up when the trial day opens, one at a time. */
function askRequests(force){
 const x=current();if(!x||x.st.verdict)return false;const t=x.st.trial4;if(!t||waiting(t))return false;
 const card=t.cards.find(v=>!v.choice);if(!card)return false;
 if(!force&&t.askedDay===t.day)return false;t.askedDay=t.day;
 const left=t.cards.filter(v=>!v.choice).length;
 modal(`${NPC[t.opponent]?.name||'상대'} 변호사가 일어섭니다`,`<p class="muted small">${dayP(t.day,'을')} 시작하기 전에 상대 측 신청${left>1?` ${left}건`:''}에 답해 주세요.</p>${cardBlock(card,t)}`,
  `<button class="btn outline full" data-action="dismiss">나중에 답하기</button>`);
 return true;
}
function endDay(){
 const x=current();if(!x||x.st.verdict)return;
 const {c,st}=x,t=ensure(c,st);
 if(waiting(t))return;
 if(t.cards.some(v=>!v.choice)){askRequests(true);return}
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
 ui.t4tab='day';
 save();
 const d=(a,b)=>{const v=b-a;return (v>0?'+':'')+v};
 modal(`재판일 ${t.daysDone} 결과`,
  `<div class="t4-result">${twist?`<p class="t4-twist">⚡ ${esc(twist)}</p>`:''}
  <div class="t4-delta"><span>증거로 보여준 정도</span><b>${after.g.P}</b><em>${d(before.g.P,after.g.P)}</em></div>
  <div class="t4-delta"><span>아직 남은 의문</span><b>${after.g.D}</b><em>${d(before.g.D,after.g.D)}</em></div>
  <div class="t4-delta"><span>여론 (처벌·인정 요구)</span><b>${after.media.O}</b><em>${d(before.media.O,after.media.O)}</em></div>
  <div class="t4-delta"><span>화제성</span><b>${after.media.H}</b><em>${d(before.media.H,after.media.H)}</em></div>
  <p class="muted small">${t.daysDone>=t.minDays?(t.nextAt>now()?`이제 판결할 수 있습니다. 재판일을 더 열고 싶다면 ${clock(t.nextAt)}부터 가능해요.`:'이제 판결할 수 있습니다.'):`판결까지 재판일 ${t.minDays-t.daysDone}번 더 필요합니다. ${dayP(t.day,'은')} <b>${clock(t.nextAt)}</b>(${minsLeft(t)}분 뒤)에 열립니다. 그동안 다른 사건을 진행하세요.`}</p></div>`);
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
 const curE=curOf(c);
 if(curE?.endings){const ek=endingKey(c,dir);t.final.ending=tell(c,t,curE.endings[ek]||'');if(t.final.ending)news(`${shortName(c)}, 그 후`,t.final.ending,'법조일보')}
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
   const crim=isCriminal(c),cur=curOf(c);
   const fact=cur?.truth?.[t.truth]?tell(c,t,cur.truth[t.truth]).replace(/[.。]$/,''):t.truth==='did'?(crim?'당시 피고인의 행위가 실제로 있었던 것으로 확인됐다':'당시 청구의 핵심 사실이 실제로 있었던 것으로 확인됐다')
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
const sizeWord=v=>v<=15?'거의 없음':v<=40?'작음':v<=65?'중간':'큼';
/* The weakness of a piece of evidence, in plain words. Looking once gives a rough size, twice gives the cause and advice. */
function flawInfo(e,seed){
 if(e.revealed===0)return {cls:'unknown',head:'약점: 아직 모름',tip:'🔎 살펴보면 이 증거에 문제가 있는지 드러나요.'};
 if(e.revealed===1){const [lo,hi]=T.rangeOf(e.flaw,seed+e.id),w=sizeWord((lo+hi)/2);return {cls:'rough',head:`약점: ${w==='거의 없음'?'거의 없어 보임':w+' 정도로 보임'}`,tip:'한 번 더 살펴보면 무엇이 문제인지 정확히 알 수 있어요.'}}
 if(e.flawType==='none')return {cls:'ok',head:'약점 없음',tip:'그대로 써도 되는 증거예요.'};
 if(e.flawType==='illegal')return {cls:'bad',head:'불법으로 얻은 증거',tip:'쓰면 안 돼요. 빼는 것이 원칙이에요.'};
 const w=sizeWord(e.flaw);
 return {cls:e.flaw>=60?'bad':'warn',head:`약점: ${T.LABEL.flaw[e.flawType]} (${w})`,tip:e.flaw>=60?'그대로 쓰면 위험해요. 조건을 붙이거나 빼는 것을 생각해 보세요.':'조건을 붙여 쓰면 안전해요.'};
}
function flawText(e,seed){return flawInfo(e,seed).head}
function evidenceCard(e,t,locked){
 const dis=locked||t.energy<=0?'disabled':'';
 const opt=(v,l)=>`<button class="t4-chip ${e.decision===v?'on':''}" data-action="t4" data-kind="decide" data-id="${esc(e.id)}" data-choice="${v}" ${dis||e.decision===v?'disabled':''}>${l}</button>`;
 return `<article class="t4-card"><header><b>${esc(e.title)}</b><span class="t4-tag">증거의 힘 ${e.strength}</span></header>
 ${e.scope?`<p class="t4-shows">${esc(e.scope)}</p>`:''}${e.note?`<p class="muted small">한계: ${esc(e.note)}</p>`:''}
 ${(()=>{const f=flawInfo(e,t.seed);return `<div class="t4-flaw ${f.cls}"><b>${esc(f.head)}</b><span>${esc(f.tip)}</span></div>`})()}
 ${e.revealed<2?`<div class="t4-row"><button class="t4-chip ghost" data-action="t4" data-kind="inspect" data-id="${esc(e.id)}" ${dis}>🔎 약점 살펴보기 <small>체력 1</small></button></div>`:''}
 <div class="t4-row t4-choose"><span>이 증거를${e.decision?' ✔':''}</span>${opt('use','쓴다')}${opt('conditional','조건 붙여 쓴다')}${opt('exclude','뺀다')}</div></article>`;
}
function witnessCard(w,t,locked){
 const p=NPC[w.id],dis=locked||t.energy<=0||w.asked>=3?'disabled':'';
 const att=w.revealed>=2?'태도: '+T.LABEL.attitude[w.attitude]:w.revealed===1?'태도: 한 번 더 물으면 드러나요':'태도: 질문하면 드러나요';
 const rw=v=>v>=70?'높음':v>=45?'보통':'낮음';
 const rel=w.revealed>=2?`믿을 만한 정도: ${rw(w.reliability)} (${w.reliability})`:w.revealed===1?`믿을 만한 정도: ${rw(T.rangeOf(w.reliability,t.seed+w.id).reduce((a,b)=>a+b)/2)}쯤으로 보임`:'믿을 만한 정도: 아직 모름';
 return `<article class="t4-card"><header><button class="t4-name" data-action="npc" data-id="${esc(w.id)}">👤 ${esc(p?.name||'증인')}</button><span class="t4-tag">${esc(w.role)}</span></header>
 ${w.story?`<p class="t4-story">${esc(w.story)}</p>`:''}<p class="small">${esc(att)} · ${esc(rel)}</p>${w.asked?`<p class="t4-quote">${esc(witnessLine(w,t))}</p>`:''}
 <div class="t4-row"><button class="t4-chip ghost" data-action="t4" data-kind="ask" data-id="${esc(w.id)}" ${dis}>🗣 ${w.asked?'더 묻기':'질문하기'} <small>체력 1</small></button><small class="muted">${w.asked}/3번</small></div></article>`;
}
function cardBlock(card,t){
 const x=cardText(card,t);
 if(card.type==='media')return `<div class="t4-event media"><b>📣 ${esc(x.title)}</b><p>${esc(x.body)}</p></div>`;
 const done=card.choice;
 const labels=card.type==='objection'?['이의 받아들이기','넘어가기']:['미뤄주기','거절하기'];
 const what=card.type==='objection'?'받아들이면 그 질문을 거둬요. 넘어가면 질문이 그대로 남아요.':'미뤄주면 다음 재판일이 20분 더 늦게 열려요. 거절하면 예정대로 열려요.';
 return `<div class="t4-event ${done?'done':''}"><b>${card.type==='objection'?'✋':'⏳'} ${esc(x.title)}</b><p>${esc(x.body)}</p>${done?'':`<p class="t4-what">${what} 말에 근거가 있는지 보고 정하세요.</p>`}
 ${done?`<p class="small">→ ${done==='accept'?labels[0]:labels[1]}</p>`:`<div class="t4-row"><button class="btn mini primary" data-action="t4" data-kind="card" data-id="${esc(card.id)}" data-choice="accept">${labels[0]}</button><button class="btn mini outline" data-action="t4" data-kind="card" data-id="${esc(card.id)}" data-choice="reject">${labels[1]}</button></div>`}</div>`;
}
const HELP=`<details class="t4-help" open><summary>처음이라면 이것만 기억하세요</summary><ol><li><b>증거</b> 탭에서 '약점 살펴보기'를 누르세요. 한 번 보면 대략, 두 번 보면 무엇이 문제인지 드러나요.</li><li>증거를 <b>쓸지, 조건 붙여 쓸지, 뺄지</b> 정하세요. 불법으로 얻은 증거를 쓰면 판결 실력이 크게 깎여요.</li><li><b>증인</b> 탭에서 질문하면 태도가 드러나요. 두 번 물으면 말을 바꾸는 증인도 있어요.</li><li>재판일이 열리면 상대 변호사가 신청을 할 때가 있어요. 말에 <b>근거가 있는지</b> 보고 답하세요.</li><li>체력을 다 쓰면 아래 <b>재판일 마치기</b>를 누르고, 정해진 횟수가 차면 <b>판결</b> 탭에서 선고하세요.</li></ol></details>`;
function tabsFor(c,st){
 const t=st.trial4;
 if(st.verdict)return [['result','선고 이후'],['case','사건'],['log','기록']];
 const pending=waiting(t)?0:t.cards.filter(v=>!v.choice).length,undecided=t.evidence.filter(e=>!e.decision).length,ready=t.daysDone>=t.minDays;
 return [['case','사건'],['day','재판일',pending],['evidence','증거',undecided],['witness','증인'],['verdict','판결',ready?'!':0],['log','기록']];
}
function pager(kind,items,render,label){
 if(!items.length)return `<p class="muted">${label}이(가) 없습니다.</p>`;
 const key=kind==='evidence'?'t4ev':'t4w';let i=Math.max(0,Math.min(items.length-1,ui[key]||0));ui[key]=i;
 const dots=items.map((_,k)=>`<button class="t4-dot ${k===i?'on':''}" data-action="t4page" data-kind="${kind}" data-i="${k}" aria-label="${k+1}번째"></button>`).join('');
 return `<div class="t4-pager" data-kind="${kind}" data-n="${items.length}">${render(items[i])}
 <div class="t4-pagenav"><button class="t4-chip" data-action="t4page" data-kind="${kind}" data-i="${i-1}" ${i<=0?'disabled':''}>‹ 이전</button><div class="t4-dots">${dots}<span>${i+1} / ${items.length}</span></div><button class="t4-chip" data-action="t4page" data-kind="${kind}" data-i="${i+1}" ${i>=items.length-1?'disabled':''}>다음 ›</button></div></div>`;
}
/* Today's checklist: what to do on this trial day, in order. */
function todo(c,t){
 const pending=t.cards.filter(v=>!v.choice).length,answered=t.cards.filter(v=>v.choice&&v.type!=='media').length;
 const looked=t.evidence.filter(e=>e.revealed>0).length,decided=t.evidence.filter(e=>e.decision).length,asked=t.witnesses.filter(w=>w.asked).length;
 const steps=[];
 if(pending||answered)steps.push({done:!pending,text:pending?`상대 측 신청 ${pending}건에 답하기`:'상대 측 신청에 답했어요',go:pending?'requests':'day'});
 steps.push({done:decided===t.evidence.length,text:`증거 살펴보고 쓸지 정하기 · 정함 ${decided}/${t.evidence.length}${looked<t.evidence.length?` · 살펴봄 ${looked}`:''}`,go:'evidence'});
 steps.push({done:asked===t.witnesses.length,text:`증인에게 질문하기 · ${asked}/${t.witnesses.length}명`,go:'witness'});
 steps.push({done:false,text:t.daysDone+1>=t.minDays?'재판일 마치기 → 그다음 판결할 수 있어요':`재판일 마치기 → 다음 재판일은 10분 뒤`,go:'end'});
 return `<ol class="t4-todo">${steps.map(x=>`<li class="${x.done?'done':''}"><button data-action="t4go" data-go="${x.go}">${x.done?'✔':'•'} ${esc(x.text)}</button></li>`).join('')}</ol>`;
}
function dayPage(c,st){
 const t=st.trial4,g=T.gauge(t),wait=waiting(t),sk=T.skill(t).score,opp=NPC[t.opponent],rec=opp?.vsJudge;
 const gauges=`${bar('증거로 보여준 정도',g.P,'p')}${bar('아직 남은 의문',g.D,'d')}
 <div class="t4-stats"><span>화제성 <b>${t.media.H}</b></span><span>여론 <b>${t.media.O>0?'+':''}${t.media.O}</b></span></div>`;
 const recent=t.log.length?`<div class="t4-log"><h4>방금 일어난 일</h4>${t.log.slice(0,3).map(l=>`<p><small>재판일 ${l.day} · ${esc(l.kind)}</small> ${esc(l.text)}</p>`).join('')}</div>`:'';
 if(wait){
  const can=t.daysDone>=t.minDays;
  return `<section class="panel t4"><div class="t4-head"><h3>재판일 ${t.daysDone} 끝</h3><span class="t4-tag">${t.daysDone}/${t.minDays}</span></div>
  <div class="t4-wait big"><b>${can?'⚖ 지금 판결할 수 있어요':`⏳ ${dayP(t.day,'은')} ${clock(t.nextAt)}에 열려요`}</b><span>${can?`재판일을 더 열고 싶다면 ${clock(t.nextAt)}(${minsLeft(t)}분 뒤)부터 가능해요.`:`${minsLeft(t)}분 남았어요. 그동안 다른 사건을 진행하세요. 열리면 알려 드려요.`}</span>
  <div class="t4-row">${can?'<button class="btn primary mini" data-action="t4tab" data-tab="verdict">판결하러 가기</button>':''}<button class="btn outline mini" data-action="tab" data-tab="courtList">다른 사건 보기</button></div></div>
  ${gauges}${recent}</section>`;
 }
 const act=(()=>{const cur=curOf(c);if(!cur?.acts?.length)return '';const i=Math.min(cur.acts.length-1,Math.floor(t.daysDone*cur.acts.length/Math.max(1,t.minDays)));const a=cur.acts[i];return `<div class="t4-act"><small>오늘의 법정 · ${esc(a.title)}</small><p>${esc(tell(c,t,a.text))}</p></div>`})();
 return `<section class="panel t4"><div class="t4-head"><h3>재판일 ${t.day} <small>/ 최소 ${t.minDays}</small></h3><span class="t4-energy">${'●'.repeat(t.energy)}${'○'.repeat(ENERGY-t.energy)} 체력</span></div>
 ${act}
 <h4>오늘 할 일</h4>${todo(c,t)}
 <p class="muted small">살펴보기·질문·증거 결정에 체력이 1씩 들어요. 체력은 재판일마다 다시 ${ENERGY}칸이 돼요.</p>
 ${gauges}
 <p class="t4-opp">상대: ${esc(opp?.name||'변호인')} · ${esc(T.LABEL.style[t.style])}${rec&&(rec.win+rec.lose)?` · 내 법정 전적 ${rec.win}승 ${rec.lose}패`:''}</p>
 ${t.cards.some(v=>v.type==='media')?t.cards.filter(v=>v.type==='media').map(x=>cardBlock(x,t)).join(''):''}
 ${t.cards.some(v=>v.choice&&v.type!=='media')?`<details class="t4-more"><summary>오늘 답한 신청</summary>${t.cards.filter(v=>v.choice&&v.type!=='media').map(x=>cardBlock(x,t)).join('')}</details>`:''}
 ${recent}
 ${!completed().length&&t.daysDone===0?HELP:''}</section>`;
}
function verdictPage(c,st){
 const t=st.trial4,canVerdict=t.daysDone>=t.minDays,g=T.gauge(t);
 return `<section class="panel t4 t4-verdict"><h3>⚖ 판결</h3>${canVerdict?'':`<p class="notice">재판일이 ${t.minDays-t.daysDone}번 더 필요해요.${waiting(t)?` ${dayP(t.day,'은')} ${clock(t.nextAt)}에 열려요.`:''}</p>`}
 ${bar('증거로 보여준 정도',g.P,'p')}${bar('아직 남은 의문',g.D,'d')}
 <p class="muted small">판결 실력은 증거와 의문으로만 매겨집니다. 여론과 숨겨진 진실은 점수에 들어가지 않아요.</p>
 ${c.verdicts.map(v=>`<button class="choice" data-action="t4verdict" data-id="${esc(v.id)}" ${canVerdict?'':'disabled'}><span class="choice-index">⚖</span><span><strong>${esc(plainLabel(v))}</strong><small>${esc(plainNote(v))}</small></span><span class="chevron">›</span></button>`).join('')}</section>`;
}
function dock(c,st){
 const t=st.trial4;if(st.verdict)return '';
 const wait=waiting(t),pending=t.cards.filter(v=>!v.choice).length,moreDays=t.daysDone<t.minDays+EXTRA_DAYS;
 if(wait&&t.daysDone>=t.minDays)return `<div class="t4-dock"><span class="small">재판일 더 열기: ${clock(t.nextAt)}부터</span><button class="btn primary" data-action="t4tab" data-tab="verdict">판결하러 가기</button></div>`;
 if(wait)return `<div class="t4-dock"><span>⏳ 재판일 ${t.day} · ${clock(t.nextAt)} (${minsLeft(t)}분 뒤)</span><button class="btn outline mini" data-action="tab" data-tab="courtList">다른 사건</button></div>`;
 const main=pending?`<button class="btn primary" data-action="t4go" data-go="requests">상대 신청 ${pending}건 답하기</button>`
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
 ${f.ending?`<div class="t4-act"><small>그 후</small><p>${esc(f.ending)}</p></div>`:''}
 <h4>💬 시민광장${dk?` · <span class="t4-mode ${dk.community.mode}">${esc(dk.community.label)}</span>`:''}</h4>${comments}
 ${dk?.narratives?.length?`<h4>언론이 주목하는 흐름</h4>${dk.narratives.map(n=>`<p class="t4-narr l${n.level}">${esc(n.text)}</p>`).join('')}`:''}
 <details class="t4-log" open><summary>내 판단 채점 · 재판 중 결정이 맞았는지</summary>${f.items.map(i=>`<p>${i.points>0?'+':''}${i.points} · ${esc(i.text)}</p>`).join('')||'<p>가감 항목 없음</p>'}</details></section>`;
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
 if(status&&t)status.innerHTML=st.verdict?`<span>선고 완료</span><span>재판일 ${t.daysDone}회</span>`:`<span>${esc(stage(c,st).short)}</span><span>재판일 ${t.daysDone}/${t.minDays}</span><span>중요도 ${c.importance}</span>`;
 const crim=isCriminal(c),who=c.who||[];
 const facts=[[crim?'피고인':'원고',NPC[who[crim?0:0]]?.name],[crim?'피해자':'피고',NPC[who[1]]?.name],['분류',c.tag],['상대 변호사',t?NPC[t.opponent]?.name:null],['최소 재판일',t?t.minDays+'번':null],['증거·증인',t?`증거 ${t.evidence.length}건 · 증인 ${t.witnesses.length}명`:null]].filter(v=>v[1]);
 const cur=curOf(c),crimRole=isCriminal(c);
 const people=cur?`<h4>사람들</h4><div class="t4-people">
  <div class="t4-person"><b>${esc(NPC[who[0]]?.name||'')}</b><span class="t4-tag">${crimRole?'피고인':'원고'}</span><p>${esc(tell(c,t,cur.people.A))}</p></div>
  <div class="t4-person"><b>${esc(NPC[who[1]]?.name||'')}</b><span class="t4-tag">${crimRole?'피해자':'피고'}</span><p>${esc(tell(c,t,cur.people.B))}</p></div>
  ${(t?.witnesses||[]).map(w=>`<div class="t4-person"><b>${esc(NPC[w.id]?.name||'')}</b><span class="t4-tag">증인 · ${esc(w.role)}</span>${w.story?`<p>${esc(w.story)}</p>`:''}</div>`).join('')}</div>`:'';
 const claims=cur?`<h4>양측의 주장</h4><div class="t4-claims"><p><b>${crimRole?'검찰':'원고'}</b> ${esc(tell(c,t,cur.claims[0]))}</p><p><b>${crimRole?'변호인':'피고'}</b> ${esc(tell(c,t,cur.claims[1]))}</p></div>`:'';
 const casePage=`<section class="panel t4 t4-case"><h3>무슨 사건인가?</h3>${cur?`<p class="t4-logline">${esc(tell(c,t,cur.logline))}</p><p>${esc(tell(c,t,cur.summary))}</p>`:(overviewHtml||`<p>${esc(c.sub||'')}</p>`)}
  <dl class="t4-facts">${facts.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
  ${cur?claims+people:(argsHtml?`<details class="t4-more"><summary>검사·변호인 주장 자세히 보기</summary><div>${argsHtml}</div></details>`:'')}
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
render=function(){priorRender();document.body.classList.toggle('t4-court',ui.tab==='court');if(ui.tab==='court'&&ui.t4tab&&ui.t4tab!=='case'&&!ui.modal)setTimeout(()=>{if(!ui.modal&&ui.tab==='court')askRequests(false)},0)};

/* Case list: plain words and the v4 trial-day counter. */
if(typeof courtList==='function'){
 const priorList=courtList;
 courtList=function(){
  let html=priorList();
  html=html.replace('접수된 사건을 확인하고 이번 주 심리할 사건을 선택하세요.','맡은 사건을 골라 재판을 이어가세요.')
   .replace(/<div class="stat-card"><label>금주 심리 여력<\/label><strong>[^<]*<\/strong><\/div>/,`<div class="stat-card"><label>판결 리뷰 평균</label><strong>${(()=>{const r=desk().reviews;return r.length?Math.round(r.reduce((a,x)=>a+x.review,0)/r.length)+'점':'-'})()}</strong></div>`)
   .replace(/시간을 진행해 보세요\./,'새 사건은 매일 10시~22시에 들어옵니다.')
   .replace(/가상 시간이 진행되면/,'시간이 흐르면');
  return html.replace(/data-id="([^"]+)"([\s\S]*?)심리 \d\/3/g,(m,id,mid)=>{const c=CASES.find(x=>x.id===id),st=S.cases[id],t=st?.trial4,g=c&&stage(c,st);return `data-id="${id}"${mid}<span class="t4-st ${g?.k||''}">${esc(g?.text||'재판 전')}</span>${t?` · 재판일 ${t.daysDone}/${t.minDays}`:''}`});
 };
}

/* ---------- clicks ---------- */
const priorClick=clicker;
clicker=function(e){
 const el=e.target.closest('[data-action]');
 const a=el?.dataset.action;
 if(a==='t4'){e.preventDefault();act(el.dataset.kind,el.dataset.id,el.dataset.choice);return}
 if(a==='t4end'){e.preventDefault();endDay();return}
 if(a==='t4go'){e.preventDefault();const go=el.dataset.go;if(go==='requests'){askRequests(true);return}if(go==='end'){endDay();return}ui.t4tab=go;render();window.scrollTo({top:0,behavior:'instant'});return}
 if(a==='t4tab'){e.preventDefault();ui.t4tab=el.dataset.tab;render();window.scrollTo({top:0,behavior:'instant'});return}
 if(a==='t4page'){e.preventDefault();const key=el.dataset.kind==='evidence'?'t4ev':'t4w';ui[key]=Number(el.dataset.i)||0;render();return}
 if(a==='t4verdict'){e.preventDefault();askVerdict(el.dataset.id);return}
 if(a==='t4confirm'){e.preventDefault();confirmVerdict();return}
 if(a==='verdict'||a==='courtStep'||a==='livePostpone'){e.preventDefault();return}
 return priorClick(e);
};

/* ---------- heartbeat ---------- */
function opened(){
 let any=null;
 for(const c of CASES){const st=S.cases[c.id],t=st?.trial4;if(!t||st.verdict||!t.nextAt||waiting(t)||t.openedSeen===t.day)continue;
  t.openedSeen=t.day;if(t.daysDone<t.minDays+EXTRA_DAYS)any=any||c}
 if(any)toast(`🔔 ${shortName(any)} · 재판일이 열렸어요`);
 return !!any;
}
setInterval(()=>{
 const changed=tick()|opened();
 if(ui.modal)return;
 const x=ui.tab==='court'&&current(),t=x&&x.st.trial4;
 const listWait=(ui.tab==='home'||ui.tab==='courtList')&&CASES.some(c=>{const q=S.cases[c.id]?.trial4;return q&&!S.cases[c.id].verdict&&waiting(q)});
 if(changed||listWait||(t&&(waiting(t)||(t.final&&!t.final.reviewShown))))render();
 if(x&&!ui.modal)askRequests(false);
},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&tick()&&!ui.modal)render()});
setTimeout(()=>{if(tick()&&!ui.modal)render()},1500);

window.VerdictTrialPlay={ensure,tick,stage,REPORTERS};
})();
