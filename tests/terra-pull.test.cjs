/* Terra pull (2026-11-08): a passing draft becomes a world sheet in the pool, a failing one is quarantined; the service
 * key comes only from the environment. Run: node tests/terra-pull.test.cjs */
'use strict';
const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {pull}=require('./terra-pull.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'terra-pull-test-'));
 const sheet=id=>({format:'verdict-world-sheet/v1',id,status:'draft',card:{kind:'civil',category:'civil',title:'가상 사건'},worlds:{did:{},didnt:{},reason:{}}});
 const marks=[],calls=[];
 const fetcher=async(url,opt)=>{const name=url.split('/rpc/')[1],body=JSON.parse(opt.body);calls.push({name,auth:opt.headers.authorization});
  if(name==='terra_take_drafts')return {ok:true,json:async()=>[{id:'terra-civil-20261108-good1',category:'civil',sheet:sheet('terra-civil-20261108-good1')},
   {id:'terra-civil-20261108-bad01',category:'civil',sheet:sheet('terra-civil-20261108-bad01')},{id:'../evil',category:'civil',sheet:sheet('../evil')}]};
  if(name==='terra_mark_draft'){marks.push(body);return {ok:true,json:async()=>true}}
  throw Error('unexpected '+name)};
 await assert.rejects(pull({env:{},fetcher,dir,log:()=>{},build:false}),/환경변수가 필요/);
 const env={SUPABASE_URL:'https://x.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-key'};
 const out=await pull({env,fetcher,dir,log:()=>{},build:false,qa:async f=>/good/.test(f)?{ok:true}:{ok:false,why:'six-tab browser QA: witness tab'}});
 assert.deepEqual(out.published,['terra-civil-20261108-good1']);assert.deepEqual(out.quarantined,['terra-civil-20261108-bad01']);assert.deepEqual(out.skipped,['../evil']);
 const written=JSON.parse(fs.readFileSync(path.join(dir,'terra-civil-20261108-good1.json'),'utf8'));
 assert.equal(written.status,'review');assert.match(written.source.note,/Terra 자동 제작/);assert.ok(!fs.existsSync(path.join(dir,'terra-civil-20261108-bad01.json')));
 assert.deepEqual(marks.map(m=>[m.p_id,m.p_state]),[['terra-civil-20261108-good1','published'],['terra-civil-20261108-bad01','quarantine']]);
 assert.match(marks[1].p_note,/witness tab/);
 assert.ok(calls.every(c=>c.auth==='Bearer service-key'));
 console.log('PASS terra pull: pass → pool, fail → quarantine, bad ids skipped, key from the environment only');
})().catch(e=>{console.error(e);process.exit(1)});
