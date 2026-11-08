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
  ...(c.link?.judge&&c.link?.from?{from:{judge:c.link.judge,parent:c.link.from}}:{})};
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
function people(){const s=mem();return Object.entries(s.npc).filter(([uid,id])=>NPC[id]&&(judges.size===0||judges.has(uid))).map(([,id])=>({id,role:NPC[id].role}))}

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
  if(!S.name)return false;
  s.since??=Date.now()-FIRST_LINK_DAYS*86400000;   // the first link brings only the last few days' verdicts
  let n=0;
  judgedRows=(rows||[]).filter(r=>r.state==='judged');
  for(const r of judgedRows.slice().reverse()){
   const tag=r.case_key+':'+r.judge_id+':'+r.judged_at;if(s.seen[tag])continue;s.seen[tag]=1;changed=true;
   const j=judges.get(r.judge_id);if(!j||Date.parse(r.judged_at)<s.since)continue;
   if(r.summary?.from?.judge===me)continue;   // the trial of one of my witnesses: told with my case (separateTick)
   if(offerLinked(r,j))changed=true;
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
 try{if(await sync(force))changed=true}catch{}   // first: a colleague's verdict on my witness's trial is then known
 if(S.name)try{if(separateTick()>0)changed=true}catch(e){console.warn('court news',e)}
 if(changed){if(typeof save==='function')save();refresh()}
}

/* a colleague's card shows their recent verdicts */
if(typeof popupNPC==='function'){
 const prior=popupNPC;
 popupNPC=function(id){prior(id);if(!NPC[id]?.colleague||!TP()?.addToModal)return;
  const mine=mem().news.filter(x=>x.from===id).slice(0,5);
  TP().addToModal(`<h4>⚖ 같은 법원 동료 판사</h4><div class="detail"><p>${esc(NPC[id].role)}</p>${mine.length?mine.map(x=>`<p class="small">· ${esc(x.title.replace(/^\[법원 소식\]\s*/,''))}</p>`).join(''):'<p class="small">아직 선고 소식이 없어요.</p>'}</div>`);
 };
}

/* the first four cases of a new judge wait (briefly) until we know which cases colleagues hold */
async function ready(ms=4000){
 if(readOnce||!linked())return;
 await Promise.race([sync(true),new Promise(r=>setTimeout(r,ms))]);
}
window.VerdictColleagues={ready,taken:()=>othersOpen,judged:()=>othersJudged,people,articles,sync:()=>tick(true),separateTick,keyOf};
const start=()=>{setTimeout(()=>tick(true),1500);setInterval(()=>tick(false),TICK_MS);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick(false)})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
