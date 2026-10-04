begin;
select no_plan();

insert into public.barangays(id,name) values
('aa010000-0000-0000-0000-000000000001','Barangay Ampid I'),
('aa010000-0000-0000-0000-000000000002','Document creation foreign tenant');
insert into public.barangay_localities values
('aa010000-0000-0000-0000-000000000001','Ampid 1','San Mateo','Rizal',false);
select barangayan_private.configure_ampid_charter();
insert into auth.users(id,email,raw_user_meta_data) values
('bb010000-0000-0000-0000-000000000001','document-creation-admin@test.local','{}'),
('bb010000-0000-0000-0000-000000000002','document-creation-resident@test.local','{}'),
('bb010000-0000-0000-0000-000000000003','document-creation-foreign@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values
('bb010000-0000-0000-0000-000000000001','aa010000-0000-0000-0000-000000000001','admin','Creation Admin'),
('bb010000-0000-0000-0000-000000000002','aa010000-0000-0000-0000-000000000001','resident','Creation Resident'),
('bb010000-0000-0000-0000-000000000003','aa010000-0000-0000-0000-000000000002','admin','Creation Foreign');

set local role authenticated;
set local request.jwt.claim.sub='bb010000-0000-0000-0000-000000000001';
select lives_ok($$ insert into public.document_types(id,barangay_id,name,description,fee_centavos,processing_target_hours,requirements,is_active)
values ('dd010000-0000-0000-0000-000000000001','aa010000-0000-0000-0000-000000000001','Additional local document','Administrator configured',2500,48,array['Valid ID','Supporting certificate'],true) $$,
'Administrator can create an active document alongside charter services');
select is((select contract_version from public.document_types where id='dd010000-0000-0000-0000-000000000001'),1,'Creation retains existing contract');
select is((select fee_centavos from public.document_types where id='dd010000-0000-0000-0000-000000000001'),2500,'Created fee retained');
select is((select processing_target_hours from public.document_types where id='dd010000-0000-0000-0000-000000000001'),48,'Created processing hours retained');
select is((select requirements from public.document_types where id='dd010000-0000-0000-0000-000000000001'),array['Valid ID','Supporting certificate'],'Created requirements retained');
select is((select count(*)::int from public.document_types where barangay_id='aa010000-0000-0000-0000-000000000001' and contract_version=2 and is_active and processing_target_minutes=15),4,'Four charter services and minute targets preserved');
select lives_ok($$ update public.document_types set is_active=false where id='dd010000-0000-0000-0000-000000000001' $$,'Administrator can deactivate additional type');
select lives_ok($$ update public.document_types set is_active=true where id='dd010000-0000-0000-0000-000000000001' $$,'Administrator can reactivate additional type');
select throws_ok($$ insert into public.document_types(barangay_id,name) values ('aa010000-0000-0000-0000-000000000002','Cross-tenant insert') $$,'42501',null,'Administrator cannot create in foreign barangay');
select throws_ok($$ update public.document_types set contract_version=1 where barangay_id='aa010000-0000-0000-0000-000000000001' and contract_version=2 $$,'42501',null,'Charter contract cannot be downgraded');

set local request.jwt.claim.sub='bb010000-0000-0000-0000-000000000002';
select throws_ok($$ insert into public.document_types(barangay_id,name) values ('aa010000-0000-0000-0000-000000000001','Resident insert') $$,'42501',null,'Resident cannot create document types');
set local request.jwt.claim.sub='bb010000-0000-0000-0000-000000000003';
select throws_ok($$ insert into public.document_types(barangay_id,name) values ('aa010000-0000-0000-0000-000000000001','Foreign admin insert') $$,'42501',null,'Foreign administrator cannot create in Ampid 1');
select is((select count(*)::int from public.document_types where id='dd010000-0000-0000-0000-000000000001'),0,'Foreign administrator cannot read created document');
reset role;
set local role anon;
select throws_ok($$ insert into public.document_types(barangay_id,name) values ('aa010000-0000-0000-0000-000000000001','Anonymous insert') $$,'42501',null,'Anonymous visitor cannot create document types');
reset role;

select * from finish();
rollback;
