/* Cloudflare-compatible, in-memory 3-world x 6-seed simulation.
 * This does not substitute for Chromium/full courtroom QA.
 * Import the shared deterministic engine rather than inventing a second model.
 */
'use strict';
const Match=require('../../../match_engine.js');
const TRUTHS=['did','didnt','reason'];
function run(sheet){
 const before=JSON.stringify(sheet),errors=[];let completed=0;
 if(!sheet||!TRUTHS.every(k=>sheet.worlds?.[k]))return {ok:false,completed:0,errors:['missing-worlds']};
 for(const truth of TRUTHS)for(let n=0;n<6;n++){
  try{
   const seed='cloud:'+sheet.id+':'+n;
   const st=Match.start(sheet,{truth,seed}),lock=st.lock;let turns=0;
   for(let day=0;day<4;day++){
    while(st.actions>0){
     const options=Match.available(sheet,st);
     if(!options.length)break;
     Match.act(sheet,st,options[(n+day+turns)%options.length]);
     if(++turns>200)throw Error('too-many-actions');
    }
    Match.endDay(sheet,st);
    if(st.lock!==lock||Match.lockOf(sheet,truth)!==lock)throw Error('world-lock-changed');
   }
   for(const l of st.log.filter(x=>x.tag==='새 자료')){
    const record=sheet.records.find(r=>l.text.includes('「'+r.title+'」'));
    if(!record||!l.text.endsWith(sheet.worlds[truth].records[record.id]))
     throw Error('record-does-not-match-world');
   }
   const verdict=Match.verdict(sheet,st,truth);
   if(!verdict.open.includes(truth)||!st.done||st.truth!==truth||st.lock!==lock)
    throw Error('world-mismatch-at-verdict');
   if(Match.start(sheet,{truth,seed}).lock!==lock)throw Error('unstable-replay');
   completed++;
  }catch(e){errors.push(truth+'/'+n+': '+String(e.message||e).slice(0,80));}
 }
 if(JSON.stringify(sheet)!==before)errors.push('input-mutated');
 return {ok:errors.length===0&&completed===18,completed,errors:errors.slice(0,8)};
}
module.exports={run};
