-- P4-3: publish a public assignment event from the trusted DB transition.
-- Apply only after 001, 002, 003, 006, 007 on an isolated QA DB.
-- Does not import old saves or retroactively publish existing assignments.
begin;
create or replace function public.shared_case_assignment_event() returns trigger
language plpgsql security definer set search_path=public as $$
declare current_day integer;
begin
 if new.state<>'assigned' or new.assigned_to is null then return new; end if;
 if tg_op='UPDATE' and old.state='assigned' then return new; end if;
 select game_day into current_day from public.shared_world_clock where id='main';
 if current_day is null then raise exception 'shared_clock_missing'; end if;
 perform public.shared_world_append(
   'case-assigned:'||new.case_id,
   new.case_id,
   'case_assigned',
   current_day,
   jsonb_build_object('publicCaseId',new.case_id,'eventLabel','새 사건이 법원에 배당되었습니다.'),
   new.assigned_to
 );
 return new;
end $$;
drop trigger if exists shared_case_assigned on public.case_stock;
create trigger shared_case_assigned after update of state,assigned_to on public.case_stock
 for each row when (new.state='assigned')
 execute function public.shared_case_assignment_event();
commit;
