-- THE VERDICT — Supabase schema, step 1 (run once in the SQL editor of project "THE VERDICT")
-- Login is invite-only: in Authentication → Sign In / Providers turn OFF "Allow new users to sign up",
-- then invite the two players from Authentication → Users → "Invite user" and add their emails below.

-- 1. who may play ------------------------------------------------------------------------------------------
create table if not exists public.players (
  email      text primary key,
  user_id    uuid unique references auth.users(id) on delete set null,
  name       text,
  created_at timestamptz not null default now()
);
-- insert into public.players(email,name) values ('player1@example.com','플레이어 1'),('player2@example.com','플레이어 2');

-- links the auth user to the invite row on first login (called by the browser after sign-in)
create or replace function public.claim_player() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.players set user_id = auth.uid()
   where lower(email) = lower(auth.jwt() ->> 'email') and (user_id is null or user_id = auth.uid());
  return exists(select 1 from public.players where user_id = auth.uid());
end $$;

create or replace function public.is_player() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.players where user_id = auth.uid())
$$;

-- 2. each player's own career saves (slot '1' / '2', same as the game's two profile slots) --------------------
create table if not exists public.saves (
  user_id    uuid not null references auth.users(id) on delete cascade,
  slot       text not null check (slot in ('1','2')),
  data       text not null,            -- the game's save string (plain JSON or its compressed form)
  game_ver   text,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);
alter table public.saves enable row level security;
drop policy if exists saves_own on public.saves;
create policy saves_own on public.saves for all
  using (user_id = auth.uid() and public.is_player())
  with check (user_id = auth.uid() and public.is_player());

-- 3. the shared world both players enter (step 2 will fill this; readable and writable by players only) -------
create table if not exists public.world_state (
  id         text primary key default 'main',
  data       jsonb not null default '{}'::jsonb,
  version    bigint not null default 0,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.world_state enable row level security;
drop policy if exists world_players on public.world_state;
create policy world_players on public.world_state for all using (public.is_player()) with check (public.is_player());
insert into public.world_state(id) values ('main') on conflict do nothing;

-- 4. AI calls: model, tokens, estimated cost (written by the Worker with the service role; players read their own) --
create table if not exists public.ai_usage (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null,         -- npc | article | judgment | case
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd      numeric(12,6) not null default 0,
  ok            boolean not null default true,
  reason        text,
  ms            integer,
  created_at    timestamptz not null default now()
);
create index if not exists ai_usage_user_day on public.ai_usage(user_id, created_at);
alter table public.ai_usage enable row level security;
drop policy if exists ai_usage_read_own on public.ai_usage;
create policy ai_usage_read_own on public.ai_usage for select using (user_id = auth.uid());

-- today's calls and cost for one player (Korean date), used by the Worker for the daily limit
create or replace function public.ai_usage_today(uid uuid) returns table(calls bigint, usd numeric)
language sql stable security definer set search_path = public as $$
  select count(*), coalesce(sum(cost_usd),0) from public.ai_usage
   where user_id = uid and created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
$$;
revoke all on function public.ai_usage_today(uuid) from public, anon, authenticated;
