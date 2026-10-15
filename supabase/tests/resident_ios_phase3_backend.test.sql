-- Resident iOS Phase 3 (P03-T02/T05/T06/T07): two-tenant, role and negative-post-state
-- proof of the write boundaries the iOS workflows depend on. Everything, fixtures
-- included, lives in one transaction that is rolled back.
--
-- Covers: incident create/update/confirm/withdraw, announcement read state, push token
-- ownership, evacuation check-in receipt, direct request-insert bypass, resident-callable
-- surface (anon and administrator-only operations) and deleted/inactive principals.
begin;
select plan(86);

-- ===== Fixtures (run as the connecting owner role) =====
insert into public.barangays (id, name) values
  ('a3000000-0000-0000-0000-000000000001', 'P3 Barangay A'),
  ('a3000000-0000-0000-0000-000000000002', 'P3 Barangay B');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at) values
  ('b3000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p3-a@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b3000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p3-a2@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b3000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p3-b@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b3000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p3-admin@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b3000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p3-deleted@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now());

insert into public.profiles (id, barangay_id, role, full_name) values
  ('b3000000-0000-0000-0000-00000000000a', 'a3000000-0000-0000-0000-000000000001', 'resident', 'P3 Resident A'),
  ('b3000000-0000-0000-0000-0000000000a2', 'a3000000-0000-0000-0000-000000000001', 'resident', 'P3 Resident A2'),
  ('b3000000-0000-0000-0000-00000000000b', 'a3000000-0000-0000-0000-000000000002', 'resident', 'P3 Resident B'),
  ('b3000000-0000-0000-0000-00000000000c', 'a3000000-0000-0000-0000-000000000001', 'admin', 'P3 Admin A'),
  ('b3000000-0000-0000-0000-00000000000d', 'a3000000-0000-0000-0000-000000000001', 'resident', 'P3 Deleted Resident');

update public.profiles set first_name='Test',last_name='Resident',house_no='1',street='Fixture Street',
  sex='female',employment_status='student',mobile_number='09171234567',birth_date='2000-01-01'
  where id in ('b3000000-0000-0000-0000-00000000000a','b3000000-0000-0000-0000-0000000000a2',
               'b3000000-0000-0000-0000-00000000000b','b3000000-0000-0000-0000-00000000000d');

insert into public.document_types (id, barangay_id, name, fee_centavos, processing_target_hours, is_active) values
  ('c3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'P3 Doc A', 1000, 24, true),
  ('c3000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000002', 'P3 Doc B', 1000, 24, true),
  ('c3000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000001', 'P3 Doc A inactive', 1000, 24, false);

insert into public.service_requests (id, barangay_id, resident_id, document_type_id) values
  ('d3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-00000000000a', 'c3000000-0000-0000-0000-000000000001');

insert into public.incident_categories (id, barangay_id, name) values
  ('e3000000-0000-0000-0000-0000000000a1', 'a3000000-0000-0000-0000-000000000001', 'P3 Category A'),
  ('e3000000-0000-0000-0000-0000000000b1', 'a3000000-0000-0000-0000-000000000002', 'P3 Category B');
insert into public.waste_zones (id, barangay_id, name) values
  ('e3000000-0000-0000-0000-0000000000a2', 'a3000000-0000-0000-0000-000000000001', 'P3 Zone A'),
  ('e3000000-0000-0000-0000-0000000000b2', 'a3000000-0000-0000-0000-000000000002', 'P3 Zone B');

insert into public.announcements (id, barangay_id, title, body, category) values
  ('f3000000-0000-0000-0000-0000000000a1', 'a3000000-0000-0000-0000-000000000001', 'P3 Announcement A', 'Body', 'general'),
  ('f3000000-0000-0000-0000-0000000000b1', 'a3000000-0000-0000-0000-000000000002', 'P3 Announcement B', 'Body', 'general');

insert into public.evacuation_centers (id, barangay_id, name, position, is_active) values
  ('e3000000-0000-0000-0000-0000000000c1', 'a3000000-0000-0000-0000-000000000001', 'P3 Center A', '{"lat":14.6,"lng":121.1}', true),
  ('e3000000-0000-0000-0000-0000000000c2', 'a3000000-0000-0000-0000-000000000002', 'P3 Center B', '{"lat":14.7,"lng":121.2}', true),
  ('e3000000-0000-0000-0000-0000000000c3', 'a3000000-0000-0000-0000-000000000001', 'P3 Center A inactive', '{"lat":14.6,"lng":121.1}', false);

insert into public.medical_drives (id, barangay_id, title, type, drive_date, time_start, time_end, eligible_criteria, stock_total, stock_remaining) values
  ('f3000000-0000-0000-0000-0000000000d1', 'a3000000-0000-0000-0000-000000000001', 'P3 Open Drive', 'vaccination', current_date + 1, '08:00', '12:00', 'Residents', 1, 1),
  ('f3000000-0000-0000-0000-0000000000d2', 'a3000000-0000-0000-0000-000000000001', 'P3 Past Drive', 'vaccination', current_date - 3, '08:00', '12:00', 'Residents', 5, 5),
  ('f3000000-0000-0000-0000-0000000000d3', 'a3000000-0000-0000-0000-000000000001', 'P3 Full Drive', 'vaccination', current_date + 1, '08:00', '12:00', 'Residents', 5, 0);

-- An incident owned by Resident B (other tenant) and a resolved one owned by Resident A.
insert into public.incidents (id, barangay_id, reporter_id, category_id, title, location, status) values
  ('a3300000-0000-0000-0000-0000000000b1', 'a3000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-00000000000b', 'e3000000-0000-0000-0000-0000000000b1', 'P3 B incident', '{"lat":14.7,"lng":121.2}', 'open'),
  ('a3300000-0000-0000-0000-0000000000a9', 'a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-00000000000a', 'e3000000-0000-0000-0000-0000000000a1', 'P3 A resolved', '{"lat":14.6,"lng":121.1}', 'resolved');

-- Helper: true when the statement raises (used for operations whose exact SQLSTATE is
-- not part of the contract, only that they are denied).
create or replace function pg_temp.denied(p_sql text) returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return true;
end $$;
grant execute on function pg_temp.denied(text) to public;

-- ===== 1. Incidents: create =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"b3000000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local request.jwt.claim.sub = 'b3000000-0000-0000-0000-00000000000a';

select lives_ok($$ insert into public.incidents (id, barangay_id, reporter_id, category_id, zone_id, title, description, location, photo_urls)
  values ('a3300000-0000-0000-0000-0000000000a1', 'a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-00000000000a',
  'e3000000-0000-0000-0000-0000000000a1', 'e3000000-0000-0000-0000-0000000000a2', 'P3 own incident', 'Detail', '{"lat":14.6,"lng":121.1}',
  array['https://x.test/storage/v1/object/public/incident-photos/b3000000-0000-0000-0000-00000000000a/one.jpg']) $$,
  'Resident can create an own-tenant incident with a client-chosen id');
select throws_ok($$ insert into public.incidents (id, barangay_id, reporter_id, title, location)
  values ('a3300000-0000-0000-0000-0000000000a1', 'a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-00000000000a', 'P3 replay', '{"lat":14.6,"lng":121.1}') $$,
  '23505', null, 'Replaying the same incident id is rejected, so retry reconciliation finds the first row');
select throws_ok($$ insert into public.incidents (barangay_id, reporter_id, title, location, confirmation_count)
  values ('a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-00000000000a', 'P3 inflated', '{"lat":14.6,"lng":121.1}', 50) $$,
  null, null, 'A resident cannot create an incident with a preset confirmation count');
select throws_ok($$ insert into public.incidents (barangay_id, reporter_id, title, location, status)
  values ('a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-00000000000a', 'P3 resolved', '{"lat":14.6,"lng":121.1}', 'resolved') $$,
  null, null, 'A resident cannot create an incident in a non-open status');
select throws_ok($$ insert into public.incidents (barangay_id, reporter_id, category_id, title, location)
  values ('a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-00000000000a', 'e3000000-0000-0000-0000-0000000000b1', 'P3 foreign category', '{"lat":14.6,"lng":121.1}') $$,
  null, null, 'An incident cannot reference another barangay category');
select throws_ok($$ insert into public.incidents (barangay_id, reporter_id, zone_id, title, location)
  values ('a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-00000000000a', 'e3000000-0000-0000-0000-0000000000b2', 'P3 foreign zone', '{"lat":14.6,"lng":121.1}') $$,
  null, null, 'An incident cannot reference another barangay waste zone');
select throws_ok($$ insert into public.incidents (barangay_id, reporter_id, title, location, photo_urls)
  values ('a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-00000000000a', 'P3 foreign photo', '{"lat":14.6,"lng":121.1}',
  array['https://x.test/storage/v1/object/public/incident-photos/b3000000-0000-0000-0000-00000000000b/other.jpg']) $$,
  null, null, 'An incident cannot attach another resident photo path');
select throws_ok($$ insert into public.incidents (barangay_id, reporter_id, title, location, photo_urls)
  values ('a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-00000000000a', 'P3 six photos', '{"lat":14.6,"lng":121.1}',
  array(select 'https://x.test/storage/v1/object/public/incident-photos/b3000000-0000-0000-0000-00000000000a/' || g || '.jpg' from generate_series(1,6) g)) $$,
  null, null, 'An incident accepts at most five photos');
select throws_ok($$ insert into public.incidents (barangay_id, reporter_id, title, location)
  values ('a3000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-00000000000a', 'P3 foreign tenant', '{"lat":14.6,"lng":121.1}') $$,
  null, null, 'A resident cannot create an incident in another barangay');
select throws_ok($$ insert into public.incidents (barangay_id, reporter_id, title, location)
  values ('a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-0000000000a2', 'P3 forged reporter', '{"lat":14.6,"lng":121.1}') $$,
  null, null, 'A resident cannot create an incident for another reporter');

-- ===== 2. Incidents: resident update boundary =====
select throws_ok($$ update public.incidents set confirmation_count = 99 where id = 'a3300000-0000-0000-0000-0000000000a1' $$,
  null, null, 'A reporter cannot set the confirmation count');
select throws_ok($$ update public.incidents set status = 'resolved' where id = 'a3300000-0000-0000-0000-0000000000a1' $$,
  null, null, 'A reporter cannot resolve their own incident');
select throws_ok($$ update public.incidents set barangay_id = 'a3000000-0000-0000-0000-000000000002' where id = 'a3300000-0000-0000-0000-0000000000a1' $$,
  null, null, 'A reporter cannot move an incident to another barangay');
select throws_ok($$ update public.incidents set category_id = 'e3000000-0000-0000-0000-0000000000b1' where id = 'a3300000-0000-0000-0000-0000000000a1' $$,
  null, null, 'A reporter cannot re-point an incident to a foreign category');
select throws_ok($$ update public.incidents set title = 'edited' where id = 'a3300000-0000-0000-0000-0000000000a1' $$,
  null, null, 'A reporter cannot edit a submitted incident');
select lives_ok($$ update public.incidents set resolved_read_at = now() where id = 'a3300000-0000-0000-0000-0000000000a9' $$,
  'A reporter can mark their resolved incident read');
select throws_ok($$ update public.incidents set status = 'open' where id = 'a3300000-0000-0000-0000-0000000000a9' $$,
  null, null, 'A reporter cannot reopen a resolved incident');
select lives_ok($$ select public.withdraw_incident('a3300000-0000-0000-0000-0000000000a1') $$,
  'A reporter can withdraw an own open incident through the contract RPC');

reset role;
select is((select confirmation_count from public.incidents where id = 'a3300000-0000-0000-0000-0000000000a1'), 0,
  'Rejected writes left the confirmation count unchanged');
select is((select status from public.incidents where id = 'a3300000-0000-0000-0000-0000000000a1'), 'withdrawn',
  'The RPC withdrawal committed');
select is((select count(*)::int from public.incidents where title like 'P3 %' and reporter_id = 'b3000000-0000-0000-0000-00000000000a' and id <> 'a3300000-0000-0000-0000-0000000000a1' and id <> 'a3300000-0000-0000-0000-0000000000a9'), 0,
  'No rejected create left a row behind');

-- ===== 3. Confirmation (corroboration) =====
update public.incidents set status = 'open', deleted_at = null where id = 'a3300000-0000-0000-0000-0000000000a1';
set local role authenticated;
set local request.jwt.claims = '{"sub":"b3000000-0000-0000-0000-00000000000b","role":"authenticated"}';
set local request.jwt.claim.sub = 'b3000000-0000-0000-0000-00000000000b';
select throws_ok($$ select public.confirm_incident('a3300000-0000-0000-0000-0000000000a1') $$,
  null, null, 'A resident of another barangay cannot corroborate');
select throws_ok($$ select public.withdraw_incident('a3300000-0000-0000-0000-0000000000a1') $$,
  null, null, 'A resident of another barangay cannot withdraw');

set local request.jwt.claims = '{"sub":"b3000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
set local request.jwt.claim.sub = 'b3000000-0000-0000-0000-0000000000a2';
select is((select public.confirm_incident('a3300000-0000-0000-0000-0000000000a1')), true, 'A same-barangay resident can corroborate once');
select is((select public.confirm_incident('a3300000-0000-0000-0000-0000000000a1')), false, 'A second corroboration is a no-op');
select throws_ok($$ select public.withdraw_incident('a3300000-0000-0000-0000-0000000000a1') $$,
  null, null, 'A non-reporter cannot withdraw');
select throws_ok($$ insert into public.incident_confirmations (incident_id, user_id) values ('a3300000-0000-0000-0000-0000000000a1', 'b3000000-0000-0000-0000-0000000000a2') $$,
  null, null, 'Confirmations cannot be inserted directly');

reset role;
select is((select confirmation_count from public.incidents where id = 'a3300000-0000-0000-0000-0000000000a1'), 1,
  'Exactly one confirmation was counted');

set local role authenticated;
set local request.jwt.claims = '{"sub":"b3000000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local request.jwt.claim.sub = 'b3000000-0000-0000-0000-00000000000a';
select throws_ok($$ select public.confirm_incident('a3300000-0000-0000-0000-0000000000a1') $$,
  null, null, 'A reporter cannot corroborate their own report');

-- ===== 4. Announcement read state =====
select throws_ok($$ insert into public.announcement_reads (resident_id, announcement_id) values ('b3000000-0000-0000-0000-00000000000a', 'f3000000-0000-0000-0000-0000000000b1') $$,
  null, null, 'A resident cannot record a read for another barangay announcement');
select lives_ok($$ insert into public.announcement_reads (resident_id, announcement_id) values ('b3000000-0000-0000-0000-00000000000a', 'f3000000-0000-0000-0000-0000000000a1') $$,
  'A resident can record a read for an own-barangay announcement');
select throws_ok($$ insert into public.announcement_reads (resident_id, announcement_id) values ('b3000000-0000-0000-0000-0000000000a2', 'f3000000-0000-0000-0000-0000000000a1') $$,
  null, null, 'A resident cannot record a read for another resident');

-- ===== 5. Direct service-request insert bypass =====
select throws_ok($$ insert into public.service_requests (barangay_id, resident_id, document_type_id)
  values ('a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-00000000000a', 'c3000000-0000-0000-0000-000000000002') $$,
  null, null, 'A request cannot reference another barangay document type');
select throws_ok($$ insert into public.service_requests (barangay_id, resident_id, document_type_id)
  values ('a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-00000000000a', 'c3000000-0000-0000-0000-000000000003') $$,
  null, null, 'A request cannot reference an inactive document type');
select throws_ok($$ insert into public.service_requests (barangay_id, resident_id, document_type_id, status, payment_status)
  values ('a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-00000000000a', 'c3000000-0000-0000-0000-000000000001', 'completed', 'paid') $$,
  null, null, 'A resident cannot create a request that is already completed or paid');
-- No resident UPDATE policy exists, so the write is filtered (zero rows) rather than raised.
select lives_ok($$ update public.service_requests set status = 'completed', payment_status = 'paid' where id = 'd3000000-0000-0000-0000-000000000001' $$,
  'A resident status/payment update on their own request is filtered by row security');
select throws_ok($$ insert into public.payments (service_request_id, barangay_id, method, amount_centavos, status, paid_at)
  values ('d3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'pickup', 1, 'paid', now()) $$,
  '42501', null, 'A resident cannot insert a payment row, including a forged paid one');
select is((select pg_temp.denied($$ select public.collect_pickup_payment('d3000000-0000-0000-0000-000000000001') $$)), true,
  'A resident cannot collect a pickup payment');
select is((select pg_temp.denied($$ select public.assess_service_request_fee('{"requestId":"d3000000-0000-0000-0000-000000000001","amountCentavos":0}'::jsonb) $$)), true,
  'A resident cannot assess a fee');
select is((select pg_temp.denied($$ select public.review_service_request('{"requestId":"d3000000-0000-0000-0000-000000000001","decision":"approve"}'::jsonb) $$)), true,
  'A resident cannot review a request');
select is((select pg_temp.denied($$ select public.transition_service_request_sla('{"requestId":"d3000000-0000-0000-0000-000000000001","action":"accept"}'::jsonb) $$)), true,
  'A resident cannot drive the SLA clock');
select is((select pg_temp.denied($$ select public.review_id_submission('{"submissionId":"d3000000-0000-0000-0000-000000000001","decision":"approve"}'::jsonb) $$)), true,
  'A resident cannot review an ID submission');
select is((select pg_temp.denied($$ select public.mark_request_ready_for_pickup('d3000000-0000-0000-0000-000000000001') $$)), true,
  'A resident cannot mark a request ready');
select is((select pg_temp.denied($$ select public.complete_service_request('d3000000-0000-0000-0000-000000000001') $$)), true,
  'A resident cannot complete a request');
select is((select pg_temp.denied($$ select public.update_incident_status('a3300000-0000-0000-0000-0000000000a1', 'resolved') $$)), true,
  'A resident cannot change incident status through the staff RPC');
select is((select pg_temp.denied($$ select public.admin_register_for_drive('b3000000-0000-0000-0000-0000000000a2', gen_random_uuid(), 30, false, '{}'::text[], null) $$)), true,
  'A resident cannot use the staff drive-registration RPC');

-- ===== 6. Profile boundary =====
select throws_ok($$ update public.profiles set role = 'admin' where id = 'b3000000-0000-0000-0000-00000000000a' $$,
  null, null, 'A resident cannot escalate their role');
select throws_ok($$ update public.profiles set barangay_id = 'a3000000-0000-0000-0000-000000000002' where id = 'b3000000-0000-0000-0000-00000000000a' $$,
  null, null, 'A resident cannot change their barangay');
select throws_ok($$ update public.profiles set id_verification_status = 'verified' where id = 'b3000000-0000-0000-0000-00000000000a' $$,
  null, null, 'A resident cannot self-verify their ID');

-- ===== 7. Medical registration =====
select throws_ok($$ insert into public.drive_registrations (drive_id, user_id, age, is_pwd, comorbidities) values (gen_random_uuid(), 'b3000000-0000-0000-0000-00000000000a', 30, false, '{}') $$,
  null, null, 'Registrations cannot be inserted directly by a resident');
select throws_ok($$ select public.register_for_drive('f3000000-0000-0000-0000-0000000000d1', 30, false, '{}'::text[], current_date + 2) $$,
  '22023', 'invalid_prior_dose_date', 'A future prior-dose date is rejected');
select throws_ok($$ select public.register_for_drive('f3000000-0000-0000-0000-0000000000d1', 30, false, array['None','Diabetes'], null) $$,
  '22023', 'invalid_comorbidities', 'None cannot be combined with a condition');
select throws_ok($$ select public.register_for_drive('f3000000-0000-0000-0000-0000000000d1', 131, false, '{}'::text[], null) $$,
  '22023', 'invalid_age', 'An age above 130 is rejected');
select throws_ok($$ select public.register_for_drive('f3000000-0000-0000-0000-0000000000d2', 30, false, '{}'::text[], null) $$,
  'P0005', null, 'A drive whose date has passed is closed');
select throws_ok($$ select public.register_for_drive('f3000000-0000-0000-0000-0000000000d3', 30, false, '{}'::text[], null) $$,
  'P0003', null, 'An exhausted drive rejects registration');
select ok((select (public.register_for_drive('f3000000-0000-0000-0000-0000000000d1', 30, false, array['Diabetes'], current_date - 40))::jsonb ->> 'applicant_number' like 'VAC-%'),
  'A valid self registration returns the committed applicant number');
select throws_ok($$ select public.register_for_drive('f3000000-0000-0000-0000-0000000000d1', 30, false, '{}'::text[], null) $$,
  'P0004', null, 'A duplicate registration is rejected');
reset role;
select is((select stock_remaining from public.medical_drives where id = 'f3000000-0000-0000-0000-0000000000d1'), 0,
  'Exactly one slot was consumed by the rejected and accepted attempts');
set local role authenticated;
set local request.jwt.claims = '{"sub":"b3000000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local request.jwt.claim.sub = 'b3000000-0000-0000-0000-00000000000a';

-- ===== 8. Push token ownership =====
select lives_ok($$ select public.upsert_push_token('ExponentPushToken[p3-shared-device]', 'ios') $$,
  'A resident can register a push token');
select throws_ok($$ select public.upsert_push_token('not-a-token', 'ios') $$,
  null, null, 'A malformed push token is rejected');
select throws_ok($$ select public.upsert_push_token('ExponentPushToken[p3-other]', 'windows') $$,
  null, null, 'An unsupported device type is rejected');

set local request.jwt.claims = '{"sub":"b3000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
set local request.jwt.claim.sub = 'b3000000-0000-0000-0000-0000000000a2';
select lives_ok($$ select public.upsert_push_token('ExponentPushToken[p3-shared-device]', 'ios') $$,
  'A second account on the same device can register the same token');
reset role;
select is((select status || '/' || payment_status from public.service_requests where id = 'd3000000-0000-0000-0000-000000000001'), 'submitted/pending',
  'The filtered resident update changed nothing');
select is((select count(*)::int from public.push_tokens where expo_push_token = 'ExponentPushToken[p3-shared-device]'), 1,
  'A token has exactly one current owner');
select is((select user_id from public.push_tokens where expo_push_token = 'ExponentPushToken[p3-shared-device]'), 'b3000000-0000-0000-0000-0000000000a2'::uuid,
  'The most recent registrant owns the token');

-- ===== 9. Evacuation check-in receipt =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"b3000000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local request.jwt.claim.sub = 'b3000000-0000-0000-0000-00000000000a';
select is((select (public.check_in_to_evacuation_center('e3000000-0000-0000-0000-0000000000c1')).already_checked_in), false,
  'Check-in returns a first-time receipt');
select is((select (public.check_in_to_evacuation_center('e3000000-0000-0000-0000-0000000000c1')).already_checked_in), true,
  'A repeated check-in returns the existing receipt');
select throws_ok($$ select public.check_in_to_evacuation_center('e3000000-0000-0000-0000-0000000000c2') $$,
  'P0011', null, 'Check-in rejects another barangay center');
select throws_ok($$ select public.check_in_to_evacuation_center('e3000000-0000-0000-0000-0000000000c3') $$,
  'P0012', null, 'Check-in rejects an inactive center');
select throws_ok($$ select public.check_in_to_evacuation_center(gen_random_uuid()) $$,
  'P0012', null, 'Check-in rejects an unknown center');
reset role;
select is((select count(*)::int from public.evacuation_center_checkins where user_id = 'b3000000-0000-0000-0000-00000000000a'), 1,
  'Exactly one check-in row exists after the repeated and rejected attempts');

set local role authenticated;
set local request.jwt.claims = '{"sub":"b3000000-0000-0000-0000-00000000000c","role":"authenticated"}';
set local request.jwt.claim.sub = 'b3000000-0000-0000-0000-00000000000c';
select throws_ok($$ select public.check_in_to_evacuation_center('e3000000-0000-0000-0000-0000000000c1') $$,
  'P0010', null, 'An administrator cannot use the resident check-in');

-- ===== 10. Deleted account =====
reset role;
update public.profiles set deleted_at = now() where id = 'b3000000-0000-0000-0000-00000000000d';
set local role authenticated;
set local request.jwt.claims = '{"sub":"b3000000-0000-0000-0000-00000000000d","role":"authenticated"}';
set local request.jwt.claim.sub = 'b3000000-0000-0000-0000-00000000000d';
select throws_ok($$ select public.confirm_incident('a3300000-0000-0000-0000-0000000000a1') $$,
  null, null, 'A deleted account cannot corroborate');
select throws_ok($$ select public.upsert_push_token('ExponentPushToken[p3-deleted]', 'ios') $$,
  null, null, 'A deleted account cannot register a push token');
select throws_ok($$ select public.check_in_to_evacuation_center('e3000000-0000-0000-0000-0000000000c1') $$,
  'P0010', null, 'A deleted account cannot check in');

-- ===== 11. Anonymous execution surface =====
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.jwt.claim.sub = '';
select is((select pg_temp.denied($$ select public.confirm_incident('a3300000-0000-0000-0000-0000000000a1') $$)), true, 'Anonymous cannot corroborate');
select is((select pg_temp.denied($$ select public.upsert_push_token('ExponentPushToken[anon]', 'ios') $$)), true, 'Anonymous cannot register a push token');
select is((select pg_temp.denied($$ select public.recompute_waste_zone_scores() $$)), true, 'Anonymous cannot recompute waste-zone scores');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'payments' and cmd = 'INSERT' and policyname like 'residents%'), 0, 'No resident insert policy exists on payments');
select is((select has_function_privilege('anon', 'public.check_in_to_evacuation_center(uuid)', 'execute')), false, 'Anonymous cannot execute the check-in RPC');
select is((select has_function_privilege('anon', 'public.request_own_account_deletion()', 'execute')), false, 'Anonymous cannot execute account deletion');
select is((select has_function_privilege('anon', 'public.withdraw_incident(uuid)', 'execute')), false, 'Anonymous cannot execute incident withdrawal');
select is((select has_function_privilege('anon', 'public.soft_delete_incident(uuid)', 'execute')), false, 'Anonymous cannot execute incident soft delete');
select is((select has_function_privilege('anon', 'public.save_about_us_with_developers(uuid,text,text,text,text,text,text,text,jsonb,boolean,integer,integer,text)', 'execute')), false, 'Anonymous cannot execute About Us publishing');
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype
  and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
  and p.proname in ('guard_drive_registration_tenant','guard_evacuation_checkin_tenant','guard_id_verification_status','guard_role_escalation',
    'handle_household_member_updated_at','handle_new_user','prevent_verification_field_update','sync_barangay_official')), 0,
  'Security-definer trigger functions are not executable through the API roles');
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
  and has_function_privilege('anon', p.oid, 'execute')
  and p.proname not in ('current_barangay_id','current_role','get_routing_conditions_snapshot')), 0,
  'The only anonymous-executable security-definer routines are the policy helpers and the public routing snapshot');

reset role;
select * from finish();
rollback;
