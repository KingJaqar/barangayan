-- Resident iOS Phase 17 (P17-T01/T02/T03/T07): inbox, outbox, preferences, event creation and
-- the sender (worker) contract of migration 0135. Everything, fixtures included, lives in one
-- transaction that is rolled back.
begin;
select plan(121);

-- ===== Fixtures (run as the connecting owner role) =====
insert into public.barangays (id, name) values
  ('a1700000-0000-0000-0000-000000000001', 'P17 Barangay A'),
  ('a1700000-0000-0000-0000-000000000002', 'P17 Barangay B');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at) values
  ('b1700000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p17-a@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b1700000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p17-a2@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b1700000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p17-b@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b1700000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p17-admin@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b1700000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p17-deleted@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now());

insert into public.profiles (id, barangay_id, role, full_name) values
  ('b1700000-0000-0000-0000-00000000000a', 'a1700000-0000-0000-0000-000000000001', 'resident', 'P17 Resident A'),
  ('b1700000-0000-0000-0000-0000000000a2', 'a1700000-0000-0000-0000-000000000001', 'resident', 'P17 Resident A2'),
  ('b1700000-0000-0000-0000-00000000000b', 'a1700000-0000-0000-0000-000000000002', 'resident', 'P17 Resident B'),
  ('b1700000-0000-0000-0000-00000000000c', 'a1700000-0000-0000-0000-000000000001', 'admin', 'P17 Admin A'),
  ('b1700000-0000-0000-0000-00000000000d', 'a1700000-0000-0000-0000-000000000001', 'resident', 'P17 Deleted Resident');

update public.profiles set first_name='Test',last_name='Resident',house_no='1',street='Fixture Street',
  sex='female',employment_status='student',mobile_number='09171234567',birth_date='2000-01-01'
  where id in ('b1700000-0000-0000-0000-00000000000a','b1700000-0000-0000-0000-0000000000a2',
               'b1700000-0000-0000-0000-00000000000b','b1700000-0000-0000-0000-00000000000d');
update public.profiles set deleted_at = now() where id = 'b1700000-0000-0000-0000-00000000000d';

insert into public.document_types (id, barangay_id, name, fee_centavos, processing_target_hours, is_active) values
  ('c1700000-0000-0000-0000-000000000001', 'a1700000-0000-0000-0000-000000000001', 'P17 Doc A', 1000, 24, true);
insert into public.service_requests (id, barangay_id, resident_id, document_type_id) values
  ('d1700000-0000-0000-0000-000000000001', 'a1700000-0000-0000-0000-000000000001', 'b1700000-0000-0000-0000-00000000000a', 'c1700000-0000-0000-0000-000000000001'),
  ('d1700000-0000-0000-0000-000000000002', 'a1700000-0000-0000-0000-000000000001', 'b1700000-0000-0000-0000-00000000000a', 'c1700000-0000-0000-0000-000000000001');
insert into public.incident_categories (id, barangay_id, name) values
  ('e1700000-0000-0000-0000-0000000000a1', 'a1700000-0000-0000-0000-000000000001', 'P17 Category A');
insert into public.incidents (id, barangay_id, reporter_id, category_id, title, location, status) values
  ('a1710000-0000-0000-0000-0000000000a1', 'a1700000-0000-0000-0000-000000000001', 'b1700000-0000-0000-0000-00000000000a', 'e1700000-0000-0000-0000-0000000000a1', 'P17 A incident', '{"lat":14.6,"lng":121.1}', 'open');

create or replace function pg_temp.denied(p_sql text) returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return true;
end $$;
grant execute on function pg_temp.denied(text) to public;

create or replace function pg_temp.inbox_count(p_recipient uuid, p_key text) returns integer language sql as $$
  select count(*)::int from barangayan_private.notification_events e join public.notification_inbox i on i.event_id = e.id
   where e.recipient_id = p_recipient and e.dedupe_key = p_key
$$;
grant execute on function pg_temp.inbox_count(uuid, text) to public;

-- ===== 1. Schema surface =====
select is((select relrowsecurity from pg_class where oid = 'public.notification_inbox'::regclass), true, 'Inbox has row level security');
select is((select relrowsecurity from pg_class where oid = 'public.notification_preferences'::regclass), true, 'Preferences have row level security');
select is((select count(*)::int from information_schema.tables where table_schema = 'barangayan_private' and table_name in ('notification_events','notification_outbox','notification_deliveries')), 3, 'Events, outbox and deliveries are private');
select is((select has_table_privilege('authenticated', 'barangayan_private.notification_outbox', 'select')), false, 'Residents cannot read the outbox');
select is((select has_table_privilege('anon', 'public.notification_inbox', 'select')), false, 'Anonymous cannot read the inbox');
select is((select has_column_privilege('authenticated', 'public.notification_inbox', 'title', 'update')), false, 'Residents cannot change inbox text');
select is((select has_column_privilege('authenticated', 'public.notification_inbox', 'read_at', 'update')), true, 'Residents can change inbox read state');
select is((select has_table_privilege('authenticated', 'public.notification_inbox', 'insert')), false, 'Residents cannot create inbox rows');
select is((select has_table_privilege('authenticated', 'public.notification_inbox', 'delete')), false, 'Residents cannot delete inbox rows');
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'notification_worker_%'
  and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))), 0, 'Sender functions are not executable through the API roles');
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'notification_worker_%'
  and has_function_privilege('service_role', p.oid, 'execute')), 7, 'Sender functions are executable by service_role');
select is((select has_function_privilege('anon', 'public.set_notification_preferences(boolean,jsonb)', 'execute')), false, 'Anonymous cannot set preferences');
select is((select has_function_privilege('anon', 'public.release_push_token(text)', 'execute')), true, 'A signed-out device can release its push token (offline-logout recovery)');
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
  and (p.proname in ('set_notification_preferences') or p.proname like 'notification_worker_%')), 0, 'No other notification routine in the public schema is anonymous-executable');
select is((select has_function_privilege('authenticated', 'barangayan_private.emit_notification(uuid[],uuid,text,text,uuid,text,text,text)', 'execute')), false, 'Residents cannot emit notifications');

-- ===== 2. Event creation (source changes made by the owner role, as a staff/webhook path) =====
update public.service_requests set status = 'in_progress' where id = 'd1700000-0000-0000-0000-000000000001';
select is(pg_temp.inbox_count('b1700000-0000-0000-0000-00000000000a', 'request:d1700000-0000-0000-0000-000000000001:status:in_progress'), 1, 'A request status change notifies the requester once');
select is((select destination from public.notification_inbox where recipient_id = 'b1700000-0000-0000-0000-00000000000a' and kind = 'request_status' order by created_at limit 1),
  '{"v":1,"kind":"request","id":"d1700000-0000-0000-0000-000000000001"}'::jsonb, 'The destination is a versioned reference only');
select is((select count(*)::int from public.notification_inbox where recipient_id <> 'b1700000-0000-0000-0000-00000000000a' and kind = 'request_status'), 0, 'Nobody else is notified of a request change');
select is((select state from barangayan_private.notification_outbox o join public.notification_inbox i on i.id = o.inbox_id where i.recipient_id = 'b1700000-0000-0000-0000-00000000000a' and i.kind = 'request_status'), 'pending', 'A pending outbox row is created with the inbox row');
update public.service_requests set status = 'in_progress' where id = 'd1700000-0000-0000-0000-000000000001';
select is(pg_temp.inbox_count('b1700000-0000-0000-0000-00000000000a', 'request:d1700000-0000-0000-0000-000000000001:status:in_progress'), 1, 'An unchanged status does not repeat the notification');
update public.service_requests set status = 'ready_for_pickup' where id = 'd1700000-0000-0000-0000-000000000001';
select is((select title from public.notification_inbox where recipient_id = 'b1700000-0000-0000-0000-00000000000a' and kind = 'request_status' and body like '%pickup%'), 'Request ready', 'Ready for pickup has its own generic text');
select is((select count(*)::int from public.notification_inbox where kind = 'request_status' and (title ~* 'P17' or body ~* 'P17')), 0, 'Inbox text never copies source record text');
update public.service_requests set payment_status = 'paid' where id = 'd1700000-0000-0000-0000-000000000001';
select is(pg_temp.inbox_count('b1700000-0000-0000-0000-00000000000a', 'request:d1700000-0000-0000-0000-000000000001:payment:paid'), 1, 'A payment received notifies the requester');
select is((select i.kind from public.notification_inbox i join barangayan_private.notification_events e on e.id = i.event_id where e.dedupe_key = 'request:d1700000-0000-0000-0000-000000000001:payment:paid'), 'payment', 'Payment events have the payment kind');

update public.incidents set status = 'in_progress' where id = 'a1710000-0000-0000-0000-0000000000a1';
select is(pg_temp.inbox_count('b1700000-0000-0000-0000-00000000000a', 'incident:a1710000-0000-0000-0000-0000000000a1:status:in_progress'), 1, 'An incident status change notifies the reporter');
select is((select body from public.notification_inbox where recipient_id = 'b1700000-0000-0000-0000-00000000000a' and kind = 'incident_status'), 'Your report has a new status.', 'Incident text carries no title, address or reporter data');
update public.incidents set status = 'withdrawn' where id = 'a1710000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from public.notification_inbox where kind = 'incident_status'), 1, 'A withdrawal is the resident''s own action and is not notified');

insert into public.announcements (id, barangay_id, title, body, category) values
  ('f1700000-0000-0000-0000-0000000000a1', 'a1700000-0000-0000-0000-000000000001', 'P17 Secret Title', 'Body', 'general');
select is((select count(*)::int from public.notification_inbox i join barangayan_private.notification_events e on e.id = i.event_id where e.dedupe_key = 'announcement:f1700000-0000-0000-0000-0000000000a1'), 2, 'An announcement reaches the two active residents of its barangay');
select is((select count(*)::int from public.notification_inbox i join barangayan_private.notification_events e on e.id = i.event_id where e.dedupe_key = 'announcement:f1700000-0000-0000-0000-0000000000a1' and i.recipient_id in ('b1700000-0000-0000-0000-00000000000b','b1700000-0000-0000-0000-00000000000c','b1700000-0000-0000-0000-00000000000d')), 0, 'Other barangays, staff and deleted accounts receive nothing');
select is((select count(*)::int from public.notification_inbox where title ~* 'Secret' or body ~* 'Secret'), 0, 'An announcement preview never contains its title');
insert into public.announcements (id, barangay_id, title, body, category, published_at) values
  ('f1700000-0000-0000-0000-0000000000a2', 'a1700000-0000-0000-0000-000000000001', 'Future', 'Body', 'general', now() + interval '1 day');
select is((select count(*)::int from barangayan_private.notification_events where dedupe_key = 'announcement:f1700000-0000-0000-0000-0000000000a2'), 0, 'A not-yet-published announcement creates no event');

insert into public.medical_drives (id, barangay_id, title, type, drive_date, time_start, time_end, eligible_criteria, stock_total, stock_remaining) values
  ('f1700000-0000-0000-0000-0000000000d1', 'a1700000-0000-0000-0000-000000000001', 'P17 Drive', 'vaccination', current_date + 1, '08:00', '12:00', 'Residents', 5, 5);
select is((select count(*)::int from barangayan_private.notification_events where dedupe_key = 'drive:f1700000-0000-0000-0000-0000000000d1'), 2, 'A new active drive notifies the barangay''s two active residents');
insert into public.medical_drives (id, barangay_id, title, type, drive_date, time_start, time_end, eligible_criteria, stock_total, stock_remaining, is_active) values
  ('f1700000-0000-0000-0000-0000000000d2', 'a1700000-0000-0000-0000-000000000001', 'P17 Inactive', 'vaccination', current_date + 1, '08:00', '12:00', 'Residents', 5, 5, false);
select is((select count(*)::int from barangayan_private.notification_events where dedupe_key = 'drive:f1700000-0000-0000-0000-0000000000d2'), 0, 'An inactive drive creates no event');

insert into public.drive_registrations (id, drive_id, user_id, applicant_number, age, is_pwd, comorbidities) values
  ('f1700000-0000-0000-0000-0000000000e1', 'f1700000-0000-0000-0000-0000000000d1', 'b1700000-0000-0000-0000-00000000000a', 'P17-0001', 30, false, '{}');
select is((select count(*)::int from barangayan_private.notification_events where subject_id = 'f1700000-0000-0000-0000-0000000000e1'), 0, 'Creating a registration creates no event');
update public.drive_registrations set status = 'confirmed' where id = 'f1700000-0000-0000-0000-0000000000e1';
select is(pg_temp.inbox_count('b1700000-0000-0000-0000-00000000000a', 'registration:f1700000-0000-0000-0000-0000000000e1:status:confirmed'), 1, 'A registration update notifies the applicant');
select is((select destination->>'kind' from public.notification_inbox i join barangayan_private.notification_events e on e.id = i.event_id where e.subject_id = 'f1700000-0000-0000-0000-0000000000e1'), 'registration', 'Registration events point at the registration');

-- The helper rejects bad input at the boundary.
select throws_ok($$ select barangayan_private.emit_notification(array['b1700000-0000-0000-0000-00000000000a']::uuid[], 'a1700000-0000-0000-0000-000000000001', 'unknown_kind', 'request', gen_random_uuid(), 'k', 't', 'b') $$, '23514', null, 'An unknown kind is refused');
select throws_ok($$ select barangayan_private.emit_notification(array['b1700000-0000-0000-0000-00000000000a']::uuid[], 'a1700000-0000-0000-0000-000000000001', 'payment', 'url', gen_random_uuid(), 'k2', 't', 'b') $$, '23514', null, 'An unknown destination kind is refused');
select is(barangayan_private.emit_notification(array['b1700000-0000-0000-0000-00000000000a']::uuid[], 'a1700000-0000-0000-0000-000000000002', 'payment', 'request', gen_random_uuid(), 'k3', 't', 'b'), 0, 'A recipient from another barangay is dropped');
select is(barangayan_private.emit_notification(array['b1700000-0000-0000-0000-00000000000d']::uuid[], 'a1700000-0000-0000-0000-000000000001', 'payment', 'request', gen_random_uuid(), 'k4', 't', 'b'), 0, 'A deleted recipient is dropped');
select is(barangayan_private.emit_notification(array['b1700000-0000-0000-0000-00000000000c']::uuid[], 'a1700000-0000-0000-0000-000000000001', 'payment', 'request', gen_random_uuid(), 'k5', 't', 'b'), 0, 'A staff recipient is dropped');

-- ===== 3. Resident: own inbox only =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1700000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1700000-0000-0000-0000-00000000000a';

select is((select count(*)::int from public.notification_inbox where recipient_id <> 'b1700000-0000-0000-0000-00000000000a'), 0, 'A resident sees only their own inbox rows');
select cmp_ok((select count(*)::int from public.notification_inbox), '>', 4, 'A resident sees their own rows');
select is((select count(*)::int from public.notification_inbox where read_at is not null), 0, 'Nothing starts read');
select lives_ok($$ update public.notification_inbox set read_at = now() where id = (select id from public.notification_inbox where kind = 'payment') $$, 'A resident can mark their own row read');
select is((select count(*)::int from public.notification_inbox where read_at is not null), 1, 'The read state is stored');
select is((select count(*)::int from public.announcement_reads), 0, 'Inbox read state does not touch announcement reads');
select is((select count(*)::int from public.incidents where resolved_read_at is not null), 0, 'Inbox read state does not touch resolved report reads');
select lives_ok($$ update public.notification_inbox set read_at = null where kind = 'payment' $$, 'A resident can mark their own row unread');
select throws_ok($$ update public.notification_inbox set title = 'edited' where kind = 'payment' $$, '42501', null, 'A resident cannot edit inbox text');
select throws_ok($$ update public.notification_inbox set destination = '{"v":1,"kind":"request","id":"d1700000-0000-0000-0000-000000000002"}' where kind = 'payment' $$, '42501', null, 'A resident cannot redirect a notification');
select throws_ok($$ insert into public.notification_inbox(event_id, recipient_id, kind, title, body, destination) values (gen_random_uuid(), 'b1700000-0000-0000-0000-00000000000a', 'payment', 't', 'b', '{"v":1,"kind":"request","id":"d1700000-0000-0000-0000-000000000002"}') $$, '42501', null, 'A resident cannot create an inbox row');
select throws_ok($$ delete from public.notification_inbox $$, '42501', null, 'A resident cannot delete inbox rows');
select throws_ok($$ select count(*) from barangayan_private.notification_outbox $$, '42501', null, 'A resident cannot read the outbox');
select throws_ok($$ select * from public.notification_worker_claim(10) $$, '42501', null, 'A resident cannot claim outbox rows');

-- Another resident cannot touch these rows.
set local request.jwt.claims = '{"sub":"b1700000-0000-0000-0000-0000000000a2","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1700000-0000-0000-0000-0000000000a2';
select is((select count(*)::int from public.notification_inbox where kind in ('payment','request_status','incident_status')), 0, 'Another resident cannot see these rows');
update public.notification_inbox set read_at = now() where kind = 'payment';
select is((select count(*)::int from (select 1 from public.notification_inbox where read_at is not null) x), 0, 'Another resident''s update matches nothing');
reset role;
select is((select count(*)::int from public.notification_inbox where kind = 'payment' and read_at is not null), 0, 'The owner''s row was not changed by another resident');

-- Cross-tenant resident sees none of barangay A's announcement rows.
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1700000-0000-0000-0000-00000000000b","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1700000-0000-0000-0000-00000000000b';
select is((select count(*)::int from public.notification_inbox), 0, 'A resident of another barangay has an empty inbox');
reset role;

-- Own actions are not notified.
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1700000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1700000-0000-0000-0000-00000000000a';
select lives_ok($$ update public.drive_registrations set status = 'cancelled' where id = 'f1700000-0000-0000-0000-0000000000e1' $$, 'A resident can cancel their own registration');
reset role;
select is((select count(*)::int from barangayan_private.notification_events where dedupe_key = 'registration:f1700000-0000-0000-0000-0000000000e1:status:cancelled'), 0, 'The resident''s own cancellation is not notified');

-- ===== 4. Preferences =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1700000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1700000-0000-0000-0000-00000000000a';
select is((select push_enabled from public.set_notification_preferences(true, '{"announcement":false}')), true, 'Preferences can be saved');
select is((select kinds from public.set_notification_preferences(null, '{"payment":false}')), '{"announcement":false,"payment":false}'::jsonb, 'Kinds merge with earlier choices');
select is((select kinds from public.notification_preferences where user_id = 'b1700000-0000-0000-0000-00000000000a'), '{"announcement":false,"payment":false}'::jsonb, 'The resident can read their saved kinds');
select is((select push_enabled from public.set_notification_preferences(false, null)), false, 'The global switch can be turned off');
select is((select push_notifications_enabled from public.profiles where id = 'b1700000-0000-0000-0000-00000000000a'), false, 'The switch is stored on the profile');
select throws_ok($$ select * from public.set_notification_preferences(null, '{"surprise":true}') $$, '22023', null, 'An unknown kind is refused');
select throws_ok($$ select * from public.set_notification_preferences(null, '{"payment":"yes"}') $$, '22023', null, 'A non-boolean value is refused');
select throws_ok($$ select * from public.set_notification_preferences(null, '[1]') $$, '22023', null, 'A non-object is refused');
select is((select count(*)::int from public.notification_preferences where user_id <> 'b1700000-0000-0000-0000-00000000000a'), 0, 'Preferences of others are not visible');
select throws_ok($$ insert into public.notification_preferences(user_id, kinds) values ('b1700000-0000-0000-0000-00000000000a', '{}') $$, '42501', null, 'Preferences cannot be written directly');
select lives_ok($$ select public.upsert_push_token('ExponentPushToken[p17-device-a]', 'ios') $$, 'Token registration still works');
select lives_ok($$ select public.release_push_token('ExponentPushToken[p17-device-a]') $$, 'A signed-in resident can release a token');
select is((select count(*)::int from public.push_tokens where expo_push_token = 'ExponentPushToken[p17-device-a]'), 0, 'The released token is gone');
select lives_ok($$ select public.upsert_push_token('ExponentPushToken[p17-device-a]', 'ios') $$, 'Token can be registered again');
set local request.jwt.claims = '{"sub":"b1700000-0000-0000-0000-0000000000a2","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1700000-0000-0000-0000-0000000000a2';
select lives_ok($$ select public.release_push_token('ExponentPushToken[p17-device-a]') $$, 'A token can be released by whoever holds it, whichever account owned it');
reset role;
select is((select count(*)::int from public.push_tokens where expo_push_token = 'ExponentPushToken[p17-device-a]'), 0, 'The token is gone');
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1700000-0000-0000-0000-00000000000d","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1700000-0000-0000-0000-00000000000d';
select throws_ok($$ select * from public.set_notification_preferences(true, null) $$, '42501', null, 'A deleted account cannot save preferences');
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.jwt.claim.sub = '';
select is((select pg_temp.denied($$ select * from public.set_notification_preferences(true, null) $$)), true, 'Anonymous cannot save preferences');
reset role;

-- A signed-out device removes its own token by holding it.
insert into public.push_tokens(user_id, expo_push_token, device_type) values ('b1700000-0000-0000-0000-00000000000a', 'ExponentPushToken[p17-signed-out]', 'ios');
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.jwt.claim.sub = '';
select lives_ok($$ select public.release_push_token('ExponentPushToken[p17-signed-out]') $$, 'A signed-out device can release its token');
select lives_ok($$ select public.release_push_token('ExponentPushToken[p17-never-registered]') $$, 'An unknown token answers the same way (no oracle)');
select throws_ok($$ select public.release_push_token('not-a-token') $$, '22023', null, 'A malformed token is refused');
select throws_ok($$ select public.release_push_token(null) $$, '22023', null, 'A missing token is refused');
reset role;
select is((select count(*)::int from public.push_tokens where expo_push_token = 'ExponentPushToken[p17-signed-out]'), 0, 'The anonymous release removed the token');

-- ===== 5. Sender: claim applies preferences at send time =====
-- Resident A is opted out (global switch off above); A2 has no token; give A2 a token and an event.
update public.profiles set push_notifications_enabled = true where id = 'b1700000-0000-0000-0000-00000000000a';
delete from public.push_tokens where user_id = 'b1700000-0000-0000-0000-00000000000a';
update public.notification_preferences set kinds = '{"announcement":false}' where user_id = 'b1700000-0000-0000-0000-00000000000a';
insert into public.push_tokens(user_id, expo_push_token, device_type) values
  ('b1700000-0000-0000-0000-0000000000a2', 'ExponentPushToken[p17-device-a2]', 'ios');
-- Hold every other outbox row back so the claim below only sees what this test creates.
update barangayan_private.notification_outbox set next_attempt_at = now() + interval '1 day';
select barangayan_private.emit_notification(array['b1700000-0000-0000-0000-0000000000a2']::uuid[], 'a1700000-0000-0000-0000-000000000001', 'payment', 'request', 'd1700000-0000-0000-0000-000000000001', 'claim:1', 'Payment update', 'Your payment was received.');
select barangayan_private.emit_notification(array['b1700000-0000-0000-0000-00000000000a']::uuid[], 'a1700000-0000-0000-0000-000000000001', 'payment', 'request', 'd1700000-0000-0000-0000-000000000001', 'claim:2', 'Payment update', 'Your payment was received.');
select barangayan_private.emit_notification(array['b1700000-0000-0000-0000-00000000000a']::uuid[], 'a1700000-0000-0000-0000-000000000001', 'announcement', 'announcement', 'f1700000-0000-0000-0000-0000000000a1', 'claim:3', 'New announcement', 'Your barangay posted a new announcement.');

set local role service_role;
create temp table claimed on commit drop as select * from public.notification_worker_claim(50);
reset role;
select is((select count(*)::int from claimed), 1, 'Only the deliverable row is claimed');
select is((select tokens from claimed), array['ExponentPushToken[p17-device-a2]'], 'The claim carries the resident''s current tokens');
select is((select attempt from claimed), 1, 'The first claim is attempt one');
select is((select state from barangayan_private.notification_outbox o join public.notification_inbox i on i.id = o.inbox_id join barangayan_private.notification_events e on e.id = i.event_id where e.dedupe_key = 'claim:2'), 'skipped', 'A resident without a token is skipped');
select is((select last_error from barangayan_private.notification_outbox o join public.notification_inbox i on i.id = o.inbox_id join barangayan_private.notification_events e on e.id = i.event_id where e.dedupe_key = 'claim:2'), 'no_token', 'The skip reason is recorded');
select is((select last_error from barangayan_private.notification_outbox o join public.notification_inbox i on i.id = o.inbox_id join barangayan_private.notification_events e on e.id = i.event_id where e.dedupe_key = 'claim:3'), 'kind_off', 'A kind the resident turned off is skipped at send time');
update public.profiles set push_notifications_enabled = false where id = 'b1700000-0000-0000-0000-0000000000a2';
select barangayan_private.emit_notification(array['b1700000-0000-0000-0000-0000000000a2']::uuid[], 'a1700000-0000-0000-0000-000000000001', 'payment', 'request', 'd1700000-0000-0000-0000-000000000001', 'claim:4', 'Payment update', 'Your payment was received.');
set local role service_role;
select is((select count(*)::int from public.notification_worker_claim(50)), 0, 'An opted-out resident is not claimed');
reset role;
select is((select last_error from barangayan_private.notification_outbox o join public.notification_inbox i on i.id = o.inbox_id join barangayan_private.notification_events e on e.id = i.event_id where e.dedupe_key = 'claim:4'), 'opted_out', 'The opt-out is applied when the row is claimed');
select is((select count(*)::int from public.notification_inbox i join barangayan_private.notification_events e on e.id = i.event_id where e.dedupe_key = 'claim:4'), 1, 'The opted-out resident still has the inbox row');

-- ===== 6. Sender: tickets, retries, receipts =====
update public.profiles set push_notifications_enabled = true where id = 'b1700000-0000-0000-0000-0000000000a2';
insert into public.push_tokens(user_id, expo_push_token, device_type) values
  ('b1700000-0000-0000-0000-0000000000a2', 'ExponentPushToken[p17-device-a2b]', 'ios');
select barangayan_private.emit_notification(array['b1700000-0000-0000-0000-0000000000a2']::uuid[], 'a1700000-0000-0000-0000-000000000001', 'payment', 'request', 'd1700000-0000-0000-0000-000000000001', 'ticket:1', 'Payment update', 'Your payment was received.');
set local role service_role;
create temp table claimed2 on commit drop as select * from public.notification_worker_claim(50);
select is((select count(*)::int from claimed2), 1, 'A second deliverable row is claimed');
select is((select cardinality(tokens) from claimed2), 2, 'All of the resident''s tokens are included');
select is((select public.notification_worker_record_tickets((select outbox_id from claimed2), jsonb_build_array(
  jsonb_build_object('token','ExponentPushToken[p17-device-a2]','status','ok','id','ticket-1'),
  jsonb_build_object('token','ExponentPushToken[p17-device-a2b]','status','error','error','DeviceNotRegistered')))), 'sent', 'One accepted ticket marks the row sent');
reset role;
select is((select count(*)::int from public.push_tokens where expo_push_token = 'ExponentPushToken[p17-device-a2b]'), 0, 'A DeviceNotRegistered ticket removes that token');
select is((select count(*)::int from public.push_tokens where expo_push_token = 'ExponentPushToken[p17-device-a2]'), 1, 'The accepted token stays');
select is((select count(*)::int from barangayan_private.notification_deliveries where state = 'accepted'), 1, 'The accepted ticket is stored for the receipt check');
set local role service_role;
select throws_ok($$ select public.notification_worker_record_tickets((select outbox_id from claimed2), '[]'::jsonb) $$, 'P0002', null, 'Tickets cannot be recorded twice for a finished row');
select is((select count(*)::int from public.notification_worker_due_receipts(10)), 0, 'A fresh ticket has no receipt due yet');
reset role;
update barangayan_private.notification_deliveries set sent_at = now() - interval '20 minutes' where state = 'accepted';
set local role service_role;
create temp table due on commit drop as select * from public.notification_worker_due_receipts(10);
select is((select ticket_id from due), 'ticket-1', 'A receipt is due after fifteen minutes');
select is((select public.notification_worker_record_receipts(jsonb_build_array(jsonb_build_object('delivery_id',(select delivery_id from due),'status','ok')))), 1, 'A receipt is recorded');
reset role;
select is((select state from barangayan_private.notification_deliveries where ticket_id = 'ticket-1'), 'provider_ok', 'An ok receipt means the provider took it, not that the phone showed it');
select is((select count(*)::int from public.notification_inbox where read_at is not null), 0, 'Delivery never changes inbox read state');

-- A receipt error removes the dead token.
insert into public.push_tokens(user_id, expo_push_token, device_type) values ('b1700000-0000-0000-0000-0000000000a2', 'ExponentPushToken[p17-device-a2c]', 'ios');
insert into barangayan_private.notification_deliveries(outbox_id, expo_push_token, ticket_id, state, sent_at)
  select outbox_id, 'ExponentPushToken[p17-device-a2c]', 'ticket-2', 'accepted', now() - interval '20 minutes' from claimed2;
create temp table ticket2 on commit drop as select id from barangayan_private.notification_deliveries where ticket_id = 'ticket-2';
grant select on ticket2 to public;
set local role service_role;
select is((select public.notification_worker_record_receipts(jsonb_build_array(jsonb_build_object('delivery_id',(select id from ticket2),'status','error','error','DeviceNotRegistered')))), 1, 'An error receipt is recorded');
reset role;
select is((select count(*)::int from public.push_tokens where expo_push_token = 'ExponentPushToken[p17-device-a2c]'), 0, 'A DeviceNotRegistered receipt removes the token');
set local role service_role;
select throws_ok($$ select public.notification_worker_record_receipts('[{"delivery_id":"not-a-uuid","status":"ok"}]'::jsonb) $$, '22023', null, 'A malformed receipt is refused');
select throws_ok($$ select public.notification_worker_record_tickets(gen_random_uuid(), '{}'::jsonb) $$, '22023', null, 'Tickets must be an array');
reset role;

-- Retries back off and stop at five attempts.
select barangayan_private.emit_notification(array['b1700000-0000-0000-0000-0000000000a2']::uuid[], 'a1700000-0000-0000-0000-000000000001', 'payment', 'request', 'd1700000-0000-0000-0000-000000000001', 'retry:1', 'Payment update', 'Your payment was received.');
update barangayan_private.notification_outbox set next_attempt_at = now() + interval '1 day' where state = 'pending' and inbox_id not in (select i.id from public.notification_inbox i join barangayan_private.notification_events e on e.id = i.event_id where e.dedupe_key = 'retry:1');
set local role service_role;
create temp table retry1 on commit drop as select * from public.notification_worker_claim(50);
select is((select public.notification_worker_fail((select outbox_id from retry1), 'provider_unreachable')), 'pending', 'A failed send goes back to pending');
reset role;
select is((select next_attempt_at > now() + interval '30 seconds' and next_attempt_at < now() + interval '5 minutes' from barangayan_private.notification_outbox where id = (select outbox_id from retry1)), true, 'The first retry waits about a minute');
update barangayan_private.notification_outbox set next_attempt_at = now() where id = (select outbox_id from retry1);
set local role service_role;
select is((select count(*)::int from public.notification_worker_claim(50)), 1, 'It is claimed again when due');
select is((select public.notification_worker_fail((select outbox_id from retry1), 'provider_unreachable')), 'pending', 'The second failure retries again');
reset role;
update barangayan_private.notification_outbox set attempt_count = 5, state = 'sending', claimed_at = now() where id = (select outbox_id from retry1);
set local role service_role;
select is((select public.notification_worker_fail((select outbox_id from retry1), 'provider_unreachable ExponentPushToken[p17-secret]')), 'dead', 'The fifth failure ends in dead');
reset role;
select is((select last_error from barangayan_private.notification_outbox where id = (select outbox_id from retry1)), 'provider_unreachable [token]', 'Stored errors never contain a token');

-- A crashed worker's claim is picked up again after five minutes.
select barangayan_private.emit_notification(array['b1700000-0000-0000-0000-0000000000a2']::uuid[], 'a1700000-0000-0000-0000-000000000001', 'payment', 'request', 'd1700000-0000-0000-0000-000000000001', 'stale:1', 'Payment update', 'Your payment was received.');
update barangayan_private.notification_outbox set next_attempt_at = now() + interval '1 day' where state = 'pending' and inbox_id not in (select i.id from public.notification_inbox i join barangayan_private.notification_events e on e.id = i.event_id where e.dedupe_key = 'stale:1');
set local role service_role;
create temp table stale1 on commit drop as select * from public.notification_worker_claim(50);
select is((select count(*)::int from public.notification_worker_claim(50)), 0, 'A row being sent is not claimed twice');
reset role;
update barangayan_private.notification_outbox set claimed_at = now() - interval '10 minutes' where id = (select outbox_id from stale1);
set local role service_role;
select is((select attempt from public.notification_worker_claim(50)), 2, 'An abandoned claim is retried as the next attempt');

-- Health and retention.
select is((select pending_total >= 0 and dead_last_24h >= 1 from public.notification_worker_health()), true, 'Health reports dead rows');
reset role;
update public.notification_inbox set read_at = now() - interval '100 days' where id = (select i.id from public.notification_inbox i join barangayan_private.notification_events e on e.id = i.event_id where e.dedupe_key = 'claim:4');
update barangayan_private.notification_outbox set finished_at = now() - interval '40 days' where state in ('skipped','dead');
set local role service_role;
select is((select inbox_deleted from public.notification_worker_purge()), 1, 'Read inbox rows are purged ninety days after reading');
reset role;
select is((select count(*)::int from barangayan_private.notification_outbox where state in ('skipped','dead') and finished_at < now() - interval '30 days'), 0, 'Old finished outbox rows are purged');
select is((select count(*)::int from public.notification_inbox i join barangayan_private.notification_events e on e.id = i.event_id where e.dedupe_key = 'claim:1'), 1, 'Unread inbox rows are kept');

select * from finish();
rollback;
