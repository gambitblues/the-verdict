/* v8.7.4 review fixes: no AI call without a price (the dollar cap must hold), a judgment is never trimmed before
 * wording, and a witness's hidden attitude never reaches the prompt. Run: npm test */
import test from 'node:test';
import assert from 'node:assert/strict';
import {reserve,priced} from '../src/index.js';
import {npcPrompt,judgmentPrompt} from '../src/prompts.js';

test('a model without a price is never reserved (dollar cap cannot be switched off by a missing price)',async()=>{
 let called=0;const fetcher=async()=>{called++;return new Response('1',{status:200})};
 const env={SUPABASE_URL:'https://sb.test',SUPABASE_SERVICE_ROLE_KEY:'svc',PRICES:'{"m-priced":{"in":0.1,"out":0.5},"m-free":{"in":0,"out":0}}'};
 assert.equal(priced(env,'m-priced'),true);
 assert.equal(priced(env,'m-free'),false);
 assert.equal(priced(env,'m-missing'),false);
 assert.equal(priced({PRICES:'not json'},'m-priced'),false);
 assert.equal(await reserve(env,'u1','npc','m-missing',0.01,fetcher),undefined);
 assert.equal(await reserve(env,'u1','npc','m-free',0.01,fetcher),undefined);
 assert.equal(called,0,'no usage row, no AI call');
 assert.equal(await reserve(env,'u1','npc','m-priced',0.01,fetcher),1);
});

test('a judgment longer than one request is not trimmed; the engine text stays',()=>{
 const facts=Array.from({length:31},(_,i)=>`인정 사실 ${i+1}번 문장이다.`);
 assert.equal(judgmentPrompt({facts,issues:[],conclusion:'결론'}).error,'too_long');
 assert.equal(judgmentPrompt({facts:['가'.repeat(501)],issues:[],conclusion:'결론'}).error,'too_long');
 const ok=judgmentPrompt({facts:facts.slice(0,30),issues:[{title:'쟁점',text:'내용'}],conclusion:'결론'});
 assert.ok(!ok.error);assert.equal(JSON.parse(ok.input).facts.length,30);
});

test('only a visible manner is used for a witness: hidden attitudes fall back to plain speech',()=>{
 const base={role:'목격자',question:'무엇을 봤나요?',answer:'창문 너머로 사람을 봤습니다.'};
 for(const hidden of ['shield','protect','fear'])assert.match(npcPrompt({...base,attitude:hidden}).input,/아는 대로 차분히 말한다/);
 assert.match(npcPrompt({...base,attitude:'flip'}).input,/흔들린다/);
});
