-- P5: one active joint hearing per existing judge, independent of five personal trials.
-- Applies only to isolated QA, after migration 024.
begin;
create or replace function public.shared_joint_one_slot() returns trigger
language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('joint-slot:'||new.chair_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('joint-slot:'||new.peer_id::text,0));
 if exists (
  select 1 from public.shared_joint_panels p
  where p.case_id<>new.case_id
    and (p.chair_id in (new.chair_id,new.peer_id)
      or p.peer_id in (new.chair_id,new.peer_id))
    and not exists(select 1 from public.shared_case_judgments j where j.case_id=p.case_id)
 ) then raise exception 'joint_slot_already_occupied' using errcode='23505'; end if;
 return new;
end $$;
drop trigger if exists shared_joint_single_slot on public.shared_joint_panels;
create trigger shared_joint_single_slot before insert on public.shared_joint_panels
 for each row execute function public.shared_joint_one_slot();

create or replace function public.shared_joint_slot(p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare panel public.shared_joint_panels%rowtype;
        title text; result text;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if not exists(select 1 from public.players where user_id=p_actor)
 then raise exception 'not_invited' using errcode='42501'; end if;
 select p.* into panel from public.shared_joint_panels p
 where (p.chair_id=p_actor or p.peer_id=p_actor)
 order by p.case_id limit 1;
 if not found then return jsonb_build_object('occupied',false,'limit',1); end if;
 select j.result into result from public.shared_case_judgments j where j.case_id=panel.case_id;
 if result is not null then return jsonb_build_object('occupied',false,'limit',1); end if;
 select s.sheet #>> '{card,title}' into title
 from public.case_stock s where s.case_id=panel.case_id;
 return jsonb_build_object('occupied',true,'limit',1,'caseId',panel.case_id,
  'title',coalesce(title,'공동재판 사건'),'state',panel.state,
  'role',case when panel.chair_id=p_actor then 'chair' else 'peer' end);
end $$;
revoke all on function public.shared_joint_slot(uuid) from public,anon,authenticated;
grant execute on function public.shared_joint_slot(uuid) to service_role;
commit;
