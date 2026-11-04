-- P4: connect canonical public NPC biographies to shared case judgments.
-- QA-only migration. Private memories/relationships are never copied or merged.
-- A case only links an NPC if trusted world-sheet authoring supplies a
-- pre-registered publicNpcId; names alone never establish identity.
begin;
create table if not exists public.shared_case_npc_links (
 case_id text not null references public.case_stock(case_id),
 npc_id text not null references public.shared_npc_public(npc_id),
 person_key text not null check(person_key ~ '^[A-Za-z0-9_-]{1,32}$'),
 created_at timestamptz not null default now(),
 primary key(case_id,npc_id)
);
alter table public.shared_case_npc_links enable row level security;
revoke all on public.shared_case_npc_links from public,anon,authenticated;
grant select,insert on public.shared_case_npc_links to service_role;

create or replace function public.shared_case_link_public_npcs() returns trigger
language plpgsql set search_path=public as $$
declare person jsonb; p_id text;p_key text;
begin
 if jsonb_typeof(new.sheet->'people')<>'array' then return new; end if;
 for person in select x.v from jsonb_array_elements(new.sheet->'people') as x(v) loop
  p_id:=person->>'publicNpcId';p_key:=person->>'key';
  if p_id is null or p_key is null or p_key !~ '^[A-Za-z0-9_-]{1,32}$' then continue; end if;
  if exists(select 1 from public.shared_npc_public where npc_id=p_id)
  then
   insert into public.shared_case_npc_links(case_id,npc_id,person_key)
   values(new.case_id,p_id,p_key) on conflict do nothing;
  end if;
 end loop;
 return new;
end $$;
drop trigger if exists p4_case_npc_link on public.case_stock;
create trigger p4_case_npc_link after insert on public.case_stock
 for each row execute function public.shared_case_link_public_npcs();

create or replace function public.shared_npc_verdict_effects() returns trigger
language plpgsql set search_path=public as $$
declare link record; keys jsonb;cases jsonb;event_id text;
begin
 for link in select l.npc_id,l.person_key from public.shared_case_npc_links l
   where l.case_id=new.case_id
 loop
  event_id:='npc-judgment:'||md5(new.case_id||':'||link.npc_id);
  -- Public biography only: no invented mortality, employment, verdict score,
  -- or private relationship state. Append once to the canonical event references.
  update public.shared_npc_public p
  set public_profile=jsonb_set(
    jsonb_set(p.public_profile,'{publicCaseIds}',
      coalesce(p.public_profile->'publicCaseIds','[]'::jsonb)||to_jsonb(new.case_id),true),
    '{publicEventKeys}',
      coalesce(p.public_profile->'publicEventKeys','[]'::jsonb)||to_jsonb(event_id),true),
    effective_day=greatest(p.effective_day,new.game_day),version=p.version+1,updated_at=now()
  where p.npc_id=link.npc_id;
  perform public.shared_world_append(
   event_id,new.case_id,'npc_public_update',new.game_day,
   jsonb_build_object('title','판결과 관련된 인물 기록',
    'summary','사건의 판결이 확정되어 인물의 공개 활동 이력에 반영되었습니다.',
    'npcIds',jsonb_build_array(link.npc_id),
    'publicCaseId',new.case_id,'sourceEventKey','judgment:'||new.case_id),
   new.judge_id);
 end loop;
 return new;
end $$;
drop trigger if exists p4_npc_verdict_effects on public.shared_world_events;
create trigger p4_npc_verdict_effects after insert on public.shared_world_events
 for each row when (new.event_type='judgment_published')
 execute function public.shared_npc_verdict_effects();
commit;
