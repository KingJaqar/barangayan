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
select is(r.assessed_amount_centavos,10000,'Fixed certificate fee is 100 pesos immediately')
  from public.service_requests r join public.document_types d on d.id=r.document_type_id where r.resident_id=auth.uid() and d.service_kind in ('indigency','first_time_job_seeker');
select is(r.assessed_amount_centavos,6000,'Six total pages cost 60 pesos across all three copies')
  from public.service_requests r join public.document_types d on d.id=r.document_type_id where r.resident_id=auth.uid() and d.service_kind='certified_true_copy';
select is(r.fee_basis,'See Attached Tax Code (depends on the kind of transaction)','Business fee description is exact')
  from public.service_requests r join public.document_types d on d.id=r.document_type_id where r.resident_id=auth.uid() and d.service_kind='business';
select ok(r.assessed_amount_centavos is null and r.fee_assessment_state='pickup_due','Business amount is variable, never free')
  from public.service_requests r join public.document_types d on d.id=r.document_type_id where r.resident_id=auth.uid() and d.service_kind='business';
select ok(requirements_reviewed_by is null and fee_assessed_by is null,'No request reviewer or fee assessor needed') from public.service_requests where resident_id=auth.uid();
select lives_ok(format('select public.submit_service_request(%L::jsonb)',submission_payload),'Unchanged retry reuses submission') from public.service_requests where resident_id=auth.uid();
select is((select count(*)::int from public.service_requests where resident_id=auth.uid()),4,'Submission retry creates no duplicate');
select throws_ok(format('select public.set_service_request_payment_method(%L,''qrph'')',r.id),'22023','pickup_only_document','Business cannot select QR PH')
  from public.service_requests r join public.document_types d on d.id=r.document_type_id where r.resident_id=auth.uid() and d.service_kind='business';
select lives_ok(format('select public.set_service_request_payment_method(%L,''qrph'')',r.id),'QR PH selectable immediately without review')
  from public.service_requests r join public.document_types d on d.id=r.document_type_id where r.resident_id=auth.uid() and d.service_kind<>'business';
select lives_ok(format('select public.set_service_request_payment_method(%L,''pickup'')',id),'Pickup selectable immediately without review') from public.service_requests where resident_id=auth.uid();
select lives_ok(format('select public.start_pickup_payment(%L)',id),'Pickup confirmation works without review') from public.service_requests where resident_id=auth.uid();
select lives_ok(format('select public.start_pickup_payment(%L)',id),'Pickup retry is idempotent') from public.service_requests where resident_id=auth.uid();
select is((select count(*)::int from public.payments p join public.service_requests r on r.id=p.service_request_id where r.resident_id=auth.uid()),3,'Only fixed and per-page pickup ledgers created; no fake business zero ledger');
select throws_ok(format('select public.collect_tax_code_pickup_payment(%L,50000)',r.id),'42501',null,'Resident cannot record cash collection')
  from public.service_requests r join public.document_types d on d.id=r.document_type_id where r.resident_id=auth.uid() and d.service_kind='business';
set local request.jwt.claim.sub='b5000000-0000-0000-0000-000000000003';
select throws_ok(format('select public.set_service_request_payment_method(%L,''pickup'')',id),'42501',null,'Foreign tenant cannot select another resident payment method') from public.service_requests where false;
select throws_ok($$select public.set_service_request_payment_method((select id from public.service_requests limit 1),'pickup')$$,'42501',null,'Foreign tenant cannot mutate a request');
set local request.jwt.claim.sub='b5000000-0000-0000-0000-000000000002';
select throws_ok(format('select public.assess_service_request_fee(%L::jsonb)',jsonb_build_object('requestId',id,'state','assessed','amountCentavos',1,'basis','Override')),'22023','request_fees_are_automatic','Staff cannot override automatic fees') from public.service_requests where resident_id='b5000000-0000-0000-0000-000000000001' limit 1;
select lives_ok(format('select public.transition_service_request_sla(%L::jsonb)',jsonb_build_object('requestId',id,'action','accept')),'Processing starts without review or appearance gate') from public.service_requests where resident_id='b5000000-0000-0000-0000-000000000001';
select lives_ok(format('select public.transition_service_request_sla(%L::jsonb)',jsonb_build_object('requestId',id,'action','ready')),'Document moves to pickup') from public.service_requests where resident_id='b5000000-0000-0000-0000-000000000001';
select throws_ok(format('select public.transition_service_request_sla(%L::jsonb)',jsonb_build_object('requestId',id,'action','release')),'22023',null,'Unpaid documents still cannot release') from public.service_requests where resident_id='b5000000-0000-0000-0000-000000000001';
select lives_ok(format('select public.collect_tax_code_pickup_payment(%L,50000)',r.id),'Business cash amount recorded at pickup without prior assessment')
  from public.service_requests r join public.document_types d on d.id=r.document_type_id where r.resident_id='b5000000-0000-0000-0000-000000000001' and d.service_kind='business';
select lives_ok(format('select public.collect_tax_code_pickup_payment(%L,50000)',r.id),'Business collection retry does not double-charge')
  from public.service_requests r join public.document_types d on d.id=r.document_type_id where r.resident_id='b5000000-0000-0000-0000-000000000001' and d.service_kind='business';
select lives_ok(format('select public.collect_pickup_payment(%L)',r.id),'Other pickup amounts collected from automatic fee')
  from public.service_requests r join public.document_types d on d.id=r.document_type_id where r.resident_id='b5000000-0000-0000-0000-000000000001' and d.service_kind<>'business';
select lives_ok(format('select public.transition_service_request_sla(%L::jsonb)',jsonb_build_object('requestId',id,'action','release')),'Paid documents release normally') from public.service_requests where resident_id='b5000000-0000-0000-0000-000000000001';
reset role;
-- QR PH ledger amounts are server-calculated and remain tied to one request.
set local role authenticated;
set local request.jwt.claim.sub='b5000000-0000-0000-0000-000000000001';
select public.submit_service_request(submission_payload || jsonb_build_object('idempotencyKey','e5000000-0000-0000-0000-000000000001'))
from public.service_requests r join public.document_types d on d.id=r.document_type_id
where r.resident_id=auth.uid() and d.service_kind='certified_true_copy' limit 1;
select public.set_service_request_payment_method(id,'qrph') from public.service_requests where idempotency_key='e5000000-0000-0000-0000-000000000001';
reset role;
select throws_ok(format('insert into public.payments(service_request_id,barangay_id,method,amount_centavos,document_fee_centavos,status) values(%L,%L,''qrph'',1,1,''pending'')',id,barangay_id),'22023','confirmed_request_amount_required','Underpayment cannot create a QR ledger') from public.service_requests where idempotency_key='e5000000-0000-0000-0000-000000000001';
select lives_ok(format('insert into public.payments(service_request_id,barangay_id,method,amount_centavos,document_fee_centavos,status) values(%L,%L,''qrph'',6000,6000,''pending'')',id,barangay_id),'QR ledger accepts automatic page-based fee') from public.service_requests where idempotency_key='e5000000-0000-0000-0000-000000000001';
select lives_ok(format('update public.payments set status=''paid'',paid_at=clock_timestamp() where service_request_id=%L',id),'Confirmed QR settlement updates request') from public.service_requests where idempotency_key='e5000000-0000-0000-0000-000000000001';
select is(payment_status,'paid','Specific request carries the QR payment status') from public.service_requests where idempotency_key='e5000000-0000-0000-0000-000000000001';
select throws_ok(format('insert into public.payments(service_request_id,barangay_id,method,amount_centavos,document_fee_centavos,status) values(%L,%L,''qrph'',6000,6000,''pending'')',id,barangay_id),'22023',null,'Paid request cannot start another charge') from public.service_requests where idempotency_key='e5000000-0000-0000-0000-000000000001';
select * from finish();
rollback;
