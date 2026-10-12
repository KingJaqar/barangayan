# Barangayan Weather Routing: BFS + Dijkstra Implementation Plan (RRL-conformant)

**File:** `plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md`
**Date:** 2026-10-12
**Primary algorithm reference (RRL):** Piamonte, C. N., Curada, J. P. M., & Zaragoza, M. C. (2026). *Project Bantay: Breadth-First Search and Dijkstra Implementation for Community-Accessible Disaster Response.* Proceedings of WCTP 2025, Atlantis Highlights in Computer Sciences 24, pp. 629–645. DOI 10.2991/978-94-6239-638-8_33. CC BY-NC 4.0. <https://www.atlantis-press.com/proceedings/wctp-25/126023805>

This plan replaces earlier proposals. It is **not** a continuation of the cancelled Phase 8 (Android usability audit) in `plans/Major_Web_AndroidMobile_Improvement_Plan.md`; phase names use the **R-prefix** to keep them separate.

## 0. Feasibility status

| Scope | Verdict |
|---|---|
| R0–R7 (closure-based routing, Android offline, web online-only) | Feasible with the current stack (`expo-file-system`, `expo-location`, `@react-native-community/netinfo`, `react-native-webview`, Deno 2 Edge runtime, vitest in `packages/shared`). |
| R3 exit gate, R10 device matrix and 72-hour drill | Feasible, but require DRRM reviewers and a **physical** Android phone. Emulated GPS (LDPlayer) does not satisfy R1/R10. |
| R8 BFS shadow model | Code is feasible. Requires three inputs not in the repository: PAGASA feed access and station coordinates, a licensed DEM, and a verified vertical datum. |
| R9 activation, R10 enablement | Externally gated on ≥2 held-out flood events and DRRM acceptance. |

Closure-based routing can release before any model activation. Do not claim project completion while device acquisition or model prerequisites remain unverified.

### Scope focus (owner decision, 2026-10-12)

Routing exists **only inside Barangay Ampid I** (San Mateo, Rizal). The single use case is: *a resident's device location → the best and shortest walking path to an Ampid I evacuation center.* Everything below is sized to that:

- Boundary measured from `apps/resident-web/src/data/ampid1-boundary.json`: about **1.83 km × 1.41 km, 1.28 km²**, 147 vertices. The file is a Google Maps trace (`properties.source`), so it is approximate.
- All four seeded centers lie inside it; **Ampid 1 Elementary sits on the boundary line** (0 m from the edge), which is why coverage needs a margin (section 2).
- At the RRL's 500 m cells the barangay is about a dozen cells, which cannot separate one street from the next. At 2 km, the RRL's sensor radius covers the whole barangay (see 3.5).

### Resolved decisions

| Matter | Decision | Why |
|---|---|---|
| Cell size | **Production grid 50 m** (profile `ampid-fine`); the RRL's 500 m exists only as `rrl-reference` for conformance tests and paper comparison, never shipped | ~1,000 cells over the barangay box; trivial BFS cost; RRL §7.5 itself calls for sub-100 m for hyperlocal flooding. |
| Sensor penalty / exclusion for residents | **Staged:** closures ON at release → sensor warning banner + soft penalty once station data is verified → BFS "advisory" overlay → BFS exclusion only after validation | A wrong exclusion can strand people; ignoring an official critical gauge is unrealistic. DRRM-verified closures are the authoritative hard block. |
| Who supplies data | Owner/developer obtains station coordinates and thresholds; barangay DRRM supplies ground truth and verifies closures; DEM licence is the owner's request | Fixed owners, with a fallback: if unavailable, BFS stays pending and closure routing still ships. |
| iOS | **Out of scope for now.** Android and web only; `apps/resident-ios-mobile` is not touched. Revisit as a separate plan once Android and web are verified | Owner decision, 2026-10-12. The shared contracts and Edge Function keep the door open without iOS work. |

## 1. Product contract and boundaries

Build walking routes from the resident's device to the best Ampid I evacuation center, using verified closures and validated weather-risk information.

- **Android (`apps/resident-android-mobile`):** online routing plus durable offline maps and local routing.
- **Web (`apps/resident-web`, Next.js 16.3):** server-backed routing requiring internet; no offline routing infrastructure. The Expo app's web build is out of scope.
- **iOS (`apps/resident-ios-mobile`):** out of scope; no changes.
- **Coverage:** Ampid I only. A device outside the covered area gets an `outside_coverage` result (manual origin still allowed), never a route computed on missing roads.
- **Connected mode:** both platforms receive the current compatible graph, closures, center availability and accepted sensor/model information.
- **Disconnected Android:** use installed graph and downloaded restrictions; disclose their age.
- Device-location acquisition must pass real-device verification before routing is considered complete.
- Retain manual origins, local road avoidance and written road/bridge itineraries.
- Preserve existing Centers layouts and authentication behavior outside the public emergency entry. New controls (confirm origin, mark avoidance, mode banner) are allowed; **existing control sizes and positions must not change** (cancelled Phase 8 boundary).
- Exclude background tracking, live navigation, vehicles and flood-arrival-time forecasting.

"Better online results" means improved information freshness and hazard assessment, not a guaranteed shorter or safe route.

### Mandatory invariants

1. Map viewport changes never change the routing origin.
2. Every route belongs to one immutable graph/conditions/origin combination.
3. A closure cannot be removed merely to obtain a route.
4. Missing information is unknown, not dry, open or available.
5. Older responses never overwrite newer user decisions.
6. Graph updates cannot discard verified closures or local avoidance.
7. Routing failure never produces a straight-line navigation fallback.
8. Web cannot calculate a new route after losing server access.
9. Android emergency access cannot depend on successful authentication.
10. No phase is complete without its required verification evidence.

These measures reduce defects; they do not eliminate uncertainty in weather observations or guarantee passability.

## 2. Location and pedestrian graph

### Device-location controller

One controller per Centers screen. Both initial acquisition and "Locate me" must update it.

Separate:

- `LocationFix`: coordinates, accuracy, device timestamp, receipt time, source.
- `ConfirmedOrigin`: accepted coordinates, source, monotonically increasing origin revision.
- Viewport state: map center and zoom.

States: idle, requesting permission, locating, confirmation required, ready, denied, services disabled, unavailable, timed out.

**Acquisition behavior**

- On entering Centers, acquire automatically only when permission is already granted.
- Explicit "Use my location" may request foreground permission.
- Android checks permission and enabled location services independently.
- Web checks secure context and API availability; classify permission denial, provider failure and timeout separately.
- After permission resolution, start a high-accuracy foreground acquisition session. Show progress after 10 s; stop after 45 s.
- Stop on success, cancellation, screen departure or backgrounding.
- Assign a request ID before starting. All callbacks and subscription initialization check ownership. If a subscription initializes after cancellation, remove it immediately. An unresolved timeout wrapper is not proof the request stopped.
- Automatically accept fixes no older than 2 minutes with accuracy ≤ 50 m when graph attachment is unambiguous; otherwise require confirmation. Label last-known fixes; never silently promote them.
- Keep the previous confirmed origin until a replacement is accepted. Do not repeatedly request permanently denied permission; recheck after returning from Settings.
- A map that becomes ready later receives the latest location state. A permission change invalidates automatic acquisition; it never fabricates or silently reuses a fix.

**Existing defects this fixes (R1 targets)**

- Android `handleLocateMe` only moves the map (`apps/resident-android-mobile/src/app/(app)/home/emergency-info/index.tsx:586-604`); the first fix uses `Balanced` accuracy and requests permission unconditionally (`:144-163`).
- Web `geoDenied` never resets after a later successful fix (`apps/resident-web/src/components/emergency/centers-content.tsx:23,40`) and `selectCenter` does not re-route when the position arrives later (`:45-57`).

Use foreground APIs from [Expo SDK 57 Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/). Verify generated Android permissions in the installed build, not merely configuration files.

### Pedestrian graph

Built offline from an OSM extract; runtime functions never construct topology.

- **Coverage = Ampid I boundary + a 150 m connectivity margin.** The margin keeps boundary-line centers (Ampid 1 Elementary) and roads that briefly leave the traced boundary routable. The margin is not a second barangay; routes remain inside this single area. Widen only if the DRRM connectivity review shows a cut-off area.
- The flood grid and DEM used by BFS are **server-side only** and may extend beyond this area (corridor from stations/river to the barangay). Devices receive only compiled per-edge conditions, never the DEM or grid.
- Retain geometry, distance, names, pedestrian access, stairs, bridges, layer, stable source references.
- Connect shared topology; preserve grade-separated crossings and barriers. Interpret pedestrian direction restrictions separately from vehicle restrictions.
- Reject incomplete topology and non-finite coordinates. Review entrance connections for every published center. Use WGS84 consistently; test application/GeoJSON coordinate order.
- Temporarily split eligible segments to attach an origin within 50 m. Never snap through water or a barrier. Ambiguous attachment requires confirmation. Any unverified connector from a GPS marker is not presented as a traversable route.
- Budgets: routing graph target ≤ 1 MB (hard ceiling 5 MB), complete Android pack target ≤ 5 MB (hard ceiling 20 MB). Reduce map display detail before graph connectivity.
- GPS accuracy of 50 m is comparable to street spacing in a 1.3 km² barangay, so attachment ambiguity will be common. When more than one eligible street lies within the accuracy radius, show a candidate chooser (nearest streets, accuracy circle) instead of guessing.

## 3. Algorithm specification (strictly derived from the RRL)

### 3.1 What the RRL specifies

| RRL § | Specification |
|---|---|
| 2.1 | Problem 1: sensors S, readings W, grid G, threshold θ: S→{0,1}; find flooded cells F ⊆ G by graph traversal. Problem 2: road graph (V,E), dynamic weights w: E→R⁺, source v₀, shelters C ⊆ V; find the shortest **safe** path. |
| 2.2 | Grid of ≈ **500 m × 500 m** cells, 4-connectivity; each vertex stores coordinates, **elevation**, flood status. Road graph from OSM: intersections are vertices; segments are edges with base distance, traffic, flood status, computed cost. |
| 2.3, 3.2 | **Algorithm 1 (BFS):** multi-source from sensors **exceeding critical thresholds**; FIFO queue; `visited` set; expand 4 neighbours when not visited and `can_flood`; O(V+E). |
| 2.4 | **Algorithm 2 (Dijkstra):** skip roads not safe from flooding; relax; **return at the first extracted shelter**; otherwise "no safe path found"; O((V+E) log V) with a min-heap. |
| 2.5 | `w(e) = d(e) · (1 + α·f(e) + β·t(e))` with **α = 10, β = 0.5**. Roads at critical flood levels get **infinite weight**. `f(e) = max over sensors within 2 km of the segment of ((w_s − w_alert) / (w_critical − w_alert))²`. |
| 3 | 17 PAGASA PMT-basin stations with Alert/Alarm/Critical levels (Table 1); readings every 30 s (paper's claim; unverified). |
| 4.3 | Implementation: deque for BFS, binary heap for Dijkstra, cached edge weights. |
| 7.4 | Ingestion validation: range check (±5 m from historical baseline), anomaly detection, temporal consistency (flag >2 m change within 30 s). |
| 7.5 | Stated limits: sensor gaps >5 km degrade BFS; 500 m cells miss hyperlocal flooding; sub-100 m resolution is future work. |

Relevant Table 1 rows for Ampid I, San Mateo: San Mateo-1 (18.0 / 19.0 / 20.0), Montalban (22.4 / 23.0 / 23.6), Nangka (16.5 / 17.1 / 17.7), Rodriguez (28.8 / 29.8 / 30.7). **Station coordinates are not in the paper's text.** They must come from the PAGASA source the paper cites, and the 2 km rule cannot be evaluated until they exist. Re-verify Table 1 values against the live source before hard-coding.

The upper bound of `t(e)` in §2.5 was illegible in the extracted text. Read it from the PDF before committing the constant; until then assume `t ∈ [0, 1]`.

### 3.2 Profiles

- **`ampid-fine`** (the production profile): the RRL algorithms and constants unchanged (α = 10, β = 0.5, sensor radius 2 km, 4-connectivity, seeds = stations with `w_s ≥ w_critical`), with **50 m cells**. Revisit 25 m only if a 5 m-class DEM is licensed. A coarser DEM (for example SRTM-class) does not justify finer cells: BFS stays disabled unless the DEM's documented vertical error is small against the gauge level spacing (Table 1 Alert→Critical spans are 1–2 m for the stations nearest San Mateo).
- **`rrl-reference`** (conformance only): same constants with 500 m cells. Used by R2 fixtures and for comparing our output with the paper's method. Never shipped to residents and never described as validated for Ampid I.
- Profile values live in a **versioned configuration**, not in code branches. One pure TypeScript module with no imports serves both Edge Functions and Android. Do not duplicate business rules in separate engines.

### 3.3 BFS flood propagation (RRL Algorithm 1)

Before traversal:

1. Acquire one immutable accepted sensor snapshot.
2. Verify units, timestamps, threshold ordering and vertical datum.
3. Apply the RRL §7.4 validators (see 3.6). Rejected readings are **unknown**.
4. Seeds = grid cells containing stations with `w_s ≥ w_critical`. Stations outside the grid domain are ignored and reported.
5. Each seed's water-surface elevation `s` is its (datum-verified) reading.

```text
flood_map = {}
visited   = {}
for seed in seeds ordered by DESCENDING surface (tie: stable station id):
    if seed in visited: continue
    queue = [seed]; visited.add(seed); head = 0          # head-index FIFO
    while head < queue.length:
        current = queue[head++]
        for n in four_neighbors(current):
            if n in visited: continue
            if can_flood(n, surface[seed]):
                visited.add(n); queue.push(n); flood_map.mark(n)
return flood_map
```

- `can_flood(n, s) := dem_elevation(n) ≤ s`. The RRL leaves `can_flood` undefined; this is the minimal elevation-based reading of "each vertex stores elevation". **DRRM must confirm this interpretation.** Missing terrain, incompatible datum or stale required readings make a cell **unknown**, not dry.
- **Why descending order with one shared `visited`:** the paper's single-queue pseudocode, if seeds carry different surfaces, lets a low seed claim a cell first and block a higher seed's propagation. Processing seeds high-to-low keeps O(V+E) and makes the result the union of per-seed fills, independent of input order. Test this property.
- The grid domain must span station-to-barangay corridors; flooding cannot jump gaps (RRL §7.5). It is larger than the Ampid I road pack and runs only on the server.
- Critical/Alarm/Alert (RRL §6.1) are **display classes only**, not extra seeds.
- BFS output is **extent only**. Queue depth is never shown as minutes or hours. Do not carry the RRL's "median 2.5 hours advance warning" claim into the product.
- Output: reached cells, unknown coverage, input observation times, sensor snapshot ID, calibration/config version, model validity.

### 3.4 Road flood status

An edge is `flooded` when its **full geometry** crosses any BFS-marked cell. Assess bridge decks and approaches separately; river cells beneath an elevated deck do not establish deck flooding. The RRL gives no cell-to-road mapping, so this is a required extension and part of the validation scope.

### 3.5 Dijkstra evacuation routing (RRL Algorithm 2 plus the required heap fix)

Freeze graph, conditions and avoidance before searching.

```text
dist[*] = INF; dist[start] = 0; heap.push(0, start)
while heap not empty:
    (cost, u) = heap.pop_min()
    if cost > dist[u]: continue                           # stale entry
    if u in shelters: return build_path(u)                # first extracted shelter = minimum cost
    for e in out_edges(u):
        if not safe(e): continue
        c = cost + weight(e)
        if c < dist[e.to]:
            dist[e.to] = c; prev[e.to] = e
            heap.push(c, e.to)                            # RRL pseudocode omits this push
return NO_SAFE_PATH
```

- `safe(e) := not flooded(e) AND f(e) < 1 AND pedestrian-legal AND not verified-closure AND not local-avoidance`. "Road is safe from flooding" is unspecified in the RRL; this is the minimal reading of §2.5 ("critical ⇒ infinite weight") combined with §2.2 ("flood status" per edge).
- **Weight:** `weight(e) = d(e) · (1 + 10·f(e) + 0.5·t(e))`.
- **Risk:** `f(e) = clamp( max over applicable stations of (w_s − w_alert)/(w_critical − w_alert), 0, 1 )²`. The clamp is required because the RRL formula goes negative below Alert while declaring `f ∈ [0, ∞)`.
- **Traffic:** `t(e) = 0` without a verified relevant feed. Keep the term in code for conformance.
- **Station applicability:** distance from station to the **segment geometry** ≤ 2 km, precomputed per pack. The DRRM hydrological-domain review is an acceptance check on this rule, not a different rule.
- **Reading of "critical ⇒ infinite weight" (deviation D9):** the RRL speaks of "roads with critical flood levels". This plan treats that as *roads that are flooded at critical level*, i.e. edges flagged by BFS (3.4), not "every edge within 2 km of a critical station". Reason: Ampid I is 1.8 × 1.4 km, so a 2 km radius around one nearby station can cover **every** edge, and removing them all would return `NO_SAFE_PATH` for every resident exactly when evacuation is needed. A station at or above Critical therefore (a) seeds BFS, (b) raises an area-level warning, and (c) contributes its soft penalty. An R2 fixture proves the all-edges-removed failure so the choice is not silent.
- Inside one barangay most edges share the same nearby stations, so `f(e)` is close to uniform and rarely changes which path wins. Route discrimination comes from verified closures and, later, BFS road flags. Do not oversell the sensor term.
- **Eligibility precedence:** pedestrian restrictions → verified closures → local avoidance → accepted model exclusions → soft risk penalties.
- **Shelters set C:** first run with confirmed-available centers; only if `NO_SAFE_PATH`, run again with unknown-availability centers, labelled with warnings. This keeps the RRL's single-criterion early exit without letting an unknown center outrank a confirmed one. A user-selected center is a one-element C. Inactive, deleted and unavailable centers are excluded; occupancy alone does not promise capacity.
- **Best path vs shortest path (owner requirement):** both are computed over the **same safe edge set** from the same frozen snapshot.
  - *Best (recommended):* minimum RRL weight.
  - *Shortest:* minimum distance (`f = 0, t = 0`).
  - If both produce the same edge sequence, show one route labelled "shortest and safest". If they differ, show the recommended route first and the shorter one with its distance and duration difference, with the reason (for example "avoids a modelled-flood approach"). Neither may traverse a blocked edge.
  - With no hazard data the weight equals distance, so the two coincide; the difference only appears when penalties are active.
- **Center list ranking:** to show real walking distance in the Centers list, run Dijkstra from the origin until every candidate center is extracted (or the heap is empty) instead of using straight-line haversine. The first-extracted-shelter early exit is used only for the automatic "best center" pick.
- **Destination default:** automatic = nearest confirmed-available center by route cost; the resident may override with any listed center.
- **Duration:** `distance / 1.2 m/s` (0.6 m/s on stairs), shown separately from optimization cost. With uniform speed the seconds-based cost equals the RRL cost up to a constant factor; the stairs speed is a documented extension.
- Stable tie-breaking; return traversed edge IDs.
- `NO_SAFE_PATH` maps to `no_route_within_coverage`. **Never** a straight-line fallback (invariant 7).

### 3.6 Sensor ingestion (RRL §7.4)

- Range check: ±5 m from the historical baseline.
- Anomaly detection: sensor drift/malfunction via statistical outliers.
- Temporal consistency: flag changes >2 m within one 30 s interval; scale the window to the real cadence.
- Flagged or stale readings become **unknown**, never zero.
- Staleness = N × the source's declared interval (default N = 10). Confirm the real PAGASA cadence in R8; a fixed 5 minutes is right only if the source is near 30 s.

### 3.7 Deviations from the RRL (all explicit)

| # | Deviation | Reason |
|---|---|---|
| D1 | Push to heap after relaxation | RRL pseudocode omits it; without it Dijkstra is incorrect. |
| D2 | Seeds processed in descending surface with shared `visited` | Order-independent correctness at O(V+E). |
| D3 | `can_flood` = elevation ≤ seed surface | RRL leaves it undefined. |
| D4 | Clamp f(e) to [0, 1] before squaring | RRL formula is negative below Alert. |
| D5 | Edge flooded via full geometry; bridges assessed separately | RRL gives no cell-to-road mapping. |
| D6 | Verified closures, local avoidance and pedestrian rules take precedence over model terms | Product safety (invariants 3, 6); the RRL has no such layer. |
| D7 | Unknown/stale handling, holdover restrictions, shadow mode | RRL has no missing-data semantics. |
| D8 | TypeScript/Deno/Supabase instead of FastAPI/Redis/Firebase/Mapbox | Stack is not part of the algorithm contract. |
| D9 | "Critical ⇒ infinite weight" applied to BFS-flooded edges, not to every edge within 2 km | A 2 km radius can cover all of a 1.3 km² barangay and disconnect everyone. |
| D10 | 50 m production cells (500 m kept only for conformance) | Barangay is ~1.8 × 1.4 km; RRL §7.5 recommends sub-100 m for hyperlocal accuracy. |
| D11 | Second Dijkstra objective (distance-only) for the "shortest" route; one-to-many run for center ranking | Owner requires both best and shortest paths; the RRL gives only the weighted objective. |

**Claims not carried into the product:** the "87% spatial accuracy" (metric undefined, 51-tile region), "23% shorter than static shortest path" (a static path cannot avoid floods; not a meaningful baseline), "2.5 hours advance warning", and the RRL's timing tables (our budgets are measured on our own infrastructure).

### 3.8 Production gating

Independent flags, enabled in this order. Each stage is a separate release decision:

| Stage | Behavior | Needs |
|---|---|---|
| 1. Closures | DRRM-verified closures and resident avoidance hard-block edges. | R4 publishing; no model data. |
| 2. Sensor warning + soft penalty | Area banner when an applicable station is at Alert/Alarm/Critical, with level and observation time; `f(e)` penalty applied. No edge is removed. | Verified station coordinates and current thresholds. |
| 3. BFS advisory | Edges flagged by BFS are shown as "possible flooding — verify"; the route is **not** changed. Differences from shadow output are logged. | A DEM that passes the vertical-accuracy rule (3.2), datum verified. |
| 4. BFS exclusion | BFS-flagged edges are removed from routing. | The validation list below. |

Compute `ampid-fine` in shadow from R8 onward. Never go from stage 3 to 4 without the DRRM acceptance record.

Production exclusions (stage 4) require:

- Verified data-feed access, compatible datum and licensed terrain inputs.
- ≥ 2 independent held-out flood events with documented ground truth. The RRL names Severe Tropical Storm Kristine (Oct 2024) and Typhoon Ulysses (Nov 2020) as candidates, if archived gauge series and extents can be obtained.
- Reported precision, recall and IoU (the RRL defines no metric) with road-level false positives/negatives.
- No missed obstruction in designated critical bridge/approach validation cases.
- DRRM acceptance of a versioned exclusion policy.

Do not invent calibration parameters when inputs are unavailable. Keep model influence disabled and expose `modelStatus=unavailable`.

## 4. Data consistency, platform recovery and interfaces

### Snapshot publication

Maintain canonical verified closures and center availability with a monotonic routing-area revision.

- Publish a complete consistent snapshot, including center deactivations/deletions (tombstones).
- Preserve observation time separately from publication and download time.
- A successful empty closure list means no reported active closures, not confirmed passability.
- Only explicit reopening removes a verified closure. Failed ingestion never publishes an empty replacement.
- Unknown new or moved entrances remain visible but unroutable.
- Compile model results separately from route requests. Use an area lease and input-version checks before publication; discard computations superseded by newer conditions.
- A snapshot records graph version, canonical revision, profile/config version, model status and resource hashes. Route responses carry that provenance.

### Aging and model failure

- Conditions check older than 15 minutes: visible stale warning.
- Center snapshot older than 24 hours: dated details/availability warning.
- Graph source older than 30 days: update recommendation.
- Required sensor observations older than the staleness rule in 3.6: no new live sensor/model contribution.

Do not silently remove previously downloaded exclusions when a model expires or fails. Retain them as **holdover restrictions**, separately labelled, until replaced by an accepted complete model revision or explicitly reviewed clearance. A valid newer model may clear its own exclusions; it cannot reopen a verified closure or a resident avoidance mark.

### Connectivity and request ownership

Track mode from successful routing-service communication, not `navigator.onLine` or Android connectivity flags.

- Android starts with local readiness, then requests a connected route.
- A connected route replaces local guidance only if origin, selection and request revisions still match.
- Service failure returns Android to labelled local mode. Web service failure disables further calculation; it does not run local Dijkstra.
- Restore connected mode only after a successful request.
- Cancel/reject obsolete results on origin, selection, avoidance, graph or condition changes. Invalidate an active route immediately when accepted conditions block one of its edges.
- Route requests: 10 s client deadline. Conditions requests: 8 s deadline; one active conditions request per screen; refresh every 30 s while visible with failure backoff up to 5 minutes.

### Android storage and public access

- Bundle Leaflet code, styles and starter data. Offline rendering must make no requests to map or script CDNs. Today the WebView loads Leaflet from unpkg and tiles from tile.openstreetmap.org (`apps/resident-android-mobile/src/components/map-view.tsx:68,81,194`).
- **Offline basemap:** OSM's tile policy forbids bulk offline prefetch from its tile servers. Render roads, water and centers as **vector layers from the pack**, or self-host tiles.
- **Attribution:** `attributionControl` is currently `false`; OSM/ODbL-derived data requires visible attribution.
- Measure the WebView bridge cost of multi-MB pack data; chunk it or load from a file URI.
- Use durable document storage independent of the existing 30-minute emergency cache (`apps/resident-android-mobile/src/lib/emergency-cache.ts:4`). Store active and previous graph packs, latest compatible conditions, local avoidance and a small activation/recovery journal.
- Stage and validate before committing the active pointer. Verify exact resource bytes, schema, sizes and graph compatibility. Hashes detect corruption; a trusted distribution origin is still required.
- Preserve current data after failed downloads. On restart, recover incomplete activation deterministically.
- Graph activation requires mappings for all active verified restrictions and local avoidance; defer activation when mappings are unresolved. Rollback must not discard newer known restrictions.
- Retain public packs across sign-out. Keep device coordinates and confirmed origins in memory only.
- Provide an unguarded public emergency entry. Today `(app)` sits behind `Stack.Protected` (`apps/resident-android-mobile/src/app/_layout.tsx:151-169`), so a signed-in user held in account setup cannot reach Centers. Auth restoration, profile loading, push registration and related overlays must not delay or obscure the entry. Normal resident authentication gates remain unchanged.
- The Dijkstra loop must **yield cooperatively** on the Hermes JS thread (also enables cancellation). Keep p95 local calculation ≤ 2 s.

### Local avoidance

Residents select a graph segment and mark both directions blocked.

- Persist by area with source references, geometry, graph version and creation time.
- Never publish as a verified DRRM closure. Never expire silently.
- Removing it cannot remove an overlapping verified or modelled block.
- Remap before graph activation; unresolved marks keep the previous graph active.
- Web stores avoidance only for the current connected session.

### Backend and security

Supabase Edge Functions for connected Dijkstra and a separately scheduled, area-bounded BFS.

- Import only the pure routing module. In R0, verify whether imports from `packages/shared` bundle for Edge Functions; if not, generate `supabase/functions/_shared/routing/` with a drift-hash test. Do not import the shared package's index (it pulls `@supabase/supabase-js` and `zod`).
- Prebuild graph/grid resources.
- Budgets: measured CPU < 1.5 s per invocation, memory < 192 MB. Re-check current Supabase limits in R0. Test **cold starts**, including resource parsing. Failure blocks deployment; it does not justify silently dropping roads or hazard checks.
- Rate-limit public routing (Edge Functions have no built-in limiter; use a hashed-IP counter via RPC). Bound avoidance/input size.
- Origins travel in POST bodies only. Keep precise coordinates out of logs and persistent response caches.
- Protect admin writes through RLS and server authorization.
- Schema: `evacuation_centers.position` is a single jsonb point and the repo deliberately uses GeoJSON, not PostGIS (`supabase/migrations/0001_barangays_and_profiles.sql`). R4 adds entrance points, availability status separate from `is_active`, a revision counter and tombstones. Graph geometry stays in packs.

Define `LocationFix`, `ConfirmedOrigin`, `RoutingPackManifest`, `CompiledRoutingConditions`, `LocalAvoidanceRecord`, `RouteRequest` and `RouteResult`. Results include status, mode, itinerary, geometry, metrics, edge IDs, provenance and warnings, and distinguish: missing/invalid origin, attachment ambiguity, coverage limits, unavailable center, no route within coverage, service failure, cancellation.

## 5. Coding execution phases

R-prefix phases, executed sequentially. A phase is not complete while its exit gate is unmet.

### R0 — Baseline, document and scope protection
- Save this plan (done) and record branch, changed files, relevant source hashes.
- Preserve concurrent Android and admin work; never reset unrelated changes.
- Read the installed Next.js docs (`apps/resident-web/node_modules/next/dist/docs/`) and Expo SDK 57 guidance.
- Record dependencies, test commands and the migration maximum: **`0112_admin_reference_index_writer_permissions.sql` → next is `0113`**. AGENTS.md's "last pushed 0094" is stale; note the discrepancy.
- Confirm each seeded center's position against the boundary (done in planning: all inside, Ampid 1 Elementary on the line). Verify Edge Function import bundling and current Supabase CPU/memory limits.
- Read the RRL PDF visually: confirm Table 1 values and the `t(e)` bound.

**Exit gate:** baseline evidence exists; boundaries and migration sequence are known.

**Status (2026-10-12): Partially complete — exit gate met; one item pending (RRL PDF visual check).** Evidence: `plans/evidence/resident-drrm-routing/r0-baseline/README.md`.

| R0 item | Status |
|---|---|
| Branch, changed files, source hashes | Done — `main` @ `6ae66e1`, 139 pre-existing uncommitted paths untouched; hashes recorded. |
| Preserve concurrent work | Done — no existing file modified; temporary probe function removed. |
| Next.js 16.3 docs, Expo SDK 57 Location guidance | Done — pages listed in evidence. |
| Dependencies, test commands, migration maximum | Done — next migration `0113`; baseline green except 4 pre-existing lint warnings. |
| Centers vs boundary | Done — independently re-measured; all four inside, Ampid 1 Elementary at 0.0 m. |
| Edge Function import bundling | Done locally — see decision below; real deploy unverified (not authorized in R0). |
| Supabase CPU/memory limits | Done — 256 MB, 2 s CPU; plan budgets fit. |
| RRL PDF: Table 1 values and `t(e)` bound | **Pending** — PDF not in repo; browser pane refused it; downloading needs owner approval. Constants stay uncommitted until read. |

**R0 decisions and discrepancies**

- **Import bundling decision:** the CLI mounts files outside `supabase/functions`, and the runtime rejects extensionless imports (even type-only ones at worker boot). The pure routing module must therefore be **one import-free file** in `packages/shared`, imported by Edge Functions by relative path with an explicit `.ts` extension. The `_shared/routing/` generated copy is a fallback only if the first R5 deploy fails.
- **Migration numbering:** `AGENTS.md` ("last pushed 0094") is stale; its own rule (next unused number after the highest prefix) gives `0113`, matching this plan. `0110`–`0112` are untracked in git; remote application state is unverified.
- **Seeded center data:** three of the four seeded centers carry addresses in other barangays (Guitnang Bayan 2, Dulong Bayan 1, Malanday) and rounded coordinates inside the Ampid I trace. Treat positions as placeholders until DRRM confirms them (R3 entrance review / R4).
- **Line-reference drift:** `_layout.tsx` `Stack.Protected` is now at `:160-173`; `attributionControl: false` is at `map-view.tsx:191`. The Android Centers screen and map view carry uncommitted user edits that R1 must build on.
- **Bundle size:** server-side bundling (`--use-api`) caps bundles at 5 MB (20 MB local CLI); load graph packs as separate resources rather than bundling them.

*Progress note, 2026-10-12 (R0):* Ran `npx vitest run` (packages/shared: 24 files / 239 tests pass), `npx tsc --noEmit` for packages/shared, apps/resident-web and apps/resident-android-mobile (0 errors each), `npx eslint` (resident-web: 0 errors, 2 pre-existing warnings) and `npx expo lint` (Android: 0 errors, 2 pre-existing warnings). Probed bundling with `edge-runtime bundle` (image v1.76.2, Deno 2.1.4) and `npx supabase functions serve` (CLI 2.118.0). Measured the boundary and seeded centers with a Node script. Remaining: RRL PDF visual check.

### R1 — Location controller and existing-screen repair
- Shared location contracts and platform adapters; fix Android's focus-only update and web's stale error flag and post-acquisition routing.
- Request ownership, timeout, cleanup, quality checks, origin confirmation; marker/accuracy replay after map readiness.

**Verification:** permission recovery, approximate location, disabled services, late-callback tests; real installed Android and browser tests including offline Android GPS acquisition.
**Exit gate:** accepted device coordinates demonstrably become the marker and routing origin. Manual placement does not satisfy this gate.

**Status (2026-10-12): Partially complete — code done on Android and web; web verified in a browser (simulated fixes); exit gate pending real-device and real-browser-GPS verification.** Evidence: `plans/evidence/resident-drrm-routing/r1-location/README.md`.

| R1 item | Status |
|---|---|
| Shared location contracts (`LocationFix`, `ConfirmedOrigin`, nine states) and platform adapters | Done — `packages/shared/src/lib/device-location.ts` (import-free), Android `hooks/use-device-location.ts` (expo-location), web `hooks/use-device-location.ts` (Geolocation + Permissions API). |
| Fix Android focus-only "Locate me" | Done — updates the controller (marker + routing origin); the map follows only an explicit request. Unconditional on-mount permission request and `Accuracy.Balanced` removed. |
| Fix web stale `geoDenied` and post-acquisition routing | Done — flag removed (state is derived); route effect keyed on center id + origin revision; verified in browser. |
| Request ownership, timeout, cleanup | Done — request IDs, late-subscription removal, 10 s progress / 45 s stop, stop on success/cancel/screen departure/backgrounding; unit-tested and browser-verified. |
| Quality checks and origin confirmation | Done for age/accuracy/last-known/approximate (≤ 2 min, ≤ 50 m). Graph-attachment ambiguity check deferred to R2/R3 (no graph yet). |
| Marker/accuracy replay after map readiness | Done — Android `SET_USER_LOCATION` replayed on `MAP_READY`; web is declarative. |
| Permission recovery, approximate, disabled services, late-callback tests | Automated: done (28 tests). Device: **pending**. |
| Real installed Android test incl. offline GPS acquisition | **Pending** — needs a physical Android phone (section 7); steps in the evidence file. |
| Real-browser test with actual GPS | **Pending** — the built-in browser pane denies geolocation; flows were exercised with a stubbed API. Needs one run in a desktop/mobile browser with location allowed. |

**R1 decisions and discrepancies**

- **Graph attachment:** section 2 makes "attachment unambiguous" part of automatic acceptance, but no graph exists before R2/R3. R1 accepts on age/accuracy only; `assessLocationFix` is where the attachment check joins.
- **Session shape:** one `watchPositionAsync`/`watchPosition` session per request. A poor fix is shown for confirmation while the watch keeps looking for a better one; a fix passing the checks is accepted outright. On timeout with nothing usable, Android offers its last-known fix for confirmation only.
- **Android settings dialog:** `mayShowUserSettingsDialog: false`. The improve-accuracy dialog would background the app, which pauses and restarts acquisition, and could loop. Disabled services are reported via `hasServicesEnabledAsync` with an "Open settings" action instead.
- **Web without the Permissions API:** permission is treated as unknown, so automatic acquisition waits for an explicit "Use my location" (the browser prompts during the watch).
- **Shared wording:** status copy lives in `describeDeviceLocation` so Android and web describe states identically. New status cards are added; existing control sizes and positions are unchanged (cancelled Phase 8 boundary).
- **Out of scope, left for R7:** the Android straight-line fallback (`index.tsx:532`) and the OSRM demo dependency remain. Note that OSRM receives origin coordinates in a GET URL to a third party, against section 4's "origins in POST bodies only"; its foot-profile durations are also implausible (0.7 km reported as ~1 min). Distances in the list are still straight-line (R5/R7).
- **Concurrent edits:** the resident-web loading/toast plan (RW-LT-05) edited the same four Centers files during R1. Its changes were merged back after coordination.

*Progress note, 2026-10-12 (R1):* Ran `npx vitest run` (packages/shared: 25 files / 267 tests pass; baseline 239), `npx tsc --noEmit` for packages/shared, apps/resident-web and apps/resident-android-mobile (0 errors each), `npx eslint` (resident-web: 0 errors; 2 pre-existing warnings, down from 5 at R1 start because of the concurrent session's fix) and `npx expo lint` (Android: 0 errors, 2 pre-existing warnings). In the built-in browser on the resident-web dev server (`/emergency/centers`, port 3001) I verified: real denied permission; explicit request; low-accuracy confirmation; auto-accept; auto-acquisition when granted; routing after a late fix (the original defect); cleanup on screen departure with a late callback ignored; 10 s progress and 45 s timeout; map locate follow; phone-width layout; discard keeps the previous origin; `/maps` regression. No console errors. Remaining: physical-Android and real-browser-GPS runs for the exit gate.

### R2 — Pure routing core and RRL conformance fixtures
- Graph validation, temporary origin attachment, heap Dijkstra (3.5), BFS (3.3), cancellation, reconstruction, hard-restriction precedence, itinerary generation.
- Fixtures: bridges, stairs, ambiguous origins, competing-risk paths.
- **RRL conformance tests (profile `rrl-reference`):** gauge halfway Alert→Critical gives f = 0.25, so d = 100 m, t = 0 gives weight 100 × (1 + 2.5) = 350; BFS output is invariant to seed input order; flooded edges are never traversed; golden values from Table 1 (San Mateo-1 reading 19.0 → f = 0.25).
- **Scope fixtures:** an origin outside the covered area returns `outside_coverage`; "best" and "shortest" coincide with no hazard and diverge on a constructed graph where a penalized edge is shorter; a fixture applying the literal "every edge within 2 km at critical is removed" rule to the Ampid I box returns `NO_SAFE_PATH`, documenting why D9 exists; the one-to-many center ranking agrees with single-target runs.

**Verification:** independent reference solver comparison on small graphs; identical results across supported runtimes and input orders.
**Exit gate:** core correctness and cancellation pass independently of UI/network behavior.

**Status (2026-10-12): Partially complete — exit gate met; one verification item pending (identical results on Hermes, needs the installed Android build).** Evidence: `plans/evidence/resident-drrm-routing/r2-routing-core/README.md`.

| R2 item | Status |
|---|---|
| Graph validation | Done — `prepareRoutingGraph` in `packages/shared/src/lib/evacuation-routing.ts` (single import-free file, R0 decision); rejects incomplete topology, non-finite or swapped coordinates, length mismatches; canonical id order. |
| Temporary origin attachment | Done — 50 m split of an eligible segment, pedestrian direction kept, never across a barrier, ambiguity chooser, resident choice, `outside_coverage` / `no_nearby_path`. |
| Heap Dijkstra (3.5), reconstruction, itinerary | Done — D1 push, first-extracted-shelter exit, stable ties, best + shortest + one-to-many ranking, available-then-unknown shelter tiers, traversed edge ids, geometry, duration (1.2 / 0.6 m/s), written road/bridge/stairs itinerary, provenance. |
| BFS (3.3) | Done — `runFloodBfs`: descending seeds with shared `visited` (D2), head-index FIFO, `can_flood` = elevation ≤ surface (D3), unknown terrain, ignored-station report. |
| Cancellation | Done — generator core; `planEvacuationRouteAsync` yields every 256 extractions and honours a cancellation token. |
| Hard-restriction precedence | Done — pedestrian rules, verified closures, local avoidance, model exclusions block both directions; sensor risk only penalizes (D9). |
| Fixtures: bridges, stairs, ambiguous origins, competing-risk paths | Done. |
| RRL conformance tests | Done — 350 weight, f = 0.25 goldens, BFS order invariance, flooded edges never traversed. Table 1 goldens remain pending the R0 PDF check. |
| Scope fixtures | Done — `outside_coverage`; best/shortest coincide and diverge; literal 2 km rule on the Ampid I box → no safe path (D9 rationale); ranking agrees with single-target runs. |
| Reference solver comparison | Done — Bellman-Ford on 150 random graphs; mutation check kills 5/5 mutants. |
| Identical results across input orders | Done. |
| Identical results across runtimes | Node 24 and Supabase edge-runtime 1.76.2 (Deno 2.1.4): **done, byte-identical** (digest `217d8e6a`, 250 cases). Hermes: **pending** — compiles with `hermesc`; run `routingDigest()` on the installed Android build in R6. |

**R2 decisions and discrepancies**

- **Math determinism:** `Math.cos` differs in the last bit between Node and the edge runtime (56/2,000 probe inputs), which changed attachment points by ~1e-12. The core computes cos with a plain-arithmetic Taylor series and distances with `Math.sqrt`; outputs are now byte-identical.
- **`safe(e)` vs D9:** 3.5 lists `f(e) < 1` in `safe(e)`, but after the D4 clamp f = 1 exactly at Critical, the literal rule D9 rejects. The core follows D9 (penalty only).
- **BFS seed cells are flooded** (the pseudocode above marks only neighbours).
- **Shortest route** uses the same safe edges and center tier as "best"; it is `null` when identical or not strictly shorter.
- **Blocked attachment:** roads nearby but all blocked → `no_route_within_coverage`, not `no_nearby_path`.
- **Extra statuses:** `invalid_conditions` and `restrictions_unmapped` (a restriction the graph cannot represent is never dropped). `service_failure` and connected/local mode stay in R5/R7.
- **Not exported from the shared index** until an app consumes it (R6/R7); `assessLocationFix` attachment-ambiguity wiring waits for packs on devices.
- **Left for later phases:** edge-flood compilation from BFS cells (3.4, R8), BFS snapshot/model-validity metadata (R8), `RoutingPackManifest` / `LocalAvoidanceRecord` (R3/R6), edge `layer` attribute (R3).

*Progress note, 2026-10-12 (R2):* Ran `npx vitest run` (packages/shared: 26 files / 329 tests pass; baseline 267; 62 new routing tests), `npx tsc --noEmit` for packages/shared, apps/resident-web and apps/resident-android-mobile (0 errors each). No app file changed, so lint baselines were not rerun. Mutation check: 5 targeted mutants (D1 push, D2 order, D4 clamp, blocked edges, first-shelter exit) all fail tests. Cross-runtime digest: Node v24.13.1 and a temporary local Edge Function on supabase-edge-runtime 1.76.2 both `217d8e6a` (first attempt differed by floating last digits; fixed as above); temporary functions removed, edge-runtime container stopped. `hermesc` compiled the type-stripped core. Remaining: Hermes digest on the installed Android build (R6).

### R3 — Pack builder and reviewed pilot topology
- OSM import clipped to the Ampid I boundary + 150 m margin; pedestrian topology, spatial indexes, manifests; simplified map resources and stable segment mappings; connectivity/entrance/coverage reports; bundled starter data; server-side `ampid-fine` and `rrl-reference` grids from one builder; station-to-edge 2 km tables.
- Test every published center against the boundary and confirm each is reachable from every residential street; list any disconnected block for DRRM.

**Verification:** review real bridge approaches and every center entrance; incomplete references, barriers, coordinate order, pack budgets.
**Exit gate:** reproducible pack build plus DRRM-reviewed topology evidence.

### R4 — Conditions migrations and admin management
- Canonical closures, center availability, revisions, audit history; admin publishing/reopening; public complete snapshots; tombstones and graph-version mappings.

**Verification:** cross-barangay authorization, forbidden writes, concurrent publication; closure/center removal reaches cached clients; use `0113` and onward, tested on a disposable database first.
**Exit gate:** consistent snapshots and security checks pass.

### R5 — Connected route service
- Pure core in Edge Functions with profile `ampid-fine`; request validation, rate limits, snapshot selection, response provenance; closure-only and degraded-model modes; returns the best route, the shortest route, and per-center route distances in one response.

**Verification:** cold/warm CPU and memory; parallel requests, oversized input, outdated snapshots, client cancellation; no coordinate leakage in logs.
**Exit gate:** route correctness, resource budgets and public API failure behavior pass.

### R6 — Android durable offline operation
- Bundled map assets, typed bridge for local geometry, pack staging/journal/recovery/rollback, local avoidance, public emergency access, restrictions preserved across graph updates and sign-out.

**Verification:** clean-install airplane-mode start; force-stop/reopen, corrupt pack, interrupted update, unresolved remapping; session-restoration failure cannot block the emergency map.
**Exit gate:** new routes calculate after an offline cold start without network assets.

### R7 — Resident integration and mode transitions
- Connected responses on Android and web; revision ownership and route invalidation; freshness, mode, availability and failure messages; keep existing Centers layouts; **remove the straight-line fallback** (`index.tsx:540-543`) and the public OSRM demo dependency (`packages/shared/src/lib/osrm.ts`).

**Verification:** network flapping, stale responses, rapid origin/center changes; Android connected-to-local transition; web offline prevention; remount/fullscreen/list changes preserve state.
**Exit gate:** platform behavior matches the product contract in end-to-end tests.

### R8 — Sensor ingestion and BFS shadow
- Permitted source adapters, RRL §7.4 validators, immutable sensor snapshots; calibrated grid eligibility, FIFO BFS, road intersection compilation; model-health and unknown-coverage reporting. Shadow output reports seeds used and stations ignored (out of grid, stale, flagged). Sensor penalties and exclusions stay disabled for residents.

**Verification:** missing/stale readings, invalid datum, barriers, multiple seeds, source failure; preprocessing and traversal budgets measured separately; superseded computations cannot publish.
**Exit gate:** reproducible shadow output and documented input readiness. Missing external data leaves this phase **pending**; do not fabricate completion.

### R9 — Model validation and controlled activation
- Replay/comparison tooling and versioned activation configuration; held-out event reports (candidates: Kristine Oct 2024, Ulysses Nov 2020); bridge/approach validation; model replacement, holdover restrictions, explicit clearance.

**Verification:** false positives/negatives and calibration sensitivity documented; accepted revisions clear only their own exclusions; degraded operation when sensor or model services fail.
**Exit gate:** DRRM acceptance evidence exists before enabling sensor penalties or BFS exclusions.

### R10 — Storm drill, release and recovery runbook
- Rollout flags, model/ingestion health indicators, privacy-preserving telemetry; preparedness and recovery instructions; acceptance evidence and feature documentation.

**Verification:** 72-hour simulated Android outage; real-device location matrix; closure/bridge/center changes during active use; connected/local route agreement for identical snapshots; p95 local ≤ 2 s; connected ≤ 3 s under documented pilot load; Android map usable within 5 s of cold start without waiting for GPS; CPU, memory, storage budgets within limits.
**Exit gate:** all required evidence passes; rollout and rollback rehearsed.

## 6. Completion evidence and release rules

Maintain evidence under `plans/evidence/resident-drrm-routing/`: baseline, fixture results, migration checks, device matrix, performance measurements, model reports, storm-drill outcomes.

For every phase record: what changed and which invariants it verifies; actual commands, runtime versions, device/browser identifiers; passed scenarios, failures, corrections, remaining external dependencies; whether findings are automated, simulated or field-observed.

Run shared routing tests, affected workspace type/lint/build checks and function tests as appropriate. Test meaningful failure modes; avoid tests that merely restate implementation steps.

Separate flags control connected routing, Android packs, sensor penalties and BFS exclusions. A server kill switch does not revoke already-offline Android data.

The final release must preserve known restrictions, state the age of its information, and provide a usable outcome when location, connectivity, data or routing fails.

## 7. Previously open matters — now resolved

The four earlier open items are settled in the "Resolved decisions" table at the top (cell size, staged penalties/exclusions, data ownership, iOS deferred). What remains are external actions, not design choices:

| Action | Owner | If it does not happen |
|---|---|---|
| Obtain coordinates and current Alert/Alarm/Critical levels for the PAGASA stations nearest San Mateo (Table 1: San Mateo-1, Montalban, Nangka, Rodriguez), and confirm real update cadence | Developer | Stage 2 and BFS stay off; closure routing ships. |
| Provide or review past flood extents, closure logs and photos for Ampid I; verify bridge/road closures through admin-web | Barangay DRRM | R9 has no ground truth; stage 4 cannot start. |
| Request a licensed DEM of adequate vertical accuracy (candidates to check: NAMRIA IfSAR, Project NOAH/LiDAR products — availability and licence unconfirmed) | Developer | BFS limited to shadow/advisory at best. |
| Confirm the t(e) bound and Table 1 values visually against the PDF | Developer (R0) | Constants not committed. |
| Supply a physical Android phone for the location matrix | Developer | R1/R10 remain pending. |

**RRL licence:** CC BY-NC 4.0. Keep the citation, and note the non-commercial terms if Barangayan is ever distributed commercially.
