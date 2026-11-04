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
