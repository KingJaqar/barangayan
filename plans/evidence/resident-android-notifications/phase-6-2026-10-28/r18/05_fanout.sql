\set ON_ERROR_STOP on
update barangayan_private.notification_hub_settings set emission_enabled=true, v2_alerts_enabled=true;
insert into public.barangays(id,name) values ('c1800000-0000-4000-8000-0000000000f1','R18 Fanout Barangay');
insert into auth.users(id,email,raw_user_meta_data) select ('c18f0000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'r18f'||g||'@test.local','{}' from generate_series(1,250) g;
insert into public.profiles(id,barangay_id,role,full_name) select ('c18f0000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'c1800000-0000-4000-8000-0000000000f1','resident','F '||g from generate_series(1,250) g;
update public.profiles set first_name='Test',last_name='Resident',house_no='1',street='Fixture Street',sex='female',employment_status='student',
  mobile_number='09171234567',birth_date='2000-01-01',profile_completed_at=now() where id::text like 'c18f0000-%';
insert into public.profiles(id,barangay_id,role,full_name) values ('c1800000-0000-4000-8000-0000000000ad','c1800000-0000-4000-8000-0000000000f1','admin','R18 Admin F') on conflict (id) do update set barangay_id=excluded.barangay_id;
set role service_role;
create temp table notice as select public.system_notice_create('service_status','c1800000-0000-4000-8000-0000000000f1','R18 maintenance','Rehearsal notice for 250 residents.','c1800000-0000-4000-8000-0000000000ad',null,null,null,null,null,null,null,true) as id;
select public.system_notice_publish((select id from notice));
reset role;
-- Interrupted run: the call's work is rolled back as a whole, nothing persists and nothing is half-sent.
begin;
set local role service_role;
select * from public.notification_publish_due_notices(100);
rollback;
do $$ begin
  assert (select count(*) from barangayan_private.notification_events where subject_type='notice')=0, 'rolled-back run left events behind';
  assert (select fanout_cursor is null and fanout_revision=0 from public.system_notices where state='published' and title='R18 maintenance'), 'rolled-back run advanced the cursor';
end $$;
-- Resume: committed calls of <=100 each until nothing is left.
set role service_role;
create temp table runs(n serial, published int, delivered int, pending int);
do $$
declare r record; i integer:=0;
begin
  loop
    i:=i+1; exit when i>8;
    select * into r from public.notification_publish_due_notices(100);
    insert into pg_temp.runs(published,delivered,pending) values (r.published,r.delivered,r.pending_notices);
    exit when r.delivered=0;
  end loop;
end $$;
reset role;
select * from runs order by n;
do $$ declare t uuid; begin
  select id into t from public.system_notices where title='R18 maintenance';
  assert (select max(delivered) from pg_temp.runs)<=100, 'a run exceeded the 100-record budget';
  assert (select sum(delivered) from pg_temp.runs)=250, 'not every resident was reached';
  assert (select count(*) from barangayan_private.notification_events where subject_type='notice' and subject_id=t)=250, 'event count';
  assert (select count(distinct recipient_id) from barangayan_private.notification_events where subject_type='notice' and subject_id=t)=250, 'duplicate event for a resident';
  assert (select count(*) from public.notification_inbox i join barangayan_private.notification_events e on e.id=i.event_id where e.subject_id=t)=250, 'inbox rows';
  assert (select delivered from pg_temp.runs order by n desc limit 1)=0, 'final run must deliver nothing (no replay)';
  assert (select fanout_revision=revision from public.system_notices where id=t), 'fan-out not marked complete';
  raise notice 'fan-out: interrupted run left nothing; resumed in % committed runs (max batch %); 250 events, 250 distinct residents, final run delivered 0', (select count(*) from pg_temp.runs), (select max(delivered) from pg_temp.runs);
end $$;
select 'push_tokens in clone', count(*) from public.push_tokens;
