/* THE VERDICT v0.9: persistent family graph, offline and deterministic migrations. */
'use strict';
window.FamilyEngine=(()=>{
 const limit=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
 function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h>>>0;}
 function randFor(seed){let n=hash(seed);return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}}
 function addLink(a,b,kind){if(!a.relationships||typeof a.relationships!=='object'||Array.isArray(a.relationships))a.relationships={};if(!b.relationships||typeof b.relationships!=='object'||Array.isArray(b.relationships))b.relationships={};a.relationships[b.id]={kind};b.relationships[a.id]={kind};a.familyIds??=[];b.familyIds??=[];if(!a.familyIds.includes(b.id))a.familyIds.push(b.id);if(!b.familyIds.includes(a.id))b.familyIds.push(a.id)}
 function makeRelative(S,NPC,base,kind,index,year){const id='family-'+base.id+'-'+kind+'-'+index;if(NPC[id])return NPC[id];const r=randFor(id),age=year-base.bornYear;let by=base.bornYear;
  if(kind==='parent')by=base.bornYear-(23+Math.floor(r()*17));
  if(kind==='sibling')by=base.bornYear-8+Math.floor(r()*17);
  if(kind==='spouse')by=base.bornYear-7+Math.floor(r()*15);
  if(kind==='child')by=base.bornYear+20+Math.floor(r()*19);
  by=Math.min(by,year-(kind==='child'?0:18));
  const n={id,name:['김','박','이','최','정','한','서'][Math.floor(r()*7)]+['지훈','서연','민재','수현','하린','도윤','서진'][Math.floor(r()*7)],bornYear:by,gender:r()<.5?'여성':'남성',role:kind==='child'?'학생':'일반 시민',career:kind==='child'?'학생':'일반 시민',wealth:kind==='parent'?base.parentWealth:limit(Math.round((base.wealth||50)*(0.5+r()))),parentWealth:base.parentWealth,alive:true,maritalStatus:kind==='spouse'?'기혼':'미혼',familyIds:[],relationships:{},jobHistory:[{year,job:'일반 시민',reason:'가족 인물 생성'}],financialHistory:[],relationshipHistory:[],biographyVersion:2,origin:'family',familyAnchor:base.id};
  NPC[id]=n;S.npcDB??={};S.npcDB[id]=n;addLink(base,n,kind);return n;
 }
 function ensure(S,NPC,id,year){const p=NPC[id];if(!p||id==='self'||p.familyGraphVersion)return;p.id??=id;if(!p.relationships||typeof p.relationships!=='object'||Array.isArray(p.relationships))p.relationships={};p.familyIds??=[];p.bornYear??=year-40;const r=randFor('links-'+id);p.familyGraphVersion=1;
  if(!id.startsWith('family-')){
   for(let i=0;i<2;i++)makeRelative(S,NPC,p,'parent',i,year);
   const count=(p.siblings==='외동')?0:Math.floor(r()*3);for(let i=0;i<count;i++)makeRelative(S,NPC,p,'sibling',i,year);
   if(p.maritalStatus==='기혼'){const spouse=makeRelative(S,NPC,p,'spouse',0,year);p.partnerId=spouse.id;spouse.partnerId=id;}
   for(let i=0;i<Math.min(3,p.children||0);i++){const child=makeRelative(S,NPC,p,'child',i,year);child.parentIds=[id,...(p.partnerId?[p.partnerId]:[])];}
  }
 }
 function hydrate(S,NPC){const ids=Object.keys(NPC).filter(id=>id!=='self'&&!id.startsWith('family-'));for(const id of ids)ensure(S,NPC,id,2027);S.familyEvents??=[];S.familyEngineVersion=1}
 function trace(S,p,kind,description,year,week,caseId){const e={year,week,kind,description,caseId:caseId||null};p.relationshipHistory??=[];p.relationshipHistory.push(e);S.familyEvents??=[];S.familyEvents.push({npcId:p.id,...e});return e}
 function annualTick(S,NPC,year,week,remember,random){
  for(const id of Object.keys(NPC).filter(x=>!x.startsWith('family-')&&x!=='self'))ensure(S,NPC,id,year);
  const pool=Object.values(NPC).filter(p=>p?.id&&p.alive!==false&&p.bornYear&&year-p.bornYear>=18&&year-p.bornYear<85);
  for(let i=0;i<Math.min(5,pool.length);i++){
   const p=pool[Math.floor(random()*pool.length)];if(p.lastFamilyYear===year)continue;p.lastFamilyYear=year;
   const a=year-p.bornYear;if(a>=78&&random()<Math.min(.8,.025+(a-78)*.028)){p.alive=false;p.deathYear=year;trace(S,p,'사망','고령에 따른 사망',year,week);continue;}
   const x=random();
   if(x<.06&&p.maritalStatus==='미혼'&&!p.partnerId){const mate=makeRelative(S,NPC,p,'spouse',Math.floor(week/52)+1,year);p.partnerId=mate.id;mate.partnerId=p.id;p.maritalStatus=mate.maritalStatus='기혼';trace(S,p,'혼인',`${mate.name}와 혼인`,year,week);remember(p.id,'가족 관계',`${mate.name}와 혼인`,p.id)}
   else if(x<.10&&p.maritalStatus==='기혼'&&p.partnerId&&NPC[p.partnerId]){const mate=NPC[p.partnerId];p.maritalStatus=mate.maritalStatus='이혼';trace(S,p,'이혼',`${mate.name}와 혼인관계 종료`,year,week);p.partnerId=null;mate.partnerId=null;}
   else if(x<.20&&p.maritalStatus==='기혼'&&year-p.bornYear<51){const count=p.familyIds.filter(fid=>p.relationships?.[fid]?.kind==='child').length;if(count<3){const child=makeRelative(S,NPC,p,'child',100+year,year);child.bornYear=year;child.parentIds=[p.id,...(p.partnerId?[p.partnerId]:[])];trace(S,p,'출생',`${child.name} 출생`,year,week)}}
  }
 }
 function onJudgment(S,NPC,c,st,v,year,week,remember){
  const main=NPC[c.who?.[0]];if(!main)return;ensure(S,NPC,c.who[0],year);
  const family=(main.familyIds||[]).map(id=>NPC[id]).filter(Boolean);
  const impact=c.kind==='criminal'&&v.id==='guilty'?'형 집행으로 가족 경제 및 생활 변화':c.kind==='criminal'&&v.id==='notguilty'?'무죄 확정 후 가족 관계 재정비':'민사 판결에 따른 가족 재정 상황 변화 가능';
  for(const member of family){member.familyCaseHistory??=[];member.familyCaseHistory.push({caseId:c.id,week,relativeId:main.id,impact});
   if(c.kind==='criminal'&&v.id==='guilty')member.wealth=limit(Math.round((member.wealth||40)-3));
   trace(S,member,'가족 판결 파장',`${main.name}: ${impact}`,year,week,c.id);
  }
  st.familyImpact={primaryNpcId:main.id,affectedIds:family.map(p=>p.id),kind:impact};
 }
 function weekTick(S,NPC,week,remember){/* Time-based family transitions are processed once per year, not every week. */}
 function audit(S,NPC){const errors=[];for(const [id,p] of Object.entries(NPC)){for(const rel of p.familyIds||[]){if(!NPC[rel])errors.push(`${id}: missing ${rel}`);else if(!(NPC[rel].familyIds||[]).includes(id))errors.push(`${id}: unreciprocated ${rel}`)}if(p.partnerId&&NPC[p.partnerId]?.partnerId!==id)errors.push(`${id}: spouse link mismatch`)}return {pass:!errors.length,errors,npcs:Object.keys(NPC).length,familyEvents:S.familyEvents?.length||0}}
 return {hydrate,ensure,annualTick,onJudgment,weekTick,audit};
})();
