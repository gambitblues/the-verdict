/* Advanced world engine: deterministic optional FUTURE events, separate from frozen trial facts. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.VerdictAdvancedWorld=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const copy=v=>JSON.parse(JSON.stringify(v));
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h>>>0};
function init(caseId,seed,people){if(!caseId||seed===undefined||!Array.isArray(people))throw Error('world setup');return {caseId,seed:String(seed),month:0,people:copy(people),facts:[],events:[],litigations:[]}}
function advance(world,catalogue,months=1){
 if(!Number.isInteger(months)||months<1||months>120)throw Error('Invalid month advance');
 const next=copy(world);
 for(let i=0;i<months;i++){next.month++;
  for(const item of catalogue){
   if(!item.id||!Number.isInteger(item.chancePer1000)||item.chancePer1000<0||item.chancePer1000>1000)throw Error('Invalid event rule');
   if(item.once&&next.events.some(e=>e.id===item.id))continue;
   if(item.requiredFacts&&!item.requiredFacts.every(f=>next.facts.includes(f)))continue;
   const n=hash(next.caseId+':'+next.seed+':'+next.month+':'+item.id)%1000;
   if(n>=item.chancePer1000)continue;
   next.events.push({id:item.id,month:next.month,detail:item.detail||'',eventType:item.eventType||'life'});
   for(const fact of item.addFacts||[])if(!next.facts.includes(fact))next.facts.push(fact);
   if(item.litigation&&item.litigation.eligible===true)next.litigations.push({id:item.litigation.id,origin:item.id,month:next.month,status:'potential',category:item.litigation.category});
  }
 }
 return next;
}
return Object.freeze({init,advance});
});
