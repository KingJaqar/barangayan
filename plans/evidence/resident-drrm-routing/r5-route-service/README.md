# R5 — Connected route service

Recorded 2026-10-13 for `plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md`, phase R5. Every result below came from a command run on that date. Findings are **automated** (unit tests, pgTAP) and **local runtime** (the real `evacuation-route` function in supabase-edge-runtime 1.76.2 with the CLI's worker limits, against a disposable seeded database). **Nothing was deployed and nothing was applied to the hosted project.**

## What changed

| File | Change |
|---|---|
| `packages/shared/src/lib/evacuation-route-service.ts` (new) | Service contract, runtime import-free (type-only `.ts` import of the core): `RouteServiceRequest` + `parseRouteServiceRequest` (strict keys, id/graph-version patterns from 0113, ≤ 200 avoided segments, segment ids require their graph version), `parseRouteConditionsSnapshot` (zod-free parser of the 0113 snapshot fields routing reads), `selectRouteConditions` (active graph only, client's newest revision, every closure mapped; closure-only conditions), response types (`RouteServiceSuccess`, `RouteServiceProvenance` with graph SHA-256, OSM time, attribution, conditions times, `modelStatus: 'unavailable'`; `RouteServiceError` codes). |
| `packages/shared/src/lib/evacuation-route-service.test.ts` (new) | 44 tests. |
| `supabase/functions/evacuation-route/handler.ts` (new) | Runtime-agnostic handler: CORS, POST only, bounded body read (16 KiB, declared or streamed), validation, pack verification (`loadRoutingPack`: manifest SHA-256 and byte count of `graph.json`, graph version, `prepareRoutingGraph`), graph-version check, per-address rate limit (fail-open, reported), snapshot fetch/parse/selection, `planEvacuationRouteAsync` with profile `ampid-fine`, cooperative yields, 1 s compute deadline and client-disconnect cancellation, error mapping, `Cache-Control: no-store`. |
| `supabase/functions/evacuation-route/index.ts` (new) | Deno entry: bundled pack as JSON modules, PostgREST RPC calls (4 s upstream timeout; snapshot with the anon key, limiter with the service key), HMAC-SHA-256 of the client address, 300 requests/minute/address, fixed-name error events. |
| `supabase/functions/evacuation-route/handler.test.ts` (new) | 27 tests on the real Ampid I pack. |
| `supabase/migrations/0114_routing_rate_limits.sql` (new) | Private `barangayan_private.routing_rate_limits` (hash, one-minute window, count; RLS on, no API-role privileges); `public.consume_routing_rate_limit(hash, limit)` (security definer, service_role only, atomic upsert, prunes finished windows under a try-advisory-lock, returns seconds to wait). |
| `supabase/tests/routing_rate_limits.test.sql` (new) | 19 pgTAP assertions. |
| `supabase/config.toml` | `[functions.evacuation-route] verify_jwt = false` (public emergency routing; invariant 9). |

No new dependencies. No app file changed. The routing core (`evacuation-routing.ts`) is unchanged (R2 digest still `217d8e6a`).

## Verification

### Checks (baseline → after)

| Check | Baseline | After |
|---|---|---|
| `npx vitest run` (packages/shared) | 28 files / 365 pass | 29 files / 409 pass |
| `npx tsc --noEmit -p .` (packages/shared) | 0 errors | 0 errors |
| `npx vitest run supabase/functions` (repo root) | 1 file / 11 pass | 2 files / 38 pass |
| `npx tsc -p plans/evidence/resident-drrm-routing/r5-route-service/tsconfig.handler.json` (handler + tests; no tsconfig covers `supabase/functions`) | — | 0 errors (an injected type error is reported, so the check is effective) |
| `npx tsc --noEmit` (apps/resident-web, apps/resident-android-mobile) | 0 errors | 0 errors |
| R2 digest (`runtime-digest.ts`, Node) | `217d8e6a` | `217d8e6a` |
| SQL suites on `r5_disposable` (full clone, 0110–0114) | — | all pass incl. `routing_rate_limits` 19/19 and `routing_conditions` 81/81; `agency_sla` stops at `cron.job` (pre-existing: no `pg_cron` in clones, as in R4) |

Lint: no app file changed and neither `packages/shared` nor `supabase/functions` has a lint target; app lint baselines are unaffected.

Logs: `baseline_*.log`, `after_*.log`, `sql_suite.log`, `routing_rate_limits.test.log`, `mutation.log`.

### Automated tests

- **Request contract (shared):** defaults; all fields; copies inputs; out-of-range coordinates left to the core (`invalid_origin`); 18 rejected shapes (unknown keys, string coordinates/accuracy, missing/negative/fractional revision, malformed graph version and ids, > 200 avoided ids, segment ids without a graph version, negative conditions revision); exactly 200 avoided ids accepted.
- **Snapshot parsing:** routing fields of a complete 0113 snapshot; the zod-free parser and `routingConditionsSnapshotSchema` accept the same valid snapshot and both reject 10 malformed variants; unmapped closures stay `null`.
- **Selection:** closure-only conditions (no readings, traffic or model exclusions); overlapping closures merged; `registered` / `unregistered` / `none` graphs and another graph version refused (`graph_not_active`); an older snapshot than the client's revision refused (`snapshot_outdated`); `null` or unknown closure edges refused (`closures_unmapped`); empty closure list = no reported closures.
- **Handler (real Ampid I pack):** pack verified against its manifest; tampered graph bytes, wrong manifest version and missing manifest entry rejected; client address precedence; CORS preflight; 405 for GET (origins never in URLs); 413 by declared and streamed size; 400 for malformed JSON, invalid UTF-8, bad shapes and 201 avoided ids; 409 for another graph version before any database call; one 200 response with best route, `shortest: null` (closure-only, weight = distance), all four centers with walking distances (Ampid 1 Elementary unreachable, R3 finding 2), route provenance and service provenance; a closure on the route reroutes on the newer revision; local avoidance applied; unknown avoided id → `restrictions_unmapped`; selected center; `outside_coverage`, `invalid_origin`, `center_unavailable`; closures around the origin → `no_route_within_coverage` without any geometry (invariant 7); 24 parallel requests equal the sequential ones; 429 with `Retry-After`; limiter failure → route still served and `rate_limiter_unavailable` reported; no address → not limited; conditions unavailable or malformed → 503; outdated / inactive / unmapped → 503; duplicate centers → 503 `invalid_conditions`; pack failure → 503; compute deadline → 503 `deadline_exceeded`; client abort → 499 and the search stops after the first chunk; the handler never writes to the console and reports only fixed event names.
- **Rate limiter (pgTAP, `routing_rate_limits.test.sql`):** anon / authenticated cannot count or read; service_role reaches counters only through the function; allowed within the limit, 1–60 s wait over it, separate clients; raw addresses, uppercase or missing hashes and bad limits refused; refused requests still count; only hash, window and count stored; finished windows pruned.
- **Mutation check** (`mutation.log`): 8 TypeScript mutants (drop unmapped closures, route on a non-active graph, ignore client revision, ignore the limit, fail closed on limiter error, ignore client disconnect, skip graph hash, accept other graph versions) each fail 1–4 tests; 5 SQL mutants (no increment, never refuse, no pruning, accept any hash, grant to API roles) each fail 1–5 assertions. Files restored byte-for-byte; the original SQL function passes again.

### Real runtime (local)

Environment, all removed afterwards:

- `r5_disposable`: full clone of the local dev DB + `0110`–`0114` (SQL suites, mutation check).
- `r5_seed`: schema-only clone + `0110`–`0114` + `supabase/seed.sql`. A test administrator registered and activated the bundled graph `ampid-1@2026-10-12#fc7101b6227d` and set the four seeded centers' entrances to the R3 proposed nodes through the 0113 RPCs; Civic Center availability `available`.
- PostgREST `v14.5` container on `r5_seed` (local stack settings), a test-only `/rest/v1` proxy, and an edge-runtime `v1.76.2` container started exactly like `supabase functions serve` (the CLI's main service: 256 MB memory, 1 s soft / 2 s hard CPU per worker) with `SUPABASE_URL` pointed at the proxy.
- First, through the normal local stack (`supabase functions serve`, dev DB without the 0113/0114 RPCs): OPTIONS 204, GET 405, invalid body 400, and a valid request 503 `conditions_unavailable` with `rate_limiter_unavailable` / `conditions_unavailable` logged — the failure path when the database lacks the routing schema.

**In-worker probe** (`runtime-probe.ts` as temporary function `zz-r5-probe`, three fresh workers, `runtime-probe.json`; function removed afterwards):

| Measure | Result |
|---|---|
| JSON pack import (graph + manifest) | 6.1–13.2 ms |
| Pack verification (re-serialize, SHA-256, byte count) + `prepareRoutingGraph` | 13.2–23.4 ms |
| Route search, 200 origins (sync, `ampid-fine`) | p50 1.5 ms, p95 2.4–2.9 ms, max 10.5–11.2 ms |
| Worker heap after loading + 200 routes | 10.4–10.9 MB used, 14.9–15.4 MB total (`rss` reads 0 in this runtime) |

Cold-start CPU work is therefore under 50 ms and a route under 12 ms against the 1.5 s budget; memory ~15 MB against 192 MB. (Timings are wall-clock around synchronous code, an upper bound for its CPU time.)

**Service probe** (`service-probe.mts`, `service-probe.json`):

| Scenario | Result |
|---|---|
| Cold first request (5 fresh runtimes; worker boot, imports, pack check, 2 RPCs, route) | 270–314 ms end to end |
| Warm requests (125) | p50 35.6 ms, p95 59.7 ms, max 75.3 ms |
| Route correctness: service (Deno) vs core in Node on the same snapshot, 25 origins | byte-identical JSON |
| 50 parallel requests | all 200, identical to sequential results, 347 ms wall |
| Oversized body / 201 avoided ids / malformed JSON / GET with query / other graph version | 413 / 400 / 400 / 405 / 409 |
| Client revision ahead of the server snapshot | 503 `snapshot_outdated` |
| Closure published by the admin RPC (revision 12) | next route served at revision 12 and avoids the closed edge |
| Closure reopened | route identical to the original again |
| Best center set `unavailable` | routed to Malanday NHS, `centerTier: unknown`, `unknown_center_availability` warning |
| Another graph version activated by the administrator | 503 `graph_not_active`; after re-activation 200 |
| 305 requests from one address within one window (25 concurrent) | 300 × 200, 5 × 429 (`Retry-After: 27`); another address 200; stored keys are 64-hex hashes only |
| 10 requests aborted by the client after 2–11 ms | next request 200; no runtime errors |
| Logs (edge runtime 461 lines, PostgREST, database, proxy) | no coordinate-like strings; only the fixed event `evacuation-route: graph_not_active` |

No worker was terminated by the CPU or memory limits during the probe's ~560 requests.

**Deploy bundling:** `edge-runtime bundle` (image v1.76.2) of `supabase/functions/evacuation-route/index.ts` succeeds: 621,057-byte eszip including the graph and manifest JSON modules (server-side bundling cap 5 MB). Booting that eszip directly (as the main service, same environment) and requesting a route returned a route with status `ok`, so the bundled pack passes its hash check.

## Decisions and plan discrepancies

1. **Pack loading.** Supabase static files must live inside the function folder, which would duplicate `graph.json`. The function imports the pack as JSON modules from `data/routing-packs/ampid-1/pack/` instead (the CLI mounts these files, and the eszip includes them). At 621 KB the bundle is far below the 5 MB cap R0 warned about. The worker checks the graph against the manifest's SHA-256 and byte count before routing, so a pack/manifest mismatch is refused (`graph_unavailable`).
2. **Rate limit.** HMAC-SHA-256 of the client address, keyed with the function's service-role key, so stored hashes cannot be reversed by enumerating addresses from a database copy. 300 requests per minute per address: Philippine mobile carriers share public addresses (CGNAT), and during a flood many residents will request routes at once. Requests without a recognisable address are not limited, and a limiter failure fails open (reported as `rate_limiter_unavailable`), because one shared bucket or a database hiccup must not take emergency routing down. The address comes from `cf-connecting-ip`, else the first `x-forwarded-for` entry. Supabase does not document which of these the hosted gateway sets or overwrites. **Pending a hosted check**: if a client-supplied first entry survives, the limit is best-effort only.
3. **Snapshot selection.** The service routes only when its bundled graph is the area's **active** graph. A registered but inactive graph is refused (`graph_not_active`), because activation is DRRM's acceptance, and a deactivated graph may be wrong. A snapshot older than the client's newest seen revision is refused (`snapshot_outdated`). A closure without a mapping onto the graph, or one mapping to unknown edges, refuses routing (`closures_unmapped`, invariants 3 and 6). Snapshots are read per request, with no cache, so closures and reopenings take effect on the next request.
4. **Closure-only and degraded-model modes.** No sensor, traffic or model input exists before R8/R9, and the pack declares stations and terrain `unavailable`. The service therefore always runs closure-only (plan 3.8 stage 1) and reports `modelStatus: 'unavailable'`. This is the degraded-model mode: missing model data never blocks routing and is never treated as dry. With weight equal to distance, `shortest` is `null` (best = shortest). The field fills once penalties are active. Holdover restrictions and model expiry belong to R9.
5. **Response shape.** HTTP 200 is `{ route, service }`. `route` is the core `RouteResult`: ok, no route, ambiguous attachment, outside coverage, no nearby path, center unavailable, invalid origin, or unmapped avoidance. `service` carries the provenance. Any other status is `{ error, message }`: 400, 405, 409, 413, 429, 503 for service failures, and 499 when the client cancelled. `cancelled` and `invalid_conditions` from the core never appear as routes.
6. **Deadlines.** Server side: 4 s per upstream RPC, and a 1 s compute deadline with yields every 256 heap extractions. The client deadlines in plan section 4 (10 s route, 8 s conditions) belong to R7.
7. **Authentication.** `verify_jwt = false`. A resident's expired session must not block a route (invariant 9), and the function serves only public data.
8. **Migration numbering.** `0114`. `AGENTS.md` ("last pushed 0094") remains stale. The next new migration is `0115`.

## Not done (needs owner authorization or hosted access)

- Apply `0114_routing_rate_limits.sql` to the hosted project, **before** deploying the function. Without it the limiter fails open and logs `rate_limiter_unavailable` on every request.
- Deploy `evacuation-route` (`npx supabase functions deploy evacuation-route`; `verify_jwt = false` comes from `config.toml`). This also settles R0's open question about whether a real deploy bundles the outside-folder imports. The local eszip bundle suggests it will.
- After deploying, on hosted: measure cold and warm latency; confirm which client-address header arrives and that a client-supplied `x-forwarded-for` cannot replace it; confirm logs contain no coordinates. Until an administrator activates the bundled map data and sets entrances (R4 hosted note), the hosted service answers `503 graph_not_active`. That is correct behavior, not a defect.
- Client consumption (Android connected mode, web) is R7.
