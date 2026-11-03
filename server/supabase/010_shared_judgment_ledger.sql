-- P4-5: one immutable, publicly verifiable judgment per shared case.
-- Apply on QA DB after 001,002,003,006,007,008,009.
-- Only the future trusted server adjudication pipeline may call the RPC.
begin;
create table if not exists public.shared_case_judgments (
 case_id text primary key references public.case_stock(case_id),
 judge_id uuid not null references auth.users(id),
 game_day integer not null check(game_day between 0 and 200000),
 result text not null check(result in ('guilty','acquittal','partial','claim_granted','claim_denied','settled','decision_yes','decision_no')),
 public_order text not null check(length(public_order) between 1 and 1200),
 record_hash text not null check(record_hash ~ '^[a-f0-9]{64}$'),
 published_at timestamptz not null default now()
);
alter table public.shared_case_judgments enable row level security;
revoke all on public.shared_case_judgments from public,anon,authenticated;
grant select on public.shared_case_judgments to authenticated;
grant select,insert on public.shared_case_judgments to service_role;
drop policy if exists shared_judgments_invited_read on public.shared_case_judgments;
create policy shared_judgments_invited_read on public.shared_case_judgments
 for select to authenticated using(public.is_player());

-- The actual game engine and evidence journal must be validated by a trusted
-- server BEFORE calling this. No browser endpoint is exposed for this RPC.
create or replace function public.shared_judgment_publish(
 p_case text,p_judge uuid,p_result text,p_order text,p_record_hash text
) returns boolean
language plpgsql security definer set search_path=public as $$
declare existing public.shared_case_judgments%rowtype; d integer;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_case is null or p_judge is null or p_result not in (
  'guilty','acquittal','partial','claim_granted','claim_denied','settled','decision_yes','decision_no')
  or p_order is null or length(p_order) not between 1 and 1200
  or p_record_hash is null or p_record_hash !~ '^[a-f0-9]{64}$'
 then raise exception 'invalid_public_judgment'; end if;
 if not exists(select 1 from public.case_stock s
  where s.case_id=p_case and s.state='assigned' and s.assigned_to=p_judge)
 then raise exception 'case_not_assigned_to_judge' using errcode='42501'; end if;
 select game_day into d from public.shared_world_clock where id='main' for share;
 if d is null then raise exception 'shared_clock_missing'; end if;
 select * into existing from public.shared_case_judgments where case_id=p_case for update;
 if found then
  if existing.judge_id is distinct from p_judge or existing.result is distinct from p_result
    or existing.public_order is distinct from p_order
    or existing.record_hash is distinct from p_record_hash
  then raise exception 'judgment_already_published' using errcode='23505'; end if;
  return false;
 end if;
 insert into public.shared_case_judgments(case_id,judge_id,game_day,result,public_order,record_hash)
 values(p_case,p_judge,d,p_result,p_order,p_record_hash);
 perform public.shared_world_append(
  'judgment:'||p_case,p_case,'judgment_published',d,
  jsonb_build_object('publicCaseId',p_case,'judgment',p_order,
                     'eventLabel','재판부가 판결을 선고했습니다.'),p_judge);
 return true;
end $$;
revoke all on function public.shared_judgment_publish(text,uuid,text,text,text)
 from public,anon,authenticated;
grant execute on function public.shared_judgment_publish(text,uuid,text,text,text)
 to service_role;

-- Published judgments must never be silently edited or deleted.
create or replace function public.shared_judgment_immutable() returns trigger
language plpgsql as $$
begin raise exception 'shared_judgment_immutable' using errcode='42501'; end $$;
drop trigger if exists shared_judgment_no_rewrite on public.shared_case_judgments;
create trigger shared_judgment_no_rewrite before update or delete
 on public.shared_case_judgments for each row execute function public.shared_judgment_immutable();

-- Appellate/afterlife publication is only valid when a judgment actually exists,
-- and its timestamp must not precede the judgment in the shared game clock.
create or replace function public.shared_event_chronology_guard() returns trigger
language plpgsql as $$
declare verdict_day integer;
begin
 if new.event_type in ('appeal_reported','aftermath_published') then
  select game_day into verdict_day from public.shared_case_judgments where case_id=new.case_id;
  if verdict_day is null or new.game_day<verdict_day
  then raise exception 'world_event_out_of_order'; end if;
 end if;
 return new;
end $$;
drop trigger if exists shared_event_chronology on public.shared_world_events;
create trigger shared_event_chronology before insert on public.shared_world_events
 for each row execute function public.shared_event_chronology_guard();
commit;
