-- P4: complete a previously requested evidence order only in a LATER court session.
-- Apply on isolated QA Supabase after 017.
begin;

alter table public.shared_court_actions
 drop constraint if exists shared_court_actions_action_type_check;
alter table public.shared_court_actions
 add constraint shared_court_actions_action_type_check
 check(action_type in ('question','order','order_result'));

create or replace function public.shared_order_result_record(
 p_case text,p_judge uuid,p_hearing integer,p_key text,p_response jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare requested public.shared_court_actions%rowtype;
 previous public.shared_court_actions%rowtype;
 hearing public.shared_judge_hearings%rowtype; today_day integer;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_key is null or p_key !~ '^[a-zA-Z0-9:_-]{1,80}$'
   or p_response is null or jsonb_typeof(p_response)<>'object'
   or octet_length(p_response::text)>12000
   or p_response->>'status' not in ('done','declined','delayed')
 then raise exception 'invalid_order_result'; end if;
 if not exists(select 1 from public.case_stock
  where case_id=p_case and assigned_to=p_judge and state='assigned')
 then raise exception 'court_case_not_owned' using errcode='42501'; end if;
 if exists(select 1 from public.shared_case_judgments where case_id=p_case)
 then raise exception 'case_already_decided'; end if;
 select game_day into today_day from public.shared_world_clock where id='main' for share;
 select * into hearing from public.shared_judge_hearings
  where case_id=p_case and hearing_index=p_hearing and judge_id=p_judge for share;
 if not found or hearing.state<>'completed' or hearing.completed_game_day is distinct from today_day
 then raise exception 'hearing_not_open_today' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('order-result:'||p_case||':'||p_key,0));
 select * into requested from public.shared_court_actions
  where case_id=p_case and action_type='order' and action_key=p_key;
 if not found or requested.judge_id is distinct from p_judge or requested.hearing_index>=p_hearing
 then raise exception 'order_not_due'; end if;
 select * into previous from public.shared_court_actions
  where case_id=p_case and action_type='order_result' and action_key=p_key;
 if found then
  if previous.judge_id is distinct from p_judge or previous.response is distinct from p_response
  then raise exception 'order_result_conflict' using errcode='23505'; end if;
  return previous.response;
 end if;
 insert into public.shared_court_actions(case_id,judge_id,action_type,action_key,response,hearing_index,game_day)
 values(p_case,p_judge,'order_result',p_key,p_response,p_hearing,today_day);
 return p_response;
end $$;
revoke all on function public.shared_order_result_record(text,uuid,integer,text,jsonb)
 from public,anon,authenticated;
grant execute on function public.shared_order_result_record(text,uuid,integer,text,jsonb)
 to service_role;
commit;
