# Requested Phase 2 baseline verification — 2026-10-11

The requested title maps to historical Phase 0 in the plan. Historical Phase 2 query implementation was not started. Baseline contract verification is complete; see plan section 8 and `final-verification.json`. This is evidence of baseline contracts, not completed table improvements or production readiness.

## Fresh evidence

- `baseline.json` / `baseline-status.txt`: HEAD, branch, 3,225 pre-existing non-task files, original changes and highest migration `0109`; next unused would be `0110` after a fresh recheck.
- `source-inventory.json`: 68 source files / 638 AST entries, including eight active tables, column objects, main/secondary queries, mutations, nested review/details/forms and shared Header/audit/loading/scroll dependencies. AST comments are excluded. Entries include JavaScript `Array.from` and storage `.from`, so 638 is an index-entry count, not a database-query count.
- `field-contracts.json`: 170 schema field definitions across fresh local / retained hosted catalogs and source-linked table, query, column and behavior locations. `local-schema.json` contains all inspected base-table columns, constraints, indexes, policies, RLS flags, collations and migration history.
- `nested-catalog.json`: fresh local definitions for 50 supporting document-type/ID-submission/request-attachment/audit fields, constraints, 32 policies, 11 function definitions and 21 publication entries. Storage `.from('id-documents')` and `.from('request-attachments')` refer to buckets, not public tables. Function capture verifies definitions, not mutation execution. No real row data was read or recorded by these metadata captures.
- `fixtures.mjs` / `verify.mjs`: deterministic DTOs with fixed time; sizes 0/1/7/10/11/23/100/101/1,505 and page sizes 10/20/30/50/100. The 44 tests execute transpiled existing server-page predicates/render branches and client sort expressions using a capped mock builder. They cover searches, filters/status segments, missing embeds, summaries, errors, score mapping and cap omissions. The mock does not implement SQL ordering, joins, RLS or Realtime. The independent 45 size combinations verify a future page-slice oracle, not existing application pagination. Permission actors and concurrency schedules are fixtures, not runtime pass claims. Repeated references are DTO comparison values, not valid UNIQUE-constrained inserts.
- `comparison-fixture.sql` / results: 11 verified independent SQL value assertions, including lower/trim/blank/null ordering, numeric suffix extraction, timestamp instants, Manila midnight and 45 size combinations. CTE-only values; no temp objects or data writes. This is not a full natural-reference comparator or application pagination.
- `typecheck-result.json`: admin typecheck exit 0, incremental output disabled. `focused-lint.json`: 66 affected admin TypeScript files, exit 0. Whole-package lint/build were not run in this request.
- `final-verification.json`: script syntax, JSON consistency, schema alignment, field/source linkage, whitespace, retained evidence hashes and final scope results.

## Retained observations and provenance

`scope-and-provenance.json` verifies all 68 indexed files, 257 historical admin/shared files and 107 historical migration files against Phase 0 runtime hashes. It hashes the retained runtime reports and verifies their recorded completion/cleanup consistency. All inspected admin/shared and migration files remain unchanged. This supports reuse of recorded baseline findings; it does not turn them into fresh runs.

Retained isolated observations: 42 Auth/REST assertions, 11 query-edge assertions, eight rendered screens, 30 completed interaction assertions, five live table-feed checks and two permission observations. Failed historical attempts remain failures. No new account, service, container, network, subscription, port or temporary database object was created here. No cleanup of unrelated resources was attempted. Prior cleanup is supported only by its retained report.

Current hosted state was not refreshed. Fresh local columns/constraints/indexes/RLS/collations/history match the retained hosted capture; all affected SELECT/ALL policies match. Full policy equality is false because the retained hosted payment INSERT policy is absent locally. This write-policy discrepancy was not repaired. Function/trigger/migration-execution equality with current hosting is not established.

## Contracts and capability boundaries

The eight detailed source contracts in plan section 6 and the corrected matrix in section 8 remain linked to unchanged current source. Requests/Incidents Submitted and Applicants Registered use their base `created_at`; payment Date uses `payments.created_at`. Health Date is `drive_date`; proposed Date created uses `medical_drives.created_at`. ID-submission `submitted_at` is a separate actual field. Joined/Added/Hired remain profile creation/member creation/official `date_hired`.

No existing main table query implements complete filtering, global ordering, exact matching totals and valid numbered pagination together. Supported API primitives do not establish implemented browse behavior. Keep direct session reads first. Demonstrated narrower gaps are disabled aggregates, absent applicant profile relationship, joined-array text search and derived comparison/display keys. Incident/Household/Staff complex related-query candidates retain their parser/zero-row evidence limits. No index requirement was measured, and no backend object was added.

Selection remains five stored detail snapshots keyed by ID with possible staleness; no bulk selection. Preserve v1 request edit guards/v2 review, paid-amount locking, Staff self guards, member check-in cleanup, score privacy, mutation row checks, audits and signed images. Failed shared saves currently discard drafts; resize drag lacks in-progress unmount cleanup. Five table subscriptions refresh directly and remove their channels; Header audit notifications and drawer subscriptions are separate. Long-run listener/subscription freedom is unverified.

Verified defects remain unfixed: capped main/secondary scans; Requests/Transactions/Staff failures resembling empty results; failed summary/lookup reads resembling zeros/empty arrays; Household Parent / Other card excluding parents; removed-admin request access and cross-tenant active Health visibility in retained sessions. Current Health comments about tenant scoping and deleted-row inclusion contradict its query/read policy. Request History is a card list; Directory's commented table is obsolete; active household dialogs are local declarations. Separate member-form/use-households files have no discovered callers.

## Failures, bounded operations and scope

The first local read failed on Docker named-pipe sandbox access, preserved in `local-attempt1*`. One approved read-only retry passed. Each SQL transaction has an 8-second statement deadline; child processes have 15-second limits. Other checks have explicit 10–65 second process limits and zero automatic retries/polling.

The first expanded fixture run passed 43/44 tests: its new score expectation incorrectly used a historical runtime fixture value of 50 while this DTO generator supplied 0. The test now sets an explicit synthetic score and verifies preservation against that input; the rerun passed 44/44. The failed log/result remain in `fixtures-expanded-attempt1*`; application code was not changed.

`scope-attempt1.json` and final scope logs record concurrent resident Android/registration OTP work: `app.json`, a new native-release helper, the separate OTP plan, and its delivery/live-acceptance evidence. Finalization first stopped when the three OTP document changes appeared; their contents were inspected and the prior scope report/log retained as `scope-final-attempt1*`. The final checker recognizes only those five inspected paths and stops on other unexpected drift. The strict byte-equality scope check remains exit 1; final verification keeps that result, confirms no missing files and unchanged admin/shared/migration provenance, and reports observed differences. It does not reset/revert those files or relabel full workspace equality as passed. All actions performed by this task wrote only the plan and this evidence directory.

## Instructions, documentation and repeatability

Read root/admin-web AGENTS.md; no additional admin-web AGENTS.md exists. Exact [Expo v57](https://docs.expo.dev/versions/v57.0.0/) read before code. Installed Next 16.3.0 guides: `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md` and `10-error-handling.md`. [Supabase skill](C:/Users/User/.codex/plugins/cache/openai-curated-remote/supabase/1.0.0/skills/supabase/SKILL.md) used. Reviewed [order](https://supabase.com/docs/reference/javascript/order), [inclusive range](https://supabase.com/docs/reference/javascript/range), [exact count](https://supabase.com/docs/reference/javascript/select), [PostgREST v14 embedding](https://docs.postgrest.org/en/v14/references/api/resource_embedding.html), [v14 aggregates](https://docs.postgrest.org/en/v14/references/api/aggregate_functions.html), and [Supabase changelog](https://supabase.com/changelog). Markdown changelog failed with unsupported content type; HTML provided the fallback. No API/grant/Realtime schema change was authorized by reading these docs.

Installed PostgREST client retry source (`PostgrestBuilder.ts:340`–`:383`, `types/common/common.ts:8`) still supports three automatic read retries by default; later request deadlines must include Retry-After time and finite page correction. No adapter/retry change was made.

From the repository root, with existing installed Node/TypeScript/ESLint and local Docker database:

```powershell
# A fresh baseline refuses to overwrite its original capture.
node plans/evidence/admin-table-phase2-baseline/audit.mjs baseline
node plans/evidence/admin-table-phase2-baseline/inventory.mjs
node plans/evidence/admin-table-phase2-baseline/checks.mjs fixtures
node plans/evidence/admin-table-phase2-baseline/checks.mjs typecheck
node plans/evidence/admin-table-phase2-baseline/checks.mjs lint
# Local read commands may require approved named-pipe access.
node plans/evidence/admin-table-phase2-baseline/checks.mjs local
node plans/evidence/admin-table-phase2-baseline/nested-catalog.mjs
node plans/evidence/admin-table-phase2-baseline/finalize.mjs
```

Reruns refresh this directory's own reports; preserve failed attempts before investigating/retrying. No dependencies were added. Baseline blockers: none. Fresh hosted/browser/Realtime acceptance, broad Unicode equivalence, implemented browse behavior, performance, build/release and manual/cross-browser accessibility remain unverified later gates.
