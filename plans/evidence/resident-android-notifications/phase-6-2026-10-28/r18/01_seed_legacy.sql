\set ON_ERROR_STOP on
-- Legacy (pre-0145) state: independent announcement_reads and inbox mirrors.
insert into public.barangays(id,name) values ('c1800000-0000-4000-8000-000000000001','R18 Barangay') on conflict do nothing;
insert into auth.users(id,email,raw_user_meta_data)
select ('c1800000-0000-4000-8000-0000000000'||lpad(g::text,2,'0'))::uuid,'r18-r'||g||'@test.local','{}' from generate_series(1,6) g on conflict do nothing;
insert into public.profiles(id,barangay_id,role,full_name)
select ('c1800000-0000-4000-8000-0000000000'||lpad(g::text,2,'0'))::uuid,'c1800000-0000-4000-8000-000000000001','resident','R18 Res '||g from generate_series(1,6) g on conflict do nothing;
update public.profiles set first_name='Test',last_name='Resident',house_no='1',street='Fixture Street',sex='female',employment_status='student',
  mobile_number='09171234567',birth_date='2000-01-01',profile_completed_at=now() where id::text like 'c1800000-%';
insert into auth.users(id,email,raw_user_meta_data) values ('c1800000-0000-4000-8000-0000000000ad','r18-admin@test.local','{}') on conflict do nothing;
insert into public.profiles(id,barangay_id,role,full_name) values ('c1800000-0000-4000-8000-0000000000ad','c1800000-0000-4000-8000-000000000001','admin','R18 Admin') on conflict do nothing;
insert into public.announcements(id,barangay_id,title,body,category,published_at)
select ('c1800000-0000-4000-8000-0000000001'||lpad(g::text,2,'0'))::uuid,'c1800000-0000-4000-8000-000000000001','R18 ann '||g,'Body','general',now()-make_interval(hours=>g) from generate_series(1,8) g;
select 'mirrors', count(*) from public.notification_inbox where kind='announcement' and recipient_id::text like 'c1800000-%';
