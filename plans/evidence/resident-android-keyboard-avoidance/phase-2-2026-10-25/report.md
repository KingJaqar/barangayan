# Phase 2 execution results

25 October 2026, Asia/Manila. **Partially complete: four reproduced form-owner failures are repaired; full native acceptance remains pending.** No later phase was implemented. No dependency, configuration, database, authentication or domain-action logic changed. No commit, push, deployment, OTP/email send, ID/attachment upload, profile/password save, family save, request submission or payment was performed.

## Changed behavior

| Requirement | Owner / change | Direct evidence |
|---|---|---|
| W3 Profile | Replace page root with Android-only height KAV, retaining iOS View; bound header/body/Save once. Keep separate native sheets outside that owner. | C03–C11 observed; first visible field does not jump, validation growth and lower fields remain usable, three dismissal cycles restore body/footer. Occupation present/absent tested through temporary local employment selection and restored with Save disabled. C12 remains locked in this account. |
| W4 password management | Existing wrapper selects height only on Android; iOS padding and other platforms unchanged. | B17–B19 measured in the active Manage existing/unknown-history branch; New Password's before overlap repaired, confirmation focus/typing/eye toggle and three cycles pass. No credentials submitted. Explicit known-password mode still needs its real account case. |
| W1 Valid ID | Replace the form root with one local Android height owner including its existing header; preserve shared StepFlowScreen and recovery behavior. | B21 Other input before overlap repaired; typing/clearing and three restoration cycles pass. B22–B24 review cannot be certified without a development photo/upload flow. No photo uploaded. |
| W5 charter | Set the existing wrapper's Android branch to height, retaining its scroll ref, field-layout tracking, fixed footer, validation and draft state. | Business Name before overlap repaired; B26/B27/B31 focus/typing and three cycles each pass in business form. Remaining purpose/CTC/legacy/page-count consumers are unresolved. |
| W2 setup/details/password | No speculative keyboard edits. Preserve shared forms, readonly fields, drafts, skip/back and Google/security gates. | Real Complete Profile visit failed with “Unable to load your current profile or registration locality. Check your connection and retry.” No inputs were made editable to bypass this error. Browser first-password gate/cancellation assertions pass; native required/optional setup remains unverified. |

Physical-pixel comparisons and capture identities are in [native-results.json](native-results.json). MuMuPlayer API32, 1080×1920, 480dpi, default font, Gboard, effective adjustResize; unchanged installed development APK identity is in environment.json. Native APK source revision is unknown; versionCode1/minSdk24/targetSdk36 is the installed binary, not normal source config versionCode6 or a newly built release APK.

The selected phase contains **45 definitions**. [ledger.md](ledger.md) and ledger.json retain **497 device/consumer rows** from Phase 0; **16 definitions** have measured candidate subsets, **zero** have complete per-field/release-matrix acceptance. No unexecuted row is a pass, no unrelated Phase 0/other-phase row was rewritten.

## Checks and failures

| Check | Result |
|---|---|
| Installed TypeScript, baseline and final | Pass, exit0, no diagnostics |
| Installed ESLint application src, baseline and final | Pass, exit0, no diagnostics |
| Broad ESLint baseline | Pre-existing failure:62 errors/4 warnings in generated router types, scripts and UI test fixtures; source files pass. No suppressions or unrelated fixes added. |
| Library unit tests | Baseline and candidate335 tests/32 files pass with one worker. No final library bytes changed after candidate run. |
| Android JS/Hermes export, baseline and final | Pass, exit0; existing NO_COLOR/FORCE_COLOR tooling warning remains. This is not a native APK build. |
| Navigation baseline | 14/15 suites pass; Services-list fixture fails because “No payment required” matches two elements. Isolated diagnostic reproduces the strict-locator failure; retained log identifies both elements. |
| Settings/Profile browser | Pass; account theme/accent/font, profile/member draft/save/validation and preference regressions |
| Affected ID/email/password browser | Pass6 groups on final source, including ID steps/picker/camera adapters, OTP retention, password security/rapid-write and first-password cancellation |
| Document forms / request presentation browser | Pass5 /6 groups; purpose/business/CTC/legacy fields, validation, drafts, cancel/error/submission guards and account styling across widths |
| Full verification browser | Pre-existing location-case timeout at “Detect Your Location”; repeated with the four baseline source snapshots substituted, same failure. Affected ID/email/password assertions pass separately. |
| Native source identity after clean reload | Pass29/29 loaded module factories and source-map originals match final source |
| Native regressions | Header editor explicitly focused and visible; family SettingsSheet3 cycles, empty field/Add disabled, Profile Save disabled. No member added. |
| Native console | Existing “Failed to get Expo push token” warning recurs through app reloads (unchanged push-notifications.ts:82). No new sampled keyboard-related warning/error/exception class. A global warning-free/full-flow result is not claimed. |
| Owned diff / user-source preservation | Four product files only; existing Maps/Centers/UI-test edits and other non-owned inputs hash-identical to baseline. git diff --check passed. |

Browser assertions use synthetic native/device/network adapters. They do not prove Android caret, iOS, camera/backend delivery or release behavior. Full logs and exact results are retained under logs/ and verification.json. Native raw screenshots/account UI remain in ignored local tmp/resident-keyboard-phase2-20261025/native; only bounds/identities are in context packets and ledger exports.

## Decisions and discrepancies

The initial ID candidate enabled height inside StepFlowScreen. Its viewport ended240px below the IME because that nested surface's origin excludes the separate header. Re-read RN0.86 KAV frame/offset implementation and actual header layout; replaced the whole local form root instead of adding a guessed offset or a new shared API. The failed candidate was not retained; StepFlowScreen is byte-identical to baseline. A measured local root fixes B21 and leaves recovery unchanged.

A native Occupation harness initially assumed a top scroll position and made scroll gestures while the IME was open, producing identifiable synthetic suffix text in Street. Stopped, compared against the clean draft, removed exactly that suffix, and verified Save disabled. The final test resets to top, verifies keyboard hidden before each gesture, then tests Occupation and restores Unemployed. UI dumps now use unique files and validate successful generation. Earlier failed harness attempts are not acceptance results.

The first header-search smoke assumed opening Search auto-focused the editor; actual UI showed an unfocused field. Source is unchanged; the corrected smoke explicitly focuses the observed editor. This is visibility-regression evidence, not a claim about automatic focus policy.

No repository-rule conflict. Root AGENTS is empty; CLAUDE references it. Current register code has both email/code steps despite historical OTP comments saying signup OTP was removed. Actual pickup route is services/payment/pickup/[requestId].tsx. The plan's overall pre-execution header/next-order prose is historical; only selected Phase 2 status/progress was updated as requested.

## Acceptance and exact remaining work

| Gate | Status |
|---|---|
| Smallest measured fixes, one height owner per surface, native resize unchanged | Met for four changed owners |
| Before overlap → candidate visible, already-visible no-jump, tested three-cycle restoration | Met for exercised subsets; all captures linked in native-results.json |
| Preserve guards, callbacks, timers, account styling, drafts and domain flows | Met at source and affected browser assertions; native untouched states remain pending |
| Every W1–W5 consumer / complete field protocol | Pending manual verification; every row has explicit result or gap |
| iOS native preservation and Android release configurations | Pending manual verification; no native iOS runtime, other API/device/font/navigation variants or physical phone qualified |

1. Use designated existing development accounts for signed-out login, both registration steps, recovery email/OTP/reset, matching pending email verification, required/optional setup, and Google-confirmed first password. Owner handles authentication/OTP delivery and makes the state available; do not create accounts, send mail or relax guards. Resolve the existing Complete Profile load failure before testing B09–B16; then test both account-setup branches and complete-profile with retained drafts/back/forward. Keep email/locality readonly.
2. In an approved development ID/photo environment, enter Other, provide the permitted synthetic front image and exercise review/manual details B22–B24, address growth/caret, errors and step Back. Do not publish an ID to prove visibility.
3. Use an existing development profile without configured locality for C12 fallback City; keep configured City locked. Repeat C03–C11 including selection/paste, phone IME, email warning growth, occupation toggle and lower-field focus switches.
4. On real charter forms choose an explanation-required purpose (B25), business and certified-copy branches (B26–B30), and notes for all three consumers. Exercise long multiline start/middle/end caret, newline insertion, focus with keyboard already open, and validation growth. Use an existing legacy catalog document for C13 and an existing page_count_required request for both C14 payment/pickup routes. No submission/payment is necessary.
5. Repeat each changed surface's full section9 protocol (including paste/selection, focus switch, open-keyboard scrolling/actions and3 dismissal/reopen cycles) on the minimum/deployed-edge/newest-supported Android matrix, compact/large-font/display, navigation/IME variants and a physical phone if available. Run native iOS short/long/step/password/Profile/sheet smoke. Update the affected ledger rows only after observation.

All unexecuted cases remain unresolved; absence of a test result is not evidence of a failure or a passing no-change decision. Phase 2 remains **Partially complete** until required native coverage is finished.
