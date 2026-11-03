-- THE VERDICT P4-8: trusted opening of a scheduled hearing advances the SHARED
-- calendar to that hearing's date (MAX), never by "one day per case."
-- Apply to an isolated QA database after migrations 001..003,006..012.
-- No browser-write RPC and no live deployment are introduced.
begin;

alter table public.shared_judge_hearings
 add column if not exists completed_game_day integer
 check(completed_game_day between 0 and 200000);

create or replace function public.shared_hearing_open(
 p_case text,p_judge uuid,p_index integer
) returns table(hearing_day integer,world_day integer,clock_version bigint,already_opened boolean)
language plpgsql security definer set search_path=public as $$
declare c public.shared_world_clock%rowtype; h public.shared_judge_hearings%rowtype;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_judge is null or not exists(select 1 from public.players where user_id=p_judge)
 then raise exception 'judge_not_invited' using errcode='42501'; end if;
 if not exists(select 1 from public.case_stock
    where case_id=p_case and state='assigned' and assigned_to=p_judge)
 then raise exception 'hearing_case_not_owned' using errcode='42501'; end if;
 if exists(select 1 from public.shared_case_judgments where case_id=p_case)
 then raise exception 'case_already_decided'; end if;
 -- One authoritative world time shared by both judges. The lock prevents races
 -- when two judges open a hearing at the same instant.
 select * into c from public.shared_world_clock where id='main' for update;
 select * into h from public.shared_judge_hearings
 where case_id=p_case and hearing_index=p_index for update;
 if not found or h.judge_id is distinct from p_judge
 then raise exception 'hearing_not_scheduled' using errcode='42501'; end if;
 if h.state='completed' then
  return query select h.completed_game_day,c.game_day,c.version,true;
  return;
 end if;
 if h.state<>'scheduled' then raise exception 'hearing_not_active'; end if;
 if h.due_game_day<c.game_day then
  raise exception 'hearing_requires_rejoin' using errcode='40001'; end if;
 if h.due_game_day>c.game_day+14 then raise exception 'hearing_outside_window'; end if;
 if h.due_game_day>c.game_day then
  update public.shared_world_clock w set game_day=h.due_game_day,
      version=c.version+1,updated_at=now()
  where w.id='main' returning * into c;
 end if;
 update public.shared_judge_hearings
 set state='completed',completed_game_day=c.game_day,updated_at=now()
 where case_id=p_case and hearing_index=p_index;
 perform public.shared_world_append(
  'hearing:'||p_case||':'||p_index,p_case,'hearing_opened',c.game_day,
  jsonb_build_object('publicCaseId',p_case,'eventLabel','공판기일이 열렸습니다.'),p_judge);
 return query select c.game_day,c.game_day,c.version,false;
end $$;

revoke all on function public.shared_hearing_open(text,uuid,integer)
 from public,anon,authenticated;
grant execute on function public.shared_hearing_open(text,uuid,integer) to service_role;

commit;
