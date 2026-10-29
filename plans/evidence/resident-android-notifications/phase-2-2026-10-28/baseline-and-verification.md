# Phase 2 baseline and verification — 2026-10-28

Source identity: HEAD `9fe8add1` + working copy; owned-file hashes in [context-index.md](context-index.md). Full logs: `C:/Users/User/barangayan/tmp/resident-notifications-phase2-20261028/logs/` (not committed). Node v24.13.1. DB = disposable clone `notif_p2_20261028` (= `notif_p1_20261028` + 0146) in `supabase_db_barangayan`; the local dev `postgres` DB and hosted were not touched.

## Baseline (before any edit)

| # | Command (cwd) | Exit | Result |
|---|---|---|---|
| P2-B01 | `npx vitest run tests/notification-worker.test.ts tests/notifications.test.ts` (ios) | 0 | 2 files / 81 tests |
| P2-B02 | phase-1 identity check: sha256 of 0145 and its pgTAP file | — | equal to the phase-1 record |
| P2-B03 | Android tsc / lint / vitest | not re-run | no Android file is part of this phase; phase-1 results (0 errors, 0 errors + 1 pre-existing warning, 343/343) stand |

## After the change

| # | Command | Result | vs baseline |
|---|---|---|---|
| P2-V01 | `psql -v ON_ERROR_STOP=1 -f 0146` on a fresh clone of p1; re-applied to the migrated clone | applied; idempotent | — |
| P2-V02 | pgTAP `resident_android_notification_producers` (new) | **125/125**, no `WARNING: notify_* failed` in the log | new |
| P2-V03 | pgTAP `resident_android_notification_hub` | 162/162 (after resetting the clone's phase-1 reconciliation boundary) | = phase 1 |
| P2-V04 | `NOTIF_TEST_DB=… node supabase/tests/notification_hub_concurrency.mjs` | snapshot / serialized / rollback pass | = phase 1 |
| P2-V05 | `NOTIF_TEST_DB=… node supabase/tests/notification_transport_i1.mjs` (new, **I1**) | 8/8 scenarios (below) | new |
| P2-V06 | pgTAP regression on the clone: phase17 121/121, phase18 deletion 56/56, rls_isolation 17/17, admin_incident_withdrawal 23/23, automatic_document_payments 65/65, admin_request_status_editor 61/61, resident_front_id_submission 26/26, resident_email_verification 13/13, editable_document_fees 40/40 | all green | identical to phase 0/1 |
| P2-V07 | the same suites with the gate **on** (emission + v2 alerts) for setup, email, fees, deletion, withdrawal, payments, status editor, front ID, phase17 | all green; no producer warning in any log | — |
| P2-V08 | `service_foundations` 108/115 (#41, 59–61, 76–77, 79), `admin_request_row_workflows` 42/43 (#30) | same failing IDs | pre-existing (D19) |
| P2-V09 | `resident_account_setup` 29/31, `resident_apple_account_setup` 36/37 | `idSubmitted` expectations from a **concurrent session's** uncommitted 0147 + test edits (F34); identical on the phase-1 clone with the gate off | not this phase |
| P2-V10 | `npx vitest run tests/notification-worker.test.ts tests/notifications.test.ts` (ios) | 2 files / **86** tests (+5 worker v2 / notice-step cases), 0 failures | +5 |
| P2-V11 | `npx tsc --noEmit` (ios; includes `worker.ts` through its test) | 0 errors | = |

## I1 scenarios (P2-V05, `notification_transport_i1.mjs`)

Real writers on the disposable DB → inbox/outbox → `notification_worker_claim` as `service_role` → the repository's `runWorker` → the push body → the Android `parseNotificationDestination`. Only Expo is simulated.

1. Staff profile edit → 1 event, 1 outbox row, 1 push with `data = {v:2,kind:'account',screen:'profile',inbox}`, parser round-trip, no profile value in the payload, outbox `sent`.
2. Repeat run → 0 claimed, 0 sent, event count unchanged.
3. Operator-published System notice → worker's due step delivers to exactly the 2 residents of the audience (none of another barangay), 1 push (`{v:2,kind:'notice',id,inbox}`), the resident without a device is `skipped/no_token` yet keeps history.
4. Resident registered later → catch-up inserts history, no alert, no claim; next run delivers 0 (terminates).
5. Material revision → new key per recipient (6 events = 2 revisions × 3 residents), 1 alert.
6. Legacy incident status change → `{v:1,kind:'incident',id,inbox}` unchanged.
7. Provider outage (503): attempts capped at 5, outbox `dead`, ≤ 15 provider requests in total (5 × 3), sixth run claims nothing.
8. Resident opt-out → outbox `skipped/opted_out`, history kept, nothing sent.

## Acceptance (phase-2 portions)

| Gate | Evidence | Status |
|---|---|---|
| R03 backend | every enabled Account row has a trusted producer, owner, filter and destination (producer map); System rows via the phase-1 operator functions + due step; `A12` activation reconcile | Met (DB); UI destinations are phase 3/4 |
| R07 | one event and one alert path per occurrence; retry/duplicate/repeated-status cases; refund stage collapse | Met (DB + I1); provider-side presentation uncertainty stays I3 |
| R09 | recipient filter (resident, not deleted, completed profile, matching barangay); foreign/deleted/staff recipients get nothing; reconcile/emit functions not executable by residents, guests or `service_role` directly | Met (DB) |
| R10 backend | v1 unchanged end to end; v2 account/notice validated at DB, worker and parser; 8 malformed destination shapes rejected by the worker; iOS ignores v2 pushes | Met; installed-iOS behaviour is unverified (D10) |
| R13 backend | reads/preferences create no events or outbox rows; catch-up/reconcile terminate; ≤100 per call; ≤5 attempts × 3 requests | Met |
| I1 | scenarios 1–8 | Met |

Not run (with reason): Android UI/lint/vitest/bundle (no Android change); Deno-native Edge runtime (the worker is Deno-free and runs in Node here; `index.ts` unchanged); MuMu/physical (phases 4–6); hosted DB/functions (not authorized, deployment unverified).
