-- P3-15: server-only single-run lease and daily AI production reservations.
-- Apply manually after 003_case_stock.sql; NOT auto-deployed.
begin;
create table if not exists public.case_refill_lease(
  id text primary key check(id='global'),
  run_id text not null,
  token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.case_refill_budget(
  id bigserial primary key,
  run_id text not null,
  lease_token text not null,
  category text not null,
  reserved_usd numeric(12,6) not null check(reserved_usd>0),
  reserved_calls integer not null check(reserved_calls between 1 and 10),
  actual_usd numeric(12,6),
  actual_calls integer,
  state text not null default 'reserved' check(state in ('reserved','closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists case_refill_budget_day_idx on public.case_refill_budget(created_at);
alter table public.case_refill_lease enable row level security;
alter table public.case_refill_budget enable row level security;
revoke all on public.case_refill_lease,public.case_refill_budget from public,anon,authenticated;
grant select,insert,update on public.case_refill_lease,public.case_refill_budget to service_role;
grant usage,select on sequence public.case_refill_budget_id_seq to service_role;

create or replace function public.refill_lease_claim(p_run text,p_token text,p_seconds int default 1800)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_run !~ '^refill-[a-z0-9-]{6,80}$' or length(coalesce(p_token,''))<24 or p_seconds not between 60 and 3600
 then raise exception 'bad_lease'; end if;
 insert into public.case_refill_lease(id,run_id,token,expires_at)
 values('global',p_run,p_token,now()+make_interval(secs=>p_seconds))
 on conflict(id) do update set run_id=excluded.run_id,token=excluded.token,
  expires_at=excluded.expires_at,updated_at=now()
 where public.case_refill_lease.expires_at<now();
 return found;
end $$;

create or replace function public.refill_budget_reserve(
 p_run text,p_token text,p_category text,p_usd numeric,p_calls int,
 p_max_day_usd numeric,p_max_day_calls int
) returns bigint language plpgsql security definer set search_path=public as $$
declare spent numeric;call_count bigint;new_id bigint;
 day_start timestamptz:=(date_trunc('day',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 -- Concurrent callers serialize on one lock, not on a client-provided daily total.
 perform pg_advisory_xact_lock(hashtext('verdict:refill:budget'));
 if not exists(select 1 from public.case_refill_lease
   where id='global' and run_id=p_run and token=p_token and expires_at>now()) then
  raise exception 'lease_missing' using errcode='42501';
 end if;
 if p_category not in ('homicide','sexual','violence','financial','property','reputation','civil','family','professional','public')
   or p_usd is null or p_usd<=0 or p_calls is null or p_calls<2 or p_calls>10
   or p_max_day_usd is null or p_max_day_usd<=0 or p_max_day_usd>1000
   or p_max_day_calls is null or p_max_day_calls<2 or p_max_day_calls>10000
 then raise exception 'invalid_budget'; end if;
 select coalesce(sum(case when state='reserved' then reserved_usd else greatest(reserved_usd,coalesce(actual_usd,reserved_usd)) end),0),
        coalesce(sum(case when state='reserved' then reserved_calls else greatest(reserved_calls,coalesce(actual_calls,reserved_calls)) end),0)
 into spent,call_count from public.case_refill_budget where created_at>=day_start;
 if spent+p_usd>p_max_day_usd or call_count+p_calls>p_max_day_calls then return null;end if;
 insert into public.case_refill_budget(run_id,lease_token,category,reserved_usd,reserved_calls)
 values(p_run,p_token,p_category,p_usd,p_calls) returning id into new_id;
 return new_id;
end $$;

create or replace function public.refill_budget_close(
 p_id bigint,p_run text,p_token text,p_actual_usd numeric,p_actual_calls int
) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_actual_usd is null or p_actual_usd<0 or p_actual_calls is null or p_actual_calls<0 then raise exception 'bad_actual';end if;
 update public.case_refill_budget
 set state='closed',actual_usd=p_actual_usd,actual_calls=p_actual_calls,closed_at=now()
 where id=p_id and run_id=p_run and lease_token=p_token and state='reserved';
 return found;
end $$;

create or replace function public.refill_lease_release(p_run text,p_token text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 delete from public.case_refill_lease where id='global' and run_id=p_run and token=p_token;
 return found;
end $$;
revoke all on function public.refill_lease_claim(text,text,int) from public,anon,authenticated;
revoke all on function public.refill_budget_reserve(text,text,text,numeric,int,numeric,int) from public,anon,authenticated;
revoke all on function public.refill_budget_close(bigint,text,text,numeric,int) from public,anon,authenticated;
revoke all on function public.refill_lease_release(text,text) from public,anon,authenticated;
grant execute on function public.refill_lease_claim(text,text,int) to service_role;
grant execute on function public.refill_budget_reserve(text,text,text,numeric,int,numeric,int) to service_role;
grant execute on function public.refill_budget_close(bigint,text,text,numeric,int) to service_role;
grant execute on function public.refill_lease_release(text,text) to service_role;
create or replace function public.refill_budget_snapshot()
returns table(used_usd numeric,used_calls bigint)
language plpgsql security definer set search_path=public as $
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 return query
 select coalesce(sum(greatest(reserved_usd,coalesce(actual_usd,reserved_usd))),0),
        coalesce(sum(greatest(reserved_calls,coalesce(actual_calls,reserved_calls))),0)
 from public.case_refill_budget
 where created_at >= (date_trunc('day',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
end $;
revoke all on function public.refill_budget_snapshot() from public,anon,authenticated;
grant execute on function public.refill_budget_snapshot() to service_role;
commit;
