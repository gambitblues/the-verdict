-- v8.7.4: the server-only guards in 003–031 read current_setting('request.jwt.claim.role'). PostgREST sets that
-- per-claim setting only on PostgreSQL < 14; on Supabase (PostgreSQL 15+) only the JSON setting request.jwt.claims is
-- set, so every guarded RPC refused the Worker with 'service_only'. This migration adds one helper that reads both
-- forms and rewrites the guard inside every existing public function to use it. Grants, SECURITY DEFINER and
-- search_path are kept (CREATE OR REPLACE from the function's own definition). Safe to run again.
begin;
create or replace function public.request_role() returns text
language sql stable set search_path=public as $$
 select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
                 (nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'role'))
$$;
revoke all on function public.request_role() from public;
grant execute on function public.request_role() to anon,authenticated,service_role;

do $rewrite$
declare f record; def text; n int:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace s on s.oid=p.pronamespace
          where s.nspname='public' and p.proname<>'request_role'
            and p.prosrc like '%request.jwt.claim.role%' loop
  def:=pg_get_functiondef(f.oid);
  def:=replace(def,$q$current_setting('request.jwt.claim.role',true)$q$,'public.request_role()');
  def:=replace(def,$q$current_setting('request.jwt.claim.role', true)$q$,'public.request_role()');
  execute def;n:=n+1;
 end loop;
 if exists(select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace
           where s.nspname='public' and p.proname<>'request_role' and p.prosrc like '%request.jwt.claim.role%')
 then raise exception 'request_role_rewrite_incomplete'; end if;
 raise notice 'request_role: % functions now read request.jwt.claims', n;
end $rewrite$;
commit;
