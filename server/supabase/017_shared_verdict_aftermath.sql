-- THE VERDICT P4: schedule deterministic public post-verdict follow-up.
-- The event appears ONLY after the authoritative world clock reaches the next day.
-- No AI call or unreleased personal NPC memory is published.
-- Apply to independent QA DB after 016. No legacy data migration.
begin;

create table if not exists public.shared_world_followups (
 case_id text not null references public.shared_case_judgments(case_id),
 event_key text not null unique,
 due_game_day integer not null check(due_game_day between 0 and 200000),
 event_type text not null default 'aftermath_published' check(event_type='aftermath_published'),
 public_data jsonb not null check(jsonb_typeof(public_data)='object'),
 state text not null default 'pending' check(state in ('pending','published')),
 published_at timestamptz,
 primary key(case_id,event_key)
);
create index if not exists shared_followups_due on public.shared_world_followups(state,due_game_day);
alter table public.shared_world_followups enable row level security;
revoke all on public.shared_world_followups from public,anon,authenticated;
grant select,insert,update on public.shared_world_followups to service_role;

create or replace function public.shared_followup_on_verdict() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.game_day>=200000 then return new; end if;
 insert into public.shared_world_followups(case_id,event_key,due_game_day,public_data)
 values(new.case_id,'aftermath:'||new.case_id,new.game_day+1,
   jsonb_build_object(
    'publicCaseId',new.case_id,
    'title','선고 이후의 변화',
    'summary','해당 사건의 판결이 공개되었으며, 관계자와 지역사회에 후속 변화가 이어지고 있습니다.',
    'sourceEventKey','judgment:'||new.case_id
   ))
 on conflict do nothing;
 return new;
end $$;
drop trigger if exists p4_followup_judgment on public.shared_case_judgments;
create trigger p4_followup_judgment after insert on public.shared_case_judgments
 for each row execute function public.shared_followup_on_verdict();

create or replace function public.shared_followups_publish_on_day() returns trigger
language plpgsql set search_path=public as $$
declare r record; owner_id uuid;
begin
 if new.game_day<=old.game_day then return new; end if;
 for r in select * from public.shared_world_followups
    where state='pending' and due_game_day<=new.game_day
    order by due_game_day,case_id
    for update skip locked
 loop
  select judge_id into owner_id from public.shared_case_judgments where case_id=r.case_id;
  perform public.shared_world_append(r.event_key,r.case_id,r.event_type,
    r.due_game_day,r.public_data,owner_id);
  update public.shared_world_followups set state='published',published_at=now()
   where event_key=r.event_key;
 end loop;
 return new;
end $$;
drop trigger if exists p4_followup_clock on public.shared_world_clock;
create trigger p4_followup_clock after update of game_day on public.shared_world_clock
 for each row execute function public.shared_followups_publish_on_day();
commit;
