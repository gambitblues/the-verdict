-- QA only: a shared panel is presided over by the allocated chair.
-- The invited human associate may submit recorded questions and evidence orders.
-- NPC always participates as associate, never as chair or as a browser actor.
begin;
create or replace function public.shared_joint_chair_for(p_case text,p_actor uuid)
returns uuid language sql stable security definer set search_path=public as $$
 select p.chair_id from public.shared_joint_panels p
 where p.case_id=p_case and (p.chair_id=p_actor or p.peer_id=p_actor)
 and not exists(select 1 from public.shared_case_judgments j where j.case_id=p_case)
 limit 1
$$;
revoke all on function public.shared_joint_chair_for(text,uuid) from public,anon,authenticated;
grant execute on function public.shared_joint_chair_for(text,uuid) to service_role;

create or replace function public.shared_court_action_record(
 p_case text,p_judge uuid,p_hearing integer,p_type text,p_key text,p_response jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare prior public.shared_court_actions%rowtype;
 today_day integer; heard public.shared_judge_hearings%rowtype; owner_id uuid;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_type not in ('question','order') or p_key is null or p_key !~ '^[a-zA-Z0-9:_-]{1,80}$'
 or p_response is null or jsonb_typeof(p_response)<>'object'
 or octet_length(p_response::text)>12000
 or p_response->>'status' not in ('done','declined','delayed')
 then raise exception 'invalid_court_action'; end if;
 select assigned_to into owner_id from public.case_stock
 where case_id=p_case and state='assigned';
 if owner_id is null or (owner_id<>p_judge and public.shared_joint_chair_for(p_case,p_judge)
 is distinct from owner_id)
 then raise exception 'court_case_not_owned' using errcode='42501'; end if;
 if exists(select 1 from public.shared_case_judgments where case_id=p_case)
 then raise exception 'case_already_decided'; end if;
 select game_day into today_day from public.shared_world_clock where id='main' for share;
 select * into heard from public.shared_judge_hearings
 where case_id=p_case and hearing_index=p_hearing and judge_id=owner_id for share;
 if not found or heard.state<>'completed' or heard.completed_game_day is distinct from today_day
 then raise exception 'hearing_not_open_today' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('court:'||p_case||':'||p_type||':'||p_key,0));
 select * into prior from public.shared_court_actions a
 where a.case_id=p_case and a.action_type=p_type and a.action_key=p_key;
 if found then
  if prior.response is distinct from p_response
   or (prior.judge_id<>p_judge and
       public.shared_joint_chair_for(p_case,p_judge) is distinct from owner_id)
  then raise exception 'court_action_conflict' using errcode='23505'; end if;
  return prior.response;
 end if;
 insert into public.shared_court_actions
 (case_id,judge_id,action_type,action_key,response,hearing_index,game_day)
 values(p_case,p_judge,p_type,p_key,p_response,p_hearing,today_day);
 return p_response;
end $$;

create or replace function public.shared_order_result_record(
 p_case text,p_judge uuid,p_hearing integer,p_key text,p_response jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare requested public.shared_court_actions%rowtype;
 previous public.shared_court_actions%rowtype;
 hearing public.shared_judge_hearings%rowtype; today_day integer; owner_id uuid;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_key is null or p_key !~ '^[a-zA-Z0-9:_-]{1,80}$'
 or p_response is null or jsonb_typeof(p_response)<>'object'
 or octet_length(p_response::text)>12000
 or p_response->>'status' not in ('done','declined','delayed')
 then raise exception 'invalid_order_result'; end if;
 select assigned_to into owner_id from public.case_stock
 where case_id=p_case and state='assigned';
 if owner_id is null or (owner_id<>p_judge and
 public.shared_joint_chair_for(p_case,p_judge) is distinct from owner_id)
 then raise exception 'court_case_not_owned' using errcode='42501'; end if;
 if exists(select 1 from public.shared_case_judgments where case_id=p_case)
 then raise exception 'case_already_decided'; end if;
 select game_day into today_day from public.shared_world_clock where id='main' for share;
 select * into hearing from public.shared_judge_hearings
 where case_id=p_case and hearing_index=p_hearing and judge_id=owner_id for share;
 if not found or hearing.state<>'completed' or hearing.completed_game_day is distinct from today_day
 then raise exception 'hearing_not_open_today' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('order-result:'||p_case||':'||p_key,0));
 select * into requested from public.shared_court_actions
 where case_id=p_case and action_type='order' and action_key=p_key;
 if not found or requested.hearing_index>=p_hearing
 then raise exception 'order_not_due'; end if;
 select * into previous from public.shared_court_actions
 where case_id=p_case and action_type='order_result' and action_key=p_key;
 if found then
  if previous.response is distinct from p_response
  then raise exception 'order_result_conflict' using errcode='23505'; end if;
  return previous.response;
 end if;
 insert into public.shared_court_actions(case_id,judge_id,action_type,action_key,response,hearing_index,game_day)
 values(p_case,p_judge,'order_result',p_key,p_response,p_hearing,today_day);
 return p_response;
end $$;
commit;
