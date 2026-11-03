-- THE VERDICT P0: explicit, idempotent PostgREST privileges.
-- Apply after 001_init.sql. The Worker needs to read the invite list and account for AI usage.
-- Does not alter existing rows, change user identities, or disable RLS.
begin;

grant usage on schema public to authenticated, service_role;

-- Never expose invite data to regular browser accounts; only the Worker service role reads it.
revoke all on table public.players from anon, authenticated;
grant select on table public.players to service_role;

-- Browser: read own saves/backups/world through existing RLS; saves can only be written via save_put().
grant select on table public.saves, public.save_backups, public.world_state to authenticated;
revoke insert, update, delete on table public.saves, public.save_backups, public.world_state from authenticated;
revoke all on table public.world_secrets from anon, authenticated;

-- Worker uses the service key for usage rows and shared-world management.
grant select, insert, update on table public.ai_usage to service_role;
grant select, insert, update on table public.world_state to service_role;
grant select, insert, update, delete on table public.world_secrets to service_role;
grant usage, select on sequence public.ai_usage_id_seq to service_role;

-- Authenticated users may see only their own usage via the existing RLS policy.
grant select on table public.ai_usage to authenticated;
revoke insert, update, delete on table public.ai_usage from authenticated;

-- Keep privileged AI RPC functions inaccessible to client JWTs.
revoke all on function public.ai_reserve(uuid,text,text,numeric,int,numeric) from public, anon, authenticated;
revoke all on function public.ai_finish(bigint,text,int,int,numeric,boolean,text,int) from public, anon, authenticated;
revoke all on function public.ai_usage_today(uuid) from public, anon, authenticated;
grant execute on function public.ai_reserve(uuid,text,text,numeric,int,numeric) to service_role;
grant execute on function public.ai_finish(bigint,text,int,int,numeric,boolean,text,int) to service_role;
grant execute on function public.ai_usage_today(uuid) to service_role;

commit;
