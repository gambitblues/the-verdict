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
const ADVICE={
 illegal:'확보 경위가 걸립니다. 영장이나 동의 없이 얻었다면 쓰기 어려울 수 있어요',
 source:'누가 만들고 어떻게 보관했는지 원본부터 확인해 보시죠',
 timing:'기록된 시각이 정확한지 다른 자료와 한 번 더 맞춰 봐야 할 것 같습니다',
 none:'출처와 확보 경위에 특별히 걸리는 점은 보이지 않습니다'};
function makeBench(kind){
 const role={assoc:'배석판사',clerk:'재판연구원',officer:'법원 참여관'}[kind];
 const id=freshNPC(role,Math.max(1,S.caseSerial||1),'law'),p=NPC[id];
 const age={assoc:[31,36],clerk:[27,31],officer:[38,55]}[kind];
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
 for(const k of ['assoc','clerk','officer'])if(!b[k]||!NPC[b[k].id]||NPC[b[k].id].alive===false)b[k]=makeBench(k);
 return b;
}
const advisorFor=c=>{const b=bench();return b?(c.importance>=4?b.assoc:b.clerk):null};
function benchAdvice(c,t,e){
 const a=advisorFor(c);if(!a||!e)return '';
 const right=T().unit(t.seed+':bench:'+e.id+':'+a.id)<a.skill/100;
 const keys=Object.keys(ADVICE),flaw=keys.includes(e.flawType)?e.flawType:'none';
 const said=right?flaw:keys.filter(k=>k!==flaw)[T().hash(t.seed+e.id+a.id)%3];
 const role=a.kind==='assoc'?'배석판사':'재판연구원';
 return `<div class="t4-bench">🧑‍⚖️ <b>${role} <button class="t4-who" data-action="npc" data-id="${esc(a.id)}">${esc(NPC[a.id]?.name)}</button></b> "${esc(ADVICE[said])}"<small>참고 의견이에요. 틀릴 때도 있어요.</small></div>`;
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

/* ---------- hooks ---------- */
function boot(){
 if(typeof S==='undefined'||!S?.name)return;
 ensurePack();growLegal();bench();
}
setTimeout(boot,1200);setInterval(()=>{try{boot()}catch(e){console.warn(e)}},60000);
window.VerdictV6={ensurePack,growLegal,expertFor,registerExpert,bench,benchAdvice,officerName,onVerdict,yearsSince,tellTruth,truthPanel,legalTarget};
})();
