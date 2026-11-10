-- Migration 040 (2026-11-10, planner request): two invited players can be a married couple of judges at the same court.
-- One row per person: who their spouse is, the sex and the age their judge has from now on, and since when. Each player
-- reads only the rows of their own couple; nobody writes from the game. The planner sets a couple once in the SQL
-- Editor (the editor runs as the database owner):
--   select public.set_judge_couple('<첫 사람 이메일>', '남', '<둘째 사람 이메일>', '여', 35);
-- Running it again with the same two emails changes nothing but sex/age; `since` stays, so children born in the game
-- (counted from `since`) stay the same. Needs 001 (players, is_player) and 037 (colleague court).

create table if not exists public.court_couples(
 user_id uuid primary key references auth.users(id) on delete cascade,
 spouse  uuid not null references auth.users(id) on delete cascade,
 sex     text not null check (sex in ('남','여')),
 age     integer not null check (age between 25 and 70),
 since   timestamptz not null default now(),
 check (user_id <> spouse)
);
alter table public.court_couples enable row level security;
drop policy if exists court_couples_read on public.court_couples;
create policy court_couples_read on public.court_couples for select to authenticated
 using (public.is_player() and (user_id = auth.uid() or spouse = auth.uid()));
revoke all on public.court_couples from public, anon;
revoke insert, update, delete on public.court_couples from authenticated;
grant select on public.court_couples to authenticated;

create or replace function public.set_judge_couple(email_a text, sex_a text, email_b text, sex_b text, p_age integer default 35)
returns text language plpgsql security definer set search_path = public, auth as $$
declare a uuid; b uuid; t timestamptz;
begin
 select id into a from auth.users where lower(email) = lower(btrim(email_a));
 select id into b from auth.users where lower(email) = lower(btrim(email_b));
 if a is null or b is null then raise exception '040: 두 이메일 가운데 가입(초대 수락)하지 않은 계정이 있습니다.'; end if;
 if a = b then raise exception '040: 같은 계정을 두 번 적었습니다.'; end if;
 if sex_a not in ('남','여') or sex_b not in ('남','여') then raise exception '040: 성별은 남 또는 여'; end if;
 -- a person already married to someone else is not silently re-married
 if exists(select 1 from public.court_couples where (user_id = a and spouse <> b) or (user_id = b and spouse <> a))
 then raise exception '040: 이미 다른 사람과 부부로 설정된 계정입니다. 먼저 delete from public.court_couples where user_id in (...)로 지우세요.'; end if;
 select since into t from public.court_couples where user_id = a and spouse = b;
 t := coalesce(t, now());
 insert into public.court_couples(user_id, spouse, sex, age, since) values (a, b, sex_a, p_age, t), (b, a, sex_b, p_age, t)
 on conflict (user_id) do update set spouse = excluded.spouse, sex = excluded.sex, age = excluded.age;
 return '부부 판사 설정 완료 (다음 접속 때 게임에 반영)';
end $$;
revoke all on function public.set_judge_couple(text,text,text,text,integer) from public, anon, authenticated;
