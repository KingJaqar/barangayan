begin;
select no_plan();
insert into public.barangays(id,name) values
('aa020000-0000-0000-0000-000000000001','Charter forms tenant'),
('aa020000-0000-0000-0000-000000000002','Charter forms foreign tenant');
insert into auth.users(id,email,raw_user_meta_data) values
('bb020000-0000-0000-0000-000000000001','charter-form-admin@test.local','{}'),
('bb020000-0000-0000-0000-000000000002','charter-form-resident@test.local','{}'),
('bb020000-0000-0000-0000-000000000003','charter-form-foreign@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values
('bb020000-0000-0000-0000-000000000001','aa020000-0000-0000-0000-000000000001','admin','Charter Admin'),
('bb020000-0000-0000-0000-000000000002','aa020000-0000-0000-0000-000000000001','resident','Charter Resident'),
('bb020000-0000-0000-0000-000000000003','aa020000-0000-0000-0000-000000000002','admin','Charter Foreign');
-- This submission fixture represents a resident with completed required fields.
update public.profiles set first_name='Test',last_name='Resident',house_no='1',street='Fixture Street',
 sex='female',employment_status='student',mobile_number='09171234567',birth_date='2000-01-01'
 where id='bb020000-0000-0000-0000-000000000002';
create temp table charter_fixture as select '{"officeDivision":"Office","classification":"Complex","transactionType":"G2B","whoMayAvail":"Applicants","checklistOfRequirements":"Valid ID","whereToSecureRequirements":"Front desk","clientSteps":"Submit form","agencyActions":"Review and issue","feesToBePaid":"Published schedule","processingTime":"Review 10 minutes; issue 5 minutes","personResponsible":"Duty officer"}'::jsonb as charter;
grant select on charter_fixture to authenticated;
insert into public.document_types(id,barangay_id,name,fee_centavos,processing_target_hours)
values('dd020000-0000-0000-0000-000000000003','aa020000-0000-0000-0000-000000000001','Old type',2500,48);
insert into public.service_requests(id,barangay_id,resident_id,document_type_id,created_at,updated_at)
values('cc020000-0000-0000-0000-000000000001','aa020000-0000-0000-0000-000000000001','bb020000-0000-0000-0000-000000000002','dd020000-0000-0000-0000-000000000003','2020-01-01','2020-01-01');
set local role authenticated;
set local request.jwt.claim.sub='bb020000-0000-0000-0000-000000000001';
select lives_ok($$ insert into public.document_types(id,barangay_id,name,description,contract_version,service_kind,charter,purposes,requirement_rules,pricing_mode,processing_target_minutes,fee_centavos)
select 'dd020000-0000-0000-0000-000000000001','aa020000-0000-0000-0000-000000000001','New charter','Description',2,'general',charter,'[{"code":"application","label":"Application","requiresExplanation":true}]','{"dtiRequired":false,"hoaRequired":false,"lessorForRenter":false,"personalAppearance":true}','fixed',25,2550 from charter_fixture $$,'Create complete general charter');
select lives_ok($$ insert into public.document_types(id,barangay_id,name,contract_version,service_kind,charter,purposes,requirement_rules,pricing_mode,processing_target_minutes)
select 'dd020000-0000-0000-0000-000000000002','aa020000-0000-0000-0000-000000000001','Second charter',2,'general',charter,'[{"code":"general","label":"General","requiresExplanation":false}]','{"dtiRequired":false,"hoaRequired":false,"lessorForRenter":false,"personalAppearance":false}','assessment',15 from charter_fixture $$,'Multiple general services can coexist');
select is(d.charter->entry.key,entry.value,'Persisted charter: '||entry.key)
from public.document_types d, charter_fixture f, jsonb_each(f.charter) entry where d.id='dd020000-0000-0000-0000-000000000001';
select is((select processing_target_minutes from public.document_types where id='dd020000-0000-0000-0000-000000000001'),25,'SLA target distinct from procedure prose');
select is((select fee_centavos from public.document_types where id='dd020000-0000-0000-0000-000000000001'),2550,'Confirmed charge distinct from published fees');
select throws_ok($$ update public.document_types set charter=charter-'agencyActions' where id='dd020000-0000-0000-0000-000000000001' $$,'22023',null,'Incomplete charter rejected');
select throws_ok($$ update public.document_types set charter=jsonb_set(charter,'{classification}','" "') where id='dd020000-0000-0000-0000-000000000001' $$,'22023',null,'Blank classification rejected');
select throws_ok($$ update public.document_types set requirement_rules=jsonb_set(requirement_rules,'{dtiRequired}','true') where id='dd020000-0000-0000-0000-000000000001' $$,'22023',null,'Incompatible supporting rule rejected');
select throws_ok($$ update public.document_types set service_kind='business' where id='dd020000-0000-0000-0000-000000000001' $$,'42501',null,'Existing service workflow fixed');
select lives_ok($$ update public.document_types set name='Updated charter',description='Updated description',
charter=(select jsonb_object_agg(key,'Updated '||(value#>>'{}')) from jsonb_each(charter)),
purposes='[{"code":"updated","label":"Updated purpose","requiresExplanation":false}]',
requirement_rules='{"dtiRequired":false,"hoaRequired":false,"lessorForRenter":false,"personalAppearance":false}',
fee_centavos=3550,processing_target_minutes=35,pricing_mode='fixed'
where id='dd020000-0000-0000-0000-000000000001' $$,'Edit all charter fields');
select is(d.charter->>entry.key,'Updated '||(entry.value#>>'{}'),'Updated charter: '||entry.key)
from public.document_types d, charter_fixture f, jsonb_each(f.charter) entry where d.id='dd020000-0000-0000-0000-000000000001';
select is((select name from public.document_types where id='dd020000-0000-0000-0000-000000000001'),'Updated charter','Updated name persists');
select is((select purposes->0->>'label' from public.document_types where id='dd020000-0000-0000-0000-000000000001'),'Updated purpose','Updated purposes persist');
select lives_ok($$ update public.document_types set contract_version=2,service_kind='general',charter=(select charter from charter_fixture),purposes='[{"code":"general","label":"General","requiresExplanation":false}]',requirement_rules='{"dtiRequired":false,"hoaRequired":false,"lessorForRenter":false,"personalAppearance":false}',processing_target_minutes=20,fee_centavos=5000
where id='dd020000-0000-0000-0000-000000000003' $$,'Legacy catalog gains charter without rewriting requests');
select is((select legacy_fee_centavos from public.service_requests where id='cc020000-0000-0000-0000-000000000001'),2500,'Unsnapshotted original fee preserved before edit');
select is((select contract_version from public.service_requests where id='cc020000-0000-0000-0000-000000000001'),1,'Historical contract preserved');
select is((select timing_model from public.service_requests where id='cc020000-0000-0000-0000-000000000001'),'legacy_hours','Historical timing preserved');
select is((select updated_at from public.service_requests where id='cc020000-0000-0000-0000-000000000001'),'2020-01-01'::timestamptz,'Historical update timestamp preserved');
select throws_ok($$ update public.service_requests set legacy_fee_centavos=5000 where id='cc020000-0000-0000-0000-000000000001' $$,'42501',null,'Recorded request fee remains immutable');
set local request.jwt.claim.sub='bb020000-0000-0000-0000-000000000002';
select results_eq($$ update public.document_types set name='Forged' where id='dd020000-0000-0000-0000-000000000001' returning id $$, $$ select id from public.document_types where false $$,'Residents cannot edit catalog');
set local request.jwt.claim.sub='bb020000-0000-0000-0000-000000000003';
select is((select count(*)::int from public.document_types where id='dd020000-0000-0000-0000-000000000001'),0,'Foreign tenant cannot read catalog');
reset role;
select * from finish();
rollback;
