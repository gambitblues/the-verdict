/* P3-13 operator-neutral local stocking gate.
 * No provider calls, no publishing, no approval forgery. The local queue is
 * limited to candidates that pass all independent verification artifacts.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {triage}=require('../server/worker/src/terra_auto_triage.cjs');
const ID=/^[a-z][a-z0-9-]{3,79}$/;
function inspect({root,id,maxPerCategory=50}){
 if(!ID.test(id||''))throw Error('잘못된 사건 ID입니다.');
 const folder=path.resolve(root,'pending',id);
 const read=name=>JSON.parse(fs.readFileSync(path.join(folder,name),'utf8'));
 const candidate=read('candidate.json'),sheet=read('world-sheet.json');
 const qa=read('qa-result.json'),browserQa=read('browser-qa.json');
 if(candidate.id!==id||sheet.id!==id)throw Error('사건 ID와 폴더 이름 불일치');
 const inventoryPath=path.join(root,'pending','stock-index.json');
 const inventory=fs.existsSync(inventoryPath)?JSON.parse(fs.readFileSync(inventoryPath,'utf8')):[];
 const decision=triage({candidate,sheet,qa,browserQa,inventory,policy:{maxPerCategory}});
 return {decision,folder,id};
}
function main(args=process.argv.slice(2)){
 if(args.length!==2||args[0]!=='--inspect')throw Error('사용법: node tests/terra-stock.cjs --inspect terra-case-id');
 const result=inspect({root:process.cwd(),id:args[1]});
 console.log(JSON.stringify(result,null,2));
 if(result.decision.decision==='quarantine')process.exitCode=1;
}
if(require.main===module)try{main()}catch(e){console.error('자동 재고 검사 실패: '+e.message);process.exitCode=1}
module.exports={inspect};
