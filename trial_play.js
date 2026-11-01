/* THE VERDICT — playable trial loop (v4).
 * Owns the courtroom "재판" screen: trial days, evidence decisions, witnesses, opponent cards,
 * verdict with sentence and written judgment, press/SNS reactions, delayed reviews and truth reveals.
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
const QPD=4,EXTRA_DAYS=2;          // questions per trial day; extra sessions allowed after the minimum

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
 const sx=id=>NPC[id]?.gender?(/여/.test(NPC[id].gender)?'여':'남'):null;
 n._sex={A:sx(c.who?.[0]),B:sx(c.who?.[1]),L:t?sx(t.opponent):null};(t?.witnesses||[]).forEach((w,i)=>{n._sex['W'+(i+1)]=sx(w.id)});
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
/* Written detail for one piece of evidence: e0..e2 from the case, e3 = evidence added between trial days. */
function evDetail(c,e){const cur=curOf(c);if(!cur)return null;const i=Number(String(e.id).slice(1));return e.late?cur.late:cur.evidence?.[i]||null}
function wDetail(c,i){return curOf(c)?.witnesses?.[i]||null}
const claimOf=c=>curOf(c)?.claim||null,chargeOf=c=>curOf(c)?.charge||null,issuesOf=c=>curOf(c)?.issues||[];
const prosName=c=>NPC[c.side?.[0]]?.name||'검사';
const sideWord=(c,which)=>isCriminal(c)?(which==='p'?'검사':'변호인'):(which==='p'?'원고 대리인':'피고 대리인');

/* ---------- gender facts the story depends on (curated sex spec) ---------- */
const isF=p=>/여/.test(p?.gender||'');
function swapName(c,p,old){if(!old||old===p.name)return;
 const walk=o=>{if(!o||typeof o!=='object')return;for(const k of Object.keys(o)){const v=o[k];if(typeof v==='string'&&v.includes(old))o[k]=v.split(old).join(p.name);else if(v&&typeof v==='object')walk(v)}};
 walk(c)}
function setSex(c,id,g){const p=NPC[id];if(!p||!g||(g==='여')===isF(p))return;
 const old=p.name;p.gender=g==='여'?'여성':'남성';p.name=VerdictNames.make({gender:p.gender,bornYear:p.bornYear,rand,people:NPC});swapName(c,p,old)}
const other=p=>isF(p)?'남':'여',same=p=>isF(p)?'여':'남';
function fixSex(c){const s=curOf(c)?.sex;if(!s||c.sexFixed||!c.who)return;c.sexFixed=true;
 const [a,b]=c.who;setSex(c,a,s.A);setSex(c,b,s.B);
 if(s.AB==='same')setSex(c,b,same(NPC[a]));else if(s.AB==='diff')setSex(c,b,other(NPC[a]))}
function witnessSex(c,i,id){const r=curOf(c)?.sex?.W?.[i];if(!r)return;const ref=NPC[c.who?.[r.endsWith('A')?0:1]];if(!ref)return;
 setSex(c,id,r.startsWith('same')?same(ref):other(ref))}

/* ---------- who people are: ages, jobs, degrees and marriage that match the story ---------- */
const ageOf=p=>p?.bornYear?year()-p.bornYear:null;
function setAge(c,id,lo,hi){const p=NPC[id];if(!p)return;lo=Math.max(18,Math.round(lo));hi=Math.max(lo,Math.round(hi));const now=ageOf(p);
 if(now!=null&&now>=lo&&now<=hi)return;const age=lo+Math.floor(rand()*(hi-lo+1)),old=p.bornYear;p.bornYear=year()-age;p.ageAtStart=age;
 if(Math.abs((old||p.bornYear)-p.bornYear)>=8){const was=p.name;p.name=VerdictNames.make({gender:p.gender,bornYear:p.bornYear,rand,people:NPC});swapName(c,p,was)}}
const BLUE=/기사|정비공|사장|택배|간호조무사|대리운전|임대업|건물주|무직/;
function sanityDegree(p,job){const a=ageOf(p)||40;
 if(/석사|박사/.test(p.degree||'')&&(BLUE.test(job||'')||a<26))p.degree=a<23?'대학 재학':'학사'}
function setJob(p,job){if(!job)return;p.career=job;if(p.jobHistory?.length)p.jobHistory[p.jobHistory.length-1].job=job}
function fixProfile(c){const pr=curOf(c)?.profile;if(!pr||c.profileFixed||!c.who)return;c.profileFixed=true;
 ['A','B'].forEach((k,n)=>{const x=pr[k],id=c.who[n],p=NPC[id];if(!x||!p)return;
  const a0=ageOf(NPC[c.who[0]]);
  if(x.same==='A'&&a0!=null)setAge(c,id,a0,a0);else if(x.younger==='A'&&a0!=null)setAge(c,id,Math.max(x.age[0],a0-10),a0-1);else setAge(c,id,x.age[0],x.age[1]);
  setJob(p,x.job);if(x.deg)p.degree=x.deg;if(x.mar)p.maritalStatus=x.mar;if(x.kids!=null)p.children=x.kids;sanityDegree(p,x.job)})}
/* Witness ages: relatives and friends follow the parties, careers follow "N년째", titles set a floor. */
function witnessProfile(c,i,id){const cur=curOf(c),w=cur?.witnesses?.[i],p=NPC[id];if(!w||!p||c.who==null)return;
 const role=String(w.role||''),story=String(w.story||'')+' '+String(w.stake||''),txt=role+' '+story;
 const A=ageOf(NPC[c.who[0]]),B=ageOf(NPC[c.who[1]]),crim=isCriminal(c);
 const refOf=()=>/\{B/.test(story)&&!/\{A/.test(story)?B:/\{A/.test(story)&&!/\{B/.test(story)?A:/피해자|원고/.test(role)&&!/피고/.test(role)?(crim?B:A):/피고인|피고/.test(role)?(crim?A:B):(/피해자/.test(story)?(crim?B:A):A);
 let r=null;
 if(/배우자/.test(role)){const x=refOf();r=[x-4,x+4];p.maritalStatus='기혼'}
 else if(/손위 형제/.test(role))r=[A+2,A+9];
 else if(/동생/.test(role)){const x=refOf();r=[x-9,x-1]}
 else if(/^둘째$/.test(role))r=[Math.min(A,B)+1,Math.max(A,B)-1];
 else if(/자녀/.test(role)){const x=refOf();r=[x-36,x-24]}
 else if(/할머니|할아버지/.test(role)){const x=crim?A:B;r=[Math.max(58,x+22),x+34]}
 else if(/동기|동갑|동창|친구|학번/.test(txt)){const x=refOf();r=[x-1,x+1]}
 else if(/후배|옆방 학생/.test(txt)){const x=refOf();r=[x-3,x-1]}
 else if(/상사|사수/.test(role+' '+story)&&/피고인|피해자|원고|피고|\{[AB]/.test(role+story)){const x=refOf();r=[x+3,x+15]}
 else if(/주선자|공통 지인/.test(txt)){r=[Math.min(A,B)-2,Math.max(A,B)+2]}
 if(!r){const m=story.match(/(\d+)\s*년\s*(?:째|차|경력|가까이|동안|을|간)/)||story.match(/경력\s*(\d+)\s*년/);
  if(m){const n=Number(m[1]);r=[Math.min(66,n+22),Math.min(72,n+40)]}}
 if(!r){if(/은퇴|노부부/.test(txt))r=[63,82];else if(/교수/.test(role))r=[42,64];else if(/대학원|연구실 동료/.test(txt))r=[25,33];else if(/조교/.test(role))r=[24,32];
  else if(/대학생|학생|부원/.test(txt))r=[19,26];else if(/주치의|원장|대표|사장|회장|팀장|과장|부장|책임자|관리자|감독관|감식관|매니저/.test(role))r=[36,62]}
 if(!r){const a=ageOf(p);if(a<21)r=[22,55];else if(a>66&&!/은퇴|노/.test(txt))r=[30,62]}
 if(r&&r.every(Number.isFinite))setAge(c,id,r[0],r[1]);
 if(!/의 |배우자|동생|자녀|둘째|할머니|할아버지|친구/.test(role))setJob(p,role);
 sanityDegree(p,role)}
window.VerdictSex={fix:c=>{fixSex(c);fixProfile(c);decisionVerdicts(c)}};

/* ---------- v6: people shape the trial ----------
 * A witness's attitude, reliability and memory come from who they are (honesty, stress control, impulsivity,
 * conscientiousness, empathy, age) and what this case puts at stake for them (a friend or relative on trial,
 * a job, fear of reprisal). The case seed only adds a little noise, so the same person stays recognisable
 * across cases and the same seed always gives the same result. The hidden truth is never changed. */
function stakeText(c,i){const w=wDetail(c,i);return [w?.stake,w?.story,w?.role].join(' ')}
function behaviour(c,i,w,seed){
 const p=NPC[w.id];if(!p)return;const tr=p.traits||{},v=k=>Number(tr[k]??50),n=k=>T.between(0,22,seed+':bh:'+i+':'+k);
 const st=stakeText(c,i),age=ageOf(p)||40;
 const close=/친구|지기|가족|동생|형제|자녀|배우자|어머니|아버지|딸|아들|부모|동료|동기|후배|선배|사수|부하|직원|제자|감싸|아끼|연인/.test(st);
 const scared=/두려|무서|보복|해고|직장|계약|불이익|인사|생계|징계|책임을 질|소송을 당|처벌받|잃을/.test(st);
 const score={
  honest:v('honesty')*0.75+v('conscientiousness')*0.25+n('h'),
  protect:close?(100-v('honesty'))*0.55+v('empathy')*0.45+n('p'):n('p')*0.6,
  fear:scared?(100-v('stressControl'))*0.8+12+n('f'):(100-v('stressControl'))*0.35+n('f'),
  flip:v('impulsivity')*0.55+(100-v('honesty'))*0.3-v('conscientiousness')*0.15+n('x')};
 w.attitude=Object.entries(score).sort((a,b)=>b[1]-a[1])[0][0];
 w.reliability=Math.round(T.clamp(34+v('honesty')*0.34+v('conscientiousness')*0.2+n('r')*0.6,35,92));
 w.memory=Math.round(T.clamp(92-Math.max(0,age-45)*0.7+v('conscientiousness')*0.08-n('m'),30,92));
 w.because=close?'close':scared?'scared':'none';
}
/* The other side's lawyer: how often their objections are sound depends on skill, not just style. */
function lawyerSkill(id){const lc=NPC[id]?.legalCareer;return lc?Math.round((lc.trialSkill+lc.evidenceSkill)/2):55}
function skilled(c,t,cards,day){
 const sk=lawyerSkill(t.opponent);
 for(const cd of cards){if(cd.skillSet||cd.type!=='objection')continue;cd.skillSet=true;
  cd.valid=T.unit(t.seed+':ov:'+day+':'+cd.id)<T.clamp(0.18+sk/150+(t.style==='meticulous'?0.08:0),0.15,0.85)}
 return cards;
}
const prepWord=id=>{const s=lawyerSkill(id);return s>=78?'준비가 철저함':s>=60?'준비가 꼼꼼한 편':s>=45?'준비가 보통':'준비가 허술한 편'};

function ensure(c,st){
 if(st.trial4)return upgrade(c,st.trial4);
 fixSex(c);fixProfile(c);decisionVerdicts(c);
 const seed=c.id+':'+(S.rng||1);
 const strictCase=!!curOf(c);
 const witnesses=witnessSeeds(c).map((w,i)=>{
  let id=w.existing;
  const ex=!id&&strictCase?window.VerdictV6?.expertFor?.(w.role,c):null;
  if(ex){id=ex.id;remember(id,'관련 사건',c.name+'의 증인으로 다시 출석 ('+w.role+')',c.id)}
  if(!id){id=freshNPC(w.role,S.caseSerial||1,c.story?.deep?.key||c.contentPack?.category||'contract');NPC[id].role=w.role;NPC[id].caseWitnessRole=w.role;
   if(w.story){NPC[id].backstory=w.story;NPC[id].bond=w.interest||NPC[id].bond}
   const g0=NPC[id].gender;
   if(/할머니|어머니|딸|누나|언니|아내/.test(w.role))NPC[id].gender='여';else if(/할아버지|아버지|아들|형|오빠|남편/.test(w.role)&&!/형제/.test(w.role))NPC[id].gender='남';
   if(NPC[id].gender!==g0)NPC[id].name=VerdictNames.make({gender:NPC[id].gender,bornYear:NPC[id].bornYear,rand,people:NPC});
   witnessSex(c,i,id);witnessProfile(c,i,id);window.VerdictV6?.registerExpert?.(id,w.role,c);
   remember(id,'관련 사건',c.name+'의 증인으로 출석',c.id)}
  return {id,role:w.role,knowledge:w.knowledge,interest:w.interest,story:w.story||''};
 });
 const history=S.trial4History||[],strict=!!curOf(c);
 const rolled=T.roll({id:c.id,archetypeId:c.contentPack?.archetypeId||c.id,truth:T.truthFromStory(c.story?.privateTruth?.kind),evidence:evidenceSeeds(c),witnesses,strict},seed,history);
 rolled.witnesses.forEach((w,i)=>{w.story=witnesses[i]?.story||'';if(strict)behaviour(c,i,w,seed)});
 const opponent=opponentOf(c),style=styleOf(opponent);
 const heat=/살인|치사/.test(c.tag)?20:/연예|celebrity/.test(c.tag+(c.contentPack?.category||''))?25:/성/.test(c.tag)?10:0;
 const t={...rolled,v:5,seed,opponent,style,day:1,daysDone:0,minDays:isDecision(c)?1:Math.max(1,T.minDays(c.importance)-(isCriminal(c)?0:1)),qLeft:isCriminal(c)?QPD:6,qpd:isCriminal(c)?QPD:6,cards:[],nextAt:0,heard:[],notices:[],dates:{},nextDate:today()+7,
  delayAccepted:false,twistUsed:false,log:[],media:T.pressStart(c.importance,{criminal:isCriminal(c),heatBonus:heat}),startedAt:now()};
 t.witnesses.forEach(w=>{w.askedIds=[];w.opened=[]});
 t.cards=dressCards(c,t,skilled(c,t,T.cards(t,1,seed),1));
 st.trial4=t;
 S.trial4History=[...history,{archetypeId:rolled.archetypeId,truth:rolled.truth,firstFlaw:rolled.firstFlaw}].slice(-60);
 save();
 return t;
}
/* A trial started under the older rules keeps going under the new ones. */
function upgrade(c,t){
 if(t.v>=5){t.dates??={};t.nextDate??=today();return t}
 t.v=5;t.heard??=[];t.notices??=[];t.qLeft=QPD;t.qpd=QPD;delete t.energy;t.dates??={};t.nextDate??=today();
 if(curOf(c))t.evidence.forEach(e=>{e.revealed=2});
 t.witnesses.forEach(w=>{w.askedIds??=[];w.opened??=[]});
 t.cards=dressCards(c,t,t.cards||[]);
 return t;
}
/* Questions this witness can be asked now: open ones plus those unlocked by an earlier answer. */
function questionsOf(c,t,i){
 const d=wDetail(c,i),w=t.witnesses[i];if(!d?.q)return [];
 return d.q.filter(q=>!q.hidden||(w.opened||[]).includes(q.id));
}
/* The answer depends on what really happened; a witness who changes their story swaps it. */
function answerOf(c,t,i,q){
 if(typeof q.a!=='object')return {text:tell(c,t,q.a),side:q.side||'n'};
 let key=t.truth in q.a?t.truth:'reason';
 const w=t.witnesses[i];
 if(w?.flipped&&key!=='reason')key=key==='did'?'didnt':'did';
 return {text:tell(c,t,q.a[key]),side:key==='did'?'p':key==='didnt'?'d':'m'};
}
/* Trial dates on the game calendar. A session is dated when it opens; the next one is set two weeks later
 * (more when a delay is granted). Opening a session moves the world calendar forward to that date. */
const cal=()=>window.VerdictCalendar;
const today=()=>cal()?cal().today():0;
const dlabel=d=>cal()&&d!=null?cal().label(d):'';
/* One shared court calendar for every case. Opening a session moves the world forward by two weeks shared out
 * among the trials in progress (5 trials → about 3 days each), and the session takes today's date. So every case
 * reads the same calendar, and a case played alone still sees about two weeks between sessions. */
function openSession(c,st){
 const t=st?.trial4;if(!t||st.verdict||waiting(t)||t.dates?.[t.day]!=null)return false;
 t.dates??={};
 const running=Math.max(1,openCases().filter(x=>S.cases[x.id]?.trial4).length);
 const step=Math.max(2,Math.min(14,Math.round(14/running)));
 if(cal())cal().advanceTo(today()+(t.day===1&&!t.daysDone?Math.min(step,7):step));
 t.dates[t.day]=Math.floor(today());t.nextDate=t.dates[t.day];return true;
}
const sessionOpen=t=>t?.dates?.[t.day]!=null;
const dateOf=t=>t.dates?.[t.day]??Math.max(t.nextDate||0,today());
/* Decision cases (curated `decision`): one hearing, then a yes/no decision with no money. */
const isDecision=c=>!!curOf(c)?.decision;
function decisionVerdicts(c){const d=curOf(c)?.decision;if(!d)return;c.verdicts=[{id:'full',label:tell(c,null,d.yes),note:tell(c,null,d.yesNote)},{id:'dismiss',label:tell(c,null,d.no),note:tell(c,null,d.noNote)}]}
const session=(c,n)=>isCriminal(c)?`제${n}회 공판`:isDecision(c)?`제${n}회 심리기일`:`제${n}회 변론기일`;
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
 const pending=t.cards.filter(v=>!v.choice&&v.type!=='media').length;
 if(t.daysDone>=t.minDays&&!(pending&&!waiting(t)))return {k:'verdict',text:'⚖ 판결할 수 있어요',short:'판결 가능'};
 if(waiting(t))return {k:'wait',text:`⏳ ${session(c,t.day)} · ${dlabel(Math.max(t.nextDate||0,today()))} (${minsLeft(t)}분 뒤)`,short:`${minsLeft(t)}분 뒤 ${session(c,t.day)}`};
 if(pending)return {k:'req',text:`✋ 상대 측 신청 ${pending}건 · 답할 차례`,short:'상대 신청 답하기'};
 if(!sessionOpen(t))return {k:'ready',text:`▶ ${session(c,t.day)}을 열 수 있어요`,short:`${session(c,t.day)} 열기 전`};
 return {k:'ready',text:`▶ ${session(c,t.day)} 진행할 수 있어요`,short:`${session(c,t.day)} 진행 가능`};
}
function current(){const c=CASES.find(x=>x.id===ui.caseId),st=c&&S.cases[c.id];return c&&st?{c,st}:null}
function waiting(t){return t.nextAt&&now()<t.nextAt}
function addLog(t,kind,text){t.log.unshift({day:t.day,kind,text,at:now()});t.log=t.log.slice(0,60)}

/* ---------- text ---------- */
const PLAIN={'유죄 인정':['유죄','증거로 충분히 보여줬다'],'공소사실 일부만 인정':['일부만 유죄','증거로 보여준 부분만 인정한다'],
 '무죄 · 범죄의 증명 부족':['무죄','아직 남은 의문이 커서 책임을 묻기 어렵다'],'원고 청구 인용':['원고 승소','원고의 요구를 모두 인정한다'],
 '원고 청구 일부 인용':['원고 일부 승소','증거로 확인된 만큼만 인정한다'],'원고 청구 기각':['원고 패소','요구를 뒷받침할 증거가 모자라다']};
const plainLabel=v=>PLAIN[v.label]?.[0]||v.label,plainNote=v=>PLAIN[v.label]?.[1]||v.note||'';
const wName=(t,i)=>NPC[t.witnesses[i]?.id]?.name||'증인';
const short=(s,n=46)=>{s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s};
const P=(name,p)=>window.VerdictCurated?VerdictCurated.particle(name,p):name+p;

/* ---------- objections and delay requests ---------- */
const OBJ={lead:'유도신문',hearsay:'전문증거(남에게 들은 말)',relevance:'관련성 없음'};
function dressCards(c,t,cards){
 return cards.map(card=>{
  if(card.dressed||card.type==='media')return card;
  if(card.type==='objection'&&!t.witnesses.length){card.void=true;return card}
  const h=T.hash(t.seed+':'+card.id),wi=h%Math.max(1,t.witnesses.length);
  if(card.type==='objection'){
   card.w=wi;
   const open=(wDetail(c,wi)?.q||[]).filter(q=>!q.hidden);
   if(card.valid)card.otype=(h>>>3)%3===0?'hearsay':'lead';
   else{card.otype=(h>>>3)%2?'relevance':'lead';card.q=open.length?open[(h>>>5)%open.length].id:null}
  }
  if(card.type==='delay'){card.by=t.style==='delay'||(h>>>4)%3?'d':'p';card.weeks=card.valid?2:4;card.reasonKey=(h>>>6)%2}
  card.dressed=true;return card;
 }).filter(card=>!card.void);
}
function cardText(card,t,c){
 const lawyer=NPC[t.opponent]?.name||'상대';
 const crim=isCriminal(c),asker=crim?`${prosName(c)} 검사`:'원고 대리인',objector=crim?`${lawyer} 변호사`:`피고 대리인 ${lawyer} 변호사`;
 if(card.type==='media')return {title:'법정 밖 언론 플레이',who:objector,body:`${objector}가 기자들 앞에서 의뢰인의 억울함을 호소했다. 여론이 흔들린다.`};
 if(card.type==='objection'){
  const wn=wName(t,card.w),d=wDetail(c,card.w);
  let target,reason;
  if(card.otype==='lead'&&card.valid){target=tell(c,t,d?.lead||'그렇게 하신 거죠?');reason=`질문에 이미 답이 들어 있습니다. 증인이 직접 겪은 일을 스스로 말하게 해야 합니다.`}
  else if(card.otype==='hearsay'){target=`${wn}: "제가 직접 본 건 아니고, 그렇게 됐다고 다른 사람한테서 들었습니다"`;reason='증인은 직접 보거나 들은 것이 아니라 남에게 전해 들은 말을 옮기고 있습니다. 원래 말한 사람을 법정에 불러야 합니다.'}
  else{const q=(d?.q||[]).find(x=>x.id===card.q);target=tell(c,t,q?.q||'그날 무엇을 보셨습니까?');
   reason=card.otype==='lead'?'질문이 답을 정해 놓고 있습니다.':'이 질문은 사건과 관계가 없습니다.'}
  return {title:`이의 제기 · ${OBJ[card.otype]}`,who:objector,
   body:`${objector}가 ${asker}의 신문에 이의를 제기했습니다.`,target:`${asker} → 증인 ${wn}`,quote:target,reason,
   choices:['이의 인용 — 질문을 거두고 답변은 기록에서 뺌','이의 기각 — 신문 계속']};
 }
 // delay
 const late=curOf(c)?.late,fromP=card.by==='p',who=fromP?(crim?`${prosName(c)} 검사`:'원고 대리인'):objector;
 const wn=wName(t,(T.hash(t.seed+card.id)>>>2)%Math.max(1,t.witnesses.length));
 const reason=card.valid?(fromP?`추가로 확보 중인 자료(${tell(c,t,late?.title||'감정 결과')})의 회신이 아직 오지 않았습니다. 기관에 보낸 요청 공문을 함께 냅니다.`
   :card.reasonKey?`증인 ${P(wn,'이')} 입원해 다음 기일에 나올 수 없습니다. 진단서를 제출합니다.`:`어제 받은 자료(${tell(c,t,late?.title||'상대방 제출 자료')})를 검토할 시간이 필요합니다. 자료 수령 확인서를 냅니다.`)
  :(card.reasonKey?'준비가 조금 더 필요합니다.':'의뢰인과 다시 상의할 시간이 필요합니다.');
 const other=fromP?(crim?`${lawyer} 변호사`:'피고 대리인'):(crim?`${prosName(c)} 검사`:'원고 대리인');
 const opinion=card.valid?`${other}: "필요한 범위에서만 허가해 주십시오."`:`${other}: "구체적인 사유가 없습니다. 미루면 증인의 기억만 흐려집니다."`;
 return {title:'기일 연기 신청',who,body:`${who}가 다음 기일을 ${card.weeks}주 미뤄 달라고 신청했습니다.`,reason,opinion,
  choices:['연기 허가 — 다음 기일이 늦게 열림','연기 기각 — 예정대로 진행']};
}

/* ---------- v6: showing evidence to a witness, and bringing two witnesses face to face ----------
 * Both cost questions. Outcomes come from the witness's attitude and character plus the case seed;
 * what a witness admits always follows the hidden truth, so pressure uncovers facts rather than inventing them. */
const truthSide=t=>t.truth==='did'?'p':t.truth==='didnt'?'d':'m';
const ADMIT={
 did:['그 기록 앞에서는 더 감출 수가 없네요. 처음에 말을 줄였습니다. 실제로 본 건 더 분명했어요','솔직히 말씀드리면 그날 일은 제가 말한 것보다 더 심각했습니다'],
 didnt:['솔직히 제가 들은 건 짐작이었어요. 확실하게 본 건 없습니다','제가 의심을 키우는 쪽으로 말을 보탰습니다. 직접 본 건 아니에요'],
 reason:['다 말씀드리지 못한 사정이 있습니다. 한쪽만 탓할 일이 아니었어요','그날 일에는 제가 빼놓은 앞뒤 사정이 있습니다. 먼저 시작한 건 한 사람만이 아니었어요']};
/* evidence that contradicts what this witness has said on the same issue */
function conflicts(c,t,i){
 const mine=t.heard.filter(h=>h.w===i&&!h.struck&&!h.tainted&&(h.side==='p'||h.side==='d'));
 return t.evidence.filter(e=>{if(e.decision!=='use'&&e.decision!=='conditional')return false;const d=evDetail(c,e);
  return d&&(d.side==='p'||d.side==='d')&&!(t.witnesses[i].shown||[]).includes(e.id)&&mine.some(h=>h.issue===d.issue&&h.side!==d.side)});
}
function confront(c,t,i,eid){
 const w=t.witnesses[i],e=t.evidence.find(x=>x.id===eid),d=e&&evDetail(c,e);if(!w||!d)return '';
 if(t.qLeft<1){toast('오늘 신문 시간이 끝났어요.');return ''}
 t.qLeft--;(w.shown??=[]).push(eid);
 const p=NPC[w.id],tr=p?.traits||{},roll=T.between(0,99,t.seed+':cf:'+i+':'+eid),name=wName(t,i),ts=truthSide(t);
 const odds={flip:w.flipped?85:40,protect:30+(100-(tr.stressControl??50))*0.35,fear:45+(tr.honesty??50)*0.3,honest:70}[w.attitude]||50;
 let text,side='n',label='증거를 보고 한 말',strike=false;
 if(roll>=odds){text=`그 ${P(e.title,'이')} 뭘 말하든 제가 기억하는 건 그대로입니다`;side='n';label='증거를 보고도 바꾸지 않은 말'}
 else if(w.attitude==='honest'){text=`제 기억이 틀렸을 수 있겠네요. 그 기록이 더 정확할 겁니다`;strike=true;label='증거를 보고 정정한 말'}
 else if(w.attitude==='flip'&&w.flipped){w.flipped=false;text='기록을 보니 처음에 말씀드린 게 맞습니다. 중간에 말이 흔들렸어요';side=ts;label='처음 진술로 돌아온 말'}
 else{const pool=ADMIT[t.truth]||ADMIT.reason;text=pool[T.hash(t.seed+i+eid)%pool.length];side=ts;label=w.attitude==='fear'?'두려움을 털어놓으며 한 말':'감싸던 것을 털어놓은 말';w.revealed=2;strike=true}
 if(strike)t.heard.forEach(h=>{if(h.w===i&&h.issue===d.issue&&!h.text&&(h.side==='p'||h.side==='d')&&h.side!==d.side)h.struck=true});
 t.heard.push({w:i,q:'cf:'+eid,side,issue:d.issue,day:t.day,text,label});
 addLog(t,'증거 대조',`${name}에게 ${P(e.title,'을')} 보여 줌 — "${text}"`);
 remember(w.id,'법정',`${shortName(c)} 재판에서 ${P(e.title,'을')} 보고 "${short(text,30)}"라고 말함`,c.id);
 return `📁 ${name}: "${short(text,44)}"`;
}
/* two witnesses whose answers on one issue point opposite ways */
function clashPair(t,issue){const hs=t.heard.filter(h=>h.issue===issue&&!h.struck&&!h.tainted);
 const a=hs.find(h=>h.side==='p'),b=hs.find(h=>h.side==='d'&&h.w!==a?.w);return a&&b?[a.w,b.w]:null}
function faceOff(c,t,issue){
 const pair=clashPair(t,issue);if(!pair)return '';
 if(t.qLeft<2){toast('대질 신문에는 남은 신문이 2번 필요해요.');return ''}
 t.qLeft-=2;(t.faced??=[]).push(issue);
 const ts=truthSide(t),score=(i,side)=>{const w=t.witnesses[i],tr=NPC[w.id]?.traits||{};
  return (tr.honesty??50)*0.35+(tr.stressControl??50)*0.35+w.reliability*0.2+(side===ts?20:ts==='m'?8:0)-(w.attitude==='protect'?10:w.attitude==='flip'?14:0)+T.between(0,18,t.seed+':face:'+issue+':'+i)};
 const [pi,di]=pair,sp=score(pi,'p'),sd=score(di,'d'),iss=issuesOf(c).find(x=>x.id===issue);
 let text;
 if(Math.abs(sp-sd)<7){text=`${P(wName(t,pi),'과')} ${wName(t,di)} 모두 물러서지 않았다. 누구 말이 맞는지는 다른 근거로 가려야 한다`;
  t.heard.push({w:pi,q:'face:'+issue,side:'n',issue,day:t.day,text:'저는 제가 본 대로 말했습니다. 바꿀 게 없습니다',label:'대질에서 한 말'})}
 else{const lose=sp<sd?pi:di,win=lose===pi?di:pi,ls=lose===pi?'p':'d';
  t.heard.forEach(h=>{if(h.w===lose&&h.issue===issue&&h.side===ls&&!h.text)h.struck=true});
  t.heard.push({w:lose,q:'face:'+issue,side:'n',issue,day:t.day,text:`${wName(t,win)}의 말을 들으니 제가 잘못 기억했을 수도 있겠습니다`,label:'대질에서 물러선 말'});
  text=`대질 끝에 ${P(wName(t,lose),'이')} 한발 물러섰다. ${P(wName(t,win),'은')} 처음 말을 그대로 지켰다`}
 addLog(t,'대질',`'${iss?.title||'쟁점'}' · ${text}`);
 return `⚖ 대질 · ${short(text,60)}`;
}
/* ---------- actions ---------- */
function act(kind,id,choice){
 const x=current();if(!x||x.st.verdict)return;
 const {c,st}=x,t=ensure(c,st);
 if(kind==='open'){if(waiting(t)||sessionOpen(t))return;openSession(c,st);addLog(t,'개정',`${session(c,t.day)} 개정 · ${dlabel(t.dates[t.day])}`);save();ui.t4tab='day';render();window.scrollTo({top:0,behavior:'instant'});
  if(!askRequests(true))askNotices(false);return}
 if(kind==='handoff')return handoff(c,st);
 if(!sessionOpen(t)&&!waiting(t)){toast(`먼저 ${session(c,t.day)}을 여세요.`);return}
 if(waiting(t)){toast(`${session(c,t.day)}(${dlabel(Math.max(t.nextDate||0,today()))})은 ${minsLeft(t)}분 뒤에 열려요.`);return}
 let say='';
 if(kind==='decide'){
  const e=t.evidence.find(v=>v.id===id);if(!e||!T.LABEL.decision[choice]||e.decision===choice)return;
  e.decision=choice;
  if((choice==='exclude'||choice==='conditional')&&e.flawType!=='none')e.publicFlaw=true;
  addLog(t,'증거',`${e.title}: ${T.LABEL.decision[choice]}`);
  const iss=issuesOf(c).find(i=>i.id===evDetail(c,e)?.issue);
  say=choice==='exclude'?`📁 ${e.title} — 판단 자료에서 뺐어요`:`📁 ${e.title} — ${T.LABEL.decision[choice]}${iss?` · 재판 현황 '${iss.title}'에 반영`:''}`;
 }else if(kind==='ask'){
  const i=Number(id),w=t.witnesses[i];if(!w)return;
  if(t.qLeft<=0){toast('오늘 신문 시간이 끝났어요. 다음 기일에 이어서 물을 수 있어요.');return}
  const q=questionsOf(c,t,i).find(v=>v.id===choice);if(!q||w.askedIds.includes(q.id)||(w.blocked||[]).includes(q.id))return;
  t.qLeft--;w.askedIds.push(q.id);w.asked=(w.asked||0)+1;w.revealed=T.reveal(w.revealed);
  if(w.attitude==='flip'&&w.asked>=2&&!w.flipped){w.flipped=true;addLog(t,'번복',`${P(wName(t,i),'이')} 앞서 한 말을 바꾸기 시작했다`)}
  const a=answerOf(c,t,i,q);
  t.heard.push({w:i,q:q.id,side:a.side,issue:q.issue,day:t.day});
  for(const n of q.next||[])if(!w.opened.includes(n))w.opened.push(n);
  addLog(t,'증언',`${wName(t,i)} — 문: ${tell(c,t,q.q)} / 답: "${a.text}"`);
  const iss=issuesOf(c).find(v=>v.id===q.issue);
  say=`🗣 ${wName(t,i)}: "${short(a.text,40)}"${iss?` → '${iss.title}'에 기록`:''}${(q.next||[]).length?' · 이어서 물을 질문이 생겼어요':''}`;
 }else if(kind==='confront'){say=confront(c,t,Number(id),choice);if(!say)return;
 }else if(kind==='face'){say=faceOff(c,t,id);if(!say)return;
 }else if(kind==='card'){
  const card=t.cards.find(v=>v.id===id);if(!card||card.choice||!['accept','reject'].includes(choice))return;
  card.choice=choice;
  if(card.type==='delay'){
   if(choice==='accept'){t.delayAccepted=true;t.delayWeeks=card.weeks;
    const late=curOf(c)?.late,lateSide=late&&(/검찰|원고/.test(late.by)?'p':'d');
    if(card.valid&&late&&!t.lateDone&&lateSide===card.by)t.lateDue=true;
    say=`⏳ 연기를 허가했어요 · 다음 기일이 늦게 열려요(현실 시간 20분 추가)`;}
   else say='⏳ 연기 신청을 기각했어요 · 예정대로 진행해요';
  }else{
   const wn=wName(t,card.w);
   if(choice==='accept'){
    if(card.otype==='relevance'||(card.otype==='lead'&&!card.valid)){if(card.q){const w=t.witnesses[card.w];w.blocked??=[];if(!w.blocked.includes(card.q))w.blocked.push(card.q)}say=`✋ 이의를 받아들였어요 · 증인 ${wn}에게 그 질문은 더 할 수 없어요`}
    else say=`✋ 이의를 받아들였어요 · 그 답변은 판단 자료에서 빠졌어요`;
   }else{
    if(card.valid){t.heard.push({w:card.w,q:'obj:'+card.id,side:'p',issue:(wDetail(c,card.w)?.q||[])[0]?.issue||issuesOf(c)[0]?.id,day:t.day,tainted:true,label:card.otype==='lead'?'유도신문에 대한 답':'전해 들은 말'});
     say=`✋ 이의를 기각했어요 · ${card.otype==='lead'?'유도된 답변':'전해 들은 말'}이 기록에 남았어요`}
    else say='✋ 이의를 기각했어요 · 신문을 계속해요';
   }
  }
  addLog(t,card.type==='objection'?'이의':'연기',`${cardText(card,t,c).title}: ${choice==='accept'?'받아들임':'기각'}`);
 }
 save();
 if(say)toast(say);
 if(kind==='card'){if(t.cards.some(v=>!v.choice))return askRequests(true);ui.modal=null;render();return askNotices(false)}
 render();
}

/* Hand a case to another court before its first session — once a day. Two taps, so it is never an accident. */
function handoff(c,st){
 const t=st.trial4,dk=new Date().toLocaleDateString('sv-SE');
 if(t&&(t.daysDone||sessionOpen(t))){toast('공판을 연 뒤에는 넘길 수 없어요.');return}
 if(S.handoffDay===dk){toast('다른 재판부로 넘기기는 하루 1건까지예요.');return}
 if(ui.handoffArm!==c.id){ui.handoffArm=c.id;toast('한 번 더 누르면 이 사건을 다른 재판부로 넘겨요.');setTimeout(()=>{if(ui.handoffArm===c.id)ui.handoffArm=null},6000);return}
 ui.handoffArm=null;S.handoffDay=dk;st.referred=true;
 const db=S.realtimeInbox;if(db){db.otherCourt.push({slot:'handoff-'+c.id,title:c.name,day:dk,kind:c.kind,category:c.contentPack?.category,at:Date.now()})}
 news(`${shortName(c)}, 다른 재판부로 재배당`,'담당 재판부의 요청으로 사건이 다른 재판부로 넘어갔다. 결과는 추후 전해진다.','법조일보');
 save();toast('사건을 다른 재판부로 넘겼어요.');ui.tab='courtList';render();
}
/* The record, short: one line per session with what mattered, then where each issue stands. */
function recordSummary(c,t){
 const days=[...new Set([...Object.keys(t.dates||{}).map(Number),...t.log.map(l=>l.day)])].sort((a,b)=>a-b);
 const key=['새 증거','반전','번복','이의','연기'];
 const rows=days.map(d=>{const L=t.log.filter(l=>l.day===d),q=L.filter(l=>l.kind==='증언').length,ev=L.filter(l=>l.kind==='증거').length;
  const marks=L.filter(l=>key.includes(l.kind)).map(l=>l.kind==='이의'||l.kind==='연기'?l.text.replace(/^.*?·\s*/,''):l.text);
  return `<li><div class="t4-rech"><b>${esc(session(c,d))}</b>${t.dates?.[d]!=null?`<span>${esc(dlabel(t.dates[d]))}</span>`:''}</div><span class="small">증언 ${q}건 · 증거 결정 ${ev}건${marks.length?' · '+esc(marks.join(' / ')):''}</span></li>`}).join('');
 const v=t.final?`<p class="t4-order"><b>선고</b> ${esc(t.final.judgment?.order||t.final.label)}</p>`:'';
 return `${rows?`<ul class="t4-timeline">${rows}</ul>`:'<p class="muted small">아직 열린 공판이 없습니다.</p>'}${v}<h4>쟁점별 정리</h4><p class="muted small">법정에 나온 증거와 증언을 쟁점마다 어느 쪽 주장을 뒷받침하는지로 나눠 적었어요. 쓰기로 정한 증거와 들은 증언만 들어가요.</p>${issueView(c,t)}`;
}
/* Pop-ups when a trial day opens: the other side's requests first, then what the parties filed. */
function askRequests(force){
 const x=current();if(!x||x.st.verdict)return false;const {c}=x,t=x.st.trial4;if(!t||waiting(t))return false;
 if(!sessionOpen(t))return false;
 const card=t.cards.find(v=>!v.choice&&v.type!=='media');if(!card)return askNotices(false);
 if(!force&&t.askedDay===t.day)return false;t.askedDay=t.day;
 const left=t.cards.filter(v=>!v.choice&&v.type!=='media').length;
 modal(`${cardText(card,t,c).who}가 일어섭니다`,`<p class="muted small">${session(c,t.day)}을 시작하기 전에 신청${left>1?` ${left}건`:''}에 답해 주세요.</p>${cardBlock(card,t,c)}`,
  `<button class="btn outline full" data-action="dismiss">나중에 답하기</button>`);
 return true;
}
function askNotices(force){
 const x=current();if(!x||x.st.verdict)return false;const {c}=x,t=x.st.trial4;if(!t||waiting(t)||ui.modal)return false;
 if(!sessionOpen(t))return false;
 const n=(t.notices||[]).find(v=>!v.seen);if(!n)return false;
 n.seen=true;save();
 const cur=curOf(c);
 if(n.type==='late'){
  const L=cur?.late,e=t.evidence.find(v=>v.late);if(!L||!e)return false;
  const bySide=/검찰|원고/.test(L.by)?'p':'d',reply=bySide==='p'?sideWord(c,'d'):sideWord(c,'p');
  const rebutSide=L.side==='p'?sideWord(c,'d'):L.side==='d'?sideWord(c,'p'):reply;
  modal(`${L.by} 새 증거 제출`,`<p>${esc(tell(c,t,L.reason))}</p><div class="t4-card mini"><b>${esc(tell(c,t,L.title))}</b><p class="t4-shows">${esc(tell(c,t,L.shows))}</p><p class="small">${esc(tell(c,t,L.how))}</p></div>
   <p class="t4-said"><b>${esc(rebutSide)}</b> "${esc(tell(c,t,L.rebut))}"</p><p class="muted small">증거 탭에서 이 증거를 쓸지 정하세요.</p>`,
   `<button class="btn outline" data-action="dismiss">닫기</button><button class="btn primary" data-action="t4go" data-go="evidence">증거 보기</button>`);
  return true;
 }
 if(n.type==='rebut'&&cur?.rebut){modal(`${sideWord(c,'p')}의 반박`,`<p class="t4-said">"${esc(tell(c,t,cur.rebut))}"</p><p class="muted small">${sideWord(c,'d')}의 주장에 대한 답입니다. 재판 현황에서 쟁점별로 확인하세요.</p>`);return true}
 if(n.type==='flip'){modal('증인 진술 번복',`<p>${esc(P(wName(t,n.w),'이'))} 앞서 한 말을 바꾸겠다고 했습니다. 같은 질문이라도 이제 다른 답이 나올 수 있습니다.</p>`);return true}
 return askNotices(force);
}

function endDay(){
 const x=current();if(!x||x.st.verdict)return;
 const {c,st}=x,t=ensure(c,st);
 if(waiting(t))return;
 openSession(c,st);
 if(t.cards.some(v=>!v.choice&&v.type!=='media')){askRequests(true);return}
 const heardToday=t.heard.filter(h=>h.day===t.day&&!h.tainted).length,decided=t.evidence.filter(e=>e.decision).length;
 let twist=null;
 if(!t.twistUsed&&t.day>=2&&T.unit(t.seed+':twist:'+t.day)<T.twistChance(c.importance)){
  t.twistUsed=true;
  const flip=t.witnesses.findIndex(w=>w.attitude==='flip'&&!w.flipped);
  if(flip>=0){t.witnesses[flip].flipped=true;twist=`${P(wName(t,flip),'이')} 다음 기일에 진술을 바꾸겠다고 알려 왔다`;t.notices.push({type:'flip',w:flip,day:t.day+1})}
  else if(curOf(c)?.late&&!t.lateDone)t.lateDue=true;
  if(twist)addLog(t,'반전',twist);
 }
 const mediaCard=t.cards.some(v=>v.type==='media');
 t.media=T.pressDay(t.media,t,{twist:!!twist||!!t.lateDue,news:t.media.H>=60?8:0,defenseMedia:mediaCard?8:0});
 (t.mediaLog??=[]).push({s:t.day,O:t.media.O,H:t.media.H,ev:twist||(t.lateDue?'새 증거 제출':'')});
 for(const e of t.evidence)if(e.publicFlaw)e.airedCounted=true;
 t.daysDone++;
 const desk4=desk(),outlet=REPORTERS[T.hash(c.id+t.day)%REPORTERS.length];
 if(t.media.H>=55)news(`${shortName(c)} · ${session(c,t.daysDone)}`,twist?`${twist}. 법정 안팎이 술렁였다.`:'증거와 증언을 두고 양측 공방이 이어졌다.',outlet.outlet);
 addLog(t,'기일',`${session(c,t.daysDone)} 종료 · 오늘 들은 증언 ${heardToday}건 · 증거 결정 ${decided}/${t.evidence.length}`);
 const more=!isDecision(c)&&t.daysDone<t.minDays+EXTRA_DAYS;
 if(more){
  t.day++;t.qLeft=t.qpd||QPD;t.cards=dressCards(c,t,skilled(c,t,T.cards(t,t.day,t.seed),t.day));
  t.nextDate=(t.dates?.[t.day-1]??today())+14+(t.delayAccepted?(t.delayWeeks||2)*7:0);
  t.nextAt=now()+DAY_WAIT+(t.delayAccepted?DELAY_EXTRA:0);t.delayAccepted=false;
  if(t.daysDone===1&&curOf(c)?.rebut)t.notices.push({type:'rebut',day:t.day});
  if(t.lateDue&&!t.lateDone){addLate(c,t);t.lateDue=false}
 }else{t.cards=[];t.qLeft=0}
 st.hearingHistory??=[];st.hearingHistory.push({kind:'resumed',week:S.week,v4:true});
 ui.t4tab='day';
 save();
 const can=t.daysDone>=t.minDays;
 modal(`${session(c,t.daysDone)} 종료`,
  `<div class="t4-result">${twist?`<p class="t4-twist">⚡ ${esc(twist)}</p>`:''}
  <p>오늘 법정에서 증언 <b>${heardToday}건</b>을 들었고, 증거 <b>${decided}/${t.evidence.length}건</b>의 사용 여부를 정했습니다.</p>
  ${issueView(c,t,true)}
  <p class="muted small">${can?(more?`이제 판결할 수 있습니다. 기일을 더 열고 싶다면 ${session(c,t.day)}(${dlabel(Math.max(t.nextDate||0,today()))})에 이어서 할 수 있어요.`:'이제 판결할 수 있습니다.'):`판결하려면 기일이 ${t.minDays-t.daysDone}번 더 필요합니다. ${session(c,t.day)}은 <b>${dlabel(Math.max(t.nextDate||0,today()))}</b>로 잡혔습니다(현실 시각 ${clock(t.nextAt)}, ${minsLeft(t)}분 뒤 열림). 그동안 다른 사건을 진행하세요.`}</p></div>`);
}
/* Evidence one side files between trial days. It arrives with the next day. */
function addLate(c,t){
 const L=curOf(c)?.late;if(!L||t.lateDone)return;
 const id='e'+t.evidence.length;
 const ns=T.roll({id:c.id+'-late',strict:true,evidence:[{id,title:tell(c,t,L.title),note:tell(c,t,L.caveat),scope:tell(c,t,L.shows),hintFlaw:L.flaw||'none'}],witnesses:[],truth:t.truth},t.seed+':late',[]).evidence[0];
 ns.late=true;ns.arrivedDay=t.day;t.evidence.push(ns);t.lateDone=true;
 t.notices.push({type:'late',day:t.day});
 addLog(t,'새 증거',`${P(L.by,'이')} 새 증거를 제출했다: ${tell(c,t,L.title)}`);
}

/* ---------- verdict ---------- */
const CRIM_FACTORS=[['first','초범이다',-1],['remorse','반성하고 있다',-1],['repair','피해를 회복했거나 합의했다',-1],['impulse','계획 없이 벌어진 일이다',-1],['grave','피해가 무겁다',1],['plan','계획적이었다',1],['norem','반성하지 않는다',1],['vuln','피해자가 약한 처지였다',1]];
const CIVIL_FACTORS=[['proved','입증된 손해만 인정한다',-1],['fault','원고에게도 책임이 있다',-1],['pain','정신적 고통이 크다',1],['long','피해가 오래 이어졌다',1]];
const ym=m=>{const y=Math.floor(m/12),r=m%12;return y&&r?`${y}년 ${r}개월`:y?`${y}년`:`${r}개월`};
const won=n=>{n=Math.round(Number(n)||0);const e=Math.floor(n/10000),r=n%10000;return e?`${e}억${r?` ${r.toLocaleString('ko-KR')}만`:''} 원`:`${r.toLocaleString('ko-KR')}만 원`};
/* What has to be decided after the verdict itself, and the reference range shown to the player. */
function sentenceSpec(c,dir){
 const side=T.sideOf(dir),partial=side===0.5;
 if(side<=0||isDecision(c))return null;
 if(isCriminal(c)){
  const ch=chargeOf(c);if(!ch)return null;
  const dm=curOf(c).demand,k=partial?0.6:1;
  if(typeof dm==='object'&&dm.fine){const f=dm.fine*k;return {mode:'crim',ch,demand:dm,ref:{kind:'fine',lo:Math.round(f*0.8/10)*10,hi:Math.round(f*1.2/10)*10}}}
  const d=Math.round(dm*12*k),lo=Math.max(Math.round(ch.min*12),Math.round(d*0.8)),hi=Math.min(ch.max*12,Math.round(d*1.2));
  return {mode:'crim',ch,demand:dm,ref:{kind:'months',lo:Math.min(lo,hi),hi}};
 }
 const cl=claimOf(c);if(!cl)return null;
 return {mode:'civil',cl,full:side===1,ref:{kind:'won',lo:cl.fair[0],hi:cl.fair[1]}};
}
function vstate(c){
 ui.t4v??={};if(ui.t4v.caseId!==c.id)ui.t4v={caseId:c.id,cites:[],factors:[]};
 return ui.t4v;
}
function setOption(c,optId){
 const v=vstate(c),opt=c.verdicts.find(o=>o.id===optId);if(!opt)return;
 v.opt=optId;const sp=sentenceSpec(c,T.direction(opt,c.kind));v.factors=[];
 if(sp?.mode==='crim'){
  if(sp.ref.kind==='fine'){v.type='fine';v.fine=Math.round((sp.ref.lo+sp.ref.hi)/2/10)*10}
  else{v.type='prison';v.months=Math.round((sp.ref.lo+sp.ref.hi)/2/3)*3||12;v.susp=2}
 }else if(sp?.mode==='civil')v.amount=sp.full?sp.cl.amount:Math.round((sp.ref.lo+sp.ref.hi)/2/10)*10;
}
function legalMonths(sp,v){const mit=(v.factors||[]).some(f=>CRIM_FACTORS.find(x=>x[0]===f)?.[2]<0);
 const min=Math.max(1,Math.round(sp.ch.min*12*(mit?0.5:1)));return {min,max:sp.ch.max*12,reduced:mit&&sp.ch.min>0}}
function tweak(c,k,val){
 const v=vstate(c),opt=c.verdicts.find(o=>o.id===v.opt);if(!opt)return;
 const sp=sentenceSpec(c,T.direction(opt,c.kind));
 if(k==='type'){v.type=val;if(val==='suspend'&&v.months>36)v.months=36;if(val==='fine'&&!v.fine)v.fine=Math.min(sp.ch.fine,Math.round(sp.ch.fine/4/10)*10||100)}
 else if(k==='months'&&sp?.mode==='crim'){const L=legalMonths(sp,v);v.months=Math.max(L.min,Math.min(v.type==='suspend'?36:L.max,(v.months||12)+Number(val)))}
 else if(k==='susp')v.susp=Math.max(1,Math.min(5,(v.susp||2)+Number(val)));
 else if(k==='fine'&&sp?.mode==='crim')v.fine=Math.max(50,Math.min(sp.ch.fine,(v.fine||100)+Number(val)));
 else if(k==='amount'&&sp?.mode==='civil'){const step=Math.max(10,Math.round(sp.cl.amount/40/10)*10);v.amount=Math.max(0,Math.min(sp.cl.amount,(v.amount||0)+Number(val)*step))}
 else if(k==='factor'){v.factors=v.factors.includes(val)?v.factors.filter(f=>f!==val):[...v.factors,val];if(sp?.mode==='crim'&&v.months){const L=legalMonths(sp,v);v.months=Math.max(L.min,v.months)}}
 else if(k==='cite'){v.cites=v.cites.includes(val)?v.cites.filter(f=>f!==val):v.cites.length>=3?v.cites:[...v.cites,val]}
 render();
}
/* Material the player may cite: evidence they used, and testimony that stayed in the record. */
function citables(c,t){
 const out=[];
 t.evidence.forEach(e=>{if(e.decision!=='use'&&e.decision!=='conditional')return;const d=evDetail(c,e);
  out.push({key:'e:'+e.id,label:e.title,text:e.scope||'',side:d?.side==='p'||d?.side==='d'?d.side:'n',issue:d?.issue,illegal:e.flawType==='illegal',kind:'evidence'})});
 t.heard.forEach((h,i)=>{if(h.struck)return;
  if(h.tainted){out.push({key:'h:'+i,label:`${wName(t,h.w)} — ${h.label}`,text:'',side:'p',issue:h.issue,struck:true,kind:'testimony'});return}
  if(h.text){out.push({key:'h:'+i,label:`${wName(t,h.w)}의 ${h.label||'증언'}`,text:h.text,side:h.side==='m'?'n':h.side,issue:h.issue,kind:'testimony',name:wName(t,h.w)});return}
  const q=(wDetail(c,h.w)?.q||[]).find(v=>v.id===h.q);if(!q)return;const a=answerOf(c,t,h.w,q);
  out.push({key:'h:'+i,label:`${wName(t,h.w)}의 증언`,text:a.text,side:h.side==='m'?'n':h.side,issue:h.issue,kind:'testimony',name:wName(t,h.w)})});
 return out;
}
function sentenceOf(c,sp,v){
 if(!sp)return null;
 if(sp.mode==='civil'){const amount=v.amount||0;return {text:won(amount),order:amount>0?`피고는 원고에게 ${won(amount)}을 지급하라.${amount<sp.cl.amount?' 원고의 나머지 청구는 기각한다.':''}`:'원고의 청구를 기각한다.',
  score:sp.full?null:{what:'배상액',value:amount,lo:sp.ref.lo,hi:sp.ref.hi}}}
 const crimLabel={prison:'징역',suspend:'징역(집행유예)',fine:'벌금',life:'무기징역'}[v.type];
 let order,text,value;
 if(v.type==='life'){order='피고인을 무기징역에 처한다.';text='무기징역';value=sp.ref.kind==='months'?sp.ch.max*12+12:Infinity}
 else if(v.type==='fine'){order=`피고인을 벌금 ${won(v.fine)}에 처한다.`;text=`벌금 ${won(v.fine)}`;value=sp.ref.kind==='fine'?v.fine:0}
 else{order=`피고인을 징역 ${ym(v.months)}에 처한다.${v.type==='suspend'?` 다만 이 판결 확정일부터 ${v.susp}년간 위 형의 집행을 유예한다.`:''}`;text=`징역 ${ym(v.months)}${v.type==='suspend'?`, 집행유예 ${v.susp}년`:''}`;
  value=sp.ref.kind==='months'?(v.type==='suspend'?v.months*0.5:v.months):Infinity}
 const lo=sp.ref.lo,hi=sp.ref.hi,f=v.factors||[];
 return {text,order,label:crimLabel,score:{what:'형량',value,lo,hi,mitig:f.filter(x=>CRIM_FACTORS.find(y=>y[0]===x)?.[2]<0).length,aggr:f.filter(x=>CRIM_FACTORS.find(y=>y[0]===x)?.[2]>0).length}};
}
const demandText=c=>{const d=curOf(c)?.demand;return d==null?'':typeof d==='object'?`벌금 ${won(d.fine)}`:`징역 ${ym(Math.round(d*12))}`};
function askVerdict(optionId){
 const x=current();if(!x||x.st.verdict)return;
 const {c,st}=x,t=ensure(c,st);
 if(t.daysDone<t.minDays){toast(`기일이 ${t.minDays-t.daysDone}번 더 필요해요.`);return}
 setOption(c,optionId);render();
}
function confirmVerdict(){
 const x=current();if(!x||x.st.verdict)return;
 const {c,st}=x,t=ensure(c,st),v=vstate(c),opt=c.verdicts.find(o=>o.id===v.opt);
 if(!opt){toast('먼저 결론을 고르세요.');return}
 if(t.daysDone<t.minDays){toast(`기일이 ${t.minDays-t.daysDone}번 더 필요해요.`);return}
 const items=citables(c,t),cites=items.filter(i=>v.cites.includes(i.key));
 if(!cites.length){toast('판결 이유로 삼을 증거나 증언을 하나 이상 고르세요.');return}
 const dir=T.direction(opt,c.kind),sp=sentenceSpec(c,dir),sent=sentenceOf(c,sp,v);
 const fs=(v.factors||[]).map(f=>(sp?.mode==='civil'?CIVIL_FACTORS:CRIM_FACTORS).find(x=>x[0]===f)).filter(Boolean);
 const score=sent?.score?{...sent.score,mitig:fs.filter(f=>f[2]<0).length,aggr:fs.filter(f=>f[2]>0).length}:null;
 const res=T.skill(t,{dir,criminal:isCriminal(c),cites:cites.map(i=>({label:i.label,side:i.side,illegal:i.illegal,struck:i.struck})),sentence:score});
 const judgment=writeJudgment(c,t,opt,dir,cites,sp,sent,fs);
 st.phase=3;st.liveHearing=null;st.nextHearingWeek=null;st.hearingHistory??=[];
 while(st.hearingHistory.filter(h=>h.kind==='resumed').length<4)st.hearingHistory.push({kind:'resumed',week:S.week,v4:true});
 S.actions=0;
 const prevEval=StoryEngine.evaluate;
 StoryEngine.evaluate=()=>({score:res.score,why:judgment.order+' '+judgment.conclusion});
 try{conclude(opt.id)}finally{StoryEngine.evaluate=prevEval}
 if(!st.verdict){toast('선고를 기록하지 못했습니다. 다시 시도해 주세요.');console.warn('v5 verdict blocked',c.id);return}
 st.grade=res.score;ui.t4v=null;
 after(c,st,t,opt,dir,res,{judgment,sentence:sent?.text||null});
}
/* The written judgment: what happened, what it rests on, each issue, and the sentence. Only cited material is quoted. */
function writeJudgment(c,t,opt,dir,cites,sp,sent,fs){
 const crim=isCriminal(c),side=T.sideOf(dir),who=crim?'피고인':'피고',accuser=crim?'검사':'원고';
 const line=i=>i.kind==='evidence'?`${i.label}에 따르면 ${i.text.replace(/[.。]$/,'')}.`:i.struck?`${i.label}이 기록에 남아 있다.`:`${P(i.name,'은')} "${i.text}"라고 진술했다.`;
 const dec=curOf(c)?.decision;
 const order=dec?tell(c,null,side>0?dec.yesOrder:dec.noOrder):side<=0?(crim?'피고인은 무죄.':'원고의 청구를 기각한다.'):(sent?.order||(crim?'피고인을 유죄로 인정한다.':'원고의 청구를 인용한다.'));
 const facts=side===1?[`재판부는 다음 사실을 인정한다.`,...cites.map(line)]:side===0.5?[`재판부는 ${accuser}의 주장 중 증명된 부분만 인정한다.`,...cites.map(line)]
  :[`재판부는 다음 이유로 ${crim?'공소사실':'원고의 청구'}을 인정하지 않는다.`,...cites.map(line)];
 const excluded=t.evidence.filter(e=>e.decision==='exclude').map(e=>`${e.title} — ${e.flawType==='illegal'?'위법하게 수집돼 증거로 쓸 수 없다':e.flawType!=='none'?'믿기 어려운 사정이 있어 판단에서 뺐다':'판단에 필요하지 않아 뺐다'}`);
 const issues=issuesOf(c).map(is=>{
  const mine=cites.filter(i=>i.issue===is.id),pro=mine.filter(i=>i.side==='p'),con=mine.filter(i=>i.side==='d');
  let txt;
  if(pro.length&&con.length)txt=`엇갈리는 자료가 있었다. 재판부는 ${(side>0?pro:con).map(i=>i.label).join(', ')} 쪽을 더 믿을 만하다고 보았다.`;
  else if(pro.length)txt=side>0?`${pro.map(i=>i.label).join(', ')}에 비추어 ${accuser}의 주장이 인정된다.`:`${pro.map(i=>i.label).join(', ')}만으로는 의심을 지우기에 부족하다.`;
  else if(con.length)txt=side>0?`${con.map(i=>i.label).join(', ')}이 있으나 결론을 바꿀 정도는 아니다.`:`${con.map(i=>i.label).join(', ')}에 비추어 ${accuser}의 주장을 그대로 믿기 어렵다.`;
  else txt=side>0?'이 쟁점에 대해서는 판결 이유로 삼은 자료가 없다.':`${accuser}이(가) 이 점을 증명하지 못했다. ${tell(c,t,is.open)}`;
  return {title:is.title,text:txt};
 });
 let conclusion;
 if(sp?.mode==='crim'&&sent){
  const ref=sp.ref.kind==='fine'?`벌금 ${won(sp.ref.lo)}~${won(sp.ref.hi)}`:`징역 ${ym(sp.ref.lo)}~${ym(sp.ref.hi)}`;
  const that=x=>x.endsWith('이다')?x.slice(0,-2)+'이라는':x+'는';const mit=fs.filter(f=>f[2]<0).map(f=>that(f[1])),agg=fs.filter(f=>f[2]>0).map(f=>that(f[1]));
  conclusion=`검사는 ${demandText(c)}을 구형했다. 법정형은 ${sp.ch.name}(${sp.ch.law}) ${sp.ch.min?`징역 ${sp.ch.min}년 이상`:''}${sp.ch.max?` ${sp.ch.max}년 이하`:''}${sp.ch.fine?` 또는 벌금 ${won(sp.ch.fine)} 이하`:''}이고, 구형을 기준으로 한 참고 범위는 ${ref}이다. ${mit.length?`유리한 사정으로 ${mit.join(', ')} 점을, `:''}${agg.length?`불리한 사정으로 ${agg.join(', ')} 점을 고려해 `:'이 사정들을 종합해 '}${sent.text}을 선고한다.`;
 }else if(sp?.mode==='civil'&&sent){
  const ps=fs.map(f=>f[1]);
  conclusion=`원고는 ${won(sp.cl.amount)}(${sp.cl.what})을 청구했다. ${sp.full?'재판부는 청구를 모두 받아들인다.':`입증된 손해의 범위는 대략 ${won(sp.ref.lo)}~${won(sp.ref.hi)}로 보이며, ${ps.length?ps.map(x=>x.endsWith('이다')?x.slice(0,-2)+'이라는':x+'는').join(', ')+' 점을 고려해 ':''}${sent.text}을 인정한다.`}`;
 }else conclusion=side<=0?`${accuser}의 주장은 합리적인 의심 없이 증명되지 않았다. 그러므로 주문과 같이 판결한다.`:'그러므로 주문과 같이 판결한다.';
 return {order,facts,excluded,issues,conclusion};
}

function after(c,st,t,opt,dir,res,extra={}){
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
 t.final={option:opt.id,label:opt.label,dir,reasons:[],judgment:extra.judgment||null,sentence:extra.sentence||null,skill:res.score,items:res.items,match,review:ev.review,evaluators:ev.scores,
  reviewAt:now()+REVIEW_AFTER,reviewShown:false,headlines,sns,desk:deskOut&&{summary:deskOut.summary,anomalies:deskOut.anomalies,column:deskOut.column,beat:deskOut.beat,community:{mode:deskOut.community.mode,label:deskOut.community.label},narratives:deskOut.narratives},proof:T.gauge(t),media:{...t.media},at:now()};
 window.VerdictV6?.onVerdict?.(c,t);
 t.revealAt=now()+T.between(REVEAL_MIN_DAYS,REVEAL_MAX_DAYS,t.seed+':reveal')*DAY;
 const curE=curOf(c);
 if(curE?.endings){const ek=endingKey(c,dir);t.final.ending=tell(c,t,curE.endings[ek]||'');if(t.final.ending)news(`${shortName(c)}, 그 후`,t.final.ending,'법조일보')}
 st.trialReview={skill:res.score,review:ev.review,proof:t.final.proof.P,doubt:t.final.proof.D,publicOpinion:{...t.media}};
 save();render();
 modal('선고 완료',`<p><b>${esc(plainLabel(opt))}</b></p>
  ${extra.judgment?`<p class="t4-order"><b>주문</b> ${esc(extra.judgment.order)}</p>`:''}
  <div class="t4-delta"><span>판결 실력</span><b>${res.score}</b></div>
  <div class="t4-delta"><span>여론과 맞은 정도</span><b>${match}</b></div>
  ${deskOut?`<h4>📋 판결 요약</h4><div class="t4-summary">${deskOut.summary.map(l=>`<div>${esc(l)}</div>`).join('')}</div>
  <h4>오늘의 1면</h4><p class="t4-headline"><small>${esc(deskOut.column.outlet)} · ${esc(deskOut.column.desk)}</small><br>${esc(deskOut.column.title)}</p><p class="t4-headline"><small>${esc(deskOut.beat.outlet)} · ${esc(deskOut.beat.desk)}</small><br>${esc(deskOut.beat.title)}</p>`:''}
  ${headlines.map(x=>`<p class="t4-headline"><small>${esc(x.outlet)} · ${esc(x.name)} 기자</small><br>${esc(x.text)}</p>`).join('')}
  <p class="muted small">판결문 전문과 채점은 '선고 이후' 탭에서 볼 수 있어요. 판결 리뷰 점수는 약 9시간 뒤 공개됩니다.</p>`);
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
  if(!t.truthShown&&t.revealAt&&t0>=t.revealAt&&(window.VerdictV6?.yearsSince?.(t)??9)>=1){
   t.truthShown=true;changed=true;
   const crim=isCriminal(c),cur=curOf(c);
   const fact=cur?.truth?.[t.truth]?tell(c,t,cur.truth[t.truth]).replace(/[.。]$/,''):t.truth==='did'?(crim?'당시 피고인의 행위가 실제로 있었던 것으로 확인됐다':'당시 청구의 핵심 사실이 실제로 있었던 것으로 확인됐다')
    :t.truth==='didnt'?(crim?'당시 혐의가 사실이 아니었던 것으로 드러났다':'당시 주장된 사실이 없었던 것으로 드러났다')
    :'당시 알려지지 않았던 사정이 새로 확인됐다';
   window.VerdictV6?.tellTruth?.(c,t,fact);
   news(`과거 사건 재조명 · ${shortName(c)}`,`후속 취재에서 ${fact}. 당시 판결은 "${t.final.label}", 여론 방향은 ${t.final.media.O}점이었다. 판결은 그대로 확정되어 있다.`,'탐사저널K');
  }
 }
 if(changed)save();
 return changed;
}

/* ---------- views ---------- */
const byWord={검찰:'검찰 제출',변호인:'변호인 제출',원고:'원고 제출',피고:'피고 제출'};
function evidenceCard(e,t,locked,c){
 const d=evDetail(c,e),dis=locked?'disabled':'';
 const opt=(v,l)=>`<button class="t4-chip ${e.decision===v?'on':''}" data-action="t4" data-kind="decide" data-id="${esc(e.id)}" data-choice="${v}" ${dis||e.decision===v?'disabled':''}>${l}</button>`;
 const iss=issuesOf(c).find(i=>i.id===d?.issue);
 return `<article class="t4-card t4-ev"><header><b>${esc(e.title)}</b>${e.late?'<span class="t4-tag new">새로 제출됨</span>':''}</header>
 ${d?`<p class="t4-meta">${esc(d.kind||'')} · ${esc(byWord[d.by]||d.by||'')} · ${esc(tell(c,t,d.when||''))}</p>`:''}
 ${e.scope?`<p class="t4-shows">${esc(e.scope)}</p>`:''}
 ${d?.excerpt?`<blockquote class="t4-excerpt">${esc(tell(c,t,d.excerpt))}</blockquote>`:''}
 ${d?.how?`<p class="small"><b>확보 경위</b> ${esc(tell(c,t,d.how))}</p>`:''}
 ${e.note?`<p class="small"><b>한계</b> ${esc(e.note)}</p>`:''}
 ${d?.check?`<p class="small t4-check"><b>대조해 볼 것</b> ${esc(tell(c,t,d.check))}</p>`:''}
 ${iss?`<p class="t4-issue-tag">쟁점 · ${esc(iss.title)}</p>`:''}
 ${window.VerdictV6?.benchAdvice?.(c,t,e)||''}
 <div class="t4-row t4-choose"><span>이 증거를${e.decision?' ✔':''}</span>${opt('use','쓴다')}${opt('conditional','조건 붙여 쓴다')}${opt('exclude','뺀다')}</div></article>`;
}
function witnessCard(w,t,locked,c){
 const i=t.witnesses.indexOf(w),p=NPC[w.id],qs=questionsOf(c,t,i),asked=w.askedIds||[],blocked=w.blocked||[];
 const heard=asked.map(id=>{const q=(wDetail(c,i)?.q||[]).find(v=>v.id===id);if(!q)return '';const a=answerOf(c,t,i,q);
  const back=t.heard.find(h=>h.w===i&&h.q===id)?.struck;
  return `<div class="t4-qa ${back?'struck':''}"><p class="q">문. ${esc(tell(c,t,q.q))}</p><p class="a">답. "${esc(a.text)}"</p>${back?'<small>⤺ 나중에 거둬들인 말</small>':''}</div>`}).join('');
 const left=qs.filter(q=>!asked.includes(q.id)&&!blocked.includes(q.id));
 const can=!locked&&t.qLeft>0;
 const extra=t.heard.filter(h=>h.w===i&&h.text).map(h=>`<div class="t4-qa v6"><p class="q">${String(h.q).startsWith('face:')?'⚖ 대질':'📁 증거를 보여 줌'}</p><p class="a">"${esc(h.text)}"</p><small>${esc(h.label||'')}</small></div>`).join('');
 const cf=locked?[]:conflicts(c,t,i);
 const confrontBox=cf.length?`<div class="t4-confront"><p class="t4-ask-head">⚠ 이 증인의 말과 어긋나는 증거 <small>· 보여 주며 물으면 신문 1번</small></p>${cf.map(e=>`<button class="t4-q cf" data-action="t4" data-kind="confront" data-id="${i}" data-choice="${esc(e.id)}" ${can?'':'disabled'}>📁 ${esc(P(e.title,'을'))} 보여 주며 묻기</button>`).join('')}</div>`:'';
 return `<article class="t4-card"><header><button class="t4-name" data-action="npc" data-id="${esc(w.id)}">👤 ${esc(p?.name||'증인')}</button><span class="t4-tag">${esc(w.role)}</span></header>
 ${w.story?`<p class="t4-story">${esc(w.story)}</p>`:''}${w.interest?`<p class="small muted">이해관계 · ${esc(w.interest)}</p>`:''}
 ${heard||'<p class="muted small">아직 묻지 않았습니다.</p>'}${extra}${confrontBox}
 ${left.length?`<p class="t4-ask-head">물어볼 질문 ${locked?'':`· 오늘 남은 신문 ${t.qLeft}/${t.qpd||QPD}`}</p>${left.map(q=>`<button class="t4-q" data-action="t4" data-kind="ask" data-id="${i}" data-choice="${esc(q.id)}" ${can?'':'disabled'}>🗣 ${esc(tell(c,t,q.q))}${q.hidden?' <i>새 질문</i>':''}</button>`).join('')}`:'<p class="muted small">이 증인에게 물을 질문을 모두 물었습니다.</p>'}
 ${blocked.length?`<p class="muted small">이의가 받아들여져 할 수 없는 질문 ${blocked.length}개</p>`:''}</article>`;
}
function cardBlock(card,t,c){
 const x=cardText(card,t,c);
 if(card.type==='media')return `<div class="t4-event media"><b>📣 ${esc(x.title)}</b><p>${esc(x.body)}</p></div>`;
 const done=card.choice;
 return `<div class="t4-event ${done?'done':''}"><b>${card.type==='objection'?'✋':'⏳'} ${esc(x.title)}</b><p>${esc(x.body)}</p>
 ${x.target?`<p class="small"><b>대상</b> ${esc(x.target)}</p><blockquote class="t4-excerpt">${esc(x.quote)}</blockquote>`:''}
 <p class="small"><b>신청 이유</b> ${esc(x.reason)}</p>${x.opinion?`<p class="small"><b>상대방 의견</b> ${esc(x.opinion)}</p>`:''}
 ${done?`<p class="small">→ ${esc(done==='accept'?x.choices[0]:x.choices[1])}</p>`:`<div class="t4-stack"><button class="btn mini primary" data-action="t4" data-kind="card" data-id="${esc(card.id)}" data-choice="accept">${esc(x.choices[0])}</button><button class="btn mini outline" data-action="t4" data-kind="card" data-id="${esc(card.id)}" data-choice="reject">${esc(x.choices[1])}</button></div>`}</div>`;
}
/* Where the case stands, issue by issue, from what has been shown in court so far. Nothing hidden is used.
 * Each issue reads like a judge's note: the question, then what supports each side (evidence first, then testimony),
 * what makes it harder to decide, where two witnesses contradict each other, and what is still unchecked. */
function issueFacts(c,t,is){
 const items=[];
 for(const e of t.evidence){const d=evDetail(c,e);if(d?.issue!==is.id||!(e.decision==='use'||e.decision==='conditional'))continue;
  items.push({kind:'증거',side:d.side||'n',who:e.title,text:e.scope||'',note:e.decision==='conditional'?(e.note?`조건부 · ${e.note}`:'조건부로 씀'):''})}
 for(const h of t.heard){if(h.issue!==is.id||h.struck||h.tainted)continue;
  if(h.text){items.push({kind:'증언',side:h.side||'n',who:wName(t,h.w),w:h.w,text:`"${h.text}"`,note:h.label||'',day:h.day});continue}
  const q=(wDetail(c,h.w)?.q||[]).find(v=>v.id===h.q);if(!q)continue;
  items.push({kind:'증언',side:h.side||'n',who:wName(t,h.w),w:h.w,text:`"${answerOf(c,t,h.w,q).text}"`,day:h.day})}
 return items;
}
function issueStatus(c,t,is){
 const f=issueFacts(c,t,is),p=f.filter(x=>x.side==='p').length,d=f.filter(x=>x.side==='d').length;
 const wp=f.filter(x=>x.kind==='증언'&&x.side==='p'),wd=f.filter(x=>x.kind==='증언'&&x.side==='d');
 const clash=wp.length&&wd.length?{a:wp[0].who,b:wd[0].who}:null;
 const undecided=t.evidence.filter(e=>!e.decision&&evDetail(c,e)?.issue===is.id).length;
 const unasked=t.witnesses.reduce((n,w,i)=>n+questionsOf(c,t,i).filter(q=>q.issue===is.id&&!(w.askedIds||[]).includes(q.id)&&!(w.blocked||[]).includes(q.id)).length,0);
 const lean=!f.length?'open':clash||(p&&d)?'clash':p?'p':d?'d':'some';
 return {f,p,d,clash,undecided,unasked,lean};
}
function faceList(c,t,locked){
 if(locked)return '';const can=issuesOf(c).filter(is=>!(t.faced||[]).includes(is.id)&&clashPair(t,is.id));
 return can.length?`<div class="t4-face">${can.map(is=>{const [a,b]=clashPair(t,is.id);return `<button class="t4-q face" data-action="t4" data-kind="face" data-id="${esc(is.id)}" ${t.qLeft>=2?'':'disabled'}>⚖ 대질 신문 · ${esc(wName(t,a))} ↔ ${esc(wName(t,b))}<small>'${esc(is.title)}'에서 말이 엇갈려요 · 신문 2번</small></button>`}).join('')}</div>`:'';
}
function issueView(c,t,brief){
 const issues=issuesOf(c);if(!issues.length)return '';
 const P_=sideWord(c,'p')==='검사'?'검찰':'원고',D_=sideWord(c,'p')==='검사'?'변호인':'피고';
 const LEAN={open:'아직 근거 없음',clash:'양쪽 근거가 맞섬',p:`${P_} 쪽 근거만 있음`,d:`${D_} 쪽 근거만 있음`,some:'참고 사실만 있음'};
 if(brief)return `<div class="t4-iss-brief">${issues.map(is=>{const s=issueStatus(c,t,is);
  return `<button class="t4-ib ${s.lean}" data-action="t4tab" data-tab="log"><b>${esc(is.title)}</b><span><i class="p">${P_} ${s.p}</i><i class="d">${D_} ${s.d}</i>${s.clash?'<i class="x">⚠ 엇갈림</i>':''}</span></button>`}).join('')}</div>`;
 const li=x=>`<li><span class="k ${x.kind==='증거'?'ev':'wt'}">${x.kind}</span><b>${esc(x.who)}</b> ${esc(x.text)}${x.note?`<small>${esc(x.note)}</small>`:''}</li>`;
 const group=(cls,label,list)=>list.length?`<div class="t4-side ${cls}"><p>${label}</p><ul>${list.sort((a,b)=>(a.kind==='증거'?0:1)-(b.kind==='증거'?0:1)).map(li).join('')}</ul></div>`:'';
 return `<div class="t4-issues">${issues.map((is,n)=>{const s=issueStatus(c,t,is),f=s.f;
  const todo=[s.undecided?`정하지 않은 증거 ${s.undecided}건`:'',s.unasked?`묻지 않은 질문 ${s.unasked}개`:''].filter(Boolean).join(' · ');
  return `<div class="t4-issue ${s.lean}"><div class="t4-ih"><span class="n">쟁점 ${n+1}</span><b>${esc(is.title)}</b><em>${LEAN[s.lean]}</em></div>
  ${f.length?group('p',`${P_} 주장을 뒷받침`,f.filter(x=>x.side==='p'))+group('d',`${D_} 주장을 뒷받침`,f.filter(x=>x.side==='d'))+group('m','판단을 어렵게 하는 사정',f.filter(x=>x.side==='m'))+group('n','양쪽 모두 다투지 않는 사실',f.filter(x=>x.side==='n'))
   :`<p class="t4-open">${esc(tell(c,t,is.open))}</p>`}
  ${s.clash?`<p class="t4-clash">⚠ ${esc(P(s.clash.a,'과'))} ${esc(s.clash.b)}의 말이 엇갈려요. ${(t.faced||[]).includes(is.id)?'대질 신문을 마쳤어요.':sessionOpen(t)&&!waiting(t)&&!S.cases[c.id]?.verdict?'증인 탭에서 두 사람을 대질 신문할 수 있어요.':'누구 말을 믿을지가 이 쟁점의 열쇠예요.'}</p>`:''}
  ${(()=>{const back=t.heard.filter(h=>h.issue===is.id&&h.struck&&!h.tainted).length;return back?`<p class="t4-gap">⤺ 증인이 스스로 거둬들인 말 ${back}개는 판단에서 뺐어요.</p>`:''})()}
  ${todo?`<p class="t4-gap">아직 확인할 것 · ${esc(todo)}</p>`:''}</div>`}).join('')}</div>`;
}
const HELP=`<details class="t4-help"><summary>❔ 재판은 이렇게 진행돼요</summary><ol><li><b>증거</b> 탭에서 원문과 확보 경위를 읽고 <b>쓸지, 조건 붙여 쓸지, 뺄지</b> 정하세요. 불법으로 얻은 증거는 쓸 수 없어요.</li><li><b>증인</b> 탭에서 질문을 고르세요. 한 기일에 ${QPD}번까지 물을 수 있고, 답에 따라 새 질문이 열려요. 묻지 않은 질문의 답은 판결 전까지 모를 수 있어요.</li><li>기일이 열리면 상대가 이의나 연기를 신청할 때가 있어요. 대상과 이유를 읽고 받아들일지 정하세요.</li><li>정해진 횟수만큼 기일을 마치면 <b>판결</b> 탭에서 결론, 형량(배상액), 판결 이유를 정해 선고하세요.</li></ol></details>`;
function tabsFor(c,st){
 const t=st.trial4;
 if(st.verdict)return [['result','선고 이후'],['case','사건'],['log','기록']];
 const pending=waiting(t)?0:t.cards.filter(v=>!v.choice&&v.type!=='media').length,undecided=t.evidence.filter(e=>!e.decision).length,ready=t.daysDone>=t.minDays;
 return [['case','사건'],['day','기일',pending],['evidence','증거',undecided],['witness','증인'],['verdict','판결',ready?'!':0],['log','기록']];
}
function pager(kind,items,render,label){
 if(!items.length)return `<p class="muted">${label}이(가) 없습니다.</p>`;
 const key=kind==='evidence'?'t4ev':'t4w';let i=Math.max(0,Math.min(items.length-1,ui[key]||0));ui[key]=i;
 const dots=items.map((_,k)=>`<button class="t4-dot ${k===i?'on':''}" data-action="t4page" data-kind="${kind}" data-i="${k}" aria-label="${k+1}번째"></button>`).join('');
 return `<div class="t4-pager" data-kind="${kind}" data-n="${items.length}">${render(items[i])}
 <div class="t4-pagenav"><button class="t4-chip" data-action="t4page" data-kind="${kind}" data-i="${i-1}" ${i<=0?'disabled':''}>‹ 이전</button><div class="t4-dots">${dots}<span>${i+1} / ${items.length}</span></div><button class="t4-chip" data-action="t4page" data-kind="${kind}" data-i="${i+1}" ${i>=items.length-1?'disabled':''}>다음 ›</button></div></div>`;
}
/* Today's checklist: what to do in this session, in order. */
function todo(c,t){
 const pending=t.cards.filter(v=>!v.choice&&v.type!=='media').length,answered=t.cards.filter(v=>v.choice&&v.type!=='media').length;
 const decided=t.evidence.filter(e=>e.decision).length,askedToday=t.heard.filter(h=>h.day===t.day&&!h.tainted).length;
 const steps=[];
 if(!sessionOpen(t))return `<ol class="t4-todo"><li><button data-action="t4" data-kind="open">▶ ${esc(session(c,t.day))} 열기 — 상대 측 신청과 새 소식은 공판을 열면 전해져요</button></li></ol>`;
 if(pending||answered)steps.push({done:!pending,text:pending?`상대 측 신청 ${pending}건에 답하기`:'상대 측 신청에 답했어요',go:pending?'requests':'day'});
 steps.push({done:decided===t.evidence.length,text:`증거를 읽고 쓸지 정하기 · ${decided}/${t.evidence.length}`,go:'evidence'});
 steps.push({done:t.qLeft===0,text:`증인 신문 · 오늘 ${askedToday}번 물음 (남은 ${t.qLeft}번)`,go:'witness'});
 steps.push({done:false,text:t.daysDone+1>=t.minDays?`${session(c,t.day)} 마치기 → 그다음 판결할 수 있어요`:`${session(c,t.day)} 마치기 → 다음 기일 잡기`,go:'end'});
 return `<ol class="t4-todo">${steps.map(x=>`<li class="${x.done?'done':''}"><button data-action="t4go" data-go="${x.go}">${x.done?'✔':'•'} ${esc(x.text)}</button></li>`).join('')}</ol>`;
}
function dayPage(c,st){
 const t=st.trial4,wait=waiting(t),opp=NPC[t.opponent],rec=opp?.vsJudge,cur=curOf(c);
 const recent=t.log.length?`<details class="t4-log"><summary>방금 일어난 일</summary>${t.log.slice(0,5).map(l=>`<p><small>${esc(session(c,l.day))} · ${esc(l.kind)}</small> ${esc(l.text)}</p>`).join('')}</details>`:'';
 const said=(t.notices||[]).filter(n=>n.seen&&n.type==='rebut').length&&cur?.rebut?`<p class="t4-said"><b>${esc(sideWord(c,'p'))}의 반박</b> "${esc(tell(c,t,cur.rebut))}"</p>`:'';
 const heat=t.media.H>=70?'뜨거움':t.media.H>=40?'꽤 있음':'조용한 편',mood=t.media.O>20?(isCriminal(c)?'처벌을 바라는 목소리가 큼':'원고 쪽을 응원함'):t.media.O<-20?(isCriminal(c)?'피고인을 안타까워함':'피고 쪽을 응원함'):'의견이 엇갈림';
 const outside=`<p class="t4-opp">📣 법정 밖 · 관심 ${heat} · 여론 ${mood}</p>`;
 if(wait){
  const can=t.daysDone>=t.minDays;
  return `<section class="panel t4"><div class="t4-head"><h3>${esc(session(c,t.daysDone))} 끝</h3><span class="t4-tag">${t.daysDone}/${t.minDays}</span></div>
  <div class="t4-wait big"><b>${can?'⚖ 지금 판결할 수 있어요':`⏳ ${esc(session(c,t.day))} · ${esc(dlabel(Math.max(t.nextDate||0,today())))}`}</b><span>${can?`기일을 더 열고 싶다면 ${session(c,t.day)}(${dlabel(Math.max(t.nextDate||0,today()))})을 ${clock(t.nextAt)}부터 열 수 있어요.`:`현실 시각 ${clock(t.nextAt)}, ${minsLeft(t)}분 뒤에 열려요. 그동안 다른 사건을 진행하세요. 열리면 알려 드려요.`}</span>
  <div class="t4-row">${can?'<button class="btn primary mini" data-action="t4tab" data-tab="verdict">판결하러 가기</button>':''}<button class="btn outline mini" data-action="tab" data-tab="courtList">다른 사건 보기</button></div></div>
  <div class="t4-subhead"><h4>쟁점 한눈에</h4><button class="t4-link" data-action="t4tab" data-tab="log">자세히 ›</button></div>${issueView(c,t,true)}${outside}${recent}</section>`;
 }
 const act=(()=>{if(!cur?.acts?.length)return '';const i=Math.min(cur.acts.length-1,Math.floor(t.daysDone*cur.acts.length/Math.max(1,t.minDays)));const a=cur.acts[i];return `<div class="t4-act"><small>오늘의 법정 · ${esc(a.title)}</small><p>${esc(tell(c,t,a.text))}</p></div>`})();
 const opponentLine=`<div class="t4-oppcard"><span>상대 ${esc(sideWord(c,'d'))}</span>${nameBtn(t.opponent,opp?.name||'변호인')}<small>${esc(T.LABEL.style[t.style])} · ${prepWord(t.opponent)}${rec&&(rec.win+rec.lose)?` · 내 법정 ${rec.win}승 ${rec.lose}패`:''}</small></div>`;
 return `<section class="panel t4 t4-day"><div class="t4-head"><h3>${esc(session(c,t.day))}</h3><span class="t4-tag">${esc(dlabel(dateOf(t)))} · ${t.daysDone+1}/${t.minDays}회</span></div>
 ${act}
 <h4>오늘 할 일</h4>${todo(c,t)}
 ${t.cards.filter(v=>v.type==='media').map(x=>cardBlock(x,t,c)).join('')}
 ${said}
 <div class="t4-subhead"><h4>쟁점 한눈에</h4><button class="t4-link" data-action="t4tab" data-tab="log">자세히 ›</button></div>${issueView(c,t,true)}
 ${opponentLine}${outside}
 ${t.cards.some(v=>v.choice&&v.type!=='media')?`<details class="t4-more"><summary>오늘 답한 신청</summary>${t.cards.filter(v=>v.choice&&v.type!=='media').map(x=>cardBlock(x,t,c)).join('')}</details>`:''}
 ${recent}</section>`;
}
function verdictPage(c,st){
 const t=st.trial4,canVerdict=t.daysDone>=t.minDays,cur=curOf(c),v=vstate(c),crim=isCriminal(c);
 const opt=c.verdicts.find(o=>o.id===v.opt),dir=opt&&T.direction(opt,c.kind),sp=opt&&sentenceSpec(c,dir);
 const closing=cur?`<div class="t4-closing"><b>${esc(sideWord(c,'p'))} 최종 ${crim?'논고':'변론'}</b><p>"${esc(tell(c,t,cur.closing))}"</p>${crim?`<p class="small">구형: <b>${esc(demandText(c))}</b></p>`:(cur.decision?`<p class="small">신청: <b>${esc(tell(c,t,cur.decision.what))}</b></p>`:`<p class="small">청구: <b>${won(cur.claim?.amount||0)}</b> · ${esc(cur.claim?.what||'')}</p>`)}</div>
  <div class="t4-closing d"><b>${esc(sideWord(c,'d'))} 최종 변론</b><p>"${esc(tell(c,t,cur.claims?.[1]||''))}"</p></div>`:'';
 const optBtns=c.verdicts.map(o=>`<button class="choice ${v.opt===o.id?'on':''}" data-action="t4verdict" data-id="${esc(o.id)}" ${canVerdict?'':'disabled'}><span class="choice-index">${v.opt===o.id?'✔':'⚖'}</span><span><strong>${esc(plainLabel(o))}</strong><small>${esc(plainNote(o))}</small></span></button>`).join('');
 let sentence='';
 if(sp?.mode==='crim'){
  const ch=sp.ch,L=legalMonths(sp,v),types=[['prison','징역(실형)'],...(L.min<=36?[['suspend','징역(집행유예)']]:[]),...(ch.fine?[['fine','벌금']]:[]),...(ch.life?[['life','무기징역']]:[])];
  if(!types.some(x=>x[0]===v.type))v.type=types[0][0];
  const ref=sp.ref.kind==='fine'?`벌금 ${won(sp.ref.lo)}~${won(sp.ref.hi)}`:`징역 ${ym(sp.ref.lo)}~${ym(sp.ref.hi)}`;
  sentence=`<h4>2. 형 정하기</h4><p class="small">${esc(ch.name)} · ${esc(ch.law)} · 법정형 ${ch.min?`징역 ${ch.min}년 이상 `:''}${ch.max}년 이하${ch.fine?` 또는 벌금 ${won(ch.fine)} 이하`:''}${ch.life?', 무기징역 가능':''}</p>
  <p class="small">검사 구형 <b>${esc(demandText(c))}</b> · 참고 범위 <b>${ref}</b><br><span class="muted">참고 범위는 구형의 ±20%를 단순 계산한 값입니다. 법정형 안에서 자유롭게 정할 수 있어요.${L.reduced?' 감경 사유를 골라 법정형 하한의 절반까지 내릴 수 있어요.':''}</span></p>
  <div class="t4-seg">${types.map(([k,l])=>`<button class="t4-chip ${v.type===k?'on':''}" data-action="t4v" data-k="type" data-v="${k}">${l}</button>`).join('')}</div>
  ${v.type==='prison'||v.type==='suspend'?`<div class="t4-step"><span>징역</span><button class="t4-chip" data-action="t4v" data-k="months" data-v="-12">−1년</button><button class="t4-chip" data-action="t4v" data-k="months" data-v="-3">−3개월</button><b>${ym(v.months||12)}</b><button class="t4-chip" data-action="t4v" data-k="months" data-v="3">+3개월</button><button class="t4-chip" data-action="t4v" data-k="months" data-v="12">+1년</button></div>
   ${v.type==='suspend'?`<div class="t4-step"><span>집행유예</span><button class="t4-chip" data-action="t4v" data-k="susp" data-v="-1">−</button><b>${v.susp||2}년</b><button class="t4-chip" data-action="t4v" data-k="susp" data-v="1">+</button><small class="muted">징역 3년 이하일 때만 가능</small></div>`:''}
   <p class="muted small">선택 가능 범위: ${ym(L.min)} ~ ${ym(v.type==='suspend'?Math.min(36,L.max):L.max)}</p>`:''}
  ${v.type==='fine'?`<div class="t4-step"><span>벌금</span><button class="t4-chip" data-action="t4v" data-k="fine" data-v="-500">−500</button><button class="t4-chip" data-action="t4v" data-k="fine" data-v="-50">−50</button><b>${won(v.fine||100)}</b><button class="t4-chip" data-action="t4v" data-k="fine" data-v="50">+50</button><button class="t4-chip" data-action="t4v" data-k="fine" data-v="500">+500</button></div>`:''}
  <p class="t4-ask-head">양형 사유</p><div class="t4-seg wrap">${CRIM_FACTORS.map(([k,l,d])=>`<button class="t4-chip ${v.factors.includes(k)?'on':''} ${d<0?'mit':'agg'}" data-action="t4v" data-k="factor" data-v="${k}">${d<0?'↓':'↑'} ${l}</button>`).join('')}</div>`;
 }else if(sp?.mode==='civil'){
  sentence=`<h4>2. 배상액 정하기</h4><p class="small">원고 청구 <b>${won(sp.cl.amount)}</b> · ${esc(sp.cl.what)}${sp.full?'':`<br>입증된 손해의 참고 범위 <b>${won(sp.ref.lo)}~${won(sp.ref.hi)}</b>`}</p>
  ${sp.full?`<p class="small">전부 인용: <b>${won(sp.cl.amount)}</b> 지급</p>`:`<div class="t4-step"><span>배상액</span><button class="t4-chip" data-action="t4v" data-k="amount" data-v="-4">−−</button><button class="t4-chip" data-action="t4v" data-k="amount" data-v="-1">−</button><b>${won(v.amount||0)}</b><button class="t4-chip" data-action="t4v" data-k="amount" data-v="1">+</button><button class="t4-chip" data-action="t4v" data-k="amount" data-v="4">++</button></div>`}
  <p class="t4-ask-head">판단 사유</p><div class="t4-seg wrap">${CIVIL_FACTORS.map(([k,l,d])=>`<button class="t4-chip ${v.factors.includes(k)?'on':''} ${d<0?'mit':'agg'}" data-action="t4v" data-k="factor" data-v="${k}">${d<0?'↓':'↑'} ${l}</button>`).join('')}</div>`;
 }
 const items=citables(c,t);
 const cites=opt?`<h4>${sp?'3':'2'}. 판결 이유 (1~3개)</h4><p class="muted small">판결문에 근거로 적을 증거와 증언을 고르세요. 쓰기로 정한 증거와 법정에서 들은 증언만 고를 수 있어요.</p>
  ${items.length?items.map(i=>`<button class="t4-cite ${v.cites.includes(i.key)?'on':''}" data-action="t4v" data-k="cite" data-v="${esc(i.key)}"><b>${v.cites.includes(i.key)?'☑':'☐'} ${esc(i.label)}</b>${i.text?`<small>${esc(short(i.text,70))}</small>`:''}</button>`).join(''):'<p class="notice">쓰기로 정한 증거나 들은 증언이 없습니다. 증거 탭과 증인 탭을 먼저 확인하세요.</p>'}
  <button class="btn primary full mt" data-action="t4confirm" ${v.cites.length&&canVerdict?'':'disabled'}>선고하기</button>`:'';
 return `<section class="panel t4 t4-verdict"><h3>⚖ 판결</h3>${canVerdict?'':`<p class="notice">기일이 ${t.minDays-t.daysDone}번 더 필요해요.${waiting(t)?` ${esc(session(c,t.day))}은 ${esc(dlabel(Math.max(t.nextDate||0,today())))}에 열려요.`:''}</p>`}
 ${closing}<h4>재판 현황</h4>${issueView(c,t)}
 <h4>1. 결론</h4>${optBtns}${sentence}${cites}</section>`;
}
function dock(c,st){
 const t=st.trial4;if(st.verdict)return '';
 const wait=waiting(t),pending=t.cards.filter(v=>!v.choice&&v.type!=='media').length,moreDays=!isDecision(c)&&t.daysDone<t.minDays+EXTRA_DAYS;
 if(wait&&t.daysDone>=t.minDays)return `<div class="t4-dock"><span class="small">기일 더 열기: ${clock(t.nextAt)}부터</span><button class="btn primary" data-action="t4tab" data-tab="verdict">판결하러 가기</button></div>`;
 if(!wait&&!sessionOpen(t))return `<div class="t4-dock"><span class="small">${esc(session(c,t.day))} · ${esc(dlabel(dateOf(t)))}</span><button class="btn primary" data-action="t4" data-kind="open">▶ ${esc(session(c,t.day))} 열기</button></div>`;
 if(wait)return `<div class="t4-dock"><span>⏳ ${esc(session(c,t.day))} · ${clock(t.nextAt)} (${minsLeft(t)}분 뒤)</span><button class="btn outline mini" data-action="tab" data-tab="courtList">다른 사건</button></div>`;
 const main=pending?`<button class="btn primary" data-action="t4go" data-go="requests">상대 신청 ${pending}건 답하기</button>`
  :(moreDays||t.daysDone<t.minDays)?`<button class="btn primary" data-action="t4end">${t.daysDone>=t.minDays?'기일 더 열기':`${session(c,t.day)} 마치기`}</button>`
  :`<button class="btn primary" data-action="t4tab" data-tab="verdict">판결하러 가기</button>`;
 return `<div class="t4-dock"><span class="small">신문 ${t.qLeft}/${t.qpd||QPD}</span>${t.daysDone>=t.minDays&&moreDays&&!pending?`<button class="btn outline" data-action="t4tab" data-tab="verdict">판결</button>`:''}${main}</div>`;
}
function judgmentView(j){
 if(!j)return '';
 return `<div class="t4-judgment"><h4>📜 판결문</h4><p class="t4-order"><b>주문</b> ${esc(j.order)}</p>
 <p><b>1. 인정 사실</b></p><ul>${j.facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>
 ${j.excluded.length?`<p><b>판단에서 뺀 자료</b></p><ul>${j.excluded.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:''}
 <p><b>2. 쟁점별 판단</b></p>${j.issues.map(i=>`<p class="small"><b>${esc(i.title)}</b> — ${esc(i.text)}</p>`).join('')}
 <p><b>3. 결론${j.conclusion.includes('선고')||j.conclusion.includes('인정한다')?'과 양형':''}</b></p><p class="small">${esc(j.conclusion)}</p></div>`;
}
function resultPanel(c,st){
 const t=st.trial4,f=t?.final;if(!f)return '';
 const reviewed=f.reviewShown||now()>=f.reviewAt,dk=f.desk;
 const groups={anger:'분노',sympathy:'동정',cynic:'냉소',legal:'법리 옹호',flaw:'법리 옹호'};
 const comments=(f.sns||[]).map(x=>`<div class="t4-sns ${x.pol==='+'?'pos':x.pol==='-'||x.pol==='?'?'neg':''}"><b>${esc(x.nick)}</b>${x.cluster?` <span class="t4-tag">${groups[x.cluster]||''}</span>`:''}<p>${esc(x.text)}</p><small>▲ ${x.likes}</small>${x.reply?`<div class="t4-reply">↳ <b>${esc(x.reply.nick)}</b> ${esc(x.reply.text)}</div>`:''}</div>`).join('');
 return `<section class="panel t4"><h3>📰 선고 이후</h3>
 <div class="t4-stats"><span>판결 실력 <b>${f.skill}</b></span><span>여론과 맞은 정도 <b>${f.match}</b></span><span>판결 리뷰 <b>${reviewed?f.review:'공개 전'}</b></span></div>
 ${reviewed?`<p class="small">${f.evaluators.map(e=>`${esc(e.name)} ${e.score}점`).join(' · ')}</p>`:`<p class="muted small">판결 리뷰는 ${Math.max(1,Math.ceil((f.reviewAt-now())/HOUR))}시간 뒤 공개됩니다.</p>`}
 ${window.VerdictV6?.truthPanel?.(c,t)||''}${judgmentView(f.judgment)}
 <details class="t4-log" open><summary>내 판단 채점 · 재판 중 결정이 맞았는지</summary>${f.items.map(i=>`<p>${i.points>0?'+':''}${i.points} · ${esc(i.text)}</p>`).join('')||'<p>가감 항목 없음</p>'}</details>
 ${dk?`<h4>📋 판결 요약</h4><div class="t4-summary">${dk.summary.map(l=>`<div>${esc(l)}</div>`).join('')}</div>
 <article class="t4-article"><small>${esc(dk.column.outlet)} · ${esc(dk.column.desk)} · ${esc(dk.column.writer)}</small><h4>${esc(dk.column.title)}</h4><p>${esc(dk.column.body)}</p></article>
 <article class="t4-article beat"><small>${esc(dk.beat.outlet)} · ${esc(dk.beat.desk)} · ${esc(dk.beat.writer)} 기자</small><h4>${esc(dk.beat.title)}</h4><p>${esc(dk.beat.body)}</p></article>`:''}
 ${f.headlines?.length?`<h4>다른 매체</h4>${f.headlines.map(x=>`<p class="t4-headline"><small>${esc(x.outlet)} · ${esc(x.name)} 기자 (${esc(x.label)})</small><br>${esc(x.text)}</p>`).join('')}`:''}
 ${f.ending?`<div class="t4-act"><small>그 후</small><p>${esc(f.ending)}</p></div>`:''}
 <h4>💬 시민광장${dk?` · <span class="t4-mode ${dk.community.mode}">${esc(dk.community.label)}</span>`:''}</h4>${comments}
 ${dk?.narratives?.length?`<h4>언론이 주목하는 흐름</h4>${dk.narratives.map(n=>`<p class="t4-narr l${n.level}">${esc(n.text)}</p>`).join('')}`:''}</section>`;
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
 if(status&&t)status.innerHTML=st.verdict?`<span>선고 완료</span><span>기일 ${t.daysDone}회</span>`:`<span>${esc(stage(c,st).short)}</span><span>기일 ${t.daysDone}/${t.minDays}</span><span>중요도 ${c.importance}</span>`;
 const crim=isCriminal(c),who=c.who||[];
 const facts=[[crim?'피고인':'원고',NPC[who[crim?0:0]]?.name],[crim?'피해자':'피고',NPC[who[1]]?.name],['분류',c.tag],['상대 변호사',t?NPC[t.opponent]?.name:null],[crim?'죄명':'청구',crim?(chargeOf(c)?`${chargeOf(c).name} (${chargeOf(c).law})`:null):(claimOf(c)?`${won(claimOf(c).amount)} · ${claimOf(c).what}`:null)],[isDecision(c)?'신청':null,isDecision(c)?tell(c,t,curOf(c).decision.what):null],[isDecision(c)?'진행':'최소 기일',t?(isDecision(c)?'심리기일 1회 뒤 바로 결정':t.minDays+'회'):null],['증거·증인',t?`증거 ${t.evidence.length}건 · 증인 ${t.witnesses.length}명`:null]].filter(v=>v[1]);
 const cur=curOf(c),crimRole=isCriminal(c);
 const people=cur?`<h4>사람들</h4><div class="t4-people">
  <div class="t4-person">${nameBtn(who[0])}<span class="t4-tag">${crimRole?'피고인':'원고'}</span><p>${esc(tell(c,t,cur.people.A))}</p></div>
  <div class="t4-person">${nameBtn(who[1])}<span class="t4-tag">${crimRole?'피해자':'피고'}</span><p>${esc(tell(c,t,cur.people.B))}</p></div>
  ${(t?.witnesses||[]).map(w=>`<div class="t4-person">${nameBtn(w.id)}<span class="t4-tag">증인 · ${esc(w.role)}</span>${w.story?`<p>${esc(w.story)}</p>`:''}</div>`).join('')}</div>`:'';
 const claims=cur?`<h4>양측의 주장</h4><div class="t4-claims"><p><b>${crimRole?'검찰':'원고'}</b> ${esc(tell(c,t,cur.claims[0]))}</p><p><b>${crimRole?'변호인':'피고'}</b> ${esc(tell(c,t,cur.claims[1]))}</p></div>`:'';
 const casePage=`<section class="panel t4 t4-case"><h3>무슨 사건인가?</h3>${!completed().length&&!st.verdict&&!(t?.daysDone)?HELP:''}${cur?`<p class="t4-logline">${esc(tell(c,t,cur.logline))}</p><p>${esc(tell(c,t,cur.summary))}</p>`:(overviewHtml||`<p>${esc(c.sub||'')}</p>`)}
  <dl class="t4-facts">${facts.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
  ${cur?claims+people:(argsHtml?`<details class="t4-more"><summary>검사·변호인 주장 자세히 보기</summary><div>${argsHtml}</div></details>`:'')}
  ${!st.verdict&&t?(waiting(t)?`<button class="btn primary full mt" data-action="t4tab" data-tab="day">재판으로 돌아가기 →</button>`:!sessionOpen(t)?`<button class="btn primary full mt" data-action="t4" data-kind="open">▶ ${esc(session(c,t.day))} 열기</button>${!t.daysDone?`<button class="btn outline full mt" data-action="t4" data-kind="handoff">다른 재판부로 넘기기 <small>(하루 1건)</small></button>`:''}`:`<button class="btn primary full mt" data-action="t4tab" data-tab="day">재판으로 돌아가기 →</button>`):''}</section>`;
 const logPage=`<section class="panel t4"><h3>📋 재판 기록 요약</h3>${window.VerdictV6?.officerName?.()?`<p class="muted small">기록 정리 · 참여관 ${esc(window.VerdictV6.officerName())}</p>`:''}${t?recordSummary(c,t):'<p class="muted">아직 기록이 없습니다.</p>'}
  ${t?.log?.length?`<details class="t4-more"><summary>전체 기록 ${t.log.length}건</summary>${t.log.map(l=>`<p class="small"><b>${esc(session(c,l.day))} · ${esc(l.kind)}</b> ${esc(l.text)}</p>`).join('')}</details>`:''}</section>`;
 let page='';
 const wait=t&&waiting(t);
 if(ui.t4tab==='case')page=casePage;
 else if(ui.t4tab==='log')page=logPage;
 else if(ui.t4tab==='result')page=resultPanel(c,st);
 else if(ui.t4tab==='day')page=dayPage(c,st);
 else if(ui.t4tab==='evidence'){const done=t.evidence.filter(e=>e.decision).length;page=`<section class="panel t4"><div class="t4-head"><h3>증거</h3><span class="t4-tag">결정 ${done}/${t.evidence.length}</span></div>${pager('evidence',t.evidence,e=>evidenceCard(e,t,wait,c),'증거')}</section>`}
 else if(ui.t4tab==='witness')page=`<section class="panel t4"><div class="t4-head"><h3>증인</h3><span class="t4-tag">오늘 남은 신문 ${t.qLeft}/${t.qpd||QPD}</span></div>${faceList(c,t,wait||!sessionOpen(t))}${pager('witness',t.witnesses,w=>witnessCard(w,t,wait,c),'증인')}</section>`;
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
render=function(){priorRender();document.body.classList.toggle('t4-court',ui.tab==='court');if(ui.tab==='courtList')document.querySelectorAll('.bottom-nav [data-tab="court"],.nav-stack [data-tab="court"]').forEach(b=>b.classList.add('active'));if(ui.tab==='court'&&ui.t4tab&&ui.t4tab!=='case'&&!ui.modal)setTimeout(()=>{if(!ui.modal&&ui.tab==='court'&&!askRequests(false))askNotices(false)},0)};

/* Case list: plain words and the v4 trial-day counter. */
if(typeof courtList==='function'){
 const priorList=courtList;
 courtList=function(){
  let html=priorList();
  if(window.VerdictDockPanel){const k=html.indexOf('</h1>');if(k>0){const e=html.indexOf('</div></div>',k);const at=e>0?e+12:k+5;html=html.slice(0,at)+'<div class="mt">'+window.VerdictDockPanel()+'</div>'+html.slice(at)}}
  html=html.replace('접수된 사건을 확인하고 이번 주 심리할 사건을 선택하세요.','맡은 사건을 골라 재판을 이어가세요.')
   .replace(/<div class="stat-card"><label>금주 심리 여력<\/label><strong>[^<]*<\/strong><\/div>/,`<div class="stat-card"><label>판결 리뷰 평균</label><strong>${(()=>{const r=desk().reviews;return r.length?Math.round(r.reduce((a,x)=>a+x.review,0)/r.length)+'점':'-'})()}</strong></div>`)
   .replace(/시간을 진행해 보세요\./,'새 사건은 매일 10시~22시에 들어옵니다.')
   .replace(/가상 시간이 진행되면/,'시간이 흐르면');
  return html.replace(/data-id="([^"]+)"([\s\S]*?)심리 \d\/3/g,(m,id,mid)=>{const c=CASES.find(x=>x.id===id),st=S.cases[id],t=st?.trial4,g=c&&stage(c,st);return `data-id="${id}"${mid}<span class="t4-st ${g?.k||''}">${esc(g?.text||'재판 전')}</span>${t?` · 기일 ${t.daysDone}/${t.minDays}`:''}`});
 };
}

/* ---------- clicks ---------- */
const priorClick=clicker;
clicker=function(e){
 const el=e.target.closest('[data-action]');
 const a=el?.dataset.action;
 if(a==='t4'){e.preventDefault();act(el.dataset.kind,el.dataset.id,el.dataset.choice);return}
 if(a==='t4end'){e.preventDefault();endDay();return}
 if(a==='tab'&&el.dataset.tab==='court'&&el.closest('.bottom-nav,.nav-stack')){e.preventDefault();changeTab('courtList');return}
 if(a==='t4go'){e.preventDefault();const go=el.dataset.go;if(go==='requests'){askRequests(true);return}ui.modal=null;if(go==='end'){endDay();return}ui.t4tab=go;render();window.scrollTo({top:0,behavior:'instant'});return}
 if(a==='t4tab'){e.preventDefault();ui.t4tab=el.dataset.tab;render();window.scrollTo({top:0,behavior:'instant'});return}
 if(a==='t4page'){e.preventDefault();const key=el.dataset.kind==='evidence'?'t4ev':'t4w';ui[key]=Number(el.dataset.i)||0;render();return}
 if(a==='t4verdict'){e.preventDefault();askVerdict(el.dataset.id);return}
 if(a==='t4v'){e.preventDefault();const x=current();if(x)tweak(x.c,el.dataset.k,el.dataset.v);return}
 if(a==='t4confirm'){e.preventDefault();confirmVerdict();return}
 if(a==='verdict'||a==='courtStep'||a==='livePostpone'){e.preventDefault();return}
 return priorClick(e);
};

/* ---------- person cards: anyone named in court opens their card ---------- */
function nameBtn(id,fallback=''){const p=NPC[id];return p?`<button class="t4-name t4-who" data-action="npc" data-id="${esc(id)}">${esc(p.name)}<i>›</i></button>`:`<b>${esc(fallback)}</b>`}
const STYLE_NOTE={aggressive:'몰아붙이는 신문과 잦은 이의 제기로 흐름을 가져가려 한다.',delay:'기일 연기와 추가 신청으로 시간을 끄는 편이다.',meticulous:'증거 하나하나의 수집 경위를 따지는 꼼꼼한 스타일이다.',media:'법정 밖 여론과 기사까지 계산해서 움직인다.',none:''};
/* What this person has been and said in my courtroom, case by case. */
function courtRecord(id){
 const out=[];
 for(const c of CASES){const st=S.cases[c.id],t=st?.trial4;if(!t)continue;
  const crim=isCriminal(c),wi=(t.witnesses||[]).findIndex(w=>w.id===id);
  let role=null;
  if(c.who?.[0]===id)role=crim?'피고인':'원고';else if(c.who?.[1]===id)role=crim?'피해자':'피고';
  else if(t.opponent===id)role=crim?'변호인':'피고 대리인';else if(c.side?.[0]===id)role=crim?'검사':'원고 대리인';
  else if(wi>=0)role='증인 · '+(t.witnesses[wi].role||'');
  if(!role)continue;
  const cur=curOf(c),lines=[];
  if(cur&&(c.who?.[0]===id||c.who?.[1]===id)){const k=c.who[0]===id?'A':'B';if(cur.people?.[k])lines.push(`<p>${esc(tell(c,t,cur.people[k]))}</p>`)}
  if(wi>=0){const w=t.witnesses[wi];if(w.story)lines.push(`<p>${esc(w.story)}</p>`);
   const qa=(w.askedIds||[]).map(qid=>{const q=(wDetail(c,wi)?.q||[]).find(v=>v.id===qid);return q?`<p class="t4-said">“${esc(answerOf(c,t,wi,q).text)}”</p>`:''}).filter(Boolean);
   lines.push(qa.length?`<p class="muted small">법정에서 한 말</p>${qa.slice(-4).join('')}`:'<p class="muted small">아직 증언대에 서지 않았습니다.</p>')}
  if(t.opponent===id){const r=NPC[id]?.vsJudge;lines.push(`<p>${esc(T.LABEL.style[t.style]||'')} — ${esc(STYLE_NOTE[t.style]||'')}</p>`);if(r&&(r.win+r.lose))lines.push(`<p class="muted small">내 법정 전적 ${r.win}승 ${r.lose}패</p>`)}
  out.push(`<div class="t4-rec"><b>${esc(shortName(c))}</b> <span class="t4-tag">${esc(role)}</span>${st.verdict?' <span class="muted small">· 선고됨</span>':''}${lines.join('')}</div>`);
 }
 return out.slice(0,3).join('');
}
function addToModal(html){if(!html||!ui.modal)return;const k=ui.modal.lastIndexOf('<div class="modal-actions">');if(k<0)return;
 const end=ui.modal.lastIndexOf('</div>',k);ui.modal=ui.modal.slice(0,end)+html+ui.modal.slice(end);render()}
const priorPopup=popupNPC;
popupNPC=function(id){priorPopup(id);const rec=courtRecord(id);if(rec)addToModal(`<h4>⚖ 내 법정에서</h4><div class="t4-recs">${rec}</div>`)};

/* ---------- heartbeat ---------- */
function opened(){
 let any=null;
 for(const c of CASES){const st=S.cases[c.id],t=st?.trial4;if(!t||st.verdict||!t.nextAt||waiting(t)||t.openedSeen===t.day)continue;
  t.openedSeen=t.day;if(t.daysDone<t.minDays+EXTRA_DAYS)any=any||c}
 if(any)toast(`🔔 ${shortName(any)} · ${session(any,S.cases[any.id].trial4.day)}이 열렸어요`);
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

window.VerdictTrialPlay={ensure,tick,stage,REPORTERS,session,curOf,tell,openSession,dlabel,addToModal};
})();
