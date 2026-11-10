/* THE VERDICT — 법원 동료 (2026-11-08, 기획 확정: 가벼운 공유 세계)
 *
 * 다른 플레이어는 같은 법원의 동료 판사로만 나온다.
 *  - 인맥의 '법원 동료'에 이름·재판부가 보인다(실제 사람의 판사 카드, 숨은 정보 없음).
 *  - 그가 선고한 사건은 '법원 소식' 기사로 읽는다.
 *  - 같은 사건이 두 재판부에 동시에 배당되지 않는다(DB 037: 한 사건은 한 재판부만 맡음).
 * 재판 기록·세이브·숨은 진실은 서버로 가지 않는다. 판결은 사건 이름(이름 없는 제목)·결론·형량·공판 수만 보낸다.
 * 로그인하지 않았거나 서버에 037이 없으면 이 부분은 조용히 쉬고, 게임은 예전과 같다.
 *
 * 따로 기소된 증인(로그인과 무관): 내가 선고하고 몇 주 뒤, 그 증인이 따로 받던 재판의 결론이 기사로 나온다.
 * 결론 문장은 사건에 집필된 세계별 문장(`witnesses[i].separate`)만 쓰고, 내 선고 전에는 절대 나오지 않는다.
 */
(()=>{
'use strict';
if(typeof S==='undefined'||typeof CASES==='undefined')return;
const CFG=window.VERDICT_CONFIG||{};
const KEY=/^[A-Za-z0-9_.:-]{1,80}$/;
const SYNC_MS=90000,TICK_MS=20000,FIRST_LINK_DAYS=3,MAX_NEWS=40;
let othersOpen=new Set(),othersJudged=new Set(),judgedRows=[],judges=new Map(),missing=false,running=false,lastSync=0,readOnce=false,inflight=null;

const A=()=>window.VerdictAuth;
const linked=()=>!missing&&CFG.colleagueCourt!==false&&!!A()?.user&&A().online===true&&typeof A().db==='function';
const TP=()=>window.VerdictTrialPlay;
const keyOf=c=>{const k=c?.contentPack?.archetypeId;return typeof k==='string'&&KEY.test(k)?k:null};
const mem=()=>{S.colleagues??={};const s=S.colleagues;s.sent??={};s.seen??={};s.npc??={};s.news??=[];s.sep??={};s.links??={};return s};
const LINK_WAIT_MS=36*3600000;   // a linked case no colleague took within this time: the witness's trial is told as before (NPC judge)
const hashOf=v=>{let x=2166136261;for(const ch of String(v))x=Math.imul(x^ch.charCodeAt(0),16777619)>>>0;return x>>>0};
const pick=(arr,seed)=>arr[hashOf(seed)%arr.length];
const P=(w,p)=>window.VerdictCurated?.particle?window.VerdictCurated.particle(w,p):w+p;
const shortName=c=>String(c?.name||'').split(' · ')[0].replace(/\s*\(\d{4}[.\-]\d{1,2}[.\-]\d{1,2}\)/g,'').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

/* ---------- my bench ---------- */
const myOpen=()=>[...new Set((typeof openCases==='function'?openCases():[]).map(keyOf).filter(Boolean))].slice(0,20);
const myJudged=()=>CASES.filter(c=>{const x=S.cases[c.id];return !!x?.verdict&&!x.referred&&!!x.trial4?.final&&!!keyOf(c)});
/* the case's own title, without the names of my world (the colleague's world has other people in it) */
function titleOf(c){
 const k=keyOf(c);
 try{const x=(typeof CasePackEngine!=='undefined'?CasePackEngine.pool(S):[]).find(y=>y.a?.id===k);if(x?.a?.title)return String(x.a.title)}catch{}
 const sheet=window.VerdictSheets?.cases?.[k]?.card?.title;if(sheet)return String(sheet);
 return c.kind==='criminal'?'형사 사건':c.kind==='civil'?'민사 사건':'한 사건';
}
/* (stage 3) the separately indicted witnesses of this case whose own trial is written as a linked case:
 * [{case, world}] — world = which of the linked case's worlds follows from what really happened in mine. Sent only
 * with my verdict (never before), so the colleague who takes the witness's trial lives in the same story. */
function linksOf(c){
 const t=S.cases[c.id]?.trial4,cur=TP()?.curOf?.(c);if(!t||!cur?.witnesses)return [];
 return cur.witnesses.map(w=>w?.separate?.case).filter(Boolean).map(id=>{const L=window.VerdictSheets?.cases?.[id]?.linked;
  const world=L?.worlds?.[t.truth];return L&&KEY.test(id)&&world?{case:id,world}:null}).filter(Boolean);
}
function summary(c){
 const t=S.cases[c.id].trial4,f=t.final||{},links=linksOf(c);
 return {title:titleOf(c).slice(0,60),kind:['criminal','civil'].includes(c.kind)?c.kind:'other',
  label:String(f.label||'판결').slice(0,60),sentence:typeof f.sentence==='string'?f.sentence.slice(0,60):'',days:Number(t.daysDone)||0,
  ...(links.length?{links}:{}),
  ...(c.link?.judge&&c.link?.from&&!c.appeal?{from:{judge:c.link.judge,parent:c.link.from}}:{}),
  ...(S.cases[c.id].appeal?.by?{appeal:{by:S.cases[c.id].appeal.by,world:t.truth,first:{label:String(f.label||'').slice(0,60),sentence:typeof f.sentence==='string'?f.sentence.slice(0,60):''}}}:{}),
  ...(c.appeal?.judge?{appealOf:{judge:c.appeal.judge,parent:c.appeal.from}}:{})};
}
/* (stage 3) a colleague judged a case whose witness was separately indicted: the witness's own trial is offered to me
 * for a day (a docket offer that says where it came from). Taken by one colleague only (one bench per case). */
function offerLinked(r,j){
 const db=S.realtimeInbox;if(!db?.enabled)return false;
 let added=false;
 for(const L of r.summary?.links||[]){
  const tag=r.case_key+':'+r.judge_id+':'+L.case,s=mem();if(s.links[tag])continue;s.links[tag]=1;
  const sheet=window.VerdictSheets?.cases?.[L.case];if(!sheet?.card||!['did','didnt','reason'].includes(L.world))continue;
  if(othersOpen.has(L.case)||CASES.some(c=>keyOf(c)===L.case))continue;
  const now=Date.now(),d=new Date(now),day=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const ch=sheet.card.charge||{},base=window.VerdictMatchPlay?.logline?.(L.case)||'';
  db.offers.push({slot:'link-'+L.case+'-'+hashOf(tag).toString(36),day,created:now,expires:now+24*3600000,status:'available',linked:true,
   options:[{title:sheet.card.title,tag:ch.name||sheet.card.title,category:sheet.card.category,kind:sheet.card.kind,archetypeId:L.case,packId:'world-sheets-v1',
    importance:ch.max>=10?5:ch.max>=5?4:3,legal:`${ch.name||''} (${ch.law||''})`.trim(),
    logline:`옆 재판부 ${j.judge_name} 판사가 선고한 '${String(r.summary.title||'').slice(0,30)}' 재판의 증인이 따로 기소된 사건이다. `+base,
    link:{world:L.world,from:r.case_key,judge:r.judge_id,parent:String(r.summary.title||'').slice(0,60)}}]});
  added=true;
  addNews({outlet:'법조일보',title:`[법원 소식] '${sheet.card.title}' 사건, 우리 법원에 접수`,day:S.week+0.5,index:'lk'+hashOf(tag),phase:'after',frame:'법원 소식 · 배당',lean:'',court:true,
   body:`옆 재판부 ${j.judge_name} 판사가 선고한 '${String(r.summary.title||'').slice(0,30)}' 재판에서 증인으로 섰던 사람이 따로 기소돼, 그 재판이 우리 법원에 들어왔다. 배당 후보에 하루 동안 올라 있다.`});
 }
 return added;
}
/* ---------- criminal appeals (2026-11-08, planner: criminal cases only, once) ----------
 * After a criminal verdict the side that lost may appeal (decided once, from the case's own seed; more likely when the
 * verdict went against what really happened). The appeal is heard by another bench: a colleague player if one takes it
 * within a day, otherwise an NPC appellate bench a few game weeks later. An appellate case is never appealed again. */
const sideOf=f=>window.VerdictTrialCore?.sideOf?.(f?.dir)??0;
const truthSide=t=>t==='did'?'p':t==='didnt'?'d':'m';
function decideAppeals(){
 let n=0;const m=mem();m.appealsFrom??=Date.now();   // verdicts given before appeals existed stay final (no flood on an old save)
 for(const c of CASES){
  const x=S.cases[c.id],t=x?.trial4,f=t?.final;
  if(c.kind!=='criminal'||!x?.verdict||x.referred||!f||x.appeal!==undefined)continue;
  if(c.appeal||!(Number(f.at)>=m.appealsFrom)){x.appeal=false;continue}   // the appellate judgment is final; so is a verdict from before appeals
  const side=sideOf(f),by=side<0?'p':'d',ts=truthSide(t.truth),wrong=(side>0&&ts==='d')||(side<0&&ts==='p');
  const chance=(by==='d'?50:30)+(wrong?(by==='d'?25:30):0);
  if(hashOf(c.id+':appeal')%100>=chance){x.appeal=false;continue}
  x.appeal={by,week:S.week,at:Date.now(),status:'filed'};n++;
  addNews({outlet:'법조일보',title:`[법원 소식] ${shortName(c)}, ${by==='d'?'피고인':'검찰'} 쪽 항소`,day:S.week+0.5,index:'ap'+hashOf(c.id),phase:'after',frame:'법원 소식 · 항소',lean:'',court:true,
   body:`${by==='d'?'피고인 쪽이':'검찰이'} 1심 판결 "${String(f.label||'판결').slice(0,40)}"에 불복해 항소했다. 항소심은 같은 법원의 다른 재판부가 맡는다.`});
 }
 return n;
}
/* a colleague's criminal verdict was appealed: the appeal is offered to me for a day */
function offerAppeal(r,j){
 const db=S.realtimeInbox,A0=r.summary?.appeal;if(!db?.enabled||!A0||!['did','didnt','reason'].includes(A0.world))return false;
 const s=mem(),tag='appeal:'+r.case_key+':'+r.judge_id+':'+r.judged_at;if(s.links[tag])return false;s.links[tag]=1;
 if(othersOpen.has(r.case_key)||CASES.some(c=>keyOf(c)===r.case_key))return false;   // a case I already heard is not mine to review
 const cand=(typeof CasePackEngine!=='undefined'?CasePackEngine.pool(S):[]).find(x=>x.a?.id===r.case_key);if(!cand)return false;
 const now=Date.now(),d=new Date(now),day=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const first=`"${String(A0.first?.label||'판결').slice(0,30)}"${A0.first?.sentence?` (${String(A0.first.sentence).slice(0,30)})`:''}`;
 db.offers.push({slot:'appeal-'+r.case_key+'-'+hashOf(tag).toString(36),day,created:now,expires:now+24*3600000,status:'available',linked:true,
  options:[{title:String(cand.a.title)+' (항소심)',tag:cand.a.tag,category:cand.a.category,kind:cand.a.kind,archetypeId:r.case_key,packId:cand.pack.packId,
   importance:cand.a.importance||3,legal:cand.a.legal||'',
   logline:`옆 재판부 ${j.judge_name} 판사가 1심에서 ${first}을 선고한 사건이다. ${A0.by==='d'?'피고인':'검찰'} 쪽이 항소해 우리 법원 항소심으로 왔다.`,
   link:{world:A0.world,from:r.case_key,judge:r.judge_id,parent:String(r.summary.title||'').slice(0,60),appeal:{by:A0.by,first:A0.first||{},judgeName:j.judge_name}}}]});
 addNews({outlet:'법조일보',title:`[법원 소식] '${cand.a.title}' 항소심, 배당 후보에`,day:S.week+0.5,index:'apo'+hashOf(tag),phase:'after',frame:'법원 소식 · 항소',lean:'',court:true,
  body:`옆 재판부 ${j.judge_name} 판사가 선고한 이 사건에 ${A0.by==='d'?'피고인':'검찰'} 쪽이 항소했다. 항소심 배당 후보에 하루 동안 올라 있다.`});
 return true;
}
/* my appealed verdicts: the colleague's appellate judgment, or an NPC appellate bench after a while */
function appealTick(){
 let added=0;const me=linked()?A()?.user?.id:null;
 for(const c of CASES){
  const x=S.cases[c.id],ap=x?.appeal,t=x?.trial4,f=t?.final;if(!ap?.by||ap.status==='decided'||!f)continue;
  if(me){const r=judgedRows.find(y=>y.case_key===keyOf(c)&&y.summary?.appealOf?.judge===me&&y.summary.appealOf.parent===keyOf(c));
   if(r){const j=judges.get(r.judge_id),x2=r.summary;ap.status='decided';ap.result={judge:j?.judge_name||'',label:x2.label,sentence:x2.sentence||''};
    const same=String(x2.label||'')===String(f.label||'')&&String(x2.sentence||'')===String(f.sentence||'');
    if(addNews({outlet:'법조일보',title:`[법원 소식] ${shortName(c)} 항소심 — ${same?'1심 판결 유지':'1심 판결 바뀜'}`,day:S.week+0.5,index:'apr'+hashOf(c.id),phase:'after',frame:'법원 소식 · 항소심',lean:'',court:true,from:mem().npc[r.judge_id]||null,
     body:`내가 1심에서 "${String(f.label||'').slice(0,40)}"을 선고한 ${shortName(c)} 사건의 항소심에서 같은 법원 ${j?.judge_name||'다른'} 판사가 "${String(x2.label||'판결').slice(0,40)}"${x2.sentence?` (${String(x2.sentence).slice(0,40)})`:''}을 선고했다. ${same?'1심 판단이 그대로 이어졌다.':'항소심은 1심과 다르게 판단했다.'}`}))added++;
    continue}
   if(othersOpen.has(keyOf(c))||(judges.size&&Date.now()-(ap.at||0)<LINK_WAIT_MS))continue;   // a colleague may still take it
  }
  if(S.week<(ap.week||0)+6+hashOf(c.id+':ap')%7)continue;
  // an NPC appellate bench: more likely to change a verdict that went against what really happened
  const side=sideOf(f),ts=truthSide(t.truth),wrong=(side>0&&ts==='d')||(side<0&&ts==='p');
  const change=hashOf(c.id+':apr')%100<(wrong?70:20),judge=judgeNpcName(c.id+':apj');
  const how=!change?'항소를 기각했다. 1심 판결이 그대로 확정됐다.':side>0?(ts==='d'?'1심 판결을 깨고 무죄를 선고했다.':'1심 판결을 깨고 형을 다시 정했다.'):'1심 판결을 깨고 유죄로 판단했다.';
  ap.status='decided';ap.result={judge,npc:true,changed:change};
  if(addNews({outlet:'법조일보',title:`[법원 소식] ${shortName(c)} 항소심 — ${change?'1심 판결 바뀜':'1심 판결 유지'}`,day:S.week+0.5,index:'apr'+hashOf(c.id),phase:'after',frame:'법원 소식 · 항소심',lean:'',court:true,
   body:`${ap.by==='d'?'피고인':'검찰'} 쪽이 항소한 ${shortName(c)} 사건에서 ${judge?`항소심 재판부(${judge} 판사)`:'항소심 재판부'}는 ${how}`}))added++;
 }
 return added;
}

/* the server says a colleague already holds a case I just took: if I have not opened it yet, it goes to their bench */
function yieldCases(keys){
 let n=0;
 for(const c of (typeof openCases==='function'?openCases():[])){
  if(!keys.includes(keyOf(c)))continue;
  const x=S.cases[c.id],t=x?.trial4;
  if(t?.daysDone||(x?.actions||[]).length||t?.dates?.[t.day]!=null)continue;   // already on trial here: keep it
  x.referred=true;n++;
  /* one of my first four cases: another case takes its place, so a new judge still starts with four */
  const first=S.legalWorld?.firstFourCaseIDs;let swapped='';
  if(Array.isArray(first)&&first.includes(c.id)&&typeof createGeneratedCase==='function')try{
   const L=window.VerdictDocket?.freshPool?.()||[],pickd=L[hashOf(c.id)%Math.max(1,L.length)];
   const nc=pickd&&createGeneratedCase(pickd);if(nc){nc.week=Math.min(nc.week,S.week);S.cases[nc.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};
    first[first.indexOf(c.id)]=nc.id;swapped=` 대신 ${shortName(nc)} 사건이 배당됐다.`}}catch(e){console.warn('replacement case',e)}
  addNews({outlet:'법조일보',title:`[법원 소식] ${shortName(c)}, 옆 재판부가 맡기로`,body:'같은 사건이 같은 법원 다른 재판부에 먼저 배당돼, 그쪽에서 재판하기로 했다.'+swapped,
   day:S.week+0.5,index:'yield'+hashOf(c.id),phase:'after',frame:'법원 소식 · 배당',lean:'',court:true});
 }
 if(n&&typeof toast==='function')toast('같은 사건이 옆 재판부에 먼저 배당돼 그쪽으로 넘어갔어요.');
 return n>0;
}

/* ---------- colleagues as people I know ---------- */
const roleOf=j=>'판사'+(j.bench?' · '+j.bench:'')+' · 같은 법원';
function colleagueNpc(uid,j){
 const s=mem();let id=s.npc[uid];
 if(id&&NPC[id]){NPC[id].name=j.judge_name;NPC[id].role=roleOf(j);if(j.gender)NPC[id].gender=j.gender;return id}
 if(typeof freshNPC!=='function')return null;
 const tmp=freshNPC('판사',0,'court'),p=NPC[tmp];
 id='colleague_'+String(uid).replace(/[^a-z0-9]/gi,'').slice(0,12);
 delete NPC[tmp];if(S.npcDB)delete S.npcDB[tmp];
 S.relations[id]=S.relations[tmp]??40;delete S.relations[tmp];S.memories[id]=S.memories[tmp]||[];delete S.memories[tmp];
 Object.assign(p,{name:j.judge_name,role:roleOf(j),career:'판사',socialStatus:'법조계',bond:'같은 법원에서 일하는 동료 판사',
  schedule:'법정과 판사실 근무',colleague:true,...(j.gender?{gender:j.gender}:{})});
 NPC[id]=p;if(S.npcDB)S.npcDB[id]=p;s.npc[uid]=id;return id;
}
function people(){const s=mem(),sp=S.couple?.spouse;return Object.entries(s.npc).filter(([uid,id])=>NPC[id]&&(judges.size===0||judges.has(uid)))
 .sort(([a],[b])=>(b===sp)-(a===sp)).map(([,id])=>({id,role:NPC[id].role}))}   // my spouse first

/* ---------- 부부 판사 (2026-11-10, planner request; DB 040) ----------
 * Two invited players set as a couple in the database: each game takes the sex and age set there (the age counts on
 * from now), shows the other player as 배우자 at the top of the court colleagues, lets each read all the other's
 * verdicts on their card, and — counted in real days from the day the couple was set, so both games agree — welcomes a
 * child (first after 30 days, a second after a year and a half, at most two). Nothing else of either game is shared. */
const CHILD_DAYS=[30,540];
let coupleMissing=false;
const couple=()=>S.couple||null;
function applyCouple(rows,me){
 const mine=(rows||[]).find(r=>r.user_id===me),other=mine&&(rows||[]).find(r=>r.user_id===mine.spouse);
 if(!mine){if(S.couple){S.couple=null;return true}return false}
 let changed=false;const since=String(mine.since);
 if(!S.couple||S.couple.spouse!==mine.spouse||S.couple.since!==since||S.couple.sex!==mine.sex||S.couple.age!==mine.age){
  const base=typeof age==='function'?age()-(S.ageShift||0):35;
  S.ageShift=Number(mine.age)-base;   // the age counts on from here
  S.couple={spouse:mine.spouse,since,sex:mine.sex,age:Number(mine.age),spouseSex:other?.sex||'',kids:S.couple?.spouse===mine.spouse?S.couple.kids||0:0};
  changed=true}
 S.selfGender=mine.sex;if(NPC.self)NPC.self.gender=mine.sex;
 const j=judges.get(mine.spouse);
 if(j){const id=colleagueNpc(mine.spouse,j);if(id){const p=NPC[id];
  p.role='배우자 · '+roleOf(j);p.bond='배우자 · 같은 법원 판사';p.spouseOfPlayer=true;p.maritalStatus='기혼';p.partnerId='self';
  if(other?.sex)p.gender=other.sex;if(NPC.self)NPC.self.partnerId=id;
  /* the spouse was first made as a colleague judge of random age: they are as old as the age set for them (040), from
   * the day the couple was set, and age with my calendar after that (v10.10.1 — the card showed 66) */
  /* a judge like me: law school, a judge's pay and home, our own children — not the random profile of a made-up colleague */
  Object.assign(p,{coupleOwned:true,career:'판사',degree:'법학전문대학원 졸업',educationField:'법학',residence:'자가 아파트',children:S.couple.kids||0});
  p.wealth=Math.max(Number(p.wealth)||0,60);p.jobHistory=[{year:Number(String(since).slice(0,4))||2027,job:'판사',reason:'같은 법원 판사'}];
  if(p.life)Object.assign(p.life,{marital:'기혼',career:'판사',partner:'self',children:S.couple.kids||0});
  if(other&&p.coupleAgeSince!==since){p.bornYear=(typeof year==='function'?year():2027)-Number(other.age);p.ageAtStart=Number(other.age);p.coupleAgeSince=since;changed=true}
  if((S.relations[id]??0)<80){S.relations[id]=85;changed=true}
  if(!S.couple.told){S.couple.told=true;changed=true;
   if(typeof log==='function')log('가족',`${j.judge_name} 판사와 부부`,'배우자와 같은 법원에서 일한다. 서로의 판결 소식을 가장 먼저 듣는다.');}
  changed=kidsTick(id,j)||changed}}
 return changed;
}
function kidsTick(spouseId,j){
 const c=S.couple,days=(Date.now()-Date.parse(c.since))/86400000;let n=0;
 const due=CHILD_DAYS.filter(d=>days>=d).length;
 while((c.kids||0)<due){const k=c.kids||0;c.kids=k+1;n++;
  const pair=[A().user.id,c.spouse].sort().join(':'),father=c.sex==='남'?S.name:j.judge_name;
  const VN=typeof VerdictNames!=='undefined'?VerdictNames:window.VerdictNames,sur=VN?.split?.(father)?.[0]||String(father).slice(0,1);
  const g=hashOf(pair+':kid:'+k)%2?'남성':'여성',by=typeof year==='function'?year():2027;
  const id='couple_child_'+k,name=VN?.make?VN.make({seed:'couple:'+pair+':'+k,gender:g,bornYear:2028,surname:sur}):sur+'아기';   // the name must not depend on either game's own calendar
  NPC[id]={id,name,bornYear:by,gender:g,role:'자녀',career:'아기',alive:true,maritalStatus:'미혼',parentIds:['self',spouseId],familyIds:[],relationships:{},origin:'family',bond:'우리 아이'};
  if(S.npcDB)S.npcDB[id]=NPC[id];S.relations[id]=95;
  const sp=NPC[spouseId];if(sp){sp.relationships=sp.relationships&&typeof sp.relationships==='object'&&!Array.isArray(sp.relationships)?sp.relationships:{};sp.relationships[id]={kind:'child'};
   sp.familyIds=[...new Set([...(sp.familyIds||[]),id])];NPC[id].relationships[spouseId]={kind:'parent'};NPC[id].familyIds.push(spouseId);sp.children=c.kids}
  if(typeof message==='function')message(spouseId,k?`둘째 ${name}${P(name,'이').slice(name.length)} 건강하게 태어났어요. 오늘은 일찍 들어와요.`:`우리 아이 ${name}${P(name,'이').slice(name.length)} 태어났어요. 고생 많았어요, 우리.`);
  if(typeof log==='function')log('가족',`${name} 출생`,k?'둘째 아이가 태어났다.':'첫아이가 태어났다.');
 }
 return n>0;
}
async function syncCouple(db,me){
 if(coupleMissing)return false;
 try{return applyCouple(await db(`court_couples?select=user_id,spouse,sex,age,since&or=(user_id.eq.${me},spouse.eq.${me})`),me)}
 catch(e){if(e?.status===404)coupleMissing=true;return false}
}
/* all of my spouse's verdicts, newest first (the court news shows only a few) */
function spouseVerdicts(){const c=couple();if(!c)return [];return judgedRows.filter(r=>r.judge_id===c.spouse).map(r=>({title:String(r.summary?.title||'사건').slice(0,40),label:String(r.summary?.label||'판결').slice(0,40),sentence:r.summary?.sentence?String(r.summary.sentence).slice(0,40):'',at:r.judged_at}))}

/* ---------- court news ---------- */
function addNews(item){const s=mem();if(s.news.some(x=>x.index===item.index))return false;s.news.unshift(item);s.news=s.news.slice(0,MAX_NEWS);return true}
function colleagueArticle(r,j){
 const x=r.summary||{},name=j.judge_name,npc=mem().npc[r.judge_id];
 const title=String(x.title||'한 사건').slice(0,40),label=String(x.label||'판결').slice(0,40);
 const kindWord=x.kind==='criminal'?'형사 재판':x.kind==='civil'?'민사 재판':'재판';
 const days=Number(x.days)||0,seed=r.case_key+r.judge_id;
 const body=[`같은 법원 ${j.bench?j.bench+' ':''}${name} 판사가 '${title}' 사건에서 "${label}"${x.sentence?` (${x.sentence})`:''} 판결을 선고했다.`,
  days?`${P(kindWord,'은')} 공판 ${days}번 끝에 마무리됐다.`:`${P(kindWord,'이')} 마무리됐다.`,
  pick(['판결 이유는 판결문이 공개된 뒤 법조계에서 다시 읽힐 전망이다.','선고가 끝난 뒤 당사자들은 말없이 법정을 나섰다.',
   '같은 법원 판사들 사이에서도 이 사건의 결론을 두고 이야기가 오갔다.','선고 날 법정 방청석은 일찍부터 가득 찼다.'],seed)].join(' ');
 return {outlet:'법조일보',title:`[법원 소식] ${name} 판사, '${title}' 사건 선고`,body,day:S.week+0.5,index:'cc'+hashOf(seed+r.judged_at),
  phase:'after',frame:'법원 소식 · 옆 재판부',lean:'',from:npc||null,court:true};
}
function articles(){return mem().news.map(x=>({...x}))}

/* ---------- separately indicted witnesses (no login needed) ---------- */
function judgeNpcName(seed){
 const ids=(S.legalWorld?.people||[]).filter(id=>NPC[id]?.legalCareer?.role==='judge');
 return ids.length?NPC[pick(ids,seed)].name:'';
}
function separateTick(){
 const s=mem();let added=0;
 for(const c of CASES){
  const x=S.cases[c.id],t=x?.trial4;if(!x?.verdict||x.referred||!t?.final)continue;
  const cur=TP()?.curOf?.(c);if(!cur?.witnesses)continue;            // case record not loaded yet: try again later
  cur.witnesses.forEach((w,i)=>{
   const sep=w?.separate;if(!sep?.worlds)return;
   const k=c.id+':'+i;s.sep[k]??={due:(Number.isFinite(x.closedWeek)?x.closedWeek:S.week)+3+hashOf(k)%6};
   const e=s.sep[k];if(e.done)return;
   const wid=t.witnesses?.[i]?.id,name=NPC[wid]?.name;if(!name){e.done=true;return}
   const role0=String(w.role||'증인').replace(/\s*\([^)]*\)\s*/g,'').trim()||'증인';
   /* (stage 3) a linked case went to a colleague: their verdict is the witness's result in my world too */
   if(sep.case&&linked()&&A()?.user){
    const me=A().user.id,r=judgedRows.find(x=>x.case_key===sep.case&&x.summary?.from?.judge===me&&x.summary.from.parent===keyOf(c));
    if(r){const j=judges.get(r.judge_id);if(j){e.done=true;const x=r.summary;
      if(addNews({outlet:'법조일보',title:`[법원 소식] ${shortName(c)} 증인 ${name}, 따로 받던 재판 결론`,day:S.week+0.5,index:'sep'+hashOf(k),phase:'after',
       frame:'법원 소식 · 옆 재판부',lean:'',court:true,from:mem().npc[r.judge_id]||null,
       body:`${shortName(c)} 재판에 증인으로 나왔던 ${role0} ${P(name,'이')} 따로 받아 온 ${String(sep.charge||'').trim()} 재판에서 같은 법원 ${j.bench?j.bench+' ':''}${j.judge_name} 판사가 "${String(x.label||'판결').slice(0,40)}"${x.sentence?` (${String(x.sentence).slice(0,40)})`:''} 판결을 선고했다. 증인석에서 했던 말이 그 재판에서 다시 따져졌다.`}))added++;
      return}}
    const sentAt=Number(s.sent[c.id])||0;
    if(othersOpen.has(sep.case)||(judges.size&&(!sentAt||Date.now()-sentAt<LINK_WAIT_MS)))return;   // a colleague may still take it
   }
   if(S.week<e.due)return;
   e.done=true;
   const raw=String(sep.worlds[t.truth]||sep.worlds.reason||'').replace(/\{W(?=[|}])/g,'{W'+(i+1));
   const told=TP()?.tell?TP().tell(c,t,raw):raw;if(!told||/\{/.test(told))return;
   const role=role0;
   const judge=judgeNpcName(k);
   const body=`${shortName(c)} 재판에 증인으로 나왔던 ${role} ${P(name,'이')} 따로 받아 온 ${String(sep.charge||'').trim()} 재판의 결론이 나왔다. `+
    (judge?`같은 법원 ${judge} 판사가 선고했다. `:'')+told;
   if(addNews({outlet:'법조일보',title:`[법원 소식] ${shortName(c)} 증인 ${name}, 따로 받던 재판 결론`,body,day:S.week+0.5,index:'sep'+hashOf(k),
    phase:'after',frame:'법원 소식 · 그 뒤 이야기',lean:'',court:true}))added++;
   if(typeof remember==='function')try{remember(wid,'관련 사건',`따로 받던 ${sep.charge} 재판의 선고`,c.id)}catch{}
  });
 }
 return added;
}

/* ---------- sync with the server (signed in only) ---------- */
async function sync(force){
 if(!linked())return false;
 if(running){await inflight;return sync(force)}   // a round already running may have read my bench before a change
 let release;inflight=new Promise(r=>release=r);
 if(!force&&Date.now()-lastSync<SYNC_MS)return false;
 running=true;lastSync=Date.now();
 const s=mem(),db=A().db,me=A().user.id;let changed=false;
 try{
  if(S.name){   // my own rows only once I am a judge; reading the colleagues works from the profile screen on
  const g=NPC.self?.gender,card={p_name:String(S.name).slice(0,20),p_bench:String(window.VerdictV6?.deptLabel?.()||'').slice(0,40),p_gender:g==='남'||g==='여'?g:''};
  const ck=JSON.stringify(card);if(s.card!==ck){await db('rpc/court_judge_put',{method:'POST',body:card});s.card=ck;changed=true}
  for(const c of myJudged()){if(s.sent[c.id])continue;
   await db('rpc/court_case_judge',{method:'POST',body:{p_key:keyOf(c),p_summary:summary(c)}});s.sent[c.id]=Date.now();changed=true}
  const refused=await db('rpc/court_case_sync',{method:'POST',body:{p_open:myOpen()}});
  if(Array.isArray(refused)&&refused.length&&yieldCases(refused))changed=true;
  }
  const [rows,js]=await Promise.all([
   db(`court_cases?select=case_key,judge_id,state,judged_at,summary&judge_id=neq.${me}&order=judged_at.desc.nullslast&limit=300`),
   db('court_judges?select=user_id,judge_name,bench,gender')]);
  judges=new Map((js||[]).filter(j=>j.user_id!==me).map(j=>[j.user_id,j]));
  const before=[...othersOpen].sort().join();
  othersOpen=new Set((rows||[]).filter(r=>r.state==='open').map(r=>r.case_key));
  othersJudged=new Set((rows||[]).filter(r=>r.state==='judged').map(r=>r.case_key));readOnce=true;
  if(S.name)for(const [uid,j] of judges){const had=!!(s.npc[uid]&&NPC[s.npc[uid]]);if(colleagueNpc(uid,j)&&!had)changed=true}
  if(S.name&&await syncCouple(db,me))changed=true;
  if(!S.name)return false;
  s.since??=Date.now()-FIRST_LINK_DAYS*86400000;   // the first link brings only the last few days' verdicts
  let n=0;
  judgedRows=(rows||[]).filter(r=>r.state==='judged');
  for(const r of judgedRows.slice().reverse()){
   const tag=r.case_key+':'+r.judge_id+':'+r.judged_at;if(s.seen[tag])continue;s.seen[tag]=1;changed=true;
   const j=judges.get(r.judge_id);if(!j||Date.parse(r.judged_at)<s.since)continue;
   if(r.summary?.from?.judge===me||r.summary?.appealOf?.judge===me)continue;   // my witness's trial / my verdict's appeal: told with my case
   if(offerLinked(r,j))changed=true;
   if(offerAppeal(r,j))changed=true;
   if(n<3&&addNews(colleagueArticle(r,j)))n++;
  }
  const tags=Object.keys(s.seen);if(tags.length>600)for(const k of tags.slice(0,tags.length-400))delete s.seen[k];
  if(before!==[...othersOpen].sort().join())try{window.VerdictDocket?.sync?.()}catch{}   // re-draw an offer a colleague now holds
 }catch(e){if(e?.status===404)missing=true}   // the server has no 037 yet: stay quiet, the game goes on as before
 finally{running=false;release()}
 return changed;
}

function refresh(){if(typeof render==='function'&&typeof ui!=='undefined'&&!ui.modal&&['home','tablet','people'].includes(ui.tab))render()}
let lastSig='';
async function tick(force){
 let changed=false;
 // my bench changed (a case taken, a verdict delivered): tell the colleagues now, not at the next round
 if(S.name){const sig=myOpen().join()+'|'+myJudged().length;if(sig!==lastSig){lastSig=sig;force=true}}
 if(S.name)try{if(decideAppeals()>0){changed=true;force=true}}catch(e){console.warn('appeals',e)}   // before the verdict goes out
 try{if(await sync(force))changed=true}catch{}   // first: a colleague's verdict on my witness's trial is then known
 if(S.name)try{if(separateTick()>0)changed=true;if(appealTick()>0)changed=true}catch(e){console.warn('court news',e)}
 if(changed){if(typeof save==='function')save();refresh()}
}

/* a colleague's card shows their recent verdicts */
if(typeof popupNPC==='function'){
 const prior=popupNPC;
 popupNPC=function(id){prior(id);if(!NPC[id]?.colleague||!TP()?.addToModal)return;
  if(NPC[id].spouseOfPlayer){const v=spouseVerdicts();
   TP().addToModal(`<h4>💍 배우자 · 같은 법원 판사</h4><div class="detail"><p>${esc(NPC[id].role)}</p><p class="small">판결 기록 ${v.length}건</p>${v.length?`<ul class="cc-spouse-verdicts">${v.slice(0,30).map(x=>`<li class="small"><b>${esc(x.title)}</b> · ${esc(x.label)}${x.sentence?` (${esc(x.sentence)})`:''}</li>`).join('')}</ul>`:'<p class="small">아직 선고한 사건이 없어요.</p>'}</div>`);return}
  const mine=mem().news.filter(x=>x.from===id).slice(0,5);
  TP().addToModal(`<h4>⚖ 같은 법원 동료 판사</h4><div class="detail"><p>${esc(NPC[id].role)}</p>${mine.length?mine.map(x=>`<p class="small">· ${esc(x.title.replace(/^\[법원 소식\]\s*/,''))}</p>`).join(''):'<p class="small">아직 선고 소식이 없어요.</p>'}</div>`);
 };
}

/* the first four cases of a new judge wait (briefly) until we know which cases colleagues hold */
async function ready(ms=4000){
 if(readOnce||!linked())return;
 await Promise.race([sync(true),new Promise(r=>setTimeout(r,ms))]);
}
window.VerdictColleagues={ready,couple,spouseVerdicts,applyCouple,decideAppeals,appealTick,taken:()=>othersOpen,judged:()=>othersJudged,people,articles,sync:()=>tick(true),separateTick,keyOf};
const start=()=>{if(S.selfGender&&NPC.self)NPC.self.gender=S.selfGender;   // the sex set for a couple (040) also when offline
 setTimeout(()=>tick(true),1500);setInterval(()=>tick(false),TICK_MS);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick(false)})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
