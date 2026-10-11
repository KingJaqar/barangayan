# Requested Phase 5 — Baseline and contract verification

2026-10-11, Asia/Manila. Baseline-only scope maps to the plan's historical Phase 0. Historical Phase 5 implementation remains unstarted. Only the plan and this evidence directory were written; no application, migration, deployment, production-data or Android UI changes.

## Evidence and actual results

- `baseline.json` / `baseline-status.txt`: immutable HEAD/branch/status and 3,371 non-task file hashes. Highest repository migration `0109_invalidate_changed_profile_email_verification.sql`; next unused `0110`, recheck before later creation. Baseline refuses overwrite.
- `source-inventory.json`: fresh TypeScript AST index, 68 files / 638 active entries. Complete column objects, queries, render/edit maps, actions, forms/details/review, shared shell/scroll/table, loading, Header and audit drawer. AST excludes comments; entries are not all database calls or executed actions.
- `field-contracts.json`: 255 required field definitions across fresh local, fresh hosted and historical hosted catalogs, plus eight source-linked active table contracts. Captured base catalogs contain 192 affected columns, constraints, indexes, policies/RLS, collations and history.
- `hosted-schema.json`, `hosted-scale.json`, `hosted-nested-catalog.json`, saved SQL and `capture-provenance.json`: fresh connector reads against the repository-linked project. SQL transactions are read-only with 8-second statement deadlines, no audit retries. Only metadata and aggregate counts are retained, no production rows copied to fixtures.
- `local-schema.json`, `nested-catalog.json`, read logs: fresh local read-only evidence. Supporting catalogs include 50 columns, 32 policies, 11 helper definitions and 21 publication entries. `supporting-alignment.json` compares local/hosted; three helper bodies differ only by CRLF/LF. All 11 definitions match after line-ending normalization. This is not all-function/trigger or mutation-execution equality.
- `schema-alignment.json`: columns, constraints, indexes, RLS, collations, migration history and affected SELECT/ALL policies match. Full policy equality is false: hosting has one additional payment INSERT policy. No difference was repaired.
- `fixtures.mjs`, `verify.mjs`, `fixtures.log`, `fixtures-result.json`: **55 tests passed / 0 failed**, using existing Node/TypeScript tooling. Initial 53-test passing run retained separately; strengthened exact-count absence assertions and two new tests cover every screen's beyond-cap search loss and Incident category/summary independence. No test failure was relabeled.
- `comparison-fixture.sql` / results: **11 independent SQL assertions passed**, synthetic read-only CTEs. Checks lower/trim/accent/null behavior, numeric suffix values, instant equality, Manila midnight and 45 dataset-size/page-size combinations. This is not application pagination or a complete natural-reference comparator.
- `typecheck-result.json`: exit 0, 19,499ms, 60-second deadline, incremental writes disabled. `lint-batch0.json` / `lint-batch1.json`: exit 0, 20,856ms / 19,882ms, 45-second deadlines; two disjoint batches cover 66 affected files. No combined lint attempt occurred here. Their inherited boundary wording about a retained timeout refers to prior audit evidence; the script now says this explicitly. Whole-package lint/build not run.
- `scope-and-provenance.json`: all 68 indexed sources, 257 historical admin/shared files and 107 historical migrations match retained runtime hashes. Nine historical runtime/cleanup report hashes equal the prior Phase 4 manifest. Of 3,371 non-task files, 3,369 remain identical; two concurrent registration documents changed and were inspected/preserved. No missing files/outside additions. Strict equality remains exit 1, not a passing check.
- `final-verification.json`: script syntax, JSON consistency, source/schema/provenance, result assertions, whitespace, strict scope and evidence hashes. Completion requires its actual successful result.

## Verified contracts and proposals

Plan section 11 records the current evidence and checklist; section 6's full per-screen matrices remain linked to unchanged current source locations. Submitted = Request/Incident `created_at`; Registered = registration `created_at`; Transaction Date = payment `created_at`; Health current Date = scheduled `drive_date`, with future Date created = drive `created_at`. Joined/Added/Hired remain separate. There is no registration `registered_at` column; its audit metadata is an alias. ID-submission `submitted_at` is a separate real field.

No current main table query meets complete filtering/global sorting/exact counts/valid numbered pagination together. Reuse direct base/to-one filters, parent ordering, exact counts and inclusive ranges before considering backend support. Retained authenticated evidence supports Requests/Transactions/inner-score Applicants candidates; some complex Incident/Household/Staff candidates have only parser/zero-row evidence. Do not turn API primitives into claims that the table implementation passes.

Conditional narrow read support is justified for disabled API aggregates, absent Applicant profile relation, comma-space joined-array substring semantics, and derived normalized/natural/display-label keys. Ordinary scalar sorting and supported joins do not justify a new browse RPC. No measured query-plan/benchmark index need, generic dynamic endpoint, eight-RPC architecture or dependency is demonstrated.

Existing defects remain unfixed: capped scans/totals, silent empty/zero secondary errors, stale selected snapshots, failed-save draft discard, Parent / Other excluding parents, resize-drag unmount cleanup gap, removed-admin access and active cross-tenant Health visibility. Fresh hosted/local helpers confirm omitted deletion guards; score policies remain protected. Five table feeds are distinct from Header/drawer channels; Health has no registration-only feed. Directory commented markup and the separate uncalled member form/hook are not active table implementations. Request History is cards.

Fresh hosted exact counts: profiles 28, requests 69, payments 55, incidents 30, drives 13, registrations 10, members 6, officials 5. All references canonical; no cancelled registrations; six drives without registrations. These small populations do not establish large-data performance. Hosted SQL maximum-row setting is null/unavailable.

Fixtures use fixed time/synthetic IDs, nine dataset sizes, five page sizes, comparison edge values, four permission actors and eight concurrency schedules. Schedules are definitions, not live execution. DTO duplicate references are not valid UNIQUE-constrained inserts. VM checks execute actual source predicates/render branches/comparators with mocked transport; they do not execute SQL joins/order, RLS, Realtime or every write action.

Historical evidence remains historical: 42 Auth/REST assertions, 11 query edges, eight rendered screens, 30 completed interactions, five feeds and two permission observations. No fresh authenticated/browser/Realtime stack was started. Preserved failed attempts remain failures. Current source/hash linkage supports representative reuse, not current hosted end-user acceptance.

## Failures, cleanup and limits

Initial local read failed on sandbox Docker named-pipe access (`local-attempt1*`). Error inspected; one approved bounded read-only retry passed. Subsequent supporting metadata read passed. No recursive retries/polling. DB children have 15-second limits; fixture test process 35 seconds; lint batches 45 seconds; typecheck 60 seconds; syntax/consistency children 10–30 seconds. Installed SDK default three retries and Retry-After remain a future adapter deadline concern; no app request policy changed.

Finalization initially stopped on concurrent changes in the registration execution plan and `resident-registration-otp/live-acceptance.md`. Current scope/status/device-matrix text was inspected and left untouched. `scope-attempt1.json` / `final-attempt1.json` preserve the failure; `concurrent-change-review.json` records exact inspected hashes. The immutable baseline remains unchanged. Strict checker still exits 1; final consistency accepts only these exact two document hashes, with no missing/outside additions and unchanged source/migration linkage. Any new drift stops it.

No task accounts, services, containers, networks, ports, subscriptions, temporary DB objects or installs created. Therefore no resource deletion was needed. Historical cleanup remains hash-verified; pre-existing local services were preserved.

Baseline blockers: none if final verification passes. Unverified facts remain explicit: current hosted transport cap, fresh authenticated hosted/browser/Realtime acceptance, execution of every mutation/RPC, full trigger/function alignment, future complete comparison/filter/page contract and broad Unicode semantics, production build/release, physical input, cross-browser/manual accessibility and 10k/100k performance. No bug-free, full-functionality or production-readiness claim.

## Documentation and repeatability

Read root/admin-web AGENTS.md, exact [Expo v57](https://docs.expo.dev/versions/v57.0.0/), installed Next fetching/error guides under `01-app/01-getting-started/`, and the Supabase skill. Initial guessed `02-guides/` paths failed; discovery located the actual guides before scripts. Official [order](https://supabase.com/docs/reference/javascript/order), [count](https://supabase.com/docs/reference/javascript/select), [range](https://supabase.com/docs/reference/javascript/range), [OR](https://supabase.com/docs/reference/javascript/or), [PostgREST v14 embedding](https://docs.postgrest.org/en/v14/references/api/resource_embedding.html) and [aggregates](https://docs.postgrest.org/en/v14/references/api/aggregate_functions.html) reviewed. Changelog markdown returned unsupported content type; [HTML changelog](https://supabase.com/changelog) and API grants/PostgreSQL minor-release/Realtime restrictions entries supplied the fallback.

From repository root, using existing tools:

```powershell
node plans/evidence/admin-table-phase5-baseline/audit.mjs baseline # first capture only
node plans/evidence/admin-table-phase5-baseline/inventory.mjs
node plans/evidence/admin-table-phase5-baseline/checks.mjs fixtures
node plans/evidence/admin-table-phase5-baseline/checks.mjs typecheck
node plans/evidence/admin-table-phase5-baseline/focused-lint.mjs 0
node plans/evidence/admin-table-phase5-baseline/focused-lint.mjs 1
node plans/evidence/admin-table-phase5-baseline/checks.mjs local
node plans/evidence/admin-table-phase5-baseline/nested-catalog.mjs
node plans/evidence/admin-table-phase5-baseline/finalize.mjs
```

Hosted captures use the saved SQL via the connector and are not refreshed by finalization. Local reads require the existing database and may require sandbox approval. Preserve failed reports before adaptive retries. Reruns write only this evidence folder; strict scope checks stop on unexplained drift rather than restoring unrelated work.
