-- Resident iOS Phase 3 (P03-T03): Apple-aware account setup is additive and cannot
-- change the strict legacy contract used by Android/web.
begin;
select no_plan();
update public.barangay_localities set resident_registration_enabled=false;
insert into public.barangays(id,name) values
 ('a6122000-0000-0000-0000-000000000001','Apple Local'),
 ('a6122000-0000-0000-0000-000000000002','Apple Foreign');
insert into public.barangay_localities values ('a6122000-0000-0000-0000-000000000001','Ampid 1','San Mateo','Rizal',true);

-- Apple sign-in: provider recorded in app metadata by Auth; user metadata is hostile.
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
 ('b6122000-0000-0000-0000-000000000001','relay-abc@privaterelay.appleid.com','{"provider":"apple","providers":["apple"]}',
  '{"role":"admin","barangay_id":"a6122000-0000-0000-0000-000000000002","registration_gps":{"lat":14.6,"lng":121.1},"house_no":"Invented"}'),
 ('b6122000-0000-0000-0000-000000000002','apple-named@test.local','{"provider":"apple","providers":["apple"]}','{}'),
 ('b6122000-0000-0000-0000-000000000003','google-user@test.local','{"provider":"google","providers":["google"]}','{}');
insert into auth.identities(id,user_id,provider_id,provider,identity_data) values
 ('c6122000-0000-0000-0000-000000000001','b6122000-0000-0000-0000-000000000001','apple-sub-1','apple',
  '{"sub":"apple-sub-1","email":"forged@test.local","role":"admin","barangay_id":"a6122000-0000-0000-0000-000000000002"}'),
 ('c6122000-0000-0000-0000-000000000002','b6122000-0000-0000-0000-000000000002','apple-sub-2','apple',
  '{"sub":"apple-sub-2","given_name":"Maria","family_name":"Santos"}'),
 ('c6122000-0000-0000-0000-000000000003','b6122000-0000-0000-0000-000000000003','google-sub-3','google',
  '{"given_name":"Gina","family_name":"Lopez"}');

select is((select count(*)::int from public.profiles where id in ('b6122000-0000-0000-0000-000000000001','b6122000-0000-0000-0000-000000000002')),2,
 'An Apple identity immediately creates one profile per account');
select is((select role from public.profiles where id='b6122000-0000-0000-0000-000000000001'),'resident','Metadata cannot assign a staff role');
select is((select barangay_id::text from public.profiles where id='b6122000-0000-0000-0000-000000000001'),'a6122000-0000-0000-0000-000000000001',
 'Tenant comes only from the enabled registration locality');
select is((select email from public.profiles where id='b6122000-0000-0000-0000-000000000001'),'relay-abc@privaterelay.appleid.com',
 'Email comes from auth.users, not identity data');
select ok((select first_name is null and last_name is null from public.profiles where id='b6122000-0000-0000-0000-000000000001'),
 'A missing Apple name leaves names empty rather than inventing them');
select is((select first_name||'/'||last_name from public.profiles where id='b6122000-0000-0000-0000-000000000002'),'Maria/Santos',
 'Names supplied by the identity are used as editable suggestions');
select ok((select registration_location is null and registration_home_location is null and house_no is null and profile_completed_at is null
  and approved_id_submission_id is null from public.profiles where id='b6122000-0000-0000-0000-000000000001'),
 'Apple provisioning imports no editable location, address, completion or ID approval');
select is((select registration_origin from barangayan_private.resident_account_lifecycle where user_id='b6122000-0000-0000-0000-000000000001'),'apple',
 'Lifecycle records the Apple origin');
select is((select password_set from barangayan_private.resident_account_lifecycle where user_id='b6122000-0000-0000-0000-000000000001'),false,
 'An Apple account starts without a password');
select is((select registration_origin from barangayan_private.resident_account_lifecycle where user_id='b6122000-0000-0000-0000-000000000003'),'google',
 'Google origin is unchanged');

-- v1 legacy contract stays strict for Android/web.
set local role authenticated;
select set_config('request.jwt.claim.sub','b6122000-0000-0000-0000-000000000001',true);
select is((select array_agg(k order by k) from jsonb_object_keys(public.get_resident_account_setup_status()) k),
 array['hasGoogleIdentity','passwordSet','profileComplete','registrationOrigin'],'v1 response keeps exactly its legacy keys');
select is(public.get_resident_account_setup_status()->>'registrationOrigin','legacy','v1 never emits the new origin value');
select is((public.get_resident_account_setup_status()->>'passwordSet')::boolean,false,'v1 reports the real password state for an Apple account');
select is((public.get_resident_account_setup_status()->>'hasGoogleIdentity')::boolean,false,'v1 reports no Google identity for an Apple account');

-- v2 is provider-aware.
select is(public.get_resident_account_setup_status_v2()->>'registrationOrigin','apple','v2 reports the Apple origin');
select is((public.get_resident_account_setup_status_v2()->>'contractVersion')::int,2,'v2 is versioned');
select is(public.get_resident_account_setup_status_v2()->'identityProviders','["apple"]'::jsonb,'v2 lists linked providers');
select is((public.get_resident_account_setup_status_v2()->>'hasAppleIdentity')::boolean,true,'v2 reports the Apple identity');
select is((public.get_resident_account_setup_status_v2()->>'emailIsPrivateRelay')::boolean,true,'v2 flags a private relay email');
select is((public.get_resident_account_setup_status_v2()->>'profileComplete')::boolean,false,'A new Apple profile is incomplete');

-- Existing operations are unchanged in v1 for a Google account.
select set_config('request.jwt.claim.sub','b6122000-0000-0000-0000-000000000003',true);
select is(public.get_resident_account_setup_status()->>'registrationOrigin','google','v1 still reports Google');
select is(public.get_resident_account_setup_status_v2()->>'registrationOrigin','google','v2 reports Google');
select is((public.get_resident_account_setup_status_v2()->>'emailIsPrivateRelay')::boolean,false,'A regular email is not flagged');

-- ensure_apple_resident_profile: caller-only, identity-bound, idempotent.
select throws_ok($$select public.ensure_apple_resident_profile()$$,'42501','apple_identity_required','A non-Apple account cannot use the Apple bootstrap');
select throws_ok($$select barangayan_private.provision_apple_resident('b6122000-0000-0000-0000-000000000001')$$,'42501',null,
 'Authenticated users cannot invoke the internal identity-taking helper');
select set_config('request.jwt.claim.sub','b6122000-0000-0000-0000-000000000002',true);
create temporary table apple_snapshot as select to_jsonb(p) saved from public.profiles p where id='b6122000-0000-0000-0000-000000000002';
grant select on apple_snapshot to authenticated;
select is(public.ensure_apple_resident_profile()::text,'b6122000-0000-0000-0000-000000000002','The bootstrap operates on the current identity only');
select is((select to_jsonb(p) from public.profiles p where id=auth.uid()),(select saved from apple_snapshot),'Repeating the bootstrap preserves every field');
select lives_ok($$select public.complete_resident_profile('{"firstName":"Maria","lastName":"Santos","houseNo":"12","street":"Main","sex":"female","employmentStatus":"student","mobileNumber":"09171234567","birthDate":"2000-01-01"}')$$,
 'An Apple resident can complete the minimal profile without a password');
reset role;
update apple_snapshot set saved=(select to_jsonb(p) from public.profiles p where id='b6122000-0000-0000-0000-000000000002');
update auth.identities set identity_data='{"sub":"apple-sub-2","given_name":"Different","family_name":"Name"}' where id='c6122000-0000-0000-0000-000000000002';
set local role authenticated;
select public.ensure_apple_resident_profile();
select is((select to_jsonb(p) from public.profiles p where id=auth.uid()),(select saved from apple_snapshot),
 'A later Apple sign-in cannot overwrite a completed resident');
select is((public.get_resident_account_setup_status_v2()->>'profileComplete')::boolean,true,'Completion is reflected in v2');

-- Earlier profile-less Apple accounts are repaired by the same operation.
reset role;
insert into auth.users(id,email,raw_app_meta_data) values ('b6122000-0000-0000-0000-000000000004','apple-old@test.local','{"provider":"apple"}');
insert into auth.identities(id,user_id,provider_id,provider,identity_data) values
 ('c6122000-0000-0000-0000-000000000004','b6122000-0000-0000-0000-000000000004','apple-sub-4','apple','{"sub":"apple-sub-4"}');
delete from public.profiles where id='b6122000-0000-0000-0000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub','b6122000-0000-0000-0000-000000000004',true);
select lives_ok($$select public.ensure_apple_resident_profile()$$,'A session restart repairs an Apple account without a profile');
select is((select count(*)::int from public.profiles where id=auth.uid()),1,'The repaired profile exists once');

-- A deleted identity cannot be restored by the bootstrap; staff cannot use the contract.
reset role;
update public.profiles set deleted_at=now() where id='b6122000-0000-0000-0000-000000000004';
set local role authenticated;
select throws_ok($$select public.ensure_apple_resident_profile()$$,'42501','forbidden','A deleted Apple resident is not restored');
select throws_ok($$select public.get_resident_account_setup_status_v2()$$,'42501','forbidden','A deleted resident has no setup contract');
reset role;
insert into auth.users(id,email,raw_app_meta_data) values ('b6122000-0000-0000-0000-000000000005','apple-staff@test.local','{"provider":"apple"}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b6122000-0000-0000-0000-000000000005','a6122000-0000-0000-0000-000000000001','admin','Apple Staff');
insert into auth.identities(id,user_id,provider_id,provider,identity_data) values
 ('c6122000-0000-0000-0000-000000000005','b6122000-0000-0000-0000-000000000005','apple-sub-5','apple','{"sub":"apple-sub-5"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','b6122000-0000-0000-0000-000000000005',true);
select throws_ok($$select public.get_resident_account_setup_status_v2()$$,'42501','forbidden','Staff accounts have no resident setup contract');

-- No anonymous execution of either contract.
reset role;
select is(has_function_privilege('anon','public.get_resident_account_setup_status_v2()','execute'),false,'Anonymous cannot read setup status v2');
select is(has_function_privilege('anon','public.ensure_apple_resident_profile()','execute'),false,'Anonymous cannot bootstrap an Apple profile');
select * from finish();
rollback;
