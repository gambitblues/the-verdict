-- THE VERDICT P4/P5 bench authority: a human presides; humans and NPCs are associates.
-- QA-only after 027. Existing joint panels retain their assigned human chair.
begin;
create or replace function public.shared_joint_bench(p_case text,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.shared_joint_panels%rowtype;
        chair_name text; peer_name text; npc_name text; npc_status text;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 select * into p from public.shared_joint_panels where case_id=p_case;
 if not found or p_actor is null or p_actor not in(p.chair_id,p.peer_id)
 then raise exception 'not_panel_member' using errcode='42501'; end if;
 select name into chair_name from public.players where user_id=p.chair_id;
 select name into peer_name from public.players where user_id=p.peer_id;
 select coalesce(public_profile->>'name',npc_id),life_status into npc_name,npc_status
 from public.shared_npc_public where npc_id=p.npc_id;
 return jsonb_build_object(
  'caseId',p_case,'myRole',case when p.chair_id=p_actor then 'chair' else 'associate' end,
  'canOpenHearing',p.chair_id=p_actor,'canPublishJudgment',p.chair_id=p_actor,
  'seats',jsonb_build_array(
   jsonb_build_object('seat','chair','kind','human','role','presiding','id',p.chair_id,'name',coalesce(chair_name,'재판장')),
   jsonb_build_object('seat','peer','kind','human','role','associate','id',p.peer_id,'name',coalesce(peer_name,'배석판사')),
   jsonb_build_object('seat','npc','kind','npc','role','associate','id',p.npc_id,'name',coalesce(npc_name,'NPC 배석판사'),'lifeStatus',coalesce(npc_status,'unknown'))
  ));
end $$;
revoke all on function public.shared_joint_bench(text,uuid) from public,anon,authenticated;
grant execute on function public.shared_joint_bench(text,uuid) to service_role;

-- A case's assigned chair and associate seats cannot be silently swapped
-- after deliberation has begun, even by privileged application code.
create or replace function public.shared_joint_seats_immutable() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.case_id is distinct from old.case_id
    or new.chair_id is distinct from old.chair_id
    or new.peer_id is distinct from old.peer_id
    or new.npc_id is distinct from old.npc_id
 then raise exception 'joint_seats_immutable' using errcode='42501'; end if;
 return new;
end $$;
drop trigger if exists shared_joint_seat_lock on public.shared_joint_panels;
create trigger shared_joint_seat_lock
 before update on public.shared_joint_panels
 for each row execute function public.shared_joint_seats_immutable();

-- Explicit seat typing: a synthetic NPC UUID can never impersonate a user or
-- act as presiding judge; the NPC reference is always the associate seat.
comment on column public.shared_joint_panels.chair_id is 'Presiding REAL invited human judge. Case assignee and initiator.';
comment on column public.shared_joint_panels.peer_id is 'Associate REAL invited human judge.';
comment on column public.shared_joint_panels.npc_id is 'Associate NPC judge only. Never presiding.';
commit;
