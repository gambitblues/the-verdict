/* THE VERDICT v2.6 — four distinct randomly assigned cases at new career start */
'use strict';
(()=>{
const localDate=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
let launching=false;
function isNew(){
 if(!S.name||S.week!==0||S.ended)return false;
 if(S.legalWorld?.firstFour)return false;
 if((S.generatedCases||[]).some(c=>(S.cases[c.id]?.actions||[]).length||S.cases[c.id]?.verdict))return false;
 if((S.generatedCases||[]).length>4)return false;
 return true;
}
async function ensurePack(){
 if(CasePackEngine.pool(S).length>=80)return;
 try{
 const res=await fetch(new URL('./content-packs/beta-weekend-100-v1.json',location.href),{cache:'no-cache'});
 if(!res.ok)throw Error('팩 다운로드 실패');
 const p=await res.json();if(p.archetypes?.length!==100)throw Error('100건 무결성 오류');
 const already=(S.casePacks||[]).some(x=>x.packId===p.packId&&x.version===p.version);
 if(!already){const installed=CasePackEngine.install(S,p);if(!installed.ok)throw Error(installed.error||'팩 설치 실패')}
 }catch(e){console.warn('첫 배당 사건팩 준비 중',e)}
}
async function firstFour(){
 if(launching||!isNew())return;
 launching=true;
 try{
 await ensurePack();
 // Preserve existing judge records; suppress only untouched legacy starter cases on a genuinely new game.
 for(const c of CASES){if(c.generated||c.week>0)continue;const st=S.cases[c.id];if(st&&!st.verdict&&!(st.actions||[]).length)st.referred=true;}
 // Replace untouched generic starter cases so all four come from the curated 100-case pack.
 for(const c of CASES){if(c.generated&&!c.contentPack?.archetypeId&&S.cases[c.id]&&!S.cases[c.id].verdict&&!(S.cases[c.id].actions||[]).length)S.cases[c.id].referred=true;}
 const active=CASES.filter(c=>c.generated&&c.contentPack?.archetypeId&&S.cases[c.id]&&!S.cases[c.id].verdict&&!S.cases[c.id].referred&&c.week<=S.week);
 const chosen=new Set(active.map(c=>c.contentPack?.archetypeId).filter(Boolean));
 const pool=CasePackEngine.pool(S).filter(x=>!chosen.has(x.a.id));
 const picks=[];
 while(pool.length&&picks.length<4-active.length){const idx=Math.floor(rand()*pool.length);picks.push(pool.splice(idx,1)[0])}
 let done=active.length;
 for(const x of picks){
  try{const c=createGeneratedCase(x);if(c)done++}
  catch(e){console.warn('첫 사건 배당 오류',x.a.id,e)}
 }
 // Controlled fallbacks: do not silently fabricate duplicate archetype cases.
 if(done<4){for(const x of pool){if(done>=4)break;try{if(createGeneratedCase(x))done++}catch(e){console.warn('대체 사건 배당 오류',e)}}}
 if(done!==4){toast('사건팩 로딩에 문제가 있습니다. 첫 배당 '+done+'/4건을 확인해 주세요.');return;}
 S.legalWorld??={};
 S.legalWorld.firstFour=true;
 S.legalWorld.firstFourWeek=S.week;
 S.legalWorld.firstFourCaseIDs=CASES.filter(c=>c.generated&&!S.cases[c.id]?.referred&&!S.cases[c.id]?.verdict).slice(-4).map(c=>c.id);
 const db=S.realtimeInbox;
 if(db?.enabled){db.acceptedByDay??={};db.acceptedByDay[localDate()]=4;}
 ui.tab='home';ui.caseId=S.legalWorld.firstFourCaseIDs[0];
 log('첫 배당','새 법관 커리어 · 4건 자동 배당','100건 사건 원형에서 중복 없이 무작위 선택');
 save();render();toast('첫 사건 4건이 재판부에 배당됐습니다.');
 }finally{launching=false}
}
const formerManifest=loadPackManifest;
loadPackManifest=async function(...args){
 const result=await formerManifest(...args);
 if(isNew())await firstFour();
 return result;
};
const formerClick=clicker;
clicker=function(e){
 const action=e.target.closest('[data-action]')?.dataset.action;
 formerClick(e);
 if(action==='start'&&S.name)firstFour().catch(err=>console.warn('시작 4건 배당 오류',err));
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(isNew())firstFour().catch(err=>console.warn(err))});
else if(isNew())firstFour().catch(err=>console.warn(err));
})();
