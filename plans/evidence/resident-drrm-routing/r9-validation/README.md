# R9a — Model validation tooling and controlled activation (no external data)

Recorded 2026-10-15 for `plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md`, phase R9, part R9a. Every result below came from a command run on that date. All evidence is **automated and synthetic**: no PAGASA gauge series, DEM or flood-event ground truth exists in the repository, and the owner paused that work until the data is obtained. **Nothing enables a model stage, nothing changes resident routing, nothing was deployed, and no migration was added.**

## What changed

| File | Change |
|---|---|
| `packages/shared/src/lib/model-activation.ts` (new) | Versioned activation configuration (`ACTIVATION_CONFIG_VERSION`, `DEFAULT_ACTIVATION` with every model stage off). Stages `sensor` (stage 2: warning + soft penalty), `advisory` (stage 3), `exclusion` (stage 4) may only be enabled in order and each needs an acceptance reference and date. `classifyModelHealth` (ok / degraded / stale after 10 run intervals / unavailable when there is no run, no confirmed interval or a future run). `resolveModelInfluence` gives the influence a route may carry: none from an invalid configuration, none from a stale or unavailable model, and every withheld stage is listed with its reason. |
| `packages/shared/src/lib/model-exclusions.ts` (new) | Holdover and clearance reducer (`applyModelEvent`). An accepted complete (`ok`) newer revision replaces model exclusions, holdovers included. A `degraded` revision only adds. An `unavailable` revision or an expiry turns active exclusions into holdover restrictions, never drops them. An older or equal revision is ignored. A reviewer may clear named edges. `effectiveBlocks` unions closures, avoidance and model exclusions with every reason kept, so a model clearance never reopens a verified closure or an avoidance mark. |
| `packages/shared/src/lib/flood-validation.ts` (new) | `compareExtents`: confusion counts, precision, recall and IoU. A ratio with nothing to divide is `null`, never 0 or 1. Units the model could not judge are excluded and observed floods among them are reported. `scoreReportRoads` treats bridge decks as unknown. `scoreReportCells`. `compareShadowReports` lists the differences that stage 3 logs. `replayShadowEvent` replays a time series through the R8 shadow model with chained history, as the scheduled function does. `terrainOffsetSensitivity` measures calibration sensitivity to a vertical offset. |
| `*.test.ts` for each (new) | 12 + 10 + 12 tests. |

No new dependencies. No app, Edge Function or migration file changed. The R8 core is unchanged.

## Verification

| Check | Baseline | After |
|---|---|---|
| `npx vitest run` (packages/shared) | 31 files / 490 pass | 34 files / 524 pass (+34) |
| `npx tsc --noEmit -p .` (packages/shared) | 5 errors, all pre-existing in other sessions' files (`id-evidence.ts` ×2, `service-catalog.test.ts` ×3) | the same 5, none new |
| `npx vitest run supabase/functions` | 5 files / 72 pass | 5 files / 72 pass |
| R2 digest (`runtime-digest.ts`, Node) | `217d8e6a` | `217d8e6a` |
| Mutation check (`mutate-r9.mjs`) | — | 14/14 killed |

The 14 mutants were: stage order not enforced, acceptance not required, a stale model still influencing, staleness never detected, a missing interval treated as fresh, expiry dropping exclusions, a degraded revision clearing, an older revision accepted, clearance without a reviewer, closures dropped from blocks, unknown counted as dry, 0/0 reported as 0, replay history not chained, and bridge decks scored as dry. Files were restored afterwards (`git status` shows only the new files).

Lint: `packages/shared` has no lint target and no app file changed.

## Plan requirements → status

| R9 requirement | Status |
|---|---|
| Replay/comparison tooling | Done (R9a), synthetic events only. |
| Versioned activation configuration | Done (R9a), all model stages off. |
| Model replacement, holdover restrictions, explicit clearance | Done (R9a) as verified pure logic. Persistence and wiring into the conditions snapshot come with stage 4 activation, which needs the data. |
| Accepted revisions clear only their own exclusions | Verified (automated). |
| Degraded operation when the sensor or model service fails | Verified (automated): health → stale or unavailable → no new influence, exclusions held over. |
| False positives/negatives, precision/recall/IoU | Computation done; **numbers pending** (R9b). |
| Calibration sensitivity documented | Tooling done; **report pending** (R9b). |
| Held-out event reports (Ulysses, Kristine) | **Pending** (R9b): needs the archived 10-minute series requested from PAGASA and observed flood extents. |
| Bridge/approach validation | **Pending** (R9b): DRRM review. |
| Exit gate: DRRM acceptance before enabling penalties or exclusions | **Not met** and cannot be met by R9a. |

## Decisions

1. **Three model stages, not four flags.** The plan pairs the stage-2 warning and soft penalty, so they share one stage (`sensor`). Closure routing is not a model stage and is never gated.
2. **Influence needs `ok` or `degraded` health.** A degraded model still reports what it knows (unknown inputs stay unknown, R8). A stale or unavailable model contributes nothing new; what was already compiled stays as holdover.
3. **Only a complete (`ok`) revision clears.** A degraded run cannot prove an edge is passable again, so it can add exclusions but only holds over the ones it no longer flags.
4. **Staleness uses the plan 3.6 rule (N = 10 intervals)** of a *confirmed* run interval. With no confirmed interval the model is `unavailable`.
5. **No persistence yet.** Storing holdover state and adding model exclusions to the conditions snapshot change what residents receive. That belongs with the first stage activation, after the data and DRRM acceptance.
6. **The paused data work is not simulated.** No thresholds, calibration values or accuracy figures were written; the tests use synthetic grids only.

## Remaining (on the owner's go signal, once the PAGASA data arrives)

- R8 inputs: reviewed `sensor-stations.json` and `terrain.json`, pack rebuild, hosted `0120`, `flood-shadow` deploy and schedule.
- R9b: replay of Ulysses and Kristine with observed extents, precision/recall/IoU and road-level errors, calibration sensitivity report, bridge/approach review, DRRM acceptance record, then (only then) persistence and wiring of the activation config and holdover state.
