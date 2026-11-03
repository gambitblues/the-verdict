-- THE VERDICT P4-1: append-only public shared-world chronology.
-- Apply manually AFTER 001_init.sql and 003_case_stock.sql.
-- Never deploy from git automatically. No existing rows or saves are changed.
begin;

create table if not exists public.shared_world_events (
  event_id bigint generated always as identity primary key,
  event_key text not null unique check(length(event_key) between 8 and 160),
  case_id text references public.case_stock(case_id) on delete restrict,
  event_type text not null check(event_type in (
    'incident_reported','investigation_opened','indictment_filed','case_assigned',
    'hearing_opened','judgment_published','appeal_reported','aftermath_published',
    'npc_public_update'
  )),
  game_day integer not null check(game_day between 0 and 200000),
  public_data jsonb not null default '{}'::jsonb,
  judge_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (jsonb_typeof(public_data)='object'),
  check(octet_length(public_data::text)<=32768),
  check(case_id is not null or event_type='npc_public_update')
);
create index if not exists shared_world_events_chronology
  on public.shared_world_events(game_day,event_id);
create index if not exists shared_world_events_case
  on public.shared_world_events(case_id,game_day,event_id);

alter table public.shared_world_events enable row level security;
revoke all on public.shared_world_events from public,anon,authenticated;
grant select on public.shared_world_events to authenticated;
grant select,insert on public.shared_world_events to service_role;
drop policy if exists shared_events_invited_read on public.shared_world_events;
create policy shared_events_invited_read on public.shared_world_events
  for select to authenticated using (public.is_player());

-- A database-side public-fields whitelist. Unknown keys (notably truth,
-- sealed branches, verdict score, prompt and evidence not in the record) fail closed.
-- Public world events are NOT a source of secret case contents.
create or replace function public.shared_world_append(
 p_key text,p_case text,p_type text,p_day integer,p_data jsonb,
 p_judge uuid default null
) returns bigint
language plpgsql security definer set search_path=public as $$
declare
 existing public.shared_world_events%rowtype;
 new_id bigint;
 allowed text[] := array[
  'title','summary','outlet','reporter','status','publicCaseId','npcIds',
  'judgment','sentence','court','hearingDate','publishedAt','sourceEventKey',
  'actorName','role','eventLabel','articleId'
 ];
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
  raise exception 'service_only' using errcode='42501';
 end if;
 if p_key is null or length(p_key) not between 8 and 160 or p_day not between 0 and 200000
    or p_data is null or jsonb_typeof(p_data)<>'object'
    or octet_length(p_data::text)>32768
    or p_type not in ('incident_reported','investigation_opened','indictment_filed',
      'case_assigned','hearing_opened','judgment_published','appeal_reported',
      'aftermath_published','npc_public_update')
    or (p_case is null and p_type<>'npc_public_update')
    or exists(select 1 from jsonb_object_keys(p_data) k where not (k=any(allowed)))
 then raise exception 'invalid_public_event'; end if;
 if p_judge is not null and not exists(select 1 from public.players where user_id=p_judge) then
  raise exception 'judge_not_invited' using errcode='42501';
 end if;
 -- Never publish a judgment for a case assigned to another judge.
 if p_type in ('hearing_opened','judgment_published') and
    (p_judge is null or not exists(
      select 1 from public.case_stock
      where case_id=p_case and state='assigned' and assigned_to=p_judge))
 then raise exception 'case_not_assigned_to_judge' using errcode='42501'; end if;
 -- Event keys are idempotency keys; reject attempts to re-use with different facts.
 perform pg_advisory_xact_lock(hashtextextended(p_key,0));
 select * into existing from public.shared_world_events where event_key=p_key;
 if found then
  if existing.case_id is distinct from p_case
    or existing.event_type is distinct from p_type
    or existing.game_day is distinct from p_day
    or existing.public_data is distinct from p_data
    or existing.judge_id is distinct from p_judge
  then raise exception 'event_key_conflict' using errcode='23505'; end if;
  return existing.event_id;
 end if;
 insert into public.shared_world_events(event_key,case_id,event_type,game_day,public_data,judge_id)
 values(p_key,p_case,p_type,p_day,p_data,p_judge) returning event_id into new_id;
 return new_id;
end $$;
revoke all on function public.shared_world_append(text,text,text,integer,jsonb,uuid)
 from public,anon,authenticated;
grant execute on function public.shared_world_append(text,text,text,integer,jsonb,uuid)
 to service_role;

-- Prevent accidental rewrites of published history, including service-role writes.
create or replace function public.shared_world_immutable() returns trigger
language plpgsql as $$
begin raise exception 'shared_history_immutable' using errcode='42501'; end $$;
drop trigger if exists shared_world_no_rewrite on public.shared_world_events;
create trigger shared_world_no_rewrite before update or delete
 on public.shared_world_events for each row execute function public.shared_world_immutable();

commit;
