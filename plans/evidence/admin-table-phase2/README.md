# Phase 2 — verified data-query correctness

Completed 2026-10-11 for the section 4 Phase 2 gate. The eight production routes remain scheduled for Phases 3–5; these adapters are opt-in.

## Implemented scope

- Admin-only server adapter for all eight tables, with validated allowlists, full filtering/search and stable database ordering before exact count/range. Five page sizes (10/20/30/50/100), blank-last ordering in both directions, normalized text, numeric reference tokens, displayed labels and ascending base-ID ties.
- The database first returns the authoritative bounded ID page. A second bounded read fetches joined DTO payloads using those IDs and the same filters, then restores ID order. This avoids constructing every candidate's JSON on deep pages; it does not sort the limited page locally. A payload membership change returns a recoverable error.
- At most one corrective page read. PostgREST 416 loses its count in the SDK, so one HEAD count precedes that correction. The same 15-second deadline covers all reads; SDK automatic retries are disabled. Count failures, truncation, timeout, changed membership and summary failures remain errors. Empty authorized results retain real zero counts.
- Separate unfiltered summary projections preserve existing meanings, including health registrations without score snapshots and cancelled registrations. The score inner join controls Applicants membership; its user-ID name join remains nullable. Applicant name is not added to search.
- Sequential migrations 0110 and 0111: 16 invoker-secured read-only views, two private comparison helpers, two measured Requests reference indexes, and statement-cached session lookups in existing SELECT policies only. Active-admin/tenant gates and underlying RLS remain authoritative. ALL and write policies are byte-identical; SELECT predicates are equivalent. Stored reference values, write workflows, shared resident DTOs and dependencies are unchanged.

## Executed acceptance evidence

| Check | Result / evidence |
| --- | --- |
| Full 1,505-row fixture gate | All eight tables, 66 sorts × two directions; combined unchanged pages match independent raw-DTO JavaScript comparators. Applicants has one additional nullable-profile member (1,506). results.json; verify-final.log |
| Paging/count/summary/search | Five sizes, removed last-page correction, empty result, searches beyond the REST 1,000-row cap, literal percent/underscore/star/backslash/quote/comma/parentheses, separator semantics, Manila dates; 4,499 API requests, maximum transport 100 rows |
| Combined filters | 33 combinations; correct membership and counts, unchanged independent summaries and nullable incident relationships. filters.json |
| Permissions | Resident, other-tenant admin, removed admin and anonymous actors; no protected score disclosure or invoker-view write. Catalog checks cover all 16 grants/views, two helper security/search paths, underlying RLS, equivalent SELECT predicates, unchanged ALL/write policies. security.json |
| Unit checks | 60 tests pass (51 foundation + 9 adapter), including correction races, reverse payload order, missing payloads, failure/no-retry and stalled-request deadline. unit-tests-final.log |
| Static/build | Affected-file lint, admin typecheck, webpack production build pass. lint-final.log; typecheck-final.log; build-final.log |
| Cleanup | Owned DB/REST containers, network and private signing files removed; no task containers remain. cleanup.json |

## Measured performance

The initial 10k-row run failed: default Requests 2,235.7ms, Transactions 2,087.3ms and Households 3,149.5ms (performance-attempt2.log). Plans identified repeated permission lookups, JSON construction before pagination and SQL natural-key evaluation. Statement caching, a scalar tenant gate, bounded payload fetching, and an equivalent cheaper PL/pgSQL tokenizer address those observed costs. The Requests indexes serve the default page; the planner can still choose sequential scan/sort on deep pages. No speculative indexes were added to other tables.

Final run used a fresh schema copy with both migration files, 10k tenant rows, PostgreSQL 17.6 / PostgREST 14.5, DB 2 CPUs/1GiB and REST 2 CPUs/512MiB, loopback with no injected latency. Each candidate used 22 sequential reads, discarding two warmups and taking p95 of 20. These are complete adapter/API round trips (including count and bounded payload), a stricter measurement than database-only duration. SQL EXPLAIN ANALYZE/BUFFERS plans for representative ID-page stages are retained in performance-final.json. They omit the separate exact-count/payload statements; the substring plan uses an email-only LIKE predicate, while the timed adapter uses escaped MATCH across all configured search columns. The performance pass is based on actual adapter/API round trips. Two successful complete runs are recorded; the final run is authoritative.

| Candidate | Final p95 ms | 500ms target |
| --- | ---: | --- |
| requests — default | 44.75 | Pass |
| requests — natural deep page | 248.24 | Pass |
| transactions — joined resident | 310.89 | Pass |
| residents — substring | 267.59 | Pass |
| incidents — nullable reporter | 109.77 | Pass |
| health — aggregate | 113.95 | Pass |
| applicants — joined score | 449.23 | Pass |
| households — joined head | 476.82 | Pass |
| staff — label role | 177.59 | Pass |

The final substring candidate searches an existing seeded email at row 9,997. The benchmark is representative, not a guarantee for every filter/sort or production latency. 100k deep pages and control-to-committed-results timing remain release work.

## Failures and boundaries

Earlier attempt logs are retained as failed attempts. They include fixture startup/HBA configuration, initial range-count handling, LIKE wildcard aliasing (resolved with fully escaped MATCH regex; see PostgREST v14 docs), edge-fixture cardinality expectations, duplicate scale-seed IDs, policy deparser quoting, and unsuccessful performance iterations. The final build was rerun after fixing a test-helper TypeScript annotation; an initial sandbox build also lacked font/network access. No pre-existing application failure was repaired as part of this phase. Expected 416, denied-read and read-only-view errors in verify-final.log are assertions, not failed gates.

Source/hosted databases and accounts were not mutated; only schema/role metadata was copied to the isolated fixture. Fresh random signing credentials stayed in ignored private state and were removed. Hosted migrations, hosted advisors and authenticated UI integration were not executed: deployment is Phase 6 and routes/actions/browser interaction are Phases 3–5. This phase adds no resident Android UI work. Unrelated concurrent Android and OTP changes were preserved.

## Reproduce

From repository root, with Docker and the existing local Supabase schema at migration 0109: run node plans/evidence/admin-table-phase2/runtime.mjs start; then verify.mjs, filters.mjs and security.mjs from the same directory. Run performance.mjs without an argument to grow to 10k, or with measure to reuse that scale. Run runtime.mjs cleanup afterward. The scripts refuse ownership mismatches; fixture writes are confined to the owned database. Run the admin test:tables, typecheck, affected-file lint and webpack build separately. generate.mjs deterministically regenerates migration 0110, descriptors and contracts; migration 0111 is separate. Documentation and pre-edit instructions are recorded in docs.md.
