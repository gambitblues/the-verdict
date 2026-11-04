-- v8.7.4 P5 three-judge panel rules: the panel can always reach one lawful verdict, nobody can stall it for good.
--
--  1. Ballots must fit the case (criminal / civil / decision choices only).
--  2. Rounds: after all three opinions are in, the two human judges see every opinion and its reasons (합의실) and
--     either one may open a new round (up to 3) to revise and resubmit. Earlier rounds stay as an immutable record.
--  3. No majority (three different opinions): 법원조직법 제66조 제2항 — starting from the opinion most favourable to the
--     defendant (civil: the largest amount), opinions are added in order until a majority is reached; the opinion
--     that completes the majority is the panel's (with three judges: the middle opinion). The chair alone can never
--     change the result: the judgment gate checks the outcome of the current round.
--  4. 변론 종결: once a ballot exists, the court record is closed — no new hearing and no new court action — so the
--     evidence the opinions rest on cannot change under them.
--  5. Absence: the associate may abstain, or, after a waiting time (at least 24h, set by the Worker) the presiding
--     judge may seat a substitute judge for an associate who has not voted in the current round. The substitute's
--     opinion is given by the server like the NPC judge's. A substituted associate earns no career record for the case.
-- After 001..033. Safe to run again.
begin;

alter table public.shared_joint_panels add column if not exists round integer not null default 1;
alter table public.shared_joint_panels add column if not exists round_started_at timestamptz not null default now();
alter table public.shared_joint_panels add column if not exists substituted text;
do $c$ begin
 if not exists(select 1 from pg_constraint where conname='shared_joint_panels_round_range') then
  alter table public.shared_joint_panels add constraint shared_joint_panels_round_range check(round between 1 and 3); end if;
 if not exists(select 1 from pg_constraint where conname='shared_joint_panels_substituted_seat') then
  alter table public.shared_joint_panels add constraint shared_joint_panels_substituted_seat check(substituted is null or substituted='peer'); end if;
end $c$;

alter table public.shared_joint_votes add column if not exists round integer not null default 1;
do $k$ declare k text;
begin
 select conname into k from pg_constraint where conrelid='public.shared_joint_votes'::regclass and contype='p'
  and not exists(select 1 from unnest(conkey) a join pg_attribute t on t.attrelid=conrelid and t.attnum=a where t.attname='round');
 if k is not null then
  execute format('alter table public.shared_joint_votes drop constraint %I',k);
  alter table public.shared_joint_votes add primary key(case_id,seat,round);
 end if;
 for k in select conname from pg_constraint where conrelid='public.shared_joint_votes'::regclass and contype='c'
   and pg_get_constraintdef(oid) ilike '%actor_id IS NULL%' and conname<>'shared_joint_votes_actor_seat' loop
  execute format('alter table public.shared_joint_votes drop constraint %I',k);
 end loop;
 if not exists(select 1 from pg_constraint where conname='shared_joint_votes_actor_seat') then
  -- the associate seat may be filled by a substitute judge (no account); the function checks when that is allowed
  alter table public.shared_joint_votes add constraint shared_joint_votes_actor_seat
   check((seat='chair' and actor_id is not null) or (seat='npc' and actor_id is null) or seat='peer');
 end if;
 if not exists(select 1 from pg_constraint where conname='shared_joint_votes_round_range') then
  alter table public.shared_joint_votes add constraint shared_joint_votes_round_range check(round between 1 and 3); end if;
end $k$;

-- order of opinions from the most favourable to the defendant (civil: the smallest amount to the plaintiff)
create or replace function public.shared_joint_rank(p_choice text) returns integer
language sql immutable as $$
 select case p_choice when 'acquittal' then 0 when 'claim_denied' then 0 when 'decision_no' then 0
  when 'settled' then 1 when 'decision_yes' then 1 when 'partial' then 2 when 'guilty' then 3 when 'claim_granted' then 3 end
$$;
create or replace function public.shared_joint_choices(p_case text) returns text[]
language sql stable security definer set search_path=public as $$
 select case s.sheet #>> '{card,kind}'
  when 'criminal' then array['guilty','acquittal','partial']
  when 'civil' then array['claim_granted','claim_denied','partial','settled']
  when 'decision' then array['decision_yes','decision_no'] else array[]::text[] end
 from public.case_stock s where s.case_id=p_case
$$;

create or replace function public.shared_joint_outcome(p_case text)
returns table(complete boolean,choice text,rule text,round integer)
language plpgsql stable security definer set search_path=public as $$
declare p public.shared_joint_panels%rowtype; n integer; top text; topn integer; mid text;
begin
 select * into p from public.shared_joint_panels where case_id=p_case;
 if not found then return; end if;
 select count(*) into n from public.shared_joint_votes v where v.case_id=p_case and v.round=p.round;
 if n<3 then return query select false,null::text,null::text,p.round; return; end if;
 select v.choice,count(*) into top,topn from public.shared_joint_votes v
  where v.case_id=p_case and v.round=p.round group by v.choice order by count(*) desc,v.choice limit 1;
 if topn>=2 then return query select true,top,'majority'::text,p.round; return; end if;
 -- 법원조직법 66②: add opinions from the most favourable until a majority (2 of 3) — the second one completes it
 select v.choice into mid from public.shared_joint_votes v where v.case_id=p_case and v.round=p.round
  order by public.shared_joint_rank(v.choice),v.seat offset 1 limit 1;
 return query select true,mid,'article66'::text,p.round;
end $$;

create or replace function public.shared_joint_vote(
 p_case text,p_actor uuid,p_seat text,p_choice text,p_hash text,p_note text default ''
) returns boolean language plpgsql security definer set search_path=public as $$
declare panel public.shared_joint_panels%rowtype; prev public.shared_joint_votes%rowtype;
begin
 if public.request_role() is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_note is null or length(p_note)>1000
  or not (p_choice = any(public.shared_joint_choices(p_case)))
 then raise exception 'invalid_joint_vote'; end if;
 perform pg_advisory_xact_lock(hashtextextended('joint:'||p_case,0));
 select * into panel from public.shared_joint_panels where case_id=p_case for update;
 if not found or panel.state<>'deliberating' then raise exception 'panel_closed'; end if;
 if exists(select 1 from public.shared_case_judgments where case_id=p_case) then raise exception 'case_already_decided'; end if;
 if p_seat not in ('chair','peer','npc')
 or (p_seat='chair' and p_actor is distinct from panel.chair_id)
 or (p_seat='peer' and panel.substituted is null and p_actor is distinct from panel.peer_id)
 or (p_seat='peer' and panel.substituted='peer' and p_actor is not null)
 or (p_seat='npc' and p_actor is not null)
 then raise exception 'not_panel_member' using errcode='42501'; end if;
 if p_seat='npc' and (select count(*) from public.shared_joint_votes
  where case_id=p_case and round=panel.round and seat in ('chair','peer'))<2
 then raise exception 'human_votes_pending'; end if;
 select * into prev from public.shared_joint_votes where case_id=p_case and seat=p_seat and round=panel.round;
 if found then
  if prev.choice is distinct from p_choice or prev.evidence_hash is distinct from p_hash
   or prev.private_note is distinct from p_note then raise exception 'vote_conflict'; end if;
  return false;
 end if;
 insert into public.shared_joint_votes(case_id,seat,actor_id,choice,evidence_hash,private_note,round)
 values(p_case,p_seat,p_actor,p_choice,p_hash,p_note,panel.round);
 return true;
end $$;

-- one evidence snapshot per round
create or replace function public.shared_joint_vote_snapshot_guard() returns trigger
language plpgsql set search_path=public as $$
declare frozen_hash text;
begin
 select evidence_hash into frozen_hash from public.shared_joint_votes
 where case_id=new.case_id and round=new.round order by seat limit 1;
 if frozen_hash is not null and frozen_hash<>new.evidence_hash
 then raise exception 'joint_evidence_snapshot_changed'; end if;
 return new;
end $$;

create or replace function public.shared_joint_status(p_case text,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare panel public.shared_joint_panels%rowtype; own text; total integer; o record; tally jsonb; opinions jsonb; prior jsonb;
        my_seat text;
begin
 if public.request_role() is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 select * into panel from public.shared_joint_panels where case_id=p_case;
 if not found then raise exception 'panel_not_found'; end if;
 if p_actor=panel.chair_id then my_seat:='chair'; elsif p_actor=panel.peer_id then my_seat:='peer';
 else raise exception 'not_panel_member' using errcode='42501'; end if;
 select choice into own from public.shared_joint_votes where case_id=p_case and seat=my_seat and round=panel.round;
 select count(*) into total from public.shared_joint_votes where case_id=p_case and round=panel.round;
 -- earlier rounds were already seen by everyone in the deliberation room
 select coalesce(jsonb_agg(jsonb_build_object('round',v.round,'seat',v.seat,'choice',v.choice,'note',v.private_note) order by v.round,v.seat),'[]'::jsonb)
  into prior from public.shared_joint_votes v where v.case_id=p_case and v.round<panel.round;
 if total<3 then return jsonb_build_object(
  'state','deliberating','round',panel.round,'maxRounds',3,'votesCast',total,'myVote',own,'majority',null,
  'substituted',panel.substituted,'roundStartedAt',panel.round_started_at,
  'pending',(select coalesce(jsonb_agg(s),'[]'::jsonb) from unnest(array['chair','peer','npc']) s
    where not exists(select 1 from public.shared_joint_votes v where v.case_id=p_case and v.round=panel.round and v.seat=s)),
  'previous',prior); end if;
 select * into o from public.shared_joint_outcome(p_case);
 select jsonb_object_agg(choice,n) into tally from (select choice,count(*)::integer n from public.shared_joint_votes
   where case_id=p_case and round=panel.round group by choice) x;
 select jsonb_agg(jsonb_build_object('seat',v.seat,'choice',v.choice,'note',v.private_note) order by v.seat) into opinions
  from public.shared_joint_votes v where v.case_id=p_case and v.round=panel.round;
 return jsonb_build_object('state','majority_ready','round',panel.round,'maxRounds',3,'votesCast',3,'myVote',own,
  'majority',o.choice,'rule',o.rule,'tally',tally,'opinions',opinions,'previous',prior,'substituted',panel.substituted,
  'canReopen',panel.round<3 and (my_seat='chair' or panel.substituted is null));
end $$;

-- a human judge asks the panel to deliberate again: everyone resubmits in a new round (up to 3 rounds)
create or replace function public.shared_joint_reopen(p_case text,p_actor uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare panel public.shared_joint_panels%rowtype;
begin
 if public.request_role() is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('joint:'||p_case,0));
 select * into panel from public.shared_joint_panels where case_id=p_case for update;
 if not found or not (p_actor=panel.chair_id or (p_actor=panel.peer_id and panel.substituted is null))
 then raise exception 'not_panel_member' using errcode='42501'; end if;
 if exists(select 1 from public.shared_case_judgments where case_id=p_case) then raise exception 'case_already_decided'; end if;
 if (select count(*) from public.shared_joint_votes where case_id=p_case and round=panel.round)<3
 then raise exception 'round_not_complete'; end if;
 if panel.round>=3 then raise exception 'max_rounds_reached'; end if;
 update public.shared_joint_panels set round=panel.round+1,round_started_at=now() where case_id=p_case;
 return panel.round+1;
end $$;

-- the associate steps aside (기권): a substitute judge takes the seat from now on
create or replace function public.shared_joint_abstain(p_case text,p_actor uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare panel public.shared_joint_panels%rowtype;
begin
 if public.request_role() is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('joint:'||p_case,0));
 select * into panel from public.shared_joint_panels where case_id=p_case for update;
 if not found or p_actor is distinct from panel.peer_id then raise exception 'not_panel_member' using errcode='42501'; end if;
 if exists(select 1 from public.shared_case_judgments where case_id=p_case) then raise exception 'case_already_decided'; end if;
 if panel.substituted='peer' then return false; end if;
 if exists(select 1 from public.shared_joint_votes where case_id=p_case and round=panel.round and seat='peer')
 then raise exception 'already_voted'; end if;
 update public.shared_joint_panels set substituted='peer' where case_id=p_case;
 return true;
end $$;

-- the presiding judge seats a substitute for an associate who has not voted after the waiting time
create or replace function public.shared_joint_substitute(p_case text,p_actor uuid,p_wait_hours integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare panel public.shared_joint_panels%rowtype;
begin
 if public.request_role() is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('joint:'||p_case,0));
 select * into panel from public.shared_joint_panels where case_id=p_case for update;
 if not found or p_actor is distinct from panel.chair_id then raise exception 'chair_required' using errcode='42501'; end if;
 if exists(select 1 from public.shared_case_judgments where case_id=p_case) then raise exception 'case_already_decided'; end if;
 if panel.substituted='peer' then return false; end if;
 if exists(select 1 from public.shared_joint_votes where case_id=p_case and round=panel.round and seat='peer')
 then raise exception 'associate_already_voted'; end if;
 if not exists(select 1 from public.shared_joint_votes where case_id=p_case and round=panel.round and seat='chair')
 then raise exception 'chair_vote_first'; end if;
 if now()-panel.round_started_at < make_interval(hours=>greatest(coalesce(p_wait_hours,72),24))
 then raise exception 'waiting_time_not_over'; end if;
 update public.shared_joint_panels set substituted='peer' where case_id=p_case;
 return true;
end $$;

-- the judgment the chair publishes must be the panel's outcome in the current round
create or replace function public.shared_joint_judgment_gate() returns trigger
language plpgsql set search_path=public as $$
declare panel public.shared_joint_panels%rowtype; total_count integer; snapshots integer; o record;
begin
 select * into panel from public.shared_joint_panels where case_id=new.case_id for update;
 if not found then return new; end if;
 if new.judge_id is distinct from panel.chair_id
 then raise exception 'joint_judgment_chair_required' using errcode='42501'; end if;
 select count(*),count(distinct evidence_hash) into total_count,snapshots
 from public.shared_joint_votes where case_id=new.case_id and round=panel.round;
 if total_count<>3 or snapshots<>1 then raise exception 'joint_votes_incomplete'; end if;
 select * into o from public.shared_joint_outcome(new.case_id);
 if not o.complete then raise exception 'joint_further_deliberation_required'; end if;
 if o.choice is distinct from new.result then raise exception 'joint_verdict_mismatch'; end if;
 return new;
end $$;

-- 변론 종결: once the first opinion is in, the record the opinions rest on is closed
create or replace function public.shared_joint_record_closed() returns trigger
language plpgsql set search_path=public as $$
begin
 if exists(select 1 from public.shared_joint_votes v where v.case_id=new.case_id)
 then raise exception 'deliberation_started' using errcode='42501'; end if;
 return new;
end $$;
drop trigger if exists shared_joint_actions_closed on public.shared_court_actions;
create trigger shared_joint_actions_closed before insert on public.shared_court_actions
 for each row execute function public.shared_joint_record_closed();
drop trigger if exists shared_joint_hearings_closed on public.shared_judge_hearings;
create trigger shared_joint_hearings_closed before insert on public.shared_judge_hearings
 for each row execute function public.shared_joint_record_closed();

-- a substituted associate did not take part: no career record for them
do $r$ declare def text;
begin
 select pg_get_functiondef('public.shared_career_event_write()'::regprocedure) into def;
 if def is not null and position('substituted' in def)=0 then
  def:=replace(def,'if peer is not null then',
   'if peer is not null and not exists(select 1 from public.shared_joint_panels sp where sp.case_id=new.case_id and sp.substituted=''peer'') then');
  execute def;
 end if;
end $r$;

revoke all on function public.shared_joint_rank(text) from public;
grant execute on function public.shared_joint_rank(text) to service_role,authenticated,anon;
revoke all on function public.shared_joint_choices(text) from public,anon,authenticated;
revoke all on function public.shared_joint_outcome(text) from public,anon,authenticated;
revoke all on function public.shared_joint_reopen(text,uuid) from public,anon,authenticated;
revoke all on function public.shared_joint_abstain(text,uuid) from public,anon,authenticated;
revoke all on function public.shared_joint_substitute(text,uuid,integer) from public,anon,authenticated;
grant execute on function public.shared_joint_choices(text) to service_role;
grant execute on function public.shared_joint_outcome(text) to service_role;
grant execute on function public.shared_joint_reopen(text,uuid) to service_role;
grant execute on function public.shared_joint_abstain(text,uuid) to service_role;
grant execute on function public.shared_joint_substitute(text,uuid,integer) to service_role;
commit;
