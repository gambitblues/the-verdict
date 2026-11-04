-- P4 shared courtroom: safely begin/reopen a case hearing.
-- QA DB only, after 015. Player may request the next session but cannot choose
-- a future day, a judge id, or bypass an uncompleted preceding session.
begin;
create or replace function public.shared_court_begin(p_case text,p_judge uuid)
returns table(hearing_index integer,world_day integer,already_opened boolean)
language plpgsql security definer set search_path=public as $$
declare prev public.shared_judge_hearings%rowtype;
        idx integer; day_now integer; due integer; result record;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if not exists(select 1 from public.case_stock s
   where s.case_id=p_case and s.state='assigned' and s.assigned_to=p_judge)
 then raise exception 'court_case_not_owned' using errcode='42501'; end if;
 if exists(select 1 from public.shared_case_judgments j where j.case_id=p_case)
 then raise exception 'case_already_decided'; end if;
 perform pg_advisory_xact_lock(hashtextextended('court-begin:'||p_case,0));
 select game_day into day_now from public.shared_world_clock where id='main';
 select * into prev from public.shared_judge_hearings h
   where h.case_id=p_case order by h.hearing_index desc limit 1;
 if not found then
  idx:=1;due:=day_now;
 else
  if prev.judge_id is distinct from p_judge then raise exception 'court_case_not_owned'; end if;
  if prev.state='scheduled' then
   if prev.due_game_day<day_now then raise exception 'hearing_requires_rejoin'; end if;
   idx:=prev.hearing_index;due:=prev.due_game_day;
  elsif prev.state='completed' then
   -- No infinite date farming: require one confirmed action before each next session.
   if prev.hearing_index>=6 then raise exception 'maximum_hearings_reached'; end if;
   if not exists(select 1 from public.shared_court_actions a
     where a.case_id=p_case and a.hearing_index=prev.hearing_index)
   then raise exception 'previous_hearing_empty'; end if;
   idx:=prev.hearing_index+1;
   due:=greatest(day_now,prev.completed_game_day+1);
  else raise exception 'hearing_not_active'; end if;
 end if;
 if due>day_now+14 then raise exception 'hearing_outside_window'; end if;
 if idx<>prev.hearing_index or prev.case_id is null then
  perform public.shared_hearing_schedule(p_case,p_judge,idx,due);
 end if;
 select * into result from public.shared_hearing_open(p_case,p_judge,idx);
 return query select idx,result.world_day,result.already_opened;
end $$;
revoke all on function public.shared_court_begin(text,uuid) from public,anon,authenticated;
grant execute on function public.shared_court_begin(text,uuid) to service_role;
commit;
