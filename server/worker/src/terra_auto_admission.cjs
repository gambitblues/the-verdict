/* Author seed -> fully verifiable case admission payload.
 * No discretionary operator review on passing cases. Reject rather than silently
 * approving anything that cannot be checked by deterministic rules.
 * Caller owns the QA-only service credential and executes the admission RPC.
 */
'use strict';
const {createHash}=require('node:crypto');
const {validateAuthorSeed}=require('./terra_author_seed.cjs');
const {validateDraft}=require('./terra_case_pipeline.cjs');
const {prepareWorldSheet}=require('./terra_world_sheet_handoff.cjs');
const {run:trialQA}=require('./terra_cloud_trial_qa.cjs');


const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function verifyForAdmission(seed,candidate,sheet){
 const errors=[];
 const author=validateAuthorSeed(seed);
 errors.push(...author.errors);
 const check=validateDraft(candidate);
 errors.push(...check.errors);
 if(seed?.id!==candidate?.id||seed?.id!==sheet?.id)errors.push('author_seed_id_mismatch');
 if(seed?.category!==candidate?.card?.category||seed?.kind!==candidate?.card?.kind)
  errors.push('author_seed_category_or_kind_mismatch');
 if(candidate?.status!=='draft'||sheet?.status!=='draft')errors.push('case_not_unpublished_draft');
 const facts=seed?.immutableFacts?.map(f=>({id:f.id,text:f.fact}))||[];
 if(JSON.stringify(candidate?.immutableFacts)!==JSON.stringify(facts)||
    JSON.stringify(sheet?.immutableFacts)!==JSON.stringify(facts))
  errors.push('immutable_author_facts_not_preserved');
 // All author CONFIRMED leads must be explicitly traceable to a record with a
 // source/limitations; POSSIBLE leads are not automatically promoted as facts.
 const clues=Array.isArray(seed?.evidenceLeads)?seed.evidenceLeads:[];
 for(const l of clues.filter(x=>x.exists==='confirmed')){
  const record=(sheet?.records||[]).find(r=>r.authorLeadId===l.id);
  if(!record||!record.how||!record.limitation)
   errors.push('confirmed_evidence_unmapped:'+l.id);
 }
 for(const l of clues.filter(x=>x.exists!=='confirmed')){
  const record=(sheet?.records||[]).find(r=>r.authorLeadId===l.id);
  if(record?.first===true)errors.push('uncertain_evidence_disclosed_as_initial:'+l.id);
 }
 const curated={...candidate,status:'review'};
 const handoff=prepareWorldSheet(curated,sheet);
 if(!handoff.ok)errors.push(...handoff.errors);
 const trial=errors.length?{ok:false,completed:0,errors:['preflight_failed']}:trialQA(sheet);
 if(!trial.ok)errors.push(...trial.errors.map(x=>'trial:'+x));
 // A novel free order must have a matching secured order. Otherwise the case can
 // still be playable, but its dynamic/free-order quality target isn't met.
 const available=(sheet?.records||[]).filter(r=>r.first===false&&typeof r.id==='string');
 if(!available.some(r=>(sheet?.orders||[]).some(o=>o.record===r.id)))
  errors.push('no_working_followup_evidence_order');
 if(errors.length)return {ok:false,errors:[...new Set(errors)],trial,verification:null};
 const candidateHash=handoff.candidateHash,sheetHash=handoff.sheetHash;
 // Use stable idempotent world assignment: same event cannot change on retry.
 const fingerprint=digest({
  category:seed.category,immutableFacts:facts,
  evidenceLeads:clues.map(l=>[l.id,l.title,l.source,l.exists]),
  seedId:seed.id
 });
 const selector=parseInt(digest({id:seed.id,sheetHash}).slice(0,8),16)%3;
 const branch=['did','didnt','reason'][selector];
 return {ok:true,errors:[],trial,branch,
  payload:{
   p_id:seed.id,p_category:seed.category,p_sheet_hash:sheetHash,
   p_candidate_hash:candidateHash,p_fingerprint:fingerprint,p_sheet:sheet,
   p_verification:{decision:'stock',sheetHash,candidateHash,passed:true,
    kind:'author-automated-qa-v1',authorSeedHash:digest(seed),
    completedSimulations:trial.completed,immutableFacts: facts.length},
   p_branch:branch
  }};
}
module.exports={verifyForAdmission};
