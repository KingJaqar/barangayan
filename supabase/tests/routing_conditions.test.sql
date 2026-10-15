-- R4 routing conditions (0113): authorization, forbidden writes, revisions,
-- complete snapshots with tombstones, and graph-version mapping guards.
begin;
select plan(81);

insert into public.barangays (id, name) values
  ('a4000000-0000-0000-0000-000000000001', 'Routing Barangay A'),
  ('a4000000-0000-0000-0000-000000000002', 'Routing Barangay B');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at) values
  ('b4000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'routing-admin-a@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b4000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'routing-admin-b@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b4000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'routing-resident-a@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now());

insert into public.profiles (id, barangay_id, role, full_name) values
  ('b4000000-0000-0000-0000-00000000000a', 'a4000000-0000-0000-0000-000000000001', 'admin', 'Routing Admin A'),
  ('b4000000-0000-0000-0000-00000000000b', 'a4000000-0000-0000-0000-000000000002', 'admin', 'Routing Admin B'),
  ('b4000000-0000-0000-0000-00000000000c', 'a4000000-0000-0000-0000-000000000001', 'resident', 'Routing Resident A')
on conflict (id) do update set barangay_id = excluded.barangay_id, role = excluded.role, full_name = excluded.full_name;

insert into public.routing_areas (id, barangay_id, name) values
  ('test-a', 'a4000000-0000-0000-0000-000000000001', 'Routing Area A'),
  ('test-b', 'a4000000-0000-0000-0000-000000000002', 'Routing Area B');

insert into public.evacuation_centers (id, barangay_id, name, position, is_active) values
  ('e4000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'Center One', '{"lat":14.6800,"lng":121.1100}', true),
  ('e4000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001', 'Center Two', '{"lat":14.6810,"lng":121.1110}', true),
  ('e4000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000001', 'Center Three', '{"lat":14.6820,"lng":121.1120}', true),
  ('e4000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000002', 'Center B', '{"lat":14.7000,"lng":121.2000}', true);

-- ---------------------------------------------------------------------------
-- Setup effects: centers took revisions; defaults are unknown, not available.
-- ---------------------------------------------------------------------------
select is((select revision from public.routing_areas where id = 'test-a'), 3::bigint, 'Each new center takes the next area revision');
select is((select availability from public.evacuation_centers where id = 'e4000000-0000-0000-0000-000000000001'), 'unknown', 'Availability defaults to unknown');
select is((select count(*)::int from public.routing_condition_events where area_id = 'test-a' and action = 'created'), 3, 'Center creation is recorded in the routing history');

-- ---------------------------------------------------------------------------
-- Anonymous access: snapshot only.
-- ---------------------------------------------------------------------------
set local role anon;
select is((public.get_routing_conditions_snapshot('test-a')->>'revision')::bigint, 3::bigint, 'Anonymous callers read the snapshot revision');
select is(jsonb_array_length(public.get_routing_conditions_snapshot('test-a')->'centers'), 3, 'Snapshot lists every non-deleted center of the area');
select is(public.get_routing_conditions_snapshot('test-a')->>'graphStatus', 'none', 'No graph is active before registration');
select is(jsonb_array_length(public.get_routing_conditions_snapshot('test-a')->'closures'), 0, 'Empty closure list is a successful snapshot');
select throws_ok($$ select public.get_routing_conditions_snapshot('missing-area') $$, 'P0002', null, 'Unknown area is reported, not empty');
select throws_ok($$ select public.get_routing_conditions_snapshot('test-a', 'bad version') $$, '22023', null, 'Malformed graph version is rejected');
select throws_ok($$ select public.publish_road_closure('test-a', 'test-a@2026-10-12#aaaaaaaaaaaa', array['e1'], array['r1'], '{"type":"MultiLineString","coordinates":[[[121.11,14.68],[121.111,14.68]]]}', 'L', 'R', now()) $$,
  '42501', null, 'Anonymous callers cannot publish closures');
select throws_ok($$ select * from public.road_closures $$, '42501', null, 'Anonymous callers cannot read closure tables');
reset role;

-- ---------------------------------------------------------------------------
-- Residents and other barangays cannot manage.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'b4000000-0000-0000-0000-00000000000c';
select throws_ok($$ select public.register_routing_graph_version('test-a', 'test-a@2026-10-12#aaaaaaaaaaaa', true) $$,
  '42501', null, 'Residents cannot register graph versions');
select is((select count(*)::int from public.routing_areas), 0, 'Residents cannot read routing areas');

set local request.jwt.claim.sub = 'b4000000-0000-0000-0000-00000000000b';
select throws_ok($$ select public.register_routing_graph_version('test-a', 'test-a@2026-10-12#aaaaaaaaaaaa', true) $$,
  '42501', null, 'Another barangay''s administrator cannot register a graph');
select is((select count(*)::int from public.routing_areas where id = 'test-a'), 0, 'Another barangay''s administrator cannot read the area');

-- ---------------------------------------------------------------------------
-- Graph registration and closure publication.
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = 'b4000000-0000-0000-0000-00000000000a';
select throws_ok($$ select public.publish_road_closure('test-a', 'test-a@2026-10-12#aaaaaaaaaaaa', array['e1'], array['r1'], '{"type":"MultiLineString","coordinates":[[[121.11,14.68],[121.111,14.68]]]}', 'L', 'R', now()) $$,
  '55000', null, 'Closures need an active graph');
select throws_ok($$ select public.register_routing_graph_version('test-a', 'test-b@2026-10-12#aaaaaaaaaaaa', true) $$,
  '22023', null, 'Graph version must belong to the area');
select is((public.register_routing_graph_version('test-a', 'test-a@2026-10-12#aaaaaaaaaaaa', true)->>'active')::boolean, true, 'Administrator registers and activates the first graph');
select is((select active_graph_version from public.routing_areas where id = 'test-a'), 'test-a@2026-10-12#aaaaaaaaaaaa', 'Active graph recorded');

select throws_ok($$ select public.publish_road_closure('test-a', 'test-a@2026-10-11#bbbbbbbbbbbb', array['e1'], array['r1'], '{"type":"MultiLineString","coordinates":[[[121.11,14.68],[121.111,14.68]]]}', 'L', 'R', now()) $$,
  '55000', null, 'Publishing against a stale graph version is refused');
select throws_ok($$ select public.publish_road_closure('test-a', 'test-a@2026-10-12#aaaaaaaaaaaa', array[]::text[], array[]::text[], '{"type":"MultiLineString","coordinates":[[[121.11,14.68],[121.111,14.68]]]}', 'L', 'R', now()) $$,
  '22023', null, 'At least one segment is required');
select throws_ok($$ select public.publish_road_closure('test-a', 'test-a@2026-10-12#aaaaaaaaaaaa', array['e1','e1'], array['r1','r2'], '{"type":"MultiLineString","coordinates":[[[121.11,14.68],[121.111,14.68]],[[121.11,14.68],[121.111,14.68]]]}', 'L', 'R', now()) $$,
  '22023', null, 'Duplicate segment ids are rejected');
select throws_ok($$ select public.publish_road_closure('test-a', 'test-a@2026-10-12#aaaaaaaaaaaa', array['e1','e2'], array['r1','r2'], '{"type":"MultiLineString","coordinates":[[[121.11,14.68],[121.111,14.68]]]}', 'L', 'R', now()) $$,
  '22023', null, 'Geometry must have one line per segment');
select throws_ok($$ select public.publish_road_closure('test-a', 'test-a@2026-10-12#aaaaaaaaaaaa', array['e1'], array['r1'], '{"type":"MultiLineString","coordinates":[[[121.11,14.68],["x",14.68]]]}', 'L', 'R', now()) $$,
  '22023', null, 'Non-numeric coordinates are rejected');
select throws_ok($$ select public.publish_road_closure('test-a', 'test-a@2026-10-12#aaaaaaaaaaaa', array['e1'], array['r1'], '{"type":"MultiLineString","coordinates":[[[121.11,14.68],[121.111,14.68]]]}', 'L', '   ', now()) $$,
  '22023', null, 'A reason is required');
select throws_ok($$ select public.publish_road_closure('test-a', 'test-a@2026-10-12#aaaaaaaaaaaa', array['e1'], array['r1'], '{"type":"MultiLineString","coordinates":[[[121.11,14.68],[121.111,14.68]]]}', 'L', 'R', now() + interval '1 hour') $$,
  '22023', null, 'Observation time cannot be in the future');

create temporary table r4_ids (name text primary key, id uuid, revision bigint) on commit drop;
grant all on r4_ids to authenticated, anon;
insert into r4_ids
select 'closure1', (r->>'id')::uuid, (r->>'revision')::bigint
  from (select public.publish_road_closure('test-a', 'test-a@2026-10-12#aaaaaaaaaaaa', array['w1:1-2','w1:2-3'],
          array['osm:way/1/1-2','osm:way/1/2-3'],
          '{"type":"MultiLineString","coordinates":[[[121.110,14.680],[121.111,14.680]],[[121.111,14.680],[121.112,14.680]]]}',
          '  Luna Street  ', 'Knee-deep flooding', now() - interval '20 minutes') as r) s;
select is((select revision from r4_ids where name = 'closure1'), (select revision from public.routing_areas where id = 'test-a'), 'Publication returns the new area revision');
select is((select label from public.road_closures where id = (select id from r4_ids where name = 'closure1')), 'Luna Street', 'Label is trimmed');
select ok((select observed_at < published_at from public.road_closures where id = (select id from r4_ids where name = 'closure1')), 'Observation time is kept separate from publication time');
select is((select count(*)::int from public.admin_audit_log where entity_type = 'road_closure' and entity_id = (select id from r4_ids where name = 'closure1')), 1, 'Publication is written to the admin audit log');

-- Forbidden direct writes (privileges revoked; RPCs are the only write path).
select throws_ok($$ insert into public.road_closures (area_id, label, reason, geometry, source_refs, observed_at, published_revision) values ('test-a','x','y','{"type":"MultiLineString","coordinates":[[[121.11,14.68],[121.111,14.68]]]}', array['r'], now(), 1) $$,
  '42501', null, 'Administrators cannot insert closures directly');
select throws_ok($$ update public.road_closures set status = 'reopened' $$, '42501', null, 'Administrators cannot update closures directly');
select throws_ok($$ delete from public.road_closures $$, '42501', null, 'Administrators cannot delete closures directly');
select throws_ok($$ insert into public.routing_condition_events (area_id, revision, entity_type, entity_id, action) values ('test-a', 1, 'road_closure', 'x', 'published') $$,
  '42501', null, 'Administrators cannot forge history');
select throws_ok($$ update public.routing_areas set revision = 1 $$, '42501', null, 'Administrators cannot rewrite the revision');

set local request.jwt.claim.sub = 'b4000000-0000-0000-0000-00000000000b';
select is((select count(*)::int from public.road_closures), 0, 'Another barangay''s administrator cannot read closures');
select throws_ok($$ select public.reopen_road_closure((select id from r4_ids where name = 'closure1'), 'Cleared') $$,
  '42501', null, 'Another barangay''s administrator cannot reopen a closure');
reset role;

-- Even a superuser cannot delete or edit a verified closure.
select throws_ok($$ delete from public.road_closures where id = (select id from r4_ids where name = 'closure1') $$,
  '55000', null, 'Verified closures are never deleted');
select throws_ok($$ update public.road_closures set label = 'Other' where id = (select id from r4_ids where name = 'closure1') $$,
  '55000', null, 'Published closures are never edited');
select throws_ok($$ update public.routing_condition_events set action = 'reopened' $$, '55000', null, 'History rows are immutable');
select throws_ok($$ delete from public.routing_condition_events $$, '55000', null, 'History rows cannot be deleted');

set local role anon;
select is(public.get_routing_conditions_snapshot('test-a')->'closures'->0->'edgeIds', '["w1:1-2", "w1:2-3"]'::jsonb, 'Snapshot carries the closure edges for the active graph');
select is(public.get_routing_conditions_snapshot('test-a', 'test-a@2026-10-13#cccccccccccc')->>'graphStatus', 'unregistered', 'Unknown graph versions are reported as unregistered');
select is(public.get_routing_conditions_snapshot('test-a', 'test-a@2026-10-13#cccccccccccc')->'closures'->0->'edgeIds', 'null'::jsonb, 'Closures without a mapping stay listed as unmapped, never dropped');
reset role;

-- ---------------------------------------------------------------------------
-- Center availability, entrances and removal.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'b4000000-0000-0000-0000-00000000000a';
update public.evacuation_centers set availability = 'available', routing_revision = 999
 where id = 'e4000000-0000-0000-0000-000000000001';
select is((select routing_revision from public.evacuation_centers where id = 'e4000000-0000-0000-0000-000000000001'),
  (select revision from public.routing_areas where id = 'test-a'), 'Availability change takes the area revision (client value ignored)');
select ok((select availability_updated_at is not null from public.evacuation_centers where id = 'e4000000-0000-0000-0000-000000000001'), 'Availability change time is recorded');
update public.evacuation_centers set contact_number = '0917' where id = 'e4000000-0000-0000-0000-000000000002';
select is((select routing_revision from public.evacuation_centers where id = 'e4000000-0000-0000-0000-000000000002'), 2::bigint,
  'Non-routing edits do not change the center revision');
select is((select count(*)::int from public.routing_condition_events where entity_id = 'e4000000-0000-0000-0000-000000000002' and action = 'updated'), 0, 'Non-routing edits add no routing history');

select throws_ok($$ select public.set_evacuation_center_entrance('e4000000-0000-0000-0000-000000000001', 'test-a@2026-10-12#aaaaaaaaaaaa', 'n7', 14.6900, 121.1100) $$,
  '22023', null, 'Entrances more than 250 m away are rejected');
select lives_ok($$ select public.set_evacuation_center_entrance('e4000000-0000-0000-0000-000000000001', 'test-a@2026-10-12#aaaaaaaaaaaa', 'n7', 14.6801, 121.1101) $$,
  'Administrator sets a reviewed entrance');
set local request.jwt.claim.sub = 'b4000000-0000-0000-0000-00000000000b';
select throws_ok($$ select public.set_evacuation_center_entrance('e4000000-0000-0000-0000-000000000002', 'test-a@2026-10-12#aaaaaaaaaaaa', 'n8', 14.6811, 121.1111) $$,
  '42501', null, 'Another barangay''s administrator cannot set entrances');
set local request.jwt.claim.sub = 'b4000000-0000-0000-0000-00000000000a';

set local role anon;
select is(public.get_routing_conditions_snapshot('test-a')->'centers'->0->>'entranceNodeId', 'n7', 'Snapshot carries the entrance node for the active graph');
select is(public.get_routing_conditions_snapshot('test-a')->'centers'->0->>'availability', 'available', 'Snapshot carries availability');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'b4000000-0000-0000-0000-00000000000a';

-- Moving a center invalidates its entrance (visible but unroutable until reviewed).
update public.evacuation_centers set position = '{"lat":14.6802,"lng":121.1102}' where id = 'e4000000-0000-0000-0000-000000000001';
select is((select entrance_position from public.evacuation_centers where id = 'e4000000-0000-0000-0000-000000000001'), null, 'Moving a center clears its entrance');
set local role anon;
select is(public.get_routing_conditions_snapshot('test-a')->'centers'->0->'entranceNodeId', 'null'::jsonb, 'A moved center is unroutable in the snapshot');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'b4000000-0000-0000-0000-00000000000a';
select lives_ok($$ select public.set_evacuation_center_entrance('e4000000-0000-0000-0000-000000000001', 'test-a@2026-10-12#aaaaaaaaaaaa', 'n7', 14.6803, 121.1103) $$,
  'Entrance can be reviewed again after a move');
set local request.jwt.claim.sub = 'b4000000-0000-0000-0000-00000000000b';
select throws_ok($$ select public.clear_evacuation_center_entrance('e4000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Another barangay''s administrator cannot clear entrances');
set local request.jwt.claim.sub = 'b4000000-0000-0000-0000-00000000000a';
select lives_ok($$ select public.clear_evacuation_center_entrance('e4000000-0000-0000-0000-000000000001') $$, 'Administrator clears an entrance');
select is((select count(*)::int from public.evacuation_center_entrance_nodes where center_id = 'e4000000-0000-0000-0000-000000000001'), 0,
  'Clearing an entrance removes its graph mappings');
select lives_ok($$ select public.set_evacuation_center_entrance('e4000000-0000-0000-0000-000000000001', 'test-a@2026-10-12#aaaaaaaaaaaa', 'n7', 14.6803, 121.1103) $$,
  'Entrance can be set again after clearing');

-- Deactivation, archive (soft delete) and hard delete reach cached clients.
update public.evacuation_centers set is_active = false where id = 'e4000000-0000-0000-0000-000000000002';
update public.evacuation_centers set deleted_at = now() where id = 'e4000000-0000-0000-0000-000000000003';
reset role;
set local role anon;
select is((select c->>'active' from jsonb_array_elements(public.get_routing_conditions_snapshot('test-a')->'centers') c where c->>'id' = 'e4000000-0000-0000-0000-000000000002'),
  'false', 'Deactivated centers stay in the snapshot as inactive');
select ok((select c->'position' = 'null'::jsonb from jsonb_array_elements(public.get_routing_conditions_snapshot('test-a')->'centers') c where c->>'id' = 'e4000000-0000-0000-0000-000000000002'),
  'Inactive centers expose no routable position');
select ok(exists (select 1 from jsonb_array_elements(public.get_routing_conditions_snapshot('test-a')->'tombstones') t
  where t->>'id' = 'e4000000-0000-0000-0000-000000000003' and t->>'entityType' = 'evacuation_center'), 'Archived centers become tombstones');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'b4000000-0000-0000-0000-00000000000a';
delete from public.evacuation_centers where id = 'e4000000-0000-0000-0000-000000000002';
reset role;
set local role anon;
select ok(exists (select 1 from jsonb_array_elements(public.get_routing_conditions_snapshot('test-a')->'tombstones') t
  where t->>'id' = 'e4000000-0000-0000-0000-000000000002'), 'Hard-deleted centers become tombstones');
select is(jsonb_array_length(public.get_routing_conditions_snapshot('test-a')->'centers'), 1, 'Removed centers leave the center list');
reset role;

-- ---------------------------------------------------------------------------
-- Reopening.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'b4000000-0000-0000-0000-00000000000a';
select throws_ok($$ select public.reopen_road_closure((select id from r4_ids where name = 'closure1'), '  ') $$,
  '22023', null, 'Reopening needs a reason');
update r4_ids set revision = (public.reopen_road_closure(id, 'Water receded; DRRM inspected')->>'revision')::bigint where name = 'closure1';
select throws_ok($$ select public.reopen_road_closure((select id from r4_ids where name = 'closure1'), 'Again') $$,
  '55000', null, 'A closure is reopened only once');
reset role;
set local role anon;
select is(jsonb_array_length(public.get_routing_conditions_snapshot('test-a')->'closures'), 0, 'Reopened closures leave the active list');
select is((select (t->>'revision')::bigint from jsonb_array_elements(public.get_routing_conditions_snapshot('test-a')->'tombstones') t
  where t->>'id' = (select id::text from r4_ids where name = 'closure1')), (select revision from r4_ids where name = 'closure1'),
  'Reopened closures appear as tombstones at the reopening revision');
reset role;

-- ---------------------------------------------------------------------------
-- Graph updates cannot discard closures or entrances.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'b4000000-0000-0000-0000-00000000000a';
insert into r4_ids
select 'closure2', (r->>'id')::uuid, (r->>'revision')::bigint
  from (select public.publish_road_closure('test-a', 'test-a@2026-10-12#aaaaaaaaaaaa', array['w9:1-2'], array['osm:way/9/1-2'],
          '{"type":"MultiLineString","coordinates":[[[121.110,14.681],[121.111,14.681]]]}', 'Bridge', 'Bridge approach collapsed', now()) as r) s;
select is((public.register_routing_graph_version('test-a', 'test-a@2026-10-20#dddddddddddd', false)->>'active')::boolean, false, 'A second graph can be registered without activation');
select throws_ok($$ select public.register_routing_graph_version('test-a', 'test-a@2026-10-20#dddddddddddd', true) $$,
  '55000', null, 'Activation is refused while a closure or entrance is unmapped');
select throws_ok($$ select public.map_road_closure_edges((select id from r4_ids where name = 'closure2'), 'test-a@2026-10-12#aaaaaaaaaaaa', array['w9:1-2']) $$,
  '55000', null, 'Mappings on the active graph cannot be changed');
select lives_ok($$ select public.map_road_closure_edges((select id from r4_ids where name = 'closure2'), 'test-a@2026-10-20#dddddddddddd', array['w9:1-2a','w9:2a-2']) $$,
  'Closure is mapped onto the new graph');
select throws_ok($$ select public.register_routing_graph_version('test-a', 'test-a@2026-10-20#dddddddddddd', true) $$,
  '55000', null, 'Activation still waits for the unmapped entrance');
select lives_ok($$ select public.map_evacuation_center_entrance('e4000000-0000-0000-0000-000000000001', 'test-a@2026-10-20#dddddddddddd', 'n7') $$,
  'Entrance is mapped onto the new graph');
select is((public.register_routing_graph_version('test-a', 'test-a@2026-10-20#dddddddddddd', true)->>'active')::boolean, true, 'Activation succeeds once every restriction is mapped');
reset role;
set local role anon;
select is(public.get_routing_conditions_snapshot('test-a')->'closures'->0->'edgeIds', '["w9:1-2a", "w9:2a-2"]'::jsonb, 'Snapshot of the new active graph uses its mapping');
select is(public.get_routing_conditions_snapshot('test-a', 'test-a@2026-10-12#aaaaaaaaaaaa')->>'graphStatus', 'registered', 'Previous graph stays registered for devices that still hold it');
select is(public.get_routing_conditions_snapshot('test-a', 'test-a@2026-10-12#aaaaaaaaaaaa')->'closures'->0->'edgeIds', '["w9:1-2"]'::jsonb, 'Previous graph keeps its own mapping');
reset role;

-- Revisions are strictly increasing across the history.
select is((select count(*)::int from (select revision, lag(revision) over (order by id) as prev from public.routing_condition_events where area_id = 'test-a') h
  where prev is not null and revision <= prev), 0, 'History revisions strictly increase');
select is((select max(revision) from public.routing_condition_events where area_id = 'test-a'), (select revision from public.routing_areas where id = 'test-a'),
  'The area revision equals the latest history revision');

select * from finish();
rollback;
