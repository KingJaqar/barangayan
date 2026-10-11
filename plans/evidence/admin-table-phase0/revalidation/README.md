# Phase 0 execution revalidation — 2026-10-11

Phase 0 is baseline and contract verification. The source contracts, fixtures, database capability findings and representative isolated flows were already complete. This execution validates those artifacts without starting later implementation phases or replacing historical reports.

## Current checks

- Root/admin AGENTS.md, exact Expo v57 reference, installed Next.js page guide, overall plan and Phase 0 gate read before evidence code was written.
- `baseline.json` / `baseline-status.txt` record HEAD, dirty workspace and 3,483 pre-existing file hashes. Highest migration is 0109; next unused prefix is 0110, subject to rechecking before any future creation. No migration needed.
- `result.json`: 68 indexed source files and 107 migration files match the previously executed runtime source snapshot. Nine original runtime reports match retained hashes. All 3,483 baseline files remain byte-identical, with no additions outside this run's plan/evidence scope.
- `fixtures.log`: 55 tests passed, zero failed. Tests use actual page source in a mocked transport; they do not execute RLS, React or Realtime.
- `comparison-data.json`: 11 independent read-only SQL assertions match the retained oracle, including 45 size/page-size combinations. These do not implement table pagination.
- Admin typecheck passed (20,612ms); lint of the existing 66 affected files passed (44,523ms). Finite deadlines: fixtures 35 seconds, typecheck/lint 60 seconds, each local SQL child 15 seconds; no automatic retries.
- Fresh hosted and local catalogs compare affected columns, constraints, indexes, RLS, collations and migration history. All match except the known hosted-only payment INSERT policy; affected SELECT/ALL policies match. Hosted catalog keys match the prior capture.
- Fresh hosted exact counts remain profiles 28, requests 69, payments 55, incidents 30, drives 13, registrations 10, members 6, officials 5. Hosted SQL transport-cap setting remains unavailable (null). These populations do not demonstrate large-data performance.

Hosted captures used the Supabase connector for project `pwjbucnyqexiepoinoke`, previously matched to repository configuration. Queries are the unchanged `hosted-schema-query.sql` and `hosted-scale-query.sql` in `admin-table-phase6-baseline`, both read-only transactions with an 8-second statement limit. No user record contents were retrieved. Local checks use the existing `supabase_db_barangayan` container without creating objects or resources.

The first local attempt was denied access to Docker's named pipe by the sandbox. Its failed status/log are preserved as `local-schema-restricted-attempt.*`. A single approved read-only execution succeeded. An early final-check invocation occurred before lint finished and stopped on missing `lint.json`; the completed final invocation passed. Neither interruption is evidence of a product regression.

## Retained executed flows and limits

Original Phase 0 runtime reports contain 42 authenticated API assertions, 11 query-edge assertions, eight rendered screens, 30 completed interaction assertions, five live table-feed checks and two permission observations. Their files and corresponding indexed source/migration hashes remain unchanged. Original cleanup confirms the disposable services and credentials were removed. This run creates no services, accounts, schema objects, subscriptions or production data and does not rerun those user flows.

The documented cap/count, removed-admin access, cross-tenant Health, failed-edit draft and selected-detail snapshot defects remain baseline findings. Minimal read support proposals and per-screen field/filter/sort contracts remain in plan section 6. No requirement calls for fixing these defects in Phase 0. Authenticated hosted acceptance, full trigger/function equality, physical input, other browsers, broad accessibility, 10k/100k performance and release behavior remain explicit later verification limits. No Phase 0 blocker remains.

## Reproduce

`revalidate.mjs checks`, `revalidate.mjs local`, then `revalidate.mjs final` rerun bounded checks from the repository root. Hosted JSON must first be refreshed with the two recorded read-only connector queries if verifying current hosted state. Preserve current reports before any rerun; `baseline` deliberately refuses to overwrite its immutable manifest. `final` fails on source drift, report drift, catalog drift, failed checks or unrelated workspace changes. The plan and this evidence folder are the only scoped writes.
