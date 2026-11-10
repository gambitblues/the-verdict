-- Migration 039 (2026-11-10, planner decision): anyone who received an invite email and set a password can play.
-- Before: the game let a user in only when their email was also typed into public.players (and the Worker's
-- ALLOWED_EMAILS). Now the first sign-in of an invited account adds its own row to public.players, so inviting from the
-- Supabase dashboard (Authentication → Users → Invite user) is the only step.
-- Who counts as invited: an auth user with invited_at set (Supabase sets it when an invite email is sent), or someone
-- already on the list. A self sign-up account is never added, even if sign-ups were switched on by mistake.
-- Test accounts for the live check still need a 'TEST…' name row added by hand (is_test_player is unchanged).

create or replace function public.claim_player() returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if uid is null then return false; end if;
  -- an invite row typed in by hand (the old way) is linked on first sign-in, as before
  update public.players set user_id = uid where lower(email) = mail and user_id is null;
  if exists(select 1 from public.players where user_id = uid) then return true; end if;
  -- an invited account joins by itself
  if mail <> '' and exists(select 1 from auth.users u where u.id = uid and u.invited_at is not null) then
    insert into public.players(email, user_id, name)
      values (mail, uid, split_part(mail, '@', 1))
      on conflict (email) do update set user_id = excluded.user_id where public.players.user_id is null;
    return exists(select 1 from public.players where user_id = uid);
  end if;
  return false;
end $$;
revoke all on function public.claim_player() from public, anon;
grant execute on function public.claim_player() to authenticated;
