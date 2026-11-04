-- Migration 035: each invited player may permanently reset only their own careers.
-- This function never deletes users, public.players, AI usage, shared world, or another user's saves.
create or replace function public.reset_player_career()
returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_player() then
    raise exception 'not_player' using errcode = '42501';
  end if;
  -- Lock this user's rows, so in-flight save_put and reset serialize at the database level.
  perform 1 from public.saves where user_id = uid for update;
  delete from public.save_backups where user_id = uid;
  delete from public.saves where user_id = uid;
  return true;
end $$;
revoke all on function public.reset_player_career() from public, anon;
grant execute on function public.reset_player_career() to authenticated;
