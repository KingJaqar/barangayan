# Resident evacuation routing: release, rollback and recovery runbook (closure routing)

Prepared 2026-10-15 for phase R10a of `plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md`. This is a reviewable procedure, **not authorization** to deploy, set secrets, apply migrations or change hosted data. Every hosted action below is owner-attended.

**What this release is.** Closure-based walking routes inside Barangay Ampid I: DRRM-verified closures and center availability are authoritative hard blocks, Dijkstra picks the best and shortest walking path, and Android keeps working offline. **It is not weather-aware.** Nothing in a route reacts to river levels; `modelStatus` is `unavailable` and every model stage is off (plan sections 0 and 3.8). Do not describe this release as flood-aware or weather-aware in the app, announcements or training material. Model-gated work (R10b) is not part of it.

## 1. Rollout controls

Plan section 6 requires separate switches. They are independent; none of them revokes what a phone already holds.

| Control | Where it lives | Default | What it does | What it does not do |
|---|---|---|---|---|
| **Connected routing** (kill switch) | Edge Function secret `EVACUATION_ROUTE_ENABLED` on the `evacuation-route` function | unset = on | `false` makes the service answer `503 service_disabled` before any database work. Android falls back to its labelled on-phone route; web shows the paused wording and calculates nothing (invariant 8). Any other value (typo such as `off` or `FALSE`) also pauses and logs `rollout_flag_invalid`. Supabase applies a changed secret without a redeploy, so the function reads it on every request. | Does not touch conditions publication, the installed Android pack or stored closures. Android routing on the phone keeps working. |
| **Conditions publication** | Admin-web Evacuation Routing: publish and reopen closures, center availability and entrances | n/a | The authoritative hard block. Reaches phones on their next conditions refresh (30 s while visible). | A phone offline keeps the last snapshot and labels its age. |
| **Android packs** | Graph version activated for the area (admin-web "activate map data", RPC `register_routing_graph_version`) plus the pack bundled in the installed build | active graph per area | A phone activates a newer bundled graph only from a snapshot in which the area has activated it and every closure and avoidance mark maps onto it; otherwise activation is deferred and the current pack stays. | There is **no remote revoke**: a pack already on a phone stays until a new build replaces it. Pack download from a server is not built (R6 decision). |
| **Sensor penalties** (stage 2) | `DEFAULT_ACTIVATION` in `packages/shared/src/lib/model-activation.ts` (`stages.sensor`) | off | Nothing reads it yet. | Cannot be enabled without a DRRM acceptance reference and date (the configuration validator rejects it). |
| **BFS advisory / exclusion** (stages 3, 4) | same configuration (`advisory`, `exclusion`) | off | Nothing reads it yet. | Stages enable only in order, each with a DRRM acceptance record (plan 3.8). Stage 4 needs R9b evidence that does not exist. |

Sensor and BFS stages are listed so nobody looks for a missing switch: they are off by construction, and the first release ships with them off. Enabling any of them is R10b, after PAGASA data, a licensed DEM and R9b.

**Pausing and resuming connected routing (owner-attended):**

```bash
supabase secrets set EVACUATION_ROUTE_ENABLED=false --project-ref <project-ref>   # pause
supabase secrets set EVACUATION_ROUTE_ENABLED=true  --project-ref <project-ref>   # resume
```

Or use the Dashboard: Edge Functions, Secrets. After either change send one POST to the function (no coordinates are needed beyond a point inside the area) and confirm `503 service_disabled` or a route answer before telling anyone it took effect. Record the time.

## 2. Release state to confirm before a pilot

Read-only checks; stop and report anything that does not match. Values below are what the plan recorded on 2026-10-14; **re-verify, do not assume**.

| Check | Expected | How to check |
|---|---|---|
| Migrations `0113` and `0114` recorded on the hosted project | present | `supabase migration list`, or the SQL editor on `supabase_migrations.schema_migrations` |
| `evacuation-route` deployed, `verify_jwt = false`, secret `EVACUATION_ROUTE_ENABLED` unset or `true` | deployed | `supabase functions list`; `supabase secrets list` (names only) |
| Graph `ampid-1@2026-10-12#fc7101b6227d` active for `ampid-1` | active | Admin-web Evacuation Routing, or `get_routing_conditions_snapshot` with the anon key (`graphStatus: "active"`) |
| Every published center has a DRRM-confirmed position, entrance and availability | **seven centers: two routable, five not** | Admin-web center list; snapshot `centers[].entranceNodeId` |
| No active closure is unmapped | `edgeIds` never `null` in the snapshot | snapshot `closures` |
| Android build under test carries the same graph (`graphSha256` in the route provenance equals the service's) | equal | route provenance on device vs a service response |
| Hosted client-address header reaches the limiter | requests are counted per hashed address | send two requests from one network, then read `barangayan_private.routing_rate_limits` in the SQL editor (private schema, service role only); R5 left this pending |

**Blocking input from DRRM:** the five remaining centers need confirmed locations and entrances before a drill is worth running. Without them most of the center list is unroutable (`center_unavailable`), the drill would test a two-center service and the list ranking would show distances for only two centers.

## 3. Rollout sequence (closure routing)

1. **Freeze** a reviewed source revision and the exact Android build (version code, build id, `graphSha256`). Preserve unrelated work; do not deploy an unreviewed tree.
2. **Preflight** section 2 above. Any mismatch stops the rollout.
3. **Dry run the pause switch** on the deployed function: set `false`, confirm `503 service_disabled` and Android on-phone routing; set `true`, confirm a route. This is the rollback rehearsal and it must pass before residents are told.
4. **Field protocol** in `plans/evidence/resident-drrm-routing/r10-release/field-protocol.md` (device matrix, closure changes in use, 72-hour outage, timings). Record results there, not here.
5. **Announce** only what is true: walking routes inside Ampid I that respect DRRM-verified closures, available offline on Android after the first sync. State that the routes are not weather-aware.
6. **Hold** the first pilot window (suggested: DRRM staff and volunteers only) before wider release. Watch section 6 signals.

## 4. Rollback and recovery procedures

| Situation | Detect | Action | Result for residents |
|---|---|---|---|
| Routes look wrong, service misbehaving, load spike | Complaints, function error rate, 5xx/429 in function logs | Pause connected routing (section 1). Investigate. | Android: on-phone routes (labelled). Web: no routes, paused wording. Closures keep applying on phones. |
| A closure was published in error | DRRM report | Admin-web: reopen with a reason. Never delete; the history is append-only. | Reaches phones on next refresh. Offline phones keep it until they sync. |
| A closure is missing or late | DRRM report | Publish it with the observation time; then check a phone refreshes. | Same. Until published, residents are routed through the road; DRRM must not rely on the app alone. |
| A center position or entrance is wrong | DRRM report | Clear the entrance (center becomes unroutable) or set the correct one. Moving a center clears its entrance by design. | Center drops from routing, stays visible as unroutable. |
| Center full or closed | DRRM | Set availability `unavailable`; deactivate the center if it should not appear. | Excluded from the automatic pick. |
| A wrong graph was activated | Route provenance shows an unexpected `graphVersion`; connectivity report differs | Re-register the previous version with `p_activate => true` as an administrator. **Refused while any active closure lacks a mapping to the older graph** (error `55000`); map those closures first (`map_road_closure_edges`). | Phones with the newer pack keep it until a build replaces it; the service answers `graph_version_mismatch` / `graph_not_active` for mismatched clients, which fall back to local mode. |
| Phone pack corrupt or update interrupted | Status card on the Centers screen | Nothing to do: the app repairs from the bundle or rolls back to the previous pack on restart (R6, verified on emulator). | A route is available after restart. |
| Resident marked a road wrongly | Resident | Remove the mark from the blocked-road list in the app; marks never expire and are never published. | Local only. |
| Rate limiting during a real emergency (429s) | 429 count; `retryAfterSeconds` | The limit is 300 requests per minute per hashed address. Raise `ROUTE_REQUESTS_PER_MINUTE` in `index.ts` and redeploy only with DRRM agreement; shared carrier addresses are the usual cause. | Clients back off 60 s, 120 s, 240 s, up to 5 minutes. |
| Conditions older than 15 minutes shown on devices | Stale warning on the card | Check connectivity to the conditions API; publishing nothing is not an error but a very old check means refresh is failing. | Warning only. A successful empty list means "no reported closures", not "passable". |
| Hosted logs show `graph_not_active`, `closures_unmapped`, `conditions_inconsistent` | Function logs | Treat as a data-consistency incident: do not delete closures to make routing work (invariant 3). Fix the mapping, then verify. | Clients get a service failure, never a route over a closure. |

Never remove a verified closure, and never bypass the active-graph check, to make a route appear (invariants 3 and 6). If nothing can be routed, the correct outcome is `no_route_within_coverage` and the written itinerary and manual placement stay available.

## 5. Preparedness instructions

**Barangay DRRM (before storm season and before each drill):**

- Confirm every published center's location, entrance and availability in admin-web; mark centers `unavailable` when they cannot take people.
- Walk the 14 bridge approaches and the private-access and barrier list in the R3 report (`plans/evidence/resident-drrm-routing/r3-pack-builder/build/report.md`) and sign it off; publish closures for anything impassable.
- Decide who publishes closures during an event and how often they re-verify. The app shows the age of the information; it does not know a road has flooded unless DRRM publishes it.
- Check once a week that a phone you hold shows "Road closures checked" within the last minutes, online and after airplane mode.

**Residents (message for announcements):**

- Open the Centers map once while online. The map, roads and last closures are then stored on the phone and work without signal.
- The app shows how old its information is. If it says closures were checked a long time ago, treat the route as a suggestion and follow barangay announcements.
- Routes are walking routes inside Ampid I. Outside it the app says so instead of drawing a line.
- You can mark a road as blocked on your own phone; it is private to that phone.
- If no route is available the app says so. Use the written directions and ask barangay personnel; it will never draw a straight line.

## 6. Monitoring and privacy

The service logs only fixed event names, never a request, origin or coordinates (R5, verified locally; hosted logs still to be read). Events written as `evacuation-route: <event>`:

`graph_unavailable`, `rate_limiter_unavailable`, `conditions_unavailable`, `conditions_malformed`, `graph_not_active`, `closures_unmapped`, `conditions_inconsistent`, `rollout_flag_invalid`.

Together with the platform's invocation counts, status codes and latency in the Supabase function logs, these are the whole telemetry. Success is not logged per request on purpose: a success line per request would add volume and nothing a status count does not give. Responses are `no-store`. Client addresses exist only as keyed hashes in the rate-limit table. There is no client-side analytics for routing.

| Signal | Source | Watch for |
|---|---|---|
| 5xx and `503` bodies | function invocations | `conditions_unavailable` spikes (database or network), `graph_not_active` (activation drift) |
| `429` | function invocations | shared-address bursts during an event |
| p95 latency | function invocations | connected route p95 above 3 s under pilot load (target) |
| `rollout_flag_invalid` | function logs | a mistyped secret value |

Model and ingestion health indicators (`modelStatus`, `flood-shadow` runs) are R10b and stay out of this release.

## 7. Evidence and exit

R10a is complete only when `plans/evidence/resident-drrm-routing/r10-release/README.md` shows every closure-routing requirement passed with real evidence: the physical-phone location matrix, the 72-hour outage, closure/bridge/center changes during active use, connected and local agreement on a device, p95 timings, cold start within 5 seconds, and a rehearsed rollout and rollback on the deployed function. Until then it stays **partially complete**; the closure-only release must not describe itself as weather-aware.
