begin; set local lock_timeout='5s';set local statement_timeout='60s';
insert into public.barangays(id,name) values ('a3000000-0000-4000-8000-000000000001','Home synthetic A'),('a3000000-0000-4000-8000-000000000002','Home synthetic B');
insert into public.document_types(id,barangay_id,name,fee_centavos) values
 ('c3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','Legacy Home fixture',3100);
insert into public.document_types(id,barangay_id,name,fee_centavos,contract_version,service_kind,charter,requirement_rules,purposes,processing_target_minutes,pricing_mode) values
 ('c3000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001','Business Home fixture',0,2,'business',
 '{"officeDivision":"Synthetic fixture","classification":"Synthetic fixture","transactionType":"Synthetic fixture","whoMayAvail":"Synthetic fixture","checklistOfRequirements":"Synthetic fixture","whereToSecureRequirements":"Synthetic fixture","clientSteps":"Synthetic fixture","agencyActions":"Synthetic fixture","feesToBePaid":"Synthetic fixture","processingTime":"Synthetic fixture","personResponsible":"Synthetic fixture"}','{"dtiRequired":false,"hoaRequired":false,"lessorForRenter":false,"personalAppearance":false}',
 '[{"code":"fixture","label":"Fixture","requiresExplanation":false}]',15,'fixed');
-- Privileged fixture seed uses the same server-only completion context as transitions.
-- No trigger, constraint or policy is disabled while inserting historical states.
set local barangayan.allow_request_completion='true';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000001','home-p3-1@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-1','fixture/back-1','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,'2026-01-01',
 'd3000000-0000-4000-8000-000000000001','{}','e3000000-0000-4000-8000-000000000001','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','assessed',1000,'Fixture fee',now(),'complete','fixed');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='pending',payment_method=null,
 sla_state='pre_processing',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000001';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000002','home-p3-2@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-2','fixture/back-2','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000002','{}','e3000000-0000-4000-8000-000000000002','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','pickup_due',null,'Fixture fee',now(),'complete','fixed');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='pending',payment_method=null,
 sla_state='pre_processing',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000002';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000003','home-p3-3@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-3','fixture/back-3','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000003','{}','e3000000-0000-4000-8000-000000000003','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','assessed',0,'Fixture fee',now(),'complete','fixed');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='pending',payment_method=null,
 sla_state='pre_processing',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000003';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000004','home-p3-4@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000004','b3000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-4','fixture/back-4','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000004','b3000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000004','{}','e3000000-0000-4000-8000-000000000004','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','assessed',1000,'Fixture fee',now(),'complete','fixed');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='pending',payment_method='pickup',
 sla_state='pre_processing',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000004';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000005','home-p3-5@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000005','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000005','b3000000-0000-4000-8000-000000000005','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-5','fixture/back-5','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000005','b3000000-0000-4000-8000-000000000005','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000005','{}','e3000000-0000-4000-8000-000000000005','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','assessed',1000,'Fixture fee',now(),'complete','fixed');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='pending',payment_method='qrph',
 sla_state='pre_processing',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000005';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000006','home-p3-6@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000006','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000006','b3000000-0000-4000-8000-000000000006','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-6','fixture/back-6','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000006','b3000000-0000-4000-8000-000000000006','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000006','{}','e3000000-0000-4000-8000-000000000006','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','assessed',99,'Fixture fee',now(),'complete','fixed');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='pending',payment_method='qrph',
 sla_state='pre_processing',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000006';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000007','home-p3-7@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000007','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000007','b3000000-0000-4000-8000-000000000007','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-7','fixture/back-7','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000007','b3000000-0000-4000-8000-000000000007','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000007','{}','e3000000-0000-4000-8000-000000000007','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','assessed',100,'Fixture fee',now(),'complete','fixed');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='pending',payment_method='qrph',
 sla_state='pre_processing',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000007';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000008','home-p3-8@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000008','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000008','b3000000-0000-4000-8000-000000000008','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-8','fixture/back-8','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000008','b3000000-0000-4000-8000-000000000008','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000008','{}','e3000000-0000-4000-8000-000000000008','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','waived',0,'Fixture fee',now(),'complete','fixed');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='waived',payment_method=null,
 sla_state='pre_processing',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000008';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000009','home-p3-9@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000009','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000009','b3000000-0000-4000-8000-000000000009','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-9','fixture/back-9','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000009','b3000000-0000-4000-8000-000000000009','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000009','{}','e3000000-0000-4000-8000-000000000009','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','assessed',1000,'Fixture fee',now(),'complete','fixed');
insert into public.payments(id,service_request_id,barangay_id,method,status,amount_centavos,document_fee_centavos,created_at)
 values ('f3000000-0000-4000-8000-000000000090','d3000000-0000-4000-8000-000000000009','a3000000-0000-4000-8000-000000000001','pickup','paid',1000,null,'2026-10-20'::timestamptz + interval '0 minutes');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='paid',payment_method=null,
 sla_state='pre_processing',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000009';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000010','home-p3-10@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000010','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000010','b3000000-0000-4000-8000-000000000010','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-10','fixture/back-10','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000010','b3000000-0000-4000-8000-000000000010','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000010','{}','e3000000-0000-4000-8000-000000000010','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','assessed',1000,'Fixture fee',now(),'complete','fixed');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='refunded',payment_method=null,
 sla_state='pre_processing',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000010';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000011','home-p3-11@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000011','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000011','b3000000-0000-4000-8000-000000000011','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-11','fixture/back-11','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000011','b3000000-0000-4000-8000-000000000011','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000011','{}','e3000000-0000-4000-8000-000000000011','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','assessed',1000,'Fixture fee',now(),'complete','fixed');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='failed',payment_method=null,
 sla_state='pre_processing',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000011';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000012','home-p3-12@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000012','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000012','b3000000-0000-4000-8000-000000000012','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-12','fixture/back-12','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000012','b3000000-0000-4000-8000-000000000012','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000012','{}','e3000000-0000-4000-8000-000000000012','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','page_count_required',null,'Fixture fee',now(),'complete','fixed');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='pending',payment_method=null,
 sla_state='pre_processing',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000012';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000013','home-p3-13@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000013','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000013','b3000000-0000-4000-8000-000000000013','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-13','fixture/back-13','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000013','b3000000-0000-4000-8000-000000000013','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000013','{}','e3000000-0000-4000-8000-000000000013','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','pickup_due',null,'Fixture fee',now(),'complete','fixed');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='pending',payment_method=null,
 sla_state='paused',
 accepted_at=now(),
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000013';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000014','home-p3-14@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000014','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000014','b3000000-0000-4000-8000-000000000014','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-14','fixture/back-14','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000014','b3000000-0000-4000-8000-000000000014','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000014','{}','e3000000-0000-4000-8000-000000000014','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','assessed',1000,'Fixture fee',now(),'complete','fixed');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='in_progress', payment_status='pending',payment_method=null,
 sla_state='running',
 accepted_at=now(),
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000014';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000015','home-p3-15@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000015','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000015','b3000000-0000-4000-8000-000000000015','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-15','fixture/back-15','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000015','b3000000-0000-4000-8000-000000000015','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000015','{}','e3000000-0000-4000-8000-000000000015','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','assessed',1000,'Fixture fee',now(),'complete','fixed');
insert into public.payments(id,service_request_id,barangay_id,method,status,amount_centavos,document_fee_centavos,created_at)
 values ('f3000000-0000-4000-8000-000000000150','d3000000-0000-4000-8000-000000000015','a3000000-0000-4000-8000-000000000001','pickup','paid',1000,1000,'2026-10-20'::timestamptz + interval '0 minutes');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='ready_for_pickup', payment_status='paid',payment_method=null,
 sla_state='ready',
 accepted_at=now(),
 ready_at=now(),
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000015';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000016','home-p3-16@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000016','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000016','b3000000-0000-4000-8000-000000000016','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-16','fixture/back-16','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000016','b3000000-0000-4000-8000-000000000016','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000016','{}','e3000000-0000-4000-8000-000000000016','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','assessed',1000,'Fixture fee',now(),'complete','fixed');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='completed', payment_status='pending',payment_method=null,
 sla_state='released',
 accepted_at=now(),
 ready_at=now(),
 released_at=now(),
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000016';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000017','home-p3-17@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000017','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000017','b3000000-0000-4000-8000-000000000017','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-17','fixture/back-17','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000017','b3000000-0000-4000-8000-000000000017','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002',2,null,now(),
 'd3000000-0000-4000-8000-000000000017','{}','e3000000-0000-4000-8000-000000000017','fixture','Fixture','{}','agency_minutes_v1',15,'pre_processing','assessed',1000,'Fixture fee',now(),'complete','fixed');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='cancelled', payment_status='pending',payment_method=null,
 sla_state='cancelled',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=now() where id='d3000000-0000-4000-8000-000000000017';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000018','home-p3-18@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000018','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000018','b3000000-0000-4000-8000-000000000018','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-18','fixture/back-18','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000018','b3000000-0000-4000-8000-000000000018','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001',1,null,now(),
 null,null,null,null,null,null,'legacy_hours',null,'legacy','legacy',null,null,null,'legacy',null);
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='pending',payment_method=null,
 sla_state='legacy',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000018';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000019','home-p3-19@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000019','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000019','b3000000-0000-4000-8000-000000000019','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-19','fixture/back-19','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000019','b3000000-0000-4000-8000-000000000019','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001',1,1700,now(),
 null,null,null,null,null,null,'legacy_hours',null,'legacy','legacy',null,null,null,'legacy',null);
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='pending',payment_method=null,
 sla_state='legacy',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000019';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000020','home-p3-20@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000020','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000020','b3000000-0000-4000-8000-000000000020','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-20','fixture/back-20','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000020','b3000000-0000-4000-8000-000000000020','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001',1,null,now(),
 null,null,null,null,null,null,'legacy_hours',null,'legacy','legacy',null,null,null,'legacy',null);
insert into public.payments(id,service_request_id,barangay_id,method,status,amount_centavos,document_fee_centavos,created_at)
 values ('f3000000-0000-4000-8000-000000000200','d3000000-0000-4000-8000-000000000020','a3000000-0000-4000-8000-000000000001','pickup','pending',2300,1900,'2026-10-20'::timestamptz + interval '0 minutes');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='pending',payment_method=null,
 sla_state='legacy',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000020';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000021','home-p3-21@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000021','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000021','b3000000-0000-4000-8000-000000000021','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-21','fixture/back-21','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000021','b3000000-0000-4000-8000-000000000021','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001',1,null,now(),
 null,null,null,null,null,null,'legacy_hours',null,'legacy','legacy',null,null,null,'legacy',null);
insert into public.payments(id,service_request_id,barangay_id,method,status,amount_centavos,document_fee_centavos,created_at)
 values ('f3000000-0000-4000-8000-000000000210','d3000000-0000-4000-8000-000000000021','a3000000-0000-4000-8000-000000000001','pickup','pending',2300,null,'2026-10-20'::timestamptz + interval '0 minutes');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='pending',payment_method=null,
 sla_state='legacy',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000021';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000022','home-p3-22@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000022','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000022','b3000000-0000-4000-8000-000000000022','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-22','fixture/back-22','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000022','b3000000-0000-4000-8000-000000000022','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001',1,null,now(),
 null,null,null,null,null,null,'legacy_hours',null,'legacy','legacy',null,null,null,'legacy',null);
insert into public.payments(id,service_request_id,barangay_id,method,status,amount_centavos,document_fee_centavos,created_at)
 values ('f3000000-0000-4000-8000-000000000220','d3000000-0000-4000-8000-000000000022','a3000000-0000-4000-8000-000000000001','pickup','paid',3000,2400,'2026-10-20'::timestamptz + interval '0 minutes');
insert into public.payments(id,service_request_id,barangay_id,method,status,amount_centavos,document_fee_centavos,created_at)
 values ('f3000000-0000-4000-8000-000000000221','d3000000-0000-4000-8000-000000000022','a3000000-0000-4000-8000-000000000001','pickup','failed',9000,null,'2026-10-20'::timestamptz + interval '1 minutes');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='paid',payment_method=null,
 sla_state='legacy',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000022';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000023','home-p3-23@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000023','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000023','b3000000-0000-4000-8000-000000000023','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-23','fixture/back-23','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000023','b3000000-0000-4000-8000-000000000023','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001',1,null,now(),
 null,null,null,null,null,null,'legacy_hours',null,'legacy','legacy',null,null,null,'legacy',null);
insert into public.payments(id,service_request_id,barangay_id,method,status,amount_centavos,document_fee_centavos,created_at)
 values ('f3000000-0000-4000-8000-000000000230','d3000000-0000-4000-8000-000000000023','a3000000-0000-4000-8000-000000000001','pickup','failed',2100,null,'2026-10-20'::timestamptz + interval '0 minutes');
insert into public.payments(id,service_request_id,barangay_id,method,status,amount_centavos,document_fee_centavos,created_at)
 values ('f3000000-0000-4000-8000-000000000231','d3000000-0000-4000-8000-000000000023','a3000000-0000-4000-8000-000000000001','pickup','pending',2600,2200,'2026-10-20'::timestamptz + interval '1 minutes');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='pending',payment_method=null,
 sla_state='legacy',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000023';
set local barangayan.foundation_operation='submit';
insert into auth.users(id,email,raw_user_meta_data) values ('b3000000-0000-4000-8000-000000000024','home-p3-24@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values ('b3000000-0000-4000-8000-000000000024','a3000000-0000-4000-8000-000000000001','resident','Home synthetic resident');
insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision,evidence_origin)
 values ('e3000000-0000-4000-8000-000000000024','b3000000-0000-4000-8000-000000000024','a3000000-0000-4000-8000-000000000001',1,'Fixture','fixture/front-24','fixture/back-24','verified','legacy_approval');
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,contract_version,legacy_fee_centavos,created_at,
 idempotency_key,submission_payload,approved_id_submission_id,purpose_code,purpose_label,supporting_details,
 timing_model,target_minutes_snapshot,sla_state,fee_assessment_state,assessed_amount_centavos,fee_basis,fee_assessed_at,requirements_review_state,pricing_mode_snapshot)
 values ('d3000000-0000-4000-8000-000000000024','b3000000-0000-4000-8000-000000000024','a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001',1,null,now(),
 null,null,null,null,null,null,'legacy_hours',null,'legacy','legacy',null,null,null,'legacy',null);
insert into public.payments(id,service_request_id,barangay_id,method,status,amount_centavos,document_fee_centavos,created_at)
 values ('f3000000-0000-4000-8000-000000000240','d3000000-0000-4000-8000-000000000024','a3000000-0000-4000-8000-000000000001','pickup','pending',2500,null,'2026-10-20'::timestamptz + interval '0 minutes');
insert into public.payments(id,service_request_id,barangay_id,method,status,amount_centavos,document_fee_centavos,created_at)
 values ('f3000000-0000-4000-8000-000000000241','d3000000-0000-4000-8000-000000000024','a3000000-0000-4000-8000-000000000001','pickup','failed',2700,null,'2026-10-20'::timestamptz + interval '0 minutes');
set local barangayan.foundation_operation='sla';
update public.service_requests set status='submitted', payment_status='pending',payment_method=null,
 sla_state='legacy',
 accepted_at=null,
 ready_at=null,
 released_at=null,
 cancelled_at=null where id='d3000000-0000-4000-8000-000000000024';
set local barangayan.foundation_operation='submit';


update public.document_types set name='Business Barangay Clearance' where id='c3000000-0000-4000-8000-000000000002';
update public.document_types set name='Unlisted service with a deliberately long official title that must wrap completely' where id='c3000000-0000-4000-8000-000000000001';
insert into public.service_requests(id,resident_id,barangay_id,document_type_id,created_at,updated_at,payment_method)
select ('d3000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b3000000-0000-4000-8000-000000000001',
'a3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','2026-10-27','2026-10-27','pickup' from generate_series(101,106) n;
set local barangayan.foundation_operation='sla';
update public.service_requests set status=case when id='d3000000-0000-4000-8000-000000000101' then 'ready_for_pickup' when id='d3000000-0000-4000-8000-000000000102' then 'in_progress' when id='d3000000-0000-4000-8000-000000000103' then 'cancelled' else 'completed' end,payment_status='paid' where id::text like 'd3000000%00000000010_';
commit;
select current_database(),count(*) from public.service_requests;
