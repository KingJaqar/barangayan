# P14 — Evacuation centers, device location, route guidance and DRRM interactions: implementation and verification (2026-10-16)

**Status:** Partially complete (non-device scope, OD-06/OD-07/OD-11). T01–T07 verified on non-device checks; T08 (live/device runs) is partial. **Owner decision OD-11 (2026-10-16)** approved sending the starting point to the first-party route service, opened `routeService` and kept Android's offline routing pack out of iOS scope for now. Source: uncommitted on base `e860743`. Environment: local workspace, a browser run of the generated map page, and read-only hosted catalog queries plus **one** test request to the barangay's own `evacuation-route` function (project `pwjbucnyqexiepoinoke`, see Verification). No commit, push, deployment, migration, dependency, configuration, Edge Function, shared-package or Android/web change. One gate was added, `routeService`, and opened by OD-11 after the first pass.

## Entry assessment

Phases 2 and 13 are Verified/Partially complete as recorded; Phase 3's open exits (hosted function deploy, stray history row, hosted invariant run) are carried as blockers, as for Phases 4–13. `AGENTS.md`/`CLAUDE.md` impose no conflict: no migration was needed (next unused prefix stays `0129`), no Expo configuration changed and no Android UI was touched. Expo SDK 57 `expo-location` was read before the location code was reviewed (foreground-only `requestForegroundPermissionsAsync`, `ios.accuracy` `full`/`reduced`, "Allow Once" not distinguishable, `getLastKnownPositionAsync` `maxAge`/`requiredAccuracy`, `watchPositionAsync` foreground only); the Phase 2 adapter already matches it and nothing in it changed.

Baseline before editing (iOS workspace): `tsc --noEmit` 0 errors, `eslint .` 0, `vitest run` 22 files / 447 tests passed.

## Requirement classification (before → after)

| Requirement | Before | After |
|---|---|---|
| A23 directory, search, nearest, list/map, selected card, facilities, occupancy, travel estimates | Partial (basic list: name, address, "N of M reported occupants", call action, behind no search or map) | Implemented in the Emergency hub's Centers section |
| A24 location controls: locate/retry/cancel/confirm/reject/Settings, reduced accuracy, last-known confirmation, background and Settings re-check | Done in Phase 2/13 (controller, adapter, `LocationCard`) | Reused unchanged; wired into Centers; manual starting point added |
| A24 route: request, draw, distance/time, estimate fallback, labels, clear on change | Not started | Implemented against the barangay's first-party route service; gate `routeService` opened by OD-11 (T04) |
| A19 full center/DRRM integration | Maps tab center layer linked to the hub's Centers list | Maps tab links the selected center into Centers with its id (`center` parameter); DRRM panel unchanged |

## What exists now

- **Data.** `schemas.ts`: `centerRow` gains `facilities`, `verified`, `availability`, `updated_at`; `CENTER_COLUMNS` selects them; `CENTER_POLICY.contractVersion` is 3, so older cached lists are discarded rather than shown without the new fields.
- **Centers** (`src/features/centers/`): `center-model.ts` (occupancy, facilities, availability, straight-line estimate, route-aware distance display, search, nearest ordering, update label, Apple Maps URL), `origin.ts` (device fix or placed spot), `route-controller.ts` (framework-free controller with abort/late-response/origin-revision guards, 30 s refresh, backoff, 5-failure stop), `use-center-route.ts` (hook: visible + foreground gating), `route-copy.ts` (card wording), `route-card.tsx`, `center-card.tsx` (card, occupancy meter, facility tags, horizontal picker), `centers-section.tsx` (the screen). `emergency-screen.tsx` renders it for `section=centers`.
- **Map page** (`profile/location-map.ts`): handles the shared `DRAW_ROUTE` and `CLEAR_ROUTE` bridge messages (validated points only, polyline, fit); `DiscoveryMap` gains a `route` prop.
- **Maps tab:** straight-line distances now read "About 840 m away in a straight line"; the selected center links to `/emergency?section=centers&center=<id>`.
- **Gate:** `releaseGates.routeService` (open by OD-11).
- **Tests:** `tests/centers.test.ts` (29), `tests/center-route.test.ts` (22), plus updated expectations in `tests/maps.test.ts`.

## Decisions

- **P14-D01 — route source is the first-party service, not a third-party provider.** The plan text (T04, §6.4) describes the public OSRM `foot` demo. That helper no longer exists: `packages/shared/src/lib/osrm.ts` was deleted in commit `063c94d`, and Android and web now route through the barangay's `evacuation-route` Edge Function (hosted v9, ACTIVE, `verify_jwt = false`; routing graph `ampid-1@2026-10-12#fc7101b6227d`, ODbL attribution returned with every answer). iOS uses the same shared client (`requestConnectedRoute`, `describeConnectedFailure`), as the resident web app does. No third-party routing processor is introduced.
- **P14-D02 — new gate `routeService`, closed until OD-11, now open.** The service receives the resident's chosen starting point in a POST body. The owner had not yet approved that transfer, so the call was put behind a gate of its own rather than `mapProviders` (which would also switch on OpenStreetMap tiles, a separate processor). Mapping: G01, G07, G17, G22. While the gate was closed the controller never sent a request and the card said walking routes were not available yet; that wording remains for any build with the gate closed.
- **P14-D03 — no straight line is ever drawn as a route.** Matches Android ("never drawn as a straight line", invariant 7) and web. Without a route the list shows a labelled straight-line **estimate** (distance at 72 m per minute, Android's pace, "(estimate)"); a center the service cannot reach says "No open walking route" instead of an estimate; a center with no pin, or no starting point, says the distance is unknown, never zero.
- **P14-D04 — connected-only, like web.** iOS does not port Android's bundled routing pack, conditions snapshot store or local road marking (see T07).
- **P14-D05 — manual starting point.** A placed spot (boundary-checked `PinPicker`, with the accessible nudge buttons) overrides the device fix until a new device fix is accepted; both live in memory only. It is sent to the route service the same way as a device fix once the gate opens.
- **P14-D06 — freshness.** The list shows when it was checked and when each center's occupancy changed (`updated_at`), re-aged every minute; the cached copy keeps the Phase 2 stale/expired labels. No invented stale threshold is applied per center. The list is re-read when the screen regains focus and when the app returns to the foreground (`usePublicResource`). A selected center that disappears from the refreshed list produces a notice and stops routing.
- **P14-D07 — selection state.** The selected center is the `center` route parameter (cleared when the section changes), so a return from another screen restores it; search text, view and the starting point stay in screen state.
- **P14-D08 — external navigation.** "Directions in Apple Maps" opens `https://maps.apple.com/?daddr=…&dirflg=w` on the resident's tap. It sends only the destination; Apple Maps asks for the starting point itself.
- **P14-D09 — unknown facility keys are shown, not dropped.** Android silently drops keys it does not know; iOS shows a readable label (≤ 32 characters).
- **P14-D10 — search in both views.** Android searches by name only in the map view; iOS searches the list and the map by name.
- **P14-D11 — bounded retries.** Android and web retry a failing route request forever with backoff; the iOS controller stops after five consecutive failures and offers "Try again" (G19 "stop polling at a defined limit").

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors (baseline 0) |
| `eslint .` | 0 problems (baseline 0); the React Compiler rule `preserve-manual-memoization` flagged one dependency in my first draft (`selected?.id`) and it was fixed by deriving the key from the route parameter |
| `vitest run` | 24 files / 498 tests passed (baseline 22 / 447; 51 new) |
| `expo export --platform ios` | exit 0, one Hermes bundle (run twice, before and after the last edits) |
| Map page executed in a browser | `DRAW_ROUTE` drew one polyline (`#1D4ED8`); a payload with malformed or out-of-range points drew nothing; a redraw replaced it; `CLEAR_ROUTE` and an empty payload left no route; console had no errors |
| Hosted contract (read-only) | `evacuation_centers` has `facilities`, `verified`, `availability`, `updated_at` with the expected types; `public read active evacuation centers` allows `anon` and `authenticated` select on active, non-deleted rows; the seven hosted center ids equal the ids the route service returns (so `best.centerId` matches a listed center) |
| Route service (one test request) | A POST with a synthetic origin near Ampid 1 Elementary and no key returned HTTP 200 with `status: ok`; the shared `parseConnectedRouteBody` parsed it (best route 10.8 m, 9 s, 7 center summaries) and the response carried the ODbL attribution. A second synthetic origin returned `no_nearby_path`. No resident data was sent |

Not run: the app on a device or simulator, a live session (no screen of the app can run against a backend, OD-07), VoiceOver or Dynamic Type, real Allow Once/reduced-accuracy prompts, Apple Maps hand-off, a route request from the app (gate closed).

## Acceptance and open items

- **Met (non-device):** A23 directory, search, nearest, list/map, selected center, facilities, occupancy, full/high/unknown states, unknown values never zero, cache and retry; A24 location actions and confirmations, background and Settings re-check, manual origin, labelled estimates, route guards and clearing (controller and wording, tested with a stubbed service), route card and street chooser.
- **Closed — P14-T04 (OD-11).** The route provider is the first-party service; the owner approved sending the starting point to it and `routeService` is open. G07's remaining conditions (tiles and geocoding under `mapProviders`, device and live evidence) are open; this is not a release approval.
- **Closed — P14-T07 (OD-11).** OD-03 said Android's offline evacuation routing becomes required iOS scope once committed. It is now committed (`063c94d`, `e860743`): a bundled routing pack with an on-device router, a conditions snapshot, the resident's own blocked roads and a connected route over them. P14-T07 says to port a newly working Android capability only if the scope is explicitly added. Only the connected subset (what web ships) is built; the owner kept the offline pack, conditions store and road marking out of iOS scope for now (OD-11).
- **Open — P14-T08.** Live, device, VoiceOver, Dynamic Type, real permission prompts, real provider outage and Apple Maps hand-off are Skipped (OD-06/OD-07).
- **Plan discrepancies:** §6.4 and A24-019 describe the OSRM helper, which was deleted; A24-022 ("use estimated distance/time when a road route is unavailable") is implemented as labelled estimates in lists and never as a drawn route, matching Android's current rule; A23-026 searches only the map view on Android.
- **Out-of-scope observations (not fixed):** the `evacuation_centers` anon select policy has no tenant predicate (the app filters by `barangay_id`); `evacuation-route` runs with `verify_jwt = false`; `npm run check:release` fails by design while gates are closed; Android's center card drops unknown facility keys silently and its route refresh retries without a limit.

## Update — OD-11 (2026-10-16)

The owner approved opening `routeService` and keeping the offline routing pack out of scope. `release-gates.ts` now has `routeService: true`; `tests/config.test.ts` lists it among the owner-opened gates and `tests/centers.test.ts` asserts it is open while `mapProviders` stays closed. Re-run after the change: `tsc --noEmit` 0, `eslint .` 0, `vitest run` 24 files / 498 tests passed, `expo export --platform ios` 0. With the gate open the app requests a route for the selected center once a starting point exists; no screen was run (OD-07), so that request path is verified by the controller tests and the live-service checks above, not in the app.
