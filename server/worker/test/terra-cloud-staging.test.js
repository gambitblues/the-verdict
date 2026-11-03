import test from 'node:test';
import assert from 'node:assert/strict';
import Terra from '../src/terra_cloud_staging.cjs';
const env={TERRA_REFILL_ENABLED:'1',OPENAI_API_KEY:'existing-key',
 SUPABASE_SERVICE_ROLE_KEY:'existing-service-key',SUPABASE_URL:'https://example.supabase.co',
 TERRA_MAX_CALLS_DAY:'8',TERRA_MAX_USD_DAY:'0.6',TERRA_MAX_USD_CASE:'0.3',
 TERRA_TARGET_STOCK:'2',TERRA_MAX_BATCH:'1',MODEL_CASE:'mock-terra'};
const fake=(names=[])=>async(url,opts={})=>{
 const rpc=url.split('/rpc/')[1];
 const data={
  refill_lease_claim:true,terra_pending_counts:{},refill_budget_reserve:45,
  terra_stage_draft:true,refill_budget_close:true,refill_lease_release:true
 };
 names.push({url,body:opts.body?JSON.parse(opts.body):null});
 if(rpc)return {ok:true,json:async()=>data[rpc]};
 return {ok:true,json:async()=>[]};
};
test('disabled default does not call network or AI',async()=>{
 let n=0;const r=await Terra.runCloudStaging({...env,TERRA_REFILL_ENABLED:'0'},
 {fetcher:async()=>{n++;throw Error('unexpected')},generateCase:async()=>{n++;throw Error('unexpected')}});
 assert.equal(r.stage,'disabled');assert.equal(n,0);
});
test('existing worker API key is used only in private scheduled generation; no ready publishing',async()=>{
 const calls=[];let got;
 const result=await Terra.runCloudStaging(env,{
  fetcher:fake(calls),random:()=> '00000000-0000-4000-8000-000000000123',
  generateCase:async(seed,options)=>{got={seed,options};return {ok:true,candidate:{id:seed.id,status:'draft'},
   worldSheet:{id:seed.id,status:'draft'},candidateHash:'a'.repeat(64),sheetHash:'b'.repeat(64)}}
 });
 assert.equal(result.stage,'staged-needs-browser-qa');
 assert.equal(got.options.apiKey,'existing-key');
 assert.ok(calls.some(x=>x.url.endsWith('/rpc/terra_stage_draft')));
 assert.ok(!calls.some(x=>/case_stock_admit|case_stock_assign/.test(x.url)));
 const reserve=calls.find(x=>x.url.endsWith('/rpc/refill_budget_reserve'));
 assert.equal(reserve.body.p_calls,4);
});
test('failed model generation never writes public or private stock',async()=>{
 const calls=[];const result=await Terra.runCloudStaging(env,{
  fetcher:fake(calls),random:()=> '11111111-0000-4000-8000-000000000123',
  generateCase:async()=>({ok:false})
 });
 assert.equal(result.stage,'quarantine');
 assert.equal(calls.some(x=>x.url.endsWith('/rpc/terra_stage_draft')),false);
 assert.ok(calls.some(x=>x.url.endsWith('/rpc/refill_budget_close')));
});
test('missing private DB cannot cause AI spend',async()=>{
 let n=0;const result=await Terra.runCloudStaging(env,{
  fetcher:async()=>({ok:false,status:503}),
  generateCase:async()=>{n++;throw Error('unexpected')}
 });
 assert.equal(result.stage,'failed-closed');assert.equal(n,0);
});
test('cost policy missing blocks before API call',async()=>{
 let n=0;
 await assert.rejects(()=>Terra.runCloudStaging({...env,TERRA_MAX_USD_CASE:''},{
  fetcher:async()=>{n++}}),/unsafe policy/);
 assert.equal(n,0);
});
