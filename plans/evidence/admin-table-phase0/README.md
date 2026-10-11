# Phase 0 evidence — 2026-10-11 (Asia/Manila)

**Complete:** source/schema contracts, deterministic fixtures, authenticated isolated query and browser baseline checks, scope comparison, and temporary-resource cleanup have supporting evidence. Later phases remain unstarted. Task writes are limited to the plan and this evidence directory; application source, dependencies, application migrations, existing databases, deployments, production rows, and resident Android UI were preserved.

The [plan](C:/Users/User/barangayan/plans/Admin_Web_Table_Browsing_Sorting_Pagination_and_Filters_Implementation_Plan.md) records the user's authorization for all its phases and necessary tools, including Docker. Authorization is distinct from successful verification. The permanently cancelled Android usability work remains excluded.

## Initial source and read-only audit

Run from `C:/Users/User/barangayan` with existing tooling:

```powershell
node plans/evidence/admin-table-phase0/inventory.mjs
node --test --test-timeout=30000 plans/evidence/admin-table-phase0/verify.mjs
node plans/evidence/admin-table-phase0/probe.mjs
node plans/evidence/admin-table-phase0/local-schema.mjs
node plans/evidence/admin-table-phase0/comparison-fixture.mjs
node plans/evidence/admin-table-phase0/scope.mjs
```

`checks.mjs` runs admin typecheck and lint with separate 60-second limits and disables incremental output. Recorded results: typecheck exit 0 in 13,831ms; lint exit 0 in 36,552ms (`check-results.json`). No production build was run.

`baseline-head.txt`, `baseline-status.txt`, and `baseline-hashes.json` preserve the original dirty working tree. The initial manifest includes its own recording artifacts; do not interpret those as pre-existing user edits. Highest repository migration prefix is `0109`; any future migration must recheck and use the next unused four-digit prefix (currently `0110`). No application migration was written or applied by this task.

`source-inventory.json` uses the installed TypeScript parser to index **68 files / 638 active source entries**, including shared/nested views, columns, queries, actions, dialogs, sort expressions, and subscriptions. JSX comments are excluded. It establishes source locations, not execution of every action.

`hosted-schema-query.sql`/`hosted-schema.json`/`hosted-schema-result.json` preserve the read-only hosted catalog query and connector result. `hosted-security-query.sql`/`hosted-security.json` capture selected helper definitions, grants and publication membership. `hosted-scale-query.sql`/`hosted-scale.json` record aggregate counts, without resident contents. SQL uses read-only transactions and an 8-second statement limit. The available project and configured public URL were matched. No hosted writes were made.

Initial `local-schema.json` and `schema-alignment.json` inspect the existing local container with 15-second Docker command limits. That initial audit created no resources. Both databases were PostgreSQL 17.6; affected columns, constraints, indexes, RLS flags and inspected collations matched. Initially local history ended at `0108`, hosted at `0109`. Separate work advanced the local source history before the later isolated copy. The hosted-only payment INSERT policy remains absent locally; affected read policies match. Catalog/migration-number equality does not prove every function/trigger or migration file content matches.

`environment-api-results.json` records zero-row anon REST/parser probes, HTTP status, Content-Range and error codes. These establish parser acceptance and anon score denial, not authenticated ordering or tenant isolation. Requests have 10-second timeouts and no automatic retries. Public configuration is read without printing credentials. Initial transport/Docker restriction failures were investigated before approved read-only execution. Host CLI/psql were unavailable; container psql supplied the fallback.

Hosted counts at capture: 28 profiles, 69 requests, 55 payments, 30 incidents, 13 drives, 10 registrations, 6 members, 5 officials. All 69 references had canonical five-digit suffixes; six drives had no registrations and none were cancelled. These small counts do not establish large-data performance or custom-reference behavior.

## Deterministic fixtures and focused source checks

`fixtures.mjs` covers required sizes/page sizes, duplicate names/references/timestamps/scores/labels, two tenants, punctuation, blank/null/accent/Unicode/custom/numeric references, long content and missing relationships. Duplicate reference DTOs are comparison fixtures, not valid inserts against UNIQUE constraints. Exported permission/concurrency schedules are expected scenarios, not themselves executed tests; actual runtime checks below are separate evidence.

`verify.mjs` transpiles all eight actual server pages into an isolated VM with a modelled Supabase transport and extracted client sort expressions. Its transport models predicates and the cap, not RLS, embedding, SQL ordering or Realtime. Array-slice paging checks do not imply pagination exists in the app. **35 tests passed / 0 failed**, initially in `fixtures.log`, and again in `runtime-source-tests.log` after runtime work.

`comparison-fixture.sql` uses read-only VALUES/generate_series CTEs for ICU lower/trim/accent/null/blank behavior, timestamp instants, numeric suffix equivalence, Manila midnight and 45 count/size combinations. **11 assertions passed** (`comparison-fixture-results.json`). No function/collation was created; this experiment is not the future global comparison implementation.

## Authenticated isolated runtime evidence

`runtime-stack.mjs` creates only labelled task-owned containers/network and loopback services. It copies schema/ownership/grants and infrastructure migration metadata from the existing local database, excluding its incompatible older Realtime infrastructure schema, then lets the pinned Realtime service create its own infrastructure. No source accounts or application records are copied. Fresh local signing keys and fixture credentials exist only in ignored task state. `runtime-seed.sql`/`runtime-seed.mjs` create deterministic tenant fixtures and four real Auth test accounts. Eight populations each contain 1,505 intended table rows; auxiliary/missing-join records are described in the seed and result files.

`runtime-serve.mjs` creates an isolated admin-source snapshot and local API proxy, with a 20-minute maximum lifetime. The production source and environment files are not altered. Browser scripts use existing bundled Playwright and installed Chrome, without adding dependencies. Script comments/arguments document bounds and assumptions; use finite fresh-stack attempts after investigating failures, never reset an unrelated database.

A fresh reproduction follows this order, keeping the bounded preview process running separately:

```powershell
node plans/evidence/admin-table-phase0/runtime-stack.mjs start
node plans/evidence/admin-table-phase0/runtime-serve.mjs
# Separate terminal while the preview is running:
node plans/evidence/admin-table-phase0/runtime-seed.mjs
node plans/evidence/admin-table-phase0/runtime-api.mjs
node plans/evidence/admin-table-phase0/runtime-browser.mjs
node plans/evidence/admin-table-phase0/runtime-interactions.mjs
node plans/evidence/admin-table-phase0/runtime-query-edges.mjs
node plans/evidence/admin-table-phase0/runtime-subscriptions.mjs
node plans/evidence/admin-table-phase0/runtime-route-permissions.mjs
node plans/evidence/admin-table-phase0/runtime-finalize.mjs
# Stop only the verified owned preview process tree, then:
node plans/evidence/admin-table-phase0/runtime-stack.mjs cleanup
# Verify the exact task snapshot path/ownership, then remove that snapshot.
```

The sequence requires the captured source schema/images, existing Chrome/runtime paths and free task ports. A changed migration/schema is deliberately rejected for review. Start refuses existing task state/container collisions; cleanup validates owner labels and a private-file allowlist. Query-edge collector fixtures are prepared by the interaction check. The finalizer accepts a complete interaction run, or consolidates preserved completed assertions from the documented partial runs. Future reproduction may discover different results; retain failures rather than overwrite historical completion claims.

| Evidence | Actual result and boundary |
| --- | --- |
| `runtime-stack.json`, `runtime-final-schema.json` | Final affected columns/constraints/indexes/RLS/collations/history/read policies match captured hosted catalog; hosted-only payment INSERT policy remains a known difference. |
| `runtime-api-results.json` | **42 passed** with real Auth/REST/RLS. Eight capped 1,000-row responses have exact totals of 1,505; bounded pages concatenate to independently expected IDs. Related searches, parent ordering, score ordering, missing joins and multi-tenant/resident/removed-admin reads executed. Final clean-stack API reproduction also passed. |
| `runtime-query-edges.json` | **11 passed**: nested OR/collector search, literal punctuation through escaped native operators, applicant status/inner membership, and invalid-range 416/PGRST103 with exact HEAD-count recovery. |
| `runtime-browser-results.json` | **Eight rendered screens**, 1,000 rows each, Chrome 154.0.8037.99. This is headless baseline coverage, not the full physical-browser matrix. |
| `runtime-interaction-attempt3.json`, `runtime-interaction-results.json` | **30 completed assertions**, 22 from a preserved partial run plus eight later checks. Earlier failed expectations remain failed. Guards, five detail identities, valid/invalid/HTTP-denied edits, actual refresh/stale selected snapshot, debounce, Back/Forward, delayed response and bounded post-unmount behavior executed. |
| `runtime-subscription-results.json` | **Five real table change feeds passed**, matching fixture IDs/values and removing each client channel. Final clean-start check confirms the actual WAL resource before writing. |
| `runtime-route-permissions.json` | **Two observations passed**: resident redirects to login; removed admin still renders requests, reproducing a defect. |
| `runtime-completion.json` | Consolidated executed counts, final schema alignment, subscription boundary and 3,113-file scope comparison. |
| `runtime-cleanup.json` | Four task containers, network, private credentials and copied preview removed; zero owned preview processes and zero listeners on task ports. |

Verified defects include capped/incomplete table filtering and totals, removed-admin request access, public Health policy exposing active foreign-tenant drives, discarded failed-edit drafts, and stale selected-detail snapshots after refresh. Score reads remain restricted in tested sessions. Ordinary joins/search/count/range capabilities work; disabled aggregates, absent applicant-profile relationship and transformed/natural/label sort keys justify only the narrow read support described in the plan. No table improvements were implemented.

Actual incident leave/no-callback evidence covers a 2,500ms post-unmount mutation window. Shared Header audit channels persist across routes by design. Server subscription metadata alone does not prove a live listener or leak. Longer stress, observer cleanup under the complete future design, authenticated hosted acceptance, other browsers, physical input, broad accessibility and 10k/100k performance remain later gates.

Failures were investigated before corrections. Preserved attempt files/logs include bootstrap/HBA, fixture triggers/active-resident/name fields, hydration/selectors, proxy methods/headers/large lookup/WebSocket path, copied Realtime infrastructure incompatibility and serialized-array observation. Final setup/seed/API were repeated on a fresh stack; final feeds passed after bounded WAL readiness checks. Corrections affected only fixture/harness resources, not existing application behavior.

## Scope and completion

Initial scope comparison checked 3,094 non-task files and flagged three unrelated resident-OTP documents; `scope-result.json` records exit 1 rather than claiming workspace equality. The continuation manifest checks 3,113 files; `runtime-completion.json` identifies three concurrent unrelated OTP artifacts, no missing files and **zero admin/Android application byte changes**. These unrelated edits were preserved. Tracked diff whitespace checks do not cover untracked evidence; script syntax and report consistency are verified separately. All **18** `.mjs` scripts passed syntax checks.

No Phase 0 evidence gate remains unresolved. Known defects need later scoped implementation; release/performance/browser gates remain unverified. Phase 0 completion is not a claim of bug-free behavior, full functionality or production readiness.

`final-artifact-checks.json` records the final successful audit: 18 script syntax checks, 36 existing JSON reports parsed, 38 evidence references resolved, completion/schema/cleanup assertions checked, 3,113 baseline files compared, and tracked diff whitespace check exit 0 with existing line-ending warnings. It does not relabel failed historical attempts or repeat later release tests.
