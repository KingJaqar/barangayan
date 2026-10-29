\set ON_ERROR_STOP on
-- r1: read seen only in the inbox mirror; r2: read seen only in announcement_reads; r3: both.
update public.notification_inbox set read_at=now()-interval '3 hours' where kind='announcement' and recipient_id='c1800000-0000-4000-8000-000000000001' and destination->>'id'='c1800000-0000-4000-8000-000000000101';
insert into public.announcement_reads(resident_id,announcement_id,read_at) values ('c1800000-0000-4000-8000-000000000002','c1800000-0000-4000-8000-000000000102',now()-interval '2 hours');
update public.notification_inbox set read_at=now()-interval '1 hour' where kind='announcement' and recipient_id='c1800000-0000-4000-8000-000000000003' and destination->>'id'='c1800000-0000-4000-8000-000000000103';
insert into public.announcement_reads(resident_id,announcement_id,read_at) values ('c1800000-0000-4000-8000-000000000003','c1800000-0000-4000-8000-000000000103',now()-interval '1 hour');
create schema if not exists r18_snap;
create table r18_snap.reads as select * from public.announcement_reads where resident_id::text like 'c1800000-%';
create table r18_snap.inbox as select id,recipient_id,kind,title,read_at from public.notification_inbox where recipient_id::text like 'c1800000-%';
create table r18_snap.counts as select (select count(*) from barangayan_private.notification_events) ev,(select count(*) from barangayan_private.notification_outbox) ob,(select count(*) from public.notification_inbox) ib,(select count(*) from public.announcements) an,(select md5(string_agg(i::text,'|' order by i.id)) from public.incidents i) inc,(select md5(string_agg(s::text,'|' order by s.id)) from public.service_requests s) sr,(select md5(string_agg(p::text,'|' order by p.id)) from public.profiles p) pr;
select * from r18_snap.counts;
