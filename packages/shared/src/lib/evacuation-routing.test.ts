import { describe, expect, it } from 'vitest';
import {
  ROUTING_PROFILES,
  floodGridCellAt,
  planEvacuationRoute,
  planEvacuationRouteAsync,
  prepareRoutingGraph,
  rrlEdgeWeight,
  runFloodBfs,
  stationApplicableEdgeIds,
  stationLevel,
  stationRiskFactor,
  type CompiledRoutingConditions,
  type FloodGrid,
  type FloodStation,
  type LngLat,
  type PedestrianAccess,
  type PlanRouteInput,
  type PreparedRoutingGraph,
  type RouteRequest,
  type RouteResult,
  type RoutingCenter,
  type RoutingEdge,
  type RoutingGraph,
  type StationReading,
} from './evacuation-routing';
import { haversineDistanceMeters } from './haversine';

const FINE = ROUTING_PROFILES['ampid-fine'];
const REFERENCE = ROUTING_PROFILES['rrl-reference'];

// --- Fixture helpers: positions are meters east/north of a point inside Ampid I. -----------

const BASE_LAT = 14.68;
const BASE_LNG = 121.115;
const M_PER_DEG_LAT = 111_194.93;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((BASE_LAT * Math.PI) / 180);

function at(east: number, north: number): LngLat {
  return [BASE_LNG + east / M_PER_DEG_LNG, BASE_LAT + north / M_PER_DEG_LAT];
}

function lineLength(points: readonly LngLat[]): number {
  let total = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const [lngA, latA] = points[i];
    const [lngB, latB] = points[i + 1];
    total += haversineDistanceMeters({ lat: latA, lng: lngA }, { lat: latB, lng: lngB });
  }
  return total;
}

interface EdgeSpec {
  id: string;
  from: string;
  to: string;
  name?: string | null;
  access?: PedestrianAccess;
  stairs?: boolean;
  bridge?: boolean;
  via?: [number, number][];
}

function makeGraph(
  nodes: Record<string, [number, number]>,
  edges: EdgeSpec[],
  extra: Partial<Pick<RoutingGraph, 'barriers' | 'stationEdges' | 'coverage'>> = {},
): RoutingGraph {
  const routingEdges: RoutingEdge[] = edges.map(spec => {
    const geometry = [at(...nodes[spec.from]), ...(spec.via ?? []).map(p => at(...p)), at(...nodes[spec.to])];
    return {
      id: spec.id,
      from: spec.from,
      to: spec.to,
      geometry,
      lengthMeters: lineLength(geometry),
      name: spec.name === undefined ? `${spec.id} St` : spec.name,
      pedestrianAccess: spec.access ?? 'both',
      stairs: spec.stairs ?? false,
      bridge: spec.bridge ?? false,
      sourceRef: `osm:way/${spec.id}`,
    };
  });
  const xs = Object.values(nodes).map(p => p[0]);
  const ys = Object.values(nodes).map(p => p[1]);
  const [w, e, s, n] = [Math.min(...xs) - 200, Math.max(...xs) + 200, Math.min(...ys) - 200, Math.max(...ys) + 200];
  return {
    version: 'test-graph-1',
    coverage: extra.coverage ?? [[at(w, s), at(e, s), at(e, n), at(w, n), at(w, s)]],
    nodes: Object.entries(nodes).map(([id, [east, north]]) => {
      const [lng, lat] = at(east, north);
      return { id, lat, lng };
    }),
    edges: routingEdges,
    barriers: extra.barriers ?? [],
    stationEdges: extra.stationEdges ?? [],
  };
}

function prepare(graph: RoutingGraph): PreparedRoutingGraph {
  const result = prepareRoutingGraph(graph);
  if (!result.ok) throw new Error(`invalid fixture: ${JSON.stringify(result.issues)}`);
  return result.graph;
}

function conditions(graph: PreparedRoutingGraph, partial: Partial<CompiledRoutingConditions> = {}): CompiledRoutingConditions {
  return { graphVersion: graph.version, revision: 1, closedEdgeIds: [], modelExcludedEdgeIds: [], stationReadings: [], traffic: [], ...partial };
}

function center(id: string, entranceNodeId: string | null, partial: Partial<RoutingCenter> = {}): RoutingCenter {
  return { id, name: id, entranceNodeId, availability: 'available', active: true, ...partial };
}

function request(east: number, north: number, partial: Partial<RouteRequest> = {}): RouteRequest {
  const [lng, lat] = at(east, north);
  return { origin: { lat, lng, accuracyMeters: 5, revision: 7 }, originEdgeId: null, centerId: null, avoidEdgeIds: [], ...partial };
}

function reading(stationId: string, levelMeters: number | null, alert = 18, alarm = 19, critical = 20): StationReading {
  return { stationId, levelMeters, alertMeters: alert, alarmMeters: alarm, criticalMeters: critical, observedAt: 1_760_000_000_000 };
}

function plan(
  graph: PreparedRoutingGraph,
  centers: RoutingCenter[],
  req: RouteRequest,
  cond: Partial<CompiledRoutingConditions> = {},
  profile = FINE,
): RouteResult {
  return planEvacuationRoute({ graph, conditions: conditions(graph, cond), centers, request: req, profile });
}

function ok(result: RouteResult): Extract<RouteResult, { status: 'ok' }> {
  if (result.status !== 'ok') throw new Error(`expected ok, got ${result.status}`);
  return result;
}

/** Deterministic PRNG (mulberry32) so random fixtures are reproducible. */
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

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// --- Competing-risk ladder: short street A–B–C vs. longer detour A–D–E–C. -------------------

const LADDER_NODES: Record<string, [number, number]> = { A: [0, 0], B: [100, 0], C: [200, 0], D: [0, 150], E: [200, 150] };
const LADDER_EDGES: EdgeSpec[] = [
  { id: 'AB', from: 'A', to: 'B', name: 'Short St' },
  { id: 'BC', from: 'B', to: 'C', name: 'Short St' },
  { id: 'AD', from: 'A', to: 'D', name: 'Detour Rd' },
  { id: 'DE', from: 'D', to: 'E', name: 'Detour Rd' },
  { id: 'EC', from: 'E', to: 'C', name: 'Detour Rd' },
];

function ladder(): PreparedRoutingGraph {
  return prepare(makeGraph(LADDER_NODES, LADDER_EDGES, { stationEdges: [{ stationId: 'SM1', edgeIds: ['AB', 'BC'] }] }));
}

// ---------------------------------------------------------------------------------------------

describe('routing profiles (plan 3.2)', () => {
  it('keeps the RRL constants in both profiles and differs only in cell size', () => {
    expect(FINE).toMatchObject({ cellSizeMeters: 50, alpha: 10, beta: 0.5, sensorRadiusMeters: 2000, trafficMax: 1 });
    expect(REFERENCE).toMatchObject({ cellSizeMeters: 500, alpha: 10, beta: 0.5, sensorRadiusMeters: 2000, trafficMax: 1 });
    expect({ ...FINE, id: 'x', cellSizeMeters: 0 }).toEqual({ ...REFERENCE, id: 'x', cellSizeMeters: 0 });
    expect(Object.isFrozen(FINE)).toBe(true);
  });
});

describe('RRL conformance (profile rrl-reference)', () => {
  it('gives f = 0.25 halfway from Alert to Critical, so d = 100 m, t = 0 weighs 350', () => {
    const f = stationRiskFactor(reading('X', 19, 18, 19, 20));
    expect(f).toBe(0.25);
    expect(rrlEdgeWeight(100, f ?? NaN, 0, REFERENCE)).toBe(350);
  });

  // Table 1 rows as transcribed in the plan; still pending the RRL PDF visual check (R0).
  it.each([
    ['San Mateo-1', 18.0, 19.0, 20.0, 19.0],
    ['Montalban', 22.4, 23.0, 23.6, 23.0],
    ['Nangka', 16.5, 17.1, 17.7, 17.1],
    ['Rodriguez', 28.8, 29.8, 30.7, 29.75],
  ])('golden Table 1 value: %s halfway Alert→Critical gives f = 0.25', (id, alert, alarm, critical, level) => {
    expect(stationRiskFactor(reading(id, level, alert, alarm, critical))).toBeCloseTo(0.25, 12);
  });

  it('clamps the ratio to [0, 1] before squaring (D4)', () => {
    expect(stationRiskFactor(reading('X', 10))).toBe(0);
    expect(stationRiskFactor(reading('X', 25))).toBe(1);
    expect(rrlEdgeWeight(100, 1, 1, REFERENCE)).toBe(100 * (1 + 10 + 0.5));
  });

  it('treats missing readings and misordered thresholds as unknown, never dry', () => {
    expect(stationRiskFactor(reading('X', null))).toBeNull();
    expect(stationRiskFactor(reading('X', 19, 20, 19, 18))).toBeNull();
    expect(stationRiskFactor(reading('X', 19, 18, 18, 18))).toBeNull();
    expect(stationRiskFactor(reading('X', Number.NaN))).toBeNull();
  });

  it('classifies station levels for display only', () => {
    expect(stationLevel(reading('X', 17.9))).toBeNull();
    expect(stationLevel(reading('X', 18))).toBe('alert');
    expect(stationLevel(reading('X', 19.5))).toBe('alarm');
    expect(stationLevel(reading('X', 20))).toBe('critical');
    expect(stationLevel(reading('X', null))).toBeNull();
  });

  it('never traverses flooded (model-excluded) edges on random graphs', () => {
    const random = rng(11);
    for (let trial = 0; trial < 60; trial++) {
      const { graph, centers } = randomGraph(random, 18);
      const flooded = graph.edges.filter(() => random() < 0.25).map(e => e.id);
      const prepared = prepare(graph);
      const result = plan(prepared, centers, nodeRequest(prepared, 'n0'), { modelExcludedEdgeIds: flooded }, REFERENCE);
      if (result.status === 'ok') {
        for (const path of [result.best, result.shortest]) {
          for (const id of path?.edgeIds ?? []) expect(flooded).not.toContain(id);
        }
      }
    }
  });
});

describe('graph validation', () => {
  const base = () => makeGraph({ A: [0, 0], B: [100, 0] }, [{ id: 'AB', from: 'A', to: 'B' }]);
  const codes = (graph: RoutingGraph) => {
    const result = prepareRoutingGraph(graph);
    return result.ok ? [] : result.issues.map(i => i.code);
  };

  it('accepts a well-formed graph', () => {
    expect(codes(base())).toEqual([]);
  });

  it('rejects swapped [lat, lng] order and geometry that does not run from "from" to "to"', () => {
    const graph = base();
    const edge = graph.edges[0];
    expect(codes({ ...graph, edges: [{ ...edge, geometry: edge.geometry.map(([lng, lat]) => [lat, lng] as LngLat) }] })).toEqual(['invalid_geometry']);
    expect(codes({ ...graph, edges: [{ ...edge, geometry: [...edge.geometry].reverse() }] })).toEqual(['endpoint_mismatch']);
  });

  it('rejects incomplete topology and bad values', () => {
    const graph = base();
    const edge = graph.edges[0];
    expect(codes({ ...graph, edges: [] })).toContain('empty_graph');
    expect(codes({ ...graph, edges: [{ ...edge, to: 'Z' }] })).toContain('unknown_node');
    expect(codes({ ...graph, edges: [{ ...edge, to: 'A' }] })).toContain('self_loop');
    expect(codes({ ...graph, edges: [edge, edge] })).toContain('duplicate_edge');
    expect(codes({ ...graph, nodes: [...graph.nodes, graph.nodes[0]] })).toContain('duplicate_node');
    expect(codes({ ...graph, nodes: [{ ...graph.nodes[0], lat: Number.NaN }, graph.nodes[1]] })).toContain('invalid_node');
    expect(codes({ ...graph, edges: [{ ...edge, lengthMeters: 0 }] })).toContain('invalid_length');
    expect(codes({ ...graph, edges: [{ ...edge, lengthMeters: 250 }] })).toContain('length_mismatch');
    expect(codes({ ...graph, edges: [{ ...edge, geometry: [edge.geometry[0]] }] })).toContain('invalid_geometry');
    expect(codes({ ...graph, edges: [{ ...edge, geometry: [edge.geometry[0], [Infinity, 14]] }] })).toContain('invalid_geometry');
    expect(codes({ ...graph, edges: [{ ...edge, pedestrianAccess: 'oneway' as PedestrianAccess }] })).toContain('invalid_access');
    expect(codes({ ...graph, edges: [{ ...edge, sourceRef: '' }] })).toContain('invalid_source_ref');
    expect(codes({ ...graph, coverage: [] })).toContain('invalid_coverage');
    expect(codes({ ...graph, barriers: [{ id: 'river', geometry: [at(0, 0)] }] })).toContain('invalid_barrier');
    expect(codes({ ...graph, stationEdges: [{ stationId: 'S', edgeIds: ['missing'] }] })).toContain('invalid_station_edges');
    expect(codes({ ...graph, version: '' })).toContain('invalid_version');
  });

  it('computes station applicability from segment geometry, not endpoints (RRL §2.5)', () => {
    // A 4.2 km street whose endpoints are both > 2 km from the station but whose middle passes 50 m away.
    const graph = makeGraph({ A: [-2100, 0], B: [2100, 0], C: [5000, 0] }, [
      { id: 'AB', from: 'A', to: 'B' },
      { id: 'BC', from: 'B', to: 'C' },
    ]);
    const [lng, lat] = at(0, 50);
    expect(stationApplicableEdgeIds(graph.edges, { lat, lng }, FINE)).toEqual(['AB']);
  });
});

describe('origin attachment (plan section 2)', () => {
  const street = () => prepare(makeGraph({ A: [0, 0], B: [200, 0] }, [{ id: 'AB', from: 'A', to: 'B', name: 'Rizal St' }]));

  it('splits the nearest segment temporarily and starts the route at the attachment point', () => {
    const graph = street();
    const result = ok(plan(graph, [center('ctr', 'B')], request(50, 10)));
    expect(result.attachment.edgeId).toBe('AB');
    expect(result.attachment.distanceMeters).toBeCloseTo(10, 0);
    expect(result.best.edgeIds).toEqual(['AB']);
    expect(result.best.distanceMeters).toBeCloseTo(150, 0);
    const [lng, lat] = result.best.geometry[0];
    expect(haversineDistanceMeters({ lat, lng }, result.attachment.point)).toBeLessThan(0.01);
    expect(result.provenance).toEqual({ graphVersion: 'test-graph-1', conditionsRevision: 1, profileId: 'ampid-fine', configVersion: expect.any(String), originRevision: 7 });
  });

  it('respects pedestrian direction on the split segment', () => {
    const graph = prepare(makeGraph({ A: [0, 0], B: [200, 0] }, [{ id: 'AB', from: 'A', to: 'B', access: 'forward' }]));
    expect(ok(plan(graph, [center('ctr', 'B')], request(50, 5))).best.distanceMeters).toBeCloseTo(150, 0);
    expect(plan(graph, [center('ctr', 'A')], request(50, 5)).status).toBe('no_route_within_coverage');
  });

  it('starts from the node when the origin meets the graph at an intersection', () => {
    const result = ok(plan(ladder(), [center('ctr', 'C')], request(0, -5)));
    expect(result.best.edgeIds).toEqual(['AB', 'BC']);
    expect(result.best.distanceMeters).toBeCloseTo(200, 0);
  });

  it('rejects invalid origins, origins outside coverage and origins far from any path', () => {
    const graph = street();
    expect(plan(graph, [center('ctr', 'B')], { ...request(0, 0), origin: { lat: Number.NaN, lng: 121, accuracyMeters: 5, revision: 1 } }).status).toBe('invalid_origin');
    expect(plan(graph, [center('ctr', 'B')], request(0, 0, { origin: { ...request(0, 0).origin, accuracyMeters: -1 } })).status).toBe('invalid_origin');
    expect(plan(graph, [center('ctr', 'B')], request(100, 500)).status).toBe('outside_coverage');
    expect(plan(graph, [center('ctr', 'B')], request(100, 80)).status).toBe('no_nearby_path');
  });

  it('never attaches across a barrier such as a river', () => {
    const graph = prepare(
      makeGraph(
        { A: [0, 0], B: [200, 0], C: [0, 40], D: [200, 40] },
        [
          { id: 'south', from: 'A', to: 'B', name: 'South St' },
          { id: 'north', from: 'C', to: 'D', name: 'North St' },
        ],
        { barriers: [{ id: 'creek', geometry: [at(-100, 15), at(300, 15)] }] },
      ),
    );
    // South St is 18 m away but across the creek; North St (22 m) is on the origin's side.
    const result = ok(plan(graph, [center('ctr', 'D')], request(50, 18)));
    expect(result.attachment.edgeId).toBe('north');
  });

  describe('ambiguity', () => {
    const twoStreets = () =>
      prepare(
        makeGraph({ A: [0, 0], B: [200, 0], C: [0, 30], D: [200, 30] }, [
          { id: 'a', from: 'A', to: 'B', name: 'A St' },
          { id: 'b', from: 'C', to: 'D', name: 'B St' },
        ]),
      );

    it('asks the resident to choose when another street lies within the accuracy radius', () => {
      const result = plan(twoStreets(), [center('ctr', 'D')], request(50, 12, { origin: { ...request(50, 12).origin, accuracyMeters: 25 } }));
      expect(result.status).toBe('attachment_ambiguous');
      if (result.status !== 'attachment_ambiguous') return;
      expect(result.candidates.map(c => c.edgeId)).toEqual(['a', 'b']);
      expect(result.candidates[0].distanceMeters).toBeCloseTo(12, 0);
    });

    it('attaches to the resident-chosen segment', () => {
      const req = request(50, 12, { origin: { ...request(50, 12).origin, accuracyMeters: 25 }, originEdgeId: 'b' });
      expect(ok(plan(twoStreets(), [center('ctr', 'D')], req)).attachment.edgeId).toBe('b');
    });

    it('re-asks when the chosen segment is no longer eligible', () => {
      const req = request(50, 12, { originEdgeId: 'b' });
      expect(plan(twoStreets(), [center('ctr', 'D')], req, { closedEdgeIds: ['b'] }).status).toBe('attachment_ambiguous');
    });

    it('attaches automatically when only one street is within the accuracy radius', () => {
      expect(ok(plan(twoStreets(), [center('ctr', 'B')], request(50, 12))).attachment.edgeId).toBe('a');
    });

    it('does not count adjacent segments of the same street as a second street', () => {
      const named = prepare(
        makeGraph({ A: [0, 0], B: [100, 0], C: [200, 0] }, [
          { id: 'ab', from: 'A', to: 'B', name: 'Rizal St' },
          { id: 'bc', from: 'B', to: 'C', name: 'Rizal St' },
        ]),
      );
      const unnamed = prepare(
        makeGraph({ A: [0, 0], B: [100, 0], C: [200, 0] }, [
          { id: 'ab', from: 'A', to: 'B', name: null },
          { id: 'bc', from: 'B', to: 'C', name: null },
        ]),
      );
      const req = request(90, 5, { origin: { ...request(90, 5).origin, accuracyMeters: 30 } });
      expect(ok(plan(named, [center('ctr', 'C')], req)).attachment.edgeId).toBe('ab');
      expect(ok(plan(unnamed, [center('ctr', 'C')], req)).attachment.edgeId).toBe('ab');
    });
  });
});

describe('Dijkstra routing (plan 3.5)', () => {
  it('coincides "best" and "shortest" without hazard data', () => {
    const result = ok(plan(ladder(), [center('ctr', 'C')], request(0, -5)));
    expect(result.shortest).toBeNull();
    expect(result.best.cost).toBeCloseTo(result.best.distanceMeters, 6);
  });

  it('diverges on a competing-risk graph where the penalized path is shorter', () => {
    const result = ok(plan(ladder(), [center('ctr', 'C')], request(0, -5), { stationReadings: [reading('SM1', 19)] }));
    expect(result.best.edgeIds).toEqual(['AD', 'DE', 'EC']);
    expect(result.best.distanceMeters).toBeCloseTo(500, 0);
    expect(result.shortest?.edgeIds).toEqual(['AB', 'BC']);
    expect(result.shortest?.distanceMeters).toBeCloseTo(200, 0);
    expect(result.shortest?.cost).toBeCloseTo(700, 0);
    expect(result.shortestAvoids).toEqual(['sensor_risk']);
    expect(result.warnings).toEqual([{ code: 'station_level', stationId: 'SM1', level: 'alarm', observedAt: expect.any(Number) }]);
  });

  it('reports traffic as the reason when t(e) makes the short path costlier', () => {
    const traffic = [
      { edgeId: 'AB', value: 1 },
      { edgeId: 'BC', value: 1 },
    ];
    // 200 m × 1.5 = 300 < 500, so the short path still wins with β = 0.5.
    expect(ok(plan(ladder(), [center('ctr', 'C')], request(0, -5), { traffic })).shortest).toBeNull();
    const graph = prepare(
      makeGraph({ ...LADDER_NODES, D: [0, 30], E: [200, 30] }, LADDER_EDGES),
    );
    const result = ok(plan(graph, [center('ctr', 'C')], request(0, -5), { traffic }));
    expect(result.best.edgeIds).toEqual(['AD', 'DE', 'EC']);
    expect(result.shortestAvoids).toEqual(['traffic']);
  });

  it('applies a critical station as a soft penalty only (D9)', () => {
    const result = ok(plan(ladder(), [center('ctr', 'C')], request(0, -5), { stationReadings: [reading('SM1', 21)], closedEdgeIds: ['AD'] }));
    expect(result.best.edgeIds).toEqual(['AB', 'BC']);
    expect(result.best.cost).toBeCloseTo(200 * 11, 0);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'station_level', level: 'critical' }));
  });

  it('reports unknown station readings without applying a penalty', () => {
    const result = ok(plan(ladder(), [center('ctr', 'C')], request(0, -5), { stationReadings: [reading('SM1', null), reading('OTHER', 21)] }));
    expect(result.best.edgeIds).toEqual(['AB', 'BC']);
    expect(result.best.cost).toBeCloseTo(200, 0);
    // OTHER applies to no edge in this pack, so it neither penalizes nor warns.
    expect(result.warnings).toEqual([{ code: 'station_unknown', stationId: 'SM1' }]);
  });

  describe('hard restrictions take precedence over soft risk', () => {
    const only = () => prepare(makeGraph({ A: [0, 0], B: [100, 0], C: [200, 0] }, [
      { id: 'AB', from: 'A', to: 'B' },
      { id: 'BC', from: 'B', to: 'C' },
    ]));

    it.each([
      ['verified closure', { closedEdgeIds: ['BC'] }, []],
      ['accepted model exclusion', { modelExcludedEdgeIds: ['BC'] }, []],
      ['local avoidance', {}, ['BC']],
    ] as const)('%s blocks the only path: no route, never a straight line', (_label, cond, avoid) => {
      const result = plan(only(), [center('ctr', 'C')], request(0, -5, { avoidEdgeIds: avoid }), cond);
      expect(result.status).toBe('no_route_within_coverage');
      if (result.status === 'no_route_within_coverage') expect(result.centers[0]).toMatchObject({ centerId: 'ctr', distanceMeters: null });
    });

    it('pedestrian prohibition blocks too', () => {
      const graph = prepare(makeGraph({ A: [0, 0], B: [100, 0], C: [200, 0] }, [
        { id: 'AB', from: 'A', to: 'B' },
        { id: 'BC', from: 'B', to: 'C', access: 'none' },
      ]));
      expect(plan(graph, [center('ctr', 'C')], request(0, -5)).status).toBe('no_route_within_coverage');
    });

    it('a restriction blocks both directions and is never traded for a shorter path', () => {
      const result = ok(plan(ladder(), [center('ctr', 'C')], request(0, -5), { closedEdgeIds: ['BC'] }));
      expect(result.best.edgeIds).toEqual(['AD', 'DE', 'EC']);
      expect(result.shortest).toBeNull();
      const back = ok(plan(ladder(), [center('ctr', 'A')], request(200, -5), { closedEdgeIds: ['BC'] }));
      expect(back.best.edgeIds).toEqual(['EC', 'DE', 'AD']);
    });

    it('reports no safe route when every nearby segment is blocked', () => {
      const result = plan(only(), [center('ctr', 'C')], request(50, 5), { closedEdgeIds: ['AB'] });
      expect(result.status).toBe('no_route_within_coverage');
      if (result.status === 'no_route_within_coverage') expect(result.attachment).toBeNull();
    });
  });

  describe('bridges and stairs', () => {
    // A creek runs east-west at north = 50; two bridges cross it.
    const crossing = () =>
      prepare(
        makeGraph(
          { S1: [0, 0], N1: [0, 100], S2: [300, 0], N2: [300, 100] },
          [
            { id: 'south', from: 'S1', to: 'S2', name: 'Riverside Rd' },
            { id: 'north', from: 'N1', to: 'N2', name: 'Upper Rd' },
            { id: 'bridge1', from: 'S1', to: 'N1', name: 'Ampid Bridge', bridge: true },
            { id: 'bridge2', from: 'S2', to: 'N2', name: 'Footbridge', bridge: true },
          ],
          { barriers: [{ id: 'creek', geometry: [at(-200, 50), at(500, 50)] }] },
        ),
      );

    it('crosses the nearest open bridge and names it in the itinerary', () => {
      const result = ok(plan(crossing(), [center('ctr', 'N1')], request(-3, -3)));
      expect(result.best.itinerary.map(s => [s.name, s.kind])).toEqual([['Ampid Bridge', 'bridge']]);
    });

    it('detours over the other bridge when one is closed, and fails safely when both are', () => {
      const detour = ok(plan(crossing(), [center('ctr', 'N1')], request(-3, -3), { closedEdgeIds: ['bridge1'] }));
      expect(detour.best.itinerary.map(s => [s.name, s.kind])).toEqual([
        ['Riverside Rd', 'path'],
        ['Footbridge', 'bridge'],
        ['Upper Rd', 'path'],
      ]);
      expect(detour.best.distanceMeters).toBeCloseTo(700, 0);
      expect(plan(crossing(), [center('ctr', 'N1')], request(-3, -3), { closedEdgeIds: ['bridge1', 'bridge2'] }).status).toBe('no_route_within_coverage');
    });

    it('walks stairs at 0.6 m/s without changing the optimization cost', () => {
      const graph = prepare(makeGraph({ A: [0, 0], B: [60, 0], C: [180, 0] }, [
        { id: 'steps', from: 'A', to: 'B', name: 'Hillside Steps', stairs: true },
        { id: 'walk', from: 'B', to: 'C', name: 'Hillside Rd' },
      ]));
      const result = ok(plan(graph, [center('ctr', 'C')], request(0, -3)));
      expect(result.best.cost).toBeCloseTo(180, 0);
      expect(result.best.durationSeconds).toBeCloseTo(60 / 0.6 + 120 / 1.2, 0);
      expect(result.best.itinerary.map(s => s.kind)).toEqual(['stairs', 'path']);
    });
  });

  it('merges consecutive segments of the same street into one itinerary step', () => {
    const result = ok(plan(ladder(), [center('ctr', 'C')], request(0, -5)));
    expect(result.best.itinerary).toEqual([{ name: 'Short St', kind: 'path', distanceMeters: expect.any(Number), durationSeconds: expect.any(Number), edgeIds: ['AB', 'BC'] }]);
  });

  describe('shelter set C', () => {
    const line = () =>
      prepare(makeGraph({ A: [0, 0], B: [100, 0], C: [400, 0], D: [-50, 0] }, [
        { id: 'AB', from: 'A', to: 'B' },
        { id: 'BC', from: 'B', to: 'C' },
        { id: 'AD', from: 'A', to: 'D' },
      ]));

    it('prefers a confirmed-available center over a nearer unknown-availability one', () => {
      const centers = [center('near', 'B', { availability: 'unknown' }), center('far', 'C')];
      const result = ok(plan(line(), centers, request(0, -3)));
      expect(result.best.centerId).toBe('far');
      expect(result.centerTier).toBe('available');
      expect(result.warnings).toEqual([]);
    });

    it('falls back to unknown availability only when no available center is reachable, with a warning', () => {
      const centers = [center('near', 'B', { availability: 'unknown' }), center('far', 'C')];
      const result = ok(plan(line(), centers, request(0, -3), { closedEdgeIds: ['BC'] }));
      expect(result.best.centerId).toBe('near');
      expect(result.centerTier).toBe('unknown');
      expect(result.warnings).toEqual([{ code: 'unknown_center_availability', centerId: 'near' }]);
    });

    it('excludes inactive, unavailable and unmapped-entrance centers and says why', () => {
      const centers = [
        center('closed', 'D', { availability: 'unavailable' }),
        center('deleted', 'D', { active: false }),
        center('moved', 'missing-node'),
        center('unmapped', null),
        center('ok', 'C'),
      ];
      const result = ok(plan(line(), centers, request(0, -3)));
      expect(result.best.centerId).toBe('ok');
      expect(result.centers.map(c => [c.centerId, c.excluded])).toEqual([
        ['ok', null],
        ['closed', 'unavailable'],
        ['deleted', 'inactive'],
        ['moved', 'no_entrance'],
        ['unmapped', 'no_entrance'],
      ]);
    });

    it('routes to a user-selected center as a one-element C', () => {
      const centers = [center('near', 'D'), center('far', 'C')];
      expect(ok(plan(line(), centers, request(0, -3))).best.centerId).toBe('near');
      expect(ok(plan(line(), centers, request(0, -3, { centerId: 'far' }))).best.centerId).toBe('far');
    });

    it('warns for a selected unknown-availability center and refuses an unavailable one', () => {
      const centers = [center('maybe', 'C', { availability: 'unknown' }), center('shut', 'B', { availability: 'unavailable' })];
      expect(ok(plan(line(), centers, request(0, -3, { centerId: 'maybe' }))).warnings).toEqual([{ code: 'unknown_center_availability', centerId: 'maybe' }]);
      expect(plan(line(), centers, request(0, -3, { centerId: 'shut' })).status).toBe('center_unavailable');
      expect(plan(line(), centers, request(0, -3, { centerId: 'nope' })).status).toBe('center_unavailable');
      expect(plan(line(), [centers[1]], request(0, -3)).status).toBe('center_unavailable');
    });
  });

  describe('frozen inputs', () => {
    it('rejects conditions for another graph version or with out-of-range values', () => {
      const graph = ladder();
      const req = request(0, -5);
      const result = plan(graph, [center('ctr', 'C')], req, { graphVersion: 'other', traffic: [{ edgeId: 'AB', value: 2 }], revision: -1 });
      expect(result.status).toBe('invalid_conditions');
      if (result.status === 'invalid_conditions') expect(result.issues).toEqual(['graph_version_mismatch', 'invalid_revision', 'invalid_traffic:AB']);
      const dup = plan(graph, [center('ctr', 'C'), center('ctr', 'A')], req, {
        stationReadings: [reading('SM1', 1), reading('SM1', 2)],
        traffic: [
          { edgeId: 'AB', value: 0.2 },
          { edgeId: 'AB', value: 0.4 },
        ],
      });
      expect(dup.status === 'invalid_conditions' && dup.issues).toEqual(['duplicate_station_reading:SM1', 'duplicate_traffic:AB', 'duplicate_center:ctr']);
    });

    it('refuses to route when a closure or avoidance mark cannot be mapped onto the graph (invariant 6)', () => {
      const result = plan(ladder(), [center('ctr', 'C')], request(0, -5, { avoidEdgeIds: ['gone-2'] }), { closedEdgeIds: ['gone-1', 'AB'] });
      expect(result).toMatchObject({ status: 'restrictions_unmapped', unmappedEdgeIds: ['gone-1', 'gone-2'] });
    });

    it('is not affected by mutating the inputs after an async plan has started', async () => {
      const graph = ladder();
      const closed = ['BC'];
      const input: PlanRouteInput = { graph, conditions: conditions(graph, { closedEdgeIds: closed }), centers: [center('ctr', 'C')], request: request(0, -5), profile: FINE };
      const pending = planEvacuationRouteAsync(input, { yieldControl: () => Promise.resolve() });
      closed.length = 0;
      expect(ok(await pending).best.edgeIds).toEqual(['AD', 'DE', 'EC']);
    });
  });
});

// --- Independent reference solver: Bellman-Ford over explicitly listed directed arcs. -------

function randomGraph(random: () => number, size: number): { graph: RoutingGraph; centers: RoutingCenter[] } {
  const nodes: Record<string, [number, number]> = {};
  const used = new Set<string>();
  for (let i = 0; i < size; i++) {
    let position: [number, number];
    do position = [Math.round(random() * 600), Math.round(random() * 600)];
    while (used.has(position.join()));
    used.add(position.join());
    nodes[`n${i}`] = position;
  }
  const edges: EdgeSpec[] = [];
  const accesses: PedestrianAccess[] = ['both', 'both', 'both', 'both', 'forward', 'backward', 'none'];
  for (let i = 1; i < size; i++) {
    edges.push({ id: `e${i}-t`, from: `n${Math.floor(random() * i)}`, to: `n${i}`, access: accesses[Math.floor(random() * accesses.length)], name: null });
  }
  for (let k = 0; k < size; k++) {
    const a = Math.floor(random() * size);
    const b = Math.floor(random() * size);
    if (a !== b) edges.push({ id: `x${k}`, from: `n${a}`, to: `n${b}`, access: accesses[Math.floor(random() * accesses.length)], name: null });
  }
  const stationEdges = [
    { stationId: 'S1', edgeIds: edges.filter(() => random() < 0.4).map(e => e.id) },
    { stationId: 'S2', edgeIds: edges.filter(() => random() < 0.4).map(e => e.id) },
  ];
  const availability = ['available', 'available', 'unknown', 'unavailable'] as const;
  const centers = [1, 2, 3, 4].map(k =>
    center(`c${k}`, `n${size - k}`, { availability: availability[Math.floor(random() * availability.length)] }),
  );
  return { graph: makeGraph(nodes, edges, { stationEdges }), centers };
}

function nodeRequest(graph: PreparedRoutingGraph, nodeId: string, partial: Partial<RouteRequest> = {}): RouteRequest {
  const node = graph.nodes[graph.nodeIndex.get(nodeId) ?? -1];
  return { origin: { lat: node.lat, lng: node.lng, accuracyMeters: 0, revision: 1 }, originEdgeId: null, centerId: null, avoidEdgeIds: [], ...partial };
}

function bellmanFord(graph: RoutingGraph, source: string, blocked: ReadonlySet<string>, weightOf: (edge: RoutingEdge) => number): Map<string, number> {
  const arcs: [string, string, number][] = [];
  for (const edge of graph.edges) {
    if (blocked.has(edge.id)) continue;
    const w = weightOf(edge);
    if (edge.pedestrianAccess === 'both' || edge.pedestrianAccess === 'forward') arcs.push([edge.from, edge.to, w]);
    if (edge.pedestrianAccess === 'both' || edge.pedestrianAccess === 'backward') arcs.push([edge.to, edge.from, w]);
  }
  const dist = new Map<string, number>([[source, 0]]);
  for (let round = 0; round < graph.nodes.length; round++) {
    let changed = false;
    for (const [u, v, w] of arcs) {
      const du = dist.get(u);
      if (du !== undefined && du + w < (dist.get(v) ?? Infinity)) {
        dist.set(v, du + w);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return dist;
}

describe('reference solver comparison', () => {
  it('matches Bellman-Ford for best, shortest and every center on 150 random graphs', () => {
    const random = rng(2026);
    let compared = 0;
    for (let trial = 0; trial < 150; trial++) {
      const { graph, centers } = randomGraph(random, 6 + Math.floor(random() * 20));
      const prepared = prepare(graph);
      const closed = graph.edges.filter(() => random() < 0.15).map(e => e.id);
      const readings = [reading('S1', 18 + random() * 3), reading('S2', 17 + random() * 3)];
      const result = plan(prepared, centers, nodeRequest(prepared, 'n0'), { closedEdgeIds: closed, stationReadings: readings });

      const risk = new Map<string, number>();
      for (const entry of graph.stationEdges) {
        const r = readings.find(x => x.stationId === entry.stationId);
        const ratio = Math.min(1, Math.max(0, ((r?.levelMeters ?? 0) - 18) / 2));
        for (const id of entry.edgeIds) risk.set(id, Math.max(risk.get(id) ?? 0, ratio * ratio));
      }
      const blocked = new Set(closed);
      const weighted = bellmanFord(graph, 'n0', blocked, e => e.lengthMeters * (1 + 10 * (risk.get(e.id) ?? 0)));
      const metric = bellmanFord(graph, 'n0', blocked, e => e.lengthMeters);

      const routable = centers.filter(c => c.availability !== 'unavailable');
      const tierOf = (tier: 'available' | 'unknown') => routable.filter(c => c.availability === tier && weighted.has(c.entranceNodeId ?? ''));
      const tier = tierOf('available').length > 0 ? tierOf('available') : tierOf('unknown');
      const noAttach = !graph.edges.some(e => e.pedestrianAccess !== 'none' && !blocked.has(e.id) && (e.from === 'n0' || e.to === 'n0'));

      // With every segment at n0 blocked the origin attaches to another segment, so the
      // node-to-node reference does not apply.
      if (noAttach) continue;
      if (tier.length === 0) {
        expect(['no_route_within_coverage', 'center_unavailable']).toContain(result.status);
        continue;
      }
      if (result.status !== 'ok') throw new Error(`trial ${trial}: expected ok, got ${result.status}`);
      compared++;
      const expectedBest = Math.min(...tier.map(c => weighted.get(c.entranceNodeId ?? '') ?? Infinity));
      const expectedShortest = Math.min(...tier.map(c => metric.get(c.entranceNodeId ?? '') ?? Infinity));
      expect(result.best.cost).toBeCloseTo(expectedBest, 6);
      expect((result.shortest ?? result.best).distanceMeters).toBeCloseTo(expectedShortest, 6);
      for (const summary of result.centers) {
        const c = centers.find(x => x.id === summary.centerId);
        const expected = c && c.availability !== 'unavailable' ? weighted.get(c.entranceNodeId ?? '') : undefined;
        if (expected === undefined) expect(summary.cost).toBeNull();
        else expect(summary.cost).toBeCloseTo(expected, 6);
      }
      for (const path of [result.best, result.shortest]) {
        if (path === null) continue;
        for (const id of path.edgeIds) expect(blocked.has(id)).toBe(false);
      }
    }
    expect(compared).toBeGreaterThan(60);
  });

  it('agrees between the one-to-many ranking and single-target runs', () => {
    const random = rng(7);
    let checked = 0;
    for (let trial = 0; trial < 40; trial++) {
      const { graph, centers } = randomGraph(random, 16);
      const prepared = prepare(graph);
      const all = plan(prepared, centers, nodeRequest(prepared, 'n0'), { stationReadings: [reading('S1', 19.2)] });
      if (all.status !== 'ok') continue;
      for (const summary of all.centers) {
        if (summary.cost === null) continue;
        const single = ok(plan(prepared, centers, nodeRequest(prepared, 'n0', { centerId: summary.centerId }), { stationReadings: [reading('S1', 19.2)] }));
        expect(single.best.cost).toBeCloseTo(summary.cost, 9);
        expect(single.best.distanceMeters).toBeCloseTo(summary.distanceMeters ?? NaN, 9);
        checked++;
      }
      const firstAvailable = all.centers.find(c => c.cost !== null && c.availability === 'available');
      if (firstAvailable) expect(all.best.cost).toBeCloseTo(firstAvailable.cost ?? NaN, 9);
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('returns identical results for any input order', () => {
    const random = rng(99);
    for (let trial = 0; trial < 30; trial++) {
      const { graph, centers } = randomGraph(random, 14);
      const closed = graph.edges.filter(() => random() < 0.1).map(e => e.id);
      const run = (g: RoutingGraph, cs: RoutingCenter[], cl: string[]) => {
        const prepared = prepare(g);
        return plan(prepared, cs, nodeRequest(prepared, 'n0'), { closedEdgeIds: cl, stationReadings: [reading('S2', 18.7), reading('S1', 19.4)] });
      };
      const baseline = run(graph, centers, closed);
      const permuted = run(
        { ...graph, nodes: shuffled(graph.nodes, random), edges: shuffled(graph.edges, random), stationEdges: shuffled(graph.stationEdges, random) },
        shuffled(centers, random),
        shuffled(closed, random),
      );
      expect(permuted).toEqual(baseline);
    }
  });
});

describe('scope fixtures: Ampid I box (D9)', () => {
  // Measured R0 bounding box of the Ampid I trace: 1.83 km × 1.41 km.
  const SOUTH = 14.673944;
  const NORTH = 14.686638;
  const WEST = 121.110227;
  const EAST = 121.127262;
  const COLS = 13;
  const ROWS = 10;

  function ampidBox(): { graph: RoutingGraph; station: { lat: number; lng: number } } {
    const nodes: RoutingGraph['nodes'][number][] = [];
    const id = (r: number, c: number) => `g${r}-${c}`;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        nodes.push({ id: id(r, c), lat: SOUTH + ((NORTH - SOUTH) * r) / (ROWS - 1), lng: WEST + ((EAST - WEST) * c) / (COLS - 1) });
      }
    }
    const byId = new Map(nodes.map(n => [n.id, n]));
    const edges: RoutingEdge[] = [];
    const link = (a: string, b: string) => {
      const na = byId.get(a);
      const nb = byId.get(b);
      if (!na || !nb) return;
      const geometry: LngLat[] = [[na.lng, na.lat], [nb.lng, nb.lat]];
      edges.push({ id: `${a}_${b}`, from: a, to: b, geometry, lengthMeters: lineLength(geometry), name: null, pedestrianAccess: 'both', stairs: false, bridge: false, sourceRef: `grid:${a}_${b}` });
    };
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (c + 1 < COLS) link(id(r, c), id(r, c + 1));
        if (r + 1 < ROWS) link(id(r, c), id(r + 1, c));
      }
    }
    // Hypothetical station at the box center: real station coordinates are not yet known (plan 3.1).
    const station = { lat: (SOUTH + NORTH) / 2, lng: (WEST + EAST) / 2 };
    const pad = 0.002;
    const coverage: LngLat[][] = [[[WEST - pad, SOUTH - pad], [EAST + pad, SOUTH - pad], [EAST + pad, NORTH + pad], [WEST - pad, NORTH + pad], [WEST - pad, SOUTH - pad]]];
    const stationEdges = [{ stationId: 'CRIT', edgeIds: stationApplicableEdgeIds(edges, station, FINE) }];
    return { graph: { version: 'ampid-box', coverage, nodes, edges, barriers: [], stationEdges }, station };
  }

  it('a 2 km sensor radius covers every edge of the barangay', () => {
    const { graph } = ampidBox();
    expect(graph.stationEdges[0].edgeIds).toHaveLength(graph.edges.length);
  });

  it('the literal "remove every edge within 2 km of a critical station" rule leaves no safe path for anyone', () => {
    const { graph } = ampidBox();
    const prepared = prepare(graph);
    const result = plan(prepared, [center('ctr', 'g9-12')], nodeRequest(prepared, 'g0-0'), {
      stationReadings: [reading('CRIT', 21)],
      modelExcludedEdgeIds: graph.stationEdges[0].edgeIds,
    });
    expect(result.status).toBe('no_route_within_coverage');
  });

  it('the D9 rule keeps a route, applies f = 1 everywhere and raises the area warning', () => {
    const { graph } = ampidBox();
    const prepared = prepare(graph);
    const result = ok(plan(prepared, [center('ctr', 'g9-12')], nodeRequest(prepared, 'g0-0'), { stationReadings: [reading('CRIT', 21)] }));
    expect(result.best.cost).toBeCloseTo(result.best.distanceMeters * 11, 6);
    expect(result.shortest).toBeNull(); // uniform f cannot change which path wins
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'station_level', stationId: 'CRIT', level: 'critical' }));
  });
});

describe('cancellation and cooperative yielding', () => {
  function bigGrid(): PreparedRoutingGraph {
    const size = 40;
    const nodes: Record<string, [number, number]> = {};
    const edges: EdgeSpec[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        nodes[`${r}-${c}`] = [c * 30, r * 30];
        if (c > 0) edges.push({ id: `h${r}-${c}`, from: `${r}-${c - 1}`, to: `${r}-${c}`, name: null });
        if (r > 0) edges.push({ id: `v${r}-${c}`, from: `${r - 1}-${c}`, to: `${r}-${c}`, name: null });
      }
    }
    return prepare(makeGraph(nodes, edges));
  }

  it('returns cancelled when the token is already aborted', () => {
    const graph = ladder();
    const input: PlanRouteInput = { graph, conditions: conditions(graph), centers: [center('ctr', 'C')], request: request(0, -5), profile: FINE };
    expect(planEvacuationRoute(input, { aborted: true })).toMatchObject({ status: 'cancelled', provenance: { originRevision: 7 } });
  });

  it('yields during long searches, matches the synchronous result, and stops when cancelled', async () => {
    const graph = bigGrid();
    const input: PlanRouteInput = { graph, conditions: conditions(graph), centers: [center('ctr', '39-39')], request: nodeRequest(graph, '0-0'), profile: FINE };
    const sync = planEvacuationRoute(input);
    let yields = 0;
    const asyncResult = await planEvacuationRouteAsync(input, { yieldControl: async () => { yields++; } });
    expect(asyncResult).toEqual(sync);
    expect(yields).toBeGreaterThan(0);

    const token = { aborted: false };
    let yieldsBeforeCancel = 0;
    const cancelled = await planEvacuationRouteAsync(input, {
      cancel: token,
      yieldControl: async () => {
        yieldsBeforeCancel++;
        token.aborted = true;
      },
    });
    expect(cancelled.status).toBe('cancelled');
    expect(yieldsBeforeCancel).toBe(1);
  });
});

describe('BFS flood propagation (RRL Algorithm 1, plan 3.3)', () => {
  // rrl-reference grid: 6 × 5 cells of 500 m. Values are elevations in meters; null = no terrain.
  // Cell 10 (8.5 m) is reachable only through the east basin, so a lower seed that claimed the
  // basin first would wrongly stop the higher one there.
  const ELEVATIONS: (number | null)[][] = [
    // row 0 (south)
    [5, 6, 30, 4, 4, 12],
    [6, 7, 30, 4, 8.5, 12],
    [8, 7, 30, 5, null, 12],
    [9, 9, 30, 6, 6, 12],
    [12, 12, 12, 12, 7, 9],
  ];
  const grid = (cellSize = 500): FloodGrid => ({
    cellSizeMeters: cellSize,
    cols: 6,
    rows: 5,
    originLat: BASE_LAT,
    originLng: BASE_LNG,
    elevations: ELEVATIONS.flat(),
  });
  const stationAt = (stationId: string, col: number, row: number, levelMeters: number | null, criticalMeters = 5): FloodStation => {
    const [lng, lat] = at(col * 500 + 250, row * 500 + 250);
    return { stationId, lat, lng, levelMeters, criticalMeters };
  };

  /** Independent per-seed flood fill (recursive DFS), union over seeds. */
  function referenceFill(g: FloodGrid, seeds: { cell: number; surface: number }[]): number[] {
    const flooded = new Set<number>();
    for (const seed of seeds) {
      const seen = new Set<number>([seed.cell]);
      const visit = (cell: number) => {
        flooded.add(cell);
        const r = Math.floor(cell / g.cols);
        const c = cell % g.cols;
        for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
          if (nr < 0 || nc < 0 || nr >= g.rows || nc >= g.cols) continue;
          const n = nr * g.cols + nc;
          const elevation = g.elevations[n];
          if (seen.has(n) || elevation === null || elevation > seed.surface) continue;
          seen.add(n);
          visit(n);
        }
      };
      visit(seed.cell);
    }
    return [...flooded].sort((a, b) => a - b);
  }

  const STATIONS = [stationAt('low', 0, 0, 6.5, 6), stationAt('high', 3, 0, 8, 5), stationAt('mid', 5, 4, 9, 9)];

  it('maps station positions to cells and ignores those outside the grid', () => {
    expect(floodGridCellAt(grid(), stationAt('x', 3, 2, 1))).toBe(2 * 6 + 3);
    const [lng, lat] = at(-10, 10);
    expect(floodGridCellAt(grid(), { lat, lng })).toBe(-1);
  });

  it('floods the union of per-seed fills, invariant to seed input order (D2)', () => {
    const expected = referenceFill(grid(), [
      { cell: 0, surface: 6.5 },
      { cell: 3, surface: 8 },
      { cell: 29, surface: 9 },
    ]);
    expect(expected).toContain(10);
    const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    for (const order of orders) {
      const outcome = runFloodBfs(grid(), order.map(i => STATIONS[i]), REFERENCE);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.result.floodedCells).toEqual(expected);
      expect(outcome.result.seeds.map(s => s.stationId)).toEqual(['mid', 'high', 'low']);
    }
  });

  it('does not let a low seed block a higher seed from a shared cell', () => {
    // Both stations sit in cell 3 (elevation 4). The lower one alone floods only the east basin.
    const outcome = runFloodBfs(grid(), [stationAt('a-low', 3, 0, 5, 5), stationAt('b-high', 3, 0, 8, 5)], REFERENCE);
    expect(outcome.ok && outcome.result.floodedCells).toEqual(referenceFill(grid(), [{ cell: 3, surface: 8 }]));
  });

  it('stops at higher ground and reports missing terrain as unknown, not dry', () => {
    const outcome = runFloodBfs(grid(), [stationAt('high', 3, 0, 8, 5)], REFERENCE);
    if (!outcome.ok) throw new Error('grid invalid');
    expect(outcome.result.floodedCells.some(cell => cell % 6 <= 2)).toBe(false); // the 30 m ridge holds
    expect(outcome.result.unknownCells).toEqual([2 * 6 + 4]);
  });

  it('reports stations that are outside the grid, unknown or below Critical, and floods nothing without seeds', () => {
    const [lng, lat] = at(-5000, 0);
    const outcome = runFloodBfs(
      grid(),
      [
        { stationId: 'far', lat, lng, levelMeters: 50, criticalMeters: 5 },
        stationAt('silent', 1, 1, null),
        stationAt('calm', 1, 1, 4.9),
        { stationId: 'broken', lat: Number.NaN, lng, levelMeters: 9, criticalMeters: 5 },
      ],
      REFERENCE,
    );
    expect(outcome).toEqual({
      ok: true,
      result: {
        floodedCells: [],
        unknownCells: [],
        seeds: [],
        ignored: [
          { stationId: 'broken', reason: 'invalid_position' },
          { stationId: 'calm', reason: 'below_critical' },
          { stationId: 'far', reason: 'outside_grid' },
          { stationId: 'silent', reason: 'reading_unknown' },
        ],
      },
    });
  });

  it('rejects a grid that does not match the profile or is malformed', () => {
    expect(runFloodBfs(grid(500), [], FINE)).toEqual({ ok: false, issues: ['cell_size_mismatch'] });
    expect(runFloodBfs({ ...grid(), elevations: [1, 2] }, [], REFERENCE)).toEqual({ ok: false, issues: ['elevation_count_mismatch'] });
    expect(runFloodBfs({ ...grid(), cols: 0 }, [], REFERENCE)).toMatchObject({ ok: false, issues: ['invalid_dimensions'] });
    expect(runFloodBfs({ ...grid(), elevations: ELEVATIONS.flat().map(e => (e === 30 ? Number.NaN : e)) }, [], REFERENCE)).toEqual({
      ok: false,
      issues: ['invalid_elevation'],
    });
    expect(runFloodBfs(grid(), [STATIONS[0], STATIONS[0]], REFERENCE)).toEqual({ ok: false, issues: ['duplicate_station:low'] });
  });

  it('runs on the production 50 m profile', () => {
    const fine: FloodGrid = { cellSizeMeters: 50, cols: 3, rows: 1, originLat: BASE_LAT, originLng: BASE_LNG, elevations: [1, 2, 3] };
    const [lng, lat] = at(25, 25);
    const outcome = runFloodBfs(fine, [{ stationId: 's', lat, lng, levelMeters: 2.5, criticalMeters: 2 }], FINE);
    expect(outcome.ok && outcome.result.floodedCells).toEqual([0, 1]);
  });
});
