# Phase 5 verification comparison — 23 October 2026 (Asia/Manila)

Phase status: **Partially complete**. The automated recurrence gate and current-source emulator diagnostics are finished. The plan's paired physical release/native presentation and full resident journey acceptance remain pending. The reported universal 1–3 second delay is not certified fixed.

## Changes and baseline

Only tests, their package command, documentation and evidence changed in Phase 5. Production sources and the dependency lock are byte-identical to this phase's working-copy baseline. Existing user/prior-phase edits remain preserved. No dependency, remote data/schema/configuration change, commit, push or deployment was made.

| Requirement | Before this phase | After this phase |
|---|---|---|
| Refresh reuse/cancellation/account isolation | Existing actual-provider tests pass | Adds sign-out during simultaneous private reads, ignored-abort success/failure and retired subscription callbacks; no restored private state or restarted private transport |
| Visibility ownership | Existing hide/show timer tests pass | Ten minutes of virtual time execute ten visible polling periods and ten hidden 45-second periods; six distinct requests each poll once while visible, no hidden work/timer/listener growth |
| Map messages/recovery | Existing equal-data/reload/commands pass | Empty latest owner replaces private map state during reload; thirty equivalent updates send nothing; next owner sends current markers/boundary once |
| Tab/Back/shell | Two-tab tracking reducers and sequential shell actions pass | All thirty directed pairs; nested Services/Health/Reports/Settings retention/Back; rapid accepted and prevented tab presses |
| Recurrence command | No combined navigation gate | `npm run test:navigation --workspace=@barangayan/mobile`: 15 suites, separate logs/artifacts, nonzero exit after failures while independent suites finish |
| Large Reports fixture | Passed baseline; combined run exposed a missed page activation with no cursor read | Scrolls first, uses accessible keyboard activation, waits for actual cursor transport before virtualized row assertions; dedicated and combined corrected runs pass |

The first new polling assertion incorrectly depended on interval insertion order; compare the sorted interval multiset instead. The first Reports readiness correction incorrectly expected an explicit `aria-busy="false"`; inspected DOM omits false accessibility attributes, so the final check rejects true busy/disabled states. These rejected attempts are retained in the task logs, not counted as passing evidence. The pointer activation's browser-level cause is not established; no production button, list or resource was changed to accommodate it.

## Checks actually run

| Check | Baseline | Final |
|---|---|---|
| Expo lint | Pass | Pass |
| App unit tests | 309 tests / 31 files pass | Same 309 / 31 pass |
| Shared routing/client/SLA | Not part of initial app baseline | 85 tests / 3 files pass |
| Focused refresh, hidden work, map bridge, root, installed-Router Back | Pass | Pass with added cases |
| Shell, Services stability/lists, Health, Reports, Maps, DRRM Centers, tracking/payment | Pass | Pass |
| Combined recurrence command | First execution fails the intermittent Reports activation above | All 15 suites pass; final Back-only review passes after removing an unnecessary export and clarifying assertion text |
| TypeScript | Three TS2859 errors in existing `external-link.tsx` lines 9/12 | Exactly byte-identical diagnostics; zero new errors |
| Android production JS/Hermes export | Initial sandbox Temp bytecode write denied; permitted pre-edit baseline passes | Candidate passes; installed release APK not produced or claimed |
| Browser diagnostics | Reports has two existing RN Web deprecations | Same two deprecations, zero new diagnostics; extended refresh/hidden/map fixtures reject console warnings/errors and pass |
| Owned source/context review | Working-copy snapshots, patches, hashes retained | No unexpected production/lock change; final packet union has zero context drift |

See [verification.json](verification.json) and the retained [logs](logs). Initial failed/environment attempts remain under `tmp/resident-nav-phase5-20261023/logs` and `regressions`; final combined logs are retained here. No check is represented as passing solely from an earlier plan mark.

## Current MuMu diagnostic, not a paired performance claim

Thirteen running module factories and mapped originals match current sources. The existing Android 12 MuMu development client is not a source-identified release APK or physical reference device. Search's visible Back control restored the shell; Android's first Back key did not restore tabs. All thirty directed pairs and ten warm circuits were exercised: 127 press events, 126 selected events (initial Home was already selected), 3,099 bounded events and zero drops over approximately 538 seconds.

The runner's optional History lookup stopped after the circuit because it required `content-desc` while the filter exposes visible text. Its recorder was stopped and the intact snapshot recovered separately. The complete Requests → History → Logs → Reports → Home control continuation then passed with zero recorded issues/drops using the actual visible text bounds. It does not establish paging on a representative large account, correct presented frames, scroll restoration or all nested Back behavior on Android.

The summary's 125 matched handler→destination React-commit observations have median **118.0ms**, p95 **207.5ms**, max **776.1ms**. All thirty per-pair summaries are in [native-diagnostic-summary.json](native-diagnostic-summary.json); the aggregate does not replace those rows. The initial runner used the wrong timestamp field for its optional derived summary; the saved analysis uses the actual `atMs` schema and recovered raw samples. Raw capture was unaffected. These intervals exclude input queueing and cannot prove native presentation, cached usability or improvement versus baseline. The historical Phase 0 slow measurements have different sources/warm conditions and are retained as historical evidence, not subtracted from this run to claim a speedup.

The capture has 100 observed reads ending HTTP 200, one map load/ready, one full marker send and one boundary send (initial replay), plus 42 presentation updates. No repeated full marker/boundary send appears during the warm circuit. Native channels, total timers and retained heap were not counted; stable owner counts and virtual-clock tests cannot establish native memory acceptance. One warning from the long native window remains unclassified in bounded console-history metadata, so the long run is **not** claimed warning-free. The separate Services continuation is clean.

## Acceptance ledger

| Phase 5 checklist / exit | Status |
|---|---|
| Native acceptance on baseline and candidate builds | Pending manual verification: identified paired releases, physical device and full matrix unavailable |
| Extend focused lifecycle coverage | Met |
| Run affected existing regressions | Met: final 15 suites pass |
| Static checks and separate unrelated failures | Met: lint/export pass; same three existing type errors recorded |
| Compact comparison and baseline retention | Met: this report, hashes, snapshots, Git patches, logs and raw diagnostic metadata retained |
| Exit: measured improvement passes native targets and journeys | Pending manual verification |

| Section 8 metric | Status / current limit |
|---|---|
| Acknowledgement p95≤100ms | Pending manual verification: synchronized native input/acknowledgement absent |
| Correct destination median≤150ms, p95≤300ms | Pending manual verification: React commit is not presentation |
| Cached content p95≤300ms | Pending manual verification: real loaded-content presentation/interaction absent |
| No repeatable ≥1,000ms stalls | Pending manual verification: no such matched handler→commit observation, native input interval unmeasured |
| No app-caused ≥100ms presentation gaps | Pending manual verification: usable native frame attribution absent |
| Zero redundant same-data full map sends | Supporting fixture/emulator behavior met; paired physical/release acceptance pending |
| Bounded requests/channels/timers | Virtual ownership gate met; real full resource inventory/long-run acceptance pending |
| Ten-minute retained memory within device budget | Pending manual verification: reference budget/heap sampling unavailable |
| Slow/offline destination and cached content | Supporting error/retry fixtures met; physical adverse-network timing pending |

| Section 9 journey | Status / supporting evidence |
|---|---|
| Correct selection/header/content and rapid final destination | Fixture gate met; six-tab emulator selection capture; physical presented-content/rapid gate pending |
| Tab history/nested Android Back | Installed reducers pass all pairs and four nested owners; real full Android Back journey pending |
| Retained lists/segments/map selection/scroll | Existing UI fixtures pass; physical release restoration pending |
| Successful actions update lists/badges | Synthetic mutation/read/registration/report fixtures pass; authorized real create/edit/cancel/register/report/read journeys pending |
| Live hidden badges/notifications | Shared ownership preserved and fixtures pass; real delivery/reconnect pending |
| Sign-out/account isolation | Extended actual-hook deferred-response tests pass; real multi-account/private-map release journey pending |
| Offline/reconnect/profile/server errors | Focused fixtures pass; real adverse-network navigation pending |
| Maps/DRRM boundary/location/route/controls | Existing wrapper/Leaflet/core checks pass; real GPS/permission/closures/avoidance/process recovery pending |
| Background/foreground and permission changes | Actual-hook ownership fixtures pass; device permission/seamless resume pending |
| Search/keyboard/motion/theme/font/accessibility focus | Existing shell/presentation fixtures pass; physical TalkBack/focus/motion acceptance pending |

## Remaining work and exact owner-attended steps

1. Supply access to the physical reference Android device, identified baseline/candidate release APKs from the retained source snapshots and owner-authorized small/large/guest datasets; establish the device memory budget during qualification. The current exported bytecode is not an installed release. Java and Android SDK platforms/build tools are installed, but this app has no local `android` project or matched APK/AAB in the navigation evidence. Its existing EAS configuration offers an internal preview APK; no remote build was dispatched under the user's restriction on sending material to third parties. Identify package/source/native dependency identities before comparing.
2. Follow [navigation-regressions.md](../../../../../apps/resident-android-mobile/tests/navigation-regressions.md) and plan sections 8–9: thirty warm samples per directed pair across at least three runs, native T0/presented T5/T6 synchronization, per-pair median/p95/max and frame/CPU attribution for every outlier. Run separate rapid, no-Maps/after-Maps/active-DRRM, normal/reduced-motion and adverse-network cases.
3. Exercise each journey above on the real account/data scopes, with authorized mutations and account switches. Do not create remote test data or revoke sessions without separate owner authorization. Capture bounded diagnostic metadata without private response bodies or credentials.
4. Measure the ten-minute real resource/retained-memory loop after warm-up/collection; verify the device budget. Classify the long-window native warning before declaring a warning-free candidate. Record actual frame evidence and unresolved failures; leave gates pending until verified.

No repository instruction conflict was found. Stale global plan language remains historical; only Phase 5 progress/status was updated. Previous physical gates in Phases 3–4 remain pending. Existing TypeScript diagnostics, earlier catalog retry-topic/cap assumptions and Health complete-membership design are outside this phase. No memory/freeze/detachment tradeoff was introduced here; installed lazy/detachment behavior remains unchanged. The universal slow interval's responsible function and same-condition causal improvement remain unestablished.
