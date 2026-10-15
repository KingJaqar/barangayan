import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RouteServiceError, RouteServiceSuccess } from '../../../packages/shared/src/lib/evacuation-route-service';
import { clientAddress, evacuationRouteHandler, loadRoutingPack, RoutingPackError, type RouteServiceDependencies, type RoutingPack } from './handler';

const packDir = new URL('../../../data/routing-packs/ampid-1/pack/', import.meta.url);
const graphJson: unknown = JSON.parse(readFileSync(new URL('graph.json', packDir), 'utf8'));
const manifestJson: unknown = JSON.parse(readFileSync(new URL('manifest.json', packDir), 'utf8'));
const sha256Hex = async (text: string) => createHash('sha256').update(text).digest('hex');

let pack: RoutingPack;
beforeAll(async () => {
  pack = await loadRoutingPack(graphJson, manifestJson, sha256Hex);
});

// Seeded centers with the R3 report's proposed entrance nodes. Only the Civic Center is
// confirmed available; Ampid 1 Elementary's entrance is on a margin-only group (R3 finding 2).
const CIVIC = '00000000-0000-0000-0000-00000000c002';
const MALANDAY = '00000000-0000-0000-0000-00000000c004';
function snapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    areaId: 'ampid-1',
    revision: 12,
    revisedAt: '2026-10-13T01:22:17.815541+00:00',
    generatedAt: '2026-10-13T01:25:59.191508+00:00',
    graphVersion: pack.graph.version,
    activeGraphVersion: pack.graph.version,
    graphStatus: 'active',
    closures: [],
    centers: [
      { id: '00000000-0000-0000-0000-00000000c001', name: 'Ampid 1 Elementary', active: true, availability: 'unknown', entranceNodeId: 'n11175955772' },
      { id: CIVIC, name: 'San Mateo Civic Center', active: true, availability: 'available', entranceNodeId: 'n13165316139' },
      { id: '00000000-0000-0000-0000-00000000c003', name: 'Dulong Bayan Covered Court', active: true, availability: 'unknown', entranceNodeId: 'n10250156647' },
      { id: MALANDAY, name: 'Malanday National High School', active: true, availability: 'unknown', entranceNodeId: 'n674020408' },
    ],
    tombstones: [],
    ...overrides,
  };
}

function closure(edgeIds: string[] | null): Record<string, unknown> {
  return { id: '5a08e60b-4514-4ead-aacc-63482aae7e65', edgeIds };
}

// Daang Bakal Street; routes to the Civic Center in R3's probe.
const ORIGIN = { lat: 14.6773, lng: 121.1154, accuracyMeters: 8, revision: 4 };

function deps(overrides: Partial<RouteServiceDependencies> = {}) {
  const base = {
    pack: vi.fn(async () => pack),
    conditions: vi.fn(async (_areaId: string, _graphVersion: string, _signal: AbortSignal): Promise<unknown> => snapshot()),
    rateLimit: vi.fn(async (_address: string, _signal: AbortSignal) => 0),
    reportError: vi.fn((_event: string) => {}),
    computeDeadlineMs: 1000,
    yieldControl: vi.fn(() => new Promise<void>(resolve => setTimeout(resolve, 0))),
  };
  return { ...base, ...overrides };
}

function post(body: unknown, init: { headers?: Record<string, string>; signal?: AbortSignal } = {}): Request {
  return new Request('http://localhost/evacuation-route', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7, 10.0.0.2', ...init.headers },
    signal: init.signal,
  });
}

async function success(response: Response): Promise<RouteServiceSuccess> {
  expect(response.status).toBe(200);
  return (await response.json()) as RouteServiceSuccess;
}

async function failure(response: Response, status: number, code: RouteServiceError['error']): Promise<RouteServiceError> {
  expect(response.status).toBe(status);
  const body = (await response.json()) as RouteServiceError;
  expect(body.error).toBe(code);
  expect(body.message.length).toBeGreaterThan(0);
  return body;
}

describe('loadRoutingPack', () => {
  it('verifies the bundled Ampid I pack against its manifest', () => {
    const manifest = manifestJson as { graphVersion: string; resources: { path: string; sha256: string }[] };
    expect(pack.graph.version).toBe(manifest.graphVersion);
    expect(pack.graphSha256).toBe(manifest.resources.find(r => r.path === 'graph.json')?.sha256);
    expect(pack.areaId).toBe('ampid-1');
    expect(pack.attribution).toContain('OpenStreetMap');
  });

  it('rejects a graph whose bytes differ from the manifest', async () => {
    const tampered = JSON.parse(JSON.stringify(graphJson)) as { edges: { lengthMeters: number }[] };
    tampered.edges[0].lengthMeters += 1;
    await expect(loadRoutingPack(tampered, manifestJson, sha256Hex)).rejects.toThrow(new RoutingPackError('graph_hash_mismatch'));
  });

  it('rejects a manifest that names another graph version', async () => {
    const manifest = { ...(manifestJson as Record<string, unknown>), graphVersion: 'ampid-1@2026-10-13#000000000000' };
    await expect(loadRoutingPack(graphJson, manifest, sha256Hex)).rejects.toThrow(new RoutingPackError('graph_version_mismatch'));
  });

  it('rejects a manifest without a graph entry', async () => {
    const manifest = { ...(manifestJson as Record<string, unknown>), resources: [] };
    await expect(loadRoutingPack(graphJson, manifest, sha256Hex)).rejects.toThrow(new RoutingPackError('manifest_invalid'));
  });
});

describe('clientAddress', () => {
  it('prefers cf-connecting-ip, then the first x-forwarded-for entry', () => {
    expect(clientAddress(new Headers({ 'cf-connecting-ip': '198.51.100.4', 'x-forwarded-for': '203.0.113.7' }))).toBe('198.51.100.4');
    expect(clientAddress(new Headers({ 'x-forwarded-for': ' 2001:db8::1 , 10.0.0.2' }))).toBe('2001:db8::1');
  });

  it('returns null when no header looks like an address', () => {
    expect(clientAddress(new Headers())).toBeNull();
    expect(clientAddress(new Headers({ 'x-forwarded-for': 'unknown' }))).toBeNull();
  });
});

describe('evacuationRouteHandler: request handling', () => {
  it('answers CORS preflight without work', async () => {
    const d = deps();
    const response = await evacuationRouteHandler(d)(new Request('http://localhost/evacuation-route', { method: 'OPTIONS' }));
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
    expect(d.pack).not.toHaveBeenCalled();
  });

  it('accepts POST only (origins never travel in URLs)', async () => {
    await failure(await evacuationRouteHandler(deps())(new Request('http://localhost/evacuation-route?lat=14.6')), 405, 'method_not_allowed');
  });

  it('refuses oversized bodies by declared length and by streamed size', async () => {
    const d = deps();
    const handler = evacuationRouteHandler(d);
    const big = JSON.stringify({ origin: ORIGIN, padding: 'x'.repeat(20_000) });
    await failure(await handler(post(big)), 413, 'payload_too_large');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 20; i++) controller.enqueue(new TextEncoder().encode('x'.repeat(1_000)));
        controller.close();
      },
    });
    const streamed = new Request('http://localhost/evacuation-route', { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
    expect(streamed.headers.get('content-length')).toBeNull();
    await failure(await handler(streamed), 413, 'payload_too_large');
    expect(d.pack).not.toHaveBeenCalled();
  });

  it('refuses malformed JSON, invalid UTF-8 and invalid shapes', async () => {
    const handler = evacuationRouteHandler(deps());
    await failure(await handler(post('{"origin":')), 400, 'invalid_request');
    const bytes = new Request('http://localhost/evacuation-route', { method: 'POST', body: new Uint8Array([0x7b, 0xff, 0x7d]) });
    await failure(await handler(bytes), 400, 'invalid_request');
    const shape = await failure(await handler(post({ origin: { ...ORIGIN, revision: -1 } })), 400, 'invalid_request');
    expect(shape.message).toContain('revision');
    await failure(
      await handler(post({ origin: ORIGIN, graphVersion: pack.graph.version, avoidEdgeIds: Array.from({ length: 201 }, (_, i) => `w${i}:a-b`) })),
      400,
      'invalid_request',
    );
  });

  it('refuses segment ids from another graph version before any database call', async () => {
    const d = deps();
    const body = await failure(
      await evacuationRouteHandler(d)(post({ origin: ORIGIN, graphVersion: 'ampid-1@2026-01-01#000000000000', avoidEdgeIds: ['w1:a-b'] })),
      409,
      'graph_version_mismatch',
    );
    expect(body.graphVersion).toBe(pack.graph.version);
    expect(d.rateLimit).not.toHaveBeenCalled();
    expect(d.conditions).not.toHaveBeenCalled();
  });
});

describe('evacuationRouteHandler: routing', () => {
  it('returns best route, shortest route and per-center distances with provenance in one response', async () => {
    const d = deps();
    const response = await evacuationRouteHandler(d)(post({ origin: ORIGIN }));
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    const { route, service } = await success(response);
    if (route.status !== 'ok') throw new Error(route.status);
    expect(route.best.centerId).toBe(CIVIC);
    expect(route.centerTier).toBe('available');
    expect(route.best.distanceMeters).toBeGreaterThan(800);
    expect(route.best.geometry.length).toBeGreaterThan(route.best.edgeIds.length);
    // Closure-only: the RRL weight equals distance, so the shortest route is the best route.
    expect(route.shortest).toBeNull();
    expect(route.centers).toHaveLength(4);
    expect(route.centers.filter(c => c.distanceMeters !== null)).toHaveLength(3);
    expect(route.centers.find(c => c.centerId === '00000000-0000-0000-0000-00000000c001')?.distanceMeters).toBeNull();
    expect(route.provenance).toEqual({
      graphVersion: pack.graph.version,
      conditionsRevision: 12,
      profileId: 'ampid-fine',
      configVersion: '2026-10-12.r2',
      originRevision: 4,
    });
    expect(service).toEqual({
      areaId: 'ampid-1',
      graphSha256: pack.graphSha256,
      osmBaseTimestamp: '2026-10-12T13:29:57Z',
      attribution: pack.attribution,
      conditionsRevisedAt: '2026-10-13T01:22:17.815541+00:00',
      conditionsGeneratedAt: '2026-10-13T01:25:59.191508+00:00',
      modelStatus: 'unavailable',
    });
    expect(d.rateLimit).toHaveBeenCalledWith('203.0.113.7', expect.any(AbortSignal));
    expect(d.conditions).toHaveBeenCalledWith('ampid-1', pack.graph.version, expect.any(AbortSignal));
    expect(d.reportError).not.toHaveBeenCalled();
  });

  it('never routes over a verified closure and reroutes on the newer snapshot', async () => {
    const before = await success(await evacuationRouteHandler(deps())(post({ origin: ORIGIN })));
    if (before.route.status !== 'ok') throw new Error(before.route.status);
    const closed = before.route.best.edgeIds[3];
    const d = deps({ conditions: vi.fn(async () => snapshot({ revision: 13, closures: [closure([closed])] })) });
    const after = await success(await evacuationRouteHandler(d)(post({ origin: ORIGIN, minConditionsRevision: 12 })));
    if (after.route.status !== 'ok') throw new Error(after.route.status);
    expect(after.route.best.edgeIds).not.toContain(closed);
    expect(after.route.provenance.conditionsRevision).toBe(13);
    expect(after.route.best.distanceMeters).toBeGreaterThan(before.route.best.distanceMeters);
  });

  it('applies local avoidance from the same graph and reports unknown avoided segments', async () => {
    const handler = evacuationRouteHandler(deps());
    const before = await success(await handler(post({ origin: ORIGIN })));
    if (before.route.status !== 'ok') throw new Error(before.route.status);
    const avoided = before.route.best.edgeIds[2];
    const after = await success(await handler(post({ origin: ORIGIN, graphVersion: pack.graph.version, avoidEdgeIds: [avoided] })));
    if (after.route.status !== 'ok') throw new Error(after.route.status);
    expect(after.route.best.edgeIds).not.toContain(avoided);
    const unknown = await success(await handler(post({ origin: ORIGIN, graphVersion: pack.graph.version, avoidEdgeIds: ['w1:n1-n2'] })));
    expect(unknown.route).toMatchObject({ status: 'restrictions_unmapped', unmappedEdgeIds: ['w1:n1-n2'] });
  });

  it('routes to a resident-selected center and reports core outcomes as route statuses', async () => {
    const handler = evacuationRouteHandler(deps());
    const selected = await success(await handler(post({ origin: ORIGIN, centerId: MALANDAY })));
    expect(selected.route.status === 'ok' && selected.route.best.centerId).toBe(MALANDAY);
    expect((await success(await handler(post({ origin: { ...ORIGIN, lat: 14.7, lng: 121.2 } })))).route.status).toBe('outside_coverage');
    expect((await success(await handler(post({ origin: { ...ORIGIN, lat: 95 } })))).route.status).toBe('invalid_origin');
    expect((await success(await handler(post({ origin: ORIGIN, centerId: 'not-a-center' })))).route.status).toBe('center_unavailable');
  });

  it('returns no route (never a straight line) when closures cut every path', async () => {
    const before = await success(await evacuationRouteHandler(deps())(post({ origin: ORIGIN })));
    if (before.route.status !== 'ok') throw new Error(before.route.status);
    const attached = before.route.attachment.edgeId;
    const edge = pack.graph.edges[pack.graph.edgeIndex.get(attached) as number];
    const touching = pack.graph.edges.filter(e => e.id !== attached && [edge.from, edge.to].some(n => n === e.from || n === e.to)).map(e => e.id);
    const d = deps({ conditions: vi.fn(async () => snapshot({ closures: [closure(touching)] })) });
    const { route } = await success(await evacuationRouteHandler(d)(post({ origin: ORIGIN })));
    expect(route.status).toBe('no_route_within_coverage');
    expect(route).not.toHaveProperty('best');
  });

  it('answers parallel requests exactly as sequential ones', async () => {
    const handler = evacuationRouteHandler(deps());
    const origins = Array.from({ length: 24 }, (_, i) => ({ lat: 14.6765 + (i % 6) * 0.0012, lng: 121.1135 + Math.floor(i / 6) * 0.0025, accuracyMeters: 10, revision: i }));
    const sequential: unknown[] = [];
    for (const origin of origins) sequential.push(await (await handler(post({ origin }))).json());
    const parallel = await Promise.all(origins.map(async origin => (await handler(post({ origin }))).json()));
    expect(parallel).toEqual(sequential);
    expect(new Set(sequential.map(r => (r as RouteServiceSuccess).route.status)).has('ok')).toBe(true);
  });
});

describe('evacuationRouteHandler: failure behavior', () => {
  it('limits requests per client address with Retry-After', async () => {
    const d = deps({ rateLimit: vi.fn(async () => 17) });
    const response = await evacuationRouteHandler(d)(post({ origin: ORIGIN }));
    const body = await failure(response, 429, 'rate_limited');
    expect(body.retryAfterSeconds).toBe(17);
    expect(response.headers.get('retry-after')).toBe('17');
    expect(d.conditions).not.toHaveBeenCalled();
  });

  it('keeps routing when the limiter is unavailable, and reports it', async () => {
    const d = deps({ rateLimit: vi.fn(async () => Promise.reject(new Error('down'))) });
    const { route } = await success(await evacuationRouteHandler(d)(post({ origin: ORIGIN })));
    expect(route.status).toBe('ok');
    expect(d.reportError).toHaveBeenCalledWith('rate_limiter_unavailable');
  });

  it('does not throttle requests without a client address into one shared bucket', async () => {
    const d = deps();
    const request = new Request('http://localhost/evacuation-route', { method: 'POST', body: JSON.stringify({ origin: ORIGIN }) });
    expect((await success(await evacuationRouteHandler(d)(request))).route.status).toBe('ok');
    expect(d.rateLimit).not.toHaveBeenCalled();
  });

  it('fails as a service failure when conditions cannot be loaded or parsed', async () => {
    const down = deps({ conditions: vi.fn(async () => Promise.reject(new Error('timeout'))) });
    await failure(await evacuationRouteHandler(down)(post({ origin: ORIGIN })), 503, 'conditions_unavailable');
    expect(down.reportError).toHaveBeenCalledWith('conditions_unavailable');
    const malformed = deps({ conditions: vi.fn(async () => ({ schemaVersion: 2 })) });
    await failure(await evacuationRouteHandler(malformed)(post({ origin: ORIGIN })), 503, 'conditions_unavailable');
    expect(malformed.reportError).toHaveBeenCalledWith('conditions_malformed');
  });

  it('refuses outdated, inactive and unmapped snapshots', async () => {
    const outdated = deps();
    await failure(await evacuationRouteHandler(outdated)(post({ origin: ORIGIN, minConditionsRevision: 13 })), 503, 'snapshot_outdated');
    expect(outdated.reportError).not.toHaveBeenCalled();
    const inactive = deps({ conditions: vi.fn(async () => snapshot({ graphStatus: 'registered', activeGraphVersion: 'ampid-1@2026-11-01#0123456789ab' })) });
    await failure(await evacuationRouteHandler(inactive)(post({ origin: ORIGIN })), 503, 'graph_not_active');
    const unmapped = deps({ conditions: vi.fn(async () => snapshot({ closures: [closure(null)] })) });
    await failure(await evacuationRouteHandler(unmapped)(post({ origin: ORIGIN })), 503, 'closures_unmapped');
    expect(unmapped.reportError).toHaveBeenCalledWith('closures_unmapped');
  });

  it('refuses inconsistent published conditions', async () => {
    const centers = (snapshot().centers as unknown[]).concat([(snapshot().centers as unknown[])[1]]);
    const d = deps({ conditions: vi.fn(async () => snapshot({ centers })) });
    await failure(await evacuationRouteHandler(d)(post({ origin: ORIGIN })), 503, 'invalid_conditions');
    expect(d.reportError).toHaveBeenCalledWith('conditions_inconsistent');
  });

  it('reports unavailable map data', async () => {
    const d = deps({ pack: vi.fn(async () => Promise.reject(new RoutingPackError('graph_hash_mismatch'))) });
    await failure(await evacuationRouteHandler(d)(post({ origin: ORIGIN })), 503, 'graph_unavailable');
    expect(d.reportError).toHaveBeenCalledWith('graph_unavailable');
  });

  it('stops the search at the compute deadline', async () => {
    const d = deps({ computeDeadlineMs: 1, yieldControl: vi.fn(() => new Promise<void>(resolve => setTimeout(resolve, 10))) });
    await failure(await evacuationRouteHandler(d)(post({ origin: ORIGIN })), 503, 'deadline_exceeded');
  });

  it('stops computing as soon as the client goes away', async () => {
    const controller = new AbortController();
    const yieldControl = vi.fn(async () => {
      controller.abort();
    });
    const d = deps({ yieldControl });
    await failure(await evacuationRouteHandler(d)(post({ origin: ORIGIN }, { signal: controller.signal })), 499, 'cancelled');
    expect(yieldControl).toHaveBeenCalledTimes(1);
  });

  it('logs nothing itself and reports only fixed event names', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(method => vi.spyOn(console, method));
    const events = vi.fn((_event: string) => {});
    const handler = evacuationRouteHandler(deps({ reportError: events, rateLimit: vi.fn(async () => Promise.reject(new Error(`${ORIGIN.lat}`))) }));
    await handler(post({ origin: ORIGIN }));
    await evacuationRouteHandler(deps({ reportError: events, conditions: vi.fn(async () => Promise.reject(new Error(`${ORIGIN.lng}`))) }))(post({ origin: ORIGIN }));
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
    expect(events.mock.calls.map(([event]) => event)).toEqual(['rate_limiter_unavailable', 'conditions_unavailable']);
  });
});
