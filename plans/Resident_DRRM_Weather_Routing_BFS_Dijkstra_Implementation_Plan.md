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
| R9 activation, R10b enablement | Externally gated on ≥2 held-out flood events and DRRM acceptance. |
| R9 tooling, activation configuration, holdover and clearance logic, failure handling; R10a (closure-only release items that do not read model output) | Feasible without any PAGASA, DEM or flood-event data (synthetic fixtures only). They enable nothing. See R9 and R10 for the split. |

Closure-based routing can release before any model activation. Do not claim project completion while device acquisition or model prerequisites remain unverified.

### What works without PAGASA data (owner Q&A, 2026-10-15)

| Capability | Needs PAGASA / DEM data? | State |
|---|---|---|
| Dijkstra routing (best and shortest walking path to a center, online and offline) | No | Done (R2–R7). |
| DRRM-verified closures and center availability (authoritative hard blocks) | No | Done (R4–R7). |
| BFS flood extent from gauge levels, road flood flags, sensor penalty, BFS advisory/exclusion | **Yes** (gauge levels and coordinates, licensed DEM, verified datum) | Code done in R2/R8; reports `modelStatus: unavailable` until the inputs exist. |

Without the data nothing in a resident's route reacts to river levels; DRRM must publish closures. The model stays off rather than guess (invariant 4). This is the supported first release, not a fault. Phases R9 and R10 may proceed only as split below: nothing that needs real events, thresholds or calibration may be written with invented values, and no phase may be marked complete on synthetic evidence.

**Use limit (owner decision, 2026-10-15):** the PAGASA request letter is for an **academic capstone only** (`PAGASA_Water_Level_Data_Request_Letter_Academic.docx`, signed by the capstone team and noted by the adviser). Whatever PAGASA grants under it covers research and prototype testing; it does **not** authorize an operational resident-facing service, and the letter promises not to use the data for one. A production feed (stage 2 and later) needs a new permission from PAGASA, with the barangay as requester. Until then the flood model stays in shadow with `residentInfluence: 'none'`.

Where the data can come from (searched 2026-10-15): **PAGASA's own Pasig-Marikina-Tullahan flood-warning site serves the gauge data publicly.** Its HTTPS host fails certificate verification, but the same site answers over plain HTTP at `http://121.58.193.173:8080/` (the address PAGASA's flood page links as "Flood Monitoring for Metro Manila"). Its pages call two undocumented JSON endpoints, `/water/table_list.do` (POST `ymdhm=YYYYMMDDHHmm`, PHT) and `/water/map_list.do` (GET `ymdhm`, `basin`; Marikina = 111). Read once on 2026-10-15 (21 stations): thresholds match RRL Table 1 for San Mateo-1 (18.00 / 19.00 / 20.00), Montalban (22.40 / 23.00 / 23.60), Nangka (16.50 / 17.10 / 17.70) and Rodriguez (28.80 / 29.80 / 30.70); the 2018 bulletin's "Montalban" values were Tumana Bridge's (17.26 / 18.26 / 19.26). Coordinates: San Mateo-1 14.67955, 121.10973; Nangka 14.67402, 121.10932 (both beside the west edge of Ampid I); Montalban 14.73308, 121.13058; Rodriguez 14.73755, 121.15467. Readings carry 10-minute timestamps. Snapshot: `plans/evidence/resident-drrm-routing/r8-shadow/pagasa-ffws-snapshot-2026-10-15.json`. **Not yet usable as a production source:** the endpoints are undocumented, publish no terms, run over unauthenticated HTTP (a path attacker could forge levels), and the vertical datum ("EL.m"), the meaning of the "(*)" marker, the historical baseline and the supported cadence are unverified. Use needs PAGASA's permission (the "Hydromet Data" request portal) and an integrity plan. Still missing entirely: the licensed DEM and datum match. Community mirrors exist but are unofficial; UP DREAM/LiPAD 1 m LiDAR is reported open but Rizal coverage, vertical accuracy and licence are unconfirmed.

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
| Model data gating (owner Q&A, 2026-10-15) | Closure-based routing is the supported first release. R9/R10 proceed only for work that needs no external data (R9a below); everything else stays pending until PAGASA/DEM/DRRM inputs exist | Prevents invented thresholds or fabricated validation; keeps the safety logic (holdover, clearance, failure handling) testable now. |
| PAGASA data deferred (owner decision, 2026-10-15) | Work that needs PAGASA station data, a DEM or DRRM ground truth is **paused** until the owner has the data; the plan resumes at that point (R8 inputs → R9b → R10 model-gated items). Nothing is built on unverified or scraped values in the meantime. | The request is an academic capstone request (see section 7); the owner will obtain the data through the capstone letter, not through an operational agreement. |
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

**Status (2026-10-12): Partially complete — builder, tests and the real Ampid I pack done; exit gate pending DRRM review of the topology report.** Evidence: `plans/evidence/resident-drrm-routing/r3-pack-builder/README.md`; review sheet `plans/evidence/resident-drrm-routing/r3-pack-builder/build/report.md`.

| R3 item | Status |
|---|---|
| OSM import clipped to boundary + 150 m | Done — `packages/shared/src/lib/routing-pack-builder.ts` (Overpass JSON); coverage buffer ±6 m. Extract fetched with owner approval (OSM base 2026-10-12T13:29:57Z, `data/routing-packs/ampid-1/source/osm-extract.json`). |
| Pedestrian topology | Done — 900 nodes, 1,064 walkable edges (54.3 km); shared-node splits, grade separation by topology, blocking barriers as dead ends, pedestrian-only direction rules, loops, zero-length joins; accepted by `prepareRoutingGraph`. |
| Spatial indexes | Not added, by measurement: full route plan p95 1.31 ms (Node) on the real graph; recheck on Hermes in R6. |
| Manifests | Done — `RoutingPackManifest` (in the core, for R6 verification); sizes, SHA-256, device/server audience. |
| Simplified map resources | Done — vector roads/water/boundary/coverage GeoJSON (`map.json`, 188 KB). |
| Stable segment mappings | Done — OSM-derived edge ids; `mapEdgesAcrossGraphs` (same / remapped / unresolved). |
| Connectivity / entrance / coverage reports | Done — real `report.json` + DRRM review sheet `report.md` with sign-off table. |
| Bundled starter data | Done as pack files in `data/routing-packs/ampid-1/pack/` (graph `ampid-1@2026-10-12#fc7101b6227d`); bundling into the APK is R6. |
| Server-side `ampid-fine` and `rrl-reference` grids from one builder | Done — terrain unknown (no DEM, R8). |
| Station-to-edge 2 km tables | Done in code; table empty (`stations: unavailable`) until verified station positions exist. |
| Every center vs boundary | Done — all four inside; Ampid 1 Elementary on the line, its seeded position is the boundary trace's first vertex (placeholder) and its proposed entrance lies on a margin-only group. |
| Reachable from every residential street | Done (automated) — every walkable edge inside the boundary reaches at least one center. Route probe: 2 of 671 inside-boundary origins (east edge, Alberto Drive / Denmark Street) attach to margin-only groups and have no route. |
| Verification: incomplete references, barriers, coordinate order | Done (automated, fixture and real extract: no missing references). |
| Verification: pack budgets | Done — graph 436,991 B (target 1 MB), device pack 626,273 B (target 5 MB). |
| Verification: real bridge approaches and center entrances | **Pending** — DRRM review: 14 bridges, 4 center entrances. |
| Reproducible pack build | Done — byte-identical rebuild of the real pack and report (`diff -r`). |
| Exit gate: DRRM-reviewed topology evidence | **Pending** — sign-off of `report.md` (centers/entrances, east-edge connectivity, bridges, 37 barrier nodes, 81 private-access ways). |

**R3 decisions and discrepancies**

- **Private roads and gates stay walkable and are listed for DRRM.** Excluding them could strand residents of gated areas; DRRM blocks any of them with verified closures (R4). `foot=no`, `access=no`, locked gates and walls block.
- **Routing clip is node-level** (stable OSM ids; edges end at the last inside node, within the margin). Water and walls are clipped geometrically (a river with distant nodes was dropped by an earlier vertex test; fixed and tested).
- **Margin-only groups:** 18 components lie entirely in the margin (neighbouring subdivisions whose links leave the coverage). They are reported, not treated as cut-off Ampid streets. Whether the 150 m margin must widen in the east is a DRRM review item (plan section 2: widen only if the review shows a cut-off area).
- **No `layer` on `RoutingEdge`:** grade separation is topological. `layer`/`bridge`/`tunnel` only separate over/underpasses from probable missing junctions in the report.
- **Entrances are proposals** (nearest walkable node ≤ 50 m), flagged when they fall on a margin-only group; stored mappings belong to R4. Seeded centers are still placeholders (R0).
- **Pack location** `data/routing-packs/<area>/` (no prior convention).
- **Overpass:** requests reserving `timeout:90` were refused with HTTP 504; the documented query uses `timeout:25` and `maxsize` 64 MiB.
- **Tooling:** `rewriteRelativeImportExtensions` in `packages/shared/tsconfig.json` so Node runs the CLI natively. The CLI is `.mts`. The npm script silences Node's MODULE_TYPELESS_PACKAGE_JSON notice rather than adding `"type": "module"` to a package Metro and Next consume.

*Progress note, 2026-10-12 (R3):* Ran `npx vitest run` (packages/shared: 27 files / 354 tests pass; baseline 329; 25 new), `npx tsc --noEmit` for packages/shared (now including the CLI), apps/resident-web and apps/resident-android-mobile (0 errors each), and the R2 digest (`217d8e6a`, unchanged). Mutation check: 5/5 targeted mutants fail tests. Fetched the Ampid I extract (overpass-api.de, 1,099,002 B). Built the real pack with `npm run build:routing-pack`; a second build was byte-identical. Ran `route-probe.mts` over 671 inside-boundary origins (599 ok, 39 chooser, 31 no nearby path, 2 no route; p95 1.31 ms). No app file changed (lint baselines unaffected). Remaining: DRRM review and sign-off of `report.md`, then rebuild with corrected center positions and any OSM or margin fixes.

### R4 — Conditions migrations and admin management
- Canonical closures, center availability, revisions, audit history; admin publishing/reopening; public complete snapshots; tombstones and graph-version mappings.

**Verification:** cross-barangay authorization, forbidden writes, concurrent publication; closure/center removal reaches cached clients; use `0113` and onward, tested on a disposable database first.
**Exit gate:** consistent snapshots and security checks pass.

**Status (2026-10-13): Complete — exit gate met on disposable databases; `0113` applied to the hosted project by the owner and verified read-only.** Evidence: `plans/evidence/resident-drrm-routing/r4-conditions/README.md`.

| R4 item | Status |
|---|---|
| Canonical closures | Done — `supabase/migrations/0113_routing_conditions.sql`: `road_closures` (label, reason, `[lng, lat]` geometry, pack source refs, observation time separate from publication) + `road_closure_edges` per graph version. Never deleted or edited; only active → reopened (guard trigger, also against superusers). |
| Center availability | Done — `evacuation_centers.availability` (`available` / `unknown` / `unavailable`, default `unknown`), separate from `is_active`, with `availability_updated_at`. |
| Revisions | Done — `routing_areas.revision` taken under the area row lock for every snapshot-visible change; centers carry `routing_revision` (trigger-maintained, client values ignored). |
| Audit history | Done — append-only `routing_condition_events` (revision, actor, details); RPCs also write `admin_audit_log` (`road_closure`, `routing_area` entity types). |
| Admin publishing / reopening | Done — admin-web Evacuation Routing page (`apps/admin-web/src/app/(admin)/evacuation-routing/`): activate bundled map data, select segments on the pack graph, publish, reopen with a reason, availability, entrance editor, history. |
| Public complete snapshots | Done — `get_routing_conditions_snapshot` (anon), one `STABLE` read; shared `routingConditionsSnapshotSchema`. |
| Tombstones | Done — reopened closures, archived and hard-deleted centers (`routing_tombstones`); deactivated centers stay listed as inactive. |
| Graph-version mappings | Done — `routing_graph_versions`, closure edge and center entrance-node mappings per version; activation refused while any active closure or entrance is unmapped; unmapped closures reported with `edgeIds: null`. |
| Verification: cross-barangay authorization, forbidden writes | Done — pgTAP 81/81; mutation check 5/5. |
| Verification: concurrent publication | Done — parallel sessions serialize (revisions 3, 4), mid-transaction reader sees the prior state, double reopen → one success. |
| Verification: removal reaches cached clients | Done at the snapshot API (tombstones/inactive entries at newer revisions); consumption by clients is R5–R7. |
| `0113` tested on a disposable database first | Done — full clone of the local DB and a seeded schema-only copy; local dev DB untouched. Applied to the hosted project by the owner afterwards (see the hosted note below). |

**R4 decisions and discrepancies**

- **Migration numbering:** used `0113` as recorded in R0; `AGENTS.md` ("last pushed 0094") remains stale. Next new migration: `0114`.
- **Write path:** all routing writes go through security-definer RPCs or the center trigger; table write privileges are revoked from `anon`/`authenticated`. Availability uses the existing admin update policy on `evacuation_centers`.
- **Moving a center clears its entrance** (plan 4: "moved entrances remain visible but unroutable"); an entrance > 250 m from the center is refused. Re-saving the existing center form with an unchanged position changes nothing.
- **Graph versions** are registered from the admin build's bundled pack; publishing requires the active version, so a stale admin page cannot map a closure to an old graph.
- **Remapping UI for a new graph version** is not built: the mapping RPCs and activation guard exist and are tested; proposing mappings with `mapEdgesAcrossGraphs` belongs to the graph-update flow (R6).
- **Pre-existing failures (not R4):** admin-web `tsc` (4 errors) and `next build` fail on `src/app/resident/requests/new/new-request-form.tsx` importing a resident-web form whose `@/` aliases don't resolve in admin-web. `agency_sla.test.sql` needs `pg_cron`, absent in cloned databases (passes 62/62 on the original).

*Progress note, 2026-10-13 (R4):* Ran `npx vitest run` (packages/shared: 28 files / 365 pass; baseline 354), `npx tsc --noEmit` for packages/shared, apps/resident-web and apps/resident-android-mobile (0 errors), apps/admin-web (4 pre-existing errors, identical to baseline), `npx eslint` (admin-web: 0 problems), `npm run test:tables` (68/68), `next build` (admin-web: pre-existing failure only). Applied `0110`–`0113` to a disposable clone; ran `routing_conditions.test.sql` (81/81), all other SQL suites (pass; `agency_sla` cron-only), a 5-mutant check, `concurrency.sh`, and `seed.sql` on a schema-only copy. Exercised the admin page in the built-in browser against an isolated GoTrue/PostgREST on the disposable DB: activation, publish (including future-time validation), anonymous snapshot and refused anonymous writes, availability, entrance, closed-segment click, reopen (including empty-reason validation), and the existing center form's update path. No console errors besides the test proxy's unsupported realtime WebSocket.

*Hosted note, 2026-10-13 (R4):* The owner applied `0113`. Read-only checks on the hosted project: migrations `0110`–`0113` are recorded; all 7 routing tables, 4 new center columns and 6 guard triggers exist. Grants are correct: `anon` can execute the snapshot but not `publish_road_closure` and can't read `road_closures`; `authenticated` can't insert closures. The snapshot returns area `ampid-1` at revision 0 with graph status `none`, 7 centers (all `unknown`), no closures and no tombstones. The security advisors raise only the expected security-definer lints for the intended public snapshot and the admin RPCs, which check the role inside. No routing table lacks RLS policies. Next operational step: an administrator activates the bundled map data on the hosted Evacuation Routing page before publishing closures or entrances. The hosted area has 7 centers against 4 in the local seed, so DRRM should review all 7 positions and entrances (R3 review).

*Hosted REST check, 2026-10-13 (R4, anon key, no writes):* The snapshot returns schema 1, revision 0, 7 active centers with valid positions, and parses with `routingConditionsSnapshotSchema`. An unknown area gets `P0002` and a malformed graph version `22023`. All 7 admin RPCs refuse `anon` (42501). Anonymous reads of `road_closures`, `routing_areas`, `routing_condition_events` and `road_closure_edges`, and an anonymous insert into `road_closures`, are refused (42501). Not run on hosted: the 81-test suite (it would write inside a rolled-back transaction, and the permission system blocked it) and the admin UI flows (they need an administrator to sign in, and closures there are permanent records).

### R5 — Connected route service
- Pure core in Edge Functions with profile `ampid-fine`; request validation, rate limits, snapshot selection, response provenance; closure-only and degraded-model modes; returns the best route, the shortest route, and per-center route distances in one response.

**Verification:** cold/warm CPU and memory; parallel requests, oversized input, outdated snapshots, client cancellation; no coordinate leakage in logs.
**Exit gate:** route correctness, resource budgets and public API failure behavior pass.

**Status (2026-10-13): Partially complete — exit gate met locally (real supabase-edge-runtime with the CLI's worker limits, disposable seeded database); hosted migration, deploy and hosted checks pending owner authorization.** Evidence: `plans/evidence/resident-drrm-routing/r5-route-service/README.md`.

| R5 item | Status |
|---|---|
| Pure core in Edge Functions, profile `ampid-fine` | Done — `supabase/functions/evacuation-route/` (`index.ts` Deno entry, `handler.ts` runtime-agnostic) imports `evacuation-routing.ts` and the new import-free contract `packages/shared/src/lib/evacuation-route-service.ts` by relative `.ts` path (R0 decision); routes with `planEvacuationRouteAsync` (yields, 1 s compute deadline, client-disconnect cancellation). |
| Request validation | Done — POST only, 16 KiB body (declared or streamed), strict keys, 0113 id/graph-version patterns, ≤ 200 avoided segments, segment ids need their graph version (409 when it is not the service's). |
| Rate limits | Done — `0114_routing_rate_limits.sql`: service-role-only `consume_routing_rate_limit` over a private per-window table of HMAC-hashed client addresses; 300 requests/minute/address, 429 + `Retry-After`; fails open and reports when the limiter is down. Hosted client-address header: **pending**. |
| Snapshot selection | Done — per-request `get_routing_conditions_snapshot` for the bundled graph; routes only on the area's active graph, never on a snapshot older than the client's newest revision, never with an unmapped closure. |
| Response provenance | Done — route provenance (graph, conditions revision, profile, config, origin revision) plus graph SHA-256, OSM time, ODbL attribution, conditions revised/generated times, `modelStatus`. |
| Closure-only and degraded-model modes | Done — closure-only (stage 1) with `modelStatus: 'unavailable'`: no model input exists before R8/R9, and missing model data never blocks routing or counts as dry. |
| Best route, shortest route and per-center distances in one response | Done — `best`, `shortest` (`null` while weight = distance), `centers` one-to-many walking distances. |
| Verification: cold/warm CPU and memory | Done (local runtime) — cold pack import 6–13 ms + verification/preparation 13–23 ms, route p95 ≤ 2.9 ms (max 11 ms), heap ≤ 15.4 MB; cold first request 270–314 ms, warm p95 60 ms end to end. Hosted: **pending** deploy. |
| Verification: parallel requests, oversized input, outdated snapshots, client cancellation | Done — 50 parallel identical to sequential; 413/400/405/409; `snapshot_outdated` and `graph_not_active` 503; abort stops the search (unit) and leaves the runtime healthy (real). |
| Verification: no coordinate leakage in logs | Done (local) — handler never logs; fixed event names only; edge runtime, PostgREST, database and proxy logs free of coordinates; responses `no-store`. Hosted logs: **pending** deploy. |
| Exit gate: route correctness | Done — service output byte-identical to the Node core on the same snapshot (25 origins); closures, reopening and availability changes served on the next request. |
| Exit gate: resource budgets | Done locally (CPU < 50 ms cold work vs 1.5 s, memory ~15 MB vs 192 MB, bundle 621 KB vs 5 MB). |
| Exit gate: public API failure behavior | Done — every failure is a typed error (never a route or straight line); 503 family for conditions/graph/deadline problems. |

**R5 decisions and discrepancies**

- **Pack loading:** bundled as JSON modules from `data/routing-packs/ampid-1/pack/` (static files must sit inside the function folder, which would duplicate the pack); R0's "load packs as separate resources" concern was the 5 MB bundle cap, and the bundle is 621 KB. The worker re-verifies `graph.json` against the manifest SHA-256 and byte count before routing.
- **Rate limit policy:** 300/minute per address because mobile carriers share public addresses (CGNAT) and residents request routes together during floods; no recognisable address → not limited; limiter failure → fail open with a logged event. Emergency availability takes precedence over abuse resistance here; revisit after the R10 pilot load test.
- **Active graph only:** a registered-but-inactive graph is refused (`graph_not_active`) because activation is DRRM's acceptance and a deactivated graph may be wrong. Until an administrator activates the map data on hosted (R4 hosted note), the hosted service will answer `503 graph_not_active`.
- **Errors vs routes:** HTTP 200 carries every core route outcome (`ok`, `no_route_within_coverage`, `attachment_ambiguous`, `outside_coverage`, `no_nearby_path`, `center_unavailable`, `invalid_origin`, `restrictions_unmapped` for client avoidance); everything else is `{ error, message }` (400/405/409/413/429/499/503) and is a service failure for clients (R7).
- **Authentication:** `verify_jwt = false` for this function in `supabase/config.toml` (invariant 9).
- **Migration numbering:** `0114`; `AGENTS.md` ("last pushed 0094") remains stale. Next new migration: `0115`.
- **Left for R7:** client deadlines (10 s route, 8 s conditions), connected/local mode, and consuming this API on Android and web.

*Progress note, 2026-10-13 (R5):* Ran `npx vitest run` (packages/shared: 29 files / 409 pass; baseline 365), `npx vitest run supabase/functions` (2 files / 38 pass; baseline 11), `npx tsc` for packages/shared, the function handler and tests (evidence tsconfig), apps/resident-web and apps/resident-android-mobile (0 errors each), and the R2 digest (`217d8e6a`, unchanged). Applied `0110`–`0114` to a full clone of the local DB: all SQL suites pass, including `routing_rate_limits` 19/19 and `routing_conditions` 81/81 (`agency_sla` cron-only, pre-existing). Mutation check: 8/8 TypeScript and 5/5 SQL mutants caught. In supabase-edge-runtime 1.76.2 with the CLI's main service and limits, against a seeded schema-only clone (graph activated and entrances set through the 0113 RPCs), I ran an in-worker resource probe on three fresh workers and the HTTP service probe: cold/warm latency, Node/Deno route agreement, parallel requests, invalid input, outdated snapshot, closure publish/reopen, availability change, graph deactivation, the 300/minute limit, cancellation and log scans. All matched the expected behavior. `edge-runtime bundle` produced a 621 KB eszip that boots and routes. The local stack (`supabase functions serve`) also returned the expected 503 against the dev DB, which lacks the routing schema. All test containers, the proxy and both disposable databases were removed; the local dev DB is unchanged (still `0109`). Remaining: owner-authorized hosted `0114` apply and function deploy, then hosted latency, client-address-header and log checks.

### R6 — Android durable offline operation
- Bundled map assets, typed bridge for local geometry, pack staging/journal/recovery/rollback, local avoidance, public emergency access, restrictions preserved across graph updates and sign-out.

**Verification:** clean-install airplane-mode start; force-stop/reopen, corrupt pack, interrupted update, unresolved remapping; session-restoration failure cannot block the emergency map.
**Exit gate:** new routes calculate after an offline cold start without network assets.

**Status (2026-10-14): Complete — exit gate and every R6 verification item met on an Android 12 emulator release build (embedded Hermes bundle, airplane mode, simulated conditions backend, fabricated test session). Operational follow-ups outside R6: on hosted, routes stay unavailable until an administrator activates the bundled graph and maps center entrances (R3/R4); physical-phone timing is R10.** Evidence: `plans/evidence/resident-drrm-routing/r6-offline/README.md`.

| R6 item | Status |
|---|---|
| Bundled map assets | Done — Leaflet 1.9.4 JS/CSS/licence inlined from `src/components/leaflet-assets.ts` (generated by `scripts/generate-leaflet-assets.mjs`, drift test); no unpkg. The Centers map draws the pack's vector roads/water as the basemap; OSM tiles load only while the internet is reachable (NetInfo) and never during page load. OSM attribution is visible on every map. Starter data is the bundled `ampid-1` pack. |
| Typed bridge for local geometry | Done — `SET_PACK_BASEMAP`, `SET_TILES`, `SET_ROAD_MARKS`, `SET_TAP_MODE`, `MAP_TAPPED` in `packages/shared/src/types/map-bridge.ts`; route is a declarative prop replayed after map-ready. Measured: 205,551-char basemap message, 17–21 ms round trip on the emulator. |
| Pack staging / journal / recovery / rollback | Done — `src/lib/offline-routing.ts`: document storage `routing/v1/ampid-1/` (active + previous packs, `state.json` journal), stage → verify exact bytes/schema/area/config → journaled pointer switch; recovery promotes or discards deterministically; corrupt active pack is reinstalled from the bundle or rolled back to the previous pack. Unit-tested at every crash point; verified on device (corrupt pack, interrupted update). |
| Local avoidance | Done — tap a road in the Centers map (≤ 25 m) → confirm; stored with source refs, geometry, graph version, creation time; both directions blocked; listed with explicit Remove; never expires or is published. Remapped by source reference on graph changes; unmapped marks are kept and block routing (`restrictions_unmapped`). |
| Public emergency access | Done — `/emergency-centers` outside every `Stack.Protected` guard; splash lifts on that route or after 3 s of restoration; the restoring screen and the restoration-error overlay offer the entry; account setup shows the link under every step. Device: offline cold start into it, from a resident held in account setup, during an offline restoration and after it failed. |
| Restrictions preserved across graph updates | Done — activation requires a snapshot of the candidate graph that the area has activated with every closure mapped, and every mark mapped; otherwise deferred with the current pack active (status card says why). |
| Restrictions preserved across sign-out | Done — device: after Sign out the routing store (pack, conditions, blocked road) and the durable center rows remain and the public map shows them; only the session key is removed. |
| Hermes digest (R2 pending item) | Done — `217d8e6a` on the installed release build, identical to Node and edge-runtime. |
| Cooperative yielding on Hermes, p95 ≤ 2 s | Done — `planEvacuationRouteAsync` with `setTimeout(0)` yields; emulator p95 12–15 ms (sync), 65–90 ms (yielding), max 150 ms. Physical-phone measurement remains for R10. |
| Verification: clean-install airplane-mode start | Done (emulator). |
| Verification: force-stop/reopen, corrupt pack, interrupted update, unresolved remapping | Done (emulator + unit tests). |
| Verification: session-restoration failure cannot block the emergency map | Done — expired test session, airplane mode: splash lifts to "Restoring your session…" with the entry; after the refresh fails (~40 s) the error overlay offers it and never covers the map. |
| Exit gate: new routes after an offline cold start without network assets | Met on the emulator release build: airplane mode, route 659 m / 21 edges computed from stored conditions (identical to Node); with a published closure 923 m / 22 edges, also after a corrupt-pack repair. |

**R6 decisions and discrepancies**

- **Pack source:** the app bundle is the only trusted distribution origin today, so the staging pipeline installs and repairs from it and activates a newer bundled graph only when its restrictions map. Network pack downloads are not built: no distribution endpoint exists (owner decision when one is needed).
- **Graph activation rule on devices:** a candidate graph is activated only from a snapshot in which the area has activated it and every closure is mapped (same rule as the R5 service). Offline, with known conditions, activation is deferred rather than losing the compatible snapshot.
- **Local routes replaced OSRM on Android:** the Centers screen now computes walking routes on the installed pack, so the Android OSRM call and its straight-line fallback (R7 targets) are gone from Android. `packages/shared/src/lib/osrm.ts` and web usage remain for R7. Connected (Edge Function) routes, mode banners and list ranking by walking distance stay in R7.
- **Center rows offline:** the last fetched `evacuation_centers` rows are kept without the 30-minute expiry so the list and routes work after a long offline period.
- **No starter centers:** centers, availability and entrances come only from the conditions snapshot; a never-online install shows the map and says data has not been downloaded (no bundled placeholders).
- **`mapEdgesAcrossGraphs` moved into the import-free core** (re-exported by the builder) so Android can remap restrictions; R2 digest unchanged.
- **Centers panel extracted** to `src/components/evacuation-centers-panel.tsx` for reuse by the public screen; existing control sizes and positions are unchanged; new controls: blocked-road button (third map button), status card and mark card at the top of the bottom overlay.
- **Migration numbering:** no migration in R6; `AGENTS.md` ("last pushed 0094") remains stale. Other sessions have since added `0115`–`0117`.
- **Out of scope noticed:** facility chips render icon names as text (e.g. "medkit-outline Medical Desk") in `EvacuationCenterCard`; the centers fetch error banner shows raw transport errors (R7 messaging).

*Progress note, 2026-10-14 (R6):* Ran `npx vitest run` (Android: 12 files / 104 pass; baseline 88), `npx tsc --noEmit` (Android, packages/shared, resident-web, admin-web: 0 errors each), `npx expo lint` (0 errors; the 2 pre-existing warnings), `npx vitest run` (packages/shared 409/409), `npx vitest run supabase/functions` (38/38), R2 digest on Node (`217d8e6a`), a 7-mutant check on the store tests (7/7 killed), and `npx expo export --platform android` (Hermes bundle builds; no CDN URLs). Built release APKs in the gitignored test shell `.expo/r6-offline-native` (application id `com.barangayan.resident.r6offline`) and ran them on MuMu (Android 12): clean install in airplane mode, hosted online (graph not activated → routes refused), offline cold-start routes with a simulated activated-graph backend, closure propagation, corrupt pack, interrupted update, unmapped mark, blocked-road marking and persistence, plus Hermes digest/timing/bridge measurements through a temporary probe screen (removed). The emulator was restored afterwards. Remaining: owner-attended session-restoration-failure, account-setup and sign-out checks on a device; hosted graph activation and entrance mapping before routes work against hosted data; physical-phone timing in R10.

*Progress note, 2026-10-14 (R6, authentication checks, owner-approved):* Built APK C in the same test shell with a temporary probe that writes a fabricated test session (test user and tokens, no real account; the build talks only to the local simulated backend) into the app's auth storage. On MuMu: a signed-in resident held on the account-setup error screen sees the evacuation-centers link, which opens the public map with the saved centers and blocked road; Sign out returns to Log In and leaves the routing store and durable center rows intact (only the session key is removed); with an expired session in airplane mode the splash lifts to "Restoring your session…" with the link, and after restoration fails the error overlay offers the link and the map stays usable. Probe removed, emulator restored (airplane mode off, test app and files removed). Rechecked the final tree: Android `tsc` 0 errors, `expo lint` 0 errors (2 pre-existing warnings), `vitest` 14 files / 126 pass (two files added meanwhile by concurrent settings work). Remaining outside R6: hosted graph activation and entrance mapping; physical-phone timing (R10).

### R7 — Resident integration and mode transitions
- Connected responses on Android and web; revision ownership and route invalidation; freshness, mode, availability and failure messages; keep existing Centers layouts; **remove the straight-line fallback** (`index.tsx:540-543`) and the public OSRM demo dependency (`packages/shared/src/lib/osrm.ts`).

**Verification:** network flapping, stale responses, rapid origin/center changes; Android connected-to-local transition; web offline prevention; remount/fullscreen/list changes preserve state.
**Exit gate:** platform behavior matches the product contract in end-to-end tests.

**Status (2026-10-14): Complete for the emulator exit gate — web and Android verified end to end against the deployed `evacuation-route` service and hosted conditions (revision 10). Physical-phone runs stay with R10; two centers are routable, the other five await DRRM-confirmed entrances. The later map-layout follow-up is done in code and awaits a device check.** Evidence is the progress notes below (no evidence folder was created).

| R7 item | Status |
|---|---|
| Connected responses on web | Done — `packages/shared/src/lib/connected-route-client.ts` (POST body only, 10 s deadline, typed outcome, failure wording); `apps/resident-web/src/hooks/use-connected-route.ts`; `route-status-card.tsx`; `centers-content.tsx` ranks and draws from the response. Verified in browser. |
| Connected responses on Android | Done — `hooks/use-resident-route.ts` wraps the local route; `evacuation-centers-panel.tsx` and `offline-route-card.tsx` show mode and failures. Verified on the EAS release build against the hosted service (device note below). |
| Revision ownership and invalidation | Done — a result is keyed by graph, origin revision, center, street choice, avoidance set and conditions revision; any change drops it immediately (Android falls back to the local route; web shows loading). Web sends the newest conditions revision seen, so an older snapshot is refused. |
| Freshness, mode, availability, failure messages | Done — conditions checked-age, "route service" vs "calculated on this phone", stale-route label on web, unconfirmed-availability and shortest-vs-recommended lines, plain-language failures. |
| Keep existing Centers layouts | Done — new status card only; no existing control size or position changed. |
| Remove straight-line fallback and OSRM | Done — Android's fallback was removed in R6; `packages/shared/src/lib/osrm.ts` and its test are deleted and the index export removed. Web no longer calls OSRM. |
| List ranked by walking distance | Done on both — from the one-to-many `centers` summaries; a center with no route shows no distance rather than a straight line. |
| Verification: web offline prevention | Done — with the service down no route is calculated or drawn; a previous route for the same selection is kept only with a stale warning. |
| Verification: stale responses, rapid center changes | Done in code (abort per key; result for another key never shown); web observed with center switches. |
| Verification: network flapping, Android connected-to-local, remount/fullscreen/list changes | Done on emulators — connected → airplane mode → local → recovered to connected (MuMu); cold start, list/map toggle, signed-in tab and rapid center switches (LDPlayer); web against the deployed function. Fullscreen applies to web only and was covered in R1. |
| Exit gate: end-to-end tests against the deployed service | Met on emulators and the web dev server (notes below). Physical phone: R10. |

**R7 decisions and discrepancies**

- **Automatic request:** with no center selected the client still requests a route (`centerId: null`) to obtain the ranking; only the route to a selected center is drawn.
- **Web has no origin chooser state before the first answer:** the street choice carries the graph version from the `attachment_ambiguous` answer that offered it.
- **Retry policy:** refresh every 30 s while visible; failures back off 60 s, 120 s, 240 s up to 5 minutes; the web "Try again" button retries at once. Android skips requests while NetInfo reports the internet unreachable, and any success restores connected mode.
- **Line reference drift:** the plan's `index.tsx:540-543` fallback no longer exists (R6). OSRM was also referenced by `geocode.ts` comments only.
- **Out of scope noticed:** `packages/shared` `tsc` reports `FileReader` missing in `id-evidence.ts` (another session's file); web `useEvacuationCenters` still offers a haversine `userPosition` option used by other screens.
- **Not done:** the Android "unknown availability" label on the center card beyond the status line; a dedicated `lib` test for the Android hook (hooks have no test harness in that app).

*Progress note, 2026-10-14 (R7):* Baseline before edits: `packages/shared` vitest 29 files / 414 pass; Android and web `tsc` 0 errors. After: shared vitest 29 files / 419 pass (osrm tests removed, 5+ client tests added: body-only origin, service error, rate limit, unreadable 200, network, timeout, cancellation); Android `tsc` 0 errors, `vitest` 14 files / 126 pass, `expo lint` 0 errors (same 2 pre-existing warnings); web `tsc` 0 errors, `eslint` on the touched folders 0 problems. In the built-in browser on the existing resident-web dev server (port 3001) with a stubbed geolocation and a local stand-in for the service (real routing core and real Ampid I pack over the 7 hosted centers): automatic ranking, selection route and drawn path, `minConditionsRevision` carried, service-down failure with retry and recovery, and a stale route kept with its warning after a refresh failure. Console showed only the simulated 503s. The stand-in and its temporary script were removed. Not run: Android emulator/device, hosted function (not deployed).

*Device note, 2026-10-14 (R7, owner-requested EAS build):* EAS preview build `5a333d69-f5bb-4639-a66e-28633172747d` (versionCode 5, eas-cli 24.13.0 because eas.json requires >= 24.12.1) was installed on MuMu (`com.barangayan.resident`, location permission granted) and opened through `barangayan://emergency-centers`. Observed against the hosted backend, where the function is not deployed and the graph is not activated: Centers map with the offline pack's vector roads, "Road closures checked just now", the connected request failure shown as "The route service had a problem… Showing the route calculated on this phone", and "The barangay has not activated this map version yet, so routes are not available". That confirms the failure and local-mode wording on a device; connected success and connected-to-local transitions remain pending the deploy and activation.

*Hosted note, 2026-10-14 (R7):* The owner deployed `evacuation-route`, activated graph `ampid-1@2026-10-12#fc7101b6227d` and, through admin-web, moved two center pins to their OpenStreetMap buildings (Ampid Ⅰ Elementary School `way/857478797`; Bahay Pamahalaan ng Barangay Ampid Ⅰ `way/561462871`), set their entrances (`n1141792181` Jupiter Street, `n8310796062` Mayor Jose F. Diaz Avenue) and marked both Available (conditions revision 10). The other five centers stay unroutable: three are in other barangays and two have no confirmed location. DRRM still has to confirm both entrances. Live probes (made-up origins inside Ampid I, anon key): automatic route → Hall 483 m / ~7 min, ranking Hall 483 m then Elementary 721 m; selected Elementary 884 m from another origin; `center_unavailable` for an unrouted center; `outside_coverage` outside the boundary + 150 m; `attachment_ambiguous` at 60 m accuracy with street candidates; `503 snapshot_outdated` for a newer client revision; `400` malformed; `405` GET; 0.3–1.0 s round trips. Function logs were not inspected (production reads are blocked for this session).

*Device and web note, 2026-10-14 (R7):* EAS build `5a333d69…` (versionCode 5). **LDPlayer** (Android 9, owner's candidate 3 upgraded in place, GPS set with `ldconsole locate` to 14.6800, 121.1160): the public Centers map showed "Route calculated by the Barangayan route service with current road conditions", the picker ranked the Hall 483 m, selecting it drew the route line and the card read 7 min · 0.5 km; the list showed Hall 0.5 km / 7 min, Elementary 0.7 km / 10 min and no distance for the five unrouted centers; after a full emulator restart (cold start) the connected route returned; on the signed-in Emergency → Centers tab a Hall → Elementary switch 0.3 s apart ended on Elementary 10 min · 0.7 km, and the drawn line matched the service geometry (Daang Bakal → J. F. Diaz → De Los Angeles → Jupiter). **MuMu** (Android 12, GPS fixed in Manila, outside coverage): online → "route service" wording; airplane mode through the root shell → tiles dropped to the pack's vector map, "Offline: road closures and center status from just now", no service line; airplane mode off → service wording back within ~40 s. **Web** (built-in browser, existing dev server :3001, stubbed geolocation, real hosted function, no other mocks): HTTP 200, list ranked Hall 0.5 km / 7 min and Elementary 0.7 km / 10 min, unrouted centers without distance; Hall selection drew the route; switching to Dulong Bayan removed the line and showed "This center cannot be routed to…"; no console errors. Not run: an offline drawn route from inside Ampid I in the same session (LDPlayer's adb rides on its network and it has no root; covered by the R6 offline exit gate with the same engine), and a physical phone (R10).

**Observations (not fixed, out of R7 scope):** facility chips show icon names ("medkit-outline Medical", R6 note); selecting an unroutable center drops the walking-distance ranking until another routable selection (the ranking comes from the same answer); the `AGENTS.md` migration note ("last pushed 0094") remains stale. The map-overlap observation from the device run is addressed in the follow-up below.

**Device state after testing:** LDPlayer runs `com.barangayan.resident` versionCode 5 (upgraded from 3, data kept) with its GPS left at the Ampid I test point; LDPlayer restarted itself with a 1920×1080 display at the end of the run (not caused by these tests). MuMu: airplane mode off, temporary screenshot removed, instance shut down for an adb port clash (both emulators bind 127.0.0.1:5555) and relaunched.

*Follow-up, 2026-10-14 (R7, owner-requested):*

| Change | Status |
|---|---|
| Admin-web entrance form: latitude/longitude fields with **Find road point** (same 40 m snap as a map click), the snapped node's coordinates and its distance from the pin, a 250 m warning, and **Save entrance** disabled while the point is over 250 m (the server refuses it anyway) | Done — `tsc`/`eslint` clean; used by the owner to set both hosted entrances. |
| Admin-web **Clear entrance** asks for confirmation in the existing native modal (`TableDetailDialog`): explains that residents get no route to the center until a new entrance is set; stays open on failure | Done — `tsc`/`eslint` clean; not exercised in a browser (needs an administrator sign-in). |
| Admin-web **Recent changes** shown as a borderless table (Revision · Change · When; time column never wraps; scrolls sideways on narrow screens) | Done — `tsc`/`eslint` clean; not exercised in a browser. |
| Set entrance / Change entrance scrolls the map and form into view | Already present (another session, 18:42); unchanged. |
| Facility codes: `EVACUATION_CENTER_FACILITIES` lists every code the resident apps render (`medical`, `catering`, `children`, `toilets`, `internet` added). The admin center form failed validation on any edit of a center holding those codes (the Barangay Hall) | Done — shared vitest 419/419, admin-web `tsc`/`eslint` clean; all seven hosted centers' codes are accepted. |
| Android Centers map: the route is fitted into the area not covered by the search bar and the bottom overlay (measured with `onLayout`, passed as `DRAW_ROUTE` padding; padding shrinks proportionally if under 120 px would remain; a later overlay resize does not refit). The selected-pin framing uses the same measurement instead of a fixed 120 px card estimate that ignored the status card, and stops once the route is drawn | Done in code — Android `tsc` 0 errors, `expo lint` 0 errors (2 pre-existing warnings), `vitest` 126/126. **Device check pending.** |
| Android Centers map: the status card is compact over the map (one summary line, warnings first, then a running calculation, then the route outcome or mode; `+N` hidden lines; tap to expand, **Show less** to collapse); never collapses while the street chooser is shown; the List view keeps the full card | Done in code — same checks. **Device check pending.** |

No existing control changed size or position (cancelled Phase 8 boundary).

**Pending device check for the map follow-up:** LDPlayer's configuration was rewritten at 22:35 (not by this session or the iOS session): 1920×1080 at 280 dpi and no adb listener, where it had been 1080×1920 at 480 dpi with local adb. Waiting on the owner to either restore those settings (then: dev build `com.barangayan.resident.dev` with Metro on 8083, GPS via `ldconsole locate`, select the Hall and confirm the whole route sits between the search bar and the cards without panning, expand/collapse the status card, trigger the street chooser at 60 m accuracy) or to check it on the next EAS build.


### R8 — Sensor ingestion and BFS shadow
- Permitted source adapters, RRL §7.4 validators, immutable sensor snapshots; calibrated grid eligibility, FIFO BFS, road intersection compilation; model-health and unknown-coverage reporting. Shadow output reports seeds used and stations ignored (out of grid, stale, flagged). Sensor penalties and exclusions stay disabled for residents.

**Verification:** missing/stale readings, invalid datum, barriers, multiple seeds, source failure; preprocessing and traversal budgets measured separately; superseded computations cannot publish.
**Exit gate:** reproducible shadow output and documented input readiness. Missing external data leaves this phase **pending**; do not fabricate completion.

**Status (2026-10-14, updated 2026-10-15): Partially complete — code, storage and tests done and verified on synthetic inputs and a disposable database; real shadow output is pending external data (stations, licensed DEM, datum, feed). Nothing deployed or applied to hosted. Paused by the owner until the PAGASA data is obtained; resume steps: fill `sensor-stations.json` and `terrain.json` after review, rebuild the pack with `stations.json`, apply `0120`, deploy and schedule `flood-shadow` (owner-authorized).** Evidence: `plans/evidence/resident-drrm-routing/r8-shadow/README.md`.

| R8 item | Status |
|---|---|
| Permitted source adapters | Done as a reviewed-feed contract (`parseSensorFeed`, HTTPS fetch from the owner-configured `FLOOD_SENSOR_FEED_URL`, bounded, no redirects). A live PAGASA adapter is **not built**: access terms, format and cadence are unverified (the PMT-FFWS certificate did not verify and was not bypassed). |
| RRL §7.4 validators | Done — ±5 m range, 2 m change scaled to the declared cadence, robust outlier test, staleness at 10 intervals, datum and future-time checks; rejected, stale and missing readings are unknown. Constants beyond the RRL's are provisional (evidence decisions 3–4). |
| Immutable sensor snapshots | Done — deep-frozen, SHA-256 id of canonical content, reproducible. |
| Calibrated grid eligibility | Done — verified station set matching the pack, licensed terrain, equal datum, known vertical RMSE ≤ 0.25 × the smallest Alert→Critical span (provisional ratio), known elevations. |
| FIFO BFS | Done in R2; reused unchanged. |
| Road intersection compilation | Done — `compileRoadFlooding` over the exact cell walk `floodGridCellsOnPolyline`; bridge decks assessed separately (never flooded by cells beneath). |
| Model-health and unknown-coverage reporting | Done — `modelStatus`, eligibility reasons, unknown terrain/frontier cells, unknown edges, source status, input times. |
| Shadow output reports seeds used and stations ignored (out of grid, stale, flagged) | Done. |
| Sensor penalties and exclusions disabled for residents | Done — reports carry `residentInfluence: 'none'`; storage refuses anything else; nothing reads shadow runs but administrators. |
| Superseded computations cannot publish | Done — `0120_flood_shadow_runs.sql`: per-area lock, newest-evaluation and active-graph checks; pgTAP 37/37, real parallel sessions. |
| Scheduled area-bounded function | Done in code (`supabase/functions/flood-shadow`); verified in edge-runtime 1.76.2 locally; **not deployed or scheduled**. |
| Preprocessing and traversal budgets measured separately | Done — whole run p95 3.7 ms (Node) / 3.3 ms (Deno), BFS p95 under 0.4 ms. |
| Reproducible shadow output | Done — byte-identical rebuild, Node = Deno = edge runtime. Real inputs give `unavailable`. |
| Documented input readiness | Done — table in the evidence README. |
| Real shadow output / exit gate | **Pending** external data: PAGASA station coordinates and levels, a licensed DEM with documented vertical error and a verified datum (plan section 7). |

**R8 decisions and discrepancies**

- **RRL range check vs Critical:** a baseline more than 5 m below Critical would make the literal §7.4 check discard genuine Critical readings, so station sets with such a baseline are refused at parse. The 2018 PAGASA bulletin lists Montalban at 17.26 / 18.26 / 19.26 m, not Table 1's values; do not hard-code unverified thresholds.
- **Lease** is a transaction-scoped advisory lock inside the publish RPC; the input-version check is evaluation time plus active graph.
- **Failure policy:** failed or invalid feed → honest `unavailable` run; missing history → no run (503).
- **Migration numbering:** `0120`; `AGENTS.md` ("last pushed 0094") remains stale. Other sessions have since added `0121`–`0124` (iOS and upload work); the next new migration is the one after the highest prefix in `supabase/migrations`, currently `0125`.
- **Out of scope noticed:** `packages/shared` `tsc` still reports `FileReader` missing in `id-evidence.ts` (another session's file); the DEM-to-grid resampler is not built because the DEM format and licence are unknown.

*Progress note, 2026-10-14 (R8):* Baseline before edits: `packages/shared` vitest 29 files / 420 pass, `tsc` 2 pre-existing errors (`id-evidence.ts`), `supabase/functions` vitest 3 files / 48 pass. After: shared 30 files / 477 pass (+57), same 2 `tsc` errors; `supabase/functions` 5 files / 72 pass (+20 flood-shadow); handler/test `tsc` 0 errors; Android `tsc` 0 errors and `vitest` 14 / 126; web `tsc` 0 errors; R2 digest `217d8e6a` unchanged. Applied `0118`–`0120` to a full clone of the dev DB (`r8_disposable`, dropped afterwards; the dev DB was only read): pgTAP `flood_shadow_runs` 37/37; 16/16 TypeScript and 7/8 SQL mutants killed (the survivor is equivalent, see evidence). Ran the real function in supabase-edge-runtime 1.76.2 with PostgREST: published, duplicate, superseded, unauthorized, method errors, real bundled inputs → `unavailable`; 10 parallel publishers stayed ordered. Node 24.13.1, Deno 2.9.7 and the edge runtime agree on report hashes. Remaining: owner-authorized hosted apply/deploy/schedule, station and terrain data, and DRRM/PAGASA confirmation of the open constants.

### R9 — Model validation and controlled activation
- Replay/comparison tooling and versioned activation configuration; held-out event reports (candidates: Kristine Oct 2024, Ulysses Nov 2020); bridge/approach validation; model replacement, holdover restrictions, explicit clearance.

**Verification:** false positives/negatives and calibration sensitivity documented; accepted revisions clear only their own exclusions; degraded operation when sensor or model services fail.
**Exit gate:** DRRM acceptance evidence exists before enabling sensor penalties or BFS exclusions.

**Scope split (owner Q&A, 2026-10-15).** R9 may be started without external data, but only for R9a. R9 as a whole cannot be complete until R9b is done.

| Part | Items | External data | Rule |
|---|---|---|---|
| **R9a — buildable now** | Replay/comparison tooling (verified on synthetic events only); versioned activation configuration with the stage order (closures → sensor warning/penalty → BFS advisory → BFS exclusion, none skippable) and every model stage **off**; model replacement, holdover restrictions and explicit clearance (a valid newer model clears only its own exclusions, never a verified closure or a resident avoidance mark); degraded operation when the sensor or model service fails; precision/recall/IoU computation code | None | Enables nothing and changes no resident behavior. No thresholds, calibration values or accuracy claims; `modelStatus` stays `unavailable`. Evidence is labelled synthetic. |
| **R9b — data-gated** | Held-out event reports (≥ 2 events with archived gauge series and extents); precision/recall/IoU numbers; road-level false positives/negatives; bridge/approach validation; calibration sensitivity; DRRM acceptance of a versioned exclusion policy | Station data, licensed DEM, datum, flood-event ground truth, DRRM review | Stays **pending**. Not started, not simulated, not marked passed. |

**Status (2026-10-15): Partially complete — R9a done and verified (synthetic, automated); R9b paused until the owner gives the go signal with the PAGASA data (owner decision, 2026-10-15). Exit gate not met.** Evidence: `plans/evidence/resident-drrm-routing/r9-validation/README.md`.

| R9 item | Status |
|---|---|
| Replay/comparison tooling | Done (R9a) — `packages/shared/src/lib/flood-validation.ts`: `replayShadowEvent` (chained history, as the scheduled function), `compareShadowReports` (stage-3 difference log), `compareExtents` / `scoreReportRoads` / `scoreReportCells` (precision, recall, IoU, road-level false positives/negatives; bridge decks unknown; 0/0 → null), `terrainOffsetSensitivity`. Synthetic events only. |
| Versioned activation configuration | Done (R9a) — `model-activation.ts`: `DEFAULT_ACTIVATION` with every model stage off; stages `sensor` → `advisory` → `exclusion` enabled only in order and only with an acceptance reference and date; `resolveModelInfluence` withholds everything for an invalid config or a stale/unavailable model. Not wired into routing (nothing to enable). |
| Model replacement, holdover restrictions, explicit clearance | Done (R9a) as pure logic — `model-exclusions.ts`: complete newer revision replaces, degraded only adds, expiry/failure → holdover, older ignored, reviewer clearance; `effectiveBlocks` keeps closure and avoidance reasons so the model can never reopen them. Persistence and snapshot wiring come with stage 4 (data-gated). |
| Verification: accepted revisions clear only their own exclusions | Done (automated). |
| Verification: degraded operation when sensor or model services fail | Done (automated): stale/unavailable health → no new influence; exclusions held over. |
| Verification: false positives/negatives and calibration sensitivity documented | Tooling done; **numbers paused** (R9b). |
| Held-out event reports (Ulysses, Kristine); bridge/approach validation | **Paused** (R9b) — owner go signal with the PAGASA data. |
| Exit gate: DRRM acceptance evidence | **Not met**; cannot be met by R9a. |

**R9 decisions**

- **Three model stages** (`sensor` = stage 2 warning + soft penalty, `advisory` = stage 3, `exclusion` = stage 4); closure routing is never gated.
- **Influence needs `ok` or `degraded` health**; a stale or unavailable model adds nothing, earlier exclusions stay as holdover. Only a complete (`ok`) revision clears.
- **Staleness** = 10 × a *confirmed* run interval (plan 3.6); no confirmed interval → `unavailable`.
- **No persistence or routing wiring yet**: both change what residents receive and belong with the first activation after DRRM acceptance.
- **Paused work is not simulated**: no thresholds, calibration values or accuracy figures were written.
- **Migration numbering:** no migration in R9; the repository is at `0128` (other sessions), so the next new one is `0129` or whatever follows the highest prefix.

*Progress note, 2026-10-15 (R9a):* Baseline: `packages/shared` vitest 31 files / 490 pass, `tsc` 5 pre-existing errors (`id-evidence.ts` ×2, `service-catalog.test.ts` ×3, other sessions' files), `supabase/functions` 5 / 72, R2 digest `217d8e6a`. After: shared 34 files / 524 pass (+34: activation 12, exclusions 10, validation 12), same 5 `tsc` errors, functions 5 / 72, digest `217d8e6a`. Mutation check 14/14 killed (`mutate-r9.mjs`). No app, function or migration changed. Remaining: R9b on the owner's go signal. The exit gate is unmet and cannot be met by R9a.

### R10 — Storm drill, release and recovery runbook
- Rollout flags, model/ingestion health indicators, privacy-preserving telemetry; preparedness and recovery instructions; acceptance evidence and feature documentation.
- **Split into R10a (closure-only release: rollout flags, runbook and documentation, device and drill evidence) and R10b (model-gated: health indicators, sensor-penalty and exclusion flags); see the status block.**

**Verification:** 72-hour simulated Android outage; real-device location matrix; closure/bridge/center changes during active use; connected/local route agreement for identical snapshots; p95 local ≤ 2 s; connected ≤ 3 s under documented pilot load; Android map usable within 5 s of cold start without waiting for GPS; CPU, memory, storage budgets within limits.
**Exit gate:** all required evidence passes; rollout and rollback rehearsed.

**Status (2026-10-15): Partially complete — R10a code, runbook and field protocol done and verified automatically; R10a device and drill evidence pending a physical phone and DRRM; R10b (model-gated) paused by the owner until the PAGASA data and R9b. Exit gate not met.** Evidence: `plans/evidence/resident-drrm-routing/r10-release/README.md`; runbook `plans/Resident_DRRM_Routing_Release_Recovery_Runbook.md`; field protocol `plans/evidence/resident-drrm-routing/r10-release/field-protocol.md`.

**Split (owner, 2026-10-15).** **R10a** is the closure-only release: rollout flags, runbook and documentation, and the device and drill evidence; it goes ahead once a physical phone and DRRM are available. **R10b** is model-gated: model/ingestion health indicators and the sensor-penalty / exclusion flags, after the PAGASA data and R9b. Before R10a's drill is worth running, DRRM must confirm the **five remaining centers' entrances**; otherwise most of the list is unroutable during the drill (hosted state: two centers routable, five not).

**Dependency split (owner Q&A, 2026-10-15).**

- **Not model-gated** (need a physical phone, DRRM drills or hosted access only): 72-hour simulated Android outage; real-device location matrix; closure/bridge/center changes during active use; connected/local agreement; p95 and budget measurements; cold-start map within 5 s; rollout flags and rollback rehearsal for closure routing; preparedness and recovery instructions.
- **Model-gated** (stay pending until R9b): enabling sensor penalties, BFS advisory or exclusion for residents; storm drills that rely on live model output; model-health indicators showing real (not `unavailable`) status.
- A closure-only release is complete only when its own evidence passes; it must not describe itself as weather-aware.

| R10 item | Part | Status |
|---|---|---|
| Rollout flag: connected routing kill switch | R10a | Done in code — function secret `EVACUATION_ROUTE_ENABLED` (unset/`true` on, `false` or any other value pauses); `503 service_disabled` before any database work; read per request; clients map it to their own wording (Android keeps the labelled on-phone route, web calculates nothing). Not set or exercised on hosted (owner-attended). |
| Rollout flag: Android packs | R10a | Documented, no new code: the area's active graph version plus the pack bundled in the build; no remote revoke exists (R6 decision), and a server switch never revokes offline data. |
| Rollout flags: sensor penalties, BFS advisory/exclusion | R10b | Off by construction (`DEFAULT_ACTIVATION`, R9a); nothing reads them. Enabling needs DRRM acceptance and R9b. **Paused.** |
| Runbook, rollback and recovery, preparedness instructions, feature documentation | R10a | Done — `plans/Resident_DRRM_Routing_Release_Recovery_Runbook.md`. |
| Privacy-preserving telemetry | R10a | Decision recorded: fixed event names only, platform invocation counts for success, no client analytics, no per-request success line (runbook section 6). No new pipeline built. |
| Model/ingestion health indicators | R10b | **Paused** (needs real `flood-shadow` runs). |
| Connected/local route agreement for identical snapshots | R10a | Automated done (25 origins, with and without a closure, in `handler.test.ts`); on-device (Hermes) check **pending**. |
| Real-device location matrix, 72-hour outage, changes during active use, drill | R10a | **Pending** physical phone and DRRM — exact steps in `field-protocol.md`. |
| p95 local ≤ 2 s, connected ≤ 3 s under pilot load, cold start ≤ 5 s, budgets | R10a | **Pending** on a physical phone and the deployed function; the load probe (`load-probe.mjs`) and steps exist. Emulator and local-runtime figures from R5/R6 stay as earlier evidence. |
| Rollout and rollback rehearsed | R10a | Switch verified in the real edge runtime locally; rehearsal on the deployed function **pending** owner authorization. |

**R10 decisions and discrepancies**

- **Kill switch is a function secret, not a database flag.** Supabase documents that secrets apply without a redeploy, so nothing needs a migration, a snapshot-schema change or an admin page, but a flip leaves no application-level audit row. A database flag would let administrators flip it with an audit row; revisit only if DRRM must be able to pause without the developer (that would be `0129` or the next free prefix).
- **Fail-safe direction:** an unrecognised value pauses and logs `rollout_flag_invalid`, so a typo meant to pause can never leave routing silently on. The cost (a typo pauses emergency routing) is bounded because Android keeps routing on the phone and the paused wording says why.
- **`service_disabled` is a new service error code** in the shared contract and client wording; the Android and web screens needed no change (they print `describeConnectedFailure`).
- **Graph rollback has no admin-web control:** only activation of the bundled version is offered. Re-registering an older version with `p_activate` works through the RPC but is refused while an active closure lacks a mapping to it (documented in the runbook).
- **No migration in R10;** `AGENTS.md` ("last pushed 0094") remains stale; the repository is at `0128`.
- **Telemetry scope:** the owner's R10a/R10b split did not assign "privacy-preserving telemetry"; it was treated as not model-gated and met with fixed event names plus platform counts. Say so if a richer pipeline is wanted.
- **Stand-in runtime caveat:** the local edge-runtime checks used a stand-in main service whose first worker booted in 171–203 s (Docker bind mount); they verify the switch only. R5 remains the cold-start evidence.
- **Out of scope, noticed:** the hosted rate-limiter client-address header is still unverified (R5 item); admin-web has no control to roll back to an older graph (the RPC works but is refused while an active closure lacks a mapping to it); Android `tsc` reports 3 typed-route complexity errors in `external-link.tsx` (unmodified, other session's types).

**Open actions to finish R10a** (none is authorized or started):

1. DRRM confirms the five remaining centers' locations and entrances (precondition P1 of the field protocol).
2. Owner authorizes a hosted rehearsal of `EVACUATION_ROUTE_ENABLED` and the pilot-load probe.
3. Developer and DRRM run `field-protocol.md` on a physical phone and record each result.

*Progress note, 2026-10-15 (R10a):* Baseline: `packages/shared` vitest 34 files / 524 pass, `tsc` 5 pre-existing errors (`id-evidence.ts` ×2, `service-catalog.test.ts` ×3), `supabase/functions` 5 files / 72 pass. After: shared 34 / 525 pass (+1), same 5 `tsc` errors; functions 5 / 76 pass (+4: flag parsing, paused path, resume without restart, 25-origin connected/local agreement); handler and test `tsc` 0 errors; Android `vitest` 14 / 126, `tsc` 3 errors, all in the unmodified `external-link.tsx` (typed-route complexity; not caused by this work, no Android baseline taken before editing); web `tsc` 0 errors. Mutation check: removing the pause check fails 2 tests. Real supabase-edge-runtime 1.76.2 (stand-in main service, dummy upstream): flag `false` and a mistyped value (`off`, logged `rollout_flag_invalid`) → `503 service_disabled`; flag unset → request proceeds past the switch (dummy upstream: `503 conditions_unavailable`). Nothing deployed, no secret set, no migration, no hosted write. Remaining R10a: the field protocol on a physical phone with DRRM, after the five centers' entrances are confirmed; hosted rollback rehearsal. R10b: paused.

## 6. Completion evidence and release rules

Maintain evidence under `plans/evidence/resident-drrm-routing/`: baseline, fixture results, migration checks, device matrix, performance measurements, model reports, storm-drill outcomes.

For every phase record: what changed and which invariants it verifies; actual commands, runtime versions, device/browser identifiers; passed scenarios, failures, corrections, remaining external dependencies; whether findings are automated, simulated or field-observed.

Run shared routing tests, affected workspace type/lint/build checks and function tests as appropriate. Test meaningful failure modes; avoid tests that merely restate implementation steps.

Separate flags control connected routing, Android packs, sensor penalties and BFS exclusions. A server kill switch does not revoke already-offline Android data.

Current mapping (R10a): connected routing = function secret `EVACUATION_ROUTE_ENABLED`; Android packs = the area's active graph version plus the bundled pack (no remote revoke); sensor penalties and BFS advisory/exclusion = `DEFAULT_ACTIVATION` stages in `model-activation.ts`, all off and read by nothing yet (R10b). Procedure: `plans/Resident_DRRM_Routing_Release_Recovery_Runbook.md`.

The final release must preserve known restrictions, state the age of its information, and provide a usable outcome when location, connectivity, data or routing fails.

## 7. Previously open matters — now resolved

The four earlier open items are settled in the "Resolved decisions" table at the top (cell size, staged penalties/exclusions, data ownership, iOS deferred). What remains are external actions, not design choices:

| Action | Owner | If it does not happen |
|---|---|---|
| Obtain coordinates and current Alert/Alarm/Critical levels for the PAGASA stations nearest San Mateo (Table 1: San Mateo-1, Montalban, Nangka, Rodriguez), and confirm real update cadence | Developer | Stage 2 and BFS stay off; closure routing ships. **State (2026-10-15): paused by the owner.** Academic request letter drafted (to PAGASA, via the Administrator, attention HMD Chief); signatories and group details being completed; not yet sent. Public values read once on 2026-10-15 match Table 1 but are unverified (evidence snapshot). Resume when PAGASA replies. |
| Provide or review past flood extents, closure logs and photos for Ampid I; verify bridge/road closures through admin-web | Barangay DRRM | R9 has no ground truth; stage 4 cannot start. |
| Request a licensed DEM of adequate vertical accuracy (candidates to check: NAMRIA IfSAR, Project NOAH/LiDAR products — availability and licence unconfirmed) | Developer | BFS limited to shadow/advisory at best. |
| Confirm the t(e) bound and Table 1 values visually against the PDF | Developer (R0) | Constants not committed. |
| Supply a physical Android phone for the location matrix | Developer | R1/R10 remain pending. |
| Confirm the location, entrance and availability of the five remaining centers (hosted: two routable, five not) | Barangay DRRM | R10a drill is mostly unroutable; run nothing until done. |
| Authorize a hosted rehearsal of the connected-routing pause switch and a pilot-load run of `load-probe.mjs` | Owner | R10a rollback and the 3 s load target stay unverified on the deployed function. |

**RRL licence:** CC BY-NC 4.0. Keep the citation, and note the non-commercial terms if Barangayan is ever distributed commercially.
