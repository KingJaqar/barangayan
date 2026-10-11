# Requested Phase 1 — baseline verification only

Date: 2026-10-11, Asia/Manila. **Complete for the baseline stage.** The plan's historical baseline is numbered Phase 0; its Phase 1 shared frontend foundation is still unstarted. The current user request controls scope. See [plan section 7](C:/Users/User/barangayan/plans/Admin_Web_Table_Browsing_Sorting_Pagination_and_Filters_Implementation_Plan.md).

Only the plan and this evidence directory were written. No application behavior, dependency, migration, deployment, production row, existing service, or resident Android UI was changed. No task resources were created; no deletion/cleanup operation was necessary. Local SQL consists of read-only catalog queries and transient CTE values, with no temporary objects.

## Evidence and actual results

| Artifact | Result / interpretation |
|---|---|
| `baseline.json`, `baseline-status.txt` | Original HEAD/branch/status and 3,190 file hashes. Highest prefix `0109`; next unused `0110` at capture. Existing untracked plan/Phase 0 evidence and unrelated resident work were preserved. |
| `source-inventory.json` | 68 files, 638 source-linked active entries. Installed TypeScript parser excludes commented JSX. Indexed dependency files are not automatically reachable components; the plan explicitly identifies unused household helpers and obsolete Directory markup. |
| `field-contracts.json` | 170 schema field definitions verified across fresh local and retained hosted captures; eight active EditableDataTables; current AST exactly equals retained inventory. Column renderer/editor mappings and query/filter/behavior locations are included. Document names additionally have `0002_document_types_and_service_requests.sql:14` schema evidence and actual join/query evidence in the retained reports. |
| `fixtures.mjs`, `verify.mjs`, `fixtures.log` | **41 passed, zero failed**, 2,331.6895ms test duration. Reused the 35 existing focused tests and added six: independent summaries, Health cancelled/omitted/zero registration meaning, capped registration undercount, Household parent-card mismatch, joined-array substring search, ID-presence versus decision. VM executes actual server-page/filter and extracted client-sort expressions with modelled transport, not SQL/RLS/embedding. |
| `comparison-fixture.sql`, `comparison-fixture-results.json` | **11 independent SQL value checks passed**: normalized case/accents, null-last orders both ways, equal timestamp instants, three numeric suffix values, Manila midnight, 45 size/count combinations. Read-only CTE oracle, not application global ordering/pagination. |
| `local-schema.json`, `schema-alignment.json` | Fresh local catalog matches retained hosted columns/constraints/indexes/RLS/collations/migration history. Policies as a whole differ due to retained hosted-only payment INSERT policy; SELECT/ALL read policies match. Statistics are estimates; no fresh hosted scale check or full trigger/function equality is claimed. |
| `check-results.json`, `admin-typecheck.log` | Typecheck **exit 0**, 17,317ms, incremental output disabled. Full package lint hit **ETIMEDOUT at 60,033ms**, no diagnostics; timeout is not a pass or an established code defect. |
| `focused-lint.json`, `focused-lint.log` | Narrower check after reviewing full timeout/log and ESLint ignores: **66 affected admin TypeScript files, exit 0**, 44,973ms within 60s. It does not relabel whole-package lint as successful. |
| `local-catalog.log` | Initial local read failed on Docker pipe permission, exit 1 in 205ms. Investigated before a single approved read-only retry; original failure preserved. |
| `local-catalog-approved.log`, `sql-comparison.log` | Approved local reads succeeded with 15-second process / 8-second SQL bounds. No migrations/seeding/service resets. |
| `scope-and-provenance.json` | 3,190 baseline files preserved, no outside-scope additions, 68 current source files and 107 historical migration files match retained runtime manifest. Runtime reports are individually hashed. |
| `final-verification.json` | Final script syntax, schema/read-policy comparison, fixture/report consistency, whitespace and scope checks. This report must be read for actual results rather than inferred from this checklist. |

Fixtures cover 0/1/7/10/11/23/100/101/1,505 rows and page sizes 10/20/30/50/100, two tenants, missing embeds, duplicate/null/blank/case/accent/Unicode/custom/numeric/long values and permission/concurrency schedules. Array paging or event schedules alone are not executed application pagination/security/race tests. Duplicate-reference DTOs cannot be inserted unchanged into UNIQUE-constrained tables.

Retained Auth/REST/browser/feed observations are in [Phase 0 evidence](C:/Users/User/barangayan/plans/evidence/admin-table-phase0/README.md): 42 API assertions, 11 query-edge assertions, eight rendered screens, 30 completed interaction assertions, five actual table feeds, two permission observations. Runtime version was PostgREST 14.5 and Chrome 154.0.8037.99. Source/migration parity supports reusing those baseline observations. We did **not** rerun authenticated sessions, browser flows or Realtime in this task. Failed historical attempts remain failed, and the prior cleanup report is retained, not represented as a newly performed cleanup.

## Findings and scope decisions

All eight current queries are incomplete browse implementations: capped fetch plus post-fetch filtering/local sort, no main exact count/range/page controls or unique tie-break. Underlying native read/count/range and related-order/filter primitives are available; do not infer eight new RPCs. Retained nonempty authenticated evidence is strongest for Requests, Transactions and Applicants; several other query shapes have parser-only evidence and need implemented-adapter verification later.

Narrow demonstrated gaps: Health grouped registration counts/sort and payment sums when aggregates are disabled; Applicant user-ID/profile relationship for global name order and joined-array textual search; transformed natural/normalized/label keys. Remaining DTO projections and tenant/day/error handling are frontend adapter corrections. No new indexes are justified without measured plans. Section 6 and section 7 contain the per-screen assessments and source links.

Submitted/Registered are base `created_at`; Health scheduled date and official `date_hired` remain separate. `confirmation_count` is the exact Incident field. The first new field-validator run failed on a mistakenly pluralized field, then source/schema inspection corrected the fixture script; subsequent validation passed. Score belongs to the protected score table; nonexistent soft-delete/provenance fields were explicitly rejected.

Other verified baseline defects: removed-admin request access, active foreign Health drive visibility, discarded failed-edit drafts, stale selected snapshots, silently empty/error counts, capped independent scans and the Household parent-summary mismatch. `pinLastColumn` is width pinning. Current installed PostgREST client retries transient reads up to three times by default; future adapters need explicit deadlines accounting for Retry-After and page correction. No fixes were made.

## Documentation and reproducibility

Instructions: root/admin-web `AGENTS.md`. Exact [Expo v57 reference](https://docs.expo.dev/versions/v57.0.0/) read before script writing. Installed Next data-fetching/error-handling guides consulted. [Supabase skill](C:/Users/User/.codex/plugins/cache/openai-curated-remote/supabase/1.0.0/skills/supabase/SKILL.md), [v14 embedding](https://docs.postgrest.org/en/v14/references/api/resource_embedding.html), [v14 aggregates](https://docs.postgrest.org/en/v14/references/api/aggregate_functions.html), [order](https://supabase.com/docs/reference/javascript/order), [range](https://supabase.com/docs/reference/javascript/range), [exact count](https://supabase.com/docs/reference/javascript/select), and [changelog](https://supabase.com/changelog) reviewed. Markdown changelog returned unsupported-content-type in the web reader; HTML supplied fallback. Installed client retry implementation was inspected directly; no new API signature was invented.

From `C:/Users/User/barangayan`, using installed Node/TypeScript/ESLint/Docker/container psql:

```powershell
# Capture once at a fresh audit start; refuses to overwrite this saved baseline:
node plans/evidence/admin-table-phase1-baseline/audit.mjs baseline
# Current-source index (writes only this evidence directory):
node plans/evidence/admin-table-phase1-baseline/inventory.mjs
node --test --test-timeout=30000 plans/evidence/admin-table-phase1-baseline/verify.mjs
# Optional package typecheck/lint/initial local-read suite; retains failures/timeouts:
node plans/evidence/admin-table-phase1-baseline/checks.mjs
# Local Docker permission may require the approved read-only execution context:
node plans/evidence/admin-table-phase1-baseline/local-read.mjs
node plans/evidence/admin-table-phase1-baseline/field-contracts.mjs
node plans/evidence/admin-table-phase1-baseline/focused-lint.mjs
node plans/evidence/admin-table-phase1-baseline/finalize.mjs
```

Every child process has a timeout; no automatic retry or polling is in the new scripts. The only Docker retry followed a specific pipe-permission failure and approved read-only escalation. Scope validation reports differences without resetting/restoring/deleting user files. Reruns refresh their own reports; retain separate attempt files when investigating new failures. No credentials or real row contents are stored.

**Baseline blockers: none.** Full package lint timeout remains a check limitation. Fresh hosted state/authenticated acceptance, broad Unicode comparison equivalence, future browse behavior, production build, physical input, other browsers/accessibility and 10k/100k performance remain unverified later gates. Baseline completion is not a functionality or production-readiness claim.
