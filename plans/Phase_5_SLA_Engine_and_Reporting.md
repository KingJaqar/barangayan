# Phase 5 completion checklist

Status: **complete — every assigned requirement and the Phase 5 exit gate verified locally.** No production operations performed.

| Requirement | Work and affected journeys | Verification / expected result | Dependency |
|---|---|---|---|
| Target snapshots / historical models | Preserve V2 submission snapshot; label and retain legacy hours | Snapshot immutable after catalog edits; historical reconciliation | 0095–0098 |
| Clock transitions | Existing review-gated accept, ready, release, cancel; strengthen event integrity | Authenticated DB transition tests; readiness stops clock, release separate, cancellation freezes | Staff review / payment gates |
| Resident-wait pauses | Staff reason controls, immutable intervals, no overlap or repeated resume | DB invalid-transition / authorization tests, shared exact-second cases | Existing pause table |
| Thresholds | Shared agency seconds calculation; SQL equivalent; 80% / 100% of the snapshotted target, inclusive (12 / 15 minutes for initial services); greater than target overdue | Before/at/after deterministic parity tests | Server timestamps / request target snapshot |
| Alerts | Minute server evaluator; durable unique threshold events; tenant staff visibility | Delayed evaluation, repeated and concurrent calls, scheduler evidence | Local pg_cron |
| Reports | Readiness/completion half-open windows; average, compliance, overdue, paused, waits, turnaround; separate legacy | Old submission completed in window included; cancellation excluded | Tenant-scoped rows |
| Tracking surfaces | Android lists/details; resident web list/drawer/detail; older portal; admin detail/dashboard/reports | Live UI, timer refresh, pause/error/empty states, screenshots | Local Auth, browser / Android |
| Regression / exit gate | All layers agree on deterministic timing examples | Shared suite, DB/API, types, lint, builds/export, final diff and reconciliation | Disposable local infrastructure |

Acceptance rules come from section E and Phase 5 of the full plan. Agency time stops at readiness, including when a ready request is later cancelled. Open waits close on cancellation. Reports sample successful readiness by ready_at and turnaround by released_at; use [start,end) UTC instants. Legacy timing remains separate.

## Implementation and prerequisite audit

The full plan and root/platform AGENTS were read before changes, together with exact Expo SDK 57 overview/Metro documentation, installed Next 16.3 documentation, and Supabase Cron documentation. Earlier phases were verified from controlled submission/review/payment/SLA operations, RLS, shared contracts, SQL tests, authenticated API calls, and both empty/existing migration rehearsals. Their pending migrations remain 0095–0098; Phase 5 adds 0099 without renumbering pushed migrations.

0099 adds clock-shape checks, serialized immutable/non-overlapping resident waits, tenant-scoped tracking/metrics/report operations, readonly threshold events, and a minute evaluator with row locks and a unique `(request_id,threshold)` key. The existing controlled accept/ready/release/cancel operations remain authoritative. Shared calculations preserve PostgreSQL microseconds, classify before display rounding, and project server time with a monotonic device timer. Tracking polls every 15 seconds, displays elapsed time every second, times out stalled calls after 10 seconds, serializes polling, and exposes recovery states.

Resident web list/drawer/detail, Android list/detail, older portal list/detail, administrator details, dashboard, and the dedicated Services SLA report consume the same calculation module. Administrator review exposes documented resident-wait and resume controls. Reports include readiness averages/compliance/waits, current overdue/paused requests, release turnaround, and durable threshold alerts. Legacy hours and per-document trends remain separate.

Initial Services-screen revision (October 4, 2026): restore the existing **Add Document Type** form even with charter services configured, and remove the **View service SLA report** shortcut from this screen. The underlying report and dashboard remain available. Migration `0100_restore_admin_document_type_creation.sql` removes only the four-service catalog restriction; administrator/tenant authorization, charter validation, and historical timing remain intact. This initial revision used the existing hour-based creation contract.

Revision verification: admin production build (including TypeScript), focused Services-page lint and diff checks PASS; seven database suites / 275 assertions PASS (`evidence/phase2/local/test-1791044886251.log`), including 14 creation/authorization assertions. Actual browser creation succeeds and persists after reload with the form visible, no SLA shortcut and no browser errors (`evidence/phase5/admin-services-restored.json`, `admin-services-restored.png`). Apply 0100 after 0099 to the connected database before using restored creation there; only the disposable local database was changed during verification.

The subsequent complete charter-form revision supersedes that creation contract for future services. Both create and edit now persist all seventeen requested fields using existing structured columns and explicit minute targets. Historical requests retain their original timing and fees. Migration 0101, browser create/edit/reload, general resident submission/retry, all 316 SQL assertions, production builds and Android compatibility are documented in [Admin Document Type Charter Form Update](Admin_Document_Type_Charter_Form_Update.md). The Phase 5 timing engine and report exit-gate requirements remain intact; only local databases were changed.

## Requirement evidence

| Requirement / exit-gate component | Actual evidence and result |
|---|---|
| Target snapshot, review-gated clock transitions, tenant isolation | Authenticated API suite: 83 assertions PASS (`evidence/phase5/http-1791036483024/results.json`); controlled submission starts pre-processing with snapshotted 15 minutes; resident/foreign operations denied; readiness/payment/release/cancellation guards preserved |
| Pause reason/actor/time, immutable intervals, overlap, invalid/repeated transitions | SQL acceptance: 62 Phase 5 assertions, 261 across six suites PASS (`evidence/phase2/local/test-1791043079609.log`); concurrent authenticated pauses/resumes allow exactly one success; cancellation closes open waits |
| Exact thresholds and SQL/shared agreement | 138 shared tests PASS, including 13 SLA tests (`evidence/phase5/release-checks/shared-tests.log`); authenticated SQL/shared parity at 719.999, 720, 900, 900.001 and after target; additional microsecond-boundary/projection tests |
| Once-per-minute server evaluation and deduplication | Real active `service-request-sla-minute` cron schedule and successful minute job runs; concurrent/delayed evaluation retains both crossed thresholds once; readonly tenant alert visibility (`evidence/phase5/ui-database-audit.json` and API suite) |
| Readiness/release report windows and historical compatibility | Jan 2 inclusive / Jan 3 exclusive report includes Jan 1 submissions ready Jan 2: 3 samples, 15m average, 100% within, 1m wait, no releases; one historical completion remains separate at its original 24-hour target/average (`evidence/phase5/legacy-report-audit.json`, `report-legacy-window.png`). Shared tests cover separate release windows and cancellation exclusion |
| Database events, shared calculations, web displays | Deterministic readiness: 900 agency seconds + 60 resident-wait seconds -> Completed Within Target, 15m 0s / 1m 0s (`browser-ready.png`, `browser-ready-drawer.png`, `older-portal-ready.png`). Real browser staff pause/resume/ready/release: SQL/shared exact equality, 756.447577 agency seconds, 963.762888 wait seconds, 1866.219840 turnaround seconds (`ui-database-audit.json`, `browser-released.png`) |
| All affected web integrations and connection recovery | Resident list/pre-processing/cancelled/ready/released, drawer, older portal, admin paused detail, dashboard and report observed. Stopping only disposable local REST produced explicit tracking/report errors; restarting restored both automatically (`browser-connection-error.png`, `report-connection-error.png`, `browser-recovered.png`, `report-recovered.png`) |
| Android UI agreement | SDK 57 running on isolated Android emulator: readiness 15m 0s / wait 1m 0s; released request 12m 36s / wait 16m 3s / turnaround 31m 6s; legacy original estimate explicitly labeled; paused agency remains 300 seconds while wait advances from 354 to 947 seconds. Disposable REST outage exposes Retry and automatic recovery succeeds. All six saved XML assertions PASS (`evidence/phase5/native-ui-results.json`, corresponding `android-*.xml` / `android-*.png`); list clock also observed (`android-list.png`) |
| Migration order, existing data and regression checks | All migrations rehearse on empty and representative existing PostgreSQL databases with preserved legacy fixture/reconciliation (`evidence/phase3/phase5-final-rehearsal/results.json`). Protected baseline hashes retained (`evidence/phase5/preservation-final.json`) |

The evaluator assertion initially counted unrelated local UI fixtures. Its final assertion filters its own resident's requests; production evaluator behavior and deduplication requirements were unchanged. Earlier failed attempts remain in evidence. Real journey auditing exposed millisecond truncation of database timestamps; integer microsecond subtraction corrected that error, with explicit regression tests.

## Final checks and review

`evidence/phase5/release-checks/results.json`: 138 shared tests; shared and all three affected application typechecks; resident/admin web and Android lint; both production web builds; Android production Hermes export; Expo SDK compatibility — all PASS. `contracts-final/results.json` repeats affected typechecks after adding the readonly alert table contract. Scoped lint for new Phase 5 scripts/calculations/tests also passes. `git diff --check` passes.

After final legacy-label and report-window changes, `evidence/phase5/legacy-labels-final/results.json` repeats all three application typechecks/lints, both production web builds, and the Android Hermes export: nine checks PASS. The final SQL run also passes all 261 assertions with the native paused and historical UI fixtures present. Database events, shared calculations, both web portals, administrator reports and actual Android displays agree on the same deterministic readiness/release examples. Every checklist row above has supporting evidence; no Phase 5 requirement remains pending.

Root lint remains a pre-existing repository failure: Phase 0 recorded 79,088 errors / 34,634 warnings including generated Next output and Deno URL-import resolution. The Phase 5 full attempt also failed in those categories (recorded under `final-checks`); subsequent generated-preview exclusions restore affected workspace lint. No source authorization, validation, types, tests, or acceptance criteria were weakened. Existing local security-advisor warnings remain; the advisor check exits 0 with no error findings (`evidence/phase2/local/advisors-1791036688238.log`).

Final review retains unrelated earlier-phase changes, historical contracts and pushed migration numbering. No new dependency or unfinished feature placeholder was added. Presentation adapters stay within each application's existing UI infrastructure; all timing/report logic is centralized in shared. Owned web previews use `.next-phase5` to avoid colliding with existing development sessions. Metro excludes generated verification/build directories to prevent watcher stalls. The isolated Android launcher uses emulator host alias `10.0.2.2` because adb reverse into WSL was unreliable; this is not a production endpoint.

## Decisions and operational setup

- Report windows are UTC, start-inclusive/end-exclusive. Readiness chooses processing/compliance/wait samples; actual release chooses turnaround samples. Current overdue/paused counts deliberately use evaluation time, independently of the selected historical window.
- A cancelled record keeps readiness-frozen processing when previously ready, freezes turnaround at cancellation, and never enters successful-completion compliance.
- Alerts are durable administrator-visible threshold events. No push/email delivery channel is specified by Phase 5; notification deduplication is enforced in the database, independently of the viewer or job retries.
- New model timing stays attached to the request snapshot. Historical hour-based rows retain their model and original reporting behavior.

For an authorized release, apply 0095–0098 prerequisites then 0099 using the existing migration process, followed by Services revisions 0100 and 0101; ship compatible consumers together. The [main plan](Major_Web_AndroidMobile_Improvement_Plan.md#phase-5--sla-engine-and-reporting) records Phase 5’s completed actions and local exit-gate result, and the [charter-form checklist](Admin_Document_Type_Charter_Form_Update.md) records the later Services regression evidence. Do not remove legacy columns or rewrite historical timestamps. On a pg_cron host, 0099 creates the named active minute schedule. Verify:

```sql
select jobname, schedule, active from cron.job
where jobname='service-request-sla-minute';
select status, start_time, end_time, return_message from cron.job_run_details
where jobid=(select jobid from cron.job where jobname='service-request-sla-minute')
order by start_time desc limit 10;
```

Investigate failed job runs and ensure the schedule continues during closed client screens. If pg_cron is unavailable, migration emits a notice: an external trusted database scheduler must call `select barangayan_private.evaluate_service_request_slas()` at least once per minute before release. Never grant this private evaluator to residents or ordinary administrators. Repeated calls are safe; use the existing trusted operational database role. Reconcile representative historical records and rerun the documented local acceptance checks before release. Production application/deployment and production scheduler operation were not exercised or authorized here.
