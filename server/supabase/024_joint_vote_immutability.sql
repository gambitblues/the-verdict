-- P5 immutable private ballots, including privileged service-role maintenance.
-- QA-only migration after 023.
begin;
revoke all on public.shared_joint_votes from service_role;
grant select,insert on public.shared_joint_votes to service_role;
create or replace function public.shared_joint_vote_immutable() returns trigger
language plpgsql as $$
begin raise exception 'joint_vote_immutable' using errcode='42501'; end $$;
drop trigger if exists shared_joint_votes_no_rewrite on public.shared_joint_votes;
create trigger shared_joint_votes_no_rewrite before update or delete
 on public.shared_joint_votes for each row
 execute function public.shared_joint_vote_immutable();
commit;
