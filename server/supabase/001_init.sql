-- THE VERDICT — Supabase schema (run once in the SQL editor of project "THE VERDICT")
-- v8.7.1: players can only read; every write goes through a checked function (saves) or the Worker (world, AI usage).
--
-- Before running: put the two invited emails in the insert at the end of section 1.
-- Dashboard settings (not SQL): Authentication → Sign In / Providers → turn OFF "Allow new users to sign up";
-- Authentication → Users → "Invite user" for the same two emails.

-- 0. no default rights for browser roles on anything below ----------------------------------------------------
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- 1. who may play -------------------------------------------------------------------------------------------
create table if not exists public.players (
  email      text primary key,
  user_id    uuid unique references auth.users(id) on delete set null,
  name       text,
  created_at timestamptz not null default now()
);
alter table public.players enable row level security;            -- no policy: browsers cannot read or change it
revoke all on public.players from anon, authenticated;
-- insert into public.players(email,name) values ('player1@example.com','플레이어 1'),('player2@example.com','플레이어 2');

create or replace function public.is_player() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists(select 1 from public.players where user_id = auth.uid())
$$;

-- links the signed-in user to their invite row (first login) and says whether they are invited
create or replace function public.claim_player() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  update public.players set user_id = auth.uid()
   where lower(email) = lower(coalesce(auth.jwt() ->> 'email','')) and user_id is null;
  return exists(select 1 from public.players where user_id = auth.uid());
end $$;

-- 2. each player's careers: read your own; write only through save_put (version check, backups) --------------
create table if not exists public.saves (
  user_id    uuid not null references auth.users(id) on delete cascade,
  slot       text not null check (slot in ('1','2')),
  data       text not null,
  game_ver   text,
  rev        bigint not null default 1,      -- goes up by one on every write; a write must name the rev it started from
  device     text,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);
alter table public.saves enable row level security;
drop policy if exists saves_own on public.saves;
drop policy if exists saves_read_own on public.saves;
create policy saves_read_own on public.saves for select to authenticated using (user_id = auth.uid() and public.is_player());
revoke all on public.saves from anon;
revoke insert, update, delete on public.saves from authenticated;

-- the version that was replaced when one device overwrote another's newer save (last 5 per slot)
create table if not exists public.save_backups (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  slot       text not null,
  data       text not null,
  rev        bigint,
  game_ver   text,
  device     text,
  reason     text,
  created_at timestamptz not null default now()
);
alter table public.save_backups enable row level security;
drop policy if exists backups_read_own on public.save_backups;
create policy backups_read_own on public.save_backups for select to authenticated using (user_id = auth.uid() and public.is_player());
revoke all on public.save_backups from anon;
revoke insert, update, delete on public.save_backups from authenticated;

-- write one slot. base_rev = the rev this device last saw (0 = none). A newer save from another device is never
-- overwritten silently: the call returns conflict=true. With p_force the newer save is first kept in save_backups.
create or replace function public.save_put(p_slot text, p_data text, p_base_rev bigint, p_game_ver text default null,
                                           p_device text default null, p_force boolean default false)
returns table(ok boolean, conflict boolean, rev bigint, updated_at timestamptz, device text)
language plpgsql security definer set search_path = public as $$
declare cur public.saves%rowtype; uid uuid := auth.uid();
begin
  if not public.is_player() then raise exception 'not_player' using errcode = '42501'; end if;
  if p_slot not in ('1','2') then raise exception 'bad_slot'; end if;
  if p_data is null or length(p_data) = 0 or length(p_data) > 8000000 then raise exception 'bad_size'; end if;
  select * into cur from public.saves s where s.user_id = uid and s.slot = p_slot for update;
  if not found then
    insert into public.saves(user_id, slot, data, game_ver, rev, device) values (uid, p_slot, p_data, p_game_ver, 1, p_device);
    return query select true, false, 1::bigint, now(), p_device; return;
  end if;
  if cur.rev <> coalesce(p_base_rev, 0) and not p_force then
    return query select false, true, cur.rev, cur.updated_at, cur.device; return;
  end if;
  if cur.rev <> coalesce(p_base_rev, 0) or coalesce(cur.device,'') <> coalesce(p_device,'') then
    insert into public.save_backups(user_id, slot, data, rev, game_ver, device, reason)
      values (uid, p_slot, cur.data, cur.rev, cur.game_ver, cur.device, case when p_force then 'overwritten' else 'other_device' end);
    delete from public.save_backups b where b.user_id = uid and b.slot = p_slot
      and b.id not in (select id from public.save_backups x where x.user_id = uid and x.slot = p_slot order by id desc limit 5);
  end if;
  update public.saves s set data = p_data, game_ver = p_game_ver, rev = cur.rev + 1, device = p_device, updated_at = now()
   where s.user_id = uid and s.slot = p_slot;
  return query select true, false, cur.rev + 1, now(), p_device;
end $$;

-- 3. the shared world: players read it; only the Worker (service role) writes it ------------------------------
create table if not exists public.world_state (
  id         text primary key default 'main',
  data       jsonb not null default '{}'::jsonb,   -- what both players may see
  version    bigint not null default 0,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.world_state enable row level security;
drop policy if exists world_players on public.world_state;
drop policy if exists world_read on public.world_state;
create policy world_read on public.world_state for select to authenticated using (public.is_player());
revoke all on public.world_state from anon;
revoke insert, update, delete on public.world_state from authenticated;
insert into public.world_state(id) values ('main') on conflict do nothing;

-- hidden truths of shared cases: no policy at all, so only the service role (the Worker) can read or write them
create table if not exists public.world_secrets (
  case_id    text primary key,
  truth      jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.world_secrets enable row level security;
revoke all on public.world_secrets from anon, authenticated;

-- 4. AI calls: a slot is reserved before calling (so parallel calls cannot pass the daily limit), then finished ----
create table if not exists public.ai_usage (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null,
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  est_usd       numeric(12,6) not null default 0,   -- the most this call could cost (counted while it runs)
  cost_usd      numeric(12,6) not null default 0,   -- what it did cost
  ok            boolean,                             -- null while running
  reason        text,
  ms            integer,
  created_at    timestamptz not null default now()
);
create index if not exists ai_usage_user_day on public.ai_usage(user_id, created_at);
alter table public.ai_usage enable row level security;
drop policy if exists ai_usage_read_own on public.ai_usage;
create policy ai_usage_read_own on public.ai_usage for select to authenticated using (user_id = auth.uid());
revoke all on public.ai_usage from anon;
revoke insert, update, delete on public.ai_usage from authenticated;

create or replace function public.ai_reserve(p_uid uuid, p_kind text, p_model text, p_est numeric, p_max_calls int, p_max_usd numeric)
returns bigint language plpgsql security definer set search_path = public as $$
declare n bigint; spent numeric; day_start timestamptz := (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'); new_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('ai:' || p_uid::text));      -- one reservation at a time per player
  select count(*), coalesce(sum(case when ok is null then est_usd else cost_usd end), 0) into n, spent
    from public.ai_usage where user_id = p_uid and created_at >= day_start;
  if n >= p_max_calls or spent + p_est > p_max_usd then return null; end if;
  insert into public.ai_usage(user_id, kind, model, est_usd) values (p_uid, p_kind, p_model, p_est) returning id into new_id;
  return new_id;
end $$;

create or replace function public.ai_finish(p_id bigint, p_model text, p_in int, p_out int, p_cost numeric, p_ok boolean, p_reason text, p_ms int)
returns void language sql security definer set search_path = public as $$
  update public.ai_usage set model = coalesce(p_model, model), input_tokens = p_in, output_tokens = p_out, cost_usd = p_cost,
         ok = p_ok, reason = p_reason, ms = p_ms where id = p_id
$$;

create or replace function public.ai_usage_today(uid uuid) returns table(calls bigint, usd numeric)
language sql stable security definer set search_path = public as $$
  select count(*), coalesce(sum(case when ok is null then est_usd else cost_usd end), 0) from public.ai_usage
   where user_id = uid and created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
$$;

-- 5. who may call which function ---------------------------------------------------------------------------
revoke all on function public.is_player() from public, anon;
revoke all on function public.claim_player() from public, anon;
revoke all on function public.save_put(text,text,bigint,text,text,boolean) from public, anon;
revoke all on function public.ai_reserve(uuid,text,text,numeric,int,numeric) from public, anon, authenticated;
revoke all on function public.ai_finish(bigint,text,int,int,numeric,boolean,text,int) from public, anon, authenticated;
revoke all on function public.ai_usage_today(uuid) from public, anon, authenticated;
grant execute on function public.is_player() to authenticated;
grant execute on function public.claim_player() to authenticated;
grant execute on function public.save_put(text,text,bigint,text,text,boolean) to authenticated;
grant execute on function public.ai_reserve(uuid,text,text,numeric,int,numeric) to service_role;
grant execute on function public.ai_finish(bigint,text,int,int,numeric,boolean,text,int) to service_role;
grant execute on function public.ai_usage_today(uuid) to service_role;
