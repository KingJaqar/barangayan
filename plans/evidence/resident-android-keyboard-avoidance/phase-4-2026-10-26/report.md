# Phase 4 execution — 26 October 2026

**Status: Partially complete.** The observed A05 Android obstruction is fixed and automated checks pass without new failures. Required native protocol/configuration cases remain unresolved; none is counted as passed. Scope is W6/W7 (A01–A07), not Phases5/6.

## Changes and rationale

`apps/resident-android-mobile/src/app/(app)/settings/location-verification.tsx` reuses the app's existing keyboard-visible context. On Android, while details are expanded and the IME is open, the map container has zero height and the existing Save footer participates in the details ScrollView. MapView stays in the same tree position with the same key, props, state and callbacks. Dismissal restores the original map and fixed footer. The iOS conditional branch, keyboard offsets, resize configuration, validation, save/geocode handlers and theme/font contracts are unchanged. No listeners, dependencies, migrations or shared primitives were added.

The compact baseline had address bounds760–972 with IME top927 (45px obstruction), and Save1011–1189 behind the keyboard. Simply removing the minimum height did not resolve larger-display footer clipping; the final branch releases the map area explicitly and makes Save scrollable. Superseded experiments are retained separately and are not final acceptance evidence.

`apps/resident-android-mobile/tests/verification-sensitive-ui.mjs` adds one mock for the existing context hook. This preserves the fixture's isolation after the new production import. Existing user changes in both files are retained; compare with the recoverable working-copy snapshots, not HEAD.

## Native evidence

Methods: ADB native UI inspection/input plus the Windows Computer Use skill operating the actual MuMuPlayer window. Some injected swipes/taps and caret shortcuts did not reach the intended state. Those setup failures are recorded as incomplete tests, not product passes. Raw account-bearing images/UI dumps stay in ignored `tmp/resident-keyboard-phase4-20261026/native`; shareable geometry and capture hashes are in `native-summary.json`.

| Case | Observed result |
|---|---|
| A01–A03 | Title focus/typing; long description and eight-line specific area with end editing visible. Full paste/selection/caret/configuration protocol remains open. |
| A04 | Independent native picker Address focus/editing, local Use This Location return, underlying A03 draft retained. No report submitted. |
| A05 default | Full Save button895–1047 above IME1167 after normal keyboard-open scrolling; 24-line/158-character address with end caret visible; three exact map/footer restoration cycles and retained draft. |
| A05 compact | 1080×1680,480dpi,font1.3, explicit three-button overlay: address705–917 above IME927; full Save635–807. The border clearance is10px, below the preferred8dp target; active text is inside the bounded field. |
| A05 larger display | 1080×1680,540dpi,font1.3, explicit gesture overlay: address526–765 above IME887; full Save560–753. Three settled-idle restoration cycles within1px. An earlier initial map comparison differed by41px; cause unestablished. |
| A06 | Actual saved synthetic household member selected; numeric Age initial focus; typing7, native Cut and Gboard clipboard paste restored exact7. Three dismissal/reopen cycles were exercised, without a complete geometry assertion for each. |
| A07 | Existing vaccination drive, nonfirst dose branch; date2025-02-28 entered; editor778–922 above IME1167 with submission footer above keyboard. |
| Controlled invalid input | User explicitly authorized a potentially real invalid-input Submit attempt after automatic review initially blocked it. One ADB tap was attempted with Age999 and consent checked. No validation message or success was captured, including the later bottom-area inspection. Its outcome is unverified; the emulator later restarted and lost the form. Source validation returns before RPC for this value, but network calls were not instrumented. This is not a native validation pass or proof of no backend request. |
| Cleanup | Both authorized test-member setup sessions were followed by removal through the normal guarded app save. Final original empty active roster, no synthetic member, and disabled Profile Save verified; see `authorized-error-test-data.json`. No valid registration, incident submission or location save was attempted. |

`environment.json` qualifies the original session; `environment-final.json` records the restarted session. Same API32 Android12 native dev package/APK hash,1080×1920,480dpi,font1.0 at finish. Both experimental navigation overlays are disabled again, original navigation setting0 restored; this setting alone is not labeled a proven navigation mode. IME is Gboard. The APK source revision remains unknown; this is not release qualification. `served-source-final.json` matches final owner SHA256 on the preserved8081 server, but served source is not loaded-factory identity. Temporary visible runtime diagnostics were removed before final checks/native candidate results. The final app is on Home with IME hidden. No8084 listener or ADB reverse remained after restart; the user's8081 server was preserved.

## Verification

| Check | Baseline | Final |
|---|---|---|
| Mobile TypeScript | Pass | Pass (`logs/final3-type.*` and `logs/final5-type.*`) |
| Source ESLint | Pass,2 warnings | Pass, same2 warnings on Phase4 candidate;1 remaining pre-existing warning after external birthday change (`logs/final5-lint.*`) |
| Mobile Vitest | 335 tests/32 files pass | 335 tests/32 files pass (`logs/final3-unit.*` and `logs/final5-unit.*`) |
| Android JS/Hermes export | Pass | Pass (`logs/final3-export.*` and `logs/final5-export.*`); existing NO_COLOR/FORCE_COLOR tooling warning |
| Report browser suite | Pre-existing motion-duration assertion failure, line95 | Unchanged owner; not rerun without a relevant production change |
| Health browser suite | Pre-existing duplicate calendar locator, line139 | Six focused registration groups pass; unchanged health owner |
| Verification browser suite | Pre-existing uppercase accessible-label timeout, line200 | Same locator timeout,line201 after fixture stub; initial import regression fixed (`logs/final4-verification-ui.txt`) |
| Focused location browser fixture | Supporting group pass before final branch | Three groups pass, no captured diagnostics (`logs/final3-location-ui.txt`) |

The two lint warnings are the existing birthday-wheel `ROW_HEIGHT` effect dependency and unused `useState` in health presentation. Focused browser derivatives retain the production handlers/guards, exercise compact themes/fonts, late geocode/manual input, save failures/write locks, map retry/GPS denial/boundary gating, input/draft identity across keyboard transitions, and one Save action. They supplement native evidence and do not certify native keyboard/caret behavior. Native sampled logs contain the existing Firebase push-token configuration warning. Full inspector Runtime/console monitoring was unavailable, so comprehensive zero-runtime-warning acceptance remains pending.

## Acceptance and remaining work

| Criterion | Status |
|---|---|
| Correct the reproduced A05 map/body/footer obstruction | Met for the recorded native focus/action configurations; full protocol pending |
| A01–A07 complete §9 per-field protocol and matrix | Pending manual verification; see `ledger.md` |
| Independent A04 picker and report draft return | Met for sampled native return; remaining protocol pending |
| Conditional Age/prior-dose editors and footer | Met for sampled native focus/typing; consent/error growth and matrix pending |
| Three restoration cycles for changed A05 surface | Met for default and settled larger-display cycles; earlier41px initial difference unresolved |
| Preserve map/geocode/domain guards and iOS policy | Met by owned-source review and supporting fixtures; native map interaction regression and runtime qualification pending |
| No new automated errors/failures | Met; baseline warnings/failures remain separate |
| Complete native console/source identity qualification | Pending manual verification |
| Preserve existing user work | Met for snapshot scope: three owned paths; late external Profile/birthday-picker/test changes detected, retained and recorded separately; see preservation audit |

Next owner-attended MuMuPlayer steps are explicit in `ledger.md`. The native automation could not reliably establish document-start/middle caret selection or the controlled Submit/error state after multiple different interaction approaches; do not infer these passed. No further speculative code changes were made from failed test setup. Physical devices, other emulators, native iOS and release-APK certification are outside the current plan gate and were not performed. No later phase, commit, push, deployment, remote migration or external configuration change was performed.

Plan discrepancies: the broader baseline/next-order narrative is stale and left unchanged outside the selected phase; `map-view.native.tsx` is absent and `map-view.tsx` is the actual source. No repository-instruction conflict was found. Expo's general pan recommendation was not applied to the plan's explicit resize policy. See the context index for prerequisite, documentation and Repomix evidence.

Final preservation review detected three concurrent external edits after the earlier checks: Profile switched birthday picker, birthday-wheel presentation/effect dependencies changed, and its browser test changed. These are user-owned and were not edited or reverted by Phase4. Final5 checks requalify the combined working copy; the earlier final3 results still identify the exact Phase4 candidate before those external edits. The external birthday-wheel edit removes one of the two earlier lint warnings. No extra Profile feature work was performed here.
