import {publicCaseSheet,initialEvidence} from './public_case_projection.js';
import {panelStatus} from './p5_joint_panel.js';
import {npcDeliberationPrompt,validateNpcOpinion,panelChoices} from './p5_npc_deliberation.js';
import {validateSharedJudgment,adjudicateSharedJudgment,sharedJudgmentHash} from './shared_judgment.js';

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
 };
 try{
  if(url.pathname==='/world/panel/case'&&req.method==='GET'){
   const panels=await read('shared_joint_panels?select=chair_id,peer_id&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1');
   const bench=panels[0];
   if(!bench||(bench.chair_id!==uid&&bench.peer_id!==uid))return response({error:'not_panel_member'},403);
   const rows=await read('case_stock?select=case_id,state,sheet&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1');
   const row=rows[0];if(!row||row.state!=='assigned')return response({error:'case_not_found'},404);
   const secret=await read('world_secrets?select=truth&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1');
   const branch=secret[0]?.truth?.branch;
   if(!['did','didnt','reason'].includes(branch))return response({error:'case_not_sealed'},409);
   const actions=await read('shared_court_actions?select=action_type,action_key,response,hearing_index,game_day&case_id=eq.'+encodeURIComponent(caseId)+'&order=created_at.asc&limit=250');
   return response({ok:true,case:publicCaseSheet(row.sheet,caseId),records:initialEvidence(row.sheet,caseId,branch),actions,role:bench.chair_id===uid?'chair':'peer'});
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
  if(url.pathname==='/world/panel/status'&&req.method==='GET'){
   const status=await rpc('shared_joint_status',{p_case:caseId,p_actor:uid});
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
   // The hash is a server-generated commitment to the public court record,
   // never supplied by the browser or derived from hidden world truth.
   const {evidenceHash}=await record();
   const created=await rpc('shared_joint_vote',{
    p_case:caseId,p_actor:uid,p_seat:seat,p_choice:input.choice,
    p_hash:evidenceHash,p_note:input.note
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
  if(url.pathname==='/world/panel/npc/decide'&&isPost){
   if(!ai.respond||!ai.reserve||!ai.finish||!ai.estimate||!ai.costOf)
    return response({error:'npc_ai_not_configured'},503);
   const [panels,votes,cases]=await Promise.all([
    read('shared_joint_panels?select=chair_id,peer_id,npc_id&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1'),
    read('shared_joint_votes?select=seat,evidence_hash&case_id=eq.'+encodeURIComponent(caseId)+'&limit=3'),
    read('case_stock?select=assigned_to,state,sheet&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1')
   ]);
   const panel=panels[0],world=cases[0];
   if(!panel||(panel.chair_id!==uid&&panel.peer_id!==uid))
    return response({error:'not_panel_member'},403);
   if(!world||world.assigned_to!==panel.chair_id||world.state!=='assigned')
    return response({error:'case_not_found'},404);
   if(votes.some(v=>v.seat==='npc'))return response({ok:true,alreadySubmitted:true});
   if(votes.length!==2||!votes.some(v=>v.seat==='chair')||!votes.some(v=>v.seat==='peer'))
    return response({error:'human_votes_pending'},409);
   const {acts,evidenceHash}=await record();
   if(votes.some(v=>v.evidence_hash!==evidenceHash))
    return response({error:'evidence_snapshot_changed'},409);
   const npc=(await read('shared_npc_public?select=npc_id,public_profile,life_status&npc_id=eq.'+
    encodeURIComponent(panel.npc_id)+'&limit=1'))[0];
   if(!npc||npc.life_status!=='alive')return response({error:'npc_unavailable'},409);
   const built=npcDeliberationPrompt(world.sheet,acts,npc.public_profile);
   if(built.error)return response({error:built.error},409);
   const model=env.MODEL_TALK,limit=360;
   const ticket=await ai.reserve(env,uid,'npc',model,
    ai.estimate(env,model,built.instructions.length+built.input.length,limit,false),fetcher);
   if(ticket===undefined)return response({error:'usage_unavailable'},503);
   if(ticket===null)return response({error:'daily_limit'},429);
   const started=Date.now();
   let modelResult;
   try{modelResult=await ai.respond(env,{model,instructions:built.instructions,input:built.input,
    schema:built.schema,maxTokens:limit},fetcher)}
   catch{modelResult={ok:false,usage:{}}}
   const opinion=modelResult?.ok?validateNpcOpinion(world.sheet.card.kind,modelResult.data)
    :{error:'npc_ai_unavailable'};
   const usage=modelResult?.usage||{};
   await ai.finish(env,ticket,{p_model:modelResult.model||model,
    p_in:usage.input_tokens||0,p_out:usage.output_tokens||0,
    p_cost:Number(ai.costOf(env,model,usage).toFixed(6)),
    p_ok:!opinion.error,p_reason:opinion.error||null,p_ms:Date.now()-started},fetcher);
   if(opinion.error)return response({error:opinion.error},503);
   const added=await rpc('shared_joint_vote',{
    p_case:caseId,p_actor:null,p_seat:'npc',p_choice:opinion.choice,
    p_hash:evidenceHash,p_note:opinion.reason
   });
   const status=await rpc('shared_joint_status',{p_case:caseId,p_actor:uid});
   return response({ok:true,submitted:added===true,status});
  }
  if(url.pathname==='/world/panel/finalize'&&isPost){
   if(env.P4_JUDGMENTS_ENABLED!=='1')return response({error:'feature_disabled'},404);
   const [panels,world,hearing]=await Promise.all([
    read('shared_joint_panels?select=chair_id&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1'),
    read('case_stock?select=assigned_to,state,sheet&case_id=eq.'+encodeURIComponent(caseId)+'&limit=1'),
    read('shared_judge_hearings?select=state,hearing_index&case_id=eq.'+
      encodeURIComponent(caseId)+'&judge_id=eq.'+encodeURIComponent(uid)+
      '&order=hearing_index.desc&limit=1')
   ]);
   if(!panels[0]||panels[0].chair_id!==uid)return response({error:'chair_required'},403);
   if(!world[0]||world[0].assigned_to!==uid||world[0].state!=='assigned')
    return response({error:'case_not_found'},404);
   if(hearing[0]?.state!=='completed')return response({error:'hearing_incomplete'},409);
   const status=await rpc('shared_joint_status',{p_case:caseId,p_actor:uid});
   if(status.state!=='majority_ready'||!panelChoices(world[0].sheet?.card?.kind).includes(status.majority))
    return response({error:'joint_majority_not_ready'},409);
   const {acts,evidenceHash}=await record();
   const votes=await read('shared_joint_votes?select=evidence_hash&case_id=eq.'+encodeURIComponent(caseId));
   if(votes.length!==3||votes.some(v=>v.evidence_hash!==evidenceHash))
    return response({error:'evidence_snapshot_changed'},409);
   const scored=env.P4_TRIAL_PARITY_ENABLED==='1';
   const submission={result:status.majority,citations:input.citations,
    sentence:input.sentence};
   const decision=scored?adjudicateSharedJudgment(world[0].sheet,acts,submission,caseId):
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
    result:decision.result,order:decision.order,citations:decision.citations,recordHash:hash,
    ...(scored?{sentence:decision.sentence,grade:decision.grade}:{})
   }});
  }
  return response({error:'method_not_allowed'},405);
 }catch{return response({error:'panel_unavailable_or_conflict'},409)}
}
