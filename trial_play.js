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
const archId=c=>c?.contentPack?.archetypeId||c?.story?.packOrigin?.id;
/* v8.2.3: the courtroom detail of a case is fetched when the case is assigned or opened (case-data/). Until it has
 * arrived the case reads as not-yet-ready: curOf gives null and the court screen shows a short loading line, so no
 * trial is ever built from the index alone. Cases already in the save are fetched at start. */
const VC_=()=>window.VerdictCurated;
const caseReady=c=>{const id=archId(c),V=VC_();return !V?.cases[id]||!V.isLoaded||V.isLoaded(id)};
const curOf=c=>{const id=archId(c),V=VC_(),x=V?.cases[id];return x&&(!V.isLoaded||V.isLoaded(id))?x:null};
let preloading=false;
function preloadSave(){
 const V=VC_();if(!V?.lazy||typeof S==='undefined'||!S.cases||preloading)return;
 const ids=(typeof CASES!=='undefined'?CASES:[]).filter(c=>S.cases[c.id]).map(archId).filter(id=>id&&V.cases[id]&&!V.isLoaded(id));
 if(!ids.length)return;preloading=true;
 V.loadMany(ids).finally(()=>{preloading=false;if(!ui.modal)render()});
}
function namesOf(c,t){
 const n={A:NPC[c.who?.[0]]?.name,B:NPC[c.who?.[1]]?.name,L:t?NPC[t.opponent]?.name:null,_seed:c.id};   // _seed: made-up place names stay fixed per case
 (t?.witnesses||[]).forEach((w,i)=>{n['W'+(i+1)]=NPC[w.id]?.name});
 const sx=id=>NPC[id]?.gender?(/여/.test(NPC[id].gender)?'여':'남'):null;
 n._sex={A:sx(c.who?.[0]),B:sx(c.who?.[1]),L:t?sx(t.opponent):null};(t?.witnesses||[]).forEach((w,i)=>{n._sex['W'+(i+1)]=sx(w.id)});
 return n;
}
/* written text may hold one value per truth ({did, didnt, reason}: cases made from world sheets) */
const byTruth=(c,t,x)=>x&&typeof x==='object'&&!Array.isArray(x)&&('did' in x||'didnt' in x)?(x[(t||S.cases[c.id]?.trial4)?.truth||'reason']??x.reason??x.did):x;
const tell=(c,t,text)=>{text=byTruth(c,t,text);return window.VerdictCurated?window.VerdictCurated.fill(text,namesOf(c,t)):String(text||'')};
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
function evDetail(c,e){if(e?.detail)return e.detail;const cur=curOf(c);if(!cur)return null;const i=Number(String(e.id).slice(1));return e.late?cur.late:cur.evidence?.[i]||null}
function wDetail(c,i){const tw=S.cases[c.id]?.trial4?.witnesses?.[i];if(tw?.detail)return tw.detail;return curOf(c)?.witnesses?.[i]||null}
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
function fixSex(c){const s=curOf(c)?.sex;if(!s||!c.who||c.sexFixed===2)return;
 if(c.sexFixed&&S.cases[c.id]?.trial4)return;   // v8.5.2: a case not yet opened is checked again (sex-crime rule); a trial in progress keeps its people
 c.sexFixed=2;
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
const WITNESS_FLOOR=[[/퇴직금|은퇴|정년|노부부/,58],[/교수/,40],[/주치의|전문의|의사|부검의|원장/,34],[/부장|회장|대표|시설장|이장|편집국/,42],[/과장|팀장|차장|반장|감정인|감식관|조사관|예보관|지휘관|책임자/,35]];
function witnessFloor(role,txt){let f=0;for(const [re,n] of WITNESS_FLOOR)if(re.test(re===WITNESS_FLOOR[0][0]?txt:role))f=Math.max(f,n);return f}
window.VerdictWitnessFloor=witnessFloor;
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
 /* job floors: a doctor, professor, manager or retiree cannot be in their twenties, whatever else applied */
 const floor=witnessFloor(role,txt);
 if(floor){r=r?[Math.max(r[0],floor),Math.max(r[1],floor+12)]:[floor,floor+22]}
 if(r&&r.every(Number.isFinite))setAge(c,id,r[0],r[1]);
 if(!/의 |배우자|동생|자녀|둘째|할머니|할아버지|친구/.test(role))setJob(p,role);
 sanityDegree(p,role)}
/* ---------- v8.6.3 family ties the story states ----------
 * Siblings in a story share the family surname and the same parents; a child carries the father's surname.
 * KIN lists the cases whose two parties are family; sibling and child witnesses are found by their role.
 * The family graph (family_engine.js) reads siblingOf / parentNpc / parentDead when it builds relatives. */
const KIN={'inherit-family-records':{AB:'sib',dead:'father',only:true},'v6-family-guardian-signature':{AB:'sib',only:true,alive:'father'},'beta-homicide-010':{AB:'childOf'}};
const surOf=p=>VerdictNames.split(p?.name||'')[0];
function setSurname(c,id,sur){const p=NPC[id];if(!p||!sur||surOf(p)===sur)return;const old=p.name;
 p.name=VerdictNames.make({gender:p.gender,bornYear:p.bornYear,rand,people:NPC,surname:sur});swapName(c,p,old)}
function tieSibling(id,to){const p=NPC[id],q=NPC[to];if(!p||!q||id===to)return;p.siblingOf=to;p.id??=id;q.id??=to;
 if(p.familyGraphVersion||q.familyGraphVersion)window.FamilyEngine?.link?.(p,q,'sibling')}
function fixKin(c){const k=KIN[archId(c)];if(!k||!c.who||c.kinFixed)return;c.kinFixed=true;
 const [a,b]=c.who,A=NPC[a],B=NPC[b];if(!A||!B)return;
 if(k.AB==='sib'){setSurname(c,b,surOf(A));tieSibling(b,a)}
 else if(k.AB==='childOf'){if(!isF(B))setSurname(c,a,surOf(B));A.parentNpc=b;A.parentIds=[b];if(isF(B))B.childSurname=surOf(A);A.id??=a;B.id??=b;if(B.children)B.children=Math.max(0,B.children-1);if(A.familyGraphVersion)window.FamilyEngine?.link?.(A,B,'parent')}
 if(k.dead)A.parentDead=k.dead;if(k.alive)A.parentAlive=k.alive;if(k.only)A.noExtraSiblings=true}
/* a witness who is a party's sibling (or child of a male party) gets that family's surname and joins the family */
function witnessKin(c,id,role){if(!c.who)return;const main=String(role||'').replace(/\([^)]*\)/g,'').trim();
 const sib=/형제|자매|남매|동생|언니|오빠|누나|^둘째$|^첫째$|손위|^형$/.test(main)&&!/친구|동료|후배|선배/.test(main),child=/자녀|아들|딸/.test(main)&&!/의 (친구|동료)/.test(main);
 if(!sib&&!child)return;
 const crim=isCriminal(c),tok=main.match(/\{([AB])/),ref=tok?c.who[tok[1]==='A'?0:1]:/피고인/.test(main)?c.who[0]:/피해자/.test(main)?c.who[crim?1:0]:/원고/.test(main)?c.who[0]:/피고/.test(main)?c.who[1]:c.who[0];
 const R=NPC[ref];if(!R)return;
 if(sib){setSurname(c,id,surOf(R));tieSibling(id,ref)}
 else if(!isF(R)){setSurname(c,id,surOf(R));const p=NPC[id];if(p)p.parentNpc=ref}}
window.VerdictSex={fix:c=>{fixSex(c);fixProfile(c);decisionVerdicts(c);window.VerdictMatchPlay?.fixParties(c);fixKin(c)}};

/* ---------- v6: people shape the trial ----------
 * A witness's attitude, reliability and memory come from who they are (honesty, stress control, impulsivity,
 * conscientiousness, empathy, age) and what this case puts at stake for them (a friend or relative on trial,
 * a job, fear of reprisal). The case seed only adds a little noise, so the same person stays recognisable
 * across cases and the same seed always gives the same result. The hidden truth is never changed. */
function stakeText(c,i){const w=wDetail(c,i);return [w?.stake,w?.story,w?.role].join(' ')}
function behaviour(c,i,w,seed){
 const p=NPC[w.id];if(!p)return;
 const r=T.attitudeOf({traits:p.traits||{},age:ageOf(p)||40,stake:stakeText(c,i)},seed+':'+i);
 w.attitude=r.attitude;w.reliability=r.reliability;w.memory=r.memory;w.because=r.because;
}
/* The other side's lawyer: how often their objections are sound depends on skill, not just style. */
function lawyerSkill(id){const lc=NPC[id]?.legalCareer;return lc?Math.round((lc.trialSkill+lc.evidenceSkill)/2):55}
function skilled(c,t,cards,day){
 const sk=lawyerSkill(t.opponent);
 for(const cd of cards){if(cd.skillSet||cd.type!=='objection')continue;cd.skillSet=true;cd.valid=T.objectionValid(sk,t.style,t.seed+':ov:'+day+':'+cd.id)}
 return cards;
}
const prepWord=id=>{const s=lawyerSkill(id);return s>=78?'준비가 철저함':s>=60?'준비가 꼼꼼한 편':s>=45?'준비가 보통':'준비가 허술한 편'};

function ensure(c,st){
 window.VerdictMatchPlay?.reset(st);   // a v8.0 match-screen trial without a verdict restarts in this courtroom
 if(st.trial4)return upgrade(c,st.trial4);
 fixSex(c);fixProfile(c);decisionVerdicts(c);window.VerdictMatchPlay?.fixParties(c);fixKin(c);
 const seed=c.id+':'+(S.rng||1);
 const strictCase=!!curOf(c);
 const witnesses=window.VerdictMatchPlay?.witnesses(c)||witnessSeeds(c).map((w,i)=>{
  let id=w.existing;
  const ex=!id&&strictCase?window.VerdictV6?.expertFor?.(w.role,c):null;
  if(ex){id=ex.id;remember(id,'관련 사건',c.name+'의 증인으로 다시 출석 ('+w.role+')',c.id)}
  if(!id){id=freshNPC(w.role,S.caseSerial||1,c.story?.deep?.key||c.contentPack?.category||'contract');NPC[id].role=w.role;NPC[id].caseWitnessRole=w.role;
   if(w.story){NPC[id].backstory=w.story;NPC[id].bond=w.interest||NPC[id].bond}
   const g0=NPC[id].gender;
   if(/할머니|어머니|딸|누나|언니|아내/.test(w.role))NPC[id].gender='여';else if(/할아버지|아버지|아들|형|오빠|남편/.test(w.role)&&!/형제/.test(w.role))NPC[id].gender='남';
   if(NPC[id].gender!==g0)NPC[id].name=VerdictNames.make({gender:NPC[id].gender,bornYear:NPC[id].bornYear,rand,people:NPC});
   witnessSex(c,i,id);witnessProfile(c,i,id);witnessKin(c,id,wDetail(c,i)?.role);window.VerdictV6?.registerExpert?.(id,w.role,c);
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
/* Written cases rolled before v6.0.1 could have had their first evidence's hidden flaw rotated on a repeat. Bring any
 * unfinished trial back in line with the text the player reads; finished verdicts keep their record as scored. */
function syncFlaws(c,t){
 if(!curOf(c)||t.final||t.flawSynced)return;t.flawSynced=true;
 for(const e of t.evidence){const want=evDetail(c,e)?.flaw||(e.late?curOf(c)?.late?.flaw:null);if(!want||e.flawType===want)continue;
  e.flawType=want;if(want==='none'){e.flaw=0;e.surface=e.strength}else{e.flaw=Math.max(e.flaw||0,40);e.surface=Math.max(e.surface||0,e.strength)}
  if(want==='none')e.publicFlaw=false}
}
function upgrade(c,t){
 syncFlaws(c,t);
 if(t.v>=5){t.dates??={};t.nextDate??=today();return t}
 t.v=5;t.heard??=[];t.notices??=[];t.qLeft=QPD;t.qpd=QPD;delete t.energy;t.dates??={};t.nextDate??=today();
 if(curOf(c))t.evidence.forEach(e=>{e.revealed=2});
 t.witnesses.forEach(w=>{w.askedIds??=[];w.opened??=[]});
 t.cards=dressCards(c,t,t.cards||[]);
 return t;
}
/* Questions this witness can be asked now: open ones plus those unlocked by an earlier answer. */
/* Every question a witness can be asked: the written ones plus questions a judge's order opened later
 * (follow-up node `recall`, ids prefixed with the node id so they never clash with the written ones). */
function allQ(c,t,i){
 const d=wDetail(c,i),w=t.witnesses[i];if(!w)return [];
 const fu=curOf(c)?.followUps||[];
 const extra=(w.extra||[]).flatMap(fid=>{const f=fu.find(x=>x.id===fid);return (f?.recall?.q||[]).map(q=>({...q,id:fid+'.'+q.id,next:(q.next||[]).map(n=>fid+'.'+n),hidden:!!q.hidden,ordered:fid}))});
 return [...(d?.q||[]),...extra];
}
const qById=(c,t,i,id)=>allQ(c,t,i).find(v=>v.id===id);
function questionsOf(c,t,i){
 const w=t.witnesses[i];if(!w)return [];
 return allQ(c,t,i).filter(q=>q.needs?needsMet(t,q.needs):!q.hidden||(w.opened||[]).includes(q.id));
}
/* v8.3: a case's own question that opens only after a record has arrived or another answer was heard */
function needsMet(t,n){
 if(n.follow)return t.evidence.some(e=>e.follow===n.follow)||(t.courtOrders||[]).some(o=>o.follow===n.follow&&(o.outcome==='done'||o.outcome==='partial'));
 if(n.heard)return t.heard.some(h=>h.w===n.heard[0]&&h.q===n.heard[1]);
 return true;
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
/* v8.4: a sheet whose 'reason' world convicts of part of the charge must let the judge say so */
function partialOption(c){if(!curOf(c)?.partial||!Array.isArray(c.verdicts)||c.verdicts.some(o=>o.id==='partial'))return;
 const i=c.verdicts.findIndex(o=>T.direction(o,c.kind)==='acquit');c.verdicts.splice(i<0?c.verdicts.length:i,0,{id:'partial',label:'일부만 유죄',note:'증거로 보여준 부분만 인정한다'})}
function decisionVerdicts(c){partialOption(c);claimNotes(c);const d=curOf(c)?.decision;if(!d)return;c.verdicts=[{id:'full',label:tell(c,null,d.yes),note:tell(c,null,d.yesNote)},{id:'dismiss',label:tell(c,null,d.no),note:tell(c,null,d.noNote)}]}
/* v8.6.5: the civil options carry the amount the case itself claims (the generated story had its own figure) */
function claimNotes(c){const cl=!isCriminal(c)&&claimOf(c);if(!cl||!c.verdicts)return;
 for(const o of c.verdicts){if(o.id==='partial')o.note=`증거로 확인된 만큼만 인정한다 (청구 ${won(cl.amount)})`;else if(o.id==='full')o.note=`원고의 요구를 모두 인정한다 (청구 ${won(cl.amount)})`}}
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
 const pending=t.cards.filter(pend).length;
 if(t.daysDone>=t.minDays&&!(pending&&!waiting(t))){const more=waiting(t)&&!isDecision(c)&&t.daysDone<t.minDays+EXTRA_DAYS;
  return {k:'verdict',text:more?`⚖ 판결할 수 있어요 · 기일 더 열기는 ${minsLeft(t)}분 뒤`:'⚖ 판결할 수 있어요',short:more?`판결 가능 · 기일 ${minsLeft(t)}분 뒤`:'판결 가능'}}
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
const wName=(t,i)=>i==='party'?(NPC[t.party?.id]?.name||'당사자'):NPC[t.witnesses[i]?.id]?.name||'증인';
/* v8.6: the record shown to a witness ('cf:<evidence id>') */
const shownTitle=(t,h)=>String(h.q||'').startsWith('cf:')?t.evidence.find(e=>e.id===String(h.q).slice(3))?.title||'':'';
/* v8.6 조건부 채택: which lines of the record the judge uses, and on what condition.
 * v8.6.4 (user): 조건부 채택 = use only some lines of the record. e.cond={rows:null|[line index]}, saved with the evidence. */
const evRows=(c,t,e)=>{const d=evDetail(c,e);return d?.excerpt?String(tell(c,t,d.excerpt)).split(/\s+\/\s+/).filter(Boolean):[]};
const CHECK_STOP=new Set(['기록','내역','자료','같은','비교해','맞춰','보세요','확인해','생각해','따져','함께','그날','증인','증인에게','사람','어떤','절차','이유','방법','부분','말한','직접','처방전','누가','어떻게','언제부터','먼저','나란히','놓고','구분해','물어보세요','있는지','없는지','실제','이것','그것','다른','처음']);
/* what the bench note ('대조해 볼 것') points at: another record in this trial or a witness, by shared words */
function condLink(c,t,e){
 const d=evDetail(c,e);if(!d?.check)return null;
 const toks=String(tell(c,t,d.check)).replace(/["'“”‘’.,·()?]/g,' ').split(/\s+/)
  .map(w=>w.replace(/(으로|에게|에서|끼리|하고|이랑|와|과|가|이|를|을|은|는|의|에|로|도|만)$/,'')).filter(w=>w.length>=2&&!CHECK_STOP.has(w));
 if(!toks.length)return null;
 const score=s=>toks.filter(k=>String(s||'').includes(k)).length;let best=null;
 t.evidence.forEach(x=>{if(x.id===e.id)return;const n=score(x.title);if(n&&(!best||n>best.n))best={kind:'e',id:x.id,name:x.title,n}});
 t.witnesses.forEach((w,i)=>{const n=score(w.role);if(n&&(!best||n>best.n))best={kind:'w',id:i,name:wName(t,i),n}});
 return best;
}
const condOf=(c,t,e)=>{if(!e.cond||e.cond.how)e.cond={rows:e.cond?.rows||null};return e.cond};
/* the lines the judge chose to use (all of them unless some were left out) */
function condUsed(c,t,e){const rows=evRows(c,t,e),k=e.cond;return !k?.rows?rows:rows.filter((_,i)=>k.rows.includes(i))}
function condSet(c,t,e,choice){
 const k=condOf(c,t,e),rows=evRows(c,t,e);if(!choice.startsWith('row:'))return;
 const i=Number(choice.slice(4));if(!(i>=0&&i<rows.length))return;
 const on=k.rows?[...k.rows]:rows.map((_,j)=>j),at=on.indexOf(i);
 if(at>=0){if(on.length<=1){toast('쓸 부분을 한 줄 이상 남겨야 해요.');return}on.splice(at,1)}else on.push(i);
 k.rows=on.length===rows.length?null:on.sort((a,b)=>a-b);
 addLog(t,'증거',`${e.title}: ${k.rows?`${rows.length}줄 중 ${k.rows.length}줄만 씀`:'모든 줄을 씀'}`);
}
const short=(s,n=46)=>{s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s};
const P=(name,p)=>window.VerdictCurated?VerdictCurated.particle(name,p):name+p;

/* ---------- objections and delay requests ----------
 * v8.2: objections come up during questioning, not before the session (`live`). Leading and relevance objections are
 * ruled on right after the question and before the answer ('before'); hearsay is ruled on after the answer ('after').
 * A live card counts as waiting for the judge only once it has come up (`fired`). Cards from older saves keep the
 * pre-session flow. */
const pend=v=>!v.choice&&v.type!=='media'&&!(v.live&&!v.fired);
const liveWhen=card=>card.otype==='hearsay'||(card.otype==='lead'&&card.valid)?'after':'before';
const OBJ={lead:'유도신문',hearsay:'전문증거(남에게 들은 말)',relevance:'관련성 없음'};
function dressCards(c,t,cards){
 return cards.map(card=>{
  // a case that can be decided at its first hearing (one-hearing civil, decision cases) gets no delay requests from
  // the parties: only the judge opens more hearings when the first one is not enough
  if(card.type==='delay'&&!card.choice&&(isDecision(c)||(!isCriminal(c)&&t.minDays<=1))){card.void=true;return card}
  if(card.dressed||card.type==='media')return card;
  if(card.type==='objection'&&!t.witnesses.length){card.void=true;return card}
  const h=T.hash(t.seed+':'+card.id),wi=h%Math.max(1,t.witnesses.length);
  if(card.type==='objection'){
   card.w=wi;card.live=true;card.at=1+(h>>>9)%3;   // comes up at the 1st~3rd question of the day
   const open=(wDetail(c,wi)?.q||[]).filter(q=>!q.hidden);
   if(card.valid)card.otype=(h>>>3)%3===0?'hearsay':'lead';
   else{card.otype=(h>>>3)%2?'relevance':'lead';card.q=open.length?open[(h>>>5)%open.length].id:null}
  }
  if(card.type==='delay'){card.by=t.style==='delay'||(h>>>4)%3?'d':'p';card.weeks=card.valid?2:4;card.reasonKey=(h>>>6)%2}
  card.dressed=true;return card;
 }).filter(card=>!card.void);
}
/* a witness's answer turned into the leading question that would have put it in the witness's mouth:
 * "제가 봤어요" → "증인이 봤지요?". Returns null when the sentence does not end in a form we can turn. */
function leadOf(text){
 const ss=String(text||'').split(/(?<=[.?!])\s+/).map(v=>v.replace(/[.!?。…\s]+$/,'').trim()).filter(Boolean);
 const hedge=v=>/^(네|아뇨|아니요|글쎄|솔직히|잘 모르|기억이)|아니에요$|모르겠어요$/.test(v);
 let x=ss.find(v=>/\d/.test(v)&&!hedge(v))||ss.find(v=>!hedge(v))||ss[0];if(!x)return null;
 const core=x.length>36?x.slice(0,35)+'…':x;
 x=x.replace(/^제가\s/,'증인이 ').replace(/^저는\s/,'증인은 ').replace(/^저도\s/,'증인도 ').replace(/^제\s/,'증인의 ').replace(/^저희\s/,'증인 쪽 ');
 const R=[[/(을|ㄹ) 거예요$/,'지요?'],[/이요$/,'이었지요?'],[/(이에요|이었어요)$/,m=>m==='이었어요'?'이었지요?':'이지요?'],[/예요$/,'지요?'],[/했어요$/,'했지요?'],[/해요$/,'하지요?'],[/돼요$/,'되지요?'],
  [/(었|았|였|했|겠)(어요|습니다)$/,(m,p)=>p+'지요?'],[/(습니다|ㅂ니다)$/,'지요?'],[/(거든요|네요|는데요|어요|아요)$/,'지요?']];
 for(const [re,to] of R)if(re.test(x)){const out=x.replace(re,to);if(out!==x&&/지요\?$/.test(out))return {ask:out,core};}
 return {ask:`${x}, 맞지요?`,core};
}
function cardText(card,t,c){
 const lawyer=NPC[t.opponent]?.name||'상대';
 const crim=isCriminal(c),asker=crim?`${prosName(c)} 검사`:'원고 대리인',objector=crim?`${lawyer} 변호사`:`피고 대리인 ${lawyer} 변호사`;
 if(card.type==='media')return {title:'법정 밖 언론 플레이',who:objector,body:`${objector}가 기자들 앞에서 의뢰인의 억울함을 호소했다. 여론이 흔들린다.`};
 if(card.type==='objection'){
  const wn=wName(t,card.w),d=wDetail(c,card.w);
  let target,reason;
  /* show what was asked and, where there was one, what the witness answered, so the judge can rule on the exchange */
  let ask,answer=null,first='',prevA='';
  if(card.otype==='lead'&&card.valid){
   /* v8.6.2: the leading follow-up grows out of the question the judge actually picked — the asker repeats the
    * witness's own answer back as a "…지요?" question, so the screen shows what was asked and which answer was put in */
   const q=card.q?qById(c,t,card.w,card.q):null,a=q?answerOf(c,t,card.w,q).text:'',l=a?leadOf(a):null;
   if(l){ask=l.ask;first=tell(c,t,q.q);prevA=a;answer=card.live&&card.choice!=='reject'?null:'네, 맞습니다.';reason=`검사가 증인의 답 가운데 "${l.core}"를 질문에 그대로 넣어 '맞지요?' 하고 확인받으려 합니다. 증인이 직접 겪은 일을 스스로 말하게 해야 합니다.`}
   else{ask=tell(c,t,d?.lead||'그렇게 하신 거죠?');answer=card.live&&card.choice!=='reject'?null:'네, 그렇습니다. 그랬던 것 같아요.';reason=`질문에 이미 답이 들어 있습니다. 증인이 직접 겪은 일을 스스로 말하게 해야 합니다.`}
   if(!isCriminal(c))reason=reason.replace('검사가','원고 대리인이')}
  else if(card.otype==='hearsay'){const open=(d?.q||[]).filter(q=>!q.hidden&&q.side!=='n'),q=card.q?questionsOf(c,t,card.w).find(x=>x.id===card.q):open.length?open[(T.hash(t.seed+':'+card.id)>>>5)%open.length]:null;
   ask=tell(c,t,q?.q||'그날 무슨 일이 있었는지 말해 주세요.');answer='그 부분은 제가 직접 본 건 아니고, 그렇게 됐다고 다른 사람한테서 들었습니다.';
   reason='증인은 직접 보거나 들은 것이 아니라 남에게 전해 들은 말을 옮기고 있습니다. 원래 말한 사람을 법정에 불러야 합니다.'}
  else{const q=(d?.q||[]).find(x=>x.id===card.q);ask=tell(c,t,q?.q||'그날 무엇을 보셨습니까?');if(q&&t.witnesses[card.w]&&(!card.live||card.choice==='reject'))answer=answerOf(c,t,card.w,q).text;
   reason=card.otype==='lead'?'질문이 답을 정해 놓고 있습니다.':'이 질문은 사건과 관계가 없습니다.'}
  target=`${asker}: "${ask}"`+(answer?`\n${wn}: "${answer}"`:'');
  return {title:`이의 제기 · ${OBJ[card.otype]}`,who:objector,
   body:first?`${objector}가 ${asker}의 덧붙인 질문에 이의를 제기했습니다.`:`${objector}가 ${asker}의 신문에 이의를 제기했습니다.`,target:`${asker} → 증인 ${wn}`,quote:target,ask,answer,askBy:asker,wn,reason,prevQ:first,prevA,
   /* plain words: what each choice does to this question and answer */
   choices:card.live&&liveWhen(card)==='before'?['이의를 받아들임 — 질문을 거두고 답을 듣지 않음','이의를 받아들이지 않음 — 증인이 답함']
    :answer?['이의를 받아들임 — 이 질문과 답은 판단에서 뺌','이의를 받아들이지 않음 — 이 답을 기록에 남김']
    :['이의를 받아들임 — 이 질문은 더 할 수 없음','이의를 받아들이지 않음 — 이 질문을 계속할 수 있음']};
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
/* v8.6.1: what the witness actually says when shown a record — the earlier words in quotes, the line of the record,
 * and (when correcting) what the record says happened. Falls back to the plain lines when the record has no text. */
function confrontWords(c,t,i,e,d){
 const said=t.heard.filter(h=>h.w===i&&h.issue===d.issue&&!h.struck&&!h.tainted&&(h.side==='p'||h.side==='d'));
 const textOf=h=>{if(!h)return '';if(h.text)return h.text;const q=qById(c,t,i,h.q);return q?answerOf(c,t,i,q).text:''};
 const clip=x=>{x=String(x||'').split(/(?<=[.?!])\s+/)[0].replace(/[.。]$/,'');return x.length>40?x.slice(0,39)+'…':x};
 const against=said.filter(h=>h.side!==d.side),earlier=clip(textOf(against[against.length-1])),first=clip(textOf(said[0]));
 const rows=evRows(c,t,e),row=clip(rows.find(r=>warnRow(r))||rows[0]||'');
 const sc=String(e.scope||'').trim().replace(/[.。]$/,''),fact=/다$/.test(sc)?sc:'';
 return {earlier,first,row,fact,pick:T.hash(t.seed+':cw:'+i+':'+e.id)%2};
}
function confront(c,t,i,eid){
 const w=t.witnesses[i],e=t.evidence.find(x=>x.id===eid),d=e&&evDetail(c,e);if(!w||!d)return '';
 if(t.qLeft<1){toast('오늘 신문 시간이 끝났어요.');return ''}
 t.qLeft--;(w.shown??=[]).push(eid);
 const name=wName(t,i),o=T.confrontOutcome({attitude:w.attitude,flipped:w.flipped,traits:NPC[w.id]?.traits||{}},t.truth,t.seed+':cf:'+i+':'+eid);
 let text,side=o.side,label,strike=o.strike;
 const cw=confrontWords(c,t,i,e,d),at=cw.row?`${e.title}에 적힌 '${cw.row}' 부분`:P(e.title,'을');
 if(o.kind==='hold'){text=cw.earlier?(cw.pick?`${cw.row?at+'이 있어도':P(e.title,'이')+' 있어도'}, 제가 "${cw.earlier}"라고 한 건 직접 겪은 대로 말씀드린 겁니다. 바꿀 게 없습니다`
   :`기록은 기록이고요. "${cw.earlier}" — 제가 본 건 그랬습니다. 그 기록이 그날 일을 다 담고 있지는 않을 겁니다`)
   :`그 ${P(e.title,'이')} 뭘 말하든 제가 기억하는 건 그대로입니다`;label='증거를 보고도 바꾸지 않은 말'}
 else if(o.kind==='correct'){text=cw.earlier?(cw.pick?`${cw.row?at+'을 보니':P(e.title,'을')+' 보니'} 제가 잘못 기억했네요. 아까 "${cw.earlier}"라고 한 건 거두겠습니다.${cw.fact?` ${cw.fact}는 게 맞는 것 같습니다`:' 기록대로가 맞을 겁니다'}`
   :`"${cw.earlier}"라고 말씀드렸는데, 기록을 보니 아니었습니다.${cw.fact?` ${cw.fact}는 쪽이 맞겠네요. 제가 헷갈렸어요`:' 제가 헷갈렸어요'}`)
   :'제 기억이 틀렸을 수 있겠네요. 그 기록이 더 정확할 겁니다';label='증거를 보고 정정한 말'}
 else if(o.kind==='revert'){w.flipped=false;text=cw.first&&cw.first!==cw.earlier?`${cw.row?at+'을 보니':'기록을 보니'} 처음에 말씀드린 "${cw.first}"라는 말이 맞습니다. 중간에 말이 흔들렸어요`:'기록을 보니 처음에 말씀드린 게 맞습니다. 중간에 말이 흔들렸어요';label='처음 진술로 돌아온 말'}
 else{const pool=ADMIT[t.truth]||ADMIT.reason;text=(cw.earlier?`"${cw.earlier}"라고 한 건 다 말씀드린 게 아니었습니다. `:'')+pool[T.hash(t.seed+i+eid)%pool.length];label=w.attitude==='fear'?'두려움을 털어놓으며 한 말':'감싸던 것을 털어놓은 말';w.revealed=2}
 if(strike)t.heard.forEach(h=>{if(h.w===i&&h.issue===d.issue&&!h.text&&(h.side==='p'||h.side==='d')&&h.side!==d.side)h.struck=true});
 t.heard.push({w:i,q:'cf:'+eid,side,issue:d.issue,day:t.day,text,label});
 addLog(t,'증거 대조',`${name}에게 ${P(e.title,'을')} 보여 줌 — "${text}"`);
 remember(w.id,'법정',`${shortName(c)} 재판에서 ${P(e.title,'을')} 보고 "${short(text,30)}"라고 말함`,c.id);
 return `📁 ${name}: "${short(text,44)}"`;
}
/* two witnesses whose answers on one issue point opposite ways */
function clashPair(t,issue){const hs=t.heard.filter(h=>h.issue===issue&&!h.struck&&!h.tainted&&h.w!=='party');
 const a=hs.find(h=>h.side==='p'),b=hs.find(h=>h.side==='d'&&h.w!==a?.w);return a&&b?[a.w,b.w]:null}
function faceOff(c,t,issue){
 const pair=clashPair(t,issue);if(!pair)return '';
 if(t.qLeft<2){toast('대질 신문에는 남은 신문이 2번 필요해요.');return ''}
 t.qLeft-=2;(t.faced??=[]).push(issue);
 const wv=i=>({traits:NPC[t.witnesses[i].id]?.traits||{},reliability:t.witnesses[i].reliability,attitude:t.witnesses[i].attitude});
 const [pi,di]=pair,o=T.faceOffOutcome(wv(pi),wv(di),t.truth,t.seed+':face:'+issue),iss=issuesOf(c).find(x=>x.id===issue);
 let text;
 if(o.result==='draw'){text=`${P(wName(t,pi),'과')} ${wName(t,di)} 모두 물러서지 않았다. 누구 말이 맞는지는 다른 근거로 가려야 한다`;
  t.heard.push({w:pi,q:'face:'+issue,side:'n',issue,day:t.day,text:'저는 제가 본 대로 말했습니다. 바꿀 게 없습니다',label:'대질에서 한 말'})}
 else{const lose=o.result==='p-yields'?pi:di,win=lose===pi?di:pi,ls=lose===pi?'p':'d';
  t.heard.forEach(h=>{if(h.w===lose&&h.issue===issue&&h.side===ls&&!h.text)h.struck=true});
  t.heard.push({w:lose,q:'face:'+issue,side:'n',issue,day:t.day,text:`${wName(t,win)}의 말을 들으니 제가 잘못 기억했을 수도 있겠습니다`,label:'대질에서 물러선 말'});
  text=`대질 끝에 ${P(wName(t,lose),'이')} 한발 물러섰다. ${P(wName(t,win),'은')} 처음 말을 그대로 지켰다`}
 addLog(t,'대질',`'${iss?.title||'쟁점'}' · ${text}`);
 return `⚖ 대질 · ${short(text,60)}`;
}
/* ---------- v6.2: the judge's orders between hearings ----------
 * At a hearing the judge can ask a side to explain a point, look for records, propose a witness or bring a witness back.
 * Results arrive when the next hearing opens. What can come back is written in advance (curated `followUps`, the
 * case's late evidence, witnesses' unopened questions); nothing is invented, and "there is no such record" is a
 * proper answer. In a criminal case the defence may decline: the accused never has to prove anything.
 * Every order is keyed, so the same order cannot be given twice and a reload never duplicates a result. */
const ORDER_MAX_DAY=2,ORDER_MAX_CASE=6,LATE_STAGE=5;
const ORDER_LABEL={records:'자료 제출',original:'원본 확인',witness:'증인 신청',explain:'석명 요구',expert:'보충 감정',compare:'비교표 제출',alibi:'동선 자료 확인',recall:'증인 재신문'};
const toWord=(c,to)=>to==='both'?'양측':isCriminal(c)?(to==='p'?'검찰':'변호인'):(to==='p'?'원고 측':'피고 측');
const pick=(x,truth)=>x&&typeof x==='object'&&!Array.isArray(x)&&('did' in x||'didnt' in x||'reason' in x)?(x[truth]??x.reason??x.did):x;
/* Orders: between hearings in an ordinary trial; on the spot (node.now) in a one-hearing decision case. */
const canOrder=(c,t)=>sessionOpen(t)&&!waiting(t)&&(isDecision(c)?!t.daysDone:t.daysDone+1<t.minDays+EXTRA_DAYS);
const nodeState=t=>({day:t.day,heard:t.heard||[],orders:Object.fromEntries((t.courtOrders||[]).filter(o=>o.follow).map(o=>[o.follow,o.status==='pending'?'pending':o.outcome]))});
function availableOrders(c,t){
 const cur=curOf(c);if(!cur||!canOrder(c,t))return [];
 const used=new Set((t.courtOrders||[]).map(o=>o.key)),out=[],iss=id=>issuesOf(c).find(x=>x.id===id),dec=isDecision(c),st=nodeState(t);
 // 1) the case's own follow-up nodes whose trigger has happened (late hearings: only clarifying, no new facts)
 for(const f of cur.followUps||[]){
  if(!!f.now!==dec||used.has('f:'+f.id)||!T.nodeOpen(f,st))continue;
  if(t.day>=LATE_STAGE&&!['explain','recall'].includes(f.type))continue;
  if(f.type==='recall'&&!t.witnesses[f.recall?.w])continue;
  out.push({key:'f:'+f.id,follow:f.id,issue:f.issue,type:f.type,to:f.to,w:f.recall?.w,text:tell(c,t,f.ask),own:true});
 }
 if(dec)return out;
 // 2) written material the case already has: the late document, hidden questions of the written witnesses
 if(cur.late&&!t.lateDone&&!t.lateDue&&t.day<LATE_STAGE){const to=/검찰|원고/.test(cur.late.by)?'p':'d',is=iss(cur.late.issue);
  out.push({key:'late',issue:cur.late.issue,type:'records',to,own:true,text:`${P(toWord(c,to),'은')} '${is?.title||'쟁점'}'와 관련해 아직 내지 않은 자료가 있는지 확인해 다음 기일까지 제출해 주세요.`})}
 t.witnesses.forEach((w,i)=>{if(w.detail)return;const d=wDetail(c,i);for(const is of issuesOf(c)){
  const hid=(d?.q||[]).filter(q=>q.hidden&&q.issue===is.id&&!(w.opened||[]).includes(q.id)&&!(w.askedIds||[]).includes(q.id));
  if(hid.length)out.push({key:`r:${i}:${is.id}`,issue:is.id,type:'recall',to:'both',w:i,own:true,text:`증인 ${P(wName(t,i),'을')} 다음 기일에 다시 불러 '${is.title}'에 대해 더 묻겠습니다. 양측은 증인이 출석하도록 협조해 주세요.`})}});
 // 3) a plain written summary of an issue, only while the case offers little of its own
 if(out.filter(o=>!used.has(o.key)).length<2)for(const is of issuesOf(c))out.push({key:'x:'+is.id,issue:is.id,type:'explain',to:'both',text:`양측은 '${is.title}'에 대한 주장과 근거를 다음 기일까지 서면으로 정리해 주세요.`});
 return out.filter(o=>!used.has(o.key));
}
function issueOrder(c,t,key){
 if(!canOrder(c,t))return '';
 const today_=(t.courtOrders||[]).filter(o=>o.day===t.day).length;
 if(today_>=ORDER_MAX_DAY){toast(`한 기일에 주문은 ${ORDER_MAX_DAY}건까지예요.`);return ''}
 if((t.courtOrders||[]).length>=ORDER_MAX_CASE){toast(`이 사건에서 낼 수 있는 주문은 ${ORDER_MAX_CASE}건까지예요.`);return ''}
 const o=availableOrders(c,t).find(x=>x.key===key);if(!o)return '';
 const f=o.follow&&(curOf(c)?.followUps||[]).find(x=>x.id===o.follow),now=!!f?.now;
 (t.courtOrders??=[]).push({...o,day:t.day,due:now?t.day:t.day+1,status:'pending',outcome:null,now,delayed:now});
 addLog(t,'주문',`${toWord(c,o.to)}에게 ${ORDER_LABEL[o.type]||'요청'} — ${o.text}`);
 if(now){resolveOrders(c,t);const last=t.changes?.items?.slice(-1)[0];return `📜 ${short(last?.text||'답변을 들었어요',60)}`}
 return `📜 주문 · ${toWord(c,o.to)}: ${short(o.text,40)} (다음 기일에 결과)`;
}
function orderSkill(c,t,to){const s=to==='p'?lawyerSkill(c.side?.[0]):to==='d'?lawyerSkill(t.opponent):(lawyerSkill(c.side?.[0])+lawyerSkill(t.opponent))/2;return s}
const LEGAL_OK='재판장 주문에 따라 제출돼 절차상 문제는 없다.';
function followEvidence(c,t,f,partial){
 const E=f.evidence,R=x=>pick(x,t.truth),tl=x=>tell(c,t,x||'');
 const ts=T.truthSide(t.truth),side=R(E.side)||(ts==='m'?'n':ts),part=partial&&E.part?R(E.part):null;
 const detail={kind:E.kind,by:E.by,when:tl(E.when),excerpt:tl(part||R(E.excerpt)),how:tl(E.how)+' '+(E.legal?tl(E.legal):LEGAL_OK)+(partial?' 요청한 범위 가운데 일부만 제출됐고, 빠진 부분은 확인되지 않았다.':''),
  issue:f.issue,side:partial&&!part?'n':side,check:tl(E.check),flaw:E.flaw||'none',title:tl(E.title)+(partial?' (일부)':''),shows:tl(R(E.shows)),caveat:tl(E.caveat)+(partial?' 일부만 나온 자료라 이것만으로 단정할 수 없다.':'')};
 const id='e'+t.evidence.length;
 const ns=T.roll({id:c.id+'-f-'+f.id,strict:true,evidence:[{id,title:detail.title,note:detail.caveat,scope:detail.shows,hintFlaw:detail.flaw}],witnesses:[],truth:t.truth},t.seed+':follow:'+f.id,[]).evidence[0];
 ns.detail=detail;ns.follow=f.id;ns.arrivedDay=t.day;ns.ordered=true;t.evidence.push(ns);return ns;
}
function followWitness(c,t,f){
 const W=f.witness,i=t.witnesses.length;
 const id=freshNPC(W.role,S.caseSerial||1,c.story?.deep?.key||c.contentPack?.category||'contract');NPC[id].role=W.role;NPC[id].caseWitnessRole=W.role;NPC[id].backstory=tell(c,t,W.story);
 const w={id,role:W.role,knowledge:'',interest:W.stake||'',attitude:'honest',reliability:60,memory:70,revealed:0,asked:0,flipped:false,askedIds:[],opened:[],story:tell(c,t,W.story),ordered:true,follow:f.id,
  detail:{role:W.role,story:W.story,stake:W.stake||'',lead:W.lead||'',q:W.q}};
 t.witnesses.push(w);witnessProfile(c,i,id);behaviour(c,i,w,t.seed+':follow');
 remember(id,'관련 사건',c.name+'의 증인으로 출석 (재판장 주문)',c.id);return w;
}
/* What each side says when asked to clarify. A party's statement is a claim, not a finding: it goes into the
 * record as what that side said. */
function explainText(c,t,f){
 const A=f.answer||{},line=k=>A[k]?`${sideWord(c,k)}: "${tell(c,t,pick(A[k],t.truth))}"`:'';
 return [line('p'),line('d')].filter(Boolean).join(' / ');
}
const NONE_TEXT={witness:'증인을 찾았지만 연락이 닿지 않아 출석하지 못했어요. 출석하지 않은 사람의 진술서는 그대로 증언을 대신할 수 없어요.',recall:'증인이 이번 기일에 나오지 못했어요.',expert:'감정인이 지금 자료만으로는 더 말할 수 있는 것이 없다고 회신했어요. 이 점은 확인되지 않은 채로 남아요.'};
function resolveOrders(c,t){
 const due=(t.courtOrders||[]).filter(o=>o.status==='pending'&&o.due<=t.day);if(!due.length)return;
 const cur=curOf(c),items=[];
 for(const o of due){
  const f=o.follow?(cur?.followUps||[]).find(x=>x.id===o.follow):null;
  const has=f?pick(f.have,t.truth)!==false:true;
  /* v8.3: a case's own order can say what comes back in each world (done / partial / declined / none); a 'late' roll
   * still happens once, so a delay remains possible */
  const fixed=f?.result?pick(f.result,t.truth):null;
  let outcome=T.orderOutcome({type:o.type,to:o.to,crim:isCriminal(c),has,skill:orderSkill(c,t,o.to),delayed:!!o.delayed},t.seed+':order:'+o.key+':'+o.due);
  if(fixed&&outcome!=='late')outcome=fixed==='declined'&&!(isCriminal(c)&&o.to==='d')?'none':fixed;
  if(outcome==='partial'&&f?.witness)outcome='none'; // a witness either comes or does not: not coming opens the way-forward nodes
  const who=toWord(c,o.to);let text='',kind=outcome;
  if(outcome==='late'){o.delayed=true;o.due=t.day+1;o.note='미뤄짐';text=`${P(who,'이')} ${f?.lateWhy?tell(c,t,f.lateWhy):'준비할 시간이 더 필요하다며'} 다음 기일로 미뤄 달라고 했어요. 한 번만 미룰 수 있어요.`;items.push({key:o.key,kind,text});addLog(t,'주문 결과',text);continue}
  o.status='done';o.outcome=outcome;o.doneDay=t.day;
  if(outcome==='none')text=f?.none?tell(c,t,pick(f.none,t.truth)):NONE_TEXT[o.type]||`${who}: 확인해 봤지만 낼 수 있는 자료가 없습니다. 없다는 것만으로 어느 쪽 주장이 맞다고 볼 수는 없어요.`;
  else if(outcome==='declined')text=`변호인: 피고인 쪽은 이 자료를 내지 않겠습니다. 형사재판에서 증명은 검찰이 하는 것이라 피고인에게 낼 의무는 없고, 내지 않았다는 이유로 불리하게 볼 수도 없어요.`;
  else if(o.key==='late'){addLate(c,t);text=`${P(who,'이')} 요청한 자료를 냈어요. 증거 탭에서 확인하세요.`}
  else if(o.type==='recall'&&f?.recall){const w=t.witnesses[f.recall.w];if(w){w.extra=[...new Set([...(w.extra||[]),f.id])];}
   const n=(f.recall.q||[]).filter(q=>!q.hidden).length;text=`증인 ${P(wName(t,f.recall.w),'이')} 다시 나왔어요. ${f.why?tell(c,t,f.why)+' ':''}새로 물을 수 있는 질문 ${n}개 · 증인 탭에서 물어보세요.`}
  else if(o.type==='recall'){const w=t.witnesses[o.w],d=wDetail(c,o.w);const ids=(d?.q||[]).filter(q=>q.hidden&&q.issue===o.issue).map(q=>q.id);w.opened=[...new Set([...(w.opened||[]),...ids])];
   text=`증인 ${P(wName(t,o.w),'이')} 다시 나왔어요. 새로 물을 수 있는 질문 ${ids.length}개.`}
  else if(o.type==='explain'&&f?.answer){const x=explainText(c,t,f);text=`${o.now?'그 자리에서 답했어요':'양측이 설명을 냈어요'} — ${x}`;(t.writs??=[]).push({follow:f.id,day:t.day,issue:f.issue,text:x})}
  else if(o.type==='explain'){const is=issuesOf(c).find(x=>x.id===o.issue);text=`양측이 '${is?.title||'쟁점'}'에 대한 서면을 냈어요. 새로 드러난 사실은 없고, 지금까지의 주장과 근거를 정리한 내용이에요. 기록 탭에서 다시 볼 수 있어요.`}
  else if(f?.witness){const w=followWitness(c,t,f);ui.t4w=null;text=`새 증인 ${P(NPC[w.id]?.name||'증인','이')} 채택돼 출석했어요(${f.witness.role}). 증인 탭에서 물어보세요.`}
  else if(f?.evidence){const e=followEvidence(c,t,f,outcome==='partial');ui.t4ev=null;text=`${P(who,'이')} ${P(e.title,'을')} ${outcome==='partial'?'일부만 ':''}냈어요. 증거 탭에서 쓸지 정하세요.`;
   if(outcome==='partial'&&f.partial)text+=' '+tell(c,t,pick(f.partial,t.truth));
   if(f.rebut)text+=` 상대방 의견: "${tell(c,t,f.rebut)}"`}
  o.result=text;items.push({key:o.key,kind,text,own:!!f});addLog(t,'주문 결과',text);
 }
 t.changes={day:t.day,items:[...((t.changes?.day===t.day&&t.changes.items)||[]),...items]};
}
function ordersBlock(c,t){
 const mine=(t.courtOrders||[]).filter(o=>o.day===t.day),dec=isDecision(c);
 const list=availableOrders(c,t),left=Math.min(ORDER_MAX_DAY-mine.length,ORDER_MAX_CASE-(t.courtOrders||[]).length);
 const pend=(t.courtOrders||[]).filter(o=>o.status==='pending'&&o.day<t.day);
 const issued=mine.length?`<ul class="t4-orders-issued">${mine.map(o=>`<li>📜 <b>${esc(toWord(c,o.to))}</b> · ${esc(ORDER_LABEL[o.type])} — ${esc(short(o.text,70))}</li>`).join('')}</ul>`:'';
 if(!canOrder(c,t))return issued?`<section class="t4-orders-panel is-done"><div class="t4-orders-top"><b>📜 재판장 ${dec?'질문':'주문'}</b><small>오늘 낸 주문 · 다음 기일에 결과</small></div>${issued}</section>`:'';
 if(dec&&!list.length&&!mine.length)return '';
 const btn=o=>{const is=issuesOf(c).find(x=>x.id===o.issue);return `<button class="t4-q order" data-action="t4" data-kind="order" data-id="${esc(o.key)}"><span class="t4-tag">${esc(toWord(c,o.to))} · ${esc(ORDER_LABEL[o.type])}</span>${esc(o.text)}${is?`<small>쟁점 · ${esc(is.title)}</small>`:''}</button>`};
 const show=list.slice(0,3),more=list.slice(3,8);
 const choices=left>0&&list.length?show.map(btn).join('')+(more.length?`<details class="t4-orders-more"><summary>다른 주문 ${more.length}개 더 보기</summary>${more.map(btn).join('')}</details>`:'')
  :`<p class="muted small">${list.length?'이번 기일에 낼 수 있는 주문을 다 냈어요.':'지금 낼 수 있는 주문이 없어요.'}</p>`;
 return `<section class="t4-orders-panel ${left>0&&list.length?'is-open':''}" id="t4-orders"><div class="t4-orders-top"><b>📜 재판장 ${dec?'질문':'주문'}</b><span class="t4-orders-count">${mine.length}/${ORDER_MAX_DAY}</span></div>
 <p class="t4-orders-why">${dec?'이 자리에서 직접 묻고 바로 답을 들어요.':'판단에 모자란 것을 양측에 시키세요. 결과는 다음 기일을 열 때 와요.'}${pend.length?` · 기다리는 결과 ${pend.length}건`:''}</p>
 ${issued}${choices}</section>`;
}
/* the day page points to the orders tab; the orders themselves live there */
function ordersHint(c,t){
 if(!canOrder(c,t))return '';
 const mine=(t.courtOrders||[]).filter(o=>o.day===t.day).length,n=availableOrders(c,t).length;
 if(!n&&!mine)return '';
 return `<button class="t4-orders-hint ${mine?'':'is-open'}" data-action="t4tab" data-tab="orders"><b>📜 재판장 ${isDecision(c)?'질문':'주문'}</b><span>${mine?`오늘 ${mine}건 냈어요 · ${ORDER_MAX_DAY-mine>0?'더 낼 수 있어요':'다음 기일에 결과'}`:`낼 수 있는 ${isDecision(c)?'질문':'주문'} ${n}개 · 판단에 모자란 것을 시키세요`}</span><i>›</i></button>`;
}
function ordersPage(c,t){
 const hist=(t.courtOrders||[]).slice().reverse();
 const ICON={done:'✅',partial:'◐',none:'∅',declined:'—'};
 const list=hist.length?`<ul class="t4-order-hist">${hist.map(o=>`<li><div><b>${esc(session(c,o.day))}</b> · ${esc(toWord(c,o.to))} · ${esc(ORDER_LABEL[o.type]||'요청')}</div><p>${esc(o.text)}</p><small>${o.status==='pending'?(o.delayed?'⏳ 미뤄짐 · 다음 기일에 결과':'⏳ 다음 기일에 결과'):`${ICON[o.outcome]||'•'} ${esc(o.result||'결과 도착')}`}</small></li>`).join('')}</ul>`:'<p class="muted small">아직 낸 주문이 없어요.</p>';
 const live=ordersBlock(c,t);
 return `<section class="panel t4 t4-orders-page"><h3>📜 재판장 ${isDecision(c)?'질문':'주문'}</h3>
 ${live||`<p class="notice">${!sessionOpen(t)?`${esc(session(c,t.day))}을 열면 주문을 낼 수 있어요.`:waiting(t)?'다음 기일을 기다리는 중이에요.':'이 기일에는 더 낼 수 있는 주문이 없어요. 판결만 남은 기일에는 주문을 낼 수 없어요.'}</p>`}
 <h4>지금까지 낸 주문</h4>${list}</section>`;
}
function changesBlock(c,t){
 const ch=t.changes;if(!ch||ch.day!==t.day||!ch.items.length)return '';
 const icon={done:'✅',partial:'◐',none:'∅',declined:'—',late:'⏳'};
 const now=(t.courtOrders||[]).some(o=>o.now&&o.day===t.day);
 return `<div class="t4-changes"><b>${now?'📬 오늘 법정에서 들은 설명':'📬 지난 기일 이후 변화'}</b><ul>${ch.items.map(x=>`<li><span>${icon[x.kind]||'•'}</span>${esc(x.text)}</li>`).join('')}</ul></div>`;
}
/* One question to one witness (the 'ask' action; also used by tests to play hearings without the screen). */
function askQuestion(c,t,i,qid){
 const w=t.witnesses[i];if(!w||t.qLeft<=0)return '';
 const q=questionsOf(c,t,i).find(v=>v.id===qid);if(!q||w.askedIds.includes(q.id)||(w.blocked||[]).includes(q.id))return '';
 t.qLeft--;w.askedIds.push(q.id);w.asked=(w.asked||0)+1;w.revealed=T.reveal(w.revealed);
 if(w.attitude==='flip'&&w.asked>=2&&!w.flipped){w.flipped=true;w.flipAt=t.heard.length-1;addLog(t,'번복',`${P(wName(t,i),'이')} 앞서 한 말을 바꾸기 시작했다`)}
 const a=answerOf(c,t,i,q);
 t.heard.push({w:i,q:q.id,side:a.side,issue:q.issue,day:t.day});
 for(const n of q.next||[])if(!w.opened.includes(n))w.opened.push(n);
 addLog(t,'증언',`${wName(t,i)} — 문: ${tell(c,t,q.q)} / 답: "${a.text}"`);
 const iss=issuesOf(c).find(v=>v.id===q.issue);
 return `🗣 ${wName(t,i)}: "${short(a.text,40)}"${iss?` → '${iss.title}'에 기록`:''}${(q.next||[]).length?' · 이어서 물을 질문이 생겼어요':''}`;
}
/* What just happened at the witness stand, so the screen can tell an ordinary answer from a changed story, a clash
 * between witnesses, a witness giving way to evidence or a face-off. Saved per witness as a short list (`moments`). */
/* v8.7: the words shown for an answer — the AI wording when it came back (t.ai), otherwise the engine's own */
const shownAnswer=(c,t,i,q)=>t.ai?.[i+':'+q.id]||answerOf(c,t,i,q).text;
const aiAsk=(c,t,i,qid)=>{const q=qById(c,t,i,qid);if(q)window.VerdictAI?.npc(c,t,{w:i,q:qid,question:tell(c,t,q.q),answer:answerOf(c,t,i,q).text})};
const heardText=(c,t,h)=>{if(!h)return '';if(h.text)return h.text;const q=qById(c,t,h.w,h.q);return q?shownAnswer(c,t,h.w,q):''};
function momentOf(c,t,kind,id,pre){
 const fresh=t.heard.slice(pre.n),h=fresh[fresh.length-1];let moment=null,wi=null,note='';
 if(kind==='ask'&&h){wi=h.w;const w=t.witnesses[wi];
  const earlier=t.heard.slice(0,pre.n).filter(x=>x.issue===h.issue&&!x.struck&&!x.tainted&&x.w!=='party'&&(x.side==='p'||x.side==='d'));
  /* v8.6.4: "own words" only when the witness has really changed story (a flip) and now says the opposite of what was
   * said before it; "another witness" names that witness and quotes both, so the player sees what does not fit */
  const before=x=>w?.flipAt!=null&&t.heard.indexOf(x)<w.flipAt;
  const mine=(h.side==='p'||h.side==='d')&&w?.flipped?earlier.filter(x=>x.w===wi&&x.side!==h.side&&before(x)).pop():null;
  const other=(h.side==='p'||h.side==='d')?earlier.filter(x=>x.w!==wi&&x.side!==h.side).pop():null;
  if(w?.flipped&&!pre.flip[wi])moment='flip';
  else if(mine){moment='shift';note=` — 앞서 한 말: "${short(heardText(c,t,mine),40)}"`}
  else if(other){moment='clash';note=` — ${P(wName(t,other.w),'은')} "${short(heardText(c,t,other),40)}"라고 했어요`}
  else moment=String(h.q).includes('.')?'recall':'answer'}
 else if(kind==='confront'&&h){wi=h.w;moment=/바꾸지 않은/.test(h.label)?'hold':/정정/.test(h.label)?'correct':/처음 진술/.test(h.label)?'revert':'admit'}
 else if(kind==='face'&&h){wi=h.w;moment=/물러선/.test(h.label)?'yield':'standoff'}
 else if(kind==='card'){const card=(t.cards||[]).find(v=>v.id===id);moment=card?.type==='delay'?'delay':'objection';
  return {moment,actor:card?.type==='delay'?(card.by==='p'?c.side?.[0]:t.opponent):t.opponent}}
 const w=wi!=null?t.witnesses[wi]:null;
 if(w&&moment&&!['answer','recall','objection'].includes(moment)){w.moments=[...new Set([...(w.moments||[]),moment])].slice(-6);save()}
 return {moment,note,actor:w?.id||(['ask','confront'].includes(kind)?t.witnesses[Number(id)]?.id:null)};
}
/* ---------- v6.9: questioning the accused / a party ----------
 * Written per case (curated `party`). The accused in a criminal trial may decline any question; declining is
 * recorded as such and never counts against them (fixed per question, unrelated to the truth). A party's own account is
 * a claim, so most answers weigh nothing either way unless they give something away (curated `side`). */
const PARTY_SILENCE=0.2;
function partyOf(c,t){const P=curOf(c)?.party;if(!P)return null;const id=c.who?.[P.who==='B'?1:0];if(!id)return null;t.party??={id,role:P.role,asked:[]};return P}
function askParty(c,t,qid){
 const P=partyOf(c,t);if(!P||t.qLeft<=0)return '';const q=P.q.find(x=>x.id===qid);if(!q||t.party.asked.includes(qid))return '';
 t.qLeft--;t.party.asked.push(qid);
 const crim=isCriminal(c),silent=crim&&T.unit(t.seed+':party:'+qid)<PARTY_SILENCE;
 const key=t.truth in q.a?t.truth:'reason',text=silent?'그 질문에는 답하지 않겠습니다.':tell(c,t,q.a[key]),side=silent?'n':(q.side?.[key]||'n');
 t.heard.push({w:'party',q:'party:'+qid,side,issue:q.issue,day:t.day,text,label:silent?`${P.role} 진술 거부`:`${P.role} 진술`,party:true,silent});
 const nm=NPC[t.party.id]?.name||P.role;
 addLog(t,'당사자 신문',`${nm}(${P.role}) — 문: ${tell(c,t,q.q)} / 답: "${text}"`);
 remember(t.party.id,'법정',`${shortName(c)} 재판에서 재판장의 질문에 ${silent?'답하지 않음':'직접 답함'}`,c.id);
 return silent?`🤐 ${nm}: 진술을 거부했어요 · 불리하게 보지 않아요`:`🗣 ${nm}(${P.role}): "${short(text,40)}"`;
}
function partyCard(c,t,locked){
 const P=partyOf(c,t);if(!P)return '';const id=t.party.id,p=NPC[id],asked=t.party.asked,crim=isCriminal(c);
 const said=t.heard.filter(h=>h.w==='party').map(h=>{const q=P.q.find(x=>'party:'+x.id===h.q);return `<div class="t4-qa ${h.silent?'struck':''}"><p class="q">문. ${esc(tell(c,t,q?.q||''))}</p><p class="a">답. "${esc(h.text)}"</p>${h.silent?'<small>진술 거부 · 불리하게 보지 않음</small>':''}</div>`}).join('');
 const left=P.q.filter(q=>!asked.includes(q.id)),can=!locked&&t.qLeft>0;
 return `<details class="t4-card t4-party" ${ui.partyOpen===c.id?'open':''} data-case="${esc(c.id)}"><summary><b>⚖ ${esc(P.role)}에게 직접 묻기</b><span>${esc(p?.name||'')} · 남은 질문 ${left.length}개</span></summary><header><button class="t4-name" data-action="npc" data-id="${esc(id)}">${window.verdictPhoto?.(id)||'👤'} ${esc(p?.name||P.role)}</button><span class="t4-tag">${esc(P.role)}</span></header>
 <p class="small muted">${crim?'피고인은 진술을 거부할 수 있어요. 거부해도 불리하게 보지 않고, 피고인의 말은 그 자체로 증거가 되지는 않아요.':'당사자의 말은 주장이에요. 다른 증거와 맞춰 보세요.'}</p>
 ${said}${left.length?`<p class="t4-ask-head">물어볼 질문 · 신문 1번</p>${left.map(q=>`<button class="t4-q" data-action="t4" data-kind="party" data-id="${esc(q.id)}" ${can?'':'disabled'}>⚖ ${esc(tell(c,t,q.q))}</button>`).join('')}`:'<p class="muted small">준비한 질문을 모두 했어요.</p>'}</details>`;
}
/* direct number entry in the verdict window (fine, amount): applied when the field is left or Enter is pressed */
document.addEventListener('change',e=>{const el=e.target.closest?.('[data-t4input]');if(!el)return;const x=current();if(x)tweak(x.c,el.dataset.t4input,el.value)});
document.addEventListener('keydown',e=>{const el=e.target.closest?.('[data-t4input]');if(el&&e.key==='Enter'){e.preventDefault();el.blur()}});
document.addEventListener('toggle',e=>{const d=e.target;if(d?.matches?.('details.t4-party'))ui.partyOpen=d.open?d.dataset.case:null},true);
/* ---------- actions ---------- */
function act(kind,id,choice){
 const x=current();if(!x||x.st.verdict)return;
 const {c,st}=x,t=ensure(c,st);
 if(kind==='open'){if(waiting(t)||sessionOpen(t))return;openSession(c,st);resolveOrders(c,t);window.VerdictV6?.onSessionOpen?.(c,t);addLog(t,'개정',`${session(c,t.day)} 개정 · ${dlabel(t.dates[t.day])}`);save();ui.t4tab='day';render();window.scrollTo({top:0,behavior:'instant'});
  if(!askRequests(true))askNotices(false);return}
 if(kind==='handoff')return handoff(c,st);
 if(kind==='cond'){const e=t.evidence.find(v=>v.id===id);if(!e||e.decision!=='conditional'||!choice)return;condSet(c,t,e,String(choice));save();render();return}
 if(!sessionOpen(t)&&!waiting(t)){toast(`먼저 ${session(c,t.day)}을 여세요.`);return}
 if(waiting(t)){toast(`${session(c,t.day)}(${dlabel(Math.max(t.nextDate||0,today()))})은 ${minsLeft(t)}분 뒤에 열려요.`);return}
 let say='';const pre={n:t.heard.length,flip:t.witnesses.map(w=>!!w.flipped)};
 if(kind==='decide'){
  const e=t.evidence.find(v=>v.id===id);if(!e||!T.LABEL.decision[choice]||e.decision===choice)return;
  e.decision=choice;if(choice==='conditional')condOf(c,t,e);
  if((choice==='exclude'||choice==='conditional')&&e.flawType!=='none')e.publicFlaw=true;
  addLog(t,'증거',`${e.title}: ${T.LABEL.decision[choice]}`);
  const iss=issuesOf(c).find(i=>i.id===evDetail(c,e)?.issue);
  say=choice==='exclude'?`📁 ${e.title} — 판단 자료에서 뺐어요`:choice==='conditional'?`📁 ${e.title} — 조건 붙여 쓴다 · 카드 아래에서 쓸 부분을 고르세요`:`📁 ${e.title} — ${T.LABEL.decision[choice]}${iss?` · 재판 현황 '${iss.title}'에 반영`:''}`;
 }else if(kind==='ask'){
  if(t.qLeft<=0){toast('오늘 신문 시간이 끝났어요. 다음 기일에 이어서 물을 수 있어요.');return}
  const wi=Number(id),nth=t.heard.filter(h=>h.day===t.day&&!h.tainted&&h.w!=='party').length+1;
  const live=t.cards.find(v=>v.type==='objection'&&v.live&&!v.fired&&!v.choice&&nth>=(v.at||1));
  const qOk=questionsOf(c,t,wi).some(v=>v.id===choice&&!(t.witnesses[wi]?.askedIds||[]).includes(v.id));
  if(live&&qOk&&liveWhen(live)==='before'){   // the other side objects to the question before the witness answers
   live.w=wi;live.q=choice;live.fired=true;addLog(t,'이의',`${cardText(live,t,c).title} — 질문 직후`);save();render();askRequests(true);return}
  say=askQuestion(c,t,wi,choice);if(!say)return;aiAsk(c,t,wi,choice);
  if(live&&liveWhen(live)==='after'){live.w=wi;live.q=choice;live.fired=true;   // raised once the answer is out (hearsay) or on the follow-up (leading)
   save();const m=momentOf(c,t,kind,id,pre);window.VerdictVisuals?.record(c.id,kind,say+(m.note||''),m.actor,m.moment);toast(say);render();askRequests(true);return}
 }else if(kind==='confront'){say=confront(c,t,Number(id),choice);if(!say)return;
 }else if(kind==='face'){say=faceOff(c,t,id);if(!say)return;
 }else if(kind==='party'){if(t.qLeft<=0){toast('오늘 신문 시간이 끝났어요.');return}say=askParty(c,t,id);if(!say)return;
 }else if(kind==='order'){say=issueOrder(c,t,id);if(!say)return;
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
   const wn=wName(t,card.w),xt=cardText(card,t,c);
   /* the exchange stays visible on the witness: kept or struck. An ordinary question (unsound objection types) that the
    * judge lets stand becomes normal testimony instead, as if asked from the bench, without using the judge's questions */
   const plain=card.otype==='relevance'||(card.otype==='lead'&&!card.valid),w=t.witnesses[card.w];
   if(card.live&&plain){   // ruled on before the answer: sustained = the question is withdrawn; overruled = the witness answers now
    if(choice==='accept'){if(card.q&&w){w.blocked??=[];if(!w.blocked.includes(card.q))w.blocked.push(card.q)}say=`✋ 이의를 받아들였어요 · 질문을 거뒀고 증인 ${wn}은 답하지 않았어요`}
    else{say=t.qLeft>0?askQuestion(c,t,card.w,card.q):'';if(say)aiAsk(c,t,card.w,card.q);if(!say)say='✋ 이의를 받아들이지 않았어요 · 오늘 신문 시간이 끝나 다음 기일에 물을 수 있어요';}
    addLog(t,'이의',`${xt.title}: ${choice==='accept'?'받아들임':'받아들이지 않음'}`);
    save();if(say){const m=momentOf(c,t,choice==='reject'?'ask':'card',choice==='reject'?String(card.w):id,pre);window.VerdictVisuals?.record(c.id,choice==='reject'?'ask':'card',say+(m.note||''),m.actor,m.moment);toast(say)}
    if(t.cards.some(pend))return askRequests(true);ui.modal=null;render();return askNotices(false)}
   if(card.live&&card.otype==='lead'&&choice==='accept'&&w){w.objections??=[];w.objections.push({id:card.id,ask:xt.ask,answer:null,by:xt.askBy,kind:OBJ[card.otype],kept:false,day:t.day})}
   if(xt.answer&&w&&!(plain&&choice!=='accept')){w.objections??=[];w.objections.push({id:card.id,ask:xt.ask,answer:xt.answer,by:xt.askBy,kind:OBJ[card.otype],kept:choice!=='accept',day:t.day})}
   if(plain&&choice!=='accept'&&w&&card.q&&!w.askedIds.includes(card.q)){const q=questionsOf(c,t,card.w).find(v=>v.id===card.q);
    if(q){w.askedIds.push(q.id);const a=answerOf(c,t,card.w,q);t.heard.push({w:card.w,q:q.id,side:a.side,issue:q.issue,day:t.day});for(const n of q.next||[])if(!w.opened.includes(n))w.opened.push(n);
     addLog(t,'증언',`${wn} — 문: ${tell(c,t,q.q)} / 답: "${a.text}"`)}}
   if(choice==='accept'){
    if(plain){if(card.q&&w){w.blocked??=[];if(!w.blocked.includes(card.q))w.blocked.push(card.q)}say=`✋ 이의를 받아들였어요 · 그 답은 판단에서 빠졌고, 증인 ${wn}에게 그 질문은 더 할 수 없어요`}
    else say=`✋ 이의를 받아들였어요 · 그 답변은 판단 자료에서 빠졌어요`;
   }else{
    if(xt.answer&&!plain){t.heard.push({w:card.w,q:'obj:'+card.id,side:'p',issue:(wDetail(c,card.w)?.q||[])[0]?.issue||issuesOf(c)[0]?.id,day:t.day,tainted:true,label:card.otype==='lead'?'유도신문에 대한 답':'전해 들은 말',ask:xt.ask,said:xt.answer});
     say=`✋ 이의를 받아들이지 않았어요 · ${card.otype==='lead'?'유도된 답':'전해 들은 말'}이 기록에 남았어요 (증인 탭·판결 이유에서 볼 수 있어요)`}
    else say=`✋ 이의를 받아들이지 않았어요 · ${wn}의 답이 증언으로 기록에 남았어요`;
   }
  }
  addLog(t,card.type==='objection'?'이의':'연기',`${cardText(card,t,c).title}: ${choice==='accept'?'받아들임':'기각'}`);
 }
 save();
 if(say){const m=momentOf(c,t,kind,id,pre);window.VerdictVisuals?.record(c.id,kind,say+(m.note||''),m.actor,m.moment);toast(say)}
 if(kind==='card'){if(t.cards.some(pend))return askRequests(true);ui.modal=null;render();return askNotices(false)}
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
 const ords=(t.courtOrders||[]).map(o=>`<li><b>${esc(session(c,o.day))}</b> ${esc(toWord(c,o.to))} · ${esc(ORDER_LABEL[o.type])} → ${o.status==='pending'?(o.delayed?'기한 연장, 다음 기일':'다음 기일 결과 대기'):{done:'제출·출석',partial:'일부 제출',none:'자료 없음',declined:'제출하지 않음'}[o.outcome]||o.outcome}</li>`).join('');
 return `${rows?`<ul class="t4-timeline">${rows}</ul>`:'<p class="muted small">아직 열린 공판이 없습니다.</p>'}${ords?`<h4>재판장 주문</h4><ul class="t4-rec-orders">${ords}</ul>`:''}${v}<h4>쟁점별 정리</h4><p class="muted small">법정에 나온 증거와 증언을 쟁점마다 어느 쪽 주장을 뒷받침하는지로 나눠 적었어요. 쓰기로 정한 증거와 들은 증언만 들어가요.</p>${issueView(c,t)}`;
}
/* Pop-ups when a trial day opens: the other side's requests first, then what the parties filed. */
function askRequests(force){
 const x=current();if(!x||x.st.verdict)return false;const {c}=x,t=x.st.trial4;if(!t||waiting(t))return false;
 if(!sessionOpen(t))return false;
 const card=t.cards.find(pend);if(!card)return askNotices(false);
 if(!force&&t.askedDay===t.day)return false;t.askedDay=t.day;
 const left=t.cards.filter(pend).length;
 modal(`${cardText(card,t,c).who}가 일어섭니다`,`<p class="muted small">${card.live?(liveWhen(card)==='before'?'증인이 답하기 전에 이의가 나왔습니다. 지금 정해 주세요.':'증인의 답을 두고 이의가 나왔습니다. 지금 정해 주세요.'):`${session(c,t.day)}을 시작하기 전에 신청${left>1?` ${left}건`:''}에 답해 주세요.`}</p>${cardBlock(card,t,c)}`,
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

/* Ending a session cannot be undone, so it asks first (v8.2.1): what is still left today, then 계속 / 마치기. */
function confirmEnd(){
 const x=current();if(!x||x.st.verdict)return;const {c,st}=x,t=ensure(c,st);
 if(waiting(t)||!sessionOpen(t))return endDay();
 if(t.cards.some(pend)){askRequests(true);return}
 const undecided=t.evidence.filter(e=>!e.decision).length,heardToday=t.heard.filter(h=>h.day===t.day&&!h.tainted).length;
 const left=[t.qLeft>0?`남은 신문 ${t.qLeft}번`:'',undecided?`아직 쓸지 정하지 않은 증거 ${undecided}건`:'',heardToday?'':'오늘 아직 아무 증언도 듣지 않았어요'].filter(Boolean);
 modal(`${session(c,t.day)}을 마칠까요?`,`<p>한 번 마치면 오늘 공판으로 돌아올 수 없어요.${t.daysDone+1>=t.minDays?' 마치면 판결할 수 있어요.':' 다음 기일은 시간이 지나야 열려요.'}</p>
  ${left.length?`<ul class="t4-end-left">${left.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}`,
  `<div class="t4-stack"><button class="btn primary full" data-action="dismiss">계속 진행하기</button><button class="btn outline full" data-action="t4end" data-ok="1">${esc(session(c,t.day))} 마치기</button></div>`);
}
function endDay(){
 const x=current();if(!x||x.st.verdict)return;
 const {c,st}=x,t=ensure(c,st);
 if(waiting(t))return;
 openSession(c,st);
 if(t.cards.some(pend)){askRequests(true);return}
 const heardToday=t.heard.filter(h=>h.day===t.day&&!h.tainted).length,decided=t.evidence.filter(e=>e.decision).length;
 let twist=null;
 if(!t.twistUsed&&t.day>=2&&T.unit(t.seed+':twist:'+t.day)<T.twistChance(c.importance)){
  t.twistUsed=true;
  const flip=t.witnesses.findIndex(w=>w.attitude==='flip'&&!w.flipped);
  if(flip>=0){t.witnesses[flip].flipped=true;t.witnesses[flip].flipAt=t.heard.length;twist=`${P(wName(t,flip),'이')} 다음 기일에 진술을 바꾸겠다고 알려 왔다`;t.notices.push({type:'flip',w:flip,day:t.day+1})}
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
 ns.late=true;ns.arrivedDay=t.day;t.evidence.push(ns);t.lateDone=true;ui.t4ev=null;
 t.notices.push({type:'late',day:t.day});
 addLog(t,'새 증거',`${P(L.by,'이')} 새 증거를 제출했다: ${tell(c,t,L.title)}`);
}

/* ---------- verdict ---------- */
const CRIM_FACTORS=[['first','초범이다',-1],['remorse','반성하고 있다',-1],['repair','피해를 회복했거나 합의했다',-1],['impulse','계획 없이 벌어진 일이다',-1],['grave','피해가 무겁다',1],['plan','계획적이었다',1],['norem','반성하지 않는다',1],['vuln','피해자가 약한 처지였다',1]];
const CIVIL_FACTORS=[['proved','입증된 손해만 인정한다',-1],['fault','원고에게도 책임이 있다',-1],['pain','정신적 고통이 크다',1],['long','피해가 오래 이어졌다',1]];
const ym=m=>{const y=Math.floor(m/12),r=m%12;return y&&r?`${y}년 ${r}개월`:y?`${y}년`:`${r}개월`};
const won=n=>{n=Math.round(Number(n)||0);const e=Math.floor(n/10000),r=n%10000;return e?`${e}억${r?` ${r.toLocaleString('ko-KR')}만`:''} 원`:`${r.toLocaleString('ko-KR')}만 원`};
/* Which sentences the law allows, by charge. Data may say it (`charge.death`, `charge.both`: 'must' | 'may'); otherwise
 * a short table of the charges in the game. 병과 (prison and fine together) only where the statute provides it. */
function penaltyOf(ch){
 const law=String(ch.law||''),name=String(ch.name||'');
 const death=ch.death??((/형법 제250조/.test(law)&&/살인|살해/.test(name))||/형법 제338조/.test(law));
 const both=ch.both??(/특정범죄가중처벌법 제2조/.test(law)?'must':/자본시장(과 금융투자업에 관한 법률|법) 제44[3-5]조/.test(law)?'may':null);
 return {death:!!death,life:!!(ch.life||death),both,fineMax:ch.fine||(both?100000:0)};
}
const lawText=sp=>{const ch=sp.ch,pen=sp.pen;return `${pen.death?'사형, ':''}${pen.life?'무기 또는 ':''}${ch.min?`징역 ${ch.min}년 이상 `:'징역 '}${ch.max}년 이하${ch.fine&&pen.both!=='must'?` 또는 벌금 ${won(ch.fine)} 이하`:''}${pen.both==='must'?'(벌금을 함께 선고)':pen.both==='may'?'(벌금을 함께 선고할 수 있음)':''}`};
/* v8.3: what can be ordered besides the sentence or the money. Written per case (curated/extras.js, sheet
 * charge.orders / claim.remedies). Ancillary orders show only when the law allows them here (ok:false → shown greyed with
 * the reason); a remedy shows only when the plaintiff asked for it. Each has its own sentence for the judgment. */
const addonsOf=c=>curOf(c)?.addons||[];
const remediesOf=c=>curOf(c)?.remedies||[];
const fillN=(txt,n)=>String(txt||'').replace(/%n%/g,n);   // %n% = years / hours / 만 원 chosen
const unitOf=a=>a.unit||'년';
const fineUnit=max=>max>=3000?100:max>=1000?50:10;   // 100만 / 50만 / 10만 원 steps
/* What has to be decided after the verdict itself, and the reference range shown to the player. */
function sentenceSpec(c,dir){
 const side=T.sideOf(dir),partial=side===0.5;
 if(side<=0||isDecision(c))return null;
 if(isCriminal(c)){
  const ch=chargeOf(c);if(!ch)return null;const pen=penaltyOf(ch);
  const dm=curOf(c).demand,k=partial?0.6:1;
  if(typeof dm==='object'&&dm.fine){const f=dm.fine*k;return {mode:'crim',ch,pen,demand:dm,ref:{kind:'fine',lo:Math.round(f*0.8/10)*10,hi:Math.round(f*1.2/10)*10}}}
  const d=Math.round(dm*12*k),lo=Math.max(Math.round(ch.min*12),Math.round(d*0.8)),hi=Math.min(ch.max*12,Math.round(d*1.2));
  return {mode:'crim',ch,pen,demand:dm,ref:{kind:'months',lo:Math.min(lo,hi),hi}};
 }
 const cl=claimOf(c);if(!cl)return null;
 return {mode:'civil',cl,full:side===1,ref:{kind:'won',lo:cl.fair[0],hi:cl.fair[1]}};
}
/* amounts are kept in 만 원; the step is 100만 원 (10만 원 for claims under 1,000만 원) */
const amountUnit=sp=>(sp?.cl?.amount||0)>=1000?100:10;
function vstate(c){
 ui.t4v??={};if(ui.t4v.caseId!==c.id)ui.t4v={caseId:c.id,cites:[],factors:[]};
 return ui.t4v;
}
function setOption(c,optId){
 const v=vstate(c),opt=c.verdicts.find(o=>o.id===optId);if(!opt)return;
 v.opt=optId;const sp=sentenceSpec(c,T.direction(opt,c.kind));v.factors=[];v.addons={};v.remedies=[];
 if(sp?.mode==='crim')for(const a of addonsOf(c))if(a.ok!==false&&a.fixed)v.addons[a.id]=a.range?.[0]??1;
 if(sp?.mode==='crim'){
  if(sp.ref.kind==='fine'){v.type='fine';v.fine=Math.round((sp.ref.lo+sp.ref.hi)/2/10)*10}
  else{v.type='prison';v.months=Math.max(6,Math.round((sp.ref.lo+sp.ref.hi)/2/6)*6);v.susp=2}
  v.withFine=sp.pen.both==='must';if(v.withFine)v.fine=v.fine||fineUnit(sp.pen.fineMax)*10;
 }else if(sp?.mode==='civil'){const u=amountUnit(sp);v.amount=sp.full?sp.cl.amount:Math.min(sp.cl.amount,Math.round((sp.ref.lo+sp.ref.hi)/2/u)*u)}
}
/* prison terms move in 6-month steps (v8.2); a mitigating reason lets the judge go down to half the statutory minimum */
function legalMonths(sp,v){const mit=(v.factors||[]).some(f=>CRIM_FACTORS.find(x=>x[0]===f)?.[2]<0);
 const min=Math.max(6,Math.ceil(sp.ch.min*12*(mit?0.5:1)/6)*6);return {min,max:Math.max(min,Math.floor(sp.ch.max*12/6)*6),reduced:mit&&sp.ch.min>0}}
function tweak(c,k,val){
 const v=vstate(c),opt=c.verdicts.find(o=>o.id===v.opt);if(!opt)return;
 const sp=sentenceSpec(c,T.direction(opt,c.kind)),crim=sp?.mode==='crim',L=crim&&legalMonths(sp,v);
 const fineMax=crim?(sp.pen.fineMax||sp.ch.fine):0,unit=fineUnit(fineMax),clampFine=n=>Math.max(unit,Math.min(fineMax,Math.round(n/unit)*unit));
 if(k==='type'&&crim){v.type=val;if(val==='suspend'&&v.months>36)v.months=36;if((val==='prison'||val==='suspend')&&L)v.months=Math.max(L.min,v.months||12);
  if(val==='fine'&&!v.fine)v.fine=clampFine(fineMax/4)}
 else if(k==='months'&&crim){v.months=Math.max(L.min,Math.min(v.type==='suspend'?36:L.max,(v.months||12)+Number(val)))}
 else if(k==='susp')v.susp=Math.max(1,Math.min(5,Number(val)||2));
 else if(k==='withFine'&&crim&&sp.pen.both==='may'){v.withFine=!v.withFine;if(v.withFine&&!v.fine)v.fine=clampFine(unit*10)}
 else if(k==='fine'&&crim)v.fine=clampFine((v.fine||unit)+Number(val)*unit);
 else if(k==='setFine'&&crim){const n=Number(String(val).replace(/[^0-9]/g,''));if(n)v.fine=clampFine(n)}
 else if(k==='amount'&&sp?.mode==='civil'){const u=amountUnit(sp);v.amount=Math.max(0,Math.min(sp.cl.amount,Math.round(((v.amount||0)+Number(val)*u)/u)*u))}
 else if(k==='setAmount'&&sp?.mode==='civil'){const n=Number(String(val).replace(/[^0-9]/g,''));if(!Number.isNaN(n))v.amount=Math.max(0,Math.min(sp.cl.amount,n))}
 else if(k==='factor'){v.factors=v.factors.includes(val)?v.factors.filter(f=>f!==val):[...v.factors,val];if(crim&&v.months){const L2=legalMonths(sp,v);v.months=Math.max(L2.min,v.months)}}
 else if(k==='addon'){const a=addonsOf(c).find(x=>x.id===val);if(a&&a.ok!==false&&!a.fixed){v.addons??={};if(v.addons[val]!=null)delete v.addons[val];else v.addons[val]=a.range?.[0]??1}}
 else if(k==='addonN'){const [id,d]=String(val).split(':'),a=addonsOf(c).find(x=>x.id===id);if(a?.range&&v.addons?.[id]!=null){const st=a.step||1;v.addons[id]=Math.max(a.range[0],Math.min(a.range[1],v.addons[id]+Number(d)*st))}}
 else if(k==='remedy'){v.remedies??=[];v.remedies=v.remedies.includes(val)?v.remedies.filter(x=>x!==val):[...v.remedies,val]}
 else if(k==='cite'){v.cites=v.cites.includes(val)?v.cites.filter(f=>f!==val):[...v.cites,val]}
 render();
}
/* Material the player may cite: evidence they used, and testimony that stayed in the record.
 * Two separate questions for testimony (v8.2):
 *  - may it be used at all (증거능력)? No for what the judge struck on an objection and for what a witness took back;
 *    those never reach this list, the gauge or the judgment.
 *  - how far can it be trusted (신빙성)? A leading answer or hearsay kept over an objection is usable but `weak`. */
function citables(c,t){
 const out=[];
 t.evidence.forEach(e=>{if(e.decision!=='use'&&e.decision!=='conditional')return;const d=evDetail(c,e);
  const part=e.decision==='conditional'&&condOf(c,t,e).rows?condUsed(c,t,e):null;
  out.push({key:'e:'+e.id,label:e.title,text:part?part.join(', '):e.scope||'',part:!!part,cond:e.decision==='conditional',side:d?.side==='p'||d?.side==='d'?d.side:'n',issue:d?.issue,illegal:e.flawType==='illegal',kind:'evidence'})});
 t.heard.forEach((h,i)=>{if(h.struck||h.silent)return;
  if(h.tainted){out.push({key:'h:'+i,label:`${wName(t,h.w)}의 ${h.label} (이의가 있었던 말)`,text:h.said||'',side:h.side==='m'?'n':h.side||'p',issue:h.issue,weak:true,kind:'testimony',name:wName(t,h.w)});return}
  if(h.text){out.push({key:'h:'+i,label:`${wName(t,h.w)}의 ${h.label||'증언'}`,text:h.text,side:h.side==='m'?'n':h.side,issue:h.issue,kind:'testimony',name:wName(t,h.w)});return}
  const q=qById(c,t,h.w,h.q);if(!q)return;
  out.push({key:'h:'+i,label:`${wName(t,h.w)}의 증언`,text:shownAnswer(c,t,h.w,q),side:h.side==='m'?'n':h.side,issue:h.issue,kind:'testimony',name:wName(t,h.w)})});
 return out;
}
function addonOrders(c,v){
 const on=addonsOf(c).filter(a=>!a.notice&&a.ok!==false&&v.addons?.[a.id]!=null),notes=addonsOf(c).filter(a=>a.notice);
 return {order:[...on.map(a=>tell(c,null,fillN(a.order,v.addons[a.id]))),...notes.map(a=>tell(c,null,a.order||''))].filter(Boolean).join(' '),
  text:on.length?' · '+on.map(a=>a.range?`${a.label} ${v.addons[a.id]}${unitOf(a)}`:a.label).join(' · '):''};
}
function addonBlock(c,v){
 const L=addonsOf(c);if(!L.length)return '';
 const row=a=>{const on=v.addons?.[a.id]!=null,n=v.addons?.[a.id];
  if(a.notice)return `<p class="small t4-addon-note">ℹ ${esc(tell(c,null,a.label))} — ${esc(tell(c,null,a.why||'법에 따라 판결이 확정되면 함께 적용돼요.'))}</p>`;
  if(a.ok===false)return `<div class="t4-addon off"><button class="t4-chip" disabled>☐ ${esc(a.label)}</button><small>${esc(a.why||'이 사건에서는 요건이 맞지 않아요')}</small></div>`;
  return `<div class="t4-addon ${on?'on':''}"><button class="t4-chip ${on?'on':''}" data-action="t4v" data-k="addon" data-v="${esc(a.id)}" ${a.fixed?'disabled':''}>${on?'☑':'☐'} ${esc(a.label)}</button>${a.needs?`<small>${esc(a.needs)}${a.fixed?' · 유죄면 반드시 함께 선고':''}</small>`:''}
   ${on&&a.range?`<div class="t4-step"><span>${esc(a.label)} ${unitOf(a)==='시간'?'시간':unitOf(a)==='만 원'?'금액':'기간'}</span><button class="t4-chip" data-action="t4v" data-k="addonN" data-v="${esc(a.id)}:-5">−${5*(a.step||1)}</button><button class="t4-chip" data-action="t4v" data-k="addonN" data-v="${esc(a.id)}:-1">−${a.step||1}</button><b>${n}${esc(unitOf(a))}</b><button class="t4-chip" data-action="t4v" data-k="addonN" data-v="${esc(a.id)}:1">+${a.step||1}</button><button class="t4-chip" data-action="t4v" data-k="addonN" data-v="${esc(a.id)}:5">+${5*(a.step||1)}</button></div><p class="muted small">${a.range[0]}~${a.range[1]}${esc(unitOf(a))}</p>`:''}</div>`};
 return `<p class="t4-ask-head">함께 선고할 명령</p><div class="t4-addons">${L.map(row).join('')}</div>`;
}
function remedyBlock(c,v){
 const L=remediesOf(c);if(!L.length)return '';
 return `<p class="t4-ask-head">돈 말고 함께 명할 것 <small class="muted">(원고가 청구한 것만)</small></p><div class="t4-addons">${L.map(r=>{const on=(v.remedies||[]).includes(r.id);
  return `<div class="t4-addon ${on?'on':''}"><button class="t4-chip ${on?'on':''}" data-action="t4v" data-k="remedy" data-v="${esc(r.id)}">${on?'☑':'☐'} ${esc(tell(c,null,r.label))}</button>${r.note?`<small>${esc(tell(c,null,r.note))}</small>`:''}</div>`}).join('')}</div>`;
}
function sentenceOf(c,sp,v){
 if(!sp)return null;
 if(sp.mode==='civil'){const amount=sp.full?sp.cl.amount:(v.amount||0),R=remediesOf(c),on=R.filter(r=>(v.remedies||[]).includes(r.id));
  const ex=on.find(r=>r.kind==='상환'),other=on.filter(r=>r.kind!=='상환');
  const money=amount>0?`피고는 원고${ex?`로부터 ${tell(c,null,ex.order)} 동시에 원고`:''}에게 ${won(amount)}을 지급하라.`:'';
  const acts=other.map(r=>tell(c,null,r.order)).join(' ');
  const rest=amount<sp.cl.amount||R.some(r=>r.kind!=='상환'&&!on.includes(r));
  const order=money||acts?[money,acts,rest?'원고의 나머지 청구를 기각한다.':''].filter(Boolean).join(' '):'원고의 청구를 기각한다.';
  return {text:[amount>0?won(amount):'',...other.map(r=>tell(c,null,r.label))].filter(Boolean).join(' · ')||'청구 기각',order,
  score:sp.full?null:{what:'배상액',value:amount,lo:sp.ref.lo,hi:sp.ref.hi}}}
 const crimLabel={prison:'징역',suspend:'징역(집행유예)',fine:'벌금',life:'무기징역',death:'사형'}[v.type];
 const fineToo=(v.type==='prison'||v.type==='suspend'||v.type==='life')&&v.withFine&&sp.pen.both&&v.fine;
 let order,text,value;
 if(v.type==='death'){order='피고인을 사형에 처한다.';text='사형';value=Infinity}
 else if(v.type==='life'){order=`피고인을 무기징역${fineToo?` 및 벌금 ${won(v.fine)}`:''}에 처한다.`;text='무기징역';value=sp.ref.kind==='months'?sp.ch.max*12+12:Infinity}
 else if(v.type==='fine'){order=`피고인을 벌금 ${won(v.fine)}에 처한다.`;text=`벌금 ${won(v.fine)}`;value=sp.ref.kind==='fine'?v.fine:0}
 else{order=`피고인을 징역 ${ym(v.months)}${fineToo?` 및 벌금 ${won(v.fine)}`:''}에 처한다.${v.type==='suspend'?` 다만 이 판결 확정일부터 ${v.susp}년간 위 징역형의 집행을 유예한다.`:''}`;
  text=`징역 ${ym(v.months)}${v.type==='suspend'?`, 집행유예 ${v.susp}년`:''}${fineToo?`, 벌금 ${won(v.fine)}`:''}`;
  value=sp.ref.kind==='months'?(v.type==='suspend'?v.months*0.5:v.months):Infinity}
 if(fineToo&&v.type!=='death')text=text.includes('벌금')?text:text+`, 벌금 ${won(v.fine)}`;
 const lo=sp.ref.lo,hi=sp.ref.hi,f=v.factors||[];
 if(v.type!=='death'||true){const add=addonOrders(c,v);if(add.order){order+=' '+add.order;text+=add.text}}
 return {text,order,label:crimLabel,score:{what:'형량',value,lo,hi,mitig:f.filter(x=>CRIM_FACTORS.find(y=>y[0]===x)?.[2]<0).length,aggr:f.filter(x=>CRIM_FACTORS.find(y=>y[0]===x)?.[2]>0).length}};
}
const demandText=c=>{const d=curOf(c)?.demand;return d==null?'':typeof d==='object'?`벌금 ${won(d.fine)}`:`징역 ${ym(Math.round(d*12))}`};
function askVerdict(optionId){
 const x=current();if(!x||x.st.verdict)return;
 const {c,st}=x,t=ensure(c,st);
 if(t.daysDone<t.minDays){toast(`기일이 ${t.minDays-t.daysDone}번 더 필요해요.`);return}
 setOption(c,optionId);render();
}
/* v8.3: remedies and ancillary orders are judged too — what the record supports (fit per truth), what the law
 * expects with a conviction (expected), what was ordered without a basis */
function extraScore(c,t,v,dir,sp){
 const out=[],side=T.sideOf(dir),fits=x=>x.fit?pick(x.fit,t.truth)!==false:true;
 if(sp?.mode==='civil'&&side>0)for(const r of remediesOf(c)){const on=(v.remedies||[]).includes(r.id),f=fits(r),l=tell(c,t,r.label);
  if(on)out.push({key:'remedy:'+r.id,points:f?3:-4,text:f?`기록에 맞는 조치를 함께 명했음(${l})`:`기록에 근거가 없는 조치를 명했음(${l})`});
  else if(f&&r.fit)out.push({key:'remedy:'+r.id,points:-2,text:`필요한 조치를 빠뜨림(${l})`})}
 if(sp?.mode==='crim'&&side>0)for(const a of addonsOf(c)){if(a.notice||a.ok===false)continue;const on=v.addons?.[a.id]!=null,f=fits(a);
  if(on&&!a.fixed)out.push({key:'addon:'+a.id,points:f?1:-3,text:f?`함께 선고한 명령이 사건에 맞음(${a.label})`:`사건에 맞지 않는 명령을 붙였음(${a.label})`});
  else if(!on&&a.expected)out.push({key:'addon:'+a.id,points:-2,text:`유죄면 원칙적으로 함께 선고하는 명령을 빠뜨림(${a.label})`})}
 return out;
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
 const res=T.skill(t,{dir,criminal:isCriminal(c),cites:cites.map(i=>({label:i.label,side:i.side,illegal:i.illegal,weak:i.weak})),sentence:score,extra:extraScore(c,t,v,dir,sp)});
 const judgment=writeJudgment(c,t,opt,dir,cites,sp,sent,fs);
 /* what was actually ordered, as plain data: the people's lives follow it (npc_life_justice.applyVerdict) */
 const side=T.sideOf(dir);
 st.sentenced=sp?.mode==='crim'?{kind:'crim',side,type:v.type,months:v.type==='prison'||v.type==='suspend'?v.months:0,susp:v.type==='suspend'?v.susp:0,
   fine:v.type==='fine'||(v.withFine&&sp.pen.both)?v.fine||0:0,charge:sp.ch.name,addons:{...(v.addons||{})}}
  :sp?.mode==='civil'?{kind:'civil',side,amount:sp.full?sp.cl.amount:v.amount||0,claim:sp.cl.amount,remedies:[...(v.remedies||[])]}
  :{kind:isDecision(c)?'decision':isCriminal(c)?'crim':'civil',side,type:'none',amount:0};
 finish(c,st,t,opt,dir,res,judgment,sent?.text||null);
}
/* Record the verdict through the career pipeline (conclude) and run the press: shared by the scripted and match trials. */
function finish(c,st,t,opt,dir,res,judgment,sentText){
 st.phase=3;st.liveHearing=null;st.nextHearingWeek=null;st.hearingHistory??=[];
 while(st.hearingHistory.filter(h=>h.kind==='resumed').length<4)st.hearingHistory.push({kind:'resumed',week:S.week,v4:true});
 S.actions=0;
 const prevEval=StoryEngine.evaluate;
 StoryEngine.evaluate=()=>({score:res.score,why:judgment.order+' '+judgment.conclusion});
 try{conclude(opt.id)}finally{StoryEngine.evaluate=prevEval}
 if(!st.verdict){toast('선고를 기록하지 못했습니다. 다시 시도해 주세요.');console.warn('v5 verdict blocked',c.id);return}
 st.grade=res.score;ui.t4v=null;
 for(const x of afterLines(c,st))if(x.id&&typeof remember==='function')remember(x.id,'판결 뒤 삶',x.text,c.id);
 after(c,st,t,opt,dir,res,{judgment,sentence:sentText});window.VerdictAI?.judgment(c,t);
}
/* The written judgment: what happened, what it rests on, each issue, and the sentence. Only cited material is quoted. */
function writeJudgment(c,t,opt,dir,cites,sp,sent,fs){
 const crim=isCriminal(c),side=T.sideOf(dir),who=crim?'피고인':'피고',accuser=crim?'검사':'원고';
 const line=i=>i.kind==='evidence'?`${i.label}${i.part?' 가운데 재판부가 증거로 쓴 부분':''}에 따르면 ${i.text.replace(/[.。]$/,'')}.`:i.weak?(i.text?`${P(i.name,'은')} "${i.text}"라고 말했다. 다만 이 말에는 이의가 있어 다른 자료와 함께 보았다.`:`${i.label}이 기록에 남아 있다.`):`${P(i.name,'은')} "${i.text}"라고 진술했다.`;
 const dec=curOf(c)?.decision;
 const order=dec?tell(c,null,side>0?dec.yesOrder:dec.noOrder):side<=0?(crim?'피고인은 무죄.':'원고의 청구를 기각한다.'):(sent?.order||(crim?'피고인을 유죄로 인정한다.':'원고의 청구를 인용한다.'));
 const facts=side===1?[`재판부는 다음 사실을 인정한다.`,...cites.map(line)]:side===0.5?[`재판부는 ${accuser}의 주장 중 증명된 부분만 인정한다.`,...cites.map(line)]
  :[`재판부는 다음 이유로 ${crim?'공소사실':'원고의 청구'}을 인정하지 않는다.`,...cites.map(line)];
 const excluded=t.evidence.filter(e=>e.decision==='exclude').map(e=>`${e.title} — ${e.flawType==='illegal'?'위법하게 수집돼 증거로 쓸 수 없다':e.flawType!=='none'?'믿기 어려운 사정이 있어 판단에서 뺐다':'판단에 필요하지 않아 뺐다'}`);
 /* v8.6.5: each issue is judged on the grounds the judge cited for it; when none were cited, on the material the judge
  * chose to use on that issue (evidence kept, testimony heard) — so the reasoning matches what was picked in court */
 const pool=citables(c,t),defense=crim?'변호인':'피고';
 const say=i=>i.kind==='evidence'?`${i.label}(${short(String(i.text||'').replace(/[.。]$/,''),38)})`:`${P(i.name,'의')} 증언("${short(String(i.text||'').replace(/[.。]$/,''),34)}")`;
 const list=a=>a.map(say).join(', ');
 const issues=issuesOf(c).map(is=>{
  let mine=cites.filter(i=>i.issue===is.id);const own=mine.length>0;if(!own)mine=pool.filter(i=>i.issue===is.id&&!i.illegal);
  const pro=mine.filter(i=>i.side==='p'),con=mine.filter(i=>i.side==='d'),nn=mine.filter(i=>i.side!=='p'&&i.side!=='d');
  const lead=own?'':'판결 이유로 따로 고르지는 않았지만, 재판부가 증거로 쓴 자료를 보면 ';
  let txt;
  if(pro.length&&con.length)txt=`${lead}${accuser} 쪽에는 ${list(pro)}, ${defense} 쪽에는 ${list(con)} 자료가 있어 서로 엇갈렸다. ${side===0.5?'재판부는 양쪽 자료를 함께 보아 일부만 인정한다.':`재판부는 ${side>0?accuser:defense} 쪽 자료를 더 믿을 만하다고 보았다.`}`;
  else if(pro.length)txt=side>0?`${lead}${list(pro)}에 비추어 ${accuser}의 주장이 인정된다.`:`${lead}${list(pro)}만으로는 의심을 지우기에 부족하다.`;
  else if(con.length)txt=side>0?`${lead}${list(con)} 같은 자료가 있으나 결론을 바꿀 정도는 아니다.`:`${lead}${list(con)}에 비추어 ${accuser}의 주장을 그대로 믿기 어렵다.`;
  else if(nn.length)txt=`${lead}${list(nn)} 자료가 있으나, 어느 한쪽 주장을 뒷받침하지는 않는다.${side>0?'':` ${accuser}이(가) 이 점을 증명하지 못했다.`}`;
  else txt=side>0?'이 쟁점을 직접 다룬 자료는 법정에 나오지 않았으나, 다른 쟁점의 판단에 비추어 결론에 영향이 없다.':`${accuser}이(가) 이 점을 증명하지 못했다. ${tell(c,t,is.open)}`;
  return {title:is.title,text:txt};
 });
 let conclusion;
 if(sp?.mode==='crim'&&sent){
  const ref=sp.ref.kind==='fine'?`벌금 ${won(sp.ref.lo)}~${won(sp.ref.hi)}`:`징역 ${ym(sp.ref.lo)}~${ym(sp.ref.hi)}`;
  const that=x=>x.endsWith('이다')?x.slice(0,-2)+'이라는':x+'는';const mit=fs.filter(f=>f[2]<0).map(f=>that(f[1])),agg=fs.filter(f=>f[2]>0).map(f=>that(f[1]));
  conclusion=`검사는 ${demandText(c)}을 구형했다. 법정형은 ${sp.ch.name}(${sp.ch.law}) ${lawText(sp)}이고, 구형을 기준으로 한 참고 범위는 ${ref}이다. ${mit.length?`유리한 사정으로 ${mit.join(', ')} 점을, `:''}${agg.length?`불리한 사정으로 ${agg.join(', ')} 점을 고려해 `:'이 사정들을 종합해 '}${sent.text}을 선고한다.`;
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
  <p class="muted small">판결문 전문은 '선고 이후' 탭에서 볼 수 있어요. 판결 리뷰 점수는 약 9시간 뒤 공개됩니다.</p>`);
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
 ${d&&(!window.VerdictVisuals||!d.excerpt)?`<p class="t4-meta">${esc(d.kind||'')} · ${esc(byWord[d.by]||d.by||'')} · ${esc(tell(c,t,d.when||''))}</p>`:''}
 ${e.scope?`<p class="t4-shows">${esc(e.scope)}</p>`:''}
 ${d?.excerpt?(window.VerdictVisuals?.evidence(e,d,tell(c,t,d.excerpt),tell(c,t,d.when||''))||`<blockquote class="t4-excerpt">${esc(tell(c,t,d.excerpt))}</blockquote>`):''}
 ${d?.how?`<p class="small"><b>확보 경위</b> ${esc(tell(c,t,d.how))}</p>`:''}
 ${e.note?`<p class="small"><b>한계</b> ${esc(e.note)}</p>`:''}
 ${d?.check?`<p class="small t4-check"><b>대조해 볼 것</b> ${esc(tell(c,t,d.check))}</p>`:''}
 ${(e.note||d?.check)?`<details class="t4-compare t4-dispute"><summary>⚖ 이 증거의 다툼과 반박 포인트</summary>
  ${e.note?`<p class="small"><b>증거의 한계</b> ${esc(e.note)}</p>`:''}
  ${d?.check?`<p class="small"><b>반대 자료와 대조할 부분</b> ${esc(tell(c,t,d.check))}</p>`:''}
  <p class="muted small">아직 반박이 입증된 것은 아닙니다. 원문을 대조한 뒤 사용할지 결정하세요.</p></details>`:''}
 ${compareBox(c,t,e)}
 ${iss?`<p class="t4-issue-tag">쟁점 · ${esc(iss.title)}</p>`:''}
 ${window.VerdictV6?.benchAdvice?.(c,t,e)||''}
 <div class="t4-row t4-choose"><span>이 증거를${e.decision?' ✔':''}</span>${opt('use','쓴다')}${opt('conditional','조건 붙여 쓴다')}${opt('exclude','뺀다')}</div>${condBox(c,t,e,locked)}</article>`;
}
const warnRow=l=>/거부|실패|없음|중단|안 됨|미입금|빠짐|빠졌|불일치|체납|연체|미지급|못/.test(l);
/* v8.6: the record the bench note points at, line by line beside this one */
function compareBox(c,t,e){
 const l=condLink(c,t,e);if(!l||l.kind!=='e')return '';
 const x=t.evidence.find(v=>v.id===l.id),a=evRows(c,t,e),b=x?evRows(c,t,x):[];if(!a.length||!b.length)return '';
 const used=e.decision==='conditional'&&e.cond?.rows,n=Math.max(a.length,b.length);
 const cell=(v,on=true)=>v==null?'<td class="nil">—</td>':`<td class="${warnRow(v)?'warn':''} ${on?'':'off'}">${esc(v)}</td>`;
 return `<details class="t4-compare" ${e.decision==='conditional'?'open':''}><summary>📊 ${esc(P(x.title,'과'))} 나란히 보기</summary>
 <table><thead><tr><th>${esc(e.title)}</th><th>${esc(x.title)}</th></tr></thead><tbody>${Array.from({length:n},(_,i)=>`<tr>${cell(a[i],!used||used.includes(i))}${cell(b[i])}</tr>`).join('')}</tbody></table>
 <small>같은 줄끼리 같은 기간·같은 항목인지 맞춰 보세요.</small></details>`;
}
/* v8.6: conditional adoption — pick the lines to use and the condition, then see whether it has been met */
function condBox(c,t,e,locked){
 if(e.decision!=='conditional')return '';
 const k=condOf(c,t,e),rows=evRows(c,t,e),dis=locked?'disabled':'',on=i=>!k.rows||k.rows.includes(i);
 if(rows.length<=1)return `<div class="t4-cond"><p class="t4-cond-h">조건 붙여 쓰기</p><p class="t4-cond-sub">이 자료는 나눌 부분이 없어요. 전부 쓰되, '쓴다'보다 가볍게 판단에 넣어요.</p></div>`;
 return `<div class="t4-cond"><p class="t4-cond-h">조건 붙여 쓰기 · 증거로 쓸 부분만 고르세요</p>
 <p class="t4-cond-sub">쓸 부분 <small>${k.rows?`${rows.length}줄 중 ${k.rows.length}줄`:'아직 전부 · 뺄 줄을 누르세요'}</small></p><ul class="t4-cond-rows">${rows.map((r,i)=>`<li><button class="t4-crow ${on(i)?'on':''} ${warnRow(r)?'warn':''}" data-action="t4" data-kind="cond" data-id="${esc(e.id)}" data-choice="row:${i}" ${dis}><span>${on(i)?'☑':'☐'}</span>${esc(r)}</button></li>`).join('')}</ul>
 <p class="t4-cond-st ${k.rows?'ok':'wait'}">${k.rows?'고른 줄만 판단과 판결문에 들어가요. 뺀 줄은 쓰지 않아요.':'줄을 빼지 않으면 자료 전체를 가볍게 판단에 넣어요.'}</p></div>`;
}
function witnessCard(w,t,locked,c){
 const i=t.witnesses.indexOf(w),p=NPC[w.id],qs=questionsOf(c,t,i),asked=w.askedIds||[],blocked=w.blocked||[];
 const heard=asked.map(id=>{const q=qById(c,t,i,id);if(!q)return '';const a={text:shownAnswer(c,t,i,q)};
  const back=t.heard.find(h=>h.w===i&&h.q===id)?.struck;
  return `<div class="t4-qa ${back?'struck':''}"><p class="q">문. ${esc(tell(c,t,q.q))}</p><p class="a">답. "${esc(a.text)}"</p>${back?'<small>⤺ 나중에 거둬들인 말</small>':''}</div>`}).join('');
 const left=qs.filter(q=>!asked.includes(q.id)&&!blocked.includes(q.id));
 const can=!locked&&t.qLeft>0;
 const objs=(w.objections||[]).map(o=>`<div class="t4-qa ${o.kept?'':'struck'}"><p class="q">✋ 이의 (${esc(o.kind)}) · 문. ${esc(o.ask)}</p>${o.answer?`<p class="a">답. "${esc(o.answer)}"</p>`:''}<small>${!o.answer?'이의를 받아들여 답을 듣기 전에 거둔 질문':o.kept?'이의를 받아들이지 않아 기록에 남은 말 · 믿을 만한 정도는 낮아요':'이의를 받아들여 판단에서 뺀 말'}</small></div>`).join('');
 const extra=objs+t.heard.filter(h=>h.w===i&&h.text).map(h=>`<div class="t4-qa v6"><p class="q">${String(h.q).startsWith('face:')?'⚖ 대질':`📁 ${esc(shownTitle(t,h)?P(shownTitle(t,h),'을')+' 보여 줌':'증거를 보여 줌')}`}</p><p class="a">"${esc(h.text)}"</p><small>${esc(h.label||'')}</small></div>`).join('');
 const cf=locked?[]:conflicts(c,t,i);
 const confrontBox=cf.length?`<div class="t4-confront"><p class="t4-ask-head">⚠ 이 증인의 말과 어긋나는 증거 <small>· 보여 주며 물으면 신문 1번</small></p>${cf.map(e=>`<button class="t4-q cf" data-action="t4" data-kind="confront" data-id="${i}" data-choice="${esc(e.id)}" ${can?'':'disabled'}>📁 ${esc(P(e.title,'을'))} 보여 주며 묻기</button>`).join('')}</div>`:'';
 return `<article class="t4-card">${window.VerdictVisuals?.witness(w,p,asked.length)||`<header><button class="t4-name" data-action="npc" data-id="${esc(w.id)}">👤 ${esc(p?.name||'증인')}</button><span class="t4-tag">${esc(w.role)}</span></header>`}
 ${w.story?`<p class="t4-story">${esc(w.story)}</p>`:''}${w.interest?`<p class="small muted">이해관계 · ${esc(w.interest)}</p>`:''}
 ${heard||'<p class="muted small">아직 묻지 않았습니다.</p>'}${extra}${confrontBox}
 ${left.length?`<p class="t4-ask-head">물어볼 질문 ${locked?'':`· 오늘 남은 신문 ${t.qLeft}/${t.qpd||QPD}`}</p>${left.map(q=>`<button class="t4-q" data-action="t4" data-kind="ask" data-id="${i}" data-choice="${esc(q.id)}" ${can?'':'disabled'}>🗣 ${esc(tell(c,t,q.q))}${q.ordered?' <i>다시 부른 질문</i>':q.hidden?' <i>새 질문</i>':''}</button>`).join('')}`:'<p class="muted small">이 증인에게 물을 질문을 모두 물었습니다.</p>'}
 ${blocked.length?`<p class="muted small">이의가 받아들여져 할 수 없는 질문 ${blocked.length}개</p>`:''}</article>`;
}
function cardBlock(card,t,c){
 const x=cardText(card,t,c);
 const exchangeKey=c.id+':'+card.id+':'+x.reason+':'+x.opinion;
 const exchange=t.aiExchange?.[card.id]?.source===exchangeKey?t.aiExchange[card.id]:null;
 if(card.type==='media')return `<div class="t4-event media"><b>📣 ${esc(x.title)}</b><p>${esc(x.body)}</p></div>`;
 const done=card.choice;
 return `<div class="t4-event ${done?'done':''}"><b>${card.type==='objection'?'✋':'⏳'} ${esc(x.title)}</b><p>${esc(x.body)}</p>
 ${x.target?`<p class="small"><b>대상</b> ${esc(x.target)}</p><blockquote class="t4-excerpt">${x.ask?`${x.prevQ?`<span class="t4-obj-line"><b>앞 질문</b> ${esc(x.askBy)}: "${esc(x.prevQ)}"</span><span class="t4-obj-line"><b>앞 답변</b> ${esc(x.wn)}: "${esc(x.prevA)}"</span>`:''}<span class="t4-obj-line"><b>${x.prevQ?'덧붙인 질문':'질문'}</b> ${esc(x.askBy)}: "${esc(x.ask)}"</span>${x.answer?`<span class="t4-obj-line"><b>답변</b> ${esc(x.wn)}: "${esc(x.answer)}"</span>`:`<span class="t4-obj-line muted small">${card.live?(card.choice==='accept'?'이의를 받아들여 증인은 답하지 않았습니다.':'증인이 답하기 전에 이의가 나왔습니다.'):'증인이 답하기 전에 이의가 나왔습니다. 받아들이지 않으면 증인 탭에서 이 질문을 할 수 있어요.'}</span>`}`:esc(x.quote)}</blockquote>`:''}
 <p class="small"><b>신청 이유</b> ${esc(exchange?.openingA||x.reason)}</p>${x.opinion?`<p class="small"><b>상대방 의견</b> ${esc(exchange?.openingB||x.opinion)}</p>`:''}
 ${x.reason&&x.opinion?`<div class="t4-row"><button class="btn outline mini" data-action="t4exchange" data-id="${esc(card.id)}" ${exchange||!window.VerdictAI?.on?'disabled':''}>${exchange?'공방 검증 완료':'AI 법정 공방 듣기'}</button></div>`:''}
 ${done?`<p class="small">→ ${esc(done==='accept'?x.choices[0]:x.choices[1])}</p>`:`<div class="t4-stack"><button class="btn mini primary" data-action="t4" data-kind="card" data-id="${esc(card.id)}" data-choice="accept">${esc(x.choices[0])}</button><button class="btn mini outline" data-action="t4" data-kind="card" data-id="${esc(card.id)}" data-choice="reject">${esc(x.choices[1])}</button></div>`}</div>`;
}
/* Where the case stands, issue by issue, from what has been shown in court so far. Nothing hidden is used.
 * Each issue reads like a judge's note: the question, then what supports each side (evidence first, then testimony),
 * what makes it harder to decide, where two witnesses contradict each other, and what is still unchecked. */
function issueFacts(c,t,is){
 const items=[];
 for(const e of t.evidence){const d=evDetail(c,e);if(d?.issue!==is.id||!(e.decision==='use'||e.decision==='conditional'))continue;
  if(e.decision!=='conditional'){items.push({kind:'증거',side:d.side||'n',who:e.title,text:e.scope||''});continue}
  const k=condOf(c,t,e),all=evRows(c,t,e).length;
  items.push({kind:'증거',side:d.side||'n',who:e.title,text:k.rows?condUsed(c,t,e).join(' · '):e.scope||'',
   note:k.rows?`조건부 · ${all}줄 중 ${k.rows.length}줄만 씀`:'조건부 · 전체를 가볍게 씀'})}
 for(const h of t.heard){if(h.issue!==is.id||h.struck||h.tainted)continue;
  if(h.text){const ev=shownTitle(t,h);items.push({kind:h.w==='party'?'진술':'증언',side:h.side||'n',who:wName(t,h.w),w:h.w,text:`"${h.text}"`,note:[h.label,ev?`${ev} 제시 뒤`:''].filter(Boolean).join(' · '),day:h.day});continue}
  const q=qById(c,t,h.w,h.q);if(!q)continue;
  items.push({kind:'증언',side:h.side||'n',who:wName(t,h.w),w:h.w,text:`"${shownAnswer(c,t,h.w,q)}"`,day:h.day})}
 return items;
}
function issueStatus(c,t,is){
 const f=issueFacts(c,t,is),p=f.filter(x=>x.side==='p').length,d=f.filter(x=>x.side==='d').length;
 const wp=f.filter(x=>x.kind==='증언'&&x.side==='p'),wd=f.filter(x=>x.kind==='증언'&&x.side==='d');
 let clash=null;for(const x of wp){const y=wd.find(v=>v.w!==x.w);if(y){clash={a:x.who,b:y.who,at:x.text,bt:y.text};break}}
 /* v8.6.4: one witness on both sides is only a changed story when that witness has actually flipped */
 const self=clash?null:(wp.find(x=>wd.some(y=>y.w===x.w)&&t.witnesses[x.w]?.flipped)?.who||null);
 const undecided=t.evidence.filter(e=>!e.decision&&evDetail(c,e)?.issue===is.id).length;
 const unasked=t.witnesses.reduce((n,w,i)=>n+questionsOf(c,t,i).filter(q=>q.issue===is.id&&!(w.askedIds||[]).includes(q.id)&&!(w.blocked||[]).includes(q.id)).length,0);
 const lean=!f.length?'open':clash||(p&&d)?'clash':p?'p':d?'d':'some';
 return {f,p,d,clash,self,undecided,unasked,lean};
}
function faceList(c,t,locked){
 if(locked)return '';const can=issuesOf(c).filter(is=>!(t.faced||[]).includes(is.id)&&clashPair(t,is.id));
 return can.length?`<div class="t4-face">${can.map(is=>{const [a,b]=clashPair(t,is.id);return `<button class="t4-q face" data-action="t4" data-kind="face" data-id="${esc(is.id)}" ${t.qLeft>=2?'':'disabled'}>⚖ 대질 신문 · ${esc(wName(t,a))} ↔ ${esc(wName(t,b))}<small>'${esc(is.title)}'에서 서로 반대쪽을 말해요 · 신문 2번</small></button>`}).join('')}</div>`:'';
}
function issueView(c,t,brief){
 const issues=issuesOf(c);if(!issues.length)return '';
 const P_=sideWord(c,'p')==='검사'?'검찰':'원고',D_=sideWord(c,'p')==='검사'?'변호인':'피고';
 const LEAN={open:'아직 근거 없음',clash:'양쪽 근거가 맞섬',p:`${P_} 쪽 근거만 있음`,d:`${D_} 쪽 근거만 있음`,some:'참고 사실만 있음'};
 if(brief)return `<div class="t4-iss-brief">${issues.map(is=>{const s=issueStatus(c,t,is);
  return `<button class="t4-ib ${s.lean}" data-action="t4tab" data-tab="verdict"><b>${esc(is.title)}</b><span><i class="p">${P_} ${s.p}</i><i class="d">${D_} ${s.d}</i>${s.clash?'<i class="x">⚠ 반대쪽 증언</i>':s.self?'<i class="x">⚠ 말 바뀜</i>':''}</span></button>`}).join('')}</div>`;
 const li=x=>`<li><span class="k ${x.kind==='증거'?'ev':'wt'}">${x.kind}</span><b>${esc(x.who)}</b> ${esc(x.text)}${x.note?`<small>${esc(x.note)}</small>`:''}</li>`;
 const group=(cls,label,list)=>list.length?`<div class="t4-side ${cls}"><p>${label}</p><ul>${list.sort((a,b)=>(a.kind==='증거'?0:1)-(b.kind==='증거'?0:1)).map(li).join('')}</ul></div>`:'';
 return `<div class="t4-issues">${issues.map((is,n)=>{const s=issueStatus(c,t,is),f=s.f;
  const todo=[s.undecided?`정하지 않은 증거 ${s.undecided}건`:'',s.unasked?`묻지 않은 질문 ${s.unasked}개`:''].filter(Boolean).join(' · ');
  return `<div class="t4-issue ${s.lean}"><div class="t4-ih"><span class="n">쟁점 ${n+1}</span><b>${esc(is.title)}</b><em>${LEAN[s.lean]}</em></div>
  ${f.length?group('p',`${P_} 주장을 뒷받침`,f.filter(x=>x.side==='p'))+group('d',`${D_} 주장을 뒷받침`,f.filter(x=>x.side==='d'))+group('m','판단을 어렵게 하는 사정',f.filter(x=>x.side==='m'))+group('n','양쪽 모두 다투지 않는 사실',f.filter(x=>x.side==='n'))
   :`<p class="t4-open">${esc(tell(c,t,is.open))}</p>`}
  ${s.clash?`<p class="t4-clash">⚠ ${esc(s.clash.a)}의 말은 ${P_} 쪽, ${esc(s.clash.b)}의 말은 ${D_} 쪽을 가리켜요.<small>${esc(s.clash.a)} ${esc(short(s.clash.at,46))} · ${esc(s.clash.b)} ${esc(short(s.clash.bt,46))}</small> ${(t.faced||[]).includes(is.id)?'대질 신문을 마쳤어요.':sessionOpen(t)&&!waiting(t)&&!S.cases[c.id]?.verdict?'증인 탭에서 두 사람을 대질 신문할 수 있어요.':'누구 말을 믿을지가 이 쟁점의 열쇠예요.'}</p>`:s.self?`<p class="t4-clash">⚠ ${esc(s.self)}의 말이 중간에 바뀌었어요. 처음 말과 바뀐 말 중 어느 쪽이 맞는지가 이 쟁점의 열쇠예요.</p>`:''}
  ${(()=>{const back=t.heard.filter(h=>h.issue===is.id&&h.struck&&!h.tainted).length;return back?`<p class="t4-gap">⤺ 증인이 스스로 거둬들인 말 ${back}개는 판단에서 뺐어요.</p>`:''})()}
  ${todo?`<p class="t4-gap">아직 확인할 것 · ${esc(todo)}</p>`:''}</div>`}).join('')}</div>`;
}
const HELP=`<details class="t4-help"><summary>❔ 재판은 이렇게 진행돼요</summary><ol><li><b>증거</b> 탭에서 원문과 확보 경위를 읽고 <b>쓸지, 조건 붙여 쓸지, 뺄지</b> 정하세요. 불법으로 얻은 증거는 쓸 수 없어요.</li><li><b>증인</b> 탭에서 질문을 고르세요. 한 기일에 ${QPD}번까지 물을 수 있고, 답에 따라 새 질문이 열려요. 묻지 않은 질문의 답은 판결 전까지 모를 수 있어요.</li><li>기일이 열리면 상대가 이의나 연기를 신청할 때가 있어요. 대상과 이유를 읽고 받아들일지 정하세요.</li><li>정해진 횟수만큼 기일을 마치면 <b>판결</b> 탭에서 결론, 형량(배상액), 판결 이유를 정해 선고하세요.</li></ol></details>`;
function tabsFor(c,st){
 const t=st.trial4;
 if(st.verdict)return [['result','선고 이후'],['case','사건'],['log','기록']];
 const pending=waiting(t)?0:t.cards.filter(pend).length,undecided=t.evidence.filter(e=>!e.decision).length,ready=t.daysDone>=t.minDays;
 const orderable=!waiting(t)&&canOrder(c,t)&&!(t.courtOrders||[]).some(o=>o.day===t.day)&&availableOrders(c,t).length>0;
 const newW=t.witnesses.filter(isNewW).length,newE=t.evidence.filter(isNewEv).length;
 return [['case','사건'],['day','기일',pending],['evidence','증거',newE?'🆕':undecided],['witness','증인',newW?'🆕':0],['orders','주문',orderable?'📜':(t.courtOrders||[]).filter(o=>o.status==='pending').length],['verdict','판결',ready?'!':0]];
}
/* New material first: evidence that arrived during the trial and is not yet decided, witnesses called by an order and
 * not yet questioned. ui.t4ev / ui.t4w keep the item's own index, so the rest of the screen is unaffected. */
const isNewEv=e=>!!(e.follow||e.late)&&!e.decision;
const isNewW=w=>!!w.follow&&!(w.askedIds||[]).length;
function orderOf(kind,items){
 const isNew=kind==='evidence'?isNewEv:isNewW,idx=items.map((_,k)=>k);
 const fresh=idx.filter(k=>isNew(items[k])).sort((x,y)=>(items[y].arrivedDay||0)-(items[x].arrivedDay||0)||y-x);
 return [...fresh,...idx.filter(k=>!fresh.includes(k))];
}
function pager(kind,items,render,label){
 if(!items.length)return `<p class="muted">${label}이(가) 없습니다.</p>`;
 const key=kind==='evidence'?'t4ev':'t4w',ord=orderOf(kind,items);
 let cur=ui[key];if(cur==null||cur<0||cur>=items.length)cur=ord[0];ui[key]=cur;const pos=ord.indexOf(cur);
 const isNew=kind==='evidence'?isNewEv:isNewW;
 const dots=ord.map((k,n)=>`<button class="t4-dot ${k===cur?'on':''} ${isNew(items[k])?'new':''}" data-action="t4page" data-kind="${kind}" data-i="${k}" aria-label="${n+1}번째${isNew(items[k])?' (새로 나옴)':''}"></button>`).join('');
 const it=items[cur],badge=isNew(it)?`<div class="t4-newflag">🆕 ${kind==='evidence'?(it.late?'새로 제출된 증거':'재판장 주문으로 들어온 증거'):'재판장 주문으로 새로 나온 증인'}${it.arrivedDay?` · ${esc(String(it.arrivedDay))}번째 기일`:''} — 먼저 확인하세요</div>`:'';
 const nNew=ord.filter(k=>isNew(items[k])).length;
 return `<div class="t4-pager" data-kind="${kind}" data-n="${items.length}">${nNew&&!isNew(it)?`<button class="t4-newjump" data-action="t4page" data-kind="${kind}" data-i="${ord[0]}">🆕 새로 나온 ${kind==='evidence'?'증거':'증인'} ${nNew}건 먼저 보기</button>`:''}${badge}${render(it)}
 <div class="t4-pagenav"><button class="t4-chip" data-action="t4page" data-kind="${kind}" data-i="${ord[pos-1]??cur}" ${pos<=0?'disabled':''}>‹ 이전</button><div class="t4-dots">${dots}<span>${pos+1} / ${items.length}</span></div><button class="t4-chip" data-action="t4page" data-kind="${kind}" data-i="${ord[pos+1]??cur}" ${pos>=items.length-1?'disabled':''}>다음 ›</button></div></div>`;
}
/* Today's checklist: what to do in this session, in order. */
function todo(c,t){
 const pending=t.cards.filter(pend).length,answered=t.cards.filter(v=>v.choice&&v.type!=='media').length;
 const decided=t.evidence.filter(e=>e.decision).length,askedToday=t.heard.filter(h=>h.day===t.day&&!h.tainted).length;
 const steps=[];
 if(!sessionOpen(t))return `<ol class="t4-todo"><li><button data-action="t4" data-kind="open">▶ ${esc(session(c,t.day))} 열기 — 상대 측 신청과 새 소식은 공판을 열면 전해져요</button></li></ol>`;
 if(pending||answered)steps.push({done:!pending,text:pending?`상대 측 신청 ${pending}건에 답하기`:'상대 측 신청에 답했어요',go:pending?'requests':'day'});
 steps.push({done:decided===t.evidence.length,text:`증거를 읽고 쓸지 정하기 · ${decided}/${t.evidence.length}`,go:'evidence'});
 steps.push({done:t.qLeft===0,text:`증인 신문 · 오늘 ${askedToday}번 물음 (남은 ${t.qLeft}번)`,go:'witness'});
 steps.push({done:false,text:t.daysDone+1>=t.minDays?`${session(c,t.day)} 마치기 → 그다음 판결할 수 있어요`:`${session(c,t.day)} 마치기 → 다음 기일 잡기`,go:'end'});
 return `<ol class="t4-todo">${steps.map(x=>`<li class="${x.done?'done':''}"><button data-action="t4go" data-go="${x.go}">${x.done?'✔':'•'} ${esc(x.text)}</button></li>`).join('')}</ol>`;
}
/* P1: opening statements use only the case engine's already disclosed claims.
 * Rendering never calls AI, mutates the trial, or exposes any hidden truth.
 * Later wording enhancement can be applied to these same fixed statements. */
function openingStatements(c,t,cur){
 if(t.daysDone!==0||!cur?.claims)return '';
 const left=tell(c,t,cur.claims[0]||''),right=tell(c,t,cur.claims[1]||'');
 if(!left&&!right)return '';
 if(left&&right&&sessionOpen(t))window.VerdictAI?.opening?.(c,t,left,right);
 const key=c.id+':'+left+':'+right,ai=t.aiOpening?.source===key?t.aiOpening:null;
 const card=(speaker,body,cls)=>body?`<div class="t4-closing ${cls}"><b>${esc(speaker)}</b><p>"${esc(body)}"</p></div>`:'';
 return `<section class="t4-opening" aria-label="첫 기일 양측 주장">
   <div class="t4-subhead"><h4>첫 기일 · 양측 입장</h4></div>
   <p class="muted small">두 주장은 사건 기록을 바탕으로 표시됩니다. 증거를 살피고 어느 쪽을 믿을지는 재판장이 판단합니다.</p>
   ${card(sideWord(c,'p'),ai?.openingA||left,'p')}${card(sideWord(c,'d'),ai?.openingB||right,'d')}
   <div class="t4-row"><button class="btn outline mini" data-action="t4tab" data-tab="evidence">증거 검토</button><button class="btn outline mini" data-action="t4tab" data-tab="witness">증인신문</button></div>
  </section>`;
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
  <div class="t4-row">${can?'<button class="btn primary mini" data-action="t4tab" data-tab="verdict" data-sheet="1">판결하러 가기</button>':''}<button class="btn outline mini" data-action="tab" data-tab="courtList">다른 사건 보기</button></div></div>
  <div class="t4-subhead"><h4>쟁점 한눈에</h4><button class="t4-link" data-action="t4tab" data-tab="verdict">자세히 ›</button></div>${issueView(c,t,true)}${outside}${recent}</section>`;
 }
 const act=(()=>{if(!cur?.acts?.length)return '';const i=Math.min(cur.acts.length-1,Math.floor(t.daysDone*cur.acts.length/Math.max(1,t.minDays)));const a=cur.acts[i];return `<div class="t4-act"><small>오늘의 법정 · ${esc(a.title)}</small><p>${esc(tell(c,t,a.text))}</p></div>`})();
 const opponentLine=`<div class="t4-oppcard"><span>상대 ${esc(sideWord(c,'d'))}</span>${nameBtn(t.opponent,opp?.name||'변호인')}<small>${esc(T.LABEL.style[t.style])} · ${prepWord(t.opponent)}${rec&&(rec.win+rec.lose)?` · 내 법정 ${rec.win}승 ${rec.lose}패`:''}</small></div>`;
 return `<section class="panel t4 t4-day"><div class="t4-head"><h3>${esc(session(c,t.day))}</h3><span class="t4-tag">${esc(dlabel(dateOf(t)))} · ${t.daysDone+1}/${t.minDays}회</span></div>
 ${act}
 ${openingStatements(c,t,cur)}
 ${changesBlock(c,t)}
 ${ordersHint(c,t)}
 <h4>오늘 할 일</h4>${todo(c,t)}
 ${t.cards.filter(v=>v.type==='media').map(x=>cardBlock(x,t,c)).join('')}
 ${said}
 <div class="t4-subhead"><h4>쟁점 한눈에</h4><button class="t4-link" data-action="t4tab" data-tab="verdict">자세히 ›</button></div>${issueView(c,t,true)}
 ${opponentLine}${outside}
 ${t.cards.some(v=>v.choice&&v.type!=='media')?`<details class="t4-more"><summary>오늘 답한 신청</summary>${t.cards.filter(v=>v.choice&&v.type!=='media').map(x=>cardBlock(x,t,c)).join('')}</details>`:''}
 ${recent}</section>`;
}
/* P1: research memo uses only evidence admitted and testimony heard in this trial.
 * No hidden truth, score, verdict option or unasked testimony is read here. */
function benchSource(c,t){
 const issues=issuesOf(c).slice(0,5);
 if(!issues.length)return '';
 return issues.map(is=>{
  const v=issueStatus(c,t,is);
  const issuesText=v.f.slice(0,3).map(x=>x.kind+' '+x.who+': '+short(x.text,90)).join(' / ');
  const todo=[v.undecided?'미결정 증거 '+v.undecided+'건':'',v.unasked?'미신문 질문 '+v.unasked+'개':''].filter(Boolean).join(', ');
  return '쟁점 '+is.title+' — 검사·원고 측 자료 '+v.p+'건, 변호·피고 측 자료 '+v.d+'건. '+(issuesText||'채택된 자료 없음.')+'. '+(todo?'남은 확인: '+todo+'.':'추가 확인 과제 없음.');
 }).join(' ').slice(0,1200);
}
function benchPanel(c,t){
 const source=benchSource(c,t),ai=t.aiBench?.source===source?t.aiBench.text:null;
 if(!source)return '';
 return `<section class="t4-card t4-bench" aria-label="재판연구원 검토">
  <div class="t4-subhead"><h4>재판연구원 · 쟁점 검토</h4></div>
  <p class="muted small">채택한 증거와 실제로 들은 증언만 반영합니다. AI는 결론·형량을 추천하지 않으며, 판결은 재판장이 결정합니다.</p>
  <p class="small">${esc(ai||source)}</p>
  <button class="btn outline mini" data-action="t4bench" ${!window.VerdictAI?.on||!!ai?'disabled':''}>${ai?'검토 완료':window.VerdictAI?.on?'AI 문장으로 정리하기':'AI 연결 시 사용 가능'}</button>
 </section>`;
}
function verdictPage(c,st){
 const t=st.trial4,canVerdict=t.daysDone>=t.minDays,cur=curOf(c),v=vstate(c),crim=isCriminal(c);
 partialOption(c);
 const opt=c.verdicts.find(o=>o.id===v.opt),dir=opt&&T.direction(opt,c.kind),sp=opt&&sentenceSpec(c,dir);
 const first=cur?tell(c,t,cur.closing):'',second=cur?tell(c,t,cur.claims?.[1]||''):'';
 const closingKey=c.id+':'+first+':'+second;
 if(canVerdict&&first&&second)window.VerdictAI?.closing?.(c,t,first,second);
 const aiClosing=t.aiClosing?.source===closingKey?t.aiClosing:null;
 const closing=cur?`<div class="t4-subhead"><h4>최종 변론 · 양측 입장</h4></div>
  <div class="t4-closing"><b>${esc(sideWord(c,'p'))} 최종 ${crim?'논고':'변론'}</b><p>"${esc(aiClosing?.openingA||first)}"</p>${crim?`<p class="small">구형: <b>${esc(demandText(c))}</b></p>`:(cur.decision?`<p class="small">신청: <b>${esc(tell(c,t,cur.decision.what))}</b></p>`:`<p class="small">청구: <b>${won(cur.claim?.amount||0)}</b> · ${esc(cur.claim?.what||'')}</p>`)}</div>
  <div class="t4-closing d"><b>${esc(sideWord(c,'d'))} 최종 변론</b><p>"${esc(aiClosing?.openingB||second)}"</p></div>`:'';
 claimNotes(c);const optBtns=c.verdicts.map(o=>`<button class="choice ${v.opt===o.id?'on':''}" data-action="t4verdict" data-id="${esc(o.id)}" ${canVerdict?'':'disabled'}><span class="choice-index">${v.opt===o.id?'✔':'⚖'}</span><span><strong>${esc(plainLabel(o))}</strong><small>${esc(plainNote(o))}</small></span></button>`).join('');
 /* the sentence or amount: only what the law allows for this case (v8.2) */
 let sentence='';
 if(sp?.mode==='crim'){
  const ch=sp.ch,pen=sp.pen,L=legalMonths(sp,v),fineMax=pen.fineMax||ch.fine,unit=fineUnit(fineMax);
  const types=[['prison','징역(실형)'],...(L.min<=36?[['suspend','징역(집행유예)']]:[]),...(ch.fine&&pen.both!=='must'?[['fine','벌금']]:[]),...(pen.life?[['life','무기징역']]:[]),...(pen.death?[['death','사형']]:[])];
  if(!types.some(x=>x[0]===v.type))v.type=types[0][0];
  const cant=[L.min>36?'집행유예: 징역 3년 이하를 선고할 때만 가능해요':'',!ch.fine?'벌금: 이 죄의 법정형에는 벌금이 없어요':'',pen.both==='must'?'벌금만 선고: 이 죄는 징역과 벌금을 함께 선고해야 해요':''].filter(Boolean);
  const ref=sp.ref.kind==='fine'?`벌금 ${won(sp.ref.lo)}~${won(sp.ref.hi)}`:`징역 ${ym(sp.ref.lo)}~${ym(sp.ref.hi)}`;
  const fineCtl=`<div class="t4-step"><span>벌금</span><button class="t4-chip" data-action="t4v" data-k="fine" data-v="-5">−${won(unit*5).replace(' 원','')}</button><button class="t4-chip" data-action="t4v" data-k="fine" data-v="-1">−${won(unit).replace(' 원','')}</button><b>${won(v.fine||unit)}</b><button class="t4-chip" data-action="t4v" data-k="fine" data-v="1">+${won(unit).replace(' 원','')}</button><button class="t4-chip" data-action="t4v" data-k="fine" data-v="5">+${won(unit*5).replace(' 원','')}</button></div>
   <label class="t4-direct">직접 입력 <input type="text" inputmode="numeric" data-t4input="setFine" value="${v.fine||unit}"> 만 원 <small class="muted">(${won(unit)} 단위, 최대 ${won(fineMax)})</small></label>`;
  const jail=v.type==='prison'||v.type==='suspend';
  sentence=`<p class="small">${esc(ch.name)} · ${esc(ch.law)} · 법정형 ${lawText(sp)}</p>
  <p class="small">검사 구형 <b>${esc(demandText(c))}</b> · 참고 범위 <b>${ref}</b><br><span class="muted">참고 범위는 구형을 기준으로 단순 계산한 값이에요. 법정형 안에서 자유롭게 정할 수 있어요.${L.reduced?' 감경 사유를 고르면 법정형 하한의 절반까지 내릴 수 있어요.':''}</span></p>
  <p class="t4-ask-head">어떤 형을 선고할까요</p><div class="t4-seg wrap t4-types">${types.map(([k,l])=>`<button class="t4-chip ${v.type===k?'on':''}" data-action="t4v" data-k="type" data-v="${k}">${l}</button>`).join('')}</div>
  ${cant.length?`<p class="muted small">고를 수 없는 형 · ${cant.map(esc).join(' / ')}</p>`:''}
  ${jail?`<div class="t4-step"><span>징역</span><button class="t4-chip" data-action="t4v" data-k="months" data-v="-12">−1년</button><button class="t4-chip" data-action="t4v" data-k="months" data-v="-6">−6개월</button><b>${ym(v.months||12)}</b><button class="t4-chip" data-action="t4v" data-k="months" data-v="6">+6개월</button><button class="t4-chip" data-action="t4v" data-k="months" data-v="12">+1년</button></div>
   <p class="muted small">6개월 단위 · 고를 수 있는 범위 ${ym(L.min)} ~ ${ym(v.type==='suspend'?Math.min(36,L.max):L.max)}</p>
   ${v.type==='suspend'?`<p class="t4-ask-head">집행유예 기간 <small class="muted">(1~5년)</small></p><div class="t4-seg t4-years">${[1,2,3,4,5].map(n=>`<button class="t4-chip ${(v.susp||2)===n?'on':''}" data-action="t4v" data-k="susp" data-v="${n}">${n}년</button>`).join('')}</div>`:''}`:''}
  ${v.type==='death'?`<p class="notice small">사형은 법정형에 사형이 있는 죄에서만 고를 수 있어요. 가장 무거운 형이라 판결 이유가 특히 단단해야 해요.</p>`:''}
  ${(jail||v.type==='life')&&pen.both==='may'?`<button class="t4-chip ${v.withFine?'on':''}" data-action="t4v" data-k="withFine" data-v="1">${v.withFine?'☑':'☐'} 벌금도 함께 선고</button>`:''}
  ${v.type==='fine'||((jail||v.type==='life')&&pen.both&&v.withFine)?fineCtl:''}
  <p class="t4-ask-head">양형 사유</p><div class="t4-seg wrap t4-factors">${CRIM_FACTORS.filter(([k])=>!(curOf(c)?.victimless&&(k==='repair'||k==='vuln'))).map(([k,l,d])=>`<button class="t4-chip ${v.factors.includes(k)?'on':''} ${d<0?'mit':'agg'}" data-action="t4v" data-k="factor" data-v="${k}">${d<0?'↓':'↑'} ${l}</button>`).join('')}</div>${addonBlock(c,v)}`;
 }else if(sp?.mode==='civil'){
  sentence=`<p class="small">원고 청구 <b>${won(sp.cl.amount)}</b> · ${esc(sp.cl.what)}${sp.full?'':`<br>입증된 손해의 참고 범위 <b>${won(sp.ref.lo)}~${won(sp.ref.hi)}</b>`}</p>
  ${sp.full?`<p class="small">전부 인용: <b>${won(sp.cl.amount)}</b> 지급</p>`:`<div class="t4-step"><span>배상액</span>${(u=>{const big=u*10,lb=n=>won(n).replace(/ 원$/,'');return `<button class="t4-chip" data-action="t4v" data-k="amount" data-v="-10">−${lb(big)}</button><button class="t4-chip" data-action="t4v" data-k="amount" data-v="-1">−${lb(u)}</button><b>${won(v.amount||0)}</b><button class="t4-chip" data-action="t4v" data-k="amount" data-v="1">+${lb(u)}</button><button class="t4-chip" data-action="t4v" data-k="amount" data-v="10">+${lb(big)}</button>`})(amountUnit(sp))}</div>
   <label class="t4-direct">직접 입력 <input type="text" inputmode="numeric" data-t4input="setAmount" value="${v.amount||0}"> 만 원 <small class="muted">(청구한 ${won(sp.cl.amount)}까지)</small></label>
   <p class="muted small">${(v.amount||0)<sp.cl.amount?'일부만 인정하면 판결문에 "원고의 나머지 청구를 기각한다"가 붙어요.':'청구 금액 전부를 인정해요.'}</p>`}
  <p class="t4-ask-head">판단 사유</p><div class="t4-seg wrap t4-factors">${CIVIL_FACTORS.map(([k,l,d])=>`<button class="t4-chip ${v.factors.includes(k)?'on':''} ${d<0?'mit':'agg'}" data-action="t4v" data-k="factor" data-v="${k}">${d<0?'↓':'↑'} ${l}</button>`).join('')}</div>${remedyBlock(c,v)}`;
 }
 const items=citables(c,t);
 const citeList=items.length?items.map(i=>`<button class="t4-cite ${v.cites.includes(i.key)?'on':''} ${i.weak?'weak':''}" data-action="t4v" data-k="cite" data-v="${esc(i.key)}"><b>${v.cites.includes(i.key)?'☑':'☐'} ${esc(i.label)}</b>${i.text?`<small>${esc(short(i.text,70))}</small>`:''}${i.weak?'<small class="t4-weak">이의가 있었던 말 · 믿을 만한 정도가 낮아요</small>':''}${i.cond?`<small class="t4-weak">${i.part?'조건부 · 고른 부분만 쓴 자료':'조건부 · 전체를 가볍게 쓴 자료'}</small>`:''}</button>`).join(''):'<p class="notice">쓰기로 정한 증거나 들은 증언이 없습니다. 창을 닫고 증거 탭과 증인 탭을 먼저 확인하세요.</p>';
 const pend_=(t.courtOrders||[]).filter(o=>o.status==='pending').length;
 const overview=`<section class="panel t4 t4-verdict-home"><h3>⚖ 판결</h3>${canVerdict?'':`<p class="notice">기일이 ${t.minDays-t.daysDone}번 더 필요해요.${waiting(t)?` ${esc(session(c,t.day))}은 ${esc(dlabel(Math.max(t.nextDate||0,today())))}에 열려요.`:''}</p>`}
 ${pend_?`<p class="notice">아직 결과가 오지 않은 재판장 주문이 ${pend_}건 있어요. 지금 선고해도 되지만, 그 결과는 판단에 들어가지 않아요.</p>`:''}
 ${closing}${benchPanel(c,t)}<h4>재판 현황</h4>${issueView(c,t)}
 <button class="btn primary full mt t4-sheet-open" data-action="t4sheet" data-v="open" ${canVerdict?'':'disabled'}>⚖ 판결하기</button></section>`;
 if(!ui.vsheet||ui.vsheet!==c.id||!canVerdict)return overview;
 /* the verdict window (v8.2): 결론 → 주문 → 판결 이유 → 판결문 미리보기 → 선고 */
 const steps=[['opt','결론'],...(sp?[['sent','주문']]:[]),['why','판결 이유'],['doc','미리보기'],['ok','선고']];
 let at=Math.min(ui.vstep||0,steps.length-1);if(!opt)at=0;ui.vstep=at;
 const done={opt:!!opt,sent:!!opt,why:v.cites.length>0,doc:v.cites.length>0,ok:false};
 const key=steps[at][0];
 const sent=opt&&sentenceOf(c,sp,v);
 const allF=[...CRIM_FACTORS,...CIVIL_FACTORS],facts=v.factors.map(k=>allF.find(f=>f[0]===k)?.[1]).filter(Boolean);
 const chosen=items.filter(i=>v.cites.includes(i.key));
 const draft=key==='doc'||key==='ok'?(()=>{const fs=(v.factors||[]).map(f=>(sp?.mode==='civil'?CIVIL_FACTORS:CRIM_FACTORS).find(x=>x[0]===f)).filter(Boolean);return writeJudgment(c,t,opt,dir,chosen,sp,sent,fs)})():null;
 const body=key==='opt'?`<p class="t4-sheet-lead">이 사건의 결론을 고르세요.</p>${optBtns}`
  :key==='sent'?`<p class="t4-sheet-lead">${crim?'어떤 형을 얼마나 선고할지 정하세요.':'얼마를 지급하라고 할지 정하세요.'}</p>${sentence}`
  :key==='why'?`<p class="t4-sheet-lead">판결문에 근거로 적을 증거와 증언을 고르세요. 개수 제한은 없지만, 결론과 반대쪽 자료나 확인하지 못한 자료를 많이 고르면 판결이 약해져요. 쓰기로 정한 증거와 법정에서 들은 증언만 고를 수 있어요. 이의를 받아들여 뺀 말은 목록에 없어요.</p>${citeList}`
  :key==='doc'?`<p class="t4-sheet-lead">선고하기 전에 판결문을 읽어 보세요. 고치려면 앞 단계로 돌아가면 돼요.</p>${judgmentView(draft)}`
  :`<div class="t4-sheet-sum"><p><span>결론</span><b>${esc(plainLabel(opt))}</b></p><p><span>주문</span><b>${esc(draft?.order||'')}</b></p>${facts.length?`<p><span>${crim?'양형 사유':'판단 사유'}</span><b>${esc(facts.join(' · '))}</b></p>`:''}<p><span>판결 이유</span><b>${chosen.length?esc(chosen.map(i=>i.label).join(' · ')):'아직 고르지 않음'}</b></p></div>
   <p class="muted small">선고하면 되돌릴 수 없어요. 이 세계에는 항소가 없고, 판결은 당사자들의 삶에 그대로 남아요.</p>
   <button class="btn primary full mt" data-action="t4confirm" ${v.cites.length?'':'disabled'}>⚖ 선고하기</button>`;
 const nextOk=key==='opt'?done.opt:key==='why'?done.why:true,reach=i=>i<=at||(done.opt&&(!['doc','ok'].includes(steps[i][0])||done.why));
 const sheet=`<div class="t4-sheet-veil" role="presentation"><section class="t4-sheet t4 t4-verdict" role="dialog" aria-modal="true" aria-label="판결 작성">
  <header class="t4-sheet-head"><div><small>판결 작성</small><b>${esc(shortName(c))}</b></div><button class="t4-sheet-x" data-action="t4sheet" data-v="close" aria-label="닫기">×</button></header>
  <ol class="t4-steps">${steps.map(([k,l],i)=>`<li class="${i===at?'on':''} ${i<at?'done':''}"><button data-action="t4sheet" data-v="${i}" ${reach(i)?'':'disabled'}><span>${i<at?'✓':i+1}</span>${l}</button></li>`).join('')}</ol>
  <div class="t4-sheet-body">${body}</div>
  <footer class="t4-sheet-foot">${at>0?`<button class="btn outline" data-action="t4sheet" data-v="${at-1}">← 이전</button>`:'<span></span>'}${key!=='ok'?`<button class="btn primary" data-action="t4sheet" data-v="${at+1}" ${nextOk?'':'disabled'}>다음 →</button>`:''}</footer>
 </section></div>`;
 return overview+sheet;
}
function dock(c,st){
 const t=st.trial4;if(st.verdict)return '';
 const wait=waiting(t),pending=t.cards.filter(pend).length,moreDays=!isDecision(c)&&t.daysDone<t.minDays+EXTRA_DAYS;
 if(wait&&t.daysDone>=t.minDays)return `<div class="t4-dock"><span class="small">${moreDays?`기일 더 열기: ${clock(t.nextAt)}부터 (${minsLeft(t)}분 남음)`:`다음 기일 ${clock(t.nextAt)} (${minsLeft(t)}분 남음)`}</span><button class="btn primary" data-action="t4tab" data-tab="verdict" data-sheet="1">판결하러 가기</button></div>`;
 if(!wait&&!sessionOpen(t))return `<div class="t4-dock"><span class="small">${esc(session(c,t.day))} · ${esc(dlabel(dateOf(t)))}</span><button class="btn primary" data-action="t4" data-kind="open">▶ ${esc(session(c,t.day))} 열기</button></div>`;
 if(wait)return `<div class="t4-dock"><span>⏳ ${esc(session(c,t.day))} · ${clock(t.nextAt)} (${minsLeft(t)}분 뒤)</span><button class="btn outline mini" data-action="tab" data-tab="courtList">다른 사건</button></div>`;
 const main=pending?`<button class="btn primary" data-action="t4go" data-go="requests">상대 신청 ${pending}건 답하기</button>`
  :(moreDays||t.daysDone<t.minDays)?`<button class="btn primary" data-action="t4end">${t.daysDone>=t.minDays?'기일 더 열기':`${session(c,t.day)} 마치기`}</button>`
  :`<button class="btn primary" data-action="t4tab" data-tab="verdict" data-sheet="1">판결하러 가기</button>`;
 return `<div class="t4-dock"><span class="small">신문 ${t.qLeft}/${t.qpd||QPD}</span>${t.daysDone>=t.minDays&&moreDays&&!pending?`<button class="btn outline" data-action="t4tab" data-tab="verdict" data-sheet="1">판결</button>`:''}${main}</div>`;
}
function judgmentView(j){
 if(!j)return '';
 return `<div class="t4-judgment"><h4>📜 판결문</h4><p class="t4-order"><b>주문</b> ${esc(j.order)}</p>
 <p><b>1. 인정 사실</b></p><ul>${j.facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>
 ${j.excluded.length?`<p><b>판단에서 뺀 자료</b></p><ul>${j.excluded.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:''}
 <p><b>2. 쟁점별 판단</b></p>${j.issues.map(i=>`<p class="small"><b>${esc(i.title)}</b> — ${esc(i.text)}</p>`).join('')}
 <p><b>3. 결론${j.conclusion.includes('선고')||j.conclusion.includes('인정한다')?'과 양형':''}</b></p><p class="small">${esc(j.conclusion)}</p></div>`;
}
/* v8.2: what the judgment did to the people (from npc_life_justice.applySentenced) */
/* v8.3: a case can say in its own words what the judgment did to each party (after.A/B.yes|no|part) */
function afterLines(c,st){
 const A=curOf(c)?.after,z=st.sentenced;if(!A||!z)return [];const key=z.side>0&&z.side<1&&A.A?.part!=null?'part':z.side>0?'yes':'no';
 return ['A','B'].map((k,i)=>{const x=A[k]?.[key];if(!x)return null;const id=c.who?.[i];return {id,text:`${NPC[id]?.name||(k==='A'?'피고인':'상대방')} — ${tell(c,st.trial4,x)}`}}).filter(Boolean);
}
function lifeAfter(st,c){
 const own=c?afterLines(c,st):[];
 if(own.length)return `<div class="t4-act"><small>판결 뒤 당사자들의 삶</small>${own.map(r=>`<p>${esc(r.text)}</p>`).join('')}</div>`;
 const fx=st.lifeConsequence?.effects||[];if(!fx.length)return '';
 const nm=id=>NPC[id]?.name||'당사자',man=n=>won(n);
 const line=e=>({수감:`${nm(e.npcId)} — 교정시설에 수감됐어요. 직장을 잃었고 살던 집을 떠났어요.`,life:`${nm(e.npcId)} — 무기징역으로 교정시설에 수감됐어요.`,death:`${nm(e.npcId)} — 사형이 확정돼 교정시설에 수감됐어요.`,
  집행유예:`${nm(e.npcId)} — 집행유예 ${e.years}년. 교도소에는 가지 않지만 전과가 남았어요.`,벌금:`${nm(e.npcId)} — 벌금 ${man(e.amount)}을 내야 해요.`,
  지급:`${nm(e.npcId)} — ${man(e.amount)}을 지급해야 해요.`,수령:`${nm(e.npcId)} — ${man(e.amount)}을 받게 됐어요.`,무죄:`${nm(e.npcId)} — 무죄로 일상에 돌아가요.`}[e.type]||'');
 const rows=fx.map(line).filter(Boolean);
 return rows.length?`<div class="t4-act"><small>판결 뒤 당사자들의 삶</small>${rows.map(r=>`<p>${esc(r)}</p>`).join('')}</div>`:'';
}
function resultPanel(c,st){
 const t=st.trial4,f=t?.final;if(!f)return '';
 const reviewed=f.reviewShown||now()>=f.reviewAt,dk=f.desk;
 const groups={anger:'분노',sympathy:'동정',cynic:'냉소',legal:'법리 옹호',flaw:'법리 옹호'};
 const comments=(f.sns||[]).map(x=>`<div class="t4-sns ${x.pol==='+'?'pos':x.pol==='-'||x.pol==='?'?'neg':''}"><b>${esc(x.nick)}</b>${x.cluster?` <span class="t4-tag">${groups[x.cluster]||''}</span>`:''}<p>${esc(x.text)}</p><small>▲ ${x.likes}</small>${x.reply?`<div class="t4-reply">↳ <b>${esc(x.reply.nick)}</b> ${esc(x.reply.text)}</div>`:''}</div>`).join('');
 return `<section class="panel t4"><h3>📰 선고 이후</h3>
 <div class="t4-stats"><span>판결 실력 <b>${f.skill}</b></span><span>여론과 맞은 정도 <b>${f.match}</b></span><span>판결 리뷰 <b>${reviewed?f.review:'공개 전'}</b></span></div>
 ${reviewed?`<p class="small">${f.evaluators.map(e=>`${esc(e.name)} ${e.score}점`).join(' · ')}</p>`:`<p class="muted small">판결 리뷰는 ${Math.max(1,Math.ceil((f.reviewAt-now())/HOUR))}시간 뒤 공개됩니다.</p>`}
 ${window.VerdictV6?.truthPanel?.(c,t)||''}${judgmentView(f.judgmentAI||f.judgment)}${lifeAfter(st,c)}
 <!-- itemised self-check kept in the save (f.items) and in the score only; not shown (v6.9) -->
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
 if(!caseReady(x.c)){preloadSave();VC_().load(archId(x.c)).then(()=>render(),e=>{console.warn(e);toast('사건 기록을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.')});
  return `<section class="panel t4"><h3>사건 기록을 펼치는 중…</h3><p class="muted small">이 사건의 증거와 증인 기록을 불러오고 있어요.</p></section>`}
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
 if(lastCaseId!==c.id){lastCaseId=c.id;ui.t4ev=null;ui.t4w=null;ui.t4tab=st.verdict?'result':(t.daysDone===0&&!t.log.length?'case':'day')}
 const tabs=t?tabsFor(c,st):[['case','사건'],['log','기록']];
 if(!tabs.some(v=>v[0]===ui.t4tab))ui.t4tab=tabs[0][0];
 const status=header?.querySelector('.court-play-status');
 if(status&&t)status.innerHTML=st.verdict?`<span>선고 완료</span><span>기일 ${t.daysDone}회</span>`:`<span>${esc(stage(c,st).short)}</span><span>${t.daysDone>t.minDays?`기일 ${t.daysDone}회 · 추가 심리`:`기일 ${t.daysDone}/${t.minDays}`}</span><span>중요도 ${c.importance}</span>`;
 const crim=isCriminal(c),who=c.who||[];
 const vless=curOf(c)?.victimless;
 const facts=[[crim?'피고인':'원고',NPC[who[crim?0:0]]?.name],vless?['피해자','따로 없음 (검사가 공소를 제기한 사건)']:[crim?(curOf(c)?.bRole||'피해자'):'피고',NPC[who[1]]?.name],['분류',c.tag],['상대 변호사',t?NPC[t.opponent]?.name:null],[crim?'죄명':'청구',crim?(chargeOf(c)?`${chargeOf(c).name} (${chargeOf(c).law})`:null):(claimOf(c)?`${won(claimOf(c).amount)} · ${claimOf(c).what}`:null)],[isDecision(c)?'신청':null,isDecision(c)?tell(c,t,curOf(c).decision.what):null],[isDecision(c)?'진행':'최소 기일',t?(isDecision(c)?'심리기일 1회 뒤 바로 결정':t.minDays+'회'):null],['증거·증인',t?`증거 ${t.evidence.length}건 · 증인 ${t.witnesses.length}명`:null]].filter(v=>v[1]);
 const cur=curOf(c),crimRole=isCriminal(c);
 const people=cur?`<h4>사람들</h4><div class="t4-people">
  <div class="t4-person">${nameBtn(who[0])}<span class="t4-tag">${crimRole?'피고인':'원고'}</span><p>${esc(tell(c,t,cur.people.A))}</p></div>
  ${cur.victimless?'':`<div class="t4-person">${nameBtn(who[1])}<span class="t4-tag">${crimRole?(cur.bRole||'피해자'):'피고'}</span><p>${esc(tell(c,t,cur.people.B))}</p></div>`}
  ${(t?.witnesses||[]).map(w=>`<div class="t4-person">${nameBtn(w.id)}<span class="t4-tag">증인 · ${esc(w.role)}</span>${w.story?`<p>${esc(w.story)}</p>`:''}</div>`).join('')}</div>`:'';
 const claims=cur?`<h4>양측의 주장</h4><div class="t4-claims"><p><b>${crimRole?'검찰':'원고'}</b> ${esc(tell(c,t,cur.claims[0]))}</p><p><b>${crimRole?'변호인':'피고'}</b> ${esc(tell(c,t,cur.claims[1]))}</p></div>`:'';
 const casePage=`<section class="panel t4 t4-case"><h3>무슨 사건인가?</h3>${!completed().length&&!st.verdict&&!(t?.daysDone)?HELP:''}${cur?`<p class="t4-logline">${esc(tell(c,t,cur.logline))}</p><p>${esc(tell(c,t,cur.summary))}</p>`:(overviewHtml||`<p>${esc(c.sub||'')}</p>`)}
  <dl class="t4-facts">${facts.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
  ${(()=>{const F=window.VerdictMatchPlay?.factsOf?.(c);if(!F||!(F.timeline.length+F.facts.length))return '';const al=F.alleged?`<h4>${crimRole?'공소사실 — 검사가 주장하는 범행':isDecision(c)?'신청 이유 — 신청인이 주장하는 사정':'청구 원인 — 원고가 주장하는 사실'}</h4><p class="muted small">${crimRole?'검사가 법정에서 증명하겠다는 내용입니다. 아직 사실로 정해진 것은 아니에요.':'원고 쪽 주장입니다. 아직 사실로 정해진 것은 아니에요.'}</p><blockquote class="t4-excerpt">${esc(tell(c,t,F.alleged))}</blockquote>`:'';return al+`<h4>다툼 없는 사실</h4><p class="muted small">양쪽 모두 인정하는 사실입니다. 다툼은 이 사실들 사이에서 벌어집니다.</p><ul class="small mp-facts">${F.timeline.map(e=>`<li><b>${esc(e.at)}</b> ${esc(tell(c,t,e.what))}</li>`).join('')}${F.facts.map(x=>`<li>${esc(tell(c,t,x))}</li>`).join('')}</ul>`})()}
  ${cur?claims+people:(argsHtml?`<details class="t4-more"><summary>검사·변호인 주장 자세히 보기</summary><div>${argsHtml}</div></details>`:'')}
  ${!st.verdict&&t?(waiting(t)?`<button class="btn primary full mt" data-action="t4tab" data-tab="day">재판으로 돌아가기 →</button>`:!sessionOpen(t)?`<button class="btn primary full mt" data-action="t4" data-kind="open">▶ ${esc(session(c,t.day))} 열기</button>${!t.daysDone?`<button class="btn outline full mt" data-action="t4" data-kind="handoff">다른 재판부로 넘기기 <small>(하루 1건)</small></button>`:''}`:`<button class="btn primary full mt" data-action="t4tab" data-tab="day">재판으로 돌아가기 →</button>`):''}</section>`;
 const logPage=`<section class="panel t4"><h3>📋 재판 기록 요약</h3>${window.VerdictV6?.officerName?.()?`<p class="muted small">기록 정리 · 참여관 ${esc(window.VerdictV6.officerName())}</p>`:''}${t?recordSummary(c,t):'<p class="muted">아직 기록이 없습니다.</p>'}
  ${t?.log?.length?`<details class="t4-more"><summary>전체 기록 ${t.log.length}건</summary>${t.log.map(l=>`<p class="small"><b>${esc(session(c,l.day))} · ${esc(l.kind)}</b> ${esc(l.text)}</p>`).join('')}</details>`:''}</section>`;
 let page='';
 const wait=t&&waiting(t);
 if(ui.t4tab==='case')page=casePage;
 else if(ui.t4tab==='log')page=logPage;
 else if(ui.t4tab==='orders')page=ordersPage(c,t);
 else if(ui.t4tab==='result')page=resultPanel(c,st);
 else if(ui.t4tab==='day')page=dayPage(c,st);
 else if(ui.t4tab==='evidence'){const done=t.evidence.filter(e=>e.decision).length;page=`<section class="panel t4"><div class="t4-head"><h3>증거</h3><span class="t4-tag">결정 ${done}/${t.evidence.length}</span></div>${pager('evidence',t.evidence,e=>evidenceCard(e,t,wait,c),'증거')}</section>`}
 else if(ui.t4tab==='witness')page=`<section class="panel t4"><div class="t4-head"><h3>증인</h3><span class="t4-tag">오늘 남은 신문 ${t.qLeft}/${t.qpd||QPD}</span></div>${partyCard(c,t,wait||!sessionOpen(t))}${faceList(c,t,wait||!sessionOpen(t))}${pager('witness',t.witnesses,w=>witnessCard(w,t,wait,c),'증인')}</section>`;
 else if(ui.t4tab==='verdict')page=verdictPage(c,st);
 if(ui.t4tab==='day'&&t&&!st.verdict){
  const evApi=window.VerdictHearingEvents;
  const opts=(evApi?.available(c,st,sessionOpen(t)&&!wait)||[]).filter(o=>o.id!=='defendant_question'||partyOf(c,t));
  const records=(st.hearingEvents||[]).map(v=>'<div class="t4-order-hist"><p><b>'+esc(v.id==='defendant_question'?'피고인 질문':v.id==='reflection'?'반성문':'합의·피해 회복')+'</b></p><p>'+esc(v.text)+'</p></div>').join('');
  if(opts.length||records)page+='<section class="panel t4"><h3>⚖ 당사자가 낸 자료</h3><p class="muted small">'+(isCriminal(c)?'피고인':'당사자')+' 쪽이 낸 자료와 진술은 공판 기록에 남습니다. 얼마나 믿을지는 재판장이 판단합니다.</p>'+opts.map(o=>'<button class="btn outline" style="margin:4px" data-action="t4hearing" data-id="'+esc(o.id)+'">'+esc(o.label)+'</button>').join('')+(records||'<p class="muted small">아직 진행한 이벤트가 없습니다.</p>')+'</section>';
 }

 const nav=`<nav class="t4-tabs" aria-label="재판 화면">${tabs.map(([id,label,badge])=>`<button class="t4-tab ${ui.t4tab===id?'on':''}" data-action="t4tab" data-tab="${id}">${label}${badge?`<i>${badge}</i>`:''}</button>`).join('')}</nav>`;
 return `<div class="court-play t4app">${header?header.outerHTML:''}${window.VerdictVisuals?.scene(c,t,ui.t4tab,st.verdict?'선고 완료':stage(c,st).short)||''}${nav}<div class="t4-page">${window.VerdictVisuals?.event(c.id)||''}${page}</div>${t?dock(c,st):''}</div>`;
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
render=function(){priorRender();preloadSave();document.body.classList.toggle('t4-court',ui.tab==='court');if(ui.tab==='courtList')document.querySelectorAll('.bottom-nav [data-tab="court"],.nav-stack [data-tab="court"]').forEach(b=>b.classList.add('active'));if(ui.tab==='court'&&ui.t4tab&&ui.t4tab!=='case'&&!ui.modal)setTimeout(()=>{if(!ui.modal&&ui.tab==='court'&&!askRequests(false))askNotices(false)},0)};

/* Case list: plain words and the v4 trial-day counter. */
if(typeof courtList==='function'){
 const priorList=courtList;
 courtList=function(){
  let html=priorList();
  if(window.VerdictDockPanel){const k=html.indexOf('</h1>');if(k>0){const e=html.indexOf('</div></div>',k);const at=e>0?e+12:k+5;html=html.slice(0,at)+'<div class="mt">'+window.VerdictDockPanel()+'</div>'+html.slice(at)}}
  const r=desk().reviews,avg=r.length?Math.round(r.reduce((n,x)=>n+x.review,0)/r.length)+'점':'-';
  const line=`<p class="t4-sumline"><span>미완료 <b>${openCases().length}</b></span><span>완료 <b>${completed().length}</b></span><span>평점 <b>${avg}</b></span></p>`;
  html=line+html;
  html=html.replace('접수된 사건을 확인하고 이번 주 심리할 사건을 선택하세요.','맡은 사건을 골라 재판을 이어가세요.')
   .replace(/<div class="stat-card"><label>금주 심리 여력<\/label><strong>[^<]*<\/strong><\/div>/,`<div class="stat-card"><label>판결 리뷰 평균</label><strong>${(()=>{const r=desk().reviews;return r.length?Math.round(r.reduce((a,x)=>a+x.review,0)/r.length)+'점':'-'})()}</strong></div>`)
   .replace(/<div class="grid three mt2">(?:<div class="stat-card"><label>[^<]*<\/label><strong>[^<]*<\/strong><\/div>){3}<\/div>\s*/,'') // only the three stat cards: the summary line above replaces them
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

 if(a==='t4exchange'){e.preventDefault();const x=current(),t=x?.st?.trial4;if(!t)return;
  const card=t.cards.find(v=>String(v.id)===el.dataset.id);if(!card)return;
  const lines=cardText(card,t,x.c);
  if(!lines.reason||!lines.opinion)return;
  el.disabled=true;el.textContent='AI 공방 생성 중…';
  Promise.resolve(window.VerdictAI?.exchange?.(x.c,t,card.id,lines.reason,lines.opinion)).then(ok=>{if(!ok)toast('AI 공방이 적용되지 않았습니다. 기존 신청·의견을 그대로 보여줍니다.')}).catch(()=>toast('AI 공방 연결 실패. 기존 공방 기록은 유지됩니다.')).finally(()=>render());
  return}
 if(a==='t4bench'){e.preventDefault();const x=current();if(!x?.st?.trial4)return;const src=benchSource(x.c,x.st.trial4);
  if(!src)return;
  el.disabled=true;el.textContent='AI 검토 중…';
  Promise.resolve(window.VerdictAI?.bench?.(x.c,x.st.trial4,src)).then(ok=>{if(!ok)toast('AI 검토를 적용하지 못했습니다. 기존 공판 기록을 그대로 보여줍니다.')}).catch(()=>toast('AI 연결에 실패했습니다. 원문 정리는 유지됩니다.')).finally(()=>render());
  return}
 if(a==='t4hearing'&&el.dataset.id==='defendant_question'){e.preventDefault();const x=current();if(!x)return;ui.t4tab='witness';ui.partyOpen=x.c.id;render();document.querySelector('details.t4-party')?.scrollIntoView({block:'center'});return}
 if(a==='t4hearing'){e.preventDefault();const x=current();if(!x)return;try{const item=window.VerdictHearingEvents.apply(x.c,x.st,el.dataset.id,sessionOpen(x.st.trial4)&&!waiting(x.st.trial4),x.st.trial4?.seed||String(S.rng||0));save();render();toast('공판 기록에 반영했습니다.')}catch(err){toast(err.message)}return}
 if(a==='t4'){e.preventDefault();act(el.dataset.kind,el.dataset.id,el.dataset.choice);return}
 if(a==='t4end'){e.preventDefault();if(el.dataset.ok){ui.modal=null;endDay()}else confirmEnd();return}
 if(a==='tab'&&el.dataset.tab==='court'&&el.closest('.bottom-nav,.nav-stack')){e.preventDefault();changeTab('courtList');return}
 if(a==='t4go'){e.preventDefault();const go=el.dataset.go;if(go==='requests'){askRequests(true);return}ui.modal=null;if(go==='end'){confirmEnd();return}ui.t4tab=go;render();window.scrollTo({top:0,behavior:'instant'});return}
 if(a==='t4tab'){e.preventDefault();ui.t4tab=el.dataset.tab;
  /* '판결' after a session: straight into the verdict window, not just the tab */
  if(el.dataset.sheet){const x=current();if(x&&x.st.trial4&&x.st.trial4.daysDone>=x.st.trial4.minDays&&!x.st.verdict){ui.vsheet=x.c.id;ui.vstep=vstate(x.c).opt?(ui.vstep||0):0}}
  render();window.scrollTo({top:0,behavior:'instant'});return}
 if(a==='t4page'){e.preventDefault();const key=el.dataset.kind==='evidence'?'t4ev':'t4w';ui[key]=Number(el.dataset.i)||0;render();document.querySelector('.t4-pager')?.scrollIntoView?.({block:'nearest'});return}
 if(a==='t4sheet'){e.preventDefault();const x=current();if(!x)return;const v=el.dataset.v;
  if(v==='open'){ui.vsheet=x.c.id;ui.vstep=vstate(x.c).opt?(ui.vstep||0):0}else if(v==='close')ui.vsheet=null;else ui.vstep=Number(v)||0;
  render();document.querySelector('.t4-sheet-body')?.scrollTo?.(0,0);return}
 if(a==='t4verdict'){e.preventDefault();const cx=current();if(!cx)return;const first=!vstate(cx.c).opt;askVerdict(el.dataset.id);if(first&&ui.vsheet){ui.vstep=1;render()}return}
 if(a==='t4v'){e.preventDefault();const x=current();if(x)tweak(x.c,el.dataset.k,el.dataset.v);return}
 if(a==='t4confirm'){e.preventDefault();confirmVerdict();if(S.cases[ui.caseId]?.verdict)ui.vsheet=null;return}
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
   const qa=(w.askedIds||[]).map(qid=>{const q=qById(c,t,wi,qid);return q?`<p class="t4-said">“${esc(answerOf(c,t,wi,q).text)}”</p>`:''}).filter(Boolean);
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

window.VerdictMatchPlay?.bind({namesOf,setSex,setAge,setJob,session,dlabel,dateOf,sessionOpen,waiting,openSession,addLog,finish,DAY_WAIT,EXTRA_DAYS,minsLeft,clock,today});
window.VerdictTrialPlay={ensure,tick,stage,REPORTERS,session,curOf,tell,openSession,dlabel,addToModal,orders:{available:availableOrders,issue:issueOrder,resolve:resolveOrders,state:nodeState},qById,questions:(c,t,i)=>questionsOf(c,t,i),ask:askQuestion,confront,conflicts,moment:momentOf};
})();
