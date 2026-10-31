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
  // fathers and children carry the family surname; mothers and spouses come from another family
  const baseFemale=/여/.test(base.gender||''),baseSur=VerdictNames.split(base.name)[0];
  const gender=kind==='parent'?(index===0?'남성':'여성'):kind==='spouse'?(baseFemale?'남성':'여성'):(r()<.5?'여성':'남성');
  const spouse=base.partnerId&&NPC[base.partnerId];
  const sur=kind==='parent'&&index===0||kind==='sibling'?baseSur:kind==='child'?(baseFemale&&spouse?VerdictNames.split(spouse.name)[0]:baseSur):null;
  const n={id,name:VerdictNames.make({seed:'name:'+id,gender,bornYear:by,surname:sur}),bornYear:by,gender,role:kind==='child'?'학생':'일반 시민',career:kind==='child'?'학생':'일반 시민',wealth:kind==='parent'?base.parentWealth:limit(Math.round((base.wealth||50)*(0.5+r()))),parentWealth:base.parentWealth,alive:true,maritalStatus:kind==='spouse'?'기혼':'미혼',familyIds:[],relationships:{},jobHistory:[{year,job:'일반 시민',reason:'가족 인물 생성'}],financialHistory:[],relationshipHistory:[],biographyVersion:2,origin:'family',familyAnchor:base.id};
  // relatives created late in a long career may be very old: an elder past 85 has usually passed away already
  const old=year-n.bornYear;if(old>85&&r()<Math.min(.97,.35+(old-85)*.06)){n.alive=false;n.deathYear=Math.max(n.bornYear+70,year-Math.floor(r()*Math.max(1,old-75)));if(n.deathYear>year)n.deathYear=year}
  NPC[id]=n;S.npcDB??={};S.npcDB[id]=n;addLink(base,n,kind);return n;
 }
 function ensure(S,NPC,id,year){const p=NPC[id];if(!p||id==='self'||p.familyGraphVersion)return;p.id??=id;if(!p.relationships||typeof p.relationships!=='object'||Array.isArray(p.relationships))p.relationships={};p.familyIds??=[];p.bornYear??=year-40;const r=randFor('links-'+id);p.familyGraphVersion=1;
  if(!id.startsWith('family-')){
   for(let i=0;i<2;i++)makeRelative(S,NPC,p,'parent',i,year);
   const count=(p.siblings==='외동')?0:Math.floor(r()*3);for(let i=0;i<count;i++)makeRelative(S,NPC,p,'sibling',i,year);
   if(p.maritalStatus==='기혼'&&!(p.partnerId&&NPC[p.partnerId])){const spouse=makeRelative(S,NPC,p,'spouse',0,year);p.partnerId=spouse.id;spouse.partnerId=id;}
   for(let i=0;i<Math.min(3,p.children||0);i++){const child=makeRelative(S,NPC,p,'child',i,year);child.parentIds=[id,...(p.partnerId?[p.partnerId]:[])];}
  }
 }
 // Relatives are created lazily: when a case reaches a verdict for the person, or when the player opens their record.
 // Each relative's name and birth year come from a hash of its id, so a pruned relative comes back the same way.
 function hydrate(S,NPC){S.familyEvents??=[];S.familyEngineVersion=2;prune(S,NPC)}
 function dormant(S,p,busy){return p.origin==='family'&&!busy.has(p.id)&&!(p.relationshipHistory||[]).length&&!(p.familyCaseHistory||[]).length&&!(S.memories?.[p.id]||[]).length&&(p.jobHistory||[]).length<=1}
 function prune(S,NPC){const busy=new Set();for(const c of S.generatedCases||[]){for(const id of [...(c.who||[]),...(c.side||[])])busy.add(id)}for(const st of Object.values(S.cases||{}))for(const w of st?.trial4?.witnesses||[])if(w.id)busy.add(w.id);
  const anchors=new Map();for(const p of Object.values(NPC))if(p?.origin==='family'&&p.familyAnchor)(anchors.get(p.familyAnchor)||anchors.set(p.familyAnchor,[]).get(p.familyAnchor)).push(p);
  let removed=0;
  for(const [anchorId,list] of anchors){const anchor=NPC[anchorId];
   // keep the whole circle when any relative has lived a story, so the family stays complete
   if(anchor&&(anchor.familyCaseImpact||(anchor.relationshipHistory||[]).length))continue;
   if(!list.every(p=>dormant(S,p,busy)&&!(p.partnerId&&p.partnerId!==anchorId)))continue;
   for(const p of list){if(anchor){anchor.familyIds=(anchor.familyIds||[]).filter(x=>x!==p.id);if(anchor.relationships)delete anchor.relationships[p.id];if(anchor.partnerId===p.id)anchor.partnerId=null}delete NPC[p.id];if(S.npcDB)delete S.npcDB[p.id];removed++}
   if(anchor)delete anchor.familyGraphVersion;
  }
  if(S.familyEvents?.length>400)S.familyEvents=S.familyEvents.slice(-400);
  return removed}
 function trace(S,p,kind,description,year,week,caseId){const e={year,week,kind,description,caseId:caseId||null};p.relationshipHistory??=[];p.relationshipHistory.push(e);S.familyEvents??=[];S.familyEvents.push({npcId:p.id,...e});return e}
 function annualTick(S,NPC,year,week,remember,random){
  // the very old pass away over time, unless they are part of a trial that is still running
  const open=new Set();for(const c of S.generatedCases||[])if(!S.cases?.[c.id]?.verdict)for(const id of [...(c.who||[]),...(c.side||[])])open.add(id);
  for(const [pid,p] of Object.entries(NPC)){if(!p?.bornYear||p.alive===false||pid==='self'||open.has(pid))continue;const a=year-p.bornYear;if(a>=88&&random()<Math.min(.9,.08+(a-88)*.04)){p.alive=false;p.deathYear=year;trace(S,p,'사망','고령에 따른 사망',year,week)}}
  const pool=Object.values(NPC).filter(p=>p?.id&&p.alive!==false&&p.bornYear&&year-p.bornYear>=18&&year-p.bornYear<85);
  for(let i=0;i<Math.min(5,pool.length);i++){
   const p=pool[Math.floor(random()*pool.length)];if(p.lastFamilyYear===year)continue;p.lastFamilyYear=year;ensure(S,NPC,p.id,year);
   const a=year-p.bornYear;if(a>=78&&random()<Math.min(.8,.025+(a-78)*.028)){p.alive=false;p.deathYear=year;trace(S,p,'사망','고령에 따른 사망',year,week);continue;}
   const x=random();
   if(x<.06&&p.maritalStatus==='미혼'&&!p.partnerId){const mate=makeRelative(S,NPC,p,'spouse',Math.floor(week/52)+1,year);p.partnerId=mate.id;mate.partnerId=p.id;p.maritalStatus=mate.maritalStatus='기혼';trace(S,p,'혼인',`${mate.name}와 혼인`,year,week);remember(p.id,'가족 관계',`${mate.name}와 혼인`,p.id)}
   else if(x<.10&&p.maritalStatus==='기혼'&&p.partnerId&&NPC[p.partnerId]){const mate=NPC[p.partnerId];p.maritalStatus=mate.maritalStatus='이혼';trace(S,p,'이혼',`${mate.name}와 혼인관계 종료`,year,week);p.partnerId=null;mate.partnerId=null;}
   else if(x<.20&&p.maritalStatus==='기혼'&&year-p.bornYear<51){const count=p.familyIds.filter(fid=>p.relationships?.[fid]?.kind==='child').length;if(count<3){const child=makeRelative(S,NPC,p,'child',100+year,year);child.bornYear=year;child.parentIds=[p.id,...(p.partnerId?[p.partnerId]:[])];trace(S,p,'출생',`${child.name} 출생`,year,week)}}
  }
 }
 function onJudgment(S,NPC,c,st,v,year,week,remember){
  const main=NPC[c.who?.[0]];if(!main)return;/* relatives that already exist feel the verdict; the rest are created later with this history in mind */
  const family=(main.familyIds||[]).map(id=>NPC[id]).filter(Boolean);
  const impact=c.kind==='criminal'&&v.id==='guilty'?'형 집행으로 가족 경제 및 생활 변화':c.kind==='criminal'&&v.id==='notguilty'?'무죄 확정 후 가족 관계 재정비':'민사 판결에 따른 가족 재정 상황 변화 가능';
  for(const member of family){member.familyCaseHistory??=[];member.familyCaseHistory.push({caseId:c.id,week,relativeId:main.id,impact});
   if(c.kind==='criminal'&&v.id==='guilty')member.wealth=limit(Math.round((member.wealth||40)-3));
   trace(S,member,'가족 판결 파장',`${main.name}: ${impact}`,year,week,c.id);
  }
  st.familyImpact={primaryNpcId:main.id,affectedIds:family.map(p=>p.id),kind:impact};main.familyCaseImpact=true;
 }
 function weekTick(S,NPC,week,remember){/* Time-based family transitions are processed once per year, not every week. */}
 function audit(S,NPC){const errors=[];for(const [id,p] of Object.entries(NPC)){for(const rel of p.familyIds||[]){if(!NPC[rel])errors.push(`${id}: missing ${rel}`);else if(!(NPC[rel].familyIds||[]).includes(id))errors.push(`${id}: unreciprocated ${rel}`)}if(p.partnerId&&NPC[p.partnerId]?.partnerId!==id)errors.push(`${id}: spouse link mismatch`)}return {pass:!errors.length,errors,npcs:Object.keys(NPC).length,familyEvents:S.familyEvents?.length||0}}
 return {hydrate,ensure,prune,annualTick,onJudgment,weekTick,audit};
})();
