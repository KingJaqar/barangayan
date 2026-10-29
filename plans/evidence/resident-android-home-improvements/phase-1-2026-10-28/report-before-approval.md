# Phase 1 execution — 28 October 2026 (Asia/Manila)

Status: **Partially complete / Pending prerequisite**. The independent U02 request-query contract is verified locally. U01's explicit model/publisher approval is pending; expiry implementation, publisher integration and I1 are not passed. No hosted migration, deployment, commit, push or third-party message occurred. No dependencies were added.

## Scope and entry classification

| Requirement | Before | Current evidence / gate |
|---|---|---|
| Phase 0 prerequisites | Partially done in historical evidence | **Met** for this entry: rechecked actual Home query, tracking/payment/fee contracts, types, RLS and schema. Phase 0 selected U02 but did not implement it. Existing local `postgres` remains at its prior contract; a separate schema-only database was required. |
| Bounded owner-scoped request retrieval | Not started | **Met**: migration 0148 adds `resident_home_requests(boolean default false)`, security invoker, stable, empty search path, explicit auth.uid owner, authenticated-only execution, no caller resident or limit. Priority precedes LIMIT 3, then updated_at descending/nulls last and UUID descending. Optional catalog joins retain rows. Unknown statuses fall after cancelled, without action. |
| Fee/action parity and supported contracts | Not started | **Met**: `homeRequestAttention` and typed `HomeRequestRow`; 24 unit cases plus 48 live SQL/TypeScript comparisons across 24 synthetic request fixtures. Ledger fee/amount → v2 assessed fee → legacy snapshot/catalog. Paid ledger first, then newest creation/ID; no missing-metadata zero fee. QR flag ranks presentation only and grants no payment authority. |
| Permission, upgrade/failure, integrity/recovery | Not started | **Met for request branch**: actual anonymous denial, empty identity, caller-RLS denial, other-owner and foreign-barangay exclusion, retired/missing catalog, older actionable record beyond newest three, active/completed/cancelled groups, unique maximum three, update ordering and stable ties. Deliberately failed DDL subtransaction rolls back; successful upgrade/query leaves request/payment value digests and read/audit/inbox/event/outbox/delivery counts unchanged. Outer rollback removes all fixtures and function. |
| Approved lifetime data and shared/publisher validation | Not started | **Not met — U01 approval pending.** No expiry column, backfill, migration, schema/type or publisher edit was made. Exact proposal below. |
| I1 Brave create/edit → Docker expiry readback and event integrity | Not started | **Pending prerequisite**: needs approved U01 implementation. Browser fixture/native Home testing cannot substitute. |
| All affected checks clean | Existing mixed baseline | **Zero new diagnostics in completed scope**; six standalone shared TypeScript errors remain byte-identical. They prevent an unqualified all-green shared typecheck claim. |

## Workflow and ownership

Checklist: confirm Phase 0/source contracts; preserve working bytes and Git baseline; narrow ripgrep discovery; validate earlier context identities; generate/read exact XML; verify original fee/payment/row/policy/guard bodies; run baseline once; implement U02; directly verify query/access/rollback/parity; review owned delta; rerun affected checks; request only the reserved U01 approval.

- HEAD: `9fe8add15b0a5b75f6c232e30679da869731a4ea`. All pre-existing working changes are user-owned. `git-status-before.txt`, binary working/staged patches and `before/` actual bytes preserve the baseline, including untracked plan inputs. Sensitive `.env`/sessions were excluded; no secrets were printed or packaged.
- `source-before.json` identifies original inputs. Main XML SHA-256 `a57bc8134e9ee4487c0e3effe28202527991157e1875ad8824f321d74b59c21e`; cached Repomix **1.18.1**, uncompressed parsable XML, six exact entries, security checks enabled/clean, no omissions. `packet-manifest.json` records actual files and extracts. Both extracts were read completely: 8,627 characters/195 lines, then 2,010/67; contiguous half-open decoded ranges `[0,8627)` and `[8627,10637)`. First extract ends in shared index after `haversine`, second resumes at `point-in-polygon`. Empty root instructions are present. Packet size is not a claim of model usage savings.
- Reused Phase 0 findings only for unchanged contracts, then verified originals: `service-catalog.ts:120–133`, database request/payment/function sections, `service-foundations.ts:1–53`, tracking `:304–345`, payment `:69–77`/`:172–177`, Requests `nextStep`, migrations 0071/0143 and actual test-schema trigger definitions. No Repowise query was needed.
- Root `AGENTS.md` is empty; root `CLAUDE.md` references it. Admin instructions were read; no nested Android/shared/Supabase/plans rules were found. No repository-rule conflict. Current execution authorization supersedes the plan's historical planning-only restriction; U01's explicit separate-approval boundary remains in force. No later Home phase was implemented.
- CLI **2.111.0** was already cached. An initial telemetry-file permission failure was diagnosed from its output and official CLI guidance; process-only `SUPABASE_TELEMETRY_DISABLED=1`/`DO_NOT_TRACK=1` allowed version/help and `migration new`. No install or global setting change. The generated new timestamp file was renamed to repository sequence **0148**; no existing migration was renumbered or edited.

## Actual verification

All app checks use the same source scope and commands before/after. Full commands/cwd/times/deadlines/exit/log paths: `baseline-checks.json`, `final-checks.json`. Typecheck/lint deadline 5 minutes, tests 10, export 20. Workspace TEMP/TMP avoided Phase 0's known system-temp issue.

| Check | Baseline | Final |
|---|---|---|
| Android TypeScript | Pass, exit 0 | Pass, exit 0 |
| Android lint | Exit 0, 0 errors / 3 warnings | Same 3 warnings, no new diagnostics: unused health useState and two notification-hook dependency warnings |
| Shared Vitest | 38 files / 589 tests pass | 39 files / 613 tests pass, including 24 new attention cases |
| Standalone shared TypeScript | Exit 2, six errors | **Pre-existing failure**, exact log unchanged: two missing FileReader globals and four service-catalog test casts |
| Android production Hermes export | Pass, exit 0 | Pass, exit 0; production bundle, not APK/native qualification; inherited NO_COLOR/FORCE_COLOR warnings remain |
| Disposable Docker query suite | New contract absent | **Pass**, exit 0; `db-final.log` reports each verified gate; 24 actual fixtures × two QR capabilities = 48 fee/action comparisons |
| Admin lint/typecheck/build, Brave expiry publisher and MuMuPlayer expiry flow | Not run | U01 branch pending; no publisher or native UI code changed |

The Docker target is **resident_home_p1_20261028** inside **supabase_db_barangayan**, PostgreSQL **17.6**, created from template0. Definitions only were dumped from existing local **notif_p2_20261028**; no rows or secrets were cloned. Empty requests/profiles and required SELECT grants were checked before tests. The full schema restore has five retained grant-option errors on pre-existing managed extension/default-privilege objects (`schema-restore.log`); it has no table/function/policy restore errors. Request table RLS, guards, constraints, required grants and retired-catalog policy were confirmed directly. This is an isolated request-contract rehearsal, not proof that all repository migrations or a full disposable REST backend have been reconciled. Existing local services were not repointed.

The SQL/TypeScript test has a 120-second process limit; each transaction uses 5-second lock and 60-second statement limits. It checks the disposable name and empty tables, inserts synthetic records, tests the real function under caller roles, then rolls back DDL and fixtures. The schema-only test database is retained empty for the pending U01 branch; no test server/listener/polling process remains. Actual generated SQL and full SQL result output are under task-owned `tmp/resident-home-phase1-20261028/db/`.

Initial test setup failures are retained separately: incomplete v2 catalog charter; historical completion lacking the existing server context; legacy ledger differences incorrectly assigned to v2; incorrect plural audit-table name (corrected to verified `admin_audit_log`); and attempted post-insert change of protected request history. Each was diagnosed against actual definitions; fixes use valid synthetic catalog/request contracts, legacy historical attempts and insertion-time dates. No production guard, policy, constraint, assertion or diagnostic was weakened. These failures were not application regressions. Final suite stderr has no warnings/errors.

## U01 concrete approval package

Approval requested only for local implementation/testing:

1. Add nullable `announcements.alert_expires_at timestamptz`, default null, no backfill. A nonnull value requires emergency category, finite publication/expiry and expiry strictly after publication. Historical expired values remain valid. DB validation is authoritative; existing RLS/grants/audit/event ownership remain intact. Old payloads omitting expiry remain valid.
2. Mirror the contract in existing shared Zod announcement schema and Row/Insert/Update types. Existing publisher files are `apps/admin-web/src/app/(admin)/announcements/announcement-form.tsx` and `announcement-row.tsx`; add one optional local datetime input with UTC serialization and inline errors. Create captures effective publication once; edit validates against its stored publication. Clearing expiry is required before switching to a non-emergency category. Preserve submission guards and existing audit calls, including expiry before/after metadata. No new screen, early-end action or scheduler.
3. Validate migration upgrade/failure/legacy payload/category/timestamp/permission contracts and publish/edit/readback in disposable Docker plus Brave. Check actual current read/audit/notification fanout, including repeated save attempts; do not infer UPDATE safety from an INSERT-only historic trigger. Additive order: schema/validation → compatible shared/publisher → later dependent Home phase. No later Home loader/UI is part of Phase 1.
4. Application rollback keeps the additive field; do not drop recorded expiry. Rehearse targeted transaction/compensating recovery in isolation. Before any separately authorized target write, record exact row IDs/before-values and restorable backup. No hosted migration, live content replacement, external configuration or deployment is included in this approval.

The earlier Phase 0 ledger/consumer list is retained as context. Current source still has no expiry contract. I1 and full Phase 1 remain pending until this approval and its actual implementation/verification; elapsed time is not approval.

## Documentation and limits

Used Supabase skill and PostgreSQL best-practice guidance for invoker/RLS/indexed owner/ledger joins. Read [official database functions](https://supabase.com/docs/guides/database/functions), [PostgreSQL 17 CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html), [CLI telemetry guidance](https://supabase.com/docs/guides/local-development/cli/getting-started), [Vitest 3.2.7](https://v3.vitest.dev/guide/), [TypeScript 6.0 notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html), and the current Supabase changelog (download retained outside context). PostgreSQL minor-release and self-hosted role notices were reviewed; no engine/service upgrade was made. Expo v57 overview and JS v2 RPC reference were checked for the eventual consumer; **no Expo/React Native implementation file changed in this request branch**. Installed Next 16.3.0 client-component guidance was read while reviewing the publisher proposal; publisher edits remain unauthorized.

Remaining: U01 approval and lifetime/publisher/I1 implementation; six existing shared type errors; broader schema-only restore privilege differences; Phase 2+ native/UI acceptance; separately authorized deployment and I3 real content. Historical top-level plan statements that all phases are unstarted are stale; only the selected Phase 1 progress section is updated, as requested. Phase 0 evidence and all unrelated work are preserved.
