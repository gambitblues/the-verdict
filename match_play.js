/* THE VERDICT — world sheets in the game (v8.1).
 * Cases written as world sheets (world_sheets.js) are tried with the SAME courtroom as every other case: trial_play.js
 * and its six pages (사건 · 기일 · 증거 · 증인 · 주문 · 판결). This module is the bridge: toCurated() turns a sheet into
 * the written-case shape trial_play.js already reads — first-day records become the evidence cards, the other records
 * become the judge's orders (with each world's text), the sheet's people become the witnesses (their answers follow the
 * locked truth: did · didnt · reason), the accused's own account becomes the party questions. Sheets that are not one of
 * the 60 written cases are added to VerdictCurated.cases and to the offer pool; written cases keep their own text.
 * The sheet's fixed timeline is shown on the case page as 다툼 없는 사실 (factsOf).
 * The match-engine screen below (t.match) was the v8.0 experiment; new trials no longer use it. A trial saved in
 * v8.0 with t.match and no verdict is restarted in the normal courtroom (reset); finished ones keep their record. */
'use strict';
(()=>{
const M=window.VerdictMatch,SH=window.VerdictSheets;
if(!M||!SH)return;
let I=null;                                     // trial_play.js internals (bind)
const T=()=>window.VerdictTrialCore;
const esc=x=>h(String(x??''));
const sheetById=id=>SH.cases[id]||null;
const archOf=c=>c?.contentPack?.archetypeId||c?.story?.packOrigin?.id;
/* scripted-trial regression tests switch the sheet cases off for themselves (localStorage verdict_match_off=1) */
const off=(()=>{try{return localStorage.getItem('verdict_match_off')==='1'}catch{return false}})();
const sheetOf=c=>off?null:sheetById(archOf(c));
const curated=c=>!!window.VerdictCurated?.cases[archOf(c)];
const crim=s=>s.card.kind==='criminal';
const person=(s,k)=>s.people.find(p=>p.key===k);
const isToken=n=>/^\{[A-Z]\d?\}$/.test(String(n||''));
const TR=['did','didnt','reason'];

/* ---------- sheet → written-case shape (what trial_play.js reads) ---------- */
const plainLegal=x=>{const parts=String(x).split(/(?<=\.)\s+| — /).filter(p=>!/쟁점|징계 사안/.test(p));return parts.join(' — ').replace(/[.。]$/,'')};
const per=f=>{const v=Object.fromEntries(TR.map(t=>[t,f(t)]));return v.did===v.didnt&&v.did===v.reason?v.did:v};
const said=x=>M.speak(x);
const halfOf=(arr,first)=>{const k=Math.ceil(arr.length/2);return (first?arr.slice(0,k):arr.slice(k).length?arr.slice(k):arr).join(' ')};
const sideOfBy=by=>/검찰|원고|신청/.test(by||'')?'p':'d';
const FLAW=[[/영장|무단|몰래|동의 없이|임의제출 범위|규정 없이|알리지 않고/,'illegal'],[/사본|요약|복원|잘라|편집|캡처/,'source']];
function toCurated(s){
 const cr=crim(s),dec=!!s.card.decision,ac=s.card.accused,W=s.people.filter(p=>/^W\d+$/.test(p.key));
 const issues=dec?[{id:'i1',title:'신청한 사정이 사실인가',open:'어느 쪽 말이 기록과 맞는지 아직 정해지지 않았습니다.'},{id:'i2',title:'어떤 결정이 더 나은가',open:'같은 사실이라도 무엇을 더 무겁게 볼지 다툼이 있습니다.'}]
  :cr?[{id:'i1',title:'그 일이 실제로 있었나',open:'누구의 말과 어떤 기록이 사실에 맞는지 아직 정해지지 않았습니다.'},{id:'i2',title:'고의와 책임은 어디까지인가',open:'같은 행동이라도 고의·과실·인과의 범위가 다툼입니다.'}]
  :[{id:'i1',title:'청구한 사실이 있었나',open:'누구의 말과 어떤 기록이 사실에 맞는지 아직 정해지지 않았습니다.'},{id:'i2',title:'책임과 손해는 어디까지인가',open:'같은 사실이라도 책임의 범위와 손해액이 다툼입니다.'}];
 const devOf=r=>s.devices?.find(d=>d.id===r.device);
 const flawOf=r=>devOf(r)?.clockOffsetSec?'timing':(FLAW.find(([re])=>re.test(r.how||''))||[0,'none'])[1];
 const trapFor=r=>(s.traps||[]).find(x=>x.includes(r.title)||x.includes(r.title.split(' ')[0]));
 const content=r=>per(t=>s.worlds[t].records[r.id]);
 const lean=r=>per(t=>{const v=s.worlds[t].records[r.id];return v===s.worlds.did.records[r.id]&&v!==s.worlds.didnt.records[r.id]?'p':v===s.worlds.didnt.records[r.id]&&v!==s.worlds.did.records[r.id]?'d':'n'});
 const firsts=s.records.filter(r=>r.first),rest=s.records.filter(r=>!r.first);
 while(firsts.length<3&&rest.length)firsts.push(rest.shift());
 const ev=firsts.slice(0,3),more=[...firsts.slice(3),...rest];
 const evidence=ev.map((r,i)=>({title:r.title,kind:r.kind,by:r.by,when:'',excerpt:content(r),
  shows:`${r.kind} — 법정에 처음 나온 자료`,caveat:devOf(r)?.note||trapFor(r)||'이 자료 하나만으로는 단정하기 어렵다',how:r.how,flaw:flawOf(r),
  issue:i===0?'i1':i===1?'i1':'i2',side:sideOfBy(r.by),check:'증인의 말과 시각·내용이 맞는지 맞춰 보세요.'}));
 const witnesses=W.map(p=>{
  const lines=t=>said(s.worlds[t].saw[p.key]);
  const stake=p.stake&&!/^없음/.test(p.stake)?said(p.stake)[0]:'사건 사람들과 따로 아는 사이는 아닙니다.';
  const opening=per(t=>lines(t)[0]);
  return {role:p.role,story:p.job&&p.job!==p.role?p.job:'',stake:p.stake||'',says:typeof opening==='string'?opening:'제가 직접 본 것만 말씀드리겠습니다.',
   q:[{id:'q1',q:'그날 직접 보고 들은 것을 말해 주세요.',issue:'i1',a:per(t=>halfOf(lines(t),true))},
      {id:'q2',q:'시각과 순서를 자세히 말해 주세요.',issue:'i1',a:per(t=>halfOf(lines(t),false))},
      {id:'q3',q:'사건 사람들과는 어떤 사이입니까?',issue:'i2',side:'n',a:`${p.role}입니다. ${stake}`}]};
 });
 for(const w of witnesses)for(const q of w.q)if(typeof q.a==='string'&&!q.side)q.side='n';
 const followUps=more.map((r,k)=>{const sd=sideOfBy(r.by),who=cr?(sd==='p'?'검찰':'변호인'):(sd==='p'?'원고 측':'피고 측');
  return {id:'s'+(k+1),issue:k%2?'i2':'i1',type:'records',to:sd,day:1,ask:`${who}은 다음 기일까지 「${r.title}」을(를) 내 주세요.`.replace(/「([^」]+)」을\(를\)/,(m,x)=>`「${x}」${/[가-힣]/.test(x.slice(-1))&&(x.slice(-1).charCodeAt(0)-0xAC00)%28?'을':'를'}`),
   evidence:{title:r.title,kind:r.kind,by:r.by,when:'',excerpt:content(r),shows:`${r.kind} — 주문으로 받은 자료`,side:lean(r),caveat:devOf(r)?.note||trapFor(r)||'다른 기록과 함께 봐야 한다',how:r.how,check:'앞서 나온 자료·증언과 맞춰 보세요.',flaw:flawOf(r)},
   rebut:sd==='p'?'이 자료 하나로 모든 것을 단정할 수는 없습니다.':'이 자료는 사건의 일부만 보여 줍니다.'}});
 const A=person(s,ac),kn=t=>s.worlds[t].knows?.[ac];
 const partyQ=A&&kn('didnt')&&kn('didnt')!=='—'?{who:ac,role:cr?'피고인':(ac==='A'?'원고':'피고'),q:[
  {id:'p1',issue:'i1',q:'그날 무슨 일이 있었는지 직접 말해 주세요.',a:{did:'… '+said(kn('didnt'))[0],didnt:said(kn('didnt')).join(' '),reason:said(kn('reason')||kn('didnt')).join(' ')},side:{did:'d',didnt:'d',reason:'m'}},
  {id:'p2',issue:'i2',q:'지금 와서 덧붙이고 싶은 말이 있습니까?',a:{did:'… 그 부분은 변호인과 상의한 뒤 말씀드리겠습니다.',didnt:'제가 한 일은 방금 말씀드린 것이 전부입니다.',reason:said(kn('reason')||'').slice(-1)[0]||'더 드릴 말씀은 없습니다.'},side:{did:'p',didnt:'d',reason:'m'}}]}:null;
 const tl=(s.common.timeline||[]).slice(0,4);
 const cur={id:s.id,fromSheet:true,logline:s.card.title,summary:s.card.summary,
  people:{A:person(s,'A')?.state||person(s,'A')?.job||'',B:person(s,'B')?.state||person(s,'B')?.job||''},
  claims:[plainLegal(s.worlds.did.legal)+'.',plainLegal(s.worlds.didnt.legal)+'.'],
  acts:tl.map((e,i)=>({title:['발단','전개','위기','절정'][i],text:e.what})),
  evidence,witnesses,issues,followUps,
  truth:Object.fromEntries(TR.map(t=>[t,'당시 사건의 실제 사정이 확인됐다 — '+plainLegal(s.worlds[t].legal)])),
  profile:Object.fromEntries(['A','B'].map(k=>{const p=person(s,k);return [k,p&&isToken(p.name)?{job:String(p.job||'').replace(/\s*\(.*\)$/,''),age:p.age?[p.age-3,p.age+3]:[30,55]}:undefined]}).filter(([,v])=>v)),
  facts:{timeline:s.common.timeline||[],facts:s.common.facts||[]}};
 if(partyQ)cur.party=partyQ;
 const sx={};for(const k of ['A','B'])if(person(s,k)?.sex)sx[k]=person(s,k).sex;if(Object.keys(sx).length)cur.sex=sx;
 if(cr)cur.charge={life:false,fine:0,...s.card.charge};else if(!dec)cur.claim=s.card.claim;
 return cur;
}
/* register the sheet-only cases next to the 60 written ones */
if(!off&&window.VerdictCurated){const VC=window.VerdictCurated;for(const [id,s] of Object.entries(SH.cases))if(!VC.cases[id]){VC.cases[id]=toCurated(s);VC.ids.push(id)}}
/* 다툼 없는 사실: the sheet's fixed timeline for the case page (written cases with a sheet get it too) */
function factsOf(c){const s=sheetOf(c);if(!s)return null;return {timeline:s.common.timeline||[],facts:s.common.facts||[]}}
/* a v8.0 trial that ran on the match screen and has no verdict yet restarts in the normal courtroom */
function reset(st){if(st?.trial4?.match&&!st.verdict){delete st.trial4;return true}return false}

/* ---------- offer pool: sheets that are not one of the 60 curated cases join as a case pack ---------- */
if(!off&&typeof CasePackEngine!=='undefined'&&SH.pack?.archetypes?.length){
 const P=SH.pack,prev=CasePackEngine.pool;
 const ensurePack=save=>{if(!save)return;const cur=(save.casePacks||[]).find(p=>p.packId===P.packId);if(cur&&cur.version===P.version)return;
  if(cur)cur.version='0.0.0';CasePackEngine.install(save,P)};
 CasePackEngine.pool=save=>{ensurePack(save);const all=prev(save),ids=new Set(all.map(x=>x.a.id));
  const extra=(save?.casePacks||[]).filter(p=>p.packId===P.packId&&p.enabled!==false).flatMap(pack=>(pack.archetypes||[]).map(a=>({pack,a})));
  return all.concat(extra.filter(x=>!ids.has(x.a.id)&&SH.cases[x.a.id]))};
}
/* one-line teaser for the offer card (names are not known yet: role words) */
function logline(id){const s=sheetById(id);if(!s)return '';const role={A:crim(s)?'피고인':'원고',B:crim(s)?'피해자':'피고'};
 return window.VerdictCurated?VerdictCurated.fill(s.card.summary.split(/(?<=[.다])\s/)[0],role):s.card.summary}

/* ---------- people: parties fit the sheet, witnesses are made from the sheet ---------- */
function fixParties(c){
 const s=sheetOf(c);if(!s||!I||c.sheetFixed||!c.who)return;c.sheetFixed=true;
 c.name=String(c.name||'').replace(/ · [^·()]+ (\(\d{4}\.\d{1,2}\.\d{1,2}\))$/,' $1');   // the sheet has its own place
 if(curated(c))return;                         // curated cases already follow their own sex/profile tables
 ['A','B'].forEach((k,n)=>{const p=person(s,k),id=c.who[n];if(!p||!NPC[id]||!isToken(p.name))return;
  if(p.sex)I.setSex(c,id,p.sex);
  if(p.age)I.setAge(c,id,p.age-3,p.age+3);
  if(p.job)I.setJob(NPC[id],p.job.replace(/\s*\(.*\)$/,''))});
}
function witnesses(c){
 return null;   // v8.1: witnesses come from the written-case shape (toCurated) like every other case
 const s=sheetOf(c);if(!s)return null;
 return s.people.filter(p=>/^W\d+$/.test(p.key)).map(p=>{
  const id=freshNPC(p.role,S.caseSerial||1,c.story?.deep?.key||c.contentPack?.category||'contract');const n=NPC[id];
  n.role=p.role;n.caseWitnessRole=p.role;
  if(p.sex)I.setSex(c,id,p.sex);
  if(p.age)I.setAge(c,id,p.age-2,p.age+2);
  if(p.job)I.setJob(n,p.job.replace(/\s*\(.*\)$/,''));
  remember(id,'관련 사건',c.name+'의 증인으로 출석 ('+p.role+')',c.id);
  return {id,role:p.role,knowledge:'',interest:p.stake||'',story:''};
 });
}
/* lock the world for a new trial: the truth the old roll gave (did · didnt · reason) */
function attach(c,st,t){
 return;   // v8.1: new trials always use the normal courtroom
 const s=sheetOf(c);if(!s||t.match)return;
 const truth=['did','didnt','reason'].includes(t.truth)?t.truth:'did';
 const m=M.start(s,{seed:t.seed,truth});
 const pn=NPC[c.side?.[0]]?.name,dn=NPC[c.side?.[1]]?.name;if(pn)m.law.p.name=pn;if(dn)m.law.d.name=dn;
 t.match=m;t.minDays=s.card.decision?1:2;t.cards=[];t.qLeft=0;t.matchVersion=SH.pack?.version||'1';
}
/* the sheet may be revised between releases: keep the truth, re-seal against the new text */
function sheetFor(c,t){const s=sheetOf(c);if(!s||!t?.match)return null;const lock=M.lockOf(s,t.match.truth);if(lock!==t.match.lock){t.match.lock=lock;
 for(const r of s.records)t.match.records[r.id]??={status:r.first?'in':'none',disputed:false,day:r.first?1:null};
 for(const p of s.people.filter(p=>/^W\d+$/.test(p.key)))t.match.witnesses[p.key]??={key:p.key,h:11,r:11,m:11,leans:null,stance:'honest',broken:false,said:{},cred:0}}
 return s}

/* ---------- words ---------- */
const names=(c,t)=>{const n=I.namesOf(c,t);return n};
const fill=(c,t,x)=>window.VerdictCurated?VerdictCurated.fill(x,names(c,t)):String(x||'');
const lawWord=(s,side)=>side==='p'?(crim(s)?'검사':'원고 대리인'):(crim(s)?'변호인':'피고 대리인');
const TAG={'거짓':null,'번복':'말을 바꿈','버팀':'기록과 다르지만 버팀','회피':'답을 피함','흔들림':'기억이 흔들림','관계':null,'확인':null,'주문':'주문','새 자료':'새 자료','지연':'제출 늦어짐','제출 거부':'제출 거부','시각 공방':'시각 다툼','증거 다툼':'자료 다툼','일부 인정':'일부 인정','부인':'부인','선고':null};
function line(c,t,l){const tag=TAG[l.tag];return `<div class="mp-line ${l.who==='법정'?'court':''}"><b>${esc(fill(c,t,l.who))}</b><p>${esc(fill(c,t,l.text))}</p>${tag?`<span class="t4-tag">${esc(tag)}</span>`:''}</div>`}

/* ---------- pages ---------- */
function casePage(c,st,t,s){
 const ch=s.card.charge,cl=s.card.claim,m=t.match;
 const ppl=s.people.filter(p=>p.key!=='B'||isToken(p.name)||p.name).map(p=>{
  const nm=fill(c,t,p.name),role=p.key==='A'?(crim(s)?'피고인':'원고'):p.key==='B'?(crim(s)?(p.role&&p.role!=='피해자'?p.role:'피해자'):'피고'):'증인 · '+p.role;
  const info=[p.job&&p.job!=='—'?p.job:null,p.age?p.age+'세':null].filter(Boolean).join(' · ');
  return `<div class="t4-person"><b>${esc(nm)}</b><span class="t4-tag">${esc(role)}</span>${info?`<p class="small">${esc(info)}</p>`:''}${p.key!=='A'&&p.key!=='B'&&p.stake&&!/없음/.test(p.stake)?`<p class="small muted">${esc(fill(c,t,p.stake))}</p>`:''}</div>`}).join('');
 const law=['p','d'].map(k=>`<p><b>${esc(lawWord(s,k))} ${esc(m.law[k].name)}</b> — ${esc(M.TACTICS[m.law[k].tactic].desc)}</p>`).join('');
 const facts=(s.common.timeline||[]).map(e=>`<li><b>${esc(e.at)}</b> ${esc(fill(c,t,e.what))}</li>`).join('')+(s.common.facts||[]).map(f=>`<li>${esc(fill(c,t,f))}</li>`).join('');
 const open=!st.verdict&&(I.waiting(t)?`<button class="btn primary full mt" data-action="t4tab" data-tab="day">재판으로 돌아가기 →</button>`:!I.sessionOpen(t)?`<button class="btn primary full mt" data-action="t4" data-kind="open">▶ ${esc(I.session(c,t.day))} 열기</button>${!t.daysDone?`<button class="btn outline full mt" data-action="t4" data-kind="handoff">다른 재판부로 넘기기 <small>(하루 1건)</small></button>`:''}`:`<button class="btn primary full mt" data-action="t4tab" data-tab="day">재판으로 돌아가기 →</button>`);
 return `<section class="panel t4 t4-case"><h3>무슨 사건인가?</h3><p class="t4-logline">${esc(s.card.title)}</p><p>${esc(fill(c,t,s.card.summary))}</p>
 <dl class="t4-facts">${ch?`<dt>죄명</dt><dd>${esc(ch.name)} (${esc(ch.law)})</dd>`:''}${cl?`<dt>청구</dt><dd>${esc(cl.what||cl.name||'')}</dd>`:''}<dt>판결까지</dt><dd>${s.card.decision?'심리 1회 이상':'공판 2회 이상'}</dd></dl>
 <h4>다툼 없는 사실</h4><ul class="small mp-facts">${facts}</ul>
 <h4>양쪽 법률가</h4><div class="t4-claims">${law}</div>
 <h4>사람들</h4><div class="t4-people">${ppl}</div>${open||''}</section>`;
}
const GROUP={ask:'증인에게 묻기',confront:'증인에게 자료 보여 주기',party:(s)=>crim(s)?'피고인에게 묻기':'당사자에게 묻기',order:'재판장 주문 — 다음 공판까지 자료 내기'};
function actLabel(c,t,s,a){
 const p=a.w&&person(s,a.w),nm=p?fill(c,t,p.name):'',rec=a.r&&s.records.find(r=>r.id===a.r);
 if(a.type==='ask')return a.q==='open'?`${nm} · ${p.role} — 그날 직접 보고 들은 것`:a.q==='detail'?`${nm} — 시각과 순서를 자세히`:`${nm} — 사건 사람들과 어떤 사이인지`;
 if(a.type==='confront')return `${nm}에게 「${rec.title}」`;
 if(a.type==='party')return `${fill(c,t,person(s,s.card.accused).name)}에게 직접 묻기`;
 if(a.type==='order')return `${rec.unlock||rec.title+' 제출'} (${rec.by.includes('검찰')||rec.by.includes('원고')?lawWord(s,'p'):lawWord(s,'d')})`;
 return a.label;
}
function dayPage(c,st,t,s){
 const m=t.match,open=I.sessionOpen(t)&&!I.waiting(t);
 const today=m.log.filter(l=>l.day===m.day);
 let body='';
 if(!open)body=I.waiting(t)?`<p class="muted">${esc(I.session(c,t.day))}은 ${I.minsLeft(t)}분 뒤에 열 수 있어요. 그사이 양쪽은 다음 공판을 준비합니다.</p>`:`<p class="muted">${esc(I.session(c,t.day))}을 열면 증인과 자료를 다룰 수 있어요.</p><button class="btn primary full" data-action="t4" data-kind="open">▶ ${esc(I.session(c,t.day))} 열기</button>`;
 else{
  const acts=M.available(s,m);
  const grp=Object.keys(GROUP).map(k=>{const list=acts.filter(a=>a.type===k);if(!list.length)return '';const g=typeof GROUP[k]==='function'?GROUP[k](s):GROUP[k];
   return `<details class="mp-group" ${k==='ask'?'open':''}><summary>${esc(g)} <i>${list.length}</i></summary>${list.map(a=>`<button class="t4-q mp-act" data-action="mp" data-a='${esc(JSON.stringify({type:a.type,w:a.w,q:a.q,r:a.r}))}'>${esc(actLabel(c,t,s,a))}</button>`).join('')}</details>`}).join('');
  body=m.actions<1?`<p class="muted">오늘 할 수 있는 일을 모두 했어요. 공판을 마치면 양쪽이 반박하고, 주문한 자료가 다음 공판에 들어옵니다.</p>`:grp;
 }
 return `<section class="panel t4"><div class="t4-head"><h3>${esc(I.session(c,t.day))}</h3>${open?`<span class="t4-tag">오늘 남은 일 ${m.actions}/4</span>`:''}</div>
 ${body}<h4>오늘 법정에서</h4><div class="mp-log">${today.length?today.map(l=>line(c,t,l)).join(''):'<p class="muted small">아직 오간 말이 없어요.</p>'}</div></section>`;
}
function recordsPage(c,st,t,s){
 const m=t.match,W=s.worlds[m.truth];
 const ins=s.records.filter(r=>m.records[r.id].status==='in').map(r=>`<div class="t4-act mp-rec"><small>${esc(r.kind)} · ${esc(r.by)} 제출${m.records[r.id].day>1?` · 제${m.records[r.id].day}회 공판`:''}</small><p><b>${esc(r.title)}</b>${m.records[r.id].disputed?' <span class="t4-tag">시각·출처 다툼 중</span>':''}</p><p class="mp-raw">${esc(fill(c,t,W.records[r.id]))}</p><p class="small muted">${esc(fill(c,t,r.how))}</p></div>`).join('');
 const wait=s.records.filter(r=>['ordered','declined'].includes(m.records[r.id].status)).map(r=>`<p class="small">· ${esc(r.title)} — ${m.records[r.id].status==='declined'?'제출을 거부했어요':'다음 공판까지 내라고 주문했어요'}</p>`).join('');
 return `<section class="panel t4"><h3>법정에 나온 자료</h3>${ins||'<p class="muted">아직 없어요.</p>'}${wait?`<h4>기다리는 자료</h4>${wait}`:''}<p class="muted small">더 필요한 자료는 '공판' 화면의 재판장 주문으로 부를 수 있어요.</p></section>`;
}
function logPage(c,st,t,s){
 const m=t.match,days=[...new Set(m.log.map(l=>l.day))];
 return `<section class="panel t4"><h3>📋 법정 기록</h3>${days.map(d=>`<details class="t4-more" ${d===m.day?'open':''}><summary>${esc(I.session(c,d))}</summary><div class="mp-log">${m.log.filter(l=>l.day===d).map(l=>line(c,t,l)).join('')}</div></details>`).join('')}
 ${st.verdict&&t.truthShown?truthBlock(c,t,s):''}</section>`;
}
function truthBlock(c,t,s){const d=t.match.done;if(!d)return '';const W=s.worlds[t.match.truth];
 return `<div class="t4-truth"><b>🕯 몇 년 뒤 드러난 일</b><p>${esc(fill(c,t,W.act))}</p><p class="small">${esc(d.grade.replace(/^바른 판단/,'그때 판결은 맞았어요').replace(/^오판/,'그때 판결은 실제와 달랐어요'))}</p></div>`}

/* ---------- verdict ---------- */
/* the 'reason' world either still convicts of something (part of the charge, a lesser crime) or acquits of the charge */
const reasonAcquits=s=>s.card.decision?s.worlds.reason.decide!=='yes':crim(s)&&/불성립|살해하지 않았음|고의 없음|고의가 아닌/.test(s.worlds.reason.legal)&&!/해당|일부|준강제추행\)/.test(s.worlds.reason.legal);
const choiceWord=(s,w)=>s.card.decision?(w==='did'?'받아들임 — '+s.card.decision.yes:w==='didnt'?'기각 — '+s.card.decision.no:reasonAcquits(s)?'기각하되 사정을 살핌 — '+s.card.decision.no:'받아들이되 사정을 살핌 — '+s.card.decision.yes):!crim(s)?{did:'청구 인용',didnt:'청구 기각',reason:'일부 인용'}[w]:w==='did'?'유죄 — 공소사실대로':w==='didnt'?'무죄':reasonAcquits(s)?'무죄 — 다만 다른 사정이 있음':'일부만 유죄';
const V=c=>{ui.mpv??={};return ui.mpv[c.id]??={choice:null,sent:null}};
function sentences(s,choice){
 const ch=s.card.charge;if(!crim(s)||!ch||choice==='didnt'||(choice==='reason'&&reasonAcquits(s)))return [];
 const y=n=>n>=1?`징역 ${Number.isInteger(n)?n+'년':Math.floor(n)+'년 6개월'}`:'징역 6개월';
 const lo=Math.max(ch.min||0,1),max=ch.life?Math.max(ch.max||15,20):(ch.max||5);
 const mid=Math.max(lo,Math.round(max*0.25*2)/2),hi=Math.max(mid+1,Math.round(max*0.5));
 const out=[];
 if(ch.fine&&!ch.min)out.push({id:'fine',text:`벌금 ${Math.round(ch.fine/2).toLocaleString()}만 원`,order:`피고인을 벌금 ${Math.round(ch.fine/2).toLocaleString()}만 원에 처한다.`});
 if(lo<=3){const n=Math.min(3,Math.max(1,lo)),u=n>=3?5:n>=2?3:2;out.push({id:'susp',text:`${y(n)}, 집행유예 ${u}년`,order:`피고인을 ${y(n)}에 처한다. 다만 이 판결 확정일부터 ${u}년간 형의 집행을 유예한다.`})}
 out.push({id:'mid',text:y(mid),order:`피고인을 ${y(mid)}에 처한다.`});
 out.push({id:'high',text:y(hi),order:`피고인을 ${y(hi)}에 처한다.`});
 return out;
}
function verdictPage(c,st,t,s){
 const v=V(c),ready=t.daysDone>=t.minDays,m=t.match;
 if(!ready)return `<section class="panel t4"><h3>판결</h3><p class="muted">공판을 ${t.minDays-t.daysDone}번 더 열어야 판결할 수 있어요.</p></section>`;
 const ws=['did','didnt','reason'];
 const pick=ws.map(w=>`<button class="t4-q ${v.choice===w?'on':''}" data-action="mpv" data-k="choice" data-v="${w}"><b>${esc(choiceWord(s,w))}</b><span>${esc(fill(c,t,plainLegal(s.worlds[w].legal)))}</span></button>`).join('');
 const ss=sentences(s,v.choice);if(v.sent&&!ss.some(x=>x.id===v.sent))v.sent=null;
 const seen=s.records.filter(r=>m.records[r.id].status==='in').length,broke=Object.values(m.witnesses).filter(w=>w.broken).length;
 return `<section class="panel t4 t4-verdict"><h3>판결</h3><p class="muted small">법정에 나온 자료 ${seen}건${broke?` · 말을 바꾼 증인 ${broke}명`:''}. 판결은 법정 기록으로 판단합니다.</p>
 <h4>1. 결론</h4><div class="mp-choices">${pick}</div>
 ${ss.length?`<h4>2. 형</h4><div class="mp-choices">${ss.map(x=>`<button class="t4-q ${v.sent===x.id?'on':''}" data-action="mpv" data-k="sent" data-v="${x.id}"><b>${esc(x.text)}</b></button>`).join('')}</div>`:''}
 <button class="btn primary full mt" data-action="mpgo" ${v.choice&&(!ss.length||v.sent)?'':'disabled'}>선고하기</button></section>`;
}
const BASE={'바른 판단 — 법정 기록으로 가려낼 수 있었음':86,'바른 판단 — 다만 기록만으로는 단정하기 어려웠음':70,'오판 — 기록으로는 가려내기 어려웠음':50,'오판 — 기록에 반대 근거가 있었음':28};
const FIT={did:{fine:-8,susp:-6,mid:6,high:4},reason:{fine:4,susp:6,mid:0,high:-8}};
function decide(c,st,t){
 const s=sheetFor(c,t),v=V(c);if(!s||st.verdict||!v.choice)return;
 if(t.daysDone<t.minDays){toast(`공판이 ${t.minDays-t.daysDone}번 더 필요해요.`);return}
 const ss=sentences(s,v.choice),sent=ss.find(x=>x.id===v.sent)||null;if(ss.length&&!sent){toast('형을 고르세요.');return}
 const acq=v.choice==='didnt'||(v.choice==='reason'&&reasonAcquits(s));
 const want=acq?-1:s.card.decision?1:v.choice==='reason'&&!crim(s)?0.5:1;
 const opts=c.verdicts.map(o=>({o,side:T().sideOf(T().direction(o,c.kind))}));
 const opt=(opts.find(x=>x.side===want)||opts.find(x=>(x.side>0)===(want>0))||opts[0]).o,dir=T().direction(opt,c.kind);
 const done=M.verdict(s,t.match,v.choice);
 const score=Math.max(10,Math.min(98,(BASE[done.grade]??50)+(sent?FIT[v.choice]?.[sent.id]||0:0)));
 const m=t.match,W=s.worlds[m.truth];
 const facts=s.records.filter(r=>m.records[r.id].status==='in'&&!m.records[r.id].disputed).slice(0,6).map(r=>`${r.title}: ${fill(c,t,W.records[r.id])}`);
 const changed=Object.values(m.witnesses).filter(w=>w.broken).map(w=>`${fill(c,t,person(s,w.key).name)} 증인은 법정에서 앞선 말을 바꾸었다.`);
 const disputed=s.records.filter(r=>m.records[r.id].disputed).map(r=>`${r.title} — 시각이나 출처가 다투어져 판단에서 뺐다`);
 const dec=window.VerdictCurated?.cases[archOf(c)]?.decision;
 const judgment={order:sent?.order||(dec?fill(c,t,acq?dec.noOrder:dec.yesOrder):acq?(crim(s)?'피고인은 무죄.':'원고의 청구를 기각한다.'):crim(s)?'피고인을 유죄로 인정한다.':v.choice==='reason'?'원고의 청구를 일부 받아들인다.':'원고의 청구를 받아들인다.'),
  facts:[acq?`재판부는 다음 자료를 살폈으나 ${crim(s)?'공소사실':'청구 원인'}이 증명되었다고 보지 않는다.`:'재판부는 다음 자료에 따라 사실을 인정한다.',...facts,...changed],
  excluded:disputed,issues:[{title:'재판부의 판단',text:fill(c,t,plainLegal(s.worlds[v.choice].legal))+'.'}],
  conclusion:acq?'합리적인 의심 없이 증명되지 않았다. 그러므로 주문과 같이 판결한다.':`그러므로 주문과 같이 판결한다.${sent?' 형은 법정에 나온 사정을 모두 고려해 정했다.':''}`};
 delete ui.mpv[c.id];
 I.finish(c,st,t,opt,dir,{score,items:[]},judgment,sent?.text||null);
 if(!st.verdict){t.match.done=null;t.match.log=t.match.log.filter(l=>l.tag!=='선고')}
}

/* ---------- days ---------- */
function endDay(c,st,t){
 if(I.waiting(t))return;
 I.openSession(c,st);
 const m=t.match,today=m.log.filter(l=>l.day===m.day);
 t.media=T().pressDay(t.media,t,{news:t.media.H>=60?8:0});
 (t.mediaLog??=[]).push({s:t.day,O:t.media.O,H:t.media.H,ev:''});
 t.daysDone++;
 const more=t.daysDone<t.minDays+I.EXTRA_DAYS;
 I.addLog(t,'기일',`${I.session(c,t.daysDone)} 종료 · 법정에서 오간 말 ${today.length}건`);
 if(more){t.day++;t.nextDate=(t.dates?.[t.day-1]??I.today())+14;t.nextAt=Date.now()+I.DAY_WAIT}
 st.hearingHistory??=[];st.hearingHistory.push({kind:'resumed',week:S.week,v4:true});
 ui.t4tab='day';save();
 const pend=Object.values(m.records).filter(r=>r.status==='ordered').length,can=t.daysDone>=t.minDays;
 modal(`${I.session(c,t.daysDone)} 종료`,`<div class="t4-result"><p>오늘 법정에서 <b>${today.length}번</b> 말이 오갔습니다.${pend?` 주문한 자료 <b>${pend}건</b>은 다음 공판 때 들어옵니다.`:''}</p>
  <p class="muted small">공판이 끝나면 검사와 변호인이 각자 방식대로 반박을 준비합니다. ${can?(more?'이제 판결할 수 있어요. 공판을 더 열어도 됩니다.':'이제 판결할 수 있어요.'):`판결하려면 공판이 ${t.minDays-t.daysDone}번 더 필요해요.`}</p></div>`);
 render();
}
/* when the next session opens: the lawyers' moves and the ordered records come in */
function onOpen(c,t){
 const s=sheetFor(c,t);if(!s||!t.match||t.match.done)return;
 const m=t.match;if(m.day>t.daysDone)return;
 const before=m.log.length;M.endDay(s,m);
 const fresh=m.log.slice(before).filter(l=>l.who!=='법정'||l.tag);
 if(fresh.length)setTimeout(()=>{modal(`${I.session(c,t.day)} — 공판 전에 들어온 것`,`<div class="mp-log">${fresh.map(l=>line(c,t,l)).join('')}</div>`)},30);
}

/* ---------- screen pieces trial_play.js asks for ---------- */
function tabs(c,st,t){
 const m=t.match,newRec=Object.values(m.records).filter(r=>r.status==='in'&&r.day===m.day&&m.day>1).length;
 if(st.verdict)return [['result','선고 이후'],['case','사건'],['log','기록']];
 return [['case','사건'],['day','공판',I.sessionOpen(t)&&!I.waiting(t)&&m.actions>0?m.actions:0],['evidence','자료',newRec?'🆕':0],['log','기록'],['verdict','판결',t.daysDone>=t.minDays?'!':0]];
}
function page(c,st,t,tab){
 const s=sheetFor(c,t);if(!s)return null;
 if(tab==='case')return casePage(c,st,t,s);
 if(tab==='day')return dayPage(c,st,t,s);
 if(tab==='evidence')return recordsPage(c,st,t,s);
 if(tab==='log')return logPage(c,st,t,s);
 if(tab==='verdict')return verdictPage(c,st,t,s);
 return null;
}
function dock(c,st,t){
 if(st.verdict)return '';
 const m=t.match,wait=I.waiting(t),more=t.daysDone<t.minDays+I.EXTRA_DAYS,ses=I.session(c,t.day);
 if(wait&&t.daysDone>=t.minDays)return `<div class="t4-dock"><span class="small">공판 더 열기: ${I.clock(t.nextAt)}부터</span><button class="btn primary" data-action="t4tab" data-tab="verdict">판결하러 가기</button></div>`;
 if(wait)return `<div class="t4-dock"><span>⏳ ${esc(ses)} · ${I.clock(t.nextAt)} (${I.minsLeft(t)}분 뒤)</span><button class="btn outline mini" data-action="tab" data-tab="courtList">다른 사건</button></div>`;
 if(!I.sessionOpen(t))return more||t.daysDone<t.minDays?`<div class="t4-dock"><span class="small">${esc(ses)} · ${esc(I.dlabel(I.dateOf(t)))}</span><button class="btn primary" data-action="t4" data-kind="open">▶ ${esc(ses)} 열기</button></div>`:`<div class="t4-dock"><span class="small">공판을 모두 열었어요</span><button class="btn primary" data-action="t4tab" data-tab="verdict">판결하러 가기</button></div>`;
 const main=(more||t.daysDone<t.minDays)?`<button class="btn primary" data-action="t4end">${esc(ses)} 마치기</button>`:`<button class="btn primary" data-action="t4tab" data-tab="verdict">판결하러 가기</button>`;
 return `<div class="t4-dock"><span class="small">오늘 남은 일 ${m.actions}/4</span>${t.daysDone>=t.minDays?`<button class="btn outline" data-action="t4tab" data-tab="verdict">판결</button>`:''}${main}</div>`;
}
function click(e,el,x){
 const a=el.dataset.action,{c,st}=x,t=st.trial4;if(!t?.match)return false;
 if(a==='mp'){e.preventDefault();const s=sheetFor(c,t);if(!I.sessionOpen(t)||I.waiting(t)){toast(`먼저 ${I.session(c,t.day)}을 여세요.`);return true}
  try{M.act(s,t.match,JSON.parse(el.dataset.a))}catch(err){toast(String(err.message||err));return true}
  save();render();return true}
 if(a==='mpv'){e.preventDefault();const v=V(c);v[el.dataset.k]=el.dataset.v;if(el.dataset.k==='choice')v.sent=null;render();return true}
 if(a==='mpgo'){e.preventDefault();decide(c,st,t);return true}
 return false;
}
window.VerdictMatchPlay={bind(api){I=api},toCurated,factsOf,reset,has:c=>!!sheetOf(c),sheetOf,logline,fixParties,witnesses,attach,onOpen,endDay,tabs,page,dock,click};
})();
