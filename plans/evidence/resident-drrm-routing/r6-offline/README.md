# R6 — Android durable offline operation: evidence

Date: 2026-10-14. Branch `main` @ `2e5681c` with uncommitted work (R3–R6 and concurrent sessions). Runtime versions: Node v24.13.1, Expo SDK 57 (expo 57.0.10, expo-file-system 57.0.2, expo-crypto 57.0.3, react-native 0.86.2 with Hermes), Leaflet 1.9.4, MuMu Player 12 instance 0 (Android 12, x86_64).

## What changed

| Area | Files |
|---|---|
| Durable store (pure, injected storage) | `apps/resident-android-mobile/src/lib/offline-routing.ts` (+ test) |
| Document-storage adapter, bundled pack source | `src/lib/offline-routing-storage.ts` |
| Runtime controller, conditions refresh (8 s deadline, 30 s, backoff to 5 min) | `src/hooks/use-offline-routing.ts` |
| Local Dijkstra on the installed pack (cancellable, yields) | `src/hooks/use-local-route.ts` |
| Bundled Leaflet (no CDN), generator + drift test | `scripts/generate-leaflet-assets.mjs`, `src/components/leaflet-assets.ts`, `src/lib/leaflet-assets.test.ts` |
| Map: pack vector basemap, tiles only when online, OSM attribution, road marks, tap mode, declarative route | `src/components/map-view.tsx`, `packages/shared/src/types/map-bridge.ts` |
| Centers panel (extracted for reuse), local route, status card, blocked-road marking | `src/components/evacuation-centers-panel.tsx`, `offline-route-card.tsx`, `road-mark-card.tsx`, `shimmer-skeleton.tsx`, `src/app/(app)/home/emergency-info/index.tsx` |
| Public emergency entry | `src/app/emergency-centers.tsx`, `src/components/emergency-entry-link.tsx`, `src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/account-setup.tsx` |
| Durable center rows (no 30-minute expiry) | `src/hooks/use-evacuation-centers.ts` |
| Cross-graph segment mapping moved into the import-free core | `packages/shared/src/lib/evacuation-routing.ts`, `routing-pack-builder.ts` (re-export) |
| Dependency | `leaflet@1.9.4` as an exact devDependency of the Android app (generator input only; already installed for resident-web/admin-web) |

Invariants exercised: 2 (route keyed to graph/conditions/origin), 3 and 6 (closures and marks never dropped across repair, recovery, or unmapped marks), 4 (missing conditions shown as not downloaded), 5 (older snapshots rejected), 7 (no straight-line route on Android), 9 (public entry outside every guard).

## Automated checks (before → after)

| Check | Baseline | After |
|---|---|---|
| `npx vitest run` (apps/resident-android-mobile) | 10 files / 88 pass | 12 files / 104 pass (R6); 14 / 126 on the final tree, including 2 test files added meanwhile by concurrent settings work |
| `npx tsc --noEmit` (Android) | 0 errors | 0 errors |
| `npx expo lint` (Android) | 0 errors, 2 warnings (`health/register.tsx`) | same 2 warnings only |
| `npx vitest run` (packages/shared) | 29 / 409 pass | 29 / 409 pass |
| `npx tsc --noEmit` (shared, resident-web, admin-web) | 0 / 0 / — | 0 / 0 / 0 |
| `npx vitest run supabase/functions` | 2 / 38 pass | 2 / 38 pass |
| R2 digest, Node | `217d8e6a` | `217d8e6a` |
| Mutation check on the store tests (`tools/mutants.py`) | — | 7/7 killed (hash check, committed-recovery promote, older conditions, avoidance deferral, remap, closure mapping, staged-bytes verification; the last survived until a staged-bytes test was added) |

Store tests cover: exact-byte/schema/area/config verification, first install, corrupt-pack reinstall with avoidance and conditions kept, rollback to the previous pack, unreadable avoidance file set aside, activation deferred offline / not activated / unmapped closure / older snapshot / unmapped mark, activation with closure mapping and avoidance remap by source reference, damaged staged bytes rejected, a crash after every write step (both outcomes observed, never a broken store), conditions ordering, local routing with closures and marks, segment picking.

## Device run (MuMu, Android 12, release build with embedded Hermes bundle)

Test shell `.expo/r6-offline-native` (gitignored, owned by R6): prebuild with application id `com.barangayan.resident.r6offline`, release variant, bundle embedded with `expo export:embed --bytecode` from `apps/resident-android-mobile`, `lintVital*` disabled (AGP lint crash in a dependency). APK A used the hosted Supabase project; APK B pointed at a **simulated** conditions backend (`tools/sim-backend.mjs`, schema-1 snapshot with the graph activated and the R3-proposed entrances) through `adb reverse`, was `debuggable` (for `run-as` file tampering) and allowed cleartext to localhost, and included a temporary probe screen (`tools/r6-probe.tsx.txt`, deleted from the source tree afterwards). MuMu's default GPS is in Manila and it refuses mock locations without changing its app-ops, so the route probe uses a fixed origin (14.6810, 121.1128); device-location acquisition remains R1's physical-phone gate.

| Scenario | Result | Screenshot |
|---|---|---|
| Clean install (never launched), airplane mode, cold start into `barangayan://emergency-centers` | Map renders from bundled Leaflet + pack vector roads/water, no tiles, OSM attribution visible; status card: "Road closures and center status have not been downloaded yet" | `device/01`, `device/02` |
| Online against hosted (graph `unregistered`, no entrances) | Snapshot stored ("checked just now"); selecting a center: "The barangay has not activated this map version yet, so routes are not available"; no line drawn | `device/03` |
| Offline cold start after one online session (APK B) | Store opened, stored conditions rev 1 used, route `ok` 659 m / 21 edges in 79 ms, identical to Node (`tools/route-edges.ts.txt`) | `device/04` |
| Hermes cross-runtime digest (R2 pending item) | `217d8e6a`, identical to Node and edge-runtime | `device/04` |
| Pack verify + prepare (SHA-256 + `prepareRoutingGraph`) on Hermes | 82–113 ms | `device/04` |
| Local route timing, 200 origins, 4 centers (one-to-many + best + shortest) | sync p50 8 / p95 12–15 / max 26 ms; with yields p95 65–90 / max 150 ms (budget p95 ≤ 2 s) | `device/04` |
| WebView bridge cost of the 188 KB basemap message (205,551 chars injected) | round trip 17–21 ms | `device/04` |
| Closure published online (simulated rev 2) on a route edge | reached the device, drawn red; route 923 m / 22 edges, identical to Node | `device/05` |
| Corrupt pack (one byte appended to the active `graph.json`), offline cold start | `repair=reinstalled` from the bundle (436,991 bytes restored), closure rev 2 kept, route still avoids it | `device/06` |
| Interrupted update (journal `staged`, partial candidate pack, staging copy, `avoidance.next.json`), offline cold start | journal cleared, candidate/staging/next files removed, active pack unchanged | `device/07` |
| Unmapped local mark (old graph, unknown source reference) | kept (`avoid=1`); routing refuses with `restrictions_unmapped`, no line; mark card shows "Does not match the installed map"; resident removes it explicitly | `device/07`, `device/08` |
| Blocking a road offline in the Centers map, force-stop, offline cold start | record written to `avoidance.json` with source ref and geometry; purple dashed segment and list entry after restart | `device/09` |
| Center list after >30 min offline | Centers listed from the durable copy | `device/08` |
| Cold start time to the public screen (`am start -W`) | 4.0–5.7 s offline | — |

After the run: airplane mode restored, test app uninstalled, temporary files removed, `adb reverse` cleared, simulated backend stopped.

## Authentication-dependent checks (2026-10-14, owner-approved run)

APK C (same test shell, simulated backend) included a second temporary probe (`tools/r6-auth-probe.tsx.txt`, removed afterwards) that writes a **fabricated test session** (user `0000aaaa-bbbb-4000-8000-000000000001`, test tokens, no real account or password) into the test app's own Supabase auth storage key (`sb-127-auth-token`). The test app only talks to the local simulated backend, so no credential reached any real service.

| Scenario | Result | Screenshot |
|---|---|---|
| Signed-in resident whose account setup cannot load (backend returns no setup status) | Held on the account-setup error screen ("Let's try that again", Sign out); the "Evacuation centers & routes (no sign-in needed)" link is shown under it | `device/10` |
| Link from account setup | Public map opens with the four saved centers, conditions and the resident's blocked road | `device/11` |
| Sign out from account setup | App calls `/auth/v1/logout` and lands on Log In; `routing/v1/ampid-1` (state, pack, conditions, `avoidance.json`) unchanged; AsyncStorage keeps `evacuation_centers_durable_v1` and drops the session key | `device/12`, `device/13` |
| Expired session, airplane mode, normal cold start (token refresh fails offline) | Splash lifts while supabase-js keeps retrying; "Restoring your session…" with the emergency link (8 s after launch) | `device/14` |
| Restoration finally fails (~40 s) | "Unable to restore your session" overlay with Retry and the emergency link | `device/15` |
| Emergency link from the failure overlay | Public map, saved centers, blocked road and "Offline: road closures and center status from 2 min ago"; the overlay does not cover it | `device/16` |
| Emergency link tapped during restoration, observed after the failure | Map stays usable throughout | `device/17` |

## Pending (not verified)

- A real graph update (new pack in a later APK with closures mapped by DRRM): exercised by unit tests only; no second reviewed pack exists.
- Physical phone run (offline GPS + route) for the R10 matrix; hosted routes after an administrator activates the graph and maps entrances.
