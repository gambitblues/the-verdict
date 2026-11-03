/* P4 sealed courtroom transitions. All source branches remain on the Worker.
 * Stateless planner, supplied with server-verified assignment, hearing, previous actions.
 * The caller can pick an existing question or order, never provide answer text.
 */
const keyOf=(x,i)=>typeof x?.id==='string'&&/^[a-zA-Z0-9:_-]{1,80}$/.test(x.id)?x.id:'index-'+i;
export function courtroomPlan(sheet,branch,actions,kind,key){
 if(!sheet||!['did','didnt','reason'].includes(branch)||!Array.isArray(actions))
  return {error:'sealed_case_invalid'};
 if(kind!=='question'&&kind!=='order')return {error:'invalid_action'};
 const list=kind==='question'?sheet.questions:sheet.orders;
 if(!Array.isArray(list))return {error:'action_not_found'};
 const i=list.findIndex((x,j)=>(kind==='question'?keyOf(x,j):String(x?.record||''))===key);
 if(i<0)return {error:'action_not_found'};
 const item=list[i],world=sheet.worlds?.[branch];
 if(!world)return {error:'sealed_case_invalid'};
 const done=(type,k)=>actions.some(a=>a.action_type===type&&a.action_key===k&&a.response?.status==='done');
 const dependency=item.after;
 if(kind==='question'&&dependency){
  // Either an exhibit id, or "witness:priorQuestionId" dependency.
  const exhibit=(sheet.records||[]).find(r=>r.id===dependency);
  if(exhibit){
   if(!exhibit.first&&!done('order',dependency))return {error:'prerequisite_missing'};
  }else{
   const prior=(sheet.questions||[]).find((q,j)=>String(q.w||'')+':'+keyOf(q,j)===dependency);
   if(!prior||!done('question',keyOf(prior,sheet.questions.indexOf(prior))))return {error:'prerequisite_missing'};
  }
 }
 if(kind==='question'){
  const answer=item.a?.[branch];
  if(typeof answer!=='string'||!answer.trim())return {error:'answer_unavailable'};
  const reply={status:'done',answer:answer.slice(0,5000),question:String(item.q||'').slice(0,1000),
   witness:String(item.w||'').slice(0,80)};
  return {key,response:reply};
 }
 const outcome=item.result?.[branch];
 if(!['done','declined','delayed'].includes(outcome))return {error:'order_outcome_unavailable'};
 const record=(sheet.records||[]).find(r=>r.id===item.record);
 if(!record||record.first===true)return {error:'order_not_applicable'};
 const response={status:outcome,recordId:record.id,title:String(record.title||'').slice(0,200)};
 if(outcome==='done'){
  const content=world.records?.[record.id];
  if(typeof content!=='string')return {error:'record_unavailable'};
  response.text=content.slice(0,5000);
 }
 return {key,response};
}
export function courtActionId(item,index,kind){
 return kind==='question'?keyOf(item,index):String(item?.record||'');
}
