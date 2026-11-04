-- P5 secure service-only transitions; never create another test judge.
begin;
create or replace function public.shared_joint_open(
 p_case text,p_chair uuid,p_peer uuid,p_npc text
) returns boolean language plpgsql security definer set search_path=public as $$
declare existing public.shared_joint_panels%rowtype;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_chair is null or p_peer is null or p_chair=p_peer
 or not exists(select 1 from public.case_stock
  where case_id=p_case and assigned_to=p_chair and state='assigned')
 or not exists(select 1 from public.players where user_id=p_chair)
 or not exists(select 1 from public.players where user_id=p_peer)
 or not exists(select 1 from public.shared_npc_public where npc_id=p_npc and life_status='alive')
 then raise exception 'invalid_joint_panel' using errcode='42501'; end if;
 if exists(select 1 from public.shared_case_judgments where case_id=p_case)
 then raise exception 'case_already_decided'; end if;
 perform pg_advisory_xact_lock(hashtextextended('joint:'||p_case,0));
 select * into existing from public.shared_joint_panels where case_id=p_case;
 if found then
  if existing.chair_id is distinct from p_chair or existing.peer_id is distinct from p_peer
    or existing.npc_id is distinct from p_npc then raise exception 'joint_panel_conflict'; end if;
  return false;
 end if;
 insert into public.shared_joint_panels(case_id,chair_id,peer_id,npc_id)
 values(p_case,p_chair,p_peer,p_npc);
 return true;
end $$;

create or replace function public.shared_joint_vote(
 p_case text,p_actor uuid,p_seat text,p_choice text,p_hash text,p_note text default ''
) returns boolean language plpgsql security definer set search_path=public as $$
declare panel public.shared_joint_panels%rowtype; prev public.shared_joint_votes%rowtype;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$'
  or p_note is null or length(p_note)>1000
  or p_choice not in ('guilty','acquittal','partial','claim_granted','claim_denied','settled','decision_yes','decision_no')
 then raise exception 'invalid_joint_vote'; end if;
 perform pg_advisory_xact_lock(hashtextextended('joint:'||p_case,0));
 select * into panel from public.shared_joint_panels where case_id=p_case for update;
 if not found or panel.state<>'deliberating' then raise exception 'panel_closed'; end if;
 if (p_seat='chair' and p_actor is distinct from panel.chair_id)
 or (p_seat='peer' and p_actor is distinct from panel.peer_id)
 or (p_seat='npc' and p_actor is not null)
 or p_seat not in ('chair','peer','npc') then
  raise exception 'not_panel_member' using errcode='42501'; end if;
 if p_seat='npc' and (select count(*) from public.shared_joint_votes
  where case_id=p_case and seat in ('chair','peer'))<2
 then raise exception 'human_votes_pending'; end if;
 select * into prev from public.shared_joint_votes where case_id=p_case and seat=p_seat;
 if found then
  if prev.choice is distinct from p_choice or prev.evidence_hash is distinct from p_hash
   or prev.private_note is distinct from p_note
  then raise exception 'vote_conflict'; end if;
  return false;
 end if;
 insert into public.shared_joint_votes(case_id,seat,actor_id,choice,evidence_hash,private_note)
 values(p_case,p_seat,p_actor,p_choice,p_hash,p_note);
 return true;
end $$;

create or replace function public.shared_joint_status(p_case text,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare panel public.shared_joint_panels%rowtype; own text; total integer;
        maximum integer; majority text; tally jsonb;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 select * into panel from public.shared_joint_panels where case_id=p_case;
 if not found then raise exception 'panel_not_found'; end if;
 if p_actor=panel.chair_id then
  select choice into own from public.shared_joint_votes where case_id=p_case and seat='chair';
 elsif p_actor=panel.peer_id then
  select choice into own from public.shared_joint_votes where case_id=p_case and seat='peer';
 else raise exception 'not_panel_member' using errcode='42501'; end if;
 select count(*) into total from public.shared_joint_votes where case_id=p_case;
 if total<3 then return jsonb_build_object(
  'state','deliberating','votesCast',total,'myVote',own,'majority',null
 ); end if;
 select choice,count(*) into majority,maximum
 from public.shared_joint_votes where case_id=p_case
 group by choice order by count(*) desc,choice limit 1;
 select jsonb_object_agg(choice,n) into tally
 from (select choice,count(*)::integer n from public.shared_joint_votes
   where case_id=p_case group by choice) x;
 return jsonb_build_object(
  'state',case when maximum>=2 then 'majority_ready' else 'further_deliberation' end,
  'votesCast',3,'myVote',own,
  'majority',case when maximum>=2 then majority else null end,'tally',tally
 );
end $$;

revoke all on function public.shared_joint_open(text,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.shared_joint_vote(text,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.shared_joint_status(text,uuid) from public,anon,authenticated;
grant execute on function public.shared_joint_open(text,uuid,uuid,text) to service_role;
grant execute on function public.shared_joint_vote(text,uuid,text,text,text,text) to service_role;
grant execute on function public.shared_joint_status(text,uuid) to service_role;
commit;
