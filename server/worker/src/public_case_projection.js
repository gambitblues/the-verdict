/* P4 case projection. The Worker alone holds a sealed world-sheet.
 * Never ship worlds, truth, private motives, answer variants, order results,
 * hidden event branches, trial score, or raw verification metadata.
 */
export function publicCaseSheet(sheet,caseId){
 if(!sheet||typeof sheet!=='object'||sheet.format!=='verdict-world-sheet/v1'||sheet.id!==caseId)
  throw Error('invalid_sheet');
 const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(o||{},k)).map(k=>[k,o[k]]));
 const limited=(v,limit=1200)=>typeof v==='string'?v.slice(0,limit):v;
 const card=pick(sheet.card,['kind','category','title','summary','accused','complainant']);
 const charge=pick(sheet.card?.charge,['name','law','min','max','life','fine']);
 card.charge=charge;
 const people=(sheet.people||[]).slice(0,20).map(p=>pick(p,['key','name','role','age','job','edu','family','stake','leans']));
 const common=pick(sheet.common,['date','timeline','facts']);
 const records=(sheet.records||[]).slice(0,30).map(r=>pick(r,['id','title','kind','by','how','first']));
 const questions=(sheet.questions||[]).slice(0,40).map(q=>pick(q,['id','w','q','issue','after']));
 const orders=(sheet.orders||[]).slice(0,40).map(o=>pick(o,['record','issue','to','ask']));
 // No arbitrary extra fields from generated world-sheets are passed through.
 const result={caseId,card,people,common,records,questions,orders};
 const serialized=JSON.stringify(result);
 if(serialized.length>50000)throw Error('public_sheet_too_large');
 return result;
}
