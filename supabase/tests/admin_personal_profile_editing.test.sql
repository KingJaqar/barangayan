-- Run in a transaction after 0128; all synthetic rows must be rolled back.
create function pg_temp.profile_edit_reject(statement text, expected text) returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlstate=expected then return; end if;
  raise exception 'Expected %, received %: %',expected,sqlstate,sqlerrm;
 end;
 raise exception 'Expected rejection % for %',expected,statement;
end $$;
insert into public.barangays(id,name) values('a1280000-0000-0000-0000-000000000001','Profile edit fixture');
insert into public.barangay_localities(barangay_id,display_name,city,province)
values('a1280000-0000-0000-0000-000000000001','Profile edit fixture','San Mateo','Rizal');
insert into auth.users(id,email,raw_user_meta_data)
values('b1280000-0000-0000-0000-000000000001','profile-edit-admin@example.test','{}'),
('b1280000-0000-0000-0000-000000000002','profile-edit-resident@example.test','{}');
insert into public.profiles(id,barangay_id,role,full_name,home_address,updated_at)
values('b1280000-0000-0000-0000-000000000001','a1280000-0000-0000-0000-000000000001','admin','Legacy Admin','Legacy address','2026-01-01'),
('b1280000-0000-0000-0000-000000000002','a1280000-0000-0000-0000-000000000001','resident','Resident Fixture','Resident address','2026-01-01');
insert into auth.sessions(id,user_id,created_at,updated_at,aal)
values('c1280000-0000-0000-0000-000000000001','b1280000-0000-0000-0000-000000000001',now(),now(),'aal1'),
('c1280000-0000-0000-0000-000000000002','b1280000-0000-0000-0000-000000000002',now(),now(),'aal1');
-- Existing structured address fragments must not overwrite an admin's edited contact address.
update public.profiles set house_no='12',street='Old street' where id='b1280000-0000-0000-0000-000000000001';
create temp table profile_edit_state(version timestamptz, verification jsonb);
grant all on profile_edit_state to authenticated;
insert into profile_edit_state select updated_at,jsonb_build_array(email_verification_status,id_verification_status,location_verified) from public.profiles where id='b1280000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1280000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1280000-0000-0000-0000-000000000001"}',true);
select pg_temp.profile_edit_reject($q$select public.admin_update_own_profile('{"birth_date":"2999-01-01"}',(select version from profile_edit_state))$q$,'22023');
select pg_temp.profile_edit_reject($q$select public.admin_update_own_profile('{"sex":"invalid"}',(select version from profile_edit_state))$q$,'22023');
select pg_temp.profile_edit_reject($q$select public.admin_update_own_profile('{"employment_status":"invalid"}',(select version from profile_edit_state))$q$,'22023');
select pg_temp.profile_edit_reject($q$select public.admin_update_own_profile('{"birth_date":"2000-02-30"}',(select version from profile_edit_state))$q$,'22023');
select pg_temp.profile_edit_reject($q$select public.admin_update_own_profile('{"id_verification_status":"verified"}',(select version from profile_edit_state))$q$,'22023');
select pg_temp.profile_edit_reject($q$select public.admin_update_own_profile('{"email_verification_status":"verified"}',(select version from profile_edit_state))$q$,'22023');
select pg_temp.profile_edit_reject($q$select public.admin_update_own_profile('{"location_verified":"true"}',(select version from profile_edit_state))$q$,'22023');
update profile_edit_state set version=public.admin_update_own_profile('{"home_address":"24 Mabini Street","city":"Quezon City","province":"Metro Manila","birth_date":"1992-06-12","sex":"female","employment_status":"employed","occupation":"Designer"}',version);
select pg_temp.profile_edit_reject($q$select public.admin_update_own_profile('{"occupation":"Stale"}','2026-01-01')$q$,'PT409');
reset role;
do $$ declare p public.profiles; begin
 select * into p from public.profiles where id='b1280000-0000-0000-0000-000000000001';
 if p.home_address<>'24 Mabini Street' or p.city<>'Quezon City' or p.province<>'Metro Manila' or p.birth_date<>'1992-06-12'::date or p.sex<>'female' or p.employment_status<>'employed' or p.occupation<>'Designer' or p.full_name<>'Legacy Admin' then raise exception 'Personal edit roundtrip failed'; end if;
 if jsonb_build_array(p.email_verification_status,p.id_verification_status,p.location_verified) is distinct from (select verification from profile_edit_state) then raise exception 'Verification changed'; end if;
end $$;
set local role authenticated;
update profile_edit_state set version=public.admin_update_own_profile('{"first_name":"Alex","last_name":"Reyes","middle_name":null,"suffix":null}',version);
update profile_edit_state set version=public.admin_update_own_profile('{"mobile_number":"09171234567"}',version);
select pg_temp.profile_edit_reject($q$select public.admin_update_own_profile('{"full_name":"Overwrite structured name"}',(select version from profile_edit_state))$q$,'22023');
update profile_edit_state set version=public.admin_update_own_profile('{"birth_date":null,"sex":null,"employment_status":null,"occupation":null,"city":null,"province":null,"home_address":null}',version);
reset role;
do $$ declare p public.profiles; begin
 select * into p from public.profiles where id='b1280000-0000-0000-0000-000000000001';
 if p.full_name<>'Alex Reyes' or p.home_address is not null or p.city is not null or p.province is not null or p.birth_date is not null or p.sex is not null or p.employment_status is not null or p.occupation is not null then raise exception 'Structured name/clear roundtrip failed'; end if;
 if (select home_address from public.profiles where id='b1280000-0000-0000-0000-000000000002')<>'Resident address' then raise exception 'Resident mutated'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1280000-0000-0000-0000-000000000002","role":"authenticated","session_id":"c1280000-0000-0000-0000-000000000002"}',true);
select pg_temp.profile_edit_reject($q$select public.admin_update_own_profile('{"occupation":"Resident write"}',now())$q$,'42501');
select pg_temp.profile_edit_reject($q$update public.profiles set city='Quezon City' where id=auth.uid()$q$,'42501');
select pg_temp.profile_edit_reject($q$update public.profiles set home_address='Free text override' where id=auth.uid()$q$,'42501');
reset role;
do $$ begin raise notice 'PASS: admin personal fields, structured names, nullable clears, stale writes, verification protection, resident isolation and locality guards'; end $$;
