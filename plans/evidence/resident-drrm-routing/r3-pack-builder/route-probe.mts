/**
 * R3 probe on the real Ampid I pack: plans a route from a ~44 m grid of origins inside the
 * boundary, using the report's proposed entrances, and prints status counts, timings and every
 * inside-boundary origin that has no route (for the DRRM connectivity review).
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON plans/evidence/resident-drrm-routing/r3-pack-builder/route-probe.mts
 */
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import {
  ROUTING_PROFILES,
  isInsideCoverage,
  planEvacuationRoute,
  prepareRoutingGraph,
  type LngLat,
  type RoutingCenter,
} from '../../../../packages/shared/src/lib/evacuation-routing.ts';
import type { RoutingPackReport } from '../../../../packages/shared/src/lib/routing-pack-builder.ts';

const root = new URL('../../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

const started = performance.now();
const graphJson = read('data/routing-packs/ampid-1/pack/graph.json');
const prepared = prepareRoutingGraph(JSON.parse(graphJson));
const loadMs = performance.now() - started;
if (!prepared.ok) throw new Error(`graph invalid: ${JSON.stringify(prepared.issues.slice(0, 5))}`);
const graph = prepared.graph;

const report: RoutingPackReport = JSON.parse(read('plans/evidence/resident-drrm-routing/r3-pack-builder/build/report.json'));
const boundary: LngLat[] = JSON.parse(read('apps/resident-web/src/data/ampid1-boundary.json')).features[0].geometry.coordinates[0];
const centers: RoutingCenter[] = report.centers.map(c => ({ id: c.centerId, name: c.name, entranceNodeId: c.proposedEntranceNodeId, availability: 'available', active: true }));

const times: number[] = [];
const statuses: Record<string, number> = {};
const bestCenter: Record<string, number> = {};
const noRoute: { lat: number; lng: number; street: string | null; edgeId: string | null }[] = [];
for (let lat = 14.6739; lat <= 14.6867; lat += 0.0004) {
  for (let lng = 121.1102; lng <= 121.1273; lng += 0.0004) {
    if (!isInsideCoverage({ lat, lng }, [boundary])) continue;
    const start = performance.now();
    const result = planEvacuationRoute({
      graph,
      conditions: { graphVersion: graph.version, revision: 0, closedEdgeIds: [], modelExcludedEdgeIds: [], stationReadings: [], traffic: [] },
      centers,
      request: { origin: { lat, lng, accuracyMeters: 10, revision: 1 }, originEdgeId: null, centerId: null, avoidEdgeIds: [] },
      profile: ROUTING_PROFILES['ampid-fine'],
    });
    times.push(performance.now() - start);
    statuses[result.status] = (statuses[result.status] ?? 0) + 1;
    if (result.status === 'ok') bestCenter[result.best.centerId] = (bestCenter[result.best.centerId] ?? 0) + 1;
    if (result.status === 'no_route_within_coverage') {
      noRoute.push({ lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)), street: result.attachment?.name ?? null, edgeId: result.attachment?.edgeId ?? null });
    }
  }
}
times.sort((a, b) => a - b);
const quantile = (p: number) => Number(times[Math.min(times.length - 1, Math.floor(p * times.length))].toFixed(2));
console.log(
  JSON.stringify(
    {
      runtime: `node ${process.version}`,
      graphVersion: graph.version,
      graphBytes: Buffer.byteLength(graphJson),
      loadAndPrepareMs: Number(loadMs.toFixed(1)),
      origins: times.length,
      statuses,
      bestCenter,
      routeMs: { p50: quantile(0.5), p95: quantile(0.95), max: Number(times[times.length - 1].toFixed(2)) },
      noRoute,
    },
    null,
    2,
  ),
);
