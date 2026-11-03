-- THE VERDICT P4-10: sealed courtroom action journal, one immutable result per
-- case/question or case/order. Trusted Worker computes the answer from the locked
-- truth before calling this RPC; browsers may neither write nor read the table.
-- Isolated QA DB only; apply after 001..003, 006..014.
begin;
create table if not exists public.shared_court_actions (
 case_id text not null references public.case_stock(case_id),
 judge_id uuid not null references auth.users(id),
 action_type text not null check(action_type in ('question','order')),
 action_key text not null check(action_key ~ '^[a-zA-Z0-9:_-]{1,80}$'),
 response jsonb not null check(jsonb_typeof(response)='object'
   and octet_length(response::text)<=12000),
 hearing_index integer not null check(hearing_index between 1 and 200),
 game_day integer not null check(game_day between 0 and 200000),
 created_at timestamptz not null default now(),
 primary key(case_id,action_type,action_key)
);
alter table public.shared_court_actions enable row level security;
revoke all on public.shared_court_actions from public,anon,authenticated;
grant select,insert on public.shared_court_actions to service_role;
create or replace function public.shared_court_action_record(
 p_case text,p_judge uuid,p_hearing integer,p_type text,p_key text,p_response jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare prior public.shared_court_actions%rowtype;
        today_day integer;
        heard public.shared_judge_hearings%rowtype;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_type not in ('question','order') or p_key is null or p_key !~ '^[a-zA-Z0-9:_-]{1,80}$'
   or p_response is null or jsonb_typeof(p_response)<>'object'
   or octet_length(p_response::text)>12000
   or p_response->>'status' not in ('done','declined','delayed')
 then raise exception 'invalid_court_action'; end if;
 if not exists(select 1 from public.case_stock s
  where s.case_id=p_case and s.assigned_to=p_judge and s.state='assigned')
 then raise exception 'court_case_not_owned' using errcode='42501'; end if;
 if exists(select 1 from public.shared_case_judgments j where j.case_id=p_case)
 then raise exception 'case_already_decided'; end if;
 -- Prevent a stale device from adding actions after the world moves beyond the
 -- last opened hearing. Only the active hearing in the current shared day can act.
 select game_day into today_day from public.shared_world_clock where id='main' for share;
 select * into heard from public.shared_judge_hearings
  where case_id=p_case and hearing_index=p_hearing and judge_id=p_judge
  for share;
 if not found or heard.state<>'completed' or heard.completed_game_day is distinct from today_day
 then raise exception 'hearing_not_open_today' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('court:'||p_case||':'||p_type||':'||p_key,0));
 select * into prior from public.shared_court_actions a
 where a.case_id=p_case and a.action_type=p_type and a.action_key=p_key;
 if found then
  if prior.judge_id is distinct from p_judge or prior.response is distinct from p_response
  then raise exception 'court_action_conflict' using errcode='23505'; end if;
  return prior.response;
 end if;
 insert into public.shared_court_actions
 (case_id,judge_id,action_type,action_key,response,hearing_index,game_day)
 values(p_case,p_judge,p_type,p_key,p_response,p_hearing,today_day);
 return p_response;
end $$;
revoke all on function public.shared_court_action_record(text,uuid,integer,text,text,jsonb)
 from public,anon,authenticated;
grant execute on function public.shared_court_action_record(text,uuid,integer,text,text,jsonb)
 to service_role;

create or replace function public.shared_court_action_immutable() returns trigger
language plpgsql as $$
begin raise exception 'court_action_immutable' using errcode='42501'; end $$;
drop trigger if exists court_action_no_mutation on public.shared_court_actions;
create trigger court_action_no_mutation before update or delete on public.shared_court_actions
 for each row execute function public.shared_court_action_immutable();
commit;
