# R8 — Sensor ingestion and BFS shadow

Recorded 2026-10-14 for `plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md`, phase R8. Every result below came from a command run on that date. Findings are **automated** (vitest, pgTAP, mutation checks) and **local runtime** (the real `flood-shadow` function in supabase-edge-runtime 1.76.2 against a disposable database, plus Node 24.13.1 and Deno 2.9.7). **Nothing was deployed, nothing was applied to the hosted project, and no sensor source was contacted.**

The shadow model is complete as code and verified with synthetic inputs. It **cannot produce a real flood extent yet**: station coordinates and thresholds, a licensed DEM and a verified vertical datum are not in the repository (plan section 7). The phase therefore stays **pending** on input readiness; see the table at the end.

## What changed

| File | Change |
|---|---|
| `packages/shared/src/lib/flood-shadow.ts` (new) | Pure server-side core. Input parsers (`parseSensorStationSet`, `parseTerrainMetadata`, `parseSensorFeed`); RRL §7.4 validators (`validateStationReading`); immutable snapshot with a SHA-256 id (`buildSensorSnapshot`, `mergeSensorHistory`); grid eligibility (`assessFloodGridEligibility`); road compilation (`compileRoadFlooding`); the shadow run and report (`runFloodShadow`). Calls the R2 `runFloodBfs` unchanged. |
| `packages/shared/src/lib/flood-shadow.test.ts` (new) | 57 tests. |
| `packages/shared/src/lib/evacuation-routing.ts` | Adds `floodGridCellsOnPolyline` (grid-line DDA, same frame as `floodGridCellAt`). No existing function changed; the R2 digest is still `217d8e6a`. |
| `supabase/migrations/0120_flood_shadow_runs.sql` (new) | `public.flood_shadow_runs` (RLS: administrators read their own area; no write privileges for any API role) and two service-role-only RPCs: `publish_flood_shadow_run` (per-area advisory lock; refuses a graph that is not the area's active one, a run not newer than the newest stored, a future run, and any report that does not match its identity or claims influence; idempotent for a repeated snapshot; keeps the newest 500 per area) and `get_flood_shadow_history`. |
| `supabase/tests/flood_shadow_runs.test.sql` (new) | 37 pgTAP assertions. |
| `supabase/functions/flood-shadow/{handler,index}.ts` (new) | Scheduled shadow run: service-role bearer only; verifies the bundled graph and grid against the manifest; reads the feed from the owner-configured `FLOOD_SENSOR_FEED_URL` (HTTPS, 5 s, 256 KB, no redirects); merges stored history; builds the snapshot, runs the model, publishes. |
| `supabase/functions/flood-shadow/handler.test.ts` (new) | 20 tests on the real Ampid I pack. |
| `data/routing-packs/ampid-1/source/{sensor-stations,terrain}.json` (new) | Unverified, empty inputs (`verification: null`, `stations: []`, `terrain: null`). README updated. |

No new dependencies. No app file changed (Android, web and admin-web untouched). `config.toml` is unchanged: the function keeps the default `verify_jwt = true` and additionally checks the service-role key itself.

## Behavior against the plan

| Plan requirement | Where |
|---|---|
| One immutable accepted sensor snapshot | `buildSensorSnapshot` deep-freezes; id = SHA-256 of canonical content (config version, evaluation time, source, per-station observations). |
| Verify units, timestamps, threshold ordering, datum | Threshold order and coordinates at parse; datum text equality per reading and against the terrain datum; timestamps (future skew ≤ 60 s, stale after 10 × declared interval). |
| RRL §7.4 validators; rejected = unknown | ±5 m range, 2 m change per window scaled to the declared cadence, robust-outlier test. Rejected, stale and missing readings are `unknown`, never 0. |
| Seeds = stations ≥ Critical in the grid; others ignored and reported | `runFloodBfs` (R2) with the report mapping its reasons to `out_of_grid`, `stale`, `flagged`, `missing`, `below_critical`, `invalid_position`, `unverified_input`. |
| Missing terrain, datum or stale readings = unknown | Ineligible grid → `modelStatus: unavailable`, no BFS; terrain-unknown cells stop the front and mark roads `unknown`; unknown stations → `degraded`. |
| Road flooded when full geometry crosses a BFS cell; decks separate | `compileRoadFlooding`: any touched flooded cell; bridge decks are never flooded by cells and are listed (`bridgeDeckEdgeIds`, `bridgeDecksOverFloodedCells`). |
| Model health and unknown coverage | `modelStatus` (`unavailable` / `degraded` / `ok`), `eligibility`, `unknownTerrainCells`, `unknownFrontierCells`, `roads.unknownEdgeIds`, `sourceStatus`, `inputObservedAt`. |
| Residents unaffected | `residentInfluence: 'none'` is part of every report, and the database refuses any other value. Nothing reads `flood_shadow_runs` except administrators. |
| Superseded computations cannot publish | Per-area lock + newest-evaluation and active-graph checks inside `publish_flood_shadow_run` (pgTAP, real parallel sessions). |

## Verification

### Checks (baseline → after)

| Check | Baseline | After |
|---|---|---|
| `npx vitest run` (packages/shared) | 29 files / 420 pass | 30 files / 477 pass (+57) |
| `npx tsc --noEmit -p .` (packages/shared) | 2 errors (`id-evidence.ts` `FileReader`, another session's file) | the same 2 errors, none new |
| `npx vitest run supabase/functions` (repo root) | 3 files / 48 pass | 5 files / 72 pass (+20 flood-shadow; the other 4 came from concurrent work) |
| `npx tsc -p r8-shadow/tsconfig.handler.json` (handler + tests) | — | 0 errors; an injected type error is reported |
| `npx tsc --noEmit` (resident-android-mobile, resident-web) | 0 errors | 0 errors |
| `npx vitest run` (resident-android-mobile) | 14 files / 126 pass | 14 files / 126 pass |
| R2 digest (`runtime-digest.ts`, Node) | `217d8e6a` | `217d8e6a` |
| pgTAP `flood_shadow_runs.test.sql` on a full clone of the dev DB + `0118`–`0120` | — | 37/37 |

Lint was not rerun: no app file changed and neither `packages/shared` nor `supabase/functions` has a lint target.

### Automated tests (what they prove)

- **SHA-256** matches Node's for empty, ASCII, multi-block and non-ASCII input.
- **Cell walk** equals an exact segment-box oracle on 200 random lines; direction-independent; reports lines leaving the grid.
- **Parsers** refuse unordered or equal thresholds, non-finite coordinates, duplicate ids, zero intervals, unreviewed provenance, non-ISO times, non-numeric levels, oversized feeds, and a baseline that would reject genuine Critical readings (finding below).
- **Validators** each reason alone (datum, range inclusive at ±5 m, stale at exactly 10 intervals, future, missing, cadence and baseline unverified, jump with window scaling, outlier but not a steady rise); other stations' and later history ignored.
- **Snapshot** deterministic and order independent, changes with readings and time, newest duplicate wins, frozen, failed source → all unknown.
- **Eligibility** every reason, all collected at once; exactly-tolerated RMSE accepted; tightest station span is the yardstick; pack/station mismatch refused.
- **Roads** a clipped corner floods, decks never, unknown over missing terrain or off the grid, edge-order independent; every real Ampid I edge compiles.
- **Shadow run** ridge blocks the front; multiple seeds with different surfaces give the union independent of input order; stale / flagged / missing / out-of-grid stations reported and the model degraded; unknown terrain stops the front; byte-identical report and hash for equal inputs; unavailable while terrain is missing or the set is unverified; unusable grid reported, not thrown.
- **Function** 401/405 before any work; honest unavailable run when the source is unconfigured, failed or invalid; stored history drives the temporal check; no history → 503 and no publication; rejected publications (superseded, graph not active) are 200 results, not faults; no readings or payloads in `reportError` or responses; bounded, HTTPS-only, no-redirect feed fetch.
- **pgTAP** only the service role publishes and only through the function; anonymous, administrator and service-role direct inserts refused; publish, duplicate, superseded (older and equal-time), newer, inactive graph, future; identity mismatches (area, graph, snapshot, status, influence) and bad ids refused; unknown area `P0002`; history shape and limits; administrator scope (own area, other barangay, resident); 500-run retention keeps the newest.

### Mutation checks

`mutate.mjs`: 16 TypeScript mutants (stale, range, jump and outlier checks removed; unknown treated as dry; decks flooded by cells; DEM accuracy and datum rules removed; snapshot id ignoring time; unknown edges unreported; model never degraded; baseline rule removed; no authorization; run without history; feed failure ignored; grid hash unchecked) — **16/16 killed**. `sqlmut.mjs`: 8 SQL mutants — 7 killed. The survivor (administrator policy without its own `barangay_id` clause) is equivalent: the sub-select reads `routing_areas`, whose own policy already scopes it; removing the whole sub-select is killed. The original migration was restored and passes 37/37.

### Real runtime (local)

Environment, all removed afterwards: database `r8_disposable` (full `pg_dump` clone of the dev DB, then `0118`–`0120`; the dev DB was only read), PostgREST `v14.5`, a `/rest/v1` proxy, edge-runtime `v1.76.2` with the CLI's worker limits (256 MB, 1 s soft / 2 s hard CPU). A test administrator activated the bundled graph through the `0113` RPC. Scenarios A, B, D, E use a scratch copy of the code with eligible inputs (scratch station set, terrain 0.2 m RMSE, synthetic elevations, three stations); the shared modules and `handler.ts` are byte-identical copies, only `index.ts` has an inline feed and a fixed clock.

| Scenario | Result |
|---|---|
| A: station at Critical, eligible inputs | 200 `published`, `degraded`, 817 ms (cold worker) |
| B: second station reading 31 m (baseline 17 m) | 200 `published`; the stored report lists it `unknown` (`out_of_range`, `jump` against A's stored reading) |
| C: **real bundled inputs**, real clock | 200 `published`, `unavailable`, `sourceStatus: unconfigured`, 694 ms |
| D, E: A and B again | 200 `duplicate` (same snapshot id) |
| F: a different snapshot older than C | 200 `rejected` / `superseded`; nothing stored |
| Wrong bearer / GET | 401 / 405 |
| Stored vs Node | Report hashes of A and B equal the Node run of the same inputs (B with A's readings as history) |
| Concurrency (10 real sessions, one area) | Arrival oldest→newest: all 10 published; random arrival: 1 published, 9 superseded; never an older run after a newer one |

**Cross-runtime digest** (`digest.ts`, three feeds: critical, flagged, two seeds): Node 24.13.1 and Deno 2.9.7 produce identical report hashes (`f37ba2a6…`, `d818ffeb…`, `4d8cec36…`) and counts (592 / 592 / 1,036 flooded cells; 284 / 284 / 661 flooded edges).

**Budgets** (`budget.ts`, 300 runs, 1,665 cells, 1,064 edges, two seeds; preprocessing = snapshot + eligibility, traversal = BFS, compilation = road intersection):

| | preprocessing p50 / p95 | BFS traversal p50 / p95 | road compilation p50 / p95 | whole run p50 / p95 / max | pack load | heap |
|---|---|---|---|---|---|---|
| Node 24 | 0.10 / 0.20 ms | 0.10 / 0.36 ms | 0.78 / 1.27 ms | 2.9 / 3.7 / 13.1 ms | 24 ms | 28 MB |
| Deno 2.9 | 0.10 / 0.18 ms | 0.07 / 0.17 ms | 0.63 / 1.01 ms | 2.5 / 3.3 / 16.0 ms | 66 ms | 30 MB |

Plan budgets are CPU < 1.5 s and memory < 192 MB. In the edge runtime a whole request (worker, two RPCs, publish) took 0.4–0.8 s, dominated by the PostgREST round trips.

## Decisions and plan discrepancies

1. **No live PAGASA adapter.** The PMT-FFWS site did not verify its certificate from this machine, and TLS checks were not bypassed. The PAGASA hydrological PDF found in search carried a link to an unverifiable endpoint. Access terms, format, cadence and station coordinates are therefore unverified. The "permitted source adapter" is a reviewed-feed contract (`parseSensorFeed`) fetched from an owner-configured HTTPS URL; any relay the owner is permitted to run can implement it. Until a URL is configured the function publishes an honest `unavailable` run.
2. **RRL range check can discard real Critical readings.** The ±5 m window around a *historical baseline* excludes a Critical reading whenever Critical lies more than 5 m above that baseline, which is exactly what BFS needs. The station parser refuses such a baseline (`baseline_excludes_critical`), so the validator stays literal to the RRL while the configuration cannot silently drop Critical. PAGASA/DRRM must say what "historical baseline" means for each gauge. For reference, the 2018 PAGASA bulletin found in search lists Montalban at 17.26 / 18.26 / 19.26 m, not Table 1's 22.4 / 23.0 / 23.6 m, so the thresholds in the paper cannot be hard-coded unverified.
3. **Temporal window.** "2 m within 30 s" is scaled to the declared cadence: one window = max(30 s, interval), with the allowance growing linearly for longer gaps. A genuine 2 m rise within one 10-minute window will flag a reading `unknown`; the next consistent reading is accepted. Confirm with PAGASA.
4. **Provisional constants** (the RRL and plan give none): outlier robust-score 3.5 with a 1 m deviation floor and 6+ history points; DEM vertical RMSE must be ≤ 0.25 × the smallest Alert→Critical span. Both are shadow-only and live in `flood-shadow.ts`; DRRM/owner confirm before stage 3.
5. **Eligibility also requires** station ids equal to those the pack was built with, so the 2 km edge table and the station set cannot drift.
6. **Lease.** The plan's "area lease" is a transaction-scoped advisory lock inside the publish RPC (a run takes milliseconds); the input-version check is the evaluation-time and active-graph comparison under that lock.
7. **Source or history failure.** A failed or invalid feed publishes an `unavailable` run (visible feed outage). A missing history aborts the run (503): readings cannot be validated without it.
8. **Edge-flood status when unavailable.** With an ineligible grid no BFS and no road compilation run, so road lists are empty and `unknownTerrainCells` equals the grid size.
9. **Migration numbering.** `0120`; `AGENTS.md` ("last pushed 0094") remains stale. Other sessions have since added `0121`–`0124`; the next new migration is `0125`, or whatever follows the highest prefix.
10. **Not exported from the shared index**, like the routing core: only Edge Functions and tooling use it.

## Input readiness (the exit gate's "documented input readiness")

| Input | State | Needed from | Effect while missing |
|---|---|---|---|
| Station coordinates, Alert/Alarm/Critical levels, baseline, datum, interval | **Missing** (`sensor-stations.json` empty, unverified) | Owner/developer, verified against PAGASA | Eligibility `no_stations`, `stations_unverified`; model unavailable |
| Real feed access and cadence | **Unverified** | Owner (PAGASA terms, or a permitted relay) | `sourceStatus: unconfigured`; every reading unknown |
| Licensed DEM resampled to the 50 m grid with documented vertical RMSE | **Missing** (all 1,665 cells unknown); the DEM-to-grid resampler is not built (format and licence unknown) | Owner (NAMRIA IfSAR / Project NOAH, unconfirmed) | `terrain_missing`, `no_known_elevation`; BFS never runs |
| Verified vertical datum, equal for gauges and DEM | **Missing** | Owner/PAGASA | `datum_mismatch` / `terrain_missing` |
| DRRM confirmation of `can_flood` = elevation ≤ surface (D3) | **Open** | DRRM | Stage 3 stays off |
| Real cadence for the 30 s check and the staleness rule | **Open** | PAGASA | `cadence_unverified` keeps readings unknown |
| Scheduling | **Not configured** | Owner | Not authorized in this phase |

`shadow-report.real-inputs.json` is the report for the bundled real inputs (reproducible: a second build is byte-identical).

## Not done (needs owner authorization or external data)

- Apply `0120_flood_shadow_runs.sql` to the hosted project, deploy `flood-shadow` (`npx supabase functions deploy flood-shadow`), set `FLOOD_SENSOR_FEED_URL` only once a permitted, reviewed feed exists, and schedule it (for example `pg_cron` + `pg_net` with the service-role key, or the platform scheduler) at the source's cadence.
- Fill `sensor-stations.json` and `terrain.json` after review, rebuild the pack with `stations.json` so the 2 km tables exist, and have an administrator activate the new graph version through the existing R4 flow.
- Hosted checks after deploy: cold/warm latency, that logs carry only fixed event names, and an administrator read of `flood_shadow_runs`.
- Model-health and shadow-versus-advisory comparison views for administrators (stage 3) are R9/R10 work; the table is readable under RLS for them.
