-- Phase 1, synthetic accounts only; every write rolls back.
begin;
select no_plan();
insert into public.barangays(id,name) values
 ('afa10000-0000-4000-8000-000000000001','Attendance A'),('afa10000-0000-4000-8000-000000000002','Attendance B');
insert into auth.users(id,email)
 select ('dfa10000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'attendance-'||n||'@test.local' from generate_series(1,6) n;
insert into public.profiles(id,barangay_id,role,full_name)
 select ('dfa10000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('afa10000-0000-4000-8000-'||case when n in (3,6) then '000000000002' else '000000000001' end)::uuid,
 case when n<=3 then 'admin' else 'resident' end,'Attendance Person '||n from generate_series(1,6) n;
insert into public.evacuation_centers(id,barangay_id,name,position,is_active) values
 ('efa10000-0000-4000-8000-000000000001','afa10000-0000-4000-8000-000000000001','Center A','{"lat":1,"lng":1}',true),
 ('efa10000-0000-4000-8000-000000000002','afa10000-0000-4000-8000-000000000001','Center B','{"lat":1,"lng":1}',true),
 ('efa10000-0000-4000-8000-000000000003','afa10000-0000-4000-8000-000000000002','Foreign Center','{"lat":1,"lng":1}',true);
update public.profiles set household_members='[
 {"id":"cfa10000-0000-4000-8000-000000000001","name":"One","relation":"child"},
 {"id":"cfa10000-0000-4000-8000-000000000002","name":"Two","relation":"child"},
 {"id":"cfa10000-0000-4000-8000-000000000003","name":"Three","relation":"child"}]'
 where id='dfa10000-0000-4000-8000-000000000004';
create temp table attendance_results(name text primary key,result jsonb);
grant all on attendance_results to authenticated;

select ok(not has_table_privilege('authenticated','public.household_attendance','insert'),'No direct attendance insert');
select ok(not has_table_privilege('authenticated','public.household_members','update'),'No direct compatibility write');
select ok(not has_table_privilege('authenticated','barangayan_private.household_attendance_receipts','select'),'Receipts are private');
select ok(not has_function_privilege('anon','public.lookup_household_for_attendance(text)','execute'),'Anonymous lookup revoked');
select ok(not has_function_privilege('service_role','public.check_in_household_members(uuid,uuid,jsonb,uuid)','execute'),'No service-role mutation shortcut');
select ok(not prosecdef,'Public mutation is invoker') from pg_proc where oid='public.check_in_household_members(uuid,uuid,jsonb,uuid)'::regprocedure;
set local role anon;
select throws_ok($$select public.get_my_household_attendance()$$,'42501',null,'A08 anonymous read denied');
select throws_ok($$select public.check_out_household_attendance(array['dfa10000-0000-4000-8000-000000000004'::uuid],gen_random_uuid())$$,
 '42501',null,'A08 anonymous write denied');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.get_my_household_attendance()$$,'42501','authentication_required','A08 missing authenticated subject denied');
select set_config('request.jwt.claim.sub','dfa10000-0000-4000-8000-000000000005',true);
select is(jsonb_array_length(public.get_my_household_attendance()->'people'),1,'A01 holder-only household has one person');
select throws_ok($$select public.check_in_household_members('dfa10000-0000-4000-8000-000000000005','efa10000-0000-4000-8000-000000000001','[{"kind":"holder"}]',gen_random_uuid())$$,
 '42501','attendance_forbidden','A08 resident cannot confirm attendance');
select throws_ok($$update public.household_members set is_checked_in=true where profile_id=auth.uid()$$,'42501',null,'A09 legacy blanket write denied');
select throws_ok($$insert into public.evacuation_center_checkins(evacuation_center_id,user_id,barangay_id) values
 ('efa10000-0000-4000-8000-000000000001',auth.uid(),'afa10000-0000-4000-8000-000000000001')$$,
 '42501',null,'A09 direct/queued legacy center scan denied');
select throws_ok($$select public.check_in_to_evacuation_center('efa10000-0000-4000-8000-000000000001')$$,
 '42501',null,'A09 legacy scan RPC denied');
select set_config('request.jwt.claim.sub','dfa10000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.lookup_household_for_attendance('https://example.com')$$,'22023','invalid_household_qr','URL is data, never a lookup');
select throws_ok($$select public.lookup_household_for_attendance('{"type":"household","version":null,"profileId":"dfa10000-0000-4000-8000-000000000005"}')$$,'22023','invalid_household_qr','Null version rejected');
select throws_ok($$select public.lookup_household_for_attendance('{"type":"household","version":1.0,"profileId":"dfa10000-0000-4000-8000-000000000005"}')$$,'22023','invalid_household_qr','Non-string version rejected');
select throws_ok($$select public.lookup_household_for_attendance(repeat(' ',2049))$$,'22023','invalid_household_qr','Raw byte bound precedes trim');
select throws_ok($$select public.lookup_household_for_attendance('{"type":"household","profileId":"dfa10000-0000-4000-8000-000000000005","barangay_id":"forged"}')$$,'22023','invalid_household_qr','Authority-bearing extra keys rejected');
select is(jsonb_array_length(public.lookup_household_for_attendance('{"type":"household","profileId":"dfa10000-0000-4000-8000-000000000005"}')->'people'),1,'Legacy QR accepted through authorization');
select throws_ok($$select public.lookup_household_for_attendance('{"type":"household","version":"1.0","profileId":"dfa10000-0000-4000-8000-000000000006"}')$$,'42501','household_unavailable','A08 cross-barangay lookup denied');

insert into attendance_results values('holder',public.check_in_household_members(
 'dfa10000-0000-4000-8000-000000000005','efa10000-0000-4000-8000-000000000001','[{"kind":"holder"}]','bfa10000-0000-4000-8000-000000000001'));
select is((select result->'stays'->0->>'outcome' from attendance_results where name='holder'),'created','A01 holder arrival created');
select is(public.check_in_household_members('dfa10000-0000-4000-8000-000000000005','efa10000-0000-4000-8000-000000000001','[{"kind":"holder"},{"kind":"holder"}]','bfa10000-0000-4000-8000-000000000001'),
 (select result from attendance_results where name='holder'),'A03/A05 duplicate normalized retry returns exact receipt');
select is(public.check_in_household_members('dfa10000-0000-4000-8000-000000000005','efa10000-0000-4000-8000-000000000001','[{"kind":"holder"}]',gen_random_uuid())->'stays'->0->>'checked_in_at',
 (select result->'stays'->0->>'checked_in_at' from attendance_results where name='holder'),'A03 a new request preserves original arrival');
select throws_ok($$select public.check_in_household_members('dfa10000-0000-4000-8000-000000000005','efa10000-0000-4000-8000-000000000002','[{"kind":"holder"}]',gen_random_uuid())$$,
 'PT409','attendance_active_elsewhere','A04 conflict at another center');
select throws_ok($$select public.check_in_household_members('dfa10000-0000-4000-8000-000000000005','efa10000-0000-4000-8000-000000000002','[{"kind":"holder"}]','bfa10000-0000-4000-8000-000000000001')$$,
 'PT409','attendance_request_conflict','A07 changed input under same key rejected');
select throws_ok($$select public.check_in_household_members('dfa10000-0000-4000-8000-000000000004','efa10000-0000-4000-8000-000000000001','[{"kind":"holder"},{"kind":"member","member_id":"cfa10000-0000-4000-8000-000000000099"}]',gen_random_uuid())$$,
 'PT409','household_roster_changed','A07 mixed invalid batch rejected');
select is((select count(*)::int from public.household_attendance where household_profile_id='dfa10000-0000-4000-8000-000000000004'),0,'A07 invalid batch leaves no partial stays');
reset role;
select is((select count(*)::int from barangayan_private.household_attendance_receipts where household_profile_id='dfa10000-0000-4000-8000-000000000004'),0,'A07 invalid batch leaves no orphan receipt');
set local role authenticated;
insert into attendance_results values('partial',public.check_in_household_members(
 'dfa10000-0000-4000-8000-000000000004','efa10000-0000-4000-8000-000000000001',
 '[{"kind":"member","member_id":"cfa10000-0000-4000-8000-000000000001"},{"kind":"member","member_id":"cfa10000-0000-4000-8000-000000000002"}]',gen_random_uuid()));
select is((select count(*)::int from public.household_attendance where household_profile_id='dfa10000-0000-4000-8000-000000000004'),2,'A02 exactly two of four participants recorded');
select is((select count(*)::int from public.household_members where profile_id='dfa10000-0000-4000-8000-000000000004' and is_checked_in),2,'A02 compatibility projection matches selected people');
select throws_ok($$select public.check_in_household_members('dfa10000-0000-4000-8000-000000000005','efa10000-0000-4000-8000-000000000001',
 '[{"kind":"member","member_id":"cfa10000-0000-4000-8000-000000000001"}]',gen_random_uuid())$$,
 'PT409','household_roster_changed','A08 member from a real different household denied');
reset role;
select throws_ok($$insert into public.household_attendance(household_profile_id,barangay_id,evacuation_center_id,checked_in_by)
 values('dfa10000-0000-4000-8000-000000000005','afa10000-0000-4000-8000-000000000001','efa10000-0000-4000-8000-000000000001','dfa10000-0000-4000-8000-000000000001')$$,
 '23505',null,'A03 unique active holder constraint is the final guard');
select throws_ok($$insert into public.household_attendance(household_profile_id,household_member_id,barangay_id,evacuation_center_id,checked_in_by)
 values('dfa10000-0000-4000-8000-000000000004','cfa10000-0000-4000-8000-000000000001','afa10000-0000-4000-8000-000000000001','efa10000-0000-4000-8000-000000000002','dfa10000-0000-4000-8000-000000000001')$$,
 '23505',null,'A03 unique active member constraint covers every center');
select throws_ok($$insert into public.household_attendance(household_profile_id,household_member_id,barangay_id,evacuation_center_id,checked_in_by,checked_out_at,checked_out_by)
 values('dfa10000-0000-4000-8000-000000000005','cfa10000-0000-4000-8000-000000000001','afa10000-0000-4000-8000-000000000001','efa10000-0000-4000-8000-000000000001','dfa10000-0000-4000-8000-000000000001',clock_timestamp()+interval '1 second','dfa10000-0000-4000-8000-000000000001')$$,
 '23503',null,'A08 composite foreign key prevents mismatched member ownership');
select throws_ok($$update public.household_attendance set checked_out_at=clock_timestamp() where household_profile_id='dfa10000-0000-4000-8000-000000000004'$$,
 '23514',null,'A13 departure requires an actor and timestamp together');
select throws_ok($$update public.household_attendance set checked_out_at=checked_in_at-interval '1 second',checked_out_by=checked_in_by where household_profile_id='dfa10000-0000-4000-8000-000000000004'$$,
 '23514',null,'A13 departure cannot precede arrival');
set local role authenticated;
select throws_ok($$select public.admin_mutate_record('households','cfa10000-0000-4000-8000-000000000001','save','{"is_checked_in":false}',
 (select updated_at from public.household_members where id='cfa10000-0000-4000-8000-000000000001'))$$,'22023','Invalid editable fields','A09 generic boolean edit denied');
select throws_ok($$select public.admin_remove_household_member('dfa10000-0000-4000-8000-000000000004','cfa10000-0000-4000-8000-000000000001')$$,
 'PT409','attendance_lifecycle_conflict','A10 active member cannot be removed');
select throws_ok($$select public.admin_mutate_record('households','cfa10000-0000-4000-8000-000000000001','archive','{}',
 (select updated_at from public.household_members where id='cfa10000-0000-4000-8000-000000000001'))$$,
 'PT409','attendance_lifecycle_conflict','A10 current-version archive of active member rejected');
select throws_ok($$select public.check_in_household_members('dfa10000-0000-4000-8000-000000000004','efa10000-0000-4000-8000-000000000001','[]',gen_random_uuid())$$,
 '22023','invalid_attendance_selection','A07 empty arrival rejected');
select throws_ok($$select public.check_out_household_attendance(array[]::uuid[],gen_random_uuid())$$,
 '22023','invalid_attendance_selection','A07 empty checkout rejected');
select throws_ok($$select public.check_out_household_attendance(array[null]::uuid[],gen_random_uuid())$$,
 '22023','invalid_attendance_selection','A07 null checkout reference rejected');
select throws_ok($$select public.check_out_household_attendance(array[['dfa10000-0000-4000-8000-000000000004'::uuid]],gen_random_uuid())$$,
 '22023','invalid_attendance_selection','A07 multidimensional checkout rejected at boundary');
select set_config('request.jwt.claim.sub','dfa10000-0000-4000-8000-000000000004',true);
select is(jsonb_array_length(public.get_my_household_attendance()->'people'),4,'A02 resident sees holder and all three members');
select throws_ok($$select public.save_resident_household_if_unchanged('[]','[]')$$,'PT409','resident_household_changed','A12 stale roster editor rejected');
select lives_ok($$select public.save_resident_household_if_unchanged(
 jsonb_set((select household_members from public.profiles where id=auth.uid()),'{0,name}','"Renamed"'),
 (select household_members from public.profiles where id=auth.uid()))$$,'A10 rename preserves stable member identity');
select is((select count(*)::int from public.household_attendance),2,'A08 resident reads only own household');
select is((select count(*)::int from public.household_attendance_receipt_exports),1,'A13 export projection includes own receipt metadata');
select ok((select id is not null from public.household_attendance_receipt_exports limit 1),'A13 exported receipt has an opaque unique pagination identity');
reset role;
select throws_ok($$update public.profiles set barangay_id='afa10000-0000-4000-8000-000000000002' where id='dfa10000-0000-4000-8000-000000000004'$$,
 'PT409','attendance_lifecycle_conflict','A11 active household cannot move barangay');
select throws_ok($$update public.profiles set deleted_at=now() where id='dfa10000-0000-4000-8000-000000000004'$$,
 'PT409','attendance_lifecycle_conflict','A11 active household cannot archive');
select throws_ok($$update public.evacuation_centers set deleted_at=now() where id='efa10000-0000-4000-8000-000000000001'$$,
 'PT409','attendance_lifecycle_conflict','A11 active center cannot archive');
select throws_ok($$update public.evacuation_centers set barangay_id='afa10000-0000-4000-8000-000000000002' where id='efa10000-0000-4000-8000-000000000001'$$,
 'PT409','attendance_lifecycle_conflict','A11 active center cannot move barangay');
update public.evacuation_centers set is_active=false where id='efa10000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','dfa10000-0000-4000-8000-000000000001',true);
insert into attendance_results values('departure',public.check_out_household_attendance(
 array[(select (result->'stays'->0->>'attendance_id')::uuid from attendance_results where name='holder')],
 'bfa10000-0000-4000-8000-000000000002'));
select is((select result->'stays'->0->>'outcome' from attendance_results where name='departure'),'closed','A11 inactive center permits departure');
select is(public.check_in_household_members('dfa10000-0000-4000-8000-000000000005','efa10000-0000-4000-8000-000000000001','[{"kind":"holder"}]','bfa10000-0000-4000-8000-000000000001'),
 (select result from attendance_results where name='holder'),'A05 delayed arrival retry returns original receipt after departure');
select is((select count(*)::int from public.household_attendance where household_profile_id='dfa10000-0000-4000-8000-000000000005' and checked_out_at is null),0,'A05 delayed arrival cannot reopen stay');
insert into attendance_results values('holder-later',public.check_in_household_members(
 'dfa10000-0000-4000-8000-000000000005','efa10000-0000-4000-8000-000000000002','[{"kind":"holder"}]',gen_random_uuid()));
select is(public.check_out_household_attendance(array[(select (result->'stays'->0->>'attendance_id')::uuid from attendance_results where name='holder')],
 'bfa10000-0000-4000-8000-000000000002'),(select result from attendance_results where name='departure'),'A06 checkout retry returns exact receipt');
select is(public.check_out_household_attendance(array[(select (result->'stays'->0->>'attendance_id')::uuid from attendance_results where name='holder')],gen_random_uuid())->'stays'->0->>'outcome',
 'already_closed','A06 stale departure remains bound to original stay');
select is((select count(*)::int from public.household_attendance where household_profile_id='dfa10000-0000-4000-8000-000000000005' and checked_out_at is null),1,'A06 later visit stays open');
select throws_ok($$select public.check_out_household_attendance(array[
 (select (result->'stays'->0->>'attendance_id')::uuid from attendance_results where name='holder-later'),
 (select (result->'stays'->0->>'attendance_id')::uuid from attendance_results where name='partial')],gen_random_uuid())$$,
 '42501','attendance_forbidden','A07 mixed-household checkout is atomic and denied');
select lives_ok($$select public.check_out_household_attendance((select array_agg((s->>'attendance_id')::uuid) from attendance_results,
 jsonb_array_elements(result->'stays') s where name='partial'),gen_random_uuid())$$,'A02 selected family departs atomically');
select lives_ok($$select public.admin_remove_household_member('dfa10000-0000-4000-8000-000000000004','cfa10000-0000-4000-8000-000000000001')$$,'A10 removal after departure succeeds');
select is((select count(*)::int from public.household_members where id='cfa10000-0000-4000-8000-000000000001' and deleted_at is not null),1,'A10 referenced removed member archived');
select is((select count(*)::int from public.household_attendance where household_member_id='cfa10000-0000-4000-8000-000000000001'),1,'A10 removed member history retained');
select lives_ok($$select public.admin_mutate_record('households','cfa10000-0000-4000-8000-000000000001','restore','{}',
 (select updated_at from public.household_members where id='cfa10000-0000-4000-8000-000000000001'))$$,'A10 restore retains historical member ID');
select is((select count(*)::int from public.household_attendance where household_member_id='cfa10000-0000-4000-8000-000000000001'),1,'A10 restore preserves history');
reset role;
update public.profiles set role='resident' where id='dfa10000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.check_in_household_members('dfa10000-0000-4000-8000-000000000005','efa10000-0000-4000-8000-000000000001','[{"kind":"holder"}]','bfa10000-0000-4000-8000-000000000001')$$,
 '42501','attendance_forbidden','A05 role removal denies original receipt');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.profiles set role='admin' where id='dfa10000-0000-4000-8000-000000000001';
update auth.users set banned_until=now()+interval '1 day' where id='dfa10000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','dfa10000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.lookup_household_for_attendance('{"type":"household","profileId":"dfa10000-0000-4000-8000-000000000005"}')$$,
 '42501','attendance_forbidden','A08 banned actor rejected despite JWT');
reset role;
update auth.users set banned_until=null where id='dfa10000-0000-4000-8000-000000000001';
update public.profiles set barangay_id='afa10000-0000-4000-8000-000000000002' where id='dfa10000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub','dfa10000-0000-4000-8000-000000000003',true);
select is((select count(*)::int from public.household_attendance),0,'A08 new barangay staff cannot read former tenant history');
select ok(not exists(select 1 from jsonb_array_elements(public.lookup_household_for_attendance(
 '{"type":"household","profileId":"dfa10000-0000-4000-8000-000000000004"}')->'people') p
 where p->'latest_departure'<>'null'::jsonb),'A08 lookup filters historical tenant');
select set_config('request.jwt.claim.sub','dfa10000-0000-4000-8000-000000000004',true);
select is((select count(*)::int from public.household_attendance),2,'A08 resident retains previous-barangay history');

reset role;
update public.profiles set barangay_id='afa10000-0000-4000-8000-000000000002' where id='dfa10000-0000-4000-8000-000000000001';
update public.evacuation_centers set barangay_id='afa10000-0000-4000-8000-000000000002' where id='efa10000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','dfa10000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.check_in_household_members('dfa10000-0000-4000-8000-000000000004','efa10000-0000-4000-8000-000000000001',
 '[{"kind":"member","member_id":"cfa10000-0000-4000-8000-000000000001"},{"kind":"member","member_id":"cfa10000-0000-4000-8000-000000000002"}]',
 (select (result->>'request_id')::uuid from attendance_results where name='partial'))$$,
 '42501','attendance_forbidden','A05 moved actor/household/center cannot replay former tenant receipt');
select set_config('request.jwt.claims',jsonb_build_object('sub',auth.uid(),'role','authenticated','amr',jsonb_build_array(
 jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint)))::text,true);
select lives_ok($$select public.request_own_account_deletion()$$,'A13 staff actor can be de-identified');
reset role;
select is((select count(*)::int from public.household_attendance where checked_in_by='dfa10000-0000-4000-8000-000000000001'),4,'A13 other households retain stays referencing the erased actor');
select is((select count(*)::int from barangayan_private.household_attendance_receipts where actor_profile_id='dfa10000-0000-4000-8000-000000000001'),0,'A13 erased actor receipts removed');
select ok(exists(select 1 from public.profiles where id='dfa10000-0000-4000-8000-000000000001' and deleted_at is not null),'A13 actor profile retained for non-null foreign keys');
set local role authenticated;
select throws_ok($$select public.lookup_household_for_attendance('{"type":"household","profileId":"dfa10000-0000-4000-8000-000000000004"}')$$,
 '42501','attendance_forbidden','A08 erased actor is denied despite retained JWT subject');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','dfa10000-0000-4000-8000-000000000004',true);

-- Both deletion contracts remove owned stays/receipts before JSON reconciliation.
select set_config('request.jwt.claims',jsonb_build_object('sub',auth.uid(),'role','authenticated','amr',jsonb_build_array(
 jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint)))::text,true);
select is(public.erase_own_account_records(),'profile_erased','A13 v2 erasure completes with historical member references');
reset role;
select is((select count(*)::int from public.household_attendance where household_profile_id='dfa10000-0000-4000-8000-000000000004'),0,'A13 erasure removes own history');
select is((select count(*)::int from barangayan_private.household_attendance_receipts where household_profile_id='dfa10000-0000-4000-8000-000000000004'),0,'A13 erasure removes household receipts');
set local role authenticated;
select set_config('request.jwt.claim.sub','dfa10000-0000-4000-8000-000000000005',true);
select set_config('request.jwt.claims',jsonb_build_object('sub',auth.uid(),'role','authenticated','amr',jsonb_build_array(
 jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint)))::text,true);
select lives_ok($$select public.request_own_account_deletion()$$,'A13 v1 erasure handles an active holder stay');
reset role;
select is((select count(*)::int from public.household_attendance where household_profile_id='dfa10000-0000-4000-8000-000000000005'),0,'A13 v1 removes active and closed own stays');
select * from finish();
rollback;
