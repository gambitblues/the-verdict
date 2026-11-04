/* Local/manual Terra author handoff. Never commits, publishes, or admits a case.
 * node server/worker/scripts/terra-from-author.cjs validate world-sheets/author-seeds/example.json
 * OPENAI_API_KEY=... node server/worker/scripts/terra-from-author.cjs generate file.json
 * Generated drafts are stored in an ignored/local directory chosen by operator.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto');
const {validateAuthorSeed,seedToTerraInput}=require('../src/terra_author_seed.cjs');
const {parseAuthorMarkdown}=require('../src/terra_author_markdown.cjs');
const {generate}=require('../src/terra_case_generator.cjs');
const {verifyForAdmission}=require('../src/terra_auto_admission.cjs');
async function main(args=process.argv.slice(2)){
 const [action,input,outArg]=args;
 if(!['validate','generate','publish'].includes(action)||!input)throw Error('Usage: validate|generate|publish <author-seed.md|json> [output-directory]');
 const file=path.resolve(input),contents=fs.readFileSync(file,'utf8');
 const original=/\.md$/i.test(input)?parseAuthorMarkdown(contents,input):JSON.parse(contents);
 const check=validateAuthorSeed(original);
 for(const w of check.warnings)console.warn('주의:',w);
 if(!check.ok){for(const e of check.errors)console.error('검증 실패:',e);process.exitCode=2;return}
 console.log('기획안 구조 검증 통과:',original.id);
 if(action==='validate')return;
 if(action==='publish')return publishOne(original,outArg);
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
  immutableAuthorFacts:original.immutableFacts,
  authorEvidenceLeads:original.evidenceLeads,
  authorUnknowns:original.unknowns,
  authorSeedSha256:createHash('sha256').update(JSON.stringify(original)).digest('hex'),
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
 if(result.ok){
  const gate=verifyForAdmission(original,result.candidate,result.worldSheet);
  report.autoAdmissionQA={ok:gate.ok,errors:gate.errors,simulations:gate.trial.completed};
  report.status=gate.ok?'qa_stock_ready':'quarantine';
  if(gate.ok)fs.writeFileSync(path.join(dir,name+'.admission.json'),JSON.stringify(gate.payload,null,2)+'\n');
 }
 fs.writeFileSync(path.join(dir,name+'.review.json'),JSON.stringify(report,null,2)+'\n');
 if(!result.ok){console.error('Terra 생성은 검토 대상:',result.stage);process.exitCode=3;return}
 if(report.autoAdmissionQA?.ok!==true){console.error('자동 입고 QA 실패:',report.autoAdmissionQA?.errors?.join(' | '));process.exitCode=4;return}
 console.log('Terra 생성·자동 QA 종료:',path.join(dir,name+'.review.json'));
}

async function publishOne(seed,dirArg){
 if(process.env.TERRA_AUTHOR_ADMISSION_TARGET!=='qa')
  throw Error('현재 QA 자동 입고만 허용합니다. TERRA_AUTHOR_ADMISSION_TARGET=qa를 명시해야 합니다.');
 const url=process.env.QA_SUPABASE_URL,key=process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!/^https:\/\/[^/]+\/?.*$/.test(url)||!key)
  throw Error('독립 QA Supabase URL 및 서비스 키가 필요합니다.');
 const dir=path.resolve(dirArg||'terra-author-drafts'),name=seed.id;
 const candidate=JSON.parse(fs.readFileSync(path.join(dir,name+'.candidate.json'),'utf8'));
 const sheet=JSON.parse(fs.readFileSync(path.join(dir,name+'.world-sheet.draft.json'),'utf8'));
 // Re-check entire chain immediately before touching the case inventory.
 const verified=verifyForAdmission(seed,candidate,sheet);
 if(!verified.ok)throw Error('자동 입고 QA 실패: '+verified.errors.join(' | ').slice(0,800));
 const response=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/shared_case_admit_sealed',{
  method:'POST',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},
  body:JSON.stringify(verified.payload)
 });
 if(!response.ok)throw Error('QA 배당 재고 등록 실패 (HTTP '+response.status+')');
 const inserted=await response.json();
 if(typeof inserted!=='boolean')throw Error('QA 배당 재고 응답이 올바르지 않습니다.');
 const reviewPath=path.join(dir,name+'.review.json');
 const report=JSON.parse(fs.readFileSync(reviewPath,'utf8'));
 report.status='qa_stock_admitted';report.autoAdmitted=true;report.admittedTo='qa';
 fs.writeFileSync(reviewPath,JSON.stringify(report,null,2)+'\n');
 console.log(inserted?'PASS: QA 사건 재고 등록 완료 — 다음 공유 배당부터 사용 가능':'PASS: 같은 사건이 이미 QA 재고에 있어 중복 등록하지 않음');
 return inserted;
}

if(require.main===module)main().catch(e=>{console.error('Terra author intake:',e.message);process.exitCode=1});
module.exports={main,publishOne};
