/* P5 three-judge panel — sentence and damages agreement (2026-11-08, planner decision: "3인 의견의 가운데 값").
 *
 * Each judge who finds liability proposes a sentence (criminal) or an amount (civil) with the vote. The NPC judge and a
 * substitute judge propose a fixed middle-of-range value. When the panel's conclusion is reached, the agreed sentence is
 * the middle of the three opinions ordered from most to least favourable to the defendant — a judge who found no
 * liability counts as the most favourable (court organisation act art. 66 applied to the amount). The chosen value is
 * always one judge's actual lawful proposal, never an average. Votes made before this rule (no proposal) leave the
 * sentence to the presiding judge, as before.
 */
import {adjudicateSentence} from './shared_sentence.js';

const YES=new Set(['guilty','partial','claim_granted']);
const int=n=>Number.isInteger(n)&&Number.isFinite(n);
const fineUnit=n=>n>=3000?100:n>=1000?50:10;
const SPEC_MISSING=new Set(['charge_spec_missing','claim_spec_missing','unsupported_sentence']);

/* only the plain numbers of a proposal; mitigation/aggravation need cited evidence, so a vote cannot carry them */
function plain(kind,input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 if(kind==='civil')return {amount:Number(input.amount)};
 const p={type:String(input.type||'')};
 if(['prison','suspend'].includes(p.type))p.months=Number(input.months);
 if(p.type==='suspend')p.susp=Number(input.susp);
 if(p.type==='fine'||input.withFine===true)p.fine=Number(input.fine);
 if(input.withFine===true)p.withFine=true;
 return p;
}

/* check a judge's proposal against the verified sheet. {ok, proposal|null} or {error} */
export function checkProposal(sheet,choice,input){
 if(!YES.has(choice))return {ok:true,proposal:null};
 const kind=sheet?.card?.kind;
 if(kind!=='criminal'&&kind!=='civil')return {ok:true,proposal:null};
 const p=plain(kind,input);
 if(!p){   // no numbers: fine only when the case has no sentencing spec (then the presiding judge decides, as before)
  const probe=adjudicateSentence(sheet,choice,{},[]);
  return SPEC_MISSING.has(probe.error)?{ok:true,proposal:null}:{error:'sentence_proposal_required'};
 }
 const r=adjudicateSentence(sheet,choice,{...p,mitigating:false,aggravating:false},[]);
 if(r.error)return SPEC_MISSING.has(r.error)?{ok:true,proposal:null}:{error:r.error};
 return {ok:true,proposal:p,order:r.order};
}

/* the NPC / substitute judge: the middle of the lawful range, snapped to the court's units */
export function npcProposal(sheet,choice){
 if(!YES.has(choice))return null;
 const card=sheet?.card||{};
 if(card.kind==='civil'){
  const c=card.claim;if(!c||!int(c.amount))return null;
  if(choice==='claim_granted')return {amount:c.amount};
  const [lo,hi]=Array.isArray(c.fair)?c.fair:[0,c.amount];
  let amount=Math.round((lo+hi)/2/10)*10;amount=Math.min(amount,c.amount-10);amount=Math.max(amount,10);
  return checkProposal(sheet,choice,{amount}).proposal||null;
 }
 if(card.kind!=='criminal')return null;
 const ch=card.charge;if(!ch||!int(ch.min)||!int(ch.max))return null;
 let p;
 if(ch.max<=0){const unit=fineUnit(ch.fine);p={type:'fine',fine:Math.max(unit,Math.round(ch.fine/2/unit)*unit)}}
 else{
  const min=Math.max(6,Math.ceil(ch.min*12/6)*6),max=Math.max(min,Math.floor(ch.max*12/6)*6);
  p={type:'prison',months:Math.round((min+max)/2/6)*6};
  if(ch.both==='must'){const unit=fineUnit(ch.fine);p.withFine=true;p.fine=Math.max(unit,Math.round(ch.fine/2/unit)*unit)}
 }
 return checkProposal(sheet,choice,p).proposal||null;
}

/* how heavy a proposal is for the defendant: [kind rank, amount] */
export function severity(p){
 if(!p)return [0,0];
 if('amount' in p&&!('type' in p))return [1,p.amount];
 return ({fine:[1,p.fine],suspend:[2,p.months],prison:[3,p.months],life:[4,0],death:[5,0]})[p.type]||[0,0];
}
const cmp=(a,b)=>{const x=severity(a),y=severity(b);return x[0]-y[0]||x[1]-y[1]};

/* votes: [{seat, choice, sentence}] for the deciding round. Returns {sentence, order, rule} or null (no agreement rule) */
export function agreedSentence(sheet,votes,majority){
 if(!YES.has(majority)||!Array.isArray(votes)||votes.length!==3)return null;
 const yes=votes.filter(v=>YES.has(v.choice));
 if(yes.some(v=>!v.sentence))return null;   // a vote from before this rule: the presiding judge decides, as before
 const ordered=votes.map(v=>YES.has(v.choice)?v.sentence:null).sort((a,b)=>a===null?-1:b===null?1:cmp(a,b));
 const tryOne=p=>{const r=p&&adjudicateSentence(sheet,majority,{...p,mitigating:false,aggravating:false},[]);return r&&!r.error?{sentence:p,order:r.order}:null};
 // the middle value; if it does not fit the conclusion (a full award under "partial"), the next lighter lawful one
 const mid=tryOne(ordered[1]);if(mid)return {...mid,rule:'middle'};
 for(const p of yes.map(v=>v.sentence).sort(cmp)){const r=tryOne(p);if(r)return {...r,rule:'lightest_lawful'}}
 return null;
}
