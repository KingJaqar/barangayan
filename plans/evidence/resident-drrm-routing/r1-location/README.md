# R1 — Location controller and existing-screen repair

Recorded 2026-10-12 for `plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md`, phase R1. Every result below came from a command or browser session run on that date. "Automated" = unit test; "simulated" = real browser with a stubbed Geolocation/Permissions API; "field" = real device (none yet).

## What changed

| Area | File | Change |
|---|---|---|
| Shared contracts + controller | `packages/shared/src/lib/device-location.ts` (new, import-free) | `LocationFix`, `ConfirmedOrigin` (monotonic `revision`), `DeviceLocationState` with the nine plan states, `LocationAdapter` platform interface, `DeviceLocationController` (request IDs, ownership checks, late-subscription removal, 10 s progress / 45 s stop, quality checks, confirmation, pause/resume, permission-change invalidation), `describeDeviceLocation` (shared resident wording). Exported from the package index. |
| Tests | `packages/shared/src/lib/device-location.test.ts` (new) | 28 tests (see below). |
| Map bridge | `packages/shared/src/types/map-bridge.ts` | New `SET_USER_LOCATION` inbound message (marker + accuracy circle, `pending` flag). |
| Android adapter | `apps/resident-android-mobile/src/hooks/use-device-location.ts` (new) | expo-location adapter: `getForegroundPermissionsAsync` / `requestForegroundPermissionsAsync` (approximate = `android.accuracy === 'coarse'`), `hasServicesEnabledAsync`, `watchPositionAsync` with `Accuracy.High`, `mayShowUserSettingsDialog: false`, `getLastKnownPositionAsync`; AppState `background` → pause, `active` → resume (re-checks permission after Settings). |
| Android UI | `.../emergency-info/index.tsx` | Removed the unconditional on-mount `requestForegroundPermissionsAsync` + `Accuracy.Balanced` fix. Controller runs only while the Centers tab is shown (`:117`). "Locate me" now updates the controller (marker + routing origin), not just the viewport (`:580`); the map follows only an explicit request. Route effect keyed on center id + origin revision (`:540`). Status/confirmation card in map overlay (`:767`) and list (`:812`). |
| Android map | `apps/resident-android-mobile/src/components/map-view.tsx` | `userLocation` prop → `SET_USER_LOCATION` (`:342` page handler); replayed on `MAP_READY` (`:559`) so a map that becomes ready later receives the latest location. |
| Android card | `apps/resident-android-mobile/src/components/location-status-card.tsx` (new) | Theme-token card; actions locate/retry/cancel/confirm/reject/open settings (`Linking.openSettings`). |
| Web adapter | `apps/resident-web/src/hooks/use-device-location.ts` (new) | Secure-context and API checks; Permissions API (auto acquisition only when `granted`; unknown → wait for explicit request); `watchPosition` (high accuracy, `maximumAge: 0`); error code 1/2/3 → denied/unavailable/timed-out; `visibilitychange` pause/resume; permission `change` listener → resume. |
| Web UI | `apps/resident-web/src/components/emergency/centers-content.tsx`, `centers-map-client.tsx`, `centers-map.tsx`, `location-status-card.tsx` (new) | `geoDenied` flag removed (state now derived from the controller, so a later success clears any failure). Route effect keyed on center id + origin revision, so a center selected before the fix arrives is routed once the origin is accepted; stale route results are ignored. Origin marker + accuracy circle, separate dashed "awaiting confirmation" marker. |
| Web locate button | `apps/resident-web/src/components/maps/locate-button.tsx` | Optional controlled mode `{ onRequest, isLocating }` for Centers; the self-managed mode used by `/maps` is unchanged. |

Concurrent work: the "Resident Web Loading Motion and Toast" RW-LT-05 session was editing the same four web Centers files during R1. My first rewrite of `centers-content.tsx` / `centers-map-client.tsx` replaced its edits; after coordinating by message, its read-state UI (skeletons, `LoadingStatus`, `InlineReadError`, `PendingHint`, `aria-pressed`, map skeleton placeholder, `routeStatus` vocabulary `idle|loading|ready|unavailable`) was merged back and that session was told the files were released.

## Verification

### Checks (baseline → after)

| Check | Baseline (R1 start) | After |
|---|---|---|
| `npx vitest run` (packages/shared) | 24 files / 239 pass | 25 files / 267 pass |
| `npx tsc --noEmit -p .` (packages/shared) | 0 errors | 0 errors |
| `npx tsc --noEmit` (apps/resident-web) | 0 errors | 0 errors |
| `npx tsc --noEmit` (apps/resident-android-mobile) | 0 errors | 0 errors |
| `npx eslint` (apps/resident-web) | 0 errors, 5 warnings (all pre-existing: location-verification ×2, use-family-members ×3) | 0 errors, 2 warnings (location-verification ×2; the use-family-members warnings were fixed by the concurrent session, not R1) |
| `npx expo lint` (apps/resident-android-mobile) | 0 errors, 2 pre-existing warnings (`health/register.tsx`) | same 2 |

### Automated (controller, `device-location.test.ts`)

Auto mode never prompts; explicit mode prompts once and never re-prompts a permanently denied permission; services disabled; insecure context; good fix auto-accepted (revision 1) and watch stopped; poor fix held for confirmation while searching continues, worse fixes don't replace it, a later good fix is accepted; confirm → `device-confirmed`; invalid coordinates ignored; **subscription that initializes after cancellation is removed immediately**; **late callbacks from a superseded request ignored**; progress at 10 s and stop at 45 s; last-known fix offered after timeout only for confirmation (never promoted); previous origin kept on later failure; watch start failure → unavailable; browser denial during watch; approximate permission forces confirmation; pause/resume; no-op resume; **permission granted in Settings restarts acquisition, a permission change drops the pending fix**; reject keeps the previous origin; subscriber notification/unsubscribe; quality rules (≤ 2 min, ≤ 50 m, clock skew counts as age); wording for confirmation, blocked permission per platform, kept origin after failure.

### Simulated — resident-web in the built-in browser

`http://localhost:3001/emergency/centers` (Next.js 16.3.0 dev server already running from another session; same working tree). The pane's real Permissions API reports `geolocation: denied`, `isSecureContext: true`.

1. Real denied permission on entry → card "Location is blocked for this site … Try again"; no prompt loop. **Pass.**
2. With stubbed `navigator.geolocation` / `navigator.permissions` (`granted`): explicit request → "Finding your location…"; 180 m fix → "Confirm your location — Accuracy is about ±180 m. Still looking for a better fix…"; confirm → watch cleared (`clearWatch` called), card hidden, list re-sorted with distances (0.2 km first). **Pass.**
3. Remount via client navigation with permission `granted` → automatic acquisition starts without a prompt. **Pass.**
4. **Original defect:** selected a center before any fix ("Set your location to see a walking route."), then delivered a 12 m fix → auto-accepted → "Fetching walking route…" → "0.7 km · ~1 min walking (road route)"; map shows boundary, accuracy circle and route polyline. **Pass.**
5. Leaving the screen mid-acquisition → watch cleared (0 watchers); a late fix delivered to the old callback had no effect; re-entry started a fresh session. **Pass.**
6. After 10 s → "Still searching…"; at 45 s → "No location fix after 45 seconds … Try again", watch cleared. **Pass.**
7. Map view "Show my current location" (controlled) → `aria-busy`/disabled during acquisition; 25 m fix → map flew to the origin, blue marker + accuracy circle (screenshot taken). **Pass.**
8. 375 × 812 viewport: 300 m fix → confirmation card fits, no horizontal overflow; "Discard" → previous origin kept, watch stopped. **Pass.**
9. `/maps` (uncontrolled `LocateButton`) renders; no console errors across all scenarios. **Pass.**

### Not verified (pending manual verification)

Android code is typechecked and linted only. The Expo web build cannot render the WebView map and is out of scope; the plan states emulated GPS (LDPlayer) does not satisfy R1. Steps for a **physical Android phone** with an installed build of the current tree:

1. Fresh install, open Emergency → Centers with permission never asked: card "Your location isn't set" and **no** permission prompt. Tap "Use my location" → system prompt.
2. Allow **Precise**, outdoors: within 45 s the card disappears, the red person marker + blue accuracy circle appear at your position, the list shows distances, selecting a center draws a route from that marker. (Exit-gate evidence: record the marker coordinates vs. the phone's own location display.)
3. Allow **Approximate** only: fix is held for confirmation with the approximate-location note and "Open settings".
4. Deny twice ("Don't ask again"): card shows "Location is blocked for Barangayan" + "Open settings"; tapping Locate does **not** re-prompt. Enable in Settings, return → acquisition restarts automatically.
5. Turn location services off → "Location services are off"; turn on via "Open settings", return → acquisition restarts.
6. Airplane mode (no network), outdoors → a GPS fix is still acquired (offline acquisition).
7. Indoors with poor signal → "Still searching…" at 10 s; stop at 45 s with a last-known location offered for confirmation (or timed-out if none).
8. Start acquiring, press Home, wait, return → acquisition restarts; switch to another tab mid-acquisition → the GPS indicator turns off.
9. Map view: pan away, then confirm the origin/route did not move; tap Locate → map recenters on the new origin.
10. Verify in the installed APK's permissions screen that only foreground location (fine + coarse) is requested — no background location.
