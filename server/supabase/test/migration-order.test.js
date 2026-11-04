/* Every numbered migration applies cleanly in file-name order on a fresh database (the order a person or the
 * Supabase SQL editor uses), including the files the feature tests skip (004, 005). Run: npm test */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('all numbered migrations apply in file-name order',async()=>{
 const db=new PGlite();
 await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users(id uuid primary key,email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email',current_setting('test.email',true)) $$;
  grant usage on schema public,auth to anon,authenticated,service_role;`);
 const files=(await readdir(new URL('..',import.meta.url))).filter(f=>/^\d{3}_.+\.sql$/.test(f)).sort();
 assert.ok(files.length>=31);
 for(const f of files){
  try{await db.exec(await readFile(new URL('../'+f,import.meta.url),'utf8'))}
  catch(e){assert.fail(`${f}: ${e.message}`)}
 }
 const r=await db.query(`select count(*)::int as n from pg_proc where proname='refill_budget_snapshot'`);
 assert.equal(r.rows[0].n,1);
});
