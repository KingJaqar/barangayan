begin;set local lock_timeout='5s';set local statement_timeout='60s';
insert into public.announcements(id,barangay_id,title,body,category,published_at,alert_expires_at,deleted_at)
select ('e4000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
case when n=7 then 'a3000000-0000-4000-8000-000000000002'::uuid else 'a3000000-0000-4000-8000-000000000001'::uuid end,
'Synthetic Phase4 '||n,'<p>Follow **publisher** instructions.</p>',case when n=3 then 'general' else 'emergency' end,
case when n=4 then now()+interval '1 hour' else now()-n*interval '1 minute' end,
case when n in (3,6) then null when n=5 then now()-interval '30 seconds' else now()+interval '2 hours' end,
case when n=8 then now() else null end from generate_series(1,8) n;
commit;