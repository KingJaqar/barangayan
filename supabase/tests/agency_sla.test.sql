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
    when 'certified_true_copy' then '{"recordReference":"Record 12","copies":3,"personalAppearanceAcknowledged":true}'::jsonb else '{"isRenter":false,"personalAppearanceAcknowledged":true}'::jsonb end,
  'attachments',case service_kind when 'business' then '[{"requirementCode":"dti","path":"b5000000-0000-0000-0000-000000000001/c5000000-0000-0000-0000-000000000001/dti.pdf","mimeType":"application/pdf","sizeBytes":1000}]'::jsonb else '[]'::jsonb end)),name || ' submits pending assessment')
from public.document_types where barangay_id='a5000000-0000-0000-0000-000000000001' and is_active;
select throws_ok(format('select public.review_service_request(%L::jsonb)',jsonb_build_object('requestId',id,'requirementsComplete',true,'eligibility','eligible','note','Forged','personalAppearancePresent',true)),'42501',null,'Resident cannot review') from public.service_requests where resident_id=auth.uid() limit 1;
set local request.jwt.claim.sub='b5000000-0000-0000-0000-000000000002';
select throws_ok(format('select public.transition_service_request_sla(%L::jsonb)',jsonb_build_object('requestId',id,'action','accept','requirementsComplete',true,'personalAppearanceReady',true)),'22023',null,'ID approval alone cannot accept requirements') from public.service_requests where resident_id='b5000000-0000-0000-0000-000000000001';
select lives_ok(format('select public.review_service_request(%L::jsonb)',jsonb_build_object('requestId',id,'requirementsComplete',true,'eligibility','eligible','note','Documents, eligibility and residency checked','personalAppearancePresent',false)),'Staff record requirements separately') from public.service_requests where resident_id='b5000000-0000-0000-0000-000000000001';
select throws_ok(format('select public.transition_service_request_sla(%L::jsonb)',jsonb_build_object('requestId',id,'action','accept','requirementsComplete',true,'personalAppearanceReady',true)),'22023',null,'Appearance acknowledgment is not actual presence') from public.service_requests where resident_id='b5000000-0000-0000-0000-000000000001';
select lives_ok(format('select public.review_service_request(%L::jsonb)',jsonb_build_object('requestId',id,'requirementsComplete',true,'eligibility','eligible','note','Actual personal appearance confirmed','personalAppearancePresent',true)),'Staff record actual appearance') from public.service_requests where resident_id='b5000000-0000-0000-0000-000000000001';
select ok(requirements_reviewed_by=auth.uid() and requirements_reviewed_at is not null and personal_appearance_recorded_by=auth.uid(),'Review and appearance actor/time recorded') from public.service_requests where resident_id='b5000000-0000-0000-0000-000000000001';
select public.transition_service_request_sla(jsonb_build_object('requestId',id,'action','accept','requirementsComplete',true,'personalAppearanceReady',true)) from public.service_requests where resident_id='b5000000-0000-0000-0000-000000000001';
reset role;
select set_config('barangayan.foundation_operation','sla',true);
update public.service_requests set created_at='2026-01-01Z',accepted_at='2026-01-02Z' where resident_id='b5000000-0000-0000-0000-000000000001';
create temporary table timing_request as select id from public.service_requests where resident_id='b5000000-0000-0000-0000-000000000001' order by id limit 1;
select is(public.service_request_sla_metrics(id,'2026-01-02T00:11:59.999Z')->>'position','on_track','Before twelve minutes') from timing_request;
select is(public.service_request_sla_metrics(id,'2026-01-02T00:12:00Z')->>'position','near_target','At twelve minutes') from timing_request;
select is(public.service_request_sla_metrics(id,'2026-01-02T00:15:00Z')->>'position','near_target','At fifteen minutes still near target') from timing_request;
select is(public.service_request_sla_metrics(id,'2026-01-02T00:15:00.001Z')->>'position','overdue','Strictly after fifteen minutes overdue') from timing_request;
insert into public.service_request_pauses(request_id,reason,started_by,started_at) select id,'Resident clarification','b5000000-0000-0000-0000-000000000002','2026-01-02T00:12:00Z' from timing_request;
update public.service_requests set sla_state='paused' where id in(select id from timing_request);
select is((public.service_request_sla_metrics(id,'2026-01-02T01:00:00Z')->>'agencySeconds')::numeric,720::numeric,'Pause freezes counted time') from timing_request;
select is(public.service_request_sla_metrics(id,'2026-01-02T01:00:00Z')->>'waitingReason','Resident clarification','Pause reason displayed') from timing_request;
select throws_ok(format('insert into public.service_request_pauses(request_id,reason,started_by,started_at) values(%L,%L,%L,%L)',id,'Duplicate wait','b5000000-0000-0000-0000-000000000002','2026-01-02T00:13:00Z'),'22023',null,'Cannot pause paused clock') from timing_request;
update public.service_request_pauses set resumed_at='2026-01-02T00:13:00Z',resumed_by='b5000000-0000-0000-0000-000000000002' where request_id in(select id from timing_request);
update public.service_requests set sla_state='running' where id in(select id from timing_request);
select throws_ok(format('insert into public.service_request_pauses(request_id,reason,started_by,started_at) values(%L,%L,%L,%L)',id,'Overlapping wait','b5000000-0000-0000-0000-000000000002','2026-01-02T00:12:30Z'),'22023',null,'Overlapping closed pause rejected') from timing_request;
select throws_ok($q$update public.service_request_pauses set resumed_at='2026-01-02T00:14:00Z' where request_id in(select id from timing_request)$q$,'22023',null,'Repeated resume rejected');
update public.service_requests set sla_state='ready',ready_at='2026-01-02T00:16:00Z',status='ready_for_pickup' where id in(select id from timing_request);
select is((public.service_request_sla_metrics(id,'2026-01-03Z')->>'agencySeconds')::numeric,900::numeric,'Readiness stops processing at target after sixty second wait') from timing_request;
select is(public.service_request_sla_metrics(id,'2026-01-03Z')->>'position','completed_within','Ready at fifteen counted minutes completes within target') from timing_request;
select set_config('barangayan.allow_request_completion','true',true);
update public.service_requests set sla_state='released',released_at='2026-01-02T01:00:00Z',status='completed',fee_assessment_state='waived',assessed_amount_centavos=0,fee_basis='Eligible exemption',fee_assessed_by='b5000000-0000-0000-0000-000000000002',fee_assessed_at=clock_timestamp(),payment_status='waived' where id in(select id from timing_request);
select is((public.service_request_sla_metrics(id,'2026-01-03Z')->>'turnaroundSeconds')::numeric,90000::numeric,'Actual release separately stops total turnaround') from timing_request;
select lives_ok('select barangayan_private.evaluate_service_request_slas()','Delayed evaluator succeeds');
select is(barangayan_private.evaluate_service_request_slas(),0,'Repeated evaluation creates no duplicate threshold alerts');
select is((select count(*)::int from public.service_request_sla_alerts a join public.service_requests r on r.id=a.request_id where r.resident_id='b5000000-0000-0000-0000-000000000001' and r.id not in(select id from timing_request)),6,'Delayed evaluation records each crossed threshold once');
select is((select count(*)::int from public.service_request_sla_alerts where request_id in(select id from timing_request)),0,'Ready or released clock does not create unfinished alert');
set local role authenticated;
set local request.jwt.claim.sub='b5000000-0000-0000-0000-000000000001';
select throws_ok('select public.service_sla_report_rows()','42501',null,'Resident cannot access administrator report');
select is((select count(*)::int from public.service_request_sla_alerts),0,'Residents cannot read alerts');
select throws_ok('select barangayan_private.evaluate_service_request_slas()','42501',null,'Resident cannot invoke server evaluator');
update public.service_requests set target_minutes_snapshot=999 where resident_id=auth.uid();
select ok((select bool_and(target_minutes_snapshot=15) from public.service_requests where resident_id=auth.uid()),'Resident RLS update cannot change snapshot');
set local request.jwt.claim.sub='b5000000-0000-0000-0000-000000000003';
select is((select count(*)::int from public.service_request_sla_alerts),0,'Foreign staff cannot read alerts');
select is(jsonb_array_length(public.service_sla_report_rows()->'requests'),0,'Foreign report has no tenant rows');
set local request.jwt.claim.sub='b5000000-0000-0000-0000-000000000002';
select throws_ok($q$update public.service_requests set target_minutes_snapshot=999 where barangay_id=public.current_barangay_id()$q$,'42501',null,'Raw administrator snapshot tampering rejected');
select is((select count(*)::int from public.service_request_sla_alerts),6,'Authorized staff read threshold events');
select is(jsonb_array_length(public.service_sla_report_rows()->'requests'),4,'Staff report includes old submission selected by completion');
select throws_ok(format('select public.transition_service_request_sla(%L::jsonb)',jsonb_build_object('requestId',id,'action','resume')),'22023',null,'Resume without pause rejected') from public.service_requests where sla_state='running' limit 1;
select throws_ok(format('select public.transition_service_request_sla(%L::jsonb)',jsonb_build_object('requestId',id,'action','pause','reason','  ')),'22023',null,'Whitespace pause reason rejected') from public.service_requests where sla_state='running' limit 1;
select public.transition_service_request_sla(jsonb_build_object('requestId',id,'action','pause','reason','Resident must supply original')) from public.service_requests where sla_state='running';
select public.transition_service_request_sla(jsonb_build_object('requestId',id,'action','cancel','reason','Resident withdrew')) from public.service_requests where sla_state='paused';
select ok(not exists(select 1 from public.service_request_pauses where resumed_at is null),'Cancellation closes all open waits');
select ok((select bool_and(cancelled_at is not null) from public.service_requests where sla_state='cancelled'),'Cancellation records server stop time');
reset role;
select ok(exists(select 1 from cron.job where jobname='service-request-sla-minute' and schedule='* * * * *' and active),'Server evaluates at least once per minute');
select * from finish();
rollback;
