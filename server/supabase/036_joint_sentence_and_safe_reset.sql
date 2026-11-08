-- Migration 036 (2026-11-08)
-- 1) P5: each judge's vote may carry a sentence / damages proposal. The Worker computes the agreed sentence as the
--    middle of the three opinions (planner decision "3인 의견의 가운데 값"). Proposals are immutable like the votes.
-- 2) reset_player_career no longer destroys the cloud record: the current saves are first kept in save_backups
--    (reason 'reset', last 5 per slot as before), so "보관된 기록" can bring them back.

alter table public.shared_joint_votes add column if not exists sentence jsonb;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='shared_joint_votes_sentence_object') then
  alter table public.shared_joint_votes add constraint shared_joint_votes_sentence_object
   check (sentence is null or (jsonb_typeof(sentence)='object' and length(sentence::text)<=500));
 end if;
end $$;

drop function if exists public.shared_joint_vote(text,uuid,text,text,text,text);
create or replace function public.shared_joint_vote(
 p_case text,p_actor uuid,p_seat text,p_choice text,p_hash text,p_note text default '',p_sentence jsonb default null
) returns boolean language plpgsql security definer set search_path=public as $$
declare panel public.shared_joint_panels%rowtype; prev public.shared_joint_votes%rowtype;
begin
 if public.request_role() is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_note is null or length(p_note)>1000
  or not (p_choice = any(public.shared_joint_choices(p_case)))
  or (p_sentence is not null and (jsonb_typeof(p_sentence)<>'object' or length(p_sentence::text)>500))
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
   or prev.private_note is distinct from p_note or prev.sentence is distinct from p_sentence
  then raise exception 'vote_conflict'; end if;
  return false;
 end if;
 insert into public.shared_joint_votes(case_id,seat,actor_id,choice,evidence_hash,private_note,round,sentence)
 values(p_case,p_seat,p_actor,p_choice,p_hash,p_note,panel.round,p_sentence);
 return true;
end $$;
revoke all on function public.shared_joint_vote(text,uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.shared_joint_vote(text,uuid,text,text,text,text,jsonb) to service_role;

create or replace function public.reset_player_career()
returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
declare uid uuid := auth.uid(); s record;
begin
  if uid is null or not public.is_player() then
    raise exception 'not_player' using errcode = '42501';
  end if;
  -- Lock this user's rows, so in-flight save_put and reset serialize at the database level.
  for s in select * from public.saves where user_id = uid for update loop
    insert into public.save_backups(user_id, slot, data, rev, game_ver, device, reason)
      values (uid, s.slot, s.data, s.rev, s.game_ver, s.device, 'reset');
    delete from public.save_backups b where b.user_id = uid and b.slot = s.slot
      and b.id not in (select id from public.save_backups x where x.user_id = uid and x.slot = s.slot order by id desc limit 5);
  end loop;
  delete from public.saves where user_id = uid;
  return true;
end $$;
revoke all on function public.reset_player_career() from public, anon;
grant execute on function public.reset_player_career() to authenticated;
