/* P3-10: local operator-only AI authoring command.
 * No Worker route, no cron and no deployment. Requires --execute and OPENAI_API_KEY.
 * Writes only pending drafts, never review/ready/world-sheets/cases.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {generate,repairWorldSheet,seedPrompt}=require('../server/worker/src/terra_case_generator.cjs');
const {evaluate}=require('./terra-handoff-qa.cjs');
function safeFolder(root,id){
 const folder=path.resolve(root,'pending',id);
 const pending=path.resolve(root,'pending')+path.sep;
 if(!folder.startsWith(pending))throw Error('unsafe case output path');
 return folder;
}
async function produce({seed,root,fetcher,apiKey,model='gpt-6.1-terra'}){
 const spec=seedPrompt(seed);
 const folder=safeFolder(root,spec.id);
 if(fs.existsSync(folder))throw Error('이 ID는 이미 입고 대기 중입니다. 기존 결과를 덮어쓰지 않습니다.');
 const generated=await generate(spec,{fetcher,apiKey,model});
 if(!generated.ok&&generated.stage!=='world-sheet-handoff')return {ok:false,stage:generated.stage,errors:generated.errors};
 let candidate=generated.candidate;
 let worldSheet=generated.ok?generated.worldSheet:generated.unverifiedSheet;
 let qa=generated.ok?evaluate({...candidate,status:'review'},worldSheet):{ok:false,stage:generated.stage,errors:generated.errors};
 const usage=[...(generated.usage||[])];
 let repairs=0;
 while(!qa.ok&&repairs<2){
  // Never repair original hidden truth. Only the supplementary world sheet may change.
  const result=await repairWorldSheet(candidate,worldSheet,(qa.errors||[]).slice(0,40),{fetcher,apiKey,model});
  repairs++;
  if(result.usage)usage.push(result.usage);
  if(!result.ok)return {ok:false,stage:result.stage,errors:result.errors,repairs};
  worldSheet=result.worldSheet;
  qa=evaluate({...candidate,status:'review'},worldSheet);
 }
 if(!qa.ok)return {ok:false,stage:qa.stage,errors:qa.errors,repairs};
 fs.mkdirSync(folder,{recursive:true,mode:0o700});
 try{
  const files=[['candidate.json',candidate],['world-sheet.json',worldSheet],
   ['qa-result.json',{stage:qa.stage,trial:qa.trial,candidateHash:qa.candidateHash,sheetHash:qa.sheetHash,
    model,usage,repairs}]];
  for(const [name,data] of files)fs.writeFileSync(path.join(folder,name),JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
 }catch(e){fs.rmSync(folder,{recursive:true,force:true});throw e}
 return {ok:true,stage:'draft-awaiting-human-review',folder,id:spec.id,trial:qa.trial,model,repairs};
}
async function main(args=process.argv.slice(2),env=process.env){
 if(args.length!==2||args[0]!=='--execute')throw Error('명시 실행: node tests/terra-generate.cjs --execute seed.json');
 if(!env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY 환경변수가 필요합니다. 명령줄에 키를 넣지 마세요.');
 const seed=JSON.parse(fs.readFileSync(path.resolve(args[1]),'utf8'));
 const out=await produce({seed,root:process.cwd(),fetcher:fetch,apiKey:env.OPENAI_API_KEY,
  model:env.TERRA_CASE_MODEL||'gpt-6.1-terra'});
 console.log(JSON.stringify(out,null,2));
 if(!out.ok)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error('제작 중단: '+String(e.message).slice(0,350));process.exitCode=1});
module.exports={produce,safeFolder};
