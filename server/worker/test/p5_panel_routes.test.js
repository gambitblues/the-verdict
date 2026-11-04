import test from 'node:test';
import assert from 'node:assert/strict';
import {p5PanelRoute} from '../src/p5_panel_routes.js';
const A='00000000-0000-0000-0000-00000000000a';
const B='00000000-0000-0000-0000-00000000000b';
const headers={apikey:'qa',authorization:'Bearer service','content-type':'application/json'};
const env={P5_JOINT_PANEL_ENABLED:'1',SUPABASE_URL:'https://qa.example'};
const req=(path,body)=>new Request('https://worker.example'+path,{
 method:body?'POST':'GET',headers:{'content-type':'application/json'},
 ...(body?{body:JSON.stringify(body)}:{})
});
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,
 headers:{'content-type':'application/json'}});
test('P5 disabled by default; only existing judge may create panel',async()=>{
 const disabled=await p5PanelRoute(req('/world/panel/open',{caseId:'case-p5',peerId:B,npcId:'npc:p5'}),{},async()=>{throw Error('network should not be called')},A,headers);
 assert.equal(disabled.status,404);
 const calls=[];
 const fake=async(url,opt)=>{calls.push({url,opt});return json(true)};
 const result=await (await p5PanelRoute(req('/world/panel/open',{caseId:'case-p5',peerId:B,npcId:'npc:p5'}),env,fake,A,headers)).json();
 assert.equal(result.created,true);
 assert.deepEqual(JSON.parse(calls[0].opt.body),{
  p_case:'case-p5',p_chair:A,p_peer:B,p_npc:'npc:p5'
 });
});
test('P5 status never sends another judge private vote before quorum',async()=>{
 const f=async()=>json({state:'deliberating',votesCast:1,myVote:null,majority:null});
 const d=await (await p5PanelRoute(req('/world/panel/status?caseId=case-p5'),env,f,B,headers)).json();
 assert.deepEqual(d,{ok:true,state:'deliberating',votesCast:1,myVote:null,majority:null});
});
test('P5 human vote uses member-derived seat and server evidence hash',async()=>{
 const calls=[];
 const f=async(url,opt={})=>{
  const u=String(url);calls.push({u,opt});
  if(u.includes('/shared_joint_panels?'))return json([{chair_id:A,peer_id:B}]);
  if(u.includes('/case_stock?'))return json([{state:'assigned',sheet:{card:{kind:'civil'}}}]);
  if(u.includes('/shared_judge_hearings?'))return json([{hearing_index:1,state:'completed',completed_game_day:8}]);
  if(u.includes('/shared_world_clock?'))return json([{game_day:8}]);
  if(u.includes('/shared_court_actions?'))return json([
   {action_type:'question',action_key:'q1',response:{status:'done',answer:'증인 진술'}}
  ]);
  if(u.includes('/rpc/shared_joint_vote'))return json(true);
  throw Error('unexpected '+u);
 };
 const body={caseId:'case-p5',choice:'claim_granted',note:'제출된 증거를 신뢰함',p_seat:'npc',evidenceHash:'x'};
 const d=await (await p5PanelRoute(req('/world/panel/vote',body),env,f,A,headers)).json();
 assert.equal(d.ok,true);
 assert.equal(d.seat,'chair');
 const data=JSON.parse(calls.find(x=>x.u.includes('/rpc/shared_joint_vote')).opt.body);
 assert.equal(data.p_actor,A);
 assert.equal(data.p_seat,'chair');
 assert.match(data.p_hash,/^[a-f0-9]{64}$/);
 assert.notEqual(data.p_hash,body.evidenceHash);
 const bad=await p5PanelRoute(req('/world/panel/vote',{...body,choice:'FAKE'}),env,f,A,headers);
 assert.equal(bad.status,400);
 const outsider=await p5PanelRoute(req('/world/panel/vote',body),env,f,'00000000-0000-0000-0000-00000000000c',headers);
 assert.equal(outsider.status,403);
});

test('P5 NPC AI is metered, sees public evidence not human ballots, and commits only the third seat',async()=>{
 const caseId='case-p5';
 const acts=[{action_type:'question',action_key:'q1',response:{status:'done',answer:'신호가 바뀌었습니다.'}}];
 const bytes=new TextEncoder().encode(JSON.stringify({caseId,journal:acts}));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 const sheet={format:'verdict-world-sheet/v1',id:'case-p5',card:{kind:'civil',title:'사고 손해배상'},records:[
  {id:'r1',title:'감정서 원본',first:true}],questions:[{id:'q1',q:'신호를 보셨나요?'}],
  worlds:{did:{act:'SEALED_DONT_SEND',records:{r1:'공개된 감정서에는 사고 당시 위치가 기재되어 있다.'}}}};
 const calls=[];const completed=[];
 const mock=async(url,opt={})=>{
  const u=String(url);calls.push({u,opt});
  if(u.includes('/shared_joint_panels?'))return json([{chair_id:A,peer_id:B,npc_id:'npc:p5'}]);
  if(u.includes('/shared_joint_votes?'))return json([
   {seat:'chair',evidence_hash:hash},{seat:'peer',evidence_hash:hash}
  ]);
  if(u.includes('/case_stock?'))return json([{assigned_to:A,state:'assigned',sheet}]);
  if(u.includes('/shared_court_actions?'))return json(acts);
  if(u.includes('/world_secrets?'))return json([{truth:{branch:'did',private:'NEVER_EXPOSE_BRANCH'}}]);
  if(u.includes('/shared_npc_public?'))return json([{npc_id:'npc:p5',life_status:'alive',
   public_profile:{name:'NPC 재판관',privateInfo:'NEVER_EXPOSE'}}]);
  if(u.includes('/rpc/shared_joint_vote')){
   const payload=JSON.parse(opt.body);
   assert.equal(payload.p_actor,null);assert.equal(payload.p_seat,'npc');
   assert.equal(payload.p_choice,'claim_granted');assert.equal(payload.p_hash,hash);
   return json(true);
  }
  if(u.includes('/rpc/shared_joint_status'))return json({
   state:'majority_ready',votesCast:3,myVote:'claim_granted',majority:'claim_granted'
  });
  throw Error('unexpected '+u);
 };
 const ai={
  reserve:async()=>42,
  estimate:()=>0.001,
  costOf:()=>0.002,
  finish:async(_env,id,usage)=>{completed.push({id,usage})},
  respond:async(_env,prompt)=>{
   assert.ok(prompt.input.includes('신호가 바뀌었습니다.'));
   assert.ok(prompt.input.includes('공개된 감정서에는 사고 당시 위치가 기재되어 있다.'));
   assert.ok(!prompt.input.includes('NEVER_EXPOSE_BRANCH'));
   assert.ok(!prompt.input.includes('SEALED_DONT_SEND'));
   assert.ok(!prompt.input.includes('SEALED_DONT_SEND'));
   assert.ok(!prompt.input.includes('NEVER_EXPOSE'));
   assert.deepEqual(prompt.schema.schema.properties.choice.enum,
    ['claim_granted','claim_denied','partial','settled']);
   return {ok:true,model:'mock-model',data:{
    choice:'claim_granted',reason:'제출된 법정 자료를 검토하면 책임을 인정할 근거가 충분합니다.'
   },usage:{input_tokens:120,output_tokens:30}};
  }
 };
 const result=await (await p5PanelRoute(req('/world/panel/npc/decide',{caseId}),env,mock,A,headers,ai)).json();
 assert.equal(result.ok,true);
 assert.equal(result.submitted,true);
 assert.equal(result.status.majority,'claim_granted');
 assert.equal(completed.length,1);assert.equal(completed[0].usage.p_ok,true);
 assert.equal(calls.filter(c=>c.u.includes('/rpc/shared_joint_vote')).length,1);
});
test('P5 joint finalization binds proven majority, citations and native grade, ignores forged client verdict',async()=>{
 const caseId='case-p5';
 const acts=[{action_type:'question',action_key:'q1',response:{status:'done',answer:'피고인이 신호를 위반했습니다.'}}];
 const digest=await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(JSON.stringify({caseId,journal:acts})));
 const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 const sheet={card:{kind:'civil',title:'사고 사건',claim:{amount:1000,fair:[500,850]}},
  records:[{id:'r1',title:'감정서',first:true,
   review:{strength:75,flaw:0,flawType:'none',side:'p'}}],
  questions:[{id:'q1',review:{side:'p'}}]};
 const calls=[];
 const mock=async(url,opt={})=>{
  const u=String(url);calls.push({u,opt});
  if(u.includes('/shared_joint_panels?'))return json([{chair_id:A}]);
  if(u.includes('/case_stock?'))return json([{assigned_to:A,state:'assigned',sheet}]);
  if(u.includes('/shared_judge_hearings?'))return json([{state:'completed',hearing_index:1,completed_game_day:8}]);
  if(u.includes('/shared_world_clock?'))return json([{game_day:8}]);
  if(u.includes('/shared_court_actions?'))return json(acts);
  if(u.includes('/shared_joint_votes?'))return json([
   {evidence_hash:hash},{evidence_hash:hash},{evidence_hash:hash}
  ]);
  if(u.includes('/rpc/shared_joint_status'))return json({
   state:'majority_ready',votesCast:3,majority:'claim_granted'
  });
  if(u.includes('/rpc/shared_judgment_publish_scored'))return json(true);
  throw Error('unexpected '+u);
 };
 const config={...env,P4_JUDGMENTS_ENABLED:'1',P4_TRIAL_PARITY_ENABLED:'1'};
 const body={caseId,result:'claim_denied',citations:['initial:r1'],
  sentence:{amount:1000},order:'FORGED ORDER'};
 const res=await (await p5PanelRoute(req('/world/panel/finalize',body),config,mock,A,headers)).json();
 assert.equal(res.ok,true);
 assert.equal(res.judgment.result,'claim_granted');
 assert.match(res.judgment.order,/1,000만 원/);
 assert.ok(res.judgment.grade.score>=0&&res.judgment.grade.score<=100);
 const sent=JSON.parse(calls.find(x=>x.u.includes('/rpc/shared_judgment_publish_scored')).opt.body);
 assert.equal(sent.p_result,'claim_granted');
 assert.ok(!JSON.stringify(sent).includes('FORGED ORDER'));
 assert.match(sent.p_record_hash,/^[0-9a-f]{64}$/);
 assert.equal(sent.p_score,res.judgment.grade.score);
 assert.equal(sent.p_review,res.judgment.grade.review);
 const denied=await p5PanelRoute(req('/world/panel/finalize',body),config,mock,B,headers);
 assert.equal(denied.status,403);
});

test('P5 dedicated joint slot is separate and can auto assign without browser case choice',async()=>{
 const requests=[];
 const mock=async(url,opt={})=>{
  const u=String(url);requests.push({u,opt});
  if(u.includes('/rpc/shared_joint_slot'))return json({occupied:false,limit:1});
  if(u.includes('/rpc/shared_joint_auto_assign'))return json({ok:true,caseId:'case-auto-p5',existing:false});
  throw Error('unexpected '+u);
 };
 const slot=await (await p5PanelRoute(req('/world/panel/slot'),env,mock,A,headers)).json();
 assert.equal(slot.occupied,false);assert.equal(slot.limit,1);
 const assigned=await (await p5PanelRoute(req('/world/panel/auto-assign',{}),env,mock,A,headers)).json();
 assert.equal(assigned.caseId,'case-auto-p5');
 assert.equal(assigned.existing,false);
 const sent=JSON.parse(requests.at(-1).opt.body);
 assert.deepEqual(sent,{p_actor:A},'browser cannot inject case IDs or a second participant');
});

test('P5 bench is server verified: NPC is an associate, not chair; outsiders do not get seats',async()=>{
 const bench={caseId:'case-p5',myRole:'associate',canOpenHearing:false,canPublishJudgment:false,
  seats:[
   {seat:'chair',kind:'human',role:'presiding',id:A,name:'A 판사'},
   {seat:'peer',kind:'human',role:'associate',id:B,name:'B 판사'},
   {seat:'npc',kind:'npc',role:'associate',id:'npc:judge',name:'NPC 배석판사'}
  ]};
 const calls=[];
 const mock=async(url,opt)=>{calls.push({url:String(url),opt});return json(bench)};
 const d=await (await p5PanelRoute(req('/world/panel/bench?caseId=case-p5'),env,mock,B,headers)).json();
 assert.equal(d.ok,true);
 assert.equal(d.bench.myRole,'associate');
 assert.equal(d.bench.seats[2].role,'associate');
 assert.deepEqual(JSON.parse(calls[0].opt.body),{p_case:'case-p5',p_actor:B});
 const corrupted={...bench,seats:[...bench.seats.slice(0,2),{seat:'npc',kind:'npc',role:'presiding'}]};
 const bad=await p5PanelRoute(req('/world/panel/bench?caseId=case-p5'),env,async()=>json(corrupted),B,headers);
 assert.equal(bad.status,503);
});
test('P5 associate observes identical public court actions, but cannot open the hearing',async()=>{
 const sheet={
  format:'verdict-world-sheet/v1',id:'case-p5',card:{kind:'civil',title:'공동재판 사건'},
  people:[],common:{facts:[]},records:[{id:'r1',title:'첫 자료',first:true}],
  worlds:{did:{records:{r1:'공개된 초기 내용'}},didnt:{},reason:{}},
  questions:[],orders:[]
 };
 const actions=[{action_type:'question',action_key:'q1',response:{status:'done',answer:'증언'},hearing_index:1,game_day:8}];
 const calls=[];
 const mock=async(url)=>{
  const u=String(url);calls.push(u);
  if(u.includes('/shared_joint_panels?'))return json([{chair_id:A,peer_id:B}]);
  if(u.includes('/case_stock?'))return json([{case_id:'case-p5',state:'assigned',sheet}]);
  if(u.includes('/world_secrets?'))return json([{truth:{branch:'did'}}]);
  if(u.includes('/shared_court_actions?'))return json(actions);
  if(u.includes('/shared_judge_hearings?'))return json([{state:'completed',hearing_index:1,completed_game_day:8}]);
  if(u.includes('/shared_world_clock?'))return json([{game_day:8}]);
  if(u.includes('/shared_case_judgments?'))return json([]);
  throw Error('unexpected '+u);
 };
 const chair=(await p5PanelRoute(req('/world/panel/case?caseId=case-p5'),env,mock,A,headers));
 const peer=(await p5PanelRoute(req('/world/panel/case?caseId=case-p5'),env,mock,B,headers));
 assert.equal(chair.status,200);assert.equal(peer.status,200);
 const a=await chair.json(),b=await peer.json();
 assert.deepEqual(a.actions,b.actions);
 assert.deepEqual(a.records,b.records);
 assert.equal(a.court.canAct,true);
 assert.equal(b.court.canAct,true,'human associate participates in opened hearing');
  assert.equal(b.court.canOpenHearing,false,'only the chair opens a hearing');
 assert.equal(b.court.canObserve,true);
 assert.equal(b.role,'associate');
 assert.ok(!JSON.stringify(b).includes('worlds'),'sealed branches are not exposed');
 const outsider=await p5PanelRoute(req('/world/panel/case?caseId=case-p5'),env,mock,'00000000-0000-0000-0000-00000000000c',headers);
 assert.equal(outsider.status,403);
 assert.equal(calls.filter(u=>u.includes('/world_secrets?')).length,2,'nonmember is denied before reading truth');
});

test('P5 blocks premature or stale human ballots and unresolved ordered evidence',async()=>{
 const sheet={format:'verdict-world-sheet/v1',card:{kind:'civil',importance:5}};
 let day=8,index=2,completed=8;
 let actions=[{action_type:'question',action_key:'q1',response:{status:'done',answer:'공개 진술'}}];
 let voted=0;
 const mock=async(url)=>{
  const u=String(url);
  if(u.includes('/shared_joint_panels?'))return json([{chair_id:A,peer_id:B}]);
  if(u.includes('/case_stock?'))return json([{state:'assigned',sheet}]);
  if(u.includes('/shared_judge_hearings?'))return json([{hearing_index:index,state:'completed',completed_game_day:completed}]);
  if(u.includes('/shared_world_clock?'))return json([{game_day:day}]);
  if(u.includes('/shared_court_actions?'))return json(actions);
  if(u.includes('/rpc/shared_joint_vote')){voted++;return json(true)}
  throw Error('unexpected '+u);
 };
 const body={caseId:'case-p5',choice:'claim_denied',note:'서버 공개 기록을 검토했습니다.'};
 let response=await p5PanelRoute(req('/world/panel/vote',body),env,mock,A,headers);
 assert.equal(response.status,409,'second hearing cannot satisfy four-hearing policy');
 assert.equal((await response.json()).minimumHearings,4);
 index=4;actions.push({action_type:'order',action_key:'r2',response:{status:'delayed'}});
 response=await p5PanelRoute(req('/world/panel/vote',body),env,mock,A,headers);
 assert.equal((await response.json()).error,'deliberation_not_ready','court order must be accounted for');
 actions.push({action_type:'order_result',action_key:'r2',response:{status:'declined'}});
 day=9;
 response=await p5PanelRoute(req('/world/panel/vote',body),env,mock,A,headers);
 assert.equal(response.status,200,'late returning judge may vote on an unchanged completed record');
 assert.equal(voted,1,'only one verified ballot reached SQL');
});

test('v8.7.4 P5: ballot must fit the case; AI failure never stalls the panel; substitute and waiting time',async()=>{
 const caseId='case-p5';
 const acts=[{action_type:'question',action_key:'q1',response:{status:'done',answer:'신호가 바뀌었습니다.'}}];
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({caseId,journal:acts})));
 const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 const sheet={format:'verdict-world-sheet/v1',id:caseId,card:{kind:'criminal',title:'폭행'},records:[{id:'r1',title:'진단서',first:true}],
  questions:[{id:'q1',q:'보셨나요?'}],worlds:{did:{records:{r1:'공개 진단서'}}}};
 let substituted=null,peerVoted=true;const votes=[];const rpcs=[];
 const mock=async(url,opt={})=>{
  const u=String(url);
  if(u.includes('/shared_joint_panels?'))return json([{chair_id:A,peer_id:B,npc_id:'npc:p5',round:2,substituted}]);
  if(u.includes('/shared_joint_votes?')){assert.match(u,/round=eq\.2/,'only the current round counts');
   return json([{seat:'chair',evidence_hash:hash},...(peerVoted?[{seat:'peer',evidence_hash:hash}]:[])])}
  if(u.includes('/case_stock?'))return json([{assigned_to:A,state:'assigned',sheet}]);
  if(u.includes('/shared_judge_hearings?'))return json([{hearing_index:1,state:'completed'}]);
  if(u.includes('/shared_court_actions?'))return json(acts);
  if(u.includes('/world_secrets?'))return json([{truth:{branch:'did'}}]);
  if(u.includes('/shared_npc_public?'))return json([{npc_id:'npc:p5',life_status:'alive',public_profile:{name:'NPC 재판관'}}]);
  if(u.includes('/rpc/shared_joint_vote')){votes.push(JSON.parse(opt.body));return json(true)}
  if(u.includes('/rpc/shared_joint_status'))return json({state:'majority_ready',majority:'acquittal'});
  if(u.includes('/rpc/shared_joint_substitute')||u.includes('/rpc/shared_joint_reopen')||u.includes('/rpc/shared_joint_abstain')){rpcs.push({u,body:JSON.parse(opt.body)});return json(u.includes('reopen')?3:true)}
  throw Error('unexpected '+u);
 };
 // a civil ballot in a criminal case
 const bad=await p5PanelRoute(req('/world/panel/vote',{caseId,choice:'claim_granted',note:''}),env,mock,A,headers);
 assert.equal(bad.status,400);
 // AI down: the NPC still gives an opinion (the side that must prove loses), never reading the humans' votes
 const failing={reserve:async()=>7,estimate:()=>0.001,costOf:()=>0,finish:async()=>{},respond:async()=>{throw Error('down')}};
 const r=await (await p5PanelRoute(req('/world/panel/npc/decide',{caseId}),env,mock,A,headers,failing)).json();
 assert.equal(r.ok,true);assert.equal(r.fallback,true);
 assert.deepEqual(votes.map(v=>[v.p_seat,v.p_choice]),[['npc','acquittal']]);
 // no AI configured at all: same
 votes.length=0;
 assert.equal((await (await p5PanelRoute(req('/world/panel/npc/decide',{caseId}),env,mock,A,headers,{})).json()).fallback,true);
 // substituted associate: the substitute's opinion is given first, then the NPC's
 votes.length=0;substituted='peer';peerVoted=false;
 await p5PanelRoute(req('/world/panel/npc/decide',{caseId}),env,mock,A,headers,{});
 assert.deepEqual(votes.map(v=>[v.p_seat,v.p_actor]),[['peer',null],['npc',null]]);
 // the chair's substitute request carries at least 24 hours of waiting time
 await p5PanelRoute(req('/world/panel/substitute',{caseId}),{...env,JOINT_WAIT_HOURS:'2'},mock,A,headers);
 assert.equal(rpcs.at(-1).body.p_wait_hours,24);
 const reo=await (await p5PanelRoute(req('/world/panel/reopen',{caseId}),env,mock,B,headers)).json();
 assert.equal(reo.round,3);
});
