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
('id-documents','b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-000000000002/id-back.jpg','{"size":1000,"mimetype":"image/jpeg"}'),
('id-documents','b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-000000000003/id-front.jpg','{"size":1000,"mimetype":"image/jpeg"}');
insert into storage.objects(bucket_id,name,metadata)
select 'id-documents','b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-00000000000'||n||'/id-front.jpg','{"size":1000,"mimetype":"image/jpeg"}'
from generate_series(4,9) n;
create function pg_temp.front_payload(n integer) returns jsonb language sql as $f$
  select jsonb_build_object('submissionId','c1180000-0000-4000-8000-00000000000'||n,'idType','Passport',
    'frontPath','b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-00000000000'||n||'/id-front.jpg',
    'confirmedDetails',jsonb_build_object('fullName','Ana Reyes','idNumber','','birthDate','','address',''))
$f$;
create function pg_temp.front_review(n integer) returns jsonb language sql as $f$
  select jsonb_build_object('submissionId','c1180000-0000-4000-8000-00000000000'||n,'decision','verification_failed','reason','Photo unclear')
$f$;
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
-- One version per hour: age the first version so the replacement is allowed.
reset role;
set local session_replication_role = replica;
update public.id_submissions set submitted_at = submitted_at - interval '61 minutes' where resident_id='b1180000-0000-4000-8000-000000000001';
set local session_replication_role = origin;
set local role authenticated;
select lives_ok($$select public.publish_id_submission('{"submissionId":"c1180000-0000-4000-8000-000000000002","idType":"Passport","frontPath":"b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-000000000002/id-front.jpg","backPath":"b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-000000000002/id-back.jpg"}')$$,'Existing two-sided clients remain supported');
select ok((select approved_id_submission_id is null from public.profiles where id=auth.uid()),'Replacement requires fresh verification');
select lives_ok($$select public.publish_id_submission((select payload from front_id_input))$$,'Resolving an older front-only submission remains idempotent');
select is((select current_id_submission_id::text from public.profiles where id=auth.uid()),'c1180000-0000-4000-8000-000000000002','Resolving an older submission does not replace the newer current evidence');
select throws_ok($$select public.publish_id_submission('{"submissionId":"c1180000-0000-4000-8000-000000000003","idType":"Passport","frontPath":"b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-000000000003/id-front.jpg","confirmedDetails":{"fullName":"Ana Reyes","idNumber":"","birthDate":"","address":""}}')$$,'54000','id_resubmission_rate_limited','A second version within an hour is rejected');
select is((select count(*)::integer from public.id_submissions where resident_id=auth.uid()),2,'A rejected resubmission stores nothing');
select is((select current_id_submission_id::text from public.profiles where id=auth.uid()),'c1180000-0000-4000-8000-000000000002','A rejected resubmission leaves current evidence unchanged');
select lives_ok($$select public.publish_id_submission('{"submissionId":"c1180000-0000-4000-8000-000000000002","idType":"Passport","frontPath":"b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-000000000002/id-front.jpg","backPath":"b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-000000000002/id-back.jpg"}')$$,'A lost-response retry inside the window stays idempotent');
reset role;
set local session_replication_role = replica;
update public.id_submissions set submitted_at = submitted_at - interval '61 minutes' where resident_id='b1180000-0000-4000-8000-000000000001';
set local session_replication_role = origin;
set local role authenticated;
select lives_ok($$select public.publish_id_submission('{"submissionId":"c1180000-0000-4000-8000-000000000003","idType":"Passport","frontPath":"b1180000-0000-4000-8000-000000000001/versions/c1180000-0000-4000-8000-000000000003/id-front.jpg","confirmedDetails":{"fullName":"Ana Reyes","idNumber":"","birthDate":"","address":""}}')$$,'A new version is allowed once the hour has passed');
-- After staff rejections the resident retries at once; the third in a row locks for an hour.
set local request.jwt.claim.sub='b1180000-0000-4000-8000-000000000002';
select lives_ok($$select public.review_id_submission(pg_temp.front_review(3))$$,'Staff reject version 3');
set local request.jwt.claim.sub='b1180000-0000-4000-8000-000000000001';
select lives_ok($$select public.publish_id_submission(pg_temp.front_payload(4))$$,'First retry after a rejection is immediate');
set local request.jwt.claim.sub='b1180000-0000-4000-8000-000000000002';
select lives_ok($$select public.review_id_submission(pg_temp.front_review(4))$$,'Staff reject version 4');
set local request.jwt.claim.sub='b1180000-0000-4000-8000-000000000001';
select lives_ok($$select public.publish_id_submission(pg_temp.front_payload(5))$$,'Second retry after a rejection is immediate');
set local request.jwt.claim.sub='b1180000-0000-4000-8000-000000000002';
select lives_ok($$select public.review_id_submission(pg_temp.front_review(5))$$,'Staff reject version 5');
set local request.jwt.claim.sub='b1180000-0000-4000-8000-000000000001';
select throws_ok($$select public.publish_id_submission(pg_temp.front_payload(6))$$,'54000','id_resubmission_rate_limited','The third rejection locks submissions');
select is((select count(*)::integer from public.id_submissions where resident_id=auth.uid()),5,'A locked submission stores nothing');
reset role;
set local session_replication_role = replica;
update public.id_submissions set reviewed_at = reviewed_at - interval '61 minutes' where id='c1180000-0000-4000-8000-000000000005';
set local session_replication_role = origin;
set local role authenticated;
select lives_ok($$select public.publish_id_submission(pg_temp.front_payload(6))$$,'The lock ends an hour after the staff decision');
set local request.jwt.claim.sub='b1180000-0000-4000-8000-000000000002';
select lives_ok($$select public.review_id_submission(pg_temp.front_review(6))$$,'Staff reject version 6');
set local request.jwt.claim.sub='b1180000-0000-4000-8000-000000000001';
select lives_ok($$select public.publish_id_submission(pg_temp.front_payload(7))$$,'The count carries on: next retry is immediate');
set local request.jwt.claim.sub='b1180000-0000-4000-8000-000000000002';
select lives_ok($$select public.review_id_submission(pg_temp.front_review(7))$$,'Staff reject version 7');
set local request.jwt.claim.sub='b1180000-0000-4000-8000-000000000001';
select lives_ok($$select public.publish_id_submission(pg_temp.front_payload(8))$$,'Second retry of the next run is immediate');
set local request.jwt.claim.sub='b1180000-0000-4000-8000-000000000002';
select lives_ok($$select public.review_id_submission(pg_temp.front_review(8))$$,'Staff reject version 8');
set local request.jwt.claim.sub='b1180000-0000-4000-8000-000000000001';
select throws_ok($$select public.publish_id_submission(pg_temp.front_payload(9))$$,'54000','id_resubmission_rate_limited','Every further third rejection locks again');
reset role;
select ok(public.consume_id_extraction_limit('b1180000-0000-4000-8000-000000000001'),'OCR request 1 permitted');
select ok(public.consume_id_extraction_limit('b1180000-0000-4000-8000-000000000001'),'OCR request 2 permitted');
select ok(public.consume_id_extraction_limit('b1180000-0000-4000-8000-000000000001'),'OCR request 3 permitted');
select ok(public.consume_id_extraction_limit('b1180000-0000-4000-8000-000000000001'),'OCR request 4 permitted');
select ok(public.consume_id_extraction_limit('b1180000-0000-4000-8000-000000000001'),'OCR request 5 permitted');
select ok(not public.consume_id_extraction_limit('b1180000-0000-4000-8000-000000000001'),'OCR request 6 limited');
select * from finish();
rollback;
