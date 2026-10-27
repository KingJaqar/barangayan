# Phase 1 shared-mechanism qualification — complete

25 October 2026, Asia/Manila. **Complete using the plan's explicit no-shared-adaptation branch.** Native experiments demonstrate that the reproduced failures are local geometry problems. Native focus reveal works once the Profile body/footer and password Modal are bounded. No cross-surface focus helper, forwarded-ref API, global wrapper, keyboard mode change or dependency is justified by these cases.

This is a mechanism-selection result, not delivery of the permanent W3/W8 fixes or completion of all 59 fields. Both experimental source files were restored byte-for-byte. [Reviewable experiment patch](local-layout-experiments.patch) remains evidence for the later implementation phases; no later phase is marked implemented and no Phase 0 ledger row is promoted to fixed-pass.

## Measured comparisons

Physical-pixel window coordinates; 480 dpi means 3 px/dp. The resident and independent Modal windows report adjustResize but their uncorrected measured content still extends behind the IME. A local Android height owner, using existing React Native KeyboardAvoidingView, corrected the container; native scrolling then revealed the editor. No keyboardVerticalOffset or keyboard-sized scroll padding was added.

| Representative | Baseline | Temporary local candidate | Result |
|---|---|---|---|
| Profile C05 Last Name | Editor 1328–1412; body 264–1677; keyboard top 1167; Save 1716–1872 | Editor 840–924; body 264–924; Save 963–1119; keyboard top 1167 | Editor/body/actions unobscured; native focus reveal works after bounds repair |
| Profile C11 Street | Phase 0 reproduced170 dp overlap | Editor 840–924 above the same fixed body/footer | Lower-field representative revealed without a custom focus coordinator |
| Profile C03 already-visible First Name / C04 switch | Candidate First Name 372–456 before focus | Same 372–456 after focus; Middle Name 606–690 after direct open-keyboard switch | No needless movement of an already-visible field |
| Delete Account B32, secure keyboard | Editor 975–1119; keyboard top 1080;39 px overlap; actions also covered | Editor 538–682; actions 754–912; body 0–1080 | Existing local wrapper's Android height behavior supplies enough usable space |
| B32 password shown, taller usable region | Secure/plain keyboard variants differ | Editor 599–743; actions 815–973; keyboard top 1167; body 0–1167 | Existing password refocus/callback path remains usable across the IME change |

The Profile editor fits to the measured body boundary; the extra visual-clearance target, selection/paste/caret details and all field-specific states remain W3 acceptance work. These are scoped geometry qualifications, not full per-field native passes.

## Native assertions actually executed

- Profile: repeated the current Last Name baseline failure; qualified C04/C05/C11 representatives, C03 visible-field no-jump, direct focus switching with the keyboard open, real name-validation growth from one synthetic character, removal of that character, disabled Save Changes, three open/dismiss cycles, and exact body/footer restoration. Meaningful scroll was retained rather than reset to the top.
- Password Modal: repeated its 39 px baseline overlap on the requalified emulator; qualified field and action visibility, synthetic long typing, Show/Hide password with focus/IME present in observed states, complete text removal, three open/dismiss cycles, original geometry restoration, Cancel and close/reopen with an empty editor. Final Delete was never submitted.
- Restored source: all 29 checked loaded factories/source-map originals match the working copy. Unchanged C15 header search remained visible and closed normally; unchanged A08 family SettingsSheet passed three geometry cycles with no name entered/Add Member disabled. Profile Save Changes was disabled afterward. Final Home and IME-hidden state are captured.
- Console event metadata was unchanged during each monitored flow: two historical buffered warnings in the Profile run and one in each restarted-device flow; no new sampled warning/error/exception. This is not a warning-free/full-app monitoring claim.

Raw images/UI dumps stay in task-local tmp/resident-keyboard-phase1-native-20261024/native because they contain account context. Published [results](results.json) contain bounds and assertions rather than account field values. No profile/member/preference/deletion/payment or other domain submission occurred.

## Environment and source qualification

MuMuPlayer API 32/Android 12,1080×1920 px,480 dpi, font 1.0, Gboard 18.5.4.993608717-release-arm64-v8a. Settings show software IME with hardware input enabled. Navigation setting0 is observed; it is not a verified gesture/three-button variant. The bridge/device rebooted between the Profile and resumed Modal experiments; both capture sets retain their timestamps/serials, and the current MuMu packages/boot/target were requalified. They do not supply two release-device matrix entries.

Current development APK SHA256: 9828659e5c4a24ddbd097fcbed7ab7b5ba185e6dd01242b912e9933420726f21, versionCode 1/minSdk 24/targetSdk 36, installation15 October 2026. Native source revision is unknown. [Environment](environment.json) and [final loaded-source identity](final-source-identity.json) qualify development comparisons, not a release APK or the missing minimum/deployed-edge/newest-supported matrix.

## Checks and phase boundary

Typecheck and installed ESLint passed before experimentation. The initial parallel unit runner failed VirtualAlloc; the diagnosed single-worker rerun passed 335 tests in 32 files. Both candidate files then passed typecheck and scoped lint. Logs are linked from the parent verification.json. The earlier Android JS/Hermes export passed on the same restored source, with its pre-existing color-environment warning; no new APK/export is claimed.

Both prototypes are removed from runtime source, leaving application/config/dependency identities and the four pre-existing user Maps/Centers/UI-fixture diffs unchanged. No shared component changed in the final deliverable, so native iOS smoke is not a Phase 1 retained-code gate; no iOS runtime result is claimed. Apply and fully verify the permanent local corrections in W3/Phase 2 and W8/Phase 3, including iOS/shared-presentation regressions when those changes are retained. Full field/route and release-device acceptance remains in the later phases. Reopen the optional helper decision only if a later reproduced failure survives correct local bounds and demonstrates missing shared focus coordination.

Documentation checked for the mechanism: [Expo v57 app configuration](https://docs.expo.dev/versions/v57.0.0/config/app/#softwarekeyboardlayoutmode), [React Native 0.86 KeyboardAvoidingView](https://reactnative.dev/docs/0.86/keyboardavoidingview), [ScrollView](https://reactnative.dev/docs/0.86/scrollview) and [Keyboard](https://reactnative.dev/docs/0.86/keyboard).
