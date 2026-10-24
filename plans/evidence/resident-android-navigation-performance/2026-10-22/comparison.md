# Phase 0 cause report and completion record

> **Latest status:** Phase 0 is complete for the user-authorized MuMuPlayer diagnostic baseline. See [MuMu completion and current verification](mumu-continuation/completion.md). The first-capture record below is historical; its physical-device prerequisite and partial status are superseded. Native release/T5 acceptance is still unverified.

22 October 2026, Asia/Manila. **Phase status: Partially complete.** Instrumentation, source preservation, repeat JavaScript observations, isolated ownership probes and static/behavior checks are implemented. Full native input/presentation attribution, complete source-matched native-build identity and populated-card native ownership remain pending manual verification. Later fix phases were not started.

## Measured finding

The fully warmed development emulator repeatedly spends the delay **after navigation dispatch and before the destination React commit**. Services → DRRM has 12 warm samples: dispatch median 0.31 ms; first destination React commit median 1142.8 ms, p95/max 1186.9 ms. Selection observation median 1237.6 ms. This establishes a slow JS/render interval. It does **not** establish native touch queueing, first presented frame, or a specific culpable function.

The accepted event-gated capture contains **120 observed presses**, all 30 directed pairs, ten six-tab circuits, 2,596 subtree commits and **zero dropped samples**. The observed destination sequence exactly matches the intended sequence. There are 19 observations meeting the diagnostic slow criterion (first React commit ≥300 ms or dispatch ≥100 ms). This criterion is for triage, not release acceptance. One active-tab setup press has no selection change, as expected.

## Evidence and rejected explanations

- **Deliberate multi-second dispatch wait:** not supported in these slow samples; emission/dispatch is prompt. Earlier source inspection also finds no deliberate wait and retains Android scene animation none.
- **SLA polling as a universal explanation:** disproved for the measured slow case. The live owner inventory has no SLA cards. Actual-source isolated effect probes at N=0/1/3 confirm two intervals per card, two polls/card and 30 ticks/card over 30 logical seconds, and cleanup to zero. Compact and full callers were tested. These substituted timers/RPCs are not native hidden-card measurements.
- **Marker rebuild/reload on every tab switch:** not observed in this warmed dataset: 0 SET_MARKERS, 0 map-ready/load events during the accepted capture. There are 21 SET_BOUNDARY and 40 SET_PRESENTATION sends. Geometry equivalence was not measured, so these are not labelled proven redundant. Message count values are injected-script UTF-16 character lengths, not byte measurements or payload retention.
- **Hidden Health calendar as the sole cause:** unsupported by the shown/hidden/shown comparison below. Hiding it did not materially reduce median Services → DRRM time. The first visible condition overlapped a browser check; the later visible condition did not, and also failed to reproduce a multi-second median.
- **More retained screens:** remains a lead, not a causal conclusion. After a fresh app restart, the smaller warm set is faster. Warming Reports alone raises the median modestly but does not reproduce the original ≥1s median. The additional Maps condition did not complete because Maps collapses its bar on entry; it is not scored as an experiment result.
- CPU profiles contain date/locale, development task creation, cloning and React work. Some short Hermes captures report startTime zero or a previous stop time, and the long export timed out. Duration-weighted summaries and cross-clock attribution were rejected. Saved summaries use **sample hit counts only**; no CPU function is declared the root cause.

| Same Services → DRRM pair, short experiment | n | Median first React commit (ms) | Max (ms) |
|---|---:|---:|---:|
| calendar-visible-a | 5 | 89.1 | 479.7 |
| calendar-hidden | 5 | 91.9 | 99.3 |
| calendar-visible-b | 5 | 87.9 | 395.2 |
| after-reports | 5 | 158.7 | 440.8 |

## Per-pair baseline

All times below begin at the JS release-handler entry (T1), **not native input T0**. React commit callbacks are not Android presented frames. Median uses the middle value/mean of the middle two; p95 uses nearest rank. Small n values are explicitly shown; these are initial diagnosis samples, not the final 30-per-pair/three-run release sample requirement.

| Directed pair | n with destination commit | Dispatch median (ms) | First React commit median (ms) | p95 (ms) | Max (ms) |
|---|---:|---:|---:|---:|---:|
| drrm->health | 2 | 0.91 | 161.3 | 196.8 | 196.8 |
| drrm->home | 2 | 0.94 | 122.2 | 129.1 | 129.1 |
| drrm->maps | 12 | 0.69 | 126.3 | 137.4 | 137.4 |
| drrm->reports | 2 | 0.50 | 136.5 | 151.7 | 151.7 |
| drrm->services | 2 | 0.57 | 126.8 | 130.5 | 130.5 |
| health->drrm | 2 | 0.48 | 147.7 | 149.2 | 149.2 |
| health->home | 2 | 0.47 | 148.5 | 151.9 | 151.9 |
| health->maps | 2 | 0.55 | 147.4 | 152.9 | 152.9 |
| health->reports | 11 | 0.57 | 147.1 | 619.3 | 619.3 |
| health->services | 2 | 0.71 | 145.5 | 156.9 | 156.9 |
| home->drrm | 2 | 0.69 | 134.8 | 138.9 | 138.9 |
| home->health | 2 | 0.57 | 120.2 | 126.3 | 126.3 |
| home->maps | 2 | 0.69 | 141.8 | 153.8 | 153.8 |
| home->reports | 2 | 1.17 | 126.0 | 132.4 | 132.4 |
| home->services | 12 | 0.78 | 124.0 | 156.6 | 156.6 |
| maps->drrm | 2 | 1.59 | 144.4 | 154.9 | 154.9 |
| maps->health | 12 | 0.74 | 128.2 | 168.3 | 168.3 |
| maps->home | 2 | 0.67 | 143.9 | 148.4 | 148.4 |
| maps->reports | 2 | 0.97 | 127.7 | 132.0 | 132.0 |
| maps->services | 2 | 1.15 | 149.6 | 172.3 | 172.3 |
| reports->drrm | 2 | 0.44 | 133.8 | 136.9 | 136.9 |
| reports->health | 2 | 0.54 | 123.9 | 127.3 | 127.3 |
| reports->home | 12 | 0.47 | 121.8 | 223.6 | 223.6 |
| reports->maps | 2 | 1.59 | 127.1 | 136.1 | 136.1 |
| reports->services | 2 | 0.57 | 126.6 | 129.5 | 129.5 |
| services->drrm | 12 | 0.31 | 1142.8 | 1186.9 | 1186.9 |
| services->health | 2 | 0.32 | 1232.8 | 1255.5 | 1255.5 |
| services->home | 2 | 0.35 | 1155.7 | 1158.9 | 1158.9 |
| services->maps | 2 | 0.66 | 178.4 | 193.9 | 193.9 |
| services->reports | 2 | 0.47 | 1160.1 | 1171.8 | 1171.8 |

## Identity, instrumentation and workflow

- Git/source/dependency snapshots: [compact index](../../../../tmp/resident-nav-phase0-20261022/context-index.md), baseline.json, recoverable before/ files and tracked/staged patches. There were extensive existing Android edits; owned-application.patch compares only this task's hunks with the actual initial working copy. The first owned review found no unowned drift; the final check detected concurrent changes to center-detail-card.tsx, evacuation-centers-panel.tsx and tests/drrm-centers-ui.mjs. These were preserved untouched. A three-entry scoped supplemental packet/source snapshot records their new identities; no change occurred during packet generation. Native conclusions for the older DRRM UI are invalidated for this newer state.
- Root AGENTS.md is empty; CLAUDE.md references it. No applicable nested/ancestor instructions were found and there is no instruction conflict. Installed versions: Expo/Router 57.0.10, React 19.2.3, RN 0.86.2, screens 4.26.2, WebView 13.16.1, Supabase JS 2.112.1, TypeScript 6.0.3.
- Installed Router's own bottom-tabs implementation was inspected: lazy true and native detachment enabled on Android by default; freeze unset. Navigation history, animation and options remain unchanged.
- Scoped Repomix 1.18.1 baseline: 15/15 entries, security clean; 4 complete bounded XML chunks. Final supplemental packet: 6/6 changed/added source entries, security clean; complete chunks [0,11000), [11000,17052). Selectors, source/packet hashes, omissions (none), logs and source-gap analysis are indexed. Repowise/Reader connectors were unavailable; direct bounded Reader inspection was used.
- Version-matched Expo v57 Router/WebView and RN 0.86 profiling/performance/Pressable documentation read; React Profiler reference reconciled against installed React/@types. Supabase transport reviewed using its skill and installed/tagged v2.112.1 fetch implementation. Changelog Markdown fetch was rejected by the browsing provider; no Supabase API/config/schema change was made.
- Actual loaded tab/diagnostic factories were retrieved via supported CDP. Their generated bodies and source-map originals matched the working copy (source-match.json). This is actual Metro output, unlike raw-source fixtures. The final portability guard then changed these source hashes; final source identities are recorded separately. Its Android development truth value is unchanged. Full native APK revision matching and final native journey requalification remain pending.
- environment.json fingerprints the native development APK and distinguishes it from the configured release package. Its native source revision is unknown. This is a MuMu emulator, not a physical Samsung reference device.
- Recording defaults off. In development, explicit start(durationMs) accepts 1–600 seconds, installs one automatic stop timeout, and retains at most 8,192 events with an explicit dropped count. stop restores transport when still owned. No credentials, URLs, arguments, identifiers or response bodies enter the buffer. Runtime capture was read back as **active=false** at completion. No new dependency, remote telemetry, database mutation or configuration change was added.

To use the retained controller in the supported development inspector, call globalThis.__residentNavigationDiagnostics?.start(30000), perform one short scenario, then export JSON.stringify(globalThis.__residentNavigationDiagnostics?.stop()). snapshot() reads without stopping. Do not label these JS-relative times as native touch/presentation timing. Production and standalone hosts without the native development global install no controller.

## Native trace and failures retained honestly

- Perfetto produced a 16,570,417-byte trace: 5,769 packets, 316,995 ftrace events, 1,307 frame-timeline packets and zero reported lost-event bundles. This supersedes the earlier planning audit's unusable two-record atrace as a *trace-availability* result. Native input/frame/clock attribution is still unperformed; a nonempty trace is not an acceptance pass.
- The two earlier fixed-rate runs acknowledged only 4/9 of 120 commanded taps after Maps hid its tab bar; they are rejected for coverage/aggregate timing. Individual observed intervals are diagnostic only. The event-gated run is the accepted 120-event capture.
- Exporting the long CPU profile timed out after timing samples had already been saved. Runner command metadata/console issues were not saved on that failure; the full event sequence was subsequently validated directly. A normal reload did not recover the inspector; restarting only the local development app and reopening its existing Metro link did. Short profiles were then acquired.
- Final six-tab smoke attempts failed in the runner (missing/reachable tab controls during collapsed Maps/DRRM/refresh state), not a diagnosed application exception. No final-source native pass is claimed. No additional UI actions are needed to inspect the saved evidence.
- The introduced browser-fixture failure was diagnosed against a passing pre-edit MapView overlay: standalone fixtures do not define __DEV__. A central guarded capability flag and seventh regression test fix it. Final Maps and DRRM checks pass with only baseline React Native Web deprecations.
- The first baseline Android export failed because Hermes could not write its sandbox temporary output. Baseline and final exports passed outside that restriction using workspace temp directories. Existing NO_COLOR/FORCE_COLOR and Hermes global-variable compiler diagnostics are retained, with no new category introduced by this change.

## Verification and acceptance

| Check / criterion | Result |
|---|---|
| Typecheck / Expo lint | PASS baseline and final |
| Unit suite | PASS 279 baseline; 286 final, including 7 diagnostics tests |
| Android production bundle export | PASS baseline and final; this is not an installed release APK |
| Shell lifecycle / Services stability | PASS baseline and final, no page errors |
| Maps presentation | PASS pre-edit replay and corrected final; baseline deprecation warnings only |
| DRRM centers / tracking-payment UI | PASS final; tracking errors empty; DRRM baseline Web warnings only |
| Buffer bounds, deadline, stopped transport, late replies, failure propagation, private-input exclusion, absent dev global | met via tests |
| Working-copy preservation and owned diff | met; three concurrent DRRM files preserved and indexed separately |
| Repeat JS-stage samples and coverage | met: 120 presses / 30 pairs / 10 circuits / zero dropped |
| Source/navigator identity | met for working JS and sampled compiled modules; full native source/build matching pending manual verification |
| Per-card ownership | met in original source and isolated effects; populated native hidden/foreground ownership pending manual verification |
| Cause report including rejected hypotheses | met; specific CPU function and controlled source-fix causality not established |
| Complete T0→T5 dominant-interval classification per slow pair | pending manual verification |
| Same-source release/physical-device targets | pending manual verification |

After the concurrent DRRM changes were detected, typecheck, lint and the updated DRRM UI command were rerun once and passed. Earlier export/unit/other fixture results belong to their saved source states; the later concurrent changes are not this task's implementation or an installed/native release acceptance. No edits were made to those three files.

## Exact remaining work

1. Use an owner-attended affected/reference Android device, or a dedicated profileable emulator build matched to the captured source/dependency snapshot. Identify native APK revision; do not relabel the existing development APK as the current release.
2. Record short synchronized native input/frame traces and bounded React/Hermes captures around the repeatedly slow Services → DRRM case. Establish native T0, handler T1, destination commit T4 and first correct presented frame T5 using verified clock correlation. Export after each short scenario.
3. Isolate actual expensive stacks/consumers with one controlled change and repeat the same pair/dataset; current evidence supports the post-dispatch render branch but not blanket memoization, freezing or a particular date formatter fix.
4. With a populated agency_minutes_v1 request list, observe compact/full cards while visible, hidden and backgrounded for two 15-second poll periods; record actual card/RPC/tick ownership. Do not create production data to manufacture N.
5. Exercise final native journeys, adverse network, rapid taps, account switching and a 10-minute memory/resource loop; report pending values rather than passing browser fixtures as native acceptance. Later release acceptance requires 30 warm samples per directed pair across three runs on physical hardware.

No commits, pushes, deployments, remote migrations, external service configuration changes or user-data deletion were performed.
