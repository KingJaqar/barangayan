# Phase 1 — Shared contracts and additive foundations

## Verdict and scope

**Partially complete: implementation and every defined database exit-gate condition pass. Live Supabase Auth/Storage/PostgREST verification remains pending a Windows restart.**

The active scope is Android, resident web, web admin, and shared/backend dependencies. The main implementation plan was changed to Android-only mobile scope at the user's request. Previous raw evidence and the prior report are preserved under `plans/evidence/phase1/`; the latest report and verifier use the current scope.

The user authorized completing the bootstrap repair and installing Docker Desktop and required Windows components. Docker Desktop 4.93.0 (Docker CLI 29.8.1) and WSL 3.0.1 are installed. `VirtualMachinePlatform` is **EnablePending**; WSL confirms it cannot start virtualization in the current boot. No computer restart was performed. No production data was modified, and nothing was deployed or published.

## Grounding and prerequisites

- Read the complete plan, confirmed decisions, specifications, phase dependencies, quality gates and release controls.
- Followed the root Expo SDK 57 instruction and the applicable web instructions. Read the exact SDK 57 reference and installed Next.js 16.3.0 documentation before affected implementation work.
- Reviewed migrations through 0094, shared types/schemas, authentication provisioning, storage policies, request/payment/SLA boundaries, administrator joins and platform consumers. The Phase 0 inventory and reproducible baseline logs remain the prerequisite record.
- Preserved the unrelated user change in migration 0094, local Claude settings, supplied charter PDF and other untracked work. Protected hashes are checked by the verifier. The authorized Android-only main-plan hash is checked separately.
- Used the Supabase and Postgres guidance, current official documentation and installed CLI help. Seeds run after migrations in normal Supabase setup: [official seeding documentation](https://supabase.com/docs/guides/local-development/seeding-your-database).

## Requirement-to-verification mapping

| Assigned action | Implementation | Supporting verification |
|---|---|---|
| Minimum catalog extensions | Opt-in contract 2, four service kinds, eleven charter fields, purposes, conditional requirements, pricing mode and minute target; strict server validation | Shared schemas; 111 foundation assertions; introspected types |
| Locality extensions | Read-only barangay configuration, province/completion fields and server-derived permitted tenant/locality | Completion, ambiguous configuration, forged identity/locality and deleted-profile cases |
| ID-version extensions | Immutable front/back paths, reviewer/decision/reason/time, current and approved pointers, repair flag and composite ownership references | Publication/review/replacement retries, stale approval, direct writes, stored-file checks and concurrent revocation |
| Request extensions | Separate purpose/notes/details, original submission payload, owner-scoped idempotency, approved-evidence reference and private attachment associations | Four-service validation, failed/foreign uploads, same-key conflict, direct bypass and concurrent duplicate submission |
| Assessment extensions | Pending/assessed/waived state, confirmed amount/basis/actor/time, total billable pages and payment freeze | Unknown/forged amounts, waiver, per-page arithmetic, payment duplicates and concurrent reservation/reassessment |
| SLA extensions | Target/model snapshots, acceptance/readiness/release, documented pauses and cancellation freeze | Server timestamps, invalid/repeated transitions, appearance readiness, pause overlap and concurrent pauses |
| Shared types and validation | Additive database contracts, strict Zod input schemas and operations using the existing authenticated Supabase client | 108 shared tests; shared and consumer typechecks; 21 schema/relationship/RPC comparisons |
| Controlled operations | Six guarded operations: profile completion, ID publication/review, request submission, fee assessment and SLA transition | Resident/admin/other-tenant/anonymous boundaries; private helper and wrapper grants |
| Session identity and tenant ownership | Auth identity checks and server profile/tenant resolution; client identity/authority fields rejected | Metadata forgery, anonymous/deleted identity, cross-account/cross-tenant and raw-update tests |
| Private attachment storage | Private 5 MB JPG/PNG/WebP/PDF bucket; own objects and associated same-tenant administrator reads | Storage policy/metadata assertions and private bucket audit; HTTP uploads/signed URLs pending live-stack verification |
| Temporary compatibility | Existing catalog/request contract 1, old fields/outcomes/timing/payment behavior retained; explicit resident relationship hints in five administrator queries | Seven-table reconciliation, nine historical-read assertions, existing backend isolation tests, both web builds and Android export |
| Account-deletion compatibility | Owner-scoped recursive cleanup for avatars, legacy/versioned IDs and request attachments; collect all pages before deletion, preserve best-effort anonymization/ban recovery | 11 nested/pagination/owner-boundary/retry/failure tests; real Deno/SDK typecheck; live Storage behavior pending restart |

Primary implementation is `supabase/migrations/20261001030133_phase1_shared_foundations.sql`, shared `service-foundations` schemas/types/operations, focused `database.ts` exports, and five administrator query strings.

## Bootstrap prerequisite repair

The original empty-chain rehearsal failed at migration 0044 because its sample centers referenced a pilot barangay that normal setup creates later in `seed.sql`. The same assumption also occurred in 0049 and 0053. These historical files now conditionally execute only their pilot sample inserts when that tenant already exists; their schema changes and existing-install behavior are retained. They do not manufacture a tenant or disable foreign keys. Already-applied migrations are not rerun on existing installations.

The normal development seed was also repaired: create the Auth user and centers before dependent records, provide incident categories for the newly created pilot, close the previously unterminated incident query, use valid UUIDs, and conflict on stable check-in IDs. The new locality seed uses `ON CONFLICT DO NOTHING`, retaining existing configuration. No contract 2 service is activated.

Every one of the **93 repository migration files** now succeeds from empty and in the representative existing-data rehearsal. The empty replay has zero public application rows before normal seeding; no pilot fixture is injected into it. The representative rehearsal explicitly models an existing pilot and introduces historical rows immediately before Phase 1.

## Exit gate

Evidence paths below are relative to `plans/evidence/phase1/`.

| Defined condition | Actual result | Evidence |
|---|---|---|
| Migrations succeed on empty database | **PASS**, all 93 files, including Phase 1; no injected pilot/application records | `completion-database/results.json`, `phase1_empty.log`; zero-row snapshot in `completion-seed-final/seed-results.json` |
| Migrations succeed on representative existing database | **PASS**, all 93 files with explicit existing-install fixtures | `completion-database/results.json`, `phase1_existing.log` |
| Historical records remain readable | **PASS**, every prior column/value unchanged across seven tables; owner/same-tenant administrator reads succeed, other-tenant reads fail | `completion-database/{before,after,reconciliation}.json`, `phase1_existing/historical-reads.log` |
| Unauthorized operations fail | **PASS for exercised database boundaries**, including RLS, grants, controlled writes, identity/evidence ownership, tenant separation, immutable paths, fee guards and concurrent races | `completion-database/phase1_empty/tests.json`, `phase1_existing/tests.json`, `races.json`; `completion-audit/grants-audit.json` |

Reconciliation preserves unsplit names, free-text addresses, legacy verified images, inactive service references, completed/cancelled requests, paid/refunded transactions, score 90 and applicant number `HIST-00001`. Two barangays, three profiles, one inactive service, two requests, two payments, one medical registration and the normalized-household table are compared.

The database exit gate passes. The overall verdict remains partial until the promised live-service verification has actual passing evidence; the verifier reports these boundaries separately and exits nonzero while live results are absent.

## Checks and actual results

| Check | Result and current evidence |
|---|---|
| Shared tests | **PASS 108 tests / 13 files**, `completion-checks/shared-tests.log` |
| Shared, resident web, administrator and Android typechecks | **PASS all four**, `completion-checks/results.json` |
| Resident web, administrator and Android lint | **PASS all three**, `completion-checks/results.json` |
| Web production builds | **PASS both**, `completion-checks/{resident-web,admin-web}-build.log` |
| Android production JavaScript export | **PASS**, `completion-checks/android-export.log`; signed native/device behavior is not established |
| Empty-chain database suites | **PASS 135 assertions**: 111 foundation, 17 legacy isolation, 7 shared backend tenant guards |
| Representative database suites | **PASS 144 assertions**: the same 135 plus 9 historical reads |
| Concurrent sessions | **PASS four**: one request per idempotency key, one open pause, fee freeze against payment reservation, approval revocation blocks simultaneous submission |
| Actual database/shared contract comparison | **PASS 21 assertions**, `completion-contracts/contract-check.json` |
| Account-deletion cleanup | **PASS 11 tests**, focused ESLint, native Deno lint and Deno/SDK typecheck recorded under `completion-review/` |
| Normal development seed and retry | **PASS**, two successful transactional executions, identical counts across every public table, **12 assertions**, `completion-seed-final/` |
| Private functions, wrappers, RLS and storage audit | **PASS**, 15 private functions, six invoker wrappers, fixed empty search paths, restricted grants, four read-only new tables and private bucket limits; `completion-audit/` |
| Database advisors | **PASS with zero ERRORs**. 61 pre-existing warnings remain: 24 RLS evaluation, 29 permissive policies, eight mutable-search-path functions; no findings for the four new tables |
| Focused lint, script syntax, diff and preservation | Results in `completion-review/scoped-checks-final.json` and `gate.json`; verifier requires every result to pass |
| Standard local Supabase startup | **Initially failed**, Docker/Podman absent; `completion-baseline/full-stack-start.log` |
| Authorized runtime setup | **Installed successfully**, official Docker installer checksum verified; Docker/WSL versions and pending-restart evidence in `completion-baseline/` |
| Live Auth/Storage/PostgREST journeys | **UNVERIFIED**, Windows restart required before service startup |

The earlier 0044 failure remains in historical logs and is now resolved. Original seed syntax/order/UUID defects are repaired; aborted seed attempts rolled back transactionally and their logs remain. A transient duplicate clause introduced during the seed repair was corrected before the final passing run.

The original backend tests contained unsupported JSON equality assertions and an expected empty update where authorization actually raises 42501. Their assertions were corrected to verify intended non-null/denial behavior; policies and validation were not weakened. Prior failure logs remain. Root lint's pre-existing generated-bundle/Deno problems remain recorded in Phase 0; affected-workspace and focused-source lint pass without changing lint rules.

Native Deno lint identified the account-deletion function's existing inline SDK import. It now uses the equivalent dependency already mapped in `supabase/functions/deno.json`; no SDK version or application dependency was added. The portable Deno 2.9.7 tool and cache stay in ignored workspace tools.

## Compatibility and phase boundaries

- Existing services and historical requests remain contract 1. No charter activation, legacy ID conversion, score migration or destructive backfill occurs.
- Profile completion supports named Auth users without registration metadata, preserves existing tenant ownership and rejects absent/ambiguous allowed localities or deleted profiles. Google buttons, linking and callbacks belong to Phase 6.
- ID replacement clears current approval; requests retain their reviewed version. Legacy evidence reconciliation and UI caching changes remain Phase 2.
- Request retry with identical payload returns its original record, even after later evidence replacement; conflicting payloads fail. Missing uploads cannot become associations.
- Assessments and payment reservations serialize on the request. Current provider adapters still use legacy catalog amounts; the guard rejects invalid contract 2 ledger writes. Consumer/payment rollout remains Phase 4 before contract 2 activation.
- Readiness and release have separate timestamps. Pauses and cancellation are recorded; shared elapsed calculations, threshold evaluation, alerts and reporting belong to Phase 5.
- Five administrator queries explicitly identify `service_requests_resident_id_fkey` because the additional fee-assessor relationship would otherwise make PostgREST joins ambiguous. Existing response keys/presentation are preserved.
- Existing account-deletion SQL anonymization compatibility is covered. Its Edge Function now removes nested/versioned/unattached media from all three owned buckets, paginates before deletion and retains the original non-fatal cleanup plus ban-retry behavior. Actual Storage HTTP cleanup remains in the pending live checks.

## Reproduction and remaining setup

Database proof uses loopback-only PostgreSQL **17.11**, pgTAP **1.3.4**, and Supabase CLI **2.118.0**. Portable tools/data remain ignored under `dist/phase1-tools`. The rehearsal scripts accept fixed local databases, never a hosted URL. Their Supabase Auth/Storage schemas are fixtures, not running HTTP services.

After starting the prepared local cluster and recreating only `phase1_empty` / `phase1_existing`, use fresh evidence directory names:

```powershell
node scripts/phase1-database.cjs phase1_empty new-database
node scripts/phase1-sql-checks.cjs phase1_empty new-database
node scripts/phase1-seed.cjs new-seed
node scripts/phase1-database.cjs phase1_existing new-database
node scripts/phase1-sql-checks.cjs phase1_existing new-database
node scripts/phase1-contracts.cjs new-contracts
node scripts/phase1-races.cjs new-database
node scripts/phase1-audit.cjs new-audit
```

Run SQL suites before the race harness, which commits synthetic fixtures in its isolated database. The evidence verifier explicitly selects the reviewed completion directories; update those selections for a future rehearsal rather than overwriting historical logs. The local PostgreSQL cluster is stopped when verification finishes.

**Remaining external prerequisite:** restart Windows to finish enabling virtualization. Docker and WSL installation have already been performed; no manual repository edits are needed. After restart, finish Docker's first-start setup if shown, start the local Supabase stack, replay the real migrations/seed and verify authenticated RPCs, real uploads, signed URLs and cross-tenant denial through the HTTP services. Record those results before marking the overall Phase 1 verdict complete.

No production access, deployment, release, native/provider validation or work in another phase is authorized by this report.
