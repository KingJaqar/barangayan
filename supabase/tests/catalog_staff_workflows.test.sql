begin;
select no_plan();
insert into public.barangays(id,name) values ('a5000000-0000-0000-0000-000000000001','Barangay Ampid I'),('a5000000-0000-0000-0000-000000000002','Phase 3 foreign tenant');
insert into public.barangay_localities values ('a5000000-0000-0000-0000-000000000001','Ampid 1','San Mateo','Rizal',false);
insert into public.document_types(id,barangay_id,name,fee_centavos) values
('d5000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000001','Certificate of Indigency',5000),
('d5000000-0000-0000-0000-000000000002','a5000000-0000-0000-0000-000000000001','Barangay Clearance',5000),
('d5000000-0000-0000-0000-000000000003','a5000000-0000-0000-0000-000000000002','Other tenant service',12300);
select barangayan_private.configure_ampid_charter();
select is((select count(*)::int from public.document_types where barangay_id='a5000000-0000-0000-0000-000000000001' and is_active),4,'Exactly four pilot services active');
select ok((select is_active from public.document_types where id='d5000000-0000-0000-0000-000000000003'),'Other tenant activity unchanged');
select is((select fee_centavos from public.document_types where id='d5000000-0000-0000-0000-000000000003'),12300,'Other tenant fee unchanged');
select is((select contract_version from public.document_types where id='d5000000-0000-0000-0000-000000000001'),2,'Equivalent indigency identifier reused');
select ok(not (select is_active from public.document_types where id='d5000000-0000-0000-0000-000000000002'),'General-purpose clearance deactivated without deletion');
select is((select count(*)::int from public.document_types where barangay_id='a5000000-0000-0000-0000-000000000001' and is_active and processing_target_minutes=15 and charter->>'classification'='Simple' and charter->>'transactionType'='G2C'),4,'All four preserve Simple, G2C and fifteen minutes');
select is((select charter->'personResponsible' from public.document_types where barangay_id='a5000000-0000-0000-0000-000000000001' and service_kind='certified_true_copy'),'null'::jsonb,'Missing CTC personnel remains explicitly unknown');
insert into auth.users(id,email,raw_user_meta_data) values
('b5000000-0000-0000-0000-000000000001','phase3-resident@test.local','{}'),
('b5000000-0000-0000-0000-000000000002','phase3-admin@test.local','{}'),
('b5000000-0000-0000-0000-000000000003','phase3-foreign@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values
('b5000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000001','resident','Phase 3 Resident'),
('b5000000-0000-0000-0000-000000000002','a5000000-0000-0000-0000-000000000001','admin','Phase 3 Admin'),
('b5000000-0000-0000-0000-000000000003','a5000000-0000-0000-0000-000000000002','admin','Phase 3 Foreign');
-- This submission fixture represents a resident with completed required fields.
update public.profiles set first_name='Test',last_name='Resident',house_no='1',street='Fixture Street',
 sex='female',employment_status='student',mobile_number='09171234567',birth_date='2000-01-01'
 where id='b5000000-0000-0000-0000-000000000001';
insert into storage.objects(bucket_id,name,metadata) values
('id-documents','b5000000-0000-0000-0000-000000000001/versions/c5000000-0000-0000-0000-000000000001/id-front.png','{"size":1000,"mimetype":"image/png"}'),
('id-documents','b5000000-0000-0000-0000-000000000001/versions/c5000000-0000-0000-0000-000000000001/id-back.png','{"size":1000,"mimetype":"image/png"}'),
('request-attachments','b5000000-0000-0000-0000-000000000001/c5000000-0000-0000-0000-000000000001/dti.pdf','{"size":1000,"mimetype":"application/pdf"}');
set local role authenticated;
set local request.jwt.claim.sub='b5000000-0000-0000-0000-000000000001';
select public.publish_id_submission('{"submissionId":"c5000000-0000-0000-0000-000000000001","idType":"Passport","frontPath":"b5000000-0000-0000-0000-000000000001/versions/c5000000-0000-0000-0000-000000000001/id-front.png","backPath":"b5000000-0000-0000-0000-000000000001/versions/c5000000-0000-0000-0000-000000000001/id-back.png"}');
set local request.jwt.claim.sub='b5000000-0000-0000-0000-000000000002';
select public.review_id_submission('{"submissionId":"c5000000-0000-0000-0000-000000000001","decision":"verified"}');
set local request.jwt.claim.sub='b5000000-0000-0000-0000-000000000001';
select lives_ok(format('select public.submit_service_request(%L::jsonb)',jsonb_build_object(
  'documentTypeId',id,'idempotencyKey',gen_random_uuid(),'purposeCode',purposes->0->>'code',
  'details',case service_kind when 'business' then '{"businessName":"Test Shop","establishmentAddress":"Main Street","personalAppearanceAcknowledged":true}'::jsonb
    when 'certified_true_copy' then '{"recordReference":"Record 12","copies":3,"totalPages":6,"personalAppearanceAcknowledged":true}'::jsonb else '{"isRenter":false,"personalAppearanceAcknowledged":true}'::jsonb end,
  'attachments',case service_kind when 'business' then '[{"requirementCode":"dti","path":"b5000000-0000-0000-0000-000000000001/c5000000-0000-0000-0000-000000000001/dti.pdf","mimeType":"application/pdf","sizeBytes":1000}]'::jsonb else '[]'::jsonb end)),name || ' submits with automatic pricing')
from public.document_types where barangay_id='a5000000-0000-0000-0000-000000000001' and is_active;
select ok(requirements_review_state='complete' and requirements_reviewed_by is null,'Request has no staff review gate') from public.service_requests where resident_id=auth.uid();
select ok(fee_assessment_state<>'pending','No pending fee assessment') from public.service_requests where resident_id=auth.uid();
select is(charter->>'feesToBePaid','See Attached Tax Code (depends on the kind of transaction)','Business tax-code label is exact') from public.document_types where service_kind='business' and barangay_id=public.current_barangay_id();
reset role;
select * from finish();
rollback;
