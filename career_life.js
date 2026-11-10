/* THE VERDICT v11 — 법관의 삶과 커리어 (2026-11-10, planner spec "Judicial Life & Career Update")
 *
 * Light layers over what the game already records; the trial engine is not touched and nothing here changes how a
 * verdict is scored. Everything is derived from real events in the save, computed when a screen opens or once per
 * game week inside a save — never on every render — and no AI is called.
 *   1. 문자: short texts from people the judge knows, at most two a game month, one person at most every 45 days,
 *      each tied to something that really happened (a verdict, an appeal result, a colleague leaving the bench, years
 *      on the bench, the spouse's public verdict). Replies are 2~3 choices; a reply nudges trust and may leave a short
 *      memory. Accepting a meal is not a meal that happened.
 *   2. 인물카드: job and workplace, the kind of tie, the last contact, up to three things worth remembering, a link to
 *      the conversation.
 *   3. 법관 성향: how this judge has worked (evidence rulings, witnesses, further hearings, grounds cited, fields),
 *      from five verdicts on; it describes choices and never rates them.
 *   4. 판결 뒤 이야기: for my verdicts, what really happened afterwards (appeal, a witness's own trial, a truth told
 *      years later, the parties' lives) — shown only where something did.
 *   5. 5년 회고: a one-page look back every five years on the bench, written from the record at that moment.
 *   6. 쟁점 태그: common legal issues of each case (identity, digital evidence, causation, intent, credibility,
 *      procedure); a new case may recall an older one with the same issue — never its outcome, never its truth.
 */
(()=>{
'use strict';
if(typeof S==='undefined'||typeof CASES==='undefined')return;
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const hashOf=v=>{let x=2166136261;for(const ch of String(v))x=Math.imul(x^ch.charCodeAt(0),16777619)>>>0;return x>>>0};
const pick=(arr,seed)=>arr[hashOf(seed)%arr.length];
const P=(w,p)=>window.VerdictCurated?.particle?window.VerdictCurated.particle(w,p):w+p;
const today=()=>window.VerdictCalendar?.today?.()??((S.week||0)*7);
const shortName=c=>String(c?.name||'').split(' · ')[0].replace(/\s*\(\d{4}[.\-]\d{1,2}[.\-]\d{1,2}\)/g,'').trim();
const given=n=>{n=String(n||'');return n.length>=3?n.slice(1):n};   // 정상봉 → 상봉
const careerYears=()=>Math.floor(today()/365);
const mine=()=>(typeof completed==='function'?completed():[]).filter(c=>S.cases[c.id]?.trial4&&!S.cases[c.id].referred);

/* ---------- 1. texts ---------- */
const SOC=()=>{S.social??={};const s=S.social;s.used??={};s.last??={};s.month??={};return s};
const MONTH_MAX=2,PERSON_GAP=45;
const spouseId=()=>{const c=S.couple;return c?(S.colleagues?.npc||{})[c.spouse]:null};
const spouseName=()=>{const id=spouseId();return id&&NPC[id]?NPC[id].name:''};
function candidates(){
 const s=SOC(),out=[],d=today(),yrs=careerYears(),sp=spouseName(),done=mine();
 const add=(key,from,text,choices,extra={})=>{if(!NPC[from]||s.used[key])return;if(d-(s.last[from]??-999)<PERSON_GAP)return;out.push({key,from,text,choices,...extra})};
 const OK=[['ok','ㅋㅋ 그럴 때가 있지.','그치? 그래도 둘이 같은 일 하니까 서로 잘 알겠다.',{rel:2}],['no','남의 집 걱정 말고 네 재판이나 잘해라.','ㅋㅋ 알겠습니다, 판사님.',{rel:0}]];
 const MEAL=[['yes','좋지. 시간 맞춰 보자.','그래, 날 잡아서 다시 연락할게.',{rel:3,memo:'식사하자는 말에 좋다고 답함 (아직 날짜는 정하지 않음)'}],['later','요즘 바빠서 다음에 보자.','알겠어. 바쁜 거 지나가면 꼭 보자.',{rel:0}]];
 // (D) years on the bench: once for each five years
 for(const n of [5,10,15,20,25,30,35,40])if(yrs>=n&&yrs<n+2)add('hyun-years-'+n,'hyun',pick([`야, 우리 판사 된 지 벌써 ${n}년이냐. 시간이 진짜 빠르다.`,`벌써 ${n}년 차네. 처음 발령받던 날이 엊그제 같은데.`],'yrs'+n),
  [['warm','그러게. 그동안 고생 많았다.','너도. 앞으로도 잘 버텨 보자.',{rel:3,memo:`판사 ${n}년 차가 된 걸 함께 돌아봄`}],['joke','아직 갈 길 멀다.','ㅋㅋ 맞다. 정년까지 아직 한참이네.',{rel:1}]]);
 if(sp){
  // (B) the spouse's public verdict — only when there is one
  const v=window.VerdictColleagues?.spouseVerdicts?.()||[],last=v[0];
  if(last)add('hyun-spouse-'+hashOf(last.title+last.at),'hyun',`${given(sp)}${P(given(sp),'이').slice(given(sp).length)} 이번에 선고한 '${last.title}' 사건 봤어? 판결 보니까 꽤 고민했겠더라.`,
   [['proud','응, 오래 고민하더라.','역시. 둘 다 대단하다, 진짜.',{rel:2}],['private','그건 본인한테 직접 물어봐.','ㅋㅋ 알았어. 판결 얘기는 판결문으로만.',{rel:1}]]);
  // (A) busy court — mentions the spouse only because they really delivered a verdict
  if(v.length&&done.length)add('hyun-busy-'+Math.floor(d/180),'hyun',`야, 요즘 재판 많지? ${given(sp)}도 선고 소식 들리던데. 둘 다 판사니까 집에서도 법정 얘기만 하는 거 아니냐? ㅋㅋ`,OK);
  // (C) the three of them
  add('hyun-meal-'+Math.floor(d/240),'hyun','우리 셋 언제 한번 밥 먹어야 하는데. 같은 일 하면서도 얼굴 보기가 쉽지 않네.',MEAL);
 }else add('hyun-meal-'+Math.floor(d/240),'hyun','언제 밥 한번 먹자. 같은 법원인데 얼굴 보기가 쉽지 않네.',MEAL);
 // an important verdict of mine (importance 4~5, in the last two game weeks)
 const big=done.filter(c=>(c.importance||3)>=4&&(S.week-(S.cases[c.id].closedWeek??-99))<=2).slice(-1)[0];
 if(big)add('big-'+big.id,'senior',`오늘 선고한 '${shortName(big)}' 건 소식 들었어. 쉽지 않은 사건이었을 텐데 고생했어.`,
  [['thanks','감사합니다, 선배님.','그래. 다음 사건도 지금처럼만 해.',{rel:2}],['ask','선배님이라면 어떻게 보셨을지 궁금해요.','판결은 맡은 판사가 하는 거지. 기록 꼼꼼히 본 게 보이더라.',{rel:3,memo:`'${shortName(big)}' 판결 뒤 선배와 이야기함`}]],{caseId:big.id});
 // a decided appeal of my case
 const ap=done.find(c=>S.cases[c.id].appeal?.status==='decided'&&!s.used['ap-'+c.id]);
 if(ap){const r=S.cases[ap.id].appeal.result||{},changed=r.npc?r.changed:r.label&&r.label!==S.cases[ap.id].trial4?.final?.label;
  add('ap-'+ap.id,'hyun',`'${shortName(ap)}' 항소심 결과 나왔더라. ${changed?'1심이랑 결론이 달라졌던데, 너무 마음 쓰지 마. 그게 항소심이 있는 이유니까.':'1심 판결 그대로 갔더라. 고생한 보람 있네.'}`,
   [['ok','그래, 고맙다.','언제든.',{rel:2}],['fine','판결은 판결로 말하는 거지 뭐.','멋있는 척은. ㅋㅋ',{rel:1}]],{caseId:ap.id})}
 // someone from my bench moved on
 const b=window.VerdictV6?.bench?.(),gone=(b?.alumni||[]).slice(-1)[0];
 if(gone&&NPC[gone.id]&&gone.now!=='정년퇴직')add('move-'+gone.id+'-'+gone.year,gone.id,`부장님, 이번 인사로 ${gone.now}${/[가-힣]$/.test(gone.now)?P(gone.now,'으로').slice(gone.now.length):'로'} 가게 됐습니다. 그동안 많이 배웠습니다.`,
  [['bless','새 자리에서도 잘할 거예요.','감사합니다. 종종 연락드리겠습니다.',{rel:4,memo:`${gone.now}${P(gone.now,'으로').slice(gone.now.length)} 옮기며 인사함`}],['short','고생 많았어요.','네, 건강하세요.',{rel:1}]]);
 // a research group, now and then
 if(done.length>=3)add('study-'+Math.floor(d/365),'senior','다음 달에 법원 안에서 형사법 연구 모임 있어. 시간 되면 와. 발표는 안 해도 돼.',
  [['go','가 보겠습니다.','그래, 자리 하나 맡아 둘게.',{rel:3,memo:'연구 모임에 가겠다고 답함 (아직 다녀오지 않음)'}],['skip','이번엔 어려울 것 같습니다.','그래, 다음 기회에.',{rel:0}]]);
 // a plain hello from the old classmate (rare)
 if(d>60)add('hyun-hi-'+Math.floor(d/150),'hyun',pick(['오늘 재판 길었다. 너는 어땠어?','점심에 법원 앞 국숫집 갔는데 너 생각나더라. 연수원 때 자주 갔잖아.','요즘 날씨 왜 이러냐. 감기 조심해라.','기록 보다가 눈이 침침하다. 너도 쉬엄쉬엄 해.'],'hi'+Math.floor(d/150)),
  [['reply','나도 오늘 하루 길었다.','ㅋㅋ 다들 똑같구나. 힘내자.',{rel:2}],['short','ㅇㅇ 너도.','오케이.',{rel:1}]]);
 return out;
}
function socialTick(){
 if(!S?.name||!window.VerdictWorld?.addSocial)return 0;
 const s=SOC(),d=today(),m=Math.floor(d/30);if(s.lastDay===d)return 0;s.lastDay=d;
 if((s.month[m]||0)>=MONTH_MAX)return 0;
 if(hashOf(S.name+':soc:'+Math.floor(d/7))%100>=40)return 0;   // about one week in three; never a flood
 const list=candidates();if(!list.length)return 0;
 const x=list[hashOf(S.name+':socpick:'+d)%list.length];
 if(!window.VerdictWorld.addSocial(x))return 0;
 s.used[x.key]=d;s.last[x.from]=d;s.month[m]=(s.month[m]||0)+1;
 for(const k of Object.keys(s.month))if(Number(k)<m-12)delete s.month[k];
 return 1;
}

/* ---------- 3. 법관 성향 (cached by the number of verdicts) ---------- */
function judgeProfile(){
 const done=mine(),n=done.length;S.judgeProfile??={};
 if(S.judgeProfile.n===n&&S.judgeProfile.v===2)return S.judgeProfile;
 let ev=0,strict=0,heard=0,orders=0,cites=0,hearings=0;const field={};
 for(const c of done){const t=S.cases[c.id].trial4||{};
  for(const e of t.evidence||[])if(e.decision){ev++;if(e.decision==='exclude'||e.decision==='conditional')strict++}
  heard+=(t.heard||[]).filter(h=>!/^(cf|face):/.test(String(h.q))).length;orders+=(t.courtOrders||[]).length;hearings+=t.daysDone||0;
  cites+=(t.final?.items||[]).filter(i=>String(i.key).startsWith('cite:')).length;
  const f=c.kind==='criminal'?'형사':c.category==='family'?'가사':'민사';field[f]=(field[f]||0)+1}
 const r=n?{ev:ev?strict/ev:0,q:heard/n,o:orders/n,c:cites/n}:null;
 const top=Object.entries(field).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
 const lines=r&&n>=5?{
  evidence:r.ev>=0.25?'신중 — 흠이 있는 자료는 빼거나 조건을 붙임':r.ev>=0.1?'보통':'폭넓게 받아들이는 편',
  trial:r.o>=1.5?'추가 심리를 자주 명함':r.o>=0.6?'필요할 때 추가 심리':'제출된 기록 중심',
  witness:r.q>=8?'증인 신문을 충분히 함':r.q>=4?'핵심만 신문':'신문을 짧게 함',
  reasons:r.c>=3?'근거를 여럿 들어 판결함':r.c>=2?'근거 중심':'핵심 근거만 듦',
  field:top}:null;
 const title=!lines?'':r.ev>=0.25&&r.c>=2?'증거와 절차에 엄격한 법관':r.o>=1.5?'사실을 끝까지 확인하는 법관':r.q>=8?'법정 진술을 꼼꼼히 듣는 법관':'기록을 균형 있게 보는 법관';
 S.judgeProfile={n,v:2,lines,title,at:today()};return S.judgeProfile;
}
function profileHtml(){
 const p=judgeProfile();
 if(!p.lines)return `<section class="tv-career-review cl-profile"><h3>판단 성향</h3><p class="muted small">판결이 5건 이상 쌓이면 어떤 법관으로 일해 왔는지 정리돼요. 지금 ${p.n}건.</p></section>`;
 const L=p.lines;
 return `<section class="tv-career-review cl-profile"><h3>법관 ${careerYears()+1}년 차 · 판단 성향</h3><p><b>${esc(p.title)}</b></p><ul class="small">
  <li>증거능력 검토: ${esc(L.evidence)}</li><li>재판 진행: ${esc(L.trial)}</li><li>증인 신문: ${esc(L.witness)}</li><li>판결 이유: ${esc(L.reasons)}</li><li>주로 맡은 분야: ${esc(L.field)}</li></ul>
  <p class="muted small">판결 ${p.n}건의 기록에서 정리했어요. 성향은 평가 점수가 아니에요.</p></section>`;
}

/* ---------- 5. 5년 회고 (a snapshot taken when the five years are reached) ---------- */
function retroTick(){
 if(!S?.name)return 0;const y=careerYears(),k=Math.floor(y/5)*5;if(k<5)return 0;S.retros??={};if(S.retros[k])return 0;
 const done=mine(),p=judgeProfile(),field={};for(const c of done){const f=c.kind==='criminal'?'형사':c.category==='family'?'가사':'민사';field[f]=(field[f]||0)+1}
 const rep=done.slice().sort((a,b)=>(b.importance||3)-(a.importance||3)||(S.cases[b.id].closedWeek||0)-(S.cases[a.id].closedWeek||0))[0];
 const people=(window.VerdictPeopleMap?.circles?.()?.court||[]).length;
 S.retros[k]={years:k,year:typeof year==='function'?year():2027+k,verdicts:done.length,fields:Object.entries(field).sort((a,b)=>b[1]-a[1]).map(([f,n])=>`${f} ${n}건`).join(' · '),
  rep:rep?shortName(rep):'',title:p.title||'',post:S.post||'판사',court:people,line:p.title?`지난 ${k}년 동안 ${done.length}건을 판결하며 ${p.title.replace(/ 법관$/,'')} 법관으로 일해 왔습니다.`:`지난 ${k}년 동안 ${done.length}건을 판결했습니다.`};
 if(typeof log==='function')log('커리어',`법관 ${k}년 차 회고`,S.retros[k].line);
 if(typeof toast==='function')toast(`🎖 법관 ${k}년 차 회고가 '나의 커리어'에 추가됐어요`);
 return 1;
}
function retroHtml(){
 const list=Object.values(S.retros||{}).sort((a,b)=>b.years-a.years);if(!list.length)return '';
 return `<section class="tv-career-review cl-retro"><h3>5년 단위 회고</h3>${list.map(r=>`<details class="cl-retro-card"${r===list[0]?' open':''}><summary><b>${esc(r.year)}년 — 법관 ${esc(r.years)}년 차</b></summary>
  <p>${esc(r.line)}</p><ul class="small"><li>판결 ${esc(r.verdicts)}건${r.fields?` · ${esc(r.fields)}`:''}</li>${r.rep?`<li>대표 사건: ${esc(r.rep)}</li>`:''}<li>직책: ${esc(r.post)}</li><li>법원 동료 ${esc(r.court)}명과 함께</li></ul></details>`).join('')}</section>`;
}

/* ---------- 4. 판결 뒤 이야기 ---------- */
function afterEvents(c){
 const st=S.cases[c.id],t=st?.trial4,name=shortName(c),out=[];if(!st?.verdict)return out;
 const dayOf=w=>typeof day==='function'?day(Math.floor(w)):'';
 if(st.closedWeek!=null)out.push({w:st.closedWeek,text:`1심 판결 — ${t?.final?.label||'선고'}${t?.final?.sentence?` (${t.final.sentence})`:''}`});
 for(const n of S.colleagues?.news||[])if(n.court&&String(n.title||'').includes(name)&&/항소|따로 받던 재판/.test(n.title))out.push({w:n.day,text:String(n.title).replace(/^\[법원 소식\]\s*/,'')});
 if(t?.truthTold){const w=(t.truthTold.day||0)/7;out.push({w,text:`${NPC[t.truthTold.id]?.name||'사건 관계인'}에게서 오래 미뤄 둔 연락이 옴`})}
 for(const [id,list] of Object.entries(S.memories||{}))for(const m of list||[])if(m.caseId===c.id&&m.type==='판결 뒤 삶'&&NPC[id])out.push({w:m.week,text:`${NPC[id].name} — ${m.body}`});
 return out.sort((a,b)=>a.w-b.w).map(x=>({...x,when:dayOf(x.w)}));
}
function afterHtml(){
 const rows=mine().map(c=>({c,ev:afterEvents(c)})).filter(x=>x.ev.length>1).sort((a,b)=>(S.cases[b.c.id].closedWeek||0)-(S.cases[a.c.id].closedWeek||0)).slice(0,8);
 if(!rows.length)return '';
 return `<details class="panel cl-after"><summary><b>판결 뒤 이야기</b> <span class="muted small">${rows.length}건</span></summary><p class="muted small">선고 뒤 실제로 있었던 일만 적어요.</p>
  ${rows.map(({c,ev})=>`<article class="cl-after-case"><b>${esc(shortName(c))}</b><ol class="small">${ev.map(x=>`<li><span class="muted">${esc(x.when)}</span> ${esc(x.text)}</li>`).join('')}</ol></article>`).join('')}</details>`;
}

/* ---------- 6. 쟁점 태그 (foundation) ---------- */
const TAGS=[['digital_evidence','영상·디지털 기록이 무엇을 보여 주는지',/CCTV|영상|블랙박스|디지털|포렌식|메시지|로그|녹음|녹화|단말/],
 ['identity','그 사람이 누구였는지 알아보는',/신원|식별|목격|지문|DNA|얼굴|누구/],
 ['causation','결과가 무엇 때문에 생겼는지',/인과|원인|사망|결과|때문/],
 ['intent','일부러 한 일이었는지',/고의|일부러|의도|미필/],
 ['procedural_fairness','증거를 얻은 절차가 적법했는지',/위법|영장|압수|절차|동의 없이/],
 ['credibility','진술을 얼마나 믿을 수 있는지',/진술|증언|기억|번복/]];
const tagCache=new Map();
function tagsOf(c){if(tagCache.has(c.id))return tagCache.get(c.id);
 const cur=window.VerdictTrialPlay?.curOf?.(c);if(!cur)return [];
 const text=[c.name,c.legal,c.tag,cur.logline,cur.summary,...(cur.issues||[]).map(i=>i.title),...(cur.evidence||[]).map(e=>e.title+' '+e.kind)].join(' ');
 const tags=TAGS.filter(([,,re])=>re.test(text)).map(([k])=>k).slice(0,3);tagCache.set(c.id,tags);return tags}
/* a case I have now may recall one I judged at least a year (game time) ago with the same issue — no outcome, no truth */
function echo(c){
 if(!c||S.cases[c.id]?.verdict)return '';const tags=tagsOf(c);if(!tags.length)return '';
 const arch=c.contentPack?.archetypeId,past=mine().filter(x=>x.contentPack?.archetypeId!==arch&&(S.week-(S.cases[x.id].closedWeek||S.week))>=52);
 for(const [k,label] of TAGS){if(!tags.includes(k))continue;const old=past.find(x=>tagsOf(x).includes(k));
  if(old)return `<p class="cl-echo small">📎 예전에 다룬 쟁점 · '${esc(shortName(old))}'(${esc(typeof day==='function'?day(S.cases[old.id].closedWeek).slice(0,4):'')})에서도 ${esc(label)}${label.endsWith('는')?' 문제':'가 문제'}였어요. 사건이 다르니 그때와 같은 결론일 필요는 없어요.</p>`}
 return '';
}

/* ---------- 2. 인물카드 ---------- */
function lastContact(id){
 const m=(S.memories?.[id]||[]).slice(-1)[0],th=(S.threads||[]).filter(x=>x.from===id).sort((a,b)=>(b.week||0)-(a.week||0))[0];
 const w=Math.max(m?.week??-1,th?.week??-1);return w>=0&&typeof day==='function'?day(w):'';
}
function cardHtml(id){
 const p=NPC[id];if(!p||id==='self')return '';
 const keep=(S.memories?.[id]||[]).filter(m=>m.type!=='문자').slice(-3).reverse();
 const hasChat=(S.threads||[]).some(x=>x.from===id)||(S.msgs||[]).some(x=>x.from===id);
 const kind=p.spouseOfPlayer?'배우자':id==='hyun'?'법원 동기':p.colleague?'같은 법원 동료':p.bond||'';
 const last=lastContact(id);
 return `<h4>🤝 인연</h4><div class="detail cl-card"><p class="small">${esc(p.career||p.role||'')}${p.legalCareer?.firmId?'':''}${kind?` · ${esc(kind)}`:''}${last?` · 마지막 교류 ${esc(last)}`:''}</p>
  ${keep.length?`<ul class="small">${keep.map(m=>`<li>${esc(typeof day==='function'?day(m.week):'')} · ${esc(m.body)}</li>`).join('')}</ul>`:''}
  ${hasChat?`<button class="btn outline mini" data-action="wfwith" data-id="${esc(id)}">💬 문자 대화 보기</button>`:''}</div>`;
}
if(typeof popupNPC==='function'){const prior=popupNPC;popupNPC=function(id){prior(id);try{const h=cardHtml(id);if(h&&window.VerdictTrialPlay?.addToModal)window.VerdictTrialPlay.addToModal(h)}catch(e){console.warn('card',e)}}}

/* ---------- career screen ---------- */
/* (the chronicle itself lives inside game_ui; the tablet router is the shared hook) — the verdict archive shows what came after */
if(typeof tabletInner==='function'){const prior=tabletInner;tabletInner=function(){const html=prior();
 try{return ui.tabletTab==='career'?profileHtml()+retroHtml()+html:ui.tabletTab==='archives'?afterHtml()+html:html}catch(e){console.warn('career life',e);return html}}}

/* ---------- once a game week, inside a save ---------- */
if(typeof save==='function'){const prior=save;save=function(...a){try{if(S?.name&&S.lifeTick!==S.week){S.lifeTick=S.week;socialTick();retroTick()}}catch(e){console.warn('career life',e)}return prior.apply(this,a)}}

const css=document.createElement('style');css.textContent=`
.cl-profile ul,.cl-retro ul,.cl-card ul{margin:6px 0 0;padding-left:18px}.cl-retro-card{margin:6px 0}.cl-retro-card summary{cursor:pointer}
.cl-after{margin-bottom:12px}.cl-after summary{cursor:pointer}.cl-after-case{margin:10px 0}.cl-after-case ol{margin:4px 0 0;padding-left:18px}
.cl-echo{background:#f4efe5;border-radius:10px;padding:8px 10px;margin:8px 0}`;
document.head.appendChild(css);
window.VerdictCareerLife={candidates,socialTick,judgeProfile,retroTick,afterEvents,tagsOf,echo,cardHtml};
})();
