-- Synthetic receipt-export access checks; no persisted fixtures.
begin;
select no_plan();
insert into public.barangays(id,name) values ('afb41000-0000-4000-8000-000000000001','Receipt export tests');
insert into auth.users(id,email) select ('dfb41000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'receipt-export-'||n||'@test.local' from generate_series(1,3) n;
insert into public.profiles(id,barangay_id,role,full_name)
 select ('dfb41000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'afb41000-0000-4000-8000-000000000001',case when n=3 then 'admin' else 'resident' end,'Receipt export '||n
 from generate_series(1,3) n;
insert into barangayan_private.household_attendance_receipts(actor_profile_id,request_id,household_profile_id,operation,input_fingerprint,result)
 select 'dfb41000-0000-4000-8000-000000000003',gen_random_uuid(),
 ('dfb41000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'check_in','{}','{"private":"never exported"}'
 from generate_series(1,3) n;
select ok((select 'security_invoker=true'=any(reloptions) and 'security_barrier=true'=any(reloptions)
 from pg_class where oid='public.household_attendance_receipt_exports'::regclass),'Export view uses invoker permissions and a barrier');
select ok(position('auth.users' in pg_get_viewdef('public.household_attendance_receipt_exports'::regclass,true))=0,
 'Auth users are not referenced by an exposed view');
select ok(not has_table_privilege('authenticated','barangayan_private.household_attendance_receipts','SELECT'),
 'Clients still cannot select private receipt rows');
select ok(not has_function_privilege('service_role','barangayan_private.get_my_household_attendance_receipt_exports()','EXECUTE'),
 'No service-role export shortcut');
set local role anon;
select throws_ok($$select * from public.household_attendance_receipt_exports$$,'42501',null,'Anonymous view access denied');
select throws_ok($$select * from barangayan_private.get_my_household_attendance_receipt_exports()$$,'42501',null,
 'Anonymous private-helper access denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','dfb41000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.household_attendance_receipt_exports),1::bigint,'Resident exports exactly their own receipt');
select is((select household_profile_id from public.household_attendance_receipt_exports),auth.uid(),'Foreign household receipt hidden');
select is((select count(*) from barangayan_private.get_my_household_attendance_receipt_exports()),1::bigint,
 'Calling the helper directly retains ownership filtering');
select ok((select not(to_jsonb(e)?|array['actor_profile_id','input_fingerprint','result'])
 from public.household_attendance_receipt_exports e),'Private staff and payload fields are never exported');
select set_config('request.jwt.claim.sub','dfb41000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.household_attendance_receipt_exports),0::bigint,'Staff cannot export resident receipt metadata');
reset role;
update auth.users set banned_until=now()+interval '1 day' where id='dfb41000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','dfb41000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.household_attendance_receipt_exports),0::bigint,'Banned resident cannot export receipts');
reset role;
update auth.users set banned_until=null,is_anonymous=true where id='dfb41000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*) from public.household_attendance_receipt_exports),0::bigint,'Anonymous Auth account cannot export receipts');
reset role;
update auth.users set is_anonymous=false,deleted_at=now() where id='dfb41000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*) from public.household_attendance_receipt_exports),0::bigint,'Deleted Auth account cannot export receipts');
reset role;
update auth.users set deleted_at=null where id='dfb41000-0000-4000-8000-000000000001';
update public.profiles set deleted_at=now() where id='dfb41000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*) from public.household_attendance_receipt_exports),0::bigint,'Archived profile cannot export receipts');
select set_config('request.jwt.claim.sub','',true);
select is((select count(*) from public.household_attendance_receipt_exports),0::bigint,'Missing subject cannot export receipts');
reset role;
select * from finish();
rollback;
