-- P5: private deliberation for two existing invited judges and one NPC.
-- QA-only migration after 019; no new accounts or save changes.
begin;
create table if not exists public.shared_joint_panels(
 case_id text primary key references public.case_stock(case_id),
 chair_id uuid not null references auth.users(id),
 peer_id uuid not null references auth.users(id),
 npc_id text not null references public.shared_npc_public(npc_id),
 state text not null default 'deliberating'
  check(state in ('deliberating','majority_ready','further_deliberation')),
 check(chair_id<>peer_id)
);
create table if not exists public.shared_joint_votes(
 case_id text not null references public.shared_joint_panels(case_id),
 seat text not null check(seat in ('chair','peer','npc')),
 actor_id uuid references auth.users(id),
 choice text not null check(choice in
 ('guilty','acquittal','partial','claim_granted','claim_denied','settled','decision_yes','decision_no')),
 evidence_hash text not null check(evidence_hash ~ '^[a-f0-9]{64}$'),
 private_note text not null default '' check(length(private_note)<=1000),
 primary key(case_id,seat),
 check((seat='npc' and actor_id is null) or (seat<>'npc' and actor_id is not null))
);
alter table public.shared_joint_panels enable row level security;
alter table public.shared_joint_votes enable row level security;
revoke all on public.shared_joint_panels,public.shared_joint_votes from public,anon,authenticated;
grant select,insert,update on public.shared_joint_panels to service_role;
grant select,insert on public.shared_joint_votes to service_role;
commit;
