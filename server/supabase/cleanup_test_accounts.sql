-- THE VERDICT — clear the data of TEST accounts after a live check (server/live), so the check can run again.
-- Only touches players whose invite name starts with 'TEST'. Real players' careers, backups and usage are never touched.
-- Run in the Supabase SQL editor: first select and run only the SELECT to see what will be cleared, then run the DELETE lines.
select p.email, p.name,
       (select count(*) from public.saves s where s.user_id = p.user_id)        as saves,
       (select count(*) from public.save_backups b where b.user_id = p.user_id) as backups,
       (select count(*) from public.ai_usage u where u.user_id = p.user_id)     as ai_calls
  from public.players p where p.name like 'TEST%';

delete from public.saves        where user_id in (select user_id from public.players where name like 'TEST%' and user_id is not null);
delete from public.save_backups where user_id in (select user_id from public.players where name like 'TEST%' and user_id is not null);
-- AI usage rows are kept as the record of what was spent (remove the next line's leading dashes to clear them too)
-- delete from public.ai_usage  where user_id in (select user_id from public.players where name like 'TEST%' and user_id is not null);
