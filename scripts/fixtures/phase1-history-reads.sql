-- Requires the synthetic pre-migration fixture in phase1-historical.sql.
-- Run only against the isolated representative rehearsal database.
begin;
select plan(9);
set local role authenticated;
set local request.jwt.claim.sub='b3000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.service_requests),2,'Historical owner reads requests for an inactive service');
select is((select array_agg(status order by created_at) from public.service_requests),array['completed','cancelled'],'Historical outcomes remain readable');
select ok((select bool_and(contract_version=1 and timing_model='legacy_hours' and sla_state='legacy') from public.service_requests),'Historical requests retain original timing semantics');
select is((select sum(amount_centavos)::int from public.payments),25000,'Historical ledger amounts remain readable');
select is((select array_agg(status order by id) from public.payments),array['paid','refunded'],'Historical payment outcomes are retained');
select is((select home_address from public.profiles where id=auth.uid()),'Unstructured address, preserved verbatim','Legacy free-text address is retained');
select is((select count(*)::int from storage.objects where bucket_id='id-documents'),2,'Legacy approved evidence remains readable by owner');
set local request.jwt.claim.sub='b3000000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.service_requests),2,'Historical tenant administrator reads original requests');
reset role;
insert into public.barangays(id,name) values('a8000000-0000-0000-0000-000000000001','Historical isolation observer');
insert into auth.users(id,email,raw_user_meta_data) values('b8000000-0000-0000-0000-000000000001','history-observer@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values('b8000000-0000-0000-0000-000000000001','a8000000-0000-0000-0000-000000000001','admin','Other administrator');
set local role authenticated;
set local request.jwt.claim.sub='b8000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.service_requests),0,'Unrelated administrator cannot read historical requests');
reset role;
select * from finish();
rollback;
