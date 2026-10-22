-- Supplemental web Phase 1 acceptance, synthetic fixtures and rollback only.
begin;
select no_plan();
insert into public.barangays(id,name) values
 ('afa30000-0000-4000-8000-000000000001','Boundary A'),('afa30000-0000-4000-8000-000000000002','Boundary B');
insert into auth.users(id,email) select ('dfa30000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'boundary-'||n||'@test.local' from generate_series(1,4) n;
insert into public.profiles(id,barangay_id,role,full_name) select
 ('dfa30000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'afa30000-0000-4000-8000-000000000001',
 case when n<=2 then 'admin' else 'resident' end,'Boundary Person '||n from generate_series(1,4) n;
insert into public.evacuation_centers(id,barangay_id,name,position,is_active) values
 ('efa30000-0000-4000-8000-000000000001','afa30000-0000-4000-8000-000000000001','Boundary Center','{"lat":1,"lng":1}',true);
update public.profiles set household_members='[{"id":"cfa30000-0000-4000-8000-000000000001","name":"Child","relation":"child"}]'
 where id='dfa30000-0000-4000-8000-000000000003';
create temp table boundary_results(name text primary key,result jsonb);
grant all on boundary_results to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','dfa30000-0000-4000-8000-000000000001',true);

select throws_ok($$select public.lookup_household_for_attendance(repeat(chr(12288),700)||'{"type":"household","profileId":"dfa30000-0000-4000-8000-000000000003"}')$$,
 '22023','invalid_household_qr','A07 multibyte QR boundary uses raw bytes');
select throws_ok($$select public.check_in_household_members('dfa30000-0000-4000-8000-000000000003','efa30000-0000-4000-8000-000000000001',
 '[{"kind":"holder","checked_in_at":"2026-10-21"}]',gen_random_uuid())$$,'22023','invalid_attendance_selection','A07 forged authority keys rejected');
select throws_ok($$select public.check_in_household_members('dfa30000-0000-4000-8000-000000000003','efa30000-0000-4000-8000-000000000001',
 (select jsonb_agg('{"kind":"holder"}'::jsonb) from generate_series(1,32)),gen_random_uuid())$$,
 '22023','invalid_attendance_selection','A07 raw participant limit precedes deduplication');
select throws_ok($$select public.check_out_household_attendance(array_fill(gen_random_uuid(),array[32]),gen_random_uuid())$$,
 '22023','invalid_attendance_selection','A07 raw checkout limit precedes deduplication');
insert into boundary_results values('arrival',public.check_in_household_members('dfa30000-0000-4000-8000-000000000003',
 'efa30000-0000-4000-8000-000000000001','[{"kind":"holder"},{"kind":"member","member_id":"cfa30000-0000-4000-8000-000000000001"}]',
 'bfa30000-0000-4000-8000-000000000001'));
select throws_ok($$select public.check_out_household_attendance(array[
 (select (result->'stays'->0->>'attendance_id')::uuid from boundary_results where name='arrival'),
 'ffa30000-0000-4000-8000-000000000099'::uuid],'bfa30000-0000-4000-8000-000000000002')$$,
 '42501','attendance_forbidden','A07 invalid checkout batch rejected atomically');
select is((select count(*)::int from public.household_attendance where checked_out_at is null),2,'A07 failed checkout preserves both active stays');
reset role;
select is((select count(*)::int from barangayan_private.household_attendance_receipts
 where household_profile_id='dfa30000-0000-4000-8000-000000000003'),1,'A07 invalid operations leave no orphan receipt');
set local role authenticated;
select throws_ok($$select public.check_out_household_attendance((select array_agg((s->>'attendance_id')::uuid)
 from boundary_results,jsonb_array_elements(result->'stays') s where name='arrival'),'bfa30000-0000-4000-8000-000000000001')$$,
 'PT409','attendance_request_conflict','A07 request key shared across operation kinds');
select lives_ok($$select public.check_out_household_attendance((select array_agg((s->>'attendance_id')::uuid)
 from boundary_results,jsonb_array_elements(result->'stays') s where name='arrival'),gen_random_uuid())$$,'A01 holder/member departure');
select lives_ok($$select public.admin_remove_household_member('dfa30000-0000-4000-8000-000000000003','cfa30000-0000-4000-8000-000000000001')$$,'A10 remove historical member');
select set_config('request.jwt.claim.sub','dfa30000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.save_resident_household_if_unchanged(
 '[{"id":"cfa30000-0000-4000-8000-000000000001","name":"Child","relation":"child"}]','[]')$$,
 'PT409','household_roster_changed','A10 stale payload cannot resurrect archived identity');
select set_config('request.jwt.claim.sub','dfa30000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.admin_mutate_record('households','cfa30000-0000-4000-8000-000000000001','restore','{}',
 (select updated_at from public.household_members where id='cfa30000-0000-4000-8000-000000000001'))$$,'A10 explicit authorized restore retains identity');
select is((select count(*)::int from public.household_attendance where household_member_id='cfa30000-0000-4000-8000-000000000001'),1,'A10 restore retains history');

reset role;
update public.profiles set barangay_id='afa30000-0000-4000-8000-000000000002'
 where id in ('dfa30000-0000-4000-8000-000000000001','dfa30000-0000-4000-8000-000000000003');
update public.evacuation_centers set barangay_id='afa30000-0000-4000-8000-000000000002' where id='efa30000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.check_in_household_members('dfa30000-0000-4000-8000-000000000003','efa30000-0000-4000-8000-000000000001',
 '[{"kind":"holder"},{"kind":"member","member_id":"cfa30000-0000-4000-8000-000000000001"}]','bfa30000-0000-4000-8000-000000000001')$$,
 '42501','attendance_forbidden','A05 moving actor household and center together cannot replay former-tenant receipt');
select is((select count(*)::int from public.household_attendance),0,'A08 moved admin cannot read old tenant history');
reset role;
update public.profiles set barangay_id='afa30000-0000-4000-8000-000000000001'
 where id in ('dfa30000-0000-4000-8000-000000000001','dfa30000-0000-4000-8000-000000000003');
update public.evacuation_centers set barangay_id='afa30000-0000-4000-8000-000000000001' where id='efa30000-0000-4000-8000-000000000001';

-- A legacy valid raw JSON snapshot may differ from the normalized display model.
alter table public.profiles disable trigger sync_household_members_from_jsonb;
update public.profiles set household_members='[{"id":"CFA30000-0000-4000-8000-000000000001","name":" Child ","relation":"child","legacy":true}]'
 where id='dfa30000-0000-4000-8000-000000000003';
alter table public.profiles enable trigger sync_household_members_from_jsonb;
set local role authenticated;
select set_config('request.jwt.claim.sub','dfa30000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.save_resident_household_if_unchanged(
 '[{"id":"cfa30000-0000-4000-8000-000000000001","name":"Child","relation":"child"}]',
 '[{"id":"cfa30000-0000-4000-8000-000000000001","name":"Child","relation":"child"}]')$$,
 'PT409','resident_household_changed','A12 reconstructed expected snapshot rejected');
insert into boundary_results values('canonical',public.save_resident_household_if_unchanged(
 '[{"id":"CFA30000-0000-4000-8000-000000000001","name":" Renamed ","relation":"child"}]',
 (select household_members from public.profiles where id=auth.uid())));
select is((select result from boundary_results where name='canonical'),
 '[{"id":"cfa30000-0000-4000-8000-000000000001","name":"Renamed","relation":"child"}]'::jsonb,'A12 raw expected snapshot returns persisted canonical list');
select is(public.save_resident_household_if_unchanged('[]',(select result from boundary_results where name='canonical')),'[]'::jsonb,'A12 zero additional members valid');
select lives_ok($$select public.save_resident_household_if_unchanged((select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'name','Child','relation','child')) from generate_series(1,30)),'[]')$$,'A12 thirty additional members valid');
select is(jsonb_array_length(public.get_my_household_attendance()->'people'),31,'A12 thirty plus holder bounded read');
select throws_ok($$select public.save_resident_household_if_unchanged((select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'name','Child','relation','child')) from generate_series(1,31)),
 (select household_members from public.profiles where id=auth.uid()))$$,'22023','invalid_household_members','A12 thirty-one additional members rejected');
select throws_ok($$update public.profiles set household_members=(select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'name','Child','relation','child')) from generate_series(1,31))
 where id=auth.uid()$$,'22023','invalid_household_members','A12 direct JSON writes cannot bypass the roster limit');

reset role;
update auth.users set is_anonymous=true where id='dfa30000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub','dfa30000-0000-4000-8000-000000000004',true);
select throws_ok($$select public.get_my_household_attendance()$$,'42501','attendance_forbidden','A08 anonymous Auth user cannot read attendance');
reset role;
update auth.users set is_anonymous=false,deleted_at=clock_timestamp() where id='dfa30000-0000-4000-8000-000000000004';
set local role authenticated;
select throws_ok($$select public.get_my_household_attendance()$$,'42501','attendance_forbidden','A08 deleted Auth user rejected despite retained profile and JWT');
reset role;
update auth.users set deleted_at=null where id='dfa30000-0000-4000-8000-000000000004';
set local role authenticated;

-- De-identifying a referenced staff actor must preserve another household's stay.
select set_config('request.jwt.claim.sub','dfa30000-0000-4000-8000-000000000002',true);
insert into boundary_results values('actor-stay',public.check_in_household_members('dfa30000-0000-4000-8000-000000000004',
 'efa30000-0000-4000-8000-000000000001','[{"kind":"holder"}]',gen_random_uuid()));
select set_config('request.jwt.claims',jsonb_build_object('sub',auth.uid(),'role','authenticated','amr',jsonb_build_array(
 jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint)))::text,true);
select is(public.erase_own_account_records(),'profile_erased','A13 staff erasure retains referenced actor row');
reset role;
select is((select count(*)::int from public.household_attendance where checked_in_by='dfa30000-0000-4000-8000-000000000002'),1,'A13 other household attendance survives actor erasure');
select is((select full_name from public.profiles where id='dfa30000-0000-4000-8000-000000000002'),'Deleted Resident','A13 retained actor de-identified');
select is((select count(*)::int from barangayan_private.household_attendance_receipts where actor_profile_id='dfa30000-0000-4000-8000-000000000002'),0,'A13 erased actor receipts removed');
select throws_ok($$delete from public.profiles where id='dfa30000-0000-4000-8000-000000000002'$$,'23503',null,'A13 referenced actor cannot be hard-deleted');
select throws_ok($$update public.household_attendance set checked_out_at=clock_timestamp() where household_profile_id='dfa30000-0000-4000-8000-000000000004'$$,
 '23514',null,'A13 departure requires actor and time together');
select * from finish();
rollback;
