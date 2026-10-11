# Requested Phase 3 baseline verification — 2026-10-11, Asia/Manila

This request executes baseline and contract verification only. The plan's historical Phase 3 pilot remains unstarted. See plan section 9 and `final-verification.json`. No application, package, migration, deployment, production data or Android UI change was performed.

## Evidence and actual results

- `baseline.json` and `baseline-status.txt`: current HEAD/branch/status and SHA-256 hashes of 3,275 pre-existing non-task files. Highest repository migration is `0109_invalidate_changed_profile_email_verification.sql`; next unused is `0110`, subject to rechecking. Original baseline is never overwritten.
- `source-inventory.json`: fresh TypeScript AST inventory, 68 files / 638 active entries; equals the historical source index. It includes eight table column objects, queries, mutation locations, nested review/detail/form paths, shared shell/scroll/table/loading components and Header/audit dependencies. Comments are excluded. Array/storage `.from` calls are index entries, not public-table queries.
- `field-contracts.json`: 170 required field definitions across fresh local and retained hosted catalogs, with eight current table/column/query/behavior mappings. `local-schema.json` includes all captured base columns, constraints, indexes, policies, RLS flags, collations and migration history. `nested-catalog.json` supplies 50 supporting fields, 32 policies, 11 helper definitions and 21 publication entries. These are metadata reads; RPCs/actions were not executed.
- `fixtures.mjs` and `verify.mjs`: 49 Node tests passed, zero failed. Reuses prior deterministic DTO/VM harness and adds five tests for remaining segment memberships, invalid-tab defaults and excluded search fields. Fixed time and synthetic IDs only; no credentials/network. Sizes 0/1/7/10/11/23/100/101/1,505, page sizes 10/20/30/50/100, comparison edge values, four permission actors and eight concurrency schedules. Duplicate references are comparison DTOs, not valid UNIQUE-constrained database inserts. VM execution tests actual page predicates/render branches and extracted client comparators; its capped builder does not implement SQL ordering, joins, RLS or Realtime. Permission/concurrency schedule presence is not execution evidence.
- `comparison-fixture.sql` and results: 11 independent SQL value assertions passed. CTEs only, read-only transaction, 8-second statement / 15-second process limits. Covers 45 size combinations, lower/trim/accent/null behavior, suffix extraction, instant equality and Manila midnight. Not a full natural comparator or application pagination test.
- `typecheck-result.json`: admin typecheck exit 0, 20,523ms, incremental writes disabled. `lint-result.json` and `focused-lint.json`: lint over 66 affected TypeScript files exit 0, 30,105ms. Whole-package lint/build were not run here. Earlier package lint timeout is historical.
- `final-verification.json`: syntax checks for ten scripts, JSON consistency, source/field/schema/provenance assertions, whitespace, report hashes and strict scope result. No fresh hosted/Auth/browser/Realtime run is claimed.

## Contracts, proposals and limits

Plan sections 6 and 9 provide line references and per-screen contracts. Submitted = Requests/Incidents base `created_at`; Registered = `drive_registrations.created_at`; payment Date = `payments.created_at`. Health's current Date is scheduled `drive_date`; proposed Date created is `medical_drives.created_at`. Joined/Added/Hired remain profile creation/member creation/official `date_hired`. Request/incident `submitted_at` and registration `registered_at` do not exist; ID-submission `submitted_at` does. Score is in `drive_registration_scores`; `0106` removes the obsolete registration score. Members/registrations have no `deleted_at`.

No current main query satisfies complete filtering/global sorting/exact count/numbered pagination together. Keep direct reads for base predicates, to-one ordering, counts and inclusive ranges. Conditional narrow support is justified for disabled aggregates, absent applicant profile relation and derived comparison/array-text expressions. Retained complex Incident/Household/Staff candidate evidence is parser/zero-row, not full nonempty authenticated coverage. No measured index requirement or new dependency exists.

Preserve nullable embeds, Staff missing-profile exclusion, Applicant inner-score membership, Directory JSON household/ID-photo semantics, independent summaries, five detail snapshots, v1/v2 request guards, paid-amount lock, Staff self guards, check-in-off cleanup, score privacy, audits and signed evidence. Existing defects remain unfixed: capped scans, zero/empty error fallbacks, stale detail snapshots, discarded edit drafts, Household Parent / Other count excluding parents, absent drag-unmount cleanup, removed-admin access and cross-tenant active Health visibility in retained sessions. Five direct table feeds differ from Header/drawer feeds; Health lacks a registration-only feed. Directory commented table and separate uncalled member-form/hook are excluded; History is cards.

`scope-and-provenance.json` compares all indexed files, 257 historical admin/shared files and 107 historical migration files to runtime hashes. Retained report hashes also equal the prior Phase 2 audit: 42 Auth/REST assertions, 11 query-edge assertions, eight screens, 30 interactions, five feeds and two permission observations remain explicitly historical. Their prior cleanup reports remain unchanged. Current hosted state is unknown. Fresh local columns/constraints/indexes/RLS/collations/history and affected SELECT/ALL policies match retained hosting; full policies differ by the retained hosted-only payment INSERT policy. Catalog equality does not prove function/trigger/migration-content execution equality.

## Failures and scope

Initial Docker read failed on sandbox named-pipe access. `local-attempt1.log`, `local-attempt1-result.json` and `local-attempt1-catalog-approved.log` preserve it; one explicitly approved read-only retry passed. Nested metadata then passed separately. No automatic polling or retries; other child processes have 10–65 second deadlines.

The strict workspace equality check initially found a concurrent removal of `apps/resident-android-mobile/scripts/prepare-release-native.mjs` and addition of `apps/resident-android-mobile/eas.json`. The initial scope report is retained. The new EAS file was inspected: CLI/local-version settings and an internal preview APK profile. The missing helper is recorded from the baseline hash and prior scope report; it was not restored or executed. Finalization then stopped on a concurrent `apps/resident-android-mobile/app.json` change. Its current content and tracked diff were inspected: package/version and EAS identity/owner settings are present. `scope-final-attempt1.json`/`.log` preserve that failure. These changes are outside this audit. Finalization recognizes only those three inspected concurrent paths and fails on other drift; strict scope exit 1 is preserved, not relabeled as equality. No task action wrote or deleted outside the plan/new evidence directory.

No services/accounts/containers/ports/networks/subscriptions/temp database objects were created; no resource cleanup was required. Existing local database was read only. Baseline blockers: none. Fresh hosted/browser/Realtime, full improved query semantics/Unicode, cross-browser/manual accessibility, physical input, 10k/100k benchmarks and build/release remain unverified later gates.

## Documentation and repeatability

Read root/admin-web AGENTS.md and installed Next 16.3.0 fetching/error-handling guides under `node_modules/next/dist/docs/01-app/01-getting-started/`. Read exact [Expo v57](https://docs.expo.dev/versions/v57.0.0/) before scripts. Used [Supabase skill](C:/Users/User/.codex/plugins/cache/openai-curated-remote/supabase/1.0.0/skills/supabase/SKILL.md), reviewed [order](https://supabase.com/docs/reference/javascript/order), [range](https://supabase.com/docs/reference/javascript/range), [exact count](https://supabase.com/docs/reference/javascript/select), [versioned PostgREST v14 embedding](https://docs.postgrest.org/en/v14/references/api/resource_embedding.html) and [aggregates](https://docs.postgrest.org/en/v14/references/api/aggregate_functions.html). Markdown changelog failed with unsupported content type; [HTML changelog](https://supabase.com/changelog) supplied the breaking-change review. API grant/Realtime restrictions are relevant to future read objects; no configuration change was made. Installed PostgREST client source confirms three default read retries and Retry-After handling; finite wall-clock deadlines remain a future adapter requirement.

From repository root with existing Node/TypeScript/ESLint and local Docker database:

```powershell
node plans/evidence/admin-table-phase3-baseline/audit.mjs baseline # first capture only
node plans/evidence/admin-table-phase3-baseline/inventory.mjs
node plans/evidence/admin-table-phase3-baseline/checks.mjs fixtures
node plans/evidence/admin-table-phase3-baseline/checks.mjs typecheck
node plans/evidence/admin-table-phase3-baseline/checks.mjs lint
node plans/evidence/admin-table-phase3-baseline/checks.mjs local
node plans/evidence/admin-table-phase3-baseline/nested-catalog.mjs
node plans/evidence/admin-table-phase3-baseline/finalize.mjs
```

Reruns refresh this directory's own outputs only; preserve failed reports before investigating/retrying. Baseline refuses overwrite. Local reads may need approved Docker access. Finalization's concurrency allowlist applies only to this captured baseline; investigate newly observed drift before modifying it.
