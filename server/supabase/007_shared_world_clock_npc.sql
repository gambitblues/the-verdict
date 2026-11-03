-- THE VERDICT P4-2: server-authoritative global day and objective NPC registry.
-- Apply to an ISOLATED QA database after 001, 002, 003, 006.
-- No real save migration. All writes service_role only.
begin;

create table if not exists public.shared_world_clock (
  id text primary key default 'main' check(id='main'),
  game_day integer not null default 0 check(game_day between 0 and 200000),
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.shared_world_clock(id) values('main') on conflict do nothing;
alter table public.shared_world_clock enable row level security;
revoke all on public.shared_world_clock from public,anon,authenticated;
grant select on public.shared_world_clock to authenticated;
grant select,update on public.shared_world_clock to service_role;
drop policy if exists world_clock_invited_read on public.shared_world_clock;
create policy world_clock_invited_read on public.shared_world_clock
 for select to authenticated using(public.is_player());

-- Advancement never follows a device clock. The Worker must validate a completed
-- session and its scheduled hearing before invoking this privileged procedure.
create or replace function public.shared_clock_advance(
 p_expected_version bigint,p_day integer
) returns table(game_day integer,version bigint)
language plpgsql security definer set search_path=public as $$
declare old public.shared_world_clock%rowtype;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 select * into old from public.shared_world_clock where id='main' for update;
 if old.version is distinct from p_expected_version
 then raise exception 'clock_conflict' using errcode='40001'; end if;
 if p_day is null or p_day<=old.game_day or p_day>old.game_day+14
 then raise exception 'invalid_world_day'; end if;
 return query update public.shared_world_clock w
 set game_day=p_day,version=old.version+1,updated_at=now()
 where w.id='main' returning w.game_day,w.version;
end $$;
revoke all on function public.shared_clock_advance(bigint,integer)
 from public,anon,authenticated;
grant execute on function public.shared_clock_advance(bigint,integer) to service_role;

create table if not exists public.shared_npc_public (
 npc_id text primary key check(npc_id ~ '^[a-zA-Z0-9:_-]{4,120}$'),
 public_profile jsonb not null check(jsonb_typeof(public_profile)='object'),
 life_status text not null check(life_status in ('alive','dead','unknown')),
 effective_day integer not null check(effective_day between 0 and 200000),
 version bigint not null default 1,
 updated_at timestamptz not null default now(),
 check(octet_length(public_profile::text)<=8192)
);
alter table public.shared_npc_public enable row level security;
revoke all on public.shared_npc_public from public,anon,authenticated;
grant select on public.shared_npc_public to authenticated;
grant select,insert,update on public.shared_npc_public to service_role;
drop policy if exists shared_npc_invited_read on public.shared_npc_public;
create policy shared_npc_invited_read on public.shared_npc_public
 for select to authenticated using(public.is_player());

create or replace function public.shared_npc_public_put(
 p_id text,p_profile jsonb,p_status text,p_day integer,p_base_version bigint
) returns bigint
language plpgsql security definer set search_path=public as $$
declare old public.shared_npc_public%rowtype; new_version bigint;
 allowed text[]:=array['name','birthYear','profession','workplace','publicRole',
 'bio','publicCaseIds','publicEventKeys','releasedAt','convictedAt'];
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_id is null or p_id !~ '^[a-zA-Z0-9:_-]{4,120}$'
    or p_status not in ('alive','dead','unknown') or p_day not between 0 and 200000
    or p_profile is null or jsonb_typeof(p_profile)<>'object'
    or octet_length(p_profile::text)>8192
    or exists(select 1 from jsonb_object_keys(p_profile) key where not(key=any(allowed)))
 then raise exception 'invalid_npc_public'; end if;
 select * into old from public.shared_npc_public where npc_id=p_id for update;
 if found then
  if old.version is distinct from p_base_version
  then raise exception 'npc_version_conflict' using errcode='40001'; end if;
  if p_day<old.effective_day or (old.life_status='dead' and p_status<>'dead')
  then raise exception 'npc_temporal_conflict'; end if;
  update public.shared_npc_public
  set public_profile=p_profile,life_status=p_status,effective_day=p_day,
      version=old.version+1,updated_at=now()
  where npc_id=p_id returning version into new_version;
 else
  if p_base_version is distinct from 0 then raise exception 'npc_version_conflict'; end if;
  insert into public.shared_npc_public(npc_id,public_profile,life_status,effective_day)
  values(p_id,p_profile,p_status,p_day) returning version into new_version;
 end if;
 return new_version;
end $$;
revoke all on function public.shared_npc_public_put(text,jsonb,text,integer,bigint)
 from public,anon,authenticated;
grant execute on function public.shared_npc_public_put(text,jsonb,text,integer,bigint)
 to service_role;

commit;
