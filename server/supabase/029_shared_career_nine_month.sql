-- P4 shared-world formal nine-month judicial reviews.
-- Projection from immutable verdict/career ledgers only. No production writes.
begin;
create or replace function public.shared_career_nine_month(p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare current_day integer; result jsonb;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_actor is null or not exists (select 1 from public.players p where p.user_id=p_actor)
 then raise exception 'not_invited' using errcode='42501'; end if;
 select game_day into current_day from public.shared_world_clock where id='main';
 if current_day is null then return '[]'::jsonb; end if;
 select coalesce(jsonb_agg(
  jsonb_build_object(
   'period',period.n,
   'startDay',(period.n-1)*273,
   'endDay',period.n*273,
   'caseCount',stats.cases,
   'solo',stats.solo_cases,
   'joint',stats.joint_cases,
   'rating',case
     when stats.cases=0 then '평가 보류'
     when stats.cases<2 then '평가 자료 부족'
     when stats.mean_review>=82 then '우수'
     when stats.mean_review>=67 then '안정'
     when stats.mean_review>=50 then '보완 필요'
     else '집중 개선' end,
   'narrative',case when stats.cases=0 then '해당 기간에는 확정된 판결이 없어 평가를 유보했다.'
    when stats.cases<2 then '종결 사건이 적어 법관 평가의 결론을 유보했다.'
    else stats.cases||'건의 공유 법정 판결 기록을 검토했다. '||
      case when stats.mean_review>=82 then '법리와 기록 검토가 우수한 기간이었다.'
       when stats.mean_review>=67 then '전반적으로 안정적인 심리를 이어갔다.'
       when stats.mean_review>=50 then '일부 판단의 충실도를 개선할 필요가 있었다.'
       else '주요 판단 근거를 다시 점검할 필요가 있었다.' end end
   ) order by period.n desc), '[]'::jsonb)
 into result
 from generate_series(1,greatest(0,current_day/273)) as period(n)
 cross join lateral (
  select count(c.case_id)::integer as cases,
         count(c.case_id) filter(where c.seat='solo')::integer as solo_cases,
         count(c.case_id) filter(where c.seat<>'solo')::integer as joint_cases,
         round(avg(c.review_score))::integer as mean_review
  from public.shared_judge_career_events c
  join public.shared_case_judgments j on j.case_id=c.case_id
  where c.judge_id=p_actor and j.game_day>=(period.n-1)*273
    and j.game_day<period.n*273
 ) stats;
 return coalesce(result,'[]'::jsonb);
end $$;
revoke all on function public.shared_career_nine_month(uuid) from public,anon,authenticated;
grant execute on function public.shared_career_nine_month(uuid) to service_role;
commit;
