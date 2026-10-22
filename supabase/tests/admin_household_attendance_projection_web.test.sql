-- Independent web Phase 2 verification. Synthetic fixtures; every write rolls back.
begin;
select no_plan();
insert into public.barangays(id,name) values
 ('afb20000-0000-4000-8000-000000000001','Web projection A'),
 ('afb20000-0000-4000-8000-000000000002','Web projection B');
insert into auth.users(id,email) select ('dfb20000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'web-projection-'||n||'@test.local' from generate_series(1,5) n;
insert into public.profiles(id,barangay_id,role,full_name)
 select ('dfb20000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('afb20000-0000-4000-8000-'||case when n in (2,5) then '000000000002' else '000000000001' end)::uuid,
 case when n<3 then 'admin' else 'resident' end,'Web Projection '||n from generate_series(1,5) n;
update public.profiles set household_members='[
 {"id":"cfb20000-0000-4000-8000-000000000001","name":"Selected child","relation":"child","role":"member"},
 {"id":"cfb20000-0000-4000-8000-000000000002","name":"Unselected child","relation":"child","role":"member"}]'
 where id='dfb20000-0000-4000-8000-000000000003';
insert into public.evacuation_centers(id,barangay_id,name,position,is_active) values
 ('efb20000-0000-4000-8000-000000000001','afb20000-0000-4000-8000-000000000001','Web Center','{"lat":1,"lng":1}',true);
-- An old boolean must never establish authoritative presence.
update public.household_members set is_checked_in=true,checked_in_center_name='Legacy center'
 where id='cfb20000-0000-4000-8000-000000000002';
create temp table projection_receipts(name text,result jsonb);
grant all on projection_receipts to authenticated;

select ok(not has_table_privilege('anon','public.admin_households_browse','select'),'Anonymous directory access revoked');
select ok(not has_table_privilege('anon','public.admin_households_summary','select'),'Anonymous summary access revoked');
select ok((select bool_and('security_invoker=true'=any(reloptions)) from pg_class
 where oid in ('public.admin_households_browse'::regclass,'public.admin_households_records'::regclass,'public.admin_households_summary'::regclass)),
 'All projections preserve invoker RLS');
set local role authenticated;
select set_config('request.jwt.claim.sub','dfb20000-0000-4000-8000-000000000001',true);
select is((select summary->>'total' from public.admin_households_summary),'4','Two holders and two members counted');
select is((select summary->>'holders' from public.admin_households_summary),'2','Holder-only household counted');
select is((select summary->>'checked_in' from public.admin_households_summary),'0','Legacy boolean not counted');
select is((select summary->>'not_checked_in' from public.admin_households_summary),'4','No active stay is counted independently');
select is((select count(*) from public.admin_households_browse),2::bigint,'Existing table remains additional members');
select ok((select bool_and(not f_checked_in and not s_checked_in and s_center is null and s_check_in_date is null)
 from public.admin_households_browse),'Filters and sorts ignore legacy compatibility fields');
select is((select row->>'is_checked_in' from public.admin_households_browse where id='cfb20000-0000-4000-8000-000000000002'),'false','Payload ignores stale legacy boolean');
select is((select row->>'checked_in_center_name' from public.admin_households_records where id='cfb20000-0000-4000-8000-000000000002'),null::text,'Record details ignore stale legacy center');

insert into projection_receipts values('arrive',public.check_in_household_members('dfb20000-0000-4000-8000-000000000003',
 'efb20000-0000-4000-8000-000000000001','[{"kind":"holder"},{"kind":"member","member_id":"cfb20000-0000-4000-8000-000000000001"}]',gen_random_uuid()));
select is((select summary->>'checked_in' from public.admin_households_summary),'2','Selected holder and member counted exactly once');
select is((select summary->>'not_checked_in' from public.admin_households_summary),'2','Unselected holder and member unchanged');
select is((select count(*) from public.admin_households_browse where f_checked_in),1::bigint,'Only selected additional member in active filter');
select is((select row->>'checked_in_center_name' from public.admin_households_browse where f_checked_in),'Web Center','Directory shows authoritative center');
select is((select row->>'checked_in_at' from public.admin_households_browse where f_checked_in),
 (select item->>'checked_in_at' from projection_receipts,jsonb_array_elements(result->'stays') item where name='arrive' and item->>'kind'='member'),
 'Directory arrival equals committed server timestamp');
select throws_ok($$select public.admin_mutate_record('households','cfb20000-0000-4000-8000-000000000001','save',
 '{"is_checked_in":false}',(select updated_at from public.household_members where id='cfb20000-0000-4000-8000-000000000001'))$$,
 '22023','Invalid editable fields','Generic mutation cannot change attendance');
insert into projection_receipts values('depart',public.check_out_household_attendance(
 (select array_agg((item->>'attendance_id')::uuid) from projection_receipts,jsonb_array_elements(result->'stays') item where name='arrive'),gen_random_uuid()));
select is((select summary->>'checked_in' from public.admin_households_summary),'0','Departures remove holder and member from active count');
select is((select count(*) from public.admin_households_browse where f_checked_in),0::bigint,'Departure clears active filter');
select lives_ok($$select public.admin_mutate_record('households','cfb20000-0000-4000-8000-000000000001','archive','{}',
 (select updated_at from public.household_members where id='cfb20000-0000-4000-8000-000000000001'))$$,'Checked-out member archive remains supported');
select is((select summary->>'total' from public.admin_households_summary),'3','Archived member excluded from totals');
select is((select count(*) from public.admin_households_records where f_archived),1::bigint,'Archive records retain member lifecycle ID');

select set_config('request.jwt.claim.sub','dfb20000-0000-4000-8000-000000000002',true);
select is((select summary->>'total' from public.admin_households_summary),'1','Other barangay sees only its holder');
select is((select count(*) from public.admin_households_browse),0::bigint,'Other barangay cannot see members');
select is((select count(*) from public.admin_households_records),0::bigint,'Other barangay cannot see archived member');
select set_config('request.jwt.claim.sub','dfb20000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.admin_households_summary),0::bigint,'Resident cannot query admin summary');
select is((select count(*) from public.admin_households_browse),0::bigint,'Resident cannot query admin directory');
reset role;
select * from finish();
rollback;
