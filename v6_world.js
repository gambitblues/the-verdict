/* THE VERDICT v6 — the world around the bench.
 *  - Case pool: installs the 30 new curated archetypes (content-packs/v6-new-30-v1.json) next to the original 30.
 *  - Persistent people: the legal world grows toward ~210 lawyers, prosecutors and judges as cases come in, and expert
 *    witnesses (forensic doctors, engineers, accountants …) are kept in a roster so the same professional can return.
 *  - The bench: an associate judge (합의부 cases) or a law clerk (other cases) reads each piece of evidence and gives an
 *    opinion that is right about as often as they are good; a court clerk keeps the record. They grow, get promoted and
 *    become colleagues.
 *  - Years later: when the truth of an old case comes out, a person from that trial tells the judge, not an anonymous paper.
 * Everything here is plain serialisable data in S (S.bench, S.legalWorld.experts) so it can move to a server later.
 */
(()=>{
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const T=()=>window.VerdictTrialCore,TP=()=>window.VerdictTrialPlay;
const PACK='./content-packs/v6-new-30-v1.json',PACK_ID='v6-new-30';
const cal=()=>window.VerdictCalendar,today=()=>cal()?cal().today():0;

/* ---------- case pool ---------- */
let packing=null;
function ensurePack(){
 if(typeof S==='undefined'||!S)return Promise.resolve();
 if((S.casePacks||[]).some(p=>p.packId===PACK_ID))return Promise.resolve();
 packing??=fetch(new URL(PACK,location.href),{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(p=>{
  if(!p)return;const res=CasePackEngine.install(S,p);if(!res.ok)console.warn('v6 사건팩 설치 실패',res.errors);else if(typeof save==='function')save();
 }).catch(e=>console.warn('v6 사건팩',e)).finally(()=>{packing=null});
 return packing;
}

/* ---------- persistent legal world ----------
 * Starts small (so a new save stays light) and grows by a few people per case until it is a city-sized bar. */
const LEGAL_CAP=210;
function legalTarget(){return Math.min(LEGAL_CAP,24+(S.caseSerial||0)*4)}
function growLegal(){
 const P=window.VerdictProfessions;if(!P?.generate||!S.legalWorld)return;
 const have=S.legalWorld.people.filter(id=>NPC[id]&&NPC[id].alive!==false).length,want=legalTarget();
 for(let i=have;i<Math.min(want,have+6);i++){const r=rand();P.generate(r<0.15?'judge':r<0.45?'prosecutor':'lawyer')}
}
/* expert witnesses: same field → the same person may be called again */
const EXPERT=/감정|법의|부검|전문가|감식|분석관|설비기사|건축사|회계사|세무사|의사|주치의|정신과|교수|기술사|엔지니어|개발자|심판|복원사|기록관리자|상담전문가|예보관/;
const fieldOf=role=>String(role||'').replace(/^(담당|당시|전)\s*/,'').replace(/\s+/g,'');
function expertFor(role,c){
 if(!EXPERT.test(role||''))return null;
 const w=S.legalWorld;if(!w)return null;w.experts??=[];
 const f=fieldOf(role),taken=new Set([...(c.who||[]),...(c.side||[])]);
 const same=w.experts.filter(x=>x.field===f&&NPC[x.id]&&NPC[x.id].alive!==false&&!taken.has(x.id)&&x.lastCase!==c.id);
 if(same.length&&T().unit(c.id+':expert:'+f)<0.55){const x=same[T().hash(c.id+f)%same.length];x.lastCase=c.id;x.cases=(x.cases||0)+1;return {id:x.id,reused:true}}
 return null;
}
function registerExpert(id,role,c){if(!EXPERT.test(role||'')||!S.legalWorld)return;const w=S.legalWorld;w.experts??=[];
 if(!w.experts.some(x=>x.id===id))w.experts.push({id,field:fieldOf(role),since:year(),lastCase:c.id,cases:1});
 w.experts=w.experts.slice(-90)}

/* ---------- the bench ---------- */
/* What the associate judge says about a piece of evidence: a view on how it was obtained (right or wrong depending on
 * their skill) and a remark on what this record can and cannot show. Fixed per evidence, so it does not change on reload. */
const ADVICE={
 illegal:['확보 경위가 걸립니다. 영장이나 동의 없이 얻었다면 쓰기 어려울 수 있어요','{T|을} 누가 무슨 근거로 가져왔는지 기록이 비어 있습니다. 위법하게 모은 자료라면 판단에서 빼야 합니다','내용보다 얻은 방법이 문제일 수 있어요. 동의서나 영장이 있었는지부터 보시죠'],
 source:['누가 만들고 어떻게 보관했는지 원본부터 확인해 보시죠','{T|은} 원본이 아니라 옮겨 적은 것일 수 있어요. 만든 사람과 보관한 사람을 따로 확인해야 합니다','중간에 손댄 사람이 없는지가 관건입니다. 보관 경로가 한 번이라도 끊겼다면 무게가 확 줄어요'],
 timing:['기록된 시각이 정확한지 다른 자료와 한 번 더 맞춰 봐야 할 것 같습니다','{T}의 시계가 맞는지부터 보시죠. 몇 분만 어긋나도 이야기가 완전히 달라집니다','시각이 핵심인 자료인데, 기계 시계는 생각보다 자주 틀립니다. 다른 기록과 대조가 필요해요'],
 none:['출처와 확보 경위에 특별히 걸리는 점은 보이지 않습니다','{T|은} 만들어진 경위가 분명합니다. 이제 내용을 어디까지 믿을지만 따지면 될 것 같아요','형식상 흠은 안 보입니다. 쓰셔도 절차 문제는 없을 겁니다']};
const ADVICE2=[
 (e)=>e.scope?`다만 이 자료가 말해 주는 건 "${cutA(e.scope)}"까지예요. 그 이상은 다른 근거가 필요합니다`:'',
 (e)=>e.note?`한계도 분명합니다. ${cutA(e.note)}`:'',
 ()=>'증인들 말과 맞춰 보면 무게가 더 분명해질 것 같습니다',
 (e)=>e.scope?`이게 맞다면 "${cutA(e.scope)}"는 거의 확실해지는데, 반대쪽이 그 점을 어떻게 설명할지 들어 보시죠`:'',
 ()=>'이것 하나로 결론을 내기보다 쟁점 하나를 좁히는 데 쓰시는 게 좋겠습니다'];
const cutA=(x,n=40)=>{x=String(x||'').replace(/[.。]$/,'');return x.length>n?x.slice(0,n-1)+'…':x};
function makeBench(kind){
 const role={assoc:'배석판사',clerk:'재판연구원',officer:'법원 참여관'}[kind];
 const id=freshNPC(role,Math.max(1,S.caseSerial||1),'law'),p=NPC[id];
 const age={assoc:[29,33],clerk:[26,30],officer:[38,55]}[kind];
 p.bornYear=year()-(age[0]+Math.floor(rand()*(age[1]-age[0]+1)));p.ageAtStart=year()-p.bornYear;
 p.role=role;p.career=role;p.socialStatus='법조계';p.name=VerdictNames.make({gender:p.gender,bornYear:p.bornYear,rand,people:NPC});
 if(kind!=='officer')p.degree=rand()<0.3?'석사':'학사';p.educationField='법학';
 S.relations[id]??=45;
 remember(id,'재판부',`${S.name||'재판장'} 재판부의 ${role}로 함께 일하기 시작함`,null);
 return {id,kind,since:today(),skill:kind==='assoc'?Math.round(52+rand()*26):kind==='clerk'?Math.round(40+rand()*28):0,cases:0};
}
function bench(){
 if(typeof S==='undefined'||!S?.name)return null;
 S.bench??={alumni:[]};const b=S.bench;
 /* the court clerk retires at 60 and is thanked on the way out */
 const o=b.officer&&NPC[b.officer.id];
 if(o&&o.alive!==false&&year()-o.bornYear>=60){o.role='퇴직 참여관';o.career='퇴직';(o.jobHistory??=[]).push({year:year(),job:'퇴직',reason:'정년퇴직'});
  b.alumni.push({id:b.officer.id,was:'참여관',now:'정년퇴직',year:year()});b.alumni=b.alumni.slice(-20);
  message(b.officer.id,'오늘로 법원을 떠납니다. 재판장님 기록은 늘 반듯해서 정리하는 맛이 있었어요.');b.officer=null}
 for(const k of ['assoc','clerk','officer'])if(!b[k]||!NPC[b[k].id]||NPC[b[k].id].alive===false)b[k]=makeBench(k);
 return b;
}
const advisorFor=c=>{const b=bench();return b?(c.importance>=4?b.assoc:b.clerk):null};
function benchAdvice(c,t,e){
 const a=advisorFor(c);if(!a||!e)return '';
 const right=T().unit(t.seed+':bench:'+e.id+':'+a.id)<a.skill/100;
 const keys=Object.keys(ADVICE),flaw=keys.includes(e.flawType)?e.flawType:'none';
 const said=right?flaw:keys.filter(k=>k!==flaw)[T().hash(t.seed+e.id+a.id)%3];
 const h=T().hash(t.seed+':adv:'+e.id+':'+a.id),pool=ADVICE[said];
 const P=(w,p)=>window.VerdictCurated?VerdictCurated.particle(w,p):w+p;
 const line1=pool[h%pool.length].replace(/\{T\|([^}]+)\}/g,(m,p)=>P(e.title,p)).replace(/\{T\}/g,e.title);
 const line2=ADVICE2[(h>>>5)%ADVICE2.length](e);
 const role=a.kind==='assoc'?'배석판사':'재판연구원';
 return `<div class="t4-bench">🧑‍⚖️ <b>${role} <button class="t4-who" data-action="npc" data-id="${esc(a.id)}">${esc(NPC[a.id]?.name)}</button></b> "${esc(line1)}${line2?'. '+esc(line2):''}"<small>참고 의견이에요. 틀릴 때도 있어요.</small></div>`;
}
function officerName(){const b=bench();return b?NPC[b.officer.id]?.name:''}
/* after each verdict: the advisor learns; after a few years they move on */
function onVerdict(c,t){
 const b=bench();if(!b)return;const a=c.importance>=4?b.assoc:b.clerk;
 if(a){a.cases++;a.skill=Math.min(92,a.skill+1.5);S.relations[a.id]=Math.min(100,(S.relations[a.id]??45)+1);
  remember(a.id,'재판부',`${String(c.name||'').split(' · ')[0]} 재판에서 함께 기록을 검토함`,c.id)}
 if(t?.final&&t.final.gameDay==null)t.final.gameDay=today();
 for(const k of ['assoc','clerk']){const x=b[k];if(!x)continue;const yrs=(today()-x.since)/365;
  if(yrs>=(k==='assoc'?3:2)&&x.cases>=4){const p=NPC[x.id];
   const next=k==='assoc'?'단독판사':(T().unit(x.id+':move')<0.5?'판사':'변호사');
   p.role=next;p.career=next;(p.jobHistory??=[]).push({year:year(),job:next,reason:k==='assoc'?'단독판사로 전보':'재판연구원 근무를 마침'});
   b.alumni.push({id:x.id,was:k==='assoc'?'배석판사':'재판연구원',now:next,year:year()});b.alumni=b.alumni.slice(-20);
   news(`법원 인사 · ${p.name} ${next}`,`${S.name||'재판장'} 재판부에서 ${k==='assoc'?'배석판사':'재판연구원'}로 ${x.cases}건을 함께 맡았던 ${p.name}이(가) ${next}로 자리를 옮긴다.`,'법조일보');
   message(x.id,k==='assoc'?'단독 재판부로 갑니다. 재판장님 옆에서 기록 보는 법을 제일 많이 배웠어요.':'재판연구원 근무를 마치게 됐습니다. 그동안 정말 감사했습니다.');
   remember(x.id,'인사',`${S.name||'재판장'} 재판부를 떠나 ${next}로`,null);
   b[k]=makeBench(k);
  }}
}

/* ---------- years later: someone tells the judge what really happened ---------- */
function yearsSince(t){const d=t?.final?.gameDay;return d==null?99:(today()-d)/365}
function speaker(c,t){
 const alive=id=>NPC[id]&&NPC[id].alive!==false;
 const ws=(t.witnesses||[]).map((w,i)=>({w,i})).filter(x=>alive(x.w.id));
 const hid=ws.find(x=>['protect','fear','flip'].includes(x.w.attitude));
 if(hid)return {id:hid.w.id,why:hid.w.attitude};
 if(ws.length)return {id:ws[0].w.id,why:'witness'};
 const party=(c.who||[]).find(alive);return party?{id:party,why:'party'}:null;
}
const OPEN={protect:'그때 법정에서 누군가를 감싸느라 다 말씀드리지 못했습니다.',fear:'그때는 무서워서 끝까지 말하지 못했어요.',flip:'그때 제 말이 자꾸 바뀌었던 것, 기억하실지 모르겠습니다.',witness:'오래 마음에 걸려서 연락드립니다.',party:'판결이 나고 오랜 시간이 지났네요.'};
function tellTruth(c,t,fact){
 const sp=speaker(c,t);if(!sp||!window.VerdictWorld?.addTruth)return false;
 const side=T().sideOf(t.final.dir),match=t.truth==='did'?side>0:t.truth==='didnt'?side<0:null;
 t.truthTold={id:sp.id,fact,match,day:today()};
 const name=String(c.name||'').split(' · ')[0];
 window.VerdictWorld.addTruth(c,sp.id,`판사님, ${name} 재판 때 증언했던 ${NPC[sp.id].name}입니다. ${OPEN[sp.why]} 이제야 말씀드리지만, ${fact}.`);
 remember(sp.id,'고백',`${name}의 진실을 재판장에게 털어놓음`,c.id);
 return true;
}
function truthPanel(c,t){
 const x=t?.truthTold;if(!x)return '';
 const verdictWord=x.match===true?'그때 판결은 실제로 일어난 일과 같은 방향이었어요.':x.match===false?'그때 판결은 실제로 일어난 일과 다른 방향이었어요. 판결은 확정된 그대로예요.':'그때 판결이 다 담지 못한 사정이 있었어요.';
 return `<div class="t4-truth"><b>🕯 몇 년 뒤의 진실</b><p>${esc(NPC[x.id]?.name||'')}이(가) 털어놓았어요. ${esc(x.fact)}.</p><p class="small">${verdictWord}</p></div>`;
}

/* ---------- pressure: someone leans on the judge ----------
 * When a session of a weighty case opens, sometimes a former judge now in private practice, a university classmate or
 * a local big name sends a message on behalf of one side. Refuse, report it, or let it pass. Reporting a lawyer sends
 * them to a disciplinary hearing; reporting anyone else leads to a formal warning. Letting it pass is quiet now, but
 * the risk grows: some time after the verdict a paper may find out, worse if the verdict went that side's way. */
const P=()=>{S.pressure??={seen:{},log:[],ignored:[]};return S.pressure};
const short=c=>String(c.name||'').split(' · ')[0];
function senderFor(kind){
 const pr=P();
 if(kind==='exjudge'){
  /* a lawyer old enough to have left the bench: the oldest in practice, or a newly registered one if none is old enough */
  let pool=(S.legalWorld?.people||[]).filter(id=>NPC[id]?.legalCareer?.role==='lawyer'&&NPC[id].alive!==false&&year()-(NPC[id].bornYear||year())>=52);
  let id=pool.length?pool[T().hash('exjudge:'+(S.caseSerial||0))%pool.length]:null;
  if(!id&&window.VerdictProfessions?.generate){id=window.VerdictProfessions.generate('lawyer');const p=NPC[id];p.bornYear=year()-(55+Math.floor(rand()*9));p.ageAtStart=year()-p.bornYear;
   p.name=VerdictNames.make({gender:p.gender,bornYear:p.bornYear,rand,people:NPC});p.legalCareer.startedYear=year()-26;p.legalCareer.years=26}
  if(id){const p=NPC[id];if(!p.exJudge){p.exJudge=true;p.role='전관 변호사';(p.jobHistory??=[]).unshift({year:year()-6,job:'부장판사',reason:'법원 퇴직 뒤 변호사 개업'})}return id}
  kind='local'}
 const key=kind==='classmate'?'classmate':'local';
 if(pr[key]&&NPC[pr[key]]&&NPC[pr[key]].alive!==false)return pr[key];
 const role=kind==='classmate'?'대학 동기 · 사업가':'지역 건설사 회장';
 const id=freshNPC(role,Math.max(1,S.caseSerial||1),'contract'),p=NPC[id];p.role=role;p.career=kind==='classmate'?'중소기업 대표':'건설사 회장';
 if(kind==='classmate'){p.bornYear=year()-(typeof age==='function'?age():35);}else p.bornYear=year()-(58+Math.floor(rand()*12));
 p.name=VerdictNames.make({gender:p.gender,bornYear:p.bornYear,rand,people:NPC});S.relations[id]??=(kind==='classmate'?55:30);
 pr[key]=id;return id;
}
const ASK={
 exjudge:(c,side,nm)=>`재판장님, 법원에 있을 때 신세 많이 졌습니다. 이번 ${nm} 사건, ${side} 쪽 사정이 딱해서요. 기록 한 번만 더 너그럽게 봐 주시면 고맙겠습니다. 식사라도 한번 모시죠.`,
 classmate:(c,side,nm)=>`야, 오랜만이다. 다른 게 아니라 ${nm} 사건 ${side} 쪽이 내 거래처 사장 가족이래. 무리한 부탁은 아니고, 그냥 사정 좀 들어 달라는 거야. 동기 좋다는 게 뭐냐.`,
 local:(c,side,nm)=>`판사님, 지역에서 사업하는 사람입니다. ${nm} 사건 ${side} 쪽이 우리 지역에 꼭 필요한 사람이라 한 말씀 드립니다. 지역 여론도 생각해 주시면 좋겠습니다.`};
function onSessionOpen(c,t,force){
 if(!c||c.importance<3||!TP()?.curOf?.(c))return;
 const pr=P();if(pr.seen[c.id]&&!force)return;pr.seen[c.id]=true;
 if(!force&&T().unit('pressure:'+c.id+':'+(S.rng||1))>=0.22)return;
 const kind=(typeof force==='string'?force:null)||['exjudge','classmate','local'][T().hash('pk:'+c.id)%3],from=senderFor(kind);if(!from)return;
 const crim=c.kind==='criminal',side=T().unit('ps:'+c.id)<0.7?'d':'p';
 const sideWord=side==='d'?(crim?'피고인':'피고'):(crim?'피해자':'원고');
 if(window.VerdictWorld?.addCustom?.('pressure',c,from,ASK[kind](c,sideWord,short(c)),`💬 ${NPC[from].name}에게서 ${short(c)} 사건에 관한 문자가 왔어요`))
  pr.log.push({caseId:c.id,from,kind,side,day:today(),answer:null});
}
function onReply(th,choice,c){
 if(th.kind!=='pressure')return;const pr=P(),e=pr.log.find(x=>x.caseId===th.caseId&&!x.answer);if(!e)return;e.answer=choice;e.answerDay=today();
 const p=NPC[th.from],mod=(id,v)=>{S.relations[id]=Math.max(0,Math.min(100,(S.relations[id]??30)+v))};
 if(choice==='refuse'){mod(th.from,-6);S.professional=Math.min(100,(S.professional||50)+1);remember(th.from,'청탁',`${short(c)} 사건 부탁을 재판장이 정중히 거절함`,c?.id)}
 else if(choice==='report'){mod(th.from,-22);S.professional=Math.min(100,(S.professional||50)+2);S.publicity=Math.min(100,(S.publicity||0)+2);
  if(p?.legalCareer){p.legalStatus='징계 절차 중';news(`변호사 ${p.name}, 재판 청탁 의혹으로 징계 회부`,`${short(c)} 사건 재판장에게 사적으로 연락해 선처를 부탁한 의혹이다. 재판장이 법원 감사 담당에 보고했다.`,'법조일보')}
  else news(`법원, ${short(c)} 사건 청탁 시도에 경고`,`재판장이 받은 사적 연락을 법원이 확인하고 연락한 사람에게 경고 서한을 보냈다.`,'법조일보');
  remember(th.from,'청탁',`${short(c)} 사건 부탁이 재판장의 보고로 공개됨`,c?.id);p.grudge=(p.grudge||0)+1}
 else if(choice==='ignore'){pr.ignored.push(th.caseId);remember(th.from,'청탁',`${short(c)} 사건 부탁에 재판장이 답하지 않음`,c?.id)}
}
/* months after a verdict, an unreported request may surface in the press */
function pressureTick(){
 const pr=P();
 for(const e of pr.log){if(e.answer!=='ignore'||e.surfaced!=null)continue;const st=S.cases[e.caseId],t=st?.trial4;if(!st?.verdict||!t?.final)continue;
  const gd=t.final.gameDay;if(gd==null||today()-gd<180)continue;
  const side=T().sideOf(t.final.dir),favoured=(e.side==='p'&&side>0)||(e.side==='d'&&side<0);
  const odds=Math.min(0.75,(favoured?0.45:0.2)+0.1*(pr.ignored.length-1));
  e.surfaced=T().unit('surface:'+e.caseId)<odds;if(!e.surfaced)continue;
  const c=CASES.find(x=>x.id===e.caseId);S.professional=Math.max(0,(S.professional||50)-(favoured?8:4));S.publicity=Math.min(100,(S.publicity||0)+6);
  news(`[단독] ${short(c||{name:'한 사건'})} 재판장, 청탁 문자 받고도 보고 안 해`,favoured?`재판 도중 ${NPC[e.from]?.name||'한 인사'}의 부탁 문자를 받았지만 보고하지 않았고, 판결은 부탁한 쪽에 유리하게 나왔다. 법원은 경위를 확인하겠다고 밝혔다.`:`재판 도중 사적인 부탁 문자를 받고도 보고하지 않았다. 판결은 부탁과 반대 방향이었지만 절차를 지키지 않았다는 지적이 나온다.`,'탐사저널K');
  message('senior','기사 봤다. 그런 문자는 받으면 바로 보고하는 거야. 판결이 맞았어도 절차가 무너지면 같이 무너진다.');
 }
}

/* ---------- personnel season, departments and the yearbook ----------
 * Every February the judge asks for a department. The choice makes those cases come more often (×3 weight), never
 * exclusively, so the whole pool of 60 stays in play. The season also brings a yearbook of last year's verdicts. */
const DEPTS=[
 ['criminal','형사부','강력·성범죄·경제범죄 같은 형사 사건이 자주 와요',a=>a.kind==='criminal'],
 ['civil','민사부','계약·손해배상·재산 다툼 같은 민사 사건이 자주 와요',a=>a.kind==='civil'&&!['family','public'].includes(a.category)],
 ['family','가사부','상속·양육·가족 간 다툼이 자주 와요',a=>a.category==='family'],
 ['public','행정부','공공기관과 시민 사이의 다툼이 자주 와요',a=>a.category==='public']];
const SEASON=()=>{S.season??={asked:{},dept:null,books:{}};return S.season};
function deptWeight(a){const d=DEPTS.find(x=>x[0]===SEASON().dept);return d&&d[3](a)?3:1}
const dateOf=day=>new Date(Date.UTC(2027,2,1)+Math.floor(day)*86400000);
function seasonDue(){const d=dateOf(today()),y=d.getUTCFullYear(),m=d.getUTCMonth();return y>=2028&&m>=1&&!SEASON().asked[y]?y:null}
function yearbook(y){
 const done=CASES.filter(c=>{const t=S.cases[c.id]?.trial4;return t?.final&&t.final.gameDay!=null&&dateOf(t.final.gameDay).getUTCFullYear()===y-1});
 if(!done.length)return {y:y-1,n:0};
 const best=done.slice().sort((a,b)=>S.cases[b.id].trial4.final.skill-S.cases[a.id].trial4.final.skill)[0];
 const hard=done.slice().sort((a,b)=>S.cases[a.id].trial4.final.match-S.cases[b.id].trial4.final.match)[0];
 const avg=Math.round(done.reduce((n,c)=>n+S.cases[c.id].trial4.final.skill,0)/done.length);
 return {y:y-1,n:done.length,avg,best:short(best),bestSkill:S.cases[best.id].trial4.final.skill,hard:short(hard),hardMatch:S.cases[hard.id].trial4.final.match};
}
function bookHtml(b){return b.n?`<div class="v6-book"><b>📘 ${b.y}년 나의 판결</b><p>선고 ${b.n}건 · 판결 실력 평균 ${b.avg}</p><p>가장 잘 판단한 사건 <b>${esc(b.best)}</b> (${b.bestSkill})</p><p>여론과 가장 크게 엇갈린 사건 <b>${esc(b.hard)}</b></p></div>`:`<div class="v6-book"><b>📘 ${b.y}년 나의 판결</b><p>지난해 선고한 사건이 없어요.</p></div>`}
function seasonTick(){
 const y=seasonDue();if(!y||typeof modal!=='function'||ui.modal)return;
 const s=SEASON(),b=yearbook(y);s.books[b.y]=b;s.pending=y;
 modal(`${y}년 법원 정기 인사`,`${bookHtml(b)}<p class="small">올해 일하고 싶은 재판부를 고르세요. 고른 쪽 사건이 더 자주 배당돼요. 다른 사건도 계속 와요.</p>
  <div class="v6-depts">${DEPTS.map(([k,l,d])=>`<button class="choice ${s.dept===k?'on':''}" data-action="v6dept" data-dept="${k}"><span class="choice-index">⚖</span><span><strong>${l}</strong><small>${d}</small></span></button>`).join('')}
  <button class="btn outline full mt" data-action="v6dept" data-dept="${s.dept||'none'}">${s.dept?'지금 재판부에 남기':'희망하지 않기'}</button></div>`);
}
function chooseDept(k){const s=SEASON(),y=s.pending;if(!y)return;s.asked[y]=true;s.pending=null;const was=s.dept;s.dept=DEPTS.some(x=>x[0]===k)?k:was;
 const label=DEPTS.find(x=>x[0]===s.dept)?.[1];
 log('커리어',`${y}년 정기 인사`,`${label?label+' 배치':'재판부 희망 없음'} · 지난해 선고 ${s.books[y-1]?.n||0}건`);
 if(label&&label!==DEPTS.find(x=>x[0]===was)?.[1])news(`${y}년 법원 정기 인사`,`${S.name||'한 법관'} 판사가 ${label}에 배치됐다.`,'법조일보');
 ui.modal=null;save();render()}
const deptLabel=()=>DEPTS.find(x=>x[0]===SEASON().dept)?.[1]||'';

/* ---------- hooks ---------- */
/* People realism (v6.9): schooling follows the job, and the two colleagues closest to the player have believable ages.
 * Runs on boot and every minute; only rewrites what does not fit, deterministically per person. */
const EDU=[
 [/판사|검사|변호사|법조|재판연구원|로펌|법률|법무|공증|법원 동기/,'법학',['학사','석사'],'law'],
 [/참여관|법원 공무원|사무관|주무관/,'법학',['학사'],'clerk'],
 [/교수|연구원|연구자/,null,['박사'],'research'],
 [/의사|전문의|주치의|의학|외과|내과|소아과|정신과|법의|한의/,'보건(의학)',['석사','박사'],'doctor'],
 [/간호|약사|의료|병원|치료사|보건/,'보건',['학사'],'health'],
 [/엔지니어|개발자|설계|기술|공학|정비|프로그래머|IT|전산|감식/,'공학',['학사','석사'],'eng'],
 [/회계|세무|경영|대표|사업|금융|투자|은행|증권|영업|무역|마케팅|재무|임원|상무|전무|이사/,'경영',['학사','석사'],'biz'],
 [/교사|교감|교장|강사|보육|학원/,'교육',['학사'],'edu'],
 [/기자|언론|작가|편집|PD|방송|출판/,'인문',['학사'],'media'],
 [/경찰|형사|공무원|소방|군인|구조|해경/,'사회과학',['학사'],'public'],
 [/사회복지|상담|활동가|시민단체/,'사회과학',['학사'],'social'],
 [/화가|음악|배우|가수|디자이너|예술|선수|코치|감독/,'예체능',['학사','전문학사'],'art'],
 [/노동|생산|운전|배달|농부|농민|어민|요리|조리|자영업|상인|청소|경비|택배|건설|기사$|반장|작업자|직원/,null,['고졸','전문학사'],'trade']];
function fitPeople(){
 const yr=year(),me=age();
 const fixAge=(id,lo,hi)=>{const p=NPC[id];if(!p)return;const a=yr-p.bornYear;if(!(a>=lo&&a<=hi)){p.bornYear=yr-(lo+T().hash(id+':age')%(hi-lo+1));p.ageAtStart=yr-p.bornYear}};
 fixAge('senior',me+8,me+15);fixAge('hyun',me-1,me+1);
 for(const [id,p] of Object.entries(NPC)){
  if(!p||id==='self')continue;const job=String(p.career||p.role||'');if(!job||p.eduFit===job)continue;
  const rule=EDU.find(r=>r[0].test(job)),a=yr-(p.bornYear||yr-40),h=T().hash(id+':edu');
  if(rule){const [,field,degs,k]=rule;
   if(field)p.educationField=field;else if(k==='research'&&!p.educationField)p.educationField='인문';
   let deg=degs[h%degs.length];if(k==='law')deg=p.bornYear>=1986?'석사':'학사';
   if(!degs.includes(p.degree))p.degree=deg;
   if(k==='trade'&&['고졸','전문학사'].includes(p.degree))p.educationField=p.degree==='고졸'?'고등학교':(p.educationField||'기술');
   if(k==='law'&&p.degree==='석사')p.lawSchool=true}
  else if(p.degree==='박사')p.degree=a>=30?'석사':'학사';
  if(a<24&&['석사','박사'].includes(p.degree))p.degree='학사';
  if(a<22&&p.degree==='학사')p.degree='재학';
  p.eduFit=job}
}
function boot(){
 if(typeof S==='undefined'||!S?.name)return;
 ensurePack();growLegal();bench();fitPeople();pressureTick();seasonTick();
}
if(typeof clicker==='function'){const prior=clicker;clicker=function(e){const el=e.target.closest('[data-action="v6dept"]');if(el){e.preventDefault();chooseDept(el.dataset.dept);return}return prior(e)}}
setTimeout(boot,1200);setInterval(()=>{try{boot()}catch(e){console.warn(e)}},60000);
window.VerdictV6={onSessionOpen,onReply,pressureTick,seasonTick,chooseDept,deptWeight,deptLabel,yearbook,DEPTS,ensurePack,growLegal,expertFor,registerExpert,bench,benchAdvice,officerName,onVerdict,yearsSince,tellTruth,truthPanel,legalTarget};
})();
