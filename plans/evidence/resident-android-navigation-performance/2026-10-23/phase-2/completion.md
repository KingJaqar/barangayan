# Phase 2 completion — 23 October 2026 (Asia/Manila)

Phase status: **Complete for scoped implementation and behavioral acceptance.** Physical/release navigation timing and device qualification remain later/manual work. This change does not establish maps as the cause of the reported universal delay.

## Changed

- Shared MapView compares marker/color, boundary and presentation data with its last injected state before serialization. Equal replacement objects no longer rebuild Leaflet layers or icons. State belongs to one mounted map/document, with at most three retained message types.
- Native load, WebView error and process loss clear readiness and sent state. Readiness replays the latest props; duplicate ready events remain ignored. Explicit camera commands and boundary-refit keys remain repeatable. Tile failures preserve usable offline map readiness.
- Changed marker payloads replace category hints, allowing removed hints to use the existing fallback color.
- Added bridge lifecycle coverage and an additive actual-Leaflet regression. The selected plan phase and compact index record decisions/results. No dependencies added.

Application/test files: [MapView](../../../../../apps/resident-android-mobile/src/components/map-view.tsx), [bridge fixture](../../../../../apps/resident-android-mobile/tests/map-state-bridge.mjs), [Maps fixture](../../../../../apps/resident-android-mobile/tests/maps-presentation-ui.mjs). Existing user modifications were preserved against the working-copy snapshot, rather than HEAD.

## Requirement and acceptance mapping

| Requirement | Status | Direct evidence |
|---|---|---|
| Memoize expensive parsing/sorting/markers where repeated work is measured | Met; existing compiler caches retained | Installed compiler output caches incidents by row reference and centers/distance/sort/markers by raw rows and location; native originals/factories match. No measured additional expensive derivation justified manual memoization. |
| Stable colors, presentation and boundary | Met | Existing Maps memo/profile equal-value retention verified; bridge accepts object-key reordering/equal replacement arrays without sends. Actual changed theme/font/color state remains observable. |
| Equivalent data produces no repeated full sends | Met | Controlled real-wrapper baseline: initial + ten equal updates = 11 sends each. Candidate: one each. Actual Leaflet marker/boundary objects and panned viewport remain unchanged across ten updates. |
| Reconcile by ID if genuinely changed datasets remain expensive | Met, conditional branch not triggered | No expensive changed-dataset evidence. Preserve the existing full changed-data protocol; do not add unmeasured reconciliation. Changed ID, label, kind, coordinates and removals still send. |
| Latest state across initial ready/reload/retry | Met in controlled lifecycle coverage | Props changed before ready and during reload; no send while reloading, next ready replays newest state/location/route/tiles. Process loss, native error, remount retry, repeated commands and forced boundary refit covered. Tile error stays usable. Native forced-crash qualification remains manual. |
| Investigate actual reloads only if observed | Met, conditional branch not triggered | Warm Maps baseline/candidate each have zero loads and ready events. Centers records one initial map load. No speculative source/navigator change. |
| Exit: route-only unchanged data causes no full replacement | Met | Three native Maps round trips before and after: six presses each, zero full marker/boundary sends, zero load/ready events, zero drops/issues. Controlled equal-reference replacement fixture closes the case not exercised by the compiler-cached warm run. |
| Exit: selection, reset, location, overlays and routing survive navigation | Met in affected behavioral checks | Actual-wrapper Maps/DRRM/picker/offline Leaflet fixtures and routing unit suite pass. Native Maps layer/reset/zoom/location control and Centers selection/clear/reset/zoom/two Home round trips complete with routing guidance and no recorded issues. GPS accuracy and representative route geometry need manual qualification. |

## Verification

| Check | Baseline | Candidate/final |
|---|---|---|
| Expo lint | Pass | Pass |
| Unit suite including offline routing | 294/294 pass | 294/294 pass |
| Maps/DRRM actual-wrapper UI | Pass | Pass; extended Maps regression passes |
| Focused bridge lifecycle | Baseline observation, no assertion of fixed behavior | Pass, zero warnings/errors |
| Resident shell | Prior baseline context verified | Pass |
| Production Android JavaScript export | Pass with permitted Hermes execution | Pass with permitted Hermes execution |
| Whole-app typecheck | Pre-existing TypeScript internal JSX assertion | Same failure; unchanged external-link.tsx |
| Per-file compiler diagnosis | Failure already reproduced before editing | 296 application sources checked; only external-link.tsx crashes, zero other diagnostics |
| Owned diff / source ownership / plan scope | Recoverable snapshots and patches saved | Pass: only two existing app/test files + selected phase changed; one new test; no unexpected drift/staged changes |

The first sandbox export failed because Hermes could not write its Temp output. Permitted execution resolved that environmental limitation. Existing browser shadow/pointer deprecations and export color-environment warnings predate this change; no new runtime warnings were observed in accepted focused/native captures. A production JS export is not an installed release APK.

## Native evidence and limits

- Existing MuMu Android development client; same six map/hook/caller factories and source-map originals match current working sources. Native APK provenance remains limited by the earlier Phase 0 record; no release/physical claim.
- Warm Maps baseline/candidate: each n=3 round trips, six acknowledged presses, no full marker/boundary messages or reloads. Presentation sends were six/five; legitimate layout/selection changes remain allowed. This is not a controlled latency improvement claim.
- Candidate Maps: Evacuation/Incidents switching, reset, zoom and location-control activation, return through Home and another reset. Three observed tab presses; no loads/drops/issues. Activation alone does not prove GPS accuracy.
- Candidate Centers: select a real existing center, observe selected details and routing guidance, clear selection, reset/zoom, two Home/DRRM round trips, return to Map/reset. Five observed tab presses, one initial map load, zero drops/issues. No records were created or changed. Routing guidance is not proof of calculated path correctness.
- Forced native WebView crash/reload was not executed. Controlled native-callback fixtures verify replay. Real Leaflet fixtures separately verify rendering, selection, boundary, picker constraints, routes, offline basemap, closures, road marks, location overlays and navigation retention.

## Context workflow and review

Followed the plan's shared Git → ripgrep → Reader → scoped Repomix → bounded XML → original-source workflow. Root AGENTS.md is empty; CLAUDE.md references it; no applicable nested/ancestor conflict. No Reader/Repowise connector and no subagents used.

The baseline includes full status/patches and 327 recoverable nonsecret working-copy inputs; installed versions/ignored context are recorded separately. Initial Repomix 1.18.1: 13 entries, zero omissions, security clean, complete reads [0,11000), [11000,22000), [22000,33000), [33000,34920). Final supplement: three entries, zero omissions, security clean, complete reads [0,11000), [11000,13044). Manifests hold selectors, actual entries, source/packet hashes and continuity. Original effects/handlers and complete owned diffs resolve compression gaps. Packet tokens are not account usage or measured savings.

Adaptations: raw hook allocations are already cached by the installed compiler; Phase 1 already retains profile geometry, and Maps already memoizes colors/presentation. No extra memoization or query/cache rewrite was justified. Document-wide historical status statements and raw-source churn hypotheses do not supersede verified code. Only Phase 2's plan section was updated.

Rejected diagnostics are retained in the compact index: native sandbox connection denial resolved through permitted existing host access; fixture adapter missing resolve directory; a tile-error test incorrectly expected changed data after sending identical props; an initial per-file diagnostic selected zero files due to path-separator mismatch. Corrected accepted results are explicit. No application workaround for these test/tool issues was added.

## Remaining manual / later-phase qualification

1. On the affected/reference physical Android phone, install the same-source release candidate through the normal owner-approved workflow. Warm all tabs and run the plan's per-pair timing suite with debugging disconnected. Report native presentation, not React commit, timings.
2. With representative centers, incidents, current conditions and a confirmed origin, select a center, verify the expected route/closures/avoidance, leave and return repeatedly. Confirm camera/selection/overlays and route geometry remain correct.
3. In a local development test, reclaim/restart the native WebView process, then use the existing retry flow. Confirm the newest filter/data/boundary/location/route appears, with one initialization replay and no subsequent equal full sends.
4. Exercise native denied/granted location transitions, GPS failure/retry and offline/reconnect/background/foreground. Verify local guidance and route availability alongside device logs.

Out of scope: TypeScript's pre-existing external-link assertion, optional hidden routing/SLA work (Phase 3), data-scale optimization (Phase 4), physical/release performance acceptance (Phase 5). No commit, push, deployment, database migration, external configuration change or message was performed.

Raw accepted JSON/logs are in this folder's `results/` and `logs/`. Recoverable source snapshots, historical diagnostic attempts, XML identities and full ownership review remain in [the compact context folder](../../../../../tmp/resident-nav-phase2-20261023/context-index.md).
