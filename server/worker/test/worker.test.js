/* Offline tests of the Worker: auth gate, invite list, limits under parallel calls, usage records, meaning checks and
 * the fallback. OpenAI and Supabase are replaced by a fake fetch, so this runs anywhere: `npm test` */
import test from 'node:test';
import assert from 'node:assert/strict';
import {handle,costOf,outputText,estimate} from '../src/index.js';
import {checkNpc,checkArticle,checkJudgment,npcPrompt,numbersIn,sentencesIn,guard,negated} from '../src/prompts.js';

const env={SUPABASE_URL:'https://sb.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'svc',OPENAI_API_KEY:'sk-test',
 ALLOWED_ORIGINS:'https://gambitblues.github.io',ALLOWED_EMAILS:'a@x.kr,b@x.kr',MODEL_CASE:'gpt-6.1-terra',MODEL_TALK:'gpt-6-luna',
 PRICES:'{"gpt-6.1-terra":{"in":1,"out":5},"gpt-6-luna":{"in":0.1,"out":0.5}}',DAILY_CALLS:'3',DAILY_USD:'1'};

/* fake services. reserve() keeps a real count like the database function, so parallel calls are counted honestly */
function fake({email='a@x.kr',inDb=true,reply,same=true,reserveDown=false,playersDown=false,limit=3}={}){
 const log=[],usage=[];let openai=0;
 const f=async(url,opt={})=>{const u=String(url);log.push({url:u,opt});
  const ok=(data,s=200)=>new Response(JSON.stringify(data),{status:s,headers:{'content-type':'application/json'}});
  if(u.endsWith('/auth/v1/user'))return /good/.test(opt.headers.authorization)?ok({id:'u1',email}):ok({},401);
  if(u.includes('/rest/v1/players'))return playersDown?ok({},500):ok(inDb?[{email}]:[]);
  if(u.endsWith('/rpc/ai_reserve')){if(reserveDown)return ok({message:'down'},500);await new Promise(r=>setTimeout(r,5));
   if(usage.length>=limit)return ok(null);usage.push({}); return ok(usage.length)}
  if(u.endsWith('/rpc/ai_finish')){const b=JSON.parse(opt.body);Object.assign(usage[b.p_id-1],b);return new Response(null,{status:204})}
  if(u.endsWith('/rpc/ai_usage_today'))return ok([{calls:usage.length,usd:0}]);
  if(u.endsWith('/v1/responses')){openai++;assert.equal(opt.headers.authorization,'Bearer sk-test');const b=JSON.parse(opt.body);assert.equal(b.store,false);
   const verify=b.text.format.name==='meaning_check';
   const out=verify?{same,problem:same?'':'증언의 뜻이 바뀜'}:reply;
   return ok({model:b.model,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(out)}]}],usage:{input_tokens:verify?300:1000,output_tokens:verify?20:200}})}
  if(u.includes('/v1/models/'))return ok({id:u.split('/').pop()});
  throw new Error('unexpected '+u)};
 f.log=log;f.usage=usage;Object.defineProperty(f,'openai',{get:()=>openai});return f;
}
const req=(path,body,token='good',origin='https://gambitblues.github.io')=>new Request('https://api.test'+path,{method:body?'POST':'GET',
 headers:{authorization:token?`Bearer ${token}`:'',origin,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
const NPC={role:'카페 매니저',attitude:'honest',names:['김혜진','홍슬기'],question:'그날 현금은 어떻게 처리했습니까?',answer:'매일 밤 10시에 김혜진 대표님이 현금을 직접 가져갔어요. 3천만 원쯤 됐을 거예요.'};
const GOOD={text:'매일 밤 10시쯤 김혜진 대표님이 현금을 직접 챙겨 가셨어요. 3천만 원쯤 됐을 거예요.'};

test('no token, bad token, uninvited, not in the database list: refused before any AI call',async()=>{
 let f=fake();assert.equal((await handle(req('/ai/npc',NPC,''),env,f)).status,401);
 assert.equal((await handle(req('/ai/npc',NPC,'bad'),env,f)).status,401);
 f=fake({email:'stranger@x.kr'});assert.equal((await handle(req('/ai/npc',NPC),env,f)).status,403);
 f=fake({inDb:false});assert.equal((await handle(req('/ai/npc',NPC),env,f)).status,403,'in the Worker list but not in the database list');
 f=fake({playersDown:true});assert.equal((await handle(req('/ai/npc',NPC),env,f)).status,503,'invite list unreachable → refused');
 assert.equal(f.openai,0);
});
test('usage store unreachable: no AI call at all',async()=>{
 const f=fake({reserveDown:true,reply:GOOD});const r=await handle(req('/ai/npc',NPC),env,f);
 assert.equal(r.status,503);assert.equal((await r.json()).error,'usage_unavailable');assert.equal(f.openai,0);
});
test('parallel calls cannot pass the daily limit',async()=>{
 const f=fake({reply:GOOD,limit:3});
 const rs=await Promise.all(Array.from({length:6},()=>handle(req('/ai/npc',NPC),env,f)));
 assert.deepEqual(rs.map(r=>r.status).sort(),[200,200,200,429,429,429]);
 assert.equal(f.openai,6,'3 calls × (rewrite + meaning check); the 3 refused never reach OpenAI');
});
test('NPC answer: rewritten, checked twice, recorded with model, tokens and cost',async()=>{
 const f=fake({reply:GOOD});const d=await (await handle(req('/ai/npc',NPC),env,f)).json();
 assert.equal(d.ok,true);assert.equal(d.result.text,GOOD.text);
 const row=f.usage[0];assert.deepEqual([row.p_model,row.p_in,row.p_out,row.p_ok],['gpt-6-luna',1300,220,true]);
 assert.equal(row.p_cost,Number(((1300*0.1+220*0.5)/1e6).toFixed(6)));
});
test('meaning changes fall back to the engine text: number, yes/no, a new person, the checker says different',async()=>{
 const cases=[
  [{text:'매일 밤 11시에 김혜진 대표님이 현금을 직접 가져갔어요. 3천만 원쯤 됐을 거예요.'},'numbers'],
  [{text:'매일 밤 10시에 김혜진 대표님은 현금을 가져가지 않았어요. 3천만 원쯤이었을 거예요.'},'polarity'],
  [{text:'매일 밤 10시에 홍슬기 씨가 현금을 직접 가져갔어요. 3천만 원쯤 됐을 거예요.'},'person_dropped'],
 ];
 for(const [reply,why] of cases){const f=fake({reply});const d=await (await handle(req('/ai/npc',NPC),env,f)).json();
  assert.deepEqual([d.ok,d.fallback,d.why],[false,true,why]);assert.equal(f.usage[0].p_ok,false,'the failed call is still recorded')}
 const f=fake({reply:{text:'매일 밤 10시에 김혜진 대표님이 현금을 직접 가져갔습니다. 3천만 원이었습니다.'},same:false});
 const d=await (await handle(req('/ai/npc',NPC),env,f)).json();assert.equal(d.ok,false);assert.match(d.why,/^meaning/);
});
test('deliberate failure for the live fallback test only works when the deployment allows it',async()=>{
 let f=fake({reply:GOOD});let d=await (await handle(req('/ai/npc',{...NPC,test:'fail'}),env,f)).json();assert.equal(d.ok,true,'ignored by default');
 f=fake({reply:GOOD});d=await (await handle(req('/ai/npc',{...NPC,test:'fail'}),{...env,ALLOW_TEST_FAIL:'1'},f)).json();
 assert.deepEqual([d.ok,d.fallback,d.why],[false,true,'test_fail']);assert.equal(f.openai,0);
});
test('article: title and 2~4 sentences of about 100~200 characters, same facts',async()=>{
 const base={outlet:'법조일보',reporter:'김기자',lean:'p',phase:'before',caseName:'친목 모임의 공동투자금',names:['김혜진'],title:'동창 돈 3억, 7천만 원은 어디로',body:'동창 12명이 모은 3억 원 가운데 7천만 원이 개업 엿새 만에 빚 갚는 데 쓰였다. 검찰은 처음부터 속일 생각이었다고 본다. 김혜진 씨는 사업을 살리려 했다고 말한다.'};
 const good={title:'동창 12명의 3억, 엿새 만에 사라진 7천만 원',body:'동창 12명이 모은 3억 원 중 7천만 원이 카페 문을 연 지 엿새 만에 빚 갚는 데 쓰였다. 검찰은 처음부터 속일 생각이었다고 본다. 김혜진 씨는 가게를 살리려 했을 뿐이라고 맞선다.'};
 assert.equal(checkArticle(base,good).ok,true);
 assert.equal(checkArticle(base,{...good,body:'짧다.'}).why,'sentences');
 assert.equal(checkArticle(base,{...good,body:good.body.replace('7천만','8천만')}).why,'numbers');
 const f=fake({reply:good});const d=await (await handle(req('/ai/article',base),env,f)).json();assert.equal(d.ok,true);
});
test('opening: two sides share one verified and metered call',async()=>{
 const base={openingA:'검사는 현장 출입 기록을 근거로 주장했다.',openingB:'변호인은 기록이 부정확하다고 반박했다.',names:[]};
 const reply={openingA:base.openingA,openingB:base.openingB};
 const f=fake({reply});
 const d=await (await handle(req('/ai/opening',base),env,f)).json();
 assert.equal(d.ok,true);
 assert.deepEqual(d.result,reply);
 assert.equal(f.openai,2,'one generation and one meaning verification for both sides');
 assert.equal(f.usage[0].p_ok,true);
});
test('opening: changed side argument falls back without displaying AI output',async()=>{
 const base={openingA:'검사는 10명이 현장에 있었다고 주장했다.',openingB:'변호인은 그 수가 확인되지 않았다고 반박했다.',names:[]};
 const f=fake({reply:{openingA:'검사는 11명이 현장에 있었다고 주장했다.',openingB:base.openingB}});
 const d=await (await handle(req('/ai/opening',base),env,f)).json();
 assert.equal(d.ok,false);assert.equal(d.fallback,true);
 assert.equal(d.why,'numbers');
 assert.equal(f.usage[0].p_ok,false);
});

test('judgment: order is not sent, sections, numbers, quotes, people and yes/no stay',()=>{
 const p={names:['홍슬기','김혜진'],facts:['재판부는 다음 사실을 인정한다.','카페 통장 거래 내역에 따르면 투자금 중 7천만 원이 김혜진의 개인 빚 상환에 쓰였다.','홍슬기는 "3천만 원이 비어요"라고 진술했다.'],
  issues:[{title:'7천만 원은 어디에 쓰였나',text:'카페 통장 거래 내역에 비추어 검사의 주장이 인정된다.'}],conclusion:'피고인 김혜진에게 징역 2년 6개월을 선고한다.'};
 const ok={facts:['재판부는 다음 사실을 인정한다.','카페 통장 거래 내역을 보면, 투자금 가운데 7천만 원이 김혜진의 개인 빚 상환에 쓰였다.','홍슬기는 법정에서 "3천만 원이 비어요"라고 진술하였다.'],
  issues:[{title:'7천만 원은 어디에 쓰였나',text:'카페 통장 거래 내역에 비추어 보면 검사의 주장이 인정된다.'}],conclusion:'피고인 김혜진에게 징역 2년 6개월을 선고한다.'};
 assert.equal(checkJudgment(p,ok).ok,true);
 assert.equal(checkJudgment(p,{...ok,conclusion:'피고인 김혜진에게 징역 3년을 선고한다.'}).why,'numbers');
 assert.equal(checkJudgment(p,{...ok,facts:ok.facts.slice(1)}).why,'sections');
 assert.equal(checkJudgment(p,{...ok,facts:[ok.facts[0],ok.facts[1],'홍슬기는 돈이 비었다고 진술하였다.']}).why,'numbers');
 assert.equal(checkJudgment(p,{...ok,issues:[{title:'돈의 행방',text:ok.issues[0].text}]}).why,'issue_titles');
 assert.equal(checkJudgment(p,{...ok,issues:[{title:ok.issues[0].title,text:'카페 통장 거래 내역에 비추어 보면 검사의 주장은 인정되지 않는다.'}]}).why,'polarity');
});
test('helpers',()=>{
 assert.deepEqual(numbersIn('3,000만 원 · 08:17 · 2.5배'),['3000','08:17','2.5']);
 assert.equal(sentencesIn('하나다. 둘이다. 셋이다.').length,3);
 assert.equal(outputText({output_text:'{"a":1}'}),'{"a":1}');
 assert.equal(costOf(env,'gpt-6.1-terra',{input_tokens:1e6,output_tokens:1e6}),6);
 assert.ok(estimate(env,'gpt-6-luna',1000,400,true)>estimate(env,'gpt-6-luna',1000,400,false));
 assert.ok(npcPrompt({answer:'',question:'?'}).error);
 assert.equal(checkNpc(NPC,{text:'네.'}).why,'length');
 assert.equal(negated('본 적이 없어요'),true);assert.equal(negated('봤어요'),false);
 assert.equal(guard('그날 창고 문을 제가 직접 잠갔고 열쇠는 사무실 서랍에 두었어요','그날 창고 문은 누군가 열어 두었고 저는 그걸 몰랐어요'),'content');
});
test('model check endpoint reports each configured model',async()=>{
 const d=await (await handle(req('/ai/check'),env,fake())).json();
 assert.deepEqual(Object.keys(d.models),['gpt-6.1-terra','gpt-6-luna']);
});

test('closing: original two sides share one verified metered call',async()=>{
 const base={openingA:'검사는 현장 출입 기록을 근거로 주장했다.',openingB:'변호인은 기록이 부정확하다고 반박했다.',names:[]};
 const f=fake({reply:{openingA:base.openingA,openingB:base.openingB}});
 const d=await (await handle(req('/ai/closing',base),env,f)).json();
 assert.equal(d.ok,true);
 assert.equal(f.openai,2);
 assert.equal(f.usage[0].p_ok,true);
});
test('bench: factual memo is verified before it is returned',async()=>{
 const source='쟁점 사고 경위 — 검사·원고 측 자료 1건, 변호·피고 측 자료 1건. 현장 기록은 2026.12.21에 작성됐다. 남은 확인: 미결정 증거 1건.';
 const base={source,names:[]};
 let f=fake({reply:{text:source}});
 let d=await (await handle(req('/ai/bench',base),env,f)).json();
 assert.equal(d.ok,true);
 assert.equal(f.openai,2);
 f=fake({reply:{text:source.replace('자료 1건','자료 2건')}});
 d=await (await handle(req('/ai/bench',base),env,f)).json();
 assert.equal(d.ok,false);
 assert.equal(d.why,'numbers');
 assert.equal(f.openai,1,'invalid response is rejected before paying for second verifier');
});

test('objection exchange uses one generation and one verification for two known arguments',async()=>{
 const base={openingA:'검사는 기록이 부정확하다고 이의를 신청했다.',openingB:'변호인은 기록이 정확하다고 반박했다.',names:[]};
 const f=fake({reply:{openingA:base.openingA,openingB:base.openingB}});
 const d=await (await handle(req('/ai/exchange',base),env,f)).json();
 assert.equal(d.ok,true);
 assert.equal(f.openai,2);
 assert.equal(f.usage[0].p_ok,true);
});
