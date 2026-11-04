-- P4/P5 atomic verdict plus native-grade evidence review; QA only after 022.
begin;
create table if not exists public.shared_judgment_reviews(
 case_id text primary key references public.shared_case_judgments(case_id),
 judge_id uuid not null references auth.users(id),
 skill_score integer not null check(skill_score between 0 and 100),
 review_score integer not null check(review_score between 0 and 100),
 grade_data jsonb not null check(jsonb_typeof(grade_data)='object'),
 created_at timestamptz not null default now()
);
alter table public.shared_judgment_reviews enable row level security;
revoke all on public.shared_judgment_reviews from public,anon,authenticated;
grant select on public.shared_judgment_reviews to authenticated;
grant select,insert on public.shared_judgment_reviews to service_role;
drop policy if exists shared_review_invited_read on public.shared_judgment_reviews;
create policy shared_review_invited_read on public.shared_judgment_reviews
 for select to authenticated using(public.is_player());

create or replace function public.shared_review_immutable() returns trigger
language plpgsql as $$
begin raise exception 'shared_review_immutable' using errcode='42501'; end $$;
drop trigger if exists shared_review_no_rewrite on public.shared_judgment_reviews;
create trigger shared_review_no_rewrite before update or delete
 on public.shared_judgment_reviews for each row
 execute function public.shared_review_immutable();

create or replace function public.shared_judgment_publish_scored(
 p_case text,p_judge uuid,p_result text,p_order text,p_record_hash text,
 p_score integer,p_review integer,p_grade jsonb
) returns boolean language plpgsql security definer set search_path=public as $$
declare inserted boolean; existing public.shared_judgment_reviews%rowtype;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_score is null or p_score not between 0 and 100
 or p_review is null or p_review not between 0 and 100
 or p_grade is null or jsonb_typeof(p_grade)<>'object'
 or octet_length(p_grade::text)>25000
 then raise exception 'invalid_shared_review'; end if;
 inserted:=public.shared_judgment_publish(
  p_case,p_judge,p_result,p_order,p_record_hash);
 if inserted then
  insert into public.shared_judgment_reviews(
   case_id,judge_id,skill_score,review_score,grade_data)
  values(p_case,p_judge,p_score,p_review,p_grade);
 else
  select * into existing from public.shared_judgment_reviews
   where case_id=p_case for share;
  if not found or existing.judge_id is distinct from p_judge
    or existing.skill_score is distinct from p_score
    or existing.review_score is distinct from p_review
    or existing.grade_data is distinct from p_grade
  then raise exception 'review_already_published'; end if;
 end if;
 return inserted;
end $$;
revoke all on function public.shared_judgment_publish_scored(text,uuid,text,text,text,integer,integer,jsonb)
 from public,anon,authenticated;
grant execute on function public.shared_judgment_publish_scored(text,uuid,text,text,text,integer,integer,jsonb)
 to service_role;
commit;
