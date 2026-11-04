-- Native evidence admissibility decisions in the server's immutable shared hearing ledger.
-- Human presiding judge decides, human associate observes; NPC never acts as RPC actor.
-- Apply in an isolated QA DB first, after 029. No existing rows rewritten.
begin;
alter table public.shared_court_actions
 drop constraint if exists shared_court_actions_action_type_check;
alter table public.shared_court_actions
 add constraint shared_court_actions_action_type_check
 check(action_type in ('question','order','order_result','evidence_decision'));

create or replace function public.shared_evidence_decision_record(
 p_case text,p_judge uuid,p_hearing integer,p_record text,p_decision text
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare owner_id uuid; today_day integer;
 heard public.shared_judge_hearings%rowtype; prior public.shared_court_actions%rowtype;
 v_key text; reply jsonb;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_record is null or p_record !~ '^[a-zA-Z0-9_-]{1,65}$'
  or p_hearing not between 1 and 200
  or p_decision not in ('use','conditional','exclude')
 then raise exception 'invalid_evidence_ruling'; end if;
 select assigned_to into owner_id from public.case_stock
  where case_id=p_case and state='assigned';
 if owner_id is null or owner_id is distinct from p_judge
 then raise exception 'chair_required' using errcode='42501'; end if;
 if exists(select 1 from public.shared_case_judgments where case_id=p_case)
 then raise exception 'case_already_decided'; end if;
 select game_day into today_day from public.shared_world_clock where id='main' for share;
 select * into heard from public.shared_judge_hearings
  where case_id=p_case and hearing_index=p_hearing and judge_id=p_judge for share;
 if not found or heard.state<>'completed' or heard.completed_game_day is distinct from today_day
 then raise exception 'hearing_not_open_today' using errcode='42501'; end if;
 v_key:=p_record||':'||p_hearing;
 reply:=jsonb_build_object('status','done','recordId',p_record,'decision',p_decision);
 perform pg_advisory_xact_lock(hashtextextended('evidence:'||p_case||':'||v_key,0));
 select * into prior from public.shared_court_actions
  where case_id=p_case and action_type='evidence_decision' and action_key=v_key;
 if found then
  if prior.response is distinct from reply then
   raise exception 'evidence_ruling_conflict' using errcode='23505'; end if;
  return prior.response;
 end if;
 insert into public.shared_court_actions(case_id,judge_id,action_type,action_key,response,hearing_index,game_day)
 values(p_case,p_judge,'evidence_decision',v_key,reply,p_hearing,today_day);
 return reply;
end $$;
revoke all on function public.shared_evidence_decision_record(text,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.shared_evidence_decision_record(text,uuid,integer,text,text) to service_role;
commit;
