-- Run after 0117. Test records, payment writes and schema changes roll back.
begin;
set local search_path=public,extensions,pg_catalog;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into public.barangays(id,name) values
('a1170000-0000-0000-0000-000000000001','Request workflow A'),
('a1170000-0000-0000-0000-000000000002','Request workflow B');
insert into auth.users(id,email,raw_user_meta_data) values
('b1170000-0000-0000-0000-000000000001','request-admin@test.local','{}'),
('b1170000-0000-0000-0000-000000000002','request-resident@test.local','{}'),
('b1170000-0000-0000-0000-000000000003','request-foreign@test.local','{}'),
('b1170000-0000-0000-0000-000000000004','request-removed@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values
('b1170000-0000-0000-0000-000000000001','a1170000-0000-0000-0000-000000000001','admin','Request Admin'),
('b1170000-0000-0000-0000-000000000002','a1170000-0000-0000-0000-000000000001','resident','Request Resident'),
('b1170000-0000-0000-0000-000000000003','a1170000-0000-0000-0000-000000000002','admin','Request Foreign'),
('b1170000-0000-0000-0000-000000000004','a1170000-0000-0000-0000-000000000001','admin','Request Removed');
update public.profiles set deleted_at=now() where id='b1170000-0000-0000-0000-000000000004';
insert into public.document_types(id,barangay_id,name,fee_centavos) values
('c1170000-0000-0000-0000-000000000001','a1170000-0000-0000-0000-000000000001','Legacy request workflow',5000);
insert into public.document_types(id,barangay_id,name,fee_centavos,contract_version,service_kind,charter,purposes,requirement_rules,processing_target_minutes) values
('c1170000-0000-0000-0000-000000000002','a1170000-0000-0000-0000-000000000001','Versioned request workflow',5000,2,'general',
'{"officeDivision":"Office","classification":"Simple","transactionType":"G2C","whoMayAvail":"Residents","checklistOfRequirements":"ID","whereToSecureRequirements":"Office","clientSteps":"Submit","agencyActions":"Review","feesToBePaid":"PHP 50","processingTime":"15 minutes","personResponsible":null}',
'[{"code":"general","label":"General","requiresExplanation":false}]',
'{"dtiRequired":false,"hoaRequired":false,"lessorForRenter":false,"personalAppearance":false}',15);
insert into public.service_requests(id,barangay_id,resident_id,document_type_id,payment_method)
select ('d1170000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'a1170000-0000-0000-0000-000000000001',
'b1170000-0000-0000-0000-000000000002','c1170000-0000-0000-0000-000000000001','pickup' from generate_series(1,4) n;
update public.service_requests set deleted_at=now() where id='d1170000-0000-0000-0000-000000000003';
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path) values
('e1170000-0000-0000-0000-000000000001','b1170000-0000-0000-0000-000000000002','a1170000-0000-0000-0000-000000000001',1,'Passport','workflow/front.png','workflow/back.png');
set local barangayan.foundation_operation='submit';
insert into public.service_requests(id,barangay_id,resident_id,document_type_id,payment_method,contract_version,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,requirements_review_state,eligibility_state,pricing_mode_snapshot,assessed_amount_centavos,fee_basis,fee_assessed_at,
 requirements_reviewed_by,requirements_reviewed_at,requirements_review_note)
select ('d1170000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'a1170000-0000-0000-0000-000000000001',
'b1170000-0000-0000-0000-000000000002','c1170000-0000-0000-0000-000000000002','pickup',2,
gen_random_uuid(),'{}','e1170000-0000-0000-0000-000000000001','general','General','{}',
'agency_minutes_v1',15,'pre_processing','assessed','complete','eligible','fixed',5000,'Configured fee',clock_timestamp(),
case when n=5 then 'b1170000-0000-0000-0000-000000000001'::uuid end,
case when n=5 then clock_timestamp() end,
case when n=5 then 'Requirements verified for the reviewed workflow fixture.' end from generate_series(5,6) n;
set local barangayan.foundation_operation='';

select ok(not has_function_privilege('anon',signature,'execute'),signature||': anonymous execution denied')
from unnest(array['public.begin_processing_request(uuid)','public.mark_request_ready_for_pickup(uuid)',
'public.complete_service_request(uuid)','public.cancel_service_request(uuid,text)']) signature;
set local role authenticated;
set local request.jwt.claim.sub='b1170000-0000-0000-0000-000000000001';
select is((select (row->'document_types'->>'fee_centavos')::integer from public.admin_requests_browse
where id='d1170000-0000-0000-0000-000000000001'),5000,'Active request controls receive the legacy catalog fee');
select is((select (row->'document_types'->>'fee_centavos')::integer from public.admin_requests_records
where id='d1170000-0000-0000-0000-000000000003'),5000,'Archived request details receive the legacy catalog fee');
select throws_ok($$select public.mark_request_ready_for_pickup('d1170000-0000-0000-0000-000000000001')$$,'22023',null,'Submitted request cannot skip processing');
select throws_ok($$select public.complete_service_request('d1170000-0000-0000-0000-000000000001')$$,'22023',null,'Submitted request cannot skip pickup');
select throws_ok($$select public.cancel_service_request('d1170000-0000-0000-0000-000000000002',' ')$$,'22023',null,'Cancellation requires a reason');
select lives_ok($$select public.begin_processing_request('d1170000-0000-0000-0000-000000000001')$$,'Legacy processing succeeds');
select is((select status from public.service_requests where id='d1170000-0000-0000-0000-000000000001'),'in_progress','Processing persisted');
select lives_ok($$select public.begin_processing_request('d1170000-0000-0000-0000-000000000001')$$,'Processing retry is idempotent');
select lives_ok($$select public.mark_request_ready_for_pickup('d1170000-0000-0000-0000-000000000001')$$,'Legacy ready succeeds');
select is((select status from public.service_requests where id='d1170000-0000-0000-0000-000000000001'),'ready_for_pickup','Ready persisted');
select lives_ok($$select public.collect_pickup_payment('d1170000-0000-0000-0000-000000000001')$$,'Pickup collection succeeds before completion');
select is((select payment_status from public.service_requests where id='d1170000-0000-0000-0000-000000000001'),'paid','Collected payment persisted on request');
select is((select amount_centavos from public.payments where service_request_id='d1170000-0000-0000-0000-000000000001'),5000,'Collected amount uses server fee');
select lives_ok($$select public.collect_pickup_payment('d1170000-0000-0000-0000-000000000001')$$,'Repeated collection is idempotent');
select is((select count(*)::integer from public.payments where service_request_id='d1170000-0000-0000-0000-000000000001'),1,'Repeated collection creates no duplicate payment');
select lives_ok($$select public.complete_service_request('d1170000-0000-0000-0000-000000000001')$$,'Legacy completion succeeds');
select is((select status from public.service_requests where id='d1170000-0000-0000-0000-000000000001'),'completed','Completion persisted');
select throws_ok($$select public.cancel_service_request('d1170000-0000-0000-0000-000000000001','Too late')$$,'22023',null,'Completed request cannot be cancelled');
select lives_ok($$select public.cancel_service_request('d1170000-0000-0000-0000-000000000002','Resident requested cancellation')$$,'Legacy cancellation succeeds');
select is((select status from public.service_requests where id='d1170000-0000-0000-0000-000000000002'),'cancelled','Cancellation persisted');
select throws_ok($$select public.begin_processing_request('d1170000-0000-0000-0000-000000000002')$$,'22023',null,'Cancelled request cannot restart');
select throws_ok(format('select %s',call),'42501',null,'Archived request rejects '||call)
from unnest(array[
$$public.begin_processing_request('d1170000-0000-0000-0000-000000000003')$$,
$$public.mark_request_ready_for_pickup('d1170000-0000-0000-0000-000000000003')$$,
$$public.complete_service_request('d1170000-0000-0000-0000-000000000003')$$,
$$public.cancel_service_request('d1170000-0000-0000-0000-000000000003','Fixture')$$]) call;
select throws_ok($$select public.begin_processing_request('d1170000-0000-0000-0000-000000000006')$$,'22023','complete_requirements_and_appearance_required','Versioned acceptance still rejects an unreviewed request');
select lives_ok($$select public.begin_processing_request('d1170000-0000-0000-0000-000000000005')$$,'Versioned accept delegates to guarded SLA');
select is((select sla_state from public.service_requests where id='d1170000-0000-0000-0000-000000000005'),'running','Versioned SLA running persisted');
select lives_ok($$select public.mark_request_ready_for_pickup('d1170000-0000-0000-0000-000000000005')$$,'Versioned ready delegates to guarded SLA');
select throws_ok($$select public.complete_service_request('d1170000-0000-0000-0000-000000000005')$$,'22023',null,'Versioned completion requires payment');
select lives_ok($$select public.collect_pickup_payment('d1170000-0000-0000-0000-000000000005')$$,'Versioned pickup collection succeeds');
select lives_ok($$select public.complete_service_request('d1170000-0000-0000-0000-000000000005')$$,'Versioned release succeeds after collection');
select is((select sla_state from public.service_requests where id='d1170000-0000-0000-0000-000000000005'),'released','Versioned released state persisted');
select lives_ok($$select public.cancel_service_request('d1170000-0000-0000-0000-000000000006','Resident requested cancellation')$$,'Versioned cancellation succeeds through existing RPC');
select is((select sla_state from public.service_requests where id='d1170000-0000-0000-0000-000000000006'),'cancelled','Versioned cancellation updates SLA');
select ok((select cancelled_at is not null from public.service_requests where id='d1170000-0000-0000-0000-000000000006'),'Versioned cancellation records its timestamp');

set local request.jwt.claim.sub='b1170000-0000-0000-0000-000000000003';
select throws_ok($$select public.begin_processing_request('d1170000-0000-0000-0000-000000000004')$$,'42501',null,'Foreign administrator cannot process request');
set local request.jwt.claim.sub='b1170000-0000-0000-0000-000000000004';
select throws_ok($$select public.begin_processing_request('d1170000-0000-0000-0000-000000000004')$$,'42501',null,'Removed administrator cannot process request');
set local request.jwt.claim.sub='b1170000-0000-0000-0000-000000000002';
select throws_ok($$select public.begin_processing_request('d1170000-0000-0000-0000-000000000004')$$,'42501',null,'Resident cannot process request');
reset role;
select * from finish();
rollback;
