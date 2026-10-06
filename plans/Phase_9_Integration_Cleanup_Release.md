# Phase 9 — Integration, cleanup and release

Verified 2026-10-06. **Verdict: partially complete; the release exit gate is not satisfied.** Local integration, migration rehearsal, reconciliation, review, focused fixes and release/recovery instructions are implemented. Protected deployed consumers, real Google/linking and Android development/signed-release qualification remain unverified. No production data was changed, migration applied, or application deployed by this task. Phase 8 remains cancelled.

The compact [exit-gate checklist](evidence/phase9/gate.json) validates the linked execution results and records each open condition explicitly.

## Acceptance and exit-gate evidence

| Assigned action / exit condition | Implementation and verification | Result |
|---|---|---|
| Complete affected suites and production builds | Shared/iOS tests, five workspace typechecks, three affected lints, SDK compatibility, both Next production builds, Android Hermes export, all SQL suites and configured strict checks for every Edge function; affected checks rerun after fixes | **Local PASS**; export is not an APK/native release build |
| Rehearse migrations on representative data | Ordered 104-file chain through 0106 on empty and historical Docker clusters; 0105 privacy checkpoint; original financial/request/applicant values and exact score comparison | **PASS** on synthetic data; not a production backup restore |
| Execute resident-to-administrator journeys | Four actual browser/Auth/Storage/database journeys through submission, review, assessment/exemption, collection, readiness and release; separate failure, authorization, retry and concurrency tests | **Local web/API PASS**; native four-service and deployed journeys unqualified |
| Review duplication, unused branches, dependencies, types and scope | Inspect supported consumers, final schema, handlers and changed sources; reuse existing test infrastructure, no new dependency/schema; fix payment cleanup narrowing and fee-waiver label | **Reviewed**; no weakened types, policies or assertions |
| Remove verified obsolete implementations | Verify 0106's obsolete score-column removal locally and hosted; remove inaccurate payment-review comment and preview configuration additions; retain necessary legacy contracts | **Reviewed**; no further dead implementation justified removal or migration replay |
| Validate setup documentation against staging | Read-only hosted database preflight; both supplied Vercel URLs returned 403 via connector; dedicated staging backend and deployed revisions not established | **Blocked / unverified**; exact provider/redirect/native setup still requires environment validation |
| Prepare release and recovery runbook | Environment inventory, migration/consumer/export checkpoint, preflight, smoke checks, monitoring, stop conditions and recovery | **Prepared**: [runbook](Phase_9_Release_Recovery_Runbook.md) |
| Critical flows pass | Local flows below pass; callback/recovery doubles identified separately | **Partially verified**; real provider, installed native and deployed flows remain open |
| Data reconciliation succeeds | Both rehearsals and local cleanup preserve all compared originals | **PASS for tested local data**; hosted aggregates are not production historical reconciliation |
| No known release-blocking defects remain | Discovered code defects corrected; unresolved Phase 6 provider/native and hosted consumer/setup qualification remain release blockers | **Not satisfied**; do not mark complete or release |

## Grounding and prerequisites

The entire unified plan, decisions, dependencies, quality gates and release controls were read before editing. Root and both web AGENTS instructions apply. Exact [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) and installed Next.js 16.3.0 documentation under `node_modules/next/dist/docs/` were read; Node is 24.13.1. No framework upgrade or new package was introduced. Highest migration prefix is 0106; no Phase 9 schema change was needed.

Current source, shared contracts, migrations, policies and actual executions establish the covered behavior. Earlier reports remain historical evidence:

- Phases 1–5: fresh SQL/API/shared checks and rehearsals substantiate catalog, approved evidence, requests/payments and SLA contracts. Earlier platform reports do not replace fresh native qualification.
- Phase 6: fresh SQL checks cover minimal profiles, idempotency, locality and deferred completion. Actual callback logic passes isolated checks. Real Google consent/linking, restart/persistence and installed development/signed-release callbacks remain prerequisites; they were not silently completed under Phase 9.
- Phase 7: fresh SQL/REST/RPC/CSV/realtime/browser checks prove covered local score isolation, administrator values/rankings and capacity races. Read-only hosted inspection now finds 0105/0106 installed. This supersedes older *database-state* pending reports, but does not prove deployed consumer/export compatibility.
- Phase 8: cancelled. Restored Android layout, controls and interactions are preserved; the sole Android product change is the functional payment text for an explicit exemption.

The task began at HEAD `d1f3371426cc7a85dcb4c8dfd27754446b41ffad` with unrelated uncommitted work. HEAD advanced externally to `3f9e2d5fbebd565661a8359d8b6346e4d1eae223` during execution, including some in-progress task artifacts. Content hashes establish preservation independently of the final Git diff: [baseline](evidence/phase9/baseline/preservation.json), [final review](evidence/phase9/final-review.json).

## Changes and traceability

- `supabase/functions/create-payment-source/index.ts`: configured strict Deno checking exposed an existing nullable reservation capture inside asynchronous cleanup. Capture the already-confirmed immutable ID before that boundary. Preserve pending-row restriction, ownership, assessment and idempotency. All eight functions typecheck; actual handler contract tests use real local Auth/database with only PayMongo responses substituted.
- Web and Android request tracking mapped every non-paid/non-refunded state to “Pending,” including released exemptions. Explicit `payment_status = waived` now displays “Waived,” reusing existing web status infrastructure. Four browser journeys compare actual paid/waived ledgers with tracking text and reject a misleading pending-payment badge. Android types/lint/export pass; native presentation remains unverified.
- Six `scripts/phase9-*.cjs` helpers collect bounded fresh evidence, rehearse migrations, adapt maintained regression suites, run synthetic previews/browser journeys and clean tagged fixtures. Credentials come from the named local Docker stack in memory. Failed evidence is preserved.
- [Release/recovery runbook](Phase_9_Release_Recovery_Runbook.md): concrete environment inventory, migration checkpoint, open setup work, monitoring and safe recovery.

Reviewed flows connect resident forms with `packages/shared/src/schemas/service-foundations.ts` and `lib/service-catalog.ts`, versioned ID/private storage, protected submission/review/assessment RPCs in 0095–0098, payment handlers, minute SLA/reporting in 0099–0101, profile/locality in 0102–0104 and protected score projections in 0105–0106. Screenshots alone do not establish these boundaries.

## Executed checks

Counts below come from the final respective execution, not accumulated retries.

| Check | Actual result / evidence | Scope and limits |
|---|---|---|
| Shared / compatible iOS unit tests | **202 + 8 PASS** [baseline](evidence/phase9/baseline/results.json); logs beside results | Contracts, validation, calculations and existing iOS test scope; not native device execution |
| Types, lint and SDK | Five types, three affected lints and SDK dependency check **PASS** [baseline](evidence/phase9/baseline/results.json), [final affected checks](evidence/phase9/final/results.json) | Two unchanged web warnings, zero errors; Android/admin zero lint errors. No repository-wide clean-lint claim |
| Builds/export | Both initial web builds/export **PASS** [builds](evidence/phase9/builds/results.json); changed web/Android **PASS** [fresh final](evidence/phase9/final-fresh-build/results.json) | Next production output and Hermes bundle; no deployment, APK/IPA or signing proof |
| Backend SQL | **12 suites / 445 assertions PASS** [SQL](evidence/phase9/database/test/results.json) | Catalog, evidence/ID, profile/locality, authorization, requests/payments, SLA and scores |
| Migration/reconciliation | Both clusters **PASS**, 104 migrations each [replay](evidence/phase9/database/replay-isolated/results.json), full comparisons beside results | Original request/payment/applicant values preserved; score exactly 90; NULL constrained 0105 mirror before 0106. Minimal Auth/storage bootstrap |
| Services API | **299 assertions PASS** [services](evidence/phase9/services-stable/results.json) | Real Auth/private Storage/REST/RPC: four services, replacement, conditional uploads, assessments/exemptions, fixed/history fees, tenant/owner denials, retries/concurrency |
| SLA API | **83 assertions PASS** [SLA](evidence/phase9/sla-stable/results.json) | Server/shared parity, pauses, transition denials, readiness/release, windows, durable alerts and concurrency |
| Score/privacy API | **60 assertions PASS** [scores](evidence/phase9/scores-stable/results.json) | REST/RPC/CSV/realtime/export denial, authorized/foreign/deleted staff, rankings/capacity race; export source executes locally |
| Payment provider contract | **19 assertions PASS** [provider](evidence/phase9/provider-corrected/results.json) | Actual handlers/local Auth/database, controlled PayMongo responses; no live settlement or deployed Edge proof |
| Android callback logic | **9 checks PASS** [callback](evidence/phase9/callback/results.json) | Actual callback source with Auth/browser/storage doubles; retry, replay, concurrency, expiry, cancellation and linking; not real OAuth/warm-cold native proof |
| Four-service browser | **32 assertions PASS**, zero observed errors [browser](evidence/phase9/browser-payment-status/results.json) | Actual resident → staff → readiness/release flows, evidence snapshot and exact ledger; screenshots visually reviewed |
| Health/staff browser | **19 assertions PASS**, zero observed errors [score browser](evidence/phase9/scoreBrowser/results.json) | Resident form/detail/confirmation/list omit scores; staff detail retains value; saved protected registration checked |
| Profile SSR/browser recovery | **11 assertions PASS**, zero hydration/script/runtime errors [recovery](evidence/phase9/recovery-restored/browser.json) | Actual app/SDK with synthetic Auth/API responses; public browsing/theme, retry and safe destination; not real Google provider |
| Edge strict types | **8 functions PASS** [final](evidence/phase9/edge-final/results.json) | Actual function import map/config; no type suppression; deployed runtime unverified |
| Fixture cleanup | **PASS**, 40 task users removed [cleanup](evidence/phase9/fixtures/cleanup.json) | All compared original local tables/Auth identities exactly unchanged; task storage/children/foreign tenants removed |
| Hosted preflight | Read-only [aggregate results](evidence/phase9/hosted-preflight.json) | Through 0106, private 5 MB buckets/MIME rules, Ampid 1 locality, enabled Google trigger/RPC, three successful minute runs. Initial wrong trigger-name query explicitly corrected; not hosted journey qualification |

## Worked SLA examples and review

Fresh shared/database checks agree: 719.999 agency seconds is on track, 720 is near target, 900 remains near target while unfinished, and 900.001 is overdue. Readiness at exactly 900 is within target. A documented 60-second resident wait is excluded: 960 elapsed seconds to readiness yields 900 agency seconds. The shared overnight-release example retains 89,400 turnaround seconds without extending the stopped agency clock. Microsecond boundaries and independent UTC readiness/release windows pass; legacy hour records stay separate.

Final review found no new dependency, authorization relaxation, destructive schema change, type suppression or unrelated refactor. Simple status branches reuse existing state without another fee-calculation system. Payment cleanup captures a validated identifier. Preview-generated tsconfig additions were removed. Required legacy fee snapshots, hour calculations, reconciliation and compatibility remain. The obsolete score-column removal was already implemented by 0106 and verified; speculative deletions were avoided.

## Failures, corrections and remaining limits

- Baseline application checks passed with unchanged web lint warnings: missing `boundary` dependency at location form line 94 and unused disable at location map line 102.
- Initial Edge checks used unsuitable root/npm resolution or omitted the actual import map. Configured checking revealed the nullable reservation defect; focused fix and final checks pass. Failed logs remain.
- First rehearsal assumed the ID table existed before 0095. Second encountered pg_cron's configured-database restriction. After reassessment, final dedicated network-disabled clusters configured cron for `postgres` and ran unchanged migrations successfully.
- Initial real-service attempts encountered unhealthy/stopped local Storage/realtime. Diagnostic reassessment, a bounded WSL keepalive and scoped service recovery restored health; final services/SLA/scores pass. Assertions were not relaxed.
- Browser/provider harness corrections followed actual labels and source boundaries. Recovery's first browser run hit suspended networking; the environment-corrected run passes. These are not represented as product fixes.
- Final sandbox build/export failed on a Turbopack worker connection and Hermes temporary-file permission. Same-directory build retry also failed. After reassessment, fresh task-only build output with normal process access and authorized export both pass. Failed logs remain.
- Cleanup transactions rolled back on legacy submission-key and foreign document dependencies. A full actual foreign-key/count audit established the order; final cleanup and original-record comparison pass. Storage deletions always targeted only task owners.
- Docker Desktop (29.8.1) and named WSL stack access were verified. Rehearsals used existing Postgres 17.6 image, no network or host mounts, bounded memory/CPU, and cleanup of only task-labelled container IDs. Existing resources/data were retained. Docker cannot qualify redirects, installed binaries or hosted browsers.
- Both supplied Vercel URLs returned **403** via connector. Automatic approval review rejected browser opening of the resident URL as a potential bypass after that denial. No alternate protection bypass was attempted. Explicit browser permission or an authorized connection/access path is still needed.
- User confirms no release APK/IPA exists yet. Native Android development/signed-release flows, real Google signup/repeat/linking/restart, deployed Edge/payment/export, exact deployed commits and dedicated staging configuration remain **unverified**. No iOS release obligation is newly added.

The [runbook](Phase_9_Release_Recovery_Runbook.md) specifies remaining setup/tests/recovery. These external gaps prevent completion despite passing implemented local checks. No later phase was started.
