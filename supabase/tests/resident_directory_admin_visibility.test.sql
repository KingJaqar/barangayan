-- Run after 0130. All fixtures, promotions and associations are rolled back.
begin;
set local search_path=public,extensions,pg_catalog;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.barangays(id,name) values
 ('a1300000-0000-0000-0000-000000000001','Directory fixture'),
 ('a1300000-0000-0000-0000-000000000002','Directory foreign fixture');
insert into auth.users(id,email,raw_user_meta_data)
select ('b1300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'directory-130-'||n||'@test.local','{}'::jsonb from generate_series(1,6) n;
insert into public.profiles(id,barangay_id,role,full_name) values
 ('b1300000-0000-0000-0000-000000000001','a1300000-0000-0000-0000-000000000001','admin','Directory Admin'),
 ('b1300000-0000-0000-0000-000000000002','a1300000-0000-0000-0000-000000000001','resident','Promoted Resident'),
 ('b1300000-0000-0000-0000-000000000003','a1300000-0000-0000-0000-000000000001','resident','Linked Resident'),
 ('b1300000-0000-0000-0000-000000000004','a1300000-0000-0000-0000-000000000002','admin','Foreign Admin'),
 ('b1300000-0000-0000-0000-000000000005','a1300000-0000-0000-0000-000000000002','resident','Foreign Resident'),
 ('b1300000-0000-0000-0000-000000000006','a1300000-0000-0000-0000-000000000001','admin','Archived Admin');
update public.profiles set deleted_at=now() where id='b1300000-0000-0000-0000-000000000006';
insert into public.admin_resident_associations(admin_id,resident_id) values
 ('b1300000-0000-0000-0000-000000000001','b1300000-0000-0000-0000-000000000003');

set local role authenticated;
set local request.jwt.claim.sub='b1300000-0000-0000-0000-000000000001';
select is(count(*),3::bigint,'Directory includes the signed-in admin and active residents in the same barangay') from public.admin_residents_browse;
select is((summary->>'total')::integer,3,'Summary includes admin profiles') from public.admin_residents_summary;
select is(count(*),1::bigint,'Associated resident appears exactly once') from public.admin_residents_browse where id='b1300000-0000-0000-0000-000000000003';
select is(count(*),0::bigint,'Archived admin is excluded from active directory') from public.admin_residents_browse where id='b1300000-0000-0000-0000-000000000006';
select is(count(*),1::bigint,'Archived admin remains available in archive projection') from public.admin_residents_records where id='b1300000-0000-0000-0000-000000000006' and f_archived;
select is(count(*),0::bigint,'Foreign residents and admins are excluded from details and archive') from public.admin_residents_records where tenant_id='a1300000-0000-0000-0000-000000000002';

-- Role assignment uses the privileged provisioning path, not resident clients.
reset role;
select lives_ok($q$update public.profiles set role='admin' where id='b1300000-0000-0000-0000-000000000002'$q$,'Backend can provision admin access for a resident');
set local role authenticated;
select is(count(*),1::bigint,'Promoted resident stays visible and searchable in the directory') from public.admin_residents_browse where id='b1300000-0000-0000-0000-000000000002' and x0 like '%promoted%';
select is(count(*),1::bigint,'Promoted resident detail projection remains available') from public.admin_residents_records where id='b1300000-0000-0000-0000-000000000002' and not f_archived;
select is((summary->>'total')::integer,3,'Promotion does not change directory total') from public.admin_residents_summary;
select is((summary->>'verified')::integer+(summary->>'unverified')::integer,3,'Email tab counts include admin profiles') from public.admin_residents_summary;
select throws_ok(format('select public.admin_mutate_record(''residents'',%L,''archive'',''{}'',%L)',id,updated_at),'42501',null,'Directory cannot archive the signed-in admin') from public.profiles where id=auth.uid();
select throws_ok(format('select public.admin_mutate_record(''residents'',%L,''archive'',''{}'',%L)',id,updated_at),'42501',null,'Directory cannot archive another admin') from public.profiles where id='b1300000-0000-0000-0000-000000000002';
select throws_ok(format('select public.admin_mutate_record(''residents'',%L,''restore'',''{}'',%L)',id,updated_at),'42501',null,'Admin restoration stays in Staff') from public.profiles where id='b1300000-0000-0000-0000-000000000006';
select throws_ok(format('select public.admin_mutate_record(''residents'',%L,''delete'',''{}'',%L)',id,updated_at),'42501',null,'Admin deletion stays in Staff') from public.profiles where id='b1300000-0000-0000-0000-000000000006';

set local request.jwt.claim.sub='b1300000-0000-0000-0000-000000000003';
select is(count(*),0::bigint,'Resident cannot browse the admin directory') from public.admin_residents_browse;
select is(count(*),0::bigint,'Resident cannot read directory details or archive') from public.admin_residents_records;
select is(count(*),0::bigint,'Resident cannot read directory totals') from public.admin_residents_summary;
reset role;
select ok(not has_table_privilege('anon','public.admin_residents_browse','select'),'Anonymous directory access remains denied');
select ok('security_invoker=true'=any(reloptions),relname||' retains caller permissions') from pg_class where oid in ('public.admin_residents_browse'::regclass,'public.admin_residents_records'::regclass);
select * from finish();
rollback;
