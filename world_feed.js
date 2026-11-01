/* THE VERDICT — the world around the courtroom.
 * 1. News: every article has its own comments, and each comment can open its replies.
 * 2. Public opinion: per case, how opinion moved session by session and what people are saying now.
 *    Comments follow what has actually happened in court (evidence shown, testimony, new evidence, the verdict).
 *    Opinion is something to watch, never a hint about the right verdict.
 * 3. Messages: people in your life write to you about your cases, and you choose how to answer (Football Manager style).
 *    Your answer changes the relationship, the press, and what they say next.
 */
'use strict';
(()=>{
const TP=window.VerdictTrialPlay,T=window.VerdictTrialCore;
if(!TP||!T)return;
const esc=x=>h(String(x??''));
const hash=s=>T.hash(String(s));
const pick=(list,seed)=>list[hash(seed)%list.length];
const shortName=c=>String(c.name||'').split(' · ')[0];
const open=new Set();

/* ---------- comments that follow the trial ---------- */
const NICK_A=['법정관찰자','동네주민','퇴근길독자','정의구현','팩트체크','조용한방청객','새벽시민','판결문러','현실주의자','오늘의독자','지나가던변호사','법알못','두아이부모','시민1','커피는아아'];
const NICK_B=['','87','_k','2027','33','99','_','7','01','J'];
function nick(seed){const a=pick(NICK_A,seed+'a'),b=pick(NICK_B,seed+'b');return a+b}
/* What the public knows: evidence shown in court, testimony heard, new evidence, the verdict. Nothing hidden. */
function facts(c,t){
 const cur=TP.curOf(c),n=TP.tell;
 const shown=(t?.evidence||[]).filter(e=>e.decision==='use'||e.decision==='conditional');
 const out=(t?.evidence||[]).filter(e=>e.decision==='exclude'&&e.flawType==='illegal');
 const late=(t?.evidence||[]).find(e=>e.late);
 const flipped=(t?.witnesses||[]).findIndex(w=>w.flipped);
 return {A:NPC[c.who?.[0]]?.name||'피고인',B:NPC[c.who?.[1]]?.name||'피해자',ev:shown[0]?.title||cur?.evidence?.[0]&&n(c,t,cur.evidence[0].title)||'핵심 증거',
  ev2:shown[1]?.title||'',illegal:out[0]?.title||'',late:late?.title||'',flip:flipped>=0?NPC[t.witnesses[flipped].id]?.name:'',
  verdict:t?.final?.label||'',sentence:t?.final?.sentence||'',crim:c.kind==='criminal'};
}
const POOL={
 pro:[f=>`${f.ev} 보니까 거의 확실한 것 같은데요`,f=>`${f.B} 쪽 이야기는 처음부터 일관됐어요`,f=>`이 정도면 책임을 묻는 게 맞다고 봅니다`,f=>`${f.A} 쪽 해명이 갈수록 궁색해지네요`,f=>`피해자 입장에서 생각하면 가볍게 끝내면 안 됩니다`],
 con:[f=>`${f.ev} 하나로 단정하기엔 이르지 않나요`,f=>`증거 수집 절차가 엉망이면 다 소용없죠`,f=>`아직 아무것도 확정된 거 없습니다. 무죄 추정이에요`,f=>`${f.A} 쪽 사정도 들어 봐야죠`,f=>`언론이 너무 한쪽으로 몰아가는 느낌`],
 mid:[f=>`판결문 나오기 전까지는 판단 보류합니다`,f=>`재판은 여론으로 하는 게 아니죠`,f=>`양쪽 말이 다 일리가 있어서 어렵네요`,f=>`기자님들 사실만 써 주세요`,f=>`다음 기일 기사 기다립니다`],
 late:[f=>`${f.late} 나오고 나서 생각이 좀 바뀌었어요`,f=>`막판에 ${f.late}? 타이밍이 묘하네요`],
 flip:[f=>`${f.flip} 증인 말이 바뀐 게 제일 큰 변수 같아요`,f=>`증인이 말을 바꾸면 뭘 믿어야 하나요`],
 illegal:[f=>`${f.illegal} 뺀 건 잘했다고 봅니다. 절차는 지켜야죠`,f=>`불법으로 얻은 증거라도 진실이면 써야 하는 거 아닌가`],
 after:[f=>`${f.verdict}${f.sentence?`, ${f.sentence}`:''}… 판결문 이유를 읽어 보니 이해는 갑니다`,f=>`${f.verdict}라니 솔직히 예상 못 했어요`,f=>`${f.sentence||f.verdict}이 적당한지는 모르겠네요`,f=>`결과보다 판결 이유가 궁금했는데 꽤 자세하네요`]
};
const REPLY={pro:[`그건 결과론 아닌가요`,`증거가 그거 하나뿐이에요?`,`저도 같은 생각입니다`],con:[`그럼 피해자는요?`,`절차 얘기만 하면 끝이 없죠`,`맞아요, 아직 모르는 게 많아요`],mid:[`이게 제일 맞는 말`,`판단 보류도 하나의 의견이죠`,`그래도 여론은 이미 기울었어요`]};
function stanceMix(t){const O=t?.media?.O??0,pro=Math.max(5,Math.min(85,Math.round(45+O*0.45))),con=Math.max(5,Math.min(80,Math.round(35-O*0.35)));return {pro,con,mid:Math.max(5,100-pro-con)}}
function thread(c,key,count){
 const st=S.cases[c.id],t=st?.trial4,f=facts(c,t),mix=stanceMix(t),stage=t?.final?'v':String(t?.daysDone||0);
 const out=[];
 for(let i=0;i<count;i++){
  const s=`${c.id}:${key}:${stage}:${i}`,r=hash(s)%100;
  let pool=r<mix.pro?'pro':r<mix.pro+mix.con?'con':'mid';
  if(t?.final&&i<2)pool='after';else if(f.late&&i===1)pool='late';else if(f.flip&&i===2)pool='flip';else if(f.illegal&&i===3)pool='illegal';
  const text=pick(POOL[pool],s+'t')(f);
  const base=pool==='after'||pool==='late'||pool==='flip'||pool==='illegal'?'mid':pool;
  const replies=Array.from({length:hash(s+'n')%4},(_,k)=>({nick:nick(s+'r'+k),text:pick(REPLY[k%2?base:base==='pro'?'con':base==='con'?'pro':'mid'],s+'rt'+k),likes:hash(s+'rl'+k)%40}));
  out.push({id:s,nick:nick(s),text,likes:hash(s+'l')%300+(pool==='after'?120:0),stance:pool,replies});
 }
 return out.sort((a,b)=>b.likes-a.likes);
}
function threadView(list){
 return list.map(x=>`<div class="wf-comment ${x.stance}"><b>${esc(x.nick)}</b><p>${esc(x.text)}</p><small>공감 ${x.likes}${x.replies.length?` · <button class="wf-link" data-action="wfopen" data-id="${esc(x.id)}">${open.has(x.id)?'답글 접기':`답글 ${x.replies.length}개 보기`}</button>`:''}</small>
 ${open.has(x.id)?`<div class="wf-replies">${x.replies.map(r=>`<p>↳ <b>${esc(r.nick)}</b> ${esc(r.text)} <small>공감 ${r.likes}</small></p>`).join('')}</div>`:''}</div>`).join('');
}

/* ---------- news with comments ---------- */
function newsFeed(limit=40){
 const list=(window.VerdictMedia?.articles()||[]).slice(0,limit);
 if(!list.length)return '<p class="muted">진행 중 사건의 보도가 여기에 쌓입니다.</p>';
 return '<div class="tv-news-list">'+list.map(a=>{
  const c=CASES.find(x=>x.id===a.caseId),key='art'+a.index,id=a.caseId+':'+key,n=3+hash(id)%3;
  return `<article class="tv-media-card"><div class="tv-media-head"><b>${esc(a.outlet)}</b><span>${esc(a.frame)}</span></div><strong>${esc(a.title)}</strong><p>${esc(a.body)}</p>
  <button class="wf-link" data-action="wfopen" data-id="${esc(id)}">💬 ${open.has(id)?'댓글 접기':`댓글 ${n}개`}</button>${open.has(id)&&c?`<div class="wf-thread">${threadView(thread(c,key,n))}</div>`:''}</article>`;
 }).join('')+'</div>';
}
/* ---------- public opinion, case by case ---------- */
function opinionFeed(){
 const cs=[...openCases(),...completed().slice(-6)].filter(c=>S.cases[c.id]?.trial4).slice(0,8);
 if(!cs.length)return '<p class="muted">재판이 시작된 사건의 여론이 여기에 모입니다.</p>';
 return cs.map(c=>{
  const t=S.cases[c.id].trial4,mix=stanceMix(t),f=t.final,log=t.mediaLog||[];
  const labels=f?['판결 지지','판결 반대','판단 보류']:[c.kind==='criminal'?'처벌 요구':'원고 지지',c.kind==='criminal'?'피고인 동정':'피고 지지','판단 보류'];
  const agree=f?T.opinionMatch(t.media.O,f.dir):null;
  const dist=f?{a:Math.round(agree*0.8),b:Math.round((100-agree)*0.8),m:0}:{a:mix.pro,b:mix.con,m:mix.mid};if(f)dist.m=100-dist.a-dist.b;
  const steps=log.map(l=>`<li>${esc(TP.session(c,l.s))} 뒤 · ${labels[0]} ${Math.max(5,Math.min(85,Math.round(45+l.O*0.45)))}%${l.ev?` · <b>${esc(l.ev)}</b>`:''}</li>`).join('');
  return `<section class="wf-case"><h4>${esc(shortName(c))} ${f?'· 선고 후':'· 재판 중'}</h4>
  <div class="wf-bar"><span class="a" style="width:${dist.a}%">${labels[0]} ${dist.a}%</span><span class="b" style="width:${dist.b}%">${labels[1]} ${dist.b}%</span><span class="m" style="width:${dist.m}%">${dist.m>=12?`${labels[2]} ${dist.m}%`:''}</span></div>
  ${steps?`<details class="wf-steps"><summary>기일마다 여론 변화</summary><ul>${steps}</ul></details>`:''}
  <div class="wf-thread">${threadView(thread(c,'plaza',5))}</div></section>`;
 }).join('')+'<p class="muted small">여론은 사회의 반응일 뿐, 판결의 정답이 아닙니다.</p>';
}

/* ---------- messages you can answer ---------- */
const TPL={
 press:{from:'hyun',text:c=>`이번 ${shortName(c)} 때문에 언론에서 계속 연락이 오는데, 어떻게 할 생각이야?`,
  choices:[['silent','일절 대응하지 않는다','그래, 판결문으로 말하는 게 맞지. 다만 기자들이 더 캐고 들 수도 있어.',{rel:2,press:-3}],
   ['official','공식 입장만 전달한다','공보판사 통해서 짧게 내는 게 깔끔하겠다. 내가 담당자 연결해 줄게.',{rel:1,press:3,news:c=>[`재판부, 공보판사 통해 "${shortName(c)} 판결 이유는 판결문에 담았다"`,'재판부는 개별 인터뷰 없이 판결문 공개로 입장을 대신했다.']}],
   ['wait','상황을 더 지켜본다','너무 오래 끌면 말이 더 커질 수 있어. 필요하면 언제든 연락해.',{rel:0,press:-1,heat:5}]]},
 late:{from:'senior',text:c=>`${shortName(c)}에 막판 증거가 들어왔다며? 상대방한테 반박할 시간은 충분히 줬어?`,
  choices:[['time','반박 기회를 충분히 주겠다','좋아. 늦게 나온 증거일수록 양쪽 말을 다 들어야 탈이 없어.',{rel:3}],
   ['enough','지금으로 충분하다','네가 판단했다면 됐다. 판결문에 그 이유만 분명히 남겨.',{rel:0}],
   ['thanks','조언 고맙습니다, 더 생각해 보겠습니다','그래, 혼자 끙끙대지 말고.',{rel:2}]]},
 review:{from:'senior',text:c=>`${shortName(c)} 리뷰 봤다. 너무 신경 쓰지 마. 다음엔 뭘 다르게 해 볼 생각이야?`,
  choices:[['proc','증거 절차를 더 꼼꼼히 보겠습니다','그게 제일 중요하지. 절차가 무너지면 결론도 같이 무너져.',{rel:3}],
   ['crowd','여론은 신경 쓰지 않겠습니다','그래야지. 대신 판결 이유는 누구나 읽을 수 있게 써.',{rel:1}],
   ['unfair','솔직히 억울합니다','그럴 수 있어. 리뷰가 늘 맞는 것도 아니고. 술 한잔하자.',{rel:4}]]}
};
function threads(){S.threads??=[];return S.threads}
function addThread(kind,c){
 const tp=TPL[kind];if(!tp||!NPC[tp.from])return;
 threads().unshift({id:kind+':'+c.id,kind,caseId:c.id,from:tp.from,week:S.week,at:Date.now(),lines:[{me:false,text:tp.text(c)}],picked:null});
 threads().splice(40);
 if(typeof toast==='function')toast(`💬 ${NPC[tp.from].name}에게서 문자가 왔어요`);
}
function scan(){
 if(!S?.name)return false;let added=false;
 for(const c of CASES){const t=S.cases[c.id]?.trial4;if(!t)continue;
  const has=k=>threads().some(x=>x.id===k+':'+c.id);
  if(t.final&&!has('press')&&(t.final.media?.H??0)>=50){addThread('press',c);added=true}
  if(t.lateDone&&!t.final&&!has('late')){addThread('late',c);added=true}
  if(t.final?.reviewShown&&t.final.review<60&&!has('review')){addThread('review',c);added=true}
 }
 if(added)save();return added;
}
function answer(id,choiceId){
 const th=threads().find(x=>x.id===id);if(!th||th.picked)return;
 const tp=TPL[th.kind],ch=tp?.choices.find(x=>x[0]===choiceId);if(!ch)return;
 const c=CASES.find(x=>x.id===th.caseId),eff=ch[3]||{};
 th.picked=choiceId;th.lines.push({me:true,text:ch[1]},{me:false,text:ch[2]});
 S.relations[th.from]=Math.max(0,Math.min(100,(S.relations[th.from]??30)+(eff.rel||0)));
 if(eff.press&&S.press4?.reporters)for(const r of Object.values(S.press4.reporters))r.mood=Math.max(0,Math.min(100,(r.mood??50)+eff.press));
 const t=c&&S.cases[c.id]?.trial4;if(eff.heat&&t)t.media.H=Math.min(100,t.media.H+eff.heat);
 if(eff.news&&c){const [title,body]=eff.news(c);news(title,body,'법조일보')}
 if(typeof remember==='function')remember(th.from,'문자',`${c?shortName(c):'사건'}에 대해 "${ch[1]}"라고 답함`,c?.id||null);
 save();render();
}
function messagesView(){
 const list=threads(),old=S.msgs||[];
 const box=list.map(th=>{const p=NPC[th.from],tp=TPL[th.kind];
  return `<article class="wf-msg ${th.picked?'':'new'}"><div class="row">${avatar(th.from)}<div><b>${esc(p?.name||'알림')}</b><div class="xs muted">${esc(p?.role||'')}</div></div></div>
  ${th.lines.map(l=>`<p class="wf-bubble ${l.me?'me':''}">${esc(l.text)}</p>`).join('')}
  ${th.picked?'':`<div class="wf-choices">${tp.choices.map(([k,l])=>`<button class="btn outline mini" data-action="wfreply" data-id="${esc(th.id)}" data-choice="${k}">${esc(l)}</button>`).join('')}</div>`}</article>`}).join('');
 return `<h2>💬 문자</h2><p class="muted small">답장에 따라 관계와 언론 반응, 다음 대화가 달라져요.</p>${box||'<p class="muted">아직 답장할 문자가 없어요.</p>'}
 ${old.length?`<details class="mt"><summary>알림 ${old.length}건</summary>${old.slice(0,30).map(m=>`<div class="feed"><b>${esc(NPC[m.from]?.name||'알림')}</b><p>${esc(m.body)}</p></div>`).join('')}</details>`:''}`;
}

/* ---------- hooks ---------- */
if(window.VerdictMedia){window.VerdictMedia.newsFeed=newsFeed;window.VerdictMedia.socialFeed=()=>opinionFeed()}
const priorTablet=tabletInner;
tabletInner=function(){
 if(ui.tabletTab==='messages')return messagesView();
 if(ui.tabletTab==='social')return '<h2>＃ 여론</h2><p class="muted small">사건마다 여론이 어떻게 움직였는지, 지금 사람들이 무슨 말을 하는지 봅니다.</p>'+opinionFeed();
 if(ui.tabletTab==='news')return '<h2>📰 기사</h2><p class="muted small">사건별 보도와 독자 댓글입니다.</p>'+newsFeed(60);
 return priorTablet();
};
const priorHome=home;
home=function(){
 const waiting=threads().filter(x=>!x.picked).length;
 return (waiting?`<button class="wf-home" data-action="tablet" data-sub="messages">💬 답장을 기다리는 문자 ${waiting}건</button>`:'')+priorHome();
};
const priorClick=clicker;
clicker=function(e){
 const el=e.target.closest('[data-action]'),a=el?.dataset.action;
 if(a==='wfopen'){e.preventDefault();const id=el.dataset.id;open.has(id)?open.delete(id):open.add(id);render();return}
 if(a==='wfreply'){e.preventDefault();answer(el.dataset.id,el.dataset.choice);return}
 return priorClick(e);
};
setInterval(()=>{if(scan()&&!ui.modal&&(ui.tab==='home'||ui.tab==='tablet'))render()},30000);
setTimeout(()=>{if(scan()&&!ui.modal)render()},2500);
window.VerdictWorld={scan,thread,opinionFeed,newsFeed,answer};
})();
