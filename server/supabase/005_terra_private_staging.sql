-- P3-16. Apply manually after 003 + 004. Private generated drafts only.
-- Hidden worlds must NEVER be exposed through an authenticated browser role.
begin;
create table if not exists public.terra_pending_drafts(
 id text primary key check(id ~ '^[a-z][a-z0-9-]{3,79}$'),
 category text not null check(category in ('homicide','sexual','violence','financial','property','reputation','civil','family','professional','public')),
 candidate jsonb not null,
 sheet jsonb not null,
 candidate_hash text not null check(candidate_hash ~ '^[0-9a-f]{64}$'),
 sheet_hash text not null check(sheet_hash ~ '^[0-9a-f]{64}$'),
 state text not null default 'qa_pending' check(state in ('qa_pending','audit','quarantine','verified')),
 created_at timestamptz not null default now()
);
create index if not exists terra_pending_state_idx on public.terra_pending_drafts(category,state);
alter table public.terra_pending_drafts enable row level security;
revoke all on public.terra_pending_drafts from public,anon,authenticated;
grant select,insert,update to service_role on public.terra_pending_drafts;

create or replace function public.terra_pending_counts()
returns jsonb language plpgsql security definer set search_path=public as $$
declare outcome jsonb;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501';end if;
 select coalesce(jsonb_object_agg(category,cnt),'{}'::jsonb) into outcome from
 (select category,count(*) as cnt from public.terra_pending_drafts
  where state in ('qa_pending','audit','verified') group by category) s;
 return outcome;
end $$;

create or replace function public.terra_stage_draft(
 p_id text,p_category text,p_candidate jsonb,p_sheet jsonb,
 p_candidate_hash text,p_sheet_hash text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501';end if;
 if p_candidate->>'id' is distinct from p_id or p_sheet->>'id' is distinct from p_id
 or p_candidate->>'status' is distinct from 'draft'
 or p_sheet->>'status' is distinct from 'draft'
 or p_candidate->>'format' is distinct from 'verdict-terra-candidate/v1'
 or p_sheet->>'format' is distinct from 'verdict-world-sheet/v1'
 or p_candidate->'card'->>'category' is distinct from p_category
 or p_sheet->'card'->>'category' is distinct from p_category
 then raise exception 'invalid draft';end if;
 insert into public.terra_pending_drafts(id,category,candidate,sheet,candidate_hash,sheet_hash)
 values(p_id,p_category,p_candidate,p_sheet,p_candidate_hash,p_sheet_hash)
 on conflict do nothing;
 return found;
end $$;

revoke all on function public.terra_pending_counts() from public,anon,authenticated;
revoke all on function public.terra_stage_draft(text,text,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.terra_pending_counts() to service_role;
grant execute on function public.terra_stage_draft(text,text,jsonb,jsonb,text,text) to service_role;
commit;
