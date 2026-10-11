begin;
select no_plan();
update public.barangay_localities set resident_registration_enabled=false;
insert into public.barangays(id,name) values ('a6070000-0000-0000-0000-000000000001','Lifecycle Local');
insert into public.barangay_localities values ('a6070000-0000-0000-0000-000000000001','Ampid 1','San Mateo','Rizal',true);
-- Representative pre-migration users and replay-safe upgrade/backfill.
insert into auth.users(id,email,encrypted_password) values
 ('b6070000-0000-0000-0000-000000000004','backfill-hash@local.test','preserved-legacy-hash'),
 ('b6070000-0000-0000-0000-000000000005','backfill-empty@local.test',null);
-- Remove only these synthetic lifecycle rows to model pre-migration state.
delete from barangayan_private.resident_account_lifecycle where user_id in
 ('b6070000-0000-0000-0000-000000000004','b6070000-0000-0000-0000-000000000005');
insert into barangayan_private.resident_account_lifecycle(user_id,registration_origin,password_set,password_evidence)
select u.id,'legacy',case when coalesce(u.encrypted_password,'')='' then false else null end,
 case when coalesce(u.encrypted_password,'')='' then 'absent' else 'unknown_initial_hash' end
from auth.users u on conflict(user_id) do nothing;
select is((select password_set from barangayan_private.resident_account_lifecycle where user_id='b6070000-0000-0000-0000-000000000004'),null::boolean,'Backfill retains unknown legacy credential provenance');
select is((select password_set from barangayan_private.resident_account_lifecycle where user_id='b6070000-0000-0000-0000-000000000005'),false,'Backfill recognizes absent credential');
select is((select encrypted_password from auth.users where id='b6070000-0000-0000-0000-000000000004'),'preserved-legacy-hash','Backfill never writes existing credentials');
insert into auth.users(id,email,encrypted_password,raw_user_meta_data,raw_app_meta_data) values
 ('b6070000-0000-0000-0000-000000000001','otp@local.test','initial-generated-hash','{"resident_registration_origin":"email_otp"}','{}'),
 ('b6070000-0000-0000-0000-000000000002','legacy@local.test','unproven-existing-hash','{}','{}'),
 ('b6070000-0000-0000-0000-000000000003','google@local.test',null,'{}','{"provider":"google"}');
select is((select registration_origin from barangayan_private.resident_account_lifecycle where user_id='b6070000-0000-0000-0000-000000000003'),'google','Server Google creation metadata records Google origin');
select is((select password_set from barangayan_private.resident_account_lifecycle where user_id='b6070000-0000-0000-0000-000000000001'),false,'Generated OTP hash is not a chosen password');
select is((select password_set from barangayan_private.resident_account_lifecycle where user_id='b6070000-0000-0000-0000-000000000002'),null::boolean,'Unknown initial hash is never assumed chosen');
update auth.users set encrypted_password='second-creation-hash' where id='b6070000-0000-0000-0000-000000000001';
select is((select password_set from barangayan_private.resident_account_lifecycle where user_id='b6070000-0000-0000-0000-000000000001'),false,'Creation transaction hash rewrites remain unset');
update auth.users set raw_user_meta_data='{"resident_registration_origin":"google","passwordSet":true,"role":"admin"}' where id='b6070000-0000-0000-0000-000000000001';
select is((select registration_origin from barangayan_private.resident_account_lifecycle where user_id='b6070000-0000-0000-0000-000000000001'),'email_otp','Metadata changes cannot change origin');
-- SQL fixture simulates a later committed Auth transaction; the HTTP integration
-- separately verifies real GoTrue creation/setup/change/recovery boundaries.
update barangayan_private.resident_account_lifecycle set creation_transaction=null where user_id='b6070000-0000-0000-0000-000000000001';
update auth.users set encrypted_password='chosen-server-write' where id='b6070000-0000-0000-0000-000000000001';
select is((select password_set from barangayan_private.resident_account_lifecycle where user_id='b6070000-0000-0000-0000-000000000001'),true,'Later Auth credential write is observed atomically');
insert into auth.identities(id,user_id,provider_id,provider,identity_data) values
 ('c6070000-0000-0000-0000-000000000001','b6070000-0000-0000-0000-000000000001','linked-email','google','{"given_name":"Linked","family_name":"Resident"}'),
 ('c6070000-0000-0000-0000-000000000003','b6070000-0000-0000-0000-000000000003','google-only','google','{"given_name":"Google","family_name":"Resident"}');
select is((select registration_origin from barangayan_private.resident_account_lifecycle where user_id='b6070000-0000-0000-0000-000000000001'),'email_otp','Google linking retains immutable email origin');
insert into barangayan_private.resident_account_lifecycle(user_id,registration_origin,password_set,password_evidence)
select u.id,'legacy',case when coalesce(u.encrypted_password,'')='' then false else null end,
 case when coalesce(u.encrypted_password,'')='' then 'absent' else 'unknown_initial_hash' end
from auth.users u on conflict(user_id) do nothing;
select is((select registration_origin from barangayan_private.resident_account_lifecycle where user_id='b6070000-0000-0000-0000-000000000001'),'email_otp','Backfill replay does not overwrite known origin');
select is((select password_set from barangayan_private.resident_account_lifecycle where user_id='b6070000-0000-0000-0000-000000000001'),true,'Backfill replay preserves positively observed credential');
select ok(not has_table_privilege('authenticated','barangayan_private.resident_account_lifecycle','SELECT'),'Private table unreadable to clients');
select ok(not has_table_privilege('authenticated','barangayan_private.resident_account_lifecycle','UPDATE'),'Private state not writable by clients');
select ok(not has_function_privilege('anon','public.get_resident_account_setup_status()','EXECUTE'),'Anonymous cannot execute status');
set local role authenticated;
select set_config('request.jwt.claim.sub','b6070000-0000-0000-0000-000000000002',true);
select is(public.get_resident_account_setup_status(),'{"registrationOrigin":"legacy","profileComplete":false,"passwordSet":null,"hasGoogleIdentity":false}'::jsonb,'Caller status reports only four safe fields');
select throws_ok($$select public.get_resident_account_setup_status('b6070000-0000-0000-0000-000000000001'::uuid)$$,'42883',null,'No other-user status argument exists');
select throws_ok($$select * from barangayan_private.resident_account_lifecycle$$,'42501',null,'Private rows are inaccessible');
select lives_ok($$select public.complete_resident_profile('{"firstName":"Legacy","lastName":"Resident","houseNo":"12","street":"Main","sex":"female","employmentStatus":"student","mobileNumber":"09171234567","birthDate":"2000-01-01"}')$$,'Profile-less OTP/legacy account uses existing tenant completion');
select is(public.get_resident_account_setup_status()->'profileComplete','true'::jsonb,'Status agrees with completed profile');
select is((select barangay_id::text from public.profiles where id=auth.uid()),'a6070000-0000-0000-0000-000000000001','Completion uses configured tenant');
select set_config('request.jwt.claim.sub','b6070000-0000-0000-0000-000000000001',true);
select is(public.get_resident_account_setup_status()->'hasGoogleIdentity','true'::jsonb,'Google state uses Auth identities');
select is(public.get_resident_account_setup_status()->'passwordSet','true'::jsonb,'Linked identity cannot erase credential evidence');
select set_config('request.jwt.claim.sub','b6070000-0000-0000-0000-000000000003',true);
select is(public.get_resident_account_setup_status()->'passwordSet','false'::jsonb,'Google-only identity has no password');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.get_resident_account_setup_status()$$,'42501','authentication_required','Missing authenticated identity fails closed');
reset role;
update public.profiles set role='admin' where id='b6070000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','b6070000-0000-0000-0000-000000000003',true);
select throws_ok($$select public.get_resident_account_setup_status()$$,'42501','forbidden','Staff is not converted to resident');
reset role;
update public.profiles set deleted_at=now() where id='b6070000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','b6070000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.get_resident_account_setup_status()$$,'42501','forbidden','Deleted resident cannot resume setup');
reset role;
update auth.users set is_anonymous=true where id='b6070000-0000-0000-0000-000000000004';
update auth.users set banned_until=now()+interval '1 day' where id='b6070000-0000-0000-0000-000000000005';
set local role authenticated;
select set_config('request.jwt.claim.sub','b6070000-0000-0000-0000-000000000004',true);
select throws_ok($$select public.get_resident_account_setup_status()$$,'42501','resident_identity_required','Anonymous Auth identity cannot enter resident setup');
select set_config('request.jwt.claim.sub','b6070000-0000-0000-0000-000000000005',true);
select throws_ok($$select public.get_resident_account_setup_status()$$,'42501','resident_identity_required','Banned identity fails even with earlier caller claims');
reset role;
update auth.users set banned_until=null where id='b6070000-0000-0000-0000-000000000005';
delete from barangayan_private.resident_account_lifecycle where user_id='b6070000-0000-0000-0000-000000000005';
set local role authenticated;
select throws_ok($$select public.get_resident_account_setup_status()$$,'55000','resident_setup_state_unavailable','Missing authoritative state fails without invented defaults');
reset role;
select * from finish();
rollback;
