import test from 'node:test';
import assert from 'node:assert/strict';
import Generator from '../src/terra_case_generator.cjs';
const seed={id:'terra-warehouse-013',category:'violence',premise:'야간 창고의 두 작업자 사이에 충돌이 있었다는 신고가 접수됐으나 현장 확인 내용이 엇갈린다.'};
test('real production requires explicit input, model and API key',async()=>{
 assert.throws(()=>Generator.seedPrompt({id:'../oops',category:'violence',premise:seed.premise}));
 await assert.rejects(()=>Generator.requestJSON({fetcher:async()=>{},apiKey:'',model:'x',instructions:'x',input:'x'}),/API 키/);
});
test('first response generation sends JSON instructions and never stores data',async()=>{
 const calls=[];
 const output={format:'verdict-terra-candidate/v1',id:seed.id,status:'draft',card:{kind:'criminal',category:'violence',title:'임시 자료',summary:'임시'}};
 const result=await Generator.requestJSON({apiKey:'dummy-token',model:'test-model',instructions:'test',input:'test',
  fetcher:async(url,opt)=>{calls.push({url,opt});return {ok:true,json:async()=>({output_text:JSON.stringify(output),usage:{input_tokens:10}})}}});
 assert.deepEqual(result.object,output);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.openai.com/v1/responses');
 const body=JSON.parse(calls[0].opt.body);
 assert.equal(body.store,false);assert.equal(body.model,'test-model');assert.equal(body.text.format.type,'json_object');
});
test('malformed first pass cannot trigger sheet-writing second pass',async()=>{
 let calls=0;
 await assert.rejects(()=>Generator.generate(seed,{apiKey:'fake-token',model:'fake-model',
  fetcher:async()=>{calls++;return {ok:true,json:async()=>({output_text:JSON.stringify({id:seed.id,status:'ready',card:{category:seed.category}})})}}}),/draft/);
 assert.equal(calls,1);
});

test('incorrect candidate identity cannot reach second stage',async()=>{
 let calls=0;
 await assert.rejects(()=>Generator.generate(seed,{apiKey:'fake',model:'fake',
  fetcher:async()=>{calls++;return {ok:true,json:async()=>({output_text:JSON.stringify({id:'some-other-case',status:'draft',card:{category:'violence'}})})}}}),/ID/);
 assert.equal(calls,1);
});
test('non-2xx provider response fails without saving anything',async()=>{
 await assert.rejects(()=>Generator.requestJSON({apiKey:'fake',model:'fake',instructions:'x',input:'x',
  fetcher:async()=>({ok:false,status:401,json:async()=>({error:{message:'unavailable'}})})}),/401/);
});
