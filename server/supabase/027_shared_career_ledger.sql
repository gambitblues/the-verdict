-- Shared judge career events are transactionally attached to immutable scored verdicts.
-- This does not overwrite existing personal save files or player profiles.
begin;
create table if not exists public.shared_judge_career_events(
 case_id text not null references public.shared_judgment_reviews(case_id),
 judge_id uuid not null references auth.users(id),
 seat text not null check(seat in ('solo','chair','peer')),
 skill_score integer not null check(skill_score between 0 and 100),
 review_score integer not null check(review_score between 0 and 100),
 created_at timestamptz not null default now(),
 primary key(case_id,judge_id)
);
alter table public.shared_judge_career_events enable row level security;
revoke all on public.shared_judge_career_events from public,anon,authenticated;
grant select,insert on public.shared_judge_career_events to service_role;
create or replace function public.shared_career_event_write()
returns trigger language plpgsql security definer set search_path=public as $$
declare peer uuid; chair uuid;
begin
 select p.chair_id,p.peer_id into chair,peer
 from public.shared_joint_panels p where p.case_id=new.case_id;
 insert into public.shared_judge_career_events(case_id,judge_id,seat,skill_score,review_score)
 values(new.case_id,new.judge_id,case when chair is not null then 'chair' else 'solo' end,
   new.skill_score,new.review_score);
 if peer is not null then
  insert into public.shared_judge_career_events(case_id,judge_id,seat,skill_score,review_score)
  values(new.case_id,peer,'peer',new.skill_score,new.review_score);
 end if;
 return new;
end $$;
drop trigger if exists shared_career_record_after_review on public.shared_judgment_reviews;
create trigger shared_career_record_after_review after insert
 on public.shared_judgment_reviews for each row
 execute function public.shared_career_event_write();

create or replace function public.shared_judge_career_status(p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare n integer; solo integer; joint integer; skill integer; review integer;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if not exists(select 1 from public.players p where p.user_id=p_actor)
 then raise exception 'not_invited' using errcode='42501'; end if;
 select count(*)::integer,
  count(*) filter(where seat='solo')::integer,
  count(*) filter(where seat<>'solo')::integer,
  round(avg(skill_score))::integer,
  round(avg(review_score))::integer
 into n,solo,joint,skill,review
 from public.shared_judge_career_events where judge_id=p_actor;
 return jsonb_build_object('cases',coalesce(n,0),
  'solo',coalesce(solo,0),'joint',coalesce(joint,0),
  'avgSkill',skill,'avgReview',review);
end $$;
revoke all on function public.shared_judge_career_status(uuid) from public,anon,authenticated;
grant execute on function public.shared_judge_career_status(uuid) to service_role;

create or replace function public.shared_career_event_immutable() returns trigger
language plpgsql as $$
begin raise exception 'career_event_immutable' using errcode='42501'; end $$;
drop trigger if exists shared_career_event_no_rewrite on public.shared_judge_career_events;
create trigger shared_career_event_no_rewrite before update or delete
 on public.shared_judge_career_events for each row
 execute function public.shared_career_event_immutable();
commit;
