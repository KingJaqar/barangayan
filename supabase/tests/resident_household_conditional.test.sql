-- Resident iOS Phase 3 (P03-T04): conditional household save, mirror parity and
-- attendance preservation.
begin;
select no_plan();
insert into public.barangays(id,name) values ('a6123000-0000-0000-0000-000000000001','Household Local');
insert into auth.users(id,email) values
 ('b6123000-0000-0000-0000-000000000001','hh-a@test.local'),
 ('b6123000-0000-0000-0000-000000000002','hh-b@test.local'),
 ('b6123000-0000-0000-0000-000000000003','hh-staff@test.local');
insert into public.profiles(id,barangay_id,role,full_name) values
 ('b6123000-0000-0000-0000-000000000001','a6123000-0000-0000-0000-000000000001','resident','HH A'),
 ('b6123000-0000-0000-0000-000000000002','a6123000-0000-0000-0000-000000000001','resident','HH B'),
 ('b6123000-0000-0000-0000-000000000003','a6123000-0000-0000-0000-000000000001','admin','HH Staff');
insert into public.evacuation_centers(id,barangay_id,name,position,is_active) values
 ('e6123000-0000-0000-0000-000000000001','a6123000-0000-0000-0000-000000000001','HH Center','{"lat":1,"lng":1}',true);

select is(has_function_privilege('anon','public.save_resident_household_if_unchanged(jsonb,jsonb)','execute'),false,'Anonymous cannot save a household');
select is(has_function_privilege('service_role','public.save_resident_household_if_unchanged(jsonb,jsonb)','execute'),false,'No service-role shortcut');

set local role authenticated;
select set_config('request.jwt.claim.sub','b6123000-0000-0000-0000-000000000001',true);
select is(public.save_resident_household_if_unchanged('[{"id":"11111111-1111-4111-8111-111111111111","name":"  Ana Reyes ","relation":"child","role":"child"},{"id":"22222222-2222-4222-8222-222222222222","name":"Ben Reyes","relation":"spouse"}]','[]')
 ->0->>'name','Ana Reyes','The first save into an empty household succeeds and trims names');
select is((select count(*)::int from public.household_members where profile_id=auth.uid() and deleted_at is null),2,'Canonical mirror rows match the saved list');

-- Staff attendance is owned by the canonical rows and survives a retained-ID edit.
reset role;
update public.household_members set is_checked_in=true,checked_in_at=now(),checked_in_center_id='e6123000-0000-0000-0000-000000000001',checked_in_center_name='HH Center'
 where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','b6123000-0000-0000-0000-000000000001',true);
select throws_ok($$select public.save_resident_household_if_unchanged('[{"id":"11111111-1111-4111-8111-111111111111","name":"Stale Edit","relation":"child"}]','[]')$$,
 'PT409','resident_household_changed','A stale editor is rejected');
select is((select name from public.household_members where id='11111111-1111-4111-8111-111111111111'),'Ana Reyes','The stale save wrote nothing');
select lives_ok($$select public.save_resident_household_if_unchanged(
  '[{"id":"11111111-1111-4111-8111-111111111111","name":"Ana M. Reyes","relation":"child"}]',
  (select household_members from public.profiles where id=auth.uid()))$$,'A current snapshot is accepted');
select is((select is_checked_in from public.household_members where id='11111111-1111-4111-8111-111111111111'),true,'Attendance is preserved for a retained member');
select is((select name from public.household_members where id='11111111-1111-4111-8111-111111111111'),'Ana M. Reyes','The retained member was updated');
select is((select count(*)::int from public.household_members where profile_id=auth.uid() and deleted_at is null),1,'A removed member is removed from the mirror');

-- Validation and ownership.
select throws_ok($$select public.save_resident_household_if_unchanged('{}','null')$$,'22023','invalid_household_members','A non-array list is rejected');
select throws_ok($$select public.save_resident_household_if_unchanged('[]','{}')$$,'22023','invalid_household_snapshot','A malformed snapshot is rejected');
select throws_ok($$select public.save_resident_household_if_unchanged('[{"id":"not-a-uuid","name":"X","relation":"child"}]',(select household_members from public.profiles where id=auth.uid()))$$,
 '22023','invalid_household_member_id','A client id must be a UUID');
select throws_ok($$select public.save_resident_household_if_unchanged('[{"id":"33333333-3333-4333-8333-333333333333","name":"   ","relation":"child"}]',(select household_members from public.profiles where id=auth.uid()))$$,
 '22023','invalid_household_member','A blank name is rejected');
select throws_ok($$select public.save_resident_household_if_unchanged((select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'name','M','relation','child')) from generate_series(1,31)),(select household_members from public.profiles where id=auth.uid()))$$,
 '22023','invalid_household_members','More than thirty members is rejected');
select throws_ok($$select public.save_resident_household_if_unchanged('[{"id":"44444444-4444-4444-8444-444444444444","name":"A","relation":"child"},{"id":"44444444-4444-4444-8444-444444444444","name":"B","relation":"child"}]',(select household_members from public.profiles where id=auth.uid()))$$,
 '22023','duplicate_household_member_id','A duplicate id is rejected');

-- Another household's member id cannot be claimed.
select set_config('request.jwt.claim.sub','b6123000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.save_resident_household_if_unchanged('[{"id":"11111111-1111-4111-8111-111111111111","name":"Stolen","relation":"child"}]','[]')$$,
 null,null,'A member id owned by another profile is rejected');
reset role;
select is((select profile_id::text from public.household_members where id='11111111-1111-4111-8111-111111111111'),'b6123000-0000-0000-0000-000000000001','The foreign member stays with its owner');
select is((select count(*)::int from public.household_members where profile_id='b6123000-0000-0000-0000-000000000002'),0,'The rejected save created nothing');
set local role authenticated;

-- Staff and deleted residents.
select set_config('request.jwt.claim.sub','b6123000-0000-0000-0000-000000000003',true);
select throws_ok($$select public.save_resident_household_if_unchanged('[]','[]')$$,'42501','forbidden','Staff cannot use the resident operation');
reset role;
update public.profiles set deleted_at=now() where id='b6123000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','b6123000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.save_resident_household_if_unchanged('[]','[]')$$,'42501','forbidden','A deleted resident cannot save');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.save_resident_household_if_unchanged('[]','[]')$$,'42501','resident_identity_required','No identity is denied');
reset role;
select * from finish();
rollback;
