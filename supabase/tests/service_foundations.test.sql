-- Phase 1 contract/authorization tests. All fixtures roll back.
begin;
select no_plan();
-- Registration fixtures are deterministic even when no pilot data has been seeded.
update public.barangay_localities set resident_registration_enabled=false;
-- Bucket configuration is infrastructure data, absent from schema-only dumps.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('id-documents','id-documents',false,5242880,array['image/jpeg','image/jpg','image/png','image/webp'])
on conflict(id) do nothing;
insert into public.barangays(id,name) values
('a4000000-0000-0000-0000-000000000001','Foundation Tenant A'),
('a4000000-0000-0000-0000-000000000002','Foundation Tenant B');
insert into auth.users(id,email,raw_user_meta_data) values
('b4000000-0000-0000-0000-000000000001','foundation-a@test.local','{}'),
('b4000000-0000-0000-0000-000000000002','foundation-b@test.local','{}'),
('b4000000-0000-0000-0000-000000000003','foundation-admin-a@test.local','{}'),
('b4000000-0000-0000-0000-000000000004','foundation-admin-b@test.local','{}'),
('b4000000-0000-0000-0000-000000000005','foundation-google@test.local','{"full_name":"Google Name","role":"admin"}');
insert into public.profiles(id,barangay_id,role,full_name) values
('b4000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001','resident','Resident A'),
('b4000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000002','resident','Resident B'),
('b4000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000001','admin','Admin A'),
('b4000000-0000-0000-0000-000000000004','a4000000-0000-0000-0000-000000000002','admin','Admin B');
-- The authorized submission persona has a completed resident profile.
update public.profiles set first_name='Test',last_name='Resident',house_no='1',street='Fixture Street',
 sex='female',employment_status='student',mobile_number='09171234567',birth_date='2000-01-01'
 where id='b4000000-0000-0000-0000-000000000001';
insert into public.barangay_localities(barangay_id,display_name,city,province,resident_registration_enabled) values
('a4000000-0000-0000-0000-000000000001','Locality A','City A','Province A',true);
insert into public.document_types(id,barangay_id,name,contract_version,service_kind,charter,purposes,requirement_rules,pricing_mode,processing_target_minutes)
select 'd4000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001','Foundation Indigency',2,'indigency',
  jsonb_build_object('officeDivision','Office','classification','Simple','transactionType','G2C','whoMayAvail','Residents','checklistOfRequirements','Requirements',
    'whereToSecureRequirements','Office','clientSteps','Grouped steps','agencyActions','Grouped actions','feesToBePaid','Assessment','processingTime','15 minutes','personResponsible',null),
  '[{"code":"medical","label":"Medical assistance","requiresExplanation":false},{"code":"others","label":"Others","requiresExplanation":true}]',
  '{"dtiRequired":false,"hoaRequired":false,"lessorForRenter":true,"personalAppearance":true}','assessment',15;
insert into public.document_types(id,barangay_id,name,contract_version,service_kind,charter,purposes,requirement_rules,pricing_mode,processing_target_minutes)
select 'd4000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000002','Foundation Other Tenant',2,service_kind,charter,purposes,requirement_rules,pricing_mode,processing_target_minutes
from public.document_types where id='d4000000-0000-0000-0000-000000000001';
insert into public.document_types(id,barangay_id,name) values
('d4000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000001','Foundation legacy service');
insert into storage.objects(bucket_id,name,metadata) values
('id-documents','b4000000-0000-0000-0000-000000000001/versions/c4000000-0000-0000-0000-000000000001/id-front.jpg','{"size":1000,"mimetype":"image/jpeg"}'),
('id-documents','b4000000-0000-0000-0000-000000000001/versions/c4000000-0000-0000-0000-000000000001/id-back.jpg','{"size":1000,"mimetype":"image/jpeg"}'),
('request-attachments','b4000000-0000-0000-0000-000000000001/c4000000-0000-0000-0000-000000000001/lessor.pdf','{"size":5242880,"mimetype":"application/pdf"}'),
('request-attachments','b4000000-0000-0000-0000-000000000002/c4000000-0000-0000-0000-000000000001/foreign.pdf','{"size":1000,"mimetype":"application/pdf"}');
create temp table foundation_input(payload jsonb);
insert into foundation_input values ('{"documentTypeId":"d4000000-0000-0000-0000-000000000001","idempotencyKey":"e4000000-0000-0000-0000-000000000001","purposeCode":"medical","details":{"personalAppearanceAcknowledged":true},"attachments":[]}');
grant select on foundation_input to authenticated;

set local role anon;
select throws_ok($$ select public.submit_service_request('{}') $$,'42501',null,'Anonymous cannot invoke submission');
select throws_ok($$ select * from public.id_submissions $$,'42501',null,'Anonymous cannot read ID versions');
select throws_ok($$ select * from public.request_attachments $$,'42501',null,'Anonymous cannot read attachments');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000001';
set local request.jwt.claims='{"sub":"b4000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$ update public.profiles set role='admin' where id=auth.uid() $$,'42501',null,'Resident cannot assign role');
select throws_ok($$ update public.profiles set barangay_id='a4000000-0000-0000-0000-000000000002' where id=auth.uid() $$,'42501',null,'Resident cannot assign tenant');
select throws_ok($$ select public.submit_service_request((select payload from foundation_input)) $$,'42501',null,'No approval blocks submission');
select throws_ok($$ insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path) values(gen_random_uuid(),auth.uid(),public.current_barangay_id(),1,'Passport','f','b') $$,'42501',null,'ID version table has no direct write grant');
select lives_ok($$ select public.publish_id_submission('{"submissionId":"c4000000-0000-0000-0000-000000000001","idType":"Passport","frontPath":"b4000000-0000-0000-0000-000000000001/versions/c4000000-0000-0000-0000-000000000001/id-front.jpg","backPath":"b4000000-0000-0000-0000-000000000001/versions/c4000000-0000-0000-0000-000000000001/id-back.jpg"}') $$,'Resident publishes owned uploaded ID version');
select lives_ok($$ select public.publish_id_submission('{"submissionId":"c4000000-0000-0000-0000-000000000001","idType":"Passport","frontPath":"b4000000-0000-0000-0000-000000000001/versions/c4000000-0000-0000-0000-000000000001/id-front.jpg","backPath":"b4000000-0000-0000-0000-000000000001/versions/c4000000-0000-0000-0000-000000000001/id-back.jpg"}') $$,'ID publication retry is idempotent');
select is((select count(*)::int from public.id_submissions),1,'Retry creates one version');
select throws_ok($$ select public.review_id_submission('{"submissionId":"c4000000-0000-0000-0000-000000000001","decision":"verified"}') $$,'42501',null,'Resident cannot approve evidence');
select throws_ok($$ update public.profiles set id_verification_status='verified' where id=auth.uid() $$,'42501',null,'Resident cannot assign a versioned verification outcome');
with changed as (update storage.objects set metadata='{"size":1}' where name like '%/versions/%' returning id)
select is((select count(*)::int from changed),0,'Resident cannot overwrite version evidence');
-- Current Storage also rejects all direct SQL deletes before row RLS runs.
-- Both outcomes must leave versioned evidence intact; API deletion is covered
-- separately by the real HTTP suite, without bypassing Storage protection.
select lives_ok($test$
do $delete_check$
declare removed integer;
begin
  begin
    with changed as (delete from storage.objects where name like '%/versions/%' returning id)
    select count(*)::int into removed from changed;
    if removed <> 0 then raise exception 'Resident deleted version evidence'; end if;
  exception when sqlstate '42501' then
    if sqlerrm <> 'Direct deletion from storage tables is not allowed. Use the Storage API instead.' then raise; end if;
  end;
end $delete_check$;
$test$,'Resident cannot delete version evidence');
select throws_ok($$ select public.submit_service_request((select payload from foundation_input)) $$,'42501',null,'Pending approval blocks submission');
select throws_ok($$ insert into public.service_requests(barangay_id,resident_id,document_type_id) values(public.current_barangay_id(),auth.uid(),'d4000000-0000-0000-0000-000000000001') $$,'42501',null,'Direct insert cannot downgrade v2 service');
select throws_ok($$ insert into public.service_requests(barangay_id,resident_id,document_type_id) values(public.current_barangay_id(),auth.uid(),'d4000000-0000-0000-0000-000000000002') $$,'42501',null,'Cross-tenant related service rejected at table boundary');
select throws_ok($$ insert into public.service_requests(barangay_id,resident_id,document_type_id,status) values(public.current_barangay_id(),auth.uid(),'d4000000-0000-0000-0000-000000000003','completed') $$,'22023',null,'Legacy direct insert cannot forge initial state');
select throws_ok($$ insert into public.service_requests(barangay_id,resident_id,document_type_id,idempotency_key,submission_payload) values(public.current_barangay_id(),auth.uid(),'d4000000-0000-0000-0000-000000000003','e4000000-0000-0000-0000-000000000001','{}') $$,'23514',null,'Legacy insert cannot reserve a controlled idempotency key');
set local barangayan.foundation_operation='submit';
select throws_ok($$ insert into public.service_requests(barangay_id,resident_id,document_type_id,contract_version) values(public.current_barangay_id(),auth.uid(),'d4000000-0000-0000-0000-000000000001',2) $$,'42501',null,'Caller cannot impersonate controlled submission with a session setting');
set local barangayan.foundation_operation='';
select lives_ok($$ insert into public.service_requests(id,barangay_id,resident_id,document_type_id) values('c4100000-0000-0000-0000-000000000003',public.current_barangay_id(),auth.uid(),'d4000000-0000-0000-0000-000000000003') $$,'Legacy supported submission remains available');
select lives_ok($$ select public.cancel_own_service_request('c4100000-0000-0000-0000-000000000003','Legacy cancellation') $$,'Existing cancellation RPC retains legacy behavior');
select is((select status from public.service_requests where id='c4100000-0000-0000-0000-000000000003'),'cancelled','Legacy cancellation keeps established status');
select throws_ok($$ insert into public.service_requests(barangay_id,resident_id,document_type_id,accepted_at) values(public.current_barangay_id(),auth.uid(),'d4000000-0000-0000-0000-000000000003',clock_timestamp()) $$,'23514',null,'Legacy insert cannot forge agency acceptance evidence');

set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000004';
select throws_ok($$ select public.review_id_submission('{"submissionId":"c4000000-0000-0000-0000-000000000001","decision":"verified"}') $$,'42501',null,'Other tenant administrator cannot review evidence');
select is((select count(*)::int from public.id_submissions),0,'Other tenant administrator cannot read evidence');
set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000003';
select throws_ok($$ update public.service_requests set contract_version=2 where id='c4100000-0000-0000-0000-000000000003' $$,'42501',null,'Historical request contract cannot be converted by a raw update');
select lives_ok($$ select public.review_id_submission('{"submissionId":"c4000000-0000-0000-0000-000000000001","decision":"verified"}') $$,'Tenant administrator approves reviewed version');
select throws_ok($$ select public.review_id_submission('{"submissionId":"c4000000-0000-0000-0000-000000000001","decision":"verified"}') $$,'22023',null,'Repeated review rejected');

set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000001';
select throws_ok($$ select public.submit_service_request((select payload || '{"residentId":"b4000000-0000-0000-0000-000000000002"}' from foundation_input)) $$,'22023',null,'Forged identity rejected');
select throws_ok($$ select public.submit_service_request((select payload || '{"purposeCode":"others","purposeExplanation":"   "}' from foundation_input)) $$,'22023',null,'Whitespace Others explanation rejected');
select throws_ok($$ select public.submit_service_request((select payload || jsonb_build_object('purposeCode','others','purposeExplanation',repeat('x',1001)) from foundation_input)) $$,'22023',null,'Excessive purpose rejected');
select throws_ok($$ select public.submit_service_request((select payload || '{"details":{}}' from foundation_input)) $$,'22023',null,'Missing appearance acknowledgment rejected');
select throws_ok($$ select public.submit_service_request((select payload || '{"attachments":[{"requirementCode":"other","path":"b4000000-0000-0000-0000-000000000002/c4000000-0000-0000-0000-000000000001/foreign.pdf","mimeType":"application/pdf","sizeBytes":1000}]}' from foundation_input)) $$,'22023',null,'Foreign uploaded file reference rejected');
select throws_ok($$ select public.submit_service_request((select payload || '{"attachments":[{"requirementCode":"lessor","path":"b4000000-0000-0000-0000-000000000001/c4000000-0000-0000-0000-000000000001/lessor.pdf","mimeType":"application/pdf","sizeBytes":1000}]}' from foundation_input)) $$,'22023',null,'Forged size does not match uploaded metadata');
select throws_ok($$ select public.submit_service_request((select payload || '{"attachments":[{"requirementCode":"other","path":"b4000000-0000-0000-0000-000000000001/c4000000-0000-0000-0000-000000000001/missing.pdf","mimeType":"application/pdf","sizeBytes":1000}]}' from foundation_input)) $$,'22023',null,'Failed or missing upload cannot be attached');
select lives_ok($$ select public.submit_service_request((select payload from foundation_input)) $$,'Verified resident submits while pricing pending');
select lives_ok($$ select public.submit_service_request((select payload from foundation_input)) $$,'Same-key retry returns original request');
select is((select count(*)::int from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),1,'One persisted request for retries');
select throws_ok($$ select public.submit_service_request((select payload || '{"requesterNotes":"changed"}' from foundation_input)) $$,'22023',null,'Same key with changed payload is a conflict');
select is((select fee_assessment_state from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'pending','Fee state is separate from request status');
select is((select sla_state from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'pre_processing','Clock does not start at online submission');
select is((select target_minutes_snapshot from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),15,'Target snapshot persisted');
select throws_ok($$ select public.assess_service_request_fee(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'state','waived','amountCentavos',0,'basis','Exempt')) $$,'42501',null,'Resident cannot assess fees');
select throws_ok($$ select public.transition_service_request_sla(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'action','accept','requirementsComplete',true,'personalAppearanceReady',true)) $$,'42501',null,'Resident cannot start agency processing');

set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000003';
select throws_ok($$ insert into public.payments(service_request_id,barangay_id,method,amount_centavos,document_fee_centavos) select id,barangay_id,'pickup',10000,10000 from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001' $$,'22023',null,'Pending fee assessment blocks payment at ledger boundary');
select throws_ok($$ update public.service_requests set assessed_amount_centavos=10000 where idempotency_key='e4000000-0000-0000-0000-000000000001' $$,'42501',null,'Administrator must use controlled assessment');
set local barangayan.foundation_operation='assessment';
select throws_ok($$ update public.service_requests set assessed_amount_centavos=10000 where idempotency_key='e4000000-0000-0000-0000-000000000001' $$,'42501',null,'Administrator cannot impersonate controlled assessment with a session setting');
set local barangayan.foundation_operation='';
select throws_ok($$ select public.transition_service_request_sla(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'action','accept','requirementsComplete',true)) $$,'22023',null,'Appearance readiness required before acceptance');
select lives_ok($$ select public.review_service_request(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'requirementsComplete',true,'eligibility','eligible','note','Reviewed documents and eligibility','personalAppearancePresent',true)) $$,'Audited requirement review and actual appearance recorded');
select lives_ok($$ select public.transition_service_request_sla(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'action','accept','requirementsComplete',true,'personalAppearanceReady',true)) $$,'Complete requirements and appearance start clock');
select throws_ok($$ select public.transition_service_request_sla(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'action','pause')) $$,'22023',null,'Pause requires documented resident reason');
select lives_ok($$ select public.transition_service_request_sla(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'action','pause','reason','Resident obtaining missing document')) $$,'Resident wait recorded');
select throws_ok($$ select public.transition_service_request_sla(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'action','pause','reason','Another wait')) $$,'22023',null,'Overlapping pause rejected');
select lives_ok($$ select public.transition_service_request_sla(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'action','resume')) $$,'Open wait resumed');
select throws_ok($$ select public.transition_service_request_sla(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'action','resume')) $$,'22023',null,'Repeated resume rejected');
select lives_ok($$ select public.assess_service_request_fee(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'state','waived','amountCentavos',0,'basis','Confirmed exemption')) $$,'Explicit waiver persists administrator basis');
select lives_ok($$ select public.transition_service_request_sla(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'action','ready')) $$,'Readiness stops processing clock');
select lives_ok($$ select public.transition_service_request_sla(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'action','release')) $$,'Waiver bypasses payment and permits release');
select ok((select accepted_at <= ready_at and ready_at <= released_at from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'Acceptance, readiness and release are separate ordered server times');
select throws_ok($$ update public.service_requests set target_minutes_snapshot=60 where idempotency_key='e4000000-0000-0000-0000-000000000001' $$,'42501',null,'Target snapshot cannot be overwritten');

select throws_ok($$ update public.document_types set purposes='[{"code":"same","label":"A","requiresExplanation":false},{"code":"same","label":"B","requiresExplanation":false}]' where id='d4000000-0000-0000-0000-000000000001' $$,'22023',null,'Catalog rejects duplicate purpose codes at server boundary');
select lives_ok($$ update public.document_types set processing_target_minutes=60 where id='d4000000-0000-0000-0000-000000000001' $$,'Administrator may change future catalog target');
select is((select target_minutes_snapshot from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),15,'Existing target snapshot survives catalog edit');

set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000001';
select throws_ok($$ select public.submit_service_request((select payload || '{"idempotencyKey":"e4000000-0000-0000-0000-000000000002","details":{"personalAppearanceAcknowledged":true,"isRenter":true}}' from foundation_input)) $$,'22023',null,'Renter requires lessor evidence independently of verified identity');
select lives_ok($$ select public.submit_service_request((select payload || '{"idempotencyKey":"e4000000-0000-0000-0000-000000000002","details":{"personalAppearanceAcknowledged":true,"isRenter":true},"attachments":[{"requirementCode":"lessor","path":"b4000000-0000-0000-0000-000000000001/c4000000-0000-0000-0000-000000000001/lessor.pdf","mimeType":"application/pdf","sizeBytes":5242880}]}' from foundation_input)) $$,'Owned file at exact 5 MB limit attaches transactionally');
select is((select count(*)::int from public.request_attachments),1,'Owner reads attached supporting metadata');
select throws_ok($$ insert into public.request_attachments(request_id,resident_id,barangay_id,requirement_code,object_path,mime_type,size_bytes) select id,resident_id,barangay_id,'other','fake','application/pdf',1 from public.service_requests limit 1 $$,'42501',null,'Attachment associations have no direct write grant');
select throws_ok($$ insert into storage.objects(bucket_id,name) values('request-attachments','b4000000-0000-0000-0000-000000000002/c4000000-0000-0000-0000-000000000001/forged.pdf') $$,'42501',null,'Upload cannot assign another owner path');
with changed as (update storage.objects set metadata='{"size":1}' where bucket_id='request-attachments' returning id)
select is((select count(*)::int from changed),0,'Supporting evidence cannot be overwritten');
set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000003';
select is((select count(*)::int from public.request_attachments),1,'Same-tenant administrator reads attachment associations');
select is((select count(*)::int from storage.objects where bucket_id='request-attachments'),1,'Administrator reads attached evidence, not unattached foreign files');
select lives_ok($$ select public.assess_service_request_fee(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000002'),'state','assessed','amountCentavos',5000,'basis','Confirmed fee')) $$,'Administrator confirms request amount');
select throws_ok($$ insert into public.payments(service_request_id,barangay_id,method,amount_centavos,document_fee_centavos) select id,barangay_id,'pickup',100,100 from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000002' $$,'22023',null,'Payment rejects amount differing from assessment');
select lives_ok($$ insert into public.payments(service_request_id,barangay_id,method,amount_centavos,document_fee_centavos) select id,barangay_id,'pickup',5000,5000 from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000002' $$,'Confirmed request amount begins payment');
select throws_ok($$ insert into public.payments(service_request_id,barangay_id,method,amount_centavos,document_fee_centavos) select id,barangay_id,'pickup',5000,5000 from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000002' $$,'23505',null,'Second active payment is rejected');
select throws_ok($$ select public.assess_service_request_fee(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000002'),'state','assessed','amountCentavos',6000,'basis','Changed fee')) $$,'22023',null,'Amount freezes when payment begins');
select throws_ok($$ update public.payments set amount_centavos=6000 where service_request_id=(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000002') $$,'22023',null,'Ledger cannot overwrite frozen assessed amount');
set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000004';
select is((select count(*)::int from public.request_attachments),0,'Other-tenant administrator cannot read attachments');
select is((select count(*)::int from storage.objects where bucket_id='request-attachments'),0,'Other-tenant administrator cannot read supporting objects');
select throws_ok($$ select public.assess_service_request_fee('{"requestId":"c4000000-0000-0000-0000-000000000001","state":"waived","amountCentavos":0,"basis":"Forged"}') $$,'42501',null,'Other-tenant administrator cannot assess a foreign request');

reset role;
insert into public.document_types(id,barangay_id,name,contract_version,service_kind,charter,purposes,requirement_rules,pricing_mode,processing_target_minutes,fee_centavos)
select 'd4000000-0000-0000-0000-000000000004',barangay_id,'Foundation Certified Copy',2,'certified_true_copy',charter,purposes,
  '{"dtiRequired":false,"hoaRequired":false,"lessorForRenter":false,"personalAppearance":false}','per_page',15,1000
from public.document_types where id='d4000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000001';
select lives_ok($$ select public.submit_service_request('{"documentTypeId":"d4000000-0000-0000-0000-000000000004","idempotencyKey":"e4000000-0000-0000-0000-000000000004","purposeCode":"medical","details":{"recordReference":"Record 12","copies":3},"attachments":[]}') $$,'Copy request snapshots description and copies');
set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000003';
select throws_ok($$ select public.assess_service_request_fee(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000004'),'state','assessed','amountCentavos',12000,'billablePages',4,'basis','Four total pages')) $$,'22023',null,'Total pages cannot be multiplied by requested copies again');
select lives_ok($$ select public.assess_service_request_fee(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000004'),'state','assessed','amountCentavos',4000,'billablePages',4,'basis','Four total pages')) $$,'Ten pesos per total confirmed page');
select lives_ok($$ select public.review_service_request(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000004'),'requirementsComplete',true,'eligibility','eligible','note','Reviewed record and eligibility','personalAppearancePresent',false)) $$,'Copy requirement review recorded');
select lives_ok($$ select public.transition_service_request_sla(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000004'),'action','accept','requirementsComplete',true)) $$,'Copy processing can start after complete requirements');
select lives_ok($$ select public.transition_service_request_sla(jsonb_build_object('requestId',(select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000004'),'action','pause','reason','Resident clarification')) $$,'Copy wait recorded');
set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000001';
select lives_ok($$ select public.cancel_own_service_request((select id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000004'),'Resident cancels') $$,'Existing resident cancellation RPC supports v2 and freezes clock');
select is((select sla_state from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000004'),'cancelled','Cancellation freezes new timing state');
select is((select count(*)::int from public.service_request_pauses where resumed_at is null),0,'Cancellation closes documented resident waits');

reset role;
insert into public.document_types(id,barangay_id,name,contract_version,service_kind,charter,purposes,requirement_rules,pricing_mode,processing_target_minutes)
select 'd4000000-0000-0000-0000-000000000005',barangay_id,'Foundation Business',2,'business',charter,purposes,
  '{"dtiRequired":true,"hoaRequired":false,"lessorForRenter":false,"personalAppearance":false}','assessment',15
from public.document_types where id='d4000000-0000-0000-0000-000000000001';
insert into public.document_types(id,barangay_id,name,contract_version,service_kind,charter,purposes,requirement_rules,pricing_mode,processing_target_minutes)
select 'd4000000-0000-0000-0000-000000000006',barangay_id,'Foundation Job Seeker',2,'first_time_job_seeker',charter,purposes,
  '{"dtiRequired":false,"hoaRequired":true,"lessorForRenter":true,"personalAppearance":false}','assessment',15
from public.document_types where id='d4000000-0000-0000-0000-000000000001';
insert into storage.objects(bucket_id,name,metadata) values
('request-attachments','b4000000-0000-0000-0000-000000000001/c4000000-0000-0000-0000-000000000001/dti.pdf','{"size":1000,"mimetype":"application/pdf"}'),
('request-attachments','b4000000-0000-0000-0000-000000000001/c4000000-0000-0000-0000-000000000001/hoa.pdf','{"size":1000,"mimetype":"application/pdf"}');
set local role authenticated;
set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000001';
select throws_ok($$ select public.submit_service_request('{"documentTypeId":"d4000000-0000-0000-0000-000000000005","idempotencyKey":"e4000000-0000-0000-0000-000000000006","purposeCode":"medical","details":{"businessName":"Shop","establishmentAddress":"Main Street"},"attachments":[]}') $$,'22023',null,'Business identity approval does not replace DTI requirement');
select lives_ok($$ select public.submit_service_request('{"documentTypeId":"d4000000-0000-0000-0000-000000000005","idempotencyKey":"e4000000-0000-0000-0000-000000000006","purposeCode":"medical","details":{"businessName":"Shop","establishmentAddress":"Main Street"},"attachments":[{"requirementCode":"dti","path":"b4000000-0000-0000-0000-000000000001/c4000000-0000-0000-0000-000000000001/dti.pdf","mimeType":"application/pdf","sizeBytes":1000}]}') $$,'Business request accepts owned DTI evidence and business details');
select throws_ok($$ select public.submit_service_request('{"documentTypeId":"d4000000-0000-0000-0000-000000000006","idempotencyKey":"e4000000-0000-0000-0000-000000000007","purposeCode":"medical","details":{},"attachments":[]}') $$,'22023',null,'Job seeker identity approval does not replace HOA requirement');
select lives_ok($$ select public.submit_service_request('{"documentTypeId":"d4000000-0000-0000-0000-000000000006","idempotencyKey":"e4000000-0000-0000-0000-000000000007","purposeCode":"medical","details":{},"attachments":[{"requirementCode":"hoa","path":"b4000000-0000-0000-0000-000000000001/c4000000-0000-0000-0000-000000000001/hoa.pdf","mimeType":"application/pdf","sizeBytes":1000}]}') $$,'Job seeker request accepts configured HOA evidence without non-renter lessor file');
reset role;
insert into storage.objects(bucket_id,name,metadata) values
('id-documents','b4000000-0000-0000-0000-000000000001/versions/c4000000-0000-0000-0000-000000000002/id-front.jpg','{"size":1000,"mimetype":"image/jpeg"}'),
('id-documents','b4000000-0000-0000-0000-000000000001/versions/c4000000-0000-0000-0000-000000000002/id-back.jpg','{"size":1000,"mimetype":"image/jpeg"}');
set local role authenticated;
set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000001';
select lives_ok($$ update public.profiles set mobile_number='09171234567' where id=auth.uid() $$,'Unrelated profile edit preserves versioned approval');
select is((select id_verification_status from public.profiles where id=auth.uid()),'verified','Unrelated edit retains approval');
select lives_ok($$ select public.publish_id_submission('{"submissionId":"c4000000-0000-0000-0000-000000000002","idType":"PhilSys","frontPath":"b4000000-0000-0000-0000-000000000001/versions/c4000000-0000-0000-0000-000000000002/id-front.jpg","backPath":"b4000000-0000-0000-0000-000000000001/versions/c4000000-0000-0000-0000-000000000002/id-back.jpg"}') $$,'Replacement publishes a distinct immutable evidence version');
select is((select id_verification_status from public.profiles where id=auth.uid()),'pending','Replacement clears approval');
select throws_ok($$ select public.submit_service_request((select payload || '{"idempotencyKey":"e4000000-0000-0000-0000-000000000005"}' from foundation_input)) $$,'42501',null,'Replacement pending evidence blocks new requests');
select is((select approved_id_submission_id from public.service_requests where idempotency_key='e4000000-0000-0000-0000-000000000001'),'c4000000-0000-0000-0000-000000000001'::uuid,'Historical request retains reviewed evidence reference');
set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000003';
select throws_ok($$ select public.review_id_submission('{"submissionId":"c4000000-0000-0000-0000-000000000001","decision":"revoked","reason":"Stale review"}') $$,'22023',null,'Stale evidence review cannot alter replacement');
select lives_ok($$ select public.review_id_submission('{"submissionId":"c4000000-0000-0000-0000-000000000002","decision":"verification_failed","reason":"Unreadable evidence"}') $$,'Administrator rejection records reason and actor');
set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000001';
select throws_ok($$ select public.submit_service_request((select payload || '{"idempotencyKey":"e4000000-0000-0000-0000-000000000005"}' from foundation_input)) $$,'42501',null,'Failed verification blocks new requests');
select lives_ok($$ select public.submit_service_request((select payload from foundation_input)) $$,'Lost-response retry still retrieves historical request after replacement');

set local request.jwt.claim.sub='b4000000-0000-0000-0000-000000000005';
select lives_ok($$ select public.complete_resident_profile('{"firstName":"Ana","lastName":"Reyes","houseNo":"12","street":"Main Street","sex":"female","employmentStatus":"student","mobileNumber":"09171234567","birthDate":"2000-02-29"}') $$,'Named OAuth identity without registration metadata can complete profile');
select is((select role from public.profiles where id=auth.uid()),'resident','User metadata role does not assign authority');
select is((select city from public.profiles where id=auth.uid()),'City A','Completion derives configured locality');
select is((select province from public.profiles where id=auth.uid()),'Province A','Completion derives province');
select throws_ok($$ select public.complete_resident_profile('{"firstName":"Ana","lastName":"Reyes","houseNo":"12","street":"Main Street","sex":"female","employmentStatus":"student","mobileNumber":"09171234567","birthDate":"2000-02-29","barangayId":"a4000000-0000-0000-0000-000000000002"}') $$,'22023',null,'Completion rejects tenant injection');
select throws_ok($$ select public.complete_resident_profile('{"firstName":"Ana","lastName":"Reyes","houseNo":"12","street":"Main Street","sex":null,"employmentStatus":"student","mobileNumber":"09171234567","birthDate":"2000-02-29"}') $$,'22023',null,'Required profile enum cannot be JSON null');
select lives_ok($$ select public.request_own_account_deletion() $$,'Existing self-service account anonymization remains compatible');
select throws_ok($$ select public.submit_service_request((select payload from foundation_input)) $$,'42501',null,'Deleted identity cannot invoke controlled submission');
select throws_ok($$ select public.complete_resident_profile('{"firstName":"Ana","lastName":"Reyes","houseNo":"12","street":"Main Street","sex":"female","employmentStatus":"student","mobileNumber":"09171234567","birthDate":"2000-02-29"}') $$,'42501',null,'Profile completion cannot restore a deleted identity');
reset role;
select * from finish();
rollback;
