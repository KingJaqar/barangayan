-- Account notifications for Auth sessions (migration 0152): every sign-in of a usable resident is
-- one alertable event keyed by its session; ended sessions are history only, one event per
-- statement; nothing while the gate is off; never for staff, incomplete or deleted accounts; and a
-- producer failure never blocks Auth. Runs in one transaction that is rolled back.
begin;
select plan(20);

insert into public.barangays(id,name) values ('a6520000-0000-0000-0000-000000000001','Barangay Ampid I');
insert into auth.users(id,email,raw_user_meta_data) values
('b6520000-0000-0000-0000-000000000001','s152-resident@test.local','{}'),
('b6520000-0000-0000-0000-000000000002','s152-admin@test.local','{}'),
('b6520000-0000-0000-0000-000000000003','s152-incomplete@test.local','{}'),
('b6520000-0000-0000-0000-000000000004','s152-deleted@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values
('b6520000-0000-0000-0000-000000000001','a6520000-0000-0000-0000-000000000001','resident','S152 Resident'),
('b6520000-0000-0000-0000-000000000002','a6520000-0000-0000-0000-000000000001','admin','S152 Admin'),
('b6520000-0000-0000-0000-000000000003','a6520000-0000-0000-0000-000000000001','resident','S152 Incomplete'),
('b6520000-0000-0000-0000-000000000004','a6520000-0000-0000-0000-000000000001','resident','S152 Deleted')
on conflict (id) do update set barangay_id=excluded.barangay_id,role=excluded.role,full_name=excluded.full_name;
update public.profiles set first_name='Test',last_name='Resident',house_no='1',street='Fixture Street',
  sex='female',employment_status='student',mobile_number='09171234567',birth_date='2000-01-01',profile_completed_at=now()
  where id in ('b6520000-0000-0000-0000-000000000001','b6520000-0000-0000-0000-000000000002','b6520000-0000-0000-0000-000000000004');
update public.profiles set deleted_at=now() where id='b6520000-0000-0000-0000-000000000004';

create or replace function pg_temp.ev(p_res uuid, p_like text) returns integer language sql as $$
  select count(*)::int from barangayan_private.notification_events e where e.recipient_id=p_res and e.dedupe_key like p_like
$$;
create or replace function pg_temp.al(p_res uuid, p_like text) returns integer language sql as $$
  select count(*)::int from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id
    join barangayan_private.notification_events e on e.id=i.event_id where e.recipient_id=p_res and e.dedupe_key like p_like
$$;
create or replace function pg_temp.inbox(p_res uuid, p_like text) returns jsonb language sql as $$
  select to_jsonb(i) from public.notification_inbox i join barangayan_private.notification_events e on e.id=i.event_id
   where e.recipient_id=p_res and e.dedupe_key like p_like order by e.created_at desc limit 1
$$;
-- Auth writes sessions without a resident JWT.
select set_config('request.jwt.claim.sub','',true), set_config('request.jwt.claims','{}',true);

-- ===== Gate off =====
update barangayan_private.notification_hub_settings set emission_enabled=false,v2_alerts_enabled=false where id;
insert into auth.sessions(id,user_id) values ('c6520000-0000-0000-0000-000000000001','b6520000-0000-0000-0000-000000000001');
select is(pg_temp.ev('b6520000-0000-0000-0000-000000000001','session%'),0,'Gate off: a sign-in writes nothing');
delete from auth.sessions where id='c6520000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6520000-0000-0000-0000-000000000001','session%'),0,'Gate off: an ended session writes nothing');

-- ===== Gate on =====
update barangayan_private.notification_hub_settings set emission_enabled=true,v2_alerts_enabled=true where id;
insert into auth.sessions(id,user_id) values ('c6520000-0000-0000-0000-000000000002','b6520000-0000-0000-0000-000000000001');
select is(pg_temp.ev('b6520000-0000-0000-0000-000000000001','session:c6520000-0000-0000-0000-000000000002:signed_in'),1,'A sign-in is one event keyed by its session');
select is(pg_temp.al('b6520000-0000-0000-0000-000000000001','session:c6520000-0000-0000-0000-000000000002:%'),1,'A sign-in has a phone alert');
select is(pg_temp.inbox('b6520000-0000-0000-0000-000000000001','session:%:signed_in')->>'kind','account_security','Sign-in is an Account security notification');
select is(pg_temp.inbox('b6520000-0000-0000-0000-000000000001','session:%:signed_in')->>'title','New sign-in to your account','Sign-in uses the generic copy');
select is(pg_temp.inbox('b6520000-0000-0000-0000-000000000001','session:%:signed_in')->'destination','{"v":2,"kind":"account","screen":"change_password"}'::jsonb,'Sign-in opens Change Password');
select ok(position('S152' in pg_temp.inbox('b6520000-0000-0000-0000-000000000001','session:%:signed_in')->>'body')=0,'No source content in the body');

-- A retried notification for the same session never doubles it.
select barangayan_private.account_notify('A22S','b6520000-0000-0000-0000-000000000001','session:c6520000-0000-0000-0000-000000000002:signed_in','account','b6520000-0000-0000-0000-000000000001',null,false);
select is(pg_temp.ev('b6520000-0000-0000-0000-000000000001','session:%:signed_in'),1,'A repeated key for one session stays one event');

insert into auth.sessions(id,user_id) values ('c6520000-0000-0000-0000-000000000003','b6520000-0000-0000-0000-000000000001'),
  ('c6520000-0000-0000-0000-000000000004','b6520000-0000-0000-0000-000000000001');
select is(pg_temp.ev('b6520000-0000-0000-0000-000000000001','session:%:signed_in'),3,'Each further sign-in is its own event');

-- ===== Ended sessions =====
delete from auth.sessions where id='c6520000-0000-0000-0000-000000000002';
select is(pg_temp.ev('b6520000-0000-0000-0000-000000000001','session_end:%'),1,'An ended session is one event');
select is(pg_temp.al('b6520000-0000-0000-0000-000000000001','session_end:%'),0,'An ended session is history only');
select is(pg_temp.inbox('b6520000-0000-0000-0000-000000000001','session_end:%')->>'title','A sign-in session ended','Ended copy does not claim a sign-out');
select is(pg_temp.inbox('b6520000-0000-0000-0000-000000000001','session_end:%')->'destination','{"v":2,"kind":"account","screen":"settings"}'::jsonb,'Ended session opens Settings');
delete from auth.sessions where user_id='b6520000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6520000-0000-0000-0000-000000000001','session_end:%'),2,'A global sign-out of several sessions is one more event');

-- ===== Recipients outside the rule =====
insert into auth.sessions(id,user_id) values ('c6520000-0000-0000-0000-000000000005','b6520000-0000-0000-0000-000000000002'),
  ('c6520000-0000-0000-0000-000000000006','b6520000-0000-0000-0000-000000000003'),
  ('c6520000-0000-0000-0000-000000000007','b6520000-0000-0000-0000-000000000004');
select is(pg_temp.ev('b6520000-0000-0000-0000-000000000002','session%'),0,'Staff sign-ins are not resident notifications');
select is(pg_temp.ev('b6520000-0000-0000-0000-000000000003','session%'),0,'A resident who has not completed setup gets nothing');
select is(pg_temp.ev('b6520000-0000-0000-0000-000000000004','session%'),0,'A deleted resident gets nothing');

-- ===== A producer failure never blocks Auth =====
alter table public.notification_inbox add constraint s152_block_inbox check (kind<>'account_security') not valid;
select lives_ok($$insert into auth.sessions(id,user_id) values ('c6520000-0000-0000-0000-000000000008','b6520000-0000-0000-0000-000000000001')$$,'A failing producer does not fail the sign-in');
select lives_ok($$delete from auth.sessions where id='c6520000-0000-0000-0000-000000000008'$$,'A failing producer does not fail the sign-out');

select * from finish();
rollback;
