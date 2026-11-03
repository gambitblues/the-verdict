/* P4: security, idempotency, immutable shared chronology.
 * Run from server/supabase with npm test. No live Supabase or secrets needed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const A='00000000-0000-0000-0000-00000000000a',B='00000000-0000-0000-0000-00000000000b';
const db=new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email',current_setting('test.email',true)) $$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on all functions in schema auth to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
insert into auth.users values ('${A}','a@test.kr'),('${B}','b@test.kr');
`);
for(const name of ['001_init.sql','002_api_privileges.sql','003_case_stock.sql','006_shared_world_events.sql','007_shared_world_clock_npc.sql','008_shared_docket_publication.sql','009_shared_docket_offers.sql'])
 await db.exec(await readFile(new URL('../'+name,import.meta.url),'utf8'));
await db.exec(`insert into public.players(email,user_id,name) values ('a@test.kr','${A}','A'),('b@test.kr','${B}','B');`);
const HASH='a'.repeat(64),FINGER='fingerprint-one';
await db.query(`insert into public.case_stock
 (case_id,category,sheet_hash,candidate_hash,fingerprint,sheet,verification,state,assigned_to,assigned_at)
 values ('case-p4','civil',$1,$2,$3,$4::jsonb,$5::jsonb,'assigned',$6,now())`,
 [HASH,HASH,FINGER,JSON.stringify({id:'case-p4'}),JSON.stringify({passed:true}),A]);
async function as(role,uid,sql,params=[]){
 await db.exec(`reset role; select set_config('test.uid','${uid||''}',false),set_config('test.email','${uid===A?'a@test.kr':uid===B?'b@test.kr':''}',false),set_config('request.jwt.claim.role','${role}',false); set role ${role};`);
 try{return await db.query(sql,params)}finally{await db.exec('reset role')}
}
const svc=(sql,p)=>as('service_role',null,sql,p),pa=(sql,p)=>as('authenticated',A,sql,p),pb=(sql,p)=>as('authenticated',B,sql,p),anon=(sql,p)=>as('anon',null,sql,p);
const append=(key,owner=A,datum={title:'공개 사건'})=>
 svc('select public.shared_world_append($1,$2,$3,$4,$5::jsonb,$6::uuid) as id',
 [key,'case-p4','judgment_published',123,JSON.stringify(datum),owner]);

test('service-only append, both invited players see same event, anonymous never sees it',async()=>{
 const id=(await append('p4-judgment-00001')).rows[0].id;
 assert.ok(id);
 assert.equal((await pa('select event_key from public.shared_world_events')).rows[0].event_key,'p4-judgment-00001');
 assert.equal((await pb('select event_key from public.shared_world_events')).rows[0].event_key,'p4-judgment-00001');
 await assert.rejects(anon('select * from public.shared_world_events'),/permission denied/);
 await assert.rejects(pa('select public.shared_world_append($1,$2,$3,$4,$5::jsonb,$6::uuid)',
  ['hack-event','case-p4','judgment_published',123,'{}',A]),/permission denied/);
 await assert.rejects(pa(`insert into public.shared_world_events(event_key,event_type,game_day)
 values('hack-event','npc_public_update',3)`),/permission denied/);
});
test('same event key is idempotent but a changed fact never replaces history',async()=>{
 const x=(await append('p4-judgment-00001')).rows[0].id;
 assert.ok(x);
 await assert.rejects(append('p4-judgment-00001',A,{title:'변조'}),/event_key_conflict/);
 assert.equal((await svc(`select count(*)::int as n from public.shared_world_events`)).rows[0].n,1);
 await assert.rejects(svc(`update public.shared_world_events set game_day=124`),/shared_history_immutable/);
 await assert.rejects(svc(`delete from public.shared_world_events`),/shared_history_immutable/);
});
test('private facts cannot be projected, other judge cannot publish a verdict',async()=>{
 await assert.rejects(append('p4-secret-00001',A,{truth:'did'}),/invalid_public_event/);
 await assert.rejects(append('p4-other-00001',B),/case_not_assigned_to_judge/);
 await assert.rejects(append('p4-missing-0001',null),/case_not_assigned_to_judge/);
 await assert.rejects(pa('select * from public.case_stock'),/permission denied/);
});

test('P4 global clock: invited judges read same day, only trusted server advances by CAS',async()=>{
 const first=(await pa('select game_day,version from public.shared_world_clock')).rows[0];
 assert.equal(first.game_day,0);
 await assert.rejects(pa('select * from public.shared_clock_advance(0,3)'),/permission denied/);
 const next=(await svc('select * from public.shared_clock_advance(0,3)')).rows[0];
 assert.deepEqual([Number(next.game_day),Number(next.version)],[3,1]);
 assert.equal((await pb('select game_day from public.shared_world_clock')).rows[0].game_day,3);
 await assert.rejects(svc('select * from public.shared_clock_advance(0,6)'),/clock_conflict/);
 await assert.rejects(svc('select * from public.shared_clock_advance(1,18)'),/invalid_world_day/);
});
test('P4 objective NPC: both judges see one biography, death irreversible, memories private',async()=>{
 const profile=JSON.stringify({name:'김가람',birthYear:1990,profession:'변호사'});
 const put=(id,p,status,day,version)=>svc(
  'select public.shared_npc_public_put($1,$2::jsonb,$3,$4,$5) as version',
  [id,JSON.stringify(p),status,day,version]);
 const v1=(await put('npc:test-001',JSON.parse(profile),'alive',3,0)).rows[0].version;
 assert.equal(Number(v1),1);
 assert.equal((await pa('select public_profile from public.shared_npc_public')).rows[0].public_profile.name,'김가람');
 assert.equal((await pb('select public_profile from public.shared_npc_public')).rows[0].public_profile.name,'김가람');
 await assert.rejects(pa(`update public.shared_npc_public set life_status='dead'`),/permission denied/);
 await assert.rejects(put('npc:test-001',{name:'변조'},'alive',4,0),/npc_version_conflict/);
 await assert.rejects(put('npc:new-123',{truth:'secret'},'alive',4,0),/invalid_npc_public/);
 assert.equal(Number((await put('npc:test-001',{name:'김가람',profession:'은퇴'},'dead',100,1)).rows[0].version),2);
 await assert.rejects(put('npc:test-001',{name:'김가람'},'alive',101,2),/npc_temporal_conflict/);
});

test('P4 global case stock: a case cannot be assigned twice to different judges',async()=>{
 const makeCase=(id,fp)=>svc(
 'insert into public.case_stock(case_id,category,sheet_hash,candidate_hash,fingerprint,sheet,verification) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)',
 [id,'civil',HASH,HASH,fp,JSON.stringify({id}),JSON.stringify({passed:true})]);
 await makeCase('case-new-a','fingerprint-new-a');
 await makeCase('case-new-b','fingerprint-new-b');
 // case-p4 already belongs to judge A; simultaneous requests must take distinct stock.
 const [ra,rb]=await Promise.all([
  svc('select case_id from public.case_stock_assign($1::uuid,$2)',[A,'civil']),
  svc('select case_id from public.case_stock_assign($1::uuid,$2)',[B,'civil'])
 ]);
 assert.equal(ra.rows.length,1);
 assert.equal(rb.rows.length,1);
 assert.notEqual(ra.rows[0].case_id,rb.rows[0].case_id);
 assert.equal((await svc(`select count(*)::int as n from public.case_stock where state='assigned'`)).rows[0].n,3);
 const published=(await pa(`select case_id,event_type from public.shared_world_events where event_type='case_assigned' order by event_id`)).rows;
 assert.equal(published.length,2,'every newly assigned case is published exactly once');
 assert.deepEqual(new Set(published.map(x=>x.case_id)),new Set([ra.rows[0].case_id,rb.rows[0].case_id]));
 assert.deepEqual((await pb(`select case_id from public.shared_world_events where event_type='case_assigned'`)).rows.map(x=>x.case_id).sort(),published.map(x=>x.case_id).sort());
 await assert.rejects(pa('select * from public.case_stock_assign($1::uuid,$2)',[A,'civil']),/permission denied/);
});

test('P4 two hourly options are globally reserved, immutable until one accepted',async()=>{
 // Only the in-memory TEST database gets a deterministic KST clock.
 await db.exec(`reset role; create or replace function public.shared_kst_slot() returns text language sql stable as $slot$
  select '2026-11-04T12'::text $slot$;`);
 const batch=['case-opt-a','case-opt-b','case-opt-c','case-opt-d','case-opt-e'];
 for(const id of batch)await svc(
  'insert into public.case_stock(case_id,category,sheet_hash,candidate_hash,fingerprint,sheet,verification) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)',
  [id,'civil',HASH,HASH,'fingerprint-'+id,JSON.stringify({id}),JSON.stringify({passed:true})]);
 await assert.rejects(pa('select * from public.shared_docket_offer($1::uuid,$2)',[A,'2026-11-04T12']),/permission denied/);
 await assert.rejects(svc('select * from public.shared_docket_offer($1::uuid,$2)',[A,'2026-11-04T11']),/invalid_offer_slot/);
 const offer=(id)=>svc('select * from public.shared_docket_offer($1::uuid,$2)',[id,'2026-11-04T12']);
 const a=(await offer(A)).rows,b=(await offer(B)).rows;
 assert.equal(a.length,2);assert.equal(b.length,2);
 assert.equal(new Set([...a,...b].map(x=>x.case_id)).size,4,'reserved cases never overlap');
 assert.deepEqual((await offer(A)).rows.map(x=>x.case_id),a.map(x=>x.case_id),'re-request is idempotent');
 const accepted=(await svc('select * from public.shared_docket_accept($1::uuid,$2,$3)',[A,'2026-11-04T12',a[0].case_id])).rows;
 assert.equal(accepted.length,1);
 assert.equal(accepted[0].case_id,a[0].case_id);
 assert.equal((await svc('select * from public.shared_docket_accept($1::uuid,$2,$3)',[A,'2026-11-04T12',a[0].case_id])).rows[0].case_id,a[0].case_id);
 assert.equal((await svc('select state from public.shared_docket_offers where judge_id=$1 and case_id=$2',[A,a[1].case_id])).rows[0].state,'expired');
 await assert.rejects(svc('select * from public.shared_docket_accept($1::uuid,$2,$3)',[B,'2026-11-04T12',a[0].case_id]),/offer_not_found/);
 const evt=(await pb('select case_id from public.shared_world_events where event_type=\'case_assigned\'')).rows;
 assert.ok(evt.some(x=>x.case_id===a[0].case_id),'acceptance creates shared public record');
});
