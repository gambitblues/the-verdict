import {publicCaseSheet,initialEvidence} from './public_case_projection.js';
import {sharedDeliberationReadiness} from './shared_courtroom.js';
import {panelStatus} from './p5_joint_panel.js';
import {npcDeliberationPrompt,validateNpcOpinion,panelChoices} from './p5_npc_deliberation.js';
import {validateSharedJudgment,adjudicateSharedJudgment,sharedJudgmentHash} from './shared_judgment.js';
import {checkProposal,npcProposal,agreedSentence} from './p5_sentence.js';

/* v8.7.4: when the AI cannot give the NPC (or substitute) judge's opinion, the panel still finishes: the judge who
 * cannot reach a conviction from the record decides against the side that must prove its case (in dubio pro reo /
 * the plaintiff's burden). It never looks at the other judges' votes. */
const FALLBACK={criminal:'acquittal',civil:'claim_denied',decision:'decision_no'};
const FALLBACK_REASON='법정에 나온 기록만으로는 확신이 서지 않아, 증명할 책임이 있는 쪽에 불리하게 판단합니다.';
const validCase=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{3,79}$/.test(x);
const validUuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const response=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{'content-type':'application/json; charset=utf-8'}
});
export async function p5PanelRoute(req,env,fetcher,uid,serviceHeaders,ai={}){
 if(env.P5_JOINT_PANEL_ENABLED!=='1')return response({error:'feature_disabled'},404);
 const url=new URL(req.url),isPost=req.method==='POST';
 let input={};
 if(isPost){try{input=await req.json()}catch{return response({error:'bad_json'},400)}}
 if(url.pathname==='/world/panel/slot'&&req.method==='GET'){
  try {
   const r=await fetcher(env.SUPABASE_URL+'/rest/v1/rpc/shared_joint_slot',{method:'POST',headers:serviceHeaders,body:JSON.stringify({p_actor:uid})});
   if(!r.ok)return response({error:'slot_unavailable'},503);
   return response({ok:true,...await r.json()});
  } catch {return response({error:'slot_unavailable'},503)}
 }
 if(url.pathname==='/world/panel/auto-assign'&&isPost){
  try {
   const r=await fetcher(env.SUPABASE_URL+'/rest/v1/rpc/shared_joint_auto_assign',{method:'POST',headers:serviceHeaders,body:JSON.stringify({p_actor:uid})});
   if(!r.ok)return response({error:'joint_assignment_unavailable'},503);
   const result=await r.json();
   return response({ok:result.ok===true,...result},result.ok?200:409);
  } catch {return response({error:'joint_assignment_unavailable'},503)}
 }
 const caseId=isPost?input.caseId:url.searchParams.get('caseId');
 if(!validCase(caseId))return response({error:'invalid_case'},400);
 const read=async path=>{
  const r=await fetcher(env.SUPABASE_URL+'/rest/v1/'+path,{headers:serviceHeaders});
  if(!r.ok)throw Error('read_failed');
  const data=await r.json();
  if(!Array.isArray(data))throw Error('invalid_data');
  return data;
 };
 const record=async()=>{
  const acts=await read('shared_court_actions?select=action_type,action_key,response&case_id=eq.'+encodeURIComponent(caseId)+'&order=created_at.asc');
  if(!acts.length)throw Error('hearing_incomplete');
  const bytes=new TextEncoder().encode(JSON.stringify({caseId,journal:acts}));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const evidenceHash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  return {acts,evidenceHash};
 };
 const rpc=async(name,body)=>{
  const r=await fetcher(env.SUPABASE_URL+'/rest/v1/rpc/'+name,{
   method:'POST',headers:serviceHeaders,body:JSON.stringify(body)
  });
  if(!r.ok)throw Error('rpc_rejected');
  return r.json();
 }; /* the deciding round's three opinions with their proposals → the agreed sentence (or null) */
 const agreedFor=async(caseId,majority)=>{
  const [panels,cases]=await Promise.all([
   read('shared_joint_panels?select=round&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1'),
   read('case_stock?select=sheet&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1')]);
  const votes=await read('shared_joint_votes?select=seat,choice,sentence&case_id=eq.'+encodeURIComponent(caseId)+
   '&round=eq.'+Number(panels[0]?.round||1)+'&limit=3');
  return agreedSentence(cases[0]?.sheet,votes,majority);
 };

 try{
  if(url.pathname==='/world/panel/bench'&&req.method==='GET'){
   const bench=await rpc('shared_joint_bench',{p_case:caseId,p_actor:uid});
   if(!bench||!Array.isArray(bench.seats)||bench.seats.length!==3||
    bench.seats[0]?.kind!=='human'||bench.seats[0]?.role!=='presiding'||
    bench.seats[1]?.role!=='associate'||bench.seats[2]?.kind!=='npc'||
    bench.seats[2]?.role!=='associate')
    return response({error:'bench_invalid'},503);
   return response({ok:true,bench});
  }
  if(url.pathname==='/world/panel/case'&&req.method==='GET'){
   const panels=await read('shared_joint_panels?select=chair_id,peer_id&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1');
   const bench=panels[0];
   if(!bench||(bench.chair_id!==uid&&bench.peer_id!==uid))return response({error:'not_panel_member'},403);
   const rows=await read('case_stock?select=case_id,state,sheet&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1');
   const row=rows[0];if(!row||row.state!=='assigned')return response({error:'case_not_found'},404);
   const secret=await read('world_secrets?select=truth&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1');
   const branch=secret[0]?.truth?.branch;
   if(!['did','didnt','reason'].includes(branch))return response({error:'case_not_sealed'},409);
   const [actions,hearings,clock,judgments,ballots]=await Promise.all([
    read('shared_court_actions?select=action_type,action_key,response,hearing_index,game_day&case_id=eq.'+encodeURIComponent(caseId)+'&order=created_at.asc&limit=250'),
    read('shared_judge_hearings?select=hearing_index,state,completed_game_day&case_id=eq.'+encodeURIComponent(caseId)+'&judge_id=eq.'+encodeURIComponent(bench.chair_id)+'&order=hearing_index.desc&limit=1'),
    read('shared_world_clock?select=game_day&id=eq.main&limit=1'),
    read('shared_case_judgments?select=case_id,result,public_order,game_day,record_hash&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1'),
    read('shared_joint_votes?select=seat&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1')
   ]);
   const hearing=hearings[0],worldDay=clock[0]?.game_day;
   // The first ballot closes the record in SQL 034. Expose the same state to both judges
   // so the UI does not offer evidence/witness/order actions that the database rejects.
   const canAct=!!hearing&&hearing.state==='completed'&&!judgments.length&&!ballots.length;
   const isChair=bench.chair_id===uid;
   const readiness=sharedDeliberationReadiness(row.sheet,actions,hearing?.hearing_index||0);
   const j=judgments[0];
   const publicJudgment=j?{result:j.result,order:j.public_order,worldDay:j.game_day,recordHash:j.record_hash}:null;
   return response({ok:true,case:publicCaseSheet(row.sheet,caseId),records:initialEvidence(row.sheet,caseId,branch),judgment:publicJudgment,
    actions,role:isChair?'chair':'associate',court:{
     worldDay,hearingIndex:canAct?hearing.hearing_index:null,
     canAct,canObserve:canAct,canOpenHearing:isChair,
     canDeliberate:!judgments.length&&readiness.ready,minimumHearings:readiness.minimumHearings,
     pendingOrders:readiness.pendingOrders,
     judgmentPublished:judgments.length>0
    }});
  }
  if(url.pathname==='/world/panel/open'&&isPost){
   if(!validUuid(input.peerId)||typeof input.npcId!=='string'||input.npcId.length>120)
    return response({error:'invalid_members'},400);
   // Chair is always the authenticated caller. Only pre-existing invited users
   // and registered living public NPCs pass the SQL gate.
   const inserted=await rpc('shared_joint_open',{
    p_case:caseId,p_chair:uid,p_peer:input.peerId,p_npc:input.npcId
   });
   return response({ok:true,created:inserted===true,caseId});
  }
  if(url.pathname==='/world/panel/bench'&&req.method==='GET'){
   const panels=await read('shared_joint_panels?select=chair_id,peer_id,npc_id&case_id=eq.'+
    encodeURIComponent(caseId)+'&limit=1');
   const bench=panels[0];
   if(!bench||(bench.chair_id!==uid&&bench.peer_id!==uid))
    return response({error:'not_panel_member'},403);
   const [names,npcs]=await Promise.all([
    read('players?select=user_id,name&user_id=in.('+bench.chair_id+','+bench.peer_id+')'),
    read('shared_npc_public?select=npc_id,public_profile&npc_id=eq.'+
     encodeURIComponent(bench.npc_id)+'&limit=1')
   ]);
   const name=id=>String(names.find(p=>p.user_id===id)?.name||'재판관').slice(0,80);
   return response({ok:true,caseId,role:bench.chair_id===uid?'chair':'peer',
    chair:{id:bench.chair_id,name:name(bench.chair_id)},
    peer:{id:bench.peer_id,name:name(bench.peer_id)},
    npc:{id:bench.npc_id,name:String(npcs[0]?.public_profile?.name||'NPC 재판관').slice(0,80)},
    presidingRole:'chair',npcRole:'associate'});
  }
  if(url.pathname==='/world/panel/status'&&req.method==='GET'){
   const status=await rpc('shared_joint_status',{p_case:caseId,p_actor:uid});
   if(status?.state==='majority_ready'){   // the agreed sentence is shown once the conclusion is reached (votes are no longer secret then)
    const agreed=await agreedFor(caseId,status.majority);
    if(agreed)return response({ok:true,...status,agreedSentence:{order:agreed.order,rule:agreed.rule}});
   }
   return response({ok:true,...status});
  }
  if(url.pathname==='/world/panel/vote'&&isPost){
   if(!['guilty','acquittal','partial','claim_granted','claim_denied','settled',
    'decision_yes','decision_no'].includes(input.choice)||
    typeof input.note!=='string'||input.note.length>1000)
    return response({error:'invalid_vote'},400);
   const row=await fetcher(env.SUPABASE_URL+'/rest/v1/shared_joint_panels?select=chair_id,peer_id&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1',{
    headers:serviceHeaders
   });
   if(!row.ok)return response({error:'panel_unavailable'},503);
   const panels=await row.json();
   const seat=panels?.[0]?.chair_id===uid?'chair':panels?.[0]?.peer_id===uid?'peer':null;
   if(!seat)return response({error:'not_panel_member'},403);
   // The native court cannot enter deliberation before required hearings or
   // while a judicial evidence order remains unresolved. Only the trusted
   // shared clock determines whether this hearing is currently open.
   const [cases,hearings]=await Promise.all([
    read('case_stock?select=state,sheet&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1'),
    read('shared_judge_hearings?select=hearing_index,state,completed_game_day&case_id=eq.'+
      encodeURIComponent(caseId)+'&judge_id=eq.'+encodeURIComponent(panels[0].chair_id)+
      '&order=hearing_index.desc&limit=1')
   ]);
   const hearing=hearings[0];
   if(!panelChoices(cases[0]?.sheet?.card?.kind).includes(input.choice))return response({error:'invalid_vote'},400);   // v8.7.4: must fit the case
   const {acts,evidenceHash}=await record();
   const readiness=sharedDeliberationReadiness(cases[0]?.sheet,acts,hearing?.hearing_index||0);
   if(cases[0]?.state!=='assigned'||hearing?.state!=='completed'||
    !readiness.ready)
    return response({error:'deliberation_not_ready',minimumHearings:readiness.minimumHearings},409);
   const proposal=checkProposal(cases[0]?.sheet,input.choice,input.sentence);   // 2026-11-08: sentence/amount with the vote
   if(proposal.error)return response({error:proposal.error},400);
   const created=await rpc('shared_joint_vote',{
    p_case:caseId,p_actor:uid,p_seat:seat,p_choice:input.choice,
    p_hash:evidenceHash,p_note:input.note,p_sentence:proposal.proposal
   });
   return response({ok:true,created:created===true,caseId,seat});
  }

  // Existing, already-invited accounts and stable public NPC IDs only.
  if(url.pathname==='/world/panel/partners'&&req.method==='GET'){
   const [players,npcs]=await Promise.all([
    read('players?select=user_id,name&user_id=neq.'+encodeURIComponent(uid)+'&limit=20'),
    read('shared_npc_public?select=npc_id,public_profile,life_status&life_status=eq.alive&limit=30')
   ]);
   return response({ok:true,players:players.filter(p=>validUuid(p.user_id))
    .map(p=>({id:p.user_id,name:String(p.name||'다른 판사').slice(0,80)})),
    npcs:npcs.map(n=>({id:n.npc_id,name:String(n.public_profile?.name||n.npc_id).slice(0,80)}))});
  }
  /* v8.7.4 rounds, revision, absence */
  if(url.pathname==='/world/panel/reopen'&&isPost){
   const round=await rpc('shared_joint_reopen',{p_case:caseId,p_actor:uid});
   return response({ok:true,caseId,round});
  }
  if(url.pathname==='/world/panel/abstain'&&isPost){
   const done=await rpc('shared_joint_abstain',{p_case:caseId,p_actor:uid});
   return response({ok:true,caseId,substituted:true,changed:done===true});
  }
  if(url.pathname==='/world/panel/substitute'&&isPost){
   const hours=Math.max(24,Number(env.JOINT_WAIT_HOURS||72));
   const done=await rpc('shared_joint_substitute',{p_case:caseId,p_actor:uid,p_wait_hours:hours});
   return response({ok:true,caseId,substituted:true,changed:done===true});
  }
  if(url.pathname==='/world/panel/npc/decide'&&isPost){
   const [panels,cases]=await Promise.all([
    read('shared_joint_panels?select=chair_id,peer_id,npc_id,round,substituted&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1'),
    read('case_stock?select=assigned_to,state,sheet&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1')
   ]);
   const panel=panels[0],world=cases[0];
   if(!panel||(panel.chair_id!==uid&&panel.peer_id!==uid))
    return response({error:'not_panel_member'},403);
   if(!world||world.assigned_to!==panel.chair_id||world.state!=='assigned')
    return response({error:'case_not_found'},404);
   const round=Number(panel.round||1),kind=world.sheet?.card?.kind;
   const votes=await read('shared_joint_votes?select=seat,evidence_hash&case_id=eq.'+encodeURIComponent(caseId)+'&round=eq.'+round+'&limit=3');
   const has=s=>votes.some(v=>v.seat===s),subPeer=panel.substituted==='peer';
   if(has('npc')&&has('peer'))return response({ok:true,alreadySubmitted:true});
   if(!has('chair')||(!has('peer')&&!subPeer))return response({error:'human_votes_pending'},409);
   const {acts,evidenceHash}=await record();
   if(votes.some(v=>v.evidence_hash!==evidenceHash))
    return response({error:'evidence_snapshot_changed'},409);
   const npc=(await read('shared_npc_public?select=npc_id,public_profile,life_status&npc_id=eq.'+
    encodeURIComponent(panel.npc_id)+'&limit=1'))[0];
   if(!npc||npc.life_status!=='alive')return response({error:'npc_unavailable'},409);
   // Retrieve only the sealed branch selector server-side, then project the
   // already-public first-hearing documents; never send worlds or branch to AI.
   const sealed=await read('world_secrets?select=truth&case_id=eq.'+
    encodeURIComponent(caseId)+'&limit=1');
   const branch=sealed[0]?.truth?.branch;
   if(!['did','didnt','reason'].includes(branch))
    return response({error:'case_not_sealed'},409);
   let initial;
   try{initial=initialEvidence(world.sheet,caseId,branch)}
   catch{return response({error:'initial_evidence_unavailable'},409)}
   const fallback={choice:FALLBACK[kind],reason:FALLBACK_REASON,fallback:true};
   if(!fallback.choice)return response({error:'invalid_case'},409);
   /* one opinion: the AI's if it can give a valid one, otherwise the fallback — the panel never stalls on the AI */
   const opinionOf=async profile=>{
    const built=npcDeliberationPrompt(world.sheet,acts,profile,initial);
    if(built.error||!ai.respond||!ai.reserve||!ai.finish||!ai.estimate||!ai.costOf)return fallback;
    const model=env.MODEL_TALK,limit=360;
    let ticket;try{ticket=await ai.reserve(env,uid,'npc',model,ai.estimate(env,model,built.instructions.length+built.input.length,limit,false),fetcher)}catch{ticket=undefined}
    if(ticket==null)return fallback;
    const started=Date.now();let modelResult;
    try{modelResult=await ai.respond(env,{model,instructions:built.instructions,input:built.input,schema:built.schema,maxTokens:limit},fetcher)}
    catch{modelResult={ok:false,usage:{}}}
    const opinion=modelResult?.ok?validateNpcOpinion(kind,modelResult.data):{error:'npc_ai_unavailable'};
    const usage=modelResult?.usage||{};
    await ai.finish(env,ticket,{p_model:modelResult.model||model,p_in:usage.input_tokens||0,p_out:usage.output_tokens||0,
     p_cost:Number(ai.costOf(env,model,usage).toFixed(6)),p_ok:!opinion.error,p_reason:opinion.error||null,p_ms:Date.now()-started},fetcher);
    return opinion.error?fallback:opinion;
   };
   let usedFallback=false;
   if(subPeer&&!has('peer')){
    const sub=await opinionOf({name:'대리 배석판사'});usedFallback||=!!sub.fallback;
    await rpc('shared_joint_vote',{p_case:caseId,p_actor:null,p_seat:'peer',p_choice:sub.choice,p_hash:evidenceHash,p_note:sub.reason,p_sentence:npcProposal(world.sheet,sub.choice)});
   }
   let added=false;
   if(!has('npc')){
    const opinion=await opinionOf(npc.public_profile);usedFallback||=!!opinion.fallback;
    added=await rpc('shared_joint_vote',{p_case:caseId,p_actor:null,p_seat:'npc',p_choice:opinion.choice,p_hash:evidenceHash,p_note:opinion.reason,p_sentence:npcProposal(world.sheet,opinion.choice)});
   }
   const status=await rpc('shared_joint_status',{p_case:caseId,p_actor:uid});
   return response({ok:true,submitted:added===true,fallback:usedFallback,status});
  }
  if(url.pathname==='/world/panel/finalize'&&isPost){
   if(env.P4_JUDGMENTS_ENABLED!=='1')return response({error:'feature_disabled'},404);
   const [panels,world,hearing]=await Promise.all([
    read('shared_joint_panels?select=chair_id,round&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1'),
    read('case_stock?select=assigned_to,state,sheet&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1'),
    read('shared_judge_hearings?select=state,hearing_index,completed_game_day&case_id=eq.'+
      encodeURIComponent(caseId)+'&judge_id=eq.'+encodeURIComponent(uid)+
      '&order=hearing_index.desc&limit=1')
   ]);
   if(!panels[0]||panels[0].chair_id!==uid)return response({error:'chair_required'},403);
   if(!world[0]||world[0].assigned_to!==uid||world[0].state!=='assigned')
    return response({error:'case_not_found'},404);
   if(hearing[0]?.state!=='completed')
    return response({error:'hearing_incomplete'},409);
   const hearingReadiness=sharedDeliberationReadiness(world[0].sheet,
    (await record()).acts,hearing[0].hearing_index);
   if(!hearingReadiness.ready)
    return response({error:'deliberation_not_ready',minimumHearings:hearingReadiness.minimumHearings},409);
   const status=await rpc('shared_joint_status',{p_case:caseId,p_actor:uid});
   if(status.state!=='majority_ready'||!panelChoices(world[0].sheet?.card?.kind).includes(status.majority))
    return response({error:'joint_majority_not_ready'},409);
   const {acts,evidenceHash}=await record();
   const votes=await read('shared_joint_votes?select=evidence_hash&case_id=eq.'+encodeURIComponent(caseId)+'&round=eq.'+Number(panels[0].round||1));
   if(votes.length!==3||votes.some(v=>v.evidence_hash!==evidenceHash))
    return response({error:'evidence_snapshot_changed'},409);
   const scored=env.P4_TRIAL_PARITY_ENABLED==='1';
   const ancillary=[...(world[0].sheet?.card?.charge?.orders||[]),
    ...(world[0].sheet?.card?.claim?.remedies||[])];
   const usesFit=scored&&ancillary.some(x=>x?.fit);
   const secrets=usesFit?await read('world_secrets?select=truth&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1'):[];
   const branch=usesFit?secrets[0]?.truth?.branch:undefined;
   if(usesFit&&!['did','didnt','reason'].includes(branch))
    return response({error:'truth_context_unavailable'},503);
   // the agreed sentence (middle of the three opinions) replaces the presiding judge's numbers; add-on orders stay the chair's
   const agreed=await agreedFor(caseId,status.majority);
   const sentence=agreed?{...agreed.sentence,addons:input.sentence?.addons,remedies:input.sentence?.remedies}:input.sentence;
   const submission={result:status.majority,citations:input.citations,
    reasons:input.reasons,sentence};
   const decision=scored?adjudicateSharedJudgment(world[0].sheet,acts,submission,caseId,{branch}):
    validateSharedJudgment(world[0].sheet,acts,submission);
   if(decision.error)return response({error:decision.error},400);
   const hash=await sharedJudgmentHash(caseId,uid,decision);
   const published=await rpc(scored?'shared_judgment_publish_scored':'shared_judgment_publish',{
    p_case:caseId,p_judge:uid,p_result:decision.result,
    p_order:decision.order,p_record_hash:hash,
    ...(scored?{p_score:decision.grade.score,p_review:decision.grade.review,
      p_grade:decision.grade}:{})
   });
   return response({ok:true,published:published===true,judgment:{
    result:decision.result,order:decision.order,citations:decision.citations,reasons:decision.reasons,recordHash:hash,
    ...(scored?{sentence:decision.sentence,grade:decision.grade}:{})
   }});
  }
  return response({error:'method_not_allowed'},405);
 }catch{return response({error:'panel_unavailable_or_conflict'},409)}
}
