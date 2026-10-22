-- Resident iOS Phase 18 (P18-T05): the database half of account deletion contract v2 (migration 0136).
-- Everything, fixtures included, lives in one transaction that is rolled back.
begin;
select plan(56);

-- ===== Fixtures (run as the connecting owner role) =====
insert into public.barangays (id, name) values
  ('a1800000-0000-0000-0000-000000000001', 'P18 Barangay');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at) values
  ('b1800000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p18-a@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b1800000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p18-b@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b1800000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p18-old@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now());

insert into public.profiles (id, barangay_id, role, full_name) values
  ('b1800000-0000-0000-0000-00000000000a', 'a1800000-0000-0000-0000-000000000001', 'resident', 'P18 Resident A'),
  ('b1800000-0000-0000-0000-00000000000b', 'a1800000-0000-0000-0000-000000000001', 'resident', 'P18 Resident B'),
  ('b1800000-0000-0000-0000-00000000000c', 'a1800000-0000-0000-0000-000000000001', 'resident', 'P18 Old Anonymized');
update public.profiles set first_name = 'Maria', last_name = 'Santos', house_no = '1', street = 'Fixture Street', sex = 'female', employment_status = 'student',
  mobile_number = '09171234567', birth_date = '2000-01-01', email = 'maria@example.com', avatar_url = 'https://example.com/a.png', occupation = null
  where id in ('b1800000-0000-0000-0000-00000000000a', 'b1800000-0000-0000-0000-00000000000b');
-- Anonymized earlier by the version 1 flow, so it has no deletion request.
update public.profiles set deleted_at = now(), full_name = 'Deleted Resident' where id = 'b1800000-0000-0000-0000-00000000000c';

insert into public.id_submissions (id, resident_id, barangay_id, version, id_type, front_path, back_path) values
  ('f1800000-0000-0000-0000-0000000000a1', 'b1800000-0000-0000-0000-00000000000a', 'a1800000-0000-0000-0000-000000000001', 1, 'passport', 'b1800000-0000-0000-0000-00000000000a/front.jpg', 'b1800000-0000-0000-0000-00000000000a/back.jpg'),
  ('f1800000-0000-0000-0000-0000000000b1', 'b1800000-0000-0000-0000-00000000000b', 'a1800000-0000-0000-0000-000000000001', 1, 'passport', 'b1800000-0000-0000-0000-00000000000b/front.jpg', 'b1800000-0000-0000-0000-00000000000b/back.jpg');
update public.profiles set current_id_submission_id = 'f1800000-0000-0000-0000-0000000000a1', approved_id_submission_id = 'f1800000-0000-0000-0000-0000000000a1' where id = 'b1800000-0000-0000-0000-00000000000a';
update public.profiles set current_id_submission_id = 'f1800000-0000-0000-0000-0000000000b1' where id = 'b1800000-0000-0000-0000-00000000000b';

insert into public.household_members (profile_id, name, relation) values
  ('b1800000-0000-0000-0000-00000000000a', 'Child A', 'child'), ('b1800000-0000-0000-0000-00000000000b', 'Child B', 'child');

insert into public.document_types (id, barangay_id, name, fee_centavos, processing_target_hours, is_active) values
  ('c1800000-0000-0000-0000-000000000001', 'a1800000-0000-0000-0000-000000000001', 'P18 Doc', 1000, 24, true);
-- A version 1 request, and a version 2 request that must keep pointing at a verified ID submission.
insert into public.service_requests (id, barangay_id, resident_id, document_type_id, requester_notes, id_document_path) values
  ('d1800000-0000-0000-0000-0000000000a1', 'a1800000-0000-0000-0000-000000000001', 'b1800000-0000-0000-0000-00000000000a', 'c1800000-0000-0000-0000-000000000001', 'call me at 0917', 'b1800000-0000-0000-0000-00000000000a/id.jpg'),
  ('d1800000-0000-0000-0000-0000000000b1', 'a1800000-0000-0000-0000-000000000001', 'b1800000-0000-0000-0000-00000000000b', 'c1800000-0000-0000-0000-000000000001', 'keep my note', null);
alter table public.service_requests disable trigger a_guard_request_foundations;
insert into public.service_requests (id, barangay_id, resident_id, document_type_id, requester_notes, contract_version, idempotency_key, submission_payload, approved_id_submission_id, purpose_code, purpose_label,
  purpose_explanation, supporting_details, timing_model, target_minutes_snapshot, sla_state, fee_assessment_state, requirements_review_state, pricing_mode_snapshot) values
  ('d1800000-0000-0000-0000-0000000000a2', 'a1800000-0000-0000-0000-000000000001', 'b1800000-0000-0000-0000-00000000000a', 'c1800000-0000-0000-0000-000000000001', 'v2 note', 2, 'a9180000-0000-0000-0000-000000000001', '{"phone":"0917"}'::jsonb,
   'f1800000-0000-0000-0000-0000000000a1', 'employment', 'Employment', 'for my job at X', '{"employer":"X"}'::jsonb, 'agency_minutes_v1', 60, 'pre_processing', 'page_count_required', 'pending', 'per_page');
alter table public.service_requests enable trigger a_guard_request_foundations;
insert into public.payments (service_request_id, barangay_id, method, amount_centavos, status) values
  ('d1800000-0000-0000-0000-0000000000a1', 'a1800000-0000-0000-0000-000000000001', 'pickup', 1000, 'pending');
insert into public.request_attachments (request_id, resident_id, barangay_id, requirement_code, object_path, mime_type, size_bytes) values
  ('d1800000-0000-0000-0000-0000000000a1', 'b1800000-0000-0000-0000-00000000000a', 'a1800000-0000-0000-0000-000000000001', 'other', 'b1800000-0000-0000-0000-00000000000a/proof.pdf', 'application/pdf', 1000),
  ('d1800000-0000-0000-0000-0000000000b1', 'b1800000-0000-0000-0000-00000000000b', 'a1800000-0000-0000-0000-000000000001', 'other', 'b1800000-0000-0000-0000-00000000000b/proof.pdf', 'application/pdf', 1000);

insert into public.incident_categories (id, barangay_id, name) values ('e1800000-0000-0000-0000-0000000000a1', 'a1800000-0000-0000-0000-000000000001', 'P18 Category');
insert into public.incidents (id, barangay_id, reporter_id, category_id, title, location, status, photo_urls) values
  ('a1810000-0000-0000-0000-0000000000a1', 'a1800000-0000-0000-0000-000000000001', 'b1800000-0000-0000-0000-00000000000a', 'e1800000-0000-0000-0000-0000000000a1', 'A report', '{"lat":14.6,"lng":121.1}', 'open', array['https://example.com/storage/v1/object/public/incident-photos/b1800000-0000-0000-0000-00000000000a/p.jpg']),
  ('a1810000-0000-0000-0000-0000000000b1', 'a1800000-0000-0000-0000-000000000001', 'b1800000-0000-0000-0000-00000000000b', 'e1800000-0000-0000-0000-0000000000a1', 'B report', '{"lat":14.6,"lng":121.1}', 'open', array['https://example.com/b.jpg']);
insert into public.incident_confirmations (incident_id, user_id) values ('a1810000-0000-0000-0000-0000000000b1', 'b1800000-0000-0000-0000-00000000000a');

insert into public.medical_drives (id, barangay_id, title, type, drive_date, time_start, time_end, eligible_criteria, stock_total, stock_remaining) values
  ('91800000-0000-0000-0000-000000000001', 'a1800000-0000-0000-0000-000000000001', 'P18 Drive', 'vaccination', current_date + 7, '08:00', '12:00', 'All', 10, 8);
insert into public.drive_registrations (drive_id, user_id, applicant_number, age, is_pwd, comorbidities, status) values
  ('91800000-0000-0000-0000-000000000001', 'b1800000-0000-0000-0000-00000000000a', 'VAC-1', 25, false, array['asthma'], 'pending'),
  ('91800000-0000-0000-0000-000000000001', 'b1800000-0000-0000-0000-00000000000b', 'VAC-2', 30, false, '{}', 'pending');

insert into public.evacuation_centers (id, barangay_id, name, position) values ('81800000-0000-0000-0000-000000000001', 'a1800000-0000-0000-0000-000000000001', 'P18 Center', '{"lat":14.6,"lng":121.1}');
insert into public.evacuation_center_checkins (evacuation_center_id, user_id, barangay_id) values
  ('81800000-0000-0000-0000-000000000001', 'b1800000-0000-0000-0000-00000000000a', 'a1800000-0000-0000-0000-000000000001'),
  ('81800000-0000-0000-0000-000000000001', 'b1800000-0000-0000-0000-00000000000b', 'a1800000-0000-0000-0000-000000000001');
insert into public.push_tokens (user_id, expo_push_token, device_type) values
  ('b1800000-0000-0000-0000-00000000000a', 'ExponentPushToken[p18-a]', 'ios'), ('b1800000-0000-0000-0000-00000000000b', 'ExponentPushToken[p18-b]', 'ios');
insert into public.announcements (id, barangay_id, title, body) values ('71800000-0000-0000-0000-000000000001', 'a1800000-0000-0000-0000-000000000001', 'News', 'Body');
insert into public.announcement_reads (resident_id, announcement_id) values
  ('b1800000-0000-0000-0000-00000000000a', '71800000-0000-0000-0000-000000000001'), ('b1800000-0000-0000-0000-00000000000b', '71800000-0000-0000-0000-000000000001');
insert into public.notification_preferences (user_id, kinds) values ('b1800000-0000-0000-0000-00000000000a', '{"payment": false}'::jsonb);
-- A status change creates a notification event and an inbox row for the requester (migration 0135).
update public.service_requests set status = 'in_progress' where id in ('d1800000-0000-0000-0000-0000000000a1', 'd1800000-0000-0000-0000-0000000000b1');

create or replace function pg_temp.denied(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;
grant execute on function pg_temp.denied(text) to public;
create or replace function pg_temp.failure_code(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return null; exception when others then return sqlstate; end $$;
grant execute on function pg_temp.failure_code(text) to public;

-- ===== 1. Surface =====
select is((select relrowsecurity from pg_class where oid = 'public.account_deletion_requests'::regclass), true, 'Deletion requests have row level security');
select is((select has_table_privilege('authenticated', 'public.account_deletion_requests', 'select')), false, 'Residents cannot read deletion requests directly');
select is((select has_function_privilege('anon', 'public.erase_own_account_records()', 'execute')), false, 'Anonymous cannot erase records');
select is((select has_function_privilege('authenticated', 'public.erase_own_account_records()', 'execute')), true, 'A signed-in resident can request erasure of their own records');
select is((select has_function_privilege('authenticated', 'public.set_account_deletion_state(uuid,text,text)', 'execute')), false, 'Residents cannot set the deletion state');
select is((select has_function_privilege('service_role', 'public.set_account_deletion_state(uuid,text,text)', 'execute')), true, 'The service role can set the deletion state');
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and has_function_privilege('anon', p.oid, 'execute') and p.proname in ('erase_own_account_records', 'set_account_deletion_state')), 0, 'Neither deletion routine is anonymous-executable');

-- ===== 2. Authentication gates =====
select is(pg_temp.failure_code('select public.erase_own_account_records()'), 'P0001', 'Without a session the request is refused');

set local role authenticated;
set local request.jwt.claims = '{"sub":"b1800000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1800000-0000-0000-0000-00000000000a';
select is(pg_temp.failure_code('select public.erase_own_account_records()'), '42501', 'A session without a recent authentication is refused');
select is(pg_temp.failure_code('select public.erase_own_account_records()'), '42501', 'The refusal is repeatable and changes nothing');
reset role;
select is((select count(*)::int from public.household_members where profile_id = 'b1800000-0000-0000-0000-00000000000a'), 1, 'A refused request erased nothing');
select is((select count(*)::int from public.account_deletion_requests), 0, 'A refused request recorded nothing');

set local role authenticated;
set local request.jwt.claims = '{"sub":"b1800000-0000-0000-0000-00000000000a","role":"authenticated","amr":[{"method":"password","timestamp":1}]}';
select is(pg_temp.failure_code('select public.erase_own_account_records()'), '42501', 'An old authentication timestamp is refused');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'b1800000-0000-0000-0000-00000000000a', 'role', 'authenticated',
  'amr', json_build_array(json_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint)))::text, true);
select is(public.erase_own_account_records(), 'profile_erased', 'A fresh authentication erases and reports the first step');
reset role;

-- ===== 3. The matrix: what is erased =====
select is((select count(*)::int from public.household_members where profile_id = 'b1800000-0000-0000-0000-00000000000a'), 0, 'Household members are erased');
select is((select count(*)::int from public.id_submissions where resident_id = 'b1800000-0000-0000-0000-00000000000a'), 1, 'The one ID submission a version 2 request depends on is kept');
select is((select id_type = 'erased' and front_path like 'erased/%' and back_path like 'erased/%' and confirmed_details is null from public.id_submissions where id = 'f1800000-0000-0000-0000-0000000000a1'), true, 'It holds only tombstones instead of the ID type and file paths');
select is((select count(*)::int from public.request_attachments where resident_id = 'b1800000-0000-0000-0000-00000000000a'), 0, 'Request attachments are erased');
select is((select count(*)::int from public.drive_registrations where user_id = 'b1800000-0000-0000-0000-00000000000a'), 0, 'Medical drive registrations are erased');
select is((select count(*)::int from public.evacuation_center_checkins where user_id = 'b1800000-0000-0000-0000-00000000000a'), 0, 'Evacuation check-ins are erased');
select is((select count(*)::int from public.push_tokens where user_id = 'b1800000-0000-0000-0000-00000000000a'), 0, 'Push tokens are erased');
select is((select count(*)::int from public.announcement_reads where resident_id = 'b1800000-0000-0000-0000-00000000000a'), 0, 'Announcement read marks are erased');
select is((select count(*)::int from public.notification_preferences where user_id = 'b1800000-0000-0000-0000-00000000000a'), 0, 'Notification preferences are erased');
select is((select count(*)::int from public.notification_inbox where recipient_id = 'b1800000-0000-0000-0000-00000000000a'), 0, 'The notification inbox is erased');
select is((select count(*)::int from barangayan_private.notification_events where recipient_id = 'b1800000-0000-0000-0000-00000000000a'), 0, 'Notification events are erased');

-- ===== 4. The matrix: what is de-identified and kept =====
select is((select full_name from public.profiles where id = 'b1800000-0000-0000-0000-00000000000a'), 'Deleted Resident', 'The profile keeps only a neutral name');
select is((select count(*)::int from public.profiles where id = 'b1800000-0000-0000-0000-00000000000a' and deleted_at is not null and first_name is null and last_name is null and mobile_number is null
  and home_address is null and house_no is null and street is null and email is null and avatar_url is null and birth_date is null and sex is null and employment_status is null
  and id_type is null and id_verification_status is null and current_id_submission_id is null and approved_id_submission_id is null and household_members = '[]'::jsonb and verified_location is null), 1, 'Name parts, contact, address, birth date, avatar, ID fields and locations are cleared and the profile is marked deleted');
select is((select count(*)::int from public.service_requests where resident_id = 'b1800000-0000-0000-0000-00000000000a'), 2, 'Both document requests are kept');
select is((select count(*)::int from public.service_requests where id = 'd1800000-0000-0000-0000-0000000000a1' and requester_notes is null and id_document_path is null and submission_payload is null and supporting_details is null), 1, 'A version 1 request loses its free text and ID file reference');
select is((select count(*)::int from public.service_requests where id = 'd1800000-0000-0000-0000-0000000000a2' and requester_notes is null and purpose_explanation is null and submission_payload = '{"phone":"0917"}'::jsonb
  and supporting_details = '{}'::jsonb and approved_id_submission_id = 'f1800000-0000-0000-0000-0000000000a1' and purpose_label = 'Employment'), 1, 'A version 2 request loses its free text and supporting details but keeps its immutable payload, catalog purpose and verified ID reference');
select is((select count(*)::int from public.payments where service_request_id = 'd1800000-0000-0000-0000-0000000000a1'), 1, 'Its payment record is kept');
select is((select reporter_id is null and photo_urls = '{}' from public.incidents where id = 'a1810000-0000-0000-0000-0000000000a1'), true, 'The incident report is kept without its reporter link or photos');
select is((select count(*)::int from public.incident_confirmations where user_id = 'b1800000-0000-0000-0000-00000000000a'), 1, 'A corroboration is kept; its author is now an anonymous profile');

-- ===== 5. Other residents are untouched =====
select is((select count(*)::int from public.household_members where profile_id = 'b1800000-0000-0000-0000-00000000000b'), 1, 'Another resident household is untouched');
select is((select count(*)::int from public.id_submissions where resident_id = 'b1800000-0000-0000-0000-00000000000b'), 1, 'Another resident ID submission is untouched');
select is((select count(*)::int from public.drive_registrations where user_id = 'b1800000-0000-0000-0000-00000000000b'), 1, 'Another resident registration is untouched');
select is((select count(*)::int > 0 from public.notification_inbox where recipient_id = 'b1800000-0000-0000-0000-00000000000b'), true, 'Another resident inbox is untouched');
select is((select requester_notes from public.service_requests where id = 'd1800000-0000-0000-0000-0000000000b1'), 'keep my note', 'Another resident request text is untouched');
select is((select first_name from public.profiles where id = 'b1800000-0000-0000-0000-00000000000b'), 'Maria', 'Another resident profile is untouched');

-- ===== 6. State and retry =====
select is((select state from public.account_deletion_requests where user_id = 'b1800000-0000-0000-0000-00000000000a'), 'profile_erased', 'The request is recorded at the first step');
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1800000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is(public.erase_own_account_records(), 'profile_erased', 'A retry after the profile was erased needs no fresh authentication and converges');
reset role;
select is((select attempts from public.account_deletion_requests where user_id = 'b1800000-0000-0000-0000-00000000000a'), 2, 'The retry is counted');

set local role service_role;
select is(public.set_account_deletion_state('b1800000-0000-0000-0000-00000000000a', 'storage_cleaned'), 'storage_cleaned', 'Storage cleanup advances the state');
select is(public.set_account_deletion_state('b1800000-0000-0000-0000-00000000000a', 'profile_erased'), 'storage_cleaned', 'The state never moves backwards');
select is(public.set_account_deletion_state('b1800000-0000-0000-0000-00000000000a', 'needs_attention', repeat('x', 500)), 'needs_attention', 'A failure is recorded as needing attention');
select is((select char_length(last_error) from public.account_deletion_requests where user_id = 'b1800000-0000-0000-0000-00000000000a'), 200, 'The recorded reason is bounded');
select is(pg_temp.failure_code($$select public.set_account_deletion_state('b1800000-0000-0000-0000-00000000000a', 'deleted')$$), '22023', 'An unknown state is refused');
select is(pg_temp.failure_code($$select public.set_account_deletion_state('b1800000-0000-0000-0000-00000000000b', 'completed')$$), 'P0002', 'A deletion that was never requested cannot be completed');
select is(public.set_account_deletion_state('b1800000-0000-0000-0000-00000000000a', 'auth_revoked'), 'auth_revoked', 'A retry after a failure resumes forward');
select is(public.set_account_deletion_state('b1800000-0000-0000-0000-00000000000a', 'completed'), 'completed', 'Only the final step reports completed');
select is(public.set_account_deletion_state('b1800000-0000-0000-0000-00000000000a', 'needs_attention', 'late'), 'completed', 'A completed deletion is never reopened');
reset role;
select is((select completed_at is not null from public.account_deletion_requests where user_id = 'b1800000-0000-0000-0000-00000000000a'), true, 'Completion is timestamped');

set local role authenticated;
set local request.jwt.claims = '{"sub":"b1800000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is(public.erase_own_account_records(), 'completed', 'A request after completion reports completed and does nothing');
-- An account anonymized by the version 1 flow has no request to resume.
set local request.jwt.claims = '{"sub":"b1800000-0000-0000-0000-00000000000c","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1800000-0000-0000-0000-00000000000c';
select is(pg_temp.failure_code('select public.erase_own_account_records()'), 'P0002', 'An account already anonymized by the old flow has nothing to resume');
reset role;

-- ===== 7. An old token cannot keep acting =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1800000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1800000-0000-0000-0000-00000000000a';
select is(pg_temp.denied($$insert into public.service_requests (barangay_id, resident_id, document_type_id) values ('a1800000-0000-0000-0000-000000000001', 'b1800000-0000-0000-0000-00000000000a', 'c1800000-0000-0000-0000-000000000001')$$), true, 'A deleted account cannot file a document request');
select is(pg_temp.denied($$select public.upsert_push_token('ExponentPushToken[p18-new]', 'ios')$$), true, 'A deleted account cannot register a device');
reset role;

select * from finish();
rollback;
