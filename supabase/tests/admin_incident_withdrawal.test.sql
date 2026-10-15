-- Rehearse 0116 with synthetic fixtures; preserve all existing data.
begin;
set local search_path=public,extensions,pg_catalog;
create extension if not exists pgtap with schema extensions;
select no_plan();
select ok(not prosecdef,'Admin incident transitions enforce caller RLS') from pg_proc where oid='public.update_incident_status(uuid,text)'::regprocedure;
select ok(not has_function_privilege('anon','public.update_incident_status(uuid,text)','execute'),'Anonymous callers cannot execute admin transitions');

insert into public.barangays(id,name) values
('a1160000-0000-0000-0000-000000000001','Withdrawal fixture A'),('a1160000-0000-0000-0000-000000000002','Withdrawal fixture B');
insert into auth.users(id,email,raw_user_meta_data) values
('b1160000-0000-0000-0000-000000000001','withdrawal-admin@test.local','{}'),
('b1160000-0000-0000-0000-000000000002','withdrawal-resident@test.local','{}'),
('b1160000-0000-0000-0000-000000000003','withdrawal-foreign@test.local','{}'),
('b1160000-0000-0000-0000-000000000004','withdrawal-removed@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name,deleted_at) values
('b1160000-0000-0000-0000-000000000001','a1160000-0000-0000-0000-000000000001','admin','Withdrawal Admin',null),
('b1160000-0000-0000-0000-000000000002','a1160000-0000-0000-0000-000000000001','resident','Withdrawal Resident',null),
('b1160000-0000-0000-0000-000000000003','a1160000-0000-0000-0000-000000000002','admin','Withdrawal Foreign',null),
('b1160000-0000-0000-0000-000000000004','a1160000-0000-0000-0000-000000000001','admin','Withdrawal Removed',now());
insert into public.incidents(id,barangay_id,reporter_id,title,description,location,status,created_at,confirmation_count) select
 ('f1160000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'a1160000-0000-0000-0000-000000000001'::uuid,'b1160000-0000-0000-0000-000000000002'::uuid,
 'Withdrawal fixture '||n,'Retain this report','{"lat":14.7,"lng":121.1}'::jsonb,
 case n when 2 then 'in_progress' when 3 then 'resolved' when 4 then 'withdrawn' when 5 then 'unresolved' when 9 then 'in_progress' else 'open' end,
 case when n in (1,2,10) then '2020-01-01'::timestamptz else now() end,3
from generate_series(1,10) n;
update public.incidents set deleted_at=now() where id='f1160000-0000-0000-0000-000000000006';

set local role authenticated;
set local request.jwt.claim.sub='b1160000-0000-0000-0000-000000000001';
select lives_ok('select public.update_incident_status(''f1160000-0000-0000-0000-000000000001'',''withdrawn'')','Admin withdraws another reporter''s old open report');
select lives_ok('select public.update_incident_status(''f1160000-0000-0000-0000-000000000002'',''withdrawn'')','Admin withdraws another reporter''s old in-progress report');
select is(status,'withdrawn','Withdrawal persists as a status change') from public.incidents where id in ('f1160000-0000-0000-0000-000000000001','f1160000-0000-0000-0000-000000000002');
select ok(deleted_at is null and description='Retain this report' and confirmation_count=3 and reporter_id='b1160000-0000-0000-0000-000000000002'::uuid,'Withdrawal retains report details, reporter and confirmations')
from public.incidents where id in ('f1160000-0000-0000-0000-000000000001','f1160000-0000-0000-0000-000000000002');
select throws_ok(format('select public.update_incident_status(%L,''withdrawn'')',id),'22023',null,'Resolved/unresolved reports cannot be withdrawn') from public.incidents
where id in ('f1160000-0000-0000-0000-000000000003','f1160000-0000-0000-0000-000000000005');
select throws_ok('select public.update_incident_status(''f1160000-0000-0000-0000-000000000004'',''in_progress'')','22023',null,'Withdrawn report cannot re-enter processing');
select throws_ok('select public.update_incident_status(''f1160000-0000-0000-0000-000000000006'',''withdrawn'')','42501',null,'Archived report cannot be withdrawn');
select throws_ok('select public.update_incident_status(''f1160000-0000-0000-0000-000000000007'',null)','22023',null,'Null status is rejected');
select lives_ok('select public.update_incident_status(''f1160000-0000-0000-0000-000000000007'',''in_progress'')','Existing progress transition is preserved');
select lives_ok('select public.update_incident_status(''f1160000-0000-0000-0000-000000000007'',''resolved'')','Existing resolution transition is preserved');
select lives_ok('select public.update_incident_status(''f1160000-0000-0000-0000-000000000004'',''withdrawn'')','Repeated withdrawal is an idempotent no-op');

set local request.jwt.claim.sub='b1160000-0000-0000-0000-000000000003';
select throws_ok('select public.update_incident_status(''f1160000-0000-0000-0000-000000000008'',''withdrawn'')','42501',null,'Other barangay admin cannot withdraw this report');
set local request.jwt.claim.sub='b1160000-0000-0000-0000-000000000004';
select throws_ok('select public.update_incident_status(''f1160000-0000-0000-0000-000000000008'',''withdrawn'')','42501',null,'Removed admin cannot withdraw reports');
set local request.jwt.claim.sub='b1160000-0000-0000-0000-000000000002';
select throws_ok('select public.update_incident_status(''f1160000-0000-0000-0000-000000000008'',''withdrawn'')','42501',null,'Resident cannot use the admin withdrawal operation');
select throws_ok('select public.withdraw_incident(''f1160000-0000-0000-0000-000000000009'')',null,null,'Resident self-withdrawal still rejects in-progress reports');
select throws_ok('select public.withdraw_incident(''f1160000-0000-0000-0000-000000000010'')',null,null,'Resident self-withdrawal still has a 24-hour limit');
select lives_ok('select public.withdraw_incident(''f1160000-0000-0000-0000-000000000008'')','Resident can still withdraw their own recent open report');
select is(status,'withdrawn','Resident self-withdrawal still persists') from public.incidents where id='f1160000-0000-0000-0000-000000000008';
select * from finish();
rollback;
