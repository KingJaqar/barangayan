import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ROUTING_PROFILES,
  distanceToPolylineMeters,
  floodGridCellAt,
  isInsideCoverage,
  planEvacuationRoute,
  prepareRoutingGraph,
  runFloodBfs,
  stationApplicableEdgeIds,
  type LngLat,
  type RoutingCenter,
  type RoutingPoint,
} from './evacuation-routing';
import {
  COVERAGE_MARGIN_METERS,
  COVERAGE_TOLERANCE_METERS,
  bufferBoundary,
  buildRoutingPack,
  mapEdgesAcrossGraphs,
  parseBoundaryGeoJson,
  parseOverpassJson,
  parsePackCenters,
  parsePackStations,
  serializeRoutingPack,
  type BuildRoutingPackInput,
  type OsmElement,
  type OsmTags,
  type PackStation,
  type RoutingPack,
} from './routing-pack-builder';

// Synthetic extract on a 400 m square boundary near Ampid I; positions in meters from its SW corner.
const LAT0 = 14.68;
const LNG0 = 121.115;
const M_PER_DEG = (6_371_000 * Math.PI) / 180;
const M_PER_DEG_LNG = M_PER_DEG * Math.cos((LAT0 * Math.PI) / 180);

function at(x: number, y: number): RoutingPoint {
  return { lat: LAT0 + y / M_PER_DEG, lng: LNG0 + x / M_PER_DEG_LNG };
}

function lngLat(x: number, y: number): LngLat {
  const p = at(x, y);
  return [p.lng, p.lat];
}

const BOUNDARY: LngLat[] = [lngLat(0, 0), lngLat(400, 0), lngLat(400, 400), lngLat(0, 400), lngLat(0, 0)];

const NODE_POSITIONS: Record<number, [number, number, OsmTags?]> = {
  1: [-50, 100], 2: [50, 100], 3: [100, 100], 4: [200, 100], 5: [300, 100], 6: [450, 100], 7: [600, 100], 8: [700, 100],
  10: [200, 0], 11: [200, 50, { barrier: 'gate', access: 'no' }], 12: [200, 250], 13: [200, 350], 14: [400, 350],
  15: [100, 175, { barrier: 'bollard' }], 16: [100, 200], 17: [100, 250], 18: [300, 200],
  19: [150, 50], 20: [150, 150], 21: [250, 50], 22: [250, 150], 23: [300, 0], 24: [50, 0], 25: [0, 380], 26: [400, 380],
  30: [-200, 300], 31: [700, 300], 32: [20, 140], 33: [20, 160],
  34: [340, 20], 35: [380, 20], 36: [380, 60], 37: [340, 60], 38: [-100, 450], 39: [-60, 450], 40: [-60, 480],
  41: [380, 200], 42: [380, 280], 43: [330, 220], 44: [360, 250], 45: [60, 200], 46: [60, 240], 47: [85, 235],
  48: [450, 200], 49: [500, 250],
};

const WAYS: [number, number[], OsmTags][] = [
  [100, [1, 2, 3, 4, 5, 6, 7, 8], { highway: 'residential', name: 'Rizal St', oneway: 'yes' }],
  [101, [10, 11, 4, 12], { highway: 'residential', name: 'Luna St' }],
  [102, [12, 13], { highway: 'footway', bridge: 'yes', layer: '1', name: 'Ampid Footbridge' }],
  [103, [13, 14], { highway: 'residential', name: 'Bagong St' }],
  [104, [3, 15, 16, 17], { highway: 'footway', oneway: 'yes' }],
  [105, [5, 18], { highway: 'steps', name: 'Hagdan' }],
  [106, [19, 20], { highway: 'footway', bridge: 'yes', layer: '1' }],
  [107, [21, 22], { highway: 'residential', name: 'Mali St' }],
  [108, [23, 5], { highway: 'service', access: 'private' }],
  [109, [24, 2], { highway: 'residential', foot: 'no', name: 'Bawal St' }],
  [110, [25, 26], { highway: 'motorway', name: 'Expressway' }],
  [111, [43, 44], { highway: 'residential', name: 'Isla St' }],
  [112, [16, 45, 46, 47, 16], { highway: 'residential', name: 'Ikot' }],
  [114, [48, 49], { highway: 'residential', name: 'Labas St' }],
  [120, [30, 31], { waterway: 'river', name: 'Ilog' }],
  [121, [32, 33], { waterway: 'drain', tunnel: 'culvert' }],
  [122, [34, 35, 36, 37, 34], { natural: 'water' }],
  [123, [38, 39, 40, 38], {}],
  [124, [41, 42], { barrier: 'wall' }],
];

function fixtureElements(): OsmElement[] {
  const nodes: OsmElement[] = Object.entries(NODE_POSITIONS).map(([id, [x, y, tags]]) => {
    const p = at(x, y);
    return { type: 'node', id: Number(id), lat: p.lat, lon: p.lng, ...(tags ? { tags } : {}) };
  });
  const ways: OsmElement[] = WAYS.map(([id, refs, tags]) => ({ type: 'way', id, nodes: refs, tags }));
  const relation: OsmElement = { type: 'relation', id: 200, members: [{ type: 'way', ref: 123, role: 'outer' }], tags: { type: 'multipolygon', natural: 'water' } };
  return [...nodes, ...ways, relation];
}

const CENTERS = [
  { id: 'c-1', name: 'Covered Court', ...at(205, 105) },
  { id: 'c-2', name: 'Bagong Hall', ...at(395, 358) },
  { id: 'c-3', name: 'Far School', ...at(50, 350) },
];

function input(overrides: Partial<BuildRoutingPackInput> = {}): BuildRoutingPackInput {
  return {
    areaId: 'fixture',
    extract: { timestampOsmBase: '2026-10-01T00:00:00Z', elements: fixtureElements() },
    boundary: BOUNDARY,
    centers: CENTERS,
    stations: [],
    ...overrides,
  };
}

function build(overrides: Partial<BuildRoutingPackInput> = {}): RoutingPack {
  const result = buildRoutingPack(input(overrides));
  if (!result.ok) throw new Error(result.issues.join(', '));
  return result.pack;
}

function withoutWays(ids: number[], extraNodes: Record<number, number[]> = {}, extraWays: OsmElement[] = []): OsmElement[] {
  return [
    ...fixtureElements()
      .filter(e => !(e.type === 'way' && ids.includes(e.id)))
      .map(e => (e.type === 'way' && extraNodes[e.id] ? { ...e, nodes: extraNodes[e.id] } : e)),
    ...extraWays,
  ];
}

const PACK = build();
const EDGE_IDS = PACK.graph.edges.map(e => e.id);

describe('pack graph (plan section 2)', () => {
  it('produces a graph the routing core accepts, in canonical order and GeoJSON [lng, lat] order', () => {
    const prepared = prepareRoutingGraph(PACK.graph);
    expect(prepared.ok).toBe(true);
    expect(EDGE_IDS).toEqual([...EDGE_IDS].sort());
    expect(PACK.graph.version).toMatch(/^fixture@2026-10-01#[0-9a-f]{12}$/);
    const node4 = PACK.graph.nodes.find(n => n.id === 'n4');
    expect(node4?.lat).toBeCloseTo(at(200, 100).lat, 6);
    expect(PACK.graph.edges[0].geometry[0][0]).toBeGreaterThan(100); // lng first
  });

  it('clips ways to the boundary plus the 150 m margin', () => {
    expect(EDGE_IDS).toContain('w100:5-6'); // node 6 is 50 m outside the boundary, inside the margin
    expect(PACK.graph.nodes.map(n => n.id)).not.toContain('n7'); // 200 m outside
    for (const edge of PACK.graph.edges) {
      for (const [lng, lat] of edge.geometry) expect(isInsideCoverage({ lat, lng }, PACK.graph.coverage)).toBe(true);
    }
  });

  it('splits at shared nodes and keeps grade-separated crossings unconnected', () => {
    expect(EDGE_IDS.filter(id => id.startsWith('w100:'))).toEqual(['w100:1-3', 'w100:3-4', 'w100:4-5', 'w100:5-6']);
    const overpass = PACK.graph.edges.find(e => e.id === 'w106:19-20');
    expect(overpass?.bridge).toBe(true);
    expect(PACK.report.crossingsWithoutJunction.map(c => c.edgeIds)).toEqual([['w100:4-5', 'w107:21-22']]);
  });

  it('applies pedestrian rules, not vehicle rules', () => {
    const edge = (id: string) => PACK.graph.edges.find(e => e.id === id);
    expect(edge('w100:1-3')?.pedestrianAccess).toBe('both'); // vehicle oneway ignored
    expect(edge('w104:3-16')?.pedestrianAccess).toBe('forward'); // oneway on a footway binds walkers
    expect(edge('w105:5-18')?.stairs).toBe(true);
    expect(edge('w102:12-13')?.bridge).toBe(true);
    expect(EDGE_IDS.some(id => id.startsWith('w109:'))).toBe(false); // foot=no
    expect(EDGE_IDS.some(id => id.startsWith('w110:'))).toBe(false); // motorway
    expect(EDGE_IDS).toContain('w108:23-5'); // private: kept, flagged for review
    expect(PACK.report.accessReview).toEqual([expect.objectContaining({ wayId: 108, reason: 'private_access' })]);
  });

  it('turns a blocking gate into two dead ends and lets walkers through a bollard', () => {
    const luna = PACK.graph.edges.filter(e => e.id.startsWith('w101:'));
    expect(luna.map(e => [e.id, e.from, e.to])).toEqual([
      ['w101:10-11', 'n10', 'n11:w101:1a'],
      ['w101:11-4', 'n11:w101:1b', 'n4'],
      ['w101:4-12', 'n4', 'n12'],
    ]);
    expect(PACK.graph.nodes.map(n => n.id)).not.toContain('n15');
    expect(EDGE_IDS).toContain('w104:3-16');
    expect(PACK.report.barrierNodes).toEqual([
      { nodeId: 11, barrier: 'gate', verdict: 'blocking' },
      { nodeId: 15, barrier: 'bollard', verdict: 'passable' },
    ]);
  });

  it('splits closed loops so no edge is a self-loop', () => {
    expect(EDGE_IDS.filter(id => id.startsWith('w112:'))).toEqual(['w112:16-46', 'w112:46-16']);
  });

  it('keeps open water and walls as attachment barriers, but not culverts', () => {
    expect(PACK.graph.barriers.map(b => b.id)).toEqual(['w120', 'w122', 'w123', 'w124']);
  });

  it('clips a river whose only nodes lie far outside the area instead of dropping it', () => {
    // Both river nodes are 1 km outside: a vertex test would lose the water the footbridge crosses.
    const far = fixtureElements().map(e =>
      e.type === 'node' && e.id === 30 ? { ...e, ...{ lat: at(-1000, 300).lat, lon: at(-1000, 300).lng } } : e.type === 'node' && e.id === 31 ? { ...e, lat: at(1400, 300).lat, lon: at(1400, 300).lng } : e,
    );
    const pack = build({ extract: { timestampOsmBase: null, elements: far } });
    const river = pack.graph.barriers.find(b => b.id === 'w120');
    expect(river?.geometry).toHaveLength(2);
    for (const [lng] of river?.geometry ?? []) expect(Math.abs(lng - at(200, 300).lng)).toBeLessThan(0.01);
    expect(pack.map.features.some(f => f.properties.layer === 'water' && f.properties.kind === 'river')).toBe(true);
  });

  it('fails on incomplete references instead of dropping roads', () => {
    const result = buildRoutingPack(input({ extract: { timestampOsmBase: null, elements: fixtureElements().filter(e => !(e.type === 'node' && e.id === 13)) } }));
    expect(result).toEqual({ ok: false, issues: ['missing_node:w102:n13', 'missing_node:w103:n13'] });
    const relationOnly = buildRoutingPack(input({ extract: { timestampOsmBase: null, elements: fixtureElements().filter(e => !(e.type === 'way' && e.id === 123)) } }));
    expect(relationOnly).toEqual({ ok: false, issues: ['missing_way:r200:w123'] });
  });
});

describe('coverage buffer', () => {
  it(`stays within ${COVERAGE_TOLERANCE_METERS} m of the exact ${COVERAGE_MARGIN_METERS} m buffer`, () => {
    const coverage = bufferBoundary(BOUNDARY, COVERAGE_MARGIN_METERS);
    expect(coverage).toHaveLength(1);
    let checked = 0;
    for (let x = -220; x <= 620; x += 7) {
      for (let y = -220; y <= 620; y += 7) {
        const p = at(x, y);
        const inside = isInsideCoverage(p, [BOUNDARY]);
        const distance = inside ? 0 : distanceToPolylineMeters(p, BOUNDARY);
        if (distance <= COVERAGE_MARGIN_METERS - COVERAGE_TOLERANCE_METERS) expect(isInsideCoverage(p, coverage)).toBe(true);
        else if (distance >= COVERAGE_MARGIN_METERS + COVERAGE_TOLERANCE_METERS) expect(isInsideCoverage(p, coverage)).toBe(false);
        else continue;
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10_000);
  });

  it('includes boundary-line points, such as a center on the trace (Ampid 1 Elementary case)', () => {
    for (const [lng, lat] of BOUNDARY) expect(isInsideCoverage({ lat, lng }, PACK.graph.coverage)).toBe(true);
  });
});

describe('review report', () => {
  it('measures centers against the boundary and proposes entrances within 50 m', () => {
    expect(PACK.report.centers.map(c => [c.centerId, c.insideBoundary, c.insideCoverage, c.proposedEntranceNodeId])).toEqual([
      ['c-1', true, true, 'n4'],
      ['c-2', true, true, 'n14'],
      ['c-3', true, true, null],
    ]);
    expect(PACK.report.centers[0].entranceDistanceMeters).toBeCloseTo(7.07, 1);
    expect(PACK.report.centers.map(c => c.entranceOnBoundaryNetwork)).toEqual([true, true, null]);
    expect(PACK.report.centers[2].unreachableEdgeCount).toBeGreaterThan(0);
  });

  it('flags an entrance that lies on a margin-only group (the real Ampid 1 Elementary case)', () => {
    const pack = build({ centers: [{ id: 'm', name: 'Margin Hall', ...at(455, 205) }] });
    expect(pack.report.centers[0]).toMatchObject({ insideBoundary: false, proposedEntranceNodeId: 'n48', entranceOnBoundaryNetwork: false });
    expect(pack.report.centers[0].unreachableEdgeCount).toBe(pack.report.components.reduce((sum, c) => sum + c.insideBoundaryEdgeCount, 0));
  });

  it('lists inside-boundary streets that reach no center, including one-way traps and gated stubs', () => {
    const ways = PACK.report.streetsWithoutCenter.map(w => w.wayId);
    expect(ways).toEqual([101, 104, 106, 107, 111, 112]);
    const luna = PACK.report.streetsWithoutCenter.find(w => w.wayId === 101);
    expect(luna?.edgeCount).toBe(1); // only the stub behind the gate
  });

  it('reports components, bridges and missing inputs', () => {
    expect(PACK.report.components[0].centerIds).toEqual(['c-1', 'c-2']);
    expect(PACK.report.components.length).toBe(6);
    // A margin-only island is listed but is not an Ampid street without a center.
    expect(PACK.report.components.find(c => c.names.includes('Labas St'))).toMatchObject({ insideBoundaryEdgeCount: 0, centerIds: [] });
    expect(PACK.report.bridges.map(b => [b.wayId, b.edgeIds])).toEqual([[102, ['w102:12-13']], [106, ['w106:19-20']]]);
    expect(PACK.report.stations).toEqual({ status: 'unavailable', applicableEdges: [] });
    expect(PACK.report.terrain).toBe('unavailable');
  });
});

describe('routing on a built pack', () => {
  const prepared = prepareRoutingGraph(PACK.graph);
  if (!prepared.ok) throw new Error('fixture graph invalid');
  const centers: RoutingCenter[] = PACK.report.centers.map(c => ({
    id: c.centerId,
    name: c.name,
    entranceNodeId: c.proposedEntranceNodeId,
    availability: 'available',
    active: true,
  }));
  const plan = (point: RoutingPoint, originEdgeId: string | null = null) =>
    planEvacuationRoute({
      graph: prepared.graph,
      conditions: { graphVersion: PACK.graph.version, revision: 0, closedEdgeIds: [], modelExcludedEdgeIds: [], stationReadings: [], traffic: [] },
      centers,
      request: { origin: { ...point, accuracyMeters: 5, revision: 1 }, originEdgeId, centerId: null, avoidEdgeIds: [] },
      profile: ROUTING_PROFILES['ampid-fine'],
    });

  it('routes from a street to the nearest center entrance', () => {
    const result = plan(at(60, 103));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.best.centerId).toBe('c-1');
    expect(result.best.edgeIds).toEqual(['w100:1-3', 'w100:3-4']);
    expect(result.best.distanceMeters).toBeCloseTo(140, 0);
  });

  it('never routes through a grade-separated crossing or a locked gate', () => {
    expect(plan(at(150, 60), 'w106:19-20').status).toBe('no_route_within_coverage');
    expect(plan(at(200, 20), 'w101:10-11').status).toBe('no_route_within_coverage');
  });

  it('crosses the river only on the footbridge', () => {
    const result = plan(at(390, 352));
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.best.centerId).toBe('c-2');
  });
});

describe('server grids and station tables', () => {
  it('builds both profiles from one builder over the coverage, with unknown terrain', () => {
    for (const id of ['ampid-fine', 'rrl-reference'] as const) {
      const grid = PACK.grids[id];
      expect(grid.cellSizeMeters).toBe(ROUTING_PROFILES[id].cellSizeMeters);
      expect(grid.elevations.every(e => e === null)).toBe(true);
      for (const ring of PACK.graph.coverage) for (const [lng, lat] of ring) expect(floodGridCellAt(grid, { lat, lng })).not.toBe(-1);
      const bfs = runFloodBfs(grid, [], ROUTING_PROFILES[id]);
      expect(bfs.ok).toBe(true);
    }
    expect(PACK.grids['ampid-fine'].cols * PACK.grids['ampid-fine'].rows).toBeGreaterThan(100);
  });

  it('computes station-to-edge tables with the 2 km rule and extends the grid to the stations', () => {
    const near: PackStation = { stationId: 'near', ...at(200, 200) };
    const far: PackStation = { stationId: 'far', ...at(200, 5200) };
    const pack = build({ stations: [far, near] });
    expect(pack.graph.stationEdges.map(s => s.stationId)).toEqual(['far', 'near']);
    expect(pack.graph.stationEdges[1].edgeIds).toEqual(stationApplicableEdgeIds(pack.graph.edges, near, ROUTING_PROFILES['ampid-fine']));
    expect(pack.graph.stationEdges[1].edgeIds).toHaveLength(pack.graph.edges.length);
    expect(pack.graph.stationEdges[0].edgeIds).toEqual([]);
    expect(pack.report.stations.status).toBe('verified');
    expect(floodGridCellAt(pack.grids['ampid-fine'], far)).not.toBe(-1);
  });
});

describe('serialization and reproducibility', () => {
  it('is byte-identical for any element order and records true hashes and sizes', () => {
    const shuffled = fixtureElements().reverse();
    shuffled.push(...shuffled.splice(0, 20));
    const a = serializeRoutingPack(PACK);
    const b = serializeRoutingPack(build({ extract: { timestampOsmBase: '2026-10-01T00:00:00Z', elements: shuffled } }));
    expect(b.files).toEqual(a.files);
    for (const resource of a.manifest.resources) {
      const file = a.files.find(f => f.path === resource.path);
      expect(resource.sha256).toBe(createHash('sha256').update(file?.content ?? '').digest('hex'));
      expect(resource.bytes).toBe(Buffer.byteLength(file?.content ?? ''));
    }
    expect(a.manifest.resources.map(r => [r.path, r.audience])).toEqual([
      ['graph.json', 'device'],
      ['map.json', 'device'],
      ['server/grid-ampid-fine.json', 'server'],
      ['server/grid-rrl-reference.json', 'server'],
    ]);
    expect(a.manifest).toMatchObject({ schemaVersion: 1, areaId: 'fixture', stations: 'unavailable', terrain: 'unavailable', coverageMarginMeters: 150 });
    expect(a.budget.withinTargets).toBe(true);
  });

  it('draws a clipped vector map with attribution-ready OSM classes', () => {
    const roads = PACK.map.features.filter(f => f.properties.layer === 'road');
    expect(roads.find(f => f.properties.kind === 'motorway')?.properties.walkable).toBe(false);
    expect(roads.find(f => f.properties.name === 'Rizal St')?.properties.walkable).toBe(true);
    expect(PACK.map.features.filter(f => f.properties.layer === 'water').length).toBe(3);
    for (const f of roads) {
      if (f.geometry.type !== 'LineString') continue;
      for (const [lng, lat] of f.geometry.coordinates) expect(isInsideCoverage({ lat, lng }, PACK.graph.coverage)).toBe(true);
    }
  });
});

describe('segment mappings across graph versions', () => {
  it('keeps unchanged edges, follows splits and merges, and leaves removed segments unresolved', () => {
    const splitNode: OsmElement = { type: 'node', id: 51, lat: at(250, 100).lat, lon: at(250, 100).lng };
    const newNode: OsmElement = { type: 'node', id: 52, lat: at(250, 30).lat, lon: at(250, 30).lng };
    const newWay: OsmElement = { type: 'way', id: 113, nodes: [51, 52], tags: { highway: 'residential' } };
    const split = build({
      extract: { timestampOsmBase: '2026-11-01T00:00:00Z', elements: [...withoutWays([105], { 100: [1, 2, 3, 4, 51, 5, 6, 7, 8] }, [newWay]), splitNode, newNode] },
    });
    const mapping = new Map(mapEdgesAcrossGraphs(PACK.graph, split.graph).map(m => [m.edgeId, m]));
    expect(mapping.get('w100:1-3')).toEqual({ edgeId: 'w100:1-3', status: 'same', successorIds: ['w100:1-3'] });
    expect(mapping.get('w100:4-5')).toEqual({ edgeId: 'w100:4-5', status: 'remapped', successorIds: ['w100:4-51', 'w100:51-5'] });
    expect(mapping.get('w105:5-18')).toEqual({ edgeId: 'w105:5-18', status: 'unresolved', successorIds: [] });

    const merged = build({ extract: { timestampOsmBase: '2026-11-01T00:00:00Z', elements: withoutWays([105, 108]) } });
    const mergedMapping = new Map(mapEdgesAcrossGraphs(PACK.graph, merged.graph).map(m => [m.edgeId, m]));
    expect(mergedMapping.get('w100:4-5')).toEqual({ edgeId: 'w100:4-5', status: 'remapped', successorIds: ['w100:4-6'] });
    expect(mergedMapping.get('w100:5-6')).toEqual({ edgeId: 'w100:5-6', status: 'remapped', successorIds: ['w100:4-6'] });
  });
});

describe('input validation', () => {
  it('rejects malformed Overpass responses', () => {
    expect(parseOverpassJson({})).toEqual({ ok: false, issues: ['not_an_overpass_json_response'] });
    expect(parseOverpassJson({ elements: [{ type: 'node', id: 1, lat: 'x', lon: 1 }] })).toEqual({ ok: false, issues: ['node/1:invalid_coordinates'] });
    expect(parseOverpassJson({ elements: [{ type: 'way', id: 2, nodes: [1] }] })).toEqual({ ok: false, issues: ['way/2:invalid_nodes'] });
    expect(parseOverpassJson({ elements: [{ type: 'node', id: 1, lat: 1, lon: 1, tags: { a: 1 } }] })).toEqual({ ok: false, issues: ['node/1:invalid_tags'] });
    const ok = parseOverpassJson({ osm3s: { timestamp_osm_base: '2026-10-01T00:00:00Z' }, elements: fixtureElements() });
    expect(ok.ok && ok.value.timestampOsmBase).toBe('2026-10-01T00:00:00Z');
  });

  it('requires a closed polygon boundary and well-formed centers and stations', () => {
    const polygon = { type: 'Polygon', coordinates: [BOUNDARY] };
    expect(parseBoundaryGeoJson({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: polygon }] })).toEqual({ ok: true, value: BOUNDARY });
    expect(parseBoundaryGeoJson({ type: 'Polygon', coordinates: [BOUNDARY.slice(0, -1)] })).toEqual({ ok: false, issues: ['boundary_ring_not_closed'] });
    expect(parsePackCenters({ centers: [{ id: 'a', name: 'A', lat: 1, lng: 2 }, { id: 'a', name: 'B', lat: 1, lng: 2 }] })).toEqual({ ok: false, issues: ['centers[1]:duplicate_id'] });
    expect(parsePackCenters({ centers: [{ id: 'a', lat: 1, lng: 2 }] })).toEqual({ ok: false, issues: ['centers:missing_name'] });
    expect(parsePackStations({ stations: [{ stationId: 's', lat: 95, lng: 2 }] })).toEqual({ ok: false, issues: ['stations[0]:invalid'] });
  });
});
