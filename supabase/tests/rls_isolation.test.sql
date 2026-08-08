-- S0-11: two-tenant RLS isolation proof, run via `supabase test db` (local or
-- --linked). Everything in this file — fixtures included — lives inside one
-- transaction that's rolled back at the end, so it never leaves data behind even when
-- run against a live/linked project.
--
-- Proves (AGENTS.md §6 S0-11 / verification gate):
--   1. Resident A reads own service_requests; cannot read Resident B's (different barangay).
--   2. Resident A cannot read Resident B's barangay's announcements.
--   3. Resident A cannot INSERT into payments directly (post S0-1 / migration 0017).
--   4. Admin A can update service_requests in their own barangay; cannot update barangay B's.
--   5. Anon can read non-deleted announcements; cannot read soft-deleted ones (post S0-5).
begin;

select plan(8);

-- ============================================================================
-- Fixtures — two barangays, two residents, two admins, one document type and one
-- service_request per barangay, plus announcements (including one soft-deleted).
-- Runs as the connecting role (postgres/owner), which bypasses RLS, so no persona
-- switching is needed for setup.
-- ============================================================================
insert into public.barangays (id, name) values
  ('a0000000-0000-0000-0000-000000000001', 'RLS Test Barangay A'),
  ('a0000000-0000-0000-0000-000000000002', 'RLS Test Barangay B');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
) values
  ('b0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rls-resident-a@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rls-resident-b@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b0000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rls-admin-a@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now());

insert into public.profiles (id, barangay_id, role, full_name) values
  ('b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'resident', 'RLS Test Resident A'),
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000002', 'resident', 'RLS Test Resident B'),
  ('b0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000001', 'admin', 'RLS Test Admin A');

insert into public.document_types (id, barangay_id, name, fee_centavos, processing_target_hours) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'RLS Test Document A', 1000, 24),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'RLS Test Document B', 1000, 24);

insert into public.service_requests (id, barangay_id, resident_id, document_type_id) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-000000000002');

insert into public.announcements (id, barangay_id, title, body, category) values
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'RLS Test Active Announcement A', 'body', 'general'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'RLS Test Active Announcement B', 'body', 'general'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'RLS Test Soft-Deleted Announcement A', 'body', 'general');
update public.announcements set deleted_at = now() where id = 'e0000000-0000-0000-0000-000000000003';

-- ============================================================================
-- Persona: Resident A (barangay A)
-- ============================================================================
set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000a';

select results_eq(
  $$ select id from public.service_requests where id = 'd0000000-0000-0000-0000-000000000001' $$,
  $$ values ('d0000000-0000-0000-0000-000000000001'::uuid) $$,
  'Resident A can read their own service_requests'
);

select is_empty(
  $$ select id from public.service_requests where id = 'd0000000-0000-0000-0000-000000000002' $$,
  'Resident A cannot read Resident B''s (barangay B) service_requests'
);

select is_empty(
  $$ select id from public.announcements where id = 'e0000000-0000-0000-0000-000000000002' $$,
  'Resident A cannot read barangay B''s announcements'
);

select throws_ok(
  $$ insert into public.payments (service_request_id, barangay_id, method, amount_centavos, status)
     values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'qrph', 1000, 'paid') $$,
  '42501',
  null,
  'Resident A cannot INSERT into payments directly (post migration 0017)'
);

-- ============================================================================
-- Persona: Admin A (barangay A)
-- ============================================================================
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000c';

update public.service_requests
  set requester_notes = 'touched by admin A'
  where id = 'd0000000-0000-0000-0000-000000000001';

update public.service_requests
  set requester_notes = 'should never apply'
  where id = 'd0000000-0000-0000-0000-000000000002';

-- ============================================================================
-- Back to the unrestricted connecting role to assert on the actual persisted state.
-- ============================================================================
reset role;

select results_eq(
  $$ select requester_notes from public.service_requests where id = 'd0000000-0000-0000-0000-000000000001' $$,
  $$ values ('touched by admin A'::text) $$,
  'Admin A can update service_requests in their own barangay'
);

select is(
  (select requester_notes from public.service_requests where id = 'd0000000-0000-0000-0000-000000000002'),
  null,
  'Admin A cannot update service_requests in barangay B'
);

-- ============================================================================
-- Persona: anon (guest, no session)
-- ============================================================================
set local role anon;

select results_eq(
  $$ select id from public.announcements where id in (
       'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002'
     ) order by id $$,
  $$ values ('e0000000-0000-0000-0000-000000000001'::uuid), ('e0000000-0000-0000-0000-000000000002'::uuid) $$,
  'Anon can read non-deleted announcements across barangays'
);

select is_empty(
  $$ select id from public.announcements where id = 'e0000000-0000-0000-0000-000000000003' $$,
  'Anon cannot read a soft-deleted announcement (post S0-5 / migration 0019)'
);

reset role;

select * from finish();

rollback;
