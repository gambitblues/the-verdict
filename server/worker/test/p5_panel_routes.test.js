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
 const sheet={card:{kind:'civil',title:'사고 손해배상'},records:[
  {id:'r1',title:'감정서 원본',first:true}],questions:[{id:'q1',q:'신호를 보셨나요?'}],
  worlds:{did:{act:'SEALED_DONT_SEND'}}};
 const calls=[];const completed=[];
 const mock=async(url,opt={})=>{
  const u=String(url);calls.push({u,opt});
  if(u.includes('/shared_joint_panels?'))return json([{chair_id:A,peer_id:B,npc_id:'npc:p5'}]);
  if(u.includes('/shared_joint_votes?'))return json([
   {seat:'chair',evidence_hash:hash},{seat:'peer',evidence_hash:hash}
  ]);
  if(u.includes('/case_stock?'))return json([{assigned_to:A,state:'assigned',sheet}]);
  if(u.includes('/shared_court_actions?'))return json(acts);
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
  if(u.includes('/shared_judge_hearings?'))return json([{state:'completed',hearing_index:1}]);
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
