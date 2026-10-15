/**
 * R5 resource probe, run inside supabase-edge-runtime as a temporary function. Copy to
 * `supabase/functions/zz-r5-probe/index.ts`, serve, POST once per fresh worker, then delete it.
 * Measures, in the worker: JSON pack import, pack verification + graph preparation (the
 * service's cold-start work), the synchronous route search over 200 origins (the CPU-bound
 * part of a request) and memory. Timings are wall-clock around synchronous code, so they
 * bound CPU time for that code.
 */
import { ROUTING_PROFILES, planEvacuationRoute } from '../../../packages/shared/src/lib/evacuation-routing.ts';
import { loadRoutingPack } from '../evacuation-route/handler.ts';

const encoder = new TextEncoder();
const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
const mb = (bytes: number) => Math.round((bytes / 1048576) * 10) / 10;

Deno.serve(async () => {
  const memoryAtStart = Deno.memoryUsage();
  let t = performance.now();
  const graph = (await import('../../../data/routing-packs/ampid-1/pack/graph.json', { with: { type: 'json' } })).default;
  const manifest = (await import('../../../data/routing-packs/ampid-1/pack/manifest.json', { with: { type: 'json' } })).default;
  const importMs = performance.now() - t;
  t = performance.now();
  const pack = await loadRoutingPack(graph, manifest, async text => hex(await crypto.subtle.digest('SHA-256', encoder.encode(text))));
  const loadMs = performance.now() - t;

  const centers = [
    { id: 'c001', name: 'Ampid 1 Elementary', entranceNodeId: 'n11175955772', availability: 'unknown' as const, active: true },
    { id: 'c002', name: 'San Mateo Civic Center', entranceNodeId: 'n13165316139', availability: 'available' as const, active: true },
    { id: 'c003', name: 'Dulong Bayan Covered Court', entranceNodeId: 'n10250156647', availability: 'unknown' as const, active: true },
    { id: 'c004', name: 'Malanday National High School', entranceNodeId: 'n674020408', availability: 'unknown' as const, active: true },
  ];
  const conditions = { graphVersion: pack.graph.version, revision: 1, closedEdgeIds: [], modelExcludedEdgeIds: [], stationReadings: [], traffic: [] };
  const times: number[] = [];
  const statuses: Record<string, number> = {};
  for (let i = 0; i < 200; i++) {
    const origin = { lat: 14.6745 + (i % 20) * 0.0006, lng: 121.1115 + Math.floor(i / 20) * 0.0015, accuracyMeters: 10, revision: i };
    const started = performance.now();
    const result = planEvacuationRoute({
      graph: pack.graph,
      conditions,
      centers,
      request: { origin, originEdgeId: null, centerId: null, avoidEdgeIds: [] },
      profile: ROUTING_PROFILES['ampid-fine'],
    });
    times.push(performance.now() - started);
    statuses[result.status] = (statuses[result.status] ?? 0) + 1;
  }
  times.sort((a, b) => a - b);
  const memoryAtEnd = Deno.memoryUsage();
  const round = (ms: number) => Math.round(ms * 100) / 100;
  return Response.json({
    runtime: `deno ${Deno.version.deno}`,
    importMs: round(importMs),
    packVerifyAndPrepareMs: round(loadMs),
    routes: times.length,
    statuses,
    routeMs: { p50: round(times[99]), p95: round(times[189]), max: round(times[199]) },
    memoryMb: {
      rssStart: mb(memoryAtStart.rss),
      rssEnd: mb(memoryAtEnd.rss),
      heapUsedEnd: mb(memoryAtEnd.heapUsed),
      heapTotalEnd: mb(memoryAtEnd.heapTotal),
    },
  });
});
