# Phase 4 execution — October 22, 2026 (Asia/Manila)

**Status: Partially complete.** Authorized local verification, cleanup review and recovery implementation are complete. Actual staging/Auth, physical-camera, deployed privacy and full installed native gates remain. Another actor pushed the 0139/0140/0141 history during execution; the restored final local candidate now passes 480 SQL assertions. Native harness checks were completed after the user requested native-first verification. No deployment was performed by this task and no production readiness is claimed.

## Changed

- Shared error mapper explains operator-paused arrival/departure with temporary-unavailability guidance; two focused cases protect the actual PostgreSQL permission errors without weakening authorization or exposing diagnostics.
- Operator-only pause/resume SQL revokes public and private confirmation access and restores only authenticated grants. It preserves all attendance/receipts and resident reads. These scripts are outside migrations and were run only in a disposable database.
- Repeatable `supabase/tests/household_attendance_recovery.mjs` verifies real pause/resume, exact data-only fixture dump/restore, original receipt replay and preservation of a later active visit. It refuses non-disposable names/nonempty attendance and cleans only its own fixtures. No new dependency.
- [Rollout, recovery and consumer/retirement ledger](rollout-recovery.md) provides release order, staff notice, candidate/target constraints, pause/drain/reconcile steps and exact remaining gates.

## Orientation and ownership

Root AGENTS is empty; CLAUDE delegates to it. Admin/Web AGENTS and CLAUDE require installed Next documentation; the installed Next 16.3 client-boundary guide was read. No nested Android/iOS/backend instructions were found. No repository-instruction conflict. The plan's historical planning-only language is stale and superseded by the execution request; only Phase 4 progress was edited.

Working-copy originals, full tracked binary patch, status and source ledgers live in `tmp/family-attendance-phase4-20261022/before`, `existing-user-work.patch`, `git-status.before.txt` and `baseline-sources.json`. Existing tracked/untracked work was preserved. Relevant ignored inputs: existing Android `.env`, admin `.env.local`, generated Expo route types and build caches; only presence/behavior was inspected, secret values were not copied or packed. Build outputs use separate directories. No Git commit/push, remote mutation, external configuration change or real-data deletion occurred.

Workflow followed: Git → ripgrep → prior index/hash validation → scoped Repomix 1.18.1 → bounded complete XML Reader → original-source closure and baseline checks. Primary 11-entry packet/chunks 0–10 fully read (largest 10,925 characters/153 lines); empty AGENTS complete. Maintenance supplement two entries fully read (4,446/7,157 characters, 61/126 lines). Both are parsable uncompressed XML, security-clean/source-equivalent with no unexplained omissions. Manifests record hashes/selectors/boundaries. No named Reader/Repowise tool was exposed; local XML parsing filled Reader, optional Repowise unused. No measured usage-saving claim.

95 prior identities matched; older changed/deleted entries were explained by Phases 2–3 and checked against the latest phase identities. Original RPC/grant/lifecycle/mirror/caller bodies and active Web QR caller were confirmed. The timestamp migrations were renamed externally to hash-identical 0137/0138 during execution. Another actor then recorded 0139 (which removes attendance) and 0140 (which restores it) in hosted history. Pushed history was left intact. Original 0139 ranges 1–105, 323–334, 415–436, 576–618 and 678–729 were inspected. The new 0140 packet is source-equivalent; its unchanged bodies match verified 0137/0138 exactly except a reviewed deletion-v2 executable anchor, transaction wrappers and new pre/postflight checks. New XML ranges 1–22, 548–553 and 851–871 were read; unchanged bodies were reused only after equality/dependency verification. The full empty local chain 0139→0140 passes all 464 SQL assertions, 21 independent-session scenarios, recovery and 17 real-REST browser groups. 0140 reconstructs schema, not records previously dropped by 0139; any affected target data remains an operator backup-reconciliation gate.

Version references read: Expo v57 SDK/Camera/Router pages, installed Next 16.3 client guide and package definitions, installed Node 24.13.1 APIs used by the existing concurrency harness, PostgreSQL 17 REVOKE/backup documentation, Supabase changelog HTML and documentation search. Markdown changelog fetch was unsupported; HTML fallback worked. No framework upgrade or native component implementation was added.

## Initial requirement classification

| Phase 4 requirement | Initial state | Final local result |
| --- | --- | --- |
| Verify prerequisites rather than phase labels | Partial: source evidence existed; attended gates open | Latest production identities/code confirmed; unverified gates retained |
| Exact candidate, checks and runtime identity | Partial: historical per-phase records | Fresh checks/build/artifact hashes and catalog evidence recorded |
| Access/concurrency/privacy regressions | Partial: prior results | 464 SQL assertions, 21 independent-session scenarios, 64 iOS API/QR/export tests pass |
| Staff-to-resident integration | Partial: separate prior harnesses | 17 final Brave groups; actual staff/Family hooks share real REST/database, synthetic Auth/native adapters |
| Migration/recovery | Partial: Phase 1 backend-only rehearsal | Both candidate migrations through 0138 rehearsed; repeatable pause/restore/replay passes |
| Temporary outage experience | Partial: generic retry copy | Actual permission denials map to clear temporary-unavailability message |
| Retirement/target rollout handoff | Not started | Verified consumer ledger and operator instructions delivered; active Web image endpoint retained |
| All target/physical gates and safe full chain | Not started | Partial: restored full local chain passes; latest linked catalog/permissions restored by external 0140, actual Auth/physical/full-native and any pre-0139 data reconciliation remain pending |

## Actual checks

| Check | Result |
| --- | --- |
| Baseline Android unit tests / lint | PASS: 266 tests / zero lint diagnostics |
| Baseline shared suite | PASS: 569 tests |
| Baseline iOS API/QR/export tests / types / lint | PASS: 64 tests (including 15 export), types and lint |
| Baseline Web types / affected lint / cutover contracts | PASS: types/lint and four contract groups |
| Baseline admin types / lint / full table suite | Types PASS; lint same two unrelated warnings; 159 tests pass and same pre-existing request-editor failure |
| Final affected shared / admin attendance tests | PASS: 44 / six; no false success or permission weakening |
| Final supported app typechecks | Admin TypeScript 5.9.3, Web and iOS PASS; Android same three pre-existing TS2859 external-link diagnostics |
| Alternate admin compiler attempt | Root TypeScript 6.0.3 reports existing profile-workspace DOM-interface TS2532; wrong compiler for admin baseline, not counted as supported pass and source untouched. Actual workspace command/build pass |
| Owned source lint / recovery syntax | PASS: correctly rooted installed admin config, zero diagnostic output; Node syntax passes. Earlier out-of-base files were ignored and not counted; root-directory warning resolved by correct Next root setting, no rule suppression |
| Baseline and final Android Hermes export | PASS. Final artifact hashes recorded; pre-existing Metro cache deserialize fallback and NO_COLOR/FORCE_COLOR tooling warnings recorded. Export is not an installed native release build |
| Baseline and final admin Webpack build | PASS: separate output directories, build/type/static rendering succeed |
| Fresh schema-only migration rehearsal | PASS through 0141: initial 21 migrations after 0117 plus externally added 0139→0140→0141, on empty schema-only local targets; no copied residents or presence backfill. Final restored schema reruns all affected checks. This proves no recovery of any preexisting data dropped by externally applied 0139 |
| SQL affected suites | PASS: 83 attendance + 30 boundaries + 27 projection + 153 lifecycle + 22 conditional roster + 56 deletion + 86 backend + seven tenant + 16 receipt-export = 480 |
| Independent PostgreSQL connections | PASS: 21 scenarios; actual lock waits, timeout/retry, role/auth/lifecycle/erasure races; fixtures cleaned |
| Paused HTTP confirmation | PASS: actual PostgREST arrival/departure return the exact permission messages handled by the new copy; every stay/receipt unchanged; authenticated grants restored; test service stopped |
| Pause/resume and recovery | PASS in separate empty schema-only candidate database: access revoked publicly/privately; resident reads/legacy guard retained; two visits/three receipts preserve all fields; exact delayed receipts leave newer stay open; fixtures count zero |
| Final Brave integration | PASS: 17 groups, zero captured console errors; resident warnings were also captured, while the staff warning channel remains an attended verification limit. Actual staff dialog and Android Family/hooks → real Supabase REST/PostgREST 14.5/PostgreSQL 17.6. Two-of-four status/timestamps and screenshots inspected. Auth endpoint/native APIs/QR renderer adapted locally, so full staging/native/physical proof remains pending |
| MuMu native supplement | PASS within harness scope: nine actual native flow groups, local real API arrival/departure, errors/Retry, theme/font/accent, focus/idle, actual AppState resume, delayed-account/logout and conditional add/edit/remove. 320dp/130% text and input focus also pass. Settings restored. Native warning/error log empty after emulator recovery. Full installed release/Auth/tabs and visual keyboard overlap remain pending |
| Linked target read-only catalog | First observed absent after 0139; later read-only migration history records externally applied 0140/0141 and catalog confirms tables/APIs/guards plus expected denial grants restored on PostgreSQL 17.6. Static catalog evidence is not an actual Auth/staging behavioral pass. No remote mutation by this task |
| Cleanup | Test browser servers closed; only owned test PostgREST container stopped. Recovery fixture counts all zero; unrelated Docker services/WSL and user migrations preserved |

Recovery first failed because the new assertion guessed an internal error token instead of the actual existing guidance. Original source was reread and assertion corrected; the whole corrected test passes. Browser first failed because a synthetic adapter captured the client before top-level initialization; forwarding calls to the initialized real SDK fixed the harness. Those failures and diagnostics remain in logs; they are not product passes.

## Acceptance for the actual release

The restored full local candidate through 0141 is distinguished from actual target/Auth/device acceptance. Hosted static grants now match the inspected boundary; no target mutations were tested. Every target-dependent gate remains open; no mock-only or screenshot result is substituted for authorization/concurrency/physical-camera evidence.

| ID | Status | Exact local evidence | Remaining gate |
| --- | --- | --- | --- |
| A01 | Pending manual verification | 83 attendance assertions; holder-only staff flow; actual Family hooks/real-REST roundtrip; native local API holder arrival/departure displayed with Manila times | Actual installed candidate/staging holder-only camera-to-Family flow |
| A02 | Pending manual verification | Final browser groups: exactly two of four, two unchanged; arrival/departure shown in actual Family components; actual native local staff two-participant arrival/departure status | Full authenticated installed Android/staff target roundtrip |
| A03 | Pending manual verification | 21-session suite same-center/request races, original arrival preserved; browser duplicate confirm one write | Recheck immutable staging candidate after migration resolution |
| A04 | Pending manual verification | Independent-session different-center conflict and source-current admin rejection | Recheck staging candidate/target |
| A05 | Pending manual verification | SQL replay/access revocation; browser response loss exact UUID/payload; recovery delayed replay | Actual staging Auth/session revocation and target replay |
| A06 | Pending manual verification | Exact-stay SQL/browser departure; recovery closed receipt replays without closing later visit | Staging candidate/target replay |
| A07 | Pending manual verification | 83 + 30 SQL boundary assertions: atomic batch/key conflicts/forged authority; UI response ownership | Staging candidate/target |
| A08 | Pending manual verification | Authenticated-role RLS/tenant/history tests and real REST; actual DB authority, synthetic Auth endpoint | Real staging Auth/role/account/tenant revocation |
| A09 | Pending manual verification | Local tested candidate blocks direct/generic/legacy/queued writers; clients send no attendance writes | 0140 restores server boundary and final local chain checks pass; actual target role/legacy/queued write behavior still requires separately authorized staging tests |
| A10 | Pending manual verification | Lifecycle/rename/roster/race suites; stable member identities; no production code change | Attended target rename/removal/arrival flow |
| A11 | Pending manual verification | Center lifecycle/reassignment races; real browser inactive-center checkout | Candidate/target recheck |
| A12 | Pending manual verification | 22 conditional-save assertions; prior hash-current Android two-editor UI evidence | Full candidate target multi-editor Family/Settings flow |
| A13 | Pending manual verification | Final 480 SQL assertions include 16 receipt-export boundary tests, 56 deletion, 86 backend and seven tenant checks; 15 export tests within 64 iOS tests. Final 0141 helper/view source and target static catalog inspected. | Deploy/smoke both actual erasure/export Edge versions under separate authorization |
| A14 | Pending manual verification | Native actual QR: direct settled enlarged decode; normal captured pixels decode after documented nearest-neighbor doubling through staff html5-qrcode 2.3.8. Physical camera unavailable per user; directory fallback passes locally. | Physical camera scans displayed normal/enlarged QR; authenticated target fallback |
| A15 | Pending manual verification | Brave states, error copy, theme/narrow/200% zoom, account cleanup; actual Family arrival/departure screenshots inspected; nine MuMu flow groups, 320dp/130% text, serif/extreme accent/dark, native conditional editing and account isolation pass | Full installed release app/actual Auth and bottom-tab clearance; visual keyboard overlap. User keeps remote checks pending. |
| A16 | Pending manual verification | Real browser stable idle counts, timeout/key retry, double-confirm and late camera cleanup; actual recovery pause has clear mapped copy; native idle/focus/resume/error/Retry/delayed-account/logout pass; post-restart ReactNativeJS warning/AndroidRuntime error log empty | Actual deployed Auth/session behavior and full app navigation; remote verification pending per user |
| A17 | Pending manual verification | Owned diff/retirement/source/artifact ledgers; fresh migration-through-0138 and recovery pass; no new dependency | Final local chain through 0141 verified; preserve pushed history. Operator must reconcile any data affected by external 0139; physical-camera/full-release/target gates remain pending. |

## Pending attended steps

1. Preserve pushed 0139/0140 history. The full empty local chain now passes. Obtain the operator’s reconciliation of any target data affected by the externally executed 0139; 0140 does not recover deleted records. Freeze candidate/target identities before final approval, and do not replay destructive history on an already migrated target.
2. Separately authorize an exact staging project/candidate and perform coordinated backend/privacy/client rollout using the runbook. The current prompt excludes deployment/remote SQL. Record actual Auth/role/tenant behavior, deployed deletion/export, server logs and original-request replay.
3. Install the exact Android release candidate, sign in through actual Auth and run holder-only/two-of-four staff-to-Family arrival/departure. Use a physical camera on normal/enlarged displayed MuMu QR; record camera/browser/build/target. Verify directory fallback and denial too.
4. Exercise full native navigation, logout/account switch while reads are delayed, focus/resume/idle counts, timeout/retry, native keyboard, bottom tabs, narrow width, large text, themes/accent/fonts, two-editor roster conflict and active removal. Record outcomes and diagnostics; leave a gate pending when hardware/credentials are unavailable.

Out of scope and unchanged: admin request-editor failure/two warnings, Android route-type complexity, alternate-compiler profile diagnostic, unrelated migration author work, existing hosted drift and Firebase push configuration. The active Web image endpoint has a verified consumer and release owner/next-cutover retirement condition in the runbook; deleting it now would break Web.

Final preservation audit: the existing Web contract runner overwrote baseline-clean historical `rw-lt-05/unit-results.json`. Its new result was copied to this Phase 4 evidence directory, and the historical file was restored byte-for-byte from its verified clean baseline. All 94 protected baseline identities and the original attendance migration contents remain preserved.

## Continued verification — native first, remote and camera pending by request

The user explicitly chose to keep remote checks pending, then confirmed only MuMu/software decoding is available. Physical-camera verification therefore remains open. Native checks were completed locally without any remote mutations or new product/native implementation. The current Family components/QR/hooks use real SDK REST calls against the disposable PostgreSQL 17.6 database; auth/session/preferences/focus providers remain test adapters in the installed October 15 development client.

Nine native flow groups pass, plus 320dp/130%-text controls and focused input. Actual local staff arrival and exact-stay departure show native Manila timestamps; conditional member add/edit/remove invokes the real guarded save RPC and restores the four-person fixture. Idle/focus/resume, clear failure/Retry, delayed read/account switch and logout are bounded and retain no prior private family. Dark theme, serif font and white accent were visually inspected. The input-method log reports a shown software keyboard, but the captured pixels do not visually establish overlap/clearance; that gate remains pending along with full app tabs.

The normal-size raw screenshot decode initially failed. A second explicit approach doubles captured pixels with nearest-neighbor scaling and passes through the existing staff decoder. The settled enlarged capture passes directly. These are software tests, not physical-camera proof. Failed/superseded captures/logs are preserved locally; final labeled evidence lives in `native/` and `native-results.json`.

The first native attempt encountered IPv6 localhost mismatch, stalled ADB and an offline transport. Supported MuMu CLI help/info identified only Android 12 instance 0; its documented restart restored responsiveness without erasing data. Fixed-delay/animation assumptions in the new harness were corrected after inspecting real state; affected checks rerun pass. The final native ReactNativeJS warning/AndroidRuntime error log is empty. Both owned native servers and test REST service are stopped, reverse ports removed, app closed, physical size restored to 1080×1920 and font scale to 1.0. An earlier automatic approval review usage failure prevented one cleanup attempt; after continuation the cleanup was approved and completed, with nothing left blocked by that review.

External migration 0141 replaces receipt export access with an invoker/barrier view over a narrow private, owner/active-account-checked helper. Its source/test Repomix supplement was completely read; all nine SQL suites pass on the final local schema: 480 assertions including 16 receipt access negatives. The unchanged 21 mutation races, recovery and 17 browser groups retain their verified 0140 function/schema identities; 0141 only changes the export read/helper/view. Latest read-only hosted history records 0141 and its inspected helper/view/grants match the source. This is static catalog evidence, not deployed Edge/Auth acceptance. No migration was authored, changed or remotely applied by this task.

Final owned-code Repomix packet: five entries completely read in three bounded extractions (test 4,987 chars/67 lines; schema 7,473/128; two operator scripts plus recovery 8,478/116). Security/source equivalence and no omissions pass. Earlier changed packets remain historical; source/check/artifact identities are current in `verification.json`.
