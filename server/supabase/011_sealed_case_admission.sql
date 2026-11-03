-- THE VERDICT P4-6: freeze one server-only truth branch before a case enters shared stock.
-- Apply only after 001,002,003,006,007,008,009,010 in an isolated QA database.
-- Existing single-player cases/saves are NOT migrated by this script.
begin;

-- Full world sheet stays service-only; clients never choose their own branch.
create or replace function public.shared_case_admit_sealed(
 p_id text,p_category text,p_sheet_hash text,p_candidate_hash text,
 p_fingerprint text,p_sheet jsonb,p_verification jsonb,p_branch text
) returns boolean
language plpgsql security definer set search_path=public as $$
declare admitted boolean; existing public.case_stock%rowtype;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_branch not in ('did','didnt','reason') or p_sheet->'worlds'->p_branch is null
 then raise exception 'missing_truth_branch'; end if;
 perform pg_advisory_xact_lock(hashtextextended('case-seal:'||p_id,0));
 admitted:=public.case_stock_admit(p_id,p_category,p_sheet_hash,p_candidate_hash,
   p_fingerprint,p_sheet,p_verification);
 if not admitted then
  select * into existing from public.case_stock where case_id=p_id;
  if not found or existing.sheet_hash is distinct from p_sheet_hash
    or existing.candidate_hash is distinct from p_candidate_hash
  then raise exception 'case_admission_conflict' using errcode='23505'; end if;
 end if;
 if exists(select 1 from public.world_secrets
           where case_id=p_id and truth->>'branch' is distinct from p_branch)
 then raise exception 'sealed_truth_conflict' using errcode='23505'; end if;
 insert into public.world_secrets(case_id,truth)
 values(p_id,jsonb_build_object('branch',p_branch,'sealedAt',now()))
 on conflict do nothing;
 return admitted;
end $$;
revoke all on function public.shared_case_admit_sealed(text,text,text,text,text,jsonb,jsonb,text)
 from public,anon,authenticated;
grant execute on function public.shared_case_admit_sealed(text,text,text,text,text,jsonb,jsonb,text)
 to service_role;

-- Even service-role updates cannot silently change the sealed objective world.
create or replace function public.shared_truth_immutable() returns trigger
language plpgsql as $$
begin raise exception 'sealed_truth_immutable' using errcode='42501'; end $$;
drop trigger if exists p4_truth_no_rewrite on public.world_secrets;
create trigger p4_truth_no_rewrite before update or delete
 on public.world_secrets for each row execute function public.shared_truth_immutable();

commit;
