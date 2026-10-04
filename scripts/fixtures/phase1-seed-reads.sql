-- Runs only after the normal development seed, never on a hosted database.
begin;
set local search_path = public, extensions;
select plan(12);
select is((select count(*) from public.barangays), 1::bigint, 'fresh seed creates exactly the pilot tenant');
select is((select count(*) from public.barangay_localities where display_name='Ampid 1' and city='San Mateo' and province='Rizal' and resident_registration_enabled), 1::bigint, 'fresh registration locality is configured');
select is((select count(*) from public.profiles where id='00000000-0000-0000-0000-000000000010' and role='resident'), 1::bigint, 'Auth trigger provisions the seeded resident');
select ok((select encrypted_password like '$2%' from auth.users where id='00000000-0000-0000-0000-000000000010'), 'development password is stored as bcrypt');
select is((select count(*) from public.incident_categories), 5::bigint, 'seed creates required incident categories');
select ok(exists(select 1 from public.document_types) and not exists(select 1 from public.document_types where contract_version<>1), 'seed retains the legacy catalog contract');
select is((select count(*) from public.evacuation_centers), 4::bigint, 'centers precede check-in references');
select is((select count(*) from public.evacuation_center_checkins), 3::bigint, 'fixed check-in IDs prevent duplicate retries');
select is((select count(*) from public.emergency_information), 6::bigint, 'guidelines and hotlines use valid stable IDs');
select is((select count(*) from public.emergency_qr_content), 2::bigint, 'QR content uses valid IDs');
select is((select count(*) from public.service_requests), 0::bigint, 'fresh seed does not invent document requests');
select is((select count(*) from public.id_submissions), 0::bigint, 'seed does not invent identity approvals');
select * from finish();
rollback;
