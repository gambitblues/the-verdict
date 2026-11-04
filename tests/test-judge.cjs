/* THE VERDICT — automated TEST JUDGE for existing authored cases only.
 * No credentials, no AI spending, no live auth, no new case generation,
 * no production DB/secrets, no runtime save writes.
 * The judge's action and verdict policy NEVER accesses the hidden truth.
 * The harness sees the sealed truth only to verify integrity after the trial.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const M=require('../match_engine.js');
const TRUTHS=['did','didnt','reason'];
const CASES=path.resolve(__dirname,'../world-sheets/cases');
const DEFAULT_LIMIT=8;
const MAX_LIMIT=24;
const hash=t=>{let h=2166136261;for(const c of String(t))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h>>>0};
function judgeMove(options,policy,seed,turn){
 if(!options.length)return null;
 const preferred=policy==='cautious'
  ?['order','ask','confront','party']
  :policy==='cross-exam'
   ?['confront','ask','order','party']
   :['ask','order','confront','party'];
 // Choose among available acts from public labels and past turn count, NOT truth.
 const ranked=options.map((x,i)=>({x,i,rank:preferred.indexOf(x.type)===-1?10:preferred.indexOf(x.type)}));
 const best=Math.min(...ranked.map(x=>x.rank));
 const pool=ranked.filter(x=>x.rank===best);
 return pool[hash(seed+':'+turn)%pool.length].x;
}
function judgeVerdict(sheet,publicOptions,policy,seed){
 // The test judge sees only candidate interpretations from admitted records.
 // It is intentionally NOT allowed to consult state.truth or world.* text.
 if(!Array.isArray(publicOptions)||publicOptions.length===0)throw Error('legal_options_empty');
 if(policy==='cautious'&&sheet.card.kind==='criminal'&&publicOptions.includes('didnt'))
  return 'didnt';
 if(policy==='cross-exam'&&publicOptions.includes('reason'))return 'reason';
 return publicOptions[hash(seed+':choice')%publicOptions.length];
}
function simulateCase(sheet,{seed,truth,policy='cautious',days=4}){
 if(!TRUTHS.includes(truth)||!['cautious','cross-exam','balanced'].includes(policy))
  throw Error('invalid_test_judge_policy');
 if(!Number.isInteger(days)||days<2||days>8)throw Error('invalid_hearing_days');
 const source=JSON.stringify(sheet),run=M.start(sheet,{seed,truth}),locked=run.lock;
 const transcript=[],events=[];
 let selected=0;
 for(let d=0;d<days;d++){
  let turns=0;
  while(run.actions>0){
   const available=M.available(sheet,run);
   if(!available.length)break;
   const move=judgeMove(available,policy,seed,d*100+turns);
   if(!move)break;
   M.act(sheet,run,move);
   selected++;turns++;
   if(turns>30)throw Error('action_loop');
  }
  M.endDay(sheet,run);
  if(run.lock!==locked||M.lockOf(sheet,truth)!==locked)throw Error('truth_lock_mutated');
  events.push({hearing:d+1,actions:turns,newRecords:run.log.filter(x=>x.day===d+2&&x.tag==='새 자료').length});
 }
 for(const l of run.log.filter(x=>x.tag==='새 자료')){
  const record=sheet.records.find(r=>l.text.includes('「'+r.title+'」'));
  if(!record||!l.text.endsWith(sheet.worlds[truth].records[record.id]))
   throw Error('evidence_does_not_match_locked_truth');
 }
 const publicOptions=M.consistent(sheet,run);
 const choice=judgeVerdict(sheet,publicOptions,policy,seed);
 const result=M.verdict(sheet,run,choice);
 if(!run.done||!result.open.includes(truth)||!TRUTHS.includes(result.choice))
  throw Error('verdict_incompatible_with_evidence');
 if(JSON.stringify(sheet)!==source)throw Error('case_truth_mutated');
 if(run.log.some(x=>!x.text))throw Error('empty_court_log');
 const counts={};
 for(const x of run.log)if(x.tag)counts[x.tag]=(counts[x.tag]||0)+1;
 return {
  caseId:sheet.id,category:sheet.card.category,kind:sheet.card.kind,
  seed,policy,hearings:days,actions:selected,worldLock:locked,
  acquiredEvidence:counts['새 자료']||0,
  orders:(run.log.filter(x=>x.tag==='주문').length),
  delays:counts['지연']||0,refusals:counts['제출 거부']||0,
  witnessReversals:counts['번복']||0,
  legalOptions:result.open.length,choice:result.choice,
  correct:choice===truth,grade:result.grade,
  transcriptEvents:run.log.length,events,transcript:run.log.slice(0,180),
  // Actual true branch must NEVER be put in a player-visible report.
  _hiddenQA:{truth}
 };
}
function eligibleCases(root=CASES){
 return fs.readdirSync(root).filter(x=>x.endsWith('.json')).sort()
 .map(x=>{try{return JSON.parse(fs.readFileSync(path.join(root,x),'utf8'))}catch{return null}})
 .filter(x=>x&&['ready','review'].includes(x.status)&&x.worlds&&x.people&&x.records);
}
function pickCases(sheets,limit){
 const groups=new Map();
 for(const x of sheets){
  const key=x.card?.category||'unknown';
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(x);
 }
 // Round-robin across categories, so 8 cases are not all the same genre.
 const selected=[];
 for(let i=0;selected.length<limit&&i<200;i++){
  let appended=false;
  for(const group of [...groups.values()]){
   if(group[i]&&selected.length<limit){selected.push(group[i]);appended=true}
  }
  if(!appended)break;
 }
 return selected;
}
function runTestJudge({cases=DEFAULT_LIMIT,replays=3,days=4,policy='cautious',caseDir=CASES}={}){
 if(!Number.isInteger(cases)||cases<1||cases>MAX_LIMIT||
    !Number.isInteger(replays)||replays<1||replays>12)throw Error('test_judge_limits_invalid');
 const files=eligibleCases(caseDir),selected=pickCases(files,cases);
 if(!selected.length)throw Error('no_existing_playable_cases');
 const runs=[],errors=[];
 for(const sheet of selected){
  for(let i=0;i<replays;i++){
   // Hidden truth assigned before trial; the judge policy cannot inspect it.
   const truth=TRUTHS[hash(sheet.id+':test-world:'+i)%TRUTHS.length];
   const seed='test-judge:'+sheet.id+':'+i+':'+policy;
   try{
    const r=simulateCase(sheet,{seed,truth,policy,days});
    const recheck=simulateCase(sheet,{seed,truth,policy,days});
    if(JSON.stringify(r)!==JSON.stringify(recheck))throw Error('test_judge_not_reproducible');
    runs.push(r);
   }catch(e){errors.push({caseId:sheet.id,seed,error:String(e.message||e)})}
  }
 }
 const summary={
  actor:'TEST_JUDGE_ONLY',environment:'OFFLINE_NO_ACCOUNTS',
  selectedCases:selected.length,expectedTrials:selected.length*replays,
  completedTrials:runs.length,failedTrials:errors.length,
  acquiredEvidence:runs.reduce((n,r)=>n+r.acquiredEvidence,0),
  orders:runs.reduce((n,r)=>n+r.orders,0),
  delays:runs.reduce((n,r)=>n+r.delays,0),
  refusals:runs.reduce((n,r)=>n+r.refusals,0),
  witnessReversals:runs.reduce((n,r)=>n+r.witnessReversals,0),
  divergentCases:selected.filter(s=>new Set(runs.filter(r=>r.caseId===s.id).map(r=>r.choice)).size>1).length,
  casesWithAmbiguousVerdicts:new Set(runs.filter(r=>r.legalOptions>1).map(r=>r.caseId)).size,
  correctJudgments:runs.filter(r=>r.correct).length,
  caveat:'Unit simulation only. NOT Supabase multi-account E2E or full trial_play.js integration.'
 };
 return {ok:errors.length===0&&runs.length===summary.expectedTrials,summary,errors,
  // No hidden branch or unsealed evidence in the public QA report.
  cases:runs.map(({_hiddenQA,transcript,...safe})=>safe),
  selectedCaseIds:selected.map(x=>x.id)};
}
if(require.main===module){
 const count=Number(process.env.TEST_JUDGE_CASES||DEFAULT_LIMIT);
 const replay=Number(process.env.TEST_JUDGE_REPLAYS||3);
 const policy=process.env.TEST_JUDGE_POLICY||'cautious';
 const report=runTestJudge({cases:count,replays:replay,policy});
 const dest=process.env.TEST_JUDGE_REPORT;
 if(dest){fs.mkdirSync(path.dirname(path.resolve(dest)),{recursive:true});
  fs.writeFileSync(path.resolve(dest),JSON.stringify(report,null,2)+'\n')}
 console.log(JSON.stringify({ok:report.ok,...report.summary,errors:report.errors.slice(0,10)},null,2));
 if(!report.ok)process.exitCode=1;
}
module.exports={judgeMove,judgeVerdict,simulateCase,eligibleCases,pickCases,runTestJudge};
