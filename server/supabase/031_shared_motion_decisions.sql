-- P5 native opponent motion decision ledger (isolated QA migration).
-- Worker selects the motion using the exact VerdictTrialCore.cards algorithm.
begin;
alter table public.shared_court_actions drop constraint if exists shared_court_actions_action_type_check;
alter table public.shared_court_actions add constraint shared_court_actions_action_type_check
 check(action_type in ('question','order','order_result','evidence_decision','motion'));

create or replace function public.shared_motion_decision_record(
 p_case text,p_judge uuid,p_hearing integer,p_key text,p_response jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare owner_id uuid; world_day integer;
 current_hearing public.shared_judge_hearings%rowtype;
 earlier public.shared_court_actions%rowtype;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_key is null or p_key !~ '^d[0-9]{1,3}-(obj|del)$'
 or p_hearing not between 1 and 200
 or p_response is null or jsonb_typeof(p_response)<>'object'
 or p_response->>'status'<>'done'
 or p_response->>'type' not in ('objection','delay')
 or p_response->>'choice' not in ('accept','reject')
 or jsonb_typeof(p_response->'valid') is distinct from 'boolean'
 or octet_length(p_response::text)>1000
 then raise exception 'invalid_court_motion'; end if;
 select assigned_to into owner_id from public.case_stock where case_id=p_case and state='assigned';
 if owner_id is null or owner_id is distinct from p_judge
 then raise exception 'chair_required' using errcode='42501'; end if;
 if exists(select 1 from public.shared_case_judgments where case_id=p_case)
 then raise exception 'case_already_decided'; end if;
 select game_day into world_day from public.shared_world_clock where id='main' for share;
 select * into current_hearing from public.shared_judge_hearings
 where case_id=p_case and judge_id=p_judge and hearing_index=p_hearing for share;
 if not found or current_hearing.state<>'completed'
 or current_hearing.completed_game_day is distinct from world_day
 then raise exception 'hearing_not_open_today' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('motion:'||p_case||':'||p_key,0));
 select * into earlier from public.shared_court_actions
 where case_id=p_case and action_type='motion' and action_key=p_key;
 if found then
  if earlier.response is distinct from p_response then
   raise exception 'motion_conflict' using errcode='23505'; end if;
  return earlier.response;
 end if;
 insert into public.shared_court_actions(case_id,judge_id,action_type,action_key,response,hearing_index,game_day)
 values(p_case,p_judge,'motion',p_key,p_response,p_hearing,world_day);
 return p_response;
end $$;
revoke all on function public.shared_motion_decision_record(text,uuid,integer,text,jsonb)
 from public,anon,authenticated;
grant execute on function public.shared_motion_decision_record(text,uuid,integer,text,jsonb) to service_role;
commit;
