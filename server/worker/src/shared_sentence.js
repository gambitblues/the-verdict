/* Shared P4/P5 sentence rules: mirror trial_play.js v8.3 court bounds.
 * Source of authority is the verified server world sheet, never AI or player.
 * Currency inputs use ten-thousand KRW units, as in the legacy trial engine. */
const int=n=>Number.isInteger(n)&&Number.isFinite(n);
const won=n=>n.toLocaleString('ko-KR')+'만 원';
const ym=m=>(Math.floor(m/12)?Math.floor(m/12)+'년':'')+(m%12?m%12+'개월':'');
const fineUnit=n=>n>=3000?100:n>=1000?50:10;
export function adjudicateSentence(sheet,result,input,citations=[]){
 const kind=sheet?.card?.kind;
 const yes=result==='guilty'||result==='partial'||result==='claim_granted';
 if(!yes)return {ok:true,kind:'none',order:'',sentence:null};
 if(!input||typeof input!=='object'||Array.isArray(input))return {error:'sentence_required'};
 if(kind==='civil'){
  const claim=sheet.card?.claim;
  if(!claim||!int(claim.amount)||claim.amount<=0||
   !Array.isArray(claim.fair)||claim.fair.length!==2||
   claim.fair.some(x=>!int(x)||x<0||x>claim.amount))
   return {error:'claim_spec_missing'};
  const amount=input.amount;
  if(!int(amount)||amount<=0||amount>claim.amount||
   (result==='claim_granted'&&amount!==claim.amount)||
   (result==='partial'&&amount>=claim.amount))
   return {error:'claim_amount_invalid'};
  const ref={lo:claim.fair[0],hi:claim.fair[1]};
  return {ok:true,kind:'civil',sentence:{type:'damages',amount,unit:'man_krw'},
   order:'피고는 원고에게 '+won(amount)+'을 지급하라.'+
    (amount<claim.amount?' 원고의 나머지 청구를 기각한다.':''),
   score:{what:'배상액',value:amount,lo:ref.lo,hi:ref.hi,mitig:0,aggr:0}};
 }
 if(kind!=='criminal')return {error:'unsupported_sentence'};
 const charge=sheet.card?.charge;
 if(!charge||!int(charge.min)||!int(charge.max)||charge.max<0||
  charge.min<0||charge.min>charge.max||
  (charge.max===0&&(!int(charge.fine)||charge.fine<=0)))return {error:'charge_spec_missing'};
 const type=input.type;
 const canFine=int(charge.fine)&&charge.fine>0;
 const canLife=charge.life===true,canDeath=charge.death===true;
 if(!['prison','suspend','fine','life','death'].includes(type)||
  (type==='fine'&&!canFine)||(type==='life'&&!canLife)||
  (type==='death'&&!canDeath))
  return {error:'sentence_type_not_allowed'};
 if((type==='prison'||type==='suspend')&&charge.max<=0)return {error:'custody_not_allowed'};
 if(input.withFine===true&&charge.both!=='may'&&charge.both!=='must')return {error:'additional_fine_not_allowed'};
 if(type==='death')return {ok:true,kind:'crim',sentence:{type},order:'피고인을 사형에 처한다.',
  score:{what:'형량',value:Infinity,lo:0,hi:charge.max*12,mitig:0,aggr:0}};
 if(type==='life')return {ok:true,kind:'crim',sentence:{type},order:'피고인을 무기징역에 처한다.',
  score:{what:'형량',value:charge.max*12+12,lo:0,hi:charge.max*12,mitig:0,aggr:0}};
 if(type==='fine'){
  const fine=input.fine,unit=fineUnit(charge.fine);
  if(!int(fine)||fine<unit||fine>charge.fine||fine%unit!==0)
   return {error:'fine_out_of_range'};
  if(charge.both==='must')return {error:'custodial_sentence_required'};
  return {ok:true,kind:'crim',sentence:{type,fine},order:'피고인을 벌금 '+won(fine)+'에 처한다.',
   score:{what:'벌금',value:fine,lo:unit,hi:charge.fine,mitig:0,aggr:0}};
 }
 const months=input.months;
 const grounds=Array.isArray(citations)?citations:[];
 const mitigation=(charge.mitigationCitations||[]);
 const aggravation=(charge.aggravationCitations||[]);
 const hasMitigation=input.mitigating===true&&grounds.some(k=>mitigation.includes(k));
 const hasAggravation=input.aggravating===true&&grounds.some(k=>aggravation.includes(k));
 if(input.mitigating===true&&!hasMitigation)return {error:'mitigation_not_supported_by_evidence'};
 if(input.aggravating===true&&!hasAggravation)return {error:'aggravation_not_supported_by_evidence'};
 const min=Math.max(6,Math.ceil(charge.min*12*(hasMitigation?0.5:1)/6)*6);
 const max=Math.max(min,Math.floor(charge.max*12/6)*6);
 if(!int(months)||months%6!==0||months<min||months>max)
  return {error:'prison_months_out_of_range'};
 if(type==='suspend'&&(!int(input.susp)||input.susp<1||input.susp>5||months>36))
  return {error:'suspension_out_of_range'};
 let penalty='피고인을 징역 '+ym(months)+'에 처한다.';
 if(type==='suspend')penalty+=' 다만 이 판결 확정일부터 '+input.susp+'년간 위 징역형의 집행을 유예한다.';
 let fine=null;
 if(charge.both==='must'||input.withFine===true){
  if(!canFine||!int(input.fine)||input.fine<fineUnit(charge.fine)||
   input.fine>charge.fine||input.fine%fineUnit(charge.fine)!==0)
   return {error:'required_fine_invalid'};
  fine=input.fine;
  penalty=penalty.replace('에 처한다.',' 및 벌금 '+won(fine)+'에 처한다.');
 }
 if(charge.both==='must'&&!fine)return {error:'mandatory_fine_missing'};
 const score={what:'형량',value:type==='suspend'?months*0.5:months,
  lo:Math.max(charge.min*12,Math.round(charge.max*12*0.2)),
  hi:charge.max*12,mitig:hasMitigation?1:0,aggr:hasAggravation?1:0};
 return {ok:true,kind:'crim',
  sentence:{type,months,...(type==='suspend'?{susp:input.susp}:{}),
   ...(fine?{fine}:{}),mitigating:hasMitigation,aggravating:hasAggravation},
  order:penalty,score};
}
