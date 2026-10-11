# Requested Phase 4 — Baseline and contract verification

2026-10-11, Asia/Manila. Only the plan and this isolated evidence directory were written. Historical Phase 4 (Directory/Households/Staff implementation) remains unstarted. No app behavior, migration, deployment, production data or Android UI changed.

## Evidence map and actual checks

- `baseline.json` / `baseline-status.txt`: original HEAD, branch, dirty tree and SHA-256 manifest of 3,320 pre-existing non-task files. Highest prefix `0109`; next unused `0110`, recheck before future migration creation. Baseline refuses overwrite.
- `source-inventory.json`: fresh TypeScript AST index of 68 files / 638 active entries, equal to the retained runtime source index. Includes eight column definitions, page queries, render/edit mapping, forms/details/review, loading, shell/scroll/table, header search, notifications and audit drawer. Comments are excluded; `.from` entries are not all database table calls.
- `field-contracts.json`: 255 checked field definitions (85 required definitions in each of fresh local, fresh hosted and retained hosted catalogs), with current columns/query/behavior locations for eight tables. Catalogs capture all 192 inspected base columns, constraints, indexes, RLS/policies, collations and history. Missing `submitted_at`/`registered_at`, removed registration score and hard-delete tables are asserted explicitly.
- `local-schema.json`, `hosted-schema.json`, `hosted-schema-query.sql`: fresh metadata reads. `nested-catalog.json` / SQL: 50 supporting columns, 32 policies, 11 helper definitions and 21 publication entries, local only. No RPC/action was executed. Connector hosted query used an 8-second SQL deadline and no automatic retry; local children have 15-second deadlines.
- `hosted-scale.json` / SQL: fresh exact aggregate counts only: profiles 28, requests 69, payments 55, incidents 30, drives 13, registrations 10, members 6, officials 5. All 69 references canonical, no cancelled registrations, six drives without registrations. These small populations do not establish large-data performance. Hosted API maximum-row setting is null/unavailable.
- `fixtures.mjs`, `verify.mjs`, `fixtures.log`: **53 passed / 0 failed**. Reuses the prior 49-test source VM harness and adds four independent checks: Directory JSON household counts, ledger sum membership, failed Request options and Health tenant-predicate omission. Synthetic DTOs, fixed time, no network/credentials. Nine sizes × five page sizes = 45 combinations. Includes comparison edge values, four permission actors and eight concurrency schedules; schedule presence is not live execution.
- `comparison-fixture.sql` / results: **11 independent SQL value assertions passed**, read-only CTEs, 8-second SQL / 15-second process deadlines. Covers lower/trim/accent/null behavior, instant equality, Manila midnight, suffix values and page-slice oracles. Does not execute application pagination or prove a full natural comparator.
- `typecheck-result.json`: exit 0, incremental writes disabled. `lint-batch0.json` and `lint-batch1.json`: two successful disjoint batches cover all 66 affected admin TypeScript files. `lint-attempt1*` preserves the original combined 60-second timeout, with no diagnostics. Whole-package lint/build were not run.
- `scope-and-provenance.json`: all indexed sources, 257 historical admin/shared files and 107 historical migrations match retained runtime hashes. Nine retained report hashes equal the prior Phase 3 audit. Historical counts: 42 Auth/REST assertions, 11 query edges, eight rendered screens, 30 interactions, five real feeds, two permission observations. Retained failed attempts stay failures. No new Auth/browser/Realtime fixture stack was started.
- `final-verification.json`: syntax checks, evidence/schema alignment, result consistency, whitespace, strict scope and artifact hashes. Completion requires this script to pass, not merely the presence of this README.

## Contracts and limitations

Plan section 10 records per-screen capability decisions; section 6 provides source line references, with matching current AST locations. Submitted = Request/Incident `created_at`; Registered = registration `created_at`; Transaction Date = payment `created_at`; Health displayed Date = scheduled `drive_date`, proposed Date created = drive `created_at`. Joined/Added/Hired are separate profile creation/member creation/official `date_hired`. Score is in `drive_registration_scores`.

None of the eight current main queries satisfies complete filtering/global sorting/exact counts/paging together. Keep supported direct reads, to-one orders, exact counts and inclusive ranges. Narrow future support is justified for disabled aggregates, absent Applicant profile relation, joined-array text and transformed comparison/label keys. Some complex Incident/Household/Staff candidate queries have only parser/zero-row evidence, not complete nonempty authenticated coverage. No measured index requirement or new dependency exists.

Verified baseline defects remain unfixed: capped scans/secondary totals, silent empty/zero errors, stale selected details, failed-save draft discard, Parent / Other card excluding parents, drag-unmount cleanup gap, removed-admin access and cross-tenant active Health visibility in retained sessions. Five table feeds are distinct from persistent Header/drawer channels; Health lacks a registration-only feed. Directory's commented table and uncalled separate member form/hook are obsolete; request history is cards.

Current local/hosted columns, constraints, indexes, RLS, collations, migration history and SELECT/ALL policies match. Full policy equality is false: hosted has one additional payment INSERT policy. Fresh hosted catalog matches retained catalog for the captured structural keys; this is not full trigger/function equality or authenticated production acceptance. No database difference was repaired.

VM models returned DTOs and the API cap; it does not implement SQL joins/order, RLS or Realtime. Historical runtime checks provide source-linked representative observations, not execution of every action, fresh production permission acceptance, long-run leak freedom or release readiness. Future improved comparisons, physical input, cross-browser/accessibility, 10k/100k benchmarks and build/release remain unverified later gates.

## Failures, scope and cleanup

One sandbox Docker named-pipe denial is preserved in `local-attempt1*`; one reviewed, approved read-only retry succeeded. Combined lint hit its 60-second deadline without output; source/config inspection found no diagnostic to fix. Two smaller batches supply bounded verification rather than claiming the timeout passed. Initial 49-test run passed; after four new tests the 53-test run passed. No automatic polling, recursive retries or services were introduced.

No temporary objects, accounts, containers, networks, ports, subscriptions, installs or copied previews were created, so no cleanup action was necessary. Read-only SQL transactions finish without persistent objects. Earlier runtime cleanup is retained with report hashes. Strict current scope checks must be consulted for any concurrent changes; never restore or overwrite unrelated work.

## Documentation and repeatability

Read root/admin-web AGENTS.md, exact [Expo v57 reference](https://docs.expo.dev/versions/v57.0.0/), installed Next 16.3.0 `06-fetching-data.md` and `10-error-handling.md`, and [Supabase skill](C:/Users/User/.codex/plugins/cache/openai-curated-remote/supabase/1.0.0/skills/supabase/SKILL.md). Reviewed [range](https://supabase.com/docs/reference/javascript/range), [order](https://supabase.com/docs/reference/javascript/order), [count](https://supabase.com/docs/reference/javascript/select), versioned [PostgREST v14 embedding](https://docs.postgrest.org/en/v14/references/api/resource_embedding.html) and [aggregates](https://docs.postgrest.org/en/v14/references/api/aggregate_functions.html). Markdown changelog failed with unsupported content type; [HTML changelog](https://supabase.com/changelog) and linked grant/PG/Realtime breaking-change entries supplied the review. Initial installed-doc filenames were incorrect; file discovery located the actual guides before scripts were written.

From repository root, with existing tools (no installs):

```powershell
node plans/evidence/admin-table-phase4-baseline/audit.mjs baseline # first capture only
node plans/evidence/admin-table-phase4-baseline/inventory.mjs
node plans/evidence/admin-table-phase4-baseline/checks.mjs fixtures
node plans/evidence/admin-table-phase4-baseline/checks.mjs typecheck
node plans/evidence/admin-table-phase4-baseline/focused-lint.mjs 0
node plans/evidence/admin-table-phase4-baseline/focused-lint.mjs 1
node plans/evidence/admin-table-phase4-baseline/checks.mjs local
node plans/evidence/admin-table-phase4-baseline/nested-catalog.mjs
node plans/evidence/admin-table-phase4-baseline/finalize.mjs
```

Hosted captures were made through the Supabase connector against the repository-linked project, using the saved read-only SQL files. They are not refreshed by finalization. Local Docker access may need approval. Preserve failed reports before adaptive retries. Reruns write only this evidence directory; scope checks fail on unexplained external drift.
