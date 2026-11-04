import {adjudicateSentence} from './shared_sentence.js';
export function adjudicateFullSentence(sheet,result,input,citations=[],branch){
 const base=adjudicateSentence(sheet,result,input,citations);
 if(base.error)return base;
 const criminal=sheet.card?.kind==='criminal'&&['guilty','partial'].includes(result);
 const civil=sheet.card?.kind==='civil'&&['claim_granted','partial'].includes(result);
 const addons=input?.addons||{},remedies=input?.remedies||[];
 if(!addons||typeof addons!=='object'||Array.isArray(addons)||!Array.isArray(remedies))return {error:'ancillary_invalid'};
 const specs=Array.isArray(sheet.card?.charge?.orders)?sheet.card.charge.orders:[];
 const claims=Array.isArray(sheet.card?.claim?.remedies)?sheet.card.claim.remedies:[];
 if((!criminal&&Object.keys(addons).length)||(!civil&&remedies.length))return {error:'ancillary_not_allowed'};
 const extraScore=[],orders=[];
 for(const [id,value] of Object.entries(addons)){
  const spec=specs.find(x=>x.id===id);
  if(!spec||spec.ok===false||!criminal)return {error:'ancillary_not_permitted'};
  if(typeof spec.order!=='string'||spec.order.length>350)return {error:'ancillary_text_invalid'};
  if(spec.fit&&!['did','didnt','reason'].includes(branch))return {error:'truth_context_required'};
  const fit=!spec.fit||spec.fit[branch]!==false;
  if(Array.isArray(spec.range)){
   const step=spec.step||1;
   if(!Number.isInteger(value)||value<spec.range[0]||value>spec.range[1]||(value-spec.range[0])%step!==0)return {error:'ancillary_range_invalid'};
  }else if(value!==true)return {error:'ancillary_value_invalid'};
  orders.push(spec.order.replace(/%n%/g,String(value)));
  if(!spec.fixed)extraScore.push({key:'addon:'+id,points:fit?1:-3,text:fit?'적합한 부수 명령':'근거 부족 부수 명령'});
 }
 for(const spec of criminal?specs:[])if(spec.fixed&&!Object.hasOwn(addons,spec.id)){
  if(spec.ok===false)return {error:'mandatory_ancillary_invalid'};
  if(typeof spec.order!=='string')return {error:'mandatory_ancillary_text_missing'};
  if(spec.fit&&!['did','didnt','reason'].includes(branch))return {error:'truth_context_required'};
  const n=Array.isArray(spec.range)?spec.range[0]:null;
  orders.push(spec.order.replace(/%n%/g,n==null?'':String(n)));
 }
 for(const spec of criminal?specs:[])if(spec.expected&&!spec.fixed&&!Object.hasOwn(addons,spec.id))extraScore.push({key:'addon:'+spec.id,points:-2,text:'필요한 명령 누락'});
 for(const id of remedies){
  const spec=claims.find(x=>x.id===id);
  if(!civil||!spec||spec.ok===false||typeof spec.order!=='string'||remedies.filter(x=>x===id).length>1)return {error:'remedy_not_claimed'};
  if(spec.fit&&!['did','didnt','reason'].includes(branch))return {error:'truth_context_required'};
  const fit=!spec.fit||spec.fit[branch]!==false;
  orders.push(spec.order);extraScore.push({key:'remedy:'+id,points:fit?3:-4,text:fit?'적합한 청구 조치':'근거 부족 청구 조치'});
 }
 for(const spec of civil?claims:[])if(spec.fit?.[branch]===true&&!remedies.includes(spec.id))extraScore.push({key:'remedy:'+spec.id,points:-2,text:'필요한 청구 조치 누락'});
 const order=[base.order,...orders].filter(Boolean).join(' ');
 if(order.length>1200)return {error:'judgment_order_too_long'};
 return {...base,order,extraScore,sentence:base.sentence?{...base.sentence,addons,remedies}:null};
}
