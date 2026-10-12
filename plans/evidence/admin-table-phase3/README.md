# Phase 3 — Requests and Transactions

Completed 2026-10-12, Asia/Manila. The authoritative summary is [final-verification.json](./final-verification.json); historical failed attempts remain intact. This verifies the two-route integration gate, not a production release or the remaining six route integrations.

## Implementation

Both routes use the Phase 2 server adapters and the opt-in Phase 1 controls, bounded sticky table and pagination. Requests defaults to Reference ascending and Active, with All first. Transactions defaults to Date created descending and All. All five sizes, global sorts/searches, independent summaries, query correction and query-preserving retries are connected to real server navigation. Main responses stay bounded to 100 rows; complete resident/document/collector action options are separate batched reads.

Pilot navigation settles edits before changing queries or acting on rows. Realtime refresh is coalesced, deferred while editing/navigating, and reconciles after release. Creation, updates, status transitions, archive and refunds refresh authoritative membership. Legacy/v2 guards, paid-amount restrictions, refund retry/claim links, exact-reference lookup and audit logging remain intact. Timestamps display in Asia/Manila.

Migration **0112** is a demonstrated prerequisite: 0111's reference expression indexes prevented service-role request writes because its pure comparison functions lacked execute permission. It grants only helper-schema usage and execution of `text_key(text)` and `reference_key(text)` to that existing writer. No table/view grants, RLS predicates, policies, stored references or resident contracts change. [writer-permissions.json](./writer-permissions.json) verifies before/after grants, unchanged anon access and numeric comparison. Migrations 0110–0112 were applied only to this disposable fixture; deployment remains Phase 6.

## Executed verification

| Evidence | Verified behavior |
| --- | --- |
| `acceptance-attempt3.json`, first eight completed groups | Chrome defaults/sizes/ranges, sticky and horizontal access, keyboard/resizing, narrow layout; all 34 pilot sort/direction combinations match database order before paging; both unchanged 1,505-row concatenations have no gaps/duplicates; global related search beyond the 1,000-row cap; rapid delayed navigation/history; independent table/summary/options failures and retries; one page correction; failed draft retention, navigation block, successful same-record retry and audit |
| `acceptance-actions-final.json` | Request processing/ready membership changes, legacy/v2 review guards; transaction edit, centavo accuracy, paid guard, refund submission/retry/claim and archive |
| `creation.json`, completed request group | Create a v1 request using the resident beyond the API cap, then archive and refresh exact membership |
| `transaction-creation.json` | Rapid latest-reference lookup, real transaction insertion and audited archive |
| `reconciliation-final.json` | Three real `postgres_changes` events cause zero refreshes during a draft and one after cancel; ten route mount cycles preserve one request channel and baseline table observer counts; 20 warm committed-result timings |
| `browser-matrix-verified.json` | Firefox 153.0 and WebKit 26.5 both pass defaults, sizes/ranges, controls, scrolling/resizing, narrow layout, beyond-cap search and empty results with no uncaught errors |
| `route-permissions.json` | Eight cases: anon/resident/removed admin redirected on both routes; foreign admin sees only own tenant |
| `unit-tests-final.log`, `typecheck-final.log`, `full-lint.log`, `build-final.log` | 65 unit tests, admin typecheck, full admin lint and webpack production build pass |
| `scope.json`, `final-checks.json`, `preview-cleanup.json`, `runtime-cleanup.json` | Preserved Phase 2 dependencies and unrelated work; byte-identical browser snapshot source linkage; final script/whitespace/status checks; owned processes, containers/network and private credentials removed |

Chrome version: 154.0.8037.99. Warm control-to-committed-result p95: **658.26ms Requests**, **706.54ms Transactions** (ten samples each, loopback/unthrottled, development preview, 1,505 rows per table, DB/REST two CPUs each). This meets 1.5 seconds for this profile; Phase 2's retained nine 10k-row database benchmarks remain separate evidence. No universal or production-latency claim.

The fixture used actual Auth, PostgREST with a 1,000-row cap, PostgreSQL and pinned Realtime v2.135.3, two synthetic tenants and freshly created test accounts. Only source schema and infrastructure migration metadata were copied from the existing local stack at 0109, with zero source account rows. Provider refund submission was intercepted with a synthetic success; its confirmation read and audit used the real fixture. No external provider, source/hosted data write or email delivery occurred.

## Failures and limits

Earlier attempts retain incorrect accessible-label locators, an invalid v2 fixture shape, a non-null refund-state restoration error, and the real helper writer-permission failure. Locators/fixtures were corrected and affected groups were rerun; 0112 fixes the demonstrated writer prerequisite. Typecheck/lint diagnostics were fixed before final passing checks. Completed positive groups in stopped reports are used explicitly; those whole reports are not relabeled as passes.

The early WebKit runs completed all pilot checks but saw a background shared-header notification access-control error immediately after login/navigation. A diagnostic on the untouched dashboard and Requests had ten successful notification responses and no errors. Waiting for the initial notification response before leaving the dashboard produced a passing Firefox/WebKit repeat. The exact earlier cause remains unproven; notification source was not changed. Firefox also recorded one navigation-aborted background notification fetch without an uncaught error. A repeat stopped when Windows could not overwrite a screenshot; unique screenshot paths fixed the artifact write. These failures remain in the raw evidence.

Native Safari/Edge, physical wheel/trackpad/OS scrollbar settings, native zoom and manual screen-reader checks were unavailable and remain Phase 6 release verification. No production deployment, hosted migration/advisor run, external refund-provider acceptance, 100k deep-page benchmark or later phase is claimed. There is no Phase 3 implementation blocker.

## Reproduction and cleanup

Run static checks from the admin workspace: `npm run test:tables`, `npm run typecheck`, `npm run lint`, and `next build --webpack`. The runtime scripts require Docker, the inspected existing local Supabase source at 0109 and cached service/browser images. They refuse conflicting task names/state and never copy source users.

Start `runtime-stack.mjs start`, run `writer-permissions.mjs` once on that fresh fixture, then start `runtime-serve.mjs` (20-minute lifetime) and run `runtime-seed.mjs` after the loopback proxy is ready. The preview is an isolated app copy; `--resume` preserves an inspected existing copy. Historical guarded infrastructure repair commands record remedies already incorporated into fresh startup; do not apply them blindly. The seed's `--accounts-only` mode is only for the documented initial proxy-start failure after SQL seeding, not a general reseed.

`acceptance.mjs` runs the full browser matrix; `--actions-only` and `--matrix-only` select focused checks. `actions-realtime.mjs --reconciliation-only` covers Realtime/mount/timing; `--creation-only` and `--transaction-only` cover creation. Use a fresh fixture for creation repeats because archived synthetic references remain in the database. `route-permissions.mjs` verifies route authorization. Keep generated credentials in ignored `dist/admin-table-phase3-runtime`, never evidence. Finish by verifying preview process identity, stopping only those processes, and running `runtime-stack.mjs cleanup`; `finalize.mjs` checks the recorded reports, cleanup and source hashes. Current cleanup passed with no owned services or private credentials remaining. Ignored browser cache, preview snapshot and build artifacts remain for repeat checks.
