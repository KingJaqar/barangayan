#!/usr/bin/env bash
# P20-T06: rehearse the backend rollback of migrations 0135/0136 on a DISPOSABLE clone of the local development database.
# It never touches the `postgres` database or any hosted project: it clones into a new database, works there and drops it at the end.
# Needs Docker with the local Supabase stack running (container supabase_db_barangayan). Run from the repository root:
#   bash plans/evidence/resident-ios-parity/phase-20/rollback-rehearsal.sh
# Stages: A baseline at the hosted state (0118-0134) -> B forward 0135/0136 + their suites -> C rollback + baseline suites again
#         + leftover-object check -> D roll forward again + their suites. Exit 1 if any stage deviates.
set -u
export MSYS_NO_PATHCONV=1
CONTAINER=supabase_db_barangayan
DB=p20_rollback
FAIL=0
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../../../.." && pwd)

admin() { docker exec -i "$CONTAINER" psql -U supabase_admin -d postgres "$@"; }
db() { docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -At "$@"; }

# Suites that must be identical before 0135 and after the rollback (none reference the notification or deletion objects).
BASE_SUITES="rls_isolation resident_ios_phase3_requests resident_ios_phase3_storage resident_ios_tenant_write_guards resident_household_conditional automatic_document_payments resident_account_setup resident_apple_account_setup resident_front_id_submission resident_profile_conflict trusted_evidence_locality unreferenced_upload_objects resident_directory_admin_visibility google_minimal_profiles document_charter_forms"
NEW_SUITES="resident_ios_phase17_notifications resident_ios_phase18_account_deletion resident_ios_phase3_backend service_foundations"

run_suites() { # <label> <suites...>
  local label=$1; shift
  local ok=0 bad=0
  for suite in "$@"; do
    out=$(db < "$root/supabase/tests/$suite.test.sql" 2>&1)
    o=$(printf '%s\n' "$out" | grep -cE '^ok ')
    n=$(printf '%s\n' "$out" | grep -cE '^not ok ')
    e=$(printf '%s\n' "$out" | grep -ciE '^psql:.*error|^error:')
    printf '  %-48s ok=%-4s not_ok=%-3s errors=%s\n' "$suite" "$o" "$n" "$e"
    ok=$((ok + o)); bad=$((bad + n + e))
  done
  echo "$label: $ok assertions ok, $bad failing/erroring"
  [ "$bad" -eq 0 ] || FAIL=1
  LAST_OK=$ok
}
apply() { for f in "$@"; do db < "$root/supabase/migrations/$f" > /dev/null 2>&1 && echo "  applied $f" || { echo "  FAILED $f"; FAIL=1; }; done; }
leftovers() {
  db -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('set_notification_preferences','release_push_token','notification_worker_claim','notification_worker_record_tickets','notification_worker_fail','notification_worker_due_receipts','notification_worker_record_receipts','notification_worker_health','notification_worker_purge','erase_own_account_records','set_account_deletion_state')) or (n.nspname='barangayan_private' and p.proname in ('valid_notification_destination','emit_notification','notify_request_change','notify_incident_change','notify_announcement','notify_medical_drive','notify_drive_registration','notification_retry','deletion_state_rank'))"
  db -c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and c.relname in ('notification_preferences','notification_inbox','notification_events','notification_outbox','notification_deliveries','account_deletion_requests')"
  db -c "select count(*) from pg_trigger where tgname like 'z\_notify\_%' and not tgisinternal"
}

echo "== clone =="
docker exec "$CONTAINER" sh -c "pg_dump -U supabase_admin -Fc -d postgres -f /tmp/$DB.dump" || exit 1
docker exec "$CONTAINER" dropdb -U supabase_admin --if-exists "$DB"
docker exec "$CONTAINER" createdb -U supabase_admin -O postgres "$DB" || exit 1
docker exec "$CONTAINER" sh -c "pg_restore -U supabase_admin -d $DB /tmp/$DB.dump" > /dev/null 2>&1 # pg_cron/realtime ownership errors are expected
docker exec "$CONTAINER" psql -U supabase_admin -d postgres -c "alter database $DB owner to postgres" > /dev/null
echo "clone $DB ready; last applied migration in the clone: $(db -c 'select max(version) from supabase_migrations.schema_migrations')"

echo "== stage A: hosted state (repository migrations 0118-0134 on the 0117 clone) =="
apply $(cd "$root/supabase/migrations" && ls 011[89]_*.sql 012?_*.sql 013[0-4]_*.sql)
run_suites "A baseline" $BASE_SUITES
A_OK=$LAST_OK
echo "  leftover objects before 0135/0136 (functions, tables, triggers): $(leftovers | tr '\n' ' ')"

echo "== stage B: forward 0135 and 0136 =="
apply 0135_resident_notifications.sql 0136_account_deletion_state.sql
run_suites "B new suites" $NEW_SUITES
run_suites "B baseline suites with 0135/0136 live" $BASE_SUITES

echo "== stage C: rollback =="
out=$(db < "$here/rollback-0135-0136.sql" 2>&1) && echo "  rollback-0135-0136.sql applied" || { echo "  ROLLBACK FAILED: $(echo "$out" | grep -iE 'error|rollback_refused' | head -3)"; FAIL=1; }
LEFT=$(leftovers | tr '\n' ' ')
echo "  leftover objects (functions, tables, triggers): $LEFT"
[ "$LEFT" = "0 0 0 " ] || FAIL=1
run_suites "C baseline after rollback" $BASE_SUITES
[ "$LAST_OK" -eq "$A_OK" ] || { echo "  DEVIATION: $LAST_OK assertions after rollback, $A_OK at baseline"; FAIL=1; }
echo "  Android/web v1 deletion RPC still present: $(db -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='request_own_account_deletion'")"
echo "  push token objects still present (push_tokens table, upsert_push_token): $(db -c "select (select count(*) from pg_class where relname='push_tokens' and relkind='r') || ' ' || (select count(*) from pg_proc where proname='upsert_push_token')")"

echo "== stage C2: the guard refuses to roll back while a deletion is unfinished =="
apply 0135_resident_notifications.sql 0136_account_deletion_state.sql
PROFILE=$(db -c "select id from public.profiles limit 1")
db -c "insert into public.account_deletion_requests(user_id,state) values ('$PROFILE','needs_attention')" > /dev/null
out=$(db < "$here/rollback-0135-0136.sql" 2>&1) && { echo "  GUARD FAILED: rollback ran with an unfinished deletion"; FAIL=1; } || { echo "$out" | grep -q rollback_refused && echo "  refused as designed (rollback_refused)" || { echo "  REFUSED FOR ANOTHER REASON: $(echo "$out" | grep -i error | head -2)"; FAIL=1; }; }
echo "  state table still intact after the refusal: $(db -c 'select count(*) from public.account_deletion_requests')"
db -c "delete from public.account_deletion_requests" > /dev/null

echo "== stage D: roll forward again after the rollback (clone currently has 0135/0136 re-applied) =="
run_suites "D new suites after roll-forward" $NEW_SUITES

echo "== cleanup =="
docker exec "$CONTAINER" dropdb -U supabase_admin --if-exists "$DB"
docker exec "$CONTAINER" rm -f "/tmp/$DB.dump"
echo "clone $DB dropped"
[ "$FAIL" -eq 0 ] && echo "REHEARSAL RESULT: PASS" || echo "REHEARSAL RESULT: FAIL"
exit "$FAIL"
