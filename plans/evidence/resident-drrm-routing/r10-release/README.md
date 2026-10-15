# R10a: rollout flags, runbook and field protocol (closure routing)

Recorded 2026-10-15 for `plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md`, phase R10, part **R10a** (closure-only release). Every result below came from a command run on that date. Findings are **automated** (unit tests) or **local runtime** (the real `evacuation-route` function in supabase-edge-runtime 1.76.2). There is **no field evidence yet**: no physical phone and no DRRM were available. **Nothing was deployed, no secret was set, no migration was added and no hosted write was made.** R10b (model health indicators, sensor-penalty and exclusion flags) is paused until the PAGASA data and R9b.

## What changed

| File | Change |
|---|---|
| `supabase/functions/evacuation-route/handler.ts` | `rolloutFlagState` (pure parser) and a per-request `enabled` dependency: when off, the function answers `503 service_disabled` before reading the body or doing any pack, limiter or database work. CORS preflight and `405` are unchanged. |
| `supabase/functions/evacuation-route/index.ts` | Reads the function secret `EVACUATION_ROUTE_ENABLED` on every request; unset or `true` serves, `false` or any other value pauses; an unrecognised value is logged once per worker as `rollout_flag_invalid`. |
| `packages/shared/src/lib/evacuation-route-service.ts`, `connected-route-client.ts` | New error code `service_disabled`; client wording "The barangay has paused the route service for now." Android appends its existing "Showing the route calculated on this phone"; web calculates nothing. |
| `*.test.ts` (handler, client) | +4 and +1 tests (below). |
| `plans/Resident_DRRM_Routing_Release_Recovery_Runbook.md` (new) | Controls, release state to confirm, rollout sequence, rollback and recovery table, preparedness instructions, monitoring and privacy. |
| `field-protocol.md` (new) | Preconditions and result sheets for the physical-phone location matrix, changes during active use, device agreement, 72-hour outage, timings, rollout/rollback rehearsal and the DRRM drill. |
| `load-probe.mjs` (new) | Pilot-load probe: N synthetic devices, one route request per interval; prints p50/p95 and a status histogram. Not run against any hosted function. |

No new dependencies. Android and web screens are unchanged.

## Verification

| Check | Baseline | After |
|---|---|---|
| `npx vitest run` (packages/shared) | 34 files / 524 pass | 34 files / 525 pass (+1) |
| `npx tsc --noEmit -p .` (packages/shared) | 5 errors, pre-existing (`id-evidence.ts` ×2, `service-catalog.test.ts` ×3) | the same 5 |
| `npx vitest run supabase/functions` | 5 files / 72 pass | 5 files / 76 pass (+4) |
| handler + test `tsc` (`r5-route-service/tsconfig.handler.json`) | not run before editing | 0 errors |
| `npx vitest run` (apps/resident-android-mobile) | not run before editing | 14 files / 126 pass |
| `npx tsc --noEmit` (apps/resident-android-mobile) | not run before editing | 3 errors, all `src/components/external-link.tsx` (expo-router typed-route "excessive complexity"; file unmodified, not caused by this work) |
| `npx tsc --noEmit` (apps/resident-web) | not run before editing | 0 errors |
| `npx eslint` on the touched function and shared files | not run before editing | no findings |
| Mutation check | n/a | removing the pause check fails the 2 pause tests (restored) |

New tests: `rolloutFlagState` (unset/`true` on; `false` and typos off and flagged), paused handler answers before any pack/limiter/conditions call and still answers CORS preflight, pauses and resumes in one handler without a restart, a paused answer is a typed service failure with its own wording, and **connected and on-device routes agree** for 25 origins with and without a published closure (same snapshot through `parseRouteConditionsSnapshot` / `selectRouteConditions` and the same core as `use-local-route.ts`; more than 10 closure cases rerouted).

### Real edge runtime (local, supabase-edge-runtime 1.76.2)

A stand-in main service (CLI-like limits: 256 MB, 1 s soft / 2 s hard CPU) served the real `index.ts` with dummy upstream URLs; only the paths that need no database were meaningful.

| Secret value | Result |
|---|---|
| `false` | `503 {"error":"service_disabled"}`; later requests 7–18 ms; CORS preflight `204`; `GET` `405`; no log lines |
| `off` (typo) | `503 {"error":"service_disabled"}`; log `evacuation-route: rollout_flag_invalid` (once) |
| unset | passed the switch: the dummy upstream failed as expected, `503 conditions_unavailable`; logs `rate_limiter_unavailable` (fail open) and `conditions_unavailable` |

The stand-in's first worker took 171–203 s to boot in this Docker Desktop bind-mount setup (the R5 harness measured 270–314 ms cold with the CLI's own main service), so these runs verify the **switch**, not cold-start latency; R5's figures stay the cold-start evidence.

## Plan requirements to status

| R10 requirement | Part | Status |
|---|---|---|
| Rollout flags (connected routing) | R10a | Done in code; local runtime verified; hosted flip **pending** owner. |
| Rollout flags (Android packs) | R10a | Documented against existing mechanisms (graph activation, bundled pack); no remote revoke by design. |
| Rollout flags (sensor penalties, BFS exclusion) | R10b | Off by construction; **paused**. |
| Model/ingestion health indicators | R10b | **Paused** (needs real flood-shadow runs). |
| Privacy-preserving telemetry | R10a | Decision: fixed event names only, no client analytics. Runbook section 6. |
| Preparedness and recovery instructions, feature documentation | R10a | Done (runbook). |
| 72-hour simulated Android outage | R10a | **Pending** physical phone — `field-protocol.md` section 4. |
| Real-device location matrix | R10a | **Pending** physical phone — section 1. |
| Closure/bridge/center changes during active use | R10a | **Pending** phone + admin session + DRRM — section 2. |
| Connected/local agreement for identical snapshots | R10a | Automated **done**; on-device **pending** — section 3. |
| p95 local ≤ 2 s | R10a | Emulator 12–90 ms (R6); physical phone **pending** — T2. |
| Connected ≤ 3 s under documented pilot load | R10a | Load probe and pilot definition ready (50 devices, 30 s cadence); **pending** hosted run — T3. |
| Map usable within 5 s of cold start without GPS | R10a | **Pending** physical phone — T1. |
| CPU, memory, storage budgets | R10a | Local runtime and pack sizes met (R5/R6); phone and hosted **pending** — T4–T6. |
| Rollout and rollback rehearsed | R10a | Local switch verified; deployed-function rehearsal **pending** — section 6. |
| Exit gate: all required evidence passes | — | **Not met.** |

## Open items and manual steps

1. **DRRM:** confirm the five remaining centers' locations and entrances in admin-web (precondition P1). Without them the drill is mostly unroutable.
2. **Owner:** authorize a hosted rehearsal of the pause switch (`supabase secrets set EVACUATION_ROUTE_ENABLED=false`, then `true`) and the load probe against the deployed function.
3. **Developer + DRRM:** run `field-protocol.md` on a physical phone and record each cell with its observation.
4. **Not started by design:** R10b.

## Out of scope, noticed

- The hosted client-address header for the rate limiter is still unverified (R5 item); the runbook lists it as a preflight check.
- There is no admin-web control to roll back to an older graph version; the RPC exists but is refused while an active closure lacks a mapping to it.
- Pre-existing, unrelated: `external-link.tsx` typed-route complexity errors in Android `tsc`; `packages/shared` `tsc` errors above; `AGENTS.md` migration note ("last pushed 0094") is stale (repository at `0128`).
