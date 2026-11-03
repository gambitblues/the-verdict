-- THE VERDICT P4-7: asynchronous judges share objective time, not personal court obligations.
-- QA-only migration, after 001,002,003,006,007,008,009,010,011.
-- Does not alter existing local saves or retroactively reschedule offline cases.
begin;

create table if not exists public.shared_judge_progress (
 judge_id uuid primary key references auth.users(id) on delete cascade,
 last_seen_world_day integer not null default 0 check(last_seen_world_day between 0 and 200000),
 protected_until_day integer not null default 0 check(protected_until_day between 0 and 200000),
 last_resumed_at timestamptz,
 updated_at timestamptz not null default now(),
 check(protected_until_day>=last_seen_world_day)
);
alter table public.shared_judge_progress enable row level security;
revoke all on public.shared_judge_progress from public,anon,authenticated;
grant select on public.shared_judge_progress to authenticated;
grant select,insert,update on public.shared_judge_progress to service_role;
drop policy if exists shared_judge_progress_own on public.shared_judge_progress;
create policy shared_judge_progress_own on public.shared_judge_progress
 for select to authenticated using(judge_id=auth.uid() and public.is_player());

create table if not exists public.shared_judge_hearings (
 case_id text not null references public.case_stock(case_id),
 hearing_index integer not null check(hearing_index between 1 and 200),
 judge_id uuid not null references auth.users(id) on delete cascade,
 due_game_day integer not null check(due_game_day between 0 and 200000),
 state text not null default 'scheduled' check(state in ('scheduled','completed','cancelled')),
 revised_by_catchup boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(case_id,hearing_index)
);
create index if not exists shared_judge_hearings_owner on public.shared_judge_hearings(judge_id,state,due_game_day);
alter table public.shared_judge_hearings enable row level security;
revoke all on public.shared_judge_hearings from public,anon,authenticated;
grant select on public.shared_judge_hearings to authenticated;
grant select,insert,update on public.shared_judge_hearings to service_role;
drop policy if exists shared_judge_hearings_own on public.shared_judge_hearings;
create policy shared_judge_hearings_own on public.shared_judge_hearings
 for select to authenticated using(judge_id=auth.uid() and public.is_player());

-- This is a trusted scheduling primitive, not a browser action.
-- Case ownership and a forward-only global hearing date are enforced in SQL.
create or replace function public.shared_hearing_schedule(
 p_case text,p_judge uuid,p_index integer,p_due integer
) returns boolean
language plpgsql security definer set search_path=public as $$
declare today_day integer; old public.shared_judge_hearings%rowtype;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if not exists(select 1 from public.case_stock where case_id=p_case and assigned_to=p_judge and state='assigned')
 then raise exception 'hearing_case_not_owned' using errcode='42501'; end if;
 select game_day into today_day from public.shared_world_clock where id='main' for share;
 if p_index not between 1 and 200 or p_due is null or p_due<today_day or p_due>today_day+14
 then raise exception 'invalid_hearing_day'; end if;
 select * into old from public.shared_judge_hearings
 where case_id=p_case and hearing_index=p_index for update;
 if found then
  if old.judge_id is distinct from p_judge or old.state<>'scheduled'
    or old.due_game_day is distinct from p_due then raise exception 'hearing_schedule_conflict'; end if;
  return false;
 end if;
 insert into public.shared_judge_hearings(case_id,hearing_index,judge_id,due_game_day)
 values(p_case,p_index,p_judge,p_due);
 return true;
end $$;
revoke all on function public.shared_hearing_schedule(text,uuid,integer,integer)
 from public,anon,authenticated;
grant execute on function public.shared_hearing_schedule(text,uuid,integer,integer) to service_role;

-- Called only after authentication. A judge inactive during global advancement
-- does not have their cases auto-tried, forfeited or removed. Rejoin is idempotent.
-- Outstanding hearings with dates passed by the world get at least two WORLD days
-- of reentry protection. Historical public events never move backward.
create or replace function public.shared_judge_resume(p_judge uuid)
returns table(previous_day integer,world_day integer,lag_days integer,
              protected_until_day integer,rescheduled_hearings integer)
language plpgsql security definer set search_path=public as $$
declare now_day integer; last_day integer; until_day integer; shifted integer:=0;
        first_pending_day integer;
        old public.shared_judge_progress%rowtype;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_judge is null or not exists(select 1 from public.players p where p.user_id=p_judge)
 then raise exception 'judge_not_invited' using errcode='42501'; end if;
 -- Serialize resumption against another device for the same judge.
 perform pg_advisory_xact_lock(hashtextextended('world-rejoin:'||p_judge::text,0));
 select game_day into now_day from public.shared_world_clock where id='main' for share;
 if now_day is null then raise exception 'shared_clock_missing'; end if;
 select * into old from public.shared_judge_progress where judge_id=p_judge for update;
 if found then
  last_day:=old.last_seen_world_day;
  until_day:=old.protected_until_day;
 else
  -- A judge with no progress record may still have an old assigned hearing.
  -- Treat its earliest outstanding day as the baseline so absence never
  -- produces an automatic missed hearing just because the cursor is missing.
  select min(h.due_game_day) into first_pending_day
  from public.shared_judge_hearings h
  where h.judge_id=p_judge and h.state='scheduled';
  last_day:=least(now_day,coalesce(first_pending_day,now_day));
  until_day:=last_day;
 end if;
 if last_day<now_day then
  until_day:=least(200000,now_day+2);
  -- Only upcoming obligations belonging to this judge may move.
  update public.shared_judge_hearings h set
   due_game_day=greatest(h.due_game_day,until_day),
   revised_by_catchup=true,updated_at=now()
  where h.judge_id=p_judge and h.state='scheduled'
    and h.due_game_day<until_day;
  get diagnostics shifted=row_count;
 end if;
 insert into public.shared_judge_progress(judge_id,last_seen_world_day,protected_until_day,last_resumed_at)
 values(p_judge,now_day,until_day,now())
 on conflict(judge_id) do update
 set last_seen_world_day=greatest(public.shared_judge_progress.last_seen_world_day,excluded.last_seen_world_day),
     protected_until_day=greatest(public.shared_judge_progress.protected_until_day,excluded.protected_until_day),
     last_resumed_at=now(),updated_at=now();
 return query select last_day,now_day,greatest(0,now_day-last_day),
                     until_day,shifted;
end $$;
revoke all on function public.shared_judge_resume(uuid) from public,anon,authenticated;
grant execute on function public.shared_judge_resume(uuid) to service_role;
commit;
