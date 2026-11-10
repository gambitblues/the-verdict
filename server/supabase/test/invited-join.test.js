/* 039: an invited account (auth.users.invited_at set) joins the player list on its first sign-in; a self sign-up does not.
 * Run: npm test (in server/supabase) */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const OLD='00000000-0000-0000-0000-0000000000a1',INV='00000000-0000-0000-0000-0000000000a2',SELF='00000000-0000-0000-0000-0000000000a3';
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
 alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
 insert into auth.users values ('${OLD}','old@x.kr',null),('${INV}','New@X.kr',now()),('${SELF}','self@x.kr',null);`);
await db.exec(await readFile(new URL('../001_init.sql',import.meta.url),'utf8'));
await db.exec(`insert into public.players(email,name) values ('old@x.kr','기존');`);
await db.exec(await readFile(new URL('../039_invited_players_join.sql',import.meta.url),'utf8'));

async function claim(uid,email){
 await db.exec(`reset role; select set_config('test.uid','${uid}',false), set_config('test.email','${email}',false); set role authenticated;`);
 try{return (await db.query('select public.claim_player() as ok')).rows[0].ok}finally{await db.exec('reset role')}
}
async function isPlayer(uid){
 await db.exec(`reset role; select set_config('test.uid','${uid}',false); set role authenticated;`);
 try{return (await db.query('select public.is_player() as ok')).rows[0].ok}finally{await db.exec('reset role')}
}

test('a hand-typed invite row still links on first sign-in',async()=>{
 assert.equal(await claim(OLD,'old@x.kr'),true);assert.equal(await isPlayer(OLD),true);
});
test('an invited account joins by itself, once',async()=>{
 assert.equal(await isPlayer(INV),false);
 assert.equal(await claim(INV,'New@X.kr'),true);assert.equal(await claim(INV,'New@X.kr'),true);
 assert.equal(await isPlayer(INV),true);
 const rows=(await db.query(`select email,name from public.players where user_id='${INV}'`)).rows;
 assert.deepEqual(rows,[{email:'new@x.kr',name:'new'}]);
});
test('a self sign-up account is never added',async()=>{
 assert.equal(await claim(SELF,'self@x.kr'),false);assert.equal(await isPlayer(SELF),false);
});
