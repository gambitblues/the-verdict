/* THE VERDICT — Match engine (prototype). Reads a world sheet (world-sheets/cases/*.json) and runs a trial that differs
 * from play to play, without a script:
 *  - the world is locked at start (one of did / didnt / reason); nothing here ever writes to the sheet or the truth;
 *  - what people say comes only from the sheet: a truthful witness tells what they saw in the locked world, a witness
 *    who lies borrows what they would have seen in another world (so every lie is a fact of some world, never invented);
 *  - records always show the locked world's content; whether and when they reach the court is courtroom play;
 *  - prosecutor and defence lawyers have abilities and a tactic; their moves and the witnesses' answers are rolls;
 *  - the verdict is graded on what the court actually saw, not only on the hidden truth.
 * State is a plain object (save-friendly): sheet id, seed, truth key, a lock hash, witnesses' stances, the court log.
 * Use: VerdictMatch.start(sheet,{seed}) → act(sheet,state,{type,...}) → endDay(sheet,state) → verdict(sheet,state,world). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.VerdictMatch=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const TRUTHS=['did','didnt','reason'];
const hash=s=>{let h=2166136261;for(const ch of String(s))h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return h>>>0};
const unit=k=>{let x=hash(k)||1;x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296};
const roll=(k,n=20)=>1+Math.floor(unit(k)*n);
const pick=(arr,k)=>arr[Math.floor(unit(k)*arr.length)%arr.length];
const clone=x=>JSON.parse(JSON.stringify(x));
const WORD={'높음':16,'강함':16,'보통':11,'낮음':6,'약함':6};
const num=(v,d=11)=>{const s=String(v||'');for(const [w,n] of Object.entries(WORD))if(s.startsWith(w))return n;return d};
const sideOf=by=>/검찰|원고|신청/.test(by||'')?'p':'d';

/* ---------- lawyers ---------- */
const SURN='김이박최정강조윤장임한오서신권황안송류홍'.split(''),GIV=['세윤','태경','민재','하늘','도현','서아','지훈','유진','현우','다은','준서','가온','수빈','재원','이안','채원'];
const TACTICS={
 press:{label:'증인 압박',desc:'상대에게 불리한 증인을 집요하게 신문'},
 clock:{label:'시각 공방',desc:'기록끼리 시각이 어긋나는 점을 파고듦'},
 source:{label:'증거 효력 다투기',desc:'자료의 확보 경위와 원본 여부를 문제 삼음'},
 steady:{label:'신중 수비',desc:'무리하지 않고 확보한 자료로 정리'}};
function lawyer(seed,side){
 const k=seed+':law:'+side,name=pick(SURN,k+'s')+pick(GIV,k+'g');
 const a=x=>6+Math.floor(unit(k+x)*13);
 return {side,name,exam:a('e'),logic:a('l'),prep:a('p'),calm:a('c'),tactic:pick(Object.keys(TACTICS),k+'t')};
}
const word=n=>n>=16?'뛰어남':n>=12?'좋음':n>=9?'보통':'약함';

/* ---------- speech: turn sheet sentences (개조식) into spoken Korean ---------- */
const ENDS=[[/했다는 것$/,'했습니다'],[/다는 것$/,'습니다'],[/본 것$/,'봤습니다'],[/한 것$/,'했습니다'],[/않은 것$/,'않았습니다'],[/놓친 것$/,'놓쳤습니다'],[/준 것$/,'줬습니다'],[/만진 것$/,'만졌습니다'],[/모습$/,'모습을 기억합니다'],
 [/전부$/,'전부입니다'],[/통화$/,'통화했습니다'],[/(도착|확인|발송|신고|이동|퇴실|입실|출근|퇴근)$/,'$1했습니다'],[/있음$/,'있습니다'],[/없었음$/,'없었습니다'],[/었음$/,'었습니다'],[/았음$/,'았습니다'],[/였음$/,'였습니다'],[/봄$/,'봤습니다'],[/들음$/,'들었습니다'],[/줌$/,'줬습니다'],[/앎$/,'압니다'],[/느낌$/,'느꼈습니다'],
 [/없음$/,'없습니다'],[/않음$/,'않습니다'],[/못함$/,'못합니다'],[/믿음$/,'믿습니다'],[/생각함$/,'생각했습니다'],[/확인함$/,'확인했습니다'],[/진술함$/,'진술했습니다'],[/함$/,'합니다'],[/됨$/,'됩니다'],[/임$/,'입니다'],[/것$/,'것입니다']];
function speak(text){
 return String(text||'').replace(/^자기가 /,'제가 ').replace(/([ ,])자기가 /g,'$1제가 ').split(/(?<=[.。])\s+|(?<=것),\s+/).map(s=>s.trim().replace(/[.。]$/,'')).filter(Boolean).map(s=>{for(const [re,to] of ENDS)if(re.test(s))return s.replace(re,to)+'.';return /[다요]$/.test(s)?s+'.':s+'입니다.'});
}
const blur=s=>s.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g,'그 무렵').replace(/(\d+)초쯤/g,'잠깐').replace(/(\d+)분/g,'몇 분');

/* ---------- start ---------- */
function lockOf(sheet,truth){return hash(truth+'|'+JSON.stringify(sheet.worlds[truth])+'|'+JSON.stringify(sheet.records)).toString(16)}
function start(sheet,opt={}){
 const seed=String(opt.seed??'seed'),truth=opt.truth&&TRUTHS.includes(opt.truth)?opt.truth:TRUTHS[hash(sheet.id+':'+seed)%3];
 const P=new Map(sheet.people.map(p=>[p.key,p])),ac=sheet.card.accused,co=sheet.card.complainant;
 const law={p:opt.lawyers?.p||lawyer(seed,'p'),d:opt.lawyers?.d||lawyer(seed,'d')};
 const witnesses={};
 for(const p of sheet.people.filter(p=>/^W\d+$/.test(p.key))){
  const h=num(p.traits?.honesty),r=num(p.traits?.pressure),m=num(p.traits?.memoryAccuracy);
  const stake=String(p.stake||'');const leans=/없음/.test(stake)||!stake?null:/고소인|피해자|원고/.test(stake)?co:ac;
  const sc={honest:h+unit(seed+p.key+'h')*6,protect:leans?(20-h)+unit(seed+p.key+'p')*6:-1,fear:leans?(20-r)*0.8+unit(seed+p.key+'f')*6:-1};
  const stance=Object.entries(sc).sort((a,b)=>b[1]-a[1])[0][0];
  witnesses[p.key]={key:p.key,h,r,m,leans,stance,broken:false,said:{},cred:0};
 }
 const records={};for(const r of sheet.records)records[r.id]={status:r.first?'in':'none',disputed:false,day:r.first?1:null};
 return {format:'verdict-match/v1',sheet:sheet.id,seed,truth,lock:lockOf(sheet,truth),day:1,actions:4,law,witnesses,records,orders:[],party:{asked:0,stance:null},log:[{day:1,who:'법정',text:'제1회 공판을 엽니다.'}],done:null};
}
const world=(sheet,st)=>sheet.worlds[st.truth];
function check(sheet,st){if(lockOf(sheet,st.truth)!==st.lock)throw Error('잠긴 세계가 바뀌었습니다');}

/* What a witness will say, given who they lean to: the world whose account helps that side. */
function story(sheet,st,w){
 const real=world(sheet,st).saw[w.key];
 if(w.broken||w.stance==='honest'||!w.leans)return {from:st.truth,text:real};
 const want=w.leans===sheet.card.accused?'didnt':'did';
 if(st.truth===want)return {from:st.truth,text:real};
 return {from:want,text:sheet.worlds[want].saw[w.key]};
}
const name=(sheet,k)=>sheet.people.find(p=>p.key===k)?.name||k;
const push=(st,who,text,tag)=>st.log.push({day:st.day,who,text,tag:tag||null});

/* Which side a record helps in the locked world: compare its content with the did and didnt worlds. */
function leaning(sheet,st,id){const c=world(sheet,st).records[id],d=sheet.worlds.did.records[id],n=sheet.worlds.didnt.records[id];
 if(c===d&&c!==n)return 'p';if(c===n&&c!==d)return 'd';return null}
/* Does a record contradict what a witness has claimed? Yes when the claim comes from another world in which this record reads differently. */
const GENERIC=new Set(['기록','원본','감정','자료','내역','결과','사본','저장','검사','2층','3층','1층','없음','있음','시간','정도','평소','원래','나중','사건','사고','소견','특이','그때','당시','직접','모두','처음']);
const tokens=t=>new Set([...String(t).matchAll(/\d{1,2}:\d{2}|[가-힣A-Za-z]{2,}/g)].map(m=>m[0]).filter(x=>!GENERIC.has(x)));
/* A record bears on a witness when what the witness could say (in any world) and the record (title or any world's content) share a time or a word. */
function relevant(sheet,w,id){const rec=sheet.records.find(r=>r.id===id),said=tokens(TRUTHS.map(t=>sheet.worlds[t].saw[w.key]).join(' '));
 const on=tokens(rec.title+' '+TRUTHS.map(t=>sheet.worlds[t].records[id]).join(' '));for(const x of said)if(on.has(x))return true;return false}
/* Does a record contradict what a witness has claimed? Yes when the claim comes from another world in which this (relevant) record reads differently. */
const contradicts=(sheet,st,w,id)=>{const s=story(sheet,st,w);return s.from!==st.truth&&relevant(sheet,w,id)&&sheet.worlds[s.from].records[id]!==world(sheet,st).records[id]};

/* ---------- judge actions ---------- */
function available(sheet,st){
 if(st.done||st.actions<1)return [];
 const out=[];
 for(const w of Object.values(st.witnesses)){const p=sheet.people.find(x=>x.key===w.key);
  if(!w.said.open)out.push({type:'ask',w:w.key,q:'open',label:`${p.name}(${p.role})에게: 그날 직접 보고 들은 것`});
  else if(!w.said.detail)out.push({type:'ask',w:w.key,q:'detail',label:`${p.name}에게: 시각과 순서를 자세히`});
  if(!w.said.stake)out.push({type:'ask',w:w.key,q:'stake',label:`${p.name}에게: 사건 사람들과의 관계`});
  if(w.said.open)for(const [id,r] of Object.entries(st.records))if(r.status==='in'&&!w.said['c:'+id]&&relevant(sheet,w,id))out.push({type:'confront',w:w.key,r:id,label:`${p.name}에게 「${sheet.records.find(x=>x.id===id).title}」 제시`});
 }
 if(st.party.asked<2)out.push({type:'party',label:`피고인 ${name(sheet,sheet.card.accused)}에게 직접 묻기`});
 for(const r of sheet.records)if(st.records[r.id].status==='none')out.push({type:'order',r:r.id,label:`주문: ${r.unlock||r.title+' 제출'} (${sideOf(r.by)==='p'?'검찰':'변호인'})`});
 return out;
}
function act(sheet,st,a){
 check(sheet,st);if(st.done)throw Error('이미 선고했습니다');if(st.actions<1)throw Error('오늘 할 수 있는 일을 다 했습니다');
 st.actions--;const k=`${st.seed}:${st.day}:${st.log.length}`;
 if(a.type==='ask')ask(sheet,st,st.witnesses[a.w],a.q,k);
 else if(a.type==='confront')confront(sheet,st,st.witnesses[a.w],a.r,'judge',12,k);
 else if(a.type==='party')party(sheet,st,k);
 else if(a.type==='order')order(sheet,st,a.r);
 else throw Error('모르는 행동 '+a.type);
 return st;
}
function ask(sheet,st,w,q,k){
 const who=name(sheet,w.key),p=sheet.people.find(x=>x.key===w.key),s=story(sheet,st,w),lines=speak(s.text);
 if(q==='stake'){w.said.stake=true;push(st,who,p.stake&&!/없음/.test(p.stake)?`${p.role}입니다. ${speak(p.stake)[0]}`:`${p.role}입니다. 사건 사람들과 따로 아는 사이는 아닙니다.`,'관계');return}
 if(w.stance==='fear'&&!w.broken&&roll(k+'f')>w.r){w.said[q]=true;push(st,who,pick(['…잘 기억나지 않습니다.','그건 제가 말씀드리기 어렵습니다.','정확히는 모르겠습니다. 경황이 없었어요.'],k),'회피');return}
 const half=Math.ceil(lines.length/2),part=q==='open'?lines.slice(0,half):lines.slice(half).length?lines.slice(half):lines;
 const vague=w.m<=8&&roll(k+'m')>w.m+4;
 w.said[q]=true;w.said[q+':from']=s.from;
 push(st,who,(vague?part.map(blur):part).join(' '),s.from===st.truth?null:'거짓');
}
function confront(sheet,st,w,id,by,force,k){
 const who=name(sheet,w.key),rec=sheet.records.find(r=>r.id===id),content=world(sheet,st).records[id];
 w.said['c:'+id]=true;
 const asker=by==='judge'?'재판장':`${st.law[by].name} ${by==='p'?'검사':'변호사'}`;
 push(st,asker,`「${rec.title}」에는 이렇게 적혀 있습니다. "${content}" 증인의 말과 맞습니까?`);
 if(!relevant(sheet,w,id)){push(st,who,pick(['그 자료는 제가 본 일과는 관계가 없어서 잘 모르겠습니다.','그건 제가 직접 겪은 부분이 아닙니다.'],k),'확인');return 'unrelated'}
 if(!contradicts(sheet,st,w,id)){push(st,who,pick(['기록에 그렇게 나와 있다면 맞을 겁니다.','네, 제 기억과 다르지 않습니다.','그 부분은 기록이 맞습니다.'],k),'확인');return 'same'}
 if(w.broken)return 'same';
 const hold=w.r+roll(k+'r',8),hit=force+roll(k+'f',10);
 if(hit>hold){w.broken=true;const truth=speak(world(sheet,st).saw[w.key]);
  push(st,who,pick(['…죄송합니다. 사실대로 말씀드리겠습니다. ','기록을 보니 더는 숨길 수가 없네요. ','제가 앞서 한 말은 사실과 다릅니다. '],k+'b')+truth.join(' '),'번복');return 'broken'}
 w.cred-=1;push(st,who,pick(['기록이 왜 그렇게 나왔는지는 모르겠습니다. 제 기억은 그렇습니다.','기계가 틀릴 수도 있지 않습니까. 저는 본 대로 말했습니다.','그 기록은 제가 만든 게 아니라서요.'],k+'h'),'버팀');return 'held'}
function party(sheet,st,k){
 const A=sheet.people.find(p=>p.key===sheet.card.accused),W=world(sheet,st),who=A.name;st.party.asked++;
 const deny=/부인/.test(A.traits?.legalStance||'');const calm=num(A.traits?.composure);
 const guilty=st.truth!=='didnt';
 if(!guilty||!deny){push(st,who,speak(W.knows[A.key]).join(' '));return}
 const pressure=Object.entries(st.records).filter(([id,r])=>r.status==='in'&&leaning(sheet,st,id)==='p').length*3;
 if(st.party.asked>1&&roll(k+'pa')+pressure>calm+8){push(st,who,'…일부는 인정하겠습니다. '+speak(W.knows[A.key]).join(' '),'일부 인정');st.party.stance='admit';return}
 push(st,who,speak(sheet.worlds.didnt.knows[A.key]).join(' '),'부인');
}
function order(sheet,st,id){
 const rec=sheet.records.find(r=>r.id===id),side=sideOf(rec.by);st.records[id].status='ordered';
 st.orders.push({r:id,side,day:st.day});push(st,'재판장',`${side==='p'?'검찰':'변호인'}은 다음 기일까지 「${rec.title}」을(를) 제출하십시오.`,'주문');
}

/* ---------- end of a hearing day: lawyers move, orders come back ---------- */
function endDay(sheet,st){
 check(sheet,st);if(st.done)return st;const k=`${st.seed}:end:${st.day}`;
 for(const side of ['p','d'])lawyerMove(sheet,st,side,k+side);
 st.day++;st.actions=4;push(st,'법정',`제${st.day}회 공판을 엽니다.`);
 for(const o of st.orders.filter(o=>!o.done)){const L=st.law[o.side],rec=sheet.records.find(r=>r.id===o.r),R=st.records[o.r];
  const hurts=leaning(sheet,st,o.r)&&leaning(sheet,st,o.r)!==o.side;
  if(o.side==='d'&&sheet.card.kind==='criminal'&&hurts&&roll(k+o.r+'dec')>12){o.done=true;R.status='declined';push(st,`${L.name} 변호사`,`「${rec.title}」은 제출하지 않겠습니다. 피고인에게 그럴 의무는 없습니다.`,'제출 거부');continue}
  if(roll(k+o.r+'late')>L.prep+6&&!o.late){o.late=true;push(st,`${L.name} ${o.side==='p'?'검사':'변호사'}`,`「${rec.title}」은 회신이 늦어 다음 기일에 내겠습니다.`,'지연');continue}
  o.done=true;R.status='in';R.day=st.day;push(st,'법정',`새 자료 도착: 「${rec.title}」 — ${world(sheet,st).records[o.r]}`,'새 자료');
  if(/시계|시각/.test(rec.title+rec.unlock))for(const r of Object.values(st.records))r.disputed=false;}
 return st;
}
function lawyerMove(sheet,st,side,k){
 const L=st.law[side],who=`${L.name} ${side==='p'?'검사':'변호사'}`,other=side==='p'?'d':'p';
 // a witness lying for the other side, and a record in court that contradicts them: confront (any tactic, if prepared)
 for(const w of Object.values(st.witnesses)){if(w.broken||!w.said.open)continue;const helps=w.leans===sheet.card.accused?'d':w.leans===sheet.card.complainant?'p':null;
  if(helps!==other)continue;const id=Object.keys(st.records).find(r=>st.records[r].status==='in'&&contradicts(sheet,st,w,r)&&!w.said['c:'+r]);
  if(id&&(L.tactic==='press'||roll(k+'see')<=L.prep)){confront(sheet,st,w,id,side,L.exam,k+'c');return}}
 if(L.tactic==='clock'){const dev=new Map(sheet.devices.map(d=>[d.id,d]));
  const id=sheet.records.find(r=>st.records[r.id].status==='in'&&!st.records[r.id].disputed&&dev.get(r.device)?.clockOffsetSec&&leaning(sheet,st,r.id)!==side)?.id;
  const fixed=sheet.records.some(r=>/시계|시각/.test(r.title+(r.unlock||''))&&st.records[r.id].status==='in');
  if(id&&!fixed){st.records[id].disputed=true;push(st,who,`「${sheet.records.find(r=>r.id===id).title}」의 시각이 다른 기록과 맞지 않습니다. 이 자료로는 그 순간을 증명할 수 없습니다.`,'시각 공방');return}}
 if(L.tactic==='source'){const id=sheet.records.find(r=>st.records[r.id].status==='in'&&!st.records[r.id].disputed&&/사본|요약|점검.*않|하지 않음|빠져/.test(r.how)&&leaning(sheet,st,r.id)!==side)?.id;
  if(id){st.records[id].disputed=true;push(st,who,`「${sheet.records.find(r=>r.id===id).title}」은 ${sheet.records.find(r=>r.id===id).how.split(/[.,]/)[0]}. 원본성과 확보 경위를 믿기 어렵습니다.`,'증거 다툼');return}}
 // press: shake an honest but forgetful witness who hurts this side
 const target=Object.values(st.witnesses).find(w=>w.said.open&&w.m<=11&&w.stance==='honest'&&!w.shaken&&(w.leans!==(side==='p'?sheet.card.complainant:sheet.card.accused)));
 if(target&&(L.tactic==='press'||roll(k+'pr')<=6)&&L.exam+roll(k+'x',8)>target.m+8){target.shaken=true;target.cred-=1;
  push(st,who,`${name(sheet,target.key)} 증인, 그 시각을 시계로 직접 확인했습니까?`);push(st,name(sheet,target.key),'…시계를 본 건 아닙니다. 그쯤이었다고 생각합니다.','흔들림');return}
 push(st,who,pick(side==='p'?['지금까지 드러난 자료로 공소사실은 충분히 뒷받침됩니다.','피해의 결과와 피고인의 행동 사이를 다음 기일에 더 밝히겠습니다.']:['검찰의 주장은 추측을 사실처럼 말하고 있습니다.','아직 그 순간을 직접 보여 주는 자료는 하나도 없습니다.'],k+'idle'));
}

/* ---------- verdict: graded on what the court saw ---------- */
function consistent(sheet,st){
 const seen=Object.entries(st.records).filter(([,r])=>r.status==='in'&&!r.disputed).map(([id])=>id);   // a record whose time or origin is still in dispute proves nothing yet
 const told=Object.values(st.witnesses).filter(w=>w.broken).map(w=>w.key);
 return TRUTHS.filter(t=>seen.every(id=>sheet.worlds[t].records[id]===world(sheet,st).records[id])&&told.every(k=>sheet.worlds[t].saw[k]===world(sheet,st).saw[k]));
}
function verdict(sheet,st,choice){
 check(sheet,st);if(!TRUTHS.includes(choice))throw Error('판결 선택지는 did · didnt · reason');
 const open=consistent(sheet,st),right=choice===st.truth;
 const grade=right&&open.length===1?'바른 판단 — 법정 기록으로 가려낼 수 있었음':right?'바른 판단 — 다만 기록만으로는 단정하기 어려웠음':open.includes(choice)?'오판 — 기록으로는 가려내기 어려웠음':'오판 — 기록에 반대 근거가 있었음';
 st.done={choice,grade,open,day:st.day};push(st,'재판장',`판단: ${sheet.worlds[choice].legal}`,'선고');
 return st.done;
}
function reveal(sheet,st){return {truth:st.truth,label:sheet.worlds[st.truth].label,act:sheet.worlds[st.truth].act,lock:st.lock}}
return Object.freeze({start,available,act,endDay,verdict,reveal,consistent,speak,TACTICS,word,lockOf});
});
