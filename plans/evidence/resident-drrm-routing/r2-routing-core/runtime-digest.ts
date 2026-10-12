/**
 * R2 cross-runtime check: runs the routing core on deterministic fixtures and prints a digest
 * of every result. Identical output from Node and the Supabase edge runtime (Deno) shows the
 * core orders ties and sums costs the same way on both.
 *
 *   node plans/evidence/resident-drrm-routing/r2-routing-core/runtime-digest.ts
 *
 * The edge-runtime run imports `routingDigest` from a temporary function (see README.md).
 */
import {
  ROUTING_PROFILES,
  planEvacuationRoute,
  prepareRoutingGraph,
  runFloodBfs,
  type LngLat,
  type PedestrianAccess,
  type RoutingCenter,
  type RoutingEdge,
  type RoutingGraph,
} from '../../../../packages/shared/src/lib/evacuation-routing.ts';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Fixture edge lengths, using only exactly rounded arithmetic so both runtimes receive identical
 * inputs (Math.sin/cos differ in the last bit between engines). cos(14.68°) is a fixed constant.
 */
function planarLength(a: LngLat, b: LngLat): number {
  const metersPerDegree = (Math.PI / 180) * 6_371_000;
  const dx = (b[0] - a[0]) * metersPerDegree * 0.967356;
  const dy = (b[1] - a[1]) * metersPerDegree;
  return Math.sqrt(dx * dx + dy * dy);
}

function randomGraph(random: () => number, size: number): { graph: RoutingGraph; centers: RoutingCenter[] } {
  const nodes = Array.from({ length: size }, (_, i) => ({ id: `n${i}`, lat: 14.674 + random() * 0.012, lng: 121.11 + random() * 0.017 }));
  const access: PedestrianAccess[] = ['both', 'both', 'both', 'forward', 'backward', 'none'];
  const edges: RoutingEdge[] = [];
  const link = (id: string, a: number, b: number) => {
    const from = nodes[a];
    const to = nodes[b];
    const geometry: LngLat[] = [[from.lng, from.lat], [to.lng, to.lat]];
    edges.push({
      id,
      from: from.id,
      to: to.id,
      geometry,
      lengthMeters: planarLength(geometry[0], geometry[1]),
      name: random() < 0.5 ? null : `St ${Math.floor(random() * 4)}`,
      pedestrianAccess: access[Math.floor(random() * access.length)],
      stairs: random() < 0.1,
      bridge: random() < 0.1,
      sourceRef: `osm:${id}`,
    });
  };
  for (let i = 1; i < size; i++) link(`t${i}`, Math.floor(random() * i), i);
  for (let k = 0; k < size; k++) {
    const a = Math.floor(random() * size);
    const b = Math.floor(random() * size);
    if (a !== b) link(`x${k}`, a, b);
  }
  const coverage: LngLat[][] = [[[121.1, 14.66], [121.14, 14.66], [121.14, 14.7], [121.1, 14.7], [121.1, 14.66]]];
  const stationEdges = [{ stationId: 'S1', edgeIds: edges.filter(() => random() < 0.5).map(e => e.id) }];
  const centers: RoutingCenter[] = [1, 2, 3].map(k => ({
    id: `c${k}`,
    name: `c${k}`,
    entranceNodeId: `n${size - k}`,
    availability: random() < 0.7 ? 'available' : 'unknown',
    active: true,
  }));
  return { graph: { version: 'digest', coverage, nodes, edges, barriers: [], stationEdges }, centers };
}

export function routingDigest(): { cases: number; statuses: Record<string, number>; digest: string; outputs: string[] } {
  const random = rng(20261012);
  const outputs: string[] = [];
  const statuses: Record<string, number> = {};
  for (let trial = 0; trial < 200; trial++) {
    const { graph, centers } = randomGraph(random, 8 + Math.floor(random() * 40));
    const prepared = prepareRoutingGraph(graph);
    if (!prepared.ok) {
      outputs.push(JSON.stringify(prepared.issues));
      continue;
    }
    const origin = graph.nodes[0];
    const result = planEvacuationRoute({
      graph: prepared.graph,
      conditions: {
        graphVersion: 'digest',
        revision: trial,
        closedEdgeIds: graph.edges.filter(() => random() < 0.1).map(e => e.id),
        modelExcludedEdgeIds: [],
        stationReadings: [{ stationId: 'S1', levelMeters: 17.5 + random() * 3, alertMeters: 18, alarmMeters: 19, criticalMeters: 20, observedAt: 0 }],
        traffic: [],
      },
      centers,
      request: { origin: { lat: origin.lat + 0.0001, lng: origin.lng, accuracyMeters: random() < 0.5 ? 5 : 40, revision: trial }, originEdgeId: null, centerId: null, avoidEdgeIds: [] },
      profile: ROUTING_PROFILES['ampid-fine'],
    });
    statuses[result.status] = (statuses[result.status] ?? 0) + 1;
    outputs.push(JSON.stringify(result));
  }
  for (let trial = 0; trial < 50; trial++) {
    const cols = 5 + Math.floor(random() * 20);
    const rows = 5 + Math.floor(random() * 20);
    const elevations = Array.from({ length: cols * rows }, () => (random() < 0.05 ? null : Math.round(random() * 200) / 10));
    const stations = [0, 1, 2].map(k => ({
      stationId: `s${k}`,
      lat: 14.674 + random() * 0.01,
      lng: 121.11 + random() * 0.01,
      levelMeters: random() < 0.1 ? null : Math.round(random() * 200) / 10,
      criticalMeters: 8,
    }));
    const outcome = runFloodBfs({ cellSizeMeters: 50, cols, rows, originLat: 14.674, originLng: 121.11, elevations }, stations, ROUTING_PROFILES['ampid-fine']);
    outputs.push(JSON.stringify(outcome));
  }
  return { cases: outputs.length, statuses, digest: fnv1a(outputs.join('\n')), outputs };
}

const runtime = typeof (globalThis as { Deno?: unknown }).Deno === 'undefined' ? 'node' : 'deno';
if (runtime === 'node') {
  const { outputs: _outputs, ...summary } = routingDigest();
  console.log(JSON.stringify({ runtime, ...summary }));
}
