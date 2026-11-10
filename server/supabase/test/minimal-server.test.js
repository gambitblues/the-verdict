/* 2026-11-10: a live server that only has the login/save tables (001) must still take 035~037, and 038 must say
 * clearly which files come first. The first live run of 036 stopped at the shared-court tables it assumed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const run=async(db,f)=>db.exec(await readFile(new URL('../'+f,import.meta.url),'utf8'));
test('001 only → 035, 036, 037 apply; 038 explains what to run first',async()=>{
 const db=new PGlite();
 await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users(id uuid primary key,email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  grant usage on schema public,auth to anon,authenticated,service_role;`);
 await run(db,'001_init.sql');
 for(const f of ['035_player_career_reset.sql','036_joint_sentence_and_safe_reset.sql','037_colleague_court.sql'])await run(db,f);
 await run(db,'036_joint_sentence_and_safe_reset.sql');   // safe to run again
 assert.ok((await db.query(`select to_regprocedure('public.reset_player_career()') as f`)).rows[0].f,'the safe reset is installed');
 await assert.rejects(run(db,'038_terra_publish.sql'),/003_case_stock\.sql, 004_case_refill_budget\.sql, 005_terra_private_staging\.sql/);
 for(const f of ['003_case_stock.sql','004_case_refill_budget.sql','005_terra_private_staging.sql'])await run(db,f);
 await assert.rejects(run(db,'038_terra_publish.sql'),/032_request_role_claims\.sql/);
 await run(db,'032_request_role_claims.sql');await run(db,'038_terra_publish.sql');
 assert.ok((await db.query(`select to_regprocedure('public.terra_take_drafts(integer)') as f`)).rows[0].f);
});
