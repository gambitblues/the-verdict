/* THE VERDICT v0.8 — NPC biography and sentencing/life-state simulation. Fictional rules, not real sentencing advice. */
'use strict';
window.LifeJustice=(()=>{
 const jobs=['회사원','자영업자','공무원','프리랜서','서비스업 종사자','연구원','기술직','교육 종사자','무직'];
 const ps=['안정된 중산층 가정','경제적으로 넉넉한 자영업 가정','형편이 어려웠던 가정','한부모와 성장','조부모와 성장','부모의 잦은 이사로 전학 경험'];
 const sib=['외동','형 1명','누나 1명','동생 2명','남매 2명','형제자매 3명'];
 const spouse=['미혼','기혼','이혼','사별'];
 const mbti=['ISTJ','ISFJ','INFJ','INTJ','ISTP','ISFP','INFP','INTP','ESTP','ESFP','ENFP','ENTP','ESTJ','ESFJ','ENFJ','ENTJ'];
 const blood=['A','B','AB','O'];
 const pick=(r,a)=>a[Math.floor(r()*a.length)];
 const number=(r,a,b)=>a+Math.floor(r()*(b-a+1));
 const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
 function enrich(p,r,now){
  if(!Number.isInteger(p.bornYear))p.bornYear=now-number(r,22,66);
  p.gender??=pick(r,['여성','남성']);
  p.parentWealth??=number(r,5,95);p.wealth??=number(r,5,95);
  p.parentsOrigin??=pick(r,ps);p.siblings??=pick(r,sib);
  p.parentRelationship??=pick(r,['가까움','다소 소원함','주기적으로 왕래','연락이 거의 없음']);
  p.childhoodLocation??=pick(r,['서울','수도권','광역시','중소도시','농촌']);
  p.degree??=pick(r,['고졸','전문학사','학사','석사','박사']);
  p.educationField??=pick(r,['경영','법학','공학','인문','보건','예체능','교육','사회과학']);
  p.mbti??=pick(r,mbti);p.blood??=pick(r,blood);
  p.siblingsRelation??=pick(r,['가깝게 지냄','가끔 연락','불화가 있음','왕래 없음']);
  p.maritalStatus??=pick(r,spouse);p.children??=p.maritalStatus==='기혼'?number(r,0,2):0;
  p.partnerId??=null;p.friendIds??=[];p.familyIds??=[];
  p.jobHistory??=[{year:now,job:p.career||p.role||pick(r,jobs),reason:'기록 시작'}];
  p.financialHistory??=[{year:now,wealth:p.wealth,reason:'프로필 생성'}];
  p.relationshipHistory??=[];p.custodyHistory??=[];p.legalStatus??='일반 생활';
  p.traits??={empathy:number(r,15,95),conscientiousness:number(r,15,95),impulsivity:number(r,5,85),stressControl:number(r,15,95),honesty:number(r,10,95)};
  p.biographyVersion=1;
  return p;
 }
 // Backward-compatible deterministic profile completion (does not advance game RNG).
 function hydrate(S,NPC){for(const [id,p] of Object.entries(NPC)){
  if(id==='self'||p.biographyVersion)continue;
  let n=2166136261;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;
  const r=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296};enrich(p,r,2027);
  if(S.npcDB?.[id])S.npcDB[id]=p;
 }}
 function currentSentence(p,w){return (p.custodyHistory||[]).find(x=>x.kind==='징역형'&&x.startWeek<=w&&x.releaseWeek>w&&!x.releasedWeek)}
 function isFree(p,w){return !currentSentence(p,w)}
 const offenceWeeks={murder:[260,780],sexual:[52,312],assault:[12,156],fraud:[12,260],embezzle:[12,260],bribe:[12,208],stalking:[12,104],fire:[52,364],privacy:[8,104],defamation:[0,52],accident:[0,104],celebrity:[0,104]};
 function impactScope(c){return c.story?.deep?.key||c.story?.key||(/살인/.test(c.legal||'')?'murder':/성폭/.test(c.legal||'')?'sexual':/사기/.test(c.legal||'')?'fraud':'other')}
 function applyVerdict(S,NPC,c,st,v,yr,w,remember,news){
  const info={caseId:c.id,week:w,partyIds:[...(c.who||[])],verdict:v.id,kind:c.kind||'civil',effects:[]};
  for(const id of c.who||[]){const p=NPC[id];if(!p)continue;p.courtHistory??=[];p.courtHistory.push({caseId:c.id,year:yr,judgment:v.label});}
  if(c.kind==='criminal'&&v.id==='guilty'&&c.who?.[0]){
   const p=NPC[c.who[0]],key=impactScope(c),range=offenceWeeks[key]||[8,104];
   // Design-only representative incarceration, NOT statutory minimum or actual sentence.
   // Fictional sentencing: independently records seriousness, harm, intent, prior convictions and mitigation.
   const prior=(p.custodyHistory||[]).filter(x=>x.kind==='징역형').length;
   const harm=limit((c.importance||3)*17,0,100);
   const intent=/살인|사기|성폭|횡령|강도/.test(String(c.legal||c.name||''))?70:45;
   const evidence=limit(st.grade??50,0,100);
   const culpability=limit(intent+(c.importance||3)*3,0,100);
   const mitigation=(p.traits?.conscientiousness||50)>75?9:3;
   const aggravation=Math.min(24,prior*8);
   const seriousness=limit(Math.round(harm*.60+culpability*.40+aggravation-mitigation),0,100);
   const weeks=Math.max(4,Math.round((range[0]+(range[1]-range[0])*seriousness/100)/4)*4);
   const sentencingFactors={harm,intent,evidenceStrength:evidence,culpability,priorConvictions:prior,aggravation,mitigation,seriousness,fictional:true};
   const sentence={kind:'징역형',startWeek:w,releaseWeek:w+weeks,releasedWeek:null,termWeeks:weeks,caseId:c.id,originalCareer:p.career||p.role,priorWealth:p.wealth,reason:'게임 전용 양형 모형 · 실제 법정형 아님',sentencingFactors};
   p.custodyHistory??=[];p.custodyHistory.push(sentence);p.legalStatus='복역 중';p.previousCareer=p.career;p.career='복역 중';p.wealth=limit(Math.round((p.wealth||40)*.83),0,100);
   const body=`${c.id} 선고 후 ${Math.round(weeks/52*10)/10}년 상당의 가상 형기 시작 (실제 양형표 아님)`;
   remember(c.who[0],'형 집행',body,c.id);info.effects.push({npcId:c.who[0],type:'수감',weeks});
   news('판결 후 형 집행',`${p.name} 관련 판결이 게임 세계에서 확정되어 형 집행 상태가 기록됐다.`,'법조일보');
  }else if(c.kind==='criminal'&&v.id==='notguilty'&&c.who?.[0]){
   const p=NPC[c.who[0]];p.legalStatus='무죄 확정 · 사회생활';
   remember(c.who[0],'무죄 확정',`${c.id} 사건에서 무죄 판결. 생활·직업 복귀 가능성은 별도`,c.id);
   info.effects.push({npcId:c.who[0],type:'무죄'});
  }else if(c.kind==='civil'){
   for(const id of c.who||[]){const p=NPC[id];if(!p)continue;
    p.financialHistory??=[];p.financialHistory.push({year:yr,wealth:p.wealth,reason:`${c.id} 민사판결 영향 가능`});
    remember(id,'민사 판결 후 생활',`${c.id} 판결에 따라 채권 회수·지급 및 관계 정리를 진행`,c.id);
   }
  }
  return info;
 }
 function weekTick(S,NPC,w,remember,news,log){
  for(const [id,p] of Object.entries(NPC)){
   if(!p.custodyHistory)continue;
   for(const sentence of p.custodyHistory){if(sentence.kind!=='징역형'||sentence.releasedWeek||w<sentence.releaseWeek)continue;
    sentence.releasedWeek=w;p.legalStatus='출소 · 사회 복귀';
    p.career='구직·사회 복귀 준비';p.reentry={startWeek:w,stage:'구직 중',priorCareer:sentence.originalCareer,completed:false};
    p.wealth=limit(Math.round((p.wealth||25)*.9),0,100);
    remember(id,'출소',`${sentence.caseId}에 따른 형기 종료. 거주·구직·가족관계 재정비 시작`,sentence.caseId);
    log('NPC 생활',`${p.name} 출소`,`과거 ${sentence.caseId} 판결의 장기 결과가 발생했다.`);
   }
   if(p.reentry&&!p.reentry.completed&&w-p.reentry.startWeek>=26){
    p.reentry.completed=true;p.reentry.stage='생활 재정착';
    const job=p.traits?.conscientiousness>=60&&p.wealth>=25?'중소기업 취업': '비정규·임시직 구직';
    p.career=job;p.jobHistory??=[];p.jobHistory.push({year:2027+Math.floor(w/52),job,reason:'출소 후 사회 복귀'});
    remember(id,'사회 복귀',`출소 후 약 6개월 경과, 현재 생활: ${job}`,p.custodyHistory.at(-1).caseId);
   }
  }
 }
 function annualLifeTick(S,NPC,yr,w,remember,news,r){
  // Imprisoned NPCs do not participate in ordinary job switching or marriage event pools.
  // Employment/financial progression stays tied to a dated history.
  for(const p of Object.values(NPC)){
   if(!p||!p.biographyVersion||!isFree(p,w))continue;
   if(p.financialHistory?.at(-1)?.year!==yr)p.financialHistory.push({year:yr,wealth:p.wealth||0,reason:'연도별 재산 상태 기록'});
   if(p.jobHistory?.at(-1)?.job!==p.career)p.jobHistory.push({year:yr,job:p.career||p.role,reason:'직업 상태 변경'});
   if(p.life?.marital&&p.maritalStatus!==p.life.marital){p.maritalStatus=p.life.marital;p.relationshipHistory.push({year:yr,type:'혼인 상태 변화',detail:p.life.marital});}
  }
 }
 function custodySummary(p,w){const hist=p.custodyHistory||[];if(!hist.length)return '확정된 복역 이력 없음';return hist.slice(-3).map(x=>`${x.caseId}: ${x.releasedWeek?'출소 완료':isFree(p,w)?'형기 종료':'복역 중'} (${Math.round(x.termWeeks/52*10)/10}년 상당)`).join(' · ')}
 function summary(p,yr,w){return [`${p.gender||'미상'} · ${p.bornYear?yr-p.bornYear+'세':'연령 미상'}`,`학위 ${p.degree||'미상'} (${p.educationField||'전공 미상'})`,`부모 경제수준 ${p.parentWealth??'?'} / 100`,`형제 ${p.siblings||p.family||'미상'}`,`혼인 ${p.maritalStatus||'미상'} · 자녀 ${p.children??0}명`,`MBTI ${p.mbti||'-'} / 혈액형 ${p.blood||'-'}`,`생활 ${p.legalStatus||'일반 생활'}`].join(' · ')}
 return {enrich,hydrate,isFree,currentSentence,applyVerdict,weekTick,annualLifeTick,summary,custodySummary};
})();
