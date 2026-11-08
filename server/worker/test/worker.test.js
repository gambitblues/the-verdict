/* Offline tests of the Worker: auth gate, invite list, limits under parallel calls, usage records, meaning checks and
 * the fallback. OpenAI and Supabase are replaced by a fake fetch, so this runs anywhere: `npm test` */
import test from 'node:test';
import assert from 'node:assert/strict';
import {handle,costOf,outputText,estimate} from '../src/index.js';
import {checkNpc,checkJudgment,npcPrompt,numbersIn,sentencesIn,guard,negated} from '../src/prompts.js';

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
test('objection exchange uses one generation and one verification for two known arguments',async()=>{
 const base={openingA:'검사는 기록이 부정확하다고 이의를 신청했다.',openingB:'변호인은 기록이 정확하다고 반박했다.',names:[]};
 const f=fake({reply:{openingA:base.openingA,openingB:base.openingB}});
 const d=await (await handle(req('/ai/exchange',base),env,f)).json();
 assert.equal(d.ok,true);
 assert.equal(f.openai,2);
 assert.equal(f.usage[0].p_ok,true);
});


test('P4 read-only public chronology: token, cursor, RLS token forwarding and no secret exposure',async()=>{
 const seen=[];
 const f=async(url,opt={})=>{
  const u=String(url);seen.push({url:u,headers:opt.headers});
  const ok=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
  if(u.endsWith('/auth/v1/user'))return ok({id:'u1',email:'a@x.kr'});
  if(u.includes('/rest/v1/players'))return ok([{email:'a@x.kr'}]);
  if(u.includes('/rest/v1/shared_world_events'))return ok([{event_id:17,case_id:'case-p4',event_type:'judgment_published',game_day:123,public_data:{title:'판결 확정'}}]);
  throw Error('unexpected '+u);
 };
 assert.equal((await handle(req('/world/events',undefined,''),env,f)).status,401);
 assert.equal((await handle(req('/world/events?after=no'),env,f)).status,400);
 const response=await handle(req('/world/events?after=16'),env,f);
 assert.equal(response.status,200);
 const payload=await response.json();
 assert.deepEqual([payload.ok,payload.next,payload.events[0].case_id],[true,17,'case-p4']);
 const rest=seen.find(x=>x.url.includes('/rest/v1/shared_world_events'));
 assert.match(rest.url,/event_id=gt.16/);
 assert.equal(rest.headers.authorization,'Bearer good');
 assert.equal(rest.headers.apikey,'anon');
 assert.ok(!rest.url.includes('world_secrets'));
});

test('P4 shared clock and NPC API use invitation-checked JWT and expose only public data',async()=>{
 const log=[];
 const f=async(url,opt={})=>{
  const u=String(url);log.push({u,headers:opt.headers});
  const ok=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
  if(u.endsWith('/auth/v1/user'))return ok({id:'u1',email:'a@x.kr'});
  if(u.includes('/rest/v1/players'))return ok([{email:'a@x.kr'}]);
  if(u.includes('/rest/v1/shared_world_clock'))return ok([{id:'main',game_day:31,version:3}]);
  if(u.includes('/rest/v1/shared_npc_public'))return ok([{npc_id:'npc:test-001',public_profile:{name:'김가람'},life_status:'alive',effective_day:12,version:1}]);
  throw Error('unexpected '+u);
 };
 assert.equal((await handle(req('/world/clock',undefined,''),env,f)).status,401);
 const clock=await (await handle(req('/world/clock'),env,f)).json();
 assert.deepEqual([clock.ok,clock.clock.game_day],[true,31]);
 const npcs=await (await handle(req('/world/npcs?after=npc:test-000'),env,f)).json();
 assert.equal(npcs.npcs[0].npc_id,'npc:test-001');
 assert.equal((await handle(req('/world/npcs?after=bad%3Dinput'),env,f)).status,400);
 const calls=log.filter(x=>x.u.includes('/rest/v1/shared_'));
 assert.equal(calls.length,2);
 assert.ok(calls.every(x=>x.headers.authorization==='Bearer good'&&x.headers.apikey==='anon'));
 assert.ok(calls.every(x=>!x.u.includes('world_secrets')&&!x.u.includes('case_stock')));
});


test('P4 global docket disabled by default, accepts only server-derived judge identity',async()=>{
 const observed=[];
 const f=async(url,opt={})=>{
  const u=String(url);observed.push({u,opt});
  const ok=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
  if(u.endsWith('/auth/v1/user'))return ok({id:'u1',email:'a@x.kr'});
  if(u.includes('/rest/v1/players'))return ok([{email:'a@x.kr'}]);
  if(u.includes('/rpc/shared_docket_offer'))return ok([{case_id:'case-p4',category:'civil',option_index:0,expires_at:'2026-11-04T12:45:00Z'}]);
  if(u.includes('/rpc/shared_docket_accept'))return ok([{case_id:'case-p4',category:'civil',assigned_at:'2026-11-04T12:30:00Z'}]);
  throw Error('unexpected '+u);
 };
 const disabled=await handle(req('/world/offers',{slot:'2026-11-04T12'}),env,f);
 assert.equal(disabled.status,404);
 assert.equal(observed.filter(x=>x.u.includes('shared_docket')).length,0);
 const enabled={...env,P4_SHARED_DOCKET_ENABLED:'1'};
 assert.equal((await handle(req('/world/offers',{slot:'bad'}),enabled,f)).status,400);
 const first=await (await handle(req('/world/offers',{slot:'2026-11-04T12',judgeId:'another-user'}),enabled,f)).json();
 assert.deepEqual([first.ok,first.offers[0].case_id],[true,'case-p4']);
 const second=await (await handle(req('/world/accept',{slot:'2026-11-04T12',caseId:'case-p4'}),enabled,f)).json();
 assert.equal(second.assignment.case_id,'case-p4');
 const rpc=observed.filter(x=>x.u.includes('/rpc/shared_docket'));
 assert.equal(rpc.length,2);
 assert.ok(rpc.every(x=>x.opt.headers.authorization==='Bearer svc'));
 assert.ok(rpc.every(x=>JSON.parse(x.opt.body).p_judge==='u1'));
 assert.ok(rpc.every(x=>!Object.hasOwn(JSON.parse(x.opt.body),'p_truth')));
});


test('P4 case endpoint requires ownership and never returns sealed sheet or another judge case',async()=>{
 const sheet={format:'verdict-world-sheet/v1',id:'case-p4',
  card:{kind:'civil',category:'civil',title:'공개 사건',summary:'분쟁 요지'},
  common:{date:'2026-11-04',facts:['계약이 존재한다'],timeline:[]},
  people:[],records:[{id:'r1',title:'서면',first:true}],questions:[],orders:[],
  worlds:{did:{act:'SECRET_DID'},didnt:{act:'SECRET_DIDNT'}}};
 let owner='u1';
 const f=async(url,opt={})=>{
  const u=String(url),ok=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
  if(u.endsWith('/auth/v1/user'))return ok({id:'u1',email:'a@x.kr'});
  if(u.includes('/rest/v1/players'))return ok([{email:'a@x.kr'}]);
  if(u.includes('/rest/v1/case_stock')){assert.equal(opt.headers.authorization,'Bearer svc');return ok([{case_id:'case-p4',assigned_to:owner,state:'assigned',sheet}])}
  throw Error('unexpected '+u);
 };
 const good=await (await handle(req('/world/case?caseId=case-p4'),env,f)).json();
 assert.equal(good.ok,true);assert.equal(good.case.card.title,'공개 사건');
 assert.ok(!JSON.stringify(good).includes('SECRET_'));
 owner='another-user';
 assert.equal((await handle(req('/world/case?caseId=case-p4'),env,f)).status,404);
 assert.equal((await handle(req('/world/case?caseId=bad'),env,f)).status,400);
});

test('P4 initial evidence endpoint seals future exhibits and non-owner cannot inspect truth',async()=>{
 let owner='u1',secretReads=0;
 const sheet={format:'verdict-world-sheet/v1',id:'case-p4',
  records:[{id:'r1',title:'처음 제출된 자료',first:true},{id:'r2',title:'추가 주문 자료',first:false}],
  worlds:{did:{records:{r1:'첫날 증거 텍스트',r2:'SECRET_FUTURE_RECORD'}},
   didnt:{records:{r1:'다른 세계 증거',r2:'SECRET_OTHER_BRANCH'}}}};
 const f=async(url,opt={})=>{
  const u=String(url),ok=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
  if(u.endsWith('/auth/v1/user'))return ok({id:'u1',email:'a@x.kr'});
  if(u.includes('/rest/v1/players'))return ok([{email:'a@x.kr'}]);
  if(u.includes('/rest/v1/case_stock'))return ok([{case_id:'case-p4',assigned_to:owner,state:'assigned',sheet}]);
  if(u.includes('/rest/v1/world_secrets')){secretReads++;assert.equal(opt.headers.authorization,'Bearer svc');return ok([{truth:{branch:'did'}}])}
  throw Error('unexpected '+u);
 };
 const result=await (await handle(req('/world/case/initial?caseId=case-p4'),env,f)).json();
 assert.equal(result.ok,true);
 assert.deepEqual(result.records,[{id:'r1',title:'처음 제출된 자료',kind:'문서',text:'첫날 증거 텍스트'}]);
 assert.ok(!JSON.stringify(result).includes('SECRET_'));
 assert.equal(secretReads,1);
 owner='another-user';
 assert.equal((await handle(req('/world/case/initial?caseId=case-p4'),env,f)).status,404);
 assert.equal(secretReads,1,'never query sealed truth for the wrong judge');
});


test('P4 catch-up is own-only and absent judge resumes without modifying other players',async()=>{
 const calls=[];let worldDay=14,previousDay=3;
 const ok=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
 const f=async(url,opt={})=>{
  const u=String(url);calls.push({u,opt});
  if(u.endsWith('/auth/v1/user'))return ok({id:'u1',email:'a@x.kr'});
  if(u.includes('/rest/v1/players'))return ok([{email:'a@x.kr'}]);
  if(u.includes('/rest/v1/shared_world_clock'))return ok([{game_day:worldDay,version:2}]);
  if(u.includes('/rest/v1/shared_judge_progress'))return ok([{last_seen_world_day:previousDay,protected_until_day:3}]);
  if(u.includes('/rest/v1/shared_judge_hearings'))return ok([{case_id:'case-p4',hearing_index:1,due_game_day:4,state:'scheduled',revised_by_catchup:false}]);
  if(u.includes('/rpc/shared_judge_resume')){previousDay=worldDay;return ok([{previous_day:3,world_day:14,lag_days:11,protected_until_day:16,rescheduled_hearings:1}])}
  throw Error('unexpected '+u);
 };
 const disabled=await handle(req('/world/catchup'),env,f);
 assert.equal(disabled.status,404);
 const enabled={...env,P4_SHARED_DOCKET_ENABLED:'1'};
 const preview=await (await handle(req('/world/catchup'),enabled,f)).json();
 assert.equal(preview.ok,true);
 assert.equal(preview.lagDays,11);
 assert.equal(preview.pending[0].due_game_day,4);
 assert.equal(calls.filter(x=>x.u.includes('/rpc/shared_judge_resume')).length,0,'read cannot mutate');
 const reply=await (await handle(req('/world/resume',{}),enabled,f)).json();
 assert.equal(reply.ok,true);
 assert.equal(reply.resume.protected_until_day,16);
 const rpc=calls.find(x=>x.u.includes('/rpc/shared_judge_resume'));
 assert.deepEqual(JSON.parse(rpc.opt.body),{p_judge:'u1'},'server derives identity, not from client');
 const restCalls=calls.filter(x=>x.u.includes('/rest/v1/shared_'));
 assert.ok(restCalls.every(x=>x.opt.headers.authorization==='Bearer good'),'RLS with player JWT');
 assert.ok(restCalls.every(x=>!x.u.includes('/world_secrets')));
 const after=await (await handle(req('/world/catchup'),enabled,f)).json();
 assert.equal(after.lagDays,0);
 assert.equal((await handle(req('/world/resume',{},''),enabled,f)).status,401);
});

test('P4 first reconnect without progress row still detects overdue private hearing',async()=>{
 const envOn={...env,P4_SHARED_DOCKET_ENABLED:'1'};
 const ok=v=>new Response(JSON.stringify(v),{status:200,headers:{'content-type':'application/json'}});
 const f=async(url)=>{
  const u=String(url);
  if(u.endsWith('/auth/v1/user'))return ok({id:'u1',email:'a@x.kr'});
  if(u.includes('/rest/v1/players'))return ok([{email:'a@x.kr'}]);
  if(u.includes('/rest/v1/shared_world_clock'))return ok([{game_day:14,version:2}]);
  if(u.includes('/rest/v1/shared_judge_progress'))return ok([]);
  if(u.includes('/rest/v1/shared_judge_hearings'))return ok([{case_id:'case-p4',hearing_index:1,due_game_day:4,state:'scheduled'}]);
  throw Error('unexpected '+u);
 };
 const d=await (await handle(req('/world/catchup'),envOn,f)).json();
 assert.equal(d.ok,true);
 assert.equal(d.previousDay,4);
 assert.equal(d.lagDays,10);
});


test('P4 hearing begin derives judge from JWT and does not let browser choose world date',async()=>{
 const calls=[];
 const ok=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
 const mock=async(url,opt={})=>{
  const u=String(url);calls.push({u,opt});
  if(u.endsWith('/auth/v1/user'))return ok({id:'u1',email:'a@x.kr'});
  if(u.includes('/rest/v1/players'))return ok([{email:'a@x.kr'}]);
  if(u.includes('/rpc/shared_court_begin'))return ok([{hearing_index:2,world_day:12,already_opened:false}]);
  throw Error('unexpected '+u);
 };
 const body={caseId:'case-p4',p_judge:'other-user',worldDay:9999,hearingIndex:19};
 assert.equal((await handle(req('/world/court/begin',body),env,mock)).status,404);
 const enabled={...env,P4_COURT_ACTIONS_ENABLED:'1'};
 const result=await (await handle(req('/world/court/begin',body),enabled,mock)).json();
 assert.equal(result.hearing.world_day,12);
 const call=calls.find(x=>x.u.includes('/rpc/shared_court_begin'));
 assert.deepEqual(JSON.parse(call.opt.body),{p_case:'case-p4',p_judge:'u1'});
 assert.equal(call.opt.headers.authorization,'Bearer svc');
 assert.equal((await handle(req('/world/court/begin',{caseId:'bad id'}),enabled,mock)).status,400);
});

test('P4 sealed courtroom endpoint: only the assigned judge can obtain a server-derived answer',async()=>{
 const calls=[];let owner='u1',hearingState='completed',finalized=false;
 const sheet={id:'case-p4',questions:[
  {id:'q1',w:'W1',q:'누구를 보셨나요?',a:{did:'서버가 봉인한 증언',didnt:'다른 분기의 증언'}},
  {id:'q2',w:'W1',q:'다음 장면은?',after:'W1:q1',a:{did:'증언 후속'}},
  {id:'q3',w:'W2',q:'CCTV?',after:'r2',a:{did:'녹화 자료 확인'}}
 ],orders:[{record:'r2',result:{did:'done',didnt:'declined'}}],
 records:[{id:'r1',title:'초기 자료',first:true},{id:'r2',title:'미공개 CCTV',first:false}],
 worlds:{did:{records:{r2:'녹화 자료 본문'}},didnt:{records:{r2:'OTHER_SECRET'}}}};
 const journal=[];
 const response=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
 const f=async(url,opt={})=>{
  const u=String(url);calls.push({u,opt});
  if(u.endsWith('/auth/v1/user'))return response({id:'u1',email:'a@x.kr'});
  if(u.includes('/rest/v1/players'))return response([{email:'a@x.kr'}]);
  if(u.includes('/rest/v1/case_stock'))return response([{case_id:'case-p4',assigned_to:owner,state:'assigned',sheet}]);
  if(u.includes('/rest/v1/shared_judge_hearings'))return response([{hearing_index:1,state:hearingState,completed_game_day:5}]);
  if(u.includes('/rest/v1/world_secrets'))return response([{truth:{branch:'did'}}]);
  if(u.includes('/rest/v1/shared_court_actions'))return response(journal);
  if(u.includes('/rest/v1/shared_world_clock'))return response([{game_day:5}]);
  if(u.includes('/rest/v1/shared_case_judgments'))return response(finalized?[{case_id:'case-p4'}]:[]);
  if(u.includes('/rpc/shared_court_action_record')){
   assert.equal(opt.headers.authorization,'Bearer svc');
   const payload=JSON.parse(opt.body);
   assert.equal(payload.p_judge,'u1');
   assert.ok(!JSON.stringify(payload).includes('OTHER_SECRET'));
   const record={action_type:payload.p_type,action_key:payload.p_key,response:payload.p_response};
   journal.push(record);return response(payload.p_response);
  }
  throw Error('unexpected '+u);
 };
 const enabled={...env,P4_COURT_ACTIONS_ENABLED:'1'};
 const request=(kind,key)=>req('/world/court/action',{caseId:'case-p4',kind,key,hearingIndex:1,
  answer:'FORGED_CLIENT_ANSWER',branch:'didnt'});
 assert.equal((await handle(request('question','q1'),env,f)).status,404,'feature must remain opt-in');
 assert.equal((await handle(req('/world/court/action',{caseId:'case-p4',kind:'question',key:'bad key',hearingIndex:1}),enabled,f)).status,400);
 let out=await (await handle(request('question','q1'),enabled,f)).json();
 assert.equal(out.response.answer,'서버가 봉인한 증언');
 assert.ok(!JSON.stringify(out).includes('FORGED_CLIENT_ANSWER'));
 assert.equal((await handle(request('question','q3'),enabled,f)).status,409,'locked witness question');
 out=await (await handle(request('order','r2'),enabled,f)).json();
 assert.equal(out.response.status,'delayed');
 out=await (await handle(request('question','q3'),enabled,f)).json();
 assert.equal(out.error,'prerequisite_missing');
 const status=await (await handle(req('/world/court/status?caseId=case-p4'),enabled,f)).json();
 assert.deepEqual([status.canAct,status.hearingIndex],[true,1]);
 finalized=true;
 const finalizedStatus=await (await handle(req('/world/court/status?caseId=case-p4'),enabled,f)).json();
 assert.deepEqual([finalizedStatus.canAct,finalizedStatus.hearingIndex],[false,null],'finished judgment locks courtroom');
 finalized=false;
 const history=await (await handle(req('/world/court/history?caseId=case-p4'),enabled,f)).json();
 assert.equal(history.actions.length,2);
 owner='another-user';
 assert.equal((await handle(request('question','q1'),enabled,f)).status,404);
 assert.equal((await handle(req('/world/court/history?caseId=case-p4'),enabled,f)).status,404);
 hearingState='scheduled';owner='u1';
 assert.equal((await handle(request('question','q1'),enabled,f)).status,409);
 assert.equal((await handle(request('question','q1'),enabled,fake({reply:GOOD}))).status,503);
});

test('P4 shared verdict requires owned case and genuine citation; refuses browser-authored order',async()=>{
 const log=[];let owner='u1';
 const ok=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
 const mock=async(url,opt={})=>{
  const u=String(url);log.push({u,opt});
  if(u.endsWith('/auth/v1/user'))return ok({id:'u1',email:'a@x.kr'});
  if(u.includes('/rest/v1/players'))return ok([{email:'a@x.kr'}]);
  if(u.includes('/rest/v1/case_stock'))return ok([{case_id:'case-p4',assigned_to:owner,state:'assigned',sheet:{
   card:{kind:'civil'},records:[{id:'r1',first:true,title:'제출 계약서'},{id:'r2',first:false,title:'미제출 자료'}]}}]);
  if(u.includes('/rest/v1/shared_judge_hearings'))return ok([{hearing_index:1,state:'completed',completed_game_day:9}]);
  if(u.includes('/rest/v1/shared_court_actions'))return ok([{action_type:'question',action_key:'q1',
   hearing_index:1,response:{status:'done',answer:'증인 진술'}}]);
  if(u.includes('/rpc/shared_judgment_publish')){
   assert.equal(opt.headers.authorization,'Bearer svc');
   const b=JSON.parse(opt.body);
   assert.equal(b.p_judge,'u1');
   assert.equal(b.p_order,'원고의 청구를 인용한다.');
   assert.match(b.p_record_hash,/^[a-f0-9]{64}$/);
   assert.ok(!JSON.stringify(b).includes('CLIENT_FORGED'));
   return ok(true);
  }
  throw Error('unexpected '+u);
 };
 const enabled={...env,P4_COURT_ACTIONS_ENABLED:'1',P4_JUDGMENTS_ENABLED:'1'};
 const request=citations=>req('/world/court/verdict',{caseId:'case-p4',result:'claim_granted',citations,
  order:'CLIENT_FORGED',worldDay:9999});
 assert.equal((await handle(request(['initial:r1']),env,mock)).status,404);
 const bad=await (await handle(request(['initial:r2']),enabled,mock)).json();
 assert.equal(bad.error,'citation_not_in_record');
 assert.equal(log.filter(x=>x.u.includes('/rpc/shared_judgment_publish')).length,0);
 const result=await (await handle(request(['initial:r1','question:q1']),enabled,mock)).json();
 assert.equal(result.ok,true);
 assert.equal(result.published,true);
 assert.equal(result.judgment.order,'원고의 청구를 인용한다.');
 owner='other-judge';
 assert.equal((await handle(request(['initial:r1']),enabled,mock)).status,404);
});

test('P4 free order: AI maps Korean open order to catalog but never writes evidence',async()=>{
 const calls=[],usage=[];
 const ok=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
 const sheet={
  records:[{id:'r1',title:'최초 제출',first:true},{id:'r-cctv',title:'식당 CCTV 원본',kind:'영상',first:false,unlock:'사고 전 식당 영상'}],
  orders:[{record:'r-cctv',ask:'식당 CCTV 원본 제출'}],
  worlds:{did:{records:{'r-cctv':'SEALED_CCTV_CONTENT'}}}
 };
 let owner='u1',opened=true,hasJudgment=false,reply={recordId:'r-cctv',intent:'request_record',explanation:'기존 영상 제출 요청'};
 const fakeFetch=async(url,opt={})=>{
  const u=String(url);calls.push({u,opt});
  if(u.endsWith('/auth/v1/user'))return ok({id:'u1',email:'a@x.kr'});
  if(u.includes('/rest/v1/players'))return ok([{email:'a@x.kr'}]);
  if(u.includes('/rest/v1/case_stock'))return ok([{assigned_to:owner,state:'assigned',sheet}]);
  if(u.includes('/rest/v1/shared_judge_hearings'))return ok([{hearing_index:1,state:opened?'completed':'scheduled',completed_game_day:7}]);
  if(u.includes('/rest/v1/shared_world_clock'))return ok([{game_day:7}]);
  if(u.includes('/rest/v1/shared_case_judgments'))return ok(hasJudgment?[{case_id:'case-p4'}]:[]);
  if(u.includes('/rpc/ai_reserve')){usage.push({});return ok(usage.length)}
  if(u.includes('/rpc/ai_finish')){Object.assign(usage.at(-1),JSON.parse(opt.body));return ok(null)}
  if(u.includes('/v1/responses')){
   const request=JSON.parse(opt.body);
   assert.equal(request.store,false);
   assert.equal(request.text.format.name,'judicial_order_intent');
   assert.ok(!JSON.stringify(request).includes('SEALED_CCTV_CONTENT'),'model must never see sealed truth');
   return ok({model:'gpt-6-luna',output:[{content:[{type:'output_text',text:JSON.stringify(reply)}]}],
    usage:{input_tokens:100,output_tokens:25}});
  }
  throw Error('unexpected '+u);
 };
 const enabled={...env,P4_COURT_ACTIONS_ENABLED:'1',P4_FREE_ORDERS_ENABLED:'1'};
 const body={caseId:'case-p4',hearingIndex:1,text:'사고 전 식당 CCTV의 원본 영상을 제출하도록 명합니다.',branch:'didnt',evidence:'FAKE'};
 const denied=await handle(req('/world/court/free-order',body),env,fakeFetch);
 assert.equal(denied.status,404);
 assert.equal(calls.filter(c=>c.u.includes('/v1/responses')).length,0);
 const good=await (await handle(req('/world/court/free-order',body),enabled,fakeFetch)).json();
 assert.deepEqual({ok:good.ok,matched:good.matched,recordId:good.recordId,confirm:good.confirmationRequired},
  {ok:true,matched:true,recordId:'r-cctv',confirm:true});
 assert.ok(!JSON.stringify(good).includes('SEALED_'));
 assert.equal(calls.filter(c=>c.u.includes('/v1/responses')).length,1);
 assert.equal(calls.filter(c=>c.u.includes('/rpc/shared_court_action_record')).length,0,'AI suggestion cannot commit court order');
 assert.equal(usage[0].p_ok,true);
 reply={recordId:'r-fake',intent:'request_record',explanation:'신규 자료'};
 const fakeAnswer=await handle(req('/world/court/free-order',body),enabled,fakeFetch);
 assert.equal(fakeAnswer.status,503);
 assert.equal((await fakeAnswer.json()).error,'order_interpretation_unavailable');
 opened=false;
 const before=calls.filter(c=>c.u.includes('/v1/responses')).length;
 assert.equal((await handle(req('/world/court/free-order',body),enabled,fakeFetch)).status,409);
 assert.equal(calls.filter(c=>c.u.includes('/v1/responses')).length,before);
 opened=true;owner='someone-else';
 assert.equal((await handle(req('/world/court/free-order',body),enabled,fakeFetch)).status,404);
 owner='u1';hasJudgment=true;
 assert.equal((await handle(req('/world/court/free-order',body),enabled,fakeFetch)).status,409);
 assert.equal((await handle(req('/world/court/free-order',body, ''),enabled,fakeFetch)).status,401);
});

test('P5 evidence ruling is sealed: chair + disclosed item only, no browser-supplied evidence text',async()=>{
 const seen=[];const localEnv={...env,P4_COURT_ACTIONS_ENABLED:'1',P4_TRIAL_PARITY_ENABLED:'1'};
 const base='case-p5-evidence';
 const make=(assigned='u1')=>async(url,opt={})=>{
  const u=String(url);seen.push({u,opt});
  const ok=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
  if(u.endsWith('/auth/v1/user'))return ok({id:'u1',email:'a@x.kr'});
  if(u.includes('/rest/v1/players'))return ok([{email:'a@x.kr'}]);
  if(u.includes('/case_stock?'))return ok([{assigned_to:assigned,state:'assigned',
   sheet:{records:[{id:'r1',first:true,title:'제출된 원본'},{id:'r2',first:false,title:'아직 미제출'}]}}]);
  if(u.includes('/shared_court_actions?'))return ok([]);
  if(u.includes('/rpc/shared_evidence_decision_record')){
   const body=JSON.parse(opt.body);
   assert.deepEqual(body,{p_case:base,p_judge:'u1',p_hearing:1,p_record:'r1',p_decision:'exclude'});
   assert.ok(!JSON.stringify(body).includes('FORGED_FACT'));
   return ok({status:'done',recordId:'r1',decision:'exclude'});
  }
  throw Error('unexpected '+u);
 };
 const body={caseId:base,recordId:'r1',hearingIndex:1,decision:'exclude',
  answer:'FORGED_FACT',truth:'did'};
 let d=await (await handle(req('/world/court/evidence/decide',body),localEnv,make())).json();
 assert.equal(d.ok,true);
 assert.equal(d.ruling.decision,'exclude');
 assert.equal(seen.filter(x=>x.u.includes('/rpc/shared_evidence_decision_record')).length,1);
 d=await (await handle(req('/world/court/evidence/decide',{...body,recordId:'r2'}),localEnv,make())).json();
 assert.equal(d.error,'evidence_not_disclosed');
 d=await (await handle(req('/world/court/evidence/decide',{...body,decision:'fake'}),localEnv,make())).json();
 assert.equal(d.error,'invalid_evidence_decision');
 const outsider=await handle(req('/world/court/evidence/decide',body),localEnv,make('another-judge'));
 assert.equal(outsider.status,403);
 const off=await handle(req('/world/court/evidence/decide',body),env,make());
 assert.equal(off.status,404);
});

test('native opponent motion endpoints hide validity, require chair for response',async()=>{
 const sheet={format:'verdict-world-sheet/v1',id:'case-motion',
  card:{kind:'civil',opponentStyle:'aggressive'}};
 const seen=[];
 const f=async(url,opt={})=>{
  const u=String(url);seen.push({u,opt});
  const ok=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
  if(u.endsWith('/auth/v1/user'))return ok({id:'u1',email:'a@x.kr'});
  if(u.includes('/rest/v1/players'))return ok([{email:'a@x.kr'}]);
  if(u.includes('/rest/v1/case_stock'))return ok([{assigned_to:'u1',state:'assigned',sheet}]);
  if(u.includes('/rest/v1/shared_judge_hearings'))return ok([{hearing_index:1,state:'completed',completed_game_day:5}]);
  if(u.includes('/rest/v1/shared_world_clock'))return ok([{game_day:5}]);
  if(u.includes('/rest/v1/shared_court_actions'))return ok([]);
  if(u.includes('/rpc/shared_motion_decision_record'))return ok(JSON.parse(opt.body).p_response);
  throw Error('unexpected '+u);
 };
 const enabled={...env,P4_COURT_ACTIONS_ENABLED:'1',P4_TRIAL_PARITY_ENABLED:'1'};
 const first=await (await handle(req('/world/court/motions?caseId=case-motion'),enabled,f)).json();
 assert.equal(first.ok,true);
 assert.ok(Array.isArray(first.motions));
 assert.ok(!JSON.stringify(first).includes('"valid"'),'do not leak the correct response before judgment');
 if(first.motions.length){
  const key=first.motions[0].id;
  const b={caseId:'case-motion',hearingIndex:1,key,choice:'accept',valid:false,answer:'FORGED'};
  const outcome=await (await handle(req('/world/court/motion/decide',b),enabled,f)).json();
  assert.equal(outcome.ok,true);
  const recorded=JSON.parse(seen.find(x=>x.u.includes('/rpc/shared_motion_decision_record')).opt.body);
  assert.ok(!JSON.stringify(recorded).includes('FORGED'));
  assert.equal(typeof recorded.p_response.valid,'boolean');
 }
 const denied=await handle(req('/world/court/motion/decide',{caseId:'case-motion',key:'forged',choice:'accept',hearingIndex:1}),enabled,f);
 assert.equal(denied.status,400);
 const off=await handle(req('/world/court/motions?caseId=case-motion'),env,f);
 assert.equal(off.status,404);
});
