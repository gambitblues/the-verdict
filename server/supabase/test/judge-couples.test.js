/* 040: a couple of judges — set only by the database owner, each player reads only their own couple. Run: npm test */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const A='00000000-0000-0000-0000-0000000000c1',B='00000000-0000-0000-0000-0000000000c2',C='00000000-0000-0000-0000-0000000000c3';
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
 insert into auth.users values ('${A}','a@x.kr',now()),('${B}','B@x.kr',now()),('${C}','c@x.kr',now());`);
for(const f of ['001_init.sql','037_colleague_court.sql','040_judge_couples.sql'])await db.exec(await readFile(new URL('../'+f,import.meta.url),'utf8'));
await db.exec(`insert into public.players(email,user_id,name) values ('a@x.kr','${A}','a'),('b@x.kr','${B}','b'),('c@x.kr','${C}','c');`);
async function as(uid,sql){
 await db.exec(`reset role; select set_config('test.uid','${uid}',false); set role authenticated;`);
 try{return (await db.query(sql)).rows}finally{await db.exec('reset role')}
}

test('the owner sets a couple once; running it again keeps the date',async()=>{
 assert.match((await db.query(`select public.set_judge_couple('a@x.kr','남','b@x.kr','여',35) as r`)).rows[0].r,/완료/);
 const t1=(await db.query(`select since from public.court_couples where user_id='${A}'`)).rows[0].since;
 await db.query(`select public.set_judge_couple('A@x.kr','남','b@x.kr','여',36)`);
 const r=(await db.query(`select since,age from public.court_couples where user_id='${A}'`)).rows[0];
 assert.equal(String(r.since),String(t1));assert.equal(r.age,36);
});
test('each player sees only their own couple; nobody writes from the game',async()=>{
 assert.equal((await as(A,'select * from public.court_couples')).length,2);
 assert.equal((await as(C,'select * from public.court_couples')).length,0,'a third player sees nothing');
 await assert.rejects(as(A,`insert into public.court_couples values ('${C}','${A}','남',35,now())`));
 await assert.rejects(as(A,`select public.set_judge_couple('a@x.kr','남','c@x.kr','여',35)`),'players cannot set couples');
});
test('someone already married is not re-married silently',async()=>{
 await assert.rejects(db.query(`select public.set_judge_couple('a@x.kr','남','c@x.kr','여',35)`),/이미 다른 사람/);
});
