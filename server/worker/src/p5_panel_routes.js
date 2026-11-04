import {panelStatus} from './p5_joint_panel.js';

const validCase=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{3,79}$/.test(x);
const validUuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const response=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{'content-type':'application/json; charset=utf-8'}
});
export async function p5PanelRoute(req,env,fetcher,uid,serviceHeaders){
 if(env.P5_JOINT_PANEL_ENABLED!=='1')return response({error:'feature_disabled'},404);
 const url=new URL(req.url),isPost=req.method==='POST';
 let input={};
 if(isPost){try{input=await req.json()}catch{return response({error:'bad_json'},400)}}
 const caseId=isPost?input.caseId:url.searchParams.get('caseId');
 if(!validCase(caseId))return response({error:'invalid_case'},400);
 const rpc=async(name,body)=>{
  const r=await fetcher(env.SUPABASE_URL+'/rest/v1/rpc/'+name,{
   method:'POST',headers:serviceHeaders,body:JSON.stringify(body)
  });
  if(!r.ok)throw Error('rpc_rejected');
  return r.json();
 };
 try{
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
   const acts=await fetcher(env.SUPABASE_URL+'/rest/v1/shared_court_actions?select=action_type,action_key,response&case_id=eq.'+encodeURIComponent(caseId)+'&order=created_at.asc',{
    headers:serviceHeaders
   });
   if(!acts.ok)return response({error:'court_unavailable'},503);
   const journal=await acts.json();
   if(!Array.isArray(journal)||!journal.length)return response({error:'hearing_incomplete'},409);
   const material=JSON.stringify({caseId,journal});
   const bytes=new TextEncoder().encode(material);
   const digest=await crypto.subtle.digest('SHA-256',bytes);
   const evidenceHash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
   const created=await rpc('shared_joint_vote',{
    p_case:caseId,p_actor:uid,p_seat:seat,p_choice:input.choice,
    p_hash:evidenceHash,p_note:input.note
   });
   return response({ok:true,created:created===true,caseId,seat});
  }
  return response({error:'method_not_allowed'},405);
 }catch{return response({error:'panel_unavailable_or_conflict'},409)}
}
