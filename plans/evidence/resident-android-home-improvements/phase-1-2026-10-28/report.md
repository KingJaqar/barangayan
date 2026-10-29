# Phase 1 execution — 28 October 2026 (Asia/Manila)

Status: **Complete / Verified for local Phase 1 implementation and data/publisher gates**, with the pre-existing standalone shared typecheck failure retained below. The user explicitly approved U01 local implementation and disposable Docker/Brave testing. No hosted migration, deployment, live-content change, commit, push or external configuration change occurred. No dependency was added. Phase 2+ Home implementation has not started.

## Acceptance

| Criterion | Status and direct evidence |
|---|---|
| Entry, ownership, contracts and context | **Met**. Actual Phase 0 contracts rechecked; Git status/binary patches/working bytes/hashes preserved. Root and admin instructions read; no conflict. Main and publisher Repomix XML completely analyzed, then original types, payment predicates, handlers, policies and event bodies verified. |
| Bounded owner-scoped requests | **Met**. Migration 0148, shared helper/types and 24 unit cases. Invoker, stable, empty search path, explicit auth.uid owner, authenticated-only, no resident selector, priority before LIMIT 3. Ledger paid-first/newest/ID; requestFee precedence; optional catalog retained; QR flag ranks presentation only. |
| Query parity, access and integrity | **Met**. `db-final.log`: 24 fixtures / **48 live SQL–TypeScript comparisons**, older actionable row beyond newest three, update/ID ties, unique maximum three, RLS/anonymous/cross-owner/cross-barangay, retired/missing catalog, failed-upgrade rollback, unchanged request/payment digests and read/audit/notification counts. |
| Approved lifetime DB/shared contract | **Met**. Migration 0149 adds nullable alert_expires_at, no backfill. Validated check requires emergency category, finite publication/expiry and expiry after publication. Historical expired records accepted. Zod and Row/Insert/Update mirror it, including PostgREST offsets. **32 live DB checks** cover upgrade/failure/value/policy preservation, old payloads, timestamps/category, access, events and targeted recovery. |
| Existing compatible publisher | **Met**. One optional local-time input in create/edit; UTC serialization, calendar validation and unchanged-value precision retention. Create captures effective publication once; edit compares its stored publication. Existing themes/fonts/accents reused. Duplicate in-flight submissions guarded; denied/failed saves retain drafts and show errors. Actual audit action receives saved ID and expiry metadata. |
| I1 Brave publisher → Docker → readback/events | **Met**. `publisher-integration.json`: actual publisher components, Supabase JS, existing audit action and actual RLS/triggers. Title/expiry/ID agree; double create/edit writes once; denied/server failures are visible; category requires expiry clear. Final counts: **1 announcement, 3 intentional audits, 1 event/inbox/outbox, 0 reads/deliveries**. Expiry edits add no fanout. |
| No new check regressions | **Met against baseline**. Android/admin production typechecks, lint, build/export and tests pass. Shared production types checked through both apps. Standalone all-source shared tsc remains a **pre-existing failure**, not an all-green check. |

Full R1/R2/R3 Home/native acceptance remains in phases 3/4/I2. No Home loader/banner/card/route caller was changed ahead of its phase. Deployment, real content and I3 remain separately unauthorized.

## Verification

Exact commands, cwd, start/end, deadlines, exits and logs: baseline-checks.json, baseline-publisher-checks.json, baseline-publisher-webpack-checks.json, lifetime-reviewed-checks.json, phase1-final-checks.json and per-check JSON. Typecheck/lint limit 5 minutes, tests 10, builds 20. Workspace TEMP/TMP avoids the earlier Hermes environment issue.

| Check | Baseline → final |
|---|---|
| Android typecheck | Pass → pass, exit 0 |
| Android lint | 0 errors/3 warnings → 0 errors/1 existing health useState warning. Two warnings in the unowned notification hook are absent in the final run; no improvement attributed to this phase |
| Shared Vitest | **589 → 625 passing tests**, 39 files; 24 attention and 12 lifetime cases added |
| Standalone shared tsc | Exit 2 → same **six byte-identical existing errors**: two FileReader globals and four service-catalog test casts |
| Android Hermes production export | Pass → pass; bundle, not APK/native evidence; inherited color-environment warnings retained |
| Admin typecheck | Pass → pass, exit 0 |
| Admin lint | 0 errors/2 warnings → identical diagnostics: search dependency and unused settings cause; owned source/test lint passes |
| Admin Vitest | **162 → 170 passing tests**, 15 files; eight local-date cases added |
| Admin production Webpack build | Pass → pass, exit 0, after final offset fix |
| Docker | **48 request parity comparisons + 32 lifetime checks pass** |
| Brave 156.0.8078.48 | Persistence/error/event integration passes; corrected read-only 1280/390/320 light/dark/font/accent screenshots inspected |

Default Turbopack baseline stalled during compilation while restricted DNS could not resolve its existing Google Fonts dependency. Task-owned PID 47968 was stopped with diagnostics retained. Installed CLI help and earlier repository diagnostics identified Webpack; one network-enabled Webpack baseline passed. Final builds use that same mode with telemetry disabled. No dependency/font/config workaround was committed; the default restricted-network command is not claimed passed.

Brave has **zero unexpected page/console errors or warnings**. The deliberately induced HTTP 503 diagnostic is retained in expectedDiagnostics; its visible failure/draft-retention state passed. Connection/session/routing adapters are synthetic; production login/cookies and full authenticated Next route rendering were not exercised. Persistence, the publisher components, audit-action body, RLS and event triggers are real.

## Context and preservation

Workflow: **Git baseline → narrow ripgrep → Reader identity validation → scoped Repomix → complete bounded XML analysis → originals → baseline → implementation → acceptance/diff review**. Optional Repowise was unnecessary. Shared execution rules remain in the plan; no competing root index was created.

- HEAD remains 9fe8add15b0a5b75f6c232e30679da869731a4ea. Source-before/publisher-source-before manifests and before-bytes preserve working copies, including user changes; sensitive env/session inputs excluded. Existing unrelated profile/notification/migration work preserved. No older migration edited; CLI-generated new files renamed to repository sequence 0148/0149. Lock/dependencies unchanged.
- Cached Repomix **1.18.1**, uncompressed parsable XML, default security checks clean, exact selectors/no omissions. Main packet: six entries, SHA-256 a57bc8134e9ee4487c0e3effe28202527991157e1875ad8824f321d74b59c21e; full decoded ranges [0,8627), [8627,10637), 195/67 lines. Publisher: nine entries, SHA-256 3813c9e9d0a7a34cdf2e0e78d9b13ed0540870f0b1f2df34b98278c6e5ee9287; full ranges [0,7128), [7128,14143), [14143,21351), [21351,28453), 195/195/195/181 lines. Both manifests retain paths/continuations. No compression gap or usage-savings claim.
- Originals verified requestFee, request/payment/function/foundation types, tracking payment/page/pause rules, owner/catalog policies and indexes, publisher handlers/styles and actual audit/announcement/notification functions. Approval was obtained before lifetime product edits. Root instructions are empty/reference-only; admin rules and installed Next **16.3.0** client/forms guidance read. No repository conflict. Current execution supersedes historical planning-only restrictions.
- Supabase/PostgreSQL skills applied; cached CLI **2.111.0** used with documented process-only telemetry opt-out. Official Supabase functions/RLS/JS2/changelog, PostgreSQL17 constraints/datetime/functions, Zod3.25.76 source, TS6/Vitest3, React19.2/reference, MDN datetime-local, Docker/PostgREST14 docs checked. Expo57 context checked; no Expo/React Native implementation file changed. No engine upgrade/install.

## Isolation and recovery

All DB work used newly created schema-only disposable databases inside supabase_db_barangayan, PostgreSQL17.6. Definitions came from local notif_p2_20261028; no rows/secrets cloned. Required request/announcement functions, RLS, grants and constraints checked directly. Five managed extension/default-privilege grant-option restore errors are retained in restore logs; acceptance suites pass. This is not a clean rehearsal of every repository migration or a hosted-schema claim.

The original resident_home_p1_20261028 request/lifetime suites roll back all test DDL/fixtures. Brave uses separate copies; final target **resident_home_p1_20261028_i2** retains migrations 0148/0149 and synthetic evidence only. Its final row ID is in publisher-integration.json. Existing databases/services were not repointed. Dedicated existing-image PostgREST containers use loopback access, existing authenticator authority and ephemeral test signing/session credentials held in memory. Temporary API/HTTP/Brave processes were stopped; no task API container remains. Synthetic outbox rows have no delivery worker and zero deliveries.

SQL limits: 5-second locks, 60-second statements, 120-second parent. Failed DDL subtransactions and full rollback preserve original values/policies. Targeted expiry restoration was rehearsed. Application rollback **retains the additive column, recorded expiry and audit/read/event history**. Any later real-data write needs separate authorization, exact before-values and restorable backup; delivered notifications cannot be unsent. No legacy advisory was promoted or release content invented.

Raw diagnostics preserve initial fixture/CTE corrections and the first browser sheet-lifecycle assumption. Real editing exposed the PostgREST offset mismatch, fixed in product with regression coverage. Screenshot review found missing workspace theme variables in the fixture; corrected screenshots were recaptured read-only, with a narrowed panel selector. No production guard, assertion or diagnostic was weakened. The historical pending report is retained as report-before-approval.md. The build-generated next-env import paths were saved as evidence and restored to their exact initial bytes; the actual admin typecheck was rerun after that cleanup. tsconfig and dependencies were preserved.

Remaining: six existing standalone shared type errors; restricted-network/default-build and managed schema-restore privilege limitations; production login/native Home/I2 work in later phases; separately authorized rollout and real-content/I3 validation. **No Phase 1 feature blocker remains.** Historical global planning/U01 statements are superseded by the selected dated Phase 1 progress entry; other phases were not edited.
