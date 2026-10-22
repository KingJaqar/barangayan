# Phase 16 integration acceptance — 21 October 2026, Asia/Manila

**Status: Partially complete.** Available implementation, automated integration checks, context handoff and cleanup decisions are delivered. The user explicitly chose to finish available work and leave native checks pending. This does not waive the plan's native/fidelity/integration gates. No production-readiness or release claim is made.

## Requirements and initial classification

| Requirement | Before edits | Result |
|---|---|---|
| Reconcile adopted Phases 1–15 against implementation | Partially done: source and earlier evidence exist; native acceptance incomplete | Actual routes/primitives/providers and all 19 existing fixtures inspected/exercised. Phase 14 stored verified-ID image/type/version remains not met. Earlier phase completion labels were not upgraded. |
| Final lint/types/unit/shared/export | Not started for this working copy | Baseline and affected final checks pass; exact results below. |
| Complete presentation/lifecycle fixture inventory | Partially done: earlier results apply to older snapshots | All 19 scripts pass on this working copy after the bounded fixes below. Synthetic adapters do not certify native behavior. |
| MuMu/reference/motion/theme/font/accessibility/permission/offline/performance matrix | Not started for this candidate | Pending manual verification; reviewed ADB device inventory empty. User selected native deferral. |
| Proven obsolete presentation cleanup | Not started | No deletion qualified. Retained routes, legacy behavior and public/auth variants require preservation or replacement-native acceptance. |
| Reversible diff/context handoff | Partially done: predecessor history retained | Working-copy snapshots, patches, hashes, immutable supplied packet, refreshed source/guidance and this matrix supplied. |

## Delivered changes

- `src/components/services/document-guide-content.tsx`: restores the legacy document requirement list when `catalogContract(doc)` is null. Renders every existing stored string in the current resident panel with account-derived colors and selected typography. Empty lists omit the panel; v2 retains its authoritative charter checklist. No new query, schema, validation, action, dependency or animation.
- `tests/request-document-presentation-ui.mjs`: reproduces the missing legacy list before the fix, verifies both requirements afterward, narrow/wide dark/custom-accent rendering, empty list and v2 isolation. Existing form, attachment, busy and submission assertions retained. [Synthetic legacy screenshot](../../../../tmp/resident-android-magicpatterns-phase-16-20261021/fixtures/request-document-presentation-ui/legacy-guide-dark-412.png) was visually inspected; it is not Android evidence.
- `tests/document-forms-ui.mjs`: retains all original content expectations, checking legacy requirement text in contract v1 and charter text in v2. The shared mapper derives v2 `requirements` from its charter; the old fixture expected divergent legacy and charter content in the same v2 view. The exact assertion failure was already documented in Phase 5. No assertion was lowered or removed.
- `tests/resident-shell-lifecycle.mjs`: supplies the existing SVG boundary and real RN Web easing in its synthetic native adapters, permitting actual shell tests to reach their retained assertions.
- `tests/services-tab-stability.mjs`: enables the PNG data loader for the existing verified-ID image. All original refresh/position/error assertions retained.

## Baseline, verification and diagnostics

Recovery root: `tmp/resident-android-magicpatterns-phase-16-20261021/`. HEAD and pre-edit hashes are in `baseline.json`; full tracked/staged patches, scoped status and source snapshots precede application edits. The first whole-tree expanded status exceeded a process buffer; the successful baseline used compact global status plus expanded relevant scope. No failed result was treated as a successful snapshot. No sensitive environment values were copied into packets.

| Check | Baseline | Final | Evidence under recovery root |
|---|---|---|---|
| Android typecheck | Pass, exit 0 | Pass, exit 0 | `logs/baseline-typecheck.log`, `logs/final-typecheck.log` |
| Android lint | Pass, exit 0 | Pass, exit 0, no lint errors/warnings | `logs/baseline-lint.log`, `logs/final-lint.log` |
| Android Vitest | Pass, 25 files / 260 tests | Pass, 25 files / 260 tests | `logs/baseline-unit.log`, `logs/final-unit.log` |
| Shared Vitest | Pass, 34 files / 527 tests | Pass, 34 files / 527 tests | `logs/baseline-shared.log`, `logs/final-shared.log` |
| Android Hermes export | Pass outside sandbox | Pass outside sandbox | `logs/export-permitted.log`, `logs/final-export.log` |
| Existing browser/reducer inventory | Initial 15/19 pass; guide assertion, new legacy regression and two adapter/build failures recorded | All 19 scripts pass | `fixture-results.json` retains initial exit codes; final logs and per-script groups in [verification.json](verification.json) |
| Owned diff and preservation | Snapshots captured | Five application/test files plus Phase 16-only plan hunks reviewed | `owned.patch`, `final-inputs.json` |
| Native candidate | Reviewed read-only ADB inventory lists no devices | Pending manual verification, explicitly deferred by user | No native build/flow/log/performance pass claimed |

The complete fixture inventory is preserved in `verification.json`, including each actual group, log hash and diagnostic. Reports/Announcements retains its two existing asserted RN Web deprecations (`shadow*` and `props.pointerEvents`); these are not newly introduced or suppressed. Expo export retains the environment `NO_COLOR`/`FORCE_COLOR` tool warning. No new runtime/page diagnostics were reported by the changed fixtures. Native console/server logs remain unverified.

Sandbox export/fixture subprocesses stalled before useful completion; reviewed runs outside the sandbox completed. No unchanged failed application command was retried as a fix. The pre-fix legacy failure body is retained in `legacy-guide-before-failure.json`. Adapter failures were diagnosed from their exact PNG-loader and native Flow-parser errors before editing. All subsequent reruns followed a specific source/adapter/test correction or final gate.

Baseline Hermes: **8,251,348 bytes**. Final: **8,251,995 bytes**, **+647 bytes**, explained by the restored legacy panel. Both exports contain **53 assets / 6,453,724 asset bytes** with identical content hashes. This compares the Phase 16 working-copy baseline and final export, not a clean HEAD or a measured native performance baseline. No new dependency or binary asset was added.

## Prerequisites, deviations and cleanup

Implementation prerequisites are present: resident tokens/fonts/reduced-motion variants; shell/header/inset providers; Services/Home/guide/form/tracking/payment; Reports/news; Maps bridge and DRRM Hub/Centers/Scan/Family; Health; Settings/Profile/verification/Help/legal/About. Their actual current component/reducer fixtures and contract tests pass. This establishes implementation evidence, not completion of the predecessor native gates.

Phase 14's verified-ID route currently renders its status but does not fetch the stored approved-submission image/type/version. Its recorded no-new-query boundary remains binding. A narrow ownership-checked approved-submission/signed-image read needs a separate scope decision; no query, policy or backend change was made here. The screen-32 matrix entry is **not met**, independently of native deferral.

| Cleanup candidate | Decision and verified reason |
|---|---|
| Legacy guide/request form | **Keep:** contract-v1 documents and original upload/payment path remain supported; guide requirements were repaired instead of deleting this branch. |
| `/drrm`, `/home/emergency-info`, QR-guide/scan aliases, Home tracking route | **Keep:** Expo Router entries/re-exports preserve existing destinations and independent Back stacks; actual router-reducer fixture passes. Import-search absence would not establish obsolescence. |
| Public emergency/auth/default primitive variants | **Keep:** public emergency imports Centers outside resident providers; auth/default presentation and sensitive controller consumers remain. |
| Existing map, route diagnostics, picker and offline assets | **Keep:** shared public/report/profile/native bridge consumers and routing fixtures still exercise them. |
| Earlier phase evidence, XML, recovery outputs and user assets | **Keep:** provenance and recovery history; no repository-wide cleanup authorized. |
| Any other replaced presentation branch | **Remove only after verified migration:** replacement-native acceptance is still pending; no deletion is represented as qualified. |

The plan's initial planning-only/stop-before-16 statements are historical; the current user request authorizes Phase 16. No AGENTS/CLAUDE conflict exists (root AGENTS empty, CLAUDE references it, no applicable nested file found). A concurrent Phase 15 About correction note appeared after the initial plan snapshot; it was preserved byte-for-byte in `plan-before-phase16-update.md` and `concurrent-plan-note.patch`, and excluded from the Phase 16 owned patch. Root lockfile/source identity remained stable for this audit. Earlier source packets without current original hashes were treated as historical, never proof of prerequisite completion.

The retained reference target is v32/artifact `df178e1c-7b6e-4d98-8334-06f3a00f28c3`; prior Phase 15 evidence reports live editor v35. No fresh Brave/reference/native comparison or exact-motion claim is made in this session. Existing typography/icon/dark-surface/native-stack adaptations remain explicit in the main plan. [Screen matrix](screen-acceptance.csv) records all 39 missing candidate/reference pairs and assigned motion IDs; [motion matrix](motion-acceptance.csv) records M01–M16 as native-pending.

## Acceptance and exact remaining manual work

| Section 8 exit criterion | Status |
|---|---|
| 1. All adopted screens/states/adaptations covered | **Not met:** screen 32 stored-ID presentation; candidate/reference comparisons and native state coverage pending. |
| 2. Relevant project and native checks pass | **Met for automated checks; pending manual verification for native.** |
| 3. MuMu flows/permissions/offline/repeats/theme/font/size | **Pending manual verification.** |
| 4. No dependency/provider/query/asset bloat or performance regression | **Met for owned source/export scope; pending manual native performance comparison.** |
| 5. Proven cleanup, preserved user work and recoverable diffs | **Met for preservation/recovery; pending replacement-native acceptance before deletion.** |

1. Open an authorized MuMu SDK 57 candidate/test account. Record serial, package/build, API, resolution/density, font scale and navigation mode. Do not clear data, switch real accounts or perform real consequential actions.
2. Follow `screen-acceptance.csv` and the main plan section 8 flow matrix: all six tabs, detail/Search/aliases and Back/keyboard; safe fixture loading/empty/error/retry/busy/cancel/success states; map/public/picker/offline/permission; QR camera lifecycle; household/Health/report/payment/account branches. For legacy guide, open a contract-v1 service and check all requirement strings plus request/Back; check a v2 service retains charter wording without duplicate legacy content.
3. Capture same-state pinned-v32/native pairs at compact/360/400–412dp plus a taller/short-keyboard layout. Cover Light/Dark, default/blue/warm/extreme custom accents, all offered fonts on representative long content, font scales 1.3/1.5, TalkBack roles/order/focus return and at least 44dp controls.
4. For M01–M16, run normal/reduced motion, five enter/change/close/Back or reverse cycles and two background/foreground cycles. Use only safe slow fixtures for five rapid submit taps. Compare listener/channel/timer/request counts at the same route, verify camera release and no invisible scrim/stale callback.
5. Record reference/native motion, logs and profiler/frame/memory evidence against the same baseline/build/configuration. Apply the plan's timing/frame gates only with appropriate measurements. Real provider settlement/email/OCR/share/permission/persistence paths need existing authorized fixtures; unavailable ones stay pending. Resolve the separate Phase 14 read boundary before screen 32 can pass.

No commit, push, deployment, remote migration, data deletion, service configuration change, real sensitive operation or third-party message occurred. Roll back only the owned hunks in `owned.patch`; do not restore the entire plan from the initial snapshot or discard the user's existing changes.
