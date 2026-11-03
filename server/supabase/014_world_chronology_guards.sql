-- THE VERDICT P4-9: no future news, no future NPC death, no hearing after verdict.
-- Apply to isolated QA DB after migrations through 013.
-- Events already published before this migration are NOT rewritten.
begin;

create or replace function public.shared_event_chronology_guard() returns trigger
language plpgsql set search_path=public as $$
declare verdict_day integer; current_day integer;
begin
 select game_day into current_day from public.shared_world_clock where id='main' for share;
 if current_day is null or new.game_day>current_day then
  raise exception 'future_world_event'; end if;
 if new.event_type='judgment_published' and not exists(
   select 1 from public.shared_case_judgments j
   where j.case_id=new.case_id and j.game_day=new.game_day)
 then raise exception 'unverified_judgment_event'; end if;
 if new.event_type='hearing_opened' and exists(
   select 1 from public.shared_case_judgments j where j.case_id=new.case_id)
 then raise exception 'hearing_after_judgment'; end if;
 if new.event_type in ('appeal_reported','aftermath_published') then
  select game_day into verdict_day from public.shared_case_judgments where case_id=new.case_id;
  if verdict_day is null or new.game_day<verdict_day then
   raise exception 'world_event_out_of_order'; end if;
 end if;
 return new;
end $$;

create or replace function public.shared_npc_date_guard() returns trigger
language plpgsql set search_path=public as $$
declare current_day integer;
begin
 select game_day into current_day from public.shared_world_clock where id='main' for share;
 if current_day is null or new.effective_day>current_day
 then raise exception 'future_npc_public_update'; end if;
 return new;
end $$;
drop trigger if exists shared_npc_public_date_guard on public.shared_npc_public;
create trigger shared_npc_public_date_guard
 before insert or update on public.shared_npc_public
 for each row execute function public.shared_npc_date_guard();

commit;
