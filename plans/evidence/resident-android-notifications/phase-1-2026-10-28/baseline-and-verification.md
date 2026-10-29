# Phase 1 baseline and verification — 2026-10-28

Source identity: HEAD `9fe8add1` + working copy; owned-file hashes in [context-index.md](context-index.md). Full logs: `C:/Users/User/barangayan/tmp/resident-notifications-phase1-20261028/logs/` (not committed). Node v24.13.1. Deadlines per plan §6.2. DB = disposable clone `notif_p1_20261028` (= `notif_p0_20261028` + 0145) in `supabase_db_barangayan`; local dev `postgres` DB and hosted were not touched.

## Baseline (before any edit, one run each)

| # | Command (cwd) | Exit | Result |
|---|---|---|---|
| P1-B01 | `npx tsc --noEmit` (android) | 0 | 0 errors |
| P1-B02 | `npx expo lint` (android) | 0 | 0 errors, 1 pre-existing warning `health-presentation.tsx:2:10` |
| P1-B03 | `npx vitest run` (android) | 0 | 32 files / 335 tests |
| P1-B04 | `npx vitest run tests/notification-worker.test.ts tests/notifications.test.ts` (ios) | 0 | 2 files / 80 tests |
| P1-B05 | pgTAP `resident_ios_phase17_notifications` on `notif_p0_20261028` | 0 | 121/121 |

## After the change

| # | Command | Exit | Result | vs baseline |
|---|---|---|---|---|
| P1-V01 | `psql -v ON_ERROR_STOP=1 -f 0145` on fresh clone from p0 | 0 | applied | — |
| P1-V02 | 0145 re-applied on the migrated clone | 0 | idempotent | — |
| P1-V03 | pgTAP `resident_android_notification_hub` (new) | 0 | **162/162** (run 2; run 1 found two real grant defects, F27/F28, fixed and the clone rebuilt) | new |
| P1-V04 | `NOTIF_TEST_DB=notif_p1_20261028 node supabase/tests/notification_hub_concurrency.mjs` (new) | 0 | snapshot (5 marked, late arrival unread), serialized (6 then 0; waiter seen on `advisory` lock), rollback (0 applied); fixtures removed, gate restored off | new (run 1 failed only on a process-exit timing assertion, replaced by the lock-wait check) |
| P1-V05 | pgTAP regression on `notif_p1_20261028`: phase17 121/121, phase18 deletion 56/56, rls_isolation 17/17, admin_incident_withdrawal 23/23, automatic_document_payments 65/65, admin_request_status_editor 61/61, resident_front_id_submission 26/26, resident_account_setup 30/30, resident_apple_account_setup 37/37, resident_email_verification 13/13, editable_document_fees 40/40 | 0 | all green | identical to phase-0 B14 |
| P1-V06 | pgTAP `service_foundations` 108/115, `admin_request_row_workflows` 42/43 | 0 | same failing IDs (#41, #59–61, #76–77, #79; #30) | pre-existing (D19), unchanged |
| P1-V07 | `npx tsc --noEmit` (android) | 0 | 0 errors | = |
| P1-V08 | `npx expo lint` (android) | 0 | 0 errors, same 1 pre-existing warning | = |
| P1-V09 | `npx vitest run` (android) | 0 | 33 files / 343 tests (+8 `notification-hub.test.ts`) | +8, 0 failures |
| P1-V10 | iOS worker + parser vitest | 0 | 2 files / 81 tests (+1 v2 fallback case) | +1, 0 failures |
| P1-V11 | `npx tsc --noEmit` (ios) | 0 | 0 errors | shared-type consumer |
| P1-V12 | `npx tsc --noEmit` (resident-web) | 0 | 0 errors | shared-type consumer |
| P1-V13 | Committed reconciliation on clone data | 0 | `0/0/0`, boundary recorded, `announcement_reads` identical to pre-snapshot | — |

## Acceptance (phase-1 portions)

| Gate | Evidence | Status |
|---|---|---|
| R02 stable disjoint keyset paging, full counts | pgTAP §5: 1,004 announcements + 1,100 inbox rows with tied `created_at`; walks 800/800 (32 pages), 200/200, 300/300, ordered; summary per source/scope; page cap 50, default 25 | Met (DB) |
| R03 enabled rows have a trusted path | Kinds/destinations/emitter in place, emission gated; producers are phase 2 | Partial by design (phase 2 / I1) |
| R04 atomic full-scope bulk, arrivals stay unread | pgTAP §6 (scoped counts, rows never paged in, fault injection rolls back everything, idempotent repeat) + concurrency script (snapshot, serialization, rollback) | Met (DB) |
| R05 read/unread + mirror convergence, no amplification | pgTAP §7 (both directions, 5 cycles settle on one marker, no duplicate mirror, deleted announcement safe) + §8 reconciliation/restore | Met (DB) |
| R06 reads never change business state | pgTAP §6: request + incident row md5 unchanged, events/outbox counts unchanged | Met (DB); target-screen behavior is phase 3 |
| R09 no leakage, least privilege | pgTAP §1 privileges; cross-resident/tenant counts, pages, bulk; deleted account forbidden; guests denied; notice RLS + column grants; operator must be an admin of the scoped barangay | Met (DB) |
| R10 v1 compatibility, validated v2, no URLs | pgTAP §2 (12 cases), Android parser fixtures (accept v1/v2, reject 19 malformed), iOS v2 → plain entry | DB/parser portion met; worker transport = I1 (phase 2) |
| R13 no loops / unbounded work | Bridge equality short-circuit (§7), batches ≤100 with resumable cursor and no-progress completion (§8, §9), due run no-op while gated | DB portion met |

Not run (with reason): Edge/worker transport (phase 2 I1 — worker unchanged); Android UI fixtures and bundle (no runtime UI change; registry module has no runtime consumer yet); `supabase db advisors` (CLI advisors target the linked/local `postgres` DB, which is intentionally not migrated); MuMu/physical (phase 6).
