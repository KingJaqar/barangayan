-- Run in an isolated database transaction after 0119. All fixtures roll back.
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlstate=expected then return; end if;
  raise exception 'Expected %, received %',expected,sqlstate;
 end;
 raise exception 'Expected rejection: %',expected;
end $$;

insert into public.barangays(id,name)
values('a1190000-0000-0000-0000-000000000001','Profile test tenant'),
 ('a1190000-0000-0000-0000-000000000002','Profile foreign tenant');
insert into auth.users(id,email,raw_user_meta_data)
select ('b1190000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'profile-119-'||n||'@example.test','{}'::jsonb from generate_series(1,5) n;
insert into public.profiles(id,barangay_id,role,full_name,home_address,updated_at)
values
 ('b1190000-0000-0000-0000-000000000001','a1190000-0000-0000-0000-000000000001','admin','Legacy Admin','Legacy address','2026-01-01'),
 ('b1190000-0000-0000-0000-000000000002','a1190000-0000-0000-0000-000000000001','resident','Associated Resident','Resident address','2026-01-01'),
 ('b1190000-0000-0000-0000-000000000003','a1190000-0000-0000-0000-000000000002','resident','Foreign Resident',null,'2026-01-01'),
 ('b1190000-0000-0000-0000-000000000004','a1190000-0000-0000-0000-000000000001','admin','Other Admin',null,'2026-01-01'),
 ('b1190000-0000-0000-0000-000000000005','a1190000-0000-0000-0000-000000000001','admin','Inactive Admin',null,'2026-01-01');
update public.barangay_officials set is_active=false where profile_id='b1190000-0000-0000-0000-000000000005';
insert into auth.sessions(id,user_id,created_at,updated_at,aal)
select ('c1190000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('b1190000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,clock_timestamp(),clock_timestamp(),'aal1' from generate_series(1,5) n;
create temp table profile_test_state(challenge uuid,version timestamptz,next_challenge uuid,link_version timestamptz);
grant all on profile_test_state to authenticated,anon;
insert into profile_test_state values(null,'2026-01-01',null,null);

set local role anon;
select pg_temp.expect_error($q$select public.admin_update_own_profile('{"full_name":"Anonymous"}',now())$q$,'42501');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1190000-0000-0000-0000-000000000002","role":"authenticated","session_id":"c1190000-0000-0000-0000-000000000002"}',true);
select pg_temp.expect_error($q$select public.admin_update_own_profile('{"full_name":"Resident"}',now())$q$,'42501');
select pg_temp.expect_error($q$select public.admin_begin_resident_association()$q$,'42501');
select set_config('request.jwt.claims','{"sub":"b1190000-0000-0000-0000-000000000005","role":"authenticated","session_id":"c1190000-0000-0000-0000-000000000005"}',true);
select pg_temp.expect_error($q$select public.admin_begin_resident_association()$q$,'42501');
select set_config('request.jwt.claims','{"sub":"b1190000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1190000-0000-0000-0000-000000000001"}',true);
select pg_temp.expect_error($q$select public.admin_update_own_profile('{"role":"resident"}','2026-01-01')$q$,'22023');
select pg_temp.expect_error($q$select public.admin_update_own_profile('{"id":"b1190000-0000-0000-0000-000000000004"}','2026-01-01')$q$,'22023');
select pg_temp.expect_error($q$select public.admin_update_own_profile('{"home_address":"overwrite"}','2026-01-01')$q$,'22023');
select pg_temp.expect_error($q$select public.admin_update_own_profile('{"full_name":"  "}','2026-01-01')$q$,'22023');
select pg_temp.expect_error($q$select public.admin_update_own_profile('{"mobile_number":"123"}','2026-01-01')$q$,'22023');
select pg_temp.expect_error($q$select public.admin_update_own_profile('{"email":"invalid"}','2026-01-01')$q$,'22023');
select pg_temp.expect_error($q$select public.admin_update_own_profile('{"avatar_url":"https://evil.example/a.png"}','2026-01-01')$q$,'22023');
update profile_test_state set version=public.admin_update_own_profile('{"mobile_number":"09171234567","email":"contact@example.test"}','2026-01-01');
select pg_temp.expect_error($q$select public.admin_update_own_profile('{"full_name":"Stale overwrite"}','2026-01-01')$q$,'PT409');
select pg_temp.expect_error($q$insert into public.admin_resident_associations(admin_id,resident_id) values('b1190000-0000-0000-0000-000000000001','b1190000-0000-0000-0000-000000000002')$q$,'42501');
update profile_test_state set challenge=public.admin_begin_resident_association();
select pg_temp.expect_error($q$select public.admin_begin_resident_association()$q$,'PT429');
select pg_temp.expect_error($q$select public.admin_finish_resident_association((select challenge from profile_test_state))$q$,'22023');
reset role;
update barangayan_private.admin_association_challenges set expires_at=clock_timestamp()-interval '1 second';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1190000-0000-0000-0000-000000000002","role":"authenticated","session_id":"c1190000-0000-0000-0000-000000000002"}',true);
select pg_temp.expect_error($q$select public.resident_prove_admin_association((select challenge from profile_test_state))$q$,'22023');
reset role;
update barangayan_private.admin_association_challenges set expires_at=clock_timestamp()+interval '5 minutes';
-- Ownership proof needs a newly created resident session, not an old JWT.
update auth.sessions set created_at=clock_timestamp() where id in ('c1190000-0000-0000-0000-000000000002','c1190000-0000-0000-0000-000000000003');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1190000-0000-0000-0000-000000000003","role":"authenticated","session_id":"c1190000-0000-0000-0000-000000000003"}',true);
select pg_temp.expect_error($q$select public.resident_prove_admin_association((select challenge from profile_test_state))$q$,'22023');
select set_config('request.jwt.claims','{"sub":"b1190000-0000-0000-0000-000000000002","role":"authenticated","session_id":"c1190000-0000-0000-0000-000000000002"}',true);
reset role;
insert into auth.mfa_factors(id,user_id,factor_type,status,friendly_name,created_at,updated_at)
values('d1190000-0000-0000-0000-000000000001','b1190000-0000-0000-0000-000000000002','totp','verified','Profile test authenticator',clock_timestamp(),clock_timestamp());
set local role authenticated;
select pg_temp.expect_error($q$select public.resident_prove_admin_association((select challenge from profile_test_state))$q$,'42501');
reset role;
update auth.sessions set aal='aal2' where id='c1190000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1190000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2","session_id":"c1190000-0000-0000-0000-000000000002"}',true);
select public.resident_prove_admin_association(challenge) from profile_test_state;
select pg_temp.expect_error($q$select public.resident_prove_admin_association((select challenge from profile_test_state))$q$,'22023');
select set_config('request.jwt.claims','{"sub":"b1190000-0000-0000-0000-000000000004","role":"authenticated","session_id":"c1190000-0000-0000-0000-000000000004"}',true);
select pg_temp.expect_error($q$select public.admin_finish_resident_association((select challenge from profile_test_state))$q$,'22023');
select set_config('request.jwt.claims','{"sub":"b1190000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1190000-0000-0000-0000-000000000001"}',true);
reset role;
-- These changes happen after ownership proof, before the final link operation.
-- Exercise each retirement boundary independently; no relationship may commit.
do $$
declare change text;
begin
 foreach change in array array[
  $q$update public.profiles set role='admin' where id='b1190000-0000-0000-0000-000000000002'$q$,
  $q$update public.profiles set deleted_at=clock_timestamp() where id='b1190000-0000-0000-0000-000000000002'$q$,
  $q$update public.profiles set barangay_id='a1190000-0000-0000-0000-000000000002' where id='b1190000-0000-0000-0000-000000000002'$q$,
  $q$update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id='b1190000-0000-0000-0000-000000000002'$q$,
  $q$update auth.users set deleted_at=clock_timestamp() where id='b1190000-0000-0000-0000-000000000002'$q$,
  $q$update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id='c1190000-0000-0000-0000-000000000002'$q$,
  $q$update auth.sessions set aal='aal1' where id='c1190000-0000-0000-0000-000000000002'$q$
 ] loop
  begin
   execute change;
   set local role authenticated;
   perform pg_temp.expect_error('select public.admin_finish_resident_association((select challenge from profile_test_state))','22023');
   reset role;
   -- Roll back only this mutation so the next boundary starts from valid proof.
   raise exception 'restore_test_boundary' using errcode='P1190';
  exception when sqlstate 'P1190' then null;
  end;
 end loop;
end $$;

create function pg_temp.reject_association_audit() returns trigger language plpgsql as $$
begin
 if new.metadata->>'operation' in ('link_resident','unlink_resident') then
  raise exception 'isolated_audit_failure' using errcode='42501';
 end if;
 return new;
end $$;
create trigger profile_test_audit_failure before insert on public.admin_audit_log
 for each row execute function pg_temp.reject_association_audit();
set local role authenticated;
select pg_temp.expect_error($q$select public.admin_finish_resident_association((select challenge from profile_test_state))$q$,'42501');
reset role;
do $$ begin
 if exists(select 1 from public.admin_resident_associations where admin_id='b1190000-0000-0000-0000-000000000001')
  or exists(select 1 from barangayan_private.admin_association_challenges where admin_id='b1190000-0000-0000-0000-000000000001' and consumed_at is not null) then
  raise exception 'Failed mandatory link audit did not roll back atomically';
 end if;
end $$;
drop trigger profile_test_audit_failure on public.admin_audit_log;
set local role authenticated;
select public.admin_finish_resident_association(challenge) from profile_test_state;
update profile_test_state set link_version=(select linked_at from public.admin_resident_associations where admin_id=auth.uid());
do $$ begin if not public.admin_profile_resident_available() then raise exception 'Active linked resident was hidden'; end if; end $$;
reset role;
update auth.users set banned_until=now()+interval '1 hour' where id='b1190000-0000-0000-0000-000000000002';
set local role authenticated;
do $$ begin if public.admin_profile_resident_available() then raise exception 'Banned linked resident was exposed'; end if; end $$;
reset role;
update auth.users set banned_until=null where id='b1190000-0000-0000-0000-000000000002';
set local role authenticated;
select pg_temp.expect_error($q$select public.admin_finish_resident_association((select challenge from profile_test_state))$q$,'22023');
select pg_temp.expect_error($q$select public.admin_begin_resident_association()$q$,'PT409');
select set_config('request.jwt.claims','{"sub":"b1190000-0000-0000-0000-000000000004","role":"authenticated","session_id":"c1190000-0000-0000-0000-000000000004"}',true);
update profile_test_state set next_challenge=public.admin_begin_resident_association();
reset role;
update auth.sessions set created_at=clock_timestamp() where id='c1190000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1190000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2","session_id":"c1190000-0000-0000-0000-000000000002"}',true);
select public.resident_prove_admin_association(next_challenge) from profile_test_state;
select set_config('request.jwt.claims','{"sub":"b1190000-0000-0000-0000-000000000004","role":"authenticated","session_id":"c1190000-0000-0000-0000-000000000004"}',true);
select pg_temp.expect_error($q$select public.admin_finish_resident_association((select next_challenge from profile_test_state))$q$,'23505');
select set_config('request.jwt.claims','{"sub":"b1190000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1190000-0000-0000-0000-000000000001"}',true);
select pg_temp.expect_error($q$select public.admin_unlink_resident_association('b1190000-0000-0000-0000-000000000003',(select link_version from profile_test_state))$q$,'PT409');
reset role;
update public.admin_resident_associations set linked_at=clock_timestamp() where admin_id='b1190000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.expect_error($q$select public.admin_unlink_resident_association('b1190000-0000-0000-0000-000000000002',(select link_version from profile_test_state))$q$,'PT409');
reset role;
create trigger profile_test_audit_failure before insert on public.admin_audit_log
 for each row execute function pg_temp.reject_association_audit();
set local role authenticated;
select pg_temp.expect_error($q$select public.admin_unlink_resident_association('b1190000-0000-0000-0000-000000000002',(select linked_at from public.admin_resident_associations where admin_id=auth.uid()))$q$,'42501');
reset role;
do $$ begin
 if not exists(select 1 from public.admin_resident_associations where admin_id='b1190000-0000-0000-0000-000000000001') then
  raise exception 'Failed mandatory unlink audit removed the relationship';
 end if;
end $$;
drop trigger profile_test_audit_failure on public.admin_audit_log;
set local role authenticated;
select public.admin_unlink_resident_association('b1190000-0000-0000-0000-000000000002',(select linked_at from public.admin_resident_associations where admin_id=auth.uid()));
reset role;
do $$ begin
 if (select full_name from public.profiles where id='b1190000-0000-0000-0000-000000000001')<>'Legacy Admin'
  or (select home_address from public.profiles where id='b1190000-0000-0000-0000-000000000001')<>'Legacy address'
  or (select email_verification_status from public.profiles where id='b1190000-0000-0000-0000-000000000001')<>'unverified'
  or (select full_name from public.profiles where id='b1190000-0000-0000-0000-000000000002')<>'Associated Resident'
  or (select count(*) from public.profiles where id::text like 'b1190000-%')<>5
  or exists(select 1 from public.admin_resident_associations where admin_id='b1190000-0000-0000-0000-000000000001') then
  raise exception 'Profile isolation/legacy/unlink assertion failed';
 end if;
 raise notice 'PASS: ownership, caller roles, injection, validation, stale writes, expiry/rate limits, fresh proof, replay, commit-time retirement, mandatory audit atomicity, tenant isolation, unlink preservation';
end $$;
