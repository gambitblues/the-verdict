/* Runs 001_init.sql in an in-memory Postgres (PGlite) with Supabase's roles and auth helpers stubbed, then checks
 * what each kind of caller can do: nobody (anon), an invited player, an uninvited account, and the Worker (service role).
 * Run: npm test (in server/supabase) */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const A='00000000-0000-0000-0000-00000000000a',B='00000000-0000-0000-0000-00000000000b',X='00000000-0000-0000-0000-00000000000c';
const db=new PGlite();
await db.exec(`
 create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth; create table auth.users(id uuid primary key, email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('test.email', true)) $$;
 grant usage on schema auth to anon, authenticated, service_role;
 grant execute on all functions in schema auth to anon, authenticated, service_role;
 grant usage on schema public to anon, authenticated, service_role;
 -- Supabase gives the API roles broad table rights by default; row level security and the revokes in the script must hold anyway
 alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
 alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
 insert into auth.users values ('${A}','a@x.kr'),('${B}','b@x.kr'),('${X}','stranger@x.kr');`);
await db.exec(await readFile(new URL('../001_init.sql',import.meta.url),'utf8'));
await db.exec(`insert into public.players(email,name) values ('a@x.kr','A'),('b@x.kr','B');`);

/* run SQL as a role (and user), always back to the owner afterwards */
async function as(role,uid,email,sql,params){
 await db.exec(`reset role; select set_config('test.uid','${uid||''}',false), set_config('test.email','${email||''}',false); set role ${role};`);
 try{return await db.query(sql,params)}finally{await db.exec('reset role')}
}
const fails=async(p,re)=>{await assert.rejects(p,re)};
const player=(uid,email)=>(sql,p)=>as('authenticated',uid,email,sql,p);
const pa=player(A,'a@x.kr'),pb=player(B,'b@x.kr'),px=player(X,'stranger@x.kr'),anon=(sql,p)=>as('anon',null,null,sql,p),svc=(sql,p)=>as('service_role',null,null,sql,p);

test('invite list: players claim their row, a stranger is refused, nobody can read the list',async()=>{
 assert.equal((await pa('select public.claim_player() as ok')).rows[0].ok,true);
 assert.equal((await pb('select public.claim_player() as ok')).rows[0].ok,true);
 assert.equal((await px('select public.claim_player() as ok')).rows[0].ok,false);
 await fails(pa('select * from public.players'),/permission denied/);
 await fails(anon('select public.claim_player()'),/permission denied/);
});
test('saves: own only, writes only through save_put, versions protect newer saves',async()=>{
 let r=(await pa(`select * from public.save_put('1','A-save-1',0,'8.7.1','phone')`)).rows[0];assert.deepEqual([r.ok,r.conflict,Number(r.rev)],[true,false,1]);
 r=(await pb(`select * from public.save_put('1','B-save-1',0,'8.7.1','pc')`)).rows[0];assert.equal(r.ok,true);
 assert.deepEqual((await pa('select data from public.saves')).rows.map(x=>x.data),['A-save-1'],'A sees only A');
 assert.deepEqual((await pb('select data from public.saves')).rows.map(x=>x.data),['B-save-1'],'B sees only B');
 await fails(anon('select * from public.saves'),/permission denied/);
 assert.equal((await px('select * from public.saves')).rows.length,0,'uninvited: nothing');
 await fails(px(`select * from public.save_put('1','x',0)`),/not_player/);
 await fails(pa(`update public.saves set data='hack'`),/permission denied/);
 await fails(pa(`insert into public.saves(user_id,slot,data) values ('${B}','2','hack')`),/permission denied/);
 await fails(pa(`delete from public.saves`),/permission denied/);
 // phone saves on rev 1 → rev 2; a tablet still on rev 1 must not overwrite it
 r=(await pa(`select * from public.save_put('1','A-phone-2',1,'8.7.1','phone')`)).rows[0];assert.equal(Number(r.rev),2);
 r=(await pa(`select * from public.save_put('1','A-tablet-old',1,'8.7.1','tablet')`)).rows[0];assert.deepEqual([r.ok,r.conflict,Number(r.rev),r.device],[false,true,2,'phone']);
 assert.equal((await pa('select data from public.saves').then(x=>x.rows[0].data)),'A-phone-2','the newer save stays');
 // the player chose to keep the tablet's: the phone's is kept as a backup first
 r=(await pa(`select * from public.save_put('1','A-tablet-kept',1,'8.7.1','tablet',true)`)).rows[0];assert.deepEqual([r.ok,Number(r.rev)],[true,3]);
 const bk=(await pa('select data,reason from public.save_backups order by id')).rows;assert.ok(bk.some(b=>b.data==='A-phone-2'&&b.reason==='overwritten'));
 assert.equal((await pb('select * from public.save_backups')).rows.length,0,'B cannot see A\'s backups');
 await fails(pa(`select * from public.save_put('3','x',0)`),/bad_slot/);
});
test('shared world: players read, nobody but the Worker writes; hidden truths are Worker-only',async()=>{
 assert.equal((await pa('select id from public.world_state')).rows.length,1);
 assert.equal((await px('select id from public.world_state')).rows.length,0);
 await fails(pa(`update public.world_state set data='{"x":1}'`),/permission denied/);
 await fails(pa(`insert into public.world_state(id) values ('mine')`),/permission denied/);
 await svc(`update public.world_state set data='{"day":1}', version=version+1`);
 await svc(`insert into public.world_secrets(case_id,truth) values ('c1','{"truth":"did"}')`);
 await fails(pa('select * from public.world_secrets'),/permission denied/);
 await fails(anon('select * from public.world_secrets'),/permission denied/);
});
test('AI usage: reserve before calling; limits hold for every call; players cannot reserve or log',async()=>{
 await fails(pa(`select public.ai_reserve('${A}','npc','gpt-6-luna',0.001,3,1)`),/permission denied/);
 await fails(pa(`select * from public.ai_usage_today('${A}')`),/permission denied/);
 await fails(pa(`insert into public.ai_usage(user_id,kind,model) values ('${A}','npc','m')`),/permission denied/);
 const ids=[];for(let i=0;i<4;i++)ids.push((await svc(`select public.ai_reserve('${A}','npc','gpt-6-luna',0.001,3,1) as id`)).rows[0].id);
 assert.equal(ids.filter(Boolean).length,3,'the 4th call over a limit of 3 is refused, even while the first 3 are still running');
 await svc(`select public.ai_finish(${ids[0]},'gpt-6-luna',1000,200,0.0002,true,null,800)`);
 const u=(await svc(`select * from public.ai_usage_today('${A}')`)).rows[0];assert.equal(Number(u.calls),3);
 // money: a call is counted at its worst-case price while it runs
 assert.equal((await svc(`select public.ai_reserve('${B}','judgment','gpt-6-luna',0.6,100,1) as id`)).rows[0].id!=null,true);
 assert.equal((await svc(`select public.ai_reserve('${B}','judgment','gpt-6-luna',0.6,100,1) as id`)).rows[0].id,null,'a second running call would pass the money limit');
 assert.equal((await pa('select count(*)::int as n from public.ai_usage')).rows[0].n,3,'a player reads only their own usage');
});
