-- THE VERDICT P3-14: private case inventory and atomic, non-repeating assignment.
-- Apply manually AFTER 001_init.sql and 002_api_privileges.sql.
-- Production credentials remain server-side. This migration DOES NOT launch AI jobs.
begin;

create table if not exists public.case_stock (
  case_id text primary key check(case_id ~ '^[a-z][a-z0-9-]{3,79}$'),
  category text not null check(category in ('homicide','sexual','violence','financial','property','reputation','civil','family','professional','public')),
  sheet_hash text not null check(sheet_hash ~ '^[a-f0-9]{64}$'),
  candidate_hash text not null check(candidate_hash ~ '^[a-f0-9]{64}$'),
  fingerprint text not null unique,
  sheet jsonb not null,                   -- sealed truth; never exposed to player JWTs
  verification jsonb not null,            -- trusted, server-rechecked QA attestation
  state text not null default 'stock' check(state in ('stock','assigned','retired')),
  assigned_to uuid references auth.users(id),
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  check ((state='assigned' and assigned_to is not null and assigned_at is not null)
      or (state<>'assigned' and assigned_to is null and assigned_at is null))
);
create index if not exists case_stock_select on public.case_stock(category,created_at) where state='stock';
create index if not exists case_stock_judge on public.case_stock(assigned_to) where state='assigned';
alter table public.case_stock enable row level security;
revoke all on public.case_stock from public,anon,authenticated;
grant select,insert,update on public.case_stock to service_role;

-- Only a trusted service_role can admit fully validated sheets. This function
-- does not pretend to verify external browser test honesty: the backend must
-- independently validate the hash AND QA attestation before this call.
create or replace function public.case_stock_admit(
 p_id text,p_category text,p_sheet_hash text,p_candidate_hash text,
 p_fingerprint text,p_sheet jsonb,p_verification jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
  raise exception 'service_only' using errcode='42501';
 end if;
 if p_sheet is null or p_sheet->>'id' is distinct from p_id
    or p_sheet->>'format' is distinct from 'verdict-world-sheet/v1'
    or p_sheet->>'status' is distinct from 'draft'
    or p_sheet->'card'->>'category' is distinct from p_category
    or p_verification->>'decision' is distinct from 'stock'
    or p_verification->>'sheetHash' is distinct from p_sheet_hash
    or p_verification->>'candidateHash' is distinct from p_candidate_hash
    or p_verification->>'passed' is distinct from 'true'
 then raise exception 'unverified_sheet'; end if;
 insert into public.case_stock(case_id,category,sheet_hash,candidate_hash,fingerprint,sheet,verification)
 values(p_id,p_category,p_sheet_hash,p_candidate_hash,p_fingerprint,p_sheet,p_verification)
 on conflict do nothing;
 return found;
end $$;

-- One global case stock, not one copy per judge. FOR UPDATE SKIP LOCKED
-- prevents two simultaneous judges from receiving the same case.
-- Assignments are durable and never reset by subsequent offers.
create or replace function public.case_stock_assign(p_judge uuid,p_category text default null)
returns table(case_id text,category text,assigned_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare chosen text;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
  raise exception 'service_only' using errcode='42501';
 end if;
 if not exists(select 1 from public.players p where p.user_id=p_judge) then
  raise exception 'judge_not_invited' using errcode='42501';
 end if;
 select s.case_id into chosen from public.case_stock s
 where s.state='stock' and (p_category is null or s.category=p_category)
 order by s.created_at,s.case_id
 for update skip locked limit 1;
 if chosen is null then return; end if;
 return query update public.case_stock s
 set state='assigned',assigned_to=p_judge,assigned_at=now()
 where s.case_id=chosen and s.state='stock'
 returning s.case_id,s.category,s.assigned_at;
end $$;

revoke all on function public.case_stock_admit(text,text,text,text,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.case_stock_assign(uuid,text) from public,anon,authenticated;
grant execute on function public.case_stock_admit(text,text,text,text,text,jsonb,jsonb) to service_role;
grant execute on function public.case_stock_assign(uuid,text) to service_role;
commit;
