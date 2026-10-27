# Phase 3 execution — 26 October 2026 (Asia/Manila)

**Partially complete.** The implemented repairs and recorded MuMu checks pass. Saved-member edit, ID-review birthday, and the specified native error/busy states remain unverified. No full per-field protocol pass is claimed. [Exact results and source identities](verification.json); [25 October history](report-20261025.md).

## Changed

- B32: the resident Delete Account modal selects Android height on its existing KeyboardAvoidingView. Reproduced baseline password overlap was39px. iOS padding and the other presentation/platform paths remain unchanged.
- A08/A10: the existing Android SettingsSheet scroller contains header, body and actions for family and default appearances. Family originally lost its input/body under the tall Gboard state. The continuation directly reproduced Custom Accent's20px body at1080×1680/540dpi/font1.3/IME top887. Both failed appearances now have a usable scrolling panel. Profile choice appearance and iOS retain their original arrangement.
- No dependency, new avoidance wrapper, keyboard-height subtraction, offset, listener, domain callback or security change. Existing account colors, fonts, safe-area padding, motion hooks and resize mode remain.

## Acceptance evidence

| Requirement | Actually observed | Status |
|---|---|---|
| B32 password/dialog | Default, compact/text and display/gesture input/action subsets; eye toggle, exact touch paste/middle-caret restore; empty-error growth; three restoration cycles. Controlled actual-component loading/rejection/close guards pass | Repair met; native rejected-reauthentication/busy state pending |
| A08 Profile Add/Edit | Native touch paste/caret, local Update/reopen; both Add and Edit opened from an already-visible underlying IME. Compact/text and display/gesture Edit each restore through3 cycles and retain local Update/reopen values. Full actions reachable | Recorded repair/variants met; no remote Profile save |
| A08 original height constraint | Normal MuMu desktop mouse control at1080×1332/480dpi/font1.3 gives the same579px keyboard boundary. Add/Edit retain full164px input height; Add, Remove and Update scroll fully into view | Measured usable-height constraint met; exact banner not recreated. Input border clearance0px, preferred8dp margin not attained in this extreme case |
| A09 Emergency Info and /drrm | Add focus/typing/actions/restoration subsets across default, compact/text and display/gesture. Exact native touch paste/caret passes on both routes; cancelled without saving | Add subsets met; actual saved-member Edit pending on both routes |
| A10 custom hex | Native valid/invalid guard, lowercase normalization, exact touch paste and original-value restore/cancel/reopen before layout-only extension. After extension: full input/buttons and restoration pass in all3 configurations;3 additional default restoration cycles, immediate reopen/original value and Android Back pass | Repair met; native duplicate/limit error growth pending |
| Shared consumers | Native Profile choice, ID type, household QR, Show QR slide, center picker and denied-camera picker open/header/close smokes pass | Recorded smokes met; birthday wheel pending ID-review prerequisite |
| Motion/geometry | Recorded restoration cycles return viewport bounds without persistent gap; current source matches loaded factories/maps | Recorded subsets met; complete native acceptance not met until pending states pass |

In larger-display Edit cycle1, Remove was297px high versus its306px full height established in cycles2/3. Only those later two captures prove full Remove reachability; all3 dismissal-restoration comparisons pass. Earlier40px Add clipping was likewise excluded and replaced with a full-height action-only observation. Positive clipped bounds are not counted as full-button passes.

## Verification

| Check | Baseline | Final after custom-color extension |
|---|---|---|
| TypeScript | Pass | Pass |
| Source ESLint | Exit0,2 warnings | Exit0, same2 warnings |
| Mobile library tests |335 tests /32 files pass |335 tests /32 files pass |
| Settings/Profile browser |14 groups, errors[] |14 groups, errors[] |
| Android JS/Hermes export |Pass |Pass; not a native APK build |
| Expanded actual-component checks |Supporting fixture |16 groups, errors[]; Android family/local edits and deletion guards |
| DRRM browser |Supporting unchanged-owner check |13 groups, errors[] retained; no redundant rerun |
| Native loaded factories/source maps |29/29 match |29/29 match in final restored session |
| Preservation/diff |79 nonsecret snapshots |All non-owned hashes identical; owned diff and whitespace check pass |

Exact commands/exits/times and diagnostics: logs/baseline-*, logs/post-color-* and logs/postcolor-expanded-ui.txt. The unchanged ESLint warnings are the birthday-wheel ROW_HEIGHT dependency and unused health useState import. Existing push-token and color-environment tooling warnings remain; sampled native monitors show no new issue class, not universal warning-free certification. Native APK source revision is unknown. Native iOS/physical devices were not run; iOS preservation is source-based and outside this plan's current gate.

## Remaining gates and exact next steps

1. **A09:** the active account has zero saved members. With an existing approved development member, open Edit through Emergency Info and /drrm in the3 configurations; exercise focus, typing/touch paste/caret, actions and reopen. Open Remove confirmation then Keep Member; do not Update or Confirm Remove. Controlled save-error/busy geometry also remains pending.
2. **Birthday wheel:** the actual caller is Valid ID review, not Profile's calendar. Code uploads the ID photo before enabling review. Use an owner-prepared, authorized review state; open Birth Date, scroll/select/dismiss/reopen without submitting ID evidence. No upload or state/auth bypass was used to manufacture access.
3. **A10/B32:** native duplicate/limit-error growth and rejected-reauthentication/busy geometry need approved controlled development states. Browser guard/error coverage passes, but is not native geometry evidence. Do not create preference records or submit a nonempty deletion password to manufacture these states.

## Method, failed attempts and cleanup

The required Git/ripgrep/Reader/scoped cached Repomix1.18.1/XML/original-source workflow is indexed in [context-index.md](context-index.md). [Expo57](https://docs.expo.dev/versions/v57.0.0/) and [RN0.86 ScrollView](https://reactnative.dev/docs/0.86/scrollview) confirm the existing bounded-scroll mechanism. No repository-rule conflict.

Initial missing8081 reverse, inspector-handshake, route-reset, UI-capture and navigation failures remain setup failures, not layout observations. The gesture case initially returned to Android Home; moving the swipe start away from the bottom resolved it without repeating the2 passing configurations. Compact Edit edge gestures were rejected with INJECT_EVENTS errors; normal Windows pointer control and later content-area gestures succeeded without changing guards. Windows type_text did not insert text; visible Gboard Q input was verified instead. Earlier clipboard shortcuts/separated attempts failed; only uninterrupted screenshot-matched Cut/Paste with exact synthetic-value assertions count. Raw account/UI captures stay in ignored local tmp.

Final cleanup is verified in resume-final-cleanup.json: Profile Save Changes disabled, Home visible, IME hidden;1080×1920/480dpi/font1.0/navigation0 and all navigation overlays restored. Camera grant and flags exactly match their original values after the denied-picker smoke. All local test drafts were discarded. No native profile/household/preference save, ID upload, nonempty deletion submission, commit, push, deployment or remote service configuration change occurred.
