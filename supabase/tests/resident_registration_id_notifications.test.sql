-- Resident registration proof of residency, Phase 5: a resident who registers by email/OTP submits the ID
-- during account setup, and the staff decision reaches the same notification path as any Valid ID decision
-- (0146: A07 history only, A08 / A09 alert). Driven through the real writers: complete_resident_profile,
-- the setup status RPC, publish_id_submission and review_id_submission. One transaction, rolled back.
begin;
select no_plan();

update public.barangay_localities set resident_registration_enabled=false;
insert into public.barangays(id,name) values ('a6500000-0000-0000-0000-000000000001','Barangay Ampid I');
insert into public.barangay_localities values ('a6500000-0000-0000-0000-000000000001','Ampid 1','San Mateo','Rizal',true);
select barangayan_private.configure_ampid_charter();
insert into auth.users(id,email,encrypted_password,raw_user_meta_data,raw_app_meta_data) values
('b6500000-0000-0000-0000-000000000001','reg-verified@test.local','generated-hash','{"resident_registration_origin":"email_otp"}','{}'),
('b6500000-0000-0000-0000-000000000002','reg-rejected@test.local','generated-hash','{"resident_registration_origin":"email_otp"}','{}'),
('b6500000-0000-0000-0000-000000000003','reg-admin@test.local',null,'{}','{}'),
('b6500000-0000-0000-0000-000000000004','reg-google@test.local',null,'{}','{"provider":"google"}');
insert into public.profiles(id,barangay_id,role,full_name) values
('b6500000-0000-0000-0000-000000000003','a6500000-0000-0000-0000-000000000001','admin','Registration Admin');
insert into storage.objects(bucket_id,name,metadata) values
('id-documents','b6500000-0000-0000-0000-000000000001/versions/c6500000-0000-0000-0000-000000000001/id-front.png','{"size":1000,"mimetype":"image/png"}'),
('id-documents','b6500000-0000-0000-0000-000000000002/versions/c6500000-0000-0000-0000-000000000002/id-front.png','{"size":1000,"mimetype":"image/png"}');

create function pg_temp.ev(p_res uuid, p_key text) returns integer language sql as $$
  select count(*)::int from barangayan_private.notification_events e where e.recipient_id=p_res and e.dedupe_key=p_key
$$;
create function pg_temp.al(p_res uuid, p_key text) returns integer language sql as $$
  select count(*)::int from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id
    join barangayan_private.notification_events e on e.id=i.event_id where e.recipient_id=p_res and e.dedupe_key=p_key
$$;
create function pg_temp.field(p_res uuid, p_key text, p_col text) returns text language sql as $$
  select to_jsonb(i)->>p_col from public.notification_inbox i
    join barangayan_private.notification_events e on e.id=i.event_id where e.recipient_id=p_res and e.dedupe_key=p_key
$$;
create function pg_temp.profile(p_mobile text) returns jsonb language sql as $$
  select jsonb_build_object('firstName','Reg','lastName','Resident','houseNo','1','street','Fixture Street','sex','female',
    'employmentStatus','student','mobileNumber',p_mobile,'birthDate','2000-01-01')
$$;

update barangayan_private.notification_hub_settings set emission_enabled=true, v2_alerts_enabled=true;

-- ===== Registration: details first, then the ID step is required, then the ID is submitted =====
set local role authenticated;
set local request.jwt.claim.sub = 'b6500000-0000-0000-0000-000000000001';
select lives_ok($$select public.complete_resident_profile(pg_temp.profile('09171234567'))$$,'Details complete the profile, which makes the resident a notification recipient');
select is((public.get_resident_account_setup_status()->>'idSubmitted')::boolean,false,'Setup status reports no ID before the ID step');
select is(public.get_resident_account_setup_status()->>'registrationOrigin','email_otp','Setup status reports the email/OTP origin');
select lives_ok($$select public.publish_id_submission('{"submissionId":"c6500000-0000-0000-0000-000000000001","idType":"Passport","frontPath":"b6500000-0000-0000-0000-000000000001/versions/c6500000-0000-0000-0000-000000000001/id-front.png","confirmedDetails":{"fullName":"Reg Resident","idNumber":"","birthDate":"","address":""}}')$$,'The registration ID step publishes the evidence');
select is((public.get_resident_account_setup_status()->>'idSubmitted')::boolean,true,'Setup status reports the ID once submitted');
select is((select id_verification_status from public.profiles where id=auth.uid()),'pending','The registered resident is pending review');
reset role;
select is(pg_temp.ev('b6500000-0000-0000-0000-000000000001','id:c6500000-0000-0000-0000-000000000001:submitted'),1,'A07 is written for the registration submission');
select is(pg_temp.field('b6500000-0000-0000-0000-000000000001','id:c6500000-0000-0000-0000-000000000001:submitted','title'),'ID submitted for review','A07 is the first-submission text, not the replacement text');
select is(pg_temp.al('b6500000-0000-0000-0000-000000000001','id:c6500000-0000-0000-0000-000000000001:submitted'),0,'A07 is history only: no push for the resident''s own submission');

-- ===== Staff approve: A08 alerts the registered resident =====
set local role authenticated;
set local request.jwt.claim.sub = 'b6500000-0000-0000-0000-000000000003';
select lives_ok($$select public.review_id_submission('{"submissionId":"c6500000-0000-0000-0000-000000000001","decision":"verified"}')$$,'Staff approve the registration ID');
reset role;
select is(pg_temp.ev('b6500000-0000-0000-0000-000000000001','id:c6500000-0000-0000-0000-000000000001:verified'),1,'A08 is written once for the approval');
select is(pg_temp.al('b6500000-0000-0000-0000-000000000001','id:c6500000-0000-0000-0000-000000000001:verified'),1,'A08 queues one push');
select is(pg_temp.field('b6500000-0000-0000-0000-000000000001','id:c6500000-0000-0000-0000-000000000001:verified','destination'),'{"v": 2, "kind": "account", "screen": "valid_id"}','A08 opens Valid ID');

-- ===== Staff reject: A09 alerts and never carries the reason =====
set local role authenticated;
set local request.jwt.claim.sub = 'b6500000-0000-0000-0000-000000000002';
select lives_ok($$select public.complete_resident_profile(pg_temp.profile('09171234568'))$$,'A second registrant completes the details');
select lives_ok($$select public.publish_id_submission('{"submissionId":"c6500000-0000-0000-0000-000000000002","idType":"Passport","frontPath":"b6500000-0000-0000-0000-000000000002/versions/c6500000-0000-0000-0000-000000000002/id-front.png","confirmedDetails":{"fullName":"Reg Resident","idNumber":"","birthDate":"","address":""}}')$$,'The second registrant submits the ID');
set local request.jwt.claim.sub = 'b6500000-0000-0000-0000-000000000003';
select lives_ok($$select public.review_id_submission('{"submissionId":"c6500000-0000-0000-0000-000000000002","decision":"verification_failed","reason":"Photo is blurry"}')$$,'Staff reject the registration ID');
reset role;
select is(pg_temp.ev('b6500000-0000-0000-0000-000000000002','id:c6500000-0000-0000-0000-000000000002:verification_failed'),1,'A09 is written once for the rejection');
select is(pg_temp.al('b6500000-0000-0000-0000-000000000002','id:c6500000-0000-0000-0000-000000000002:verification_failed'),1,'A09 queues one push');
select is((select count(*)::int from public.notification_inbox where body ilike '%blurry%' or title ilike '%blurry%'),0,'A09 never copies the review reason');

-- ===== Google registrants keep their origin, which the client uses to skip the ID step =====
select is((select registration_origin from barangayan_private.resident_account_lifecycle where user_id='b6500000-0000-0000-0000-000000000004'),'google','The Google registrant keeps the Google origin');

select * from finish();
rollback;
