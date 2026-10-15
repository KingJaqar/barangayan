-- Resident iOS Phase 3 (P03-T05): resident-callable request/payment operations are
-- owner-and-tenant bound, idempotent where the client retries, and leave no side effects
-- when rejected. Administrative assessment/collection controls are covered in
-- resident_ios_phase3_backend.test.sql.
begin;
select no_plan();

insert into public.barangays(id,name) values
 ('a3100000-0000-0000-0000-000000000001','P3R Barangay A'),
 ('a3100000-0000-0000-0000-000000000002','P3R Barangay B');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at) values
 ('b3100000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p3r-a@test.local','',now(),'','','','','{}','{}',false,now(),now()),
 ('b3100000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p3r-a2@test.local','',now(),'','','','','{}','{}',false,now(),now()),
 ('b3100000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p3r-b@test.local','',now(),'','','','','{}','{}',false,now(),now()),
 ('b3100000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p3r-admin@test.local','',now(),'','','','','{}','{}',false,now(),now());
insert into public.profiles(id,barangay_id,role,full_name) values
 ('b3100000-0000-0000-0000-00000000000a','a3100000-0000-0000-0000-000000000001','resident','P3R A'),
 ('b3100000-0000-0000-0000-0000000000a2','a3100000-0000-0000-0000-000000000001','resident','P3R A2'),
 ('b3100000-0000-0000-0000-00000000000b','a3100000-0000-0000-0000-000000000002','resident','P3R B'),
 ('b3100000-0000-0000-0000-00000000000c','a3100000-0000-0000-0000-000000000001','admin','P3R Admin');
update public.profiles set first_name='Test',last_name='Resident',house_no='1',street='Fixture Street',
 sex='female',employment_status='student',mobile_number='09171234567',birth_date='2000-01-01'
 where role='resident' and id::text like 'b3100000%';
insert into public.document_types(id,barangay_id,name,fee_centavos,processing_target_hours) values
 ('c3100000-0000-0000-0000-000000000001','a3100000-0000-0000-0000-000000000001','P3R Doc A',5000,24),
 ('c3100000-0000-0000-0000-000000000002','a3100000-0000-0000-0000-000000000002','P3R Doc B',5000,24);
insert into public.service_requests(id,barangay_id,resident_id,document_type_id) values
 ('d3100000-0000-0000-0000-000000000001','a3100000-0000-0000-0000-000000000001','b3100000-0000-0000-0000-00000000000a','c3100000-0000-0000-0000-000000000001'),
 ('d3100000-0000-0000-0000-000000000002','a3100000-0000-0000-0000-000000000001','b3100000-0000-0000-0000-00000000000a','c3100000-0000-0000-0000-000000000001'),
 ('d3100000-0000-0000-0000-000000000003','a3100000-0000-0000-0000-000000000002','b3100000-0000-0000-0000-00000000000b','c3100000-0000-0000-0000-000000000002');

select is(has_function_privilege('anon','public.set_service_request_payment_method(uuid,text)','execute'),false,'Anonymous cannot set a payment method');
select is(has_function_privilege('anon','public.start_pickup_payment(uuid)','execute'),false,'Anonymous cannot start a pickup payment');
select is(has_function_privilege('anon','public.cancel_own_service_request(uuid,text)','execute'),false,'Anonymous cannot cancel a request');
select is(has_function_privilege('anon','public.submit_service_request(jsonb)','execute'),false,'Anonymous cannot submit a request');
select is(has_function_privilege('anon','public.service_request_sla_tracking(uuid)','execute'),false,'Anonymous cannot read SLA tracking');

-- Another resident of the same barangay and a resident of another barangay.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b3100000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','b3100000-0000-0000-0000-0000000000a2',true);
select throws_ok($$select public.set_service_request_payment_method('d3100000-0000-0000-0000-000000000001','pickup')$$,'42501','forbidden','Another resident cannot set the method');
select throws_ok($$select public.start_pickup_payment('d3100000-0000-0000-0000-000000000001')$$,'42501','forbidden','Another resident cannot start the pickup payment');
select throws_ok($$select public.cancel_own_service_request('d3100000-0000-0000-0000-000000000001','nope')$$,'42501','request_not_found','Another resident cannot cancel');
select is((select public.service_request_sla_tracking('d3100000-0000-0000-0000-000000000001')),null,'Another resident gets no SLA row');

select set_config('request.jwt.claims','{"sub":"b3100000-0000-0000-0000-00000000000b","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','b3100000-0000-0000-0000-00000000000b',true);
select throws_ok($$select public.set_service_request_payment_method('d3100000-0000-0000-0000-000000000001','pickup')$$,'42501','forbidden','Another barangay cannot set the method');
select throws_ok($$select public.start_pickup_payment('d3100000-0000-0000-0000-000000000001')$$,'42501','forbidden','Another barangay cannot start the pickup payment');
select throws_ok($$select public.cancel_own_service_request('d3100000-0000-0000-0000-000000000001','nope')$$,'42501','request_not_found','Another barangay cannot cancel');

-- The administrator of the same barangay cannot use the resident operations either.
select set_config('request.jwt.claims','{"sub":"b3100000-0000-0000-0000-00000000000c","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','b3100000-0000-0000-0000-00000000000c',true);
select throws_ok($$select public.set_service_request_payment_method('d3100000-0000-0000-0000-000000000001','pickup')$$,null,null,'An administrator cannot set a resident payment method');
select throws_ok($$select public.start_pickup_payment('d3100000-0000-0000-0000-000000000001')$$,null,null,'An administrator cannot start a resident pickup payment');
select throws_ok($$select public.cancel_own_service_request('d3100000-0000-0000-0000-000000000001','staff')$$,'42501','request_not_found','An administrator cannot self-cancel a resident request');

-- The owner.
select set_config('request.jwt.claims','{"sub":"b3100000-0000-0000-0000-00000000000a","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','b3100000-0000-0000-0000-00000000000a',true);
select throws_ok($$select public.set_service_request_payment_method('d3100000-0000-0000-0000-000000000001','cash')$$,'22023','invalid_payment_method','An unsupported method is rejected');
select lives_ok($$select public.set_service_request_payment_method('d3100000-0000-0000-0000-000000000001','pickup')$$,'The owner can choose pickup');
select lives_ok($$select public.set_service_request_payment_method('d3100000-0000-0000-0000-000000000001','pickup')$$,'Repeating the same method is a no-op');
select is((select public.start_pickup_payment('d3100000-0000-0000-0000-000000000001')),(select public.start_pickup_payment('d3100000-0000-0000-0000-000000000001')),
 'A retried pickup payment returns the same payment');
select throws_ok($$select public.set_service_request_payment_method('d3100000-0000-0000-0000-000000000001','qrph')$$,'22023','payment_method_locked','The method is locked once a payment is pending');

reset role;
select is((select count(*)::int from public.payments where service_request_id='d3100000-0000-0000-0000-000000000001'),1,'Exactly one pickup payment exists');
select is((select amount_centavos from public.payments where service_request_id='d3100000-0000-0000-0000-000000000001'),5000,'The amount comes from the server catalog, not the client');
select is((select count(*)::int from public.payments where service_request_id in ('d3100000-0000-0000-0000-000000000002','d3100000-0000-0000-0000-000000000003')),0,
 'Rejected attempts created no payment');
select is((select payment_method from public.service_requests where id='d3100000-0000-0000-0000-000000000002'),null,'Rejected attempts changed no other request');

-- Cancellation: legacy request, then terminal states.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b3100000-0000-0000-0000-00000000000a","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','b3100000-0000-0000-0000-00000000000a',true);
select lives_ok($$select public.cancel_own_service_request('d3100000-0000-0000-0000-000000000002','Changed my mind')$$,'The owner can cancel an open legacy request');
select throws_ok($$select public.cancel_own_service_request('d3100000-0000-0000-0000-000000000002','again')$$,null,'this request can no longer be cancelled','A cancelled request cannot be cancelled again');
reset role;
select is((select status from public.service_requests where id='d3100000-0000-0000-0000-000000000002'),'cancelled','The cancellation committed');
select is((select status from public.service_requests where id='d3100000-0000-0000-0000-000000000003'),'submitted','The other barangay request is untouched');
select * from finish();
rollback;
