begin;
select no_plan();
update public.barangay_localities set resident_registration_enabled=false;
insert into public.barangays(id,name,boundary) values
 ('a6000000-0000-0000-0000-000000000001','Phase Six Ampid','{"type":"Polygon","coordinates":[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]]}'),
 ('a6000000-0000-0000-0000-000000000002','Phase Six Foreign',null);
insert into public.barangay_localities values ('a6000000-0000-0000-0000-000000000001','Ampid 1','San Mateo','Rizal',true);
insert into auth.users(id,email,raw_user_meta_data) values
 ('b6000000-0000-0000-0000-000000000001','phase6-google@test.local','{"full_name":"Google Resident","role":"admin"}'),
 ('b6000000-0000-0000-0000-000000000002','phase6-password@test.local','{"first_name":"Password","last_name":"Resident","barangay_id":"a6000000-0000-0000-0000-000000000001","location_verified":true,"registration_gps":{"lat":1,"lng":1},"registration_home":{"lat":11,"lng":1}}');
select is((select count(*)::int from public.profiles where id='b6000000-0000-0000-0000-000000000001'),0,'Google identity waits for mandatory resident fields');
select is((select city from public.profiles where id='b6000000-0000-0000-0000-000000000002'),'San Mateo','Password signup uses server locality');
select is((select province from public.profiles where id='b6000000-0000-0000-0000-000000000002'),'Rizal','Province is assigned');
select is((select location_verified from public.profiles where id='b6000000-0000-0000-0000-000000000002'),false,'Outside home advisory overrides forged verification and inside GPS');
select is((select registration_location->>'lat' from public.profiles where id='b6000000-0000-0000-0000-000000000002'),'1','GPS observation retained separately');
select is((select registration_home_location->>'lat' from public.profiles where id='b6000000-0000-0000-0000-000000000002'),'11','Outside home does not block registration');
select throws_ok($$insert into auth.users(id,email,raw_user_meta_data) values ('b6000000-0000-0000-0000-000000000003','forged@test.local','{"first_name":"Forged","last_name":"Tenant","barangay_id":"a6000000-0000-0000-0000-000000000002"}')$$,'22023','registration_locality_not_configured','Password tenant injection denied');
select throws_ok($$insert into auth.users(id,email,raw_user_meta_data) values ('b6000000-0000-0000-0000-000000000003','invalid@test.local','{"first_name":"Invalid","last_name":"Coordinates","barangay_id":"a6000000-0000-0000-0000-000000000001","registration_gps":{"lat":91,"lng":1}}')$$,'22023','invalid_coordinates','Invalid coordinates cannot be stored');
set local role authenticated;
select set_config('request.jwt.claim.sub','b6000000-0000-0000-0000-000000000001',true);
select throws_ok($$select public.complete_resident_profile('{"role":"admin"}')$$,'22023','invalid_payload','Completion cannot set role');
select lives_ok($$select public.complete_resident_profile('{"firstName":"Google","lastName":"Resident","houseNo":"12","street":"Main","sex":"female","employmentStatus":"student","mobileNumber":"09171234567","birthDate":"2000-01-01","location":{"gps":{"lat":11,"lng":1},"home":{"lat":1,"lng":1}}}')$$,'Metadata-free Google completion works without password');
select is((select role from public.profiles where id=auth.uid()),'resident','Server chooses permitted role');
select is((select barangay_id::text from public.profiles where id=auth.uid()),'a6000000-0000-0000-0000-000000000001','Server chooses configured tenant');
select is((select location_verified from public.profiles where id=auth.uid()),true,'Home classification independent of outside GPS');
select isnt((select profile_completed_at from public.profiles where id=auth.uid()),null,'Completion recorded');
select throws_ok($$update public.profiles set registration_home_location='{"lat":2,"lng":1}' where id=auth.uid()$$,'42501','registration_location_operation_required','Direct advisory replacement blocked');
select throws_ok($$update public.profiles set verified_location='{"lat":11,"lng":1}' where id=auth.uid()$$,'22023','location_outside_or_unavailable','Settings outside pin blocked server side');
select throws_ok($$update public.profiles set verified_location='{"lat":5,"lng":5}' where id=auth.uid()$$,'22023','location_outside_or_unavailable','Polygon hole excluded');
select lives_ok($$update public.profiles set verified_location='{"lat":0,"lng":5}',location_verified_at='2000-01-01' where id=auth.uid()$$,'Settings polygon edge accepted');
select ok((select location_verified_at>now()-interval '1 minute' from public.profiles where id=auth.uid()),'Settings timestamp server derived');
select throws_ok($$update public.profiles set verified_location='{"lat":1,"lng":1,"verified":true}' where id=auth.uid()$$,'22023','invalid_coordinates','Extra coordinate claims rejected');
select throws_ok($$update public.profiles set city='Elsewhere' where id=auth.uid()$$,'42501','fixed_locality','Completion retains locality protections');
reset role;
select is(barangayan_private.location_inside('{"lat":1,"lng":1}',null),null,'Missing boundary produces unable to check');
select is(barangayan_private.location_inside('{"lat":3,"lng":5}',(select boundary from public.barangays where id='a6000000-0000-0000-0000-000000000001')),true,'Hole boundary inclusive');
select * from finish();
rollback;
