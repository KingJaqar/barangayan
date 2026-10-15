# R3 — Pack builder and reviewed pilot topology

Recorded 2026-10-12 for `plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md`, phase R3. Every result below came from a command run on that date. Findings are **automated**: unit tests on a synthetic OSM fixture, plus a build and route probe on the real Ampid I OSM extract. **No DRRM review has happened yet.** The review sheet is `build/report.md`.

## What changed

| File | Change |
|---|---|
| `packages/shared/src/lib/routing-pack-builder.ts` (new, Node-only) | Overpass JSON / boundary / centers / stations validation. 150 m coverage buffer (5 m raster, outline trace, 2 m simplification, ±6 m). Pedestrian interpretation of OSM tags. Clipping to coverage at node level. Topology split at shared nodes, loop splitting and zero-length joins. Blocking barrier nodes become two dead ends. Water and wall attachment barriers, clipped geometrically. Station-to-edge 2 km tables via the core's `stationApplicableEdgeIds`. Server flood grids for `ampid-fine` and `rrl-reference` from one builder (terrain unknown). Simplified vector map. DRRM review report. Canonical serialization with manifest, SHA-256 and budget check. `mapEdgesAcrossGraphs` for stable segment mappings. |
| `packages/shared/src/lib/routing-pack-builder.test.ts` (new) | 25 tests (below). |
| `packages/shared/scripts/build-routing-pack.mts` (new) | CLI: reads inputs, writes the pack and `report.json` / `report.md` (DRRM review sheet with sign-off table). Exits 1 and writes nothing on invalid input, topology errors or a budget-ceiling breach. |
| `packages/shared/src/lib/evacuation-routing.ts` | Added exports only: `isInsideCoverage` (the router's own coverage test, so builder and router agree), `RoutingPackManifest`, `RoutingPackResource`. R2 digest unchanged (`217d8e6a`). |
| `packages/shared/tsconfig.json` | `rewriteRelativeImportExtensions: true` (allows the `.ts`-extension imports Node needs to run the CLI natively, as R2's digest script does); `include` adds `scripts/**/*.mts`. |
| `packages/shared/package.json` | Script `build:routing-pack` (`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON …`). |
| `data/routing-packs/ampid-1/README.md`, `source/centers.json`, `source/osm-extract.json` (new) | Reproducible inputs: the exact Overpass query and build command; centers transcribed from `supabase/seed.sql` (placeholders); the fetched OSM extract. |
| `data/routing-packs/ampid-1/pack/` (generated) | The real Ampid I pack: `manifest.json`, `graph.json`, `map.json`, `server/grid-ampid-fine.json`, `server/grid-rrl-reference.json`. |
| `plans/evidence/…/r3-pack-builder/build/report.{json,md}` (generated) | Real review report and DRRM sign-off sheet. |
| `plans/evidence/…/r3-pack-builder/route-probe.mts`, `route-probe.json` | Route probe over the real pack (below) and its output. |

No new dependencies. No app file changed.

## Verification

### Checks (baseline → after)

| Check | Baseline (R3 start) | After |
|---|---|---|
| `npx vitest run` (packages/shared) | 26 files / 329 pass | 27 files / 354 pass |
| `npx tsc --noEmit -p .` (packages/shared, now incl. the CLI) | 0 errors | 0 errors |
| `npx tsc --noEmit` (apps/resident-web) | 0 errors | 0 errors |
| `npx tsc --noEmit` (apps/resident-android-mobile) | 0 errors | 0 errors |
| R2 digest `node …/runtime-digest.ts` | `217d8e6a` | `217d8e6a` |

Lint: no app file changed and `packages/shared` has no lint target, so the app lint baselines are unaffected and were not rerun.

### Automated tests (`routing-pack-builder.test.ts`, synthetic 400 m fixture)

- **Graph:** accepted by `prepareRoutingGraph`; canonical id order; `[lng, lat]` order; versioned `area@osm-date#hash`.
- **Clipping:** a way running 300 m past the boundary keeps the node 50 m out (inside the margin) and drops the one 200 m out; every edge vertex lies inside coverage.
- **Topology:** split at shared nodes; a `bridge=yes layer=1` footway over a street stays unconnected and is not reported as a missing junction; a same-level street crossing with no shared node is reported; closed loops are split (no self-loops).
- **Pedestrian rules:** vehicle `oneway` ignored on a residential street; `oneway` on a footway binds walkers; `foot=no` and motorway are excluded; `access=private` is kept and listed for review; steps → `stairs`; bridges flagged.
- **Barriers:** `barrier=gate access=no` splits Luna St into two dead ends (`n11:w101:1a` / `n11:w101:1b`); a bollard passes; river, pond, multipolygon water and wall are attachment barriers; a culvert is not. A river whose only nodes are 1 km outside is clipped, not dropped (regression for a defect found while writing these tests).
- **Incomplete references:** a missing node or relation member fails the build with the exact reference.
- **Coverage buffer:** over 10,000 grid points, every point ≤ 144 m from the boundary is inside and every point ≥ 156 m away is outside; boundary-line points are inside (the Ampid 1 Elementary case).
- **Report:** centers measured against boundary and coverage; entrance proposals within 50 m (none for a far center); streets reaching no center include a one-way footpath trap, its loop, the gated stub, the overpass and two islands; a margin-only island is listed as a component with 0 inside-boundary edges but not as an Ampid street; an entrance on a margin-only group is flagged (`entranceOnBoundaryNetwork: false`); component and bridge lists; stations/terrain `unavailable`.
- **Routing on the built pack:** `planEvacuationRoute` reaches the nearest center over the expected edges (140 m); no route through the grade-separated footway or past the locked gate; the river is crossed only on the footbridge.
- **Grids and stations:** both profiles from one builder with the right cell size, all coverage inside the grid, all elevations unknown, accepted by `runFloodBfs`. Station tables equal `stationApplicableEdgeIds`. A station 5 km away gets no edges but extends the grid.
- **Reproducibility:** shuffled element order produces byte-identical files; manifest sizes and SHA-256 match the contents; the map's roads stay inside coverage.
- **Segment mappings:** unchanged → `same`; a new junction splits `w100:4-5` → `remapped` to both halves; removing junctions merges two edges → both `remapped` to the merged edge; a deleted way → `unresolved`.
- **Input validation:** malformed Overpass elements, tags, unclosed boundaries, duplicate/nameless centers, out-of-range stations.

**Mutation check** (temporary edits, file restored byte-for-byte): ignoring blocking gates (4 failures), ignoring grade in the crossing check (1), letting vehicle `oneway` bind walkers (2), dropping the margin (9), vertex-only water clipping (3).

### Real Ampid I build

- **Fetch:** the Overpass query in `data/routing-packs/ampid-1/README.md` was sent with the owner's approval. The first three attempts (`timeout:90`, two servers) got HTTP 504. The error body said the dispatcher refused the 90 s reservation ("server is probably too busy"); a tiny query succeeded at the same time. With `timeout:25` and `maxsize` 64 MiB the request returned 200: 1,099,002 bytes, OSM base `2026-10-12T13:29:57Z`, SHA-256 `4b3c6a6e…a131c6`.
- **Build** (`npm run build:routing-pack`, ~4.6 s wall time): graph `ampid-1@2026-10-12#fc7101b6227d`; 900 nodes, 1,064 walkable edges, 54.3 km of walkable way; 53 water/wall barrier lines; no incomplete references, no zero-length pieces, no same-grade crossings without a junction.
- **Budgets:** `graph.json` 436,991 B (target 1 MB), `map.json` 188,111 B, `manifest.json` 1,171 B; device pack 626,273 B (target 5 MB). Server grids: `ampid-fine` 8,428 B, `rrl-reference` 312 B.
- **Reproducibility:** a second build into another directory is byte-identical for every pack file and `report.json` (`diff -r`). Manifest SHA-256: graph `e291ec6f…`, map `a3508a88…`, grid-fine `149ea805…`, grid-reference `68ac1446…`.
- **Coordinate order and validation:** the core's `prepareRoutingGraph` accepts the real graph (it rejects swapped `[lat, lng]`, dangling geometry and length mismatches).

**Report findings (`build/report.md`, for DRRM review):**

1. **Every walkable street inside the boundary reaches at least one center** ("streets inside Ampid I that reach no center": none). The main network (899 edges, 673 inside the boundary) reaches San Mateo Civic Center, Dulong Bayan Covered Court and Malanday NHS.
2. **Ampid 1 Elementary is not on the Ampid I network.** Its seeded position (14.684583, 121.112071) is exactly the first vertex of the boundary trace, so it is a placeholder. The nearest walkable node within 50 m (`n11175955772`, 43 m) belongs to a margin-only group of service roads, so all 673 inside-boundary edges are reported as unable to reach it. The nearest node on the main network is 73 m away. DRRM must give the school's real entrance.
3. **18 margin-only groups** (0 inside-boundary edges; for example Alaska St / Alberto Drive, Amethyst / Diamond St, Gold / Narra St). These are neighbouring subdivisions whose links leave the covered area, not cut-off Ampid streets.
4. **14 bridges** (including two on General A. Luna Street, primary, 50 m each, and Daang Bakal Street) to confirm with their approaches.
5. **37 barrier nodes**, none blocking (gates without access tags are passable; 15 private gates kept passable). **81 private-access ways** kept walkable. DRRM confirms or closes them (R4).

**Route probe** (`route-probe.mts`, Node v24.13.1, proposed entrances, 671 origins on a ~44 m grid inside the boundary):

| Result | Origins |
|---|---|
| `ok` | 599 (best center: Civic Center 483, Malanday 60, Dulong Bayan 56) |
| `attachment_ambiguous` (chooser) | 39 |
| `no_nearby_path` (> 50 m from any walkable way) | 31 |
| `no_route_within_coverage` | 2 |

- Load + validate graph 13.1 ms; route p50 0.75 ms, p95 1.31 ms, max 12.4 ms. This confirms decision 5 (no spatial index). The Hermes figure is still R6.
- The two no-route origins (14.6831, 121.1258 and 14.6835, 121.1238) are inside the boundary near its eastern edge. Their nearest streets, Alberto Drive and Denmark Street, belong to margin-only groups whose links leave the 150 m margin. The router correctly refuses (no straight line). **DRRM connectivity review item:** per section 2 of the plan, widen the margin only if DRRM confirms residents there are cut off. The alternative is that the boundary trace or these private subdivision roads need correcting.

### CLI smoke runs (synthetic extract, real boundary and centers)

`node scripts/build-routing-pack.mts` with a 5-node extract against `ampid1-boundary.json` and `source/centers.json`:

- Pack written (`manifest.json`, `graph.json`, `map.json`, `server/grid-*.json`). Coverage ring 961 vertices; graph 24,737 B, mostly coverage.
- Second run byte-identical (`diff -r`), also after renaming the CLI to `.mts`.
- Missing nodes exit 1 with `missing_node:w1:n1`, `missing_node:w1:n2` and write nothing. Missing arguments exit 1 with usage.

## Decisions and plan discrepancies

1. **Clipping is node-level for routing.** An edge exists only between consecutive OSM nodes inside coverage, so ids stay OSM-derived and stable. A road segment crossing the coverage edge ends at its last inside node, within the 150 m margin and never inside the boundary proper. Water and walls are clipped geometrically, because their sparse nodes can lie far outside.
2. **Coverage buffer** is raster-traced (no geometry dependency) and accurate to ±6 m. The margin is a connectivity aid, not a legal line.
3. **Pedestrian access rules (for DRRM review, report section 4):**
   - Walkable by default: trunk to service, `road`, track, pedestrian, footway, path, steps and corridor. Cycleways and bridleways need a foot tag.
   - `foot=no` / `use_sidepath` / `access=no` exclude a way.
   - **`private` roads and gates are kept walkable and listed.** Excluding them could strand residents of gated areas during an evacuation; DRRM can close any of them through verified closures (R4).
   - Trunk roads without a foot tag and `highway=road` are listed as assumptions.
   - Barrier nodes block only when foot/access is denied, the barrier is `locked=yes`, or it is a wall/fence.
4. **Grade separation** is represented by topology: ways connect only at shared OSM nodes. The `layer` attribute (left open in R2) is not added to `RoutingEdge`; it is used only to tell "probable missing junction" apart from an over/underpass.
5. **Spatial index not added.** The core's attachment is a linear scan. On the real graph a full plan takes p95 1.31 ms in Node, against a 2 s budget, so an index would be dead data. Recheck on Hermes in R6.
6. **Edge ids** are `w<way>:<fromNode>-<toNode>`. `sourceRef` (`osm:way/<way>/<from>-<to>`) carries the way for remapping. Blocking-barrier terminals get per-side node ids.
7. **Entrances are proposals** (nearest walkable node ≤ 50 m). Real entrance points and graph-version mappings are stored in R4.
8. **Grids:** the domain is the coverage plus every verified station, padded by one cell, which approximates the station-to-barangay corridor. Elevations are all `null` (`terrain: unavailable`) until a licensed DEM exists (R8). No DEM reader was written, since the format is unknown.
9. **Pack location:** `data/routing-packs/<area>/` (inputs in `source/`, outputs in `pack/`). The repository had no prior convention; R5/R6 read from here.
10. **Node runner:** the CLI is `.mts` (always ESM). Node still prints MODULE_TYPELESS_PACKAGE_JSON for the typeless shared `.ts` sources. Adding `"type": "module"` to `packages/shared` could change how Metro/Next consume the package, so the npm script silences that single notice instead.

11. **Report clarity after the real build:** components now show how many edges lie inside the boundary, and centers show whether the proposed entrance is on the Ampid I network. Without these, margin islands and the Ampid 1 Elementary placeholder read as alarming cut-offs.

## Not done (see the plan's R3 status)

- **DRRM review and sign-off** of `build/report.md`: center locations and entrances (Ampid 1 Elementary especially), the two eastern no-route points, 14 bridges, barriers and 81 private-access ways. This is the remaining exit-gate item; it is external.
- After DRRM corrections (real center positions, any OSM fixes, any margin change), rebuild with the same command and record the new graph version.
