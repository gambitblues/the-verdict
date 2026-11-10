-- Migration 041 (2026-11-10, planner request): a clean first save from now on.
-- The planner wants every career made so far put away so that the next sign-in starts a new game, and that new game is
-- the player's first save. Nothing is destroyed: the cloud saves and the kept backups move to trash tables that no
-- player can read; each game then puts its own device copies into a hidden trash in that browser on the next sign-in.
-- Run in the SQL Editor (database owner):
--   select public.fresh_start_players();                         -- every player
--   select public.fresh_start_players(array['a@x.kr','b@x.kr']);  -- only these accounts
-- Close the game on every device first: an open game notices within a minute and starts over, but a save it sends in
-- that minute would be the first save of the old career.

create table if not exists public.save_trash(
 id bigserial primary key, user_id uuid not null, slot text not null, data text not null, rev bigint, game_ver text,
 device text, updated_at timestamptz, moved_at timestamptz not null default now());
create table if not exists public.backup_trash(
 id bigserial primary key, user_id uuid not null, slot text not null, data text not null, rev bigint, game_ver text,
 device text, reason text, created_at timestamptz, moved_at timestamptz not null default now());
alter table public.save_trash enable row level security;
alter table public.backup_trash enable row level security;
revoke all on public.save_trash, public.backup_trash from public, anon, authenticated;

-- when this player's careers were put away; the game compares it with what it last applied on this device
create table if not exists public.fresh_starts(
 user_id uuid primary key references auth.users(id) on delete cascade,
 at timestamptz not null default now());
alter table public.fresh_starts enable row level security;
drop policy if exists fresh_starts_read_own on public.fresh_starts;
create policy fresh_starts_read_own on public.fresh_starts for select to authenticated using (user_id = auth.uid());
revoke all on public.fresh_starts from public, anon;
revoke insert, update, delete on public.fresh_starts from authenticated;
grant select on public.fresh_starts to authenticated;

create or replace function public.fresh_start_players(p_emails text[] default null)
returns text language plpgsql security definer set search_path = public, auth as $$
declare u record; n int := 0; s int := 0; b int := 0; c int;
begin
 for u in select p.user_id from public.players p
   where p.user_id is not null
     and (p_emails is null or lower(p.email) = any(select lower(btrim(x)) from unnest(p_emails) x))
 loop
  insert into public.save_trash(user_id,slot,data,rev,game_ver,device,updated_at)
   select user_id,slot,data,rev,game_ver,device,updated_at from public.saves where user_id = u.user_id;
  get diagnostics c = row_count; s := s + c;
  insert into public.backup_trash(user_id,slot,data,rev,game_ver,device,reason,created_at)
   select user_id,slot,data,rev,game_ver,device,reason,created_at from public.save_backups where user_id = u.user_id;
  get diagnostics c = row_count; b := b + c;
  delete from public.saves where user_id = u.user_id;
  delete from public.save_backups where user_id = u.user_id;
  insert into public.fresh_starts(user_id, at) values (u.user_id, now())
   on conflict (user_id) do update set at = now();
  n := n + 1;
 end loop;
 return format('새 출발 %s명 · 세이브 %s개·보관본 %s개를 trash로 옮김 (다음 접속 때 새 게임)', n, s, b);
end $$;
revoke all on function public.fresh_start_players(text[]) from public, anon, authenticated;
