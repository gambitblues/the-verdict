/* 2026-11-08 P5 sentence/damages agreement: the middle of the three judges' opinions (planner decision). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {checkProposal,npcProposal,agreedSentence,severity} from '../src/p5_sentence.js';
import {p5PanelRoute} from '../src/p5_panel_routes.js';

const criminal={card:{kind:'criminal',charge:{name:'업무상과실',min:0,max:10,fine:10000,both:'may'}}};
const civil={card:{kind:'civil',claim:{amount:2700,fair:[1000,2000]}}};

test('a liability vote must carry a lawful proposal; mitigation cannot be smuggled in; no-spec cases stay as before',()=>{
 assert.equal(checkProposal(criminal,'guilty',undefined).error,'sentence_proposal_required');
 assert.equal(checkProposal(criminal,'guilty',{type:'prison',months:13}).error,'prison_months_out_of_range');
 const ok=checkProposal(criminal,'guilty',{type:'prison',months:24,mitigating:true});
 assert.equal(ok.ok,true);assert.deepEqual(ok.proposal,{type:'prison',months:24});
 assert.equal(checkProposal(criminal,'acquittal',{type:'prison',months:24}).proposal,null,'no proposal for an acquittal');
 assert.equal(checkProposal(civil,'partial',{amount:2700}).error,'claim_amount_invalid');
 assert.equal(checkProposal(civil,'claim_granted',{amount:2700}).ok,true);
 assert.deepEqual(checkProposal({card:{kind:'civil'}},'claim_granted',undefined),{ok:true,proposal:null});
 assert.deepEqual(checkProposal({card:{kind:'decision'}},'decision_yes',{amount:1}),{ok:true,proposal:null});
});

test('the NPC proposes the lawful middle of the range',()=>{
 assert.deepEqual(npcProposal(criminal,'guilty'),{type:'prison',months:66});
 assert.deepEqual(npcProposal(civil,'claim_granted'),{amount:2700});
 assert.deepEqual(npcProposal(civil,'partial'),{amount:1500});
 const fineOnly={card:{kind:'criminal',charge:{min:0,max:0,fine:500}}};
 assert.deepEqual(npcProposal(fineOnly,'guilty'),{type:'fine',fine:250});
 const must={card:{kind:'criminal',charge:{min:2,max:4,fine:4000,both:'must'}}};
 const p=npcProposal(must,'guilty');assert.equal(p.withFine,true);assert.equal(p.months,36);
 assert.equal(npcProposal(criminal,'acquittal'),null);
});

test('the agreed sentence is the middle opinion, never an average; a not-liable judge counts as the lightest',()=>{
 const v=(seat,choice,sentence)=>({seat,choice,sentence});
 let a=agreedSentence(criminal,[v('chair','guilty',{type:'prison',months:24}),v('peer','guilty',{type:'prison',months:60}),
  v('npc','guilty',{type:'suspend',months:24,susp:2})],'guilty');
 assert.deepEqual(a.sentence,{type:'prison',months:24});assert.equal(a.rule,'middle');assert.match(a.order,/징역 2년/);
 a=agreedSentence(criminal,[v('chair','guilty',{type:'prison',months:36}),v('peer','acquittal',null),
  v('npc','guilty',{type:'prison',months:60})],'guilty');
 assert.deepEqual(a.sentence,{type:'prison',months:36},'with one acquittal the lighter of the two guilty opinions');
 a=agreedSentence(civil,[v('chair','claim_granted',{amount:2700}),v('peer','partial',{amount:1200}),v('npc','partial',{amount:1500})],'partial');
 assert.equal(a.sentence.amount,1500);
 // the middle is a full award but the conclusion is partial → the next lighter lawful opinion
 a=agreedSentence(civil,[v('chair','claim_granted',{amount:2700}),v('peer','claim_granted',{amount:2700}),v('npc','partial',{amount:1500})],'partial');
 assert.equal(a.sentence.amount,1500);assert.equal(a.rule,'lightest_lawful');
 assert.equal(agreedSentence(criminal,[v('chair','guilty',null),v('peer','guilty',{type:'prison',months:24}),v('npc','guilty',{type:'prison',months:24})],'guilty'),null,
  'votes from before this rule leave the sentence to the presiding judge');
 assert.equal(agreedSentence(criminal,[],'acquittal'),null);
 assert.ok(severity({type:'death'})[0]>severity({type:'prison',months:999})[0]);
});

const A='00000000-0000-0000-0000-00000000000a',B='00000000-0000-0000-0000-00000000000b';
const headers={apikey:'qa',authorization:'Bearer service','content-type':'application/json'};
const env={P5_JOINT_PANEL_ENABLED:'1',SUPABASE_URL:'https://qa.example',P4_JUDGMENTS_ENABLED:'1',P4_TRIAL_PARITY_ENABLED:'1'};
const req=(path,body)=>new Request('https://worker.example'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const json=v=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}});

test('routes: the vote stores the proposal, finalize publishes the agreed sentence instead of the chair numbers',async()=>{
 const caseId='case-p5-sentence';
 const acts=[{action_type:'question',action_key:'q1',response:{status:'done',answer:'피고인이 신호를 위반했습니다.'}}];
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({caseId,journal:acts})));
 const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 const sheet={...criminal,records:[{id:'r1',title:'진단서',first:true,review:{strength:75,flaw:0,flawType:'none',side:'p'}}],questions:[{id:'q1',review:{side:'p'}}]};
 const calls=[];
 const votes=[{seat:'chair',choice:'guilty',sentence:{type:'prison',months:24},evidence_hash:hash},
  {seat:'peer',choice:'guilty',sentence:{type:'prison',months:60},evidence_hash:hash},
  {seat:'npc',choice:'acquittal',sentence:null,evidence_hash:hash}];
 const mock=async(url,opt={})=>{
  const u=String(url);calls.push({u,opt});
  if(u.includes('/shared_joint_panels?'))return json([{chair_id:A,peer_id:B,round:1}]);
  if(u.includes('/case_stock?'))return json([{assigned_to:A,state:'assigned',sheet}]);
  if(u.includes('/shared_judge_hearings?'))return json([{hearing_index:1,state:'completed',completed_game_day:8}]);
  if(u.includes('/shared_world_clock?'))return json([{game_day:8}]);
  if(u.includes('/shared_court_actions?'))return json(acts);
  if(u.includes('/shared_joint_votes?'))return json(votes);
  if(u.includes('/rpc/shared_joint_vote'))return json(true);
  if(u.includes('/rpc/shared_joint_status'))return json({state:'majority_ready',votesCast:3,majority:'guilty'});
  if(u.includes('/rpc/shared_judgment_publish'))return json(true);
  throw Error('unexpected '+u);
 };
 const missing=await p5PanelRoute(req('/world/panel/vote',{caseId,choice:'guilty',note:''}),env,mock,A,headers);
 assert.equal(missing.status,400);assert.equal((await missing.json()).error,'sentence_proposal_required');
 const ok=await (await p5PanelRoute(req('/world/panel/vote',{caseId,choice:'guilty',note:'',sentence:{type:'prison',months:24}}),env,mock,A,headers)).json();
 assert.equal(ok.ok,true);
 const sent=JSON.parse(calls.filter(c=>c.u.includes('/rpc/shared_joint_vote')).at(-1).opt.body);
 assert.deepEqual(sent.p_sentence,{type:'prison',months:24});
 const st=await (await p5PanelRoute(req('/world/panel/status?caseId='+caseId),env,mock,A,headers)).json();
 assert.match(st.agreedSentence.order,/징역 2년/,'1 acquittal + 2y + 5y → the middle is 2 years');
 const fin=await (await p5PanelRoute(req('/world/panel/finalize',{caseId,citations:['initial:r1'],sentence:{type:'prison',months:120}}),env,mock,A,headers)).json();
 assert.equal(fin.ok,true,JSON.stringify(fin));
 assert.match(fin.judgment.order,/징역 2년/);assert.doesNotMatch(fin.judgment.order,/징역 10년/);
});
