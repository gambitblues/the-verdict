/* THE VERDICT — hearings, real-time docket, other courts, save snapshots, onboarding and case dossiers. */

;/* source: beta_drama_v16.js */
/* THE VERDICT Beta 1.6 — NPC witnesses and evolving case drama */
'use strict';
(()=>{
let arcs=new Map();
const esc=s=>h(String(s??''));
async function load(){
 try{const r=await fetch(new URL('./content-packs/drama-100-v1.json',location.href),{cache:'no-cache'});if(!r.ok)throw Error('HTTP '+r.status);
 const data=await r.json();if(data.format!=='the-verdict-case-drama/v1'||data.cases?.length!==100)throw Error('format');
 arcs=new Map(data.cases.map(a=>[a.id,a]));render();
 }catch(e){console.warn('Case drama unavailable',e)}
}
function detail(c){
 const a=arcs.get(c.contentPack?.archetypeId||c.story?.packOrigin?.id||c.story?.pack?.archetypeId);
 if(!a)return null;
 const st=S.cases[c.id];if(!st)return null;
 st.drama??={castIds:[],answers:{},postVerdict:false};
 return {a,st,d:st.drama};
}
const prevCourt=court;
court=function(){
 const page=prevCourt();
 const c=CASES.find(x=>x.id===ui.caseId);if(!c||!S.name)return page;
 const x=detail(c);if(!x)return page;
 const {a,st,d}=x;
 const n=Math.min(2,(st.hearingHistory||[]).filter(v=>v.kind==='resumed').length);
 const points=a.turningPoints.filter(p=>p.stage===0||p.stage<=n+1).map(p=>'<article class="drama-act"><b>'+esc(p.heading)+'</b><p>'+esc(p.text)+'</p><small>'+esc(p.why)+'</small></article>').join('');
 const evis=a.factDisclosure.map((e,i)=>'<div class="drama-act"><b>'+esc(e.evidence)+'</b><p>'+esc(e.what)+'</p><small>'+esc(e.caveat)+' · '+(i<=n?'검토 가능한 자료':'추가 기일 검토 대상')+'</small></div>').join('');
 const people=!d.castIds.length?'<p class="muted small">증인 후보는 아직 활성화되지 않았습니다. 필요할 때만 인물 이력을 생성합니다.</p><button class="btn outline" data-action="activateWitnesses">증인 후보 검토</button>':a.cast.map((p,i)=>{
  const id=d.castIds[i];if(!id||!NPC[id])return '';
  const answers=d.answers[id]||[];
  return '<article class="drama-act"><button data-action="npc" data-id="'+esc(id)+'" class="btn outline">👤 '+esc(NPC[id].name)+' · '+esc(p.role)+' · 인물 정보</button><p>'+esc(p.knowledge)+'</p><small>이해관계: '+esc(p.interest)+'</small><div class="drama-buttons">'+[['memory','관찰 범위'],['interest','이해관계'],['cross','반대신문']].map(([type,title])=>'<button class="btn outline mini" data-action="dramaAsk" data-witness="'+esc(id)+'" data-i="'+i+'" data-type="'+type+'" '+(answers.some(v=>v.type===type)||st.verdict?'disabled':'')+'>'+title+'</button>').join('')+'</div>'+answers.map(v=>'<div class="drama-answer"><b>'+esc(v.q)+'</b><p>'+esc(v.a)+'</p><small>'+esc(day(v.week))+' · 검증 대상인 진술</small></div>').join('')+'</article>';
 }).join('');
 const follow=st.verdict?'<section class="panel"><h3>🗞 판결 이후의 관계</h3><p>'+esc(a.consequences.claimant)+'</p><p>'+esc(a.consequences.respondent)+'</p></section>':'';
 const block='<section class="panel deep-drama"><h3>📖 사건의 사람들과 선택</h3>'+points+'<h3>⚖ 양측의 논쟁</h3><p><b>검사·원고 측</b> '+esc(a.advocacy.claimant.theory)+'</p><p><b>변호인·피고 측</b> '+esc(a.advocacy.respondent.theory)+'</p><h3>🔎 증거와 해석</h3>'+evis+'</section><section class="panel deep-drama"><h3>👥 증인·관계인 신문</h3><p class="muted small">각 인물의 진술은 관찰 범위와 이해관계를 포함하며 자동으로 사실로 확정되지 않습니다.</p>'+people+'</section>'+follow;
 const marker='<section class="panel action-panel">';
 return page.includes(marker)?page.replace(marker,block+marker):page+block;
};
const prevClick=clicker;
clicker=function(e){
 const act=e.target.closest('[data-action="activateWitnesses"]');
 if(act){
 const c=CASES.find(x=>x.id===ui.caseId),x=c&&detail(c);if(!x||x.st.verdict||x.d.castIds.length)return;
 for(const p of x.a.cast){const id=freshNPC(p.role,S.caseSerial||1,c.story?.deep?.key||'contract');NPC[id].career=p.profile.career;NPC[id].bond=p.profile.relationship;NPC[id].caseWitnessRole=p.role;x.d.castIds.push(id);remember(id,'관련 사건',c.name+'의 증인 후보로 지목됨 · 관찰 범위 확인 필요',c.id);}
 save();render();return;
 }
 const b=e.target.closest('[data-action="dramaAsk"]');if(!b)return prevClick(e);
 const c=CASES.find(x=>x.id===ui.caseId),x=c&&detail(c);if(!x||x.st.verdict)return;
 if(Number.isInteger(x.st.nextHearingWeek)&&S.week<x.st.nextHearingWeek){toast('다음 기일 이후 신문할 수 있습니다.');return;}
 const i=Number(b.dataset.i),p=x.a.cast[i],id=x.d.castIds[i];if(!p||id!==b.dataset.witness)return;
 const type=b.dataset.type,q=type==='memory'?'무엇을 직접 보고 들었습니까?':type==='interest'?'당사자와 어떤 이해관계가 있습니까?':'다른 증거와 불일치하는 부분은 무엇입니까?';
 const a=type==='memory'?p.testimony.first:type==='interest'?p.interest:p.testimony.cross;
 const records=x.d.answers[id]??(x.d.answers[id]=[]);if(records.some(v=>v.type===type))return;
 records.push({type,q,a,week:S.week});remember(id,'증인신문',c.name+' · '+a,c.id);save();render();
};
const prevConclude=conclude;
conclude=function(v){
 const c=CASES.find(x=>x.id===ui.caseId),x=c&&detail(c);
 prevConclude(v);
 if(!x||!x.st.verdict||x.d.postVerdict)return;
 x.d.postVerdict=true;
 for(const id of x.d.castIds)remember(id,'재판 종결',c.name+' 판결 선고 사실을 통지받음',c.id);
 S.news.unshift({week:S.week,title:'판결 이후의 관계 · '+c.name,body:x.a.consequences.network,category:'법조일보'});
 save();
};
const st=document.createElement('style');
st.textContent='.deep-drama{background:#f9f7f2}.drama-act{background:#fff;border:1px solid #dbd7d1;padding:12px;border-radius:10px;margin:10px 0}.drama-act p{line-height:1.6;margin:7px 0}.drama-act small{color:#657886}.drama-buttons{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.drama-answer{border-left:3px solid #a88b62;padding:10px;background:#f1f5f6;margin:8px 0}';
document.head.appendChild(st);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();

;/* source: beta_hearings_v17.js */
/* Beta v1.7 — playable hearings: short real-time delays, purpose and multi-session judgment */
'use strict';
(()=>{
const KEY_DELAY='verdict_hearing_v17';
const reasonDefs={brief:{title:'양측 추가 서면',mins:10,description:'쟁점을 정리하고 반박 서면을 비교합니다.'},witness:{title:'증인 소환',mins:20,description:'출석 여부와 진술의 직접 경험 범위를 확인합니다.'},evidence:{title:'추가 증거 제출',mins:30,description:'자료 원본과 확보 경위를 검토합니다.'},expert:{title:'현장 검증·전문 감정',mins:60,description:'기술적 자료와 기존 진술을 대조합니다.'}};
function bucket(c){return c.importance>=4?'major':c.importance>=2?'regular':'minor'}
function waits(c){return bucket(c)==='major'?[20,40,60,120,240]:bucket(c)==='regular'?[10,20,40,60]:[10,20,30]}
function minHearings(c){return bucket(c)==='major'?4:bucket(c)==='regular'?2:1}
const fmt=ms=>{const m=Math.max(0,Math.ceil(ms/60000));return m>=60?Math.floor(m/60)+'시간 '+(m%60)+'분':m+'분'};
function eachReady(){
 let updated=0;
 for(const c of CASES){const st=S.cases[c.id],t=st?.liveHearing;if(!t||st.verdict||t.done||Date.now()<t.until)continue;
 t.done=true;
 st.hearingHistory??=[];
 st.hearingHistory.push({week:S.week,kind:'resumed',text:'['+reasonDefs[t.reason].title+'] 후속 심리 가능 · 자료의 진실성은 별도 검토'});
 st.lastHearingNotice=reasonDefs[t.reason].description;
 st.pendingResearch=null;st.nextHearingWeek=null;updated++;
 }
 if(updated)save();
 return updated;
}
function hold(st){return !!(st?.liveHearing&&!st.liveHearing.done&&Date.now()<st.liveHearing.until)}
function schedule(c,reason){
 const st=S.cases[c.id];if(!st||st.verdict||hold(st))return;
 const defs=reasonDefs[reason];if(!defs)return;
 const num=(st.hearingHistory||[]).filter(x=>x.kind==='resumed').length;
 const delays=waits(c);const minutes=Math.max(defs.mins,delays[Math.min(num,delays.length-1)]);
 st.liveHearing={reason,minutes,until:Date.now()+minutes*60000,done:false};
 st.nextHearingWeek=null;st.hearingHistory??=[];st.hearingHistory.push({week:S.week,kind:'scheduled',text:defs.title+' · 현실 '+minutes+'분 후 후속 심리'});
 st.pendingResearch={kind:defs.title,requestedWeek:S.week,realDue:st.liveHearing.until};
 save();render();toast(defs.title+' · '+minutes+'분 뒤 후속 심리');
}
const beforeCourt=court;
court=function(){
 eachReady();
 let html=beforeCourt();
 const c=CASES.find(v=>v.id===ui.caseId),st=c&&S.cases[c.id];if(!c||!st||st.verdict)return html;
 const t=st.liveHearing,awaiting=hold(st),count=(st.hearingHistory||[]).filter(v=>v.kind==='resumed').length,min=minHearings(c);
 const phaseLabel=bucket(c)==='major'?'중대 사건':bucket(c)==='regular'?'일반 사건':'경미 사건';
 let block='<section class="panel live-hearing-panel"><div class="row between"><h3>🗓 재판 진행 · '+phaseLabel+'</h3><span class="chip">'+count+'/'+min+'회 기일 완료</span></div>';
 if(awaiting)block+='<p><b>'+reasonDefs[t.reason].title+'</b>에 대한 준비가 진행 중입니다.</p><p>다음 심리까지 약 '+fmt(t.until-Date.now())+' 남았습니다.</p><button class="btn outline full" data-action="liveRefresh">기일 상태 확인</button>';
 else if(st.phase===3&&count>=min)block+='<p>필요한 후속 심리를 진행했습니다. 판결을 검토할 수 있습니다.</p>';
 else{
  block+='<p class="muted small">기일 연기 사유를 선택하세요. 대기하는 동안 다른 사건을 심리할 수 있습니다. 이미 수락한 사건은 사라지지 않습니다.</p><div class="live-hearing-choices">';
  for(const [id,d] of Object.entries(reasonDefs)){const delay=Math.max(d.mins,waits(c)[Math.min(count,waits(c).length-1)]);block+='<button class="btn outline" data-action="livePostpone" data-reason="'+id+'"><b>'+d.title+'</b><small> '+delay+'분 · '+d.description+'</small></button>';}
  block+='</div>';
 }
 if(st.phase===3&&count<min)block+='<p class="notice">선고 전 추가 심리 '+(min-count)+'회가 필요합니다. 같은 날 모든 단계를 종결할 수 없습니다.</p>';
 block+='</section>';
 // Remove legacy weekly scheduling buttons and skip button while preserving other court UI.
 html=html.replace(/<section class="panel calendar-panel">[\s\S]*?<\/section>/,'');
 const mark='<section class="panel action-panel">';
 return html.includes(mark)?html.replace(mark,block+mark):block+html;
};
const prevStep=courtStep,prevConclude=conclude,prevClick=clicker;
courtStep=function(i){eachReady();if(hold(S.cases[ui.caseId])){toast('다음 심리 기일을 기다려야 합니다.');return;}return prevStep(i)};
conclude=function(id){eachReady();const c=CASES.find(v=>v.id===ui.caseId),st=c&&S.cases[c.id];if(!c||!st)return;if(hold(st)){toast('후속 심리 준비 중입니다.');return;}if((st.hearingHistory||[]).filter(v=>v.kind==='resumed').length<minHearings(c)){toast('추가 기일에서 증거와 반박을 검토해야 선고할 수 있습니다.');return;}return prevConclude(id)};
clicker=function(e){const el=e.target.closest('[data-action]');if(!el)return;
 if(el.dataset.action==='livePostpone'){const c=CASES.find(v=>v.id===ui.caseId);if(c)schedule(c,el.dataset.reason);return;}
 if(el.dataset.action==='liveRefresh'){eachReady();render();return;}
 if(el.dataset.action==='postpone'){const c=CASES.find(v=>v.id===ui.caseId);if(c)schedule(c,'evidence');return;}
 if(el.dataset.action==='skipHearing'){toast('현실시간 기일 시스템에서는 기일 건너뛰기를 사용하지 않습니다.');return;}
 return prevClick(e);
};
const st=document.createElement('style');st.textContent='.live-hearing-panel{border:1px solid #b7a68e;background:#f8f6f0}.live-hearing-choices{display:grid;grid-template-columns:1fr 1fr;gap:8px}.live-hearing-choices button{text-align:left;line-height:1.6;white-space:normal}.live-hearing-choices small{display:block;color:#6a7881}@media(max-width:540px){.live-hearing-choices{grid-template-columns:1fr}}';document.head.appendChild(st);
})();

;/* source: beta_realtime_v18.js */
/* THE VERDICT v1.8 — offline real-time docket and case offers */
'use strict';
(()=>{
const DAY=86400000,HOUR=3600000,START_H=10,END_H=22,OFFER_LIFE=3*HOUR,MAX_ACTIVE=5;
/* Two clocks.
 * Real time brings opportunities: every hour 10:00–22:00 two cases are offered; pick one within 3 hours or both go to
 * another court. The game calendar tells the story: it only moves when a trial session opens (see VerdictCalendar),
 * so the world waits while the player is away.
 * Server-ready: offers come from offerPair(slot), a pure function of the slot and the case pool. A future server can
 * return the same {slot, options[]} shape (or AI-written cases) and the rest of the game does not change. */
const dateKey=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const esc=v=>h(String(v??''));
function initClock(){
 if(!S.name)return null;
 if(!S.realtimeInbox){S.realtimeInbox={enabled:true,startedAt:Date.now(),lastSync:Date.now(),dayProgress:0,offers:[],acceptedByDay:{},otherCourt:[],processedSlots:{}};save();}
 // In real-time mode cases only arrive by choice. The old built-in story cases (week 1–10) must not open by themselves.
 for(const c of CASES){if(c.generated)continue;const st=S.cases[c.id];if(st&&!st.verdict&&!st.referred&&!(st.actions||[]).length&&!st.trial4)st.referred=true}
 S.realtimeInbox.v??=1;
 if(S.realtimeInbox.v<2){S.realtimeInbox.v=2;for(const o of S.realtimeInbox.offers)if(o.status==='available'&&!o.options){o.options=[{title:o.title,tag:o.tag,category:o.category,kind:o.kind,archetypeId:o.archetypeId,packId:o.packId}];o.expires=Math.min(o.expires,Date.now()+OFFER_LIFE)}}
 return S.realtimeInbox;
}
function candidates(){return CasePackEngine.pool(S)}
function hashOf(s){let x=2166136261;for(const ch of String(s))x=Math.imul(x^ch.charCodeAt(0),16777619)>>>0;return x>>>0}
const busy=()=>new Set(openCases().map(c=>c.contentPack?.archetypeId).filter(Boolean));
function preview(item){const a=item.a,cur=window.VerdictCurated?.cases[a.id];
 return {title:a.title,tag:a.tag,category:a.category,kind:a.kind,archetypeId:a.id,packId:item.pack.packId,importance:a.importance||3,
  logline:cur?window.VerdictCurated.fill(cur.logline,{}):'',legal:a.legal||''}}
/* Two contrasting cases for one hour: different archetypes, and when possible a different kind or weight. */
function offerPair(slot){
 const taken=busy(),pool=candidates().filter(x=>!taken.has(x.a.id));const list=pool.length?pool:candidates();
 if(!list.length)return [{title:'사실관계 조사 사건',tag:'일반 사건',archetypeId:null}];
 const scores=Array.isArray(S.specialties)?S.specialties:[];
 const weighted=list.map(item=>({item,w:1+Math.min(2,Math.floor((scores.find(x=>x.key===item.a.category)?.count||0)/3))}));
 const sum=weighted.reduce((v,x)=>v+x.w,0);let pick=hashOf(slot)%sum,a=weighted[0].item;
 for(const x of weighted){if(pick<x.w){a=x.item;break}pick-=x.w}
 const rest=list.filter(x=>x.a.id!==a.a.id);if(!rest.length)return [preview(a)];
 const contrast=rest.filter(x=>x.a.kind!==a.a.kind||Math.abs((x.a.importance||3)-(a.a.importance||3))>=2);
 const pool2=contrast.length?contrast:rest,b=pool2[hashOf(slot+'b')%pool2.length];
 return [preview(a),preview(b)];
}
function transfer(db,o,which){const opts=which==null?o.options||[]:[o.options[which]];opts.forEach((x,i)=>{if(x)db.otherCourt.push({slot:o.slot+(which==null?'-'+i:'-x'),title:x.title,day:o.day,kind:x.kind,category:x.category,at:Date.now()})})}
function sync(){
 const db=initClock();if(!db)return;
 const now=Date.now(),last=Math.max(db.startedAt,Math.min(now,db.lastSync||now));
 // the game calendar no longer follows real time; it moves when trial sessions open (VerdictCalendar)
 const since=Math.max(last,now-7*DAY);
 const cursor=new Date(since);cursor.setMinutes(0,0,0);
 let transferred=0;
 for(let t=cursor.getTime();t<=now;t+=HOUR){
   const d=new Date(t),hour=d.getHours();if(hour<START_H||hour>END_H)continue;
   const slot=dateKey(t)+'T'+String(hour).padStart(2,'0'),day=dateKey(t);
   if(db.processedSlots[slot])continue;db.processedSlots[slot]=true;
   const entry={slot,day,created:t,expires:t+OFFER_LIFE,status:'available',options:offerPair(slot)};
   if(entry.expires<=now){entry.status='transferred';transferred+=entry.options.length;transfer(db,entry)}else db.offers.push(entry);
 }
 for(const o of db.offers){if(o.status==='available'&&now>=o.expires){o.status='transferred';transferred+=(o.options||[]).length;transfer(db,o)}}
 db.offers=db.offers.filter(o=>o.status==='available'||o.status==='accepted').slice(-180);
 db.otherCourt=db.otherCourt.slice(-300);
 const slots=Object.keys(db.processedSlots);if(slots.length>400){const keep=new Set(slots.slice(-250));for(const k of slots)if(!keep.has(k))delete db.processedSlots[k];}
 if(transferred){db.missed=(db.missed||0)+transferred;db.missedDay=dateKey(now)===db.missedDay?db.missedDay:dateKey(now);
  news('다른 재판부로 간 사건 '+transferred+'건','고르지 않은 사건이 다른 재판부에 배당됐습니다. 결과는 며칠 뒤 법조 뉴스로 전해집니다.');}
 db.lastSync=now;save();
}
/* The game calendar. Day 0 = 2027-03-01. It only moves forward, and only when a session opens or time is spent on purpose. */
const CAL0=Date.UTC(2027,2,1);
window.VerdictCalendar={
 today(){return (S.week||0)*7+(S.realtimeInbox?.dayProgress||0)},
 advanceTo(target){const db=initClock();if(!db)return 0;const diff=target-this.today();if(!(diff>0))return 0;
  db.dayProgress=(db.dayProgress||0)+diff;let weeks=Math.min(104,Math.floor(db.dayProgress/7));db.dayProgress-=weeks*7;
  for(let i=0;i<weeks&&!S.ended;i++)advanceWeek(true);return diff},
 label(day){const d=new Date(CAL0+Math.floor(day)*DAY);return `${d.getUTCMonth()+1}월 ${d.getUTCDate()}일(${'일월화수목금토'[d.getUTCDay()]})`},
 full(day){const d=new Date(CAL0+Math.floor(day)*DAY);return `${d.getUTCFullYear()}.${String(d.getUTCMonth()+1).padStart(2,'0')}.${String(d.getUTCDate()).padStart(2,'0')}`}
};
window.VerdictDocket={offerPair,sync,MAX_ACTIVE,OFFER_LIFE,nextSlot(){const d=new Date();const h0=d.getHours();if(h0<START_H){d.setHours(START_H,0,0,0)}else if(h0>=END_H){d.setDate(d.getDate()+1);d.setHours(START_H,0,0,0)}else d.setHours(h0+1,0,0,0);return d.getTime()},missedToday(){const db=S.realtimeInbox;return db?.missedDay===dateKey(Date.now())?db.missed||0:0}};
const baseHome=home;
function inbox(){return ''} // the docket is shown by the home screen (game_ui.js priority())
home=function(){return inbox()+baseHome()};
const baseClick=clicker;
clicker=function(e){const b=e.target.closest('[data-action]');if(!b)return;
 if(b.dataset.action==='acceptDocket'){
   sync();const db=S.realtimeInbox,o=db.offers.find(x=>x.slot===b.dataset.slot),which=Number(b.dataset.opt||0);
   if(!o||o.status!=='available'||Date.now()>=o.expires)return toast('다른 재판부로 넘어갔거나 고를 수 없는 사건입니다.');
   if(openCases().length>=MAX_ACTIVE)return toast(`맡을 수 있는 사건은 ${MAX_ACTIVE}건까지예요. 진행 중인 사건을 먼저 선고하세요.`);
   const pickd=(o.options||[])[which];if(!pickd)return;
   const candidate=candidates().find(x=>x.a.id===pickd.archetypeId&&x.pack.packId===pickd.packId);
   let c;try{c=createGeneratedCase(candidate||null)}catch(err){console.error(err);toast('사건 구성 오류로 배당하지 못했습니다.');return;}
   if(!c)return toast('현재 사건을 배당할 수 없습니다.');
   o.status='accepted';o.caseId=c.id;o.picked=which;(o.options||[]).forEach((x,i)=>{if(i!==which)transfer(db,{...o,options:o.options},i)});
   const today=dateKey(Date.now());db.acceptedByDay[today]=(db.acceptedByDay[today]||0)+1;
   remember(c.who[0],'배당 수락',c.name+'의 재판이 시작됨',c.id);save();ui.caseId=c.id;changeTab('court');toast('사건을 맡았어요 · '+c.name);return;
 }
 if(['nextWeek','skip'].includes(b.dataset.action)){toast('실시간 커리어 모드에서는 주간 스킵이 비활성화됩니다.');return;}
 return baseClick(e);
};
const sty=document.createElement('style');sty.textContent='.realtime-docket{border:1px solid #c09f6f;background:#f8f6f0}.docket-entry{background:white;border:1px solid #ded8cb;border-radius:10px;margin:8px 0;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px}.docket-entry small{display:block;color:#667786;margin-top:4px}';document.head.appendChild(sty);
function awaken(){if(!S.name)return;sync();render();}
const previousStart=clicker;
clicker=function(e){previousStart(e);if(e.target.closest('[data-action="start"]')){initClock();sync();render();}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',awaken);else awaken();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)awaken()});
window.addEventListener('focus',awaken);
})();

;/* source: beta_world_v19.js */
/* v1.9 — other-court decisions and evolving judicial expertise. */
'use strict';
(()=>{
const safe=s=>h(String(s??''));
const categories={homicide:'강력·형사',sexual:'성범죄',violence:'폭력·형사',financial:'경제·금융',property:'재산범죄',reputation:'명예·정보',civil:'민사·계약',family:'가사·상속',professional:'기업·전문직',public:'공공·행정'};
function scores(){
 const tally={};for(const c of CASES){const st=S.cases[c.id];if(!st?.verdict)continue;
 const k=c.contentPack?.category||c.story?.pack?.category||c.story?.deep?.key||'civil';
 tally[k]??={cases:0,score:0};tally[k].cases++;tally[k].score+=Math.max(0,Number(st.grade)||0);
 }
 const out=Object.entries(tally).map(([key,v])=>({key,title:categories[key]||key,count:v.cases,score:Math.round(v.score/v.cases),level:Math.min(5,Math.floor(v.cases/3)+1)})).sort((a,b)=>b.count-a.count);
 S.specialties=out;return out;
}
function resolveCourts(){
 const db=S.realtimeInbox;if(!db?.enabled)return;
 db.resolvedSlots??={};db.otherCourtDecisions??=[];
 const now=Date.now();let updated=0;
 for(const entry of db.otherCourt){
  if(db.resolvedSlots[entry.slot])continue;
  const arrival=entry.at||new Date(entry.day+'T10:00:00').getTime();
  const seed=[...entry.slot].reduce((a,c)=>Math.imul(a^c.charCodeAt(0),16777619)>>>0,2166136261);
  const hours=8+(seed%89);if(now<arrival+hours*3600000)continue;
  const verdicts=entry.kind==='criminal'?['증거 부족으로 무죄','일부 혐의 유죄','공소사실 전부 유죄','공소기각']:['청구 일부 인용','청구 기각','청구 전부 인용','조정 성립','소송상 화해'];
  const result=verdicts[seed%verdicts.length];
  // Do not invent a relationship between unrelated NPCs and a background case.
  const connection=null;
  const record={slot:entry.slot,title:entry.title,day:entry.day,result,week:S.week,connection,category:'법원 판결'};
  db.resolvedSlots[entry.slot]=true;db.otherCourtDecisions.push(record);entry.result=result;
  if(updated<3||connection){news(entry.title.replace(/\s*·.*$/,'')+', 다른 재판부에서 '+result,'내가 고르지 않았던 사건이다. 다른 재판부의 결론은 "'+result+'"였다.','법조일보');}
  updated++;
 }
 if(updated){db.otherCourtDecisions=db.otherCourtDecisions.slice(-300);save();}
}
const oldHome=home;
home=function(){
 resolveCourts();const arr=scores();const db=S.realtimeInbox;
 let html='<section class="panel judicial-specialty"><h3>🎓 법관 전문 분야</h3><p class="muted small">실제 판결 경험이 누적될수록 해당 분야의 배당 가능성이 높아집니다.</p>';
 html+=arr.length?arr.slice(0,5).map(s=>'<p><b>'+safe(s.title)+'</b> · '+s.count+'건 · 평균 판단 '+s.score+'점 · 숙련 '+s.level+'/5</p>').join(''):'<p class="muted small">아직 완료한 사건이 없습니다.</p>';
 if(db?.otherCourtDecisions?.length){html+='<details><summary>⚖ 다른 재판부의 모의 종결 기록</summary>'+db.otherCourtDecisions.slice(-8).reverse().map(d=>'<p class="small">'+safe(d.title)+' · '+safe(d.result)+(d.connection&&NPC[d.connection]?' · 👤 '+safe(NPC[d.connection].name):'')+'</p>').join('')+'</details>';}
 html+='</section>';return oldHome()+html;
};
const oldConclude=conclude;
conclude=function(id){const c=CASES.find(x=>x.id===ui.caseId),was=c&&S.cases[c.id]?.verdict;oldConclude(id);if(c&&!was&&S.cases[c.id]?.verdict){scores();save();}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(S.name){resolveCourts();scores();render();}});else if(S.name){resolveCourts();scores();render();}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.name){resolveCourts();render();}});
const style=document.createElement('style');style.textContent='.judicial-specialty{border:1px solid #b7c4ce;background:#f6f8fa}.judicial-specialty p{line-height:1.5}';document.head.appendChild(style);
})();

;/* source: save_manager_v21.js */
/* THE VERDICT v2.1 — nonintrusive saves with IndexedDB recovery snapshots */
'use strict';
(()=>{
const DB='the-verdict-saves',STORE='snapshots',KEY='the_verdict_alpha_1',PREFIX='verdict_player_save_',ACTIVE='verdict_player_active';
const who=()=>localStorage.getItem(ACTIVE)||'1';
let dbPromise=null,writing=Promise.resolve(),lastOkay=null;
function openDB(){if(!('indexedDB'in window))return Promise.reject(Error('IndexedDB unsupported'));
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});return dbPromise;}
async function records(id){const db=await openDB();return new Promise((res,rej)=>{const t=db.transaction(STORE,'readonly');const q=t.objectStore(STORE).getAll();q.onsuccess=()=>res(q.result.filter(x=>x.player===id).sort((a,b)=>b.time-a.time));q.onerror=()=>rej(q.error)});}
async function put(data,id){const db=await openDB();const previous=await records(id);return new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE),ts=Date.now();s.put({id:id+'-'+ts,player:id,time:ts,data});for(const x of previous.slice(2))s.delete(x.id);tx.oncomplete=()=>res(ts);tx.onerror=()=>rej(tx.error)})}
function valid(raw){try{const o=VerdictStore.parse(raw);return [1,2,3,4,5].includes(Number(o.version))&&o.cases&&o.market&&Array.isArray(o.journal)}catch{return false}}
function status(s){lastOkay=s;const el=document.getElementById('verdict-save-status');if(el)el.textContent=s}
function snapshot(){VerdictStore.flush();const data=localStorage.getItem(KEY);if(!data||!valid(data))return Promise.reject(Error('invalid save'));
 const id=who(); // the active profile is not copied into its slot here; that copy doubled storage
 writing=writing.catch(()=>{}).then(()=>put(data,id)).then(ts=>{status('저장 완료 · '+new Date(ts).toLocaleTimeString('ko-KR'));return ts}).catch(e=>{status('저장 확인 실패 · 백업 권장');throw e});return writing;}
const previousSave=save;
let lastBackup=0;
save=function(){previousSave();const now=Date.now();if(now-lastBackup>60000){lastBackup=now;snapshot().catch(e=>console.warn('Snapshot:',e))}};
function uiPanel(){
 const parent=document.querySelector('.quick-top');if(!parent||parent.querySelector('[data-action="safeSave"]'))return;
 const button=document.createElement('button');button.className='btn outline mini';button.dataset.action='safeSave';button.textContent='💾 저장';
 const flag=document.createElement('span');flag.id='verdict-save-status';flag.className='small muted';flag.textContent=lastOkay||'자동 저장 사용 중';
 parent.prepend(flag);parent.prepend(button);
}
const baseRender=render;render=function(){baseRender();uiPanel()};
const click=clicker;
clicker=function(e){const b=e.target.closest('[data-action]');if(!b)return;
 if(b.dataset.action==='safeSave'){status('저장 중…');snapshot().catch(()=>toast('저장에 실패했습니다. 저장 관리에서 백업을 확인하세요.'));return;}
 if(b.dataset.action==='saveRecovery'){recovery().catch(()=>toast('복구할 수 있는 기록이 없습니다.'));return;}
 if(b.dataset.action==='advancedBackup'){ui.tabletTab='backup';changeTab('tablet');return;}
 return click(e);
};
async function clearSnapshots(id){const db=await openDB();const xs=await records(id);return new Promise(res=>{const tx=db.transaction(STORE,'readwrite'),st=tx.objectStore(STORE);for(const x of xs)st.delete(x.id);tx.oncomplete=()=>res(xs.length);tx.onerror=()=>res(0)})}
window.VerdictSnapshots={clear:id=>clearSnapshots(id||who()).catch(()=>0)};
async function recovery(){const xs=await records(who()),good=xs.find(x=>valid(x.data));if(!good)throw Error('no valid snapshot');if(!confirm('최근 정상 저장본으로 복구할까요? 현재 진행 상황을 덮어씁니다.'))return;localStorage.setItem(KEY,good.data);location.reload();}
const prevTablet=tabletInner;
tabletInner=function(){if(ui.tabletTab!=='backup')return prevTablet();
 return '<h2>💾 저장 관리</h2><p class="muted">판결과 사건 진행은 자동으로 저장됩니다. 기기 내 최근 정상 저장본을 보관합니다.</p><div class="save-buttons"><button class="btn primary" data-action="safeSave">지금 저장</button><button class="btn outline" data-action="saveRecovery">최근 저장 복구</button></div><details class="mt"><summary>고급 백업 · 기기 간 파일 이동</summary><div class="save-buttons"><button class="btn outline" data-action="export">백업 파일 내보내기</button><button class="btn outline" data-action="import">파일에서 불러오기</button></div><input id="importFile" type="file" accept="application/json,.json" class="hidden"><p class="muted small">파일은 직접 보관해야 합니다. 온라인 계정 동기화는 아직 지원하지 않습니다.</p></details>';
};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&S.name)snapshot().catch(()=>{})});
document.addEventListener('DOMContentLoaded',()=>{if(S.name){snapshot().catch(()=>{});uiPanel();}});
})();

;/* source: visual_onboarding_v22.js */
/* THE VERDICT visual refresh v2.2 — mobile-first career onboarding */
'use strict';
(()=>{
const oldSetup=setup;
setup=function(){
 const chosen=Number.isInteger(S.style)?S.style:0;
 modal('새 커리어 시작',`
 <div class="onboard-head"><div class="onboard-seal">⚖</div><div class="onboard-kicker">THE VERDICT · CAREER 01</div><h3>당신의 판결이<br>한 사람의 인생을 바꿉니다.</h3><p>2027년 · 신임 판사 35세 · 40년의 기록</p></div>
 <div class="onboard-field"><label for="playerName">판사 이름</label><input id="playerName" class="control" maxlength="16" placeholder="이름을 입력하세요" autocomplete="off"></div>
 <div class="onboard-choice-head"><strong>프로필 스타일</strong><small>시작 후 변경 가능 · 외형은 판결에 영향 없음</small></div>
 <div class="onboard-portrait-grid">${[0,1,2,3,4].map(i=>`<button type="button" class="onboard-portrait ${i===chosen?'selected':''}" data-action="style" data-i="${i}" aria-label="스타일 ${i+1}" aria-pressed="${i===chosen}"><div class="onboard-face">${avatar('self',i)}</div><span>STYLE ${String(i+1).padStart(2,'0')}</span></button>`).join('')}</div>
 <div class="onboard-note"><span>●</span> 판결·동료·가족·사건 기록은 자동 저장됩니다.</div>`,
 '<button class="btn primary full onboard-start" data-action="start">나의 법관 커리어 시작하기 <span>→</span></button>');
};
const oldClick=clicker;
clicker=function(e){
 const b=e.target.closest('[data-action]');if(b?.dataset.action==='style'){
 S.style=Number(b.dataset.i);const modalRoot=document.querySelector('#modal-root');
 modalRoot?.querySelectorAll('.onboard-portrait').forEach((node,i)=>{const yes=i===S.style;node.classList.toggle('selected',yes);node.setAttribute('aria-pressed',String(yes))});
 save();return;
 }
 return oldClick(e);
};
const css=document.createElement('style');css.textContent=`
/* Startup overlay: deliberately no internal scrolling on normal phone sizes */
#modal-root .modal-veil:has(.onboard-head){z-index:20000;padding:16px;align-items:center;overflow-y:auto;background:rgba(8,18,28,.86);backdrop-filter:blur(7px)}
#modal-root .modal:has(.onboard-head){width:min(440px,100%);max-height:min(95dvh,850px);overflow-y:auto;padding:0;border:1px solid #bb9a6d;border-radius:22px;background:#f9f7f2;box-shadow:0 24px 80px #080d16b3;color:#253849}
#modal-root .modal:has(.onboard-head)>h2{display:none}
#modal-root .modal:has(.onboard-head)>div:nth-child(2){padding:0 22px}
.onboard-head{text-align:center;background:linear-gradient(150deg,#17283c,#2b4354);color:#f4eddf;margin:0 -22px 20px;padding:22px 20px 24px}
.onboard-seal{font-family:serif;display:inline-grid;place-items:center;width:45px;height:45px;border:1px solid #c7a370;border-radius:50%;font-size:23px;color:#cba76e;margin-bottom:10px}
.onboard-kicker{font-size:10px;letter-spacing:2.3px;color:#d3b689;font-weight:700}
.onboard-head h3{font-size:24px;line-height:1.38;margin:12px 0 7px;color:#fff;font-weight:700;word-break:keep-all}
.onboard-head p{font-size:12px;color:#c5cfd2;margin:0}
.onboard-field label{display:block;font-size:13px;font-weight:700;margin:0 0 8px}
.onboard-field input{width:100%;border:1px solid #d1d9dd;border-radius:12px;padding:13px 14px;background:#fff;min-height:48px;font-size:16px}
.onboard-choice-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:19px 0 10px}
.onboard-choice-head strong{font-size:14px}.onboard-choice-head small{font-size:10px;color:#88939b}
.onboard-portrait-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}
.onboard-portrait{min-width:0;background:white;border:2px solid #d8dedf;border-radius:11px;padding:5px 2px 6px;cursor:pointer;color:#6d7c87}
.onboard-portrait.selected{border-color:#b98b4d;background:#fdf6e9;box-shadow:0 0 0 2px #b98b4d22;color:#805b2b}
.onboard-face{height:92px;display:flex;justify-content:center;align-items:flex-end;overflow:hidden}
.onboard-face .avatar{height:88px;width:auto;max-width:100%}
.onboard-face svg{width:100%;height:100%;object-fit:contain}
.onboard-portrait span:not(.avatar){display:block;font-size:8px;font-weight:800;letter-spacing:.4px;margin-top:4px}
.onboard-note{font-size:11px;color:#687e7c;margin:16px 0 9px}.onboard-note span{color:#4c8f75;font-size:9px}
#modal-root .modal:has(.onboard-head)>.modal-actions{padding:9px 22px 20px;margin:0}
.onboard-start{border-radius:12px!important;min-height:50px;background:#ad8550!important;color:#fff!important;font-size:14px!important;font-weight:700}
.onboard-start span{margin-left:12px}
@media(max-height:740px){.onboard-head{padding:12px 18px 15px;margin-bottom:13px}.onboard-head h3{font-size:20px;margin:7px 0}.onboard-seal{width:33px;height:33px;font-size:18px;margin-bottom:5px}.onboard-face{height:72px}.onboard-face .avatar{height:68px}.onboard-choice-head{margin-top:11px}.onboard-note{margin:8px 0}}
`;document.head.appendChild(css);
})();

;/* source: judge_avatar_v23.js */
/* THE VERDICT — unified judge ID portrait (gender, face, complexion, hair, glasses, outfit). */
'use strict';
(()=>{
const oldAvatar=avatar,oldHome=home,oldSetup=setup,oldClick=clicker,oldShell=shell;
const choices={
 gender:[['masculine','남성형'],['feminine','여성형'],['neutral','중성형']],
 face:[['oval','계란형'],['round','둥근형'],['square','각진형']],
 skin:[['fair','밝음'],['medium','중간'],['deep','어두움']],
 hair:[['part','가르마'],['crop','숏컷'],['bob','단발'],['ponytail','묶음'],['wave','웨이브'],['slick','올백']],
 glasses:[['no','안경 없음'],['yes','안경']],
 outfit:[['robe','법복'],['suit','정장']]
};
const skinMap={fair:'#f1c9a9',medium:'#d6a07c',deep:'#9d644d'};
const darkMap={fair:'#ca9279',medium:'#ad7054',deep:'#7e4b39'};
const hairMap={part:'#302b30',crop:'#28292d',bob:'#3f2d2d',ponytail:'#332b31',wave:'#453338',slick:'#242b31'};
function avatarState(){
 if(!S.judgeAvatar){S.judgeAvatar={gender:S.style===4?'feminine':'masculine',face:'oval',skin:'medium',hair:['crop','part','slick','wave','bob'][Math.max(0,Math.min(4,S.style||0))],glasses:false,outfit:'robe'};}
 return S.judgeAvatar;
}
function portrait(settings,klass){
 const g=settings||avatarState(),color=skinMap[g.skin]||skinMap.medium,shade=darkMap[g.skin]||darkMap.medium,hair=hairMap[g.hair]||hairMap.part;
 const shapes={round:'M42 60 Q42 27 81 26 Q120 27 120 61 Q120 115 82 119 Q42 113 42 60Z',oval:'M42 60 Q43 18 81 21 Q120 21 120 60 Q119 119 81 125 Q41 119 42 60Z',square:'M43 53 Q45 23 81 24 Q116 24 118 51 L118 103 Q106 122 81 123 Q54 120 44 104Z'};
 const silhouette=shapes[g.face]||shapes.oval;
 const wide=g.gender==='feminine',neutral=g.gender==='neutral',longHair=wide&&['bob','ponytail','wave'].includes(g.hair);
 const back=longHair?'<path d="M36 64Q25 5 81 11 Q135 8 126 67 L134 155 Q103 175 84 125 L62 128 Q36 170 27 147Z" fill="'+hair+'"/>':'';
 const hairFront={
  part:'<path d="M39 64 Q27 29 51 16 Q72 6 84 21 Q112 6 124 52 Q109 41 91 32 Q67 42 39 64Z" fill="'+hair+'"/>',
  crop:'<path d="M39 64 Q33 22 70 17 Q112 11 125 55 Q94 39 74 42 Q49 38 39 64Z" fill="'+hair+'"/>',
  bob:'<path d="M33 82 Q28 18 75 15 Q128 9 127 84 L119 118 L111 76 Q105 42 80 37 Q50 41 43 78 L42 117Z" fill="'+hair+'"/>',
  ponytail:'<path d="M39 68 Q26 24 71 17 Q112 8 124 56 Q96 33 74 35 Q48 40 39 68Z" fill="'+hair+'"/><path d="M119 44 Q148 61 129 125" stroke="'+hair+'" stroke-width="19" fill="none"/>',
  wave:'<path d="M34 76 Q23 38 48 20 Q65 6 80 19 Q103 5 122 26 L129 88 Q117 63 111 45 Q91 51 75 38 Q54 44 43 77Z" fill="'+hair+'"/>',
  slick:'<path d="M40 60 Q36 25 76 17 Q118 11 123 53 Q100 27 77 28 Q54 34 40 60Z" fill="'+hair+'"/>'
 }[g.hair]||'';
 const eyes=neutral?20:wide?18:14;
 const glasses=g.glasses?'<rect x="49" y="68" width="28" height="20" rx="7" fill="none" stroke="#28323e" stroke-width="3"/><rect x="87" y="68" width="28" height="20" rx="7" fill="none" stroke="#28323e" stroke-width="3"/><path d="M77 76 Q82 73 87 76" fill="none" stroke="#28323e" stroke-width="3"/>':'';
 const jacket=g.outfit==='robe'?'#1b2536':'#344c68',shirt=g.outfit==='robe'?'#f8f6ee':'#f3f3ef';
 return '<span class="judge-id-portrait '+(klass||'')+'" role="img" aria-label="선택한 판사의 증명사진"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 184" preserveAspectRatio="xMidYMid meet">'+
 '<defs><linearGradient id="judge-photo-bg" x2="0" y2="1"><stop stop-color="#e4ded5"/><stop offset="1" stop-color="#c5c0ba"/></linearGradient></defs><rect width="160" height="184" fill="#dadbd9"/><rect x="5" y="5" width="150" height="174" fill="#f0ece5"/>'+
 '<path d="M0 180 Q10 132 56 131 L107 131 Q151 137 160 180Z" fill="'+jacket+'"/><path d="M61 130 L81 160 L99 130 L94 119 L67 119Z" fill="'+shirt+'"/><path d="M81 140 l-7 14 7 24 7-24Z" fill="#a98350"/>'+
 back+'<rect x="69" y="111" width="24" height="29" rx="10" fill="'+color+'"/><path d="'+silhouette+'" fill="'+color+'" stroke="'+shade+'" stroke-width="1.1"/>'+
 '<ellipse cx="41" cy="78" rx="7" ry="10" fill="'+color+'"/><ellipse cx="120" cy="78" rx="7" ry="10" fill="'+color+'"/>'+hairFront+
 '<path d="M52 65 Q62 '+(eyes+40)+' 74 65 M89 65 Q103 '+(eyes+40)+' 113 65" fill="none" stroke="'+hair+'" stroke-width="'+(wide?'2.4':'3.4')+'" stroke-linecap="round"/>'+
 '<ellipse cx="63" cy="79" rx="3.5" ry="4.1" fill="#2b3340"/><ellipse cx="101" cy="79" rx="3.5" ry="4.1" fill="#2b3340"/>'+
 '<path d="M82 85 L79 99 L84 101" fill="none" stroke="'+shade+'" stroke-width="1.8"/><path d="M70 108 Q82 '+(wide?'114':'112')+' 94 108" fill="none" stroke="#995d56" stroke-width="2"/>'+glasses+
 '<path d="M12 182 H148" stroke="#9a9993" stroke-width="1"/></svg></span>';
}
window.VerdictJudgePortrait={get:avatarState,picture:portrait,choices};
avatar=function(id,style){return id==='self'||id===undefined?portrait(avatarState(),'judge-avatar'):oldAvatar(id,style)};
function replaceJudgePhoto(html){
 const tmp=document.createElement('template');tmp.innerHTML=html;
 tmp.content.querySelectorAll('.dashboard-hero-badge .id-portrait').forEach(e=>{e.outerHTML=portrait(avatarState(),'judge-home-photo')});
 return tmp.innerHTML;
}
home=function(){return replaceJudgePhoto(oldHome());};
shell=function(content){let html=oldShell(content);return html.replace('class="sidebar-user">','class="sidebar-user"><button class="judge-edit" data-action="judgeEdit" title="판사 얼굴 수정">프로필 수정</button>')};
function controls(group,label){
 return '<div class="judge-control"><b>'+label+'</b><div class="judge-control-items">'+choices[group].map(p=>'<button type="button" class="judge-option" data-action="judgeOption" data-key="'+group+'" data-value="'+p[0]+'" aria-pressed="'+(String(avatarState()[group])===p[0])+'">'+p[1]+'</button>').join('')+'</div></div>';
}
function drawEditor(editing){
 const body='<div class="judge-creator"><div class="judge-preview">'+portrait(avatarState(),'judge-preview-image')+'<div><b>나의 판사</b><small>프로필·법정·홈에 동일하게 반영</small></div></div>'+
 '<div class="judge-name-field"><label for="playerName">판사 이름</label><input class="control" id="playerName" maxlength="16" value="'+h(S.name||'')+'" placeholder="이름을 입력하세요" autocomplete="off"></div>'+
 controls('gender','외모 유형')+controls('face','얼굴형')+controls('skin','피부톤')+controls('hair','헤어스타일')+controls('glasses','안경')+controls('outfit','복장')+'</div>';
 modal(editing?'판사 프로필 변경':'나의 판사 만들기',body,'<button class="btn primary full" data-action="'+(editing?'judgeSaveEdit':'start')+'">'+(editing?'프로필 저장':'법관 커리어 시작하기')+'</button>');
}
setup=function(){drawEditor(false)};
clicker=function(e){
 const el=e.target.closest('[data-action]');if(!el)return oldClick(e);
 if(el.dataset.action==='judgeOption'){
  const k=el.dataset.key,v=el.dataset.value;if(!(k in choices)||!choices[k].some(x=>x[0]===v))return;
  avatarState()[k]=k==='glasses'?v==='yes':v;
  const view=document.querySelector('.judge-preview-image');if(view)view.outerHTML=portrait(avatarState(),'judge-preview-image');
  document.querySelectorAll('.judge-option[data-key="'+k+'"]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.value===v)));
  save();return;
 }
 if(el.dataset.action==='judgeEdit'){drawEditor(true);return}
 if(el.dataset.action==='judgeSaveEdit'){const inp=document.querySelector('#playerName');if(inp)S.name=inp.value.trim().slice(0,16)||S.name;save();ui.modal=null;render();toast('프로필 변경 저장');return}
 return oldClick(e);
};
avatarState();
})();

;/* source: court_editorial_v24.js */
/* THE VERDICT v2.4 — specific case summary, opposed submissions, and witnesses across 100 archetypes */
'use strict';
(()=>{
let editorial=new Map(),forensic={},ready=false;
const esc=v=>h(String(v??''));
const name=id=>NPC[id]?.name||'성명 미상';
function caseId(c){return c.contentPack?.archetypeId||c.story?.pack?.archetypeId||c.story?.packOrigin?.id||null}
function info(c){const a=editorial.get(caseId(c));return a?{a,f:forensic[a.id]||a.details||{},criminal:c.kind==='criminal'}:null}
function dispute(c,ctx){
 const {a,f,criminal}=ctx;
 const defendant=name(criminal?c.who?.[0]:c.who?.[1]),victim=name(criminal?c.who?.[1]:c.who?.[0]);
 const place=f.place||a.location||'사건 현장',time=f.when||'사건 발생일';
 const action=f.method||a.allegation;
 const short=criminal?
   ('피고인 '+defendant+' · 장소: '+place+' · 의혹: '+String(action).replace(/[.。]$/,'')+'. '+(/살인|치사|사망|추락/.test(c.tag+action)?'피해자':'피해자·신고인')+' '+victim+'. 실제로 무슨 일이 있었는지 증거로 가려야 한다.'):
   (victim+'이(가) '+defendant+'을(를) 상대로 '+a.allegation+'에 관하여 청구했다. 약속이나 행동, 손해가 증거로 얼마나 확인되는지가 쟁점이다.');
 return short;
}
function witnesses(c,ctx){
 const st=S.cases[c.id]||{},base=[...new Set((c.stages||[]).flatMap(x=>x.actions||[]).map(x=>x.who).filter(id=>id&&NPC[id]&&!c.who?.includes(id)&&!c.side?.includes(id)))];
 const added=(st.drama?.castIds||[]).filter(id=>NPC[id]);
 const ids=[...new Set([...added,...base])].slice(0,3),roles=ctx.a.witnessRoles||[];
 const panel='<section class="panel compact-case-witness"><h3>👥 사건 관계인 · 증인</h3><div class="compact-witness-row">'+
 ids.map((id,i)=>'<button class="compact-witness-person" data-action="npc" data-id="'+esc(id)+'"><strong>'+esc(name(id))+'</strong><span>'+esc(roles[i]||'관계인')+'</span><small>인물 카드 ›</small></button>').join('')+
 (!ids.length?'<p class="muted small">아직 출석한 증인이 없습니다. 재판에서 증인 조사를 신청할 수 있습니다.</p>':'')+'</div></section>';
 return panel;
}
function sides(c,ctx){
 const {a,f,criminal}=ctx,defendant=name(criminal?c.who?.[0]:c.who?.[1]),claimant=name(criminal?c.who?.[1]:c.who?.[0]);
 const evidence=(c.evidence||[]).slice(0,2).join(' · '),weak=f.defense||a.defenseTheory||a.whyDefense;
 const claim=criminal?
  ('피고인 '+defendant+'이(가) '+(f.when||'사건 당일')+' '+(f.place||a.location||'사건 장소')+'에서 '+String(f.method||a.allegation).replace(/\s*(혐의|의혹)\.?$/,'')+'는 혐의. '+(f.motive?'범행 동기는 '+f.motive+'. ':'')+'입증 자료: '+evidence+'.'):
  ('원고 '+claimant+'은 '+a.allegation+'. 관련 증거: '+evidence+'.');
 const response=criminal?
  ('피고인 측은 '+weak+' 검찰의 주장만으로 고의·행위자 특정·인과관계가 모두 입증되지는 않았다고 반박한다.'):
  ('피고 '+defendant+' 측은 '+weak+' 청구 금액과 의무·손해의 관계를 다툰다.');
 return '<section class="case-advocates editorial-advocates"><div class="row between"><h3 class="no-margin">02 · 양측의 주장</h3><span class="chip">서면 확인</span></div><div class="adversarial">'+
  '<article class="adv-card prosecution"><strong class="adv-label">'+(criminal?'검사 측':'원고 측')+'</strong><p>'+esc(claim)+'</p><button class="btn outline full" data-action="editorialBrief" data-side="claim">📄 '+(criminal?'검사 의견서':'원고 준비서면')+' 전문</button></article>'+
  '<article class="adv-card defense"><strong class="adv-label">'+(criminal?'변호인 측':'피고 측')+'</strong><p>'+esc(response)+'</p><button class="btn outline full" data-action="editorialBrief" data-side="defend">📄 '+(criminal?'변호인 의견서':'피고 준비서면')+' 전문</button></article>'+
  '</div></section>';
}
function fullBrief(c,ctx,side){
 const {a,f,criminal}=ctx,pro=side==='claim';
 const defendant=name(criminal?c.who?.[0]:c.who?.[1]),claimant=name(criminal?c.who?.[1]:c.who?.[0]);
 const advocate=name(c.side?.[pro?0:1]),loc=f.place||a.location||'기록에 기재된 장소';
 const when=f.when||'사건 발생일',action=f.method||a.allegation,motive=f.motive||'당사자의 이해관계';
 const corePro=criminal?
   ('검사는 피고인 '+defendant+'이(가) '+when+', '+loc+'에서 '+claimant+'에게 '+action+' 혐의가 있다고 주장합니다. 범행 동기로 '+motive+'를 지목하며, 해당 행위와 피해 결과 사이의 인과관계 및 고의가 쟁점이라고 봅니다.'):
   ('원고 '+claimant+'은 '+a.allegation+'에 관하여 피고 '+defendant+'에게 책임이 있다고 주장합니다. 발생 장소는 '+loc+'이며, 손해의 범위와 원인이 다투어집니다.');
 const coreDef=criminal?
   ('변호인은 '+defendant+'의 방어권을 위해 다음 점을 다툽니다. '+(f.defense||a.defenseTheory||a.whyDefense)+' 피해 사실의 존재와 피고인의 범행 책임은 구분되어야 하고 검사는 합리적 의심을 배제할 수준으로 입증해야 합니다.'):
   ('피고 '+defendant+' 측은 '+(a.whyDefense||a.weakEvidence)+' 계약의 범위, 이행 경위, 손해 발생의 원인과 액수를 각각 다툽니다.');
 const proof=(c.evidence||[]).map((title,i)=>'<p><b>'+(i+1)+'. '+esc(title)+'</b> — '+esc(i===0?a.whyEvidence:i===1?a.weakEvidence:'작성자·원본·입증 범위 확인')+'</p>').join('');
 const expert=f.medicalEvidence||f.forensic||'증인의 직접 관찰 범위와 자료 원본성·진술의 시간적 일치 여부를 확인해야 합니다.';
 const demand=pro?(criminal?'가상 구형: '+(f.demand||a.demand||'개별 심리 후 구형'):'청구 취지: '+(a.demand||'손해배상 및 청구권 판단')):(criminal?'결론: 공소사실에 관한 증명 부족 부분은 무죄 판단을 구합니다.':'결론: 증명되지 않은 청구 부분은 기각을 구합니다.');
 const text=pro?corePro:coreDef,title=criminal?(pro?'검사 의견서':'변호인 의견서'):(pro?'원고 준비서면':'피고 준비서면');
 const paper='<div class="editorial-paper"><div class="paper-kicker">THE VERDICT · 가상 사건 기록</div><h3>'+title+'</h3><p><b>사건</b> '+esc(c.name)+' · '+esc(c.id)+'</p><p><b>제출인</b> '+esc(advocate)+'</p>'+
 '<h4>1. 사건의 경위와 주장</h4><p>'+esc(text)+'</p>'+
 '<h4>2. 증거와 반대 논점</h4>'+proof+
 '<p><b>감정·진료·정황 자료:</b> '+esc(expert)+'</p><p><b>상대방이 다투는 부분:</b> '+esc(f.defense||a.defenseTheory||a.whyDefense)+'</p>'+
 '<h4>3. '+(criminal?'구형 및 결론':'청구와 결론')+'</h4><p><b>'+esc(demand)+'</b></p>'+
 '<p class="muted small">법률상 죄명·구형은 게임을 위한 가상 주장입니다. 제시된 혐의는 확정된 사실이 아니며 재판부가 증거에 따라 판단합니다.</p></div>';
 modal(title,paper,'<button class="btn primary full" data-action="dismiss">서면 닫기</button>');
}
const formerCourt=court;
court=function(){
 let html=formerCourt(),c=CASES.find(x=>x.id===ui.caseId);if(!c)return html;
 const ctx=info(c);if(!ctx||!html.includes('case-narrative'))return html;
 const intro='<section class="panel case-narrative editorial-intro"><div class="row between"><h3 class="no-margin">01 · 무슨 사건인가?</h3><span class="chip">'+(ctx.criminal?'형사':'민사·가사')+'</span></div><p>'+esc(dispute(c,ctx))+'</p></section>';
 html=html.replace(/<section class="panel case-narrative">[\s\S]*?<\/section>/,intro);
 html=html.replace(/<section class="case-advocates">[\s\S]*?<\/section>/,sides(c,ctx)+witnesses(c,ctx));
 html=html.replace(/<section class="panel new-hearing-briefs">[\s\S]*?<\/section>/,'');
 html=html.replace(/<section class="panel verdict-narrative-layer">[\s\S]*?<\/section>/,'');
 html=html.replace(/<section class="panel deep-drama"><h3>📖 사건의 사람들과 선택<\/h3>[\s\S]*?<\/section>/,'');
 html=html.replace(/<section class="panel"><div class="row between"><h3 class="no-margin">사건 관계인 · 증인<\/h3>[\s\S]*?<\/section>/,'');
 const entries=(S.cases[c.id]?.hearingRevelations||[]).slice(-2);
 if(entries.length){const update='<details class="editorial-updates"><summary>새 기일에 추가된 자료</summary>'+entries.map(v=>'<p class="small"><b>'+esc(v.type)+'</b> · '+esc(v.body)+'</p>').join('')+'</details>';html=html.replace('</section><section class="case-advocates editorial-advocates">',update+'</section><section class="case-advocates editorial-advocates">');}

 return html;
};
function caseWitnessIds(c){
 const st=S.cases[c.id]||{},base=[...new Set((c.stages||[]).flatMap(x=>x.actions||[]).map(x=>x.who).filter(id=>id&&NPC[id]&&!c.who?.includes(id)&&!c.side?.includes(id)))];
 return [...new Set([...(st.drama?.castIds||[]).filter(id=>NPC[id]),...base])].slice(0,3);
}
const previousNPC=popupNPC;
popupNPC=function(id){
 const c=CASES.find(x=>x.id===ui.caseId),ctx=c&&info(c);
 if(!c||!ctx||!NPC[id])return previousNPC(id);
 const idx=caseWitnessIds(c).indexOf(id);
 if(idx<0)return previousNPC(id);
 const p=NPC[id],role=ctx.a.witnessRoles[idx]||p.role||'관계인';
 const short='<div class="compact-npc-modal"><div class="compact-npc-top">'+avatar(id)+'<div><b>'+esc(role)+'</b><p>'+esc(p.career||'관계인')+' · '+esc(p.bornYear?year()-p.bornYear+'세':'나이 미상')+'</p></div></div>'+
  '<p><b>이 사건에서의 역할:</b> '+esc(role)+'</p>'+
  '<p><b>확인할 사실:</b> '+esc(idx===0?(ctx.a.whyEvidence||c.evidence?.[0]||'사건 당시 상황'):idx===1?(ctx.a.secondEvidence||'관련 기록'):ctx.a.thirdEvidence||'원본성·시간 기록')+'</p>'+
  '<p><b>증언의 한계:</b> '+esc(ctx.f.defense||ctx.a.weakEvidence||'직접 경험 범위 확인')+'</p>'+
  '<details><summary>인물의 생애 정보 더 보기</summary><p>성격: '+esc(p.personality||'미상')+'</p><p>가족: '+esc(p.family||'미상')+'</p><p>과거 기억: '+esc((S.memories[id]||[]).slice(-2).map(x=>x.body).join(' · ')||'별도 기록 없음')+'</p></details></div>';
 modal(p.name+' · '+role,short,'<button class="btn primary full" data-action="dismiss">닫기</button>');
};
const oldClick=clicker;
clicker=function(e){const b=e.target.closest('[data-action]');if(b?.dataset.action==='editorialBrief'){
  const c=CASES.find(x=>x.id===ui.caseId),ctx=c&&info(c);if(ctx)fullBrief(c,ctx,b.dataset.side);return;
 }return oldClick(e)};
async function load(){
 try{
 const [r1,r2]=await Promise.all([
 fetch(new URL('./content-packs/court-editorial-100-v1.json',location.href),{cache:'no-cache'}),
 fetch(new URL('./content-packs/forensic-detail-33-v1.json',location.href),{cache:'no-cache'})
 ]);
 if(!r1.ok||!r2.ok)throw Error('콘텐츠 다운로드 오류');
 const a=await r1.json(),b=await r2.json();
 if(a.cases?.length!==100||Object.keys(b.cases||{}).length!==33)throw Error('100건 데이터 정합성 실패');
 editorial=new Map(a.cases.map(x=>[x.id,x]));forensic=b.cases;ready=true;render();
 }catch(e){console.warn('법정 사건 서사팩을 불러오지 못했습니다',e)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
