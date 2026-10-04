begin;
select no_plan();
update public.barangay_localities set resident_registration_enabled=false;
insert into public.barangays(id,name) values
 ('a6030000-0000-0000-0000-000000000001','Deferred Local'),
 ('a6030000-0000-0000-0000-000000000002','Deferred Foreign');
insert into public.barangay_localities values ('a6030000-0000-0000-0000-000000000001','Ampid 1','San Mateo','Rizal',true);
insert into auth.users(id,email,raw_user_meta_data) values
 ('b6030000-0000-0000-0000-000000000001','deferred@test.local','{"given_name":"Deferred","family_name":"Resident","role":"admin"}');
insert into public.announcements(barangay_id,title,body,deleted_at) values
 ('a6030000-0000-0000-0000-000000000001','Deferred Local','Public',null),
 ('a6030000-0000-0000-0000-000000000002','Deferred Foreign','Public',null),
 ('a6030000-0000-0000-0000-000000000001','Deferred Deleted','Hidden',now());
insert into public.document_types(barangay_id,name) values ('a6030000-0000-0000-0000-000000000001','Deferred Document');
insert into public.medical_drives(id,barangay_id,title,type,drive_date,time_start,time_end,eligible_criteria,stock_total,stock_remaining)
 values ('d6030000-0000-0000-0000-000000000001','a6030000-0000-0000-0000-000000000001','Deferred Health','vaccination',current_date+1,'08:00','12:00','All',10,10);
set local role authenticated;
select set_config('request.jwt.claim.sub','b6030000-0000-0000-0000-000000000001',true);
select is((select count(*)::int from public.profiles where id=auth.uid()),0,'Google identity can remain without invented resident details');
select is(public.incomplete_profile_browsing_barangay()::text,'a6030000-0000-0000-0000-000000000001','Missing profile derives only enabled browsing tenant');
select is((select count(*)::int from public.announcements where title like 'Deferred%'),1,'Public browsing excludes foreign and deleted announcements');
select is((select count(*)::int from public.document_types where name='Deferred Document'),1,'Document guidance readable before completing profile');
select is((select count(*)::int from public.medical_drives where title='Deferred Health'),1,'Health information readable before registering');
select throws_ok($$insert into public.incidents(barangay_id,reporter_id,title,location) values ('a6030000-0000-0000-0000-000000000001',auth.uid(),'Incomplete','{"lat":1,"lng":1}')$$,'42501','resident_profile_completion_required','Direct report submission requires profile');
select throws_ok($$insert into public.drive_registrations(drive_id,user_id,applicant_number,age) values ('d6030000-0000-0000-0000-000000000001',auth.uid(),'INCOMPLETE',26)$$,'42501','resident_profile_completion_required','Direct health registration requires profile');
select throws_ok($$insert into public.service_requests(barangay_id,resident_id,document_type_id) values ('a6030000-0000-0000-0000-000000000001',auth.uid(),(select id from public.document_types where name='Deferred Document'))$$,'42501','resident_profile_completion_required','Direct document request requires profile');
select lives_ok($$select public.complete_resident_profile('{"firstName":"Deferred","lastName":"Resident","houseNo":"12","street":"Main","sex":"female","employmentStatus":"student","mobileNumber":"09171234567","birthDate":"2000-01-01"}')$$,'Deferred completion still works without password');
select is(public.incomplete_profile_browsing_barangay(),null::uuid,'After completion existing tenant policies take over');
select is((select count(*)::int from public.announcements where title like 'Deferred%'),1,'Completing profile preserves tenant isolation');
select lives_ok($$insert into public.incidents(barangay_id,reporter_id,title,location) values ('a6030000-0000-0000-0000-000000000001',auth.uid(),'Complete','{"lat":1,"lng":1}')$$,'Completed resident may submit a report');
select is((select approved_id_submission_id from public.profiles where id=auth.uid()),null::uuid,'Completion does not approve ID evidence');
reset role;
-- An existing partial profile must be gated too; checking only row existence is unsafe.
update public.profiles set house_no=E'\t' where id='b6030000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$insert into public.incidents(barangay_id,reporter_id,title,location) values ('a6030000-0000-0000-0000-000000000001',auth.uid(),'Whitespace','{"lat":1,"lng":1}')$$,'42501','resident_profile_completion_required','Whitespace-only required address cannot bypass completion');
reset role;
update public.profiles set house_no=null where id='b6030000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$insert into public.incidents(barangay_id,reporter_id,title,location) values ('a6030000-0000-0000-0000-000000000001',auth.uid(),'Partial','{"lat":1,"lng":1}')$$,'42501','resident_profile_completion_required','Partial existing profiles cannot bypass submission gate');
select is((select count(*)::int from public.announcements where title like 'Deferred%'),1,'Partial profiles can continue browsing');
reset role;
-- No fallback tenant if registration configuration is ambiguous.
insert into public.barangay_localities values ('a6030000-0000-0000-0000-000000000002','Other','Other','Other',true);
insert into auth.users(id,email) values ('b6030000-0000-0000-0000-000000000002','deferred-other@test.local');
set local role authenticated;
select set_config('request.jwt.claim.sub','b6030000-0000-0000-0000-000000000002',true);
select is(public.incomplete_profile_browsing_barangay(),null::uuid,'Ambiguous locality fails closed');
select is((select count(*)::int from public.announcements where title like 'Deferred%'),0,'No cross-tenant browsing fallback');
select * from finish();
rollback;
