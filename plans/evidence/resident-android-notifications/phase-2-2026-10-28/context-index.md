# Phase 2 context supplement — 2026-10-28

Extends the [phase-0](../phase-0-2026-10-28/context-index.md) and [phase-1](../phase-1-2026-10-28/context-index.md) supplements; only new or changed facts are listed. Shared rules stay in the [plan](../../../Resident_Android_Notifications_and_Announcements_Implementation_Plan_2026_10_27.md) §3.

## Phase checklist

| Item | Record |
|---|---|
| Scope | Producers for every enabled Account row, occurrence keys, source-keyed reconciliation, System catch-up delivery, worker v2 contract. No UI, no Android change, no hosted change, gates left off. |
| Prerequisites | Phase 1 Verified — re-confirmed by re-running its suites on the new clone (hub pgTAP 162/162, concurrency 3/3, phase17 121/121) and by the 0145/test hashes equal to the phase-1 record. |
| Context inputs | Phase-0 ledger writers; scoped Repomix packet `tmp/resident-notifications-phase2-20261028/phase2.xml` (4 files: 0116, 0118, worker.ts, iOS worker test; sha `c7e1c2f0…`, security clean, no omissions; read completely in bounded chunks). Effective SQL for the other writers read from the clone with `pg_get_functiondef`. |
| Acceptance gates | I1 (writer → inbox/outbox → claim → worker payload → parser), backend portions of R03/R07/R09/R10/R13. |
| Baseline | iOS worker + parser vitest 81/81, iOS tsc 0 (phase-1 identity, sources hash-equal); no Android file touched. Pre-existing failures unchanged (see baseline-and-verification.md). |

## W1–W6 record

| Step | Result |
|---|---|
| W1 Git | HEAD `9fe8add1`; status 569 entries at entry (concurrent user/session work). Saved: status, unstaged patch, working bytes of `worker.ts`, `notification-worker.test.ts` and the plan → session scratchpad `before/`. Owned: 0146, two new tests, `worker.ts`, `notification-worker.test.ts`, the plan, this folder. |
| W2 ripgrep | Writers located: `publish_id_submission`/`review_id_submission` (0118/0095), `observe_resident_auth_password` (0122), `sync_household_members_from_jsonb` (0139), `guard_sla_pause`, `transition_service_request_sla` (resident `cancel` allowed), `withdraw_incident`, `update_incident_status`. `public.cancel_service_request` is the staff RPC. Repowise not used. |
| W3 Reader | Reused F16–F30 and the ledger; nothing invalidated. |
| W4–W5 | Repomix 1.18.1 packet above, read in chunks of ≤200 lines (lines 18–217 test, 441–605 migrations); `worker.ts` read from the original in full. |
| W6 | Original sources for every changed function read before editing. |

## Findings and decisions

| ID | Finding / decision | Impact |
|---|---|---|
| F31 | Password writes reach the lifecycle row only through `observe_resident_auth_password`; GoTrue has no resident session, so these events are alert-eligible. | A18–A20 trigger on `resident_account_lifecycle.password_observed_at`. |
| F32 | Resident cancellation is `transition_service_request_sla(action=cancel)`. | A40 self-history test uses the real resident path. |
| F33 | A deferred (commit-time) trigger sees `now()` = transaction start, so "same transaction" = `events.created_at = now()`. | A45 coalescing. In a single-transaction pgTAP file this equals "same file", so the positive and negative A45 cases use different requests. |
| F34 | A concurrent session added `0147_resident_setup_id_submitted.sql` and edited the `resident_account_setup` / `resident_apple_account_setup` tests at 11:26–11:27; the clone has no 0147, so those suites show 3 `idSubmitted` failures that are not from this phase (identical on the phase-1 clone). | Reported separately; not touched. |
| D23 | Occurrence identity = the client command (`statement_timestamp()` token). The first occurrence keeps the legacy key (existing event ids unchanged); a genuine repeat gets `:x<token>`. Applied to the existing request/payment/incident producers too. | R07. |
| D24 | Self-actions are history-only by actor (`auth.uid()` = recipient) for A03/A05/A15/A40/A50; submissions A01/A07/A11/A31/A46 are always history-only. A recipient must be a usable account (resident, not deleted, `profile_completed_at` set). | D18; no preference mutation. |
| D25 | Reconciliation (`notification_reconcile_account_events`) repairs only events whose key is the source row (ID versions/decisions, ID repair, request/incident submission, pauses, withdrawal). Profile/household/fee/refund/password/email-verification occurrences have no durable per-occurrence source row and cannot be reconstructed; a lost one is the documented residual risk of non-blocking producers. History only, ≤100 per call. | Plan §4.2, last bullet. |
| D26 | `notification_publish_due_notices` is replaced (same signature) to add catch-up: residents with `updated_at ≥ published_at` and no event for a published, unexpired (<90 days) notice get its current revision as history only. | Phase-1 handoff item; shares the ≤100 budget. |
| D27 | Worker contract: `parseClaimed` accepts v1 (as before) and the two validated v2 shapes; `buildMessage.data` = destination + `inbox`; `notification_publish_due_notices(p_limit=100)` runs first, once, in its own try block (a failure is reported, claim still runs). `RunSummary.notices` added. iOS ignores v2 pushes by design (`parsePushData` is v1-only). | Rollout: deploy 0145/0146 before this worker, then enable the gates in the D20 order. |

## Producer → test map (`resident_android_notification_producers.test.sql` unless noted)

| Rows | Producer | Evidence |
|---|---|---|
| A01 | `notify_profile_account` (insert + update) | first completion once, repeat none, silent, destination Settings |
| A03 | same | self silent; unchanged/preference/avatar none; staff distinct, alert only with v2 alerts on; text generic |
| A05 | `notify_household_change` | multi-row statement = 1; unchanged/check-in none; change/delete distinct; real profile-jsonb path |
| A07/A11 | `notify_id_submission` (insert) | real `publish_id_submission`; idempotent re-publish; replacement text |
| A08/A09/A10 | same (decision update) | real `review_id_submission`; reasons never copied |
| A12 | `notify_profile_account` + reconcile | false→true once; unchanged none; activation reconcile once then 0 |
| A14/A15 | `notify_profile_account` | verified once; normalized-equal email none; no address in key |
| A18/A19/A20 | `notify_password_change` | first password vs generic update; no credential material |
| A31 | `notify_request_submitted` | real `submit_service_request`; silent; v1 destination |
| A32/A37 | `notify_request_pause` | pause/resume/pause distinct; reason not copied |
| A33 | `notify_request_change` | revised amount; unchanged none; further revision distinct |
| A34–A36, A38, A39, A47–A49 | existing producers (occurrence keys added) | phase17 121/121 unchanged; repeated status distinct (R07) |
| A40 | `notify_request_change` (owner path) | real resident cancel: history, no alert; staff path unchanged |
| A43/A44 | `notify_payment_change` | expired once; stage-aware refund (started / in progress / confirmed / failed); retry after failure distinct |
| A45 | `notify_request_details` (deferred) | staff edit once; same value none; own edit none; coalesces |
| A46/A50 | `notify_incident_submitted`, `notify_incident_change` | submit silent; own withdrawal silent; staff withdrawal alerts; repeated status distinct |
| Y01–Y06, Y08, Y11–Y13 | phase-1 operator functions + `notification_publish_due_notices` | pgTAP catch-up and bounds; `notification_transport_i1.mjs` (publish → revise → worker → parser) |

## Identity (owned files, final)

| File | SHA-256 |
|---|---|
| `supabase/migrations/0146_notification_hub_producers.sql` (new) | `086138861e46146117749aaaba3718aad6ca8e79e1fb4e0320510f386d9c5b79` |
| `supabase/tests/resident_android_notification_producers.test.sql` (new) | `54a11e63e38d68e0735e3d084a2b4edf4203d43027ee35b9b9b17f5a6efd11af` |
| `supabase/tests/notification_transport_i1.mjs` (new) | `b55cbe51724e6ae20eca3c51b4e9f90775b4ae5f4bc7c26108794f5ace116e4b` |
| `supabase/functions/send-notifications/worker.ts` (was `3c0362de…`) | `beef23fa2b56c55347e6489ba70a132a99e818b811e854b84818b6d285ed197e` |
| `apps/resident-ios-mobile/tests/notification-worker.test.ts` (was `8d249daf…`) | `19f753f1529983ff10e445a76146fc77257455289ef66ea5425760fbbce941dc` |
| `supabase/migrations/0145_notification_hub_contracts.sql` (unchanged, phase 1) | `3880306b98c1eedb1dc864e022a9825e8f78395dce053513dfc094c4ad7d859b` |

## Recovery record

- Clone `notif_p2_20261028` = `notif_p1_20261028` + 0146 (task-owned, retained). `notif_p0_*` and `notif_p1_*` untouched; the p1 clone still holds the phase-1 committed read-reconciliation boundary, so the hub test needs `announcement_reads_reconciled_at = null` first (clone-state note, not a defect). Gate off in all clones; dev `postgres` DB and hosted untouched.
- Rollback = turn `emission_enabled` / `v2_alerts_enabled` off (D20) and redeploy the previous worker (it rejects v2 rows, which are never created while v2 alerts are off). 0146 is additive; its triggers drop by name (`z_notify_*`); the replaced functions keep their 0135/0145 bodies in those migrations. The I1 script removes its own fixtures; no task-owned rows exist outside the disposable clones.
