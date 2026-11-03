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
for(const name of ['001_init.sql','002_api_privileges.sql','003_case_stock.sql','006_shared_world_events.sql','007_shared_world_clock_npc.sql','008_shared_docket_publication.sql','009_shared_docket_offers.sql','010_shared_judgment_ledger.sql','011_sealed_case_admission.sql','012_asynchronous_judge_calendar.sql','013_shared_hearing_progress.sql'])
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
 for(const id of batch)await svc('insert into public.world_secrets(case_id,truth) values($1,$2::jsonb)',[id,JSON.stringify({branch:'did',sealedAt:'TEST'})]);
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

test('P4 public judgment: one immutable verdict, both judges see same facts, aftermath cannot precede verdict',async()=>{
 const record='b'.repeat(64),caseId='case-opt-a',order='원고의 청구를 인용한다.';
 // The earlier docket acceptance assigned case-opt-a to judge A.
 const result=(await svc('select public.shared_judgment_publish($1,$2::uuid,$3,$4,$5) as published',
  [caseId,A,'claim_granted',order,record])).rows[0];
 assert.equal(result.published,true);
 const again=(await svc('select public.shared_judgment_publish($1,$2::uuid,$3,$4,$5) as published',
  [caseId,A,'claim_granted',order,record])).rows[0];
 assert.equal(again.published,false);
 assert.equal((await pb('select public_order from public.shared_case_judgments where case_id=$1',[caseId])).rows[0].public_order,order);
 assert.equal((await pa('select count(*)::int as n from public.shared_world_events where case_id=$1 and event_type=\'judgment_published\'',[caseId])).rows[0].n,1);
 await assert.rejects(svc('select public.shared_judgment_publish($1,$2::uuid,$3,$4,$5)',
  [caseId,B,'claim_granted',order,record]),/case_not_assigned_to_judge/);
 await assert.rejects(svc('select public.shared_judgment_publish($1,$2::uuid,$3,$4,$5)',
  [caseId,A,'claim_denied','기각한다.',record]),/judgment_already_published/);
 await assert.rejects(svc('update public.shared_case_judgments set public_order=$1 where case_id=$2',['변조',caseId]),/shared_judgment_immutable/);
 await assert.rejects(pa('select public.shared_judgment_publish($1,$2::uuid,$3,$4,$5)',
  [caseId,A,'claim_granted',order,record]),/permission denied/);
 await assert.rejects(svc('select public.shared_world_append($1,$2,$3,$4,$5::jsonb,$6::uuid)',
  ['aftermath-before-0001',caseId,'aftermath_published',0,JSON.stringify({title:'과거 기사'}),A]),/world_event_out_of_order/);
});

test('P4 truth is sealed once at admission and never exposed to judges',async()=>{
 const id='case-sealed-0001';
 const sheet={format:'verdict-world-sheet/v1',id,status:'draft',card:{category:'civil'},worlds:{
  did:{act:'SEALED_DID'},didnt:{act:'SEALED_DIDNT'},reason:{act:'SEALED_REASON'}}};
 const verification={decision:'stock',sheetHash:HASH,candidateHash:HASH,passed:true};
 const args=[id,'civil',HASH,HASH,'fingerprint-sealed-0001',JSON.stringify(sheet),JSON.stringify(verification),'didnt'];
 const sql='select public.shared_case_admit_sealed($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8) as admitted';
 assert.equal((await svc(sql,args)).rows[0].admitted,true);
 assert.equal((await svc(sql,args)).rows[0].admitted,false,'idempotent same approved case');
 assert.equal((await svc('select truth->>\'branch\' as branch from public.world_secrets where case_id=$1',[id])).rows[0].branch,'didnt');
 await assert.rejects(svc(sql,[...args.slice(0,-1),'did']),/sealed_truth_conflict/);
 await assert.rejects(svc('update public.world_secrets set truth=$1::jsonb where case_id=$2',[JSON.stringify({branch:'did'}),id]),/sealed_truth_immutable/);
 await assert.rejects(pa('select * from public.world_secrets'),/permission denied/);
 await assert.rejects(pa(sql,args),/permission denied/);
});

test('P4 asynchronous judges: eight hearings by A do not auto-try B; B rejoins with protection',async()=>{
 // World starts on day 3. B has a hearing on day 4 but does not sign in as A proceeds.
 const ownA='case-new-a',ownB='case-new-b';
 assert.equal((await svc('select public.shared_judge_resume($1::uuid) as x',[B])).rows.length,1);
 await svc('select public.shared_hearing_schedule($1,$2::uuid,$3,$4)',[ownA,A,1,4]);
 await svc('select public.shared_hearing_schedule($1,$2::uuid,$3,$4)',[ownB,B,1,4]);
 assert.equal((await pa('select * from public.shared_judge_hearings where judge_id=$1',[B])).rows.length,0,'A cannot read B private obligations');
 // Even when a judge opens eight hearings on the SAME global date, the clock moves once.
 const tick=(await svc('select * from public.shared_clock_advance($1,$2)',[1,10])).rows[0];
 assert.equal(Number(tick.game_day),10);
 for(let i=0;i<8;i++){
  const key='p4-eight-hearings-'+String(i).padStart(3,'0');
  await svc('select public.shared_world_append($1,$2,$3,$4,$5::jsonb,$6::uuid)',
   [key,ownA,'hearing_opened',10,JSON.stringify({title:'공판 '+(i+1)}),A]);
 }
 assert.equal((await svc('select game_day from public.shared_world_clock')).rows[0].game_day,10);
 assert.equal((await svc('select count(*)::int as n from public.shared_world_events where event_type=\'hearing_opened\' and game_day=10')).rows[0].n,8);
 assert.equal((await pb('select due_game_day from public.shared_judge_hearings')).rows[0].due_game_day,4,
  'B case is not automatically heard or lost while offline');
 const resume=(await svc('select * from public.shared_judge_resume($1::uuid)',[B])).rows[0];
 assert.deepEqual([Number(resume.previous_day),Number(resume.world_day),Number(resume.lag_days),Number(resume.protected_until_day),Number(resume.rescheduled_hearings)],
 [3,10,7,12,1]);
 const after=(await pb('select due_game_day,state,revised_by_catchup from public.shared_judge_hearings')).rows[0];
 assert.deepEqual([after.due_game_day,after.state,after.revised_by_catchup],[12,'scheduled',true]);
 assert.equal((await pa('select due_game_day from public.shared_judge_hearings')).rows[0].due_game_day,4,
  'B reconnect must not alter A private docket');
 const twice=(await svc('select * from public.shared_judge_resume($1::uuid)',[B])).rows[0];
 assert.equal(twice.rescheduled_hearings,0,'refresh does not grant infinite extensions');
 assert.equal(twice.lag_days,0);
 await assert.rejects(pa('select * from public.shared_judge_resume($1::uuid)',[A]),/permission denied/);
 await assert.rejects(svc('select public.shared_hearing_schedule($1,$2::uuid,$3,$4)',[ownA,B,2,12]),/hearing_case_not_owned/);
});

test('P4 calendar: eight hearings on one date count as one shared date, absent B stays pending',async()=>{
 const dayBefore=(await svc('select game_day,version from public.shared_world_clock')).rows[0];
 assert.equal(dayBefore.game_day,10);
 const owner='case-fast-0';
 for(let i=0;i<8;i++){
  const id='case-fast-'+i;
  await svc(
   'insert into public.case_stock(case_id,category,sheet_hash,candidate_hash,fingerprint,sheet,verification,state,assigned_to,assigned_at) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,\'assigned\',$8,now())',
   [id,'civil',HASH,HASH,'fingerprint-fast-'+i,JSON.stringify({id}),JSON.stringify({passed:true}),A]);
  await svc('select public.shared_hearing_schedule($1,$2::uuid,$3,$4)',[id,A,1,10]);
  const opened=(await svc('select * from public.shared_hearing_open($1,$2::uuid,$3)',[id,A,1])).rows[0];
  assert.equal(opened.hearing_day,10);
  assert.equal(opened.world_day,10);
  assert.equal(opened.clock_version,dayBefore.version);
  assert.equal(opened.already_opened,false);
 }
 const afterA=(await svc('select game_day,version from public.shared_world_clock')).rows[0];
 assert.deepEqual(afterA,dayBefore,'eight hearings on one day must not advance clock eight times');
 assert.equal((await svc(`select count(*)::int as n from public.shared_judge_hearings
 where judge_id=$1 and state='completed' and completed_game_day=10`,[A])).rows[0].n,8);
 const pending=(await pb('select due_game_day,state from public.shared_judge_hearings')).rows;
 assert.deepEqual(pending,[{due_game_day:12,state:'scheduled'}],'B was inactive; no automatic hearing');
 const duplicate=(await svc('select * from public.shared_hearing_open($1,$2::uuid,$3)',[owner,A,1])).rows[0];
 assert.equal(duplicate.already_opened,true,'same hearing is never counted twice');
 await assert.rejects(svc('select * from public.shared_hearing_open($1,$2::uuid,$3)',[owner,B,1]),/hearing_case_not_owned/);
 await assert.rejects(pa('select * from public.shared_hearing_open($1,$2::uuid,$3)',[owner,A,1]),/permission denied/);
 const b=(await svc('select * from public.shared_hearing_open($1,$2::uuid,$3)',[
  'case-new-b',B,1])).rows[0];
 assert.equal(b.world_day,12,'a later scheduled B hearing advances one common date');
 assert.equal(b.clock_version,Number(dayBefore.version)+1);
 assert.equal((await pa('select game_day from public.shared_world_clock')).rows[0].game_day,12);
 assert.equal((await pb('select game_day from public.shared_world_clock')).rows[0].game_day,12);
});

test('P4 first login with pending old hearing gets grace even without progress record',async()=>{
 const state=(await svc('select game_day from public.shared_world_clock')).rows[0];
 assert.equal(state.game_day,12);
 const before=(await pa('select due_game_day,state from public.shared_judge_hearings where case_id=$1',['case-new-a'])).rows[0];
 assert.deepEqual(before,{due_game_day:4,state:'scheduled'});
 const r=(await svc('select * from public.shared_judge_resume($1::uuid)',[A])).rows[0];
 assert.deepEqual([r.previous_day,r.world_day,r.lag_days,r.protected_until_day,r.rescheduled_hearings],
  [4,12,8,14,1]);
 const after=(await pa('select due_game_day,state from public.shared_judge_hearings where case_id=$1',['case-new-a'])).rows[0];
 assert.deepEqual(after,{due_game_day:14,state:'scheduled'});
 assert.equal((await pb('select count(*)::int as n from public.shared_judge_hearings where judge_id=$1',[A])).rows[0].n,0,
  'B cannot inspect the other judge court schedule');
});
