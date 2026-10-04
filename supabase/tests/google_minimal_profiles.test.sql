begin;
select no_plan();
update public.barangay_localities set resident_registration_enabled=false;
insert into public.barangays(id,name) values
 ('a6040000-0000-0000-0000-000000000001','Google Local'),
 ('a6040000-0000-0000-0000-000000000002','Google Foreign');
insert into public.barangay_localities values ('a6040000-0000-0000-0000-000000000001','Ampid 1','San Mateo','Rizal',true);
insert into auth.users(id,email,raw_user_meta_data) values
 ('b6040000-0000-0000-0000-000000000001','google-minimal@test.local',
 '{"role":"admin","first_name":"Untrusted","house_no":"Invented","registration_gps":{"lat":91,"lng":1}}');
insert into auth.identities(id,user_id,provider_id,provider,identity_data) values
 ('c6040000-0000-0000-0000-000000000001','b6040000-0000-0000-0000-000000000001','google-minimal','google',
 '{"given_name":"Mary Ann","family_name":"de la Cruz","email":"forged@test.local","role":"admin","barangay_id":"a6040000-0000-0000-0000-000000000002","house_no":"Invented"}');
select is((select count(*)::int from public.profiles where id='b6040000-0000-0000-0000-000000000001'),1,'Google identity insert immediately creates one profile');
select is((select first_name from public.profiles where id='b6040000-0000-0000-0000-000000000001'),'Mary Ann','Auth identity supplies first name');
select is((select last_name from public.profiles where id='b6040000-0000-0000-0000-000000000001'),'de la Cruz','Structured multiword surname is preserved');
select is((select email from public.profiles where id='b6040000-0000-0000-0000-000000000001'),'google-minimal@test.local','Email comes from auth.users, not identity/user claims');
select is((select barangay_id::text from public.profiles where id='b6040000-0000-0000-0000-000000000001'),'a6040000-0000-0000-0000-000000000001','Tenant comes only from enabled configuration');
select is((select role from public.profiles where id='b6040000-0000-0000-0000-000000000001'),'resident','Metadata cannot assign a staff role');
select ok((select house_no is null and street is null and home_address is null and mobile_number is null and birth_date is null
 and sex is null and employment_status is null and registration_location is null and registration_home_location is null
 and location_verified is null and profile_completed_at is null and approved_id_submission_id is null
 from public.profiles where id='b6040000-0000-0000-0000-000000000001'),'Bootstrap invents no demographics, location, completion or ID approval');
select is((select city || '/' || province from public.profiles where id='b6040000-0000-0000-0000-000000000001'),'San Mateo/Rizal','Configured locality display remains available');
insert into public.announcements(barangay_id,title,body) values
 ('a6040000-0000-0000-0000-000000000001','Google Local Announcement','Public'),
 ('a6040000-0000-0000-0000-000000000002','Google Foreign Announcement','Private');
insert into public.document_types(barangay_id,name) values ('a6040000-0000-0000-0000-000000000001','Google Document');
insert into public.medical_drives(id,barangay_id,title,type,drive_date,time_start,time_end,eligible_criteria,stock_total,stock_remaining)
 values ('d6040000-0000-0000-0000-000000000001','a6040000-0000-0000-0000-000000000001','Google Health','vaccination',current_date+1,'08:00','12:00','All',10,10);
create temporary table google_snapshot as select to_jsonb(p) saved from public.profiles p where id='b6040000-0000-0000-0000-000000000001';
grant select on google_snapshot to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','b6040000-0000-0000-0000-000000000001',true);
select is(public.ensure_google_resident_profile()::text,auth.uid()::text,'Retry operates on current authenticated identity only');
select is(public.ensure_google_resident_profile()::text,auth.uid()::text,'Repeated call is idempotent');
select is((select to_jsonb(p) from public.profiles p where id=auth.uid()),(select saved from google_snapshot),'Retry preserves every existing field and timestamp');
select is((select count(*)::int from public.announcements where title like 'Google%'),1,'Incomplete profile can browse only own-tenant information');
select is((select count(*)::int from public.document_types where name='Google Document'),1,'Incomplete profile can read document guidance');
select is((select count(*)::int from public.medical_drives where title='Google Health'),1,'Incomplete profile can read health guidance');
select throws_ok($$insert into public.incidents(barangay_id,reporter_id,title,location) values ('a6040000-0000-0000-0000-000000000001',auth.uid(),'Incomplete','{"lat":1,"lng":1}')$$,'42501','resident_profile_completion_required','Minimal profile cannot submit reports');
select throws_ok($$insert into public.drive_registrations(drive_id,user_id,applicant_number,age) values ('d6040000-0000-0000-0000-000000000001',auth.uid(),'GOOGLE',26)$$,'42501','resident_profile_completion_required','Minimal profile cannot register for health services');
select throws_ok($$select public.register_for_drive('d6040000-0000-0000-0000-000000000001',26,false,array[]::text[])$$,'42501','resident_profile_completion_required','Health RPC enforces completion too');
select is((select stock_remaining from public.medical_drives where id='d6040000-0000-0000-0000-000000000001'),10,'Failed registration cannot consume a health slot');
select throws_ok($$insert into public.service_requests(barangay_id,resident_id,document_type_id) values ('a6040000-0000-0000-0000-000000000001',auth.uid(),(select id from public.document_types where name='Google Document'))$$,'42501','resident_profile_completion_required','Minimal profile cannot request documents');
select throws_ok($$select barangayan_private.provision_google_resident('b6040000-0000-0000-0000-000000000002')$$,'42501',null,'Authenticated users cannot invoke the internal identity-taking helper');
select throws_ok($$update public.profiles set registration_location='{"lat":1,"lng":1}' where id=auth.uid()$$,'42501','registration_location_operation_required','Minimal profile retains established client map protection');
select lives_ok($$select public.complete_resident_profile('{"firstName":"Mary Ann","lastName":"de la Cruz","houseNo":"12","street":"Main","sex":"female","employmentStatus":"student","mobileNumber":"09171234567","birthDate":"2000-01-01"}')$$,'Resident can complete the existing minimal profile without a password');
select ok((select profile_completed_at is not null and approved_id_submission_id is null from public.profiles where id=auth.uid()),'Completion remains separate from administrator ID verification');
select lives_ok($$insert into public.incidents(barangay_id,reporter_id,title,location) values ('a6040000-0000-0000-0000-000000000001',auth.uid(),'Completed','{"lat":1,"lng":1}')$$,'Completed resident may submit a report');
select lives_ok($$select public.register_for_drive('d6040000-0000-0000-0000-000000000001',26,false,array[]::text[])$$,'Completed resident may register through the health RPC');
reset role;
update google_snapshot set saved=(select to_jsonb(p) from public.profiles p where id='b6040000-0000-0000-0000-000000000001');
update auth.identities set identity_data='{"name":"Different Provider Name"}' where id='c6040000-0000-0000-0000-000000000001';
set local role authenticated;
select public.ensure_google_resident_profile();
select is((select to_jsonb(p) from public.profiles p where id=auth.uid()),(select saved from google_snapshot),'Provider refresh cannot overwrite a completed resident');
reset role;

-- Earlier profile-less Google accounts are repaired through the same operation.
insert into auth.users(id,email) values ('b6040000-0000-0000-0000-000000000002','google-old@test.local');
insert into auth.identities(id,user_id,provider_id,provider,identity_data) values
 ('c6040000-0000-0000-0000-000000000002','b6040000-0000-0000-0000-000000000002','google-old','google','{"full_name":"  Juan\tDela  Cruz "}');
delete from public.profiles where id='b6040000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','b6040000-0000-0000-0000-000000000002',true);
select lives_ok($$select public.ensure_google_resident_profile()$$,'Session restart repairs earlier Google account without a profile');
select is((select first_name || '/' || last_name from public.profiles where id=auth.uid()),'Juan/Dela Cruz','Full-name fallback matches editable form suggestions');
reset role;
select is((select first_name from barangayan_private.google_resident_names('{"name":"Cher"}')),'Cher','Mononym retains available first name');
select is((select last_name from barangayan_private.google_resident_names('{"name":"Cher"}')),null::text,'Mononym does not invent a surname');
select is((select first_name from barangayan_private.google_resident_names('{"email":"juan.santos@gmail.com","given_name":123,"full_name":{}}')),null::text,'Malformed metadata and email-only identities do not invent a name');

insert into auth.users(id,email) values ('b6040000-0000-0000-0000-000000000005','google-no-name@test.local');
insert into auth.identities(id,user_id,provider_id,provider,identity_data) values
 ('c6040000-0000-0000-0000-000000000005','b6040000-0000-0000-0000-000000000005','google-no-name','google','{}');
select ok((select first_name is null and last_name is null and full_name='' from public.profiles where id='b6040000-0000-0000-0000-000000000005'),'Name-less Google identity still gets a profile without invented names');
insert into auth.users(id,email) values ('b6040000-0000-0000-0000-000000000006','google-staff@test.local');
insert into public.profiles(id,barangay_id,role,full_name) values ('b6040000-0000-0000-0000-000000000006','a6040000-0000-0000-0000-000000000002','admin','Saved Staff');
insert into auth.identities(id,user_id,provider_id,provider,identity_data) values
 ('c6040000-0000-0000-0000-000000000006','b6040000-0000-0000-0000-000000000006','google-staff','google','{"name":"Provider Name"}');
select is((select role || '/' || full_name || '/' || barangay_id::text from public.profiles where id='b6040000-0000-0000-0000-000000000006'),
 'admin/Saved Staff/a6040000-0000-0000-0000-000000000002','Linking preserves existing staff role, tenant and name');
insert into auth.users(id,email,is_anonymous) values ('b6040000-0000-0000-0000-000000000007','google-anonymous@test.local',true);
select throws_ok($$insert into auth.identities(id,user_id,provider_id,provider,identity_data) values
 ('c6040000-0000-0000-0000-000000000007','b6040000-0000-0000-0000-000000000007','google-anonymous','google','{}')$$,
 '42501','google_identity_required','Anonymous Auth identity cannot provision a resident');

insert into auth.users(id,email,raw_user_meta_data) values ('b6040000-0000-0000-0000-000000000003','password@test.local','{"providers":["google"],"provider":"google"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','b6040000-0000-0000-0000-000000000003',true);
select throws_ok($$select public.ensure_google_resident_profile()$$,'42501','google_identity_required','Editable provider metadata cannot impersonate a Google identity');
reset role;
set local role anon;
select throws_ok($$select public.ensure_google_resident_profile()$$,'42501',null,'Anonymous role cannot invoke provisioning');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.ensure_google_resident_profile()$$,'42501','authentication_required','Missing authenticated identity fails closed');
reset role;
update public.profiles set deleted_at=now() where id='b6040000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','b6040000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.ensure_google_resident_profile()$$,'42501','forbidden','Deleted profile cannot be recreated');
reset role;
insert into auth.users(id,email) values ('b6040000-0000-0000-0000-000000000004','google-config@test.local');
insert into public.barangay_localities values ('a6040000-0000-0000-0000-000000000002','Other','Other','Other',true);
select throws_ok($$insert into auth.identities(id,user_id,provider_id,provider,identity_data) values ('c6040000-0000-0000-0000-000000000004','b6040000-0000-0000-0000-000000000004','google-config','google','{}')$$,'22023','registration_locality_not_configured','Ambiguous registration tenant fails atomically');
select is((select count(*)::int from public.profiles where id='b6040000-0000-0000-0000-000000000004'),0,'Configuration failure leaves no incorrectly assigned profile');
select is((select count(*)::int from auth.identities where user_id='b6040000-0000-0000-0000-000000000004'),0,'Failed identity insert rolls back');
update public.barangay_localities set resident_registration_enabled=false;
select throws_ok($$insert into auth.identities(id,user_id,provider_id,provider,identity_data) values ('c6040000-0000-0000-0000-000000000004','b6040000-0000-0000-0000-000000000004','google-config','google','{}')$$,'22023','registration_locality_not_configured','Missing registration tenant fails closed');
select * from finish();
rollback;
