#!/bin/bash
# R16 kit — brings up the isolated backend for a physical-phone test, reachable on the LAN.
# Needs Docker Desktop + the repo's local Supabase stack running (supabase_db_barangayan). Creates only notif_r16_* objects.
# Output: the LAN URL to build the app against, the tester password file, and the PostgREST secret hint.
set -e
export MSYS_NO_PATHCONV=1
DB=notif_r16_20261028
TEMPLATE=${TEMPLATE:-notif_p5_20261028}      # a notif_* clone that already has migrations 0145-0149 applied
KIT=$(cd "$(dirname "$0")" && pwd)
WORK=${WORK:-$KIT/../../../../../tmp/r16-work}; mkdir -p "$WORK"; WORK=$(cd "$WORK" && pwd)
WIN=$(cygpath -m "$WORK")
docker exec supabase_db_barangayan psql -U postgres -c "drop database if exists $DB" -c "create database $DB template $TEMPLATE"
# the pg_dump-made template lacks realtime.list_changes (Realtime CDC errors without it): copy it from the dev DB
docker exec supabase_db_barangayan psql -U supabase_admin -d postgres -Atc "select pg_get_functiondef('realtime.list_changes(name,name,integer,integer)'::regprocedure)" > "$WORK/list_changes.sql"
docker exec -i supabase_db_barangayan psql -U supabase_admin -d $DB -X -q < "$WORK/list_changes.sql"
docker exec supabase_db_barangayan psql -U supabase_admin -d $DB -Atc "alter function realtime.list_changes(name,name,integer,integer) owner to supabase_admin; grant execute on function realtime.list_changes(name,name,integer,integer) to postgres, anon, authenticated, service_role"
# GoTrue needs its schema owned by supabase_auth_admin in a clone
docker exec supabase_db_barangayan psql -U supabase_admin -d $DB -Atc "
do \$\$ declare r record; begin
for r in select tablename from pg_tables where schemaname='auth' loop execute format('alter table auth.%I owner to supabase_auth_admin', r.tablename); end loop;
for r in select sequence_name from information_schema.sequences where sequence_schema='auth' loop execute format('alter sequence auth.%I owner to supabase_auth_admin', r.sequence_name); end loop;
for r in select t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='auth' and t.typtype='e' loop execute format('alter type auth.%I owner to supabase_auth_admin', r.typname); end loop;
end \$\$; alter schema auth owner to supabase_auth_admin;"
# seed the tester data (gates are switched on inside this clone only)
docker exec -i supabase_db_barangayan psql -U supabase_admin -d $DB -X -q -v ON_ERROR_STOP=1 < "$KIT/seed.sql"
# containers: GoTrue, PostgREST, Realtime with the CLI containers' env and the DB swapped
for c in auth rest realtime; do docker inspect supabase_${c}_barangayan --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -v '^PATH=' > "$WORK/env_$c.raw"; done
LAN=$(ipconfig | grep -E "IPv4" | grep -o "192\.168\.[0-9]*\.[0-9]*\|10\.[0-9]*\.[0-9]*\.[0-9]*" | head -1)
sed "s#/postgres#/$DB#g" "$WORK/env_auth.raw" | grep -v '^GOTRUE_SITE_URL' > "$WORK/env_auth.env"
sed "s#/postgres#/$DB#g" "$WORK/env_rest.raw" > "$WORK/env_rest.env"
grep -v -E '^(DB_NAME|SLOT_NAME_SUFFIX|PORT)=' "$WORK/env_realtime.raw" > "$WORK/env_realtime.env"
docker rm -f r16_auth r16_rest r16_rt >/dev/null 2>&1 || true
docker run -d --name r16_auth --network supabase_network_barangayan --env-file "$WIN/env_auth.env" -e GOTRUE_SITE_URL=http://$LAN:58520 -e API_EXTERNAL_URL=http://$LAN:58520 -e GOTRUE_MAILER_AUTOCONFIRM=true -p 58521:9999 public.ecr.aws/supabase/gotrue:v2.197.0 >/dev/null
docker run -d --name r16_rest --network supabase_network_barangayan --env-file "$WIN/env_rest.env" -p 58522:3000 public.ecr.aws/supabase/postgrest:v14.5 >/dev/null
docker run -d --name r16_rt --network supabase_network_barangayan --env-file "$WIN/env_realtime.env" -e DB_NAME=$DB -e SLOT_NAME_SUFFIX=r16 -e PORT=4000 -e RUN_JANITOR=false -p 58523:4000 public.ecr.aws/supabase/realtime:v2.135.3 >/dev/null
sleep 8
SERVICE=$(cd "$KIT/../../../../.." && npx supabase status -o env 2>/dev/null | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2- | tr -d '"')
PW="R16$(openssl rand -hex 6)!a"; echo "$PW" > "$WORK/tester-password.txt"
for id in 5e0d0000-0000-4000-8000-0000000000a1 5e0d0000-0000-4000-8000-0000000000a4; do
  curl -s -o /dev/null -X PUT "http://localhost:58521/admin/users/$id" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" -d "{\"password\":\"$PW\",\"email_confirm\":true}"
done
# the proxy maps /auth/v1, /rest/v1, /realtime/v1 on one LAN port (58520) — edit the ports in proxy.cjs if you change them above
sed -e 's/58421/58521/g; s/58422/58522/g; s/58423/58523/g; s/58420/58520/g' "$KIT/proxy.cjs" > "$WORK/proxy-r16.cjs"
echo "Start the proxy:   node $WORK/proxy-r16.cjs        (listens on 0.0.0.0:58520; allow it through Windows Firewall for your Wi-Fi/private network)"
echo "App backend URL:   http://$LAN:58520"
echo "Anon key:          npx supabase status -o env   (ANON_KEY)"
echo "Tester login:      rwfb-populated@test.local   password in $WORK/tester-password.txt"
echo "Second account:    rwfb-other@test.local (same password) for the account-isolation case"
