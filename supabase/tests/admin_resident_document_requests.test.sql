begin;
select no_plan();

insert into public.barangays(id,name) values
('a1270000-0000-4000-8000-000000000001','Dual role request test'),
('a1270000-0000-4000-8000-000000000002','Other request tenant');
insert into public.barangay_localities(barangay_id,display_name,city,province,resident_registration_enabled)
values ('a1270000-0000-4000-8000-000000000001','Dual role request test','San Mateo','Rizal',false);
insert into auth.users(id,email,raw_user_meta_data) values
('b1270000-0000-4000-8000-000000000001','dual-request@test.local','{}'),
('b1270000-0000-4000-8000-000000000002','dual-reviewer@test.local','{}'),
('b1270000-0000-4000-8000-000000000003','dual-foreign@test.local','{}'),
('b1270000-0000-4000-8000-000000000004','ordinary-request@test.local','{}'),
('b1270000-0000-4000-8000-000000000005','dual-unverified@test.local','{}');
insert into public.profiles(id,barangay_id,role,first_name,last_name,house_no,street,sex,employment_status,mobile_number,birth_date) values
('b1270000-0000-4000-8000-000000000001','a1270000-0000-4000-8000-000000000001','resident','Dual','Resident','12','Main Street','female','student','09171234567','2000-02-29'),
('b1270000-0000-4000-8000-000000000002','a1270000-0000-4000-8000-000000000001','admin','ID','Reviewer',null,null,null,null,null,null),
('b1270000-0000-4000-8000-000000000003','a1270000-0000-4000-8000-000000000002','admin','Foreign','Admin',null,null,null,null,null,null),
('b1270000-0000-4000-8000-000000000004','a1270000-0000-4000-8000-000000000001','resident','Ordinary','Resident','12','Main Street','female','student','09171234568','2000-02-29'),
('b1270000-0000-4000-8000-000000000005','a1270000-0000-4000-8000-000000000001','admin','Unverified','Resident',null,null,null,null,null,null);
insert into public.document_types(id,barangay_id,name,contract_version,service_kind,charter,purposes,requirement_rules,pricing_mode,processing_target_minutes)
values ('d1270000-0000-4000-8000-000000000001','a1270000-0000-4000-8000-000000000001','Certificate of Indigency',2,'indigency',
  '{"officeDivision":"Office","classification":"Simple","transactionType":"G2C","whoMayAvail":"Residents","checklistOfRequirements":"Valid ID","whereToSecureRequirements":"Office","clientSteps":"Submit","agencyActions":"Review","feesToBePaid":"100 pesos","processingTime":"15 minutes","personResponsible":null}',
  '[{"code":"medical","label":"Medical assistance","requiresExplanation":false}]',
  '{"dtiRequired":false,"hoaRequired":false,"lessorForRenter":true,"personalAppearance":false}','fixed',15);
insert into public.document_types(id,barangay_id,name,fee_centavos) values
('d1270000-0000-4000-8000-000000000002','a1270000-0000-4000-8000-000000000001','Legacy document',5000),
('d1270000-0000-4000-8000-000000000003','a1270000-0000-4000-8000-000000000002','Foreign document',5000);
insert into storage.objects(bucket_id,name,metadata) values
('id-documents','b1270000-0000-4000-8000-000000000004/versions/c1270000-0000-4000-8000-000000000004/id-front.jpg','{"size":1000,"mimetype":"image/jpeg"}');

create temp table dual_request_input(payload jsonb);
insert into dual_request_input values ('{"documentTypeId":"d1270000-0000-4000-8000-000000000001","idempotencyKey":"e1270000-0000-4000-8000-000000000001","purposeCode":"medical","details":{"isRenter":true},"attachments":[{"requirementCode":"lessor","path":"b1270000-0000-4000-8000-000000000001/c1270000-0000-4000-8000-000000000001/lessor.pdf","mimeType":"application/pdf","sizeBytes":1000}]}');
grant select on dual_request_input to authenticated;

set local role anon;
select throws_ok($$select public.submit_service_request('{}')$$,'42501',null,'Anonymous requests remain blocked');
reset role;
-- Match account provisioning: an existing resident is manually granted admin access.
update public.profiles set role='admin' where id='b1270000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='b1270000-0000-4000-8000-000000000001';
select lives_ok($$insert into storage.objects(bucket_id,name,metadata) values ('id-documents','b1270000-0000-4000-8000-000000000001/versions/c1270000-0000-4000-8000-000000000001/id-front.jpg','{"size":1000,"mimetype":"image/jpeg"}')$$,'Promoted resident uploads own front ID through ordinary Storage permissions');
select is((select count(*)::integer from storage.objects where bucket_id='id-documents' and name='b1270000-0000-4000-8000-000000000001/versions/c1270000-0000-4000-8000-000000000001/id-front.jpg'),1,'Promoted resident can read own uploaded ID');
select throws_ok($$insert into storage.objects(bucket_id,name,metadata) values ('id-documents','b1270000-0000-4000-8000-000000000004/versions/c1270000-0000-4000-8000-000000000001/id-front.jpg','{}')$$,'42501',null,'Admin role does not allow uploading another resident ID');
select throws_ok($$select public.publish_id_submission('{"submissionId":"c1270000-0000-4000-8000-000000000001","idType":"PhilSys","frontPath":"b1270000-0000-4000-8000-000000000001/versions/c1270000-0000-4000-8000-000000000001/id-front.jpg","confirmedDetails":{"fullName":" ","idNumber":"","birthDate":"","address":""}}')$$,'22023','invalid_fullName','Admin ID submission still requires a confirmed name');
select throws_ok($$select public.publish_id_submission('{"submissionId":"c1270000-0000-4000-8000-000000000001","idType":"PhilSys","frontPath":"b1270000-0000-4000-8000-000000000001/versions/c1270000-0000-4000-8000-000000000001/id-front.jpg","confirmedDetails":{"fullName":"Dual Resident","idNumber":"","birthDate":"2001-02-29","address":""}}')$$,'22023','invalid_birth_date','Admin ID submission rejects impossible birthdays');
select lives_ok($$insert into storage.objects(bucket_id,name,metadata) values ('request-attachments','b1270000-0000-4000-8000-000000000001/c1270000-0000-4000-8000-000000000001/lessor.pdf','{"size":1000,"mimetype":"application/pdf"}')$$,'Dual-role resident uploads own required certification');
select throws_ok($$insert into storage.objects(bucket_id,name,metadata) values ('request-attachments','b1270000-0000-4000-8000-000000000004/c1270000-0000-4000-8000-000000000001/forged.pdf','{}')$$,'42501',null,'Admin role does not allow uploading as another resident');
select lives_ok($$select public.publish_id_submission('{"submissionId":"c1270000-0000-4000-8000-000000000001","idType":"PhilSys","frontPath":"b1270000-0000-4000-8000-000000000001/versions/c1270000-0000-4000-8000-000000000001/id-front.jpg","confirmedDetails":{"fullName":"Dual Resident","idNumber":"","birthDate":"","address":""}}')$$,'Dual-role resident can submit own ID for approval');
select throws_ok($$select public.submit_service_request((select payload from dual_request_input))$$,'42501','current_approved_ID_required','Admin role does not bypass pending ID approval');
set local request.jwt.claim.sub='b1270000-0000-4000-8000-000000000004';
select lives_ok($$select public.publish_id_submission('{"submissionId":"c1270000-0000-4000-8000-000000000004","idType":"PhilSys","frontPath":"b1270000-0000-4000-8000-000000000004/versions/c1270000-0000-4000-8000-000000000004/id-front.jpg","confirmedDetails":{"fullName":"Ordinary Resident","idNumber":"","birthDate":"","address":""}}')$$,'Resident-only account can still publish ID evidence');
select throws_ok($$select public.review_id_submission('{"submissionId":"c1270000-0000-4000-8000-000000000001","decision":"verified"}')$$,'42501',null,'Resident-only account cannot review ID evidence');
set local request.jwt.claim.sub='b1270000-0000-4000-8000-000000000002';
select public.review_id_submission('{"submissionId":"c1270000-0000-4000-8000-000000000001","decision":"verified"}');
select public.review_id_submission('{"submissionId":"c1270000-0000-4000-8000-000000000004","decision":"verified"}');

set local request.jwt.claim.sub='b1270000-0000-4000-8000-000000000001';
select throws_ok($$select public.submit_service_request((select payload||'{"residentId":"b1270000-0000-4000-8000-000000000004"}' from dual_request_input))$$,'22023','invalid_payload','Admin cannot supply another resident identity');
select throws_ok($$select public.submit_service_request((select payload||'{"attachments":[]}' from dual_request_input))$$,'22023','supporting_requirement_missing','Dual-role renter still needs lessor evidence');
select lives_ok($$select public.submit_service_request((select payload from dual_request_input))$$,'Verified dual-role resident submits document request');
select lives_ok($$select public.submit_service_request((select payload from dual_request_input))$$,'Dual-role unchanged retry reuses original request');
select is((select count(*)::integer from public.service_requests where resident_id=auth.uid()),1,'Dual-role retry creates no duplicate');
select is((select assessed_amount_centavos from public.service_requests where resident_id=auth.uid()),10000,'Dual-role request uses ordinary 100-peso fee');
select is((select role from public.profiles where id=auth.uid()),'admin','Requesting does not remove administrator access');
select is((select count(*)::integer from public.request_attachments where resident_id=auth.uid()),1,'Required attachment is linked to the dual-role request');
select lives_ok($$select public.set_service_request_payment_method((select id from public.service_requests where resident_id=auth.uid()),'qrph')$$,'Dual-role requester can select online payment');
select lives_ok($$select public.set_service_request_payment_method((select id from public.service_requests where resident_id=auth.uid()),'pickup')$$,'Dual-role requester can select pickup');
select lives_ok($$select public.start_pickup_payment((select id from public.service_requests where resident_id=auth.uid()))$$,'Dual-role requester can confirm pickup payment');
select lives_ok($$select public.start_pickup_payment((select id from public.service_requests where resident_id=auth.uid()))$$,'Dual-role pickup confirmation is idempotent');
select is((select count(*)::integer from public.payments p join public.service_requests r on r.id=p.service_request_id where r.resident_id=auth.uid()),1,'Dual-role pickup retry creates one ledger');
select throws_ok($$select public.submit_service_request('{"documentTypeId":"d1270000-0000-4000-8000-000000000003","idempotencyKey":"e1270000-0000-4000-8000-000000000003","purposeCode":"legacy","details":{},"attachments":[]}')$$,'22023','service_contract_unavailable','Dual-role requester cannot request another barangay document');
select lives_ok($$select public.submit_service_request('{"documentTypeId":"d1270000-0000-4000-8000-000000000002","idempotencyKey":"e1270000-0000-4000-8000-000000000002","purposeCode":"legacy","details":{},"attachments":[]}')$$,'Dual-role resident can request legacy documents too');
set local request.jwt.claim.sub='b1270000-0000-4000-8000-000000000002';
select throws_ok($$select public.set_service_request_payment_method((select id from public.service_requests where idempotency_key='e1270000-0000-4000-8000-000000000001'),'pickup')$$,'42501','forbidden','Another same-tenant admin cannot choose requester payment');
select throws_ok($$select public.start_pickup_payment((select id from public.service_requests where idempotency_key='e1270000-0000-4000-8000-000000000001'))$$,'42501','forbidden','Another same-tenant admin cannot start requester payment');
set local request.jwt.claim.sub='b1270000-0000-4000-8000-000000000003';
select throws_ok($$select public.set_service_request_payment_method((select id from public.service_requests where idempotency_key='e1270000-0000-4000-8000-000000000001'),'pickup')$$,'42501','forbidden','Foreign-tenant admin cannot choose requester payment');
set local request.jwt.claim.sub='b1270000-0000-4000-8000-000000000005';
select throws_ok($$select public.submit_service_request('{"documentTypeId":"d1270000-0000-4000-8000-000000000001","idempotencyKey":"e1270000-0000-4000-8000-000000000005","purposeCode":"medical","details":{},"attachments":[]}')$$,'42501','current_approved_ID_required','An admin without approved resident ID remains ineligible');
set local request.jwt.claim.sub='b1270000-0000-4000-8000-000000000004';
select lives_ok($$select public.submit_service_request('{"documentTypeId":"d1270000-0000-4000-8000-000000000001","idempotencyKey":"e1270000-0000-4000-8000-000000000004","purposeCode":"medical","details":{},"attachments":[]}')$$,'Verified resident-only account still submits');

reset role;
update public.profiles set deleted_at=clock_timestamp() where id='b1270000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='b1270000-0000-4000-8000-000000000001';
select throws_ok($$select public.submit_service_request((select payload from dual_request_input))$$,'42501','forbidden','Deleted dual-role account cannot submit or retry');
select throws_ok($$insert into storage.objects(bucket_id,name,metadata) values ('request-attachments','b1270000-0000-4000-8000-000000000001/c1270000-0000-4000-8000-000000000001/deleted.pdf','{}')$$,'42501',null,'Deleted dual-role account cannot upload attachments');
select * from finish();
rollback;
