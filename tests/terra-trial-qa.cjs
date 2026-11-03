/* P3-9: automated match-engine truth/record/witness/verdict smoke for STAGED cases.
 * In-memory and read-only; does not certify real-world law or actual browser rendering.
 */
'use strict';
const Match=require('../match_engine.js');
const {createHash}=require('node:crypto');
const TRUTHS=['did','didnt','reason'];
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function run(sheet,{seeds=6,days=4}={}){
 const errors=[],results=[],sampleErrors=15;
 const fail=(msg)=>{if(errors.length<sampleErrors)errors.push(msg)};
 if(!sheet||typeof sheet!=='object'||!TRUTHS.every(k=>sheet.worlds?.[k]))return {ok:false,errors:['세 가지 사건 세계가 필요합니다.'],results:[]};
 if(!Number.isInteger(seeds)||seeds<1||seeds>50||!Number.isInteger(days)||days<1||days>12)return {ok:false,errors:['시험 횟수 범위가 잘못되었습니다.'],results:[]};
 const before=hash(sheet);
 for(const truth of TRUTHS)for(let n=0;n<seeds;n++){
  const seed='staging:'+sheet.id+':'+n;let st;
  try{
   st=Match.start(sheet,{truth,seed});
   const locked=st.lock;let turns=0;
   for(let day=0;day<days;day++){
    while(st.actions>0){
     const opts=Match.available(sheet,st);
     if(!opts.length)break;
     const action=opts[(n+day+turns)%opts.length];Match.act(sheet,st,action);
     turns++;
    }
    Match.endDay(sheet,st);
    if(st.lock!==locked||Match.lockOf(sheet,truth)!==locked)throw Error('잠긴 세계 변경');
   }
   for(const l of st.log.filter(x=>x.tag==='새 자료')){
    const record=sheet.records.find(r=>l.text.includes('「'+r.title+'」'));
    if(!record||!l.text.endsWith(sheet.worlds[truth].records[record.id]))
     throw Error('자료 내용이 실제 세계 원문과 일치하지 않음');
   }
   const resolved=Match.verdict(sheet,st,truth);
   if(!resolved?.open?.includes(truth))throw Error('판사가 확인한 사실에서 실제 세계가 배제됨');
   if(st.truth!==truth||st.lock!==locked||!st.done)throw Error('선고 후 세계가 바뀌거나 결과 누락');
   const replay=Match.start(sheet,{truth,seed});
   if(replay.lock!==locked)throw Error('동일 사건·시드 재생 시 세계 불일치');
   results.push({truth,seed,actions:turns,grade:resolved.grade,newRecords:st.log.filter(x=>x.tag==='새 자료').length,verdict:true});
  }catch(e){fail(truth+'/'+seed+': '+String(e?.message||e))}
 }
 if(hash(sheet)!==before)fail('검수 실행이 세계 시트 입력을 변경함');
 return {ok:errors.length===0,errors,results,summary:{simulations:results.length,expected:TRUTHS.length*seeds,worlds:TRUTHS.length}};
}
module.exports={run};
