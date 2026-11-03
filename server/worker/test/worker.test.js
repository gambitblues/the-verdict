/* Offline tests of the Worker: auth gate, limits, usage logging, fallback, and the answer checks.
 * OpenAI and Supabase are replaced by a fake fetch, so this runs anywhere: `node --test test/` */
import test from 'node:test';
import assert from 'node:assert/strict';
import {handle,costOf,outputText} from '../src/index.js';
import {checkNpc,checkArticle,checkJudgment,npcPrompt,numbersIn,sentencesIn} from '../src/prompts.js';

const env={SUPABASE_URL:'https://sb.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'svc',OPENAI_API_KEY:'sk-test',
 ALLOWED_ORIGINS:'https://gambitblues.github.io',ALLOWED_EMAILS:'a@x.kr,b@x.kr',MODEL_CASE:'gpt-6.1-terra',MODEL_TALK:'gpt-6-luna',
 PRICES:'{"gpt-6.1-terra":{"in":1,"out":5},"gpt-6-luna":{"in":0.1,"out":0.5}}',DAILY_CALLS:'3',DAILY_USD:'1'};

function fake({email='a@x.kr',calls=0,reply,status=200}={}){
 const log=[];
 const f=async(url,opt={})=>{const u=String(url);log.push({url:u,opt});
  const ok=(data,s=200)=>new Response(JSON.stringify(data),{status:s,headers:{'content-type':'application/json'}});
  if(u.endsWith('/auth/v1/user'))return /good/.test(opt.headers.authorization)?ok({id:'u1',email}):ok({},401);
  if(u.endsWith('/rpc/ai_usage_today'))return ok([{calls,usd:0}]);
  if(u.endsWith('/rest/v1/ai_usage'))return new Response(null,{status:201});
  if(u.endsWith('/v1/responses')){assert.equal(opt.headers.authorization,'Bearer sk-test');const b=JSON.parse(opt.body);assert.equal(b.store,false);
   return ok({model:b.model,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(reply)}]}],usage:{input_tokens:1000,output_tokens:200}},status)}
  if(u.includes('/v1/models/'))return ok({id:u.split('/').pop()});
  throw new Error('unexpected '+u)};
 f.log=log;return f;
}
const req=(path,body,token='good',origin='https://gambitblues.github.io')=>new Request('https://api.test'+path,{method:body?'POST':'GET',
 headers:{authorization:token?`Bearer ${token}`:'',origin,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
const NPC={role:'카페 매니저',attitude:'honest',question:'그날 현금은 어떻게 처리했습니까?',answer:'매일 밤 10시에 대표님이 현금을 직접 가져갔어요. 3천만 원쯤 됐을 거예요.'};

test('no token, bad token and uninvited users are refused before any AI call',async()=>{
 let f=fake();let r=await handle(req('/ai/npc',NPC,''),env,f);assert.equal(r.status,401);
 r=await handle(req('/ai/npc',NPC,'bad'),env,f);assert.equal(r.status,401);
 f=fake({email:'stranger@x.kr'});r=await handle(req('/ai/npc',NPC),env,f);assert.equal(r.status,403);
 assert.ok(!f.log.some(x=>x.url.includes('openai')),'OpenAI is never reached without a valid invited user');
});
test('NPC answer: the model rewrites, the check passes, usage is logged with model, tokens and cost',async()=>{
 const f=fake({reply:{text:'매일 밤 10시쯤 대표님이 현금을 직접 챙겨 가셨어요. 3천만 원 정도였을 겁니다.'}});
 const r=await handle(req('/ai/npc',NPC),env,f),d=await r.json();
 assert.equal(d.ok,true);assert.match(d.result.text,/10시/);assert.equal(d.model,'gpt-6-luna');
 const row=JSON.parse(f.log.find(x=>x.url.endsWith('/rest/v1/ai_usage')).opt.body);
 assert.deepEqual([row.kind,row.model,row.input_tokens,row.output_tokens,row.ok],['npc','gpt-6-luna',1000,200,true]);
 assert.equal(row.cost_usd,(1000*0.1+200*0.5)/1e6);
 assert.equal(r.headers.get('access-control-allow-origin'),'https://gambitblues.github.io');
});
test('a reply that changes a number falls back to the engine text',async()=>{
 const f=fake({reply:{text:'매일 밤 11시에 대표님이 현금을 가져갔어요. 3천만 원쯤이요.'}});
 const d=await (await handle(req('/ai/npc',NPC),env,f)).json();
 assert.deepEqual([d.ok,d.fallback,d.why],[false,true,'numbers']);
});
test('daily limit stops the call',async()=>{
 const f=fake({calls:3,reply:{text:'x'}});const r=await handle(req('/ai/npc',NPC),env,f);
 assert.equal(r.status,429);assert.ok(!f.log.some(x=>x.url.includes('openai')));
});
test('article: title and 2~4 sentences of about 100~200 characters',async()=>{
 const base={outlet:'법조일보',reporter:'김기자',lean:'p',phase:'before',caseName:'친목 모임의 공동투자금',title:'동창 돈 3억, 7천만 원은 어디로',body:'동창 12명이 모은 3억 원 가운데 7천만 원이 개업 엿새 만에 빚 갚는 데 쓰였다. 검찰은 처음부터 속일 생각이었다고 본다. 피고인은 사업을 살리려 했다고 말한다.'};
 const good={title:'동창 12명의 3억, 엿새 만에 사라진 7천만 원',body:'동창 12명이 모은 3억 원 중 7천만 원이 카페 문을 연 지 엿새 만에 빚 갚는 데 쓰였다. 검찰은 처음부터 속일 생각이었다고 본다. 피고인은 가게를 살리려 했을 뿐이라고 맞선다.'};
 assert.equal(checkArticle(base,good).ok,true);
 assert.equal(checkArticle(base,{...good,body:'짧다.'}).why,'sentences');
 assert.equal(checkArticle(base,{...good,body:good.body.replace('7천만','8천만')}).why,'numbers');
 const f=fake({reply:good});const d=await (await handle(req('/ai/article',base),env,f)).json();assert.equal(d.ok,true);
});
test('judgment: order is not sent, sections and numbers stay, quotes stay word for word',()=>{
 const p={facts:['재판부는 다음 사실을 인정한다.','카페 통장 거래 내역에 따르면 투자금 중 7천만 원이 피고인의 개인 빚 상환에 쓰였다.','홍슬기는 "3천만 원이 비어요"라고 진술했다.'],
  issues:[{title:'7천만 원은 어디에 쓰였나',text:'카페 통장 거래 내역에 비추어 검사의 주장이 인정된다.'}],conclusion:'피고인에게 징역 2년 6개월을 선고한다.'};
 const ok={facts:['재판부는 다음 사실을 인정한다.','카페 통장 거래 내역을 보면, 투자금 가운데 7천만 원이 피고인의 개인 빚을 갚는 데 쓰였다.','홍슬기는 법정에서 "3천만 원이 비어요"라고 진술하였다.'],
  issues:[{title:'7천만 원은 어디에 쓰였나',text:'카페 통장 거래 내역에 비추어 보면 검사의 주장은 인정된다.'}],conclusion:'피고인에게 징역 2년 6개월을 선고한다.'};
 assert.equal(checkJudgment(p,ok).ok,true);
 assert.equal(checkJudgment(p,{...ok,conclusion:'피고인에게 징역 3년을 선고한다.'}).why,'numbers');
 assert.equal(checkJudgment(p,{...ok,facts:ok.facts.slice(1)}).why,'sections');
 assert.equal(checkJudgment(p,{...ok,facts:[ok.facts[0],ok.facts[1],'홍슬기는 돈이 비었다고 진술하였다.']}).why,'numbers');
 assert.equal(checkJudgment(p,{...ok,issues:[{title:'돈의 행방',text:ok.issues[0].text}]}).why,'issue_titles');
});
test('helpers',()=>{
 assert.deepEqual(numbersIn('3,000만 원 · 08:17 · 2.5배'),['3000','08:17','2.5']);
 assert.equal(sentencesIn('하나다. 둘이다. 셋이다.').length,3);
 assert.equal(outputText({output_text:'{"a":1}'}),'{"a":1}');
 assert.equal(costOf(env,'gpt-6.1-terra',{input_tokens:1e6,output_tokens:1e6}),6);
 assert.ok(npcPrompt({answer:'',question:'?'}).error);
 assert.equal(checkNpc(NPC,{text:'네.'}).why,'length');
});
test('model check endpoint reports each configured model',async()=>{
 const d=await (await handle(req('/ai/check'),env,fake())).json();
 assert.deepEqual(Object.keys(d.models),['gpt-6.1-terra','gpt-6-luna']);
});
