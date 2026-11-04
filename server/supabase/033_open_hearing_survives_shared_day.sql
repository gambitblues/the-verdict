-- v8.7.4: a judge's opened hearing stays open until that judge begins the next hearing or decides the case.
-- Before, every courtroom action required the hearing date to equal the shared world date, so when the other judge
-- opened a hearing that moved the shared date forward, this judge could no longer act in the hearing already open
-- AND could not begin the next one (previous_hearing_empty) — the case was stuck for good (spec 2.5: one judge's
-- hearing must never force the other's schedule). The stale-device protection is kept in a better form: only the
-- judge's LATEST hearing accepts actions; an older hearing is closed as soon as a later one exists.
-- Rewrites the guard inside the existing functions (015, 018, 028, 030, 031). Safe to run again.
begin;
do $rewrite$
declare f record; def text; n int:=0;
begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace s on s.oid=p.pronamespace
          where s.nspname='public' and p.prosrc ~ '\w+\.completed_game_day\s+is distinct from\s+(today_day|world_day)' loop
  def:=pg_get_functiondef(f.oid);
  def:=regexp_replace(def,'(\w+)\.completed_game_day\s+is distinct from\s+(today_day|world_day)',
   'exists(select 1 from public.shared_judge_hearings later_h where later_h.case_id=\1.case_id and later_h.hearing_index>\1.hearing_index)','g');
  execute def;n:=n+1;
 end loop;
 if exists(select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace
           where s.nspname='public' and p.prosrc ~ '\w+\.completed_game_day\s+is distinct from\s+(today_day|world_day)')
 then raise exception 'open_hearing_rewrite_incomplete'; end if;
 raise notice 'open hearing rule: % functions updated', n;
end $rewrite$;
commit;
