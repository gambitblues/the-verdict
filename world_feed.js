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
 /* before the verdict people guess; after it they judge the judge */
 guessP:[f=>`이건 ${f.crim?'유죄':'원고 승'} 나온다에 한 표`,f=>`${f.ev} 나온 순간 끝났다고 봅니다`,f=>`${f.A} 쪽 표정 보니 본인들도 아는 듯`,f=>`${f.crim?'구형대로 갈 것 같네요':'청구 대부분 인정될 것 같아요'}`,f=>`판사가 증거만 제대로 보면 결론은 뻔해요`],
 guessD:[f=>`${f.crim?'무죄':'원고 패소'} 가능성 꽤 있다고 봅니다`,f=>`${f.ev}만으로는 부족해 보이는데요`,f=>`판사가 절차 꼼꼼히 보면 뒤집힐 수도`,f=>`여론이랑 판결은 다를 거예요. 두고 봅시다`,f=>`${f.A} 쪽 변호인이 만만치 않던데요`],
 guessM:[f=>`이번 재판부는 어떻게 볼지 정말 궁금하네요`,f=>`다음 기일에 뭐가 나오느냐가 관건`,f=>`예상이 반반으로 갈리는 사건`,f=>`판결 나오면 이유부터 읽어 볼 생각입니다`],
 praise:[f=>`판결 이유 읽어 보니 증거를 하나하나 따졌네요. 납득됩니다`,f=>`여론에 휘둘리지 않은 판결이라 봅니다`,f=>`${f.verdict}${f.sentence?`, ${f.sentence}`:''}… 적절하다고 봐요`,f=>`이번 재판장 꼼꼼하네요. 절차를 제대로 지켰어요`,f=>`처음엔 반대였는데 판결문 보고 생각이 바뀌었습니다`],
 blame:[f=>`${f.verdict}라니 판사가 뭘 본 건지 모르겠네요`,f=>`${f.sentence||f.verdict}? 이건 아니죠`,f=>`판사가 ${f.ev}를 너무 가볍게 봤어요`,f=>`이러니 법원 판결을 못 믿는 겁니다`,f=>`재판부가 한쪽 말만 들은 것 같아요`],
 after:[f=>`${f.verdict}${f.sentence?`, ${f.sentence}`:''}… 판결문 이유를 읽어 보니 이해는 갑니다`,f=>`${f.verdict}라니 솔직히 예상 못 했어요`,f=>`${f.sentence||f.verdict}이 적당한지는 모르겠네요`,f=>`결과보다 판결 이유가 궁금했는데 꽤 자세하네요`]
};
const REPLY={pro:[`그건 결과론 아닌가요`,`증거가 그거 하나뿐이에요?`,`저도 같은 생각입니다`],con:[`그럼 피해자는요?`,`절차 얘기만 하면 끝이 없죠`,`맞아요, 아직 모르는 게 많아요`],mid:[`이게 제일 맞는 말`,`판단 보류도 하나의 의견이죠`,`그래도 여론은 이미 기울었어요`]};
function stanceMix(t){const O=t?.media?.O??0,pro=Math.max(5,Math.min(85,Math.round(45+O*0.45))),con=Math.max(5,Math.min(80,Math.round(35-O*0.35)));return {pro,con,mid:Math.max(5,100-pro-con)}}
function thread(c,key,count){
 const st=S.cases[c.id],t=st?.trial4,f=facts(c,t),mix=stanceMix(t),stage=t?.final?'v':String(t?.daysDone||0);
 const agree=t?.final?T.opinionMatch(t.media.O,t.final.dir):null;
 const out=[];
 for(let i=0;i<count;i++){
  const s=`${c.id}:${key}:${stage}:${i}`,r=hash(s)%100;
  let pool;
  if(t?.final){pool=r<Math.max(15,Math.min(85,agree))*0.85?'praise':r<90?'blame':'mid';if(i===0&&agree<40)pool='blame';if(i===0&&agree>=60)pool='praise'}
  else{pool=r<mix.pro?'guessP':r<mix.pro+mix.con?'guessD':'guessM';if(f.late&&i===1)pool='late';else if(f.flip&&i===2)pool='flip';else if(f.illegal&&i===3)pool='illegal'}
  const text=pick(POOL[pool],s+'t')(f);
  const base={guessP:'pro',praise:'pro',guessD:'con',blame:'con'}[pool]||(pool==='pro'||pool==='con'?pool:'mid');
  const replies=Array.from({length:hash(s+'n')%4},(_,k)=>({nick:nick(s+'r'+k),text:pick(REPLY[k%2?base:base==='pro'?'con':base==='con'?'pro':'mid'],s+'rt'+k),likes:hash(s+'rl'+k)%40}));
  out.push({id:s,nick:nick(s),text,likes:hash(s+'l')%300+(pool==='praise'||pool==='blame'?120:0),stance:base,phase:t?.final?'after':'before',pool,replies});
 }
 return out.sort((a,b)=>b.likes-a.likes);
}
function threadView(list){
 return list.map(x=>`<div class="wf-comment ${x.stance}"><b>${esc(x.nick)}</b><p>${esc(x.text)}</p><small>공감 ${x.likes}${x.replies.length?` · <button class="wf-link" data-action="wfopen" data-id="${esc(x.id)}">${open.has(x.id)?'답글 접기':`답글 ${x.replies.length}개 보기`}</button>`:''}</small>
 ${open.has(x.id)?`<div class="wf-replies">${x.replies.map(r=>`<p>↳ <b>${esc(r.nick)}</b> ${esc(r.text)} <small>공감 ${r.likes}</small></p>`).join('')}</div>`:''}</div>`).join('');
}

/* ---------- reporters: 20 people, two articles per case, one from each side ---------- */
/* side p = writes from the prosecution or claimant's side, d = from the defence or respondent's side.
 * style decides how they build a headline and which facts they reach for first. */
const REPORTERS=[
 {name:'서은채',g:'여',outlet:'중앙사회신문',side:'p',style:'victim',bio:'피해자 지원센터 취재로 이름을 알린 사회부 12년 차',voice:'피해자의 하루가 어떻게 무너졌는지부터 쓴다'},
 {name:'이재석',g:'남',outlet:'서울법정일보',side:'p',style:'police',bio:'경찰서 출입 9년, 수사 기록을 가장 먼저 읽는 기자',voice:'수사팀이 쌓은 증거의 무게를 믿는다'},
 {name:'구태오',g:'남',outlet:'민생24',side:'p',style:'hot',bio:'조회수 1위를 놓친 적 없는 화제성 담당',voice:'방청석의 분노를 그대로 옮긴다'},
 {name:'정하린',g:'여',outlet:'한빛경제',side:'p',style:'money',bio:'소비자·노동 분쟁을 오래 쫓은 경제사회부 기자',voice:'힘이 약한 쪽의 손해가 얼마인지 묻는다'},
 {name:'오세진',g:'남',outlet:'사회안전통신',side:'p',style:'safety',bio:'산업재해와 안전사고만 8년째 쓰는 기자',voice:'같은 일이 또 일어날 수 있는지를 따진다'},
 {name:'남궁윤',g:'여',outlet:'라디오정의',side:'p',style:'voice',bio:'라디오 시사 프로그램 출신, 당사자 인터뷰를 즐겨 싣는다',voice:'당사자의 목소리를 문장 그대로 옮긴다'},
 {name:'김다온',g:'여',outlet:'청년프레스',side:'p',style:'young',bio:'2년 차 막내 기자, 같은 또래 피해자 사건에 마음이 쓰인다',voice:'청년들이 이 사건을 어떻게 보는지 묻는다'},
 {name:'류태민',g:'남',outlet:'현장타임즈',side:'p',style:'scene',bio:'사건 현장부터 가 보는 발로 뛰는 기자',voice:'현장의 모습으로 기사를 연다'},
 {name:'홍지아',g:'여',outlet:'동부종합일보',side:'p',style:'local',bio:'지역 사회를 20년째 지킨 지역 데스크',voice:'동네가 이 사건을 어떻게 겪고 있는지 쓴다'},
 {name:'황보람',g:'여',outlet:'오늘의쟁점',side:'p',style:'opinion',bio:'논설위원 출신, 단호한 문장으로 유명하다',voice:'책임을 분명히 하라고 쓴다'},
 {name:'윤도경',g:'남',outlet:'시사돋보기',side:'d',style:'probe',bio:'강압 수사 보도로 상을 받은 탐사 기자',voice:'증거를 어떻게 얻었는지부터 의심한다'},
 {name:'박서윤',g:'여',outlet:'코리아재판뉴스',side:'d',style:'rights',bio:'국선 변호인 출신으로 피고인 인권을 다뤄 온 법조 기자',voice:'"아직 증명되지 않았다"는 문장을 아끼지 않는다'},
 {name:'마지훈',g:'남',outlet:'데이터사회',side:'d',style:'data',bio:'판결문을 숫자와 구조로 읽는 데이터 기자',voice:'빈칸이 남은 증거를 하나씩 센다'},
 {name:'한민지',g:'여',outlet:'재판브리핑',side:'d',style:'court',bio:'법원 출입 10년 차, 양쪽 말을 다 들어야 쓰는 기자',voice:'여론보다 절차를 먼저 본다'},
 {name:'차은호',g:'남',outlet:'팩트노트',side:'d',style:'fact',bio:'팩트체크 전담, 기사에 출처를 다 다는 기자',voice:'확인된 것과 소문을 칸을 나눠 적는다'},
 {name:'선우진',g:'남',outlet:'산업과법',side:'d',style:'company',bio:'기업법무 담당, 계약서를 끝까지 읽는 기자',voice:'계약과 규정에 무엇이 적혀 있는지 본다'},
 {name:'제갈현',g:'남',outlet:'대한저널',side:'d',style:'history',bio:'오판 사례를 연재해 온 사법 전문기자',voice:'과거의 오판과 겹치는 지점을 찾는다'},
 {name:'민예린',g:'여',outlet:'시민포커스',side:'d',style:'family',bio:'가족과 돌봄 문제를 다루는 생활부 기자',voice:'피고인의 가족과 삶도 함께 보라고 쓴다'},
 {name:'곽도윤',g:'남',outlet:'로컬이슈',side:'d',style:'online',bio:'온라인 여론과 가짜뉴스를 추적하는 기자',voice:'인터넷의 확신이 법정의 증거보다 앞서 있지 않은지 묻는다'},
 {name:'설하준',g:'남',outlet:'오늘의법',side:'d',style:'scholar',bio:'법학 박사 출신 객원 기자',voice:'법 조문이 실제로 무엇을 요구하는지 풀어 쓴다'}
];
const STYLE_LABEL={victim:'피해자 시선',police:'수사 기록',hot:'화제성',money:'경제·생활',safety:'안전·재발 방지',voice:'당사자 인터뷰',young:'청년 시선',scene:'현장 르포',local:'지역 사회',opinion:'사설',probe:'탐사 보도',rights:'피고인 인권',data:'데이터 분석',court:'법원 출입',fact:'팩트체크',company:'기업·계약',history:'오판 연구',family:'가족·돌봄',online:'온라인 여론',scholar:'법률 해설'};
/* A reporter becomes a real person the first time the player opens their card. */
function reporterNPC(i){const r=REPORTERS[i];if(!r)return null;const id='reporter_'+i;if(NPC[id])return id;
 const tmp=freshNPC('기자',0,'media'),p=NPC[tmp];delete NPC[tmp];delete S.npcDB[tmp];S.relations[id]=S.relations[tmp];delete S.relations[tmp];S.memories[id]=S.memories[tmp]||[];delete S.memories[tmp];
 const yrs=Number((r.bio.match(/(\d+)\s*년/)||[])[1])||(/막내|2년/.test(r.bio)?2:/논설|박사/.test(r.bio)?20:10);
 Object.assign(p,{name:r.name,gender:r.g,bornYear:year()-(25+yrs+hash(r.name)%4),role:r.outlet+' 기자',career:r.outlet+' 기자',personality:r.voice,origin:r.bio,socialStatus:'언론계',bond:'내 법정을 취재하는 기자',reporter:i,jobHistory:[{year:year()-yrs,job:r.outlet+' 기자',reason:'입사'}]});
 NPC[id]=p;S.npcDB[id]=p;save();return id}
function reporterNote(i){const r=REPORTERS[i];if(!r)return '';
 const mine=articles().filter(a=>a.reporter===r);let up=0,down=0;
 for(const a of mine){const f=S.cases[a.caseId]?.trial4?.final;if(!f||!T)continue;const side=T.sideOf(f.dir);if(side===0.5||side===0)continue;((side===1)===(r.side==='p'))?up++:down++}
 const tone=up+down?`<p>내 판결 ${up+down}건을 다뤘고, 그중 ${up}건은 호의적으로 ${down}건은 비판적으로 썼다.</p>`:'<p>아직 내 판결을 평가한 기사는 없다.</p>';
 return `<h4>📰 기자 수첩</h4><div class="detail"><p><b>${esc(r.outlet)}</b> · ${esc(STYLE_LABEL[r.style]||'')} · ${r.side==='p'?'검찰·원고 쪽에서 보는 편':'변호인·피고 쪽에서 보는 편'}</p><p>${esc(r.bio)}. ${esc(r.voice)}.</p>${tone}</div>${mine.length?`<h4>쓴 기사</h4>${mine.slice(0,5).map(a=>`<p class="small">· ${esc(a.title)}</p>`).join('')}`:''}`}
function reporterPair(c){const Pr=REPORTERS.filter(r=>r.side==='p'),Dr=REPORTERS.filter(r=>r.side==='d');return [Pr[hash(c.id+'rp')%Pr.length],Dr[hash(c.id+'rd')%Dr.length]]}
const Pj=(w,p)=>window.VerdictCurated?VerdictCurated.particle(w,p):w+p;
const cop=x=>{x=String(x);const ch=x.charCodeAt(x.length-1);return x+(ch>=0xAC00&&ch<=0xD7A3&&(ch-0xAC00)%28?'이다':'다')};
const cut=(x,n=38)=>{x=String(x||'').replace(/[.。]$/,'');return x.length>n?x.slice(0,n-1)+'…':x};
/* Everything a reporter may use: only what has been said or shown in court, plus the public case summary. */
function material(c,t){
 const cur=TP.curOf(c),tell=x=>TP.tell(c,t,x||'');
 const evs=(cur?.evidence||[]).map((e,i)=>{const live=t?.evidence?.[i];return {title:tell(e.title),shows:tell(e.shows),caveat:tell(e.caveat),side:e.side,decision:live?.decision||null,illegal:live?.flawType==='illegal'}});
 const said=(t?.heard||[]).filter(h=>!h.tainted&&!h.struck).map(h=>{const q=TP.qById?TP.qById(c,t,h.w,h.q):(cur?.witnesses?.[h.w]?.q||[]).find(x=>x.id===h.q);if(!q)return null;
  let a=q.a;if(typeof a==='object'){let k=t.truth in a?t.truth:'reason';if(t.witnesses[h.w]?.flipped&&k!=='reason')k=k==='did'?'didnt':'did';a=a[k]}
  return {who:NPC[t.witnesses[h.w]?.id]?.name||'증인',role:cur.witnesses[h.w]?.role||'증인',text:tell(a),side:h.side}}).filter(Boolean);
 const issues=(cur?.issues||[]).map(i=>({title:i.title,open:tell(i.open)}));
 const late=t?.evidence?.find(e=>e.late);
 const crim=c.kind==='criminal',f=t?.final;
 const nA=NPC[c.who?.[0]]?.name||'피고인',nB=NPC[c.who?.[1]]?.name||'피해자';
 return {cur,tell,evs,said,issues,late,crim,f,A:nA,B:nB,hurt:crim?nB:nA,accused:crim?nA:nB,
  name:shortName(c),days:t?.daysDone||0,logline:tell(cur?.logline),claimP:tell(cur?.claims?.[0]),claimD:tell(cur?.claims?.[1]),
  demand:crim&&cur?.demand!=null?(typeof cur.demand==='object'?`벌금 ${cur.demand.fine}만 원`:(()=>{const mo=Math.round(cur.demand*12),y=Math.floor(mo/12),r=mo%12;return `징역 ${y?y+'년':''}${y&&r?' ':''}${r?r+'개월':''}`})()):'',claim:cur?.claim?`${cur.claim.amount.toLocaleString('ko-KR')}만 원`:''};
}
const HEAD={
 victim:(m,x)=>m.f?`${m.name}, ${Pj(m.hurt,'의')} 남은 시간은 누가 책임지나`:`"${cut(x.quote||m.logline,26)}" — ${m.name}`,
 police:(m,x)=>`${m.name}, 수사 기록 속 ${Pj(x.ev.title,'이')} 가리키는 것`,
 hot:(m,x)=>x.quote?`[법정 직캠] ${m.name}, "${cut(x.quote,24)}"`:`[이슈] ${m.name}, 방청석이 술렁인 이유`,
 money:(m,x)=>`${m.name}, 피해 ${m.claim||'규모'}… 숫자 뒤의 생활`,
 safety:(m,x)=>`${m.name}, 막을 수 있었던 일인가`,
 voice:(m,x)=>x.quote?`"${cut(x.quote,30)}" ${m.name} 증언대의 목소리`:`${m.name}, 당사자들이 말하지 못한 것`,
 young:(m,x)=>`${m.name}, 또래들은 이 재판을 이렇게 본다`,
 scene:(m,x)=>`${m.name}, 그날의 현장을 다시 걸어 보니`,
 local:(m,x)=>`${m.name} 이후, 동네는 아직 그날에 멈춰 있다`,
 opinion:(m,x)=>m.f?`[사설] ${m.name}, 판결이 남긴 숙제`:`[사설] ${m.name}, 책임을 흐리지 말라`,
 probe:(m,x)=>x.gap?`${m.name}, ${cut(x.gap,30)}`:`${m.name}, 수사는 어디서부터 어긋났나`,
 rights:(m,x)=>`${m.name}, "${cut(x.issue?.title||'아직 증명되지 않았다',24)}"에 답은 나왔나`,
 data:(m,x)=>`${m.name}, 쟁점 ${m.issues.length}개 중 법정에서 확인된 것은`,
 court:(m,x)=>m.days?`${m.name} ${m.days}차 공판, 양측이 맞선 지점`:`${m.name}, 첫 공판을 앞두고 정리한 쟁점`,
 fact:(m,x)=>`[팩트체크] ${m.name}, 확인된 것과 확인되지 않은 것`,
 company:(m,x)=>`${m.name}, 계약서와 규정이 말하는 것`,
 history:(m,x)=>`${m.name}, 과거 오판 사례와 닮은 세 가지`,
 family:(m,x)=>`${m.name}, ${Pj(m.accused,'의')} 가족도 재판을 받고 있다`,
 online:(m,x)=>`${m.name}, 인터넷은 이미 판결을 내렸다?`,
 scholar:(m,x)=>`${m.name}, 법은 무엇을 증명하라고 하나`
};
/* Before the verdict a reporter forecasts; after it they grade the bench. The two reporters of a case write from
 * opposite sides, so when the verdict goes against a reporter's side the article criticises the judge, and when it
 * goes their way it praises the reasoning. Only what was said or shown in court is used. */
function writeArticle(c,t,r){
 const m=material(c,t),mine=r.side,judge=S.name||'재판장';
 const evPick=m.evs.filter(e=>e.side===mine&&e.decision!=='exclude');const ev=evPick[hash(c.id+r.name)%Math.max(1,evPick.length)]||m.evs[hash(c.id+r.name)%Math.max(1,m.evs.length)]||{title:'핵심 증거',shows:'',caveat:''};
 const quoteFrom=m.said.filter(x=>x.side===mine||(x.side==='m'));const q=quoteFrom[hash(r.name+c.id)%Math.max(1,quoteFrom.length)];
 const issue=m.issues[hash(r.name)%Math.max(1,m.issues.length)];
 const v=hash(c.id+r.name+'v')%3;
 const crit={
  victim:`판결문 몇 줄로는 정리할 수 없는 시간이 ${m.hurt}에게 남았다.`,police:`수사팀이 쌓은 기록을 가볍게 넘겨서는 안 된다.`,hot:`재판정 밖에서는 벌써 결론을 둘러싼 말들이 오간다.`,
  money:`잃은 돈은 숫자지만, 그 돈으로 버티던 생활은 숫자가 아니다.`,safety:`같은 구조가 그대로라면 같은 일은 또 일어난다.`,voice:`당사자의 말을 한 번 더 들어야 하는 이유다.`,
  young:`이 재판을 지켜보는 또래들이 묻는 것은 결국 "나라면 어땠을까"다.`,scene:`현장의 거리와 시간은 기록보다 많은 것을 말한다.`,local:`사건은 법정에서 끝나도 동네의 기억은 오래 남는다.`,
  opinion:m.f?`판결이 내려졌다고 질문까지 끝난 것은 아니다.`:`책임의 소재를 흐리는 재판이 되어서는 안 된다.`,
  probe:`증거가 어떻게 손에 들어왔는지부터 다시 물어야 한다.`,rights:`"${issue?.title||'핵심 쟁점'}"에 대한 답이 없다면 유죄의 문은 열리지 않는다.`,
  data:`${m.issues.length}개의 쟁점 가운데 증언과 증거로 메워진 칸이 몇 개인지 세어 보면 결론이 달리 보인다.`,court:`양측의 말이 가장 크게 엇갈린 곳은 "${issue?.title||'핵심 쟁점'}"이다.`,
  fact:`확인된 사실: ${cut(ev.shows,40)}. 확인되지 않은 사실: ${cut(issue?.open||ev.caveat,40)}.`,company:`계약서와 내부 규정에 적힌 문장이 이 사건의 무게를 정한다.`,
  history:`비슷한 정황만으로 유죄가 났다가 뒤집힌 사건이 적지 않았다.`,family:`${Pj(m.accused,'의')} 가족도 판결을 기다리며 같은 시간을 견디고 있다.`,
  online:`인터넷의 확신이 법정의 증거를 앞서 가고 있는 것은 아닌가.`,scholar:`법이 요구하는 것은 짐작이 아니라 증명이다. ${issue?`특히 "${issue.title}"가 그렇다.`:''}`
 }[r.style];
 const lines=[];
 if(!m.f){
  /* ---- forecast ---- */
  const lean=m.evs.filter(e=>e.decision&&e.decision!=='exclude').reduce((n,e)=>n+(e.side==='p'?1:e.side==='d'?-1:0),0)+m.said.reduce((n,x)=>n+(x.side==='p'?1:x.side==='d'?-1:0),0);
  const win=m.crim?'유죄':'원고 승소',lose=m.crim?'무죄':'원고 패소';
  const title=mine==='p'?[`[전망] ${m.name}, ${Pj(cut(ev.title,16),'이')} 승부를 가를까`,`[전망] ${m.name}, ${win}에 무게 싣는 법정`,`[전망] ${m.name} "${cut(issue?.title||'핵심 쟁점',18)}"… 검증대에 선 ${m.crim?'공소사실':'청구'}`][v]
   :[`[전망] ${m.name}, "${cut(issue?.title||'핵심 쟁점',18)}"에 답 못 하면 뒤집힌다`,`[전망] ${m.name}, ${lose} 가능성은 남아 있나`,`[전망] ${m.name}, ${Pj(cut(ev.title,16),'의')} 빈칸을 재판부는 볼까`][v];
  const pk=(key,arr)=>arr[hash(c.id+r.name+key)%arr.length];
  const LG=mine==='p'?m.logline:'';
  lines.push(m.days?pk('o1',[`${m.name} 재판이 ${m.days}차 공판까지 진행됐다. ${LG}`,`${m.days}차 공판을 마친 ${m.name} 재판이 반환점을 돌고 있다. ${LG}`,`${m.name} 재판정의 공기가 ${m.days}차 공판을 거치며 달라지고 있다. ${LG}`]):pk('o0',[`${m.name} 재판이 시작됐다. ${LG}`,`${LG} ${m.name} 재판의 막이 올랐다.`,`첫 공판을 앞둔 ${m.name} 사건, 쟁점은 분명하다. ${LG}`]));
  lines.push(pk('cl',[mine==='p'?m.claimP:m.claimD,`${mine==='p'?(m.crim?'검찰':'원고 측'):(m.crim?'변호인':'피고 측')}의 입장은 이렇다. ${mine==='p'?m.claimP:m.claimD}`,`${mine==='p'?m.claimP:m.claimD} 이것이 ${mine==='p'?(m.crim?'검찰':'원고 측'):(m.crim?'변호인':'피고 측')}의 논리다.`]));
  if(mine==='p')lines.push(pk('ev',[`${Pj(ev.title,'은')} ${ev.shows.replace(/[.。]$/,'')}는 점을 보여 준다.`,`눈여겨볼 자료는 ${cop(ev.title)}. ${ev.shows.replace(/[.。]$/,'')}는 대목이 핵심이다.`,`${ev.title}에 따르면 ${ev.shows.replace(/[.。]$/,'')}.`]));
  else lines.push(pk('ev',[`다만 ${ev.title}에는 한계가 있다. ${ev.caveat.replace(/[.。]$/,'')}.`,`${Pj(ev.title,'이')} 결정적이라고 보기는 이르다. ${ev.caveat.replace(/[.。]$/,'')}.`,`반대쪽이 파고드는 곳은 ${ev.title}의 빈틈이다. ${ev.caveat.replace(/[.。]$/,'')}.`]));
  if(q)lines.push(pk('q',[`${q.role} ${Pj(q.who,'은')} 법정에서 "${q.text}"라고 말했다.`,`"${q.text}" — ${q.role} ${q.who}의 증언이다.`,`증인석의 ${Pj(q.who,'은')} "${q.text}"라고 답했다.`]));
  if(m.late)lines.push(pk('lt',[`공판 사이에 ${Pj(m.late.title,'이')} 새로 제출돼 변수가 됐다.`,`뒤늦게 나온 ${Pj(m.late.title,'이')} 판을 흔들 수 있다.`]));
  const tilt=mine==='p'?lean:-lean,goal=mine==='p'?win:lose;
  lines.push(tilt>0?pk('tl',[`법조계에서는 ${goal} 쪽에 무게를 싣는 관측이 많다.`,`지금 흐름이라면 ${goal} 쪽이 유리하다는 평가가 나온다.`,`법정 주변에서는 ${Pj(goal,'을')} 점치는 목소리가 커지고 있다.`]):tilt<0?pk('tl',[`다만 지금까지 법정에 나온 것만 보면 ${Pj(goal,'을')} 장담하기는 어렵다는 말도 나온다.`,`그러나 기록만 놓고 보면 ${goal}까지는 갈 길이 멀다.`,`${Pj(goal,'을')} 기대하기엔 아직 증거가 모자라 보인다.`]):pk('tl',['지금으로서는 어느 쪽으로도 기울지 않았다는 평가가 많다.','판세는 아직 팽팽하다.','결론을 점치기엔 이르다는 말이 법정 주변의 중론이다.','양쪽 모두 결정타는 아직 내놓지 못했다.','어느 쪽 말이 맞는지 가릴 자료는 아직 법정에 다 나오지 않았다.','방청석의 예상도 반반으로 갈린다.']));
  lines.push(hash(c.id+r.name+'cr')%3?crit:pk('cr2',['결국 재판부가 무엇을 믿을지가 관건이다.','남은 공판에서 무엇이 새로 나올지 지켜볼 일이다.','법정 밖의 확신과 법정 안의 증거는 다를 수 있다.']));
  if(m.demand&&mine==='p'&&m.days)lines.push(`검찰은 결심에서 ${m.demand} 안팎을 구형할 것으로 보인다.`);
  if(hash(c.id+r.name+'jd?')%2)lines.push(pk('jd',[`판결은 ${Pj(judge,'이')} 맡은 재판부가 내린다.`,`최종 판단은 ${judge} 재판장의 몫이다.`,`선고는 ${judge} 재판장이 맡는다.`,`${judge} 재판장이 어떤 결론을 내릴지 관심이 쏠린다.`,`공은 이제 ${judge} 재판장에게 넘어갔다.`]));
  return {title,body:lines.filter(Boolean).join(' '),phase:'before'};
 }
 /* ---- evaluation ---- */
 const side=T.sideOf(m.f.dir),won=(side>0&&mine==='p')||(side<0&&mine==='d'),half=side===0.5||side===0;
 const used=m.evs.filter(e=>e.decision&&e.decision!=='exclude'),dropped=m.evs.filter(e=>e.decision==='exclude');
 const theirs=used.find(e=>e.side===mine)||ev,ignored=dropped.find(e=>e.side===mine)||used.find(e=>e.side===mine)||ev;
 const title=half?[`[평가] ${m.name}, 절반의 판결이 남긴 것`,`[평가] ${m.name}, 양쪽 모두 웃지 못한 선고`,`[평가] ${m.name} "${cut(m.f.label,14)}"… 재판부의 계산법`][v]
  :won?[`[평가] ${m.name}, 증거로 답한 재판부`,`[평가] ${m.name} "${cut(m.f.label,14)}"… ${judge} 재판장의 판단이 옳았다`,`[평가] ${m.name}, 여론보다 기록을 본 판결`][v]
  :[`[비판] ${m.name} 판결, 재판부는 "${cut(issue?.title||'핵심 쟁점',18)}"를 외면했다`,`[비판] ${m.name}, ${judge} 재판장의 판단에 묻는다`,`[비판] ${m.name} "${cut(m.f.label,14)}"… 납득하기 어려운 이유들`][v];
 const pk=(key,arr)=>arr[hash(c.id+r.name+key)%arr.length],sen=m.f.sentence?`(${m.f.sentence})`:'';
 lines.push(pk('o',[`${m.name} 사건에 "${m.f.label}"${sen} 판결이 선고됐다. 재판장은 ${judge} 판사다.`,`${judge} 재판장이 ${m.name} 사건에서 "${m.f.label}"${sen} 판결을 선고했다.`,`"${m.f.label}"${sen}. ${m.name} 사건의 결론이 나왔다.`]));
 if(half)lines.push(pk('h',[`재판부는 양쪽 주장을 일부씩만 받아들였다. ${mine==='p'?m.claimP:m.claimD}`,`어느 쪽도 완전히 이기지 못했다. ${mine==='p'?m.claimP:m.claimD}`]));
 else if(won)lines.push(pk('w',[`재판부는 ${Pj(theirs.title,'을')} 판단의 중심에 뒀다. ${theirs.shows?Pj(theirs.title,'은')+' '+theirs.shows.replace(/[.。]$/,'')+'는 점을 보여 준 자료다.':''}`,`판결의 무게중심은 ${theirs.title}에 있었다. ${theirs.shows?theirs.shows.replace(/[.。]$/,'')+'.':''}`,`${Pj(theirs.title,'이')} 결론을 이끌었다. ${theirs.shows?theirs.shows.replace(/[.。]$/,'')+'는 점이 받아들여졌다.':''}`]));
 else lines.push(pk('l',[`그러나 재판부는 ${Pj(ignored.title,'을')} 충분히 따지지 않았다. ${ignored.decision==='exclude'?'판단 자료에서 아예 빠졌다.':'판결 이유에서 그 무게는 가볍게 다뤄졌다.'}`,`${ignored.title}에 대한 판단이 아쉽다. ${ignored.decision==='exclude'?'재판부는 이 자료를 아예 쓰지 않았다.':'판결문은 이 자료를 몇 줄로 지나갔다.'}`,`가장 큰 의문은 ${cop(ignored.title)}. ${ignored.decision==='exclude'?'재판부는 이를 판단에서 뺐다.':'재판부는 그 의미를 작게 봤다.'}`]));
 if(q)lines.push(pk('q',[`법정에서 ${q.role} ${Pj(q.who,'이')} "${q.text}"라고 했던 말이 ${won?'결국 받아들여진 셈이다':'판결에 얼마나 반영됐는지는 의문이다'}.`,`"${q.text}" — ${q.role} ${q.who}의 이 증언은 ${won?'판결과 같은 방향을 가리켰다':'끝내 무게를 얻지 못했다'}.`]));
 lines.push(hash(c.id+r.name+'cr')%3?crit:pk('cr2',['판결문은 남고, 그 무게는 당사자들이 진다.','이번 선고가 남긴 질문은 법정 밖에서 계속될 것이다.','기록은 판결보다 오래 남는다.']));
 lines.push(half?pk('e',['판결은 확정됐고, 남은 쪽들은 각자의 몫을 감당하게 됐다.','누구도 웃지 못한 판결이 그대로 확정됐다.']):won?pk('e',[`${judge} 재판장의 판결 이유는 기록에 충실했다는 평가를 받는다.`,`증거를 따라간 ${judge} 재판장의 판단에 힘이 실린다.`,`${judge} 재판장은 여론이 아니라 기록으로 답했다.`]):pk('e',[`${judge} 재판장의 판단은 비판을 피하기 어렵다. 이 세계에는 항소가 없고, 판결은 그대로 확정된다.`,`항소가 없는 세계에서 ${judge} 재판장의 이 판결은 그대로 확정된다. 그래서 더 아쉽다.`,`${judge} 재판장은 이 판결에 대한 질문에 답해야 한다. 판결은 이미 확정됐다.`]));
 return {title,body:lines.filter(Boolean).join(' '),phase:'after',tone:half?'mixed':won?'praise':'blame'};
}
/* Only cases on my own bench (assigned to me, not handed on): no coverage of cases I never took,
 * handed to another bench, or never took. Newest activity first. */
/* My bench: cases assigned to me and not handed on. Before the first hearing they already draw forecast articles. */
function mine(c){const st=S.cases[c.id];return !!st&&!st.referred&&!!TP.curOf(c)&&(!!st.verdict||c.week<=S.week)}
function articles(){
 const cs=CASES.filter(c=>(c.generated||c.contentPack)&&mine(c))
  .sort((a,b)=>(!!S.cases[a.id].verdict-!!S.cases[b.id].verdict)||((S.cases[b.id].trial4?.daysDone||0)-(S.cases[a.id].trial4?.daysDone||0)))
  .slice(0,14);
 const out=[];
 for(const c of cs){
  const st=S.cases[c.id],t=st?.trial4,crim=c.kind==='criminal';
  if(!TP.curOf(c))continue;
  const [rp,rd]=reporterPair(c);
  for(const [r,lean,idx] of [[rp,'p',0],[rd,'d',1]]){const a=writeArticle(c,t,r);
   out.push({caseId:c.id,outlet:r.outlet,title:a.title,body:a.body,day:st?.closedWeek||c.week,index:idx,phase:a.phase,tone:a.tone||null,frame:(a.phase==='after'?(a.tone==='praise'?'판결 호평 · ':a.tone==='blame'?'판결 비판 · ':'판결 평가 · '):'재판 전망 · ')+(lean==='p'?(crim?'검찰 측 시각':'원고 측 시각'):(crim?'변호인 측 시각':'피고 측 시각')),reporter:r,lean})}
 }
 return out;
}
/* ---------- news with comments ---------- */
/* articles open from their headline; which ones the reader opened is remembered for this visit only */
const readOpen=new Set();
document.addEventListener('toggle',e=>{const d=e.target;if(!d?.matches?.('details.wf-art'))return;d.open?readOpen.add(d.dataset.art):readOpen.delete(d.dataset.art)},true);
function newsFeed(limit=40){
 const list=articles().slice(0,limit);
 if(!list.length)return '<p class="muted">내가 맡은 사건이 생기면 재판 전 전망 기사부터 실려요.</p>';
 return '<div class="tv-news-list">'+list.map(a=>{
  const c=CASES.find(x=>x.id===a.caseId),key='art'+a.index,id=a.caseId+':'+key,n=3+hash(id)%3;
  return `<article class="tv-media-card"><details class="wf-art" data-art="${esc(id)}" ${readOpen.has(id)||open.has(id)?'open':''}><summary><div class="tv-media-head"><b>${esc(a.outlet)}</b><span class="lean ${a.lean||''}">${esc(a.frame)}</span></div><strong>${esc(a.title)}</strong><small class="wf-more">기사 펼치기</small></summary>${a.reporter?`<button class="tv-reporter" data-action="reporter" data-i="${REPORTERS.indexOf(a.reporter)}">✍ <b>${esc(a.reporter.name)} 기자</b> · ${esc(a.reporter.bio)}. ${esc(a.reporter.voice)}. <i>›</i></button>`:''}<p>${esc(a.body)}</p>
  <button class="wf-link" data-action="wfopen" data-id="${esc(id)}">💬 ${open.has(id)?'댓글 접기':`댓글 ${n}개`}</button>${open.has(id)&&c?`<div class="wf-thread">${threadView(thread(c,key,n))}</div>`:''}</details></article>`;
 }).join('')+'</div>';
}
/* ---------- public opinion, case by case ---------- */
function opinionFeed(){
 const cs=CASES.filter(mine).sort((a,b)=>!!S.cases[a.id].verdict-!!S.cases[b.id].verdict).slice(0,8);
 if(!cs.length)return '<p class="muted">재판이 시작된 사건의 여론이 여기에 모입니다.</p>';
 return cs.map(c=>{
  const t=S.cases[c.id].trial4,mix=stanceMix(t),f=t?.final,log=t?.mediaLog||[];
  const labels=f?['판결 지지','판결 반대','판단 보류']:[c.kind==='criminal'?'처벌 요구':'원고 지지',c.kind==='criminal'?'피고인 동정':'피고 지지','판단 보류'];
  const agree=f?T.opinionMatch(t.media.O,f.dir):null;
  const dist=f?{a:Math.round(agree*0.8),b:Math.round((100-agree)*0.8),m:0}:{a:mix.pro,b:mix.con,m:mix.mid};if(f)dist.m=100-dist.a-dist.b;
  const steps=log.map(l=>`<li>${esc(TP.session(c,l.s))} 뒤 · ${labels[0]} ${Math.max(5,Math.min(85,Math.round(45+l.O*0.45)))}%${l.ev?` · <b>${esc(l.ev)}</b>`:''}</li>`).join('');
  return `<section class="wf-case"><h4>${esc(shortName(c))} ${f?'· 선고 후 · 판결을 두고':t?.daysDone?'· 재판 중 · 결과를 두고':'· 재판 전 · 예상'}</h4>
  <div class="wf-legend"><span><i style="background:#c8442f"></i>${labels[0]} ${dist.a}%</span><span><i style="background:#2f62a8"></i>${labels[1]} ${dist.b}%</span><span><i style="background:#9a9790"></i>${labels[2]} ${dist.m}%</span></div>
  <div class="wf-bar"><span class="a" style="width:${dist.a}%"></span><span class="b" style="width:${dist.b}%"></span><span class="m" style="width:${dist.m}%"></span></div>
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
 interview:{text:(c,r)=>`${r.outlet} ${r.name} 기자입니다. 저희는 ${shortName(c)} 판결을 비판적으로 보도했습니다. 그래도 판사님이 왜 그렇게 판단하셨는지 직접 듣고 싶습니다. 짧게 인터뷰 가능하실까요?`,
  choices:[['accept','짧게 인터뷰에 응한다','감사합니다. 판사님 말씀은 왜곡 없이 그대로 싣겠습니다.',{rel:10,news:(c,r)=>[`[인터뷰] "${shortName(c)}, 기록이 말한 만큼만 판단했다"`,`${r.outlet} ${r.name} 기자가 재판장을 만나 판결 이유를 물었다. 재판장은 "증거로 확인된 것과 확인되지 않은 것을 나눠 판단했다"고 말했다.`]}],
   ['decline','정중히 거절한다','알겠습니다. 그래도 다음 판결도 계속 지켜보겠습니다.',{rel:-3}],
   ['office','공보판사를 통해 달라고 한다','공보 창구로 다시 요청드리겠습니다.',{rel:1,press:2}]]},
 pressure:{text:()=>'',
  choices:[['refuse','정중히 거절한다','… 알겠습니다. 제가 괜한 말씀을 드렸네요.',{}],
   ['report','법원 감사 담당에 보고한다','(답장이 오지 않는다)',{}],
   ['ignore','답하지 않고 넘어간다','(읽음 표시만 남았다)',{}]]},
 truth:{text:()=>'',
  choices:[['thanks','말해 줘서 고맙다고 답한다','들어 주셔서 감사합니다. 이제야 조금 마음이 놓여요.',{rel:6}],
   ['final','판결은 이미 확정됐다고 답한다','네, 압니다. 그래도 판사님은 아셔야 할 것 같았어요.',{rel:0}],
   ['where','필요하면 알려야 할 곳을 안내한다','알려 주신 곳에 정식으로 말해 보겠습니다. 용기를 내 볼게요.',{rel:3}]]},
 review:{from:'senior',text:c=>`${shortName(c)} 리뷰 봤다. 너무 신경 쓰지 마. 다음엔 뭘 다르게 해 볼 생각이야?`,
  choices:[['proc','증거 절차를 더 꼼꼼히 보겠습니다','그게 제일 중요하지. 절차가 무너지면 결론도 같이 무너져.',{rel:3}],
   ['crowd','여론은 신경 쓰지 않겠습니다','그래야지. 대신 판결 이유는 누구나 읽을 수 있게 써.',{rel:1}],
   ['unfair','솔직히 억울합니다','그럴 수 있어. 리뷰가 늘 맞는 것도 아니고. 술 한잔하자.',{rel:4}]]}
};
function threads(){S.threads??=[];return S.threads}
function addThread(kind,c,from){
 const tp=TPL[kind],who=from||tp?.from;if(!tp||!NPC[who])return;const r=NPC[who].reporter!=null?REPORTERS[NPC[who].reporter]:null;
 threads().unshift({id:kind+':'+c.id+(from?':'+from:''),kind,caseId:c.id,from:who,week:S.week,at:Date.now(),lines:[{me:false,text:tp.text(c,r)}],picked:null});
 threads().splice(40);
 if(typeof toast==='function')toast(`💬 ${NPC[who].name}${r?' 기자':''}에게서 문자가 왔어요`);
}
function addCustom(kind,c,from,text,note){
 const id=kind+':'+c.id;if(!NPC[from]||threads().some(x=>x.id===id))return false;
 threads().unshift({id,kind,caseId:c.id,from,week:S.week,at:Date.now(),lines:[{me:false,text}],picked:null});threads().splice(40);
 if(typeof toast==='function')toast(note||`💬 ${NPC[from].name}에게서 문자가 왔어요`);return true;
}
const addTruth=(c,from,text)=>addCustom('truth',c,from,text,`💬 ${NPC[from]?.name}에게서 오래 미뤄 둔 연락이 왔어요`);
function scan(){
 if(!S?.name)return false;let added=false;
 for(const c of CASES){const t=S.cases[c.id]?.trial4;if(!t)continue;
  const has=k=>threads().some(x=>x.id===k+':'+c.id);
  if(t.final&&!has('press')&&(t.final.media?.H??0)>=50){addThread('press',c);added=true}
  if(t.lateDone&&!t.final&&!has('late')){addThread('late',c);added=true}
  if(t.final?.reviewShown&&t.final.review<60&&!has('review')){addThread('review',c);added=true}
  if(t.final&&!t.final.pressDone){t.final.pressDone=true;added=true;const side=T.sideOf(t.final.dir);
   if(side===1||side===-1)for(const r of reporterPair(c)){const i=REPORTERS.indexOf(r),id=reporterNPC(i);if(!id)continue;
    const up=(side===1)===(r.side==='p');S.relations[id]=Math.max(0,Math.min(100,(S.relations[id]??30)+(up?6:-6)));
    S.pressBook??={};const b=S.pressBook[i]??={up:0,down:0,asked:false};up?b.up++:b.down++;
    remember(id,'기사',`${shortName(c)} 판결을 ${up?'호의적으로':'비판적으로'} 보도`,c.id);
    if(!up&&!b.asked&&(b.down>=2||c.importance>=4)){b.asked=true;addThread('interview',c,id)}}}
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
 if(eff.news&&c){const rr=NPC[th.from]?.reporter!=null?REPORTERS[NPC[th.from].reporter]:null;const [title,body]=eff.news(c,rr);news(title,body,rr?.outlet||'법조일보')}
 window.VerdictV6?.onReply?.(th,choiceId,c);
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
if(window.VerdictMedia){window.VerdictMedia.articles=articles;window.VerdictMedia.newsFeed=newsFeed;window.VerdictMedia.socialFeed=()=>opinionFeed()}
const priorTablet=tabletInner;
tabletInner=function(){
 if(ui.tabletTab==='messages')return messagesView();
 if(ui.tabletTab==='social')return '<h2>＃ 여론</h2><p class="muted small">사건마다 여론이 어떻게 움직였는지, 지금 사람들이 무슨 말을 하는지 봅니다.</p>'+opinionFeed();
 if(ui.tabletTab==='news')return '<h2>📰 기사</h2><p class="muted small">내가 맡은 사건의 보도예요. 판결 전에는 전망을, 판결 뒤에는 판결에 대한 평가를 씁니다.</p>'+newsFeed(60);
 return priorTablet();
};
const priorHome=home;
home=function(){
 const waiting=threads().filter(x=>!x.picked).length;
 return (waiting?`<button class="wf-home" data-action="tablet" data-sub="messages">💬 답장을 기다리는 문자 ${waiting}건</button>`:'')+priorHome();
};
const priorPopup=popupNPC;
popupNPC=function(id){priorPopup(id);const p=NPC[id];if(p&&p.reporter!=null&&window.VerdictTrialPlay?.addToModal)VerdictTrialPlay.addToModal(reporterNote(p.reporter))};
const priorClick=clicker;
clicker=function(e){
 const el=e.target.closest('[data-action]'),a=el?.dataset.action;
 if(a==='wfopen'){e.preventDefault();const id=el.dataset.id;open.has(id)?open.delete(id):open.add(id);render();return}
 if(a==='reporter'){e.preventDefault();const id=reporterNPC(Number(el.dataset.i));if(id)popupNPC(id);return}
 if(a==='wfreply'){e.preventDefault();answer(el.dataset.id,el.dataset.choice);return}
 return priorClick(e);
};
setInterval(()=>{if(scan()&&!ui.modal&&(ui.tab==='home'||ui.tab==='tablet'))render()},30000);
setTimeout(()=>{if(scan()&&!ui.modal)render()},2500);
window.VerdictWorld={addTruth,addCustom,scan,thread,opinionFeed,newsFeed,answer,reporters:()=>REPORTERS,reporterNPC};
})();
