/* Offline staging QA for a Terra candidate and a separately authored world sheet.
 * Usage: node tests/terra-handoff-qa.cjs candidate.json world-sheet.json
 * Read only: never writes output, changes status, or deploys to the game.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const handoff=require('../server/worker/src/terra_world_sheet_handoff.cjs');
function evaluate(candidate,sheet){
 const prepared=handoff.prepareWorldSheet(candidate,sheet);
 if(!prepared.ok)return {ok:false,stage:'candidate-handoff',errors:prepared.errors};
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'verdict-handoff-'));
 try{
  const file=path.join(dir,prepared.sheet.id+'.json');
  fs.writeFileSync(file,JSON.stringify(prepared.sheet,null,2)+'\n',{flag:'wx',mode:0o600});
  const check=cp.spawnSync(process.execPath,[path.join(__dirname,'world-sheets.test.cjs'),file],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  if(check.status!==0)return {ok:false,stage:'world-sheet-QA',errors:[check.stdout?.slice(-3000)||'',check.stderr?.slice(-1000)||''].filter(Boolean)};
  return {ok:true,stage:'staged-draft',id:prepared.sheet.id,candidateHash:prepared.candidateHash,sheetHash:prepared.sheetHash,
   note:'This is only schema/content QA. Not a playable case or a verified human approval.'};
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
if(require.main===module){
 const args=process.argv.slice(2);
 if(args.length!==2){console.error('Usage: node tests/terra-handoff-qa.cjs candidate.json world-sheet.json');process.exit(2)}
 try{
  const candidate=JSON.parse(fs.readFileSync(args[0],'utf8')),sheet=JSON.parse(fs.readFileSync(args[1],'utf8'));
  const result=evaluate(candidate,sheet);console.log(JSON.stringify(result,null,2));process.exit(result.ok?0:1);
 }catch(e){console.error('입고 검증 실패: '+e.message);process.exit(1)}
}
module.exports={evaluate};
