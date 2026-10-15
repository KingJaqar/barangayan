begin;
insert into public.barangays(id,name) values ('a6250000-0000-0000-0000-000000000001','Barangay Ampid I'),('a6250000-0000-0000-0000-000000000002','Phase 3 foreign tenant');
insert into public.barangay_localities values ('a6250000-0000-0000-0000-000000000001','Ampid 1','San Mateo','Rizal',false);
insert into public.document_types(id,barangay_id,name,fee_centavos) values
('d6250000-0000-0000-0000-000000000001','a6250000-0000-0000-0000-000000000001','Certificate of Indigency',5000),
('d6250000-0000-0000-0000-000000000002','a6250000-0000-0000-0000-000000000001','Barangay Clearance',5000),
('d6250000-0000-0000-0000-000000000003','a6250000-0000-0000-0000-000000000002','Other tenant service',12300);
select barangayan_private.configure_ampid_charter();
insert into auth.users(id,email,raw_user_meta_data) values
('b6250000-0000-0000-0000-000000000001','migration125-resident@test.local','{}'),
('b6250000-0000-0000-0000-000000000002','migration125-admin@test.local','{}'),
('b6250000-0000-0000-0000-000000000003','migration125-foreign@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values
('b6250000-0000-0000-0000-000000000001','a6250000-0000-0000-0000-000000000001','resident','Phase 3 Resident'),
('b6250000-0000-0000-0000-000000000002','a6250000-0000-0000-0000-000000000001','admin','Phase 3 Admin'),
('b6250000-0000-0000-0000-000000000003','a6250000-0000-0000-0000-000000000002','admin','Phase 3 Foreign');
-- This submission fixture represents a resident with completed required fields.
update public.profiles set first_name='Test',last_name='Resident',house_no='1',street='Fixture Street',
 sex='female',employment_status='student',mobile_number='09171234567',birth_date='2000-01-01'
 where id='b6250000-0000-0000-0000-000000000001';
insert into storage.objects(bucket_id,name,metadata) values
('id-documents','b6250000-0000-0000-0000-000000000001/versions/c6250000-0000-0000-0000-000000000001/id-front.png','{"size":1000,"mimetype":"image/png"}'),
('id-documents','b6250000-0000-0000-0000-000000000001/versions/c6250000-0000-0000-0000-000000000001/id-back.png','{"size":1000,"mimetype":"image/png"}'),
('request-attachments','b6250000-0000-0000-0000-000000000001/c6250000-0000-0000-0000-000000000001/dti.pdf','{"size":1000,"mimetype":"application/pdf"}');
set local role authenticated;
set local request.jwt.claim.sub='b6250000-0000-0000-0000-000000000001';
select public.publish_id_submission('{"submissionId":"c6250000-0000-0000-0000-000000000001","idType":"Passport","frontPath":"b6250000-0000-0000-0000-000000000001/versions/c6250000-0000-0000-0000-000000000001/id-front.png","backPath":"b6250000-0000-0000-0000-000000000001/versions/c6250000-0000-0000-0000-000000000001/id-back.png"}');
set local request.jwt.claim.sub='b6250000-0000-0000-0000-000000000002';
select public.review_id_submission('{"submissionId":"c6250000-0000-0000-0000-000000000001","decision":"verified"}');
set local request.jwt.claim.sub='b6250000-0000-0000-0000-000000000001';
select public.submit_service_request(jsonb_build_object(
  'documentTypeId',id,'idempotencyKey',gen_random_uuid(),'purposeCode',purposes->0->>'code',
  'details',case service_kind when 'business' then '{"businessName":"Test Shop","establishmentAddress":"Main Street","personalAppearanceAcknowledged":true}'::jsonb
    when 'certified_true_copy' then '{"recordReference":"Record 12","copies":3,"personalAppearanceAcknowledged":true}'::jsonb else '{"isRenter":false,"personalAppearanceAcknowledged":true}'::jsonb end,
  'attachments',case service_kind when 'business' then '[{"requirementCode":"dti","path":"b6250000-0000-0000-0000-000000000001/c6250000-0000-0000-0000-000000000001/dti.pdf","mimeType":"application/pdf","sizeBytes":1000}]'::jsonb else '[]'::jsonb end))
from public.document_types where barangay_id='a6250000-0000-0000-0000-000000000001' and is_active;
set local request.jwt.claim.sub='b6250000-0000-0000-0000-000000000002';
select public.assess_service_request_fee(jsonb_build_object('requestId',r.id,'state','assessed','amountCentavos',2500,'basis','Historical cash amount'))
from public.service_requests r join public.document_types d on d.id=r.document_type_id where r.resident_id='b6250000-0000-0000-0000-000000000001' and d.service_kind='first_time_job_seeker';
set local request.jwt.claim.sub='b6250000-0000-0000-0000-000000000001';
select public.set_service_request_payment_method(r.id,'pickup') from public.service_requests r join public.document_types d on d.id=r.document_type_id where r.resident_id=auth.uid() and d.service_kind='first_time_job_seeker';
select public.start_pickup_payment(r.id) from public.service_requests r join public.document_types d on d.id=r.document_type_id where r.resident_id=auth.uid() and d.service_kind='first_time_job_seeker';
reset role;
commit;
