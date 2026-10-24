# Resident Android: bottom tab navigation delay investigation and fix plan

Date: 22 October 2026 (Asia/Manila)  
Status: expanded source audit, isolated source probes and MuMu diagnostic capture complete; causal Android profiling, release baseline and fixes pending.  
Scope: Home, Services, DRRM, Maps, Health and Reports, including returning to previously visited tabs.

## 1. Problem and intended experience

The resident reports a **1–3 second delay on every bottom tab switch**, including repeat visits. This makes the application feel unresponsive during one of its most frequent interactions.

The intended experience is:

- A tap receives prompt visual feedback.
- The selected tab, header and destination content become consistent quickly.
- Previously loaded content remains available while freshness checks run.
- Network requests, location acquisition and route computation do not hold up opening the destination.
- Repeated navigation does not gradually increase CPU use, memory use, subscriptions or pending work.

**No single root cause has been established yet.** The findings below identify actual code behavior and the measurements needed to establish causation. A MuMu development-build video now shows repeated delayed selection/header changes, but source-to-loaded-bundle identity and synchronized tap timing are unverified. This is diagnostic observation, not a certified reproduction of the user's exact build, a CPU profile or a fix.

Because the delay occurs repeatedly, cold screen initialization alone is insufficient as an explanation. Shared updates, recurring focus work, hidden screen activity, native screen attachment and development overhead must be investigated first.

### Evidence levels and current priority

| Level | Meaning | Current examples |
|---|---|---|
| Source-confirmed | A behavior exists in current original source; its latency contribution is unknown | Per-card SLA timers, Health focus refresh, hidden-eligible connected routing |
| Isolated probe | Actual source exercised with explicitly substituted state/transport | Two immediate profile refetches construct two requests; uncompiled hooks return new equal-content marker arrays |
| Native observation | Behavior visible in the emulator, with build/measurement limits | Twelve Home/Services/Reports/Health taps; selection/header sometimes remain on the previous route in intermediate frames |
| Causally established | A correlated slow trace plus an isolated change and repeated comparison demonstrate the contribution | None yet |
| Release-accepted | Same-source release candidate passes timing and functional gates on reference hardware | Pending |

Investigate **F11 (per-card recurring work), F04/F12 (global route propagation), F02/F08 (shared refresh propagation), F03 (refresh-induced content disappearance)** first. F05 map churn is conditional on compiler output and actual input identity; do not treat the uncompiled probe as proof of native behavior. F07/F14 are conditional on an activated DRRM route. Source inspection cannot establish that every possible device, backend or runtime cause has been found; section 3's coverage ledger and section 6's decision table define the remaining closure work.

## 2. Current navigation path

```text
Resident touches a tab
  → Android delivers input to the JavaScript press handler
  → tabPress event is emitted
  → navigation.navigate(route.name), unless prevented/already selected
  → navigation state changes; outgoing screen blurs; destination gains focus
  → route subscribers, shared consumers and focus effects may update
  → React renders and commits destination/affected components
  → Android attaches, lays out and draws the destination
  → asynchronous data refreshes complete and may trigger additional renders
```

The stages can overlap. An asynchronous request does not inherently block navigation: its immediate loading updates, response processing and the UI that waits for its result can still affect responsiveness.

The bar's selection highlight is driven by committed navigation state. Its 220 ms animation starts from an effect after selection changes; it is not an independent measurement of how promptly the original tap was handled.

## 3. Source findings and investigation priorities

Priority indicates investigation order, not proof of responsibility for the reported delay.

### F01 — Navigation has no deliberate multi-second wait

**Confirmed:** [app-tabs.tsx:35](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/app-tabs.tsx:35) sets Android scene animation to `none`. The [press handler:100](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/app-tabs.tsx:100) emits `tabPress` and calls navigation without awaiting a request or timer. The indicator animates for 220 ms and icon/label transitions for 150 ms.

**Interpretation:** shortening these animations is unlikely to explain or remove a 1–3 second wait. Work before the handler, during navigation/rendering or after focus needs measurement. Other event listeners must still be inspected during tracing.

**Probe:** native input timestamp → handler entry → event emission complete → navigation dispatch → first destination frame.

### F02 — Services refreshes a shared, relatively broad profile on every focus

**Confirmed:** [Services:40](<C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/index.tsx:40>) calls the shared profile `refetch()` on focus. Settings has a similar path at [settings/index.tsx:64](<C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/index.tsx:64>).

[use-profile.ts:29](C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-profile.ts:29) immediately sets loading state, selects the profile with barangay boundary/locality data, publishes a new profile value and serializes it to local storage. The provider also refreshes on foregrounding and profile Realtime updates. Its request scope rejects obsolete results; this is not equivalent to deduplicating transport requests.

**Possible impact:** entering Services can update consumers throughout the application. Repeated equivalent profile/boundary objects may also trigger downstream map effects. Response size and storage serialization costs are unknown.

**Limits:** this finding alone does not explain every destination being slow, especially a clean Home ↔ Reports cycle.

**Probe:** count profile requests, overlapping requests, shared consumer commits, payload bytes and serialization time per navigation. Compare Services with an already-fresh profile in a controlled experiment.

### F03 — Health reloads both feeds on focus and hides existing content while loading

**Confirmed:** [use-medical-drives.ts:285](C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-medical-drives.ts:285) fetches drives and registrations on each focus. Both fetch paths set loading flags. [health/index.tsx:729](<C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/health/index.tsx:729>) substitutes a spinner for drive content while loading; the registrations panel also branches on loading at line 489. These branches were revalidated after an external Health UI edit during this audit; the older packet's Health entry is superseded.

**Possible impact:** the route may open promptly while usable content disappears until a network response. This creates a repeated perceived navigation delay and remounts the list content.

**Probe:** compare first destination frame, first cached-content frame and refreshed-data completion. Repeat with the network disconnected after warming the tab.

**Fix direction:** separate initial loading from background refreshing; preserve loaded rows for the same account and filter. Keep mutation-driven refreshes and freshness checks.

### F04 — Route-aware inset hooks can update previously visited screens

**Confirmed:** [use-floating-tab-inset.ts:15](C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-floating-tab-inset.ts:15) subscribes to the global pathname and shared floating bar layout. Many tab screens and feed components call it. Route changes can therefore notify consumers beyond the incoming screen, even when their desired numeric inset is unchanged.

The app does not explicitly configure `freezeOnBlur` or call `enableFreeze()` in its inspected TypeScript sources. The installed Expo Router implementation supports freezing and normally retains previously loaded tab trees. Actual runtime commits must be checked.

**Possible impact:** hidden screens may rerender and run derivations or dependency-driven effects during a tab switch.

**Probe:** count commits by screen and reason after all six tabs have been visited. Compare with a fresh launch where Maps and DRRM have never been opened.

**Fix direction:** narrow route subscriptions to small shell/adapter components, isolate heavy content from route-derived layout updates and consider measured native freezing experiments.

### F05 — Maps can resend and rebuild unchanged marker sets

**Confirmed:** [use-incidents.ts:122](C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-incidents.ts:122) recreates marker arrays during render. [use-evacuation-centers.ts:125](C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-evacuation-centers.ts:125) recreates parsed centers, optional distance sorting and marker arrays during render.

[map-view.tsx:717](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/map-view.tsx:717) sends `SET_MARKERS` when marker/category references change. The send path serializes the message at line 665. The WebView handler [clears and recreates all markers:387](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/map-view.tsx:387).

**Possible impact:** if the compiled hook produces new references, a screen rerender with semantically unchanged data can cause array allocations, message serialization and WebView marker reconstruction. Repeated profile fetches can supply newly parsed boundary objects regardless of marker caching. The magnitude depends on real data volume, compiler output and whether hidden screens actually rerender.

**Important correction from the expanded audit:** `reactCompiler: true` is configured. An isolated transform using the installed compiler **does cache incident markers by the incidents reference and center derivations by raw centers/user position**. A synthetic probe without that transform confirms the source allocation behavior but does not establish allocation on each native rerender. Before adding manual memoization, verify the actual Metro output and count bridge messages. Fresh equal-content network arrays can still invalidate compiler caches. The installed compiler did not emit memo caches for the isolated profile/theme provider transforms; that does not prove their entire runtime subtree rerenders.

**Probe:** per transition, record message type/count/bytes, derivation duration, marker rebuild duration, boundary sends and WebView load/ready events. Compare navigation before and after opening Maps.

**Fix direction:** stabilize derivations by actual inputs; preserve unchanged geometry/data references; send changed map data only. Consider marker reconciliation by ID if full replacement remains expensive after redundant sends are eliminated.

**Do not infer a WebView reload merely from a new `source` object.** Verify native load events and map-ready events. The inline Leaflet HTML is already constructed at module scope.

### F06 — Refresh and subscription work exists across multiple visited tabs

**Confirmed:** Reports refreshes on repeat focus in [use-my-incidents.ts:112](C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-my-incidents.ts:112), already preserving rows for that background refresh. Services Logs refetches on focus in [logs-list.tsx:40](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/logs-list.tsx:40). Documents, medical drives and incidents have mount-owned Realtime subscriptions.

The shell's [UnreadCountsProvider](C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-unread-counts.tsx:54) intentionally remains active so badges update across tabs. An incident change can legitimately reach the badge provider, the resident's report feed and the community map feed.

**Possible impact:** bursts of related requests and response-driven renders can contend with input. Multiple channels alone are not proof of a leak or a cause of latency.

**Probe:** inventory channels, event callbacks, requests per event, in-flight requests, and commits before/after a long navigation loop. Distinguish necessary independent consumers from duplicate work.

**Fix direction:** coalesce duplicate invalidations, deduplicate equivalent in-flight reads, use account/filter-specific freshness and pause work that has no visible or shared consumer. Preserve shared notification/badge updates and catch up after reconnect.

### F07 — DRRM has some visibility guards, but route computation needs a separate audit

**Confirmed:** [evacuation-centers-panel.tsx](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/evacuation-centers-panel.tsx:103) supplies focus to `useOfflineRouting`. [use-offline-routing.ts:240](C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-offline-routing.ts:240) gates condition polling on that active flag.

However, [use-resident-route.ts:59](C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-resident-route.ts:59) receives no screen visibility flag. Its connected refresh loop checks whether the app is foregrounded, which differs from whether DRRM is visible. It also invokes local route computation. A retained Centers screen with a confirmed origin may therefore continue eligible work while another bottom tab is active.

**Limits:** the local solver already uses asynchronous yielding and cancellation. This is not evidence of a tight synchronous routing loop, and not every DRRM visit activates routing.

**Probe:** establish a route, leave DRRM, observe requests/computation for at least two refresh intervals and correlate with later tap delays.

**Fix direction:** make visible ownership explicit for local/connected route work, cancel or suspend hidden work where appropriate, and resume with current inputs without displaying outdated routes.

### F08 — Shared context propagation may amplify otherwise small updates

**Confirmed:** profile, theme preferences, font preferences and unread counts use context. Several provider values are constructed inline. Profile loading and data are distributed together. `useTheme()` already memoizes the resident palette, and React Compiler is enabled in app configuration.

**Possible impact:** broad context updates can reach consumers that only need one stable field. Inline objects are an inspection lead, not proof of costly rendering; compiler behavior and actual commits matter.

**Fix direction:** measure consumers first. Stable provider values help unrelated provider renders; splitting stable data from refresh status helps consumers avoid legitimate but irrelevant loading updates. Do not add blanket memoization or assume `memo` blocks a component's own context subscription.

### F09 — Large datasets can magnify rendering and response costs

**Confirmed:** several feeds select broad rows with no explicit pagination, including resident incident history and service activity. Documents and Health render multiple rows inside scroll containers. Reports already uses a `FlatList`.

**Possible impact:** larger accounts may incur heavier parsing, derivation, layout and garbage collection. Counts currently derive some totals from returned row sets. Actual cardinalities and response limits must be measured.

**Fix direction:** narrow projections and add correct pagination/virtualization only where measured. Avoid silently truncating results or totals. Database plans/indexes are a later branch if request timing proves server work contributes.

### F10 — Existing verification does not establish native tab responsiveness

**Confirmed:** [resident-shell-lifecycle.mjs](C:/Users/User/barangayan/apps/resident-android-mobile/tests/resident-shell-lifecycle.mjs:16) mocks navigation and native animation; its result explicitly marks native motion unverified. [services-tab-stability.mjs](C:/Users/User/barangayan/apps/resident-android-mobile/tests/services-tab-stability.mjs:18) mocks focus and data hooks.

Historical native performance summaries under `plans/evidence/resident-android-magicpatterns-phase-1/2026-10-19/native-resume/` concern a different interaction and a development build. A reviewed summary has no captured frame-duration samples. It cannot establish current tab latency or physical-device performance.

**Conclusion:** retain these tests for behavior, and add a dedicated Android timing baseline. Do not declare success from passing browser fixtures.

### F11 — Per-request SLA cards each own recurring timers and a polling request

**Confirmed, high priority:** [agency-sla-status.tsx:20](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/agency-sla-status.tsx:20) immediately loads `service_request_sla_tracking`, then starts a **15-second refresh interval and one-second tick interval**. The effect is keyed only to request ID/retry and cleans up on effect replacement/unmount. It has no route-focus, app-foreground or terminal-status guard. An `inFlight` flag prevents overlapping requests within one card; it does not coalesce requests across cards. The intervals remain installed even when the component renders its error state.

[RequestsList](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/requests-list.tsx:274) renders one `AgencySlaStatus` for each displayed `agency_minutes_v1` request. The list uses a ScrollView, so rows beyond the viewport are also mounted. Retaining this Services screen after switching tabs retains eligible timer callbacks. Native detachment and render freezing do not cancel JavaScript timers.

For N mounted matching cards, the source creates **2N intervals**, N initial RPCs, up to 4N recurring poll attempts/minute and approximately 60N tick state updates/minute while timers are scheduled normally. For 20 cards: 40 intervals, up to 80 recurring attempts and about 1,200 tick updates/minute. Actual network count may be lower because of in-flight suppression, throttling or runtime suspension. This is a formula from code, not a measured account workload.

**Isolated effect probe:** three actual card effects with synthetic timers/RPC created six intervals (15,000/1,000 ms per card) and three initial calls. All six intervals were removed when their cleanup functions ran. No recurring callbacks were executed. This confirms multiplicity and existing unmount cleanup; it does not prove a leak, native hidden callbacks or a latency contribution.

**Possible impact:** repeated hidden renders, independent SLA calculations, result processing and periodic request bursts can contend with every tab, especially after visiting Services → Requests. It cannot explain a clean session that never mounted these cards unless another retained detail screen uses the same component.

**Probe:** record N, active intervals, callback counts and RPCs before entering Requests, after loading it, after switching Home and after backgrounding. Compare at N=0, small N and realistic large N for at least two 15-second intervals. Preserve the same dataset in candidate comparisons.

**Fix direction:** keep existing clock behavior when visible, give it explicit visible/foreground ownership, and suspend hidden work. Prefer a shared visible clock tick or bounded visible-card ownership over one timer per retained row. Stop unnecessary terminal-state polling once status semantics are verified. Preserve authoritative processing calculations, freshness on return and cancellation of obsolete requests. Do not add a new product feature or change the displayed business rules.

**Required gate:** with Services hidden, no optional per-card tick/poll executes; on return, data catches up without a burst of duplicate requests or stale clocks. Verify full tracking and compact-card callers separately. [TrackingReveal](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/tracking-reveal.tsx:4) already performs one mount transition and does not intentionally restart on every tick; do not replace it based on an invented animation loop.

### F12 — A global pathname subscription also sits above the root navigator

**Confirmed:** [SplashGatedNavigator](C:/Users/User/barangayan/apps/resident-android-mobile/src/app/_layout.tsx:119) calls `usePathname()` to exempt the public emergency route from the splash, and renders `RootNavigator` beneath it. Every route change can notify this ancestor in addition to header, inset and search consumers.

**Possible impact:** the navigation shell may perform unnecessary ancestor work during every switch. The public-emergency comparison can remain false while the full pathname changes. Compiler optimizations and navigation internals may mitigate descendant work; trace commits rather than assuming the whole app rerenders.

**Probe/fix:** isolate the route-sensitive splash decision from the stable navigator subtree only if measured. Preserve public emergency access, protected-route admission, deep-link restoration and cold-start splash behavior. The **3,000 ms restoration timer is gated by authentication loading**; it is not a tab-navigation delay and should not be shortened as a tab fix.

### F13 — Several repeat-refresh paths can overlap and apply obsolete results

**Confirmed:** Health drive/registration fetches set state when their requests settle without a request generation tied to the current filter/account. Reports' repeat-focus `fetchIncidents(false)` path similarly lacks the cancellation guard that its initial mount effect has. Focus + Realtime + explicit refresh can therefore create concurrent reads. The profile provider's generation guard handles obsolete publication but does not cancel/deduplicate transport; two immediate calls produced two constructed requests in the isolated probe.

**Possible impact:** late responses can trigger unnecessary renders, reinstate older data, or prolong loading presentation. Slow requests alone do not delay route dispatch. Actual out-of-order publication needs a controlled deferred-response test; do not claim a privacy incident from this source finding.

**Fix direction/gate:** coalesce same-key work, use account/tenant/filter generations, ignore obsolete results and cancel transport where supported. Validate A→B filter changes with responses returned B→A, account changes, blur/refocus and unmount. A stale request must not clear a newer request's loading/error state. Preserve initial-load/error behavior and data isolation.

### F14 — The asynchronous route solver still has synchronous preparation sections

**Confirmed:** [use-local-route.ts:46](C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-local-route.ts:46) compiles routing inputs during a render memo. [planEvacuationRouteAsync](C:/Users/User/barangayan/packages/shared/src/lib/evacuation-routing.ts:1180) drives a generator, yielding between search chunks. Before the first search yield, `planSteps` validates inputs, freezes edge conditions and scans candidate attachments; route assembly between searches also performs synchronous work. The search yields every 256 heap pops, which is a work-count bound, not a fixed time budget.

**Possible impact:** a sufficiently large graph/conditions update can still occupy JavaScript for a long section despite the async function name. Existing yielding and cancellation are real safeguards; this is not evidence of an infinite loop or a need to replace Dijkstra/BFS.

**Probe/fix:** record longest uninterrupted preparation/search/assembly segments on Hermes with the shipped pack. If they exceed the input budget, cache verified immutable preparation and cooperatively chunk only the measured costly sections. Preserve exact routing results, closure/avoidance handling, deterministic ties and cancellation. Pair with F07's visibility ownership first.

### F15 — Independent Maps and DRRM instances duplicate some data derivation/reads

**Confirmed:** Maps and the DRRM screen both call `useEvacuationCenters`; each hook owns its own cache read, network initialization and center/marker derivations. DRRM creates guidelines, hotlines, alerts and centers sources at screen scope, even when a different internal segment is selected. Mount-owned subscriptions remain eligible after visiting another bottom tab.

**Possible impact:** multiple data owners can independently process the same updates, and unused internal segments may remain active. This is bounded retained work by design until proven otherwise, not proof of accumulating instances on each switch.

**Probe/fix:** inventory live instances by owner and subscription purpose. Share only identical public/account/tenant-scoped inputs or defer optional owners if measurements justify it. Preserve offline emergency availability, the correct barangay, notification delivery and reconnect catch-up. Do not introduce a new cache framework for this optimization.

### F16 — Development host workload can confound emulator results

**Confirmed:** Metro watches the workspace root; its block list excludes Git and selected web build outputs, but does not explicitly exclude the task's `tmp` or `repomix output files` folders. The current workspace contains substantial generated/evidence content. This audit used a debuggable emulator app.

**Possible impact:** host filesystem scanning, live transforms, debugger overhead or competing builds can make development navigation worse. This does not explain a same-source release build automatically. No watcher backlog or host saturation has been measured here.

**Probe/fix:** record host/emulator CPU and Metro activity, pause unrelated builds during comparisons, and compare a same-source release build. Add narrow watcher exclusions only after proving required source/assets remain resolved. Do not delete user evidence or broad directories to make the benchmark look faster.

### F17 — Tap feedback follows navigation state rather than immediately acknowledging touch

**Confirmed:** the custom tab Pressable dispatches on release; the selection pill and icon state derive from navigation state. There is no independent pressed visual in this handler. A busy JavaScript thread can delay both navigation and visible acknowledgement.

**Interpretation:** lack of immediate feedback amplifies perceived slowness; it is not proof of a multi-second handler delay. Changing the highlighted selected tab before successful navigation could instead display misleading state. Retain the existing UI scope and fix the critical path first; do not add speculative optimistic selection, gestures or new animation features.

### Coverage and exclusion ledger

| Potential cause class | Coverage/result in this revision | Remaining closure |
|---|---|---|
| Explicit tab delay / scene animation | F01, handler/source verified | Correlate native input and listeners |
| Cold initialization alone | Insufficient for every repeat switch | Count repeat mounts and native attachment |
| Global route and context propagation | F02/F04/F08/F12 | Actual compiled runtime commit trace |
| Repeated optional timers/polls | F07/F11, other timer callers discovered | Visibility/account/terminal tests with realistic N |
| Slow refresh / spinner replacement | F03/F06/F13 | Separate destination frame from data completion |
| Map bridge / WebView | F05, compiler caveat verified | Actual messages/bytes/rebuild/load counts |
| Routing preparation / long JS tasks | F14 | Hermes segment timing with shipped pack |
| Dataset scale / N+1 card requests | F09/F11/F15 | Query volumes, parse/layout cost, larger account |
| Native screen attach/layout/render | Installed navigator inspected | Valid native frame/CPU trace and controlled detachment candidate |
| Repeated remount / resource leak | No leak established | Per-owner mounts, channels, timers and retained heap over long run |
| Error retries / auth gates | Profile backoff is 1 s then 3 s after errors; splash timer is initial restoration only | Correlate error/retry events; never infer cause from matching duration |
| Decorative loops | Services root placeholder is static; legacy looping primitives have detail-route or no discovered callers | Trace only live retained callers; no unrelated cleanup |
| Touch interception / rapid input queue | Ordinary taps exercised; full-screen interactive overlays can affect input | Native input-to-handler timing, overlay/pointer-state and rapid-tap checks |
| Emulator/dev host / compiler/version mismatch | F16; loaded source identity pending | Same-source release and physical reference device |
| Backend/network/RLS execution | Queries inspected, no production plans run | Read-only timings and plans only if request latency is causal |

This ledger prevents silent omissions. A class is closed only by applicable evidence or a documented reason it cannot apply to the observed scenario; a search with no matches is not sufficient by itself.

## 4. Measure the delay in separate stages

Use a correlation ID for each tap and record the following milestones without storing personal payloads:

| Marker | Meaning | How to observe |
|---|---|---|
| T0 | Actual input delivered on the device | Native input/system trace or synchronized input/video capture |
| T1 | JavaScript press handler begins | Small in-memory monotonic timestamp |
| T2 | `tabPress` listeners finish and dispatch returns | Instrument before/after emission and dispatch |
| T3 | Navigation selection/focus is observed | Navigation state and focus instrumentation |
| T4 | Destination React commit | React profiler/commit instrumentation |
| T5 | First correct destination frame is presented | Android frame trace plus visual confirmation |
| T6 | Cached content or meaningful initial state is usable | Frame evidence and control interaction |
| T7 | Fresh data is applied | Request completion and relevant commit |

Report input queueing (T1−T0), dispatch cost, destination presentation (T5−T0), usable content (T6−T0) and fresh-data completion separately. Also record request durations, JS long tasks, UI frame misses, allocations/GC, and outgoing/destination mount counts.

Important measurement rules:

- Starting a timer inside `onPress` misses time spent waiting for a busy JavaScript thread. If T0 is unavailable, label the result handler-to-frame, not tap-to-frame.
- React commits, focus events, `onLayout` and `requestAnimationFrame` callbacks do not prove that Android presented a frame. Use native tracing/video for presentation acceptance.
- Correlate clock domains explicitly; do not subtract unrelated native and JavaScript clocks.
- React profiling adds overhead and needs a profiling-capable build. Use it to explain work; use a normal release build for final interaction timing.
- Keep samples in a bounded buffer, then export after the run. Avoid per-render logging or network telemetry that perturbs the benchmark.
- Record device, OS, refresh rate, app/build revision, dependency versions, build type, account/data size, network and thermal state.
- The workspace already has Android UI changes. Capture the current working state as the baseline rather than treating an older Git revision as equivalent.

## 5. Reproduction and comparison matrix

### Initial diagnostic runs

1. Use the resident's affected device when available. Also use a physical Android device representative of the supported low/mid-range hardware. Emulator results are useful but reported separately.
2. Compare the current development build with a release build from the same source and dependencies, with debugging tools disconnected for timing runs.
3. Visit every tab once. Then exercise **all 30 directed pairs** between the six tabs, with special attention to returning Home and leaving Maps/DRRM.
4. Repeat the six-tab circuit at least 10 times after warm-up. Capture a separate rapid-tap burst to reveal queued navigation and final-selection errors.
5. Repeat a small Home ↔ Services/Reports loop before ever opening Maps, after opening Maps, and after activating DRRM Centers routing. This distinguishes shared baseline overhead from retained heavy-screen work.
6. After warming data, repeat with slow responses and with the network disconnected. Record whether the destination appears while data is unavailable.
7. Compare a guest, a signed-in resident with small datasets, and a signed-in resident with realistic larger histories.
8. Check normal/reduced motion, a populated Services segment, Health registrations, map selection, and a 10-minute session. Keep these scenarios separate in the results.

Do not include automated screenshot polling, UI hierarchy dumps or arbitrary test sleeps in the measured navigation duration. Separate runner overhead from application latency.

### Controlled experiments

Change one cause at a time in an instrumented local candidate:

| Experiment | Result that supports the hypothesis |
|---|---|
| Compare identical data at N=0/small/large agency-timed request cards; suspend hidden card work | Optional hidden intervals/RPCs stop; cross-tab latency and CPU decline with the predicted workload reduction |
| Refresh profile only when actually stale/invalidated | Services latency and shared consumer commits decline |
| Keep Health rows visible during refresh | Route timing unchanged, but usable-content delay disappears |
| Feed stable markers/boundary references to Maps | Equivalent `SET_MARKERS`/boundary sends and WebView work decline |
| Isolate global pathname subscriptions | Hidden-screen commits fall alongside tap-to-frame latency |
| Pause eligible hidden routing work | Post-DRRM latency/CPU improve without stale routes on return |
| Time routing preparation separately from heap-search chunks | Any uninterrupted expensive section is identified rather than misclassified as an async network wait |
| Test freezing of inactive screens | Hidden rendering decreases without a large backlog on return |
| Compare native detachment settings | T4→T5 improves when attachment is the bottleneck, with measured memory tradeoffs |
| Compare controlled response delay | T5 remains fast while T7 follows network delay; otherwise locate the gating UI |

A cause is established when a slow sample identifies the responsible work, a controlled change removes/reduces it, and repeated comparison runs show the predicted improvement. Several causes may coexist.

## 6. Diagnosis decision table

| Observation | Primary branch | Next action |
|---|---|---|
| T1 is late; UI was touched much earlier | JS thread blocked or input dispatch delayed | Inspect JS stacks/GC and native input trace before handler entry |
| T1 prompt, tabPress emission expensive | Synchronous event listener work | Identify listener and move nonessential work outside the critical path |
| Dispatch prompt, React commits expensive across many screens | Context/route propagation | Identify actual consumers; isolate stable content and shared status |
| React commit fast, destination frame late | Native attach/layout/draw/WebView | Inspect UI/render threads and detachment experiment |
| Frame prompt, list replaced by spinner | Loading presentation | Preserve same-scope content and refresh in place |
| Repeated map messages with unchanged data | Referential churn | Stabilize derivations; suppress redundant bridge updates |
| Delays begin after routing is activated | Retained routing work | Trace visibility ownership and cancel/resume behavior |
| Delay grows with session duration | Resource growth/backlog | Compare mounts, timers, channels, pending requests and retained memory |
| Only development mode is slow | Development overhead contributes | Report release timing separately; still fix reproducible user-build delays |
| Requests are slow but screen stays interactive | Data freshness issue | Optimize requests separately; do not call this navigation dispatch delay |

## 7. Implementation phases and exit gates

### Central workflow contract — mandatory for every phase below

Apply this sequence in order:

**Git baseline → ripgrep discovery, optionally assisted by Repowise → Reader validation → scoped Repomix → Reader XML analysis → original-source verification.**

“Reader” means bounded file/XML inspection and evidence reconciliation; no separate Reader connector is available in this session. Repowise is optional and was not available/discovered for this audit. Direct discovery is the fallback, with no claim of graph completeness.

1. **Git baseline.** Capture current HEAD as a reference, scoped status, staged/unstaged diffs, relevant untracked/ignored inputs and recoverable copies/patches before editing. Existing changes remain user/other-work ownership. Hash working-copy inputs; never equate HEAD with their content. Secure sensitive inputs separately and exclude them from packets. Reuse the baseline during the phase, recording concurrent changes and owned hunks.
2. **Discovery.** Read applicable repository instructions and the phase row. Use narrow `rg --files` and symbol/caller/consumer/test/config searches, expanding only for unanswered requirements. If Repowise is used, record index freshness against the actual working copy, including additions; verify inferred relationships directly. Save full relevant search output locally when necessary, returning bounded excerpts rather than silently dropping matches.
3. **Reader validation.** Consult the compact index and per-file/packet hashes, installed dependency versions and relationship notes. Classify unchanged/changed/missing/uncertain inputs. Reuse only verified findings, and invalidate affected conclusions after relevant input changes. A matching hash proves identity, not analytical completeness. Record prior paths/symbols/ranges and unresolved questions.
4. **Scoped Repomix.** Use pinned cached **1.18.1** unless a deliberate version change is recorded. Select confirmed requirements/contracts/callers/tests; retain security scanning and default/repository ignores. Add explicit secret/env/generated/binary exclusions. Put new XML/logs in `repomix output files`; never include generated packets or their own index/manifest as source. Record selectors, actual entries, source/packet hashes, scan/exit/parse results and omissions. Resolve unexplained omissions; use a small supplemental packet for changed context. Preserve historical packets as superseded evidence rather than overwriting unrelated artifacts.
5. **Reader XML analysis.** Extract at most 12,000 characters or 200 lines initially, with explicit continuation boundaries and counts. Read every required selected entry across continuations. Reuse unchanged analyzed entries only when dependencies remain current. Record compression gaps and concise findings tied to source. Packet token estimates are not actual account usage or demonstrated savings.
6. **Original-source verification and execution.** Resolve decisive handlers/effects/validation/cleanup/styles omitted by compression from current originals. Run each relevant existing baseline check once before application edits; retain full logs and exact outcomes. Implement only the smallest complete authorized change. Review the owned diff, verify each exit gate, rerun affected checks and broaden only for a concrete risk/failure. Record existing failures separately. Update changed facts in the index, refresh only invalidated context, and stop claiming completion where native/manual evidence remains pending.

Shared constraints: no new product feature/UI, no unconditional timer/retry/navigation loops, no broad architecture/dependency changes, no relaxed authorization/eligibility rules. Existing bounded visible polling is assessed by ownership and necessity, not removed indiscriminately. Delete replaced implementation files only after static/dynamic caller and route discovery confirms they are unused and replacement acceptance passes; retain user evidence and unrelated legacy code. This documentation pass replaces no application files, so no application deletion is justified.

### Phase context checklist

All rows inherit the central workflow; check these five items at each entry: **scope, prerequisites, context inputs, baseline, acceptance**. Phase status is evidence-based, not inherited from an older redesign plan.

| Phase | Scope and prerequisite | Context inputs | Baseline checks | Acceptance gate |
|---|---|---|---|---|
| 0 | Diagnose repeat navigation; current source/build identity required | Shell/data/polling packets, installed navigator, runtime identity, F01–F17 ledger | Git/source hashes; shell/Services behavior checks; diagnostic timing capability | Slow interval attributed with trustworthy instrumentation; preliminary audit alone is partial |
| 1 | Refresh presentation/profile ownership; Phase 0 identifies this branch | Profile/Auth scope contracts, Health/Services hooks, verification rules, F02/F03/F08/F13 | Existing Services stability, relevant hook/account tests; request/commit counts | Loaded content retained, deduplicated same-key reads, authoritative eligibility and newest-response ownership |
| 2 | Map data/bridge costs; actual messages or expensive map work measured | MapView callers, hooks, compiler output, bridge contract/tests, F05 | Map/DRRM behavior and unchanged-input message counts | Redundant sends removed; ready/retry/latest-state and map behavior preserved |
| 3 | Hidden card/routing/screen work; ownership inventory available | SLA compact/full callers, routing hooks/core, shell inset/provider, native screens implementation, F04/F07/F11/F12/F14/F15 | Timer/RPC ownership, route correctness, rapid switching, relevant lifecycle tests | Optional hidden work stops, visible behavior resumes correctly, no backlog or resource growth |
| 4 | Proven data/render scale bottlenecks; prior phases do not already meet target | Narrow projections/consumers, SLA response contract, list/row rendering, measured query plans if relevant | Representative dataset volumes, completeness/counts, affected journey tests | Navigation targets at realistic scale; complete data and correct scoping preserved |
| 5 | Final acceptance; owned fixes and current candidate identities available | Only changed context plus saved baseline/candidate evidence and relevant tests | Owned diff/static checks; paired same-source native runs | Per-pair timing + full affected functional acceptance; release/device limits stated |

No application implementation phase is marked complete by this document revision. The user authorized refinement and investigation here; current changes are plan/evidence/context only.

### Decisions fixed by this refinement

| Decision | Chosen approach and reason |
|---|---|
| First investigation | Reproduce with and without mounted SLA request cards, then measure route/context work. These are repeated-work paths that fit the reported symptom better than cold mounting alone. |
| Freshness | No universal TTL. Preserve current live/foreground/mutation semantics first, reuse in-flight same-key reads, and keep loaded content visible. A per-resource freshness window is introduced only after validating its contract. |
| SLA work | Visibility/foreground gating is the first candidate. No new RPC, endpoint or application-wide polling framework is part of the initial fix. Shared visible ticking is an implementation option only if measured card counts justify it. |
| Compiler | Verify actual transformed output before adding manual memoization. The isolated compiler result invalidates an unconditional claim that marker arrays change on every native rerender. |
| Navigator | Preserve lazy loading, history and the existing Android no-animation setting. Freezing/detachment are controlled experiments, not default blanket fixes. |
| Backend | No schema/index/RLS or subscription architecture change without measured query/event evidence. Never weaken verification rules to make a loading screen disappear. |
| Cleanup | Remove only replaced, proven-unused owned implementation after acceptance. Historical evidence, generated context identities and unrelated files remain intact. |
| Instrumentation failure | An unauthorized inspector is not bypassed; an empty/unusable trace is not evidence. Use a supported profiling session/profileable build in Phase 0 and leave causal attribution pending until available. |

### Phase 0 — Establish a trustworthy baseline

- [x] Capture exact current source/dependency/build state and runtime navigator implementation.
- [x] Add temporary bounded timing, render, mount, request and map-message instrumentation.
- [x] Collect repeat-navigation samples and classify the dominant interval for each slow pair.
- [x] Establish per-card SLA/timer ownership and distinguish the actually loaded compiled bundle from raw-source fixtures.
- [x] Write a cause report with evidence, including causes disproved by experiments.

**Execution status, 22 October 2026 (Asia/Manila): Complete for the authorized MuMuPlayer Phase 0 diagnostic baseline.** The user's follow-up explicitly selects MuMuPlayer for testing. Physical hardware is therefore not a Phase 0 prerequisite. Release/physical targets, complete native input-to-correct-presentation timing, and later fix acceptance remain unverified; this status does not claim a production performance fix. No later phase was implemented. The earlier document-level audit status predates this execution; this Phase 0 record supersedes its implementation-status statement.

**Entry classification and checklist:** source/runtime identity — partially done; instrumentation — not started; repeat samples — partially done; SLA/compiled identity — partially done; cause report — partially done. No earlier phase dependency. Scope is baseline/instrumentation only. Context inputs are the shell, request/map/SLA owners, installed navigator and recorded source identities. Acceptance gates are the five checklist items and measured-interval exit below. Instructions: root AGENTS.md is empty, CLAUDE.md references it, and no applicable nested/ancestor conflict was found.

**Workflow followed:** Git baseline → narrow ripgrep → Reader index/hash validation → cached scoped Repomix 1.18.1 → complete bounded XML analysis → decisive original handlers/effects/cleanup. The initial snapshot preserves 426 relevant working-copy files and Git patches; the MuMu continuation preserves another 317 current inputs. Existing and concurrent user changes remain untouched. The baseline/final/concurrent packets retain their historical identities. The continuation reuses 19 unchanged manifest entries, reads a three-entry SLA supplement completely at [0,6494), and reads a two-entry current DRRM supplement completely at [0,5723); security scans clean, zero omissions. Earlier manifest entries for owned pre-edit files are superseded by the final manifest, not treated as new drift. Repowise/Reader services were unavailable; direct bounded reading was used. [Compact continuation index](../tmp/resident-nav-mumu-20261022/context-index.md) records hashes, reads, original-source gaps, checks and limitations; shared workflow rules remain in section 10.

**Implemented:** development-only recording defaults off, with an 8,192-event ring, dropped counts, 1–600-second duration, automatic stop and safe fetch restoration. Records press/listener/dispatch, selection/focus, screen commits/mounts, request durations/status without private inputs, map send/load/ready and compact/full SLA owners/ticks/polls. Seven focused tests cover bounds, cleanup, transport/error preservation, old replies, private input exclusion, production inactivity and absent development globals. No dependency, backend, authorization, theme or product behavior change. Diagnostics read back active=false; compact/full SLA owners both zero at completion.

**Dated verification, including MuMu continuation:**

- Working JavaScript/dependency/configuration identities, installed Router 57.0.10 behavior and the exact tested native APK fingerprint are recorded. All six actual loaded tab/diagnostic/map/SLA/DRRM factories match current generated bodies and source-map originals. Native APK SHA-256 is 9828659e5c4a24ddbd097fcbed7ab7b5ba185e6dd01242b912e9933420726f21; its native source revision remains unknown. This is the existing debuggable SDK 57 development client, not the configured release APK. Installed framework sources and Expo v57/RN 0.86 documentation were read before app edits; clock/Metro inspector contracts were verified in installed sources.
- Accepted historical warm baseline: 120 observed presses, all 30 directed pairs, ten circuits, zero drops. All 19 slow observations across Services→DRRM/Home/Health/Reports and Health→Reports are dominated by the measured post-dispatch→destination React commit interval. Services→DRRM n=12 median 1142.8 ms, dispatch ~0.31 ms. No claim that a React commit is first correct presented content. Two earlier fixed-rate captures remain rejected for missing tab-handler coverage.
- Current-source MuMu supplementary capture: five Services↔DRRM Hub round trips, ten acknowledged presses, zero dropped samples or console issues. Services→DRRM first React commit median 77.8 ms (max 122.2 ms), dispatch 0.56 ms. Different warm set and concurrent DRRM edits prevent a before/after speedup claim. The final six-tab native smoke observes all six presses and selections with zero console issues.
- Native input/app frames were decoded with the official locally executed, checksum-verified Perfetto trace processor. Monotonic/boot-time snapshots and explicit uptime brackets support provisional input correlation. The current trace has 20 app motion events and 56 app frames, but 92 negative-timestamp drops and unresolved SurfaceFlinger frames prevent complete native presentation acceptance. Disabled JS Systrace markers and inconsistent Hermes CPU clocks are recorded limitations, not bypassed or silently accepted.
- Real existing requests in MuMu: N=6 compact cards generated 180 ticks/12 polls in each nominal 32-second visible and hidden-Home observation. Backgrounded: zero SLA callbacks observed; reopening the development URL reloaded runtime, so seamless resume is unverified. A real full card mounted alongside six retained compact cards: 31 full ticks/2 full polls and 180 compact ticks/18 compact polls during its window. Closing tracking and selecting Documents yields zero compact/full owners and zero ticks/polls over a further 32 seconds. No production data was created. The full-card capture recorded one warning without retained message; later LogBox was empty, so that capture is not claimed warning-free.
- Unit suite: 279 before instrumentation, 286 final; current rerun 286/286 passes. Expo lint and updated DRRM UI pass. Current Android production bundle export passes; it is not an installed release. Earlier shell/Services/Maps/tracking fixtures passed, including the diagnosed and fixed absent-__DEV__ browser regression. Baseline Web deprecations/build diagnostics are retained separately.
- Earlier typechecks passed. The current whole-app command fails inside TypeScript 6.0.3 with an internal JSX assertion in unchanged external-link.tsx. Per-file diagnosis finds no other semantic issues. A read-only replay removing all three owned modified files' hunks and excluding all three added files reproduces the same crash; the affected file is byte-identical to the initial snapshot. This is an unrelated current compiler/generated-input issue, not a passed check or suppressed diagnostic. No application source changed during the MuMu continuation.
- Concurrent evacuation-centers-panel.tsx and tests/drrm-centers-ui.mjs changes were preserved, hashed and context-read; the updated UI/build checks and current native evidence identify that state separately. The earlier center-detail-card.tsx change is also preserved. Map-control preparation failures, a stale Fast Refresh warning cleared by restart, the first sandboxed Hermes export failure, and old CPU attribution failures remain historical rejected/limited evidence.

**Cause report and remaining boundaries:** [MuMu completion record](evidence/resident-android-navigation-performance/2026-10-22/mumu-continuation/completion.md) links raw samples, slow-pair classifications, source matching, SLA ownership, native trace analysis and check logs. SLA is disproved as a universal explanation because the slow baseline had N=0; full marker replacement/reload was absent in that warm run; hiding the Health calendar did not materially reduce median delay. The responsible function is not established. Physical/reference/release samples, precise first-correct-frame T5, a controlled source-fix comparison, adverse-network/account/resource acceptance and seamless background resume remain future/manual verification for later phases. Investigate the unrelated TypeScript crash and unclassified full-card warning separately; do not broaden Phase 0 into those fixes.

**Exit:** at least one repeated slow case is reproducible and attributable to a measured interval. If the reported delay cannot be reproduced, retain the instrumentation and document the missing device/build conditions instead of inventing a root cause.

### Phase 1 — Remove refresh-induced waiting and shared profile amplification

Target: Services, Settings, profile provider and Health data/presentation.

- [x] Distinguish initial loading, background refreshing and refresh failure.
- [x] Keep loaded content for unchanged user/tenant/filter scopes.
- [x] Deduplicate equivalent in-flight reads and coalesce overlapping invalidations.
- [x] Remove redundant same-key transport while preserving current live/foreground/mutation requirements. Choose any per-resource freshness window from its verified data contract; no generic TTL is preapproved.
- [x] Preserve mutation-triggered invalidation, explicit retry, reconnect and required foreground checks.
- [x] Reduce shared loading propagation and retain equal profile/geometry values when possible.
- [x] Measure whether a lighter profile projection or separately cached boundary removes meaningful cost before changing the data contract.

**Exit:** returning to Health does not blank previously loaded feeds; entering Services avoids redundant fresh-profile requests; late responses cannot overwrite a newer account/filter state.

ID approval and other eligibility checks retain their existing authoritative validation. Reusing demographic content must not turn cached approval into permission to submit or pay. Existing fail-closed behavior on verification errors must remain intact.

**Execution status, 23 October 2026 (Asia/Manila): Complete for Phase 1.** Its seven requirements and three exit criteria are verified; final physical/release navigation timing remains Phase 5 work, not a claimed performance fix.

**Dated progress note — 23 October 2026:** Scoped read ownership now deduplicates/coalesces refreshes, cancels obsolete work and keeps loaded Health rows/empty states through background refresh and failure. Services/Settings use provider-owned profile freshness; equal profile/geometry values are retained, preference providers avoid status-only propagation, and existing authoritative verification guards remain. No generic TTL, projection change, dependency, backend migration or later-phase fix was introduced. Three alternating profile projection pairs did not demonstrate a request-time benefit from dropping boundary data, so the existing contract remains.

**Verification:** baseline type/lint/286 unit/Services/Health/Android export passed. Final type/lint/294 unit/Services/Health/ownership/Settings/shell/document/payment/Maps checks and Android production JS export pass. MuMu selected-source identity matches, Services/Settings repeated visits show zero profile reads, and visible loaded empty Health feeds survive held refreshes; registration result release completes with 200 reads and zero issues/drops. Populated rows, out-of-order account/filter ownership, failure/retry and mutation/reconnect/foreground semantics pass actual UI/hook fixtures. Pre-existing Home PNG-loader and verification-location fixture failures are recorded separately. Native physical/release timing, populated-device and real mutation qualification remain pending manual verification under later acceptance.

**Workflow and evidence:** followed section 7's central Git → ripgrep → Reader → cached scoped Repomix 1.18.1 → complete bounded XML → original-source workflow. Existing application edits were preserved; no instruction conflict. The Health month APIs were adapted to the verified sole caller. [Completion and acceptance record](evidence/resident-android-navigation-performance/2026-10-23/phase-1/completion.md) and [compact context index](../tmp/resident-nav-phase1-20261023/context-index.md) record scope, hashes, reads, decisions, actual checks, rejected diagnostic attempts and manual steps.

### Phase 2 — Eliminate redundant map and derived-data work

Target: incident/center hooks, Maps and shared MapView.

- [x] Memoize expensive parsing/sorting/marker derivations by meaningful data and location inputs where profiling shows repeated work. Existing compiler caches verified; no additional measured expensive derivation warranted manual memoization.
- [x] Stabilize category colors, presentation inputs and boundary geometry. Retain existing upstream memoization/equal profile values and compare equivalent bridge state before serialization.
- [x] Ensure equivalent data causes no repeated full marker/boundary message after initialization.
- [x] If changed datasets remain expensive, reconcile markers by ID and update only changed entries. Conditional gate evaluated: no measured changed-dataset bottleneck justifies reconciliation; changed payloads keep the existing full-update contract.
- [x] Preserve latest data across map readiness, reload and retry; do not suppress necessary initial replay.
- [x] Investigate actual WebView reloads only if load/ready counts reveal them. Zero warm reloads observed; no speculative reload fix or navigator change.

**Exit:** route-only changes with unchanged map data generate no redundant full marker replacement. Map selection, boundary reset, location, overlays and routing still work after repeated navigation.

**Execution status, 23 October 2026 (Asia/Manila): Complete for Phase 2's scoped implementation and behavioral gates.** This does not claim that maps caused the reported universal delay or that physical/release timing targets are met.

**Dated progress note — 23 October 2026:** MapView now retains the last injected marker/color, boundary and presentation payload per document and skips equal data before serialization. Explicit commands and boundary-refit keys remain repeatable. Native load/error/process-loss events invalidate readiness and sent state; the next ready event replays current props. Tile errors keep an otherwise usable map ready. Removed category hints clear instead of retaining old colors. No hook/query/cache/auth/routing algorithm, dependency or later-phase change was needed.

**Verification:** baseline/final lint, 294 unit tests, Maps and DRRM fixtures pass; shell regression and focused bridge lifecycle fixture pass. Ten equal-content updates improve from 11 total marker/boundary/presentation sends each to one each; actual Leaflet marker/boundary identities and panned viewport survive ten updates. Latest-before-ready, reload, process loss, retry, empty/removal, changed marker fields, theme/font changes and repeatable commands are covered. Android production JavaScript exports pass before/after using permitted Hermes execution; sandboxed baseline temporary-file denial is retained as an environment failure. Whole-app typecheck reproduces the pre-existing TypeScript JSX assertion in unchanged external-link.tsx; per-file diagnosis checks 296 application sources and finds only that crash, with zero other diagnostics. Existing browser deprecations and export environment warnings remain pre-existing.

**Native scope:** six loaded map/hook/caller factories and source-map originals match current working sources. Three Maps round trips before and after have zero full marker/boundary sends, zero load/ready events, six observed presses each, zero dropped events and zero recorded issues. Candidate layer switching, zoom, boundary reset and location-control activation complete without issues. Centers selection, routing guidance, clearing, reset/zoom and two Home/DRRM round trips also complete with one initial map load and zero drops/issues. These observations preserve the existing native warm behavior; the 11→1 result is a controlled wrapper fixture, not a measured native navigation speedup. Native GPS accuracy, forced WebView-process recovery, full routing correctness with representative data and physical/release timing remain manual/later qualification; route/picker/offline behavior is verified by the actual-wrapper/Leaflet fixtures and existing routing tests.

**Workflow, decisions and discrepancies:** followed section 7's Git → ripgrep → Reader validation → cached scoped Repomix 1.18.1 → complete bounded XML analysis → original-source verification. Preserved existing edits; no repository instruction conflicts. Current compiler output already caches incident markers and center parsing/sorting, Maps already memoizes colors/presentation, and Phase 1 retains equal profile geometry: these pre-existing implementations satisfy the relevant conditional work without duplicate memoization. Earlier document-wide implementation-status statements and raw-source churn hypotheses are historical; this Phase 2 record supersedes them only for this scope. [Completion/acceptance record](evidence/resident-android-navigation-performance/2026-10-23/phase-2/completion.md) and [compact index](../tmp/resident-nav-phase2-20261023/context-index.md) record source/packet identities, baseline, owned changes, rejected test attempts and exact manual steps.

### Phase 3 — Isolate hidden screens and suspend unnecessary work

Target: per-card SLA work, floating-tab inset consumers, root route subscription, DRRM routing ownership, shared providers, navigator.

- [x] Suspend hidden/background per-card SLA ticks/polls; preserve visible processing status and freshness on return. Full/compact owners gated by focus + foreground, with abortable reads and one current read per distinct request on return.
- [x] Evaluate one shared visible tick/bounded visible-row ownership before adding any new polling owner; avoid N duplicate per-card requests where existing contracts support reuse. One shared visible clock replaces N tick intervals. Existing authorized RPC is single-request; distinct visible requests retain their polling, while retained compact/full duplicate ownership stops.
- [x] Keep pathname-dependent layout handling small and isolate expensive destination content. Scalar clearance adapter and sibling restoration chrome verified by actual-provider/root render fixtures.
- [x] Give connected/local route work explicit screen visibility ownership where the trace proves retained work. Centers focus + foreground gates connected/local work and age/conditions polling; cancellation/current-input behavior verified in actual-hook fixtures. Representative native-origin routing qualification remains manual.
- [x] Cancel obsolete work on blur/account/filter changes and resume from current inputs without outdated results. Abort/token cleanup and result ownership verified with deferred responses, account/request/origin/center/conditions changes and foreground return.
- [x] Measure routing preparation and assembly before modifying search chunking; do not assume an async function is nonblocking throughout. Supporting current-core/pack host measurement recorded; Hermes probe rejected. No search chunking change made; representative Hermes measurement is mandatory before any future change.
- [x] Separate always-live badge/notification ownership from optional hidden-screen work. Existing shell/session providers preserved; deliberate public/cache ownership inventoried.
- [x] Test `freezeOnBlur` as a controlled candidate on the installed Expo Router implementation. Freezing rendering does not stop subscription callbacks, requests or timers. Clean native experiment reduces commits but lacks qualified latency/restoration acceptance; candidate removed.
- [x] Test native screen detachment only if native attach/draw timing is dominant; evaluate memory and WebView restoration. Conditional gate not met: no attach/draw-dominant evidence, so installed Android detachment remains unchanged.

**Exit:** hidden work is bounded and deliberate; resuming screens does not dump a large update backlog, show the wrong content or lose state. Reject freezing/detachment candidates that regress rapid switching, nested navigation or maps.

The installed Expo Router package is 57.0.10 at inspection time and contains its own React Navigation implementation. Its local types expose `freezeOnBlur`, `lazy` and `detachInactiveScreens`; Android detachment defaults to enabled and lazy loading defaults to true. Verify the actual installed implementation again before applying navigator changes. Do not substitute options from a newer external navigator release.

**Execution status, 23 October 2026 (Asia/Manila): Complete for Phase 3's scoped ownership/isolation implementation and behavioral gates.** Native representative-route/Hermes segment qualification and physical/release performance acceptance remain pending manual/later verification; this does not claim that the universal 1–3 second delay is resolved.

**Dated progress note — 23 October 2026:** Both SLA layouts now have account/request ownership, focus/foreground gating, response validation and abort cleanup. Six visible cards share one 1-second tick and one foreground listener. Centers supplies explicit visibility to local/connected routing; obsolete results cannot publish, hidden inputs do no preparation/search, and failure guidance is visible. Small scalar-inset and restoration-overlay adapters isolate pathname propagation, retaining auth/public/callback behavior and overlay stacking. Badges, notifications and bounded public offline-cache ownership remain deliberately live. No new dependency, backend/schema/configuration change, commit, push or deployment.

**Verification:** baseline/final lint pass; app unit tests 294→303 and shared routing/client/SLA tests 85→85 pass. Shell/Services/tracking/DRRM/Maps fixtures pass; new actual-hook ownership and root-isolation fixtures pass. Final Android production JS export passes. Baseline/final typecheck reports the same three pre-existing TS2859 errors in unchanged external-link.tsx, with zero new diagnostics. Final ten loaded Android module factories/source-map originals match working sources. Six retained compact cards change from 180 ticks/18 polls in a 32-second hidden baseline window to zero hidden ticks/polls; separate final hidden/background 32-second windows have zero callbacks/issues/drops. Foreground/tab return performs six reads for six distinct requests. One visible full card with six retained compact cards records 30 full ticks/two polls, zero compact callbacks and zero issues/drops. Ten controlled hide/show loops show no timer/listener growth; request/account replacement, stale responses, backoff/retry and solver failure are covered. Equal-inset route changes cause zero clearance-consumer commits, and route-only restoration changes cause zero root-navigator renders in focused fixtures.

**Conditional experiments and limits:** current-core Node measurements use the shipped 900-node/1064-edge pack and 30 synthetic-condition runs: maximum preparation freezing 1.26ms, attachment 17.89ms, assembly 0.56ms and uninterrupted generator segment 22.23ms. These are host-only; a diagnostic-only Hermes inspector source-copy probe failed and terminated the development process, was rejected, and was replaced with independent checks after restoring the app. Search algorithm/chunking remains unchanged. The clean native freezing comparison passes the same circuit/rapid-final-selection/Maps controls with zero issues/drops and reduces total recorded commits 133→70, without a qualified presentation/timing/backlog comparison; freezing is not retained. No attach/draw evidence warrants changing detachment. Native GPS/representative closures/avoidance, physical/release timing and long-session resource qualification remain exact manual steps in the completion record.

**Workflow and discrepancies:** followed the centralized Git → ripgrep → Reader validation → cached scoped Repomix 1.18.1 → complete bounded XML → original-source sequence, with recoverable working-copy snapshots/patches and compact source/packet indexes. Initial 30-entry packet, 17-entry final packet and three-entry review supplement have clean security scans and zero omissions; unchanged context reused by hash. Existing user work preserved; no repository instruction conflict. Installed Router remains 57.0.10 and screens resolves to 4.26.2. Historical document-wide pending statements are stale; only this phase's record changed. [Completion/acceptance record](evidence/resident-android-navigation-performance/2026-10-23/phase-3/completion.md), [verification](evidence/resident-android-navigation-performance/2026-10-23/phase-3/verification.json) and [compact context index](../tmp/resident-nav-phase3-20261023/context-index.md) record decisions, rejected diagnostic/runner attempts, ownership limits and manual steps.

### Phase 4 — Reduce data/render cost where the baseline proves it matters

- [x] Measure feed cardinalities and response parsing costs. Read-only aggregate sizes/cardinalities and 30-sample synthetic host parsing recorded; actual Hermes response parsing remains part of pending native qualification.
- [x] Replace unnecessarily broad projections with fields the screen actually consumes. Reports summaries, Requests and Activity narrowed; incident detail, payment/legacy fee and SLA contracts preserved.
- [x] Paginate long histories with deterministic ordering and preserve complete counts separately. Three histories use 25-row timestamp/UUID keyset pages; server filters precede paging. Exact totals retained independently; live report badges use scoped exact HEAD counts. Supporting tests cover >1,000 rows, ties, changes, errors/retries and obsolete account/filter responses.
- [x] Virtualize large Health/activity lists if native layout/render work is dominant; preserve variable-height/accessibility behavior. Conditional gate not established: current registrations max 3; activity initially bounded by paging; existing Reports FlatList and themed variable-height layouts retained. No speculative virtualization rewrite.
- [x] Inspect query plans/indexes only for requests with measured server-side delay. Preserve resident/tenant scoping and existing authorization. Conditional gate not established; no database/index/RLS change. Current owner filters and authorization preserved.
- [x] Remove expensive nonessential synchronous logging/instrumentation from the final timing build. Existing instrumentation is development-gated/off by default/bounded; production test verifies no recorder/timer/fetch wrapper. No scoped per-render production logging or new instrumentation; Android production JS/Hermes export passes.

**Exit:** large-history accounts meet the same navigation targets without missing rows, incorrect totals or altered account boundaries.

**Execution status, 23 October 2026 (Asia/Manila): Partially complete.** Scoped implementation and automated behavior/API/static/build gates are finished. The exit's physical Android/release large-history navigation targets are **pending manual verification**; neither synthetic histories nor host parsing/export results establish native performance or resolve the reported universal 1–3 second delay. Current emulator smoke stopped at a missing Services tab control and is not a passing native gate.

**Dated progress note — 23 October 2026:** Measured current live maximum histories are 25 service requests, 7 incident reports and 3 registrations. Base-row mean bytes fall 1,567→225 (Requests), 1,567→246 (Activity) and 779→427 (Reports), excluding unchanged joins. A small history owner reuses the existing abort/deadline/deduplication resource. It retains loaded prefixes and scroll presentation through refresh/errors, loads older pages explicitly, rejects repeated cursors, validates timestamp/UUID syntax without losing microseconds and isolates account/filter state. Requests/Reports invalidations refresh the loaded prefix atomically; Activity preserves focus freshness. Complete report counts remain live independently of paged rows. No new dependency, remote mutation/schema/configuration change, commit, push or deployment.

**Verification:** baseline/final lint pass; app unit tests 303→309 pass. Baseline/final Services stability, Health and tracking/payment pass. Final Services lists, Reports/announcements, resident shell, hidden-work ownership and installed-Router Back fixtures pass. Pagination covers all 1,003 synthetic rows; UI covers 63 Requests/Activity rows, the complete 31-row History filter, independent 1,003-report count, filter/status/fee semantics, account replacement, theme/font and retry/scroll behavior. Zero new fixture diagnostics; Reports retains its two existing RN Web deprecations. Baseline/final typecheck has only the same three pre-existing TS2859 errors in unchanged external-link.tsx. Initial baseline Android export failed on sandbox Hermes Temp permissions; final permitted production JS/Hermes export passes. An intervening successful export labeled baseline-permitted was transitional source and is excluded from comparisons. Five actual anonymous API contract reads return HTTP 200 with zero private rows; authenticated large-account/RLS/device journeys are not claimed by those reads. Synthetic 5,000-row host parse median is 17.42ms broad vs 4.90ms projected; first 25-row projected page is 7,091 bytes/~0.025ms median. These are supporting Node measurements, not actual resident/Hermes/native presentation timings.

**Workflow, decisions and discrepancies:** followed section 7's Git → ripgrep → Reader validation → scoped cached Repomix 1.18.1 → complete bounded XML analysis → original-source verification. Preserved existing user edits, non-secret snapshots/patches and source identities. Initial 18-entry/final 12-entry packets have clean security scans and zero omissions. No applicable repository instruction conflict. Reports/Requests/Logs still had independent fetch paths despite earlier shared-resource work; all three now use the existing owner semantics. The full MyIncidentRow type also serves the detail route, so summary projection has a separate type. Health totals/registered-drive membership require complete registrations; no partial paging without a separate membership/count contract. Current small datasets and absent native/server dominance do not justify Health virtualization or indexes. Earlier global pending statements are historical and remain unchanged. [Completion/acceptance record](evidence/resident-android-navigation-performance/2026-10-23/phase-4/completion.md), [verification](evidence/resident-android-navigation-performance/2026-10-23/phase-4/verification.json) and [compact context index](../tmp/resident-nav-phase4-20261023/context-index.md) record exact results, rejected fixture/environment attempts, ownership limits, conditional decisions and manual steps. Phase 5 is unchanged.

**Final review update — 23 October 2026:** Requests filter changes now create a unique subscription topic using the existing helper, preventing reuse while the preceding channel is being removed asynchronously. Verified the installed Realtime implementation and passed the delayed-removal/filter-switch fixture. Lint and the final Android production export pass after this correction; typecheck retains only the same three pre-existing diagnostics. The three-entry review and three-entry closure Repomix supplements have clean scans, zero omissions and complete bounded reads; the final source-hash audit reports zero context drift, an unchanged package lock and no unexpected source changes.

**Remaining Phase 4 acceptance gates — keep unchecked until verified:**

- [ ] Restore a discoverable Home screen with bottom tabs in the emulator and verify current compiled source identity. Exercise Services → Requests → History → Activity → Reports → Home, including paging, retry, return freshness and Android Back, while checking runtime diagnostics. The attempted smoke run stopped at `Tab missing: services`; it supplies no passing flow evidence.
- [ ] Use owner-authorized representative large histories on physical reference Android hardware with matching baseline/candidate release builds. Verify every resident/filter's row completeness and independent totals, including timestamp ties, changes between pages and histories exceeding 1,000 rows. Current live cardinalities and anonymous API syntax checks do not satisfy this gate; creating remote test data requires separate authorization.
- [ ] Verify the section 8 native navigation targets at that scale with synchronized input/presentation evidence and the specified samples. Qualify slow/offline return, later-page failure/retry, account changes during reads and resource stability. Record Hermes parsing/render/layout costs before revisiting conditional virtualization. Coordinate the full journey qualification with Phase 5 without marking either phase's native acceptance complete prematurely.

**Remaining out-of-scope findings:** existing external-link.tsx TS2859 errors; the unchanged public catalog's instance-stable retry topic, whose possible asynchronous removal collision needs separate real lifecycle reproduction; announcement count/ID feeds' existing API-cap assumptions; and Health's complete registration membership/count contract before any future large-history pagination. These findings were not fixed or represented as passing native behavior. Phase 4 remains **Partially complete**, with its implementation finished and the above manual acceptance pending. No Phase 5 checklist or status was changed.

### Phase 5 — Verify the resident journey and prevent recurrence

- [ ] Run the native acceptance suite below on baseline and candidate builds.
- [x] Extend focused lifecycle tests for refresh reuse, cancellation, account isolation, visibility ownership and map-message behavior. Added active-read sign-out/late callbacks, ten-minute virtual visible/hidden polling, current-scope map replay, all directed pairs/nested Back and rapid/prevented presses.
- [x] Run relevant existing resident shell, Services, Reports, Maps/DRRM and routing checks for changed areas. Final combined command passes all 15 suites, including 309 app and 85 shared routing/client/SLA tests.
- [x] Run the application's relevant static checks; record existing unrelated failures separately. Baseline/final lint and permitted Android production JS/Hermes export pass; typecheck retains exactly the same three TS2859 diagnostics in external-link.tsx lines 9/12.
- [x] Save a compact before/after report and retain the baseline artifacts. Working-copy snapshots/patches, source/packet identities, raw bounded diagnostics and final logs retained; no source-paired release speedup claim.

**Exit:** measured improvement passes the native targets and affected journey checks. Browser fixtures remain supporting behavioral evidence.

**Execution status, 23 October 2026 (Asia/Manila): Partially complete.** Automated recurrence coverage, regression/static verification and current-source emulator diagnostics are finished. The exit's paired physical/reference release timing, native input/presented-frame and full journey/resource gates are **pending manual verification**. A production JS export and emulator React commits cannot satisfy those gates. The universal 1–3 second delay is not certified resolved.

**Dated progress note — 23 October 2026:** Added `npm run test:navigation --workspace=@barangayan/mobile` with separate per-suite logs/artifacts and nonzero failure status after independent suites finish. Existing actual-hook/provider/native-wrapper fixtures now exercise sign-out with simultaneous private reads and obsolete channel callbacks, executing visible polls and hidden idle windows over ten virtual minutes, empty latest map scope during reload and thirty equal updates. Installed-Router tests cover all thirty directed pairs and nested Services/Health/Reports/Settings Back; shell tests cover rapid accepted and prevented presses. The Reports fixture's intermittent page activation is now separated from virtualized rendering by accessible keyboard activation and an explicit cursor-read gate. No production application source, lockfile, dependency, authorization, backend/schema/configuration, navigation option or theme behavior changed. Existing user edits remain preserved; no commit, push, deployment or remote data mutation.

**Verification and native limits:** all 15 final suites pass, with zero new fixture diagnostics; Reports retains its two existing RN Web deprecations. Final typecheck output is byte-identical to baseline (three existing TS2859 errors). Initial sandbox Android export failed on Hermes temporary bytecode permissions; permitted pre-edit baseline and candidate exports pass. Thirteen loaded MuMu module factories and mapped originals match working source. Current Android 12 development capture exercises all thirty pairs and ten warm circuits: 127 presses, 126 selections, 3,099 events, zero drops, 100 observed HTTP 200 reads, one map load/ready and one initial full marker/boundary send each. There are 125 matched handler→React-commit observations (median118.0ms/p95207.5ms/max776.1ms), with all thirty per-pair rows retained. These are not tap→presented-frame/usable-content results or a speedup comparison. One unclassified native warning prevents a clean long-run claim. The initial optional History lookup stopped after the circuit; the intact recorder was recovered, and a separate Requests→History→Logs→Reports→Home continuation passes with zero recorded issues/drops using visible text bounds. Native paging at representative scale, real account/mutation/permission/adverse-network journeys, memory and synchronized frame acceptance remain pending.

**Workflow/checklist and discrepancies:** scope and acceptance inherited from section 7; prerequisites confirmed in original refresh/profile/Health/map/SLA/routing/inset/history code, without treating earlier phase labels as physical acceptance. Followed Git baseline → ripgrep → Reader/index validation → cached scoped Repomix1.18.1 → full bounded XML reads → original-source verification and pre-edit checks. Retained 440 non-secret source/config/test/plan snapshots and Git patches. Initial19-entry, Reports3-entry, final9-entry and closure1-entry packets have clean scans and zero omissions; final union has zero source drift. Complete continuation boundaries, compression gaps and docs/version identities are in the compact index. No Repowise/Reader connector available; direct discovery used. No applicable repository instruction conflict. Global historical pending language and Phases0–4 were left unchanged. Current native tabs were hidden by Search, not a missing Services route; Back/control discovery resolved that runner precondition. Early rejected assertions/runner attempts and their causes remain recorded separately.

**Remaining acceptance — do not mark passed:** identified paired baseline/candidate release APKs on physical reference Android hardware; at least30 warm samples per directed pair across at least3 runs with synchronized T0/T5/T6/frame evidence; full section9 journeys on authorized representative accounts, including large histories; actual ten-minute resource/retained-memory measurement within a supplied device budget; classify the native warning. Exact steps and every section8/9 criterion's status are in the [comparison/acceptance report](evidence/resident-android-navigation-performance/2026-10-23/phase-5/comparison.md), [verification record](evidence/resident-android-navigation-performance/2026-10-23/phase-5/verification.json) and [compact context index](../tmp/resident-nav-phase5-20261023/context-index.md). Phase5 remains Partially complete until those gates are verified.

## 8. Proposed performance acceptance targets

These are project targets to validate on agreed reference hardware, not measured results or framework guarantees.

| Metric, warm repeat navigation | Proposed target |
|---|---|
| Tap → visible acknowledgement | p95 ≤ 100 ms |
| Tap → first correct destination frame | median ≤ 150 ms; p95 ≤ 300 ms |
| Tap → usable previously loaded content | p95 ≤ 300 ms |
| Multi-second navigation stalls | No repeatable ≥ 1,000 ms samples; investigate every captured outlier |
| Frame pacing during switches | No app-caused ≥ 100 ms presentation gaps; compare missed-frame distribution with baseline |
| Same-data map update | Zero redundant full marker/boundary sends caused solely by changing bottom tabs |
| Requests/channels/timers after warm navigation | No monotonic growth; necessary active ownership documented |
| Memory over a 10-minute loop | No continuing retained-memory growth after warm-up/collection; total within the measured device budget |
| Slow/offline network | Destination and cached content still open promptly; clear refresh/error state is local to the affected data |

Use an initial 10-round screen to find problems. For final normal-network release acceptance, collect at least **30 warm samples per directed pair** across the six tabs, distributed across at least three runs. Report median/p95/max for each pair as well as an aggregate; do not hide a slow Maps or DRRM pair inside a fast average. Report adverse-network and rapid-tap scenarios separately.

Physical-device acceptance is required for a claim about resident experience. If only emulator/development runs are available, mark that portion pending.

## 9. Functional acceptance scenarios

- All six tabs show the correct selected state, header and content; rapid taps end on the last accepted destination without queued replay or a stuck screen.
- Tab history and Android Back remain correct, including nested Services, Health, Reports and Settings screens.
- Previously loaded lists, selected segments, map selection and scroll position survive normal tab changes where expected.
- Successful create/edit/cancel/register/report/read actions update relevant lists and badges when returning.
- Shared badges and notifications remain live while their detail screens are inactive.
- Sign-out and account switching cannot expose prior resident data, stale requests, cached eligibility or map data from an obsolete private scope.
- Offline/reconnect, profile refresh failure and server errors do not trap navigation behind a spinner.
- Maps and DRRM retain boundary, location, route correctness, current conditions and map controls after repeated hiding/showing; no duplicate WebViews or unexpected reloads.
- Background/foreground transitions and location permission changes stop/resume appropriate work.
- Search draft, keyboard/tab visibility, reduced motion, theme/font changes and accessibility focus remain correct.

## 10. Evidence to produce and completion record

### Evidence already collected during this refinement

The compact index at [resident-nav-audit context](C:/Users/User/barangayan/tmp/resident-nav-audit-20261022/context.md) records source identities, packets, completed reads, exact outcomes and pending questions. The recoverable plan baseline and relevant tracked/staged patches are in the same task folder. No application source was edited by this audit.

| Check | Actual result | Limit |
|---|---|---|
| Repomix core/data/supplement/polling/changed-Health packets | Required selected entries captured; security scan clean | Compression omits behavior; decisive originals inspected separately |
| Original-source probes | Two immediate profile refetches construct two requests; raw hooks return equal-content/new-reference centers/markers | Substituted hook state/transport, no native timing; compiler caveat applies |
| SLA effect probe | Three card effects create six intervals and three initial calls; unmount cleanup removes all intervals | Synthetic hooks/timers/RPC; no periodic loop or real backend request executed |
| Installed compiler transform | Isolated incident/center hook output caches derivations; profile/theme transforms have no emitted memo cache | Not proof of the loaded Metro bundle or actual render counts |
| Existing resident shell lifecycle fixture | Passed using installed Brave; no page errors | Native routing/animation/data are mocked |
| Existing Services stability fixture | Passed; three background refreshes preserve document position, error/status guidance still works | Focus/data hooks mocked; not a performance benchmark |
| MuMu diagnostic | Android 12, 1080×1920, density 480, font scale 1.0; 12 taps captured in the debuggable `com.barangayan.resident.dev` app | Package install metadata differs from current production app config; loaded JavaScript source revision unverified |
| MuMu video review | Some intermediate samples show previous header/selection persisting before destination catches up | 60 sampled header/bar crops; host timestamps not synchronized to recording; no exact latency/p95 claim; Maps/DRRM not exercised in this capture |
| System trace attempt | Rejected for causal analysis: file contains only two clock-sync records | No usable CPU/input/frame attribution; presence of a trace file is not a passing gate |
| Local JS inspector | Authorization error; not bypassed | No Hermes CPU profile or live render/bridge counts acquired |

The first browser baseline launch failed because the default cached browser executable was absent; rerunning once with the existing Brave executable passed. The first ADB connection needed execution outside the sandbox; the approved emulator connection then succeeded. These are environment limitations, not application error findings.

During the audit, Health's source changed outside this task. Its dependency-specific finding and references were revalidated and a small supplemental packet was generated; the earlier Health entry remains historical. Do not attribute that UI edit or its test coverage to this audit.

### Remaining implementation evidence

Store implementation evidence under a dedicated navigation-performance folder, separate from earlier animation/fidelity captures:

```text
plans/evidence/resident-android-navigation-performance/2026-10-22/
  environment.json
  baseline/                   # timings, representative trace/video, resource counts
  experiments/                # one change per comparison, including rejected candidates
  candidate/                  # same scenarios and devices
  comparison.md               # cause → fix → measured effect, per-pair results
  regression-results.json
```

Each result should identify build/source state and contain sample count, median/p95/max, request/render/map-message counts, relevant frame evidence and limitations. Preserve only diagnostic metadata; omit credentials and personal response bodies.

Completion requires a clear statement of:

1. Which interval caused the reported delay and the evidence establishing it.
2. Which changes improved it and by how much on the same device/build conditions.
3. Which user journeys were checked and which targets remain pending.
4. Any retained tradeoff, such as increased memory from keeping native screens attached.

Do not use added animation, blanket eager mounting, a full app rewrite, generic database upgrades or broad dependency upgrades as the starting fix. Apply a small measured change, compare, and retain it only when behavior and timing support it. A subtle press acknowledgement may help feedback, but it does not replace fixing delayed presentation.

## 11. Reference guidance

- [React Native performance overview](https://reactnative.dev/docs/performance): input can wait behind busy JavaScript work; benchmark release builds.
- [React Profiler](https://react.dev/reference/react/Profiler): measures React rendering and adds profiling overhead; it does not establish native frame presentation.
- [Android system tracing](https://developer.android.com/topic/performance/tracing): inspect input, scheduling, rendering and device activity alongside application-level measurements.
- [Expo JavaScript tabs](https://docs.expo.dev/router/advanced/tabs/): navigation architecture context; local installed package code remains the option/version reference for implementation.
- [React Navigation bottom tabs](https://reactnavigation.org/docs/bottom-tab-navigator/): lazy loading/freezing concepts; verify compatibility against the bundled Expo implementation.
- [Expo React Compiler](https://docs.expo.dev/guides/react-compiler/), [React memo](https://react.dev/reference/react/memo) and [React context](https://react.dev/reference/react/useContext): compiler memoization can change allocation/render behavior; context consumers still respond to changed context values.
- [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes): filtering and subscription behavior; backend throughput concerns require workload evidence before architectural changes.

References checked during planning. Supabase's Markdown changelog endpoint could not be retrieved through the browsing tool; recheck relevant current release notes before implementing Supabase-specific behavior changes.
