begin;
select no_plan();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('id-documents','id-documents',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
insert into public.barangays(id,name) values ('a1180000-0000-4000-8000-000000000001','Front ID test');
insert into public.barangay_localities(barangay_id,display_name,city,province,resident_registration_enabled)
values ('a1180000-0000-4000-8000-000000000001','Front ID test','San Mateo','Rizal',false);
insert into auth.users(id,email,raw_user_meta_data) values
('b1180000-0000-4000-8000-000000000001','front-id@test.local','{}'),
('b1180000-0000-4000-8000-000000000002','front-id-admin@test.local','{}');
insert into public.profiles(id,barangay_id,role,first_name,last_name,house_no,street,sex,employment_status,mobile_number,birth_date) values
('b1180000-0000-4000-8000-000000000001','a1180000-0000-4000-8000-000000000001','resident','Ana','Reyes','12','Main Street','female','student','09171234567','2000-02-29'),
('b1180000-0000-4000-8000-000000000002','a1180000-0000-4000-8000-000000000001','admin','Admin','Reyes',null,null,null,null,null,null);
insert into public.document_types(id,barangay_id,name,contract_version,service_kind,charter,purposes,requirement_rules,pricing_mode,processing_target_minutes)
values ('d1180000-0000-4000-8000-000000000001','a1180000-0000-4000-8000-000000000001','Front ID service',2,'indigency',
  '{"officeDivision":"Office","classification":"Simple","transactionType":"G2C","whoMayAvail":"Residents","checklistOfRequirements":"Valid ID","whereToSecureRequirements":"Office","clientSteps":"Submit","agencyActions":"Review","feesToBePaid":"Assessment","processingTime":"15 minutes","personResponsible":null}',
  '[{"code":"medical","label":"Medical assistance","requiresExplanation":false}]',
  '{"dtiRequired":false,"hoaRequired":false,"lessorForRenter":false,"personalAppearance":false}','assessment',15);
insert into storage.objects(bucket_id,name,metadata) values
('id-documents','b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-000000000001/id-front.jpg','{"size":1000,"mimetype":"image/jpeg"}'),
('id-documents','b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-000000000002/id-front.jpg','{"size":1000,"mimetype":"image/jpeg"}'),
('id-documents','b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-000000000002/id-back.jpg','{"size":1000,"mimetype":"image/jpeg"}');
create temp table front_id_input(payload jsonb);
insert into front_id_input values ('{"submissionId":"c1180000-0000-4000-8000-000000000001","idType":"PhilSys","frontPath":"b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-000000000001/id-front.jpg","confirmedDetails":{"fullName":"Corrected Name","idNumber":"1234-5678-9012-3456","birthDate":"2000-02-29","address":"12 Main Street"}}');
grant select on front_id_input to authenticated;
select set_config('request.jwt.claim.sub','b1180000-0000-4000-8000-000000000001',true);
set local role authenticated;
select throws_ok($$select public.publish_id_submission((select payload-'confirmedDetails' from front_id_input))$$,'22023','confirmed_details_required','Front only requires confirmed details');
select throws_ok($$select public.publish_id_submission((select jsonb_set(payload,'{confirmedDetails,fullName}','" "') from front_id_input))$$,'22023','invalid_fullName','Missing confirmed name rejected');
select throws_ok($$select public.publish_id_submission((select jsonb_set(payload,'{confirmedDetails,birthDate}','"2001-02-29"') from front_id_input))$$,'22023','invalid_birth_date','Impossible date rejected');
select throws_ok($$select public.publish_id_submission((select payload||'{"verified":true}' from front_id_input))$$,'22023','invalid_payload','Resident cannot forge approval');
select lives_ok($$select public.publish_id_submission((select payload from front_id_input))$$,'Front only publishes successfully');
select lives_ok($$select public.publish_id_submission((select payload from front_id_input))$$,'Lost response retry returns same submission');
select is((select count(*)::integer from public.id_submissions where resident_id=auth.uid()),1,'Retries create one version');
select ok((select back_path is null from public.id_submissions where resident_id=auth.uid()),'No fake back photo is stored');
select is((select confirmed_details->>'fullName' from public.id_submissions where resident_id=auth.uid()),'Corrected Name','Corrections are persisted with evidence');
select is((select full_name from public.profiles where id=auth.uid()),'Ana Reyes','ID evidence does not overwrite Profile');
select is((select cardinality(id_photo_urls) from public.profiles where id=auth.uid()),1,'Profile evidence array has front only');
select is((select id_verification_status from public.profiles where id=auth.uid()),'pending','Submission awaits staff approval');
select throws_ok($$select public.publish_id_submission((select jsonb_set(payload,'{confirmedDetails,fullName}','"Changed again"') from front_id_input))$$,'22023','idempotency_conflict','A committed version cannot be changed on retry');
select throws_ok($$select public.consume_id_extraction_limit(auth.uid())$$,'42501',null,'Residents cannot bypass server OCR limits');
set local request.jwt.claim.sub='b1180000-0000-4000-8000-000000000002';
select lives_ok($$select public.review_id_submission('{"submissionId":"c1180000-0000-4000-8000-000000000001","decision":"verified"}')$$,'Staff can approve front-only evidence');
set local request.jwt.claim.sub='b1180000-0000-4000-8000-000000000001';
select lives_ok($$select public.submit_service_request('{"documentTypeId":"d1180000-0000-4000-8000-000000000001","idempotencyKey":"e1180000-0000-4000-8000-000000000001","purposeCode":"medical","details":{},"attachments":[]}')$$,'Approved front-only evidence supports a service request');
select lives_ok($$select public.publish_id_submission('{"submissionId":"c1180000-0000-4000-8000-000000000002","idType":"Passport","frontPath":"b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-000000000002/id-front.jpg","backPath":"b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-000000000002/id-back.jpg"}')$$,'Existing two-sided clients remain supported');
select ok((select approved_id_submission_id is null from public.profiles where id=auth.uid()),'Replacement requires fresh verification');
reset role;
select ok(public.consume_id_extraction_limit('b1180000-0000-4000-8000-000000000001'),'OCR request 1 permitted');
select ok(public.consume_id_extraction_limit('b1180000-0000-4000-8000-000000000001'),'OCR request 2 permitted');
select ok(public.consume_id_extraction_limit('b1180000-0000-4000-8000-000000000001'),'OCR request 3 permitted');
select ok(public.consume_id_extraction_limit('b1180000-0000-4000-8000-000000000001'),'OCR request 4 permitted');
select ok(public.consume_id_extraction_limit('b1180000-0000-4000-8000-000000000001'),'OCR request 5 permitted');
select ok(not public.consume_id_extraction_limit('b1180000-0000-4000-8000-000000000001'),'OCR request 6 limited');
select * from finish();
rollback;
