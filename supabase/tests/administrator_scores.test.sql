begin;
select no_plan();
insert into public.barangays(id,name) values
 ('a7070000-0000-0000-0000-000000000001','Score Local'),
 ('a7070000-0000-0000-0000-000000000002','Score Foreign');
insert into auth.users(id,email) select ('b7070000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'score-'||n||'@test.local' from generate_series(1,7) n;
insert into public.profiles(id,barangay_id,role,full_name,first_name,last_name,house_no,street,sex,employment_status,mobile_number,birth_date)
select ('b7070000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 case when n in (2,4) then 'a7070000-0000-0000-0000-000000000002'::uuid else 'a7070000-0000-0000-0000-000000000001'::uuid end,
 case when n in (3,4,6) then 'admin' else 'resident' end,'Score Persona','Test','Resident','1','Test Street','female','student','09171234567','2000-01-01'
from generate_series(1,6) n;
update public.profiles set deleted_at=now() where id='b7070000-0000-0000-0000-000000000006';
insert into public.medical_drives(id,barangay_id,title,type,drive_date,time_start,time_end,eligible_criteria,stock_total,stock_remaining)
values
 ('d7070000-0000-0000-0000-000000000001','a7070000-0000-0000-0000-000000000001','Score Local Drive','vaccination',current_date+1,'08:00','12:00','All',3,3),
 ('d7070000-0000-0000-0000-000000000002','a7070000-0000-0000-0000-000000000002','Score Foreign Drive','vaccination',current_date+1,'08:00','12:00','All',3,3),
 ('d7070000-0000-0000-0000-000000000003','a7070000-0000-0000-0000-000000000001','Score Single Slot','consultation',current_date+1,'08:00','12:00','All',1,1);
insert into public.admin_audit_log(barangay_id,admin_id,action,entity_type,metadata) values
 ('a7070000-0000-0000-0000-000000000001','b7070000-0000-0000-0000-000000000003','update','drive_registration','{"priority_score":90}');

select ok(not exists(select 1 from information_schema.columns where table_schema='public' and table_name='drive_registrations' and column_name='priority_score'),'Obsolete score column removed');
select ok(not exists(select 1 from pg_publication_tables where tablename='drive_registration_scores'),'Protected scores excluded from every Realtime publication');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='drive_registrations'),'Resident registration updates remain published');
select ok(not has_function_privilege('anon','public.register_for_drive(uuid,integer,boolean,text[],date)','execute'),'Anonymous self registration denied');
select ok(not has_function_privilege('anon','public.admin_register_for_drive(uuid,uuid,integer,boolean,text[],date)','execute'),'Anonymous staff registration denied');
select ok(not has_function_privilege('authenticated','barangayan_private.record_drive_priority_score()','execute'),'Internal score operation inaccessible');
select ok(not has_table_privilege('authenticated','public.drive_registration_scores','INSERT,UPDATE,DELETE'),'Clients cannot write scores');

set local role authenticated;
select set_config('request.jwt.claim.sub','b7070000-0000-0000-0000-000000000001',true);
create temporary table score_result as select public.register_for_drive('d7070000-0000-0000-0000-000000000001',65,true,array['a','b','c','d','e'],'2020-01-01')::jsonb result;
select ok(not (select result ? 'priority_score' from score_result),'Resident RPC omits score key');
select is((select count(*)::int from jsonb_object_keys((select result from score_result))),3,'Resident RPC has exactly applicant, registration, status fields');
select is((select result->>'status' from score_result),'pending','Registration status preserved');
select matches((select result->>'applicant_number' from score_result),'^VAC-[0-9]{8}-0001$','Applicant number preserved');
select is_empty($$select * from public.drive_registration_scores$$,'Resident cannot read protected score rows');
select is_empty($$select * from public.admin_audit_log where metadata ? 'priority_score'$$,'Resident cannot read scores in staff audit metadata');
select is_empty($$select s.* from public.drive_registrations r join public.drive_registration_scores s on s.registration_id=r.id$$,'Resident embedded join cannot recover score');
select ok(not exists(select 1 from public.drive_registrations r where to_jsonb(r) ? 'priority_score'),'Resident wildcard REST/export rows contain no score');
select throws_ok($$select priority_score from public.drive_registrations$$,'42703',null,'Explicit obsolete column query fails');
select throws_ok($$select public.admin_register_for_drive(auth.uid(),'d7070000-0000-0000-0000-000000000003',20,false,'{}',null)$$,'P0005',null,'Resident cannot call staff score-returning RPC');
select throws_ok($$select public.register_for_drive('d7070000-0000-0000-0000-000000000001',65,true,'{}',null)$$,'P0004',null,'Duplicate retry does not create registration or score');
select throws_ok($$select public.register_for_drive('d7070000-0000-0000-0000-000000000002',65,true,'{}',null)$$,'P0011',null,'Cross-tenant registration rejected');
select throws_ok($$update public.drive_registrations set status='cancelled',age=1 where user_id=auth.uid()$$,'42501',null,'Cancellation cannot tamper with scoring inputs');
select throws_ok($$update public.drive_registrations set status='cancelled',applicant_number='FORGED' where user_id=auth.uid()$$,'42501',null,'Cancellation cannot rewrite applicant history');
select results_eq($$update public.drive_registrations set status='cancelled' where user_id=auth.uid() returning status::text$$,$$values ('cancelled')$$,'Resident cancellation remains supported');
reset role;
select is((select priority_score from public.drive_registration_scores s join public.drive_registrations r on r.id=s.registration_id where r.user_id='b7070000-0000-0000-0000-000000000001'),80::numeric,'PWD senior capped comorbidities and prior dose preserve formula');
select is((select stock_remaining from public.medical_drives where id='d7070000-0000-0000-0000-000000000001'),2,'Duplicate and failed foreign operation preserve capacity');
select is((select stock_remaining from public.medical_drives where id='d7070000-0000-0000-0000-000000000002'),3,'Cross-tenant failure rolls back all writes');

set local role authenticated;
select set_config('request.jwt.claim.sub','b7070000-0000-0000-0000-000000000002',true);
select lives_ok($$select public.register_for_drive('d7070000-0000-0000-0000-000000000002',4,false,array['one'],null)$$,'Foreign tenant resident can register for their own drive');
select is_empty($$select * from public.drive_registration_scores$$,'Foreign resident cannot read own or other scores');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','b7070000-0000-0000-0000-000000000003',true);
select is((select count(*)::int from public.drive_registration_scores),1,'Same-tenant administrator sees only local scores');
select is((select priority_score from public.drive_registration_scores),80::numeric,'Administrator retains exact score');
select is((select count(*)::int from public.admin_audit_log where barangay_id='a7070000-0000-0000-0000-000000000001' and metadata ? 'priority_score'),1,'Active administrator retains historical audit score');
select is_empty($$select s.* from public.drive_registration_scores s join public.drive_registrations r on r.id=s.registration_id where r.drive_id='d7070000-0000-0000-0000-000000000002'$$,'Administrator cannot retrieve foreign scores');
select is((public.admin_register_for_drive('b7070000-0000-0000-0000-000000000005','d7070000-0000-0000-0000-000000000001',30,false,'{}',null)::jsonb->>'priority_score')::numeric,0::numeric,'Admin RPC retains score for new resident');
select results_eq($$select priority_score from public.drive_registration_scores order by priority_score desc$$,$$values (80::numeric),(0::numeric)$$,'Protected administrator rankings preserve ordering');
select lives_ok($$update public.drive_registrations set age=50,status='confirmed' where user_id='b7070000-0000-0000-0000-000000000005'$$,'Admin edits and status management remain supported');
select is((select s.priority_score from public.drive_registration_scores s join public.drive_registrations r on r.id=s.registration_id where r.user_id='b7070000-0000-0000-0000-000000000005'),0::numeric,'Admin input edits preserve original score snapshot');
select throws_ok($$update public.drive_registration_scores set priority_score=999$$,'42501',null,'Admin cannot overwrite preserved score');
select throws_ok($$select public.admin_register_for_drive('b7070000-0000-0000-0000-000000000002','d7070000-0000-0000-0000-000000000001',30,false,'{}',null)$$,'P0007',null,'Staff cannot register foreign resident');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','b7070000-0000-0000-0000-000000000004',true);
select results_eq($$select priority_score from public.drive_registration_scores$$,$$values (20::numeric)$$,'Foreign administrator retains only foreign tenant score');
select is_empty($$select * from public.admin_audit_log where barangay_id='a7070000-0000-0000-0000-000000000001'$$,'Foreign administrator cannot read local historical audit scores');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','b7070000-0000-0000-0000-000000000006',true);
select is_empty($$select * from public.drive_registration_scores$$,'Deleted administrator cannot read protected scores');
select is_empty($$select * from public.admin_audit_log where metadata ? 'priority_score'$$,'Deleted administrator cannot read historical audit scores');
select throws_ok($$select public.admin_register_for_drive('b7070000-0000-0000-0000-000000000005','d7070000-0000-0000-0000-000000000003',20,false,'{}',null)$$,'P0005',null,'Deleted administrator cannot return score via RPC');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','b7070000-0000-0000-0000-000000000007',true);
select is_empty($$select * from public.drive_registration_scores$$,'Missing profile cannot retrieve score');
select throws_ok($$select public.admin_register_for_drive('b7070000-0000-0000-0000-000000000005','d7070000-0000-0000-0000-000000000003',20,false,'{}',null)$$,'P0005',null,'Missing role cannot bypass admin RPC through SQL null comparisons');
reset role;
set local role anon;
select throws_ok($$select * from public.drive_registration_scores$$,'42501',null,'Anonymous score storage denied');
reset role;
select is((select count(*)::int from public.drive_registration_scores s join public.drive_registrations r on r.id=s.registration_id where r.drive_id::text like 'd707%'),3,'Every successful registration has exactly one protected score');
select * from finish();
rollback;
