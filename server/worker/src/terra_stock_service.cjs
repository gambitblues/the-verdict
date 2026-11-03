/* P3-14 trusted-service adapter for private case-stock RPC.
 * Only pass verification artifacts that were independently checked by a
 * trusted server. Never invoke with browser/user-authenticated input alone.
 */
'use strict';
const {triage}=require('./terra_auto_triage.cjs');
function credentials({url,serviceKey,fetcher}){
 if(!/^https:\/\/[^/]+/.test(url||'')||!serviceKey||typeof fetcher!=='function')throw Error('trusted service configuration required');
}
async function rpc({url,serviceKey,fetcher},name,body){
 credentials({url,serviceKey,fetcher});
 const response=await fetcher(url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{apikey:serviceKey,authorization:'Bearer '+serviceKey,'content-type':'application/json'},
  body:JSON.stringify(body)
 });
 if(!response.ok)throw Error('stock RPC '+name+' failed: '+response.status);
 return response.json();
}
async function admitVerified({env,candidate,sheet,qa,browserQa,inventory,policy}={}){
 const decision=triage({candidate,sheet,qa,browserQa,inventory,policy});
 if(decision.decision!=='stock')return {ok:false,decision:decision.decision,reasons:decision.reasons};
 const item=decision.item;
 if(!item||item.published!==false||item.status!=='staged-approved')throw Error('not an unpublished verified case');
 // The trusted service should re-run QA, not trust tamperable browser artifacts.
 if(policy?.serverReverified!==true)return {ok:false,decision:'quarantine',reasons:['서버 독립 검증 기록이 없습니다.']};
 const result=await rpc(env,'case_stock_admit',{
  p_id:item.id,p_category:item.category,p_sheet_hash:item.sheetHash,
  p_candidate_hash:item.candidateHash,p_fingerprint:item.fingerprint,
  p_sheet:sheet,p_verification:{decision:'stock',passed:true,sheetHash:item.sheetHash,
    candidateHash:item.candidateHash}
 });
 return {ok:result===true,decision:result===true?'stock':'duplicate',id:item.id};
}
async function assignCase({env,judgeId,category=null}={}){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(judgeId||''))throw Error('valid invited judge UUID required');
 const rows=await rpc(env,'case_stock_assign',{p_judge:judgeId,p_category:category});
 if(!Array.isArray(rows))throw Error('invalid atomic claim response');
 return rows[0]||null; // no available stock is not a made-up offer
}
module.exports={rpc,admitVerified,assignCase};
