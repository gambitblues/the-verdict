/* Prompts and answer checks for THE VERDICT API.
 * Every builder takes only what the player can already see on screen, and every check makes sure the model changed
 * wording and nothing else: numbers, names in quotes, the order of a judgment and its sections stay as the engine wrote
 * them. A failed check returns {ok:false} and the browser keeps the engine's own text. */

const S=v=>String(v??'').replace(/\s+/g,' ').trim();
const cap=(v,n)=>S(v).slice(0,n);
/* numbers as written (2억, 3,000만, 08:17, 1.5) → comparable tokens */
export const numbersIn=t=>(S(t).match(/\d[\d,.:]*\d|\d/g)||[]).map(x=>x.replace(/,/g,'').replace(/[.:]$/,''));
const sameNumbers=(src,out)=>{const a=numbersIn(src),b=numbersIn(out);return b.every(x=>a.includes(x))&&a.every(x=>b.includes(x))};
const quotesIn=t=>S(t).match(/"[^"]{2,}"|“[^”]{2,}”/g)||[];
/* Normalize complete dates so 2026.12.21 and 2026년 12월 21일 compare equally.
 * Reject additions, omissions, or actual changes rather than weakening the meaning guard. */
export const datesIn=t=>{
 const re=/(\d{4})\s*(?:년\s*|[.\/-]\s*)(\d{1,2})\s*(?:월\s*|[.\/-]\s*)(\d{1,2})\s*(?:일)?/g;
 return [...new Set([...S(t).matchAll(re)].map(m=>m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0')))].sort();
};
const sameDates=(a,b)=>JSON.stringify(datesIn(a))===JSON.stringify(datesIn(b));
const dateView=t=>S(t).replace(/(\d{4})\s*(?:년\s*|[.\/-]\s*)(\d{1,2})\s*(?:월\s*|[.\/-]\s*)(\d{1,2})\s*(?:일)?/g,(_,y,m,d)=>y+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0'));
const numbersWithoutDates=t=>numbersIn(S(t).replace(/\d{4}\s*(?:년\s*|[.\/-]\s*)\d{1,2}\s*(?:월\s*|[.\/-]\s*)\d{1,2}\s*(?:일)?/g,' '));
/* sentences end in 다/요/까 followed by a stop (Korean news and testimony) */
export const sentencesIn=t=>S(t).split(/(?<=[.!?。])\s+/).filter(x=>x.length>1);

/* ---------- meaning guards (no model needed) ----------
 * people: every listed name the source mentions must stay, and no listed name may appear that the source did not have.
 * polarity: a sentence that denied something must still deny it, and the other way round (않/안/못/없/아니/모르…).
 * content: most of the source's own words (2+ syllables, endings stripped) must still be there. */
const NEG=/않|안 |안했|못|없|아니|모르|모릅|아뇨|부인/;
export const negated=t=>NEG.test(' '+S(t)+' ');
const stem=w=>w.replace(/(으로|에게|에서|까지|부터|처럼|이라고|라고|이라는|라는|이에요|예요|입니다|습니다|했어요|어요|아요|해요|와|과|가|이|를|을|은|는|의|에|로|도|만|요|다)$/,'');
export const words=t=>[...new Set((S(t).match(/[가-힣A-Za-z0-9]{2,}/g)||[]).map(stem).filter(w=>w.length>=2))];
export function guard(src,out,{names=[],keep=0.5}={}){
 for(const n of names){const a=S(src).includes(n),b=S(out).includes(n);if(a&&!b)return 'person_dropped';if(!a&&b)return 'person_added'}
 if(negated(src)!==negated(out))return 'polarity';
 const w=words(src);if(w.length>=4){const o=S(out);const kept=w.filter(x=>o.includes(x)).length/w.length;if(kept<keep)return 'content'}
 return null;
}
const namesOf=p=>(Array.isArray(p.names)?p.names:[]).map(S).filter(n=>n.length>=2).slice(0,40);

/* ---------- second opinion: a separate short call compares the two texts' meaning ---------- */
export function verifyPrompt(kind,src,out){
 return {instructions:`두 글을 비교하는 검사원입니다. B가 A의 표현만 바꾼 글인지 확인합니다.
다음 중 하나라도 있으면 same=false입니다: B에 A에 없는 사실·사람·장소·시각·숫자가 있음, A의 사실이 빠지거나 바뀜, 인정과 부인(긍정·부정)이 뒤집힘, 누가 무엇을 했는지가 바뀜, 증언이라면 증인이 말하는 뜻이 달라짐, 확신의 정도가 크게 달라짐(“~였을 거예요”를 “~였습니다”로 단정 등).
말투·어순·문장 나누기·같은 뜻의 다른 낱말, 2026.12.21과 2026년 12월 21일처럼 동일한 날짜의 표기 변화는 괜찮습니다.`,
  input:`종류: ${kind}\nA(원래 글): ${cap(dateView(src),3000)}\nB(바꾼 글): ${cap(dateView(out),3000)}`,
  schema:{name:'meaning_check',schema:{type:'object',additionalProperties:false,required:['same','problem'],properties:{same:{type:'boolean'},problem:{type:'string'}}}}};
}

const COMMON=`당신은 한국 법정 시뮬레이션 게임 THE VERDICT의 문장 담당입니다.
- 쓰는 말: 고등학생도 이해할 쉬운 한국어. 어려운 법률 용어, 영어, 이모지, 마크다운을 쓰지 않습니다.
- 사실은 주어진 글에 있는 것만 씁니다. 사람·장소·시각·금액·숫자를 새로 만들거나 바꾸지 않습니다.
- 누가 유죄인지, 진실이 무엇인지 짐작해 덧붙이지 않습니다.`;

/* ---------- a witness's answer ---------- */
const ATT={honest:'아는 대로 차분히 말한다',shield:'누군가를 감싸려 말을 아끼고 조심스럽다',fear:'겁을 먹어 머뭇거린다',flip:'앞서 한 말과 달라져 조금 흔들린다'};
export function npcPrompt(p){
 const answer=cap(p.answer,400),question=cap(p.question,200);
 if(!answer||!question)return {error:'missing_text'};
 return {instructions:`${COMMON}
지금 할 일: 증인석에 선 사람의 답을, 그 사람이 실제로 법정에서 말하듯 자연스럽게 다시 씁니다.
- 원래 답의 내용, 인정하거나 부인하는 방향, 숫자와 시각은 그대로 둡니다.
- 존댓말 구어체로 1~3문장. 원래 답보다 너무 길게 쓰지 않습니다.
- 질문에 없는 다른 이야기로 새지 않습니다.`,
  input:`증인: ${cap(p.role,40)}${p.years?` (${cap(p.years,20)})`:''}
태도: ${ATT[p.attitude]||ATT.honest}
질문: ${question}
원래 답: ${answer}`,
  schema:{name:'witness_answer',schema:{type:'object',additionalProperties:false,required:['text'],properties:{text:{type:'string'}}}}};
}
export function checkNpc(p,out){
 const text=S(out?.text),src=S(p.answer);
 if(!text)return {ok:false,why:'empty'};
 if(text.length>Math.max(60,src.length*1.8+20)||text.length<Math.min(src.length*0.5,12))return {ok:false,why:'length'};
 if(!sameNumbers(src,text))return {ok:false,why:'numbers'};
 if(sentencesIn(text).length>3)return {ok:false,why:'too_many_sentences'};
 const g=guard(src,text,{names:namesOf(p),keep:0.5});if(g)return {ok:false,why:g};
 return {ok:true,value:{text},compare:[src,text]};
}

/* ---------- opening statements: both sides in a single call, no new arguments ---------- */
export function openingPrompt(p){
 const a=cap(p.openingA,700),b=cap(p.openingB,700);
 if(!a||!b)return {error:'missing_text'};
 return {instructions:`${COMMON}
지금 할 일: 재판 첫 기일에 나온 양측 입장 두 개를 실제 법정에서 듣기 편한 한국어로 다듬습니다.
- 첫 번째와 두 번째의 입장, 사람, 숫자, 금액, 시각, 확신 정도를 각각 그대로 유지합니다.
- 상대방의 주장이나 근거를 한쪽 발언에 옮기지 않습니다.
- 원문에 없는 사실, 법령, 증거를 추가하지 않습니다.
- 각 발언은 최대 3문장, 원래 주장보다 지나치게 길지 않게 작성합니다.`,
  input:`첫 번째 입장: ${a}\n두 번째 입장: ${b}`,
  schema:{name:'opening_statements',schema:{type:'object',additionalProperties:false,required:['openingA','openingB'],properties:{openingA:{type:'string'},openingB:{type:'string'}}}}};
}
export function checkOpening(p,out){
 const result={};const pairs=[];
 for(const k of ['openingA','openingB']){
  const src=S(p[k]),text=S(out?.[k]);
  if(!src||!text)return {ok:false,why:'empty'};
  if(text.length>src.length*1.7+30||text.length<Math.min(src.length*0.4,12))return {ok:false,why:'length'};
  if(!sameDates(src,text))return {ok:false,why:'dates'};
  const originalNums=numbersWithoutDates(src),revisedNums=numbersWithoutDates(text);
  if(originalNums.length!==revisedNums.length||!originalNums.every((x,i)=>x===revisedNums[i]))return {ok:false,why:'numbers'};
  if(sentencesIn(text).length>3)return {ok:false,why:'sentences'};
  const g=guard(src,text,{names:namesOf(p),keep:0.5});if(g)return {ok:false,why:g};
  result[k]=text;pairs.push([src,text]);
 }
 return {ok:true,value:result,compare:[pairs.map(x=>x[0]).join('\n---\n'),pairs.map(x=>x[1]).join('\n---\n')]};
}

/* ---------- a reporter's article: title + 2~4 sentences, about 100~200 characters ---------- */
export function articlePrompt(p){
 const body=cap(p.body,700),title=cap(p.title,80);
 if(!body||!title)return {error:'missing_text'};
 const lean=p.lean==='p'?'원고·검찰 쪽 시각':p.lean==='d'?'피고·변호인 쪽 시각':'중립';
 return {instructions:`${COMMON}
지금 할 일: 신문 기사 한 편을 다시 씁니다.
- 제목 1개(40자 이내)와 본문 2~4문장, 본문 전체 100~200자.
- 기자의 시각과 말투를 살리되, 바탕 기사에 있는 사실만 씁니다. 원문에 적힌 사건 날짜(연·월·일)는 반드시 모두 유지하며 추가하거나 변경하지 않습니다. 날짜 표기 방식만 바꿀 수 있습니다. 다른 숫자도 바꾸지 않습니다.
- 기사 문체(~했다, ~이다)로 씁니다.`,
  input:`언론사: ${cap(p.outlet,30)}
기자: ${cap(p.reporter,20)}${p.style?` · 문체: ${cap(p.style,60)}`:''}
시각: ${lean}
시점: ${p.phase==='after'?'선고 뒤 평가':'재판 전·중 전망'}${p.tone?` · 논조: ${cap(p.tone,10)}`:''}
사건: ${cap(p.caseName,60)}
바탕 기사 제목: ${title}
바탕 기사 본문: ${body}`,
  schema:{name:'news_article',schema:{type:'object',additionalProperties:false,required:['title','body'],properties:{title:{type:'string'},body:{type:'string'}}}}};
}
export function checkArticle(p,out){
 const title=S(out?.title),body=S(out?.body),src=S(p.title)+' '+S(p.body);
 if(!title||title.length>45)return {ok:false,why:'title'};
 const n=sentencesIn(body).length;
 if(n<2||n>4)return {ok:false,why:'sentences'};
 if(body.length<80||body.length>240)return {ok:false,why:'length'};
 if(!sameDates(src,title+' '+body))return {ok:false,why:'dates'};
 const b=numbersWithoutDates(title+' '+body),a=numbersWithoutDates(src);if(!b.every(x=>a.includes(x)))return {ok:false,why:'numbers'};
 for(const n of namesOf(p))if(!src.includes(n)&&(title+body).includes(n))return {ok:false,why:'person_added'};
 if(negated(S(p.body))!==negated(body))return {ok:false,why:'polarity'};
 return {ok:true,value:{title,body},compare:[src,title+' '+body]};
}

/* ---------- a judgment: the engine's order, sections and every number stay; only sentences change ---------- */
export function judgmentPrompt(p){
 const facts=(p.facts||[]).slice(0,30).map(x=>cap(x,500)),issues=(p.issues||[]).slice(0,10).map(x=>({title:cap(x.title,80),text:cap(x.text,700)}));
 const conclusion=cap(p.conclusion,1200);
 if(!facts.length&&!issues.length&&!conclusion)return {error:'missing_text'};
 return {instructions:`${COMMON}
지금 할 일: 판사가 쓴 판결문 초안의 문장만 매끄럽게 다듬습니다.
- 판결 결과, 형량, 금액, 날짜, 숫자, 사람 이름, 따옴표 안의 말은 한 글자도 바꾸지 않습니다.
- 인정 사실은 같은 개수, 같은 순서로 돌려줍니다. 쟁점은 같은 제목, 같은 순서로 돌려줍니다.
- 근거를 빼거나 더하지 않습니다. 판결문다운 단정한 문체(~이다, ~한다)로 씁니다.`,
  input:JSON.stringify({facts,issues,conclusion}),
  schema:{name:'judgment_text',schema:{type:'object',additionalProperties:false,required:['facts','issues','conclusion'],properties:{
   facts:{type:'array',items:{type:'string'}},
   issues:{type:'array',items:{type:'object',additionalProperties:false,required:['title','text'],properties:{title:{type:'string'},text:{type:'string'}}}},
   conclusion:{type:'string'}}}}};
}
export function checkJudgment(p,out){
 const facts=(p.facts||[]).map(S),issues=(p.issues||[]).map(x=>({title:S(x.title),text:S(x.text)})),conclusion=S(p.conclusion);
 const of=(out?.facts||[]).map(S),oi=(out?.issues||[]).map(x=>({title:S(x?.title),text:S(x?.text)})),oc=S(out?.conclusion);
 if(of.length!==facts.length||oi.length!==issues.length)return {ok:false,why:'sections'};
 if(oi.some((x,i)=>x.title!==issues[i].title))return {ok:false,why:'issue_titles'};
 const pairs=[...facts.map((x,i)=>[x,of[i]]),...issues.map((x,i)=>[x.text,oi[i].text]),[conclusion,oc]];
 for(const [a,b] of pairs){
  if(a&&!b)return {ok:false,why:'empty_part'};
  if(!sameNumbers(a,b))return {ok:false,why:'numbers'};
  if(quotesIn(a).some(q=>!b.includes(q.slice(1,-1))))return {ok:false,why:'quotes'};
  if(b.length>a.length*1.6+40)return {ok:false,why:'length'};
  const g=guard(a,b,{names:namesOf(p),keep:0.6});if(g)return {ok:false,why:g};
 }
 return {ok:true,value:{facts:of,issues:oi,conclusion:oc},compare:[pairs.map(x=>x[0]).join('\n'),pairs.map(x=>x[1]).join('\n')]};
}
