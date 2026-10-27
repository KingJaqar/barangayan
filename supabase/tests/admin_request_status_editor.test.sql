-- Exercise the same public mutation boundary as inline cells and the record sheet.
-- All fixtures and workflow/audit/notification writes roll back.
begin;
set local search_path=public,extensions,pg_catalog;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.barangays(id,name) values
('a1440000-0000-4000-8000-000000000001','Status editor test'),
('a1440000-0000-4000-8000-000000000002','Other status editor tenant');
insert into auth.users(id,email,raw_user_meta_data) values
('b1440000-0000-4000-8000-000000000001','status-admin@test.local','{}'),
('b1440000-0000-4000-8000-000000000002','status-resident@test.local','{}'),
('b1440000-0000-4000-8000-000000000003','status-foreign@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values
('b1440000-0000-4000-8000-000000000001','a1440000-0000-4000-8000-000000000001','admin','Status Admin'),
('b1440000-0000-4000-8000-000000000002','a1440000-0000-4000-8000-000000000001','resident','Status Resident'),
('b1440000-0000-4000-8000-000000000003','a1440000-0000-4000-8000-000000000002','admin','Foreign Admin');
insert into public.document_types(id,barangay_id,name,fee_centavos,contract_version,service_kind,charter,purposes,requirement_rules,processing_target_minutes) values
('c1440000-0000-4000-8000-000000000001','a1440000-0000-4000-8000-000000000001','Status editor document',5000,2,'general',
'{"officeDivision":"Office","classification":"Simple","transactionType":"G2C","whoMayAvail":"Residents","checklistOfRequirements":"ID","whereToSecureRequirements":"Office","clientSteps":"Submit","agencyActions":"Process","feesToBePaid":"PHP 50","processingTime":"15 minutes","personResponsible":null}',
'[{"code":"general","label":"General","requiresExplanation":false}]',
'{"dtiRequired":false,"hoaRequired":false,"lessorForRenter":false,"personalAppearance":false}',15);
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,confirmed_details) values
('e1440000-0000-4000-8000-000000000001','b1440000-0000-4000-8000-000000000002','a1440000-0000-4000-8000-000000000001',1,'Passport','status-editor/front.jpg',
'{"fullName":"Status Resident","idNumber":"","birthDate":"","address":""}');

set local barangayan.foundation_operation='submit';
insert into public.service_requests(id,barangay_id,resident_id,document_type_id,reference_number,requester_notes,payment_method,contract_version,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,requirements_review_state,eligibility_state,
 pricing_mode_snapshot,assessed_amount_centavos,fee_basis,fee_assessed_at)
select ('d1440000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'a1440000-0000-4000-8000-000000000001',
 'b1440000-0000-4000-8000-000000000002','c1440000-0000-4000-8000-000000000001','STATUS-EDITOR-'||n,'Original notes','pickup',2,
 gen_random_uuid(),'{}','e1440000-0000-4000-8000-000000000001','general','General','{}',
 'agency_minutes_v1',15,'pre_processing','assessed','complete','eligible','fixed',5000,'Configured fee',clock_timestamp()
from generate_series(1,7) n;
set local barangayan.foundation_operation='';

create temp table reason_cases(id uuid,label text,patch jsonb);
insert into reason_cases values
('d1440000-0000-4000-8000-000000000001','omitted reason','{}'),
('d1440000-0000-4000-8000-000000000002','null reason','{"status_change_reason":null}'),
('d1440000-0000-4000-8000-000000000003','empty reason','{"status_change_reason":""}'),
('d1440000-0000-4000-8000-000000000004','whitespace reason','{"status_change_reason":"   "}');
grant select on reason_cases to authenticated;
create function pg_temp.save_request(p_id uuid,p_patch jsonb) returns jsonb
language sql security invoker as $$
 select public.admin_mutate_record('requests',p_id,'save',p_patch,updated_at)
 from public.service_requests where id=p_id;
$$;

select ok(not has_function_privilege('anon','barangayan_private.admin_edit_request_details(uuid,jsonb,timestamptz)','execute'),'Anonymous editor execution remains denied');
select ok(has_function_privilege('authenticated','barangayan_private.admin_edit_request_details(uuid,jsonb,timestamptz)','execute'),'Authenticated editor grant is preserved');
set local role authenticated;
set local request.jwt.claim.sub='b1440000-0000-4000-8000-000000000001';
select lives_ok(format('select pg_temp.save_request(%L,%L::jsonb)',id,patch||'{"status":"in_progress"}'::jsonb),label||': processing saves') from reason_cases;
select ok(r.status='in_progress' and r.sla_state='running' and r.accepted_at is not null,c.label||': processing state and timestamp persist')
from reason_cases c join public.service_requests r using(id);
select lives_ok(format('select pg_temp.save_request(%L,%L::jsonb)',id,patch||'{"status":"ready_for_pickup"}'::jsonb),label||': ready saves') from reason_cases;
select ok(r.status='ready_for_pickup' and r.sla_state='ready' and r.ready_at>=r.accepted_at,c.label||': ready state and timestamp persist')
from reason_cases c join public.service_requests r using(id);
select throws_ok(format('select pg_temp.save_request(%L,%L::jsonb)',id,patch||'{"status":"completed"}'::jsonb),'22023','confirmed_payment_or_waiver_required',label||': unpaid release is still blocked') from reason_cases;
select lives_ok(format('select pg_temp.save_request(%L,%L::jsonb)',id,patch||'{"payment_status":"paid","status":"completed"}'::jsonb),label||': paid completion saves atomically') from reason_cases;
select ok(r.status='completed' and r.sla_state='released' and r.payment_status='paid' and r.released_at>=r.ready_at,c.label||': completion state and timestamp persist')
from reason_cases c join public.service_requests r using(id);
select is((select count(*)::integer from public.payments p where p.service_request_id=c.id and p.status='paid' and p.amount_centavos=5000),1,c.label||': one correctly valued paid ledger') from reason_cases c;
select is(jsonb_array_length(r.status_history),4,c.label||': one history entry per status transition') from reason_cases c join public.service_requests r using(id);
select is((select count(*)::integer from public.admin_audit_log a where a.entity_id=c.id and a.metadata->>'operation'='request_record_edit'),3,c.label||': one record audit per successful transition') from reason_cases c;

select throws_ok(format('select pg_temp.save_request(%L,%L::jsonb)','d1440000-0000-4000-8000-000000000005',patch||'{"status":"cancelled"}'::jsonb),'22023','Enter a reason for cancelling the request.',label||': cancellation still requires text') from reason_cases;
select throws_ok($$select pg_temp.save_request('d1440000-0000-4000-8000-000000000005','{"status":"cancelled","status_change_reason":123}')$$,'22023','Request fields must contain text.','Non-text reasons remain invalid');
select throws_ok($$select pg_temp.save_request('d1440000-0000-4000-8000-000000000005',jsonb_build_object('status','cancelled','status_change_reason',repeat('x',1001)))$$,'22023','Notes or status reason is too long.','Overlong reasons remain invalid');
select lives_ok($$select pg_temp.save_request('d1440000-0000-4000-8000-000000000005','{"status":"cancelled","status_change_reason":"  Duplicate request  "}')$$,'Cancellation with a real reason succeeds');
select ok(status='cancelled' and sla_state='cancelled' and cancelled_at is not null,'Cancellation persists state and timestamp') from public.service_requests where id='d1440000-0000-4000-8000-000000000005';
select is(status_history->-1->>'note','Duplicate request','Cancellation history retains the trimmed reason') from public.service_requests where id='d1440000-0000-4000-8000-000000000005';
select lives_ok($$select pg_temp.save_request('d1440000-0000-4000-8000-000000000006','{"status":"in_progress","status_change_reason":"  Reviewed  ","requester_notes":null}')$$,'Supplied transition reason and explicit note clearing both succeed');
select ok(requester_notes is null and status_history->-1->>'note'='Reviewed','Text reason is retained and edit-patch null still clears notes') from public.service_requests where id='d1440000-0000-4000-8000-000000000006';
select throws_ok($$select public.admin_mutate_record('requests','d1440000-0000-4000-8000-000000000006','save','{"status":"ready_for_pickup"}','2000-01-01')$$,'40001','Record changed. Reload details.','Stale edits remain blocked');

reset role;
create temp table rollback_snapshot as
select to_jsonb(r) as request,
 (select count(*) from public.payments where service_request_id=r.id) as payments,
 (select count(*) from public.admin_audit_log where entity_id=r.id) as audits,
 (select count(*) from barangayan_private.notification_events where subject_id=r.id) as notifications
from public.service_requests r where id='d1440000-0000-4000-8000-000000000007';
set local role authenticated;
select throws_ok($$select pg_temp.save_request('d1440000-0000-4000-8000-000000000007','{"status":"completed","payment_status":"paid","requester_notes":"Must roll back"}')$$,'22023','invalid_SLA_transition','A combined edit cannot skip processing and pickup');
reset role;
select is(to_jsonb(r),s.request,'Failed combined edit rolls back the whole request, including notes, payment and history') from public.service_requests r cross join rollback_snapshot s where r.id='d1440000-0000-4000-8000-000000000007';
select is((select count(*) from public.payments where service_request_id='d1440000-0000-4000-8000-000000000007'),payments,'Failed combined edit creates no ledger') from rollback_snapshot;
select is((select count(*) from public.admin_audit_log where entity_id='d1440000-0000-4000-8000-000000000007'),audits,'Failed combined edit creates no audit entry') from rollback_snapshot;
select is((select count(*) from barangayan_private.notification_events where subject_id='d1440000-0000-4000-8000-000000000007'),notifications,'Failed combined edit creates no notification event') from rollback_snapshot;

set local role authenticated;
set local request.jwt.claim.sub='b1440000-0000-4000-8000-000000000003';
select throws_ok($$select public.admin_mutate_record('requests','d1440000-0000-4000-8000-000000000007','save','{"status":"in_progress"}',now())$$,'42501',null,'Other tenant administrator remains blocked');
set local request.jwt.claim.sub='b1440000-0000-4000-8000-000000000002';
select throws_ok($$select pg_temp.save_request('d1440000-0000-4000-8000-000000000007','{"status":"in_progress"}')$$,'42501',null,'Resident cannot use the administrator editor');
reset role;
select * from finish();
rollback;
