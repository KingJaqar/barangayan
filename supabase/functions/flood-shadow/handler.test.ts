import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { FloodGrid } from '../../../packages/shared/src/lib/evacuation-routing';
import {
  FEED_LIMITS,
  ShadowPackError,
  fetchFeedJson,
  floodShadowHandler,
  loadShadowPack,
  parseShadowHistory,
  type FloodShadowDependencies,
  type PublishArguments,
  type ShadowPack,
  type ShadowRunResponse,
} from './handler';

const packDir = new URL('../../../data/routing-packs/ampid-1/pack/', import.meta.url);
const sourceDir = new URL('../../../data/routing-packs/ampid-1/source/', import.meta.url);
const read = (url: URL): unknown => JSON.parse(readFileSync(url, 'utf8'));
const graphJson = read(new URL('graph.json', packDir));
const gridJson = read(new URL('server/grid-ampid-fine.json', packDir));
const manifestJson = read(new URL('manifest.json', packDir));
const bundledStations = read(new URL('sensor-stations.json', sourceDir));
const bundledTerrain = read(new URL('terrain.json', sourceDir));
const sha256Hex = async (text: string) => createHash('sha256').update(text).digest('hex');

let pack: ShadowPack;
beforeAll(async () => {
  pack = await loadShadowPack(graphJson, gridJson, manifestJson, sha256Hex);
});

const NOW = Date.parse('2026-10-14T06:00:00Z');
const SERVICE_KEY = 'service-role-key-for-tests';

function deps(overrides: Partial<FloodShadowDependencies> = {}) {
  const publish = vi.fn(async (_args: PublishArguments, _signal: AbortSignal): Promise<unknown> => ({ status: 'published', id: 'run-1' }));
  const base: FloodShadowDependencies = {
    pack: vi.fn(async () => pack),
    stationSet: bundledStations,
    terrain: bundledTerrain,
    fetchFeed: vi.fn(async (_signal: AbortSignal): Promise<unknown | null> => null),
    history: vi.fn(async (_areaId: string, _signal: AbortSignal): Promise<unknown> => []),
    publish,
    authorized: (request: Request) => request.headers.get('authorization') === `Bearer ${SERVICE_KEY}`,
    now: () => NOW,
    reportError: vi.fn((_event: string) => {}),
  };
  return { ...base, ...overrides, publish: overrides.publish ?? publish };
}

function post(headers: Record<string, string> = { authorization: `Bearer ${SERVICE_KEY}` }): Request {
  return new Request('http://localhost/flood-shadow', { method: 'POST', headers });
}

async function run(d: FloodShadowDependencies, request: Request = post()): Promise<{ status: number; body: ShadowRunResponse & { error?: string } }> {
  const response = await floodShadowHandler(d)(request);
  return { status: response.status, body: (await response.json()) as ShadowRunResponse & { error?: string } };
}

// A tiny verified station set inside the real grid; terrain stays unknown in the pack, so
// the model is unavailable but validation and reporting are fully exercised.
function stationSetFor(ids: string[]): unknown {
  return {
    schemaVersion: 1,
    verification: { source: 'fixture', verifiedOn: '2026-10-14', reviewer: 'tests' },
    stations: ids.map(stationId => ({
      stationId,
      name: stationId,
      lat: 14.68,
      lng: 121.115,
      alertMeters: 18,
      alarmMeters: 19,
      criticalMeters: 20,
      baselineMeters: 17,
      datum: 'TEST-MSL',
      intervalSeconds: 600,
    })),
  };
}

describe('loadShadowPack', () => {
  it('verifies the bundled graph and grid against the manifest', () => {
    expect(pack.areaId).toBe('ampid-1');
    expect(pack.graphVersion).toBe((manifestJson as { graphVersion: string }).graphVersion);
    expect(pack.edges.length).toBeGreaterThan(1000);
    expect(pack.grid.cols * pack.grid.rows).toBe(pack.grid.elevations.length);
    expect(pack.packStationIds).toEqual([]);
  });

  it('refuses a tampered grid', async () => {
    const grid = gridJson as FloodGrid;
    const tampered = { ...grid, elevations: grid.elevations.map((e, i) => (i === 0 ? 12.5 : e)) };
    await expect(loadShadowPack(graphJson, tampered, manifestJson, sha256Hex)).rejects.toThrow(ShadowPackError);
  });

  it('refuses a manifest without the grid entry', async () => {
    const manifest = manifestJson as { resources: { path: string }[] };
    const stripped = { ...manifest, resources: manifest.resources.filter(r => r.path !== 'server/grid-ampid-fine.json') };
    await expect(loadShadowPack(graphJson, gridJson, stripped, sha256Hex)).rejects.toThrow(ShadowPackError);
  });
});

describe('floodShadowHandler', () => {
  it('rejects non-POST requests and unauthorized callers before doing any work', async () => {
    const d = deps();
    const get = await floodShadowHandler(d)(new Request('http://localhost/flood-shadow', { method: 'GET' }));
    expect(get.status).toBe(405);
    expect((await run(d, post({ authorization: 'Bearer wrong' }))).status).toBe(401);
    expect((await run(d, post({}))).status).toBe(401);
    expect(d.pack).not.toHaveBeenCalled();
    expect(d.publish).not.toHaveBeenCalled();
  });

  it('publishes an unavailable run when no source is configured and terrain is missing', async () => {
    const d = deps();
    const { status, body } = await run(d);
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: 'published', modelStatus: 'unavailable', sourceStatus: 'unconfigured' });
    const args = vi.mocked(d.publish).mock.calls[0][0];
    expect(args).toMatchObject({ p_area_id: 'ampid-1', p_graph_version: pack.graphVersion, p_model_status: 'unavailable', p_evaluated_at: '2026-10-14T06:00:00.000Z' });
    const report = args.p_report as { residentInfluence: string; eligibility: { reasons: string[] }; reportHash: string };
    expect(report.residentInfluence).toBe('none');
    expect(report.eligibility.reasons).toEqual(['no_stations', 'stations_unverified', 'no_known_elevation', 'terrain_missing']);
    expect(body.reportHash).toBe(report.reportHash);
  });

  it('is reproducible: equal inputs and time give an equal report hash', async () => {
    const first = await run(deps());
    const second = await run(deps());
    expect(second.body.reportHash).toBe(first.body.reportHash);
    expect(second.body.snapshotId).toBe(first.body.snapshotId);
  });

  it('validates a feed: a flagged reading becomes unknown and is kept as history', async () => {
    const feed = {
      schemaVersion: 1,
      source: 'fixture-feed',
      readings: [
        { stationId: 'sa', levelMeters: 17.5, observedAt: '2026-10-14T05:58:00Z', datum: 'TEST-MSL' },
        { stationId: 'sb', levelMeters: 31, observedAt: '2026-10-14T05:58:00Z', datum: 'TEST-MSL' },
      ],
    };
    const d = deps({ stationSet: stationSetFor(['sa', 'sb']), fetchFeed: vi.fn(async () => feed) });
    const { body } = await run(d);
    expect(body.sourceStatus).toBe('ok');
    const report = vi.mocked(d.publish).mock.calls[0][0].p_report as {
      stations: { stationId: string; status: string; reasons: string[] }[];
      readings: { stationId: string }[];
    };
    expect(report.stations.map(s => [s.stationId, s.status, s.reasons])).toEqual([
      ['sa', 'accepted', []],
      ['sb', 'unknown', ['out_of_range']],
    ]);
    expect(report.readings.map(r => r.stationId)).toEqual(['sa', 'sb']);
  });

  it('uses stored history for the temporal check', async () => {
    const feed = {
      schemaVersion: 1,
      source: 'fixture-feed',
      readings: [{ stationId: 'sa', levelMeters: 20.5, observedAt: '2026-10-14T05:58:00Z', datum: 'TEST-MSL' }],
    };
    const history = [[{ stationId: 'sa', observedAt: Date.parse('2026-10-14T05:50:00Z'), levelMeters: 17.2 }]];
    const d = deps({ stationSet: stationSetFor(['sa']), fetchFeed: vi.fn(async () => feed), history: vi.fn(async () => history) });
    await run(d);
    const report = vi.mocked(d.publish).mock.calls[0][0].p_report as { stations: { reasons: string[] }[] };
    expect(report.stations[0].reasons).toEqual(['jump']);
  });

  it('reports a failing or invalid source and still publishes an honest unavailable run', async () => {
    const failing = deps({ fetchFeed: vi.fn(async () => { throw new Error('boom'); }) });
    expect((await run(failing)).body).toMatchObject({ status: 'published', sourceStatus: 'failed', modelStatus: 'unavailable' });
    expect(failing.reportError).toHaveBeenCalledWith('feed_failed');

    const invalid = deps({ fetchFeed: vi.fn(async () => ({ readings: 'nope' })) });
    expect((await run(invalid)).body).toMatchObject({ sourceStatus: 'invalid' });
    expect(invalid.reportError).toHaveBeenCalledWith('feed_invalid');
  });

  it('does not run without history: the validators cannot be applied', async () => {
    const d = deps({ history: vi.fn(async () => { throw new Error('db down'); }) });
    const { status, body } = await run(d);
    expect(status).toBe(503);
    expect(body.error).toBe('history_unavailable');
    expect(d.publish).not.toHaveBeenCalled();

    const malformed = deps({ history: vi.fn(async () => [[{ stationId: 'a' }]]) });
    expect((await run(malformed)).status).toBe(503);
  });

  it('refuses invalid bundled inputs and an unverifiable pack', async () => {
    const badStations = deps({ stationSet: { schemaVersion: 1, verification: null, stations: [{ stationId: 'x' }] } });
    expect((await run(badStations)).body.error).toBe('inputs_invalid');
    const badPack = deps({ pack: vi.fn(async () => { throw new ShadowPackError('grid_hash_mismatch'); }) });
    const result = await run(badPack);
    expect(result.status).toBe(503);
    expect(result.body.error).toBe('pack_unavailable');
    expect(badPack.reportError).toHaveBeenCalledWith('pack_unavailable');
  });

  it.each([
    ['superseded', { status: 'rejected', reason: 'superseded' }],
    ['graph_not_active', { status: 'rejected', reason: 'graph_not_active' }],
  ])('passes a rejected publication (%s) through without treating it as a fault', async (_label, outcome) => {
    const d = deps({ publish: vi.fn(async () => outcome) });
    const { status, body } = await run(d);
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: 'rejected', reason: outcome.reason });
    expect(d.reportError).not.toHaveBeenCalled();
  });

  it('reports a duplicate publication and fails on a broken publish', async () => {
    expect((await run(deps({ publish: vi.fn(async () => ({ status: 'duplicate', id: 'x' })) }))).body.status).toBe('duplicate');
    const broken = deps({ publish: vi.fn(async () => { throw new Error('rpc 500'); }) });
    expect((await run(broken)).status).toBe(503);
    expect(broken.reportError).toHaveBeenCalledWith('publish_failed');
    const unreadable = deps({ publish: vi.fn(async () => ({ status: 'weird' })) });
    expect((await run(unreadable)).status).toBe(503);
  });

  it('never reports feed payloads or readings through reportError or the response', async () => {
    const feed = { schemaVersion: 1, source: 'fixture-feed', readings: [{ stationId: 'sa', levelMeters: 17.123, observedAt: '2026-10-14T05:58:00Z', datum: 'TEST-MSL' }] };
    const d = deps({ stationSet: stationSetFor(['sa']), fetchFeed: vi.fn(async () => feed) });
    const response = await floodShadowHandler(d)(post());
    expect(await response.text()).not.toContain('17.123');
    for (const [event] of vi.mocked(d.reportError).mock.calls) expect(event).toMatch(/^[a-z_]+$/);
  });
});

describe('parseShadowHistory', () => {
  it('flattens runs and skips null entries', () => {
    expect(parseShadowHistory([[{ stationId: 'a', observedAt: 1, levelMeters: 2 }], null, []])).toEqual([{ stationId: 'a', observedAt: 1, levelMeters: 2 }]);
  });
  it('rejects anything but arrays of well-formed readings', () => {
    expect(parseShadowHistory({})).toBeNull();
    expect(parseShadowHistory([{}])).toBeNull();
    expect(parseShadowHistory([[{ stationId: 'a', observedAt: Number.NaN, levelMeters: 2 }]])).toBeNull();
  });
});

describe('fetchFeedJson', () => {
  const ok = (body: string, headers: Record<string, string> = {}) => vi.fn(async () => new Response(body, { status: 200, headers }));

  it('reads JSON over HTTPS without following redirects', async () => {
    const fetchImpl = ok('{"a":1}');
    await expect(fetchFeedJson('https://feed.example/levels.json', fetchImpl as unknown as typeof fetch, new AbortController().signal)).resolves.toEqual({ a: 1 });
    expect(fetchImpl.mock.calls[0]).toBeDefined();
  });

  it('refuses non-HTTPS URLs, error statuses and oversized bodies', async () => {
    const signal = new AbortController().signal;
    await expect(fetchFeedJson('http://feed.example/x', ok('{}') as unknown as typeof fetch, signal)).rejects.toThrow('feed_url_not_https');
    await expect(fetchFeedJson('https://feed.example/x', vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch, signal)).rejects.toThrow('feed_status_503');
    await expect(fetchFeedJson('https://feed.example/x', ok('{}', { 'content-length': String(FEED_LIMITS.maxBytes + 1) }) as unknown as typeof fetch, signal)).rejects.toThrow('feed_too_large');
    await expect(fetchFeedJson('https://feed.example/x', ok(JSON.stringify({ pad: 'x'.repeat(FEED_LIMITS.maxBytes) })) as unknown as typeof fetch, signal)).rejects.toThrow('feed_too_large');
  });

  it('rejects invalid JSON and invalid UTF-8', async () => {
    const signal = new AbortController().signal;
    await expect(fetchFeedJson('https://feed.example/x', ok('not json') as unknown as typeof fetch, signal)).rejects.toThrow();
    const invalidUtf8 = vi.fn(async () => new Response(new Uint8Array([0x7b, 0xff, 0x7d]), { status: 200 }));
    await expect(fetchFeedJson('https://feed.example/x', invalidUtf8 as unknown as typeof fetch, signal)).rejects.toThrow();
  });
});
