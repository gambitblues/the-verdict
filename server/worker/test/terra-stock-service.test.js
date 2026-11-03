import test from 'node:test';import assert from 'node:assert/strict';
import Stock from '../src/terra_stock_service.cjs';
test('no provider request without trusted service credentials',async()=>{
 let calls=0;
 await assert.rejects(()=>Stock.assignCase({env:{url:'https://db.example.com',serviceKey:'',fetcher:async()=>{calls++}} ,judgeId:'00000000-0000-4000-8000-000000000001'}),/trusted/);
 assert.equal(calls,0);
});
test('assigned case comes from DB claim RPC, not local random selection',async()=>{
 const calls=[];
 const env={url:'https://db.example.com',serviceKey:'test-service',
 fetcher:async(url,opt)=>{calls.push({url,opt});return {ok:true,json:async()=>[{case_id:'terra-unique-001',category:'civil'}]}}};
 const r=await Stock.assignCase({env,judgeId:'00000000-0000-4000-8000-000000000001'});
 assert.equal(r.case_id,'terra-unique-001');assert.match(calls[0].url,/case_stock_assign$/);
 assert.equal(JSON.parse(calls[0].opt.body).p_judge,'00000000-0000-4000-8000-000000000001');
});
test('unverified case never reaches DB admission',async()=>{
 let calls=0;
 const a=await Stock.admitVerified({env:{url:'https://db.example.com',serviceKey:'test',fetcher:async()=>{calls++}},candidate:{id:'bad'},sheet:{},qa:{},browserQa:{}});
 assert.equal(a.ok,false);assert.equal(calls,0);
});
