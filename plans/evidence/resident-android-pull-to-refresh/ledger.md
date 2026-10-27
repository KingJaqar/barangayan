# Pull-to-refresh verification ledger

Columns: screen ID · check · device/API/build · theme/accent/font · result (pass / fail / not observed) · evidence reference.
Rows are appended by the phase that runs the check. Nothing is recorded as `pass` without a log or observation behind it.

## Phase 0 baseline (25 Oct 2026, HEAD `d9253f0d`, working tree with other sessions' uncommitted changes)

Environment: automated checks only; no device (Node 24.13.1, Brave as Chromium per D8). Details: [phase-0/baseline-summary.md](phase-0/baseline-summary.md).

| Screen ID | Check | Device/API/build | Theme/accent/font | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| all | `tsc --noEmit` | n/a | n/a | pass (exit 0) | phase-0/typecheck.log |
| all | `vitest run` | n/a | n/a | pass (32 files, 335 tests) | phase-0/vitest.log |
| 19 edit files | source `eslint` | n/a | n/a | pass (exit 0, no output) | phase-0/eslint-source.log |
| all | `expo export --platform android` | n/a | n/a | pass (exit 0, 1 bundle) | phase-0/export-android.log |
| shared | 14 of 16 regression `tests/*.mjs` | Brave | n/a | pass | phase-0/tests/_summary.txt |
| R-23 | `services-lists-ui` | Brave | n/a | fail, pre-existing (duplicate `No payment required` locator) | phase-0/tests/services-lists-ui.log |
| R-16 | `home-presentation-ui` | Brave | n/a | fail, pre-existing (esbuild has no `.png` loader for `services-tab-icon.tsx`) | phase-0/tests/home-presentation-ui.log |
| shared | `navigation-regressions.mjs` | Brave | n/a | 14 of 15 pass; `services-lists-ui` fails (pre-existing) | phase-0/tests/navigation-regressions.log |

## Phase 1 (25 Oct 2026, primitive + `useProfile`; automated only, no device)

Environment: Node 24.13.1, Brave as Chromium (D8). Logs in [phase-1/](phase-1/). The primitive is not attached to any screen yet, so no device row applies.

| Screen ID | Check | Device/API/build | Theme/accent/font | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| shared | `tests/pull-refresh-ui.mjs` (8 groups: single flight, failures, 20 s ceiling/timers, registration, loop guard, no scope, theme tokens light/dark x 2 accents, unmount) | Brave | light/dark, 2 accents (tokens only) | pass (`errors: []`); mutation check (timer clear removed) makes it fail | phase-1/pull-refresh-ui-results.json |
| shared | `tsc --noEmit` | n/a | n/a | pass (exit 0) | phase-1/typecheck.log |
| shared | `eslint` on `pull-refresh.tsx`, `use-profile.ts`, 3 edited tests | n/a | n/a | pass (exit 0, no output) | phase-1/eslint.log |
| shared | `expo export --platform android` | n/a | n/a | pass (exit 0, 1 bundle) | phase-1/export-android.log |
| shared | `refresh-ownership` | Brave | n/a | pass; metrics equal baseline (`dataConsumerCommits 0`, `cacheWrites 0`, `totalRequests 60`, `rpcCalls 1`, `errors []`); first run timed out, see note | phase-1/refresh-ownership-rerun.log |
| R-16 | `home-presentation-ui` | Brave | n/a | pass, `errors []`; passes with the `.png` harness fix before and after the code change | phase-1/home-presentation-ui-baseline-after-harness-fix.log, phase-1/home-presentation-ui.log |
| shared | `settings-profile-ui`, `health-presentation-ui`, `help-legal-about-ui`, `services-tab-stability` | Brave | n/a | pass (equal to Phase 0) | phase-1/*.log |
| R-34, R-36, R-39 | `reports-announcements-ui` | Brave | n/a | pass; same 2 react-native-web deprecation entries as baseline | phase-1/reports-announcements-ui.log |
| R-23 | `services-lists-ui` | Brave | n/a | fail, pre-existing and identical to Phase 0 (duplicate `No payment required` locator) | phase-1/services-lists-ui.log |

Note on the first `refresh-ownership` run: `page.evaluate(() => window.profile.refetch())` now returns the promise, and Playwright awaits it, so two expression-bodied calls waited for replies the test sends later (30 s `waitForFunction` timeout, `phase-1/refresh-ownership-first-run-harness-deadlock.log`). Diagnosed once and fixed by wrapping them as `{ void window.profile.refetch(); }`; no source change.

## Phase 2 (25 Oct 2026, working tree with other sessions' uncommitted changes)

Environment: Brave via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; device `emulator-5554` (SM-S918U, API 32, 1080x1920, dev client `com.barangayan.resident.dev`, Metro :8081, signed-in test account, light, default accent, normal font, read-only gestures). Logs: [phase-2/](phase-2/).
| Screen ID | Check | Device/build | Theme/accent/font | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| R-23 | `pull-refresh-services-ui` (Documents/Logs/Requests wiring, failed pull, one control per segment) | Brave | light, default | pass (`errors []`); mutation removing the Logs registration makes it fail | phase-2/pull-refresh-services-ui.log |
| R-34 | `health-presentation-ui` incl. day-list, month-view and My Registrations pulls | Brave | light/dark in existing groups | pass (`errors []`) | phase-2/health-presentation-ui-wiring.log |
| R-36 | `reports-announcements-ui` incl. reports-list pull | Brave | light/dark in existing groups | pass; same 2 baseline deprecation entries | phase-2/reports-announcements-ui-wiring.log |
| shared | `refresh-ownership`, `services-tab-stability`, `pull-refresh-ui` | Brave | n/a | pass; `refresh-ownership` metrics equal baseline (0 commits, 60 requests, 1 RPC) | phase-2/*-after-code.log |
| R-23 | `services-lists-ui` | Brave | n/a | fail, pre-existing, same message as Phase 1; further stale at `₱10.00 per page` after one `.first()` fix (reverted) | phase-2/services-lists-ui-after-code.log, services-lists-ui-first-fix.log |
| shared | `tsc --noEmit`; `eslint` on the 6 source files; `expo export --platform android` | n/a | n/a | pass (exit 0 each) | phase-2/typecheck.log, eslint.log, export-android.log |
| R-23 Documents, Requests | C1 pull at top shows themed spinner; Services pull also reloads profile | emulator, dev client | light, default, normal | pass | observed 25 Oct (screenshots in the session scratchpad, not archived) |
| R-34 drives | C1 | emulator | same | pass | same |
| R-36 | C1 (inside the list area only) | emulator | same | pass | same |
| R-23 Documents | C2 drag at a scrolled position does not trigger | emulator | same | pass | same |
| R-23, R-34, R-36 | C12 device log after the pulls: 0 `ReactNativeJS` W/E, 0 `AndroidRuntime` E | emulator | same | pass | adb logcat |
| R-23 Logs | C1 pull at top, themed spinner, rows kept | emulator, dev client | light, default, normal | pass | observed 25 Oct (session scratchpad, not archived) |
| R-34 My Registrations | C1 and C10 (empty list for this account) | emulator | light, default, normal | pass | same |
| R-34 My Registrations | C5 two quick pulls: no error, no stuck spinner (request count not observable on device) | emulator | light, default, normal | pass (behavioral) | same |
| R-23 Documents, Requests, Logs; R-34 drives; R-36 | C7 dark mode with red preset accent: readable accent spinner on the dark card | emulator | dark, red preset, normal | pass (Documents, Health, Reports inspected; Requests and Logs pulled and logged, screenshots not opened) | same |
| shared | C12 device log across the follow-up: 0 `ReactNativeJS` W/E, 0 `AndroidRuntime` E; theme restored to light/default green | emulator | n/a | pass | adb logcat |
| all Phase 2 | C3, C4, C6, C8 (system font size), C11 (TalkBack), status-strip diagonal drag, custom non-preset accent | n/a | n/a | not observed | pending manual verification (plan Phase 2 note) |

## Phase 3 (25 Oct 2026, working tree with other sessions' uncommitted changes)

Environment: Brave via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; device `emulator-5554` (API 32, 1080x1920, dev client `com.barangayan.resident.dev`, Metro :8081, signed-in test account, light, default accent, normal font, read-only gestures). Logs: [phase-3/](phase-3/).
| Screen ID | Check | Device/build | Theme/accent/font | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| R-16 | `home-presentation-ui` incl. new pull group (queries, profile refetch, new data, failed/rejected pulls, single flight, account switch, unmount) | Brave | light/dark in existing groups | pass (`errors []`) | phase-3/home-presentation-ui-after-code.log |
| R-39 | `reports-announcements-ui` incl. new announcements pull group; mutation removing `!quiet` fails it | Brave | light/dark in existing groups | pass; same 2 baseline deprecation entries; one unrelated flaky failure on the first run (`Large report 49`), pass on rerun | phase-3/reports-announcements-ui-1.log, -2.log, -after-code.log, mutation-announcements-quiet.log |
| shared | `refresh-ownership`, `pull-refresh-ui`, `pull-refresh-services-ui`, `health-presentation-ui`, `services-tab-stability`, `settings-profile-ui`, `help-legal-about-ui` | Brave | n/a | pass; `refresh-ownership` metrics equal baseline (0 commits, 60 requests, 1 RPC) | phase-3/*-after-code.log |
| shared | `tsc --noEmit`; `eslint` on 3 source files; `expo export --platform android` | n/a | n/a | pass (exit 0 each) | phase-3/typecheck.log, eslint.log, export-android.log |
| R-16 Home | C1 pull from the greeting area: themed spinner, content stays | emulator, dev client | light, default, normal | pass | observed 25 Oct (screenshots in the session scratchpad, not archived) |
| R-16 Home | C2 drag after scrolling away from the top: no spinner | emulator | same | pass | same |
| R-39 Announcements | C1 pull inside the list: themed spinner, cards stay | emulator | same | pass | same |
| R-16, R-39 | C12 device log: 0 `ReactNativeJS` W/E, 0 `AndroidRuntime` E | emulator | same | pass | adb logcat |
| R-16, R-39 | guest, C3, C4, C5 (device), C6, C7 (these screens), C8, C11, chevron-row diagonal drag | n/a | n/a | not observed | pending manual verification (plan Phase 3 note) |

## Phase 4 (25 Oct 2026, working tree with other sessions' uncommitted changes)

Environment: Brave via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; device `emulator-5554` (API 32, 1080x1920, dev client `com.barangayan.resident.dev`, Metro :8081, signed-in test account, light, default accent, normal font, read-only gestures). Logs: [phase-4/](phase-4/).
| Screen ID | Check | Device/build | Theme/accent/font | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| R-18/R-19 | new `pull-refresh-emergency-ui`: Hub = guidelines + hotlines only; failing source does not stop the rest; spinner waits and a second pull in one flight starts nothing; Alerts = alerts only; Scan = QR only; Family awaits members + attendance; tab switch re-registers; switch mid-pull; Centers has no control; unmount mid-pull; guest tabs register nothing; four real hooks return a promise that resolves after the response and on failure | Brave | light | pass (`errors []`); mutations (no Family registration; no `return` in hotlines) each fail it | phase-4/pull-refresh-emergency-ui-3.log, after-pull-refresh-emergency-ui.log, mutation-*.log |
| shared | baseline `drrm-hub-alerts-ui`, `drrm-scan-family-ui`, `resident-search-explore`, `-session`, `-submit`, `resident-shell-lifecycle`, `drrm-centers-ui`, `tsc` before editing | Brave | n/a | all exit 0 | phase-4/baseline-*.log |
| shared | same tests after the change, plus `refresh-ownership`, `pull-refresh-ui`, `pull-refresh-services-ui`, `home-presentation-ui` | Brave | n/a | pass; `refresh-ownership` metrics equal baseline (0 data-consumer commits, 0 cache writes, 60 requests, 1 RPC); `resident-search-explore` failed once at `See all My reports` (5 s timeout, concurrent with device work), passed on an idle rerun | phase-4/after-*.log, after-resident-search-explore-rerun.log |
| shared | `tsc --noEmit`; `eslint` on 7 source files + new test; `expo export --platform android` | n/a | n/a | pass (exit 0 each); first `tsc` failed once (`PromiseLike` vs `Promise`), fixed | phase-4/typecheck-1.log, typecheck-final.log, eslint-final.log, export-android.log |
| R-18 Hub | C1 pull from the top: themed spinner over the content, content stays | emulator, dev client | light, default, normal | pass | observed 25 Oct (screenshots in the session scratchpad, not archived) |
| R-18 Alerts / Scan / R-19 Family | C1 pull: themed spinner, content stays on each tab | emulator | same | pass | same |
| R-18 Centers | swipe in the list: no spinner, list unchanged | emulator | same | pass | same |
| R-18, R-19 | C12 device log after the pulls: 0 `ReactNativeJS` lines, 0 `FATAL EXCEPTION` (the `AndroidRuntime` lines are the `uiautomator` launcher) | emulator | same | pass | adb logcat |
| R-18, R-19 | LDPlayer follow-up (same day): device `SM-S9280`, Android 9, 1080x1920, dev client `com.barangayan.resident.dev` on the running :8081 Metro via `adb reverse`, signed-in test resident, read-only gestures. C1 pull on Hub, Alerts, Family: themed spinner, content stays; Scan and Centers covered by the harness plus the MuMu pilot | LDPlayer | light, default | pass | observed 25 Oct |
| R-18 Alerts | diagonal drag started on the chip row (the chevron row) triggers the spinner and does not scroll the chips | LDPlayer | light, default | pass | observed 25 Oct |
| R-18 | tab switch mid-pull (Hub to Alerts): spinner continues on the same scroller, content intact, spinner ends (pixel check) | LDPlayer | light, default | pass | observed 25 Oct |
| R-18, R-19 | C8 system font scale 1.3 (largest on Android 9): Hub and Family show the spinner over the content with no clipping from the control; Alerts and Scan spinner confirmed by a pixel check only; scale restored to 1.0 | LDPlayer | light, default, 1.3 | pass (the floating tab bar label "Services" wraps to "Service/s" at this scale, an existing issue outside this phase) | observed 25 Oct |
| R-18, R-19 | C7 Dark + purple preset accent: spinner readable on the dark card on Hub, Alerts, Family, Scan (purple pixels found on all four); theme restored to Light + default green and verified in Settings | LDPlayer | dark, purple | pass | observed 25 Oct |
| R-18, R-19 | C12 device log for the LDPlayer session: 0 `FATAL EXCEPTION`, no `ReactNativeJS` lines other than the existing "Failed to get Expo push token" warning (dev client without Firebase) | LDPlayer | n/a | pass | adb logcat |
| R-18 Hub | C4 offline-style on LDPlayer: root `iptables` REJECT of outbound tcp/443 (removed afterwards, verified empty on both devices), pull on Hub: spinner stayed through the whole 20 s window and ended at the ceiling (about 21 s), content unchanged, no error banner (requests hang, they do not fail), no JS errors; after unblocking, three pulls each showed the spinner normally | LDPlayer | light, default | pass | observed 25 Oct (time series of screenshots, scratchpad) |
| R-18 | C5/C1 request count on device from the Supabase API logs (read-only): each Hub pull = exactly one `category=guidelines` and one `category=hotlines` request to `emergency_information`, status 200 (other sessions share the devices, so only isolated pulls were counted) | LDPlayer | light | pass for one pull; overlapping double pull stays covered by the harness only | observed 25 Oct |
| R-19 Family | C6 app backgrounded then foregrounded (Family refreshes on foreground) with a pull started at once: spinner showed and ended, QR and members stayed, no `ReactNativeJS` lines, no fatal | LDPlayer | light | pass (request counts not isolated) | observed 25 Oct |
| R-18 | C7 custom (non-preset) accent #912B69 saved through the colour picker: the Hub spinner uses it; the colour was then removed (0/10 saved) and the default green restored (header 15,110,91) | LDPlayer | light, custom | pass | observed 25 Oct |
| R-18, R-19 | Guest on a device: logged the test resident out in the LDPlayer dev client (pre-approved), Browse as guest: spinner shows on Hub, Scan, Family, Alerts; Scan and Family show the login callout and the pull ends with nothing loaded; no errors in the log | LDPlayer | light | pass | observed 25 Oct |
| R-18, R-19 | C11 TalkBack: enabled on LDPlayer (service active, app stayed stable), then restored to the original accessibility setting; adb cannot inject TalkBack gestures, spoken output was not captured and the focus walk was inconclusive | LDPlayer | n/a | not observed (stable only) | pending manual verification with a person using TalkBack |
| R-18 Hub | C3 data changed on a backend, on an isolated stack: Docker containers (supabase Postgres 17 with the real `emergency_information` shape and the guest read policy, PostgREST v14.5, a small `/rest/v1` proxy on 127.0.0.1:58399) and a separate Metro on :8099 with `EXPO_PUBLIC_SUPABASE_URL` pointing at it (bundle checked: isolated URL present, production host absent); LDPlayer dev client as a guest through `adb reverse`. Changed one title and added one guideline in the isolated DB: the screen stayed unchanged (no realtime in the stack), then one pull showed the changed title and the added row, content never blanked | LDPlayer | light, default | pass | observed 25 Oct (screenshots in the scratchpad) |
| R-18 Hub | C4 failure banner against the isolated API: PostgREST stopped, pull: spinner ended, the existing "Unable to refresh guidelines. Showing available offline information." banner, Offline badge and Retry appeared with the changed rows kept; after restarting PostgREST one pull cleared the banner and the data was current | LDPlayer | light, default | pass | observed 25 Oct |

## Phase 6 / IG2 (25 Oct 2026, working tree with other sessions' uncommitted changes)

Environment: Brave via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; devices MuMu `emulator-5554` (SM-S918U, API 32) and LDPlayer `192.168.254.131:5555` (SM-S9280, Android 9), both 1080x1920, dev client `com.barangayan.resident.dev` on the :8081 Metro, signed-in test account, light, default accent, normal font, read-only gestures. Logs: [phase-6/](phase-6/).
| Screen ID | Check | Device/build | Theme/accent/font | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| all | `tsc --noEmit` (before and after the one type-keyword edit) | n/a | n/a | pass (exit 0) | phase-6/typecheck.log, typecheck-final.log |
| all | `vitest run` | n/a | n/a | pass (335 tests, equal to Phase 0) | phase-6/vitest.log |
| 20 source files + 9 tests | `eslint` | n/a | n/a | pass (exit 0; 1 warning at `health-presentation-ui.mjs:107`, a line this work did not touch) | phase-6/eslint.log |
| all | `expo export --platform android` | n/a | n/a | pass (exit 0) | phase-6/export-android.log |
| all | full harness: 31 `tests/*.mjs` including `navigation-regressions` | Brave | n/a | 29 pass, 2 fail (next two rows); `services-lists-ui` and `home-presentation-ui` now pass; `refresh-ownership` metrics equal baseline (0 data-consumer commits, 0 cache writes, 60 requests, 1 RPC) | phase-6/summary.txt, tests/ |
| shared | `resident-search-explore` | Brave | n/a | fail, not caused by this work: same failure (`See all My reports` not visible) on two reruns and in a clean HEAD `d9253f0d` checkout; cause undiagnosed | phase-6/tests/resident-search-explore*.log |
| Settings location | `verification-sensitive-ui` (`Detect Your Location` click timeout) | Brave | n/a | fail, not caused by this work: bundles no touched file (mocks `useProfile`); identical on clean HEAD | phase-6/tests/verification-sensitive-ui*.log |
| R-17 .. R-28 | `tracking-payment-ui` mutations: tracking pull no-op; payment control removed | Brave | n/a | each fails the test (restored, hashes `e641e41d`, `90920ec8`) | phase-6/tests/mutation-*.log |
| shared | `pull-refresh-ui` after removing the unused `export` on a type | Brave | light/dark tokens | pass | phase-6/tests/pull-refresh-ui-final.log |
| shared | dependency diff (`package.json`, lockfile) | n/a | n/a | pass (empty) | git diff |
| R-17 tracking | C1 pull at top: themed spinner, all cards stay | MuMu | light, default, normal | pass | observed 25 Oct (scratchpad, not archived) |
| R-17 tracking | C2 drag after scrolling: page scrolls, no spinner | MuMu | same | pass | same |
| R-16 Home | C4 offline-style (REJECT tcp/443): spinner 3 s and 12 s, gone by 22 s, cards unchanged | LDPlayer | same | pass | observed 25 Oct |
| R-23 Requests, R-36 Reports, R-34 My Registrations | C4 with screens loaded first: spinner at 6-8 s, gone by 26-27 s, rows kept; Requests clock chips degrade to "Processing clock unavailable. Please retry." (existing row-clock result) and an online pull restores them | LDPlayer | same | pass, with the clock observation | observed 25 Oct |
| shared | C12 device logs after all device work: 0 `ReactNativeJS` warning/error, 0 `FATAL EXCEPTION`; network block removed and verified empty | both | n/a | pass | adb logcat, `iptables -S` |
| R-26/R-28 payment status | pull on a device; flicker against the 10 s poll | n/a | n/a | superseded: observed in the follow-up rows below | plan Phase 6 note |
| R-17 | two tracking instances, clean log | n/a | n/a | not observed (see follow-up row) | plan Phase 6 note |
| signed-in screens | C3 data changed on a backend (isolated authenticated stack not built); C11 TalkBack; guest on Home/Announcements/Documents | n/a | n/a | not observed | plan Phase 6 note |
| R-26/R-28 payment method | C1 pull: themed spinner, amount card and both method rows stay; 12 frames over a poll tick pixel-identical below the title (no flicker); no row tapped | MuMu | light, default, normal | pass | observed 25 Oct (owner-approved read of the request id) |
| R-17, R-26/R-28 | C4 offline-style on LDPlayer with a fresh bundle: spinner at 0.5 s, gone by about 25 s | LDPlayer | same | pass (after relaunching the dev client; the first attempts hit a stale bundle) | observed 25 Oct |
| R-16, R-34, R-36, R-17, R-26/R-28 | C8 system font scale 1.3 (restored to 1.0): spinner shown without clipping on Home, Health, Reports, tracking, payment | LDPlayer | light, default, 1.3 | pass | observed 25 Oct |
| R-17 | two tracking instances: deep links reuse one instance, success push not reproducible without paying | MuMu | same | not observed | plan Phase 6 note |

## Settings screens extension (25 Oct 2026, owner request; logs in phase-6/)
| Screen | Check | Device/build | Theme/accent/font | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| Valid ID, Email, Location, Manage/Set Password | `pull-refresh-settings-ui` (9 groups: single reload, scroller/form/map/typed fields stay, saving blocked while refreshing, failed pull error view, forms free of control); 3 mutations fail it | Brave | light | pass (`errors []`) | phase-6/tests/mutation-settings-*.log |
| Settings | `settings-profile-ui` new group: one control, one profile read and one setup-status read per pull | Brave | light | pass | phase-6/tests/settings-profile-ui-after.log |
| shared | `tsc`, `eslint` (5 screens + 3 tests), Android export; `document-forms-ui`, `help-legal-about-ui`, `resident-details-loading-ui`, `pull-refresh-ui`, `refresh-ownership` | Brave | n/a | pass | phase-6/settings-*.log, tests/*-after-settings.log |
| shared | `verification-sensitive-ui` | Brave | n/a | fail at the same line as clean HEAD (label "Detect your location" vs test text), not caused by this change | phase-6/tests/verification-sensitive-ui-after-settings.log |
| Settings, Valid ID, Manage Password, Email, Location | C1 pull: themed spinner, content stays; log clean | MuMu | light, default, normal | pass | observed 25 Oct |
| the five | dark/custom accent, largest font, TalkBack, failed pull on device | n/a | n/a | not observed | plan scope-extension note |
