-- Migration 038 (2026-11-08): Terra drafts reach the case pool.
-- The Worker's daily refill stages one draft at a time (005, cost caps in 004). A separate job (GitHub Action
-- terra-pull, service key in GitHub Secrets) takes drafts that wait for QA, runs the six-tab browser QA outside the
-- Worker, and either publishes a passing draft as a world sheet in the repository (it then joins every player's pool
-- through the normal build) or quarantines it. A published or quarantined draft no longer counts as pending, so the
-- refill makes the next one — a steady trickle within the daily cap.
-- Needs 005. Service role only; no browser role ever sees a draft.

do $check$ begin
 if to_regclass('public.terra_pending_drafts') is null then
  raise exception '038: Terra 초안 표가 없습니다. 먼저 003_case_stock.sql, 004_case_refill_budget.sql, 005_terra_private_staging.sql을 순서대로 실행하세요.';
 end if;
 if to_regprocedure('public.request_role()') is null then
  raise exception '038: request_role 함수가 없습니다. 먼저 032_request_role_claims.sql을 실행하세요.';
 end if;
end $check$;

alter table public.terra_pending_drafts drop constraint if exists terra_pending_drafts_state_check;
alter table public.terra_pending_drafts add constraint terra_pending_drafts_state_check
 check (state in ('qa_pending','audit','quarantine','verified','published'));
alter table public.terra_pending_drafts add column if not exists decided_at timestamptz;
alter table public.terra_pending_drafts add column if not exists qa_note text check (qa_note is null or length(qa_note) <= 300);

create or replace function public.terra_take_drafts(p_limit integer default 2)
returns table(id text, category text, sheet jsonb, sheet_hash text)
language plpgsql security definer set search_path = public as $$
begin
 if public.request_role() is distinct from 'service_role'
 then raise exception 'service_only' using errcode = '42501'; end if;
 return query select d.id, d.category, d.sheet, d.sheet_hash from public.terra_pending_drafts d
  where d.state = 'qa_pending' order by d.created_at limit greatest(1, least(coalesce(p_limit,2), 5));
end $$;

create or replace function public.terra_mark_draft(p_id text, p_state text, p_note text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
 if public.request_role() is distinct from 'service_role'
 then raise exception 'service_only' using errcode = '42501'; end if;
 if p_state not in ('published','quarantine') then raise exception 'invalid_state'; end if;
 update public.terra_pending_drafts set state = p_state, decided_at = now(), qa_note = left(p_note, 300)
  where id = p_id and state = 'qa_pending';
 return found;
end $$;

revoke all on function public.terra_take_drafts(integer) from public, anon, authenticated;
revoke all on function public.terra_mark_draft(text,text,text) from public, anon, authenticated;
grant execute on function public.terra_take_drafts(integer) to service_role;
grant execute on function public.terra_mark_draft(text,text,text) to service_role;
