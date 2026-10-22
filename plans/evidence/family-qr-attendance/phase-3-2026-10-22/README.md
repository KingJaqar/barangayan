# Phase 3 execution — October 22, 2026 (Asia/Manila)

Scope: Android resident integration and cross-client legacy cutover only. No deployment, remote migration, commits, pushes, external configuration changes or data deletion are authorized.

## Baseline and context

- Root AGENTS is empty; root CLAUDE delegates to it. No nested Android/iOS instructions. Resident web AGENTS/CLAUDE require installed Next documentation; `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` read. No instruction conflict. The plan's planning-only heading is stale and superseded by the execution request; only Phase 3 progress will be edited.
- Recoverable working-copy source copies, full pre-existing tracked patch and Git status: `tmp/family-attendance-phase3-20261022/before`, `existing-user-work.patch`, `git-status.before.txt`. Existing source changes belong to the user; owned changes are compared to these copies, not HEAD. Sensitive environment values are excluded; only environment file presence/configuration affects build transport. No credential values are recorded.
- Workflow: Git → ripgrep discovery → existing index and source identity validation → scoped Repomix 1.18.1 → bounded local XML Reader → original handlers/contracts/styles/cleanup verification. No Reader/Repowise tool is available; safe local XML parsing is used, Repowise optional and unused.
- Repomix: `tmp/family-attendance-phase3-20261022/resident.before.xml`, manifest/chunks and security log alongside it. Uncompressed parsable XML; all 17 selected entries included, source-equivalent after newline normalization; empty AGENTS read. Sixteen nonempty chunks, each at most 180 lines/11,000 characters, fully read 0–15. Chunk 14 reread alone after combined output omitted a section. No compression gaps or missing required continuation. Packet estimates are not actual usage measurements.
- Original-source closure: Settings profile hydration/dirty/save state and raw roster handling, iOS API/error/controller and tests, web scanner/upload consumers, shared RPC signatures and current mirror/legacy guard bodies. Existing Phase 1/2 source identities revalidated separately; their device/staging gates remain pending.
- Version references: Expo 57 Router focus hooks and Camera preview lifecycle; RN 0.86 AppState; installed react-native-qrcode-svg 6.3.21 README/types; React cleanup guidance plus installed 19.2 runtime/types (the `19-2.react.dev` archive URL was inaccessible); Supabase JS 2.112.1 RPC/abortSignal (documentation search plus installed definitions); Next 16.3 installed client directive guide. Supabase changelog Markdown fetch unsupported by web transport; HTML index inspected. No relevant breaking change requires a dependency upgrade.

## Initial requirement classification

| Requirement | Before Phase 3 | Finding |
| --- | --- | --- |
| Local validated data-only household QR | Not started | Android fetches authenticated external image with no deadline; web still calls that endpoint, iOS renders locally |
| Holder and per-person current/latest-departure status | Not started | Android only shows editable additional people, no authoritative attendance |
| Focus/manual/resume bounded refresh and account isolation | Partial | Existing focus/presentation cleanup; roster read lacks deadline and new status data absent |
| Conditional Family and Settings roster save | Not started | Both Android editors directly overwrite profile JSON; existing conditional RPC verified |
| Staff-only resident scan cutover | Partial | Phase 1 rejects legacy/direct/queued arrivals and protects projections; Android/web clients still write; iOS legacy RPC/read reconciliation still present |
| Retire unused local paths and preserve live compatibility | Not started | Android queue hook only consumed by scanner; web image endpoint remains live and must be retained |
| Phase 1/2 prerequisites | Local implementation present | Current schemas/signatures/security and admin call wiring verified in source; earlier physical camera/staging checks were never complete |

## Baseline results

Exact commands, exits and full output are in `tmp/family-attendance-phase3-20261022/baseline-checks.json` and `logs/baseline-*`.

- Android types: pre-existing TS2859 complexity failure in `components/external-link.tsx`, three diagnostics. Android lint passes. Android unit suite: 260 pass.
- Shared attendance/response schemas: 42 pass. Web types and affected lint pass. iOS types and affected API/QR tests: 54 pass.
- Android export: restricted Metro startup stalled and was interrupted; a diagnosed two-worker unrestricted build baseline is recorded separately.
- ADB cannot start its daemon in the restricted runner. Docker engine pipe is absent. MuMu installed build/device state and isolated PostgreSQL behavioral rechecks are pending environment access; no pass inferred.

## Implementation and final verification

Phase status: **Partially complete — implementation and local verification complete; full authenticated staff-to-resident and physical-camera acceptance pending.** No independent production-code work remains for Phase 3.

| Requirement | Implemented behavior / files |
| --- | --- |
| QR | `components/drrm/household-code.tsx` renders the shared validated v1 payload through existing react-native-qrcode-svg 6.3.21. Identity must match the current session. No remote image/auth-token image request remains on Android. Optical media colors retain contrast in either theme; both views use the same reference and quiet zone. |
| Holder/status | `family-content.tsx`, new `hooks/use-household-attendance.ts`: holder plus roster total, current center/arrival and latest visit/departure in Asia/Manila, honest unavailable/no-recorded states. Existing screen owns scrolling/bottom-tab clearance. |
| Roster | New `lib/household.ts`, Family hook/modal and Settings profile: whole-list validation, raw expected snapshot, caller-derived conditional RPC, preserved IDs, strict returned-list correspondence, clear stale/active-removal feedback, explicit reload after uncertain outcome. Settings roster and demographic writes are separate: confirmed partial results are described; unchanged rosters are not rewritten. |
| Lifecycle | Account-keyed Family presentation, generation and owner guards, abort cleanup, 15-second SDK/fetch watchdogs, explicit/focus/resume reads, no new polling/subscription or effect-driven mutation. Shared profile provider remains unchanged. |
| Legacy cutover | Android scanner and web camera/upload handlers send zero attendance writes and explain staff confirmation. iOS `checkInToCenter` compatibility adapter validates input then refuses locally with safe resident copy; legacy scan logs are explicitly labeled. Existing migration rejects older/queued requests and protects compatibility projections. |

No new dependencies, migration or changes to shared security/contracts were needed. Initial failures were diagnosed and corrected: abortSignal must precede `.single()` in the installed builder; the iOS clock-slack constant is also used by health registration and was retained; a new test import ordering warning was corrected. Earlier failed logs remain identifiable and are superseded by the passing results below.

## Verification ledger

Source identities and ownership: [verification.json](verification.json). Full diagnostic logs and the recoverable owned diff are under `tmp/family-attendance-phase3-20261022/`; `owned.diff` compares to working-copy snapshots, not HEAD. All snapshotted unowned source/lockfile bytes are unchanged. Historical untracked browser-test snapshots were revalidated by reproducing the exact recorded transformation into the candidate; `test-baseline-reuse.json` identifies them.

| Check / flow | Actual result |
| --- | --- |
| Android unit suite | **PASS:** 266 tests in 26 files (baseline 260/25). Six new tests cover whole-list validation, expected snapshot/result matching, safe conflicts, hung/cancelled requests, timer cleanup and Manila dates. |
| Shared attendance/response schemas | **PASS:** 42 tests, baseline and candidate. Schemas/dependency hashes unchanged; no redundant final rerun. |
| Android lint | **PASS:** full Expo lint after correcting the introduced test-import warning; correction also checked directly. |
| Android typecheck | **PRE-EXISTING FAILURE:** only three TS2859 diagnostics at `components/external-link.tsx` lines 9/12. Same locations/codes as baseline; generated route-union counts vary after Expo regenerates its ignored type artifact. No new diagnostic remains. |
| Android build | **PASS:** baseline and final production Android Hermes export with two Metro workers. Final artifact/log: `export-candidate`, `logs/candidate-export.log`. Restricted initial startup was interrupted; the verified two-worker build resolved the runner issue. Build-tool NO_COLOR/FORCE_COLOR warnings already occur in baseline. |
| Web typecheck / affected lint | **PASS:** affected camera/upload/helper paths; current scan-content guidance included in final lint. |
| Web cutover contracts | **PASS:** four groups in `scripts/resident-web-feedback-regression.cjs rw-lt-05:unit`; one safe warning, attempt identity, removed hook, zero mutation path, existing validation/household-feedback contracts. Its old self-check-in browser expectations were adapted; syntax check passes. Full legacy Web browser/database suite was **not run** because its local database stack is unavailable. |
| iOS typecheck / lint | **PASS:** typecheck and existing app lint. |
| iOS affected API/QR tests | **PASS:** 49 tests (baseline 54). Obsolete legacy success/reconciliation expectations replaced with no-request/staff-guidance assertions; malformed input and legacy read restrictions retained. No unrelated API test removed. |
| Android browser Family/scanner | **PASS:** 13 groups using real components/hooks/theme and synthetic native/transport adapters; holder arrival/departure, roster changes, stale/active-removal guard, loading/error/Retry, identity guards, idle/focus/resume counts, QR equivalence, denied camera/cleanup, 320/360/400/412 widths, light/dark/extreme accents and ten offered fonts. Final report has zero captured console warnings/errors. |
| Android browser Settings | **PASS:** 12 groups, including conditional roster save, no direct JSON update, no demographic-only roster rewrite, stale save blocks demographic write, explicit reload, existing avatar/draft/validation/preferences behavior. Zero captured console warnings/errors. |
| Native MuMu | **PASS, scoped harness:** existing `com.barangayan.resident.dev`, version 1.0.0/code 1, last installed October 15; Android 12, 1080×1920. Actual current Family/QR/hooks render through a separate local Expo harness with synthetic auth/profile/transport. Holder arrival and departure, unselected member unchanged, normal/enlarged code, dark theme and 130% text visually inspected. Original font scale 1.0 restored. This is not a rebuilt authenticated full-app or real database pass. |
| Native QR → staff decoder | **PASS:** existing html5-qrcode 2.3.8 decodes native screenshots at both sizes to the exact shared v1 payload. Pixels framed using observed UIAutomator QR bounds; no QR replacement/resynthesis. Whole-screen decoding failed twice; library source inspection led to framing the actual code for the final test. The exact whole-screen decoder failure cause is not claimed. A physical camera remains pending. |
| Native diagnostics | **PASS for the isolated harness window:** no ReactNativeJS warning/AndroidRuntime error since 09:20 Asia/Manila. Earlier unrelated Metro crash and Firebase push configuration warnings predate the harness; they are not Phase 3 regressions. |
| Backend/admin prerequisite reuse | **SOURCE-VERIFIED:** all Phase 1/2 production candidate identities match prior evidence; historical plan/index hashes differ because Phase 2 progress was added. Current RPC, mirror, legacy trigger, grants and admin wiring inspected. SQL/concurrency/deletion/export tests were **not rerun**; prior local results retained only for matching sources. Docker engine is unavailable. |

The final Repomix supplement contains only new/changed household helper, status hook, roster hook and Family component: four entries/four chunks, each ≤10,250 characters/106 lines. All fully read, source-equivalent and security-clean; no omissions. It supersedes changed initial entries; unchanged contract entries remain reusable. Packet/source hashes and explicit read boundaries are in the two manifests.

## Consumer and retirement record

| Replaced / retained path | Verified consumer and disposition |
| --- | --- |
| Android remote household image implementation | Both inline and modal callers now use local `HouseholdCode`; removed image loader/auth headers/spinner/retry state. No Android `generate-household-qr` caller remains. |
| Android `hooks/use-qr-checkins.ts` | Only actual caller was the resident scanner; removed after replacing its handler with read-only guidance. |
| Android queue helpers | Sole producer/replay consumer was the removed hook. Removed unused queue types/helpers; retained ordinary emergency cache consumers. Existing on-device queued records are inert, never replayed or reported as attendance; no data was deleted. Older app replay is rejected by the existing coordinated server cutover once deployed. |
| Web `hooks/use-qr-checkins.ts` / `completeCheckIn` | Camera/upload were the production consumers; both now use `explainStaffCheckIn`. Removed old writer/types. Existing unit and browser scenario expectations updated for zero writes; no duplicate hook retained. |
| iOS legacy receipt parser/reconciliation | Only API consumer inspected; removed after the compatibility adapter was changed. `RECONCILE_SLACK_MS` retained because health-drive registration uses it. Scanner/controller types remain actively consumed by the existing iOS QR screen; retirement belongs to later iOS Family parity. |
| iOS legacy logs | `qr-section.tsx` still calls `recentCheckIns`; kept bounded, owner-filtered and labeled legacy rather than staff attendance. |
| `generate-household-qr` endpoint | **Retained live compatibility dependency:** web `components/emergency/family-content.tsx:194` → `household-qr-dialog.tsx` → function. Retire local/deployed endpoint only after the Web client replaces that image caller, supported old builds are retired and deployed caller checks show no active consumer. Endpoint deployment/removal is not authorized here. |
| Historical migrations / privacy code | Preserved. No backfill, data deletion or schema-history rewrite. Existing backend/admin cutover protects old requests; release coordination belongs to Phase 4. |

## Acceptance allocation

Statuses describe demonstrated local portions, with remaining target gates explicit. Prior backend/admin behavior is inherited only after current production-source identity validation; it was not rerun or relabeled as a new pass.

| ID | Status / evidence and remaining work |
| --- | --- |
| A01 | **Pending manual verification:** holder-only native/browser display, arrival/departure and prior SQL/admin gates met; actual staff-to-authenticated-Android roundtrip pending. |
| A02 | **Pending manual verification:** per-person rendering/unselected member unchanged in harness and prior partial-family SQL/admin gates met; real two-of-four flow pending. |
| A03 | **Met locally, inherited backend/admin:** uniqueness/races/double confirmation source identities unchanged; target recheck Phase 4. |
| A04 | **Met locally, inherited backend/admin:** cross-center conflict implementation/evidence unchanged; target recheck Phase 4. |
| A05 | **Met locally, inherited backend/admin:** request receipts/replay/current authorization unchanged; real staging session revocation remains pending. |
| A06 | **Met locally, inherited backend/admin:** exact-stay checkout/replay unchanged; target recheck Phase 4. |
| A07 | **Met locally, inherited backend/admin:** atomic selection/key conflicts unchanged; target recheck Phase 4. |
| A08 | **Met locally, inherited backend/admin; resident response boundary met:** caller-derived status, strict owner/shape validation, account cleanup; real staging Auth/tenant revocation pending. |
| A09 | **Met locally:** new Android/web scans make zero writes; iOS adapter makes zero requests; no Android queue producer/replay path. Existing server guards hash-current. **Deployment cutover pending**; current hosted protection is not claimed. |
| A10 | **Met locally:** stable IDs/rename and active-removal feedback; prior server lifecycle/races unchanged. Real staff/device target flow pending. |
| A11 | **Met locally, inherited backend/admin:** inactive-center departure/lifecycle implementation unchanged; target recheck Phase 4. |
| A12 | **Met locally:** both Android editors use raw-snapshot conditional saves; strict result validation/stale rejection/reload verified; prior actual SQL conditional-save tests retained. Target multi-editor flow remains Phase 4. |
| A13 | **Met locally, inherited backend:** privacy/deletion/export production sources unchanged; no new compatibility effect. Deployed Edge smoke remains Phase 4. |
| A14 | **Pending manual verification:** MuMu normal/enlarged QR rendering and actual staff-library screenshot decode pass; physical staff camera and authenticated directory fallback target check pending. |
| A15 | **Pending manual verification:** local read/error/edit/Retry, synthetic account change, native themes/large text and existing clearance source met. Full candidate Auth/logout/navigation/bottom bar and native keyboard need attended target verification. |
| A16 | **Pending manual verification:** bounded deadlines/cancellation/timer cleanup, same snapshot on save, no attendance resubmission, idle counts and focus/resume local tests pass. Actual deployed native session/request counts remain pending. |
| A17 | **Met locally:** owned diff reviewed, consumer/retirement ledger and candidate identities recorded, user work preserved, no new dependency; final target/recovery/endpoint retirement remain Phase 4. |

## Exact pending manual steps and limits

1. Use a separately authorized coordinated staging candidate containing the existing attendance and projection migrations plus staff/resident clients. This request does **not** authorize that deployment. Sign in with actual resident and same-barangay admin accounts. Test a holder-only household and then a four-person household; scan the real Android Family QR, select exactly two people, confirm arrival, refresh Family, check out the same stays, refresh again. Verify all other people remain unchanged and both timestamps use Manila time.
2. Scan the displayed MuMu/Android Family QR through an available physical staff camera at normal and enlarged sizes. Repeat camera denial and existing directory fallback. Record device/browser/build/target and console/server output. Screenshot/software decoding is not this physical test.
3. On the full candidate, navigate Family away/back and background/resume; inspect idle request counts, error/Retry and 15-second deadline states. Sign out and switch accounts while a read is delayed; verify no prior QR/member/status appears. Test 320dp width, 130% text, both themes, native member keyboard and bottom-tab Add/Edit reachability.
4. Open Family and Settings on two editors, save a roster edit in one, then save the stale draft in the other; verify clear rejection and explicit reload. Rename a checked-in member, try removing them while active, check out, then remove; verify history is preserved. Submit an old legacy/queued request after server cutover and confirm denial/no attendance change.

Out of scope: pre-existing Android route-type complexity; prior Firebase push configuration warnings; hosted migration/Edge drift and release/recovery. No physical camera, actual staging credentials/cutover or rebuilt full-app authenticated acceptance was substituted with assumptions. No commit, push, deployment, remote migration, external configuration change or data deletion occurred.

Final closure: all 26 owned production/test source identities still match verification; no new trailing whitespace in the snapshot-owned diff; other plan sections remain identical to the pre-edit snapshot. The local native test server was stopped, its ADB forward is absent, and font scale 1.0 was rechecked after reconnecting from an ADB daemon reset.
