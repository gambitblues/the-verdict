/* THE VERDICT — media desk.
 * Turns a verdict into three outlets' reactions, without live AI:
 *   1) a fixed fact summary every outlet must agree with,
 *   2) anomalies (what is surprising about this verdict),
 *   3) a legal column (structure and numbers), a court-beat reporter (relations, hedged rumour)
 *      and a citizen community (emotion, memes) — each blaming a different cause,
 *   4) rumour intensity that grows only with accumulated history,
 *   5) a locked opinion mode per verdict, no mixed polarity inside one comment,
 *   6) no template reuse across recent verdicts, 30–40% plain comments,
 *   7) running narratives that the next verdict can recall ("이번이 처음이 아니다").
 * Pure: takes a context and a desk state, returns text plus the updated desk state. No DOM.
 * Safety: victims are never mocked; homicide/sexual cases switch off joke memes.
 */
(function(root){
'use strict';

const hash=s=>{let h=2166136261;for(const ch of String(s))h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;
 h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0};
const unit=s=>hash(s)/4294967296;
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,Number(n)||0));

/* Korean particles: 이/가, 은/는, 을/를, 과/와, (으)로 */
function batchim(word){const w=String(word).trim(),last=w.slice(-1);
 if(/[0-9]/.test(last))return '013678'.includes(last);
 const c=last.charCodeAt(0);if(c<0xAC00||c>0xD7A3)return false;return (c-0xAC00)%28!==0}
function rieul(word){const w=String(word).trim(),last=w.slice(-1);if(/[0-9]/.test(last))return '178'.includes(last);const c=last.charCodeAt(0);return c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28===8}
const j=(w,a,b)=>w+(batchim(w)?a:b);
const was=n=>n+(batchim(n)?'이었다':'였다');
const ro=n=>n+(batchim(n)&&!rieul(n)?'으로':'로');

const OUTLETS=Object.freeze({
 column:{outlet:'리걸포커스',desk:'판결 분석',writer:'마지훈'},
 beat:{outlet:'데일리법조',desk:'법원 출입기자',writer:'구태오'},
 community:{outlet:'시민광장',desk:'실시간 반응'}
});

/* ---------- 1. fixed facts ---------- */
function summary(x){
 const used=x.evidence.filter(e=>e.decision==='use').length,cond=x.evidence.filter(e=>e.decision==='conditional').length,out=x.evidence.filter(e=>e.decision==='exclude').length;
 return [
  `${x.caseName}`,
  `판결: ${x.verdictLabel} · 재판일 ${x.daysDone}회`,
  `증거: 씀 ${used} · 조건 붙여 씀 ${cond} · 뺌 ${out}${x.illegalOut?' (불법 획득 증거 배제)':''}`,
  `확신 게이지: 증거로 보여준 정도 ${x.P} · 남은 의문 ${x.D}`,
  `상대: ${x.opponent.name} 변호사 (${x.opponent.styleLabel}) · 화제성 ${x.H}`
 ];
}

/* ---------- 2. anomalies ---------- */
function anomalies(x,state){
 const a=[],m=x.P-x.D,hist=state.history||[];
 const conv=hist.filter(h=>h.side===1).length,acq=hist.filter(h=>h.side===-1).length,n=hist.length;
 if(x.side===-1&&m>=40)a.push('proofButAcquit');
 if(x.side===1&&m<15)a.push('doubtButConvict');
 if(x.match<30&&x.H>=45)a.push('againstOpinion');
 if(x.match>=75&&x.H>=60)a.push('withOpinion');
 if(x.illegalOut)a.push('illegalOut');
 if(x.flip||x.twist)a.push('twist');
 if(x.importance>=4&&x.daysDone<=x.minDays)a.push('quick');
 if(x.daysDone>x.minDays)a.push('longTrial');
 if(n>=4&&conv/n>=0.7&&x.side===-1)a.push('styleBreakAcquit');
 if(n>=4&&acq/n>=0.6&&x.side===1)a.push('styleBreakConvict');
 const rv=(state.rivals||{})[x.opponent.id];
 if(rv&&rv.streak>=2)a.push(rv.streakSide==='win'?'rivalWinning':'rivalLosing');
 if(!a.length)a.push('normal');
 return a;
}

/* ---------- 7. running narratives ---------- */
function updateState(state,x){
 const s=JSON.parse(JSON.stringify(state||{}));
 s.history=[...(s.history||[]),{side:x.side,match:x.match,skill:x.skill,case:x.caseShort}].slice(-30);
 const against=x.match<35;
 s.againstStreak=against?(s.againstStreak||0)+1:0;
 s.withStreak=x.match>=65?(s.withStreak||0)+1:0;
 s.rivals??={};
 const r=s.rivals[x.opponent.id]??={name:x.opponent.name,win:0,lose:0,streak:0,streakSide:null};
 const res=x.side===-1?'win':x.side===1?'lose':null;
 if(res){r[res]++;r.streak=r.streakSide===res?r.streak+1:1;r.streakSide=res}
 const n=[];
 if(s.againstStreak>=2)n.push({id:'against',text:`여론과 반대로 간 판결 ${s.againstStreak}연속`,level:s.againstStreak>=4?3:2});
 if(s.withStreak>=3)n.push({id:'with',text:`여론과 같은 방향의 판결 ${s.withStreak}연속`,level:2});
 for(const [id,v] of Object.entries(s.rivals))if(v.streak>=2)n.push({id:'rival:'+id,text:(v.streakSide==='win'?`${v.name} 변호사, 이 법정 ${v.streak}연승`:`${v.name} 변호사, 이 법정 ${v.streak}연패`),level:v.streak>=4?3:2});
 const h=s.history,conv=h.filter(v=>v.side===1).length/h.length,acq=h.filter(v=>v.side===-1).length/h.length;
 if(h.length>=5&&conv>=0.7)n.push({id:'hard',text:'책임 인정 비율이 높은 재판부',level:2});
 if(h.length>=5&&acq>=0.6)n.push({id:'soft',text:'책임 불인정 비율이 높은 재판부',level:2});
 s.narratives=n;
 return s;
}

/* ---------- 6. template picking without reuse ---------- */
function picker(seed,recent){
 const past=recent||[],used=new Set(past),fresh=[];
 const lastUse=id=>{const i=past.lastIndexOf(id);return i<0?-1:i};
 const pick=(key,list,idOf)=>{
  const order=list.map((item,i)=>{const id=key+':'+(idOf?idOf(item,i):i);return [id,i,unit(seed+id)]}).sort((a,b)=>a[2]-b[2]);
  const now=new Set(fresh);
  const hit=order.find(o=>!used.has(o[0]))||order.filter(o=>!now.has(o[0])).sort((a,b)=>lastUse(a[0])-lastUse(b[0]))[0]||order[0];
  used.add(hit[0]);fresh.push(hit[0]);return list[hit[1]];
 };
 return {pick,fresh:()=>fresh};
}

/* ---------- 3a. legal column: structure and numbers ---------- */
const COLUMN={
 proofButAcquit:[
  x=>[`${x.caseShort}, 증거는 충분했는데 왜 무죄였나`,`확신 게이지로 보면 증거로 보여준 정도 ${x.P}, 남은 의문 ${ro(x.D)} 차이가 ${x.P-x.D}에 이른다. 숫자만 보면 책임을 인정할 수 있는 사건이었다. 재판부가 고른 판결 이유가 이 간극을 얼마나 설명하는지가 이번 판결의 평가를 가를 것으로 보인다.`],
  x=>[`${x.caseShort} 판결, 숫자와 결론이 어긋난 지점`,`제출된 증거 가운데 ${x.usedCount}건이 판단에 쓰였고, 증거로 보여준 정도는 ${was(x.P)}. 그럼에도 결론은 무죄였다. 증거 자체보다 증거와 행위자를 잇는 고리를 문제 삼았다는 해석이 가능하다.`]
 ],
 doubtButConvict:[
  x=>[`${x.caseShort}, 남은 의문 ${x.D}에서 나온 유죄`,`증거로 보여준 정도(${x.P})와 남은 의문(${x.D})의 차이가 ${x.P-x.D}에 그친다. 책임을 인정하기엔 여유가 거의 없는 수치다. 의문이 남으면 책임을 묻기 어렵다는 원칙과 어떻게 조화되는지 판결문을 다시 읽어볼 필요가 있다.`],
  x=>[`${x.caseShort} 판결의 약한 고리`,`유죄의 근거가 된 증거 중 ${x.flawedUsed}건은 흠이 확인된 상태로 쓰였다. 남은 의문 ${x.D}${batchim(x.D)?'이라는':'라는'} 수치는 결코 작지 않다. 이 판결이 판결 리뷰에서 어떤 평가를 받을지 주목된다.`]
 ],
 illegalOut:[
  x=>x.side===1?[`${x.caseShort}, 불법 증거 없이도 책임을 인정했다`,`재판부는 불법으로 얻은 증거를 판단에서 뺐다. 그러고도 남은 증거로 보여준 정도가 ${x.P}에 이르렀다. 절차와 결론을 함께 지킨 판단으로 평가할 만하다.`]
   :[`${x.caseShort}, 불법 증거를 걸러낸 원칙`,`재판부는 불법으로 얻은 증거를 판단에서 뺐다. 그 결과 증거로 보여준 정도는 ${x.P}에 머물렀다. 겉으로 강해 보이던 증거가 빠지면서 ${x.match<50?'여론과의 거리는 벌어졌지만':'결론은 달라졌지만'}, 절차 면에서는 흠잡기 어려운 판단이다.`]
 ],
 againstOpinion:[
  x=>[`${x.caseShort}, 여론과 법정 사이의 거리`,`여론 방향은 ${x.O>0?'+':''}${x.O}${batchim(x.O)?'이었고':'였고'} 판결은 반대쪽을 택했다. 대중은 증거의 겉모습을 보고, 재판부는 흠까지 본다. 이번 판결은 그 차이가 가장 크게 드러난 사례 중 하나다.`]
 ],
 twist:[
  x=>[`${x.caseShort}, 막판 변수가 바꾼 판결`,`선고를 앞두고 ${x.flip?'증인이 진술을 바꿨고':'새 자료가 제출됐고'}, 남은 의문은 ${x.D}까지 올라갔다. 막판 변수를 어떻게 다뤘는지가 이 재판부의 판단 습관을 보여준다.`]
 ],
 quick:[
  x=>[`${x.caseShort}, 최소 재판일로 끝난 중요 사건`,`중요도 ${x.importance} 사건이 재판일 ${x.daysDone}회 만에 끝났다. 밀린 사건을 줄이는 데는 도움이 되겠지만, 증거 조사가 충분했는지에 대한 질문은 남는다.`]
 ],
 longTrial:[
  x=>[`${x.caseShort}, 재판일 ${x.daysDone}회의 의미`,`최소 횟수보다 재판일을 더 열었다. 조사에 시간을 쓴 만큼 남은 의문은 ${ro(x.D)} 정리됐다. 신중함이 밀린 사건이라는 비용을 감수할 만했는지는 연말 평가에서 드러날 것이다.`]
 ],
 styleBreakAcquit:[
  x=>[`책임 인정이 잦던 재판부의 무죄`,`이 재판부는 최근 판결 대부분에서 책임을 인정했다. 이번 ${x.caseShort} 무죄는 그 흐름에서 벗어난다. 사건 자체의 증거 구조가 달랐다고 보는 것이 자연스럽다.`]
 ],
 styleBreakConvict:[
  x=>[`의문을 중시하던 재판부의 유죄`,`최근 책임 불인정이 많던 재판부가 ${x.caseShort}에서는 책임을 인정했다. 증거로 보여준 정도 ${j(String(x.P),'이','가')} 이 재판부의 기준선을 넘었다는 의미로 읽힌다.`]
 ],
 rivalWinning:[x=>[`${x.opponent.name} 변호사, 이 법정에서 또 웃었다`,`${x.opponent.name} 변호사는 이 재판부를 상대로 ${x.rival.streak}연승을 이어갔다. ${x.opponent.styleLabel} 변론이 이 재판부의 판단 습관과 맞물린다는 분석이 나온다.`]],
 rivalLosing:[x=>[`${x.opponent.name} 변호사, 이 법정에서 다시 막혔다`,`${x.opponent.name} 변호사는 이 재판부 앞에서 ${x.rival.streak}연패다. ${x.opponent.styleLabel} 변론이 이 재판부에는 통하지 않는다는 평가가 나온다.`]],
 withOpinion:[x=>[`${x.caseShort}, 여론과 판결이 만났다`,`여론 방향 ${x.O>0?'+':''}${x.O}${batchim(x.O)?'과':'와'} 같은 결론이다. 다만 판결 실력은 여론이 아니라 증거로 매겨진다. 증거로 보여준 정도 ${j(String(x.P),'이','가')} 결론을 뒷받침하는지가 핵심이다.`]],
 normal:[
  x=>[`${x.caseShort} 판결 분석`,`증거로 보여준 정도 ${x.P}, 남은 의문 ${x.D}. 숫자와 결론이 크게 어긋나지 않는 판결이다. 쓰인 증거 ${x.usedCount}건과 뺀 증거 ${x.outCount}건의 구성이 결론을 설명한다.`],
  x=>[`${x.caseShort}, 무난하지만 짚을 점`,`결론은 기록과 크게 다르지 않다. 다만 흠을 확인하지 않은 증거가 ${x.unchecked}건 남아 있었다는 점은 아쉬움으로 남는다.`]
 ]
};
const NEXT=['다음 재판에서도 같은 기준을 유지할지가 관전 포인트다.','같은 유형의 사건에서 이 기준이 반복될지 지켜볼 일이다.','판결 리뷰가 공개되면 평가는 더 분명해질 것이다.'];
const PATTERN=['이번이 처음이 아니다.','비슷한 장면은 이전에도 있었다.','패턴이라고 부를 만한 흐름이 보인다.'];

/* ---------- 3b. court-beat reporter: relations and hedged rumour ---------- */
const BEAT={
 1:[
  x=>`선고 직후 ${x.opponent.name} 변호사가 ${x.side===-1?'법원 복도에서 짧게 고개를 끄덕였다는':'기자들의 질문을 피해 서둘러 자리를 떴다는'} 목격담이 나온다.`,
  x=>`재판이 끝난 뒤 법원 구내식당에서는 이번 판결 이야기가 오갔다는 후문이다. 판결 이유가 예상보다 짧았다는 반응도 있었다고 한다.`,
  x=>`한 법조 관계자는 "${x.caseShort} 사건은 처음부터 결론을 예측하기 어려웠다"고 전했다.`
 ],
 2:[
  x=>`법원 안팎에서는 이 재판부의 판단 흐름을 두고 "패턴이 보인다"는 말이 나오기 시작했다. ${x.narrative?`${x.narrative} 기록이 근거로 거론된다.`:''}`,
  x=>`복수의 법조 관계자에 따르면 일부 변호사들이 이 재판부의 판단 습관을 사건 준비에 반영하고 있다는 이야기가 흘러나온다.`,
  x=>`${x.opponent.name} 변호사 측 사정에 밝은 인사는 "이 재판부에 맞춘 변론 전략을 따로 준비했다"고 귀띔했다.`
 ],
 3:[
  x=>`법원장이 최근 이 재판부와 면담을 가졌다는 이야기가 법원 안에서 돌고 있다. 공식 확인은 없지만, ${x.narrative||'최근 판결 흐름'}과 무관하지 않다는 관측이 나온다.`,
  x=>`다음 정기 인사에서 이 재판부의 이동 가능성을 거론하는 목소리도 있다. 법원 측은 "근거 없는 이야기"라는 입장이다.`,
  x=>`일부 변호인들 사이에서 이 재판부를 피하고 싶다는 말까지 나온다는 전언이다. 다만 사건 배당은 무작위로 이뤄진다.`
 ]
};

/* ---------- 3c. community: locked mode, memes with triggers ---------- */
const NICKS=['팩트먼저','퇴근길댓글','지나가던법대생','상식인','기록덕후','판례읽는밤','유동닉','법알못아님','정의구현중','방구석배심원','오늘도눈팅','커피는아아','야근요정','시민1','진지충아님','판결문정독러'];
const PLAIN={
 praise:['오늘 판결은 납득됨','이유까지 깔끔하네','이 판사님 계속 봐야겠다','이번엔 제대로 봤네','판결문 요약만 봐도 이해됨','이 정도면 할 만큼 했다','증거 보는 눈이 있네','오랜만에 시원한 판결','설명이 친절해서 좋다','이런 판결이 많아졌으면','고민한 흔적이 보임','결론도 이유도 다 맞는 듯'],
 criticize:['이건 좀 아니지 않냐','납득이 안 됨','피해자 생각은 한 거냐','결과가 너무 이상함','이해하려고 해도 안 된다','이게 상식적인 결론인가','뉴스 보고 한숨 나옴','도대체 뭘 본 거지','이러니까 법을 못 믿지','다른 판사였으면 달랐을 듯','결론이 너무 성급했다','기록을 제대로 본 건지 모르겠다'],
 debate:['판결문 나오면 다시 보자','양쪽 다 일리는 있음','기사만 보고는 모르겠다','증거를 다 본 사람은 판사뿐이지','결론보다 이유가 궁금함','감정이랑 증거는 따로 봐야 함','댓글창 온도차 실화냐','이건 진짜 의견 갈릴 만함','난 아직 판단 보류','둘 다 맞는 말이라 어렵다']
};
/* polarity: + praise, - criticize, 0 neutral/defender. heavy=false means a joke meme (off in homicide/sexual cases). */
const MEMES=[
 {id:'official-cider',pol:'+',heavy:true,when:x=>x.match>=65,text:x=>'[오피셜] 사이다 판결'},
 {id:'dae',pol:'+',heavy:true,when:x=>x.skill>=70,text:x=>`대${x.judgeSurname} 판사님 판결문 필사하러 감`},
 {id:'god',pol:'+',heavy:false,when:x=>x.skill>=75,text:x=>`${x.judgeSurname}갓 또 해냈다`},
 {id:'frame',pol:'+',heavy:true,when:x=>x.skill>=70,text:x=>'판결문 액자에 걸어둠'},
 {id:'root',pol:'+',heavy:true,when:x=>x.illegalOut||x.skill>=72,text:x=>'근본 있는 재판부'},
 {id:'fan',pol:'+',heavy:false,when:x=>x.withStreak>=2,text:x=>`세상에 한 명의 ${x.judgeName} 판사 팬이 있다면 그게 나다`},
 {id:'right',pol:'?',heavy:true,when:x=>x.match<40,text:x=>'판사님 이거 맞아요?'},
 {id:'vending-acq',pol:'-',heavy:false,when:x=>x.side===-1&&x.softish,text:x=>'무죄 자판기 또 작동함'},
 {id:'vending-conv',pol:'-',heavy:false,when:x=>x.side===1&&x.hardish,text:x=>'유죄 자판기 또 돌아갔네'},
 {id:'disaster',pol:'-',heavy:false,when:x=>x.skill<55&&x.match<40,text:x=>`${x.judgeSurname}재앙 오늘도 레전드 찍음`},
 {id:'out',pol:'-',heavy:true,when:x=>x.againstStreak>=3,text:x=>`참을만큼 참았다 ${x.judgeSurname}재앙 아웃`},
 {id:'lawbook',pol:'-',heavy:true,when:x=>x.match<35,text:x=>'법전은 장식이냐'},
 {id:'ai',pol:'-',heavy:false,when:x=>x.match<35,text:x=>'판사를 AI로 바꾸자는 말이 왜 나오는지 알겠다'},
 {id:'official-bad',pol:'-',heavy:false,when:x=>x.skill<50,text:x=>'[오피셜] 법알못 판사'},
 {id:'lawyer-win',pol:'0',heavy:false,when:x=>x.side===-1&&x.rival&&x.rival.streak>=2&&x.rival.streakSide==='win',text:x=>`${x.opponent.name} 변호사 이 법정 무패 신화 ㄷㄷ`},
 {id:'lawyer-tongue',pol:'0',heavy:false,when:x=>x.side===1&&x.opponent.style==='media',text:x=>`${x.opponent.name} 변호사 언론플레이가 법정에선 안 통했네`},
 {id:'twist',pol:'0',heavy:false,when:x=>x.flip,text:x=>'증인 번복 실화냐 엌ㅋㅋㅋ'},
 {id:'drama',pol:'0',heavy:true,when:x=>x.twist||x.flip,text:x=>'드라마보다 더 드라마 같은 재판이었음'},
 {id:'readit',pol:'d',heavy:true,when:x=>x.illegalOut||x.D>=35,text:x=>'법알못들 판결문부터 읽고 와라'},
 {id:'illegal',pol:'d',heavy:true,when:x=>x.illegalOut,text:x=>'불법으로 얻은 증거는 못 쓰는 게 원칙 맞음'},
 {id:'doubt',pol:'d',heavy:true,when:x=>x.side===-1&&x.D>=35,text:x=>'의심이 남으면 책임 못 묻는 게 원칙임'},
 {id:'headline',pol:'0',heavy:false,when:x=>x.S>=50,text:x=>'기사 제목만 보고 싸우는 중 ㅋㅋ'},
 {id:'mild',pol:'d',heavy:true,when:x=>x.illegalOut,text:x=>'불법 증거 쓰는 순간 진짜 범인도 빠져나갈 구멍이 생기는 거임'}
];
const REPLIES={hey:'헤이헤이헤이',eoheo:x=>'어허 증거를 다 본 건 판사라니까',fact:x=>`남은 의문 ${x.D}이면 원래 이런 결론 나옴`};

function mode(x){
 if(x.match>=65&&x.skill>=60)return 'praise';
 if(x.match<35)return 'criticize';
 if(x.S>=55||x.match<65)return 'debate';
 return 'praise';
}

function community(x,seed,pk){
 const m=mode(x),heavyCase=x.heavy,count=8;
 const allowed=MEMES.filter(me=>me.when(x)&&(!heavyCase||me.heavy)&&(
  m==='praise'?(me.pol==='+'||me.pol==='0'||me.pol==='d'):
  m==='criticize'?(me.pol==='-'||me.pol==='?'||me.pol==='0'):true));
 const memesWanted=Math.round(count*(0.6+unit(seed+'mw')*0.05)); // 60–65% memes → 35–40% plain
 const out=[];let memeLeft=Math.min(memesWanted,allowed.length);
 const used=new Set();
 for(let i=0;i<count;i++){
  const s=seed+':c:'+i;
  // In debate mode alternate sides so different users fight; one user never mixes polarity.
  const side=m==='debate'?(i%2===0?'pro':'con'):m==='praise'?'pro':'con';
  let text=null,kind='plain',pol=side==='pro'?'+':'-';
  if(memeLeft>0&&unit(s+'m')<0.75){
   const pool=allowed.filter(me=>!used.has(me.id)&&(m!=='debate'||(side==='pro'?['+','d','0'].includes(me.pol):['-','?','0'].includes(me.pol))));
   if(pool.length){const me=pk.pick('meme',pool,v=>v.id);if(!used.has(me.id)){used.add(me.id);text=me.text(x);kind='meme';pol=me.pol;memeLeft--}}
  }
  if(!text){const list=m==='debate'?PLAIN.debate.concat(side==='pro'?PLAIN.praise:PLAIN.criticize):PLAIN[m];text=pk.pick('plain',list,v=>v)}
  const nick=pk.pick('nick',NICKS.filter(n=>!out.some(o=>o.nick===n)),v=>v);
  out.push({nick,text,kind,pol,likes:Math.round(x.H*(2+unit(s+'l')*22))});
 }
 // debate: one factual reply under the most-liked attack
 if(m==='debate'){
  const target=out.filter(c=>c.pol==='-'||c.pol==='?').sort((a,b)=>b.likes-a.likes)[0];
  if(target){const r=pk.pick('reply',[REPLIES.hey,REPLIES.eoheo(x),REPLIES.fact(x)]);target.reply={nick:NICKS.find(n=>!out.some(o=>o.nick===n))||'시민',text:r}}
 }
 return {mode:m,label:{praise:'찬양',criticize:'비판',debate:'논쟁'}[m],comments:out.sort((a,b)=>b.likes-a.likes)};
}

/* ---------- main ---------- */
function react(input,deskState){
 const st=deskState||{};
 const x={...input};
 x.caseShort=String(x.caseName||'').split(' · ')[0];
 x.judgeSurname=String(x.judgeName||'판').trim().slice(0,1)||'판';
 x.heavy=/살인|치사|성범죄|성폭|강간|추행|아동/.test(x.category||'');
 x.usedCount=x.evidence.filter(e=>e.decision==='use'||e.decision==='conditional').length;
 x.outCount=x.evidence.filter(e=>e.decision==='exclude').length;
 x.flawedUsed=x.evidence.filter(e=>(e.decision==='use'||e.decision==='conditional')&&e.revealed>=1&&e.flawType!=='none').length;
 x.unchecked=x.evidence.filter(e=>e.revealed===0).length;
 const hist=st.history||[];
 x.hardish=hist.length>=3&&hist.filter(h=>h.side===1).length/hist.length>=0.65;
 x.softish=hist.length>=3&&hist.filter(h=>h.side===-1).length/hist.length>=0.6;
 x.againstStreak=(x.match<35?(st.againstStreak||0)+1:0);
 x.withStreak=(x.match>=65?(st.withStreak||0)+1:0);
 const rv=(st.rivals||{})[x.opponent.id];
 const res=x.side===-1?'win':x.side===1?'lose':null;
 x.rival=rv&&res?{streak:rv.streakSide===res?rv.streak+1:1,streakSide:res}:res?{streak:1,streakSide:res}:null;
 const stateForAnom={...st,rivals:{...(st.rivals||{}),[x.opponent.id]:x.rival?{streak:x.rival.streak,streakSide:x.rival.streakSide}:rv}};
 const list=anomalies(x,stateForAnom);
 const seed=x.caseId+':'+(hist.length);
 const pk=picker(seed,st.recent);

 // column: the most structural anomaly, plus a pattern line if a narrative is already running
 const colKey=['proofButAcquit','doubtButConvict','illegalOut','againstOpinion','twist','styleBreakAcquit','styleBreakConvict','rivalWinning','rivalLosing','quick','longTrial','withOpinion','normal'].find(k=>list.includes(k))||'normal';
 const [ctitle,cbody]=pk.pick('col:'+colKey,COLUMN[colKey])(x);
 const running=(st.narratives||[])[0];
 const column={...OUTLETS.column,title:ctitle,body:cbody+(running?' '+pk.pick('pattern',PATTERN):'')+' '+pk.pick('next',NEXT),anomaly:colKey};

 // beat: intensity follows accumulated history only
 const next=updateState(st,x);
 const level=Math.max(1,...next.narratives.map(n=>n.level),1);
 x.narrative=next.narratives[0]?.text||'';
 const beatTitle=level>=3?`[단독] ${x.caseShort} 이후, 법원 안 기류가 심상치 않다`:level===2?`${x.caseShort} 판결로 본 재판부의 흐름`:`${x.caseShort} 선고 현장 뒷이야기`;
 const beat={...OUTLETS.beat,title:beatTitle,body:pk.pick('beat:'+level,BEAT[level])(x),level};

 const comm={...OUTLETS.community,...community(x,seed,pk)};
 next.recent=[...(st.recent||[]),...pk.fresh()].slice(-80);
 return {summary:summary(x),anomalies:list,column,beat,community:comm,narratives:next.narratives,state:next};
}

const api=Object.freeze({react,summary,anomalies,updateState,mode,batchim,j,OUTLETS,MEMES});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.VerdictMediaDesk=api;
})(typeof window!=='undefined'?window:globalThis);
