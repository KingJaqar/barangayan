begin;
select no_plan();
insert into public.barangays(id,name) values ('a5000000-0000-0000-0000-000000000001','Barangay Ampid I'),('a5000000-0000-0000-0000-000000000002','Phase 3 foreign tenant');
insert into public.barangay_localities values ('a5000000-0000-0000-0000-000000000001','Ampid 1','San Mateo','Rizal',false);
insert into public.document_types(id,barangay_id,name,fee_centavos) values
('d5000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000001','Certificate of Indigency',5000),
('d5000000-0000-0000-0000-000000000002','a5000000-0000-0000-0000-000000000001','Barangay Clearance',5000),
('d5000000-0000-0000-0000-000000000003','a5000000-0000-0000-0000-000000000002','Other tenant service',12300);
select barangayan_private.configure_ampid_charter();
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
    when 'certified_true_copy' then '{"recordReference":"Record 12","copies":3,"totalPages":6,"personalAppearanceAcknowledged":true}'::jsonb
    else '{"isRenter":false,"personalAppearanceAcknowledged":true}'::jsonb end,
  'attachments',case service_kind when 'business' then '[{"requirementCode":"dti","path":"b5000000-0000-0000-0000-000000000001/c5000000-0000-0000-0000-000000000001/dti.pdf","mimeType":"application/pdf","sizeBytes":1000}]'::jsonb else '[]'::jsonb end)),name || ' submits without request review')
from public.document_types where barangay_id='a5000000-0000-0000-0000-000000000001' and is_active;
select is((select count(*)::int from public.service_requests where resident_id=auth.uid()),4,'All service kinds submit');

reset role;
insert into storage.objects(bucket_id,name,metadata) values
('request-attachments','b5000000-0000-0000-0000-000000000001/c5000000-0000-0000-0000-000000000001/dti-next.pdf','{"size":1000,"mimetype":"application/pdf"}');
create temp table original_fees as select id,assessed_amount_centavos,fee_basis from public.service_requests
  where resident_id='b5000000-0000-0000-0000-000000000001';
grant select on original_fees to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='b5000000-0000-0000-0000-000000000002';
select lives_ok($test$update public.document_types set
  fee_centavos=case service_kind when 'business' then 8765 when 'indigency' then 2750 when 'first_time_job_seeker' then 0 else 1250 end,
  pricing_mode=case when service_kind='certified_true_copy' then 'per_page' else 'fixed' end
  where barangay_id='a5000000-0000-0000-0000-000000000001' and contract_version=2$test$,'Admin edits fees for every document workflow');
select is(fee_centavos,case service_kind when 'business' then 8765 when 'indigency' then 2750 when 'first_time_job_seeker' then 0 else 1250 end,'Edited fee persists: ' || service_kind)
  from public.document_types where barangay_id='a5000000-0000-0000-0000-000000000001' and contract_version=2;
select is(charter->>'feesToBePaid','₱' || (fee_centavos::numeric/100)::numeric(12,2)::text || case when pricing_mode='per_page' then ' per page' else '' end,'Charter matches edited fee: ' || service_kind)
  from public.document_types where barangay_id='a5000000-0000-0000-0000-000000000001' and contract_version=2;
set local request.jwt.claim.sub='b5000000-0000-0000-0000-000000000001';
select lives_ok(format('select public.submit_service_request(%L::jsonb)',r.submission_payload || jsonb_build_object('idempotencyKey',gen_random_uuid(),
  'attachments',case when jsonb_array_length(r.submission_payload->'attachments')>0 then jsonb_set(r.submission_payload->'attachments','{0,path}',
    to_jsonb('b5000000-0000-0000-0000-000000000001/c5000000-0000-0000-0000-000000000001/dti-next.pdf'::text)) else '[]'::jsonb end)), 'New request uses edited fee')
  from public.service_requests r join original_fees old on old.id=r.id;
select is(r.assessed_amount_centavos,case d.service_kind when 'business' then 8765 when 'indigency' then 2750 when 'first_time_job_seeker' then 0 else 7500 end,'New amount follows catalog: ' || d.service_kind)
  from public.service_requests r join public.document_types d on d.id=r.document_type_id
  where r.resident_id=auth.uid() and not exists(select 1 from original_fees old where old.id=r.id);
select is(r.fee_assessment_state,'assessed','Fixed business fee and free certificates are immediately assessed')
  from public.service_requests r where r.resident_id=auth.uid() and not exists(select 1 from original_fees old where old.id=r.id);
select is(r.fee_basis,'₱12.50 per page','Copy request records its edited per-page rate')
  from public.service_requests r join public.document_types d on d.id=r.document_type_id
  where r.resident_id=auth.uid() and d.service_kind='certified_true_copy' and not exists(select 1 from original_fees old where old.id=r.id);
select results_eq($test$select r.id,r.assessed_amount_centavos,r.fee_basis from public.service_requests r join original_fees old on old.id=r.id order by r.id$test$,
  $test$select * from original_fees order by id$test$,'Existing requests keep the original fee and basis');
select lives_ok(format('select public.submit_service_request(%L::jsonb)',r.submission_payload),'Retry preserves the original request after price changes')
  from public.service_requests r join original_fees old on old.id=r.id;
select results_eq($test$update public.document_types set fee_centavos=1 where barangay_id='a5000000-0000-0000-0000-000000000001' returning id$test$,
  $test$select id from public.document_types where false$test$,'Residents cannot edit document fees');
set local request.jwt.claim.sub='b5000000-0000-0000-0000-000000000003';
select results_eq($test$update public.document_types set fee_centavos=1 where barangay_id='a5000000-0000-0000-0000-000000000001' returning id$test$,
  $test$select id from public.document_types where false$test$,'Foreign tenant cannot edit document fees');
reset role;
select barangayan_private.configure_ampid_charter();
select is(fee_centavos,case service_kind when 'business' then 8765 when 'indigency' then 2750 when 'first_time_job_seeker' then 0 else 1250 end,'Setup preserves staff-edited fee: ' || service_kind)
  from public.document_types where barangay_id='a5000000-0000-0000-0000-000000000001' and contract_version=2;
select throws_ok($test$update public.document_types set fee_centavos=-1 where barangay_id='a5000000-0000-0000-0000-000000000001'$test$,'23514',null,'Negative fees are rejected');
update public.document_types set fee_centavos=2147483647 where barangay_id='a5000000-0000-0000-0000-000000000001' and service_kind='certified_true_copy';
set local role authenticated;
set local request.jwt.claim.sub='b5000000-0000-0000-0000-000000000001';
select throws_ok(format('select public.submit_service_request(%L::jsonb)',r.submission_payload || jsonb_build_object('idempotencyKey',gen_random_uuid())),
  '22023','document_fee_total_too_large','Page totals cannot overflow the stored amount')
  from public.service_requests r join public.document_types d on d.id=r.document_type_id join original_fees old on old.id=r.id
  where d.service_kind='certified_true_copy';
reset role;
select * from finish();
rollback;
