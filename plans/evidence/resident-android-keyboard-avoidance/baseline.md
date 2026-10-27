# Resident Android keyboard baseline — Phase 0

24 October 2026 (Asia/Manila). Source HEAD: `d9253f0d42934133143d3b67955a4f987504914d`. **Phase 0 baseline/gap checkpoint complete; native field acceptance remains pending.** The user resumed native validation with MuMuPlayer as the primary environment. Earlier pending-only results are historical. No application edits were made; W3/W8 future fix candidates are tied to the native failures below.

59 definitions (10 A, 32 B, 17 C), 791 explicit ID × consumer/branch × device/configuration rows, initially 791 pending, **0 native field passes**. The continuation below supersedes the initial zero-failure result with eight reproduced cases. A/B/C describe source structure only. Rows without continuation evidence remain reserved/unexecuted; only linked continuation rows carry native observations. The original 791 planned rows now distinguish 770 editable cases and 21 noneditable list-state regressions; definition count remains 59. The initial 274-file scan matched the audit; concurrent source deltas and the current running modules were verified separately. [Machine ledger](phase-0-2026-10-24/ledger.json), [source inventory](phase-0-2026-10-24/inventory.json), [context/workflow](phase-0-2026-10-24/context-index.md).

Concurrent work detected after baseline checks: Maps/Centers and their two UI fixtures changed outside Phase 0. The native input definitions are unchanged; current C16/C17 source locations are 249/427. [Recorded delta](phase-0-2026-10-24/concurrent-manifest.json) preserves ownership and hashes. Initial app checks described earlier source. Current-source typecheck, lint, 335 tests and 29 loaded native-module factory/source identities now qualify the recorded continuation; full protocol and release acceptance remain pending.

## MuMuPlayer native continuation — 24 October 2026

MuMuPlayer is now the primary native testing environment at the user's direction. The earlier launcher-only/unavailable narrative below is historical. The resident MainActivity is active with adjustResize and Gboard visible. Nineteen editable ID/consumer cases across 19 definitions were observed on API 32: **8 reproduced initial-focus bounds failures, 11 limited visible observations,0 full-protocol passes**. All unexecuted protocol steps and other matrix/consumer cases remain pending. [Native report](phase-0-2026-10-24/mumu-2026-10-24/report.md), [measured results](phase-0-2026-10-24/mumu-2026-10-24/native-results.json).

Reproduced cases: C04–C06/C08–C11 (W3 Profile), B32 (W8 Delete Account). No application fix has been made. Existing report and family/color avoidance has positive sampled behavior; this does not close full protocol/device acceptance. Native/console samples and current-source type/lint/unit checks are retained in the continuation report.

## Initial build/device qualification (historical)

- Current resolved resident identity: com.barangayan.resident, version 1.0.0, versionCode 6; Expo 57.0.10, React Native 0.86.2, React 19.2.3, Router installed 57.0.10. Config has no explicit keyboard mode; installed Expo resolver returns adjustResize. [Resolution](phase-0-2026-10-24/resolved-config.json).
- Only connected device: emulator-5554 (SM_S918U reported model, not evidence of physical hardware), API 32/Android 12, 1080×1920 at 480 dpi, font 1.0, Sogou IME. The available installed package is com.barangayan.resident.dev 1.0.0/versionCode 1, minSdk 24, target/compileSdk 36, installed 15 October. APK SHA256: 9828659e5c4a24ddbd097fcbed7ab7b5ba185e6dd01242b912e9933420726f21. Native source revision is unknown.
- Installed MainActivity manifest has windowSoftInputMode=0x10 (adjustResize). Opening it reaches DevLauncherActivity; that launcher window uses adjustPan. **Launcher mode is not resident runtime mode.** Screenshot N0 confirms development launcher and a historical crash warning; it is not a crash reproduced against current source. No source-paired resident viewport, keyboard bounds, runtime system-bar or Modal behavior was measured. [Native identity](phase-0-2026-10-24/native-identity.json).
- Initial restricted localhost fetch failed. Attempt to start local Metro found 8081 already occupied; no process was stopped and no alternate server was started. Inspection of that existing server outside isolation was not executed: automatic approval review failed because of a usage-limit condition (not a safety determination). User then directed native/account cases to remain pending.
- SDK 57 documentation supports Android 7+/API24 and compile/target 36. Neither that target nor the older installed APK proves the product’s deployed or newest-supported OS policy. Effective edge-to-edge/insets must be observed in the actual resident activity and each native Modal.

## Coverage definitions and investigation owners

Owners below are **investigation pointers**, not proposed code changes. No mechanism, offset or wrapper has been selected without reproduction. W3/W8 now have native failure evidence in the continuation report; other proposed changes still require reproduction.

| ID | Editable definition | Work package | Current source / investigation owner |
|---|---|---|---|
| A01 | Title | W6 / Phase 4 | [source](../../../apps/resident-android-mobile/src/app/(app)/reports/new.tsx:459) |
| A02 | Description | W6 / Phase 4 | [source](../../../apps/resident-android-mobile/src/app/(app)/reports/new.tsx:460) |
| A03 | Specific area details | W6 / Phase 4 | [source](../../../apps/resident-android-mobile/src/app/(app)/reports/new.tsx:488) |
| A04 | Address | W6 / Phase 4 | [source](../../../apps/resident-android-mobile/src/components/reports/location-picker-modal.tsx:116) |
| A05 | Detected Address | W6 / Phase 4 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/location-verification.tsx:267) |
| A06 | Age | W7 / Phase 4 | [source](../../../apps/resident-android-mobile/src/app/(app)/health/register.tsx:556) |
| A07 | Previous dose date | W7 / Phase 4 | [source](../../../apps/resident-android-mobile/src/app/(app)/health/register.tsx:635) |
| A08 | Full name | W8 / Phase 3 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:476) |
| A09 | Full Name | W8 / Phase 3 | [source](../../../apps/resident-android-mobile/src/components/family-member-modal.tsx:60) |
| A10 | Hex color | W8 / Phase 3 | [source](../../../apps/resident-android-mobile/src/components/custom-accent-color-modal.tsx:55) |
| B01 | Email | W1 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(auth)/login.tsx:92) |
| B02 | Password | W1 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(auth)/login.tsx:103) |
| B03 | Email address | W1 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(auth)/register.tsx:107) |
| B04 | Confirmation code | W1 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(auth)/register.tsx:107) |
| B05 | Email address | W1 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(auth)/forgot-password.tsx:47) |
| B06 | 6-digit reset code | W1 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(auth)/otp.tsx:82) |
| B07 | New Password | W1 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(auth)/reset-password.tsx:71) |
| B08 | Confirm New Password | W1 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(auth)/reset-password.tsx:92) |
| B09 | First Name | W2 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/resident-details-form.tsx:274) |
| B10 | Last Name | W2 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/resident-details-form.tsx:284) |
| B11 | Middle Name (optional) | W2 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/resident-details-form.tsx:296) |
| B12 | Suffix (optional) | W2 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/resident-details-form.tsx:305) |
| B13 | Mobile Number | W2 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/resident-details-form.tsx:362) |
| B14 | House No. | W2 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/resident-details-form.tsx:385) |
| B15 | Street | W2 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/resident-details-form.tsx:395) |
| B16 | Occupation (optional) | W2 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/resident-details-form.tsx:436) |
| B17 | Current Password | W4 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/change-password.tsx:238) |
| B18 | New Password | W4 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/change-password.tsx:260) |
| B19 | Confirm New Password | W4 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/change-password.tsx:271) |
| B20 | Six-digit code | W1 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/email-verification.tsx:135) |
| B21 | Specify ID type | W1 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/valid-id.tsx:259) |
| B22 | Full name | W1 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/valid-id.tsx:285) |
| B23 | ID number (if shown) | W1 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/valid-id.tsx:285) |
| B24 | Address (if shown) | W1 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/valid-id.tsx:285) |
| B25 | Explain your purpose | W5 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/services/charter-request-form.tsx:419) |
| B26 | Business name | W5 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/services/charter-request-form.tsx:427) |
| B27 | Establishment address | W5 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/services/charter-request-form.tsx:428) |
| B28 | Record/document reference | W5 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/services/charter-request-form.tsx:459) |
| B29 | Number of copies | W5 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/services/charter-request-form.tsx:460) |
| B30 | Total pages across all copies | W5 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/services/charter-request-form.tsx:461) |
| B31 | Additional notes (optional) | W5 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/services/charter-request-form.tsx:479) |
| B32 | Password | W8 / Phase 3 | [source](../../../apps/resident-android-mobile/src/components/delete-account-modal.tsx:79) |
| C01 | Password | W2 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/resident-password-step.tsx:84) |
| C02 | Confirm Password | W2 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/resident-password-step.tsx:86) |
| C03 | First Name | W3 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1018) |
| C04 | Middle Name | W3 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1027) |
| C05 | Last Name | W3 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1035) |
| C06 | Suffix | W3 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1044) |
| C07 | Occupation | W3 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1084) |
| C08 | Email | W3 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1089) |
| C09 | Mobile Number | W3 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1099) |
| C10 | House No. | W3 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1112) |
| C11 | Street | W3 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1121) |
| C12 | City | W3 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1134) |
| C13 | Purpose of Request | W5 / Phase 2 | [source](../../../apps/resident-android-mobile/src/app/(app)/services/request/[documentId].tsx:211) |
| C14 | Total pages across all copies | W5 / Phase 2 | [source](../../../apps/resident-android-mobile/src/components/services/resident-payment-screen.tsx:171) |
| C15 | Search services, announcements and your records | W9 / Phase 5 | [source](../../../apps/resident-android-mobile/src/components/resident-header.tsx:138) |
| C16 | Search incidents | W9 / Phase 5 | [source](../../../apps/resident-android-mobile/src/app/(app)/maps/index.tsx:249) |
| C17 | Search evacuation centers | W9 / Phase 5 | [source](../../../apps/resident-android-mobile/src/components/evacuation-centers-panel.tsx:427) |

## Real consumers and conditional branches

Angle-bracket IDs are test-record slots, not fabricated routes or records. The source route definitions take documentId/requestId/driveId; no matching backend records were created. R codes identify actual route plus branch, so shared definitions are not treated as one tested screen.

| Consumer | Route | Required state | Test data group |
|---|---|---|---|
| R001 | `/reports/new` | Editable incident draft; title/description/area; errors and long text | T-report |
| R002 | `/reports/new` | Pin Your Location native Modal; address correction; geocode loading/error | T-report |
| R003 | `/settings/location-verification` | Signed in; details expanded; loaded and failed address detection | T-profile |
| R004 | `/health/register?driveId=<test-drive>` | Resident with unknown age; profileAge=null | T-health |
| R005 | `/health/register?driveId=<test-drive>` | Household member selected; profileAge=null | T-health |
| R006 | `/health/register?driveId=<test-vaccination-drive>` | Resident; vaccination; dose other than 1st Dose | T-health |
| R007 | `/health/register?driveId=<test-vaccination-drive>` | Household member; vaccination; dose other than 1st Dose | T-health |
| R008 | `/settings/profile` | Add Family Member native SettingsSheet | T-household |
| R009 | `/settings/profile` | Edit Family Member native SettingsSheet | T-household |
| R010 | `/home/emergency-info?tab=family` | Add Family Member native ScanFamilySheet; signed in | T-household |
| R011 | `/home/emergency-info?tab=family` | Edit Family Member native ScanFamilySheet; signed in | T-household |
| R012 | `/drrm?tab=family` | Add Family Member native ScanFamilySheet; signed in | T-household |
| R013 | `/drrm?tab=family` | Edit Family Member native ScanFamilySheet; signed in | T-household |
| R014 | `/settings` | Custom Accent Color native SettingsSheet; hex editing and invalid hex | T-local |
| R015 | `/(auth)/login` | Signed out; email/password; password toggle and validation growth | T-signed-out |
| R016 | `/(auth)/register` | Email step; not loading | T-registration |
| R017 | `/(auth)/register` | Confirmation-code step; not loading; numeric paste/autofill | T-registration |
| R018 | `/(auth)/forgot-password` | Signed out; not loading; email editable | T-recovery |
| R019 | `/(auth)/otp` | Recovery flow; existing email context; single native reset-code input | T-recovery |
| R020 | `/(auth)/reset-password` | Verified recovery session; new/confirm password; no update submission | T-recovery |
| R021 | `/account-setup` | Required details; ready; not loading/uncertain/conflicted | T-setup |
| R022 | `/account-setup` | Optional details; ready; not loading/uncertain/conflicted | T-setup |
| R023 | `/complete-profile` | Optional completion; ready; employment with/without occupation | T-setup |
| R024 | `/settings/change-password` | Existing password mode; not loading; existing-password form | T-existing-password |
| R025 | `/settings/email-verification` | Matching unverified email; pending verification; not loading | T-verification |
| R026 | `/settings/valid-id` | Step 1; ID type Other | T-id |
| R027 | `/settings/valid-id` | Step 3; manually entered details; local synthetic front image | T-id |
| R028 | `/settings/valid-id` | Step 3; extracted details with status/error growth | T-id |
| R029 | `/services/request/<test-documentId>` | Charter contract; purpose.requiresExplanation=true | T-service |
| R030 | `/services/request/<test-documentId>` | Charter serviceKind=business | T-service |
| R031 | `/services/request/<test-documentId>` | Charter serviceKind=certified_true_copy | T-service |
| R032 | `/services/request/<test-documentId>` | Additional notes; standard charter | T-service |
| R033 | `/services/request/<test-documentId>` | Additional notes; business | T-service |
| R034 | `/services/request/<test-documentId>` | Additional notes; certified_true_copy | T-service |
| R035 | `/settings` | Resident Delete Account password Modal; open only; NEVER confirm deletion | T-existing-password |
| R036 | `/account-setup` | Required first password; retain draft across details/back | T-setup |
| R037 | `/account-setup` | Optional first password; skip action changes body height | T-setup |
| R038 | `/settings/change-password` | First-password branch; fresh same-account Google confirmation | T-first-password |
| R039 | `/settings/profile` | Editable profile with configured locality; save-bar sibling | T-profile |
| R040 | `/settings/profile` | Employment status permits occupation; status-row growth | T-profile |
| R041 | `/settings/profile` | Fallback only: barangay_localities absent; configured City remains locked | T-fallback-locality |
| R042 | `/services/request/<test-documentId>` | Legacy fallback: catalogContract(doc) absent | T-service |
| R043 | `/services/payment/<test-requestId>` | page_count_required; status neither completed nor cancelled | T-page-count |
| R044 | `/services/payment/pickup/<test-requestId>` | Same request conditions; pickup prop changes parent flow | T-page-count |
| R045 | `/search` | Enter header search from /home; keyboard already open/closed; clear/Back/idle | T-search |
| R046 | `/explore` | Submit from /home; refocus submitted query; Back restores origin | T-search |
| R047 | `/search` | Enter header search from /services; keyboard already open/closed; clear/Back/idle | T-search |
| R048 | `/explore` | Submit from /services; refocus submitted query; Back restores origin | T-search |
| R049 | `/search` | Enter header search from /drrm; keyboard already open/closed; clear/Back/idle | T-search |
| R050 | `/explore` | Submit from /drrm; refocus submitted query; Back restores origin | T-search |
| R051 | `/search` | Enter header search from /home/emergency-info; keyboard already open/closed; clear/Back/idle | T-search |
| R052 | `/explore` | Submit from /home/emergency-info; refocus submitted query; Back restores origin | T-search |
| R053 | `/search` | Enter header search from /maps; keyboard already open/closed; clear/Back/idle | T-search |
| R054 | `/explore` | Submit from /maps; refocus submitted query; Back restores origin | T-search |
| R055 | `/search` | Enter header search from /health; keyboard already open/closed; clear/Back/idle | T-search |
| R056 | `/explore` | Submit from /health; refocus submitted query; Back restores origin | T-search |
| R057 | `/search` | Enter header search from /reports; keyboard already open/closed; clear/Back/idle | T-search |
| R058 | `/explore` | Submit from /reports; refocus submitted query; Back restores origin | T-search |
| R059 | `/search` | Enter header search from /announcements; keyboard already open/closed; clear/Back/idle | T-search |
| R060 | `/explore` | Submit from /announcements; refocus submitted query; Back restores origin | T-search |
| R061 | `/search` | Enter header search from /settings; keyboard already open/closed; clear/Back/idle | T-search |
| R062 | `/explore` | Submit from /settings; refocus submitted query; Back restores origin | T-search |
| R063 | `/maps` | Incidents only; filters/selected marker/navigation shown and hidden; evacuation lookalike disabled | T-search |
| R064 | `/emergency-centers` | Expanded search in list; filters/selection/route overlay; collapse and reopen | T-search |
| R065 | `/emergency-centers` | Expanded search in map; filters/selection/route overlay; collapse and reopen | T-search |
| R066 | `/home/emergency-info?tab=centers` | Expanded search in list; filters/selection/route overlay; collapse and reopen | T-search |
| R067 | `/home/emergency-info?tab=centers` | Expanded search in map; filters/selection/route overlay; collapse and reopen | T-search |
| R068 | `/drrm?tab=centers` | Expanded search in list; filters/selection/route overlay; collapse and reopen | T-search |
| R069 | `/drrm?tab=centers` | Expanded search in map; filters/selection/route overlay; collapse and reopen | T-search |

**Additional real consumers:** /drrm re-exports /home/emergency-info; A09/C17 cover both entry paths. This alias is additional route coverage, not a 60th definition. C15 is editable in /search and /explore; each supported header origin has its own entry/refocus/Back case.

## Required matrix

M0 is now the active MuMuPlayer primary slot with sampled results below. Other slots and unexecuted M0 cases remain pending. Navigation/font variants are explicit; do not claim a setting was exercised merely because it is listed. Each row uses its source-selected IME (default/text, email-address, phone-pad or number-pad); repeat using a taller suggestion row/IME under section 9.1. Physical phone coverage is optional if available; no physical device was connected. Record exact API/build, IME package/version, navigation, font scale and display density when a slot is actually run.

| Config | Android/API | Device | Navigation | Font/display | Access / gap |
|---|---|---|---|---|---|
| M0 | API 32 / Android 12 | MuMuPlayer primary; 360×640 dp | Setting 0 observed; navigation variant pending | Font scale 1.0; account theme/font retained | Active resident client, Gboard, 29 matched source/factory identities; sampled results below |
| M1 | 24 / Android 7 (SDK 57 and installed APK floor) | Compact-height emulator | Three-button | Default | Unavailable in connected inventory |
| M1L | 24 / Android 7 | Compact-height emulator | Gesture if supported by device; otherwise record N/A and exercise gestures on M2/M3 | Larger font and display; exact settings to record | Unavailable in connected inventory |
| M2 | Currently deployed edge-to-edge Android: API needs release-policy confirmation | Release validation device | Gesture | Default | No such qualified connected device; deployed OS not established |
| M2L | Same deployed edge-to-edge version as M2 | Compact-height variant | Three-button | Larger font and display; exact settings to record | Unavailable |
| M3 | Newest Android supported for release: policy/API unresolved; targetSdk 36 is not an upper support limit | Release validation device | Three-button | Default | Unavailable; no inferred newest-release API |
| M3L | Same newest-supported release as M3 | Compact-height variant | Gesture | Larger font and display; exact settings to record | Unavailable |

## Data readiness and safe execution

[Scenario catalog](phase-0-2026-10-24/test-data.json) supplies local synthetic edit payloads and the exact conditional prerequisites. These are **prepared inputs, not provisioned accounts, seeded records or executed UI fixtures**. Every account/data group is unresolved until reached in an approved development environment. No production data/auth/service configuration was changed; no OTP email, password update, account deletion, payment or remote migration was sent.

Before field execution, pair the native candidate with source/dependency identity and observe window mode/system bars. Load each scenario through its real guards; never unlock a read-only field. For every ledger row run section 9.1 focus/typing/paste/selection/focus-switch/error-growth/open-keyboard scrolling/dismissal/reopen protocol. Capture before-focus, settled-keyboard, long-typing and after-dismissal images/video. Record field/caret/scroll viewport/keyboard/footer bounds in dp where diagnosing failure; target 8 dp clearance where feasible. Multiline IDs require start/middle/end caret and native/outer scroll cooperation. Repeat 3 open/close cycles for any later changed surface. Modal observations belong to their own window. Do not submit destructive or financial actions for visibility tests.

## Full baseline ledger

Compact codes prevent repeated claims: **U-build**=no qualified source-paired resident candidate; **U-start**=normal starting scroll prescribed but not executed (lower fields scroll only enough to tap); **U-protocol**=focus/typing/scroll/dismissal all untested; **U-cause**=no measured overlap/cause; **Reopen**=Reopen for investigation; **Pending**=pending manual verification, never pass; **—**=no evidence. **N0**=[launcher-only screenshot](../../../tmp/resident-keyboard-phase0-20261024/native-launch.png), not input evidence. Matrix and consumer dictionaries above fully specify each reserved occurrence. The owner column points to the ID source table, pending any native cause diagnosis. Baseline evidence exists for the linked MuMuPlayer observations; candidate-fix evidence is absent because no application fix was made.

| Audit ID | Consumer route/branch | Build/device/API/IME/nav/font | Starting scroll | Focus/typing/scroll/dismissal | Observed cause | Decision | Proposed file owner (investigation only) | Before evidence | Candidate evidence | Final status |
|---|---|---|---|---|---|---|---|---|---|---|
| A01 | R001 | MuMu-dev/M0/Gboard | Observed | Focus visible; partial protocol | Remaining checks pending | Reopen for investigation | A01 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Partial; pending |
| A01 | R001 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | A01 source | — | — | Pending |
| A01 | R001 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | A01 source | — | — | Pending |
| A01 | R001 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | A01 source | — | — | Pending |
| A01 | R001 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | A01 source | — | — | Pending |
| A01 | R001 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | A01 source | — | — | Pending |
| A01 | R001 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | A01 source | — | — | Pending |
| A02 | R001 | MuMu-dev/M0/Gboard | Observed | Focus visible; partial protocol | Remaining checks pending | Reopen for investigation | A02 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Partial; pending |
| A02 | R001 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | A02 source | — | — | Pending |
| A02 | R001 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | A02 source | — | — | Pending |
| A02 | R001 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | A02 source | — | — | Pending |
| A02 | R001 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | A02 source | — | — | Pending |
| A02 | R001 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | A02 source | — | — | Pending |
| A02 | R001 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | A02 source | — | — | Pending |
| A03 | R001 | MuMu-dev/M0/Gboard | Observed | Focus visible; partial protocol | Remaining checks pending | Reopen for investigation | A03 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Partial; pending |
| A03 | R001 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | A03 source | — | — | Pending |
| A03 | R001 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | A03 source | — | — | Pending |
| A03 | R001 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | A03 source | — | — | Pending |
| A03 | R001 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | A03 source | — | — | Pending |
| A03 | R001 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | A03 source | — | — | Pending |
| A03 | R001 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | A03 source | — | — | Pending |
| A04 | R002 | MuMu-dev/M0/Gboard | Observed | Focus visible; partial protocol | Remaining checks pending | Reopen for investigation | A04 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Partial; pending |
| A04 | R002 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | A04 source | — | — | Pending |
| A04 | R002 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | A04 source | — | — | Pending |
| A04 | R002 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | A04 source | — | — | Pending |
| A04 | R002 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | A04 source | — | — | Pending |
| A04 | R002 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | A04 source | — | — | Pending |
| A04 | R002 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | A04 source | — | — | Pending |
| A05 | R003 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | A05 source | N0 | — | Pending |
| A05 | R003 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | A05 source | — | — | Pending |
| A05 | R003 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | A05 source | — | — | Pending |
| A05 | R003 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | A05 source | — | — | Pending |
| A05 | R003 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | A05 source | — | — | Pending |
| A05 | R003 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | A05 source | — | — | Pending |
| A05 | R003 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | A05 source | — | — | Pending |
| A06 | R004 | MuMu-dev/M0/number-pad | U-start | U-protocol | U-cause | Reopen | A06 source | N0 | — | Pending |
| A06 | R004 | U-build/M1/number-pad | U-start | U-protocol | U-cause | Reopen | A06 source | — | — | Pending |
| A06 | R004 | U-build/M1L/number-pad | U-start | U-protocol | U-cause | Reopen | A06 source | — | — | Pending |
| A06 | R004 | U-build/M2/number-pad | U-start | U-protocol | U-cause | Reopen | A06 source | — | — | Pending |
| A06 | R004 | U-build/M2L/number-pad | U-start | U-protocol | U-cause | Reopen | A06 source | — | — | Pending |
| A06 | R004 | U-build/M3/number-pad | U-start | U-protocol | U-cause | Reopen | A06 source | — | — | Pending |
| A06 | R004 | U-build/M3L/number-pad | U-start | U-protocol | U-cause | Reopen | A06 source | — | — | Pending |
| A06 | R005 | MuMu-dev/M0/number-pad | U-start | U-protocol | U-cause | Reopen | A06 source | N0 | — | Pending |
| A06 | R005 | U-build/M1/number-pad | U-start | U-protocol | U-cause | Reopen | A06 source | — | — | Pending |
| A06 | R005 | U-build/M1L/number-pad | U-start | U-protocol | U-cause | Reopen | A06 source | — | — | Pending |
| A06 | R005 | U-build/M2/number-pad | U-start | U-protocol | U-cause | Reopen | A06 source | — | — | Pending |
| A06 | R005 | U-build/M2L/number-pad | U-start | U-protocol | U-cause | Reopen | A06 source | — | — | Pending |
| A06 | R005 | U-build/M3/number-pad | U-start | U-protocol | U-cause | Reopen | A06 source | — | — | Pending |
| A06 | R005 | U-build/M3L/number-pad | U-start | U-protocol | U-cause | Reopen | A06 source | — | — | Pending |
| A07 | R006 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | A07 source | N0 | — | Pending |
| A07 | R006 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | A07 source | — | — | Pending |
| A07 | R006 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | A07 source | — | — | Pending |
| A07 | R006 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | A07 source | — | — | Pending |
| A07 | R006 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | A07 source | — | — | Pending |
| A07 | R006 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | A07 source | — | — | Pending |
| A07 | R006 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | A07 source | — | — | Pending |
| A07 | R007 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | A07 source | N0 | — | Pending |
| A07 | R007 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | A07 source | — | — | Pending |
| A07 | R007 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | A07 source | — | — | Pending |
| A07 | R007 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | A07 source | — | — | Pending |
| A07 | R007 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | A07 source | — | — | Pending |
| A07 | R007 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | A07 source | — | — | Pending |
| A07 | R007 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | A07 source | — | — | Pending |
| A08 | R008 | MuMu-dev/M0/Gboard | Observed | Focus visible; partial protocol | Remaining checks pending | Reopen for investigation | A08 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Partial; pending |
| A08 | R008 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | A08 source | — | — | Pending |
| A08 | R008 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | A08 source | — | — | Pending |
| A08 | R008 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | A08 source | — | — | Pending |
| A08 | R008 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | A08 source | — | — | Pending |
| A08 | R008 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | A08 source | — | — | Pending |
| A08 | R008 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | A08 source | — | — | Pending |
| A08 | R009 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | A08 source | N0 | — | Pending |
| A08 | R009 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | A08 source | — | — | Pending |
| A08 | R009 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | A08 source | — | — | Pending |
| A08 | R009 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | A08 source | — | — | Pending |
| A08 | R009 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | A08 source | — | — | Pending |
| A08 | R009 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | A08 source | — | — | Pending |
| A08 | R009 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | A08 source | — | — | Pending |
| A09 | R010 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | A09 source | N0 | — | Pending |
| A09 | R010 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R010 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R010 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R010 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R010 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R010 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R011 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | A09 source | N0 | — | Pending |
| A09 | R011 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R011 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R011 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R011 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R011 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R011 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R012 | MuMu-dev/M0/Gboard | Observed | Focus visible; partial protocol | Remaining checks pending | Reopen for investigation | A09 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Partial; pending |
| A09 | R012 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R012 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R012 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R012 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R012 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R012 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R013 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | A09 source | N0 | — | Pending |
| A09 | R013 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R013 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R013 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R013 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R013 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A09 | R013 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | A09 source | — | — | Pending |
| A10 | R014 | MuMu-dev/M0/Gboard | Observed | Focus visible; partial protocol | Remaining checks pending | Reopen for investigation | A10 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Partial; pending |
| A10 | R014 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | A10 source | — | — | Pending |
| A10 | R014 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | A10 source | — | — | Pending |
| A10 | R014 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | A10 source | — | — | Pending |
| A10 | R014 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | A10 source | — | — | Pending |
| A10 | R014 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | A10 source | — | — | Pending |
| A10 | R014 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | A10 source | — | — | Pending |
| B01 | R015 | MuMu-dev/M0/email-address | U-start | U-protocol | U-cause | Reopen | B01 source | N0 | — | Pending |
| B01 | R015 | U-build/M1/email-address | U-start | U-protocol | U-cause | Reopen | B01 source | — | — | Pending |
| B01 | R015 | U-build/M1L/email-address | U-start | U-protocol | U-cause | Reopen | B01 source | — | — | Pending |
| B01 | R015 | U-build/M2/email-address | U-start | U-protocol | U-cause | Reopen | B01 source | — | — | Pending |
| B01 | R015 | U-build/M2L/email-address | U-start | U-protocol | U-cause | Reopen | B01 source | — | — | Pending |
| B01 | R015 | U-build/M3/email-address | U-start | U-protocol | U-cause | Reopen | B01 source | — | — | Pending |
| B01 | R015 | U-build/M3L/email-address | U-start | U-protocol | U-cause | Reopen | B01 source | — | — | Pending |
| B02 | R015 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B02 source | N0 | — | Pending |
| B02 | R015 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B02 source | — | — | Pending |
| B02 | R015 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B02 source | — | — | Pending |
| B02 | R015 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B02 source | — | — | Pending |
| B02 | R015 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B02 source | — | — | Pending |
| B02 | R015 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B02 source | — | — | Pending |
| B02 | R015 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B02 source | — | — | Pending |
| B03 | R016 | MuMu-dev/M0/email-address | U-start | U-protocol | U-cause | Reopen | B03 source | N0 | — | Pending |
| B03 | R016 | U-build/M1/email-address | U-start | U-protocol | U-cause | Reopen | B03 source | — | — | Pending |
| B03 | R016 | U-build/M1L/email-address | U-start | U-protocol | U-cause | Reopen | B03 source | — | — | Pending |
| B03 | R016 | U-build/M2/email-address | U-start | U-protocol | U-cause | Reopen | B03 source | — | — | Pending |
| B03 | R016 | U-build/M2L/email-address | U-start | U-protocol | U-cause | Reopen | B03 source | — | — | Pending |
| B03 | R016 | U-build/M3/email-address | U-start | U-protocol | U-cause | Reopen | B03 source | — | — | Pending |
| B03 | R016 | U-build/M3L/email-address | U-start | U-protocol | U-cause | Reopen | B03 source | — | — | Pending |
| B04 | R017 | MuMu-dev/M0/number-pad | U-start | U-protocol | U-cause | Reopen | B04 source | N0 | — | Pending |
| B04 | R017 | U-build/M1/number-pad | U-start | U-protocol | U-cause | Reopen | B04 source | — | — | Pending |
| B04 | R017 | U-build/M1L/number-pad | U-start | U-protocol | U-cause | Reopen | B04 source | — | — | Pending |
| B04 | R017 | U-build/M2/number-pad | U-start | U-protocol | U-cause | Reopen | B04 source | — | — | Pending |
| B04 | R017 | U-build/M2L/number-pad | U-start | U-protocol | U-cause | Reopen | B04 source | — | — | Pending |
| B04 | R017 | U-build/M3/number-pad | U-start | U-protocol | U-cause | Reopen | B04 source | — | — | Pending |
| B04 | R017 | U-build/M3L/number-pad | U-start | U-protocol | U-cause | Reopen | B04 source | — | — | Pending |
| B05 | R018 | MuMu-dev/M0/email-address | U-start | U-protocol | U-cause | Reopen | B05 source | N0 | — | Pending |
| B05 | R018 | U-build/M1/email-address | U-start | U-protocol | U-cause | Reopen | B05 source | — | — | Pending |
| B05 | R018 | U-build/M1L/email-address | U-start | U-protocol | U-cause | Reopen | B05 source | — | — | Pending |
| B05 | R018 | U-build/M2/email-address | U-start | U-protocol | U-cause | Reopen | B05 source | — | — | Pending |
| B05 | R018 | U-build/M2L/email-address | U-start | U-protocol | U-cause | Reopen | B05 source | — | — | Pending |
| B05 | R018 | U-build/M3/email-address | U-start | U-protocol | U-cause | Reopen | B05 source | — | — | Pending |
| B05 | R018 | U-build/M3L/email-address | U-start | U-protocol | U-cause | Reopen | B05 source | — | — | Pending |
| B06 | R019 | MuMu-dev/M0/number-pad | U-start | U-protocol | U-cause | Reopen | B06 source | N0 | — | Pending |
| B06 | R019 | U-build/M1/number-pad | U-start | U-protocol | U-cause | Reopen | B06 source | — | — | Pending |
| B06 | R019 | U-build/M1L/number-pad | U-start | U-protocol | U-cause | Reopen | B06 source | — | — | Pending |
| B06 | R019 | U-build/M2/number-pad | U-start | U-protocol | U-cause | Reopen | B06 source | — | — | Pending |
| B06 | R019 | U-build/M2L/number-pad | U-start | U-protocol | U-cause | Reopen | B06 source | — | — | Pending |
| B06 | R019 | U-build/M3/number-pad | U-start | U-protocol | U-cause | Reopen | B06 source | — | — | Pending |
| B06 | R019 | U-build/M3L/number-pad | U-start | U-protocol | U-cause | Reopen | B06 source | — | — | Pending |
| B07 | R020 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B07 source | N0 | — | Pending |
| B07 | R020 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B07 source | — | — | Pending |
| B07 | R020 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B07 source | — | — | Pending |
| B07 | R020 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B07 source | — | — | Pending |
| B07 | R020 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B07 source | — | — | Pending |
| B07 | R020 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B07 source | — | — | Pending |
| B07 | R020 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B07 source | — | — | Pending |
| B08 | R020 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B08 source | N0 | — | Pending |
| B08 | R020 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B08 source | — | — | Pending |
| B08 | R020 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B08 source | — | — | Pending |
| B08 | R020 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B08 source | — | — | Pending |
| B08 | R020 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B08 source | — | — | Pending |
| B08 | R020 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B08 source | — | — | Pending |
| B08 | R020 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B08 source | — | — | Pending |
| B09 | R021 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B09 source | N0 | — | Pending |
| B09 | R021 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R021 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R021 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R021 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R021 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R021 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R022 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B09 source | N0 | — | Pending |
| B09 | R022 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R022 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R022 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R022 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R022 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R022 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R023 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B09 source | N0 | — | Pending |
| B09 | R023 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R023 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R023 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R023 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R023 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B09 | R023 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B09 source | — | — | Pending |
| B10 | R021 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B10 source | N0 | — | Pending |
| B10 | R021 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R021 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R021 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R021 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R021 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R021 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R022 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B10 source | N0 | — | Pending |
| B10 | R022 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R022 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R022 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R022 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R022 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R022 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R023 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B10 source | N0 | — | Pending |
| B10 | R023 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R023 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R023 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R023 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R023 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B10 | R023 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B10 source | — | — | Pending |
| B11 | R021 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B11 source | N0 | — | Pending |
| B11 | R021 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R021 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R021 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R021 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R021 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R021 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R022 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B11 source | N0 | — | Pending |
| B11 | R022 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R022 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R022 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R022 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R022 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R022 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R023 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B11 source | N0 | — | Pending |
| B11 | R023 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R023 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R023 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R023 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R023 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B11 | R023 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B11 source | — | — | Pending |
| B12 | R021 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B12 source | N0 | — | Pending |
| B12 | R021 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R021 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R021 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R021 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R021 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R021 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R022 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B12 source | N0 | — | Pending |
| B12 | R022 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R022 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R022 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R022 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R022 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R022 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R023 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B12 source | N0 | — | Pending |
| B12 | R023 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R023 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R023 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R023 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R023 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B12 | R023 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B12 source | — | — | Pending |
| B13 | R021 | MuMu-dev/M0/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | N0 | — | Pending |
| B13 | R021 | U-build/M1/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R021 | U-build/M1L/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R021 | U-build/M2/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R021 | U-build/M2L/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R021 | U-build/M3/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R021 | U-build/M3L/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R022 | MuMu-dev/M0/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | N0 | — | Pending |
| B13 | R022 | U-build/M1/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R022 | U-build/M1L/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R022 | U-build/M2/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R022 | U-build/M2L/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R022 | U-build/M3/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R022 | U-build/M3L/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R023 | MuMu-dev/M0/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | N0 | — | Pending |
| B13 | R023 | U-build/M1/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R023 | U-build/M1L/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R023 | U-build/M2/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R023 | U-build/M2L/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R023 | U-build/M3/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B13 | R023 | U-build/M3L/phone-pad | U-start | U-protocol | U-cause | Reopen | B13 source | — | — | Pending |
| B14 | R021 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B14 source | N0 | — | Pending |
| B14 | R021 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R021 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R021 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R021 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R021 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R021 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R022 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B14 source | N0 | — | Pending |
| B14 | R022 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R022 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R022 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R022 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R022 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R022 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R023 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B14 source | N0 | — | Pending |
| B14 | R023 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R023 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R023 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R023 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R023 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B14 | R023 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B14 source | — | — | Pending |
| B15 | R021 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B15 source | N0 | — | Pending |
| B15 | R021 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R021 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R021 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R021 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R021 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R021 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R022 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B15 source | N0 | — | Pending |
| B15 | R022 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R022 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R022 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R022 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R022 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R022 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R023 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B15 source | N0 | — | Pending |
| B15 | R023 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R023 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R023 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R023 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R023 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B15 | R023 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B15 source | — | — | Pending |
| B16 | R021 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B16 source | N0 | — | Pending |
| B16 | R021 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R021 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R021 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R021 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R021 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R021 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R022 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B16 source | N0 | — | Pending |
| B16 | R022 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R022 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R022 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R022 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R022 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R022 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R023 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B16 source | N0 | — | Pending |
| B16 | R023 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R023 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R023 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R023 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R023 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B16 | R023 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B16 source | — | — | Pending |
| B17 | R024 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B17 source | N0 | — | Pending |
| B17 | R024 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B17 source | — | — | Pending |
| B17 | R024 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B17 source | — | — | Pending |
| B17 | R024 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B17 source | — | — | Pending |
| B17 | R024 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B17 source | — | — | Pending |
| B17 | R024 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B17 source | — | — | Pending |
| B17 | R024 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B17 source | — | — | Pending |
| B18 | R024 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B18 source | N0 | — | Pending |
| B18 | R024 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B18 source | — | — | Pending |
| B18 | R024 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B18 source | — | — | Pending |
| B18 | R024 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B18 source | — | — | Pending |
| B18 | R024 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B18 source | — | — | Pending |
| B18 | R024 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B18 source | — | — | Pending |
| B18 | R024 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B18 source | — | — | Pending |
| B19 | R024 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B19 source | N0 | — | Pending |
| B19 | R024 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B19 source | — | — | Pending |
| B19 | R024 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B19 source | — | — | Pending |
| B19 | R024 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B19 source | — | — | Pending |
| B19 | R024 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B19 source | — | — | Pending |
| B19 | R024 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B19 source | — | — | Pending |
| B19 | R024 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B19 source | — | — | Pending |
| B20 | R025 | MuMu-dev/M0/number-pad | U-start | U-protocol | U-cause | Reopen | B20 source | N0 | — | Pending |
| B20 | R025 | U-build/M1/number-pad | U-start | U-protocol | U-cause | Reopen | B20 source | — | — | Pending |
| B20 | R025 | U-build/M1L/number-pad | U-start | U-protocol | U-cause | Reopen | B20 source | — | — | Pending |
| B20 | R025 | U-build/M2/number-pad | U-start | U-protocol | U-cause | Reopen | B20 source | — | — | Pending |
| B20 | R025 | U-build/M2L/number-pad | U-start | U-protocol | U-cause | Reopen | B20 source | — | — | Pending |
| B20 | R025 | U-build/M3/number-pad | U-start | U-protocol | U-cause | Reopen | B20 source | — | — | Pending |
| B20 | R025 | U-build/M3L/number-pad | U-start | U-protocol | U-cause | Reopen | B20 source | — | — | Pending |
| B21 | R026 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B21 source | N0 | — | Pending |
| B21 | R026 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B21 source | — | — | Pending |
| B21 | R026 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B21 source | — | — | Pending |
| B21 | R026 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B21 source | — | — | Pending |
| B21 | R026 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B21 source | — | — | Pending |
| B21 | R026 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B21 source | — | — | Pending |
| B21 | R026 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B21 source | — | — | Pending |
| B22 | R027 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B22 source | N0 | — | Pending |
| B22 | R027 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B22 source | — | — | Pending |
| B22 | R027 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B22 source | — | — | Pending |
| B22 | R027 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B22 source | — | — | Pending |
| B22 | R027 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B22 source | — | — | Pending |
| B22 | R027 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B22 source | — | — | Pending |
| B22 | R027 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B22 source | — | — | Pending |
| B22 | R028 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B22 source | N0 | — | Pending |
| B22 | R028 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B22 source | — | — | Pending |
| B22 | R028 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B22 source | — | — | Pending |
| B22 | R028 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B22 source | — | — | Pending |
| B22 | R028 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B22 source | — | — | Pending |
| B22 | R028 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B22 source | — | — | Pending |
| B22 | R028 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B22 source | — | — | Pending |
| B23 | R027 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B23 source | N0 | — | Pending |
| B23 | R027 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B23 source | — | — | Pending |
| B23 | R027 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B23 source | — | — | Pending |
| B23 | R027 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B23 source | — | — | Pending |
| B23 | R027 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B23 source | — | — | Pending |
| B23 | R027 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B23 source | — | — | Pending |
| B23 | R027 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B23 source | — | — | Pending |
| B23 | R028 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B23 source | N0 | — | Pending |
| B23 | R028 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B23 source | — | — | Pending |
| B23 | R028 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B23 source | — | — | Pending |
| B23 | R028 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B23 source | — | — | Pending |
| B23 | R028 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B23 source | — | — | Pending |
| B23 | R028 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B23 source | — | — | Pending |
| B23 | R028 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B23 source | — | — | Pending |
| B24 | R027 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B24 source | N0 | — | Pending |
| B24 | R027 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B24 source | — | — | Pending |
| B24 | R027 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B24 source | — | — | Pending |
| B24 | R027 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B24 source | — | — | Pending |
| B24 | R027 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B24 source | — | — | Pending |
| B24 | R027 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B24 source | — | — | Pending |
| B24 | R027 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B24 source | — | — | Pending |
| B24 | R028 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B24 source | N0 | — | Pending |
| B24 | R028 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B24 source | — | — | Pending |
| B24 | R028 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B24 source | — | — | Pending |
| B24 | R028 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B24 source | — | — | Pending |
| B24 | R028 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B24 source | — | — | Pending |
| B24 | R028 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B24 source | — | — | Pending |
| B24 | R028 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B24 source | — | — | Pending |
| B25 | R029 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B25 source | N0 | — | Pending |
| B25 | R029 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B25 source | — | — | Pending |
| B25 | R029 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B25 source | — | — | Pending |
| B25 | R029 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B25 source | — | — | Pending |
| B25 | R029 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B25 source | — | — | Pending |
| B25 | R029 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B25 source | — | — | Pending |
| B25 | R029 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B25 source | — | — | Pending |
| B26 | R030 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B26 source | N0 | — | Pending |
| B26 | R030 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B26 source | — | — | Pending |
| B26 | R030 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B26 source | — | — | Pending |
| B26 | R030 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B26 source | — | — | Pending |
| B26 | R030 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B26 source | — | — | Pending |
| B26 | R030 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B26 source | — | — | Pending |
| B26 | R030 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B26 source | — | — | Pending |
| B27 | R030 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B27 source | N0 | — | Pending |
| B27 | R030 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B27 source | — | — | Pending |
| B27 | R030 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B27 source | — | — | Pending |
| B27 | R030 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B27 source | — | — | Pending |
| B27 | R030 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B27 source | — | — | Pending |
| B27 | R030 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B27 source | — | — | Pending |
| B27 | R030 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B27 source | — | — | Pending |
| B28 | R031 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B28 source | N0 | — | Pending |
| B28 | R031 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B28 source | — | — | Pending |
| B28 | R031 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B28 source | — | — | Pending |
| B28 | R031 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B28 source | — | — | Pending |
| B28 | R031 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B28 source | — | — | Pending |
| B28 | R031 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B28 source | — | — | Pending |
| B28 | R031 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B28 source | — | — | Pending |
| B29 | R031 | MuMu-dev/M0/number-pad | U-start | U-protocol | U-cause | Reopen | B29 source | N0 | — | Pending |
| B29 | R031 | U-build/M1/number-pad | U-start | U-protocol | U-cause | Reopen | B29 source | — | — | Pending |
| B29 | R031 | U-build/M1L/number-pad | U-start | U-protocol | U-cause | Reopen | B29 source | — | — | Pending |
| B29 | R031 | U-build/M2/number-pad | U-start | U-protocol | U-cause | Reopen | B29 source | — | — | Pending |
| B29 | R031 | U-build/M2L/number-pad | U-start | U-protocol | U-cause | Reopen | B29 source | — | — | Pending |
| B29 | R031 | U-build/M3/number-pad | U-start | U-protocol | U-cause | Reopen | B29 source | — | — | Pending |
| B29 | R031 | U-build/M3L/number-pad | U-start | U-protocol | U-cause | Reopen | B29 source | — | — | Pending |
| B30 | R031 | MuMu-dev/M0/number-pad | U-start | U-protocol | U-cause | Reopen | B30 source | N0 | — | Pending |
| B30 | R031 | U-build/M1/number-pad | U-start | U-protocol | U-cause | Reopen | B30 source | — | — | Pending |
| B30 | R031 | U-build/M1L/number-pad | U-start | U-protocol | U-cause | Reopen | B30 source | — | — | Pending |
| B30 | R031 | U-build/M2/number-pad | U-start | U-protocol | U-cause | Reopen | B30 source | — | — | Pending |
| B30 | R031 | U-build/M2L/number-pad | U-start | U-protocol | U-cause | Reopen | B30 source | — | — | Pending |
| B30 | R031 | U-build/M3/number-pad | U-start | U-protocol | U-cause | Reopen | B30 source | — | — | Pending |
| B30 | R031 | U-build/M3L/number-pad | U-start | U-protocol | U-cause | Reopen | B30 source | — | — | Pending |
| B31 | R032 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B31 source | N0 | — | Pending |
| B31 | R032 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R032 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R032 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R032 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R032 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R032 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R033 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B31 source | N0 | — | Pending |
| B31 | R033 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R033 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R033 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R033 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R033 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R033 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R034 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | B31 source | N0 | — | Pending |
| B31 | R034 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R034 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R034 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R034 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R034 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B31 | R034 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B31 source | — | — | Pending |
| B32 | R035 | MuMu-dev/M0/Gboard | Observed | FAIL: bounds overlap | See native report | Add/tune local avoidance | B32 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Failure; candidate pending |
| B32 | R035 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | B32 source | — | — | Pending |
| B32 | R035 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | B32 source | — | — | Pending |
| B32 | R035 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | B32 source | — | — | Pending |
| B32 | R035 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | B32 source | — | — | Pending |
| B32 | R035 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | B32 source | — | — | Pending |
| B32 | R035 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | B32 source | — | — | Pending |
| C01 | R036 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C01 source | N0 | — | Pending |
| C01 | R036 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R036 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R036 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R036 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R036 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R036 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R037 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C01 source | N0 | — | Pending |
| C01 | R037 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R037 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R037 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R037 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R037 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R037 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R038 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C01 source | N0 | — | Pending |
| C01 | R038 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R038 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R038 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R038 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R038 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C01 | R038 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C01 source | — | — | Pending |
| C02 | R036 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C02 source | N0 | — | Pending |
| C02 | R036 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R036 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R036 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R036 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R036 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R036 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R037 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C02 source | N0 | — | Pending |
| C02 | R037 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R037 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R037 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R037 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R037 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R037 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R038 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C02 source | N0 | — | Pending |
| C02 | R038 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R038 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R038 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R038 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R038 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C02 | R038 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C02 source | — | — | Pending |
| C03 | R039 | MuMu-dev/M0/Gboard | Observed | Focus visible; partial protocol | Remaining checks pending | Reopen for investigation | C03 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Partial; pending |
| C03 | R039 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C03 source | — | — | Pending |
| C03 | R039 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C03 source | — | — | Pending |
| C03 | R039 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C03 source | — | — | Pending |
| C03 | R039 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C03 source | — | — | Pending |
| C03 | R039 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C03 source | — | — | Pending |
| C03 | R039 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C03 source | — | — | Pending |
| C04 | R039 | MuMu-dev/M0/Gboard | Observed | FAIL: bounds overlap | See native report | Repair layout/scrolling | C04 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Failure; candidate pending |
| C04 | R039 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C04 source | — | — | Pending |
| C04 | R039 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C04 source | — | — | Pending |
| C04 | R039 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C04 source | — | — | Pending |
| C04 | R039 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C04 source | — | — | Pending |
| C04 | R039 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C04 source | — | — | Pending |
| C04 | R039 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C04 source | — | — | Pending |
| C05 | R039 | MuMu-dev/M0/Gboard | Observed | FAIL: bounds overlap | See native report | Repair layout/scrolling | C05 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Failure; candidate pending |
| C05 | R039 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C05 source | — | — | Pending |
| C05 | R039 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C05 source | — | — | Pending |
| C05 | R039 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C05 source | — | — | Pending |
| C05 | R039 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C05 source | — | — | Pending |
| C05 | R039 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C05 source | — | — | Pending |
| C05 | R039 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C05 source | — | — | Pending |
| C06 | R039 | MuMu-dev/M0/Gboard | Observed | FAIL: bounds overlap | See native report | Repair layout/scrolling | C06 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Failure; candidate pending |
| C06 | R039 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C06 source | — | — | Pending |
| C06 | R039 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C06 source | — | — | Pending |
| C06 | R039 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C06 source | — | — | Pending |
| C06 | R039 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C06 source | — | — | Pending |
| C06 | R039 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C06 source | — | — | Pending |
| C06 | R039 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C06 source | — | — | Pending |
| C07 | R040 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C07 source | N0 | — | Pending |
| C07 | R040 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C07 source | — | — | Pending |
| C07 | R040 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C07 source | — | — | Pending |
| C07 | R040 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C07 source | — | — | Pending |
| C07 | R040 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C07 source | — | — | Pending |
| C07 | R040 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C07 source | — | — | Pending |
| C07 | R040 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C07 source | — | — | Pending |
| C08 | R039 | MuMu-dev/M0/Gboard | Observed | FAIL: bounds overlap | See native report | Repair layout/scrolling | C08 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Failure; candidate pending |
| C08 | R039 | U-build/M1/email-address | U-start | U-protocol | U-cause | Reopen | C08 source | — | — | Pending |
| C08 | R039 | U-build/M1L/email-address | U-start | U-protocol | U-cause | Reopen | C08 source | — | — | Pending |
| C08 | R039 | U-build/M2/email-address | U-start | U-protocol | U-cause | Reopen | C08 source | — | — | Pending |
| C08 | R039 | U-build/M2L/email-address | U-start | U-protocol | U-cause | Reopen | C08 source | — | — | Pending |
| C08 | R039 | U-build/M3/email-address | U-start | U-protocol | U-cause | Reopen | C08 source | — | — | Pending |
| C08 | R039 | U-build/M3L/email-address | U-start | U-protocol | U-cause | Reopen | C08 source | — | — | Pending |
| C09 | R039 | MuMu-dev/M0/Gboard | Observed | FAIL: bounds overlap | See native report | Repair layout/scrolling | C09 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Failure; candidate pending |
| C09 | R039 | U-build/M1/phone-pad | U-start | U-protocol | U-cause | Reopen | C09 source | — | — | Pending |
| C09 | R039 | U-build/M1L/phone-pad | U-start | U-protocol | U-cause | Reopen | C09 source | — | — | Pending |
| C09 | R039 | U-build/M2/phone-pad | U-start | U-protocol | U-cause | Reopen | C09 source | — | — | Pending |
| C09 | R039 | U-build/M2L/phone-pad | U-start | U-protocol | U-cause | Reopen | C09 source | — | — | Pending |
| C09 | R039 | U-build/M3/phone-pad | U-start | U-protocol | U-cause | Reopen | C09 source | — | — | Pending |
| C09 | R039 | U-build/M3L/phone-pad | U-start | U-protocol | U-cause | Reopen | C09 source | — | — | Pending |
| C10 | R039 | MuMu-dev/M0/Gboard | Observed | FAIL: bounds overlap | See native report | Repair layout/scrolling | C10 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Failure; candidate pending |
| C10 | R039 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C10 source | — | — | Pending |
| C10 | R039 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C10 source | — | — | Pending |
| C10 | R039 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C10 source | — | — | Pending |
| C10 | R039 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C10 source | — | — | Pending |
| C10 | R039 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C10 source | — | — | Pending |
| C10 | R039 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C10 source | — | — | Pending |
| C11 | R039 | MuMu-dev/M0/Gboard | Observed | FAIL: bounds overlap | See native report | Repair layout/scrolling | C11 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Failure; candidate pending |
| C11 | R039 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C11 source | — | — | Pending |
| C11 | R039 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C11 source | — | — | Pending |
| C11 | R039 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C11 source | — | — | Pending |
| C11 | R039 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C11 source | — | — | Pending |
| C11 | R039 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C11 source | — | — | Pending |
| C11 | R039 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C11 source | — | — | Pending |
| C12 | R041 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C12 source | N0 | — | Pending |
| C12 | R041 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C12 source | — | — | Pending |
| C12 | R041 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C12 source | — | — | Pending |
| C12 | R041 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C12 source | — | — | Pending |
| C12 | R041 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C12 source | — | — | Pending |
| C12 | R041 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C12 source | — | — | Pending |
| C12 | R041 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C12 source | — | — | Pending |
| C13 | R042 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C13 source | N0 | — | Pending |
| C13 | R042 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C13 source | — | — | Pending |
| C13 | R042 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C13 source | — | — | Pending |
| C13 | R042 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C13 source | — | — | Pending |
| C13 | R042 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C13 source | — | — | Pending |
| C13 | R042 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C13 source | — | — | Pending |
| C13 | R042 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C13 source | — | — | Pending |
| C14 | R043 | MuMu-dev/M0/number-pad | U-start | U-protocol | U-cause | Reopen | C14 source | N0 | — | Pending |
| C14 | R043 | U-build/M1/number-pad | U-start | U-protocol | U-cause | Reopen | C14 source | — | — | Pending |
| C14 | R043 | U-build/M1L/number-pad | U-start | U-protocol | U-cause | Reopen | C14 source | — | — | Pending |
| C14 | R043 | U-build/M2/number-pad | U-start | U-protocol | U-cause | Reopen | C14 source | — | — | Pending |
| C14 | R043 | U-build/M2L/number-pad | U-start | U-protocol | U-cause | Reopen | C14 source | — | — | Pending |
| C14 | R043 | U-build/M3/number-pad | U-start | U-protocol | U-cause | Reopen | C14 source | — | — | Pending |
| C14 | R043 | U-build/M3L/number-pad | U-start | U-protocol | U-cause | Reopen | C14 source | — | — | Pending |
| C14 | R044 | MuMu-dev/M0/number-pad | U-start | U-protocol | U-cause | Reopen | C14 source | N0 | — | Pending |
| C14 | R044 | U-build/M1/number-pad | U-start | U-protocol | U-cause | Reopen | C14 source | — | — | Pending |
| C14 | R044 | U-build/M1L/number-pad | U-start | U-protocol | U-cause | Reopen | C14 source | — | — | Pending |
| C14 | R044 | U-build/M2/number-pad | U-start | U-protocol | U-cause | Reopen | C14 source | — | — | Pending |
| C14 | R044 | U-build/M2L/number-pad | U-start | U-protocol | U-cause | Reopen | C14 source | — | — | Pending |
| C14 | R044 | U-build/M3/number-pad | U-start | U-protocol | U-cause | Reopen | C14 source | — | — | Pending |
| C14 | R044 | U-build/M3L/number-pad | U-start | U-protocol | U-cause | Reopen | C14 source | — | — | Pending |
| C15 | R045 | MuMu-dev/M0/Gboard | Observed | Focus visible; partial protocol | Remaining checks pending | Reopen for investigation | C15 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Partial; pending |
| C15 | R045 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R045 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R045 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R045 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R045 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R045 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R046 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R046 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R046 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R046 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R046 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R046 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R046 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R047 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R047 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R047 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R047 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R047 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R047 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R047 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R048 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R048 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R048 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R048 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R048 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R048 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R048 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R049 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R049 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R049 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R049 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R049 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R049 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R049 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R050 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R050 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R050 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R050 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R050 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R050 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R050 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R051 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R051 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R051 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R051 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R051 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R051 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R051 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R052 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R052 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R052 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R052 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R052 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R052 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R052 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R053 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R053 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R053 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R053 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R053 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R053 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R053 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R054 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R054 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R054 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R054 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R054 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R054 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R054 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R055 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R055 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R055 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R055 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R055 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R055 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R055 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R056 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R056 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R056 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R056 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R056 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R056 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R056 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R057 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R057 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R057 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R057 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R057 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R057 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R057 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R058 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R058 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R058 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R058 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R058 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R058 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R058 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R059 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R059 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R059 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R059 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R059 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R059 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R059 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R060 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R060 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R060 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R060 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R060 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R060 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R060 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R061 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R061 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R061 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R061 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R061 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R061 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R061 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R062 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C15 source | N0 | — | Pending |
| C15 | R062 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R062 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R062 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R062 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R062 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C15 | R062 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C15 source | — | — | Pending |
| C16 | R063 | MuMu-dev/M0/Gboard | Observed | Focus visible; partial protocol | Remaining checks pending | Reopen for investigation | C16 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Partial; pending |
| C16 | R063 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C16 source | — | — | Pending |
| C16 | R063 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C16 source | — | — | Pending |
| C16 | R063 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C16 source | — | — | Pending |
| C16 | R063 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C16 source | — | — | Pending |
| C16 | R063 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C16 source | — | — | Pending |
| C16 | R063 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C16 source | — | — | Pending |
| C17 | R064 | M0/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R064 | M1/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R064 | M1L/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R064 | M2/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R064 | M2L/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R064 | M3/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R064 | M3L/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R065 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C17 source | N0 | — | Pending |
| C17 | R065 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R065 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R065 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R065 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R065 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R065 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R066 | M0/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R066 | M1/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R066 | M1L/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R066 | M2/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R066 | M2L/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R066 | M3/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R066 | M3L/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R067 | MuMu-dev/M0/default | U-start | U-protocol | U-cause | Reopen | C17 source | N0 | — | Pending |
| C17 | R067 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R067 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R067 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R067 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R067 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R067 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R068 | M0/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | Native absence observed | — | N/A editor; regression observed |
| C17 | R068 | M1/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R068 | M1L/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R068 | M2/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R068 | M2L/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R068 | M3/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R068 | M3L/list | N/A | No editor rendered | Map-only source guard | List regression | C17 source | — | — | N/A editor; regression pending |
| C17 | R069 | MuMu-dev/M0/Gboard | Observed | Focus visible; partial protocol | Remaining checks pending | Reopen for investigation | C17 source | [native](phase-0-2026-10-24/mumu-2026-10-24/report.md) | — | Partial; pending |
| C17 | R069 | U-build/M1/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R069 | U-build/M1L/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R069 | U-build/M2/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R069 | U-build/M2L/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R069 | U-build/M3/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |
| C17 | R069 | U-build/M3L/default | U-start | U-protocol | U-cause | Reopen | C17 source | — | — | Pending |

## Read-only exclusions reconfirmed

Setup Email/City/Province explicitly use editable=false; setup Barangay is displayed text. Configured Profile City uses LockedField when barangay_localities exists; Profile Barangay/Province are always LockedField. Fallback Profile City remains C12, editable Profile Email remains C08. Date-of-birth wheels/calendars and choice/chip controls are not native text editors; vaccination prior-dose date is an actual TextField (A07), so remains included. Recovery OTP is one native input with six visual cells, not six definitions. Maps evacuation lookalike uses editable=false; only incident state counts.

## Phase 0 exit gates

| Gate | Status | Evidence |
|---|---|---|
| All 59 definitions have a native result or explicit unresolved access/device gap | Met via explicit gaps |59 unique definitions; 19 native observations plus explicit remaining gaps and noneditable List regressions |
| Every proposed application change tied to reproduced failure | Met |No application edits; W3/W8 future fixes now tied to measured native failures |
| No A/B/C category substituted for native outcome | Met |0 full-protocol passes; native failures and partial observations explicitly distinguished |
| Native visibility, caret, scrolling and restoration | Pending manual verification |MuMuPlayer continuation has samples and failures; full protocol and remaining matrix/branches pending |

Phase 0 closes only the inventory/qualification/gap checkpoint. The overall keyboard objective and all device acceptance remain open. Later phases require reproduced native cases before application edits.
