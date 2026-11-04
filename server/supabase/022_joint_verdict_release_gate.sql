-- P5 release gate and immutable evidence snapshot for the three-judge bench.
-- Apply only on isolated QA after 021.
begin;
create or replace function public.shared_joint_vote_snapshot_guard() returns trigger
language plpgsql set search_path=public as $$
declare frozen_hash text;
begin
 select evidence_hash into frozen_hash from public.shared_joint_votes
 where case_id=new.case_id order by seat limit 1;
 if frozen_hash is not null and frozen_hash<>new.evidence_hash
 then raise exception 'joint_evidence_snapshot_changed'; end if;
 return new;
end $$;
drop trigger if exists shared_joint_vote_snapshot_guard on public.shared_joint_votes;
create trigger shared_joint_vote_snapshot_guard before insert on public.shared_joint_votes
 for each row execute function public.shared_joint_vote_snapshot_guard();

create or replace function public.shared_joint_judgment_gate() returns trigger
language plpgsql set search_path=public as $$
declare panel public.shared_joint_panels%rowtype;
        total_count integer; winning integer; decided text; snapshots integer;
begin
 select * into panel from public.shared_joint_panels where case_id=new.case_id for update;
 if not found then return new; end if;
 if new.judge_id is distinct from panel.chair_id
 then raise exception 'joint_judgment_chair_required' using errcode='42501'; end if;
 select count(*),count(distinct evidence_hash) into total_count,snapshots
 from public.shared_joint_votes where case_id=new.case_id;
 if total_count<>3 or snapshots<>1 then raise exception 'joint_votes_incomplete'; end if;
 select choice,count(*) into decided,winning from public.shared_joint_votes
 where case_id=new.case_id group by choice order by count(*) desc,choice limit 1;
 if winning<2 then raise exception 'joint_further_deliberation_required'; end if;
 if decided is distinct from new.result then raise exception 'joint_verdict_mismatch'; end if;
 return new;
end $$;
drop trigger if exists shared_joint_judgment_gate on public.shared_case_judgments;
create trigger shared_joint_judgment_gate before insert on public.shared_case_judgments
 for each row execute function public.shared_joint_judgment_gate();

create or replace function public.shared_joint_close_after_verdict() returns trigger
language plpgsql set search_path=public as $$
begin
 update public.shared_joint_panels set state='majority_ready' where case_id=new.case_id;
 return new;
end $$;
drop trigger if exists shared_joint_close_after_verdict on public.shared_case_judgments;
create trigger shared_joint_close_after_verdict after insert on public.shared_case_judgments
 for each row execute function public.shared_joint_close_after_verdict();
commit;
