begin;
create or replace function public.shared_joint_auto_assign(p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid text; partner uuid; npc text; active text;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then raise exception 'service_only'; end if;
 if not exists(select 1 from public.players where user_id=p_actor) then raise exception 'not_invited'; end if;
 perform pg_advisory_xact_lock(hashtextextended('joint-auto-allocate',0));
 select j.case_id into active from public.shared_joint_panels j
 where (j.chair_id=p_actor or j.peer_id=p_actor)
 and not exists(select 1 from public.shared_case_judgments v where v.case_id=j.case_id)
 limit 1;
 if active is not null then return jsonb_build_object('ok',true,'caseId',active,'existing',true); end if;
 select p.user_id into partner from public.players p
 where p.user_id<>p_actor and not exists(
  select 1 from public.shared_joint_panels j
  where (j.chair_id=p.user_id or j.peer_id=p.user_id)
  and not exists(select 1 from public.shared_case_judgments v where v.case_id=j.case_id))
 order by p.user_id limit 1;
 select n.npc_id into npc from public.shared_npc_public n where n.life_status='alive'
 order by n.npc_id limit 1;
 if partner is null or npc is null then
  return jsonb_build_object('ok',false,'reason','panel_members_unavailable');
 end if;
 select s.case_id into cid from public.case_stock s
 where s.state='stock' and exists(select 1 from public.world_secrets t where t.case_id=s.case_id)
 order by s.created_at,s.case_id for update skip locked limit 1;
 if cid is null then return jsonb_build_object('ok',false,'reason','joint_stock_empty'); end if;
 update public.case_stock set state='assigned',assigned_to=p_actor,assigned_at=now()
 where case_id=cid and state='stock';
 insert into public.shared_joint_panels(case_id,chair_id,peer_id,npc_id)
 values(cid,p_actor,partner,npc);
 return jsonb_build_object('ok',true,'caseId',cid,'existing',false);
end $$;
revoke all on function public.shared_joint_auto_assign(uuid) from public,anon,authenticated;
grant execute on function public.shared_joint_auto_assign(uuid) to service_role;
commit;
