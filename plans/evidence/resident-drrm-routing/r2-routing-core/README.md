# R2 — Pure routing core and RRL conformance fixtures

Recorded 2026-10-12 for `plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md`, phase R2. Every result below came from a command run on that date. All findings are **automated** (unit tests, cross-runtime digest); R2 has no UI or device behavior.

## What changed

| File | Change |
|---|---|
| `packages/shared/src/lib/evacuation-routing.ts` (new, import-free, erasable TypeScript only) | Versioned profiles (`ampid-fine` 50 m, `rrl-reference` 500 m; α = 10, β = 0.5, 2 km radius, t ∈ [0, 1]); pack graph types and `prepareRoutingGraph` validation; `stationApplicableEdgeIds` (2 km to segment geometry); `stationRiskFactor` / `stationLevel` / `rrlEdgeWeight`; frozen conditions; temporary origin attachment (50 m, barrier-aware, ambiguity chooser); binary-heap Dijkstra as a resumable generator (D1 push, first-extracted-shelter exit, stable ties); best + shortest + one-to-many center ranking; path reconstruction, metrics, written itinerary; `planEvacuationRoute` (sync) and `planEvacuationRouteAsync` (cooperative yield + cancellation); `runFloodBfs` (descending seeds with shared `visited`, head-index FIFO, unknown terrain) and `floodGridCellAt`. |
| `packages/shared/src/lib/evacuation-routing.test.ts` (new) | 62 tests (below). |
| `plans/evidence/resident-drrm-routing/r2-routing-core/runtime-digest.ts` (new) | Cross-runtime digest: 200 random routing cases + 50 random BFS grids, FNV-1a over the JSON results. |

Not exported from `packages/shared/src/index.ts`: nothing outside the tests uses it yet. R5 imports the file by path (R0 decision); R6/R7 decide how the apps import it.

## Verification

### Checks (baseline → after)

| Check | Baseline (R2 start) | After |
|---|---|---|
| `npx vitest run` (packages/shared) | 25 files / 267 pass | 26 files / 329 pass |
| `npx tsc --noEmit -p .` (packages/shared) | 0 errors | 0 errors |
| `npx tsc --noEmit` (apps/resident-web) | 0 errors (R1) | 0 errors |
| `npx tsc --noEmit` (apps/resident-android-mobile) | 0 errors (R1) | 0 errors |

No app file changed, so the app lint baselines (2 + 2 pre-existing warnings) are unaffected; lint was not rerun.

### Automated tests (`evacuation-routing.test.ts`)

- **RRL conformance (`rrl-reference`):** halfway Alert→Critical gives f = 0.25 and d = 100 m, t = 0 weighs 350; Table 1 golden values (San Mateo-1 19.0, Montalban 23.0, Nangka 17.1, Rodriguez 29.75 → 0.25) — transcribed from the plan, **still pending the RRL PDF check**; D4 clamp below Alert / above Critical; unknown readings and misordered thresholds are unknown; display classes; model-excluded (flooded) edges never traversed on 60 random graphs.
- **Graph validation:** swapped `[lat, lng]` order, reversed geometry, empty graph, unknown node, self-loop, duplicate node/edge, non-finite coordinates, zero length, declared-vs-geometry length mismatch, bad access value, missing source reference, coverage, barrier, station table; 2 km applicability measured to segment geometry, not endpoints.
- **Origin attachment:** temporary split with partial distance; pedestrian direction on the split piece; start at an intersection node; invalid origin; `outside_coverage`; `no_nearby_path`; never attaches across a barrier (creek); ambiguity chooser when another street is within the accuracy radius; resident-chosen segment; re-asks when the chosen segment is closed; same-street and adjacent unnamed segments are not "another street".
- **Dijkstra / scope fixtures:** best = shortest without hazards; competing-risk graph diverges (best 500 m detour, shortest 200 m with cost 700, reason `sensor_risk`); traffic reason; critical station is a soft penalty (f = 1, cost × 11, D9); unknown readings warn without penalty; verified closure, model exclusion, local avoidance and pedestrian prohibition each block the only path → `no_route_within_coverage` (never a straight line); restrictions block both directions; all nearby segments blocked → no safe route; bridges (closed bridge → detour over the other, both closed → no route, bridge named in itinerary); stairs at 0.6 m/s without changing cost; itinerary merges same-street segments; shelter set C (available before unknown, fallback with warning, inactive/unavailable/unmapped entrances excluded with reason, user-selected one-element C, selected unknown warns, selected unavailable refused); conditions for another graph version, bad revision, out-of-range or duplicate traffic, duplicate readings/centers rejected; unmapped closure/avoidance refuses to route (invariant 6); inputs frozen at plan start.
- **Reference solver:** best cost, shortest distance and every center's ranking cost match an independent Bellman-Ford over explicitly listed directed arcs on 150 random graphs (> 60 compared after excluding origins whose own segments are all blocked); one-to-many ranking agrees with single-target runs (> 30 centers); identical results under shuffled nodes, edges, station tables, centers and closures.
- **Ampid I box (D9):** a 13 × 10 street grid over the measured R0 box (1.83 × 1.41 km) with a **hypothetical** station at its center: the 2 km radius covers every edge; the literal "remove every edge within 2 km of a critical station" rule leaves no safe path; the D9 rule keeps a route with f = 1 everywhere and a critical area warning.
- **Cancellation:** pre-aborted token → `cancelled`; on a 1,600-node grid the async planner yields, equals the sync result, and stops after the first yield when cancelled.
- **BFS:** union of independent per-seed flood fills, identical for all 6 seed orders, including a cell (8.5 m) reachable only through a lower seed's basin; a low seed sharing a cell with a higher one does not block it; ridge stops spread; missing terrain reported as unknown; out-of-grid / unknown / below-Critical / invalid-position stations reported; grid–profile mismatch and malformed grids rejected; 50 m production profile.

**Mutation check** (temporary edits, file restored and compared byte-for-byte): removing the D1 heap push, processing seeds in ascending order, removing the D4 clamp, ignoring blocked edges, and breaking the first-shelter exit each made tests fail (≥ 2 failures per mutant).

### Cross-runtime results

`node plans/evidence/resident-drrm-routing/r2-routing-core/runtime-digest.ts` and the same `routingDigest()` imported by a temporary local Edge Function (`supabase functions serve`, CLI 2.118.0):

| Runtime | Cases | Statuses | Digest |
|---|---|---|---|
| Node v24.13.1 | 250 | ok 115, attachment_ambiguous 81, no_route 4 | `217d8e6a` |
| supabase-edge-runtime 1.76.2 (Deno 2.1.4) | 250 | same | `217d8e6a` |

The first run differed (`c703b76b` vs `2f426b57`): 3 of 250 cases, last-digit floating differences only (max relative 1.8e-12; no status, edge or ranking change). A probe found `Math.cos` differs between the two engines on 56 of 2,000 inputs (`Math.sin` 5, `**` 16; `Math.asin`, `Math.hypot` 0). The core now computes cos with a Taylor series in plain arithmetic (max error 3.3e-16 vs `Math.cos` over ±90°) and distances with `Math.sqrt`; the fixture's own lengths avoid transcendental functions. After that the outputs are byte-identical. (The later duplicate-traffic validation does not touch the digest's code path; the Node digest was rerun after it and is unchanged.)

The temporary functions `supabase/functions/zz-r2-runtime-digest` and `zz-r2-mathprobe` were removed and the edge-runtime container stopped; `git status supabase/` shows only the pre-existing untracked `0110`–`0112` migrations.

**Hermes:** `hermesc` (from `node_modules/hermes-compiler`) compiles the type-stripped core to bytecode (36,812 bytes). No Hermes VM is available off-device, so **identical results on Hermes are pending** — run `routingDigest()` in the installed Android build (R6) and expect `217d8e6a`.

## Decisions and plan discrepancies

1. **`safe(e)` vs D9.** Section 3.5 lists `f(e) < 1` in `safe(e)`, but with the D4 clamp f = 1 exactly when a station is at Critical, which is the literal rule D9 rejects. The core follows D9: f contributes only a penalty; hard blocks are pedestrian rules, verified closures, local avoidance and accepted model exclusions.
2. **BFS seed cells are marked flooded.** The plan's pseudocode marks only neighbours; the gauge itself reports water at its cell.
3. **Shortest route destination.** "Shortest" uses the same safe edges and the same center tier as "best", so it may end at a different center of that tier. It is omitted (`null`) when it is the same edge sequence or not strictly shorter.
4. **Attachment.** Only unblocked, pedestrian-legal segments are attached to; if roads are nearby but all blocked the result is `no_route_within_coverage` (no safe path), not `no_nearby_path`. Ambiguity: another street within `max(nearest distance, min(50 m, accuracy))`, unless it has the same name, meets the nearest candidate at the same point, or touches it at the nearest segment's end. Blocked streets do not count toward ambiguity. Wiring this into `assessLocationFix` waits for packs on devices (R3/R6/R7).
5. **Result statuses** added beyond the plan's list: `invalid_conditions` (graph-version mismatch, bad revision/traffic, duplicates) and `restrictions_unmapped` (a closure or avoidance mark the graph cannot represent is never dropped silently). `service_failure` and connected/local `mode` belong to the transport layer (R5/R7).
6. **Out of R2 (left for later phases):** edge-flood compilation from BFS cells (3.4, R8), sensor snapshot IDs and model validity in BFS output (R8), `RoutingPackManifest` / `LocalAvoidanceRecord` (R3/R6), the `layer` attribute (grade separation is represented by topology; R3 may add it).
7. **Constants pending the RRL PDF:** `trafficMax = 1` and the Table 1 golden values are test/config values, not shipped station data.
