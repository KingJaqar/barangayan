# Phase 0 execution evidence — 18 October 2026 (Asia/Manila)

Status: **Complete for Phase 0 baseline/evidence acceptance, with the explicitly deferred limitations below.** The owner confirmed the current MuMu session is disposable and subsequently authorized autonomous native testing. Phase 1 has not started. This records execution, not another redesign proposal.

## Scope, instructions and ownership

Read the root `AGENTS.md` and `CLAUDE.md`, all three required planning documents, the existing capture index, relevant Android primitives/layouts/configuration and retained v32 component source. Repository discovery found no additional instructions under Android, shared or plans, and no ancestor instruction files. Web/admin instructions do not apply because those apps are untouched.

The current execution request supersedes the main plan's historical “planning only / do not begin” wording **for Phase 0 only**. The owner’s later instruction to run these tests autonomously supersedes section 8’s manual-only native-interaction restriction for the bounded reversible Phase 0 checks. No repository-instruction conflict requires a code change. The cancelled Phase 8 in the Major Web/Android plan remains cancelled; its historical standards were not adopted. No other redesign phase is authorized by this execution record.

Owned tracked hunk: only the Phase 0 execution-status subsection added to the [main plan](../../../Resident_Android_MagicPatterns_Redesign_Implementation_Plan.md). Owned new files: this evidence directory and the two export output directories beneath `tmp/magicpatterns-phase-0-20261018/`. Keep every pre-existing application file, reference artifact and unrelated untracked output. No deletion, dependency change, migration, backend change, commit, push, deployment or external write occurred.

Baseline HEAD: `80c2cb9b4695744e0e15ff98a31864507cb95dfc`. At orientation the only tracked modifications were the three user-edited planning documents; Android/shared source and package files were clean. The full untracked inventory contains extensive earlier verification output. It was preserved, not cleaned or stashed.

Recoverable baseline:

- [HEAD](before/head.txt), [full initial inventory](before/status.txt), [pre-existing unstaged patch](before/pre-existing.patch), [staged patch](before/pre-existing-staged.patch), [source/manifest hashes](before/source-hashes.json).
- Byte-for-byte copies of the three pre-existing planning documents in `before/`. Their existing modifications belong to the user. The inventory includes this run's bootstrap evidence entries; exclude this owned directory when interpreting pre-existing work.
- [Owned phase patch](phase-0-owned.patch) is generated against the saved working copy, not against HEAD. Reverse only its added subsection after checking for subsequent overlapping edits. Do not restore the whole plan from HEAD or from the snapshot if later user edits exist.

## Requirement comparison

| Phase 0 requirement | At orientation | Execution result |
|---|---|---|
| Read instructions, context and phase/dependency requirements | Not started in this session | Done. Phase 0 has no implementation-phase prerequisites. Later packets' code is deliberately unchanged. |
| HEAD, tracked/untracked inventory, owned hashes/diffs and reversal | Not started | Done; artifacts above. Three existing plan modifications preserved. |
| Confirm live reference version/artifact/viewport | Partially done in earlier planning | Done again in Brave: v32; same artifact; 1666 × 865 CSS px; DPR 1.5; reduced-motion media query false. |
| Every screen/state has an evidence status | Partially done in inspection record | Done as an inventory: [39-entry matrix and named state gaps](screen-state-evidence.md), plus [M01–M16 status](motion-status.md). An inventory status does not mean the state passed. |
| Missing reference variants needed by next packet | Partially done | Added sheet entry/cancel, confirmation entry/cancel, font selection and too-light field/disabled-button evidence. Reduced motion, held-press timing and rapid interruption remain deferred. |
| Current MuMu before-state and metadata | Not started | Done: Services, Settings, form, purpose sheet, cancel-only format dialog, separate native guest and SDK 57 development runtime evidence below. Native timing/performance and later states remain explicitly deferred. |
| Guest and safe signed-in fixtures | Not started | Done: owner-confirmed disposable development session preserved; separate installed Expo Go SDK 57 session reached guest Home, Documents-only Services and Log In to Request gate without credentials or sign-out. |
| Baseline lint/type/unit/contracts/export | Not started | Done; results below. No baseline failures hidden. |

## Baseline checks actually executed

Node `24.13.1`, npm `11.8.0`. [Installed versions](installed-versions.json): Expo `57.0.10`, Router `57.0.10`, RN `0.86.2`, React `19.2.3`, Reanimated `4.5.1`, Worklets `0.10.1`, TypeScript `6.0.3`, Vitest `3.2.7`.

| Check and working directory | Exact invocation | Result |
|---|---|---|
| Android lint; repository root | `npm run lint --workspace=@barangayan/mobile` | **PASS**, exit 0; **six pre-existing warnings**, zero errors. [Log](checks/lint.log). |
| Android types; Android app directory | `../../node_modules/.bin/tsc.cmd --noEmit` | **PASS**, exit 0; no diagnostics. [Log](checks/typecheck.log). |
| Android unit suite; Android app directory | `../../node_modules/.bin/vitest.cmd run` | **PASS**, exit 0; 17 files / 169 tests. [Log](checks/unit.log). |
| Shared contracts; shared package directory | `npm test` | **PASS**, exit 0; 34 files / 527 tests. [Log](checks/shared.log). |
| Android export; Android app directory; sandbox | `../../node_modules/.bin/expo.cmd export --platform android --output-dir ../../tmp/magicpatterns-phase-0-20261018/android-export` | **Environment failure**, exit 1: Hermes could not write temporary `index.hbc` (permission denied, compiler exit 6). Source bundled; this was not accepted as an export pass. [Log](checks/export.log). |
| Android export; same directory; outside sandbox after approval | `../../node_modules/.bin/expo.cmd export --platform android --output-dir ../../tmp/magicpatterns-phase-0-20261018/android-export-permitted` | **PASS**, exit 0; 2,533 modules, 8.1 MB Hermes bundle, 3.3 KB metadata. [Log](checks/export-permitted.log). This is a bundle, not an installed-native-build qualification. |

All check processes set `CI=1`; no automatic fixes were requested. The export retry changed the permission context and owned output path after diagnosing the write failure; it did not repeat the failed command unchanged or modify the app. Successful export also emitted existing Node `NO_COLOR`/`FORCE_COLOR` environment warnings. The failed sandbox export included Hermes global-declaration diagnostics; its full log is retained.

Lint warnings: duplicate shared imports in `health/register.tsx` (lines 2, 33), `services/payment/qrph/[requestId].tsx` (lines 1, 2), and `services/requests/[requestId].tsx` (lines 1, 3). These are out of scope for this evidence-only phase.

No app code changed after these checks. Final verification checks the owned Markdown links/evidence, initial versus final source hashes, support-document byte preservation and owned diff. Repeating unchanged application suites/export would not add runtime or native evidence; the baseline results remain applicable to the byte-identical source. See [verification results](verification.json).

Read the exact [Expo v57 SDK reference](https://docs.expo.dev/versions/v57.0.0/), [v57 Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/), [v57 Reanimated](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/), [v57 app configuration](https://docs.expo.dev/versions/v57.0.0/config/app/) and [Expo CLI](https://docs.expo.dev/more/expo-cli/) for the baseline commands/configuration. The current v57 Router docs recommend a newer patch than the installed `57.0.10`; no upgrade was made. Manifest ranges and installed versions are distinguished above.

## Reference evidence obtained in this execution

Brave editor remains **v32**, Internal Preview artifact `df178e1c-7b6e-4d98-8334-06f3a00f28c3`. Saved [editor state](reference/editor-state.txt) and [identity screenshot](reference/editor-v32.jpg). A separate disposable preview tab was used and closed afterward; the user's editor was not edited.

Five sequences contain **120 raw viewport JPEGs**, request/response timestamps and settled DOM states. See [capture summary](reference/capture-summary.json). Source duration/easing declarations remain targets; sample intervals are not rendering FPS, input-dispatch times, exact animation durations or proof of smoothness. No high-rate video/profiler or reduced-motion playback was collected.

| Sequence | IDs / actual outcome |
|---|---|
| [01 custom-color open](reference/01-custom-color-open/capture.json) | M04/M12: color sheet reached with Shade, Hue, hex input, Cancel and Save. [Settled view](reference/custom-color-open.jpg). |
| [02 custom-color cancel](reference/02-custom-color-cancel/capture.json) | M04: dismissed without saving; Settings restored. |
| [03 confirmation open](reference/03-logout-dialog-open/capture.json) | M05/M12: “Log out?” dialog reached in the synthetic preview. [Settled view](reference/logout-dialog-open.jpg). Confirmation was never pressed. |
| [04 confirmation cancel](reference/04-logout-dialog-cancel/capture.json) | M05/M12: Cancel removed the dialog. No account operation occurred. |
| [05 font selection](reference/05-font-inter-select/capture.json) | M12: Inter became pressed/selected; System Default was restored and verified afterward. This does not qualify a held press/scale animation. |

An initial Add-color click scrolled the shelf and focused the right chevron rather than opening the sheet. The settled screenshot exposed the plus control; the following observed click opened it. This is recorded as a prototype interaction/capture limitation, not copied as a native requirement.

Additional [too-light color view](reference/custom-color-too-light.jpg) / [state](reference/custom-color-too-light.txt): entering synthetic `#FFFFFF` displayed the warning and disabled Save Color. Cancel was used; the default accent and default font remained selected in the [final state](reference/final-settings-state.txt). Preserve the plan's explicit native adaptation: do **not** impose this prototype rejection rule on currently accepted resident colors. No new reference/native visual contradiction changed the motion specification. [Captured console output](reference/console.json) contained no warnings/errors; this covers this preview session only.

## MuMu before-state and its limits

MuMu CLI `6.3.1.0`, instance 0, Android 12 / API 32, confirmed ADB endpoint **`127.0.0.1:16384`**. Initial generic ADB discovery returned only offline `emulator-5554`; MuMu's read-only instance API supplied the actual endpoint. ADB initially could not start inside the sandbox, then connected outside it. No unrelated emulator was targeted.

- Physical size 1080 × 1920; density 480 dpi (scale 3): nominal **360 × 640 dp**, before system/content insets. Navigation-mode setting `0`; OS configuration reports night mode while the captured app uses light surfaces. Resident appearance/font preference values were not changed. Settings screenshots show Light and System Default selected; the color picker displays the existing default `#0F6E5B`.
- Display dump reports active **15.000001 Hz** mode (60 Hz also supported). Window and transition animation scales read `0.5`; animator duration scale and stored font-scale key read `null` (unset; effective animator value not inferred). The [effective activity configuration](native/effective-configuration.txt) reports font scale 1.0, w360dp/h616dp. [Display](native/display.txt), [instance](native/mumu-instance.json), [fingerprint](native/build-fingerprint.txt).
- Package **`com.barangayan.resident.dev`**, versionName `1.0.0`, versionCode `1`, target SDK 36, installed 15 October 2026. Normal `app.json` specifies `com.barangayan.resident` versionCode 5; existing opt-in `app.config.js` explains the separate development package, with runtime/development-server qualification below. No new APK was built or installed. [Package metadata](native/package.txt).
- [Current before-state screenshot](native/initial-screen.png): Services → Requests → Active → All, real request rows and existing bottom bar. It establishes the displayed running state. The SDK 57 developer menu, connected runtime and local manifest subsequently establish this checkout’s development server; the successful **production export was not installed or loaded**. No production-build, fidelity or performance pass is claimed.
- [Graphics counters](native/gfxinfo.txt) are cumulative (98,034 historical frames), not an isolated warm-up/ten-transition run. Reported legacy jank is 7.08%; emulator GPU histogram data is not meaningful as a measured animation profile here. Do not attribute this history to the present task or certify performance from it.
- [Filtered warning/error log](native/logcat-warnings-errors.txt): command exited 0 and returned zero lines for the requested recent/tag-filtered window. This does not prove absence of earlier, other-tag or unexercised-flow errors. Logs were not cleared and counters were not reset.

## Native execution completion and fixture results

The owner manually opened Settings and completed a recorded walkthrough, then asked the agent to run these tests autonomously. That direct instruction supersedes the plan’s manual-only restriction for these checks. Subsequent ADB taps/Back/scrolling were based on freshly inspected screenshots and saved UI hierarchy; no Windows app automation was used for Android input. The signed-in account, app data, permissions, saved appearance and records were preserved.

A navigation action was temporarily **not executed** because automatic approval review hit a usage limit. This was a review-service failure, not an unsafe-action determination. After the owner asked to continue, a fresh approved read established that the restriction had cleared. The restarted ADB daemon had lost its connection; the confirmed MuMu endpoint was re-read/reconnected. The failed `resumed-state` observation directory contains no successful capture and is not evidence of a tested screen.

### Build/server identity

- [Developer menu](native/developer-menu/screen.png) reports `exposdk:57.0.0` in the running native development package.
- [Local Metro manifest](native/local-metro-manifest.json): HTTP 200, SDK 57 runtime, Hermes Android bundle URL and project root `C:/Users/User/barangayan/apps/resident-android-mobile` on port 8081. Only non-secret identity fields were retained.
- [Connected runtime](native/metro-connected-runtimes.json): `com.barangayan.resident.dev` on the API 32 MuMu model is attached to that local Metro server. This qualifies the **development baseline**, not a new installed production build or cryptographic APK/bundle equivalence claim.

### Native states actually reached

[State assertions](native-results.json) verify 13 expected labels/presence/absence outcomes against retained UI dumps; screenshots were also visually inspected. These are evidence assertions, not added production test cases.

| Fixture / action | Actual result and retained evidence |
|---|---|
| Signed-in list | [Services/Documents](native/services-resumed/screen.png) and initial Requests/Active/All captured. Four catalog services in this signed-in fixture. |
| Guide and form entry | [Indigency guide](native/indigency-guide/screen.png), [form top](native/request-form-top/screen.png) and [scrolled purpose](native/request-form-purpose/screen.png) reached. Submit was never pressed; empty purpose is allowed to reach existing boundary validation on deliberate Submit, so the visible button is not labelled a disabled-state pass. |
| Purpose overlay / Android Back | [Sheet open](native/purpose-sheet-open/screen.png) exposes all current options. [Back dismisses](native/purpose-sheet-back/screen.png) with “Choose a purpose” unchanged and form/scroll context retained; no option or request was saved. [Form Back](native/form-back-to-guide/screen.png) and [guide Back](native/guide-back-to-services/screen.png) return correctly. |
| Settings and color cancellation | [Settings](native/settings-before.png), [appearance controls](native/settings-preferences/screen.png), [color picker](native/color-open/screen.png), [Cancel return](native/color-cancelled/screen.png) captured. No swatch/font/theme was changed or saved. |
| Native dialog / Cancel | Source confirmed opening the export-format chooser performs no export request. [Format dialog](native/format-dialog-open/screen.png) opened; [Cancel](native/format-dialog-cancelled/screen.png) returned to Settings. No PDF/JSON format, Delete or Logout action was selected. This is the existing OS-dialog adaptation, not a match to prototype M05 timing/shape. |
| Separate guest fixture | Existing `host.exp.exponent` SDK 57.0.9/code 445 loaded this checkout through `exp://127.0.0.1:8081`. After cold loading and its informational developer tutorial, [signed-out entry](native/signed-out-entry/screen.png) → Browse as guest → [guest Home](native/guest-home/screen.png) → [Documents-only Services](native/guest-services/screen.png) → [settled Log In to Request gate](native/guest-guide-settled/screen.png). No credentials/login/account creation. This is a native guest fixture with Expo Go integration limits, not a replacement for the main development client. |
| Signed-in preservation | [Development session after guest inspection](native/signed-in-after-guest/screen.png) still displays its verified-ID Services state. Final main-app state is Settings, with no modal, Light/System Default still visible. |

Guest and signed-in catalog counts differ (five versus four); the existing DocumentsList reads the active RLS-scoped catalog. No query/policy was changed, and cross-identity data equivalence was not established. Do not treat these unequal fixture contents as an exact screenshot pair or infer a new bug. The guest guide briefly showed Expo Go’s Refreshing overlay; the settled capture excludes it. Expo Go’s floating developer gear is tool chrome, not product UI.

The manual recording showed Settings/Profile/form/guide states and a prolonged “Checking your password status…” state. The same checking text was visible in the original Settings baseline before any application change; account-status correctness remains an out-of-scope baseline issue. No fix, account mutation or claim that password loading passed is included.

### Recordings, decoded media and timing limits

- [Manual native recording](native/manual-baseline.mp4), [contact sheet](native/manual-contact-sheet.jpg), [recorder log](native/manual-recording.log): 150-second recorder window, 745 encoded frames; media container duration reported 126.83 seconds and ~5.87 average fps. Original timestamps are retained; this discrepancy and variable updates prevent exact runtime-duration/smoothness claims.
- [Automated native color open/cancel recording](native/automated-color-baseline.mp4), [log](native/automated-color-recording.log): 45-second window, only 21 frames. This sparse capture is retained as before-state evidence, not timing qualification.
- Both videos decoded successfully with existing ShareX FFmpeg (no installation/dependency). The first decode used default output timebase and emitted non-monotonic DTS conversion warnings; a corrected passthrough decode at 1/90000 timebase exited 0 with empty [manual](native/video-decode-passthrough.log) and [color](native/color-video-decode.log) logs. No app change was used to suppress warnings. All 161 saved JPEG/PNG images were verified with the bundled Pillow library; later derived static previews are included in the final media audit.
- Reference capture is still 120 sampled JPEGs at ~14.29–15.75 samples/sec, not browser rendering FPS. Normal-speed/high-rate/native duration, reduced-motion playback, interruption stress, internal profiler/frame-budget, TalkBack and physical-device qualification remain **deferred to the owning implementation packets**. Source values stay targets; no “smooth,” “pixel exact,” 60 Hz or production-ready claim is made.

Temporary ADB reverse `tcp:8081` was added solely for isolated Expo Go loading and removed afterward; [final mapping inventory](native/final-reverse.txt) matches the initially empty inventory. No main-app data was cleared, no package was installed/uninstalled and no emulator setting/permission changed. Remote recording/UI-dump evidence remains at the exact owned `/sdcard/phase0-…` paths; no user data was deleted. Filtered log windows returned no lines, including the [final window](native/final-filtered-log.txt); limited tags/window coverage does not certify all runtime/console paths.

## Phase 0 acceptance and handoff

| Acceptance criterion | Status / evidence |
|---|---|
| Existing work recoverably identified without reset/stash | **Met.** Full inventory, working-copy snapshots, patches/hashes, insertion-only owned patch and dry-run reversal. |
| Every screen/state has an evidence status | **Met.** [39-entry/state inventory](screen-state-evidence.md), [16-ID motion status](motion-status.md), explicit current native observations and untested variations. |
| Unavailable visual/integration states explicitly blocked or deferred | **Met.** Reduced motion/high-rate/profiler, full theme/font/size matrix and account/payment/stock/permission/provider states remain unverified in the owning packets. |
| No later pixel/motion fidelity claim without matching reference | **Met.** v32 identity retained; new core-state captures supplement prior evidence; native fidelity and smoothness are not certified. |
| Baseline checks and next-packet native/fixture evidence | **Met for baseline scope.** Lint/types/169 Android tests/527 shared tests/export recorded; representative list/form/sheet/dialog, preserved disposable signed-in session and separate guest fixture reached. |

**Phase status: Complete for Phase 0.** Later implementation acceptance remains outstanding; this completion does not mark any of the 39 native redesigns or M01–M16 animations implemented. Phase 1 has not begun. There is no remaining user-input blocker for this phase.

**Remaining / out of scope:** six baseline lint warnings; Node color-environment warnings; pre-existing account/password status loading; unequal guest/signed-in catalog data; missing high-rate/reduced-motion/profiler and integration qualification. Keep these explicit when the relevant phase changes those surfaces. Exact future manual/device/provider steps are listed in the main plan/specification; no remote writes, commits, pushes, deployments, migrations or consequential actions were performed.
