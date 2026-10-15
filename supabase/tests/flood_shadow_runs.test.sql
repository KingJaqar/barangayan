-- R8 BFS shadow storage (0120): service-role-only publication, supersession and
-- graph guards, identity checks, bounded history, administrator read scope.
begin;
select plan(37);

insert into public.barangays (id, name) values
  ('a8000000-0000-0000-0000-000000000001', 'Shadow Barangay A'),
  ('a8000000-0000-0000-0000-000000000002', 'Shadow Barangay B');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at) values
  ('b8000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'shadow-admin-a@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b8000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'shadow-admin-b@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now()),
  ('b8000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'shadow-resident-a@test.local', '', now(), '', '', '', '', '{}'::jsonb, '{}'::jsonb, false, now(), now());

insert into public.profiles (id, barangay_id, role, full_name) values
  ('b8000000-0000-0000-0000-00000000000a', 'a8000000-0000-0000-0000-000000000001', 'admin', 'Shadow Admin A'),
  ('b8000000-0000-0000-0000-00000000000b', 'a8000000-0000-0000-0000-000000000002', 'admin', 'Shadow Admin B'),
  ('b8000000-0000-0000-0000-00000000000c', 'a8000000-0000-0000-0000-000000000001', 'resident', 'Shadow Resident A')
on conflict (id) do update set barangay_id = excluded.barangay_id, role = excluded.role, full_name = excluded.full_name;

insert into public.routing_areas (id, barangay_id, name) values
  ('shadow-a', 'a8000000-0000-0000-0000-000000000001', 'Shadow Area A'),
  ('shadow-b', 'a8000000-0000-0000-0000-000000000002', 'Shadow Area B');

-- Reports as the function builds them (identity fields only; the rest is opaque here).
create function public.test_shadow_report(p_area text, p_graph text, p_snapshot text, p_status text, p_influence text default 'none')
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'areaId', p_area, 'graphVersion', p_graph, 'snapshotId', p_snapshot, 'modelStatus', p_status,
    'residentInfluence', p_influence, 'readings', jsonb_build_array(jsonb_build_object('stationId', 's', 'observedAt', 1, 'levelMeters', 15.5)));
$$;
grant execute on function public.test_shadow_report(text, text, text, text, text) to service_role;

-- Activate a graph for area A through the administrator RPC.
set local role authenticated;
set local request.jwt.claim.sub = 'b8000000-0000-0000-0000-00000000000a';
select is((public.register_routing_graph_version('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', true)->>'active')::boolean, true, 'Setup: area A has an active graph');
select is((public.register_routing_graph_version('shadow-a', 'shadow-a@2026-10-13#bbbbbbbbbbbb', false)->>'active')::boolean, false, 'Setup: a second graph is registered but inactive');
reset role;

-- ---------------------------------------------------------------------------
-- Only the service role publishes, and only through the function.
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('1', 64), now(), 'ok', public.test_shadow_report('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('1', 64), 'ok')) $$,
  '42501', null, 'Anonymous callers cannot publish');
select throws_ok($$ select * from public.flood_shadow_runs $$, '42501', null, 'Anonymous callers cannot read runs');
select throws_ok($$ select public.get_flood_shadow_history('shadow-a') $$, '42501', null, 'Anonymous callers cannot read history');
reset role;

set local role authenticated;
set local request.jwt.claim.sub = 'b8000000-0000-0000-0000-00000000000a';
select throws_ok($$ select public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('1', 64), now(), 'ok', public.test_shadow_report('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('1', 64), 'ok')) $$,
  '42501', null, 'Administrators cannot publish');
select throws_ok($$ insert into public.flood_shadow_runs (area_id, graph_version, snapshot_id, evaluated_at, model_status, report)
  values ('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('2', 64), now(), 'ok', '{}') $$,
  '42501', null, 'Administrators cannot insert directly');
reset role;

set local role service_role;
select throws_ok($$ insert into public.flood_shadow_runs (area_id, graph_version, snapshot_id, evaluated_at, model_status, report)
  values ('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('2', 64), now(), 'ok', '{}') $$,
  '42501', null, 'The service role cannot insert directly either');

-- ---------------------------------------------------------------------------
-- Publication
-- ---------------------------------------------------------------------------
select is(
  public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('1', 64), now() - interval '10 minutes', 'unavailable',
    public.test_shadow_report('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('1', 64), 'unavailable'))->>'status',
  'published', 'A run for the active graph is published');

select is(
  public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('1', 64), now() - interval '10 minutes', 'unavailable',
    public.test_shadow_report('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('1', 64), 'unavailable'))->>'status',
  'duplicate', 'Publishing the same snapshot again is idempotent');

select is(
  public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('3', 64), now() - interval '20 minutes', 'ok',
    public.test_shadow_report('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('3', 64), 'ok')),
  jsonb_build_object('status', 'rejected', 'reason', 'superseded'), 'A run older than the newest stored one is superseded');

select is(
  public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('4', 64), now() - interval '10 minutes', 'ok',
    public.test_shadow_report('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('4', 64), 'ok'))->>'reason',
  'superseded', 'A different run evaluated at the same time does not replace the stored one');

select is(
  public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('5', 64), now() - interval '5 minutes', 'degraded',
    public.test_shadow_report('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('5', 64), 'degraded'))->>'status',
  'published', 'A newer run is published');

select is(
  public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-13#bbbbbbbbbbbb', repeat('6', 64), now(), 'ok',
    public.test_shadow_report('shadow-a', 'shadow-a@2026-10-13#bbbbbbbbbbbb', repeat('6', 64), 'ok')),
  jsonb_build_object('status', 'rejected', 'reason', 'graph_not_active'), 'A run computed on a graph that is not active is refused');

select is(
  public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('7', 64), now() + interval '1 hour', 'ok',
    public.test_shadow_report('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('7', 64), 'ok'))->>'reason',
  'evaluated_in_future', 'A run evaluated in the future is refused');

select is((select count(*)::int from public.flood_shadow_runs where area_id = 'shadow-a'), 2, 'Only accepted runs are stored');

-- ---------------------------------------------------------------------------
-- Input validation
-- ---------------------------------------------------------------------------
select throws_ok($$ select public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', 'not-a-hash', now(), 'ok',
  public.test_shadow_report('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', 'not-a-hash', 'ok')) $$, '22023', null, 'A malformed snapshot id is refused');
select throws_ok($$ select public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('8', 64), now(), 'nonsense',
  public.test_shadow_report('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('8', 64), 'nonsense')) $$, '22023', null, 'An unknown model status is refused');
select throws_ok($$ select public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('8', 64), now(), 'ok', null) $$,
  '22023', null, 'A missing report is refused');
select throws_ok($$ select public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('8', 64), now(), 'ok',
  public.test_shadow_report('shadow-b', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('8', 64), 'ok')) $$, '22023', null, 'A report for another area is refused');
select throws_ok($$ select public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('8', 64), now(), 'ok',
  public.test_shadow_report('shadow-a', 'shadow-a@2026-10-13#bbbbbbbbbbbb', repeat('8', 64), 'ok')) $$, '22023', null, 'A report for another graph version is refused');
select throws_ok($$ select public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('8', 64), now(), 'ok',
  public.test_shadow_report('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('9', 64), 'ok')) $$, '22023', null, 'A report with another snapshot id is refused');
select throws_ok($$ select public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('8', 64), now(), 'ok',
  public.test_shadow_report('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('8', 64), 'degraded')) $$, '22023', null, 'A report with another model status is refused');
select throws_ok($$ select public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('8', 64), now(), 'ok',
  public.test_shadow_report('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('8', 64), 'ok', 'applied')) $$, '22023', null, 'A report claiming resident influence is refused');
select throws_ok($$ select public.publish_flood_shadow_run('shadow-zzz', 'shadow-zzz@2026-10-12#aaaaaaaaaaaa', repeat('8', 64), now(), 'ok',
  public.test_shadow_report('shadow-zzz', 'shadow-zzz@2026-10-12#aaaaaaaaaaaa', repeat('8', 64), 'ok')) $$, 'P0002', null, 'An unknown area is reported');

-- ---------------------------------------------------------------------------
-- History
-- ---------------------------------------------------------------------------
select is(jsonb_array_length(public.get_flood_shadow_history('shadow-a')), 2, 'History lists the stored runs');
select is(public.get_flood_shadow_history('shadow-a', 1)->0->0->>'stationId', 's', 'History entries are the raw reading lists');
select is(public.get_flood_shadow_history('shadow-b'), '[]'::jsonb, 'An area without runs has an empty history');
select throws_ok($$ select public.get_flood_shadow_history('shadow-a', 0) $$, '22023', null, 'A zero history limit is refused');
select throws_ok($$ select public.get_flood_shadow_history('shadow-a', 25) $$, '22023', null, 'A history limit above 24 is refused');
reset role;

-- ---------------------------------------------------------------------------
-- Administrators read their own area's runs only.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'b8000000-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.flood_shadow_runs), 2, 'An administrator reads their own area''s runs');
set local request.jwt.claim.sub = 'b8000000-0000-0000-0000-00000000000b';
select is((select count(*)::int from public.flood_shadow_runs), 0, 'Another barangay''s administrator reads none');
set local request.jwt.claim.sub = 'b8000000-0000-0000-0000-00000000000c';
select is((select count(*)::int from public.flood_shadow_runs), 0, 'Residents read none');
reset role;

-- ---------------------------------------------------------------------------
-- Bounded history: only the newest 500 runs per area are kept.
-- ---------------------------------------------------------------------------
insert into public.flood_shadow_runs (area_id, graph_version, snapshot_id, evaluated_at, model_status, report)
select 'shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', lpad(to_hex(n), 64, '0'), now() - interval '1 day' - (n || ' minutes')::interval, 'unavailable', '{}'::jsonb
from generate_series(1, 510) n;

set local role service_role;
select is(
  public.publish_flood_shadow_run('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('b', 64), now() - interval '1 minute', 'ok',
    public.test_shadow_report('shadow-a', 'shadow-a@2026-10-12#aaaaaaaaaaaa', repeat('b', 64), 'ok'))->>'status',
  'published', 'Publishing still works with a long history');
reset role;
select is((select count(*)::int from public.flood_shadow_runs where area_id = 'shadow-a'), 500, 'Only the newest 500 runs are kept');
select ok(exists (select 1 from public.flood_shadow_runs where snapshot_id = repeat('b', 64)), 'The newest run survives pruning');
select ok(not exists (select 1 from public.flood_shadow_runs where snapshot_id = lpad(to_hex(510), 64, '0')), 'The oldest runs are pruned');

select * from finish();
rollback;
