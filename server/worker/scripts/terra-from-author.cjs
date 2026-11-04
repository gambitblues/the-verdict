/* Local/manual Terra author handoff. Never commits, publishes, or admits a case.
 * node server/worker/scripts/terra-from-author.cjs validate world-sheets/author-seeds/example.json
 * OPENAI_API_KEY=... node server/worker/scripts/terra-from-author.cjs generate file.json
 * Generated drafts are stored in an ignored/local directory chosen by operator.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {validateAuthorSeed,seedToTerraInput}=require('../src/terra_author_seed.cjs');
const {generate}=require('../src/terra_case_generator.cjs');
const {run}=require('../../../tests/terra-trial-qa.cjs');
async function main(args=process.argv.slice(2)){
 const [action,input,outArg]=args;
 if(!['validate','generate'].includes(action)||!input)throw Error('Usage: validate|generate <author-seed.json> [output-directory]');
 const original=JSON.parse(fs.readFileSync(path.resolve(input),'utf8'));
 const check=validateAuthorSeed(original);
 for(const w of check.warnings)console.warn('주의:',w);
 if(!check.ok){for(const e of check.errors)console.error('검증 실패:',e);process.exitCode=2;return}
 console.log('기획안 구조 검증 통과:',original.id);
 if(action==='validate')return;
 if(!process.env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY는 로컬 환경변수로만 제공해 주세요.');
 // Explicit manual command only. No automatic paid calls on a git push.
 const result=await generate(seedToTerraInput(original),{
  apiKey:process.env.OPENAI_API_KEY,model:process.env.MODEL_CASE||'gpt-6.1-terra',fetcher:fetch
 });
 const dir=path.resolve(outArg||'terra-author-drafts');
 fs.mkdirSync(dir,{recursive:true});
 // Every output is unapproved; save rejected candidates for author revision.
 const safe=id=>id.replace(/[^a-z0-9-]/g,'');
 const name=safe(original.id);
 const report={
  seedId:original.id,sourceFile:path.resolve(input),generatedAt:new Date().toISOString(),
  status:'draft_only',autoAdmitted:false,
  seedWarnings:check.warnings,stage:result.stage,
  generatorOk:!!result.ok,errors:result.errors||[],
  authorReviewRequired:[
   '집필자가 고정한 사실의 누락·왜곡·반대 서술 여부',
   'Terra가 새로 제안한 사실·목격 범위·증거의 존재 여부',
   '가능성만 있는 증거를 실제 수집된 증거로 표현했는지',
   '형사·민사 법적 구성요건과 판결 종류, 관련 법령',
   'AI 자유 주문에서 자료가 범위를 넘어 공개될 가능성',
   '실제 6메뉴 재판 완주와 장기 NPC 연속성'
  ]
 };
 if(result.candidate)fs.writeFileSync(path.join(dir,name+'.candidate.json'),JSON.stringify(result.candidate,null,2)+'\n');
 if(result.worldSheet)fs.writeFileSync(path.join(dir,name+'.world-sheet.draft.json'),JSON.stringify(result.worldSheet,null,2)+'\n');
 fs.writeFileSync(path.join(dir,name+'.review.json'),JSON.stringify(report,null,2)+'\n');
 if(!result.ok){console.error('Terra 생성은 검토 대상:',result.stage);process.exitCode=3;return}
 console.log('Terra 초안 생성 완료. 수동 검수 전 배당 금지:',path.join(dir,name+'.review.json'));
}
if(require.main===module)main().catch(e=>{console.error('Terra author intake:',e.message);process.exitCode=1});
module.exports={main};
