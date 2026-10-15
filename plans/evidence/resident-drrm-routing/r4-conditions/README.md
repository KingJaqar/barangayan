# R4 — Conditions migrations and admin management

Recorded 2026-10-13 for `plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md`, phase R4. Every result below came from a command run on that date. Database findings are **automated against disposable local databases**; the admin UI was exercised in the built-in browser against an isolated local stack. **Nothing was applied to the hosted Supabase project.**

## What changed

| File | Change |
|---|---|
| `supabase/migrations/0113_routing_conditions.sql` (new) | `routing_areas` (one per barangay, monotonic `revision`), `routing_graph_versions`, `road_closures` + `road_closure_edges` (per-graph mapping), `evacuation_center_entrance_nodes`, `routing_tombstones`, `routing_condition_events` (append-only history). `evacuation_centers` gains `availability` (default `unknown`), `availability_updated_at`, `entrance_position`, `routing_revision` (trigger-maintained). Guards: closures are never deleted or edited (only active → reopened); history rows immutable; activation of a graph refused while an active closure or entrance is unmapped. RPCs: public `get_routing_conditions_snapshot`; admin `register_routing_graph_version`, `publish_road_closure`, `reopen_road_closure`, `set_/clear_evacuation_center_entrance`, `map_road_closure_edges`, `map_evacuation_center_entrance`. RLS: admins read their own area only; all writes through the RPCs/trigger. Pilot area `ampid-1` inserted when the pilot barangay exists. |
| `supabase/seed.sql` | Inserts the `ampid-1` routing area before the seeded centers. |
| `supabase/tests/routing_conditions.test.sql` (new) | 81 pgTAP assertions (below). |
| `packages/shared/src/types/routing-conditions.database.ts` (new), `types/database.ts` | Generated narrow types (CLI 2.118.0 against the disposable DB), composed into `Database`; four new `evacuation_centers` columns. |
| `packages/shared/src/schemas/routing-conditions.ts` (+ test, new) | Availability enum, closure/reopen input schemas, snapshot schema, RPC result schemas, editor subset of the pack graph. |
| `packages/shared/src/schemas/admin-audit-log.ts`, `index.ts` | Audit entity types `road_closure`, `routing_area`; export the new schema module. |
| `apps/admin-web/src/app/(admin)/evacuation-routing/` (new) | Evacuation Routing page: revision/map-data status and activation, Leaflet map of the bundled pack graph (select segments, closed segments in red, centers and entrances), publish closure form, active closures with reopen-with-reason, center availability and entrance editor, recent history. |
| `apps/admin-web/src/lib/routing-packs.ts` (new) | Bundled pack registry (`data/routing-packs/ampid-1/pack`), validated lazy graph load, nearest-node pick. |
| `apps/admin-web/src/components/admin/{sidebar-nav,header}.tsx`, `lib/audit-notifications.ts` | Nav entry and audit-feed module for the new page. |

No new dependencies.

## Verification

### Checks (baseline → after)

| Check | Baseline | After |
|---|---|---|
| `npx vitest run` (packages/shared) | 27 files / 354 pass | 28 files / 365 pass |
| `npx tsc --noEmit -p .` (packages/shared) | 0 errors | 0 errors |
| `npx tsc --noEmit` (apps/admin-web) | **4 pre-existing errors** (`resident-web/.../resident-service-form.tsx` `@/` imports) | identical 4 errors (`diff` empty) |
| `npx eslint` (apps/admin-web) | 0 problems | 0 problems |
| `npm run test:tables` (apps/admin-web) | 4 files / 68 pass | 4 files / 68 pass |
| `npx tsc --noEmit` (apps/resident-web, apps/resident-android-mobile) | 0 errors | 0 errors |
| `next build` (apps/admin-web, separate distDir) | — | **fails on the same pre-existing 4 module-not-found errors** (admin `/resident/requests/new` imports a resident-web form); no error from R4 files |

### Disposable databases

The local dev database (at `0109`, with dev data) was **not modified**. `r4_disposable` was a full `pg_dump`/`pg_restore` clone; `0110`–`0113` applied cleanly on top. `r4_seed` was a schema-only copy at `0113` plus `supabase/seed.sql` (seed runs; the four seeded centers take revisions 1–4). Both were dropped afterwards.

- `routing_conditions.test.sql`: **81/81** (`routing_conditions.test.log`). Covers: anonymous snapshot read; anonymous publish/table read refused; resident and other-barangay admin refused (register, read, reopen, entrance set/clear); stale graph version refused; empty, duplicate, mismatched-geometry, non-numeric, blank-reason and future-time inputs refused; direct insert/update/delete of closures, history forgery and revision rewrite refused (privileges); even a superuser cannot delete/edit a closure or history row; availability change takes the area revision and ignores a client-supplied `routing_revision`; non-routing edits add no revision; entrance > 250 m refused; moving a center clears its entrance; deactivation, archive and hard delete reach the snapshot (inactive entry / tombstones); reopening is final and produces a tombstone at its revision; unmapped closures stay listed with `edgeIds: null`; activation refused until closures and entrances are mapped, then each graph keeps its own mapping; revisions strictly increase and equal the latest history revision.
- **Mutation check:** dropping the closure guard, the center stamp trigger, the center history trigger, the history immutability trigger, or the admin check in `lock_routing_area_for_admin` each fails tests (2–4 failures each).
- **All other SQL suites** on `r4_disposable`: pass (`sql_suite.log`). `agency_sla` stops at `cron.job` because `pg_cron` exists only in the original database; the same file passes 62/62 on the regular local database.
- **Concurrent publication** (`concurrency.sh`, real parallel sessions): two simultaneous publications serialize to revisions 3 and 4; a reader during the open transactions saw revision 2 with no closures (no half-applied state); two simultaneous reopens of one closure → one success, one `This road closure was already reopened.`; history revisions 1–5 (`concurrency.log`).

### Admin UI (built-in browser, isolated stack)

Stack: separate GoTrue and PostgREST containers on `r4_seed` behind a local proxy; an admin-web dev server on port 3201 with its own `distDir`, environment pointed at the proxy. Signed in with the seed's test account (promoted to admin only in `r4_seed`). Flows:

1. Page loads revision 4, "Active map data: none", activation prompt; map draws the bundled graph and centers.
2. Activate map data → revisions 5 (registered) and 6 (activated).
3. Selected two segments (label suggestion "Pitang Street"); a future observation time shows "The observation time cannot be in the future"; blank time publishes → revision 7, form and selection reset, closed segments red.
4. Anonymous REST snapshot carries both edge ids and source refs; anonymous `publish_road_closure` → 42501; anonymous `road_closures` read → 42501.
5. Availability San Mateo Civic Center → Available (revision 8, timestamp shown).
6. Set entrance by clicking near a road → node `n333609621`, saved (revision 9, "Entrance reviewed").
7. Clicking a closed segment → toast "That road segment is already closed…".
8. Reopen with empty reason → "Enter why the road is open again"; with reason → revision 10, active list empty.
9. The existing Evacuation Centers form's PATCH (sent through REST as the admin): unchanged position keeps the entrance and revision; moved position clears the entrance (revision 11). The snapshot shows the reopened closure as a tombstone at revision 10 (`snapshot-sample.json`, `ui-run-events.txt`). The real snapshot parses with `routingConditionsSnapshotSchema`.

Console: no React/hydration warnings. The only errors were the admin shell's existing realtime WebSocket attempts against the test proxy (no WebSocket support; local realtime stopped) — test-harness artefacts.

## Decisions

1. **Writes only through RPCs** (security definer, admin + barangay check, area row lock). The center availability change uses the existing admin update policy; a trigger stamps revision and history.
2. **Revision per area, under the row lock**: every change visible in any snapshot takes the next revision; the snapshot RPC is `STABLE`, so revision and content come from one database snapshot.
3. **Graph versions are registered in the database; geometry stays in packs.** The admin page bundles the pack and offers activation; publishing requires the active version (stale admin pages are refused).
4. **Entrances**: one reviewed entrance per center, mapped to a node per graph; moving a center clears it; > 250 m from the center is refused.
5. **History**: `routing_condition_events` is the trustworthy record (trigger/RPC-written, immutable); the RPCs also write `admin_audit_log` for the notification feed.
6. **Snapshot content**: active closures (with `edgeIds` or `null` when unmapped), all non-deleted centers (inactive ones without position/entrance), tombstones for reopened closures and archived or hard-deleted centers.

## Not done

- **Hosted database:** the owner applied `0113` afterwards. A read-only check found the tables, columns, triggers and grants as expected, and the snapshot at revision 0 (no active map data, 7 centers `unknown`). An administrator still has to activate the map data there. Hosted REST checks with the anon key confirmed the following:
- the snapshot parses with the shared schema (7 centers, all with valid positions);
- an unknown area returns `P0002` and a malformed graph version returns `22023`;
- all 7 admin RPCs and anonymous table reads and inserts are refused with 42501.

Two tests were not run on hosted, because both need writes. The SQL suite was converted to a block that always rolls back and was proven locally (81/81, and it still catches a disabled guard), but the permission system blocked running it on hosted. The admin UI flows need an administrator to sign in.
- **Remapping tooling for a new graph version:** `map_road_closure_edges` / `map_evacuation_center_entrance` and the activation guard exist and are tested; the UI/CLI that proposes mappings with `mapEdgesAcrossGraphs` belongs to the graph-update flow (R6).
- **Client consumption** of the snapshot (Edge Function, Android cache, web) is R5–R7.
