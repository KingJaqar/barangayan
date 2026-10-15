import { describe, expect, it } from 'vitest';
import { routingConditionsSnapshotSchema } from '../schemas/routing-conditions';
import { prepareRoutingGraph, type PreparedRoutingGraph } from './evacuation-routing';
import {
  ROUTE_SERVICE_LIMITS,
  parseRouteConditionsSnapshot,
  parseRouteServiceRequest,
  selectRouteConditions,
  type RouteConditionsSnapshot,
} from './evacuation-route-service';

const GRAPH_VERSION = 'test-1@2026-10-12#aaaaaaaaaaaa';

function graph(): PreparedRoutingGraph {
  const prepared = prepareRoutingGraph({
    version: GRAPH_VERSION,
    coverage: [[[121.1, 14.67], [121.13, 14.67], [121.13, 14.69], [121.1, 14.69], [121.1, 14.67]]],
    nodes: [
      { id: 'n1', lat: 14.68, lng: 121.11 },
      { id: 'n2', lat: 14.68, lng: 121.111 },
      { id: 'n3', lat: 14.681, lng: 121.111 },
    ],
    edges: [
      { id: 'w1:n1-n2', from: 'n1', to: 'n2', geometry: [[121.11, 14.68], [121.111, 14.68]], lengthMeters: 107.6, name: 'A St', pedestrianAccess: 'both', stairs: false, bridge: false, sourceRef: 'osm:way/1/n1-n2' },
      { id: 'w2:n2-n3', from: 'n2', to: 'n3', geometry: [[121.111, 14.68], [121.111, 14.681]], lengthMeters: 111.2, name: 'B St', pedestrianAccess: 'both', stairs: false, bridge: false, sourceRef: 'osm:way/2/n2-n3' },
    ],
    barriers: [],
    stationEdges: [],
  });
  if (!prepared.ok) throw new Error(JSON.stringify(prepared.issues));
  return prepared.graph;
}

const origin = { lat: 14.68, lng: 121.1105, accuracyMeters: 12, revision: 3 };

describe('parseRouteServiceRequest', () => {
  it('accepts a minimal request and fills defaults', () => {
    const parsed = parseRouteServiceRequest({ origin });
    expect(parsed).toEqual({
      ok: true,
      value: { graphVersion: null, origin, originEdgeId: null, centerId: null, avoidEdgeIds: [], minConditionsRevision: null },
    });
  });

  it('accepts every field and copies the avoidance list', () => {
    const avoidEdgeIds = ['w1:n1-n2'];
    const parsed = parseRouteServiceRequest({
      graphVersion: GRAPH_VERSION,
      origin: { ...origin, accuracyMeters: null },
      originEdgeId: 'w2:n2-n3',
      centerId: '00000000-0000-0000-0000-00000000c002',
      avoidEdgeIds,
      minConditionsRevision: 12,
    });
    if (!parsed.ok) throw new Error(parsed.message);
    avoidEdgeIds.push('w2:n2-n3');
    expect(parsed.value.avoidEdgeIds).toEqual(['w1:n1-n2']);
    expect(parsed.value.origin.accuracyMeters).toBeNull();
    expect(parsed.value.minConditionsRevision).toBe(12);
  });

  it('leaves coordinate ranges to the routing core (invalid_origin)', () => {
    expect(parseRouteServiceRequest({ origin: { ...origin, lat: 95 } }).ok).toBe(true);
  });

  it.each([
    ['a non-object body', []],
    ['null', null],
    ['an unknown top-level field', { origin, mode: 'fast' }],
    ['a missing origin', {}],
    ['an unknown origin field', { origin: { ...origin, altitude: 3 } }],
    ['string coordinates', { origin: { ...origin, lat: '14.68' } }],
    ['a string accuracy', { origin: { ...origin, accuracyMeters: '12' } }],
    ['a missing revision', { origin: { lat: 14.68, lng: 121.11, accuracyMeters: null } }],
    ['a negative revision', { origin: { ...origin, revision: -1 } }],
    ['a fractional revision', { origin: { ...origin, revision: 1.5 } }],
    ['a malformed graph version', { origin, graphVersion: 'ampid-1' }],
    ['a segment id with spaces', { origin, graphVersion: GRAPH_VERSION, originEdgeId: 'w1 n1' }],
    ['an over-long center id', { origin, centerId: 'c'.repeat(161) }],
    ['a non-array avoidance list', { origin, graphVersion: GRAPH_VERSION, avoidEdgeIds: 'w1:n1-n2' }],
    ['too many avoided segments', { origin, graphVersion: GRAPH_VERSION, avoidEdgeIds: Array.from({ length: ROUTE_SERVICE_LIMITS.maxAvoidEdgeIds + 1 }, (_, i) => `w${i}:a-b`) }],
    ['segment ids without a graph version', { origin, avoidEdgeIds: ['w1:n1-n2'] }],
    ['a chosen segment without a graph version', { origin, originEdgeId: 'w1:n1-n2' }],
    ['a negative conditions revision', { origin, minConditionsRevision: -2 }],
  ])('rejects %s', (_label, body) => {
    const parsed = parseRouteServiceRequest(body);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message.length).toBeGreaterThan(0);
  });

  it('accepts exactly the maximum number of avoided segments', () => {
    const avoidEdgeIds = Array.from({ length: ROUTE_SERVICE_LIMITS.maxAvoidEdgeIds }, (_, i) => `w${i}:a-b`);
    expect(parseRouteServiceRequest({ origin, graphVersion: GRAPH_VERSION, avoidEdgeIds }).ok).toBe(true);
  });
});

// A get_routing_conditions_snapshot result in the shape migration 0113 returns.
function snapshotJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    areaId: 'test-1',
    revision: 7,
    revisedAt: '2026-10-13T01:22:17.815541+00:00',
    generatedAt: '2026-10-13T01:25:59.191508+00:00',
    graphVersion: GRAPH_VERSION,
    activeGraphVersion: GRAPH_VERSION,
    graphStatus: 'active',
    closures: [
      {
        id: '5a08e60b-4514-4ead-aacc-63482aae7e65',
        label: 'B St',
        reason: 'Flooded',
        observedAt: '2026-10-13T01:00:00+00:00',
        publishedAt: '2026-10-13T01:05:00+00:00',
        revision: 6,
        sourceRefs: ['osm:way/2/n2-n3'],
        geometry: { type: 'MultiLineString', coordinates: [[[121.111, 14.68], [121.111, 14.681]]] },
        edgeIds: ['w2:n2-n3'],
      },
    ],
    centers: [
      { id: '00000000-0000-0000-0000-00000000c001', name: 'North Hall', active: true, availability: 'available', availabilityUpdatedAt: null, position: { lat: 14.681, lng: 121.111 }, entrancePosition: { lat: 14.681, lng: 121.111 }, entranceNodeId: 'n3', revision: 2 },
      { id: '00000000-0000-0000-0000-00000000c002', name: 'Closed Court', active: false, availability: 'unknown', availabilityUpdatedAt: null, position: null, entrancePosition: null, entranceNodeId: null, revision: 5 },
    ],
    tombstones: [{ entityType: 'road_closure', id: '6a08e60b-4514-4ead-aacc-63482aae7e65', revision: 4, removedAt: '2026-10-13T00:50:00+00:00' }],
    ...overrides,
  };
}

const closure = (snapshotJson().closures as Record<string, unknown>[])[0];
const center = (snapshotJson().centers as Record<string, unknown>[])[0];

describe('parseRouteConditionsSnapshot', () => {
  it('reads the routing fields of a complete snapshot', () => {
    expect(parseRouteConditionsSnapshot(snapshotJson())).toEqual({
      areaId: 'test-1',
      revision: 7,
      revisedAt: '2026-10-13T01:22:17.815541+00:00',
      generatedAt: '2026-10-13T01:25:59.191508+00:00',
      graphVersion: GRAPH_VERSION,
      graphStatus: 'active',
      closures: [{ id: '5a08e60b-4514-4ead-aacc-63482aae7e65', edgeIds: ['w2:n2-n3'] }],
      centers: [
        { id: '00000000-0000-0000-0000-00000000c001', name: 'North Hall', entranceNodeId: 'n3', availability: 'available', active: true },
        { id: '00000000-0000-0000-0000-00000000c002', name: 'Closed Court', entranceNodeId: null, availability: 'unknown', active: false },
      ],
    });
  });

  it('agrees with the shared zod schema on the valid snapshot', () => {
    expect(routingConditionsSnapshotSchema.safeParse(snapshotJson()).success).toBe(true);
  });

  it.each([
    ['another schema version', { schemaVersion: 2 }],
    ['a negative revision', { revision: -1 }],
    ['a missing revision time', { revisedAt: undefined }],
    ['an unknown graph status', { graphStatus: 'pending' }],
    ['closures that are not a list', { closures: null }],
    ['a closure with non-string edge ids', { closures: [{ ...closure, edgeIds: [1] }] }],
    ['a closure without an id', { closures: [{ ...closure, id: undefined }] }],
    ['an unknown availability', { centers: [{ ...center, availability: 'full' }] }],
    ['a center without the active flag', { centers: [{ ...center, active: undefined }] }],
    ['a numeric entrance node', { centers: [{ ...center, entranceNodeId: 3 }] }],
  ])('rejects %s, as the zod schema does', (_label, overrides) => {
    const json = snapshotJson(overrides);
    expect(parseRouteConditionsSnapshot(json)).toBeNull();
    expect(routingConditionsSnapshotSchema.safeParse(json).success).toBe(false);
  });

  it('keeps an unmapped closure as null (never dropped)', () => {
    const parsed = parseRouteConditionsSnapshot(snapshotJson({ closures: [{ ...closure, edgeIds: null }] }));
    expect(parsed?.closures).toEqual([{ id: '5a08e60b-4514-4ead-aacc-63482aae7e65', edgeIds: null }]);
  });
});

describe('selectRouteConditions', () => {
  function parsed(overrides: Record<string, unknown> = {}): RouteConditionsSnapshot {
    const snapshot = parseRouteConditionsSnapshot(snapshotJson(overrides));
    if (snapshot === null) throw new Error('fixture snapshot invalid');
    return snapshot;
  }

  it('compiles closure-only conditions for the active graph', () => {
    const selection = selectRouteConditions(parsed(), graph(), null);
    expect(selection).toEqual({
      ok: true,
      conditions: { graphVersion: GRAPH_VERSION, revision: 7, closedEdgeIds: ['w2:n2-n3'], modelExcludedEdgeIds: [], stationReadings: [], traffic: [] },
      centers: parsed().centers,
    });
  });

  it('merges overlapping closures into one sorted list', () => {
    const closures = [
      { ...closure, id: 'c2', edgeIds: ['w2:n2-n3', 'w1:n1-n2'] },
      { ...closure, id: 'c1', edgeIds: ['w2:n2-n3'] },
    ];
    const selection = selectRouteConditions(parsed({ closures }), graph(), null);
    expect(selection.ok && selection.conditions.closedEdgeIds).toEqual(['w1:n1-n2', 'w2:n2-n3']);
  });

  it.each(['registered', 'unregistered', 'none'])('refuses a %s graph', graphStatus => {
    expect(selectRouteConditions(parsed({ graphStatus }), graph(), null)).toEqual({ ok: false, reason: 'graph_not_active' });
  });

  it('refuses a snapshot for another graph version', () => {
    const other = 'test-1@2026-10-13#bbbbbbbbbbbb';
    expect(selectRouteConditions(parsed({ graphVersion: other, activeGraphVersion: other }), graph(), null)).toEqual({
      ok: false,
      reason: 'graph_not_active',
    });
  });

  it('refuses a snapshot older than one the client has seen', () => {
    expect(selectRouteConditions(parsed(), graph(), 8)).toEqual({ ok: false, reason: 'snapshot_outdated' });
    expect(selectRouteConditions(parsed(), graph(), 7).ok).toBe(true);
  });

  it('refuses to route while a verified closure is unmapped or maps to unknown segments', () => {
    expect(selectRouteConditions(parsed({ closures: [{ ...closure, edgeIds: null }] }), graph(), null)).toEqual({
      ok: false,
      reason: 'closures_unmapped',
    });
    expect(selectRouteConditions(parsed({ closures: [{ ...closure, edgeIds: ['w9:n8-n9'] }] }), graph(), null)).toEqual({
      ok: false,
      reason: 'closures_unmapped',
    });
  });

  it('treats an empty closure list as no reported closures', () => {
    const selection = selectRouteConditions(parsed({ closures: [] }), graph(), null);
    expect(selection.ok && selection.conditions.closedEdgeIds).toEqual([]);
  });
});
