begin;
select plan(7);

insert into public.barangays (id, name) values
  ('a1000000-0000-0000-0000-000000000001', 'iOS Guard Barangay A'),
  ('a1000000-0000-0000-0000-000000000002', 'iOS Guard Barangay B');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at) values
  ('b1000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ios-guard-a@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b1000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ios-guard-b@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b1000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ios-guard-admin@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now());

insert into public.profiles (id, barangay_id, role, full_name) values
  ('b1000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'resident', 'iOS Guard Resident A'),
  ('b1000000-0000-0000-0000-00000000000b', 'a1000000-0000-0000-0000-000000000002', 'resident', 'iOS Guard Resident B'),
  ('b1000000-0000-0000-0000-00000000000c', 'a1000000-0000-0000-0000-000000000001', 'admin', 'iOS Guard Admin A');

insert into public.medical_drives (id, barangay_id, title, type, drive_date, time_start, time_end, eligible_criteria, stock_total, stock_remaining) values
  ('f2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'iOS Drive A', 'vaccination', current_date, '08:00', '12:00', 'Residents', 5, 5),
  ('f2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'iOS Drive B', 'vaccination', current_date, '08:00', '12:00', 'Residents', 5, 5);

insert into public.evacuation_centers (id, barangay_id, name, position, is_active) values
  ('e2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'iOS Center A', '{"lat":14.6,"lng":121.1}', true),
  ('e2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'iOS Center B', '{"lat":14.7,"lng":121.2}', true),
  ('e2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'iOS Center Inactive', '{"lat":14.6,"lng":121.1}', false);

set local role authenticated;
set local request.jwt.claim.sub = 'b1000000-0000-0000-0000-00000000000a';

select throws_ok(
  $$ select public.register_for_drive('f2000000-0000-0000-0000-000000000002', 30, false, '{}'::text[], null) $$,
  'P0011', null, 'Resident cannot register for another barangay medical drive');
select is((select stock_remaining from public.medical_drives where id = 'f2000000-0000-0000-0000-000000000002'), 5, 'Rejected medical registration preserves stock');
select isnt((select public.register_for_drive('f2000000-0000-0000-0000-000000000001', 30, false, '{}'::text[], null)), null, 'Resident can register for own barangay drive');

select throws_ok(
  $$ insert into public.evacuation_center_checkins (evacuation_center_id, user_id, barangay_id) values ('e2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001') $$,
  'P0011', null, 'Resident cannot check into another barangay center');
select throws_ok(
  $$ insert into public.evacuation_center_checkins (evacuation_center_id, user_id, barangay_id) values ('e2000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001') $$,
  'P0012', null, 'Resident cannot check into an inactive center');
select lives_ok(
  $$ insert into public.evacuation_center_checkins (evacuation_center_id, user_id, barangay_id) values ('e2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001') $$,
  'Resident can check into an active own-barangay center');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'b1000000-0000-0000-0000-00000000000c';
select throws_ok(
  $$ insert into public.evacuation_center_checkins (evacuation_center_id, user_id, barangay_id) values ('e2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-00000000000c', 'a1000000-0000-0000-0000-000000000001') $$,
  'P0010', null, 'Administrator cannot use the resident check-in path');

reset role;
select * from finish();
rollback;
