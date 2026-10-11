# Requested Phase 6 — Baseline and contract verification only

2026-10-11, Asia/Manila. The requested title maps to the plan's historical baseline gate; historical Phase 6 release work remains unstarted. Only the plan and this directory are task writes. No application behavior, migration, deployment, production data or resident Android UI was changed.

## Evidence

- `baseline.json` / `baseline-status.txt`: immutable HEAD, branch, dirty/untracked status and **3,424 pre-existing non-task file hashes**. Highest repository migration is `0109_invalidate_changed_profile_email_verification.sql`; next unused is `0110`, subject to rechecking before any later creation. No migration was created or applied.
- `documentation.json`: instructions and exact Expo v57, installed Next testing guide, official Supabase count/range/order/changelog and versioned PostgREST v14 documentation reviewed. Missing guessed Next path and unsupported Markdown changelog response are recorded. No package installation or delegation.
- `source-inventory.json`: fresh TypeScript AST inventory, **68 files / 638 active entries**. Full column objects include render/edit maps, queries, forms/details/review, shared shell/scroll/table/loading and Header/audit dependencies. Comments are excluded. Entries include array/storage operations, not just database queries.
- `field-contracts.json`: **255 required field definitions** across current local/current hosted/retained hosted catalogs and eight active table contracts. Full catalogs contain 192 affected base columns. Field types, nullability, constraints, indexes, policies/RLS, collations and history are captured.
- `hosted-schema.json`, `hosted-scale.json`, `hosted-nested-catalog.json`, saved queries and `capture-provenance.json`: fresh connector reads against the linked project, using read-only transactions and 8-second SQL deadlines. Only metadata and aggregate counts are saved. No production rows become synthetic fixtures.
- `local-schema.json`, `nested-catalog.json` and read logs: fresh local read-only metadata. Supporting catalog: 50 columns, 32 policies, 11 helpers and 21 publication entries. `final-verification.json` compares both catalogs: all affected read policies match; full policy equality is false because hosting has an additional payment INSERT policy. Three helper definition texts differ only in line endings; all 11 match after normalization. This is not full function/trigger or write-execution equality.
- `fixtures.mjs`, `verify.mjs`, `fixtures.log` / result: **55 Node tests passed / 0 failed**. Reuses existing Node/TypeScript tooling, actual source predicates/render branches/client comparators with mocked transport/joins. Does not execute SQL order, RLS, React/Next rendering or Realtime.
- `comparison-fixture.sql` / results: **11 independent read-only SQL assertions passed**. Covers lower/trim/accent/null, numeric suffix samples, timestamp instant equality, Manila midnight and 45 size/page-size combinations. This is an independent value oracle, not implemented pagination or a complete natural-reference comparator.
- `typecheck-result.json`: admin typecheck exit 0, **21,692ms**, 60-second deadline, incremental writes disabled.
- `lint-batch0/1.json`: two concurrent 33-file batches timed out at 45 seconds without diagnostics. `lint-small0.json` also timed out; `lint-small1.json` passed (20,846ms). No small batches 2/3 were run. Process metadata confirmed no surviving audit lint children. `lint-debug.log`: one-file host-runtime diagnostic passed. `lint-host.json`: final bounded host-runtime lint of all **66 distinct affected files passed**, **23,204ms**, 60-second deadline. Timeout cause remains unproven; earlier failures are retained. No `--fix`, whole-package lint or build.
- `scope-and-provenance.json`: indexed source, 257 historical admin/shared files and 107 historical migrations match retained runtime hashes. Nine historical runtime/cleanup report hashes match the preceding audit. **3,419 of 3,424 baseline files remain byte-identical**, with no missing/outside additions. Five concurrent Android registration/navigation changes were inspected and preserved (`concurrent-change-review.json`). Strict scope remains exit 1; final consistency accepts only exact reviewed hashes, not arbitrary drift. `scope-attempt1.json` / `final-attempt1.json` retain the failure. Baseline hashes cannot reconstruct exact textual deltas; tracked Git diffs include pre-existing work. Actual historical evidence: 42 Auth/REST assertions, 11 query-edge assertions, eight rendered screens, 30 interaction assertions, five real feeds, two permission observations. These are retained observations, not newly executed checks.
- `final-verification.json`: actual final consistency status, scope comparison, script syntax, JSON parsing, source/schema/report linkage, catalog differences, checks and evidence hashes. A successful report is required for baseline completion.

## Contracts and narrow proposals

Plan sections 6 and 12 contain the complete source-linked screen/shared/nested contract matrices. Fresh AST/source parity revalidates their one-based locations. Submitted = Request/Incident `created_at`; Registered = registration `created_at`; Transaction Date = payment `created_at`; Health current Date = scheduled `drive_date`, while proposed Date created = drive `created_at`. No base request/incident `submitted_at` or registration `registered_at` exists. ID-submission `submitted_at` is a separate real field; audit aliases do not create columns.

None of the eight current main queries combines complete filtering, global ordering, exact counts and valid numbered pagination. All lack exact count/range; Incident category is the existing database-side filter exception. Preserve search trim differences, nullable relationships, Applicant inner scores, Staff missing-profile exclusion, all independent summaries and action guards.

Existing direct base/to-one filters, parent ordering, counts and inclusive ranges should be used first. Retained nonempty authenticated evidence supports Requests, Transactions and inner-score Applicants candidates. Some complex Incident/Household/Staff shapes have parser/zero-row evidence only. `.order('relation(field)')` orders parents; `referencedTable` order only orders embeds.

Conditional narrow read support is justified for disabled aggregates, absent Applicant profile relation, separator-preserving comorbidity substring expression and derived normalized/natural/display keys. No generic dynamic endpoint, eight-RPC architecture, new dependency or index is demonstrated. Future adapters must explicitly enforce tenant/active-admin membership and bounded deadlines encompassing SDK retries/Retry-After plus at most one page correction.

Existing unfixed defects: capped scans/summaries/search loss, empty/zero substitutes on errors, stale selected snapshots, failed-save draft discard, Parent / Other excluding parents, resize-drag unmount cleanup gap, removed-admin access and cross-tenant active Health visibility. Scores remain separately protected. Five table feeds differ from Header/drawer channels; Health has no registration-only feed. Directory's commented table and unused member form/hook are not active implementations; Request History is cards.

Current hosted aggregate counts: profiles 28, requests 69, payments 55, incidents 30, drives 13, registrations 10, members 6, officials 5. All 69 references canonical; zero cancelled registrations; six drives have no registrations. These counts do not establish large-data performance. Hosted maximum-row SQL setting is null/unavailable.

## Reproduction and boundaries

Run from the repository root, using existing Node dependencies:

```powershell
node plans/evidence/admin-table-phase6-baseline/inventory.mjs
node plans/evidence/admin-table-phase6-baseline/checks.mjs fixtures
node plans/evidence/admin-table-phase6-baseline/checks.mjs typecheck
node plans/evidence/admin-table-phase6-baseline/checks.mjs local
node plans/evidence/admin-table-phase6-baseline/nested-catalog.mjs
node plans/evidence/admin-table-phase6-baseline/field-contracts.mjs
node plans/evidence/admin-table-phase6-baseline/audit.mjs verify
node plans/evidence/admin-table-phase6-baseline/finalize.mjs
```

Never rerun `audit.mjs baseline`: it refuses overwrite. Local scripts require access to the existing `supabase_db_barangayan` container; they create no objects/services. Hosted queries can be rerun through the connector with the repository-linked project ID; never substitute DDL or data writes. Commands overwrite only their owned result artifacts; finalization rehashes evidence. Retain failures before rerunning. `lint-small.mjs 0..3` is a bounded reproducer, not evidence that unexecuted batches passed. Host lint used the existing `C:/Program Files/nodejs/node.exe`, ESLint CLI and the 66 inventory paths, without fixes; its exact selected paths and deadline are saved in `lint-host.json`.

Fixtures use fixed time/synthetic IDs, nine sizes and five page sizes, mixed case/accent/Unicode/null/blank/long/missing-related values, four permission actors and eight concurrency schedules. Duplicate references are comparator DTOs, not valid UNIQUE-constrained inserts. Permission/concurrency schedules are definitions, distinct from retained actual runtime observations.

First local attempt failed on sandbox Docker named-pipe access; `local-attempt1*` retains it. One approved read-only retry passed. The initial large catalog-save call exceeded tool review's code-size limit; bounded segments saved the same authorized metadata. No automatic audit retry, polling, subscription or service was added.

No task accounts, containers, networks, ports, subscriptions, temporary database objects or test data were created. Child checks exited or reached finite deadlines; `process-cleanup.json` records the final process inspection. No resource deletion is necessary. Historical disposable cleanup remains hash-verified.

Unknowns: current hosted transport cap, fresh authenticated hosted/browser/Realtime acceptance, every mutation/RPC execution, full trigger/function alignment, proposed comparison/global-filter/page-correction behavior, broad Unicode semantics, build/release, physical inputs, cross-browser/manual accessibility and 10k/100k performance. These are explicitly unverified later/runtime checks, not successful results or current production-readiness claims.
