#!/usr/bin/env bash
# R4 concurrent-publication check. Runs real parallel sessions against a DISPOSABLE
# database (never the dev database): DB=<name> bash concurrency.sh
set -euo pipefail
: "${TMPDIR_R4:?set TMPDIR_R4 to a scratch directory}"
export MSYS_NO_PATHCONV=1
DB="${DB:?set DB to the disposable database name}"
CONTAINER="${CONTAINER:-supabase_db_barangayan}"
psql_run() { docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -tA -q "$@"; }

ADMIN=c4000000-0000-0000-0000-00000000000a
GRAPH='conc-c@2026-10-12#eeeeeeeeeeee'
GEOM='{"type":"MultiLineString","coordinates":[[[121.110,14.680],[121.111,14.680]]]}'

psql_run <<SQL
insert into public.barangays (id, name) values ('c4000000-0000-0000-0000-000000000001', 'Concurrency Barangay') on conflict do nothing;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at)
values ('$ADMIN', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'conc-admin@test.local', '', now(), '', '', '', '', '{}', '{}', false, now(), now()) on conflict do nothing;
insert into public.profiles (id, barangay_id, role, full_name) values ('$ADMIN', 'c4000000-0000-0000-0000-000000000001', 'admin', 'Concurrency Admin')
on conflict (id) do update set barangay_id = excluded.barangay_id, role = excluded.role;
insert into public.routing_areas (id, barangay_id, name) values ('conc-c', 'c4000000-0000-0000-0000-000000000001', 'Concurrency Area') on conflict do nothing;
begin; set local role authenticated; set local request.jwt.claim.sub = '$ADMIN';
select public.register_routing_graph_version('conc-c', '$GRAPH', true);
commit;
SQL

BEFORE=$(psql_run -c "select revision from public.routing_areas where id = 'conc-c'")
echo "revision before: $BEFORE"

publish() {
  psql_run <<SQL
begin; set local role authenticated; set local request.jwt.claim.sub = '$ADMIN';
select 'published ' || (public.publish_road_closure('conc-c', '$GRAPH', array['w$1:1-2'], array['osm:way/$1/1-2'], '$GEOM', 'Street $1', 'Concurrent test', now())->>'revision');
select pg_sleep(2);
commit;
SQL
}

# Two publishers start together; the second must wait for the first's area lock.
publish 101 > "$TMPDIR_R4/pub1.out" 2>&1 &
P1=$!
publish 102 > "$TMPDIR_R4/pub2.out" 2>&1 &
P2=$!
sleep 1
# A reader during the open transactions sees the committed state only (no half-applied publication).
DURING=$(psql_run -c "select (s->>'revision') || ' closures=' || jsonb_array_length(s->'closures') from public.get_routing_conditions_snapshot('conc-c') s")
wait $P1 $P2
cat "$TMPDIR_R4/pub1.out" "$TMPDIR_R4/pub2.out"
echo "snapshot during open publications: $DURING"
psql_run -c "select 'after: revision=' || (s->>'revision') || ' closures=' || jsonb_array_length(s->'closures') || ' closure_revisions=' || (select string_agg(c->>'revision', ',' order by (c->>'revision')::int) from jsonb_array_elements(s->'closures') c) from public.get_routing_conditions_snapshot('conc-c') s"

# Two administrators reopen the same closure at once: exactly one succeeds.
CLOSURE=$(psql_run -c "select id from public.road_closures where area_id = 'conc-c' and label = 'Street 101'")
reopen() {
  psql_run <<SQL 2>&1 || true
begin; set local role authenticated; set local request.jwt.claim.sub = '$ADMIN';
select 'reopened ' || (public.reopen_road_closure('$CLOSURE', 'Concurrent reopen $1')->>'revision');
select pg_sleep(1);
commit;
SQL
}
reopen A > "$TMPDIR_R4/re1.out" &
R1=$!
reopen B > "$TMPDIR_R4/re2.out" &
R2=$!
wait $R1 $R2
cat "$TMPDIR_R4/re1.out" "$TMPDIR_R4/re2.out"
psql_run -c "select 'reopen events=' || count(*) from public.routing_condition_events where area_id = 'conc-c' and action = 'reopened'"
psql_run -c "select 'event revisions=' || string_agg(revision::text, ',' order by id) from public.routing_condition_events where area_id = 'conc-c'"
