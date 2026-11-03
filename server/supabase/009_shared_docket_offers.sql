-- P4-4: two shared-world case offers per real KST hour, one accepted by a judge.
-- An invited judge can only reserve through a trusted Worker; browser roles have NO grants.
-- Apply after 001,002,003,006,007,008 on a separate QA Supabase project.
begin;
create table if not exists public.shared_docket_offers (
 judge_id uuid not null references auth.users(id),
 slot text not null check(slot ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}$'),
 option_index smallint not null check(option_index in (0,1)),
 case_id text not null references public.case_stock(case_id),
 state text not null default 'offered' check(state in ('offered','accepted','expired')),
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 primary key(judge_id,slot,option_index)
);
-- A case cannot be reserved for two judges during the same active window.
create unique index if not exists shared_docket_unclaimed
 on public.shared_docket_offers(case_id) where state='offered';
create index if not exists shared_docket_by_slot
 on public.shared_docket_offers(judge_id,slot,state);
alter table public.shared_docket_offers enable row level security;
revoke all on public.shared_docket_offers from public,anon,authenticated;
grant select,insert,update on public.shared_docket_offers to service_role;

-- The slot calculation is a database-owned function. Test DB can substitute a
-- deterministic fixture without changing production UTC/KST behavior.
create or replace function public.shared_kst_slot() returns text
language sql stable set search_path=public as $$
 select to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD"T"HH24')
$$;
revoke all on function public.shared_kst_slot() from public,anon,authenticated;
grant execute on function public.shared_kst_slot() to service_role;

-- Request is idempotent within one KST hour and uses DB clock rather than
-- client time. Releasing expired reservations never releases ACCEPTED cases.
create or replace function public.shared_docket_offer(p_judge uuid,p_slot text)
returns table(case_id text,category text,option_index smallint,expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare
 current_slot text:=public.shared_kst_slot();
 current_hour int:=right(public.shared_kst_slot(),2)::int;
 found_id text;
 n int;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_judge is null or not exists(select 1 from public.players where user_id=p_judge)
 then raise exception 'judge_not_invited' using errcode='42501'; end if;
 if p_slot is distinct from current_slot or current_hour not between 10 and 22
 then raise exception 'invalid_offer_slot'; end if;
 perform pg_advisory_xact_lock(hashtextextended('docket:'||p_judge::text||':'||p_slot,0));
 -- Expired offers do not consume a case or prevent other judges from receiving it.
 update public.shared_docket_offers o set state='expired'
 where o.state='offered' and o.expires_at<=now();
 -- Re-fetching never generates more than the original two options for the slot.
 select count(*) into n from public.shared_docket_offers
 where judge_id=p_judge and slot=p_slot;
 if n=0 then
  for i in 0..1 loop
   select s.case_id into found_id from public.case_stock s
   where s.state='stock' and exists(
      select 1 from public.world_secrets w where w.case_id=s.case_id
      and w.truth->>'branch' in ('did','didnt','reason')) and not exists(
      select 1 from public.shared_docket_offers o
      where o.case_id=s.case_id and o.state='offered' and o.expires_at>now())
   order by s.created_at,s.case_id
   for update of s skip locked limit 1;
   if found_id is null then exit; end if;
   insert into public.shared_docket_offers(judge_id,slot,option_index,case_id,expires_at)
   values(p_judge,p_slot,i,found_id,now()+interval '45 minutes');
  end loop;
 end if;
 return query
 select o.case_id,s.category,o.option_index,o.expires_at
 from public.shared_docket_offers o join public.case_stock s on s.case_id=o.case_id
 where o.judge_id=p_judge and o.slot=p_slot
   and o.state in ('offered','accepted')
   and (o.state='accepted' or o.expires_at>now())
 order by o.option_index;
end $$;

create or replace function public.shared_docket_accept(
 p_judge uuid,p_slot text,p_case_id text
) returns table(case_id text,category text,assigned_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare
 offer public.shared_docket_offers%rowtype;
 existing public.case_stock%rowtype;
 accepted_today int;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'service_only' using errcode='42501'; end if;
 if p_judge is null or not exists(select 1 from public.players where user_id=p_judge)
 then raise exception 'judge_not_invited' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('docket:'||p_judge::text||':'||p_slot,0));
 select * into offer from public.shared_docket_offers o
 where o.judge_id=p_judge and o.slot=p_slot and o.case_id=p_case_id
 for update;
 if not found then raise exception 'offer_not_found'; end if;
 if offer.state='accepted' then
  return query select s.case_id,s.category,s.assigned_at from public.case_stock s
  where s.case_id=p_case_id and s.assigned_to=p_judge and s.state='assigned';
  return;
 end if;
 if offer.state<>'offered' or offer.expires_at<=now()
 then raise exception 'offer_expired'; end if;
 if p_slot is distinct from public.shared_kst_slot()
 then raise exception 'offer_expired'; end if;
 select count(*) into accepted_today from public.shared_docket_offers o
 where o.judge_id=p_judge and left(o.slot,10)=left(p_slot,10) and o.state='accepted';
 if accepted_today>=4 then raise exception 'daily_case_limit'; end if;
 select * into existing from public.case_stock s
 where s.case_id=p_case_id for update;
 if not found or existing.state<>'stock' then raise exception 'case_already_assigned'; end if;
 if not exists(select 1 from public.world_secrets w where w.case_id=p_case_id
    and w.truth->>'branch' in ('did','didnt','reason'))
 then raise exception 'case_truth_not_sealed'; end if;
 -- The assignment update also invokes the shared_case_assignment_event trigger.
 update public.case_stock s set state='assigned',assigned_to=p_judge,assigned_at=now()
 where s.case_id=p_case_id;
 update public.shared_docket_offers o set state='expired'
 where o.judge_id=p_judge and o.slot=p_slot and o.state='offered' and o.case_id<>p_case_id;
 update public.shared_docket_offers o set state='accepted'
 where o.judge_id=p_judge and o.slot=p_slot and o.case_id=p_case_id;
 return query select s.case_id,s.category,s.assigned_at from public.case_stock s
 where s.case_id=p_case_id and s.assigned_to=p_judge;
end $$;

revoke all on function public.shared_docket_offer(uuid,text) from public,anon,authenticated;
revoke all on function public.shared_docket_accept(uuid,text,text) from public,anon,authenticated;
grant execute on function public.shared_docket_offer(uuid,text) to service_role;
grant execute on function public.shared_docket_accept(uuid,text,text) to service_role;
commit;
