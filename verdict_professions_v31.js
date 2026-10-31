/* THE VERDICT compiled legal career & court gameplay runtime. */

;/* legal_world_v25.js */
/* THE VERDICT v2.5 — persistent judiciary ecosystem, law firms and weighted representation */
'use strict';
(()=>{
const FIRMS=[
{id:'haeon',name:'법무법인 해온',tier:5,kind:'대형',research:94,fee:90},
{id:'seojin',name:'법무법인 서진',tier:5,kind:'대형',research:91,fee:87},
{id:'yulrim',name:'법무법인 율림',tier:4,kind:'중대형',research:84,fee:74},
{id:'mirae',name:'법무법인 미래',tier:4,kind:'중대형',research:79,fee:71},
{id:'jipyeong',name:'법무법인 가온길',tier:3,kind:'중형',research:72,fee:54},
{id:'jungwon',name:'법률사무소 정원',tier:3,kind:'전문',research:69,fee:46},
{id:'nurim',name:'법률사무소 누림',tier:2,kind:'소형',research:58,fee:31},
{id:'sarang',name:'법률사무소 새길',tier:2,kind:'소형',research:51,fee:25},
{id:'public',name:'국선변호인 명부',tier:1,kind:'국선',research:43,fee:0}
];
const expCap=n=>Math.min(100,Math.max(0,Math.round(Number(n)||0)));
const pick=xs=>xs[Math.min(xs.length-1,Math.floor(rand()*xs.length))];
function world(){
 if(!S.legalWorld)S.legalWorld={version:1,firms:FIRMS.map(x=>({...x})),people:[],careerLog:[],cases:{},lastCareerYear:year(),firstFour:false,firstFourAttempted:false};
 return S.legalWorld;
}
function profession(id,role){
 const p=NPC[id];if(!p)return;
 p.legalCareer??={role,startedYear:year()-Math.floor(rand()*22),years:0,trialSkill:expCap(35+rand()*63),evidenceSkill:expCap(30+rand()*66),ethics:expCap(50+rand()*50),demand:expCap(28+rand()*67),careerHistory:[]};
 const lc=p.legalCareer;lc.role=role;lc.years=Math.max(0,year()-lc.startedYear);
 const relevant=role==='judge'?'판사':role==='prosecutor'?'검사':'변호사';
 p.career=relevant;p.role=relevant;p.socialStatus='법조계';
 if(role==='lawyer'&&!lc.firmId)lc.firmId=pick(FIRMS.filter(x=>x.id!=='public')).id;
 if(!lc.careerHistory.length)lc.careerHistory.push({year:year(),role,firmId:lc.firmId||null,reason:'최초 등록'});
}
function generate(role){
 const id=freshNPC(role==='judge'?'법관':role==='prosecutor'?'검사':'변호사',Math.max(1,S.caseSerial+1),'law');
 profession(id,role);world().people.push(id);
 const p=NPC[id],minAge=role==='judge'?34:role==='prosecutor'?27:26,ageNow=year()-p.bornYear;
 if(ageNow<minAge){p.bornYear=year()-(minAge+Math.floor(rand()*9));p.ageAtStart=year()-p.bornYear;}
 const maxExperience=Math.max(0,year()-p.bornYear-25);
 p.legalCareer.startedYear=year()-Math.min(maxExperience,Math.floor(rand()*20));
 p.legalCareer.years=year()-p.legalCareer.startedYear;
 p.legalCareer.trialSkill=expCap(25+p.proficiency*.72+rand()*19);
 p.legalCareer.evidenceSkill=expCap(28+p.proficiency*.65+rand()*22);
 p.legalCareer.demand=expCap(25+rand()*65);
 return id;
}
function pool(role){const w=world();return w.people.filter(id=>NPC[id]?.legalCareer?.role===role&&NPC[id]?.alive!==false)}
function ensurePopulation(n){
 const active=Math.max(1,n||1),targets={judge:Math.max(0,Math.ceil(active*.6)-1),prosecutor:active,lawyer:active*2};
 for(const [role,target]of Object.entries(targets)){let list=pool(role);for(let i=list.length;i<target;i++)generate(role)}
 return targets;
}
function selectProsecutor(c){
 const list=pool('prosecutor');if(!list.length)return null;
 // Strong candidates tend to receive complex cases, but assignments still vary.
 const weighted=list.map(id=>{const skill=NPC[id].legalCareer.trialSkill;return {id,w:1+(c.importance>=4?Math.floor(skill/24):1)}}),sum=weighted.reduce((v,a)=>v+a.w,0);
 let draw=Math.floor(rand()*sum);for(const a of weighted){draw-=a.w;if(draw<0)return a.id}return list[0];
}
function defendantResources(p){
 const wealth=expCap(p?.wealth??35),parent=expCap(p?.parentWealth??p?.parentWealthScore??35);
 const social=/(기업|대표|공직|전문직|법조|연예)/.test(String(p?.socialStatus||''))?14:0;
 return Math.min(100,Math.round(wealth*.66+parent*.22+social));
}
function selectCounsel(p,excluded=[]){
 let list=pool('lawyer').filter(id=>!excluded.includes(id));if(!list.length)list=pool('lawyer');
 if(!list.length)return null;
 const budget=defendantResources(p),publicNeed=budget<27,afford=Math.max(12,budget*1.07+11);
 const candidates=list.map(id=>{
  const x=NPC[id].legalCareer,firm=FIRMS.find(f=>f.id===x.firmId)||FIRMS[8];
  const eligible=publicNeed||firm.fee<=afford;
  const fit=(eligible?5:0)+Math.max(1,Math.round(11-Math.abs(firm.fee-afford)/9))+(x.demand/24)+(Math.min(100,x.fame||0)/28)+rand()*3;
  return {id,score:fit,firm}
 }).sort((a,b)=>b.score-a.score);
 let chosen=publicNeed?candidates.filter(x=>x.firm.tier<=2)[0]||candidates[0]:candidates[0];
 const lawyer=NPC[chosen.id],lc=lawyer.legalCareer;
 const arrangement=publicNeed?'국선변호인':'사선변호인';
 // Appointment as public defender does not require that the attorney is inherently unskilled.
 return {id:chosen.id,arrangement,resources:budget,firmId:arrangement==='국선변호인'?'public':lc.firmId};
}
function defensePerformance(id,firmId){
 const x=NPC[id].legalCareer,f=FIRMS.find(z=>z.id===firmId)||FIRMS[8];
 const quality=expCap(x.trialSkill*.52+x.evidenceSkill*.27+f.research*.16+Math.min(20,x.years)*.25);
 const issues=quality>=78?3:quality>=58?2:1;
 return {quality,issues,firmName:f.name,firmTier:f.tier,experience:x.years};
}
function assign(c){
 if(!c||c.legalRepresentation)return;
 const w=world(),targets=ensurePopulation(openCases().length);
 const defendant=NPC[c.kind==='criminal'?c.who[0]:c.who[1]];
 if(!defendant)return;
 if(defendant.parentWealth==null)defendant.parentWealth=expCap(defendant.wealth*.65+rand()*45);
 const pro=c.kind==='criminal'?selectProsecutor(c):null;
 const defense=selectCounsel(defendant),claimant=c.kind==='civil'?selectCounsel(NPC[c.who[0]],[defense?.id]):null;
 if(!defense)return;
 const originalSide=[...c.side],def=defensePerformance(defense.id,defense.firmId);
 if(pro){c.side[0]=pro;c.story.prosecutor={...c.story.prosecutor,id:pro,years:NPC[pro].legalCareer.years,trialSkill:NPC[pro].legalCareer.trialSkill};c.story.lawyerA={...c.story.lawyerA,id:pro,quality:NPC[pro].legalCareer.trialSkill,years:NPC[pro].legalCareer.years};}
 else if(claimant){c.side[0]=claimant.id;c.story.lawyerA={...c.story.lawyerA,id:claimant.id,quality:defensePerformance(claimant.id,claimant.firmId).quality};}
 c.side[1]=defense.id;
 // The story engine wrote stage speakers before representation was allocated.
 // Update those speaker references atomically; otherwise old attorneys appear as witnesses.
 const replacement=new Map([[originalSide[0],c.side[0]],[originalSide[1],c.side[1]]]);
 for(const stage of c.stages||[])for(const action of stage.actions||[]){
  const mapped=replacement.get(action.who);if(mapped&&mapped!==action.who)action.who=mapped;
 }
 if(c.story?.witness&&c.side.includes(c.story.witness)){const id=freshNPC('사실관계 참고인',Math.max(1,S.caseSerial),'witness');c.story.witness=id;}
 c.story.lawyerB={...c.story.lawyerB,id:defense.id,years:def.experience,quality:def.quality,funding:defense.arrangement};
 const prosecutor=pro?NPC[pro].legalCareer:null;
 const challengePoints=(c.story?.evidenceDetails||[]).slice(0,def.issues).map((e,i)=>({
  evidence:e.title,point:i===0?'작성·획득 경위와 원본을 대조':i===1?'시간대와 진술의 불일치 지적':'대체 원인·제3자 개입 가능성 검토',strength:Math.max(20,Math.min(95,def.quality-Math.round(rand()*18)))
 }));
 c.legalRepresentation={
  judgePoolCount:targets.judge+1,prosecutor:pro,prosecutorExperience:prosecutor?.years||0,prosecutorSkill:prosecutor?.trialSkill||0,
  claimant:claimant?.id||null,defendant:defense.id,attorneyTier:def.firmTier,firmName:def.firmName,
  arrangement:defense.arrangement,clientWealth:defendant.wealth||0,parentWealth:defendant.parentWealth,
  socialStatus:defendant.socialStatus,quality:def.quality,experience:def.experience,challengePoints,
  originalSide,assignedYear:year()
 };
 w.cases[c.id]={side:[...c.side],firms:{defense:def.firmName},assignedYear:year()};
 remember(defense.id,'변론 수임',c.name+' · '+defense.arrangement+' · '+def.firmName,c.id);
 if(pro)remember(pro,'공소 유지',c.name+' · 공판 검사 배당',c.id);
}

function repairLegacyCounselRefs(){
 let changed=0;
 for(const c of CASES){
  const r=c.legalRepresentation;if(!r?.originalSide?.length||!c.stages)continue;
  const replace=new Map([[r.originalSide[0],c.side[0]],[r.originalSide[1],c.side[1]]]);
  for(const stage of c.stages)for(const a of stage.actions||[]){
   const mapped=replace.get(a.who);
   if(mapped&&mapped!==a.who){a.who=mapped;changed++}
  }
 }
 if(changed)save();
 return changed;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',repairLegacyCounselRefs);
else repairLegacyCounselRefs();
const prevGenerate=createGeneratedCase;
createGeneratedCase=function(candidate=null){
 if(S.name)ensurePopulation(Math.max(1,openCases().length+1));
 const c=prevGenerate(candidate);
 if(c){ensurePopulation(openCases().length);assign(c);save()}
 return c;
};
function yearlyCareer(){
 const w=world(),thisYear=year();if(w.lastCareerYear>=thisYear)return;
 for(const id of [...w.people]){
  const p=NPC[id];if(!p||p.alive===false)continue;const c=p.legalCareer;if(!c)continue;
  c.years=Math.max(0,thisYear-c.startedYear);c.trialSkill=expCap(c.trialSkill+Math.floor(rand()*5)-1);
  c.demand=expCap(c.demand+Math.floor(rand()*11)-5);
  c.fame=expCap((c.fame||0)-Math.max(1,Math.round((c.fame||0)/26))); // Public attention slowly fades; skill persists.
  let next=null,reason='';
  if(c.role==='judge'&&c.years>=7&&rand()<.045){next='lawyer';reason='퇴직 후 개업'}
  if(c.role==='prosecutor'&&c.years>=5&&rand()<.055){next='lawyer';reason='검찰 퇴직 후 변호사 개업'}
  if(c.role==='lawyer'){
   const firm=FIRMS.find(x=>x.id===c.firmId);
   if(c.demand<33&&c.years>=3&&rand()<.47){c.firmId='public';reason='사선 수임 감소로 국선 사건 위주 전환';}
   else if(c.firmId==='public'&&c.demand>65&&rand()<.35){c.firmId=pick(FIRMS.filter(x=>x.id!=='public'&&x.tier<=3)).id;reason='사선 수임 회복';}
   else if(c.demand>76&&firm?.tier<=3&&rand()<.21){c.firmId=pick(FIRMS.filter(x=>x.tier>=4)).id;reason='상위 로펌으로 이직'}
   if(reason){c.careerHistory.push({year:thisYear,role:'lawyer',firmId:c.firmId,reason});remember(id,'법조인 경력',reason,'legal-career-'+thisYear)}
  }
  if(next){c.role=next;c.firmId=pick(FIRMS.filter(x=>x.id!=='public')).id;c.careerHistory.push({year:thisYear,role:next,firmId:c.firmId,reason});p.career='변호사';p.role='변호사';remember(id,'법조인 이직',reason,'legal-career-'+thisYear)}
 }
 w.lastCareerYear=thisYear;ensurePopulation(Math.max(1,openCases().length));save();
}
// Courtroom skill changes how carefully the judge must examine arguments, not objective guilt.
const originalEvaluate=StoryEngine.evaluate;
StoryEngine.evaluate=function(c,selected,decision){
 const base=originalEvaluate(c,selected,decision);
 if(!base||!c.legalRepresentation)return base;
 const r=c.legalRepresentation,flags=new Set((selected||[]).map(x=>x.flag));
 const defenseDemand=Math.max(1,Math.round((r.quality-30)/13));
 const prosecutionDemand=c.kind==='criminal'?Math.max(0,Math.round((r.prosecutorSkill-40)/18)):0;
 const dueProcess=(flags.has('cross')?1:0)+(flags.has('chain')?1:0)+(flags.has('elements')?1:0);
 const bonus=dueProcess>=2?Math.min(5,Math.round(defenseDemand/2)+prosecutionDemand):0;
 const penalty=dueProcess===0?Math.min(9,defenseDemand+prosecutionDemand):dueProcess===1?Math.min(4,Math.floor((defenseDemand+prosecutionDemand)/2)):0;
 return {...base,score:Math.min(100,Math.max(10,base.score+bonus-penalty)),
   why:(base.why||'')+' 변호인의 반박력 '+r.quality+'/100, 검사의 공소수행 '+(r.prosecutorSkill||0)+'/100을 고려할 때, 주요 반증·증거 출처 심리 '+dueProcess+'/3항목이 판결의 검토 충실도 평가에 반영됐습니다.'};
};
const prevCourtStep=courtStep;
courtStep=function(index){
 const c=CASES.find(x=>x.id===ui.caseId),st=c&&S.cases[c.id];
 const previous=st?.actions?.length||0;
 const out=prevCourtStep(index);
 if(!c?.legalRepresentation||!st||st.actions.length<=previous)return out;
 const r=c.legalRepresentation,prosecutor=r.prosecutorSkill||0,defense=r.quality||0;
 const argument=r.challengePoints[Math.min(st.phase-1,r.challengePoints.length-1)];
 const criticism=argument?argument.evidence+'에 대해 '+argument.point:'주요 증거에 대한 일반 반박';
 const dStrength=defense>=75?'기록의 구체적 모순을 제시해 추가 확인을 요청했다':defense>=50?'원본과 작성 경위를 집중 추궁했다':'증거의 신빙성에 이의를 제기했으나 구체적 반증은 제한적이었다';
 const pStrength=prosecutor>=75?'검사는 원본·제출 경위를 비교하여 반대신문에 대응했다':prosecutor>=50?'검사는 기소 내용과 제출 증거의 연관성을 설명했다':'검사의 반박은 증거 연결 부분에서 추가 보완을 요구받았다';
 const note='[변론력 반영] '+criticism+'. 변호인: '+dStrength+'. '+(c.kind==='criminal'?pStrength+'. ':'');
 st.legalDynamics??={};
 st.legalDynamics.lastArgument=note;
 st.legalDynamics.defenseQuality=defense;
 st.legalDynamics.prosecutorQuality=prosecutor;
 st.actions[st.actions.length-1].says+=' '+note;
 remember(r.defendant,'법정 변론',note,c.id);
 save();render();return out;
};
const prevAdvance=advanceWeek;
advanceWeek=function(...args){const out=prevAdvance(...args);if(S.name&&out!==false)yearlyCareer();return out};
function roster(){
 const w=world(),n=Object.keys(w.cases).length;return '<section class="panel legal-world"><h3>⚖ 법조인 생태계</h3><p class="small muted">활성 사건 대비 법관 0.6배 · 검사 1배 · 변호사 2배를 목표로 인력이 생성되며, 판사는 플레이어를 포함합니다.</p>'+
 '<div class="legal-world-metrics">'+[['판사',pool('judge').length+1],['검사',pool('prosecutor').length],['변호사',pool('lawyer').length],['로펌',FIRMS.length-1]].map(([a,b])=>'<div><b>'+b+'</b><small>'+a+'</small></div>').join('')+'</div>'+
 '<details><summary>로펌·국선변호인 명부</summary>'+FIRMS.map(f=>'<p class="small"><strong>'+f.name+'</strong> · '+f.kind+' · 등급 '+f.tier+'/5 · 조사 지원 '+f.research+'</p>').join('')+'</details></section>';
}
const previousLegalNPC=popupNPC;
popupNPC=function(id){
 const p=NPC[id],lc=p?.legalCareer;
 if(!lc)return previousLegalNPC(id);
 const firm=FIRMS.find(f=>f.id===lc.firmId);
 const trail=lc.careerHistory.slice(-5).reverse().map(z=>'<p class="small">'+h(z.year)+'년 · '+h(z.role==='judge'?'판사':z.role==='prosecutor'?'검사':'변호사')+' · '+h(z.reason)+'</p>').join('');
 const panel='<div class="legal-person-card"><p><strong>현재 직역</strong> '+h(p.career)+' · 경력 '+h(lc.years)+'년</p>'+
  (firm?'<p><strong>소속</strong> '+h(firm.name)+' · 로펌 등급 '+firm.tier+'/5</p>':'')+
  '<p><strong>공소·변론 능력</strong> '+lc.trialSkill+'/100 · <strong>증거 분석</strong> '+lc.evidenceSkill+'/100</p>'+
  '<p><strong>업계 수임 평판</strong> '+lc.demand+'/100 · <strong>직업 윤리</strong> '+lc.ethics+'/100</p>'+
  '<details><summary>법조인 경력 변천</summary>'+trail+'</details></div>';
 modal(p.name+' · '+p.career,panel,'<button class="btn primary full" data-action="dismiss">닫기</button>');
};
const previousPeople=people;
people=function(){
 const base=previousPeople(),list=world().people.filter(id=>NPC[id]?.legalCareer).sort((a,b)=>NPC[b].legalCareer.demand-NPC[a].legalCareer.demand);
 const panel='<section class="panel legal-profession-network"><h3>⚖ 살아있는 법조인 네트워크</h3><p class="small muted">판사·검사·변호사는 이직 후에도 같은 NPC ID와 과거 재판 기록을 유지합니다.</p><div class="legal-network-grid">'+
 list.slice(0,30).map(id=>{const p=NPC[id],c=p.legalCareer,f=FIRMS.find(x=>x.id===c.firmId);return '<button class="legal-network-person" data-action="npc" data-id="'+h(id)+'"><b>'+h(p.name)+'</b><span>'+h(p.career)+' · '+c.years+'년</span><small>'+(f?h(f.name)+' · ':'')+'공판·변론 '+c.trialSkill+'/100</small></button>'}).join('')+'</div></section>';
 return base+panel;
};
const prevHome=home;
home=function(){return prevHome()+roster()};
const prevCourt=court;
court=function(){
 let html=prevCourt(),c=CASES.find(x=>x.id===ui.caseId);if(!c?.legalRepresentation)return html;
 const r=c.legalRepresentation,def=NPC[r.defendant],pro=NPC[r.prosecutor];
 const x='<section class="panel counsel-ability"><h3>🧑‍⚖️ 법조인 구성과 변론력</h3>'+
 (pro?'<div><b>담당 검사</b> '+h(pro.name)+' · 경력 '+r.prosecutorExperience+'년 · 공소 수행 '+r.prosecutorSkill+'/100</div>':'')+
 '<div><b>피고 측 변호사</b> '+h(def?.name||'미상')+' · '+h(r.arrangement)+' · '+h(r.firmName)+' ('+r.attorneyTier+'/5)</div>'+
 '<p class="small">변론 평가 '+r.quality+'/100 · 경력 '+r.experience+'년 · 추가 반박 '+r.challengePoints.length+'건</p>'+
 '<details><summary>증거별 반박 검토</summary>'+r.challengePoints.map(v=>'<p class="small"><b>'+h(v.evidence)+'</b> — '+h(v.point)+' · 조사력 '+v.strength+'</p>').join('')+'</details></section>';
 const mark='<section class="panel action-panel">';
 return html.includes(mark)?html.replace(mark,x+mark):x+html;
};
})();


;/* initial_docket_v26.js */
/* THE VERDICT v2.6 — four distinct randomly assigned cases at new career start */
'use strict';
(()=>{
const localDate=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
let launching=false;
function isNew(){
 if(!S.name||S.week!==0||S.ended)return false;
 if(S.legalWorld?.firstFour)return false;
 if((S.generatedCases||[]).some(c=>(S.cases[c.id]?.actions||[]).length||S.cases[c.id]?.verdict))return false;
 if((S.generatedCases||[]).length>4)return false;
 return true;
}
async function ensurePack(){
 if(CasePackEngine.pool(S).length>=80)return;
 try{
 const res=await fetch(new URL('./content-packs/beta-weekend-100-v1.json',location.href),{cache:'no-cache'});
 if(!res.ok)throw Error('팩 다운로드 실패');
 const p=await res.json();if(p.archetypes?.length!==100)throw Error('100건 무결성 오류');
 const already=(S.casePacks||[]).some(x=>x.packId===p.packId&&x.version===p.version);
 if(!already){const installed=CasePackEngine.install(S,p);if(!installed.ok)throw Error(installed.error||'팩 설치 실패')}
 }catch(e){console.warn('첫 배당 사건팩 준비 중',e)}
}
async function firstFour(){
 if(launching||!isNew())return;
 launching=true;
 try{
 await ensurePack();
 // Preserve existing judge records; suppress only untouched legacy starter cases on a genuinely new game.
 for(const c of CASES){if(c.generated||c.week>0)continue;const st=S.cases[c.id];if(st&&!st.verdict&&!(st.actions||[]).length)st.referred=true;}
 // Replace untouched generic starter cases so all four come from the curated 100-case pack.
 for(const c of CASES){if(c.generated&&!c.contentPack?.archetypeId&&S.cases[c.id]&&!S.cases[c.id].verdict&&!(S.cases[c.id].actions||[]).length)S.cases[c.id].referred=true;}
 const active=CASES.filter(c=>c.generated&&c.contentPack?.archetypeId&&S.cases[c.id]&&!S.cases[c.id].verdict&&!S.cases[c.id].referred&&c.week<=S.week);
 const chosen=new Set(active.map(c=>c.contentPack?.archetypeId).filter(Boolean));
 const pool=CasePackEngine.pool(S).filter(x=>!chosen.has(x.a.id));
 const picks=[];
 while(pool.length&&picks.length<4-active.length){const idx=Math.floor(rand()*pool.length);picks.push(pool.splice(idx,1)[0])}
 let done=active.length;
 for(const x of picks){
  try{const c=createGeneratedCase(x);if(c)done++}
  catch(e){console.warn('첫 사건 배당 오류',x.a.id,e)}
 }
 // Controlled fallbacks: do not silently fabricate duplicate archetype cases.
 if(done<4){for(const x of pool){if(done>=4)break;try{if(createGeneratedCase(x))done++}catch(e){console.warn('대체 사건 배당 오류',e)}}}
 if(done!==4){toast('사건팩 로딩에 문제가 있습니다. 첫 배당 '+done+'/4건을 확인해 주세요.');return;}
 S.legalWorld??={};
 S.legalWorld.firstFour=true;
 S.legalWorld.firstFourWeek=S.week;
 S.legalWorld.firstFourCaseIDs=CASES.filter(c=>c.generated&&!S.cases[c.id]?.referred&&!S.cases[c.id]?.verdict).slice(-4).map(c=>c.id);
 const db=S.realtimeInbox;
 if(db?.enabled){db.acceptedByDay??={};db.acceptedByDay[localDate()]=4;}
 ui.tab='home';ui.caseId=S.legalWorld.firstFourCaseIDs[0];
 log('첫 배당','새 법관 커리어 · 4건 자동 배당','100건 사건 원형에서 중복 없이 무작위 선택');
 save();render();toast('첫 사건 4건이 재판부에 배당됐습니다.');
 }finally{launching=false}
}
const formerManifest=loadPackManifest;
loadPackManifest=async function(...args){
 const result=await formerManifest(...args);
 if(isNew())await firstFour();
 return result;
};
const formerClick=clicker;
clicker=function(e){
 const action=e.target.closest('[data-action]')?.dataset.action;
 formerClick(e);
 if(action==='start'&&S.name)firstFour().catch(err=>console.warn('시작 4건 배당 오류',err));
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(isNew())firstFour().catch(err=>console.warn(err))});
else if(isNew())firstFour().catch(err=>console.warn(err));
})();


;/* legal_fame_v28.js */
/* THE VERDICT v2.8 — fame, career legacy, media visibility and reputation */
'use strict';
(()=>{
 const priorConclude=conclude,priorHome=home,priorPeople=people,priorNPC=popupNPC;
 const cap=v=>Math.min(100,Math.max(0,Math.round(v)));
 const htm=v=>h(String(v??''));
 function award(id,caseObj,grade,role,success){
  const p=NPC[id],lc=p?.legalCareer;if(!lc)return;
  lc.fame=cap((lc.fame||0)+Math.max(2,Math.round(caseObj.importance*2.2+(grade>=80?3:0)+(success===true?3:0))));
  lc.caseCount=(lc.caseCount||0)+1;
  lc.notableCases??=[];
  const entry={caseId:caseObj.id,title:caseObj.name,year:year(),importance:caseObj.importance,role,verdict:S.cases[caseObj.id]?.verdict,grade};
  lc.notableCases.unshift(entry);lc.notableCases=lc.notableCases.slice(0,30);
  if(success===true)lc.goodOutcomes=(lc.goodOutcomes||0)+1;
  if(success===false)lc.unsuccessfulOutcomes=(lc.unsuccessfulOutcomes||0)+1;
  const old=lc.fameLabel||'무명';
  lc.fameLabel=lc.fame>=80?'전국적 인지도':lc.fame>=55?'법조계 유명인':lc.fame>=30?'지역 법조계 주목':'일반 법조인';
  if(old!==lc.fameLabel&&lc.fame>=30){
    remember(id,'법조계 평판',lc.fameLabel+' · '+caseObj.name,caseObj.id);
    if(caseObj.importance>=4)news('법조계 인물 · '+p.name,p.name+' '+p.career+'이(가) '+caseObj.name+'으로 언론의 주목을 받았다. 법률적 실력과 대중 인지도는 구별해야 한다.','법조 뉴스');
  }
 }
 conclude=function(choice){
  const c=CASES.find(x=>x.id===ui.caseId),had=c&&S.cases[c.id]?.verdict;
  const ret=priorConclude(choice);
  if(!c||had||!S.cases[c.id]?.verdict||!c.legalRepresentation)return ret;
  const st=S.cases[c.id],r=c.legalRepresentation,criminal=c.kind==='criminal';
  const winPro=criminal?st.verdict==='guilty':st.verdict==='full';
  const winDef=criminal?st.verdict==='notguilty':st.verdict==='dismiss';
  if(r.prosecutor)award(r.prosecutor,c,st.grade,'검사',winPro);
  if(r.claimant)award(r.claimant,c,st.grade,'원고 대리인',winPro);
  if(r.defendant)award(r.defendant,c,st.grade,'피고 측 변호사',winDef);
  S.legalWorld??={};S.legalWorld.playerFame=cap((S.legalWorld.playerFame||0)+Math.max(1,c.importance*2)+(st.grade>=80?2:0));
  S.legalWorld.playerNotableCases??=[];
  S.legalWorld.playerNotableCases.unshift({id:c.id,title:c.name,year:year(),grade:st.grade});
  S.legalWorld.playerNotableCases=S.legalWorld.playerNotableCases.slice(0,60);
  save();return ret;
 };
 function leaders(){
  const members=(S.legalWorld?.people||[]).filter(id=>NPC[id]?.legalCareer);
  return members.sort((a,b)=>(NPC[b].legalCareer.fame||0)-(NPC[a].legalCareer.fame||0))
   .slice(0,5).map((id,i)=>{
     const p=NPC[id],lc=p.legalCareer;
     return '<button class="court-fame-person" data-action="npc" data-id="'+htm(id)+'"><span>'+String(i+1)+'.</span><b>'+htm(p.name)+'</b><small>'+htm(p.career)+' · 인지도 '+(lc.fame||0)+'/100</small></button>';
   }).join('');
 }
 home=function(){
  const html=priorHome(),f=S.legalWorld?.playerFame||0;
  return html+'<section class="panel court-fame-summary"><div class="row between"><h3>🏅 법조계 평판</h3><span class="chip">나의 인지도 '+f+'/100</span></div><p class="muted small">유명세는 재판의 규모·언론 노출·경력으로 쌓이고 시간이 지나면 줄어듭니다. 공정한 판단력과는 별도입니다.</p><details><summary>주목받는 법조인 TOP 5</summary>'+leaders()+'</details></section>';
 };
 people=function(){
  const html=priorPeople();
  return html+'<section class="panel court-fame-directory"><h3>📣 법조계 인지도</h3><p class="muted small">잘 알려진 검사와 변호사도 무조건 유능하거나 옳은 것은 아닙니다.</p>'+leaders()+'</section>';
 };
 popupNPC=function(id){
  const p=NPC[id],lc=p?.legalCareer;
  if(!lc)return priorNPC(id);
  const recent=(lc.notableCases||[]).slice(0,4).map(x=>'<p class="small">'+htm(x.year)+' · '+htm(x.title)+' · '+htm(x.role)+'</p>').join('');
  const firmRecord=(S.legalWorld?.firms||[]).find(x=>x.id===lc.firmId);const firm=p.career==='변호사'?'<p>소속 '+htm(firmRecord?.name||'개인 법률사무소')+' · 등급 '+(firmRecord?.tier||1)+'/5</p>':'';
  modal(p.name+' · '+p.career,
    '<div class="court-fame-profile"><b>'+htm(lc.fameLabel||'일반 법조인')+'</b><p>대중 인지도 '+(lc.fame||0)+'/100 · 관여 사건 '+(lc.caseCount||0)+'건</p>'+
    '<p>공판·변론 능력 '+lc.trialSkill+'/100 · 증거 분석 '+lc.evidenceSkill+'/100 · 경력 '+lc.years+'년</p>'+
    firm+'<details><summary>대표 사건과 과거 경력</summary>'+recent+
    (lc.careerHistory||[]).slice(-5).reverse().map(x=>'<p class="small">'+htm(x.year)+' · '+htm(x.reason)+'</p>').join('')+
    '</details></div>','<button class="btn primary full" data-action="dismiss">닫기</button>');
 };
})();

;/* court_gameplay_v27.js */
/* THE VERDICT v2.7 — focused courtroom user interface
   Keeps original court controls and events; rearranges their existing DOM nodes. */
'use strict';
(()=>{
 const priorCourt=court,priorClick=clicker;
 const tabs=[['hearing','⚖','심리·판결'],['arguments','📄','양측 주장'],['evidence','🔎','증거·증인'],['history','▤','재판 기록']];
 const esc=v=>h(String(v??''));
 let lastCase=null;
 function element(tag,className,html){
  const e=document.createElement(tag);if(className)e.className=className;if(html!==undefined)e.innerHTML=html;return e;
 }
 function findAll(root,selector){return Array.from(root.querySelectorAll(selector))}
 function move(target,node){if(node&&node.isConnected!==false)target.appendChild(node)}
 function groupDisclosure(title,node){
  const wrapper=element('details','court-detail-archive');
  wrapper.innerHTML='<summary>'+esc(title)+'</summary>';
  wrapper.appendChild(node);return wrapper;
 }
 court=function(){
  const prior=priorCourt(),c=CASES.find(x=>x.id===ui.caseId),st=c&&S.cases[c.id];
  if(!c||!st||!prior.includes('beta-court'))return prior;
  // Parse DOM, move each interactive existing component only once.
  const temp=document.createElement('template');temp.innerHTML=prior;
  const original=temp.content.querySelector('.beta-court');if(!original)return prior;
  if(lastCase!==c.id){ui.courtFocus='hearing';lastCase=c.id}
  const focus=tabs.some(t=>t[0]===ui.courtFocus)?ui.courtFocus:'hearing';
  const claim=original.querySelector('.case-advocates.editorial-advocates')||original.querySelector('.case-advocates');
  const overview=original.querySelector('.case-narrative');
  const action=original.querySelector('.action-panel');
  const hearing=original.querySelector('.live-hearing-panel');
  const counsel=original.querySelector('.counsel-ability');
  const parties=original.querySelector('.lawsuit-parties');
  const witnessSummary=original.querySelector('.compact-case-witness');
  const evidence=original.querySelector('.evidence-panel');
  // Identify the interactive witness panel by contents instead of a brittle CSS class name.
  const special=findAll(original,'section.panel').filter(x=>
   x!==overview&&x!==claim&&x!==action&&x!==hearing&&x!==counsel&&x!==parties&&x!==witnessSummary&&x!==evidence);
  const hearingExtra=special.filter(x=>!!x.querySelector('[data-action="witnessQuestion"],[data-action="dramaAsk"],[data-action="activateWitnesses"]'));
  const metadata=special.filter(x=>x.classList.contains('new-hearing-briefs')||x.classList.contains('verdict-arc')||x.classList.contains('deep-drama')||x.classList.contains('verdict-narrative-layer'));
  const logPanels=special.filter(x=>!hearingExtra.includes(x)&&!metadata.includes(x)&&!x.classList.contains('calendar-panel'));
  const ready=(st.hearingHistory||[]).filter(x=>x.kind==='resumed').length;
  const status=st.verdict?'선고 완료':st.liveHearing&&!st.liveHearing.done&&Date.now()<st.liveHearing.until?'다음 기일 대기':st.phase>=3?'선고 검토':'심리 '+Math.min(3,st.phase+1)+'/3';
  const header=element('header','court-play-header',
   '<div class="court-case-kicker">THE VERDICT <span>·</span> '+esc(c.kind==='criminal'?'형사 재판':'민사·가사 재판')+'</div>'+
   '<div class="court-play-title"><h2>'+esc(c.name)+'</h2><button class="btn outline mini" data-action="tab" data-tab="courtList">사건 목록</button></div>'+
   '<div class="court-play-status"><span>사건 '+esc(c.id)+'</span><span>'+esc(status)+'</span><span>기일 '+ready+'회</span></div>');
  const page=element('div','court-play');
  page.appendChild(header);
  if(overview){overview.classList.add('court-play-overview');page.appendChild(overview)}
  const nav=element('nav','court-play-tabs');
  nav.setAttribute('aria-label','재판 화면 메뉴');
  for(const [key,icon,label] of tabs){
   const b=element('button','court-play-tab'+(focus===key?' active':''),'<span aria-hidden="true">'+icon+'</span> '+label);
   b.type='button';b.dataset.action='courtFocus';b.dataset.focus=key;b.setAttribute('aria-pressed',String(focus===key));
   nav.appendChild(b);
  }
  page.appendChild(nav);
  const screens={};
  for(const [key] of tabs){
   const panel=element('section','court-screen court-screen-'+key);panel.hidden=focus!==key;
   panel.setAttribute('aria-label',tabs.find(x=>x[0]===key)[2]);page.appendChild(panel);screens[key]=panel;
  }
  if(hearing)screens.hearing.appendChild(hearing);
  if(action)screens.hearing.appendChild(action);
  if(!hearing&&!action)screens.hearing.appendChild(element('section','panel','<p>현재 진행할 심리가 없습니다. 사건 기록을 확인해 주세요.</p>'));
  if(claim)screens.arguments.appendChild(claim);
  if(parties)screens.arguments.appendChild(groupDisclosure('당사자·대리인 확인',parties));
  if(counsel)screens.arguments.appendChild(groupDisclosure('검사·변호사 경력과 능력',counsel));
  if(evidence)screens.evidence.appendChild(evidence);
  if(witnessSummary)screens.evidence.appendChild(witnessSummary);
  for(const x of hearingExtra)screens.evidence.appendChild(x);
  for(const x of metadata)if(!x.parentElement?.closest('.court-screen'))screens.history.appendChild(groupDisclosure(x.querySelector('h3')?.textContent||'사건 추가 자료',x));
  const extras=findAll(original,'section.panel').filter(x=>
   x!==overview&&x!==claim&&x!==hearing&&x!==action&&x!==parties&&x!==counsel&&x!==witnessSummary&&x!==evidence&&
   !hearingExtra.includes(x)&&!metadata.includes(x)&&!x.classList.contains('calendar-panel')&&
   !x.closest('.court-screen'));
  for(const node of [...logPanels,...extras])if(node.parentElement&&!node.closest('.court-screen')&&!node.classList.contains('calendar-panel'))
    screens.history.appendChild(groupDisclosure(node.querySelector('h3')?.textContent||'추가 기록',node));
  if(!screens.history.children.length)screens.history.appendChild(element('section','panel','<p>진행된 기일과 조사 기록이 쌓이면 여기에 표시됩니다.</p>'));
  if(!screens.evidence.children.length)screens.evidence.appendChild(element('section','panel','<p>추가 조사 자료가 아직 없습니다.</p>'));
  // On rerender, reset view focus only when a new case is selected.
  return page.outerHTML;
 };
 clicker=function(e){
  const b=e.target.closest('[data-action]');
  if(b?.dataset.action==='courtFocus'){
   if(!tabs.some(x=>x[0]===b.dataset.focus))return;
   ui.courtFocus=b.dataset.focus;render();return;
  }
  return priorClick(e);
 };
})();
