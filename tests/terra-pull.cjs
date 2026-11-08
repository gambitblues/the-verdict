/* 2026-11-08 Terra → case pool. Takes drafts the Worker's daily refill staged, runs the same checks a written sheet
 * must pass (world-sheet rules, then the six-tab browser QA in the real courtroom), and publishes a passing draft as
 * world-sheets/cases/<id>.json (status review), so the normal build puts it in every player's pool. A failing draft is
 * quarantined with a short reason. Hidden worlds never leave the repository's own sheet format; nothing is printed
 * beyond ids and pass/fail.
 *
 * Run (service key from the environment only — GitHub Secrets in the workflow, never in the repo or a chat):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node tests/terra-pull.cjs [--limit 2] [--dry]
 * Needs DB 038. Exit 0 when nothing to do or all handled; the workflow opens a pull request with any new sheets. */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process');
const ROOT=path.join(__dirname,'..'),DIR=path.join(ROOT,'world-sheets','cases');

function rpcClient(env,fetcher){
 const base=String(env.SUPABASE_URL||'').replace(/\/$/,''),key=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!/^https:\/\//.test(base)||!key)throw Error('SUPABASE_URL와 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
 return async(name,body)=>{const r=await fetcher(base+'/rest/v1/rpc/'+name,{method:'POST',
  headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw Error('rpc '+name+' '+r.status);return r.json()};
}
/* the two gates, as child processes so a broken sheet cannot touch this process */
function realQA(file){
 const node=process.execPath;
 const sheetCheck=spawnSync(node,[path.join(ROOT,'tests','world-sheets.test.cjs'),file],{cwd:ROOT,encoding:'utf8'});
 if(sheetCheck.status!==0)return {ok:false,why:'world-sheet rules: '+(sheetCheck.stdout.split('\n').find(l=>/^\s+- /.test(l))||'').trim().slice(0,200)};
 const browser=spawnSync(node,[path.join(ROOT,'tests','terra-browser-qa.mjs'),'--sheet',file],{cwd:ROOT,encoding:'utf8',timeout:600000});
 if(browser.status!==0)return {ok:false,why:'six-tab browser QA: '+String(browser.stderr||browser.stdout).split('\n').find(l=>/Error|assert|실패/.test(l))?.slice(0,200)||'failed'};
 return {ok:true};
}
const ID=/^terra-[a-z]+-\d{8}-[a-z0-9]{4,16}$/;
async function pull({env=process.env,fetcher=globalThis.fetch,qa=realQA,limit=2,dry=false,dir=DIR,log=console.log,build=true}={}){
 const rpc=rpcClient(env,fetcher),out={published:[],quarantined:[],skipped:[]};
 const drafts=await rpc('terra_take_drafts',{p_limit:limit});
 for(const d of Array.isArray(drafts)?drafts:[]){
  const id=String(d?.id||'');
  if(!ID.test(id)||d?.sheet?.id!==id||d?.sheet?.format!=='verdict-world-sheet/v1'){out.skipped.push(id);continue}
  const target=path.join(dir,id+'.json');
  if(fs.existsSync(target)){if(!dry)await rpc('terra_mark_draft',{p_id:id,p_state:'published',p_note:'already in the pool'});out.skipped.push(id);continue}
  const sheet={...d.sheet,status:'review',source:{type:'original',note:`Terra 자동 제작 사건(${d.category}). 세계 시트 규칙과 여섯 메뉴 브라우저 QA를 통과해 ${new Date().toISOString().slice(0,10)}에 배당 풀에 들어옴. 실존 인물·사건과 무관한 가상 사건.`}};
  /* the browser QA writes its report only next to a sheet under pending/ (git-ignored: hidden worlds stay local) */
  const tmp=path.join(ROOT,'pending','pull-'+id);fs.rmSync(tmp,{recursive:true,force:true});fs.mkdirSync(tmp,{recursive:true});const file=path.join(tmp,id+'.json');
  fs.writeFileSync(file,JSON.stringify(sheet,null,1)+'\n');
  let verdict;try{verdict=await qa(file)}catch(e){verdict={ok:false,why:'qa crashed'}}
  finally{try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}}
  if(verdict.ok){
   if(!dry){fs.writeFileSync(target,JSON.stringify(sheet,null,1)+'\n');await rpc('terra_mark_draft',{p_id:id,p_state:'published',p_note:'browser QA passed'})}
   out.published.push(id);log(`✓ ${id} · 배당 풀에 추가`);
  }else{
   if(!dry)await rpc('terra_mark_draft',{p_id:id,p_state:'quarantine',p_note:String(verdict.why||'failed').slice(0,280)});
   out.quarantined.push(id);log(`✗ ${id} · 격리 (${String(verdict.why||'').slice(0,120)})`);
  }
 }
 if(out.published.length&&!dry&&build){
  const b=spawnSync(process.execPath,[path.join(ROOT,'tests','build-sheets.cjs')],{cwd:ROOT,encoding:'utf8'});
  if(b.status!==0)throw Error('build-sheets failed after publishing');
 }
 log(`Terra pull: 추가 ${out.published.length} · 격리 ${out.quarantined.length} · 건너뜀 ${out.skipped.length}`);
 return out;
}
module.exports={pull,realQA,ID};
if(require.main===module){
 const args=process.argv.slice(2),n=Number(args[args.indexOf('--limit')+1]);
 pull({limit:args.includes('--limit')&&n>0?n:2,dry:args.includes('--dry')}).catch(e=>{console.error('Terra pull failed:',e.message);process.exit(1)});
}
