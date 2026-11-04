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
for(const name of ['001_init.sql','002_api_privileges.sql','003_case_stock.sql','006_shared_world_events.sql','007_shared_world_clock_npc.sql','008_shared_docket_publication.sql','009_shared_docket_offers.sql','010_shared_judgment_ledger.sql','011_sealed_case_admission.sql','012_asynchronous_judge_calendar.sql','013_shared_hearing_progress.sql','014_world_chronology_guards.sql','015_shared_court_actions.sql','016_shared_court_begin.sql','017_shared_verdict_aftermath.sql','018_deferred_order_results.sql','019_shared_public_npc_verdict_links.sql','020_joint_panel_deliberation.sql','021_joint_panel_rpc.sql','022_joint_verdict_release_gate.sql','023_scored_shared_judgments.sql'])
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
 [key,'case-p4','hearing_opened',0,JSON.stringify(datum),owner]);

test('service-only append, both invited players see same event, anonymous never sees it',async()=>{
 const id=(await append('p4-judgment-00001')).rows[0].id;
 assert.ok(id);
 assert.equal((await pa('select event_key from public.shared_world_events')).rows[0].event_key,'p4-judgment-00001');
 assert.equal((await pb('select event_key from public.shared_world_events')).rows[0].event_key,'p4-judgment-00001');
 await assert.rejects(anon('select * from public.shared_world_events'),/permission denied/);
 await assert.rejects(pa('select public.shared_world_append($1,$2,$3,$4,$5::jsonb,$6::uuid)',
  ['hack-event','case-p4','hearing_opened',0,'{}',A]),/permission denied/);
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
 assert.equal(Number((await put('npc:test-001',{name:'김가람',profession:'은퇴'},'dead',3,1)).rows[0].version),2);
 await assert.rejects(put('npc:test-001',{name:'김가람'},'alive',3,2),/npc_temporal_conflict/);
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

test('P4 world date is authoritative for news, NPC life and post-judgment hearings',async()=>{
 const current=(await svc('select game_day from public.shared_world_clock')).rows[0].game_day;
 const add=(key,id,type,day,judge)=>svc('select public.shared_world_append($1,$2,$3,$4,$5::jsonb,$6::uuid)',
  [key,id,type,day,JSON.stringify({title:'사건 기록'}),judge]);
 await assert.rejects(add('future-news-001','case-new-a','incident_reported',current+1,A),/future_world_event/);
 await assert.rejects(add('faked-verdict-001','case-new-a','judgment_published',current,A),/unverified_judgment_event/);
 await assert.rejects(add('after-judgment-hearing','case-opt-a','hearing_opened',current,A),/hearing_after_judgment/);
 await assert.rejects(svc('select public.shared_npc_public_put($1,$2::jsonb,$3,$4,$5)',
  ['npc:future-001',JSON.stringify({name:'미래 인물'}),'alive',current+1,0]),/future_npc_public_update/);
});

test('P4 sealed courtroom journal: only owner, opened hearing, immutable answer',async()=>{
 const id='case-new-b',response={status:'done',answer:'확인했습니다',witness:'W1'};
 const put=(owner,key,data,hearing=1)=>svc(
  'select public.shared_court_action_record($1,$2::uuid,$3,$4,$5,$6::jsonb) as response',
  [id,owner,hearing,'question',key,JSON.stringify(data)]);
 const first=(await put(B,'q1',response)).rows[0].response;
 assert.deepEqual(first,response);
 assert.deepEqual((await put(B,'q1',response)).rows[0].response,response,'same request is idempotent');
 await assert.rejects(put(B,'q1',{...response,answer:'변조'}),/court_action_conflict/);
 await assert.rejects(put(A,'q2',response),/court_case_not_owned/);
 await assert.rejects(put(B,'q2',response,2),/hearing_not_open_today/);
 await assert.rejects(pa('select * from public.shared_court_actions'),/permission denied/);
 await assert.rejects(pb('select * from public.shared_court_actions'),/permission denied/);
 await assert.rejects(pb('select public.shared_court_action_record($1,$2::uuid,$3,$4,$5,$6::jsonb)',
  [id,B,1,'question','q2',JSON.stringify(response)]),/permission denied/);
 await assert.rejects(svc('update public.shared_court_actions set response=$1::jsonb where case_id=$2',
  [JSON.stringify({status:'done',answer:'fake'}),id]),/court_action_immutable/);
 await assert.rejects(svc('delete from public.shared_court_actions where case_id=$1',[id]),/court_action_immutable/);
 const count=(await svc('select count(*)::int as n from public.shared_court_actions where case_id=$1',[id])).rows[0].n;
 assert.equal(count,1);
});

test('P4 courtroom begin: server owns day, next hearing requires real prior action',async()=>{
 const id='case-next-001',hash=HASH;
 await svc(
  'insert into public.case_stock(case_id,category,sheet_hash,candidate_hash,fingerprint,sheet,verification,state,assigned_to,assigned_at) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,\'assigned\',$8,now())',
  [id,'civil',hash,hash,'fingerprint-next-001',JSON.stringify({id}),JSON.stringify({passed:true}),A]);
 const begin=()=>svc('select * from public.shared_court_begin($1,$2::uuid)',[id,A]);
 const first=(await begin()).rows[0];
 assert.equal(first.hearing_index,1);
 assert.equal(first.world_day,12);
 assert.equal(first.already_opened,false);
 await assert.rejects(begin(),/previous_hearing_empty/,'cannot skip an empty completed hearing');
 await svc('select public.shared_court_action_record($1,$2::uuid,$3,$4,$5,$6::jsonb)',
  [id,A,1,'question','q1',JSON.stringify({status:'done',answer:'증언'})]);
 const next=(await begin()).rows[0];
 assert.equal(next.hearing_index,2);
 assert.equal(next.world_day,13);
 assert.equal((await pb('select game_day from public.shared_world_clock')).rows[0].game_day,13);
 await assert.rejects(svc('select * from public.shared_court_begin($1,$2::uuid)',[id,B]),/court_case_not_owned/);
 await assert.rejects(pa('select * from public.shared_court_begin($1,$2::uuid)',[id,A]),/permission denied/);
});

test('P4 verdict creates news the following world day, never before and never twice',async()=>{
 const id='case-next-001',hash='c'.repeat(64);
 const day=(await svc('select game_day,version from public.shared_world_clock')).rows[0];
 assert.equal(day.game_day,13);
 const published=(await svc('select public.shared_judgment_publish($1,$2::uuid,$3,$4,$5) as ok',
 [id,A,'claim_granted','원고의 청구를 인용한다.',hash])).rows[0].ok;
 assert.equal(published,true);
 assert.equal((await pb('select count(*)::int as n from public.shared_world_events where event_key=$1',['aftermath:'+id])).rows[0].n,0);
 const queued=(await svc('select due_game_day,state from public.shared_world_followups where case_id=$1',[id])).rows[0];
 assert.deepEqual(queued,{due_game_day:14,state:'pending'});
 await svc('select * from public.shared_clock_advance($1,$2)',[day.version,14]);
 assert.equal((await pb('select count(*)::int as n from public.shared_world_events where event_key=$1',['aftermath:'+id])).rows[0].n,1);
 assert.equal((await svc('select state from public.shared_world_followups where case_id=$1',[id])).rows[0].state,'published');
 const current=(await svc('select version from public.shared_world_clock')).rows[0].version;
 await svc('select * from public.shared_clock_advance($1,$2)',[current,15]);
 assert.equal((await pa('select count(*)::int as n from public.shared_world_events where event_key=$1',['aftermath:'+id])).rows[0].n,1);
 await assert.rejects(svc('select * from public.shared_hearing_open($1,$2::uuid,$3)',[id,A,1]),/case_already_decided/);
 await assert.rejects(pa('select * from public.shared_world_followups'),/permission denied/);
});

test('P4 order material cannot be delivered until the following real court hearing',async()=>{
 const id='case-order-001';
 await svc(
  'insert into public.case_stock(case_id,category,sheet_hash,candidate_hash,fingerprint,sheet,verification,state,assigned_to,assigned_at) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,\'assigned\',$8,now())',
  [id,'civil',HASH,HASH,'fingerprint-order-001',JSON.stringify({id}),JSON.stringify({passed:true}),A]);
 const begin=()=>svc('select * from public.shared_court_begin($1,$2::uuid)',[id,A]);
 assert.equal((await begin()).rows[0].hearing_index,1);
 await svc('select public.shared_court_action_record($1,$2::uuid,$3,$4,$5,$6::jsonb)',
  [id,A,1,'order','r2',JSON.stringify({status:'delayed',recordId:'r2',title:'영상'})]);
 const resolve=(judge,hearing,reply)=>svc(
  'select public.shared_order_result_record($1,$2::uuid,$3,$4,$5::jsonb) as result',
  [id,judge,hearing,'r2',JSON.stringify(reply)]);
 const done={status:'done',recordId:'r2',title:'영상',text:'다음 기일에 공개된 영상'};
 await assert.rejects(resolve(A,1,done),/order_not_due/);
 const h=(await begin()).rows[0];
 assert.equal(h.hearing_index,2);
 assert.equal(h.world_day,16);
 assert.deepEqual((await resolve(A,2,done)).rows[0].result,done);
 assert.deepEqual((await resolve(A,2,done)).rows[0].result,done,'replay has same result');
 await assert.rejects(resolve(A,2,{...done,text:'서버 기록 위조'}),/order_result_conflict/);
 await assert.rejects(resolve(B,2,done),/court_case_not_owned/);
 await assert.rejects(pa('select * from public.shared_order_result_record($1,$2::uuid,$3,$4,$5::jsonb)',
 [id,A,2,'r2',JSON.stringify(done)]),/permission denied/);
 await assert.rejects(svc('update public.shared_court_actions set response=$1::jsonb where case_id=$2',
  [JSON.stringify({status:'declined'}),id]),/court_action_immutable/);
 assert.equal((await svc('select count(*)::int as n from public.shared_court_actions where case_id=$1',[id])).rows[0].n,2);
});

test('P4 public NPC biography follows judgment without leaking judge-private memories',async()=>{
 const id='case-linked-001',npc='npc:shared-a01',day=(await svc('select game_day from public.shared_world_clock')).rows[0].game_day;
 await svc('select public.shared_npc_public_put($1,$2::jsonb,$3,$4,$5)',
  [npc,JSON.stringify({name:'가상 증인',profession:'기술자'}),'alive',day,0]);
 const sheet={id,people:[{key:'W1',publicNpcId:npc,name:'가상 증인'}],card:{kind:'civil'}};
 await svc(
  'insert into public.case_stock(case_id,category,sheet_hash,candidate_hash,fingerprint,sheet,verification,state,assigned_to,assigned_at) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,\'assigned\',$8,now())',
  [id,'civil',HASH,HASH,'fingerprint-linked-001',JSON.stringify(sheet),JSON.stringify({passed:true}),A]);
 assert.equal((await svc('select count(*)::int as n from public.shared_case_npc_links where case_id=$1',[id])).rows[0].n,1);
 await assert.rejects(pa('select * from public.shared_case_npc_links'),/permission denied/);
 await svc('select public.shared_judgment_publish($1,$2::uuid,$3,$4,$5)',
  [id,A,'claim_denied','원고의 청구를 기각한다.','d'.repeat(64)]);
 const published=(await pb(`select event_type,public_data from public.shared_world_events where case_id=$1
 and event_type in ('judgment_published','npc_public_update') order by event_id`,[id])).rows;
 assert.deepEqual(published.map(x=>x.event_type),['judgment_published','npc_public_update']);
 assert.deepEqual(published[1].public_data.npcIds,[npc]);
 const rec=(await pa('select public_profile,life_status from public.shared_npc_public where npc_id=$1',[npc])).rows[0];
 assert.equal(rec.life_status,'alive','no invented death or status change');
 assert.ok(rec.public_profile.publicCaseIds.includes(id));
 assert.equal((await pb('select public_profile from public.shared_npc_public where npc_id=$1',[npc])).rows[0].public_profile.publicCaseIds[0],id);
});

test('P5 existing judges and public NPC: private votes until all 3, majority and stalled case',async()=>{
 const id='case-panel-p5',npc='npc:p5-bench';
 const day=(await svc('select game_day from public.shared_world_clock')).rows[0].game_day;
 await svc('select public.shared_npc_public_put($1,$2::jsonb,$3,$4,$5)',
  [npc,JSON.stringify({name:'가상 합의부 재판관'}),'alive',day,0]);
 await svc(
  'insert into public.case_stock(case_id,category,sheet_hash,candidate_hash,fingerprint,sheet,verification,state,assigned_to,assigned_at) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,\'assigned\',$8,now())',
  [id,'civil',HASH,HASH,'fingerprint-panel-p5',JSON.stringify({id}),JSON.stringify({passed:true}),A]);
 const open=()=>svc('select public.shared_joint_open($1,$2::uuid,$3::uuid,$4) as inserted',[id,A,B,npc]);
 assert.equal((await open()).rows[0].inserted,true);
 assert.equal((await open()).rows[0].inserted,false,'replay must not create another panel');
 const vote=(uid,seat,choice)=>svc(
  'select public.shared_joint_vote($1,$2::uuid,$3,$4,$5,$6) as inserted',
  [id,uid,seat,choice,HASH,'비공개 의견']);
 const view=uid=>svc('select public.shared_joint_status($1,$2::uuid) as state',[id,uid]);
 assert.equal((await vote(A,'chair','claim_granted')).rows[0].inserted,true);
 let only=(await view(B)).rows[0].state;
 assert.equal(only.votesCast,1);
 assert.equal(only.myVote,null,'peer must not see first judge opinion');
 assert.equal(only.tally,undefined);
 await assert.rejects(vote(B,'chair','claim_granted'),/not_panel_member/);
 await assert.rejects(vote(B,'npc','claim_granted'),/not_panel_member/);
 await assert.rejects(pa('select * from public.shared_joint_votes'),/permission denied/);
 await assert.rejects(pb('select * from public.shared_joint_votes'),/permission denied/);
 await assert.rejects(svc('select public.shared_joint_vote($1,$2::uuid,$3,$4,$5,$6)',
  [id,null,'npc','claim_denied',HASH,'']),/human_votes_pending/);
 assert.equal((await vote(B,'peer','claim_denied')).rows[0].inserted,true);
 await svc('select public.shared_joint_vote($1,$2::uuid,$3,$4,$5,$6)',
  [id,null,'npc','claim_granted',HASH,'']);
 const complete=(await view(A)).rows[0].state;
 assert.equal(complete.majority,'claim_granted');
 assert.equal(complete.tally.claim_granted,2);
 assert.equal(complete.tally.claim_denied,1);
 assert.equal((await view(B)).rows[0].state.majority,'claim_granted');
 await assert.rejects(vote(B,'peer','claim_granted'),/vote_conflict/);
 await assert.rejects(svc('select public.shared_joint_status($1,$2::uuid)',[
  id,'00000000-0000-0000-0000-00000000000f']),/not_panel_member/);
});

test('P5 verdict release requires complete consensus and correct majority, not a lone judge',async()=>{
 const wrong=()=>svc('select public.shared_judgment_publish($1,$2::uuid,$3,$4,$5)',
  ['case-panel-p5',A,'claim_denied','원고의 청구를 기각한다.','e'.repeat(64)]);
 await assert.rejects(wrong(),/joint_verdict_mismatch/);
 const good=()=>svc('select public.shared_judgment_publish($1,$2::uuid,$3,$4,$5) as published',
  ['case-panel-p5',A,'claim_granted','원고의 청구를 인용한다.','f'.repeat(64)]);
 assert.equal((await good()).rows[0].published,true);
 assert.equal((await good()).rows[0].published,false,'replay is idempotent');
 await assert.rejects(svc('update public.shared_joint_votes set choice=$1 where case_id=$2',
  ['claim_denied','case-panel-p5']),/permission denied|joint_vote/);
 const pending='case-panel-pending',npc='npc:p5-bench';
 await svc(
  'insert into public.case_stock(case_id,category,sheet_hash,candidate_hash,fingerprint,sheet,verification,state,assigned_to,assigned_at) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,\'assigned\',$8,now())',
  [pending,'civil',HASH,HASH,'fingerprint-panel-pending',JSON.stringify({id:pending}),
   JSON.stringify({passed:true}),A]);
 await svc('select public.shared_joint_open($1,$2::uuid,$3::uuid,$4)',[pending,A,B,npc]);
 await svc('select public.shared_joint_vote($1,$2::uuid,$3,$4,$5,$6)',
  [pending,A,'chair','claim_granted',HASH,'']);
 await assert.rejects(svc('select public.shared_judgment_publish($1,$2::uuid,$3,$4,$5)',
  [pending,A,'claim_granted','원고의 청구를 인용한다.','e'.repeat(64)]),/joint_votes_incomplete/);
 await assert.rejects(svc('select public.shared_joint_vote($1,$2::uuid,$3,$4,$5,$6)',
  [pending,B,'peer','claim_denied','b'.repeat(64),'']),/joint_evidence_snapshot_changed/);
});
test('P4 server publishes native-score review atomically and never permits rewriting it',async()=>{
 const id='case-native-review-001',score={method:'VerdictTrialCore.skill/evaluate',items:[]};
 await svc(
  'insert into public.case_stock(case_id,category,sheet_hash,candidate_hash,fingerprint,sheet,verification,state,assigned_to,assigned_at) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,\'assigned\',$8,now())',
  [id,'civil',HASH,HASH,'fingerprint-review-001',JSON.stringify({id}),JSON.stringify({passed:true}),A]);
 const publish=(grade=score)=>svc(
  'select public.shared_judgment_publish_scored($1,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb) as published',
  [id,A,'claim_denied','원고의 청구를 기각한다.','e'.repeat(64),72,74,JSON.stringify(grade)]);
 assert.equal((await publish()).rows[0].published,true);
 assert.equal((await publish()).rows[0].published,false);
 const row=(await pa('select skill_score,review_score,grade_data from public.shared_judgment_reviews where case_id=$1',[id])).rows[0];
 assert.equal(row.skill_score,72);
 assert.equal(row.review_score,74);
 assert.equal(row.grade_data.method,'VerdictTrialCore.skill/evaluate');
 await assert.rejects(publish({method:'forged'}),/review_already_published/);
 await assert.rejects(pa('update public.shared_judgment_reviews set skill_score=99 where case_id=$1',[id]),/permission denied/);
 await assert.rejects(svc('update public.shared_judgment_reviews set skill_score=99 where case_id=$1',[id]),/shared_review_immutable/);
});
