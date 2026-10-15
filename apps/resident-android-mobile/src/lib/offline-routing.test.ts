import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROUTING_PROFILES, planEvacuationRoute, type RoutingGraph } from '@barangayan/shared/src/lib/evacuation-routing';
import {
  ROUTING_AREA_ID,
  STORE_FILES,
  acceptConditions,
  activatePack,
  addAvoidance,
  avoidedEdgeIds,
  localRoutingInputs,
  nearestEdge,
  openStore,
  parseAvoidance,
  parseState,
  parseStoredConditions,
  serializeAvoidance,
  utf8ByteLength,
  verifyPack,
  type LocalAvoidanceRecord,
  type PackFiles,
  type RoutingStorage,
  type StoredConditions,
} from './offline-routing';

const PACK_DIR = resolve(__dirname, '../../../../data/routing-packs/ampid-1/pack');
const BUNDLED: PackFiles = {
  manifest: readFileSync(resolve(PACK_DIR, 'manifest.json'), 'utf8'),
  graph: readFileSync(resolve(PACK_DIR, 'graph.json'), 'utf8'),
  map: readFileSync(resolve(PACK_DIR, 'map.json'), 'utf8'),
};
const BUNDLED_GRAPH = JSON.parse(BUNDLED.graph) as RoutingGraph;
const NOW = () => new Date('2026-10-13T08:00:00Z');

const sha256Hex = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const sha256 = async (text: string) => sha256Hex(text);

/** In-memory storage; `failAfter` throws on the n-th mutating call to simulate a force-stop. */
class MemoryStorage implements RoutingStorage {
  files = new Map<string, string>();
  mutations = 0;
  failAfter = Infinity;

  private mutate() {
    this.mutations++;
    if (this.mutations > this.failAfter) throw new Error('simulated crash');
  }
  async readText(path: string) {
    return this.files.get(path) ?? null;
  }
  async writeText(path: string, text: string) {
    this.mutate();
    this.files.set(path, text);
  }
  async removeFile(path: string) {
    this.mutate();
    this.files.delete(path);
  }
  async removeDirectory(path: string) {
    this.mutate();
    for (const key of [...this.files.keys()]) if (key.startsWith(`${path}/`)) this.files.delete(key);
  }
  async moveDirectory(from: string, to: string) {
    this.mutate();
    for (const key of [...this.files.keys()]) if (key.startsWith(`${to}/`)) this.files.delete(key);
    for (const [key, value] of [...this.files.entries()]) {
      if (key.startsWith(`${from}/`)) {
        this.files.delete(key);
        this.files.set(`${to}/${key.slice(from.length + 1)}`, value);
      }
    }
  }
  async moveFile(from: string, to: string) {
    this.mutate();
    const text = this.files.get(from);
    if (text === undefined) return;
    this.files.delete(from);
    this.files.set(to, text);
  }
  async list(directory: string) {
    const names = new Set<string>();
    for (const key of this.files.keys()) if (key.startsWith(`${directory}/`)) names.add(key.slice(directory.length + 1).split('/')[0]);
    return [...names];
  }
  async sha256(text: string) {
    return sha256(text);
  }
}

/** A pack for a later graph version: one segment renamed (same OSM way and geometry). */
function nextPack(version = 'ampid-1@2026-11-01#aaaaaaaaaaaa', renamedEdgeId = BUNDLED_GRAPH.edges[0].id): PackFiles {
  const graph: RoutingGraph = {
    ...BUNDLED_GRAPH,
    version,
    edges: BUNDLED_GRAPH.edges.map(edge => (edge.id === renamedEdgeId ? { ...edge, id: `${edge.id}-v2` } : edge)),
  };
  const graphText = JSON.stringify(graph);
  const manifest = JSON.parse(BUNDLED.manifest);
  manifest.graphVersion = version;
  manifest.resources = manifest.resources.map((resource: { path: string }) =>
    resource.path === 'graph.json' ? { ...resource, bytes: Buffer.byteLength(graphText), sha256: sha256Hex(graphText) } : resource,
  );
  return { manifest: JSON.stringify(manifest), graph: graphText, map: BUNDLED.map };
}

const CLOSURE_ID = '7a1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const CENTER_A = '11111111-1111-4111-8111-111111111111';
const CENTER_B = '22222222-2222-4222-8222-222222222222';

function snapshot(options: { graphVersion: string; revision?: number; status?: 'active' | 'registered'; closedEdgeIds?: string[] | null; closures?: boolean }) {
  const { graphVersion, revision = 5, status = 'active', closedEdgeIds = [], closures = true } = options;
  const nodes = BUNDLED_GRAPH.nodes;
  return {
    schemaVersion: 1,
    areaId: ROUTING_AREA_ID,
    revision,
    revisedAt: '2026-10-13T07:00:00Z',
    generatedAt: '2026-10-13T07:59:00Z',
    graphVersion,
    activeGraphVersion: status === 'active' ? graphVersion : 'ampid-1@2026-12-01#bbbbbbbbbbbb',
    graphStatus: status,
    closures:
      closures && (closedEdgeIds === null || closedEdgeIds.length > 0)
        ? [
            {
              id: CLOSURE_ID,
              label: 'Test closure',
              reason: 'Flooded',
              observedAt: '2026-10-13T06:00:00Z',
              publishedAt: '2026-10-13T06:10:00Z',
              revision: 3,
              sourceRefs: [],
              geometry: { type: 'MultiLineString', coordinates: [[[121.11, 14.68], [121.111, 14.681]]] },
              edgeIds: closedEdgeIds,
            },
          ]
        : [],
    centers: [
      { id: CENTER_A, name: 'Center A', active: true, availability: 'available', availabilityUpdatedAt: null, position: { lat: nodes[10].lat, lng: nodes[10].lng }, entrancePosition: null, entranceNodeId: nodes[10].id, revision: 1 },
      { id: CENTER_B, name: 'Center B', active: true, availability: 'unknown', availabilityUpdatedAt: null, position: { lat: nodes[500].lat, lng: nodes[500].lng }, entrancePosition: null, entranceNodeId: nodes[500].id, revision: 1 },
    ],
    tombstones: [],
  };
}

function storedConditions(raw: unknown): StoredConditions {
  const accepted = acceptConditions(null, raw, ROUTING_AREA_ID, (raw as { graphVersion: string }).graphVersion, NOW());
  if (!accepted.ok) throw new Error(accepted.reason);
  return accepted.stored;
}

async function installed(storage = new MemoryStorage()) {
  const opened = await openStore({ storage, areaId: ROUTING_AREA_ID, bundled: () => BUNDLED, now: NOW });
  return { storage, opened };
}

describe('pack verification (exact bytes, schema, compatibility)', () => {
  it('accepts the bundled Ampid I pack', async () => {
    const result = await verifyPack(BUNDLED, sha256, ROUTING_AREA_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pack.graph.version).toBe(JSON.parse(BUNDLED.manifest).graphVersion);
  });

  it('rejects one changed byte, another area, another routing config and missing resources', async () => {
    const flipped = BUNDLED.graph.replace('"lengthMeters":27.06', '"lengthMeters":27.07');
    expect(flipped).not.toBe(BUNDLED.graph);
    expect(await verifyPack({ ...BUNDLED, graph: flipped }, sha256, ROUTING_AREA_ID)).toEqual({ ok: false, reason: 'resource_mismatch' });
    expect(await verifyPack({ ...BUNDLED, map: `${BUNDLED.map} ` }, sha256, ROUTING_AREA_ID)).toEqual({ ok: false, reason: 'resource_mismatch' });
    expect(await verifyPack(BUNDLED, sha256, 'ampid-2')).toEqual({ ok: false, reason: 'area_mismatch' });
    const manifest = JSON.parse(BUNDLED.manifest);
    expect(await verifyPack({ ...BUNDLED, manifest: JSON.stringify({ ...manifest, configVersion: 'old' }) }, sha256, ROUTING_AREA_ID)).toEqual({ ok: false, reason: 'config_incompatible' });
    const noMap = { ...manifest, resources: manifest.resources.filter((r: { path: string }) => r.path !== 'map.json') };
    expect(await verifyPack({ ...BUNDLED, manifest: JSON.stringify(noMap) }, sha256, ROUTING_AREA_ID)).toEqual({ ok: false, reason: 'manifest_invalid' });
    expect(await verifyPack({ ...BUNDLED, manifest: '{' }, sha256, ROUTING_AREA_ID)).toEqual({ ok: false, reason: 'manifest_invalid' });
  });

  it('counts UTF-8 bytes like the builder', () => {
    for (const text of ['', 'abc', 'Ñ', '©', '€', '😀', 'a😀b', '\ud800', 'x\udc00y', BUNDLED.map]) {
      expect(utf8ByteLength(text)).toBe(Buffer.byteLength(text, 'utf8'));
    }
  });
});

describe('opening the store', () => {
  it('installs the bundled pack on first start and reuses it afterwards', async () => {
    const { storage, opened } = await installed();
    expect(opened.repair).toBe('installed');
    expect(opened.pack?.graph.version).toBe(BUNDLED_GRAPH.version);
    expect(opened.state.active?.graphVersion).toBe(BUNDLED_GRAPH.version);
    expect([...storage.files.keys()].filter(key => key.startsWith('staging/'))).toEqual([]);
    const again = await openStore({ storage, areaId: ROUTING_AREA_ID, bundled: () => BUNDLED, now: NOW });
    expect(again.repair).toBe('none');
    expect(again.pack?.graph.version).toBe(BUNDLED_GRAPH.version);
  });

  it('reinstalls a corrupt active pack from the bundle and keeps avoidance and conditions', async () => {
    const { storage, opened } = await installed();
    const pack = opened.pack;
    if (pack === null) throw new Error('no pack');
    const marked = addAvoidance([], pack.graph, BUNDLED_GRAPH.edges[3].id, 'mark-1', NOW());
    if (!marked.ok) throw new Error(marked.reason);
    await storage.writeText(STORE_FILES.avoidance, serializeAvoidance(marked.records));
    const conditions = storedConditions(snapshot({ graphVersion: BUNDLED_GRAPH.version }));
    await storage.writeText(STORE_FILES.conditions, JSON.stringify(conditions));
    const graphPath = `${opened.state.active?.dir}/graph.json`;
    storage.files.set(graphPath, (storage.files.get(graphPath) ?? '').slice(0, 1000));

    const repaired = await openStore({ storage, areaId: ROUTING_AREA_ID, bundled: () => BUNDLED, now: NOW });
    expect(repaired.repair).toBe('reinstalled');
    expect(repaired.pack?.graph.version).toBe(BUNDLED_GRAPH.version);
    expect(repaired.avoidance.map(r => r.id)).toEqual(['mark-1']);
    expect(repaired.conditions?.snapshot.revision).toBe(5);
    expect(storage.files.get(graphPath)).toBe(BUNDLED.graph);
  });

  it('rolls back to the previous pack when the active one is corrupt and the bundle carries another graph', async () => {
    const storage = new MemoryStorage();
    const newer = nextPack();
    const first = await openStore({ storage, areaId: ROUTING_AREA_ID, bundled: () => BUNDLED, now: NOW });
    const upgraded = await activatePack({
      storage,
      areaId: ROUTING_AREA_ID,
      state: first.state,
      candidate: newer,
      current: first.pack,
      avoidance: [],
      conditions: null,
      fetchConditions: () => Promise.reject(new Error('offline')),
      now: NOW,
    });
    expect(upgraded.status).toBe('activated');
    if (upgraded.status !== 'activated') return;
    expect(upgraded.state.previous?.graphVersion).toBe(BUNDLED_GRAPH.version);
    storage.files.set(`${upgraded.state.active?.dir}/map.json`, 'corrupt');

    const opened = await openStore({ storage, areaId: ROUTING_AREA_ID, bundled: () => newerBundleOther(), now: NOW });
    expect(opened.repair).toBe('rolled_back');
    expect(opened.pack?.graph.version).toBe(BUNDLED_GRAPH.version);
    expect(opened.state.previous).toBeNull();
  });

  it('sets an unreadable avoidance file aside instead of deleting it', async () => {
    const { storage } = await installed();
    storage.files.set(STORE_FILES.avoidance, '{"schemaVersion":1,"records":[{"id":');
    const opened = await openStore({ storage, areaId: ROUTING_AREA_ID, bundled: () => BUNDLED, now: NOW });
    expect(opened.avoidanceUnreadable).toBe(true);
    expect(opened.avoidance).toEqual([]);
    expect(storage.files.get(`avoidance.unreadable-${NOW().getTime()}.json`)).toContain('"records"');
  });
});

/** A bundle that is neither the corrupt active graph nor the previous one. */
function newerBundleOther(): PackFiles {
  const manifest = JSON.parse(BUNDLED.manifest);
  return { ...BUNDLED, manifest: JSON.stringify({ ...manifest, graphVersion: 'ampid-1@2026-12-01#cccccccccccc' }) };
}

describe('graph activation requires mappings for known restrictions', () => {
  async function upgradeWith(fetchConditions: () => Promise<unknown>, avoidance: LocalAvoidanceRecord[] = [], withConditions = true) {
    const { storage, opened } = await installed();
    const conditions = withConditions ? storedConditions(snapshot({ graphVersion: BUNDLED_GRAPH.version, revision: 5 })) : null;
    const result = await activatePack({
      storage,
      areaId: ROUTING_AREA_ID,
      state: opened.state,
      candidate: nextPack(),
      current: opened.pack,
      avoidance,
      conditions,
      fetchConditions,
      now: NOW,
    });
    return { storage, opened, result };
  }

  it('defers offline, when the area has not activated the candidate, or when a closure is unmapped', async () => {
    const offline = await upgradeWith(() => Promise.reject(new Error('offline')));
    expect(offline.result).toEqual({ status: 'deferred', reason: 'conditions_unavailable', unresolvedAvoidanceIds: [] });
    const version = 'ampid-1@2026-11-01#aaaaaaaaaaaa';
    const notActive = await upgradeWith(async () => snapshot({ graphVersion: version, status: 'registered' }));
    expect(notActive.result).toMatchObject({ status: 'deferred', reason: 'graph_not_active' });
    const unmapped = await upgradeWith(async () => snapshot({ graphVersion: version, closedEdgeIds: null }));
    expect(unmapped.result).toMatchObject({ status: 'deferred', reason: 'closures_unmapped' });
    const older = await upgradeWith(async () => snapshot({ graphVersion: version, revision: 4 }));
    expect(older.result).toMatchObject({ status: 'deferred', reason: 'snapshot_outdated' });
    for (const { storage, opened } of [offline, notActive, unmapped, older]) {
      const state = parseState(storage.files.get(STORE_FILES.state) ?? null, ROUTING_AREA_ID);
      expect(state?.active).toEqual(opened.state.active);
      expect(state?.journal).toBeNull();
    }
  });

  it('activates with mapped closures, remaps avoidance by source reference and keeps the previous pack', async () => {
    const renamed = BUNDLED_GRAPH.edges[0].id;
    const { opened: base } = await installed();
    if (base.pack === null) throw new Error('no pack');
    const mark = addAvoidance([], base.pack.graph, renamed, 'mark-1', NOW());
    if (!mark.ok) throw new Error(mark.reason);
    const version = 'ampid-1@2026-11-01#aaaaaaaaaaaa';
    const { storage, result } = await upgradeWith(async () => snapshot({ graphVersion: version, revision: 6, closedEdgeIds: [`${renamed}-v2`] }), mark.records);
    expect(result.status).toBe('activated');
    if (result.status !== 'activated') return;
    expect(result.state.active?.graphVersion).toBe(version);
    expect(result.state.previous?.graphVersion).toBe(BUNDLED_GRAPH.version);
    expect(avoidedEdgeIds(result.avoidance)).toEqual([`${renamed}-v2`]);
    expect(parseAvoidance(storage.files.get(STORE_FILES.avoidance) ?? null)?.[0].graphVersion).toBe(version);
    expect(parseStoredConditions(storage.files.get(STORE_FILES.conditions) ?? null)?.snapshot.revision).toBe(6);
    expect(await storage.list(STORE_FILES.packs)).toHaveLength(2);
  });

  it('defers when a local avoidance mark cannot be mapped', async () => {
    const { opened: base } = await installed();
    if (base.pack === null) throw new Error('no pack');
    const mark = addAvoidance([], base.pack.graph, BUNDLED_GRAPH.edges[0].id, 'mark-1', NOW());
    if (!mark.ok) throw new Error(mark.reason);
    const orphan: LocalAvoidanceRecord = {
      ...mark.records[0],
      edges: [{ ...mark.records[0].edges[0], sourceRef: 'osm:way/1/1-2' }],
    };
    const { result } = await upgradeWith(async () => snapshot({ graphVersion: 'ampid-1@2026-11-01#aaaaaaaaaaaa' }), [orphan]);
    expect(result).toEqual({ status: 'deferred', reason: 'avoidance_unresolved', unresolvedAvoidanceIds: ['mark-1'] });
  });
});

describe('staged files are verified as stored', () => {
  it('rejects a candidate whose bytes are damaged on the way to storage and keeps the current pack', async () => {
    const { storage, opened } = await installed();
    const write = storage.writeText.bind(storage);
    storage.writeText = async (path, text) => write(path, path.startsWith('staging/') && path.endsWith('graph.json') ? text.slice(0, -10) : text);
    const result = await activatePack({
      storage,
      areaId: ROUTING_AREA_ID,
      state: opened.state,
      candidate: nextPack(),
      current: opened.pack,
      avoidance: [],
      conditions: null,
      fetchConditions: () => Promise.reject(new Error('not needed')),
      now: NOW,
    });
    expect(result).toEqual({ status: 'rejected', reason: 'resource_mismatch' });
    const state = parseState(storage.files.get(STORE_FILES.state) ?? null, ROUTING_AREA_ID);
    expect(state?.active).toEqual(opened.state.active);
    expect(state?.journal).toBeNull();
    expect([...storage.files.keys()].some(key => key.startsWith('staging/'))).toBe(false);
  });
});

describe('interrupted activation recovers deterministically', () => {
  it('a crash after any write leaves either the old or the new pack active, with matching avoidance', async () => {
    const renamed = BUNDLED_GRAPH.edges[0].id;
    const version = 'ampid-1@2026-11-01#aaaaaaaaaaaa';
    const candidate = nextPack();
    let sawOld = false;
    let sawNew = false;
    for (let crashAfter = 0; crashAfter < 40; crashAfter++) {
      const { storage, opened } = await installed();
      if (opened.pack === null) throw new Error('no pack');
      const mark = addAvoidance([], opened.pack.graph, renamed, 'mark-1', NOW());
      if (!mark.ok) throw new Error(mark.reason);
      await storage.writeText(STORE_FILES.avoidance, serializeAvoidance(mark.records));
      const conditions = storedConditions(snapshot({ graphVersion: BUNDLED_GRAPH.version }));
      await storage.writeText(STORE_FILES.conditions, JSON.stringify(conditions));
      storage.mutations = 0;
      storage.failAfter = crashAfter;
      const attempt = activatePack({
        storage,
        areaId: ROUTING_AREA_ID,
        state: opened.state,
        candidate,
        current: opened.pack,
        avoidance: mark.records,
        conditions,
        fetchConditions: async () => snapshot({ graphVersion: version, revision: 6 }),
        now: NOW,
      });
      const finished = await attempt.then(() => true, () => false);
      storage.failAfter = Infinity;

      const reopened = await openStore({ storage, areaId: ROUTING_AREA_ID, bundled: () => BUNDLED, now: NOW });
      const active = reopened.pack?.graph.version;
      expect(reopened.state.journal).toBeNull();
      expect([...storage.files.keys()].some(key => key.startsWith('staging/') || key.endsWith('.next.json'))).toBe(false);
      expect(reopened.unresolvedAvoidanceIds).toEqual([]);
      expect(reopened.avoidance.every(record => record.graphVersion === active)).toBe(true);
      if (active === version) {
        sawNew = true;
        expect(avoidedEdgeIds(reopened.avoidance)).toEqual([`${renamed}-v2`]);
        expect(reopened.conditions?.snapshot.graphVersion).toBe(version);
      } else {
        sawOld = true;
        expect(active).toBe(BUNDLED_GRAPH.version);
        expect(reopened.conditions?.snapshot.graphVersion).toBe(BUNDLED_GRAPH.version);
      }
      if (finished) break;
    }
    expect(sawOld).toBe(true);
    expect(sawNew).toBe(true);
  });
});

describe('conditions and avoidance in local routing', () => {
  it('never lets an older or malformed response replace stored conditions', () => {
    const stored = storedConditions(snapshot({ graphVersion: BUNDLED_GRAPH.version, revision: 7 }));
    expect(acceptConditions(stored, snapshot({ graphVersion: BUNDLED_GRAPH.version, revision: 6 }), ROUTING_AREA_ID, BUNDLED_GRAPH.version, NOW())).toEqual({ ok: false, reason: 'older' });
    expect(acceptConditions(stored, { schemaVersion: 1 }, ROUTING_AREA_ID, BUNDLED_GRAPH.version, NOW())).toEqual({ ok: false, reason: 'invalid' });
    expect(acceptConditions(stored, snapshot({ graphVersion: 'ampid-1@2026-11-01#aaaaaaaaaaaa' }), ROUTING_AREA_ID, BUNDLED_GRAPH.version, NOW())).toEqual({ ok: false, reason: 'other_graph' });
    const same = acceptConditions(stored, snapshot({ graphVersion: BUNDLED_GRAPH.version, revision: 7 }), ROUTING_AREA_ID, BUNDLED_GRAPH.version, NOW());
    expect(same.ok).toBe(true);
  });

  it('routes on the installed pack with stored closures and local avoidance, never on an unactivated graph', async () => {
    const { opened } = await installed();
    const pack = opened.pack;
    if (pack === null) throw new Error('no pack');
    expect(localRoutingInputs(pack.graph, null)).toEqual({ ok: false, problem: 'no_conditions' });
    const notActive = storedConditions(snapshot({ graphVersion: BUNDLED_GRAPH.version, status: 'registered' }));
    expect(localRoutingInputs(pack.graph, notActive.snapshot)).toEqual({ ok: false, problem: 'graph_not_active' });

    const origin = { lat: BUNDLED_GRAPH.nodes[11].lat, lng: BUNDLED_GRAPH.nodes[11].lng, accuracyMeters: 5, revision: 1 };
    const plan = (closed: string[], avoid: string[]) => {
      const inputs = localRoutingInputs(pack.graph, storedConditions(snapshot({ graphVersion: BUNDLED_GRAPH.version, closedEdgeIds: closed })).snapshot);
      if (!inputs.ok) throw new Error(inputs.problem);
      return planEvacuationRoute({
        graph: pack.graph,
        conditions: inputs.conditions,
        centers: inputs.centers,
        request: { origin, originEdgeId: null, centerId: CENTER_A, avoidEdgeIds: avoid },
        profile: ROUTING_PROFILES['ampid-fine'],
      });
    };
    const open = plan([], []);
    if (open.status === 'attachment_ambiguous') throw new Error('fixture origin is ambiguous');
    expect(open.status).toBe('ok');
    if (open.status !== 'ok') return;
    expect(open.best.centerId).toBe(CENTER_A);
    const used = open.best.edgeIds[open.best.edgeIds.length - 1];
    for (const result of [plan([used], []), plan([], [used])]) {
      if (result.status === 'ok') expect(result.best.edgeIds).not.toContain(used);
      else expect(result.status).toBe('no_route_within_coverage');
    }
  });

  it('picks the tapped segment and refuses duplicate marks', async () => {
    const { opened } = await installed();
    const pack = opened.pack;
    if (pack === null) throw new Error('no pack');
    const edge = BUNDLED_GRAPH.edges[5];
    const [lng, lat] = edge.geometry[0];
    const picked = nearestEdge(pack.graph, { lat, lng });
    expect(picked).not.toBeNull();
    expect(nearestEdge(pack.graph, { lat: 14.0, lng: 121.0 })).toBeNull();
    const first = addAvoidance([], pack.graph, edge.id, 'a', NOW());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(addAvoidance(first.records, pack.graph, edge.id, 'b', NOW())).toEqual({ ok: false, reason: 'already_marked' });
    expect(addAvoidance(first.records, pack.graph, 'nope', 'b', NOW())).toEqual({ ok: false, reason: 'unknown_segment' });
    expect(parseAvoidance(serializeAvoidance(first.records))).toEqual(first.records);
  });
});
