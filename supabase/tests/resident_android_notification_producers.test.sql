-- Resident Android notifications and announcements, Phase 2: producers of migration 0146. Account
-- events are driven through the real writers (profile updates, household rows, ID publication and
-- review, request submission and SLA transitions, payment/refund rows, incident rows) and checked for:
-- one durable event per occurrence, retry/duplicate/actor/negative cases, generic text, the
-- history-only mode for the resident's own actions, no event from reads or preferences, bounded
-- reconciliation and the catch-up delivery of System notices. Everything, fixtures included, runs
-- in one transaction that is rolled back.
begin;
select no_plan();

-- ===== Fixtures (owner role; the activation gate is still off) =====
insert into public.barangays(id,name) values ('a6000000-0000-0000-0000-000000000001','Barangay Ampid I'),('a6000000-0000-0000-0000-000000000002','Phase 2 foreign tenant');
insert into public.barangay_localities values ('a6000000-0000-0000-0000-000000000001','Ampid 1','San Mateo','Rizal',false);
insert into public.document_types(id,barangay_id,name,fee_centavos) values
('d6000000-0000-0000-0000-000000000001','a6000000-0000-0000-0000-000000000001','Certificate of Indigency',5000),
('d6000000-0000-0000-0000-000000000002','a6000000-0000-0000-0000-000000000001','Barangay Clearance',5000);
select barangayan_private.configure_ampid_charter();
insert into auth.users(id,email,raw_user_meta_data) values
('b6000000-0000-0000-0000-000000000001','p146-resident@test.local','{}'),
('b6000000-0000-0000-0000-000000000002','p146-admin@test.local','{}'),
('b6000000-0000-0000-0000-000000000003','p146-foreign-admin@test.local','{}'),
('b6000000-0000-0000-0000-000000000004','p146-resident2@test.local','{}'),
('b6000000-0000-0000-0000-000000000005','p146-incomplete@test.local','{}'),
('b6000000-0000-0000-0000-000000000006','p146-deleted@test.local','{}'),
('b6000000-0000-0000-0000-000000000007','p146-late@test.local','{}');
insert into public.profiles(id,barangay_id,role,full_name) values
('b6000000-0000-0000-0000-000000000001','a6000000-0000-0000-0000-000000000001','resident','P146 Resident'),
('b6000000-0000-0000-0000-000000000002','a6000000-0000-0000-0000-000000000001','admin','P146 Admin'),
('b6000000-0000-0000-0000-000000000003','a6000000-0000-0000-0000-000000000002','admin','P146 Foreign Admin'),
('b6000000-0000-0000-0000-000000000004','a6000000-0000-0000-0000-000000000001','resident','P146 Resident Two'),
('b6000000-0000-0000-0000-000000000005','a6000000-0000-0000-0000-000000000001','resident','P146 Incomplete'),
('b6000000-0000-0000-0000-000000000006','a6000000-0000-0000-0000-000000000001','resident','P146 Deleted');
update public.profiles set first_name='Test',last_name='Resident',house_no='1',street='Fixture Street',
  sex='female',employment_status='student',mobile_number='09171234567',birth_date='2000-01-01',profile_completed_at=now()
  where id in ('b6000000-0000-0000-0000-000000000001','b6000000-0000-0000-0000-000000000004','b6000000-0000-0000-0000-000000000006');
update public.profiles set deleted_at=now() where id='b6000000-0000-0000-0000-000000000006';
insert into storage.objects(bucket_id,name,metadata)
select 'id-documents','b6000000-0000-0000-0000-000000000001/versions/c6000000-0000-0000-0000-00000000000'||n||'/id-'||side||'.png','{"size":1000,"mimetype":"image/png"}'
  from generate_series(1,3) n, (values ('front'),('back')) s(side);

create or replace function pg_temp.who(p uuid) returns text language sql as $$
  select set_config('request.jwt.claim.sub',coalesce(p::text,''),true)||set_config('request.jwt.claims',case when p is null then '{}' else json_build_object('sub',p,'role','authenticated')::text end,true)
$$;
create or replace function pg_temp.ev(p_res uuid, p_like text) returns integer language sql as $$
  select count(*)::int from barangayan_private.notification_events e where e.recipient_id=p_res and e.dedupe_key like p_like
$$;
create or replace function pg_temp.al(p_res uuid, p_like text) returns integer language sql as $$
  select count(*)::int from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id
    join barangayan_private.notification_events e on e.id=i.event_id where e.recipient_id=p_res and e.dedupe_key like p_like
$$;
create or replace function pg_temp.total(p_res uuid) returns integer language sql as $$
  select count(*)::int from barangayan_private.notification_events e where e.recipient_id=p_res
$$;
create or replace function pg_temp.field(p_res uuid, p_like text, p_col text) returns text language sql as $$
  select (to_jsonb(i)||jsonb_build_object('payload_version',e.payload_version))->>p_col from public.notification_inbox i
    join barangayan_private.notification_events e on e.id=i.event_id where e.recipient_id=p_res and e.dedupe_key like p_like order by e.created_at desc limit 1
$$;

-- ===== 1. Gate off: producers write nothing =====
select pg_temp.who('b6000000-0000-0000-0000-000000000001');
update public.profiles set first_name='GateOff' where id='b6000000-0000-0000-0000-000000000001';
update public.profiles set profile_completed_at=now() where id='b6000000-0000-0000-0000-000000000005';
select is(pg_temp.total('b6000000-0000-0000-0000-000000000001'),0,'A03 gate off: no event while emission is disabled');
select is(pg_temp.total('b6000000-0000-0000-0000-000000000005'),0,'A01 gate off: no event while emission is disabled');
update public.profiles set profile_completed_at=null where id='b6000000-0000-0000-0000-000000000005';
update barangayan_private.notification_hub_settings set emission_enabled=true;

-- ===== 2. Copy contract =====
select is((select count(*)::int from barangayan_private.account_event_copy('A01')),1,'Copy lookup returns one row per code');
select is((select count(*)::int from barangayan_private.account_event_copy('A99')),0,'Unknown codes have no copy');
select is((select count(*)::int from (values ('A01'),('A03'),('A05'),('A07'),('A08'),('A09'),('A10'),('A11'),('A12'),('A14'),('A15'),('A18'),('A19'),('A31'),('A32'),('A33'),('A37'),('A40'),
    ('A43'),('A44P'),('A44S'),('A44D'),('A44F'),('A45'),('A46'),('A50')) c(code)
    join lateral barangayan_private.account_event_copy(c.code) t on true
    where char_length(t.title) between 1 and 80 and char_length(t.body) between 1 and 200 and t.body !~ '[{}<>]'),26,'Every enabled code has bounded, markup-free text');
select is((select count(*)::int from barangayan_private.account_event_copy('A44S') where body ilike '%not been returned%'),1,'Refund in progress never says money was returned');

-- ===== 3. Profile (A01, A03, A14, A15, A12) =====
select pg_temp.who('b6000000-0000-0000-0000-000000000005');
update public.profiles set first_name='Late',last_name='Complete',profile_completed_at=now() where id='b6000000-0000-0000-0000-000000000005';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000005','account_ready:%'),1,'A01 first completion emits once');
select is(pg_temp.field('b6000000-0000-0000-0000-000000000005','account_ready:%','destination'),'{"v": 2, "kind": "account", "screen": "settings"}','A01 destination is the Settings screen');
select is(pg_temp.field('b6000000-0000-0000-0000-000000000005','account_ready:%','kind'),'account_profile','A01 is a Profile event');
select is(pg_temp.al('b6000000-0000-0000-0000-000000000005','account_ready:%'),0,'A01 is history only (no phone alert)');
update public.profiles set profile_completed_at=now()+interval '1 minute' where id='b6000000-0000-0000-0000-000000000005';
select is(pg_temp.total('b6000000-0000-0000-0000-000000000005'),1,'A01 a repeat save emits nothing more (and the first-completion save was not also a profile edit)');

select pg_temp.who('b6000000-0000-0000-0000-000000000001');
update public.profiles set first_name='Renamed' where id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','profile:%'),1,'A03 whitelisted self edit emits once');
select is(pg_temp.al('b6000000-0000-0000-0000-000000000001','profile:%'),0,'A03 self edit keeps history without an alert');
update public.profiles set first_name='Renamed', mobile_number='09171234567' where id='b6000000-0000-0000-0000-000000000001';
update public.profiles set theme_preference='dark', push_notifications_enabled=true, avatar_url='x.png' where id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','profile:%'),1,'A03 unchanged save and preference/avatar updates emit nothing');
select pg_temp.who('b6000000-0000-0000-0000-000000000002');
update public.profiles set mobile_number='09170000002' where id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','profile:%'),2,'A03 staff edit emits a distinct occurrence');
select is(pg_temp.al('b6000000-0000-0000-0000-000000000001','profile:%'),0,'A03 staff edit: no version-2 alert while v2 alerts are disabled');
update barangayan_private.notification_hub_settings set v2_alerts_enabled=true;
update public.profiles set street='Other Street' where id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','profile:%'),3,'A03 third occurrence stays distinct');
select is(pg_temp.al('b6000000-0000-0000-0000-000000000001','profile:%'),1,'A03 staff edit alerts once v2 alerts are enabled');
select is(pg_temp.field('b6000000-0000-0000-0000-000000000001','profile:%','body'),'Your resident details changed. Open your profile to review them.','A03 text is generic (no field names or values)');

select pg_temp.who('b6000000-0000-0000-0000-000000000001');
update public.profiles set email='first@example.test' where id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','email:%:changed:%'),1,'A15 email change emits once');
select is(pg_temp.al('b6000000-0000-0000-0000-000000000001','email:%:changed:%'),0,'A15 self change is history only');
update public.profiles set email=' FIRST@Example.test ' where id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','email:%:changed:%'),1,'A15 case or space only change emits nothing');
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','%first@example%'),0,'No event key carries the address');
select pg_temp.who(null);
update public.profiles set email_verification_status='verified',email_verified_at=now() where id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','email:%:verified:%'),1,'A14 verification emits once');
select is(pg_temp.al('b6000000-0000-0000-0000-000000000001','email:%:verified:%'),1,'A14 by the service role may alert');
select is(pg_temp.field('b6000000-0000-0000-0000-000000000001','email:%:verified:%','destination'),'{"v": 2, "kind": "account", "screen": "email_verification"}','A14 destination is Email Verification');
update public.profiles set email_verification_status='verified',email_verified_at=now() where id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','email:%:verified:%'),1,'A14 saving an already verified email emits nothing');

update public.profiles set id_repair_required=true where id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','id_repair:%'),1,'A12 flag false to true emits once');
update public.profiles set id_repair_required=true where id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','id_repair:%'),1,'A12 an unchanged flag emits nothing');
update public.profiles set id_repair_required=false where id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','id_repair:%'),1,'A12 clearing the flag emits nothing');

select pg_temp.who('b6000000-0000-0000-0000-000000000002');
update public.profiles set first_name='Ghost' where id='b6000000-0000-0000-0000-000000000006';
select is(pg_temp.total('b6000000-0000-0000-0000-000000000006'),0,'A deleted resident receives nothing');
update public.profiles set first_name='Wrong' where id='b6000000-0000-0000-0000-000000000003';
select is(pg_temp.total('b6000000-0000-0000-0000-000000000003'),0,'Staff accounts receive no resident events');

-- ===== 4. Household (A05) =====
select pg_temp.who('b6000000-0000-0000-0000-000000000004');
insert into public.household_members(profile_id,name,relation) values
  ('b6000000-0000-0000-0000-000000000004','Member One','child'),('b6000000-0000-0000-0000-000000000004','Member Two','spouse');
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000004','household:%'),1,'A05 several rows in one statement coalesce to one event');
select is(pg_temp.al('b6000000-0000-0000-0000-000000000004','household:%'),0,'A05 self edit is history only');
update public.household_members set name=name where profile_id='b6000000-0000-0000-0000-000000000004';
update public.household_members set is_checked_in=true,checked_in_at=now(),sort_order=3 where profile_id='b6000000-0000-0000-0000-000000000004';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000004','household:%'),1,'A05 unchanged values, check-in flags and ordering emit nothing');
update public.household_members set relation='sibling' where profile_id='b6000000-0000-0000-0000-000000000004' and name='Member One';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000004','household:%'),2,'A05 a changed detail is a new occurrence');
select pg_temp.who('b6000000-0000-0000-0000-000000000002');
delete from public.household_members where profile_id='b6000000-0000-0000-0000-000000000004' and name='Member Two';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000004','household:%'),3,'A05 removal by staff is another occurrence');
select is(pg_temp.al('b6000000-0000-0000-0000-000000000004','household:%'),1,'A05 staff removal may alert');
-- The path the app really uses: the household jsonb on the profile, synchronised by the database.
select pg_temp.who('b6000000-0000-0000-0000-000000000001');
update public.profiles set household_members='[{"name":"Json Member","relation":"child"}]'::jsonb where id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','household:%'),1,'A05 saving a new member through the profile jsonb emits once');
create temp table hh_json as select household_members as doc from public.profiles where id='b6000000-0000-0000-0000-000000000001';
update public.profiles set household_members=(select doc from hh_json) where id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','household:%'),1,'A05 saving the identical roster again emits nothing');
update public.profiles set household_members='[]'::jsonb where id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','household:%'),2,'A05 removing the member through the profile jsonb is one more occurrence');

-- ===== 5. Valid ID (A07, A08) through the real writers =====
set local role authenticated;
set local request.jwt.claim.sub = 'b6000000-0000-0000-0000-000000000001';
select public.publish_id_submission('{"submissionId":"c6000000-0000-0000-0000-000000000001","idType":"Passport","frontPath":"b6000000-0000-0000-0000-000000000001/versions/c6000000-0000-0000-0000-000000000001/id-front.png","backPath":"b6000000-0000-0000-0000-000000000001/versions/c6000000-0000-0000-0000-000000000001/id-back.png"}');
select public.publish_id_submission('{"submissionId":"c6000000-0000-0000-0000-000000000001","idType":"Passport","frontPath":"b6000000-0000-0000-0000-000000000001/versions/c6000000-0000-0000-0000-000000000001/id-front.png","backPath":"b6000000-0000-0000-0000-000000000001/versions/c6000000-0000-0000-0000-000000000001/id-back.png"}');
reset role;
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','id:c6000000-0000-0000-0000-000000000001:submitted'),1,'A07 first submission emits once, and an idempotent re-publish adds nothing');
select is(pg_temp.field('b6000000-0000-0000-0000-000000000001','id:c6000000-0000-0000-0000-000000000001:submitted','title'),'ID submitted for review','A07 uses the first-submission text');
select is(pg_temp.al('b6000000-0000-0000-0000-000000000001','id:c6000000-0000-0000-0000-000000000001:submitted'),0,'A07 is history only');
select is(pg_temp.field('b6000000-0000-0000-0000-000000000001','id:c6000000-0000-0000-0000-000000000001:submitted','destination'),'{"v": 2, "kind": "account", "screen": "valid_id"}','A07 destination is Valid ID');
set local role authenticated;
set local request.jwt.claim.sub = 'b6000000-0000-0000-0000-000000000002';
select public.review_id_submission('{"submissionId":"c6000000-0000-0000-0000-000000000001","decision":"verified"}');
reset role;
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','id:c6000000-0000-0000-0000-000000000001:verified'),1,'A08 verification emits once');
select is(pg_temp.al('b6000000-0000-0000-0000-000000000001','id:c6000000-0000-0000-0000-000000000001:verified'),1,'A08 staff review may alert');
select ok(pg_temp.field('b6000000-0000-0000-0000-000000000001','id:c6000000-0000-0000-0000-000000000001:verified','body') !~* 'reason','A08 text carries no review reason');

-- ===== 6. Document requests: submission, pause, fee, cancel, payment, refund =====
set local role authenticated;
set local request.jwt.claim.sub = 'b6000000-0000-0000-0000-000000000001';
select public.submit_service_request(jsonb_build_object('documentTypeId',d.id,'idempotencyKey','e6000000-0000-0000-0000-000000000001','purposeCode',d.purposes->0->>'code',
  'details','{"isRenter":false,"personalAppearanceAcknowledged":true}'::jsonb,'attachments','[]'::jsonb))
  from public.document_types d where d.barangay_id='a6000000-0000-0000-0000-000000000001' and d.name='Certificate of Indigency';
select public.submit_service_request(jsonb_build_object('documentTypeId',d.id,'idempotencyKey','e6000000-0000-0000-0000-000000000002','purposeCode',d.purposes->0->>'code',
  'details','{"isRenter":false,"personalAppearanceAcknowledged":true}'::jsonb,'attachments','[]'::jsonb))
  from public.document_types d where d.barangay_id='a6000000-0000-0000-0000-000000000001' and d.name='First Time Job Seeker';
reset role;
create temp table rq as select id,idempotency_key from public.service_requests where resident_id='b6000000-0000-0000-0000-000000000001';
grant select on rq to authenticated;
select is((select count(*)::int from rq),2,'Two requests were submitted through the real writer');
select is((select count(*)::int from rq where pg_temp.ev('b6000000-0000-0000-0000-000000000001','request:'||id||':submitted')=1),2,'A31 each submission emitted exactly once');
select is((select count(*)::int from rq where pg_temp.al('b6000000-0000-0000-0000-000000000001','request:'||id||':submitted')=0),2,'A31 self submission is history only');
select is((select i.destination->>'kind' from public.notification_inbox i join barangayan_private.notification_events e on e.id=i.event_id where e.dedupe_key='request:'||(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001')||':submitted'),'request','A31 keeps the version-1 request destination');
select is((select i.kind from public.notification_inbox i join barangayan_private.notification_events e on e.id=i.event_id where e.dedupe_key='request:'||(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001')||':submitted'),'request_status','A31 is a Document Requests event');

set local role authenticated;
set local request.jwt.claim.sub = 'b6000000-0000-0000-0000-000000000002';
select public.transition_service_request_sla(jsonb_build_object('requestId',id,'action','accept','requirementsComplete',true,'personalAppearanceReady',true)) from rq where idempotency_key='e6000000-0000-0000-0000-000000000001';
reset role;
select is((select pg_temp.ev('b6000000-0000-0000-0000-000000000001','request:'||id||':status:in_progress') from rq where idempotency_key='e6000000-0000-0000-0000-000000000001'),1,'A36 existing producer still emits once with the unchanged key');
select is((select pg_temp.al('b6000000-0000-0000-0000-000000000001','request:'||id||':status:in_progress') from rq where idempotency_key='e6000000-0000-0000-0000-000000000001'),1,'A36 alerts once');

set local role authenticated;
set local request.jwt.claim.sub = 'b6000000-0000-0000-0000-000000000002';
select public.transition_service_request_sla(jsonb_build_object('requestId',id,'action','pause','reason','Bring a printed copy')) from rq where idempotency_key='e6000000-0000-0000-0000-000000000001';
reset role;
select is((select count(*)::int from barangayan_private.notification_events where recipient_id='b6000000-0000-0000-0000-000000000001' and dedupe_key like 'request_pause:%:started'),1,'A32 pause start emits once');
select is((select count(*)::int from public.notification_inbox where body ilike '%printed copy%' or title ilike '%printed copy%'),0,'A32 never copies the pause reason into the notification');
select is((select pg_temp.al('b6000000-0000-0000-0000-000000000001','request_pause:%:started')),1,'A32 staff pause alerts');
set local role authenticated;
set local request.jwt.claim.sub = 'b6000000-0000-0000-0000-000000000002';
select public.transition_service_request_sla(jsonb_build_object('requestId',id,'action','resume')) from rq where idempotency_key='e6000000-0000-0000-0000-000000000001';
select public.transition_service_request_sla(jsonb_build_object('requestId',id,'action','pause','reason','Second wait')) from rq where idempotency_key='e6000000-0000-0000-0000-000000000001';
select public.transition_service_request_sla(jsonb_build_object('requestId',id,'action','resume')) from rq where idempotency_key='e6000000-0000-0000-0000-000000000001';
reset role;
select is((select count(*)::int from barangayan_private.notification_events where recipient_id='b6000000-0000-0000-0000-000000000001' and dedupe_key like 'request_pause:%:started'),2,'A32 a second pause is a distinct event');
select is((select count(*)::int from barangayan_private.notification_events where recipient_id='b6000000-0000-0000-0000-000000000001' and dedupe_key like 'request_pause:%:resumed'),2,'A37 each resume is its own event');
select is((select count(distinct dedupe_key)::int from barangayan_private.notification_events where recipient_id='b6000000-0000-0000-0000-000000000001' and dedupe_key like 'request_pause:%'),4,'A32/A37 keys are per pause occurrence');

-- A33: a revised assessed fee. Direct write under the assessment operation, as the real writers do.
select set_config('barangayan.foundation_operation','assessment',true);
select pg_temp.who('b6000000-0000-0000-0000-000000000002');
update public.service_requests set assessed_amount_centavos=assessed_amount_centavos+100 where id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001');
select is((select pg_temp.ev('b6000000-0000-0000-0000-000000000001','request:'||id||':fee:%') from rq where idempotency_key='e6000000-0000-0000-0000-000000000001'),1,'A33 a revised payable fee emits once');
update public.service_requests set assessed_amount_centavos=assessed_amount_centavos where id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001');
select is((select pg_temp.ev('b6000000-0000-0000-0000-000000000001','request:'||id||':fee:%') from rq where idempotency_key='e6000000-0000-0000-0000-000000000001'),1,'A33 an unchanged fee emits nothing');
update public.service_requests set assessed_amount_centavos=assessed_amount_centavos+100 where id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001');
select is((select pg_temp.ev('b6000000-0000-0000-0000-000000000001','request:'||id||':fee:%') from rq where idempotency_key='e6000000-0000-0000-0000-000000000001'),2,'A33 a further revision is a new occurrence');
select set_config('barangayan.foundation_operation','',true);

-- Repeated genuine transition (R07): back to submitted then in progress again.
select set_config('barangayan.foundation_operation','sla',true);
update public.service_requests set status='submitted' where id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001');
update public.service_requests set status='in_progress' where id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001');
select set_config('barangayan.foundation_operation','',true);
select is((select pg_temp.ev('b6000000-0000-0000-0000-000000000001','request:'||id||':status:in_progress%') from rq where idempotency_key='e6000000-0000-0000-0000-000000000001'),2,'R07 a genuinely repeated status is a distinct occurrence');
select is((select pg_temp.al('b6000000-0000-0000-0000-000000000001','request:'||id||':status:in_progress%') from rq where idempotency_key='e6000000-0000-0000-0000-000000000001'),2,'R07 each occurrence has exactly one alert path');
select is((select count(*)::int from barangayan_private.notification_events where recipient_id='b6000000-0000-0000-0000-000000000001' and dedupe_key='request:'||(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001')||':status:in_progress'),1,'The first occurrence keeps the original key (existing event ids unchanged)');

-- A45: staff edit of record fields steps aside when the transaction already produced a specific event,
-- and stands alone otherwise.
select pg_temp.who('b6000000-0000-0000-0000-000000000002');
select set_config('barangayan.foundation_operation','admin_record_correction',true);
set constraints all immediate;
update public.service_requests set requester_notes='Updated by staff' where id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000002');
select is((select pg_temp.ev('b6000000-0000-0000-0000-000000000001','request:'||id||':details:%') from rq where idempotency_key='e6000000-0000-0000-0000-000000000002'),1,'A45 a staff edit of resident-facing fields emits once');
update public.service_requests set requester_notes='Updated by staff' where id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000002');
select is((select pg_temp.ev('b6000000-0000-0000-0000-000000000001','request:'||id||':details:%') from rq where idempotency_key='e6000000-0000-0000-0000-000000000002'),1,'A45 saving the same value emits nothing');
update public.service_requests set requester_notes='Edited with a status change' where id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001');
select is((select pg_temp.ev('b6000000-0000-0000-0000-000000000001','request:'||id||':details:%') from rq where idempotency_key='e6000000-0000-0000-0000-000000000001'),0,'A45 coalesces into the specific status, payment or fee event of the same transaction');
select pg_temp.who('b6000000-0000-0000-0000-000000000001');
update public.service_requests set requester_notes='Mine' where id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000002');
select is((select pg_temp.ev('b6000000-0000-0000-0000-000000000001','request:'||id||':details:%') from rq where idempotency_key='e6000000-0000-0000-0000-000000000002'),1,'A45 the resident editing their own record emits nothing');
select set_config('barangayan.foundation_operation','',true);

-- A40: the resident cancels their own request (history only); staff cancellation keeps the alerting producer.
set local role authenticated;
set local request.jwt.claim.sub = 'b6000000-0000-0000-0000-000000000001';
select public.transition_service_request_sla(jsonb_build_object('requestId',id,'action','cancel','reason','No longer needed')) from rq where idempotency_key='e6000000-0000-0000-0000-000000000002';
reset role;
select is((select pg_temp.ev('b6000000-0000-0000-0000-000000000001','request:'||id||':status:cancelled:self') from rq where idempotency_key='e6000000-0000-0000-0000-000000000002'),1,'A40 the resident cancelling keeps one history event');
select is((select pg_temp.al('b6000000-0000-0000-0000-000000000001','request:'||id||':status:cancelled%') from rq where idempotency_key='e6000000-0000-0000-0000-000000000002'),0,'A40 own cancellation does not alert');
select is((select i.title from public.notification_inbox i join barangayan_private.notification_events e on e.id=i.event_id where e.dedupe_key='request:'||(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000002')||':status:cancelled:self'),'Document request cancelled','A40 uses the catalog text');

-- A43/A44: payment attempt and refund stages (provider-style writes carry no resident session).
select pg_temp.who(null);
insert into public.payments(service_request_id,barangay_id,method,amount_centavos,document_fee_centavos,status)
  select r.id,s.barangay_id,'qrph',s.assessed_amount_centavos,s.assessed_amount_centavos,'pending' from rq r join public.service_requests s on s.id=r.id where r.idempotency_key='e6000000-0000-0000-0000-000000000001';
update public.payments set status='expired' where service_request_id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001');
select is((select count(*)::int from barangayan_private.notification_events where recipient_id='b6000000-0000-0000-0000-000000000001' and dedupe_key like 'payment:%:expired'),1,'A43 an expired attempt emits once');
update public.payments set status='expired' where service_request_id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001');
select is((select count(*)::int from barangayan_private.notification_events where recipient_id='b6000000-0000-0000-0000-000000000001' and dedupe_key like 'payment:%:expired'),1,'A43 repeating the same state emits nothing');
insert into public.payments(service_request_id,barangay_id,method,amount_centavos,document_fee_centavos,status)
  select r.id,s.barangay_id,'qrph',s.assessed_amount_centavos,s.assessed_amount_centavos,'pending' from rq r join public.service_requests s on s.id=r.id where r.idempotency_key='e6000000-0000-0000-0000-000000000001';
update public.payments set status='paid',paid_at=now() where service_request_id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001') and status='pending';
select is((select pg_temp.ev('b6000000-0000-0000-0000-000000000001','request:'||id||':payment:paid') from rq where idempotency_key='e6000000-0000-0000-0000-000000000001'),1,'A34 a provider settlement (no resident session) uses the existing producer once');
update public.payments set refund_status='pending' where status='paid' and service_request_id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001');
update public.payments set refund_status='processing' where status='paid' and service_request_id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001');
update public.payments set refund_status='refunding' where status='paid' and service_request_id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001');
select is((select count(*)::int from barangayan_private.notification_events where recipient_id='b6000000-0000-0000-0000-000000000001' and dedupe_key like 'refund:%'),2,'A44 pending and in-progress are separate stages; processing and refunding are one stage');
select is((select count(*)::int from public.notification_inbox where body like '%returned%' and body not like '%not been returned%'),0,'A44 no stage before confirmation claims the money was returned');
update public.payments set refund_status='failed' where status='paid' and service_request_id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001');
update public.payments set refund_status='pending' where status='paid' and service_request_id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001');
update public.payments set refund_status='refunded' where status='paid' and service_request_id=(select id from rq where idempotency_key='e6000000-0000-0000-0000-000000000001');
select is((select count(*)::int from barangayan_private.notification_events where recipient_id='b6000000-0000-0000-0000-000000000001' and dedupe_key like 'refund:%'),5,'A44 a refund retried after failure is a new pending occurrence, then the confirmed stage');
select is((select count(*)::int from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id join barangayan_private.notification_events e on e.id=i.event_id where e.dedupe_key like 'refund:%'),5,'A44 every refund stage has one alert path');

-- ===== 7. Incident reports =====
insert into public.incident_categories(id,barangay_id,name) values ('e6000000-0000-0000-0000-0000000000c1','a6000000-0000-0000-0000-000000000001','P146 Category');
select pg_temp.who('b6000000-0000-0000-0000-000000000001');
insert into public.incidents(id,barangay_id,reporter_id,category_id,title,location,status) values
  ('e6000000-0000-0000-0000-0000000000a1','a6000000-0000-0000-0000-000000000001','b6000000-0000-0000-0000-000000000001','e6000000-0000-0000-0000-0000000000c1','P146 one','{"lat":14.6,"lng":121.1}','open'),
  ('e6000000-0000-0000-0000-0000000000a2','a6000000-0000-0000-0000-000000000001','b6000000-0000-0000-0000-000000000001','e6000000-0000-0000-0000-0000000000c1','P146 two','{"lat":14.6,"lng":121.1}','open');
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','incident:%:submitted'),2,'A46 each committed report emits once');
select is(pg_temp.al('b6000000-0000-0000-0000-000000000001','incident:%:submitted'),0,'A46 own submission is history only');
set local role authenticated;
select public.withdraw_incident('e6000000-0000-0000-0000-0000000000a1');
reset role;
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','incident:e6000000-0000-0000-0000-0000000000a1:withdrawn%'),1,'A50 the reporter withdrawing emits once');
select is(pg_temp.al('b6000000-0000-0000-0000-000000000001','incident:e6000000-0000-0000-0000-0000000000a1:withdrawn%'),0,'A50 own withdrawal is history only');
select pg_temp.who('b6000000-0000-0000-0000-000000000002');
update public.incidents set status='withdrawn' where id='e6000000-0000-0000-0000-0000000000a2';
select is(pg_temp.al('b6000000-0000-0000-0000-000000000001','incident:e6000000-0000-0000-0000-0000000000a2:withdrawn%'),1,'A50 withdrawal by staff may alert');
update public.incidents set status='in_progress' where id='e6000000-0000-0000-0000-0000000000a2';
update public.incidents set status='open' where id='e6000000-0000-0000-0000-0000000000a2';
update public.incidents set status='in_progress' where id='e6000000-0000-0000-0000-0000000000a2';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','incident:e6000000-0000-0000-0000-0000000000a2:status:in_progress%'),2,'R07 a repeated incident status is a distinct occurrence');
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','incident:e6000000-0000-0000-0000-0000000000a2:status:in_progress'),1,'The first incident occurrence keeps the original key');

-- ===== 8. Password (A18, A19/A20) =====
select pg_temp.who(null);
update barangayan_private.resident_account_lifecycle set password_set=false where user_id='b6000000-0000-0000-0000-000000000001';
update barangayan_private.resident_account_lifecycle set password_set=true,password_evidence='auth_password_write',password_observed_at=clock_timestamp() where user_id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','password:%'),1,'A18 a first password emits once');
select is((select count(*)::int from public.notification_inbox i join barangayan_private.notification_events e on e.id=i.event_id where e.dedupe_key like 'password:%' and i.title='Password added'),1,'A18 uses the first-password text');
update barangayan_private.resident_account_lifecycle set password_observed_at=clock_timestamp() where user_id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','password:%'),2,'A19/A20 a later password write is one distinct generic event');
select is((select count(*)::int from public.notification_inbox i join barangayan_private.notification_events e on e.id=i.event_id where e.dedupe_key like 'password:%' and i.title='Password updated'),1,'D16 intent is unknown, so a later write gets the generic wording');
update barangayan_private.resident_account_lifecycle set password_evidence='auth_password_write' where user_id='b6000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','password:%'),2,'Another lifecycle update without a password write emits nothing');
select is(pg_temp.al('b6000000-0000-0000-0000-000000000001','password:%'),2,'Password events alert (no resident session) once v2 alerts are enabled');
select is((select count(*)::int from barangayan_private.notification_events e join public.notification_inbox i on i.event_id=e.id where e.dedupe_key like 'password:%' and (i.body ~* '(secret|hash)' or e.dedupe_key ~* '(secret|hash)')),0,'No credential material in the text or key');

-- ===== 9. Reads and preferences create no events =====
select pg_temp.who('b6000000-0000-0000-0000-000000000001');
create temp table before_counts as select (select count(*) from barangayan_private.notification_events) as ev, (select count(*) from barangayan_private.notification_outbox) as ob;
set local role authenticated;
select public.notification_mark_scope_read('account','all');
select public.set_notification_preferences(false,'{"request_status":false}'::jsonb);
select public.set_notification_preferences(true,'{"request_status":true}'::jsonb);
reset role;
select is((select count(*) from barangayan_private.notification_events),(select ev from before_counts),'Reads and preference changes create no events');
select is((select count(*) from barangayan_private.notification_outbox),(select ob from before_counts),'Reads and preference changes create no outbox rows');

-- ===== 10. Replacement, failure and revocation of ID evidence (A09, A10, A11) =====
-- One pending or verified version per hour (0150): age the verified version so the replacement is allowed.
set local session_replication_role = replica;
update public.id_submissions set submitted_at = submitted_at - interval '61 minutes' where resident_id = 'b6000000-0000-0000-0000-000000000001';
set local session_replication_role = origin;
set local role authenticated;
set local request.jwt.claim.sub = 'b6000000-0000-0000-0000-000000000001';
select public.publish_id_submission('{"submissionId":"c6000000-0000-0000-0000-000000000002","idType":"Passport","frontPath":"b6000000-0000-0000-0000-000000000001/versions/c6000000-0000-0000-0000-000000000002/id-front.png","backPath":"b6000000-0000-0000-0000-000000000001/versions/c6000000-0000-0000-0000-000000000002/id-back.png"}');
set local request.jwt.claim.sub = 'b6000000-0000-0000-0000-000000000002';
select public.review_id_submission('{"submissionId":"c6000000-0000-0000-0000-000000000002","decision":"verification_failed","reason":"Photo is blurry"}');
reset role;
select is(pg_temp.field('b6000000-0000-0000-0000-000000000001','id:c6000000-0000-0000-0000-000000000002:submitted','title'),'Replacement ID submitted','A11 a submission after verified evidence uses the replacement text');
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','id:c6000000-0000-0000-0000-000000000002:verification_failed'),1,'A09 a failed review emits once');
select is((select count(*)::int from public.notification_inbox where body ilike '%blurry%' or title ilike '%blurry%'),0,'A09 never copies the review reason');
set local role authenticated;
set local request.jwt.claim.sub = 'b6000000-0000-0000-0000-000000000001';
select public.publish_id_submission('{"submissionId":"c6000000-0000-0000-0000-000000000003","idType":"Passport","frontPath":"b6000000-0000-0000-0000-000000000001/versions/c6000000-0000-0000-0000-000000000003/id-front.png","backPath":"b6000000-0000-0000-0000-000000000001/versions/c6000000-0000-0000-0000-000000000003/id-back.png"}');
set local request.jwt.claim.sub = 'b6000000-0000-0000-0000-000000000002';
select public.review_id_submission('{"submissionId":"c6000000-0000-0000-0000-000000000003","decision":"verified"}');
select public.review_id_submission('{"submissionId":"c6000000-0000-0000-0000-000000000003","decision":"revoked","reason":"Document expired"}');
reset role;
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','id:c6000000-0000-0000-0000-000000000003:revoked'),1,'A10 revocation emits once, bound to its own evidence version');
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000001','id:c6000000-0000-0000-0000-00000000000_:%'),7,'Each evidence version produced one event per transition (submitted, verified, failed, submitted, verified, revoked and the replacement submission)');

-- ===== 11. Reconciliation of source-keyed events =====
delete from barangayan_private.notification_events where recipient_id='b6000000-0000-0000-0000-000000000001'
  and dedupe_key in ('id:c6000000-0000-0000-0000-000000000001:submitted','id:c6000000-0000-0000-0000-000000000003:revoked','incident:e6000000-0000-0000-0000-0000000000a1:submitted');
select is(public.notification_reconcile_account_events(null,2),2,'Reconcile repairs at most the requested number per call');
select is(public.notification_reconcile_account_events(null,100),1,'Reconcile finishes the remainder');
select is(public.notification_reconcile_account_events(null,100),0,'Reconcile ends when nothing is missing');
select is(pg_temp.al('b6000000-0000-0000-0000-000000000001','id:c6000000-0000-0000-0000-000000000003:revoked'),0,'Repaired events are history only (no stale alert)');
select is(pg_temp.field('b6000000-0000-0000-0000-000000000001','id:c6000000-0000-0000-0000-000000000001:submitted','title'),'ID submitted for review','A repaired first submission keeps the first-submission text');
-- A12 activation reconciliation: flagged under a disabled gate, then activated.
update barangayan_private.notification_hub_settings set emission_enabled=false;
update public.profiles set id_repair_required=true where id='b6000000-0000-0000-0000-000000000004';
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000004','id_repair:%'),0,'A12 a flag set while the gate is off emits nothing');
update barangayan_private.notification_hub_settings set emission_enabled=true;
select is(public.notification_reconcile_account_events(null,100),1,'A12 activation reconciliation covers a currently flagged resident');
select is(public.notification_reconcile_account_events(null,100),0,'A12 reconciliation is idempotent');
select is(pg_temp.ev('b6000000-0000-0000-0000-000000000004','id_repair:b6000000-0000-0000-0000-000000000004:none'),1,'A12 key carries the resident and the evidence version');
update public.profiles set id_repair_required=false where id='b6000000-0000-0000-0000-000000000004';

-- ===== 12. System notices: delivery, catch-up for later residents, bounds =====
select ok(has_function_privilege('service_role','public.notification_reconcile_account_events(timestamptz,integer)','execute'),'service_role runs the reconciliation');
select ok(not has_function_privilege('authenticated','public.notification_reconcile_account_events(timestamptz,integer)','execute') and not has_function_privilege('anon','public.notification_reconcile_account_events(timestamptz,integer)','execute'),'Residents and guests cannot run it');
select ok(not has_function_privilege('authenticated','barangayan_private.account_notify(text,uuid,text,text,uuid,jsonb,boolean)','execute'),'Residents cannot emit account events directly');
select ok(not has_function_privilege('service_role','barangayan_private.account_notify(text,uuid,text,text,uuid,jsonb,boolean)','execute'),'The API service role cannot emit account events directly');
create temp table notice as select public.system_notice_create('service_status','a6000000-0000-0000-0000-000000000001','Scheduled maintenance','Barangayan will be unavailable tonight.','b6000000-0000-0000-0000-000000000002',null,null,null,null,null,null,null,true) as id;
select public.system_notice_publish(id) from notice;
select is((select delivered from public.notification_publish_due_notices(100)),(select count(*)::int from public.profiles where role='resident' and deleted_at is null and barangay_id='a6000000-0000-0000-0000-000000000001'),'Due run fans a published notice out to every eligible resident of its audience');
select is((select count(*)::int from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id where i.destination->>'kind'='notice'),(select count(*)::int from public.profiles where role='resident' and deleted_at is null and barangay_id='a6000000-0000-0000-0000-000000000001'),'Each fan-out entry has one alert path');
-- A resident registers after the fan-out.
insert into public.profiles(id,barangay_id,role,full_name) values ('b6000000-0000-0000-0000-000000000007','a6000000-0000-0000-0000-000000000001','resident','P146 Late');
select is((select delivered from public.notification_publish_due_notices(100)),1,'Catch-up delivers the active notice to a resident who registered later');
select is((select count(*)::int from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id where i.recipient_id='b6000000-0000-0000-0000-000000000007'),0,'Catch-up is history only: old alerts are not replayed');
select is((select count(*)::int from public.notification_inbox where recipient_id='b6000000-0000-0000-0000-000000000007' and destination->>'kind'='notice'),1,'The late resident can read the notice in the System section');
select is((select delivered from public.notification_publish_due_notices(100)),0,'Catch-up ends: the next run delivers nothing');
select is((select delivered from public.notification_publish_due_notices(100)),0,'A repeat run is still idle');
select is((select count(*)::int from barangayan_private.notification_events where subject_type='notice' and subject_id=(select id from notice)),(select count(*)::int from public.profiles where role='resident' and deleted_at is null and barangay_id='a6000000-0000-0000-0000-000000000001'),'One event per eligible resident, none duplicated');
-- Bound: p_limit caps one invocation.
insert into auth.users(id,email,raw_user_meta_data)
  select ('b6000000-0000-0000-0000-0000000001'||lpad(n::text,2,'0'))::uuid,'p146-bulk-'||n||'@test.local','{}' from generate_series(1,5) n;
insert into public.profiles(id,barangay_id,role,full_name)
  select ('b6000000-0000-0000-0000-0000000001'||lpad(n::text,2,'0'))::uuid,'a6000000-0000-0000-0000-000000000001','resident','P146 Bulk '||n from generate_series(1,5) n;
select is((select delivered from public.notification_publish_due_notices(2)),2,'One invocation delivers at most the requested number');
select is((select delivered from public.notification_publish_due_notices(100)),3,'The remainder follows on the next invocation');

select * from finish();
rollback;
