\set ON_ERROR_STOP on
\set B '5e0d0000-0000-4000-8000-000000000001'
\set A '5e0d0000-0000-4000-8000-0000000000a1'
\set AD '5e0d0000-0000-4000-8000-0000000000ad'
update barangayan_private.notification_hub_settings set emission_enabled=true, v2_alerts_enabled=true;
insert into auth.users(id,email,raw_user_meta_data) values (:'AD','p6-admin@test.local','{}') on conflict do nothing;
insert into public.profiles(id,barangay_id,role,full_name) values (:'AD',:'B','admin','P6 Admin') on conflict do nothing;
-- Barangay announcements: 3 tied timestamps, long title/body, all four categories
insert into public.announcements(id,barangay_id,title,body,category,published_at)
select gen_random_uuid(), :'B',
  case when g=1 then 'A very long announcement title that keeps going to test wrapping at large font sizes and narrow widths on small phones' else 'P6 announcement '||g end,
  case when g=1 then repeat('Long body sentence for the preview line. ',12) else 'Body of announcement '||g end,
  (array['general','emergency','health','events'])[1+g%4],
  case when g<=3 then date_trunc('hour',now()) else now()-make_interval(hours=>g) end
from generate_series(1,80) g;
update public.announcements set detailed_description = repeat('Detailed description paragraph with enough text to scroll the details view. ',30) where title like 'P6 announcement 5' ;
-- Account: staff profile edit and an incident lifecycle (real producers)
insert into public.incident_categories(id,barangay_id,name) values ('5e0d0000-0000-4000-8000-0000000000c1',:'B','P6 Category') on conflict do nothing;
insert into public.incidents(id,barangay_id,reporter_id,category_id,title,location,status)
values ('5e0d0000-0000-4000-8000-0000000000d1',:'B',:'A','5e0d0000-0000-4000-8000-0000000000c1','P6 street light out','{"lat":14.6,"lng":121.1}','open');
begin; select set_config('request.jwt.claim.sub',:'AD',true), set_config('request.jwt.claims',format('{"sub":"%s","role":"authenticated"}',:'AD'),true);
update public.profiles set mobile_number='09170000011' where id=:'A';
update public.incidents set status='in_progress' where id='5e0d0000-0000-4000-8000-0000000000d1';
commit;
-- Account: long history through the private emitter (history only, no alert)
select barangayan_private.emit_notification_v2(array[:'A'::uuid],:'B',
  (array['account_security','account_verification','account_profile'])[1+g%3],'account',gen_random_uuid(),'p6-hist-'||g,
  case when g=1 then 'Long Account title that wraps on narrow screens at large font' else 'Account update '||g end,
  'Something about your account changed. Open to review the details.', '{"v":2,"kind":"account","screen":"settings"}', false)
from generate_series(1,40) g;
-- System: three operator notices
set role service_role;
select public.system_notice_create('service_status',:'B','Scheduled maintenance','Barangayan will be unavailable tonight from 11 PM to 1 AM.',:'AD',null,null,null,null,null,null,null,true);
select public.system_notice_create('app_update',:'B','Update available','A new version of the Barangayan app is available.',:'AD',null,null,null,null,null,null,2,true);
select public.system_notice_create('policy',:'B','Privacy policy updated','We updated how we handle your information.',:'AD',null,null,null,'terms_privacy','privacy_policy',current_date,null,true);
select public.system_notice_publish(id) from public.system_notices where state='draft';
select public.notification_publish_due_notices(100);
reset role;
select 'announcements',count(*) from public.announcements where barangay_id=:'B'
union all select 'inbox',count(*) from public.notification_inbox where recipient_id=:'A'
union all select 'inbox_unread',count(*) from public.notification_inbox where recipient_id=:'A' and read_at is null;
