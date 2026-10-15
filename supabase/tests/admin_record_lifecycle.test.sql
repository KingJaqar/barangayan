-- Run after 0115; all fixtures and writes are rolled back.
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
update lifecycle_fixture set expected=pg_temp.record_version(screen,id);
select is(pg_temp.record_count(screen,id,true),1,screen||': active details are readable') from lifecycle_fixture;
select lives_ok(format('select public.admin_mutate_record(%L,%L,''save'',%L,%L)',screen,id,patch,expected),screen||': edits persist') from lifecycle_fixture;
create function pg_temp.patch_persisted(screen text,record_id uuid,patch jsonb) returns boolean language plpgsql as $$
declare result boolean; begin
 execute format('select row @> $2 from public.admin_%I_records where id=$1',screen) into result using record_id,patch;
 return result;
end $$;
select ok(pg_temp.patch_persisted(screen,id,patch),screen||': edited values are read back from database') from lifecycle_fixture;
select throws_ok(format('select public.admin_mutate_record(%L,%L,''save'',''{"barangay_id":"a1150000-0000-0000-0000-000000000002"}'',%L)',screen,id,pg_temp.record_version(screen,id)),'22023',null,screen||': tenant reassignment rejected') from lifecycle_fixture;
select throws_ok(format('select public.admin_mutate_record(%L,%L,''archive'',''{}'',''2000-01-01'')',screen,id),'40001',null,screen||': stale actions rejected') from lifecycle_fixture;
select throws_ok(format('select public.admin_mutate_record(%L,%L,''delete'',''{}'',%L)',screen,id,pg_temp.record_version(screen,id)),'23503',null,screen||': related records prevent permanent deletion') from lifecycle_fixture where screen in ('requests','residents','health');
select lives_ok(format('select public.admin_mutate_record(%L,%L,''archive'',''{}'',%L)',screen,id,pg_temp.record_version(screen,id)),screen||': archive succeeds') from lifecycle_fixture order by case screen when 'applicants' then 0 when 'households' then 1 when 'residents' then 2 else 3 end;
select is(pg_temp.record_count(screen,id,true),0,screen||': archive leaves active list') from lifecycle_fixture;
select is(pg_temp.record_count(screen,id,false),1,screen||': archived details remain readable') from lifecycle_fixture;
select ok(deleted_at is not null and is_checked_in,'Household archive preserves check-in state') from public.household_members where id='f1150000-0000-0000-0000-000000000004';
select lives_ok(format('select public.admin_mutate_record(%L,%L,''save'',%L,%L)',screen,id,patch,pg_temp.record_version(screen,id)),screen||': archived details editable') from lifecycle_fixture where screen in ('households','applicants','incidents','staff');
select lives_ok(format('select public.admin_mutate_record(%L,%L,''restore'',''{}'',%L)',screen,id,pg_temp.record_version(screen,id)),screen||': restore succeeds') from lifecycle_fixture order by case screen when 'residents' then 0 when 'health' then 1 when 'households' then 2 when 'applicants' then 3 else 4 end;
select is(pg_temp.record_count(screen,id,true),1,screen||': restored record returns to active list') from lifecycle_fixture;
select ok(is_checked_in,'Household restore preserves check-in state') from public.household_members where id='f1150000-0000-0000-0000-000000000004';
select lives_ok(format('select public.admin_mutate_record(''staff'',%L,''save'',''{"full_name":"Updated Staff Name","official_role":"treasurer"}'',%L)',id,pg_temp.record_version(screen,id)),'Staff profile and roster update atomically') from lifecycle_fixture where screen='staff';
select is(full_name,'Updated Staff Name','Staff profile changes persisted') from public.profiles where id='b1150000-0000-0000-0000-000000000003';
select throws_ok(format('select public.admin_mutate_record(''staff'',%L,''archive'',''{}'',%L)',id,updated_at),'42501',null,'Cannot archive own staff record') from public.barangay_officials where profile_id=auth.uid();
set local request.jwt.claim.sub='b1150000-0000-0000-0000-000000000004';
select is(pg_temp.record_count(screen,id,false),0,screen||': other tenant cannot browse details') from lifecycle_fixture;
select throws_ok(format('select public.admin_mutate_record(%L,%L,''delete'',''{}'',%L)',screen,id,expected),'42501',null,screen||': other tenant deletion denied') from lifecycle_fixture;
set local request.jwt.claim.sub='b1150000-0000-0000-0000-000000000002';
select throws_ok(format('select public.admin_mutate_record(%L,%L,''archive'',''{}'',%L)',screen,id,expected),'42501',null,screen||': resident lifecycle mutation denied') from lifecycle_fixture;
select throws_ok('update public.drive_registrations set deleted_at=now() where id=''f1150000-0000-0000-0000-000000000003''','42501',null,'Resident cannot archive via existing cancellation policy');
select throws_ok('update public.household_members set deleted_at=now() where id=''f1150000-0000-0000-0000-000000000004''','42501',null,'Resident cannot alter household archive state');
set local request.jwt.claim.sub='b1150000-0000-0000-0000-000000000001';
select lives_ok(format('select public.admin_mutate_record(%L,%L,''archive'',''{}'',%L)',screen,id,pg_temp.record_version(screen,id)),screen||': archive before permanent deletion') from lifecycle_fixture;
select lives_ok(format('select public.admin_mutate_record(%L,%L,''delete'',''{}'',%L)',screen,id,pg_temp.record_version(screen,id)),screen||': permanent deletion succeeds') from lifecycle_fixture
order by case screen when 'transactions' then 0 when 'applicants' then 1 when 'households' then 2 when 'staff' then 3 when 'incidents' then 4 when 'health' then 5 when 'requests' then 6 else 7 end;
select is(pg_temp.record_count(screen,id,false),0,screen||': deleted record is absent from database view') from lifecycle_fixture;
select * from finish();
rollback;
