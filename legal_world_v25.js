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
 const p=NPC[id];p.legalCareer.trialSkill=expCap(25+p.proficiency*.72+rand()*19);
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
  const fit=(eligible?5:0)+Math.max(1,Math.round(11-Math.abs(firm.fee-afford)/9))+(x.demand/24)+rand()*3;
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
