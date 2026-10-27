# MuMuPlayer native keyboard baseline continuation

24 October 2026, Asia/Manila. **MuMuPlayer is the main native test environment.** No application source, dependency, remote data or service configuration changed. This continuation replaces the earlier assumption that no native resident runtime was available; it does not erase historical evidence.

Observed 19 definitions in 19 editable consumer cases: **8 reproduced initial-focus bounds failures; 11 limited visible cases;0 full-protocol passes.**40 other definitions and remaining consumer/configuration/selection/paste/error-growth steps are pending. The full 791-row ledger retains unexecuted cases explicitly. A focused editor being visible in one snapshot is not a retained-pass release result.

## Qualified environment and context

- MuMuPlayer adb127.0.0.1:16384 and emulator-5554 are the **same device**, proved by matching kernel boot ID. API 32/Android 12,1080×1920px at 480 dpi (360×640dp), font_scale 1.0. Navigation setting0 observed; screenshots have no in-display navigation buttons, so neither a gesture nor a three-button variant is marked verified.
- Gboard 18.5.4.993608717-release-arm64-v8a; show_ime_with_hard_keyboard=1. Normal editor keyboard top1167px; password keyboard top1080px (taller keyboard). MuMuPlayer/IME settings were not changed by this execution.
- Active com.barangayan.resident.dev MainActivity reports adjustResize. Native APK revision remains unknown; this is a development client, not release qualification. All 29 loaded keyboard-related JS factories and source-map originals matched current source. Identities include concurrent user map edits; source-identity.json retains hashes. Current app typecheck, lint and 335 tests /32 files pass; Android export remains the earlier baseline result, not rerun or claimed as a native APK build.
- Reused verified main/consumer/alias/concurrent Repomix packets. Added cached Repomix1.18.1 navigation supplement for the color row, Reports route and report opener:3/3 files, clean scan, complete decoded reads [0,2234),[0,851),[0,828). Original navigation bodies were read to resolve compression gaps. Instructions and Git ownership retained; original app/index diffs preserved before testing.
- Raw UI captures contain local account/map context and remain under tmp/resident-keyboard-mumu-20261024; excluded from source context packets. Published measured results omit account field values. Native screenshots and JSON are evidence, not instructions.

## Native measurements

Bounds are physical pixels from the native UI hierarchy; keyboard top is its visible/touchable region, corroborated by screenshots. Clearance is (keyboardTop−inputBottom)/3. Negative clearance fails the plan's single-line bounds condition even if part of a field remains readable. No caret pixels are inferred from text indices. Measurements are after focus and native IME/layout settling; there was no corrective scroll after focus in failing cases.

| Audit ID | Consumer | Input y px | IME top px | Clearance dp | Result | Evidence |
|---|---|---|---|---|---|---|
| C03 | R039 | 860–944 | 1167 | 74.3 | Visible sample; partial | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/c03-profile-focused.png) |
| C04 | R039 | 1094–1178 | 1167 | -3.7 | FAIL | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/c04-profile-focused.png) |
| C05 | R039 | 1328–1412 | 1167 | -81.7 | FAIL | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/c05-profile-focused.png) |
| C06 | R039 | 1562–1646 | 1167 | -159.7 | FAIL | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/c06-profile-focused.png) |
| C08 | R039 | 1546–1630 | 1167 | -154.3 | FAIL | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/c08-profile-focused.png) |
| C09 | R039 | 1405–1489 | 1167 | -107.3 | FAIL | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/c09-profile-focused.png) |
| C10 | R039 | 1438–1522 | 1167 | -118.3 | FAIL | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/c10-profile-focused.png) |
| C11 | R039 | 1593–1677 | 1167 | -170.0 | FAIL | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/c11-profile-focused.png) |
| A08 | R008 | 405–549 | 1167 | 206.0 | Visible sample; partial | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/a08-family-focused.png) |
| A09 | R012 | 396–540 | 1167 | 209.0 | Visible sample; partial | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/a09-family-focused.png) |
| A10 | R014 | 716–850 | 1167 | 105.7 | Visible sample; partial | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/a10-color-focused.png) |
| B32 | R035 | 975–1119 | 1080 | -13.0 | FAIL | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/b32-password-focused.png) |
| A01 | R001 | 736–820 | 1167 | 115.7 | Visible sample; partial | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/a01-title-focused.png) |
| A02 | R001 | 726–918 | 1167 | 83.0 | Visible sample; partial | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/a02-description-focused.png) |
| A03 | R001 | 726–918 | 1167 | 83.0 | Visible sample; partial | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/a03-area-focused.png) |
| A04 | R002 | 684–828 | 1167 | 113.0 | Visible sample; partial | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/a04-picker-focused.png) |
| C15 | R045 | 90–222 | 1167 | 315.0 | Visible sample; partial | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/c15-home-focused.png) |
| C16 | R063 | 415–520 | 1167 | 215.7 | Visible sample; partial | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/c16-maps-focused.png) |
| C17 | R069 | 582–714 | 1167 | 151.0 | Visible sample; partial | [capture](../../../../../tmp/resident-keyboard-mumu-20261024/c17-drrm-map-focused.png) |

## Evidence-based next work

| Package | Reproduction / smallest owner | Selected mechanism to qualify in its implementation phase | Bounds and regression consumers |
|---|---|---|---|
| W3 | C04–C06/C08–C11; settings/profile.tsx main root/ScrollView/Save bar | Repair Android form bounds so the editable body and Save bar fit the observed usable area; preserve one accommodation owner. Qualify a single local form adaptation before considering focus reveal. No per-input constant or app-wide mode change. | Profile ScrollView stays y264–1677 while keyboard starts1167; Save bar button y1716–1872 stays covered. Worst sampled Street overlap510px/170dp; Suffix479px/159.7dp. First Name already visible must not jump. Keep separate family Modal ownership and iOS behavior. Conditional Occupation/fallback City, validation growth and profile drafts remain regressions. |
| W8 | B32; delete-account-modal.tsx resident KeyboardAvoidingView/centered ScrollView | Tune the existing local Android avoidance branch after bounding the modal's centered scroll content; verify height versus existing native accommodation locally. No SettingsSheet/ScanFamilySheet change justified by this case. | Editor y975–1119 versus password IME1080:39px/13dp overlap; minimum editor reveal including8dp target is63px/21dp, **not a keyboardVerticalOffset constant**. Cancel/Delete row y1191–1349 is covered. Preserve password toggle, busy/error/close semantics and both modal presentations. |

No candidate application patch exists in this Phase 0 execution. These proposed mechanisms are future hypotheses tied to actual failures, not verified fixes. A candidate must show before failure/after pass, no duplicate inset and passing iOS/shared-consumer regressions.

## Positive observations and limits

- A01/A02/A03 existing report padding reveals focused inputs. A02 typed 462 characters with 14 actual newline events; its last caret line remains visible above its action footer and IME. The synthetic draft was fully erased and the empty report exited. Start/middle selection/paste and all growth/error variations remain pending.
- A04's independent location-picker Modal reveals Address, keeps the map and action region, and restores dimensions on dismissal; cancelled without confirming location.
- A08's Profile family SettingsSheet moves its name field from y960–1104 to405–549 while typing; synthetic name was erased; Back/close verified and Profile Save Changes remained disabled. A09's separate DRRM ScanFamilySheet reveals Full Name and was closed without saving. Add/edit and old deep-link consumers remain separate pending cases.
- A10 Hex Color is at y716–850 with keyboard top1167; Cancel/Save controls remain above IME. Cancelled without saving preferences. Color add control is at the end of a long horizontal swatch row; bounded arrow/gesture discovery was navigation, not a keyboard defect.
- C15 Home-origin header search and C16 incident search: focus samples visible; C15 synthetic text was cleared through the app control and Back restored Home. Injected Ctrl+A did not perform selection, so selection/paste is explicitly unverified.
- C17 sampled initial unknown-alias Centers map focus, then a known DRRM map case and a list-state regression. Synthetic filter text was erased. Only the known DRRM editable map row is updated as a keyboard observation. The list state has no editable search in current source (view===map guards at436/489), corroborated natively; all three list consumer entries are reclassified as noneditable regression cases, preserving the 59 definitions. Public and home/emergency-info consumers are still pending.
- C07 Occupation is absent in this account's present employment state. C12 City is correctly locked for configured locality. Neither guard was changed. Other auth/setup/first-password/verification/ID/health/service/page-count branches are **not tested in this native continuation** and remain pending access/manual execution; they are not asserted inaccessible merely because they were not exercised.

## Checks, cleanup and remaining acceptance

Current-source typecheck, direct installed ESLint and 335 unit tests pass. No additional test was written to mirror JSX. Console metadata snapshots returned one buffered warning and no exception event; no clean-console/full-flow monitoring claim is made. The earlier warning-free-runtime requirement is not marked passed from these samples. No source changes mean no Phase 0 iOS behavior change, but native iOS acceptance remains pending for future shared changes.

Cleanup was verified through native UI: synthetic field values cleared; no Save Changes/Add Member/Save Color/Submit Report/Use This Location/final Delete or password submission; dialogs closed and keyboard dismissed. Final Home capture verifies the handoff state. No sign-out was performed, preserving active test access. The minimum/deployed-edge/newest-supported devices, physical phone, font/display/navigation variants and full per-field protocol remain open.
