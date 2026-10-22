# Phase 11 — DRRM Scan and Family

20 October 2026, Asia/Manila. **Partially complete:** implementation and automated validation delivered; native/integration/fidelity gates remain pending. No deployment, commit, push, remote migration, real check-in, household mutation or external share was performed.

## Delivered behavior

| Requirement | Owned files and result |
|---|---|
| Guide and aliases | `qr-guide-content.tsx`, `authenticated-scan-view.tsx`, Emergency Info `index.tsx`, both `qr-guide.tsx` aliases and `scan.tsx`: one real guide, 26dp heading, 20dp rhythm, managed reason/numbered steps, loading/empty/offline/error/Retry, correctly directed aliases, no extra whole-screen entrance. |
| Scanner and permissions | `qr-scanner-overlay.tsx`, `qr-permission-modal.tsx`: schema/barangay checks retained; synchronous event lock; camera removed on close/focus loss/background/processing/result/error; old response cannot trigger household update in a newer scanner session; mount-error Retry; permission exceptions/denial/permanent denial/settings recovery; selected font/accent and 200ms opacity. |
| QR/center/member sheets | `qr-show-modal.tsx`, `family-member-modal.tsx`, `household-qr-modal.tsx`, new `drrm/scan-family-sheet.tsx`: M04 280ms panel/200ms scrim, center picker 200ms panel/180ms scrim, reduced motion <=100ms opacity, interrupted exits cleaned up, keyboard-aware body and pinned member actions. Sorted center picker, address, stable validated evacuation JSON, explicit share/save failures and cancellation, Expo Go guard and capture cleanup. |
| Family and Profile | `family-content.tsx`, new `drrm/household-code.tsx`, `use-profile-household-members.ts`: compact 152dp server QR, divided member rows, full-width Add, real image loading/error/Retry, authenticated same endpoint in inline/full views, preserved member/role choices and unknown stored role, async save failure retains input, busy guard and removal confirmation. Existing profile JSONB read/write remains the data path; real Retry, profile refresh after save and household-change refresh replace the old no-op refetch. |
| Shared presentation | `primary-button.tsx`: opt-in `secondaryAccent` for the guide/download outlines; existing variants unchanged. `drrm/presentation.tsx`: opt-in compact managed icon. `use-report-modal-motion.ts`: optional scrim duration with unchanged existing defaults. Existing `TextField`, themed text, reduced-motion hook and interactive chevron row reused. |

No new dependency, backend/schema/RLS/policy change or data subscription. Camera/AppState and reduced-motion listeners have cleanup; these presentation listeners are covered by the fixture. Replaced presentation bodies were removed inside their existing modules; all route files/exports remain. `horizontal-center-picker.tsx` is retained as an existing out-of-scope file, not deleted based on a text search. No asset was added.

## Baseline and checks

Exact logs and byte snapshots: [execution directory](../../../../tmp/resident-android-magicpatterns-phase-11-20261020). [Context index](../../../../tmp/resident-android-magicpatterns-repomix/phase-11-drrm-scan-family.context.md). [Audit, source identities and bundle/assets](../../../../tmp/resident-android-magicpatterns-phase-11-20261020/audit.json). [Recoverable owned patch](../../../../tmp/resident-android-magicpatterns-phase-11-20261020/owned.patch), reverse applicability checked without applying it.

| Check | Baseline | Final |
|---|---|---|
| Android `tsc --noEmit` | Pass, exit 0 | Pass, exit 0 |
| Android `expo lint` | Pass, zero errors; two Health `import/no-duplicates` warnings | Pass, zero errors; same two warnings |
| Android Vitest (including setup-navigation) | Pass, 25 files / 260 tests | Pass, 25 files / 260 tests |
| Android Hermes export | Initial temp-folder error; diagnosed workspace TEMP/TMP retry passed | Pass; no export diagnostics |
| New actual-component/household-hook fixture | Not present | Pass, 12 groups, zero console errors/warnings |
| Existing Services list fixture | Not rerun at baseline | Pass, 7 groups, zero console errors/warnings |
| Existing Hub/Alerts fixture | Post-edit baseline replay with original changed primitives passed, 7 groups | Isolated candidate passes 7 groups; first concurrent run timed out on Alerts Clear; see diagnostic below |
| Owned whitespace/diff/reversal; dependency lock | Working/staged patches and real working-copy snapshots saved before edits | Pass; owned reverse patch applies in check-only mode; lock unchanged |

The first new-fixture attempts exposed adapter issues (mock syntax/initialization and a strict locator during overlapping exiting modals). An expanded test initially awaited its intentionally held scan promise; that fixture call was corrected to dispatch without awaiting. Assertions were retained. These were test harness fixes, not hidden application diagnostics.

The first Hub/Alerts regression run timed out waiting for `Showing 3 of 3 alerts` after Clear, while export and other work ran concurrently. Its four preceding groups and console checks were clean. To distinguish this from the two opt-in primitive changes, a scratch copy replayed the **saved baseline primitives** with the same assertions. After supplying its original app tsconfig (the first scratch bundle could not resolve aliases), all seven groups passed. The unchanged candidate then passed all seven groups in isolation. This is an intermittent observation, **not a proven pre-existing failure** or a claimed Alerts fix. Alerts source and its existing test were not edited; the failed run and both passing diagnostic runs are retained.

Hermes bundle: **8,293,380 → 8,286,380 bytes** (−7,000; approximately −0.084%). All **53 asset paths, sizes and hashes are identical**. This is a bundling result, not a native performance measurement.

## Direct automated acceptance coverage

The new [fixture](../../../../apps/resident-android-mobile/tests/drrm-scan-family-ui.mjs) uses actual components, schema, theme/font/motion hooks and household hook, with native APIs and data transport adapted. [Results](../../../../tmp/resident-android-magicpatterns-phase-11-20261020/ui-final/results.json) and [captures](../../../../tmp/resident-android-magicpatterns-phase-11-20261020/ui-final) are supplementary browser evidence. QR drawing and server images are synthetic adapters; blank optical surfaces in these captures are **not** native QR-generation evidence.

- Managed content retained during errors; offline/Retry and loading/empty states.
- Permission denial/permanent denial/settings/API exception; invalid/wrong-barangay QR.
- Eight synchronous native-event callbacks produce one check-in and household update; close/reopen while pending cannot resubmit or apply an old household update.
- Close, focus loss, two background cycles and camera mount-error Retry remove camera instances; all owned app/motion listeners clean up.
- QR identity survives theme and fresh center-object renders; alphabetical choices change center ID/address/JSON, not QR protocol. Empty/loading/error centers disable unavailable actions.
- Share failure and cancellation; denied gallery permission, capture failure, successful Asset/Album calls and released capture.
- Actual household hook read/write shape, generated UUID, retained input on failed save, duplicate/close guard while saving, update, confirmed removal/cancel, Profile refresh/external update, unknown stored role and malformed JSON blocking edits.
- Authenticated same household endpoint inline/full, image error/retry, account separation.
- 320/360/400/412 widths, light/dark, extreme saved accents, serif and all ten offered form fonts; five sheet cycles; declared normal 280/200/180ms and reduced <=100ms configurations. This does not measure native motion or system font scaling.

## Acceptance status

| Criterion | Status / evidence |
|---|---|
| Guide actions, aliases, managed content, error/empty/loading feedback and preference-aware presentation | **Met** in source/export/actual-component fixture; native visual comparison is separate below |
| Existing payload validation, barangay isolation and synchronous duplicate-scan guards | **Met** in real schema/handler fixture; real server integration remains pending below |
| Native permission allow/deny/revoke, successful decode and release on every close/Back/background path | **Pending manual verification**; adapter lifecycle checks pass |
| QR selection/share/download in SDK57 development build and OS cancellation/denial | **Pending manual verification**; controller/error/cleanup adapters pass |
| Household add/edit/remove and Profile/canonical table synchronization against disposable records | **Pending manual verification**; actual hook/transport fixture passes; DB trigger unchanged/read only |
| Reference/native fidelity, M04/M10/M11 execution, keyboard/TalkBack/focus return, size/font scale and performance/resource gates | **Pending manual verification**; declared animation and browser layout checks pass |
| Frontend scope, no new dependencies/assets, no altered QR/queue/canonical persistence contract; recoverable changes | **Met**, source/hash/diff/export audit |

## Reference, discrepancies and adaptations

- The editor currently displays **v35**, artifact `f653f2b7-7442-4163-9c7d-b8db16117d63`. Read-only version preview selected **v32**, matching the plan's `df178e1c-7b6e-4d98-8334-06f3a00f28c3`; no Restore or project edit occurred. V32 Scan guide/Show QR and retained matching Scan/Family/member/center source were inspected. Later Reports changes are outside this phase.
- Root `AGENTS.md` was already empty; `CLAUDE.md` only references it. There are no applicable nested/parent rules. Historical references to old AGENTS sections in comments/evidence were not treated as current instructions. No current instruction conflict was found. The plan's top-level planning-only status is historical; this execution updates only Phase11 sections.
- The plan's index QR alias still contained a placeholder and the other guide alias returned Hub; both now reach the real Scan guide. The old authenticated scan screen duplicated a whole guide; it now wraps the single shared guide.
- Shared household schema enums differ from the existing Android title-cased choices/free-form stored roles. Actual JSONB/Profile/mirror-trigger semantics govern this presentation; those choices and unknown existing values remain, rather than silently converting records. The existing query shapes stay unchanged; profile refresh plumbing is a strictly needed prerequisite for the phase's sync requirement.
- Optical QR/camera surfaces, existing system-font approximations/Ionicons, dark-role derivation, wrapping/44dp hit areas and native stack behavior remain documented native adaptations. Share retains the existing **text payload** contract rather than adopting the prototype's image-file sharing. Scanner results use one accessible inline state so decoding stops while a resident reads the result; they do not claim success for queued/error results. Member removal now requires explicit confirmation.
- Picker source specifies 180ms scrim / 200ms scale+fade; the generic M04 row does not describe this special dialog. This phase follows that inspected source. Reduced motion removes geometry and uses <=100ms opacity.
- Existing queue behavior enqueues any failed insert and clears attempted sync entries. It was inspected and left unchanged; queue policy/reliability changes are out of scope. No live queue/check-in result is claimed. Existing Health lint warnings are also out of scope.

## Exact remaining native steps

ADB read-only discovery succeeded only after allowing the installed daemon to run; it lists **`emulator-5554 offline`**, with no online device. No candidate-native test, screenshot or timing measurement is claimed. Do not apply permissions, switch a real account or mutate real records for acceptance.

1. Start/connect MuMu's SDK57 development build; identify an **online explicit serial**. Record package/build, API, logical size/density, font scale and navigation mode. Serve this exact working tree with the existing development-client workflow. Keep the current account/data intact; use an approved disposable fixture account for mutations.
2. Open `/drrm?tab=scan`, `/home/emergency-info?tab=scan`, both guide aliases and `/home/emergency-info/scan`; verify guide-before-camera, guest gate, Back/history/tab visibility. Compare Guide and Family top/scrolled states to v32 at matching logical widths.
3. Allow/deny/revoke camera; retry from Settings and camera failure. Scan schema-invalid, wrong-barangay and a safe valid disposable-center payload. Hold the code in view, close/reopen rapidly, press hardware Back, background twice and blur the route. Confirm one operation, truthful queue/result feedback, no stale result or retained camera/green privacy indicator after closure; inspect native logs.
4. Open Show QR and alphabetical center picker five times; cancel picker/backdrop/Back, select changed/deleted/empty centers, share then cancel, deny then allow gallery access, save and decode the saved QR to compare its JSON with the selected center. Use the development build; separately verify the ExpoGo guard without importing the unsupported module. Do not send the QR to anyone.
5. In disposable household data, test empty/add/failed save/retry/update/removal cancel/confirm; switch to Profile and back, make a disposable Profile edit and verify Family refresh. Inspect canonical rows read-only as authorized; compare inline/full server QR. Restore the fixture through its approved test workflow.
6. Check light/dark, default/blue/warm/extreme accents, ten fonts, 320/360/400–412dp, font scales 1.3/1.5, short-height keyboard, gesture/three-button insets, TalkBack labels/radios/busy/errors, modal focus entry/return and pinned footer reachability. No clipping or touch blockers.
7. Capture normal/reduced M04/M10/M11 and picker transitions, five entry/exit reversals and ten warm repetitions; compare baseline/candidate JS/UI frames/resources/logs on the same device. Record actual durations/frame data; do not infer native smoothness from the browser fixture.

Phase12 has not been started.
