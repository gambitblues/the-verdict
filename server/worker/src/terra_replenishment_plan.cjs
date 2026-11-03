/* P3-14: pure, bounded replenishment plan for a shared case-world.
 * This is not a timer or a provider call. A trusted operator may execute an
 * approved plan later, with persistent budgets and verified case inventory.
 */
'use strict';
const {TARGETS}=require('./terra_case_pipeline.cjs');
const CATEGORIES=Object.keys(TARGETS);
function plan({inventory=[],inFlight=[],policy={}}={}){
 const errors=[];
 const min=policy.minPerCategory??5,max=policy.targetPerCategory??12,limit=policy.maxNewCasesPerRun??3;
 const todayCalls=policy.usedCallsToday,capCalls=policy.maxCallsToday;
 const todayUsd=policy.usedUsdToday,budget=policy.maxUsdToday,est=policy.maxEstimatedUsdPerCase;
 if(!Array.isArray(inventory)||!Array.isArray(inFlight))errors.push('재고와 제작 중 목록은 배열이어야 합니다.');
 for(const [k,v] of Object.entries({min,max,limit,todayCalls,capCalls}))
  if(!Number.isInteger(v)||v<0)errors.push(k+': 유효한 정수가 필요합니다.');
 for(const [k,v] of Object.entries({todayUsd,budget,est}))
  if(typeof v!=='number'||!Number.isFinite(v)||v<0)errors.push(k+': 유효한 비용 상한이 필요합니다.');
 if(!errors.length&&(min>max||max>500||limit>30||capCalls>10000||budget>1000||est<=0))
  errors.push('사건 제작 한도 정책이 비정상적입니다.');
 if(errors.length)return {ok:false,errors,requests:[]};
 // An unattended run cannot count a single case twice.
 const seen=new Set(),counts=Object.fromEntries(CATEGORIES.map(c=>[c,{stock:0,working:0}]));
 for(const [items,kind] of [[inventory,'stock'],[inFlight,'working']])for(const item of items){
  if(!item||typeof item.id!=='string'||seen.has(item.id)||!counts[item.category]){errors.push('중복 ID 또는 잘못된 사건 분류');continue}
  seen.add(item.id);counts[item.category][kind]++;
 }
 if(errors.length)return {ok:false,errors,requests:[]};
 // Two generation calls plus up to two constrained repair calls per case.
 const capacity=Math.max(0,Math.min(limit,Math.floor((budget-todayUsd+1e-9)/est),Math.floor((capCalls-todayCalls)/4)));
 const shortages=CATEGORIES.map(category=>{
  const c=counts[category],available=c.stock+c.working;
  return {category,stock:c.stock,inFlight:c.working,available,missing:available<min?Math.max(0,Math.min(max,TARGETS[category])-available):0};
 }).filter(x=>x.missing).sort((a,b)=>b.missing-a.missing||a.category.localeCompare(b.category));
 const requests=[];
 for(const shortage of shortages)for(let i=0;i<shortage.missing&&requests.length<capacity;i++)
  requests.push({category:shortage.category,ordinal:i+1});
 return {ok:true,requests,shortages,remainingUsd:Math.max(0,budget-todayUsd),capacity,
  note:'No generated cases, allocations, API calls or DB writes were performed.'};
}
module.exports={plan};
