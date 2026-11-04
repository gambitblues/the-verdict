/* Shared verdict review calls the SAME VerdictTrialCore.skill/evaluate functions
 * used by the native personal courtroom. Unscored legacy sheets fail closed:
 * no fabricated evidence weight or illegal-evidence status is guessed.
 */
import '../../../trial_core.js';
const DIRECTIONS={
 guilty:'convict',acquittal:'acquit',partial:'partial',
 claim_granted:'claimant',claim_denied:'respondent',
 settled:'settled',decision_yes:'claimant',decision_no:'respondent'
};
const isSide=x=>['p','d','n'].includes(x);
const validReview=r=>r&&Number.isFinite(r.strength)&&r.strength>=0&&r.strength<=100&&
 Number.isFinite(r.flaw)&&r.flaw>=0&&r.flaw<=100&&
 ['none','source','timing','illegal'].includes(r.flawType)&&isSide(r.side);
export function evaluateSharedTrial(sheet,actions,judgment,sentence,seed){
 const T=globalThis.VerdictTrialCore;
 if(!T?.skill||!T?.evaluate||!T?.opinionMatch)return {error:'trial_core_unavailable'};
 const citations=new Set(judgment?.citations||[]);
 const delivered=new Set((actions||[])
  .filter(a=>a.action_type==='order_result'&&a.response?.status==='done').map(a=>a.action_key));
 const rulings=new Map();
 for(const a of actions||[]){
  if(a.action_type!=='evidence_decision'||!['use','conditional','exclude'].includes(a.response?.decision))continue;
  const id=a.response?.recordId;
  if(typeof id!=='string')continue;
  if(!rulings.has(id)||Number(a.hearing_index||0)>=rulings.get(id).hearing)
   rulings.set(id,{decision:a.response.decision,hearing:Number(a.hearing_index||0)});
 }
 const evidence=[];
 const cites=[];
 for(const r of sheet.records||[]){
  if(!r.first&&!delivered.has(r.id))continue;
  const key=(r.first?'initial:':'order:')+r.id;
  if((citations.has(key)||rulings.has(r.id))&&!validReview(r.review))
   return {error:'evidence_review_metadata_required',recordId:r.id};
  const meta=r.review||{};
  evidence.push({
   id:r.id,title:String(r.title||r.id),strength:meta.strength||0,
   flaw:meta.flaw||0,flawType:meta.flawType||'none',
   revealed:2,decision:rulings.get(r.id)?.decision||(citations.has(key)?'use':null),
   publicFlaw:false,surface:meta.strength||0
  });
  if(citations.has(key))cites.push({
   label:String(r.title||r.id),side:meta.side||'n',
   illegal:meta.flawType==='illegal',weak:meta.flaw>50
  });
 }
 const heard=[];
 for(const a of actions||[]){
  if(a.action_type!=='question'||a.response?.status!=='done')continue;
  const q=(sheet.questions||[]).find(x=>x.id===a.action_key);
  if(citations.has('question:'+a.action_key)){
   if(!q?.review||!isSide(q.review.side))
    return {error:'testimony_review_metadata_required',questionId:a.action_key};
   cites.push({label:q.q||a.action_key,side:q.review.side,weak:q.review.weak===true,
    illegal:false});
  }
  heard.push({side:isSide(q?.review?.side)?q.review.side:'n',issue:q?.issue||null,
   w:0,struck:false,tainted:q?.review?.weak===true});
 }
 if(!cites.length)return {error:'evaluation_evidence_missing'};
 const dir=DIRECTIONS[judgment.result];
 if(!dir)return {error:'evaluation_choice_invalid'};
 const cards=(actions||[]).filter(a=>a.action_type==='motion'&&a.response?.status==='done'&&
  ['objection','delay'].includes(a.response?.type)&&
  ['accept','reject'].includes(a.response?.choice)&&
  typeof a.response?.valid==='boolean').map(a=>({
   id:a.action_key,type:a.response.type,valid:a.response.valid,choice:a.response.choice
  }));
 const trial={truth:'did',evidence,witnesses:[],heard,cards};
 const start=T.pressStart(Number(sheet.card?.importance)||2,{criminal:sheet.card.kind==='criminal'});
 const media=T.pressDay(start,trial,{twist:false});
 trial.media=media;
 const score=T.skill(trial,{
  dir,criminal:sheet.card.kind==='criminal',cites,reasons:judgment.reasons||[],
  sentence:sentence?.score||null,extra:sentence?.extraScore||[]
 });
 // Neutral audience pressure until public-opinion linkage is implemented.
 // The review explicitly records this projection instead of pretending its
 // underlying trial state is identical to a private career case.
 const audience=T.opinionMatch(media.O,dir);
 const review=T.evaluate(score.score,audience,trial,dir,seed);
 return {ok:true,score:score.score,review:review.review,
  items:score.items,assessors:review.scores,
  method:'VerdictTrialCore.skill/evaluate',
  inputMode:'server_disclosed_court_record',
  publicOpinion:{H:media.H,O:media.O,S:media.S,match:audience},
  parityLimit:'private witness personality, persistent NPC relationships, and media-life feedback are not reproduced by the shared grading projection'};
}
