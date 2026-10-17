-- Run after 0129; all fixtures and writes are rolled back.
begin;
set local search_path=public,extensions,pg_catalog;
create extension if not exists pgtap with schema extensions;
select no_plan();
select ok(not has_function_privilege('anon','public.admin_mutate_record(text,uuid,text,jsonb,timestamptz)','execute'),'Anonymous users cannot execute lifecycle mutations');
select ok(not prosecdef,'Lifecycle mutations run as the caller under RLS') from pg_proc where oid='public.admin_mutate_record(text,uuid,text,jsonb,timestamptz)'::regprocedure;
select ok(not has_function_privilege('anon','barangayan_private.active_admin_barangay_id()','execute'),'Internal active-admin lookup is not anonymous-callable');
select ok('security_invoker=true'=any(reloptions),relname||': record view enforces caller permissions') from pg_class where relname in (
 'admin_requests_records','admin_transactions_records','admin_residents_records','admin_incidents_records',
 'admin_health_records','admin_applicants_records','admin_households_records','admin_staff_records');
insert into public.barangays(id,name) values
('a1150000-0000-0000-0000-000000000001','Lifecycle fixture A'),('a1150000-0000-0000-0000-000000000002','Lifecycle fixture B');
insert into auth.users(id,email,raw_user_meta_data) values
('b1150000-0000-0000-0000-000000000001','lifecycle-admin@test.local','{}'),
('b1150000-0000-0000-0000-000000000002','lifecycle-resident@test.local','{}'),
('b1150000-0000-0000-0000-000000000003','lifecycle-staff@test.local','{}'),
('b1150000-0000-0000-0000-000000000004','lifecycle-foreign@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name,first_name,last_name) values
('b1150000-0000-0000-0000-000000000001','a1150000-0000-0000-0000-000000000001','admin','Lifecycle Admin','Lifecycle','Admin'),
('b1150000-0000-0000-0000-000000000002','a1150000-0000-0000-0000-000000000001','resident','Lifecycle Resident','Lifecycle','Resident'),
('b1150000-0000-0000-0000-000000000003','a1150000-0000-0000-0000-000000000001','admin','Lifecycle Staff','Lifecycle','Staff'),
('b1150000-0000-0000-0000-000000000004','a1150000-0000-0000-0000-000000000002','admin','Lifecycle Foreign','Lifecycle','Foreign');
insert into public.document_types(id,barangay_id,name,fee_centavos) values
('c1150000-0000-0000-0000-000000000001','a1150000-0000-0000-0000-000000000001','Lifecycle document',5000);
insert into public.service_requests(id,barangay_id,resident_id,document_type_id) values
('d1150000-0000-0000-0000-000000000001','a1150000-0000-0000-0000-000000000001','b1150000-0000-0000-0000-000000000002','c1150000-0000-0000-0000-000000000001');
insert into public.payments(id,barangay_id,service_request_id,method,status,amount_centavos,document_fee_centavos) values
('e1150000-0000-0000-0000-000000000001','a1150000-0000-0000-0000-000000000001','d1150000-0000-0000-0000-000000000001','pickup','pending',5000,5000);
insert into public.incidents(id,barangay_id,reporter_id,title,description,location) values
('f1150000-0000-0000-0000-000000000001','a1150000-0000-0000-0000-000000000001','b1150000-0000-0000-0000-000000000002','Lifecycle incident','Fixture','{"lat":14.7,"lng":121.1}');
insert into public.medical_drives(id,barangay_id,title,type,drive_date,time_start,time_end,eligible_criteria,stock_total,stock_remaining) values
('f1150000-0000-0000-0000-000000000002','a1150000-0000-0000-0000-000000000001','Lifecycle drive','vaccination',current_date,'08:00','12:00','Residents',10,9);
insert into public.drive_registrations(id,drive_id,user_id,applicant_number,age) values
('f1150000-0000-0000-0000-000000000003','f1150000-0000-0000-0000-000000000002','b1150000-0000-0000-0000-000000000002','LC-001',30);
update public.profiles set household_members='[{"id":"f1150000-0000-0000-0000-000000000004","name":"Fixture Member","relation":"child","role":"member"}]'::jsonb
where id='b1150000-0000-0000-0000-000000000002';
update public.household_members set is_checked_in=true,checked_in_at=now() where id='f1150000-0000-0000-0000-000000000004';
create temp table lifecycle_fixture(screen text,id uuid,patch jsonb,expected timestamptz);
insert into lifecycle_fixture(screen,id,patch) values
('requests','d1150000-0000-0000-0000-000000000001','{"requester_notes":"Updated note"}'),
('transactions','e1150000-0000-0000-0000-000000000001','{"amount_centavos":5500}'),
('residents','b1150000-0000-0000-0000-000000000002','{"occupation":"Fixture occupation"}'),
('incidents','f1150000-0000-0000-0000-000000000001','{"title":"Updated incident"}'),
('health','f1150000-0000-0000-0000-000000000002','{"location":"Updated health center"}'),
('applicants','f1150000-0000-0000-0000-000000000003','{"age":31}'),
('households','f1150000-0000-0000-0000-000000000004','{"name":"Updated member"}');
insert into lifecycle_fixture(screen,id,patch) select 'staff',id,'{"official_role":"clerk"}'::jsonb from public.barangay_officials where profile_id='b1150000-0000-0000-0000-000000000003';
grant all on lifecycle_fixture to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='b1150000-0000-0000-0000-000000000001';

-- Test helpers use INVOKER and the fixture IDs only; they cannot bypass RLS.
create function pg_temp.record_version(screen text,record_id uuid) returns timestamptz language plpgsql as $$
declare result timestamptz; begin
 execute format('select (row->>''updated_at'')::timestamptz from public.admin_%I_records where id=$1',screen) into result using record_id;
 return result;
end $$;
create function pg_temp.record_count(screen text,record_id uuid,active boolean) returns integer language plpgsql as $$
declare result integer; begin
 execute format('select count(*) from public.admin_%I_%s where id=$1',screen,case when active then 'browse' else 'records' end) into result using record_id;
 return result;
end $$;

select lives_ok($$select public.admin_mutate_record('requests','d1150000-0000-0000-0000-000000000001','save',
 '{"reference_number":"SHEET-001","created_at":"2026-10-01T08:00:00Z"}',pg_temp.record_version('requests','d1150000-0000-0000-0000-000000000001'))$$,'Legacy table fields save in the sheet');
select is(reference_number,'SHEET-001','Request reference persisted') from public.service_requests where id='d1150000-0000-0000-0000-000000000001';
select lives_ok($$select public.admin_mutate_record('transactions','e1150000-0000-0000-0000-000000000001','save',
 '{"request_reference":"SHEET-001","collected_by":"b1150000-0000-0000-0000-000000000001","created_at":"2026-10-02T08:00:00Z","linked_resident_id":"b1150000-0000-0000-0000-000000000002","linked_document_type_id":"c1150000-0000-0000-0000-000000000001"}',
 pg_temp.record_version('transactions','e1150000-0000-0000-0000-000000000001'))$$,'Transaction linked fields and collector save atomically');
select is(collected_by,'b1150000-0000-0000-0000-000000000001'::uuid,'Collector persisted') from public.payments where id='e1150000-0000-0000-0000-000000000001';
select throws_ok($$select public.admin_mutate_record('transactions','e1150000-0000-0000-0000-000000000001','save',
 '{"request_reference":"MISSING","method":"qrph"}',pg_temp.record_version('transactions','e1150000-0000-0000-0000-000000000001'))$$,'22023',null,'Unknown request reference rejected');
select is(method,'pickup','Invalid linked change does not partially save payment fields') from public.payments where id='e1150000-0000-0000-0000-000000000001';
select throws_ok($$select public.admin_mutate_record('transactions','e1150000-0000-0000-0000-000000000001','save',
 '{"collected_by":"b1150000-0000-0000-0000-000000000004"}',pg_temp.record_version('transactions','e1150000-0000-0000-0000-000000000001'))$$,'42501',null,'Cross-tenant collector rejected');
select lives_ok($$select public.admin_mutate_record('incidents','f1150000-0000-0000-0000-000000000001','save',
 '{"reporter_id":null,"location":{"lat":14.8,"lng":121.2},"confirmation_count":7,"created_at":"2026-10-03T08:00:00Z"}',pg_temp.record_version('incidents','f1150000-0000-0000-0000-000000000001'))$$,'Incident table fields save in the sheet');
select is(confirmation_count,7,'Incident confirmation count persisted') from public.incidents where id='f1150000-0000-0000-0000-000000000001';
select ok(reporter_id is null and location='{"lat":14.8,"lng":121.2}'::jsonb,'Anonymous reporter and coordinates persisted') from public.incidents where id='f1150000-0000-0000-0000-000000000001';
select throws_ok($$select public.admin_mutate_record('incidents','f1150000-0000-0000-0000-000000000001','save',
 '{"location":null}',pg_temp.record_version('incidents','f1150000-0000-0000-0000-000000000001'))$$,'22023',null,'Required incident coordinates cannot be cleared');
select throws_ok($$select public.admin_mutate_record('incidents','f1150000-0000-0000-0000-000000000001','save',
 '{"reporter_id":"b1150000-0000-0000-0000-000000000004"}',pg_temp.record_version('incidents','f1150000-0000-0000-0000-000000000001'))$$,'42501',null,'Cross-tenant reporter rejected');
select throws_ok($$select public.admin_mutate_record('incidents','f1150000-0000-0000-0000-000000000001','save',
 '{"location":{"lat":91,"lng":121}}',pg_temp.record_version('incidents','f1150000-0000-0000-0000-000000000001'))$$,'22023',null,'Invalid coordinates rejected at database boundary');
select lives_ok($$select public.admin_mutate_record('households','f1150000-0000-0000-0000-000000000004','save',
 '{"name":"Updated Member","is_checked_in":false}',pg_temp.record_version('households','f1150000-0000-0000-0000-000000000004'))$$,'Membership and evacuation state save together');
select ok(not is_checked_in and checked_in_at is null and checked_in_center_id is null and checked_in_center_name is null,'Checkout clears stale evacuation details') from public.household_members where id='f1150000-0000-0000-0000-000000000004';
select ok(household_members @> '[{"name":"Updated Member"}]'::jsonb,'Membership JSON stays synchronized') from public.profiles where id='b1150000-0000-0000-0000-000000000002';
select lives_ok($$select public.admin_mutate_record('residents','b1150000-0000-0000-0000-000000000002','save',
 '{"occupation":"Nurse"}',pg_temp.record_version('residents','b1150000-0000-0000-0000-000000000002'))$$,'Resident partial edit saves');
select ok(first_name='Lifecycle' and last_name='Resident','Unchanged resident names survive partial edit') from public.profiles where id='b1150000-0000-0000-0000-000000000002';
select lives_ok(format('select public.admin_mutate_record(%L,%L,''save'',%L,%L)',screen,id,patch,pg_temp.record_version(screen,id)),screen||': existing edit still saves') from lifecycle_fixture where screen in ('health','applicants','staff');
select * from finish();
rollback;
