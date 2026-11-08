-- Migration 037 (2026-11-08): colleague court — the light shared world (planner decision).
-- Each invited player keeps playing their own game. Other players appear only as colleague judges at the same court:
--   * their public judge card (name, bench),
--   * the cases they currently hold (so the same case is never on two benches at once),
--   * the verdicts they delivered (public summary only, read as court news).
-- No hidden truth, no court record, no save data is stored here. Players write only their own rows, through the
-- functions below; everyone invited can read. Needs 001 (players, is_player).

create table if not exists public.court_judges(
 user_id    uuid primary key references auth.users(id) on delete cascade,
 judge_name text not null check (length(judge_name) between 1 and 20),
 bench      text not null default '' check (length(bench) <= 40),
 gender     text not null default '' check (gender in ('','남','여')),   -- so the colleague's card shows the right person
 updated_at timestamptz not null default now()
);

create table if not exists public.court_cases(
 case_key   text not null check (case_key ~ '^[A-Za-z0-9_.:-]{1,80}$'),
 judge_id   uuid not null references auth.users(id) on delete cascade,
 state      text not null check (state in ('open','judged')),
 opened_at  timestamptz not null default now(),
 touched_at timestamptz not null default now(),
 judged_at  timestamptz,
 summary    jsonb check (summary is null or (jsonb_typeof(summary)='object' and length(summary::text) <= 1500)),
 primary key (case_key, judge_id)
);
-- one bench at a time: a case is open for at most one judge
create unique index if not exists court_case_one_open on public.court_cases(case_key) where state='open';
create index if not exists court_case_judged on public.court_cases(judged_at desc) where state='judged';

alter table public.court_judges enable row level security;
alter table public.court_cases enable row level security;
drop policy if exists court_judges_read on public.court_judges;
create policy court_judges_read on public.court_judges for select to authenticated using (public.is_player());
drop policy if exists court_cases_read on public.court_cases;
create policy court_cases_read on public.court_cases for select to authenticated using (public.is_player());
revoke all on public.court_judges, public.court_cases from public, anon;
revoke insert, update, delete on public.court_judges, public.court_cases from authenticated;
grant select on public.court_judges, public.court_cases to authenticated;

-- my judge card
create or replace function public.court_judge_put(p_name text, p_bench text default '', p_gender text default '')
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
 if not public.is_player() then raise exception 'not_player' using errcode = '42501'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 20 or length(coalesce(p_bench,'')) > 40
  or coalesce(p_gender,'') not in ('','남','여')
 then raise exception 'invalid_judge'; end if;
 insert into public.court_judges(user_id, judge_name, bench, gender) values (uid, btrim(p_name), coalesce(p_bench,''), coalesce(p_gender,''))
 on conflict (user_id) do update set judge_name = excluded.judge_name, bench = excluded.bench, gender = excluded.gender, updated_at = now();
 return true;
end $$;

-- make my open cases exactly p_open (self-healing after a new career, a lost device or a skipped sync).
-- Returns the keys I could NOT take because another judge holds them. A hold not refreshed for 14 days lapses.
create or replace function public.court_case_sync(p_open text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); k text; refused text[] := '{}';
begin
 if not public.is_player() then raise exception 'not_player' using errcode = '42501'; end if;
 if p_open is null or cardinality(p_open) > 20 then raise exception 'invalid_cases'; end if;
 perform pg_advisory_xact_lock(hashtextextended('court-cases', 0));
 delete from public.court_cases where judge_id = uid and state = 'open' and not (case_key = any(p_open));
 delete from public.court_cases where state = 'open' and judge_id <> uid and touched_at < now() - interval '14 days';
 foreach k in array p_open loop
  if k !~ '^[A-Za-z0-9_.:-]{1,80}$' then raise exception 'invalid_cases'; end if;
  if exists(select 1 from public.court_cases where case_key = k and state = 'open' and judge_id <> uid) then
   refused := refused || k; continue;
  end if;
  insert into public.court_cases(case_key, judge_id, state) values (k, uid, 'open')
  on conflict (case_key, judge_id) do update set state = 'open', touched_at = now(),
   opened_at = case when public.court_cases.state = 'open' then public.court_cases.opened_at else now() end,
   judged_at = null, summary = null;   -- a case judged long ago may come back late in a career
 end loop;
 return refused;
end $$;

-- I delivered a verdict: the public summary becomes court news for the other judges
create or replace function public.court_case_judge(p_key text, p_summary jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
 if not public.is_player() then raise exception 'not_player' using errcode = '42501'; end if;
 if p_key is null or p_key !~ '^[A-Za-z0-9_.:-]{1,80}$' or p_summary is null or jsonb_typeof(p_summary) <> 'object'
  or length(p_summary::text) > 1500 then raise exception 'invalid_judgment'; end if;
 perform pg_advisory_xact_lock(hashtextextended('court-cases', 0));
 insert into public.court_cases(case_key, judge_id, state, judged_at, summary) values (p_key, uid, 'judged', now(), p_summary)
 on conflict (case_key, judge_id) do update set state = 'judged', judged_at = now(), touched_at = now(), summary = excluded.summary;
 return true;
end $$;

revoke all on function public.court_judge_put(text,text,text) from public, anon;
revoke all on function public.court_case_sync(text[]) from public, anon;
revoke all on function public.court_case_judge(text,jsonb) from public, anon;
grant execute on function public.court_judge_put(text,text,text) to authenticated;
grant execute on function public.court_case_sync(text[]) to authenticated;
grant execute on function public.court_case_judge(text,jsonb) to authenticated;
