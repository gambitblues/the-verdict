/* 041: careers put away to trash (nothing deleted), a fresh-start mark each player can read, players cannot run it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const A='00000000-0000-0000-0000-0000000000d1',B='00000000-0000-0000-0000-0000000000d2';
const db=new PGlite();
await db.exec(`
 create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth; create table auth.users(id uuid primary key, email text, invited_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('test.email', true)) $$;
 grant usage on schema auth to anon, authenticated, service_role;
 grant execute on all functions in schema auth to anon, authenticated, service_role;
 grant usage on schema public to anon, authenticated, service_role;
 alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
 insert into auth.users values ('${A}','a@x.kr',now()),('${B}','b@x.kr',now());`);
for(const f of ['001_init.sql','041_fresh_start.sql'])await db.exec(await readFile(new URL('../'+f,import.meta.url),'utf8'));
await db.exec(`insert into public.players(email,user_id,name) values ('a@x.kr','${A}','a'),('b@x.kr','${B}','b');
 insert into public.saves(user_id,slot,data) values ('${A}','1','old-a'),('${B}','1','old-b');
 insert into public.save_backups(user_id,slot,data,reason) values ('${A}','1','older-a','reset');`);
async function as(uid,sql){
 await db.exec(`reset role; select set_config('test.uid','${uid}',false); set role authenticated;`);
 try{return (await db.query(sql)).rows}finally{await db.exec('reset role')}
}

test('players cannot put careers away',async()=>{
 await assert.rejects(as(A,'select public.fresh_start_players()'));
 assert.equal((await as(A,'select * from public.fresh_starts')).length,0);
});
test('only the named accounts move to trash; nothing is deleted outright',async()=>{
 const msg=(await db.query(`select public.fresh_start_players(array['A@x.kr']) as m`)).rows[0].m;
 assert.match(msg,/1명 · 세이브 1개·보관본 1개/);
 assert.equal((await db.query(`select count(*)::int n from public.saves where user_id='${A}'`)).rows[0].n,0);
 assert.equal((await db.query(`select count(*)::int n from public.saves where user_id='${B}'`)).rows[0].n,1,'the other player keeps their game');
 assert.deepEqual((await db.query(`select data from public.save_trash`)).rows,[{data:'old-a'}]);
 assert.deepEqual((await db.query(`select data from public.backup_trash`)).rows,[{data:'older-a'}]);
});
test('each player reads only their own fresh-start mark; trash is unreadable',async()=>{
 assert.equal((await as(A,'select * from public.fresh_starts')).length,1);
 assert.equal((await as(B,'select * from public.fresh_starts')).length,0);
 await assert.rejects(as(A,'select * from public.save_trash'));
});
