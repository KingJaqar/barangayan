# Phase 1 implementation and exit-gate evidence

Date: 1 October 2026. Scope: Phase 1 of `Major_Web_AndroidMobile_Improvement_Plan.md` only.

**Verdict: partially complete.** The Phase 1 implementation and independent checks are finished. Its complete exit gate fails because the repository's pre-existing migration `0044_evacuation_centers_verified.sql:93` references barangay `00000000-0000-0000-0000-000000000001` before that row exists in an empty database. The new Phase 1 migration is never reached in that replay. Repairing earlier migration/bootstrap ordering requires separate scope; no earlier phase was silently repaired.

## Grounding and prerequisites

The entire improvement plan was read, including decisions, specifications A–I, dependencies, quality evidence and release controls. The recorded Phase 0 inventory/report and its source/preservation gate were inspected and verified before edits. That prerequisite gate passed for its inventory/baseline scope; it did not certify database behavior. Rerunning its verifier refreshed its generated gate timestamp/log. Its inventory and report were preserved.

Root and both web `AGENTS.md` instructions were followed. Documentation consulted included the exact [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) and [DocumentPicker reference](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/), installed Next.js 16.3.0 guides under `node_modules/next/dist/docs/` (including data security), current Supabase RLS/storage/function documentation and changelog, and [explicit foreign-key join guidance](https://supabase.com/docs/guides/database/joins-and-nesting). Supabase, Postgres and React skills informed the implementation/review.

Existing migrations through 0094, table grants/policies/triggers, profile provisioning, request/payment operations, Storage rules, shared schemas/types, administrator corrections, web/Android/iOS/legacy consumers, exports/deletion and the existing tests were inspected. Baseline commands were rerun before editing: shared 93 tests and iOS 8 tests passed; shared/web/Android types and web lint passed; iOS's two missing SDK modules reproduced. Earlier Phase 0 evidence records root lint, mobile SDK/release and device/tooling limitations.

The original modified 0094 migration comment, local settings, charter PDF and original plan match their pre-edit hashes. The original archive and other unrelated source files were not edited. Application dependency manifests and lockfiles were not changed.

## Requirement-to-implementation mapping

| Phase 1 action | Implemented requirement | Verification |
|---|---|---|
| Minimum data extensions | Additive catalog contract/version, eleven charter categories, service kind/purpose/requirement/pricing/target settings; tenant locality reference; ID versions and profile pointers; request purpose/details/evidence/assessment/timing snapshots; attachments and documented pauses | Representative and empty-application-schema migration rehearsals; schema-introspected type/relationship checks; catalog constraints and all four service-kind database cases |
| Shared types and validation | Strict shared schemas for catalog, conditional submissions, uploads, profile completion, ID publication/review, assessments, SLA actions and coordinate ranges; exported inferred types and operations using the existing session client | Shared suite: 108 tests; 21 database-introspected contract assertions; all supported consumer typechecks except the recorded iOS dependency failure |
| Controlled operations | Six caller-scoped RPCs for completion, publication/review, transactionally validated/idempotent submission, fee assessment and acceptance/pause/resume/readiness/release/cancellation; existing cancellation RPC bridges v1/v2 | 111 foundation SQL assertions, real multi-session races, legacy cancellation/account-anonymization regressions |
| Authenticated ownership | Identity from `auth.uid()`; email from Auth; tenant/role from active profile or permitted registration configuration; strict payloads cannot assign identity/tenant/outcomes/clocks | Anon/resident/same-tenant admin/other-tenant admin, role/tenant injection, raw inserts/updates, spoofed session operation markers, stale/failed/revoked approval, deleted identity and historical isolation tests |
| Private attachments | Private 5 MiB JPG/PNG/WebP/PDF bucket; owner uploads/reads; same-tenant admin reads associated files; uploaded metadata checked against supplied references; new version paths cannot be overwritten/deleted by residents | Missing/foreign/forged files, exact size boundary, immutable evidence, direct association-write denial and tenant Storage policy tests |
| Temporary compatibility | Existing catalog/request rows default to contract 1 and legacy timing; old money/status/name/address/ID/score fields retained; no destructive backfill; explicit resident relationship hints preserve administrator joins | Seven-table before/after reconciliation, nine authenticated historical-read assertions, existing 17+7 RLS assertions, web builds and Android export |

Primary implementation: `supabase/migrations/20261001030133_phase1_shared_foundations.sql`, `packages/shared/src/{schemas,types,lib}/service-foundations.ts`, focused `database.ts`/index additions, and five existing administrator query strings.

## Behavior and compatibility decisions

- Catalog contract 2 is opt-in. Existing services remain contract 1; no live charter/service activation or legacy request conversion occurs. A historical request's contract is immutable.
- Registration completion works for named Auth users without registration metadata. It derives the permitted resident tenant on the server, rejects ambiguous/unconfigured registration, preserves existing tenant ownership, and cannot revive a deleted profile. The original password-registration trigger body is retained and gated on resident-registration metadata.
- ID publication uses `{resident}/versions/{submission}/id-front|back` immutable objects. Review records decision/reviewer/time/reason; replacement clears approval; current approval is checked under the profile lock during submission. Existing requests keep the reviewed reference. Legacy approvals/paths remain untouched for Phase 2 reconciliation.
- Submission validates active same-tenant service, configured purpose, independent notes/explanation, business/DTI, HOA/renter evidence, record/copies, appearance acknowledgment and uploaded object metadata. One transaction creates request and associations; same-owner/same-key/same-payload retries return the original ID, including after a later evidence replacement. Conflicting retries fail.
- Assessment stores confirmed amount/basis/actor/time and explicit waiver. Unknown fees permit submission but block the payment ledger. Certified-copy assessment uses total confirmed pages × 1,000 centavos once. Payment reservation and assessment serialize on the request; amounts freeze when any payment starts, and duplicate active payments fail.
- SLA transitions use server timestamps. Complete requirements and applicable appearance start processing; readiness and collection are separate. Pauses require recorded reasons/actors/times and cannot overlap. Cancellation closes an open wait and freezes its record. Existing status names/history and completion guard are reused. Calculations, threshold evaluator/alerts/reports remain Phase 5.
- New foundation writes cannot be impersonated by setting a session operation marker. Direct v2 writes and v1 foundation-field poisoning fail; authenticated raw updates cannot convert historical requests.
- The additional fee-assessor foreign key creates two request→profile relationships. Dashboard, request list/detail and transaction list/lookup explicitly select `service_requests_resident_id_fkey`, retaining the existing response keys and presentation.
- Future catalog/payment UI rollout must adopt the new RPCs and request-level assessment amounts before enabling contract 2. Current v1 consumers keep their original payment behavior. Existing provider adapters still derive legacy catalog fees; the new database guard rejects mismatched/unassessed v2 ledger writes before provider creation. No Phase 4 payment UI/provider rollout is claimed.

## Exit gate

| Condition | Actual result | Evidence under `plans/evidence/phase1/` |
|---|---|---|
| Full repository migration chain succeeds from empty | **FAIL: pre-existing prerequisite** at 0044's pilot-tenant FK; reproduced before reaching the Phase 1 migration | `database-exit-gate/phase1_empty.log`, failing step/timing in `database-exit-gate/results.json`; earlier reproduction in `database/phase1_empty.log` |
| Additive Phase 1 migration succeeds with no application records | **PASS**, separately restored schema-only pre-Phase-1 baseline, verified zero application rows, then applied Phase 1 | `database-exit-gate/empty-foundation.json` / `.log`; empty-schema SQL assertions |
| Representative existing database migration succeeds | **PASS**, all repository migration files applied with explicit existing pilot reference fixture; synthetic historical fixture inserted before Phase 1 | `database-exit-gate/phase1_existing.log`, `results.json` |
| Historical records remain readable | **PASS**: each old column/value unchanged across seven tables, owner and same-tenant admin can read inactive-service requests, payments and legacy images; other-tenant admin cannot | `database-exit-gate/{before,after,reconciliation}.json`, `phase1_existing/historical-reads.log` |
| Unauthorized operations fail | **PASS for exercised database boundaries**, including grants, RLS, controlled RPCs, immutable evidence, direct bypasses, tenant separation, unknown/forged money and deleted identities | `database-exit-gate/phase1_existing/{foundations,legacy-rls,ios-rls}.log`, empty-schema rerun, `races.json` |

The existing-data fixture intentionally supplies the pilot row before 0044, modeling an existing installation. It is not an empty-database fix. The separate schema-only rehearsal proves this additive migration, not the full broken bootstrap chain.

Reconciliation includes two barangays, three profiles, one inactive document type, two historical requests, two payments, one medical registration and the unchanged empty normalized-household table. Every old field is compared, including unstructured name/address, verified legacy ID paths, completed/cancelled outcomes, recorded fees/refund state, priority score 90 and applicant number `HIST-00001`. Defaults added to old requests identify legacy timing without rewriting historical outcomes.

## Checks and review results

| Check | Result / evidence |
|---|---|
| Shared tests | **PASS 108 / 13 files**, `reviewed-checks/shared-tests.log` |
| iOS logic tests | **PASS 8 / 2 files**, `reviewed-checks/ios-tests.log` |
| Representative database suites | **PASS 144 assertions**: 111 foundation + 17 legacy isolation + 7 iOS tenant + 9 historical reads, `database-exit-gate/phase1_existing/tests.json` |
| Empty-application-schema suites | **PASS 135 assertions**: 111 + 17 + 7, `database-exit-gate/phase1_foundation_empty/tests.json` |
| Concurrent sessions | **PASS 4**: same-key single request, one open pause, fee stable against payment reservation, revocation blocks simultaneous submission, `database-exit-gate/races.json` |
| Database/shared contract comparison | **PASS 21** fields/new-table/relationship/RPC assertions, `contracts-acceptance/contract-check.json` |
| Shared/resident-web/Android types | **PASS**, `reviewed-checks/results.json` |
| Administrator types/lint/build | **PASS after the relationship compatibility fix**, `admin-compatibility/results.json` |
| Resident web/Android lint | **PASS**, `reviewed-checks/results.json`; scoped new-code/script lint also passes |
| Production web builds | **PASS both**, resident `reviewed-builds`, administrator final `admin-compatibility` |
| Android production JS export | **PASS**, `reviewed-builds/android-export.log`; does not prove signed native/device behavior |
| Database advisors | Command **PASS (no ERROR)**; 61 public-schema WARN findings retained: 24 RLS evaluation, 29 permissive-policy, and eight existing mutable-search-path functions. No findings for the four new public tables; `database-exit-gate/advisors.json`. Private grants/search paths and bucket configuration separately audited in `grants-audit.json` |
| Final diff/preservation | **PASS** diff whitespace check, focused source review, original protected-file hashes unchanged; current evidence/source manifest in `gate.json` |

Failures are not relabeled as passes. iOS types/lint/export still fail because installed `expo-crypto` and `expo-secure-store` are absent; baseline and final logs contain the same diagnostic. iOS release/SDK configuration and Android view-shot compatibility warnings remain as recorded by Phase 0. Root lint previously completed with 79,088 errors/34,634 warnings, including generated bundles and Deno resolver failures; affected-source/workspace lint was used here, without changing lint rules.

Executing the original SQL tests discovered pre-existing pgTAP assertions comparing JSON with unsupported equality and expecting an empty update where the policy correctly raises 42501. Their assertions were corrected to test the intended non-null/denial behavior; authorization was not weakened. Original failure logs remain in `database-representative/`. Transient implementation/type-check failures, including the new relationship ambiguity and verification-harness compiler invocation, were repaired and retained separately; they are not baseline defects.

The final review checked authorization/null handling, search paths/execution grants, lock ordering, stable snapshots, legacy cancellation/deletion compatibility, relationship ambiguity, historical fields, storage references and phase boundaries. No application package, scoring formula, legacy migration, presentation or unrelated refactor was introduced. Documentation and local verification scripts are the supporting additions.

## Reproduction and manual setup

Database proof used portable PostgreSQL **17.11** (official EDB Windows distribution) and pgTAP **1.3.4**, with a loopback-only cluster on `127.0.0.1:55431`. The installed Supabase CLI is **2.118.0**. Tools/data are ignored under `dist/phase1-tools`; no system service or application dependency was installed. The test cluster is shut down after verification.

The bootstrap fixture reproduces the Supabase role/auth/storage schema portions needed by existing migrations; it is not a running GoTrue, Storage HTTP or PostgREST stack. Do not substitute a hosted URL: the scripts accept only fixed local databases.

After preparing the same portable tools/pgTAP and starting that local cluster, use fresh evidence-directory names:

```powershell
node scripts/phase1-database.cjs phase1_existing new-representative
node scripts/phase1-sql-checks.cjs phase1_existing new-representative
node scripts/phase1-empty-foundation.cjs new-empty
node scripts/phase1-sql-checks.cjs phase1_foundation_empty new-empty
node scripts/phase1-contracts.cjs new-contracts
node scripts/phase1-races.cjs new-races
node scripts/phase1-verify.cjs
```

Create/reset only the explicitly named isolated databases before the full replay. Run SQL suites before the race harness, which commits synthetic fixtures in its isolated database. `phase1-database.cjs phase1_empty new-empty-chain` is expected to reproduce the recorded 0044 failure until the earlier prerequisite is repaired. Existing logs are preserved; a fresh directory is required for reruns.

The evidence verifier reads the recorded exit-gate directories, checks results and original-file preservation, and hashes implementation/evidence files. Its nonzero exit deliberately reports the incomplete full gate; it must not be treated as a passing release check. Update its evidence paths explicitly when reviewing a new rehearsal.

Before any separately authorized staging rollout: repair the empty-chain pilot-reference ordering, rehearse a full Supabase stack, verify current production/staging applied schema/grants through an authorized process, and retain contract 1 until dependent consumers are ready. Ampid 1 locality is configured only for the existing exact pilot name; profile completion fails closed if the permitted registration locality is absent/ambiguous. Service charter content and uncertain fees require Phase 3 configuration, not invented seed values.

HTTP Storage uploads/signed URLs, authenticated browser journeys/screenshots, actual provider operations, Google linking/callbacks, signed mobile/device behavior, clock evaluation/reporting and legacy evidence backfills are **unverified or owned by later phases**. Existing account-deletion Storage cleanup is best-effort and requires a live-stack check for versioned/unattached objects during the later evidence/upload rollout; its SQL anonymization compatibility is tested here. No production data was modified and nothing was deployed or published.

Phase 1 must not be marked complete or used to advance the plan while the full empty-database migration condition remains failed.
