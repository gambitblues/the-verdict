/* 038: Terra drafts are taken for browser QA and then published or quarantined — service role only. Run: npm test */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
 grant usage on schema public,auth to anon,authenticated,service_role;`);
for(const f of ['001_init.sql','002_api_privileges.sql','003_case_stock.sql','004_case_refill_budget.sql','005_terra_private_staging.sql','032_request_role_claims.sql','038_terra_publish.sql'])
 await db.exec(await readFile(new URL('../'+f,import.meta.url),'utf8'));
const as=async(role,sql,p=[])=>{await db.exec(`reset role; select set_config('request.jwt.claims','${JSON.stringify({role})}',false); set role ${role};`);try{return await db.query(sql,p)}finally{await db.exec('reset role')}};
const svc=(s,p)=>as('service_role',s,p),user=(s,p)=>as('authenticated',s,p);
const H='a'.repeat(64);
const draft=id=>[id,'civil',JSON.stringify({id,status:'draft',format:'verdict-terra-candidate/v1',card:{category:'civil'}}),JSON.stringify({id,status:'draft',format:'verdict-world-sheet/v1',card:{category:'civil'}}),H,H];
test('take → publish / quarantine; published drafts stop counting as pending; players never see drafts',async()=>{
 for(const id of ['terra-civil-a','terra-civil-b'])assert.equal((await svc('select public.terra_stage_draft($1,$2,$3::jsonb,$4::jsonb,$5,$6) as ok',draft(id))).rows[0].ok,true);
 assert.deepEqual((await svc('select public.terra_pending_counts() as c')).rows[0].c,{civil:2});
 const taken=(await svc('select id,sheet from public.terra_take_drafts(5)')).rows;assert.equal(taken.length,2);assert.equal(taken[0].sheet.format,'verdict-world-sheet/v1');
 assert.equal((await svc(`select public.terra_mark_draft('terra-civil-a','published') as ok`)).rows[0].ok,true);
 assert.equal((await svc(`select public.terra_mark_draft('terra-civil-b','quarantine','six-tab QA failed: witness tab') as ok`)).rows[0].ok,true);
 assert.equal((await svc(`select public.terra_mark_draft('terra-civil-a','quarantine') as ok`)).rows[0].ok,false,'a decided draft stays decided');
 assert.deepEqual((await svc('select public.terra_pending_counts() as c')).rows[0].c,{},'the refill can make the next one');
 assert.equal((await svc('select count(*)::int n from public.terra_take_drafts(5)')).rows[0].n,0);
 await assert.rejects(svc(`select public.terra_mark_draft('terra-civil-a','verified')`),/invalid_state/);
 await assert.rejects(user('select * from public.terra_take_drafts(1)'),/permission denied|service_only/);
 await assert.rejects(user('select * from public.terra_pending_drafts'),/permission denied/);
});
