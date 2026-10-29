-- Resident Android notifications and announcements, Phase 1: contracts of migration 0145 — activation
-- gate, version-2 destinations, history-only emission, hub summary/pages/bulk read, the announcement
-- read bridge, read reconciliation with targeted restore, and the service_role System notice
-- lifecycle. Everything, fixtures included, runs in one transaction that is rolled back.
-- Cross-session snapshot/serialization cases live in notification_hub_concurrency.mjs.
begin;
select plan(162);

-- ===== Fixtures (owner role) =====
insert into public.barangays (id, name) values
  ('a1450000-0000-0000-0000-000000000001', 'P145 Barangay A'),
  ('a1450000-0000-0000-0000-000000000002', 'P145 Barangay B');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()
  from (values
    ('b1450000-0000-0000-0000-00000000000a'::uuid, 'p145-a@test.local'),
    ('b1450000-0000-0000-0000-0000000000a2'::uuid, 'p145-a2@test.local'),
    ('b1450000-0000-0000-0000-00000000000b'::uuid, 'p145-b@test.local'),
    ('b1450000-0000-0000-0000-00000000000c'::uuid, 'p145-admin-a@test.local'),
    ('b1450000-0000-0000-0000-0000000000bc'::uuid, 'p145-admin-b@test.local'),
    ('b1450000-0000-0000-0000-00000000000d'::uuid, 'p145-deleted@test.local')) u(id, email);

insert into public.profiles (id, barangay_id, role, full_name) values
  ('b1450000-0000-0000-0000-00000000000a', 'a1450000-0000-0000-0000-000000000001', 'resident', 'P145 Resident A'),
  ('b1450000-0000-0000-0000-0000000000a2', 'a1450000-0000-0000-0000-000000000001', 'resident', 'P145 Resident A2'),
  ('b1450000-0000-0000-0000-00000000000b', 'a1450000-0000-0000-0000-000000000002', 'resident', 'P145 Resident B'),
  ('b1450000-0000-0000-0000-00000000000c', 'a1450000-0000-0000-0000-000000000001', 'admin', 'P145 Admin A'),
  ('b1450000-0000-0000-0000-0000000000bc', 'a1450000-0000-0000-0000-000000000002', 'admin', 'P145 Admin B'),
  ('b1450000-0000-0000-0000-00000000000d', 'a1450000-0000-0000-0000-000000000001', 'resident', 'P145 Deleted Resident');
update public.profiles set first_name='Test',last_name='Resident',house_no='1',street='Fixture Street',
  sex='female',employment_status='student',mobile_number='09171234567',birth_date='2000-01-01'
  where id::text like 'b1450000-%' and role='resident';
update public.profiles set deleted_at = now() where id = 'b1450000-0000-0000-0000-00000000000d';

-- Business rows whose state reads must never change (R06).
insert into public.document_types (id, barangay_id, name, fee_centavos, processing_target_hours, is_active) values
  ('c1450000-0000-0000-0000-000000000001', 'a1450000-0000-0000-0000-000000000001', 'P145 Doc A', 1000, 24, true);
insert into public.service_requests (id, barangay_id, resident_id, document_type_id) values
  ('d1450000-0000-0000-0000-000000000001', 'a1450000-0000-0000-0000-000000000001', 'b1450000-0000-0000-0000-00000000000a', 'c1450000-0000-0000-0000-000000000001');
insert into public.incident_categories (id, barangay_id, name) values
  ('e1450000-0000-0000-0000-0000000000a1', 'a1450000-0000-0000-0000-000000000001', 'P145 Category A');
insert into public.incidents (id, barangay_id, reporter_id, category_id, title, location, status) values
  ('a1460000-0000-0000-0000-0000000000a1', 'a1450000-0000-0000-0000-000000000001', 'b1450000-0000-0000-0000-00000000000a', 'e1450000-0000-0000-0000-0000000000a1', 'P145 A incident', '{"lat":14.6,"lng":121.1}', 'resolved');

create or replace function pg_temp.denied(p_sql text) returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return true;
end $$;
grant execute on function pg_temp.denied(text) to public;

-- Walks every keyset page of one source and reports rows/distinct/ordered/pages.
create or replace function pg_temp.walk(p_source text, p_view text, p_filter text, p_size integer) returns text language plpgsql as $$
declare c_at timestamptz; c_id uuid; ids uuid[]:='{}'; r record; got integer; pages integer:=0; ordered boolean:=true; prev_at timestamptz; prev_id uuid;
begin
  loop
    got:=0;
    for r in select * from public.notification_inbox_page(p_source,p_view,p_filter,c_at,c_id,p_size) loop
      got:=got+1; ids:=ids||r.id;
      if prev_id is not null and (r.created_at,r.id)>=(prev_at,prev_id) then ordered:=false; end if;
      prev_at:=r.created_at; prev_id:=r.id;
    end loop;
    exit when got=0;
    pages:=pages+1; c_at:=prev_at; c_id:=prev_id;
    exit when pages>200;
  end loop;
  return cardinality(ids)||'/'||(select count(distinct x) from unnest(ids) x)||'/'||ordered||'/'||pages;
end $$;
grant execute on function pg_temp.walk(text,text,text,integer) to public;

create or replace function pg_temp.summary(p_view text, p_filter text) returns text language sql as $$
  select string_agg(s.source||':'||coalesce(s.total::text,'-')||','||coalesce(s.unread::text,'-')||','||coalesce(s.scope_total::text,'-')||','||coalesce(s.scope_unread::text,'-'),' ' order by s.source)
    from public.notification_hub_summary(p_view,p_filter) s
$$;
grant execute on function pg_temp.summary(text,text) to public;

create or replace function pg_temp.mirror_unread(p_recipient uuid) returns integer language sql as $$
  select count(*)::int from public.notification_inbox where recipient_id=p_recipient and kind='announcement' and read_at is null
$$;
grant execute on function pg_temp.mirror_unread(uuid) to public;

-- ===== 1. Surface and privileges =====
select is(has_table_privilege('authenticated', 'barangayan_private.notification_hub_settings', 'select'), false, 'Residents cannot read the activation gate');
select is(has_table_privilege('service_role', 'barangayan_private.notification_hub_settings', 'update'), false, 'The API service role cannot flip the activation gate directly');
select is(has_table_privilege('authenticated', 'barangayan_private.notification_read_restore', 'select'), false, 'Residents cannot read the read-restore ledger');
select is(has_function_privilege('authenticated', 'barangayan_private.emit_notification_v2(uuid[],uuid,text,text,uuid,text,text,text,jsonb,boolean)', 'execute'), false, 'Residents cannot emit notifications');
select is(has_function_privilege('service_role', 'barangayan_private.emit_notification_v2(uuid[],uuid,text,text,uuid,text,text,text,jsonb,boolean)', 'execute'), false, 'The API service role cannot emit arbitrary notifications');
select is(has_function_privilege('authenticated', 'public.notification_hub_summary(text,text)', 'execute'), true, 'Residents can read the hub summary');
select is((select count(*)::int from unnest(array['public.notification_hub_summary(text,text)','public.notification_inbox_page(text,text,text,timestamptz,uuid,integer)','public.notification_mark_scope_read(text,text)']) f
  where has_function_privilege('anon', f, 'execute')), 0, 'Guests cannot call the private hub reads or bulk read');
select is((select count(*)::int from unnest(array['public.notification_reconcile_announcement_reads(integer)','public.notification_restore_announcement_reads(uuid)',
  'public.system_notice_create(text,uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,text,text,date,integer,boolean)','public.system_notice_publish(uuid,timestamptz)',
  'public.system_notice_revise(uuid,text,text,boolean,timestamptz,timestamptz,timestamptz)','public.system_notice_resolve(uuid,text,text)','public.system_notice_cancel(uuid,text,text)',
  'public.notification_publish_due_notices(integer)']) f
  where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')), 0, 'Operator, reconciliation and due-notice functions are closed to API users');
select is((select count(*)::int from unnest(array['public.notification_reconcile_announcement_reads(integer)','public.notification_restore_announcement_reads(uuid)',
  'public.system_notice_create(text,uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,text,text,date,integer,boolean)','public.system_notice_publish(uuid,timestamptz)',
  'public.system_notice_revise(uuid,text,text,boolean,timestamptz,timestamptz,timestamptz)','public.system_notice_resolve(uuid,text,text)','public.system_notice_cancel(uuid,text,text)',
  'public.notification_publish_due_notices(integer)']) f
  where has_function_privilege('service_role', f, 'execute')), 8, 'service_role runs the operator, reconciliation and due-notice functions');
select is((select count(*)::int from pg_proc p where p.pronamespace='public'::regnamespace and p.prosecdef
  and p.proname in ('notification_hub_summary','notification_inbox_page','notification_mark_scope_read')), 0, 'Resident hub functions run with the caller''s rights');
select is((select relrowsecurity from pg_class where oid='public.system_notices'::regclass), true, 'System notices have row level security');
select is(has_table_privilege('authenticated', 'public.system_notices', 'insert') or has_table_privilege('authenticated', 'public.system_notices', 'update')
  or has_table_privilege('authenticated', 'public.system_notices', 'delete'), false, 'Residents cannot write System notices');
select is(has_table_privilege('anon', 'public.system_notices', 'select'), false, 'Guests cannot read System notices');
select is(has_column_privilege('authenticated', 'public.system_notices', 'created_by', 'select'), false, 'The operator identity is not resident-readable');
select is(has_column_privilege('authenticated', 'public.system_notices', 'fanout_cursor', 'select'), false, 'Fan-out progress is not resident-readable');
select is(has_column_privilege('authenticated', 'public.system_notices', 'title', 'select'), true, 'Notice content is resident-readable');
select is((select emission_enabled or v2_alerts_enabled from barangayan_private.notification_hub_settings), false, 'New emission and version-2 alerts start disabled');

-- ===== 2. Destination contract =====
select is(barangayan_private.valid_notification_destination('{"v":1,"kind":"request","id":"d1450000-0000-0000-0000-000000000001"}'), true, 'A version-1 request reference stays valid');
select is(barangayan_private.valid_notification_destination('{"v":"1","kind":"incident","id":"d1450000-0000-0000-0000-000000000001"}'), true, 'Version-1 references keep their original string-version tolerance');
select is(barangayan_private.valid_notification_destination('{"v":2,"kind":"notice","id":"d1450000-0000-0000-0000-000000000001"}'), true, 'A version-2 notice reference is valid');
select is(barangayan_private.valid_notification_destination('{"v":2,"kind":"account","screen":"valid_id"}'), true, 'A version-2 account screen reference is valid');
select is(barangayan_private.valid_notification_destination('{"v":"2","kind":"notice","id":"d1450000-0000-0000-0000-000000000001"}'), false, 'Version 2 must be numeric');
select is(barangayan_private.valid_notification_destination('{"v":2,"kind":"notice","screen":"profile"}'), false, 'A notice needs its id');
select is(barangayan_private.valid_notification_destination('{"v":2,"kind":"account","screen":"admin"}'), false, 'Only allowlisted account screens are accepted');
select is(barangayan_private.valid_notification_destination('{"v":2,"kind":"account","screen":"https://evil.example"}'), false, 'A URL is never a screen');
select is(barangayan_private.valid_notification_destination('{"v":1,"kind":"request","id":"d1450000-0000-0000-0000-000000000001","url":"x"}'), false, 'Extra keys are rejected');
select is(barangayan_private.valid_notification_destination('{"a":1,"b":2,"c":3}'), false, 'An object without the contract keys is rejected (no NULL pass-through)');
select is(barangayan_private.valid_notification_destination('{"v":1,"kind":"route","id":"/settings"}'), false, 'Arbitrary kinds and routes are rejected');
select is(barangayan_private.valid_notification_destination('[1,2,3]'), false, 'A non-object is rejected');

-- ===== 3. Emission modes and the activation gate =====
select is(barangayan_private.emit_notification_v2(array['b1450000-0000-0000-0000-00000000000b'::uuid],'a1450000-0000-0000-0000-000000000002','request_status','request',gen_random_uuid(),
  'p145:gate','Request submitted','Your document request was submitted.','{"v":1,"kind":"request","id":"d1450000-0000-0000-0000-000000000009"}',false), 0, 'Nothing is emitted while the gate is off');
select is((select delivered from public.notification_publish_due_notices(100)), 0, 'No notice is delivered while the gate is off');
update barangayan_private.notification_hub_settings set emission_enabled=true;
select is(barangayan_private.emit_notification_v2(array['b1450000-0000-0000-0000-00000000000b'::uuid],'a1450000-0000-0000-0000-000000000002','request_status','request',gen_random_uuid(),
  'p145:hist','Request submitted','Your document request was submitted.','{"v":1,"kind":"request","id":"d1450000-0000-0000-0000-000000000009"}',false), 1, 'History-only emission writes one inbox row');
select is((select count(*)::int from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id join barangayan_private.notification_events e on e.id=i.event_id where e.dedupe_key='p145:hist'), 0, 'History-only emission writes no phone alert');
select is(barangayan_private.emit_notification_v2(array['b1450000-0000-0000-0000-00000000000b'::uuid],'a1450000-0000-0000-0000-000000000002','payment','request',gen_random_uuid(),
  'p145:alert','Payment update','Your payment was received.','{"v":1,"kind":"request","id":"d1450000-0000-0000-0000-000000000009"}',true), 1, 'Alerting emission writes one inbox row');
select is((select count(*)::int from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id join barangayan_private.notification_events e on e.id=i.event_id where e.dedupe_key='p145:alert'), 1, 'A version-1 alert gets its outbox row');
select is(barangayan_private.emit_notification_v2(array['b1450000-0000-0000-0000-00000000000b'::uuid],'a1450000-0000-0000-0000-000000000002','account_verification','account',gen_random_uuid(),
  'p145:v2','ID verified','Your valid ID was verified.','{"v":2,"kind":"account","screen":"valid_id"}',true), 1, 'A version-2 event is recorded');
select is((select count(*)::int from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id join barangayan_private.notification_events e on e.id=i.event_id where e.dedupe_key='p145:v2'), 0, 'A version-2 alert waits for v2 alerts to be enabled');
select is((select payload_version from barangayan_private.notification_events where dedupe_key='p145:v2'), 2, 'The event records its payload version');
select is(barangayan_private.emit_notification_v2(array['b1450000-0000-0000-0000-00000000000b'::uuid],'a1450000-0000-0000-0000-000000000002','account_verification','account',gen_random_uuid(),
  'p145:v2','ID verified','Your valid ID was verified.','{"v":2,"kind":"account","screen":"valid_id"}',true), 0, 'Re-emitting the same occurrence writes nothing');
select is(barangayan_private.emit_notification_v2(array['b1450000-0000-0000-0000-00000000000a','b1450000-0000-0000-0000-0000000000bc','b1450000-0000-0000-0000-00000000000d']::uuid[],
  'a1450000-0000-0000-0000-000000000002','account_profile','account',gen_random_uuid(),'p145:foreign','Profile updated','Your profile was updated.','{"v":2,"kind":"account","screen":"profile"}',false), 0,
  'Other-barangay residents, staff and deleted accounts receive nothing');
select throws_ok($$select barangayan_private.emit_notification_v2(array['b1450000-0000-0000-0000-00000000000b'::uuid],'a1450000-0000-0000-0000-000000000002','account_profile','account',gen_random_uuid(),
  'p145:bad','Profile updated','Your profile was updated.','{"v":2,"kind":"account","screen":"https://evil.example"}',false)$$, '23514', null, 'An invalid destination cannot be stored');
update barangayan_private.notification_hub_settings set v2_alerts_enabled=true;
select is(barangayan_private.emit_notification_v2(array['b1450000-0000-0000-0000-00000000000b'::uuid],'a1450000-0000-0000-0000-000000000002','system_service','notice',gen_random_uuid(),
  'p145:v2alert','Service update','A service notice was posted.',jsonb_build_object('v',2,'kind','notice','id',gen_random_uuid()),true), 1, 'A version-2 alert is recorded once v2 alerts are on');
select is((select count(*)::int from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id join barangayan_private.notification_events e on e.id=i.event_id where e.dedupe_key='p145:v2alert'), 1, 'A version-2 alert gets its outbox row once enabled');

-- ===== 4. Volume fixtures: 1,004 announcements, 1,100 Account/System rows (all created_at tied) =====
insert into public.announcements (id, barangay_id, title, body, category, published_at)
select ('f1450000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid, 'a1450000-0000-0000-0000-000000000001', 'P145 '||g, 'Body', (array['general','emergency','health','events'])[1+g%4], now()-make_interval(secs=>g)
  from generate_series(1,1000) g;
insert into public.announcements (id, barangay_id, title, body, category, published_at) values
  ('f1450000-0000-0000-0000-0000000000a1', 'a1450000-0000-0000-0000-000000000001', 'P145 X', 'Body', 'general', now()),
  ('f1450000-0000-0000-0000-0000000000a2', 'a1450000-0000-0000-0000-000000000001', 'P145 Y', 'Body', 'general', now()),
  ('f1450000-0000-0000-0000-0000000000a3', 'a1450000-0000-0000-0000-000000000001', 'P145 W', 'Body', 'general', now()),
  ('f1450000-0000-0000-0000-0000000000a4', 'a1450000-0000-0000-0000-000000000001', 'P145 V', 'Body', 'general', now()),
  ('f1450000-0000-0000-0000-0000000000b1', 'a1450000-0000-0000-0000-000000000002', 'P145 B1', 'Body', 'general', now()),
  ('f1450000-0000-0000-0000-0000000000b2', 'a1450000-0000-0000-0000-000000000002', 'P145 B2', 'Body', 'events', now());
insert into public.announcements (id, barangay_id, title, body, category, deleted_at) values
  ('f1450000-0000-0000-0000-0000000000d1', 'a1450000-0000-0000-0000-000000000001', 'P145 deleted', 'Body', 'general', now());

do $$
declare g integer; k text; dest jsonb; subj text;
begin
  for g in 1..1100 loop
    k:=(array['account_verification','account_security','account_profile','request_status','payment','incident_status',
              'system_service','system_update','system_policy','account_verification','account_security'])[1+g%11];
    if k like 'account_%' then dest:='{"v":2,"kind":"account","screen":"settings"}'; subj:='account';
    elsif k in ('request_status','payment') then dest:=jsonb_build_object('v',1,'kind','request','id',gen_random_uuid()); subj:='request';
    elsif k='incident_status' then dest:=jsonb_build_object('v',1,'kind','incident','id',gen_random_uuid()); subj:='incident';
    else dest:=jsonb_build_object('v',2,'kind','notice','id',gen_random_uuid()); subj:='notice'; end if;
    perform barangayan_private.emit_notification_v2(array['b1450000-0000-0000-0000-00000000000a'::uuid],'a1450000-0000-0000-0000-000000000001',k,subj,gen_random_uuid(),
      'p145:load:'||g,'Update','Something changed.',dest,false);
  end loop;
end $$;
select is((select count(*)::int from public.notification_inbox where recipient_id='b1450000-0000-0000-0000-00000000000a' and kind<>'announcement'), 1100, 'Load fixture: 1,100 Account/System rows for resident A');
select is(pg_temp.mirror_unread('b1450000-0000-0000-0000-00000000000a'), 1004, 'Load fixture: every announcement has an unread inbox mirror');

select set_config('test.events', (select count(*)::text from barangayan_private.notification_events), true);
select set_config('test.outbox', (select count(*)::text from barangayan_private.notification_outbox), true);
select set_config('test.request', (select md5(r::text) from public.service_requests r where id='d1450000-0000-0000-0000-000000000001'), true);
select set_config('test.incident', (select md5(r::text) from public.incidents r where id='a1460000-0000-0000-0000-0000000000a1'), true);

-- ===== 5. Summary and keyset pages (resident A) =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1450000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1450000-0000-0000-0000-00000000000a';

select is(pg_temp.summary('all','all'), 'account:800,800,800,800 barangay:1004,1004,1004,1004 system:300,300,300,300', 'All/All counts every authorized row, beyond any page or row cap');
select is(pg_temp.summary('all','emergency'), 'account:800,800,0,0 barangay:1004,1004,250,250 system:300,300,0,0', 'A Barangay chip in All scopes only announcements');
select is(pg_temp.summary('all','account'), 'account:800,800,800,800 barangay:1004,1004,0,0 system:300,300,0,0', 'The Account chip in All scopes only Account');
select is(pg_temp.summary('account','verification'), 'account:800,800,200,200 barangay:1004,1004,0,0 system:300,300,0,0', 'Account/Verification scopes one Account chip');
select is(pg_temp.summary('account','document_requests'), 'account:800,800,200,200 barangay:1004,1004,0,0 system:300,300,0,0', 'Document Requests covers request and payment updates');
select is(pg_temp.summary('system','policies'), 'account:800,800,0,0 barangay:1004,1004,0,0 system:300,300,100,100', 'System/Policies scopes one System chip');
select is(pg_temp.summary('barangay','all'), 'account:800,800,0,0 barangay:1004,1004,1004,1004 system:300,300,0,0', 'Barangay/All excludes the inbox announcement mirrors and deleted announcements');
select throws_ok($$select * from public.notification_hub_summary('barangay','account')$$, '22023', 'invalid_notification_scope', 'A chip outside its view is rejected');
select throws_ok($$select * from public.notification_hub_summary('reports','all')$$, '22023', 'invalid_notification_scope', 'An unknown view is rejected');
select is(pg_temp.walk('account','all','all',25), '800/800/true/32', 'Account pages of 25 return every row once, in stable order, despite tied timestamps');
select is(pg_temp.walk('account','account','verification',50), '200/200/true/4', 'A chip''s pages return exactly its rows');
select is(pg_temp.walk('system','all','all',50), '300/300/true/6', 'System pages are independent of Account pages');
select is(pg_temp.walk('account','system','all',50), '0/0/true/0', 'A source outside the view returns nothing');
select is((select count(*)::int from public.notification_inbox_page('account','all','all',null,null,500)), 50, 'A page never exceeds 50 rows');
select is((select count(*)::int from public.notification_inbox_page('account','all','all',null,null,null)), 25, 'The default page is 25 rows');
select is((select count(*)::int from public.notification_inbox_page('account','all','all',null,null,25) where filter is null or kind='announcement'), 0, 'Pages carry a chip for every row and never include announcement mirrors');
select throws_ok($$select * from public.notification_inbox_page('account','all','all',now(),null,25)$$, '22023', 'invalid_notification_page', 'A half cursor is rejected');
select throws_ok($$select * from public.notification_inbox_page('barangay','all','all',null,null,25)$$, '22023', 'invalid_notification_page', 'Announcements are not an inbox source');

-- ===== 6. Scoped bulk read (resident A) =====
select results_eq($$select * from public.notification_mark_scope_read('account','verification')$$, $$values (0,200)$$, 'Account/Verification marks exactly its 200 unread rows');
select is(pg_temp.summary('account','all'), 'account:800,600,800,600 barangay:1004,1004,0,0 system:300,300,0,0', 'Other Account chips stay unread');
select results_eq($$select * from public.notification_mark_scope_read('barangay','emergency')$$, $$values (250,0)$$, 'Barangay/Emergency marks its 250 announcements, inbox untouched');
select is(pg_temp.mirror_unread('b1450000-0000-0000-0000-00000000000a'), 754, 'Marked announcements'' inbox mirrors follow through the bridge');
select results_eq($$select * from public.notification_mark_scope_read('all','all')$$, $$values (754,900)$$, 'All/All marks everything still unread, including rows never paged in');
select is(pg_temp.summary('all','all'), 'account:800,0,800,0 barangay:1004,0,1004,0 system:300,0,300,0', 'Nothing in any source is unread afterwards');
select results_eq($$select * from public.notification_mark_scope_read('all','all')$$, $$values (0,0)$$, 'Repeating after a lost response changes nothing');
select is(pg_temp.mirror_unread('b1450000-0000-0000-0000-00000000000a'), 0, 'Every announcement mirror converged');
select is((select count(*)::int from public.notification_inbox where recipient_id='b1450000-0000-0000-0000-00000000000b'), 0, 'Resident A cannot see resident B''s inbox');
reset role;

select is((select count(*)::text from barangayan_private.notification_events), current_setting('test.events'), 'Reads create no events');
select is((select count(*)::text from barangayan_private.notification_outbox), current_setting('test.outbox'), 'Reads create no phone alerts');
select is((select md5(r::text) from public.service_requests r where id='d1450000-0000-0000-0000-000000000001'), current_setting('test.request'), 'Reads never change a request or its payment');
select is((select md5(r::text) from public.incidents r where id='a1460000-0000-0000-0000-0000000000a1'), current_setting('test.incident'), 'Reads never change a report or its resolved acknowledgment');
select is(pg_temp.mirror_unread('b1450000-0000-0000-0000-0000000000a2'), 1004, 'Another resident''s announcement state is untouched');
select is((select count(*)::int from public.announcement_reads where resident_id='b1450000-0000-0000-0000-00000000000a'), 1004, 'Exactly one read marker per announcement');

-- New arrivals and an injected mid-statement failure.
select is(barangayan_private.emit_notification_v2(array['b1450000-0000-0000-0000-00000000000a'::uuid],'a1450000-0000-0000-0000-000000000001','account_security','account',gen_random_uuid(),
  'p145:late','Password updated','Your password was updated.','{"v":2,"kind":"account","screen":"change_password"}',false), 1, 'A later arrival is recorded');
select is(barangayan_private.emit_notification_v2(array['b1450000-0000-0000-0000-00000000000a'::uuid],'a1450000-0000-0000-0000-000000000001','account_profile','account',gen_random_uuid(),
  'p145:explode','Explode','Fault fixture.','{"v":2,"kind":"account","screen":"profile"}',false), 1, 'A fault fixture row is recorded');
insert into public.announcements (id, barangay_id, title, body, category) values
  ('f1450000-0000-0000-0000-0000000000c1', 'a1450000-0000-0000-0000-000000000001', 'P145 late 1', 'Body', 'health'),
  ('f1450000-0000-0000-0000-0000000000c2', 'a1450000-0000-0000-0000-000000000001', 'P145 late 2', 'Body', 'events');
create function public.zz_p145_fault() returns trigger language plpgsql as $$ begin raise exception 'p145_fault'; end $$;
create trigger zz_p145_fault before update on public.notification_inbox for each row when (old.title='Explode') execute function public.zz_p145_fault();

set local role authenticated;
set local request.jwt.claims = '{"sub":"b1450000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1450000-0000-0000-0000-00000000000a';
select is(pg_temp.summary('all','all'), 'account:802,2,802,2 barangay:1006,2,1006,2 system:300,0,300,0', 'Arrivals after a bulk read stay unread');
select throws_ok($$select * from public.notification_mark_scope_read('all','all')$$, 'P0001', 'p145_fault', 'A failure inside the bulk statement surfaces');
select is(pg_temp.summary('all','all'), 'account:802,2,802,2 barangay:1006,2,1006,2 system:300,0,300,0', 'A failed bulk read leaves nothing partially applied');
reset role;
drop trigger zz_p145_fault on public.notification_inbox;
drop function public.zz_p145_fault();

-- Other callers.
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1450000-0000-0000-0000-00000000000b","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1450000-0000-0000-0000-00000000000b';
select is(pg_temp.summary('all','all'), 'account:3,3,3,3 barangay:2,2,2,2 system:1,1,1,1', 'Resident B counts only their own barangay and inbox');
select is(pg_temp.walk('account','all','all',25), '3/3/true/1', 'Resident B pages only their own rows');
select results_eq($$select * from public.notification_mark_scope_read('all','all')$$, $$values (2,4)$$, 'Resident B''s bulk read covers only resident B');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1450000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1450000-0000-0000-0000-00000000000a';
select is(pg_temp.summary('all','all'), 'account:802,2,802,2 barangay:1006,2,1006,2 system:300,0,300,0', 'Resident B''s bulk read changed nothing of resident A');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1450000-0000-0000-0000-00000000000d","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1450000-0000-0000-0000-00000000000d';
select throws_ok($$select * from public.notification_mark_scope_read('all','all')$$, '42501', 'forbidden', 'A deleted account cannot bulk-read');
select is(pg_temp.summary('all','all'), 'account:-,-,-,- barangay:1006,-,1006,- system:-,-,-,-', 'A deleted account has no inbox or read state (unknown, not zero)');
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.jwt.claim.sub = '';
select is(pg_temp.denied($$select * from public.notification_hub_summary('all','all')$$), true, 'Guests cannot call the summary');
select is(pg_temp.denied($$select * from public.notification_mark_scope_read('all','all')$$), true, 'Guests cannot bulk-read');
reset role;

-- ===== 7. Announcement read bridge (resident A2) =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1450000-0000-0000-0000-0000000000a2","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1450000-0000-0000-0000-0000000000a2';
update public.notification_inbox set read_at=now() where kind='announcement' and destination->>'id'='f1450000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from public.announcement_reads where announcement_id='f1450000-0000-0000-0000-0000000000a1'), 1, 'Reading the inbox mirror adds the announcement read marker');
update public.notification_inbox set read_at=null where kind='announcement' and destination->>'id'='f1450000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from public.announcement_reads where announcement_id='f1450000-0000-0000-0000-0000000000a1'), 0, 'Unreading the inbox mirror removes the marker');
insert into public.announcement_reads (resident_id, announcement_id) values ('b1450000-0000-0000-0000-0000000000a2', 'f1450000-0000-0000-0000-0000000000a2');
select isnt((select read_at from public.notification_inbox where kind='announcement' and destination->>'id'='f1450000-0000-0000-0000-0000000000a2'), null, 'An announcement read marks its inbox mirror read');
delete from public.announcement_reads where announcement_id='f1450000-0000-0000-0000-0000000000a2';
select is((select read_at from public.notification_inbox where kind='announcement' and destination->>'id'='f1450000-0000-0000-0000-0000000000a2'), null, 'Removing the read marks the mirror unread');
do $$ begin
  for i in 1..5 loop
    update public.notification_inbox set read_at=now() where kind='announcement' and destination->>'id'='f1450000-0000-0000-0000-0000000000a1';
    update public.notification_inbox set read_at=null where kind='announcement' and destination->>'id'='f1450000-0000-0000-0000-0000000000a1';
  end loop;
  update public.notification_inbox set read_at=now() where kind='announcement' and destination->>'id'='f1450000-0000-0000-0000-0000000000a1';
  update public.notification_inbox set read_at=now() where kind='announcement' and destination->>'id'='f1450000-0000-0000-0000-0000000000a1';
end $$;
select is((select count(*)::int from public.announcement_reads where announcement_id='f1450000-0000-0000-0000-0000000000a1'), 1, 'Repeated read/unread settles on one marker');
select is((select count(*)::int from public.notification_inbox where kind='announcement' and destination->>'id'='f1450000-0000-0000-0000-0000000000a1'), 1, 'The bridge never duplicates a mirror');
reset role;
select is((select count(*)::text from barangayan_private.notification_events), (current_setting('test.events')::int+6)::text, 'Bridge traffic creates no events (only the six fixture events above)');
select is((select read_at from public.notification_inbox where recipient_id='b1450000-0000-0000-0000-00000000000a' and kind='announcement' and destination->>'id'='f1450000-0000-0000-0000-0000000000a1') is not null, true, 'Resident A''s mirror is untouched by resident A2');
update public.announcements set deleted_at=now() where id='f1450000-0000-0000-0000-0000000000a3';
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1450000-0000-0000-0000-0000000000a2","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1450000-0000-0000-0000-0000000000a2';
select lives_ok($$update public.notification_inbox set read_at=now() where kind='announcement' and destination->>'id'='f1450000-0000-0000-0000-0000000000a3'$$, 'A mirror of a deleted announcement can still be marked read');
select is((select count(*)::int from public.announcement_reads where announcement_id='f1450000-0000-0000-0000-0000000000a3'), 0, 'No marker is written for an unavailable announcement');
reset role;

-- ===== 8. Reconciliation and targeted restore (service_role functions) =====
select set_config('barangayan.read_bridge','off',true);
update public.notification_inbox set read_at=now()-interval '1 day'
 where recipient_id='b1450000-0000-0000-0000-0000000000a2' and kind='announcement'
   and destination->>'id' in ('f1450000-0000-0000-0000-000000000001','f1450000-0000-0000-0000-000000000002','f1450000-0000-0000-0000-000000000003');
insert into public.announcement_reads (resident_id, announcement_id, read_at) values
  ('b1450000-0000-0000-0000-0000000000a2', 'f1450000-0000-0000-0000-000000000004', now()-interval '2 days'),
  ('b1450000-0000-0000-0000-0000000000a2', 'f1450000-0000-0000-0000-000000000005', now()-interval '2 days');
select set_config('barangayan.read_bridge','',true);

select results_eq($$select reads_added, mirrors_marked, remaining from public.notification_reconcile_announcement_reads(2)$$, $$values (2,0,3)$$, 'Reconciliation works in bounded batches');
select is((select announcement_reads_reconciled_at from barangayan_private.notification_hub_settings), null, 'The boundary is not recorded while work remains');
select set_config('test.batch', (select batch_id::text from public.notification_reconcile_announcement_reads(100)), true);
select results_eq($$select count(*)::int from barangayan_private.notification_read_restore where batch_id=current_setting('test.batch')::uuid group by target order by target$$, $$values (1),(2)$$, 'The resumed batch records each change it makes');
select isnt((select announcement_reads_reconciled_at from barangayan_private.notification_hub_settings), null, 'The reconciliation boundary is recorded when nothing remains');
select results_eq($$select reads_added, mirrors_marked, remaining from public.notification_reconcile_announcement_reads(100)$$, $$values (0,0,0)$$, 'Re-running reconciliation is harmless');
select is((select count(*)::int from public.notification_inbox n where n.recipient_id='b1450000-0000-0000-0000-0000000000a2' and n.kind='announcement' and n.read_at is not null
   and n.destination->>'id' in ('f1450000-0000-0000-0000-000000000001','f1450000-0000-0000-0000-000000000002','f1450000-0000-0000-0000-000000000003','f1450000-0000-0000-0000-000000000004','f1450000-0000-0000-0000-000000000005')), 5,
  'A read seen in either store is preserved');

-- The resident unreads one reconciled mirror after the batch; restore must leave that alone.
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1450000-0000-0000-0000-0000000000a2","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1450000-0000-0000-0000-0000000000a2';
update public.notification_inbox set read_at=null where kind='announcement' and destination->>'id'='f1450000-0000-0000-0000-000000000004';
reset role;
select results_eq($$select * from public.notification_restore_announcement_reads(current_setting('test.batch')::uuid)$$, $$values (2,1)$$, 'Restore reverts recorded changes and skips the one the resident changed since');
select is(current_setting('barangayan.read_bridge'), '', 'Restore re-enables the bridge');
select is((select count(*)::int from public.announcement_reads where resident_id='b1450000-0000-0000-0000-0000000000a2' and announcement_id=(select announcement_id from barangayan_private.notification_read_restore where batch_id=current_setting('test.batch')::uuid and target='announcement_read')), 0, 'A restored added marker is removed');
select isnt((select read_at from public.notification_inbox where recipient_id='b1450000-0000-0000-0000-0000000000a2' and kind='announcement' and destination->>'id'=(select announcement_id from barangayan_private.notification_read_restore where batch_id=current_setting('test.batch')::uuid and target='announcement_read')::text), null, 'Restoring a marker keeps the mirror''s own original read');
select is((select read_at from public.notification_inbox where recipient_id='b1450000-0000-0000-0000-0000000000a2' and kind='announcement' and destination->>'id'='f1450000-0000-0000-0000-000000000005'), null, 'A restored mirror returns to unread');
select is((select count(*)::int from public.announcement_reads where resident_id='b1450000-0000-0000-0000-0000000000a2' and announcement_id='f1450000-0000-0000-0000-000000000005'), 1, 'Restoring a mirror keeps the original announcement read');
select is((select count(*)::int from public.announcement_reads where resident_id='b1450000-0000-0000-0000-0000000000a2' and announcement_id='f1450000-0000-0000-0000-000000000004'), 0, 'The resident''s later unread is kept');
select results_eq($$select * from public.notification_restore_announcement_reads(current_setting('test.batch')::uuid)$$, $$values (0,1)$$, 'Restore is not applied twice');

-- ===== 9. System notices =====
select throws_ok($$select public.system_notice_create('service_status','a1450000-0000-0000-0000-000000000001','Maintenance','Body text.','b1450000-0000-0000-0000-00000000000a')$$, '42501', 'system_notice_operator_required', 'Only an administrator can be the operator');
select throws_ok($$select public.system_notice_create('service_status','a1450000-0000-0000-0000-000000000001','Maintenance','Body text.','b1450000-0000-0000-0000-0000000000bc')$$, '42501', 'system_notice_operator_required', 'An administrator cannot target another barangay');
select throws_ok($$select public.system_notice_create('service_status','a1450000-0000-0000-0000-000000000001',repeat('x',81),'Body text.','b1450000-0000-0000-0000-00000000000c')$$, '22023', 'invalid_system_notice_text', 'Titles are length-checked');
select throws_ok($$select public.system_notice_create('policy','a1450000-0000-0000-0000-000000000001','Terms updated','Review the terms.','b1450000-0000-0000-0000-00000000000c')$$, '23514', null, 'A policy notice must name its policy');
select throws_ok($$select public.system_notice_create('service_status','a1450000-0000-0000-0000-000000000001','Maintenance','Body text.','b1450000-0000-0000-0000-00000000000c',null,null,null,'https://evil.example')$$, '23514', null, 'Actions come from the allowlist only');
select throws_ok($$select public.system_notice_create('service_status','a1450000-0000-0000-0000-000000000001','Maintenance','Body text.','b1450000-0000-0000-0000-00000000000c',now()+interval '2 hours',now()+interval '1 hour')$$, '23514', null, 'A window must end after it starts');

select set_config('test.n1', public.system_notice_create('service_status','a1450000-0000-0000-0000-000000000001','Scheduled maintenance',
  'Barangayan will be unavailable on October 30, 10:00-11:00 PM.','b1450000-0000-0000-0000-00000000000c',now()+interval '2 days',now()+interval '2 days 1 hour',null,'services')::text, true);
select is((select alert from public.system_notices where id=current_setting('test.n1')::uuid), true, 'Service notices alert by default');
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1450000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1450000-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.system_notices where id=current_setting('test.n1')::uuid), 0, 'A draft is invisible to residents');
reset role;
select is(public.system_notice_publish(current_setting('test.n1')::uuid), 'published', 'Publishing now publishes');
select throws_ok($$select public.system_notice_publish(current_setting('test.n1')::uuid)$$, '55000', 'system_notice_state_conflict', 'A notice is published once');
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1450000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1450000-0000-0000-0000-00000000000a';
select is((select state from public.system_notices where id=current_setting('test.n1')::uuid), 'published', 'Residents of its barangay can read a published notice');
select is(pg_temp.denied($$select created_by from public.system_notices$$), true, 'Residents cannot read the operator');
select is(pg_temp.denied($$update public.system_notices set title='x'$$), true, 'Residents cannot change a notice');
select is(pg_temp.denied($$insert into public.system_notices(subtype,title,body,alert,created_by) values ('service_status','x','y',true,'b1450000-0000-0000-0000-00000000000a')$$), true, 'Residents cannot create a notice');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1450000-0000-0000-0000-00000000000b","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1450000-0000-0000-0000-00000000000b';
select is((select count(*)::int from public.system_notices where id=current_setting('test.n1')::uuid), 0, 'Other barangays cannot read it');
reset role;

select results_eq($$select * from public.notification_publish_due_notices(1)$$, $$values (0,1,1)$$, 'Fan-out is bounded per run and remembers where it stopped');
select results_eq($$select * from public.notification_publish_due_notices(100)$$, $$values (0,1,0)$$, 'The next run resumes and finishes the audience');
select results_eq($$select * from public.notification_publish_due_notices(100)$$, $$values (0,0,0)$$, 'A finished revision is never replayed');
select is((select count(*)::int from public.notification_inbox where kind='system_service' and destination=jsonb_build_object('v',2,'kind','notice','id',current_setting('test.n1')::uuid)), 2, 'Each active resident of the barangay gets one System entry');
select is((select count(*)::int from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id
  where i.destination->>'id'=current_setting('test.n1') and o.state='pending'), 2, 'Revision 1 alerts are queued');
select is(public.system_notice_revise(current_setting('test.n1')::uuid,'Maintenance extended','Maintenance will continue until 11:30 PM.',true,now()+interval '2 days',now()+interval '2 days 90 minutes'), 2, 'A material change is a new revision');
select is((select count(*)::int from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id
  where i.destination->>'id'=current_setting('test.n1') and o.state='skipped' and o.last_error='superseded'), 2, 'Unsent alerts of the old revision are superseded');
select results_eq($$select * from public.notification_publish_due_notices(100)$$, $$values (0,2,0)$$, 'The new revision is delivered once to the audience');
select is(public.system_notice_revise(current_setting('test.n1')::uuid,'Maintenance extended','Maintenance will continue until 11:30 PM tonight.',false,now()+interval '2 days',now()+interval '2 days 90 minutes'), 2, 'A wording fix keeps the revision');
select results_eq($$select * from public.notification_publish_due_notices(100)$$, $$values (0,0,0)$$, 'A non-material change sends nothing');
select is(public.system_notice_resolve(current_setting('test.n1')::uuid,'Service restored','You can now submit and track document requests.'), 3, 'Resolving is a new revision');
select results_eq($$select * from public.notification_publish_due_notices(100)$$, $$values (0,2,0)$$, 'The recovery notice reaches the audience');
select is((select count(*)::int from public.notification_inbox where destination->>'id'=current_setting('test.n1')), 6, 'Three revisions, two residents, no duplicates');
select throws_ok($$select public.system_notice_cancel(current_setting('test.n1')::uuid,'Cancelled','Never mind.')$$, '55000', 'system_notice_state_conflict', 'A resolved notice cannot be cancelled');

select set_config('test.n2', public.system_notice_create('app_update','a1450000-0000-0000-0000-000000000001','An app update is available',
  'Update Barangayan for the latest fixes and improvements.','b1450000-0000-0000-0000-00000000000c',null,null,null,null,null,null,7)::text, true);
select is(public.system_notice_publish(current_setting('test.n2')::uuid, now()+interval '1 day'), 'scheduled', 'A future publication is scheduled');
select results_eq($$select * from public.notification_publish_due_notices(100)$$, $$values (0,0,1)$$, 'A scheduled notice waits for its time');
update public.system_notices set publish_at=now()-interval '1 minute' where id=current_setting('test.n2')::uuid;
select results_eq($$select * from public.notification_publish_due_notices(100)$$, $$values (1,2,0)$$, 'A due notice is published and delivered in the same run');
select is((select count(*)::int from barangayan_private.notification_outbox o join public.notification_inbox i on i.id=o.inbox_id where i.destination->>'id'=current_setting('test.n2')), 0, 'App-update notices are inbox-only by default');

select set_config('test.n3', public.system_notice_create('service_status','a1450000-0000-0000-0000-000000000001','Draft notice','Never sent.','b1450000-0000-0000-0000-00000000000c')::text, true);
select is(public.system_notice_cancel(current_setting('test.n3')::uuid), 1, 'A draft is cancelled silently');
select results_eq($$select * from public.notification_publish_due_notices(100)$$, $$values (0,0,0)$$, 'A cancelled draft sends nothing');

select set_config('test.n4', public.system_notice_create('policy',null,'Privacy notice updated','Review the updated notice to see how Barangayan handles your information.',
  'b1450000-0000-0000-0000-00000000000c',null,null,null,null,'privacy_policy','2026-11-01')::text, true);
select is((select action from public.system_notices where id=current_setting('test.n4')::uuid), 'terms_privacy', 'A policy notice opens the existing terms and privacy screen');
select is(public.system_notice_publish(current_setting('test.n4')::uuid), 'published', 'An all-barangay policy notice is published');
select is((select delivered from public.notification_publish_due_notices(100)),
  (select count(*)::int from public.profiles where role='resident' and deleted_at is null and barangay_id is not null), 'An all-barangay notice reaches every active resident once');
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1450000-0000-0000-0000-00000000000b","role":"authenticated"}';
set local request.jwt.claim.sub = 'b1450000-0000-0000-0000-00000000000b';
select is((select policy_key from public.system_notices where id=current_setting('test.n4')::uuid), 'privacy_policy', 'Every barangay can read an all-barangay notice');
reset role;

select set_config('test.n5', public.system_notice_create('service_status','a1450000-0000-0000-0000-000000000001','Online payments temporarily unavailable',
  'QR Ph payments are unavailable right now.','b1450000-0000-0000-0000-00000000000c')::text, true);
select is(public.system_notice_publish(current_setting('test.n5')::uuid), 'published', 'A service notice is published');
update public.system_notices set expires_at=now()-interval '1 minute' where id=current_setting('test.n5')::uuid;
select results_eq($$select * from public.notification_publish_due_notices(100)$$, $$values (0,0,0)$$, 'An expired notice stops delivering');
select throws_ok($$select public.system_notice_cancel(current_setting('test.n5')::uuid)$$, '22023', 'invalid_system_notice_text', 'Cancelling a published notice needs a message');
select is(public.system_notice_cancel(current_setting('test.n5')::uuid,'Payments are available','QR Ph payments are working again.'), 2, 'Cancelling a published notice is a new revision');
select is((select state from public.system_notices where id=current_setting('test.n5')::uuid), 'cancelled', 'The notice is cancelled');

update barangayan_private.notification_hub_settings set emission_enabled=false;
select set_config('test.n6', public.system_notice_create('service_status','a1450000-0000-0000-0000-000000000001','Document requests temporarily unavailable',
  'New document requests can''t be submitted right now.','b1450000-0000-0000-0000-00000000000c')::text, true);
select is(public.system_notice_publish(current_setting('test.n6')::uuid), 'published', 'Notices can be prepared while the gate is off');
select results_eq($$select published, delivered from public.notification_publish_due_notices(100)$$, $$values (0,0)$$, 'Nothing is delivered while the gate is off');
select is((select count(*)::int from public.notification_inbox where destination->>'id'=current_setting('test.n6')), 0, 'No entry exists until activation');

select * from finish();
rollback;
