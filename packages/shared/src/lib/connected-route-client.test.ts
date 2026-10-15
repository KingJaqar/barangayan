import { describe, expect, it } from 'vitest';
import {
  describeConnectedFailure,
  parseConnectedRouteBody,
  requestConnectedRoute,
  type ConnectedRouteCall,
} from './connected-route-client';

const PROVENANCE = { graphVersion: 'g@2026-10-12#aaaaaaaaaaaa', conditionsRevision: 3, profileId: 'ampid-fine', configVersion: 'c', originRevision: 1 };
const SERVICE = { areaId: 'ampid-1', graphSha256: 'abc', osmBaseTimestamp: null, attribution: '© OpenStreetMap contributors', conditionsRevisedAt: '2026-10-14T00:00:00Z', conditionsGeneratedAt: '2026-10-14T00:00:01Z', modelStatus: 'unavailable' };
const OK_ROUTE = { status: 'ok', provenance: PROVENANCE, best: { centerId: 'c1', edgeIds: [], geometry: [], distanceMeters: 1, durationSeconds: 1, cost: 1, itinerary: [] }, shortest: null, shortestAvoids: [], centers: [], warnings: [] };

function call(fetchImpl: typeof fetch, extra: Partial<ConnectedRouteCall> = {}): ConnectedRouteCall {
  return {
    url: 'https://example.test/functions/v1/evacuation-route',
    anonKey: 'anon',
    request: { graphVersion: null, origin: { lat: 14.68, lng: 121.11, accuracyMeters: 10, revision: 1 }, originEdgeId: null, centerId: null, avoidEdgeIds: [], minConditionsRevision: null },
    fetchImpl,
    ...extra,
  };
}

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('requestConnectedRoute', () => {
  it('posts the origin in the body only and returns the route', async () => {
    let seen: { url: string; body: string } | null = null;
    const outcome = await requestConnectedRoute(
      call(((url: string, init: RequestInit) => {
        seen = { url, body: String(init.body) };
        return json(200, { route: OK_ROUTE, service: SERVICE });
      }) as unknown as typeof fetch),
    );
    expect(outcome.kind).toBe('route');
    expect(seen).not.toBeNull();
    expect(seen!.url).not.toMatch(/14\.68|121\.11/);
    expect(JSON.parse(seen!.body).origin.lat).toBe(14.68);
  });

  it('maps service errors to failures, never to a route', async () => {
    const outcome = await requestConnectedRoute(call((() => json(503, { error: 'graph_not_active', message: 'x' })) as unknown as typeof fetch));
    expect(outcome).toEqual({ kind: 'failure', failure: { reason: 'service', code: 'graph_not_active' } });
  });

  it('reports rate limiting with the wait', async () => {
    const outcome = await requestConnectedRoute(call((() => json(429, { error: 'rate_limited', message: 'x', retryAfterSeconds: 12 })) as unknown as typeof fetch));
    expect(outcome).toEqual({ kind: 'failure', failure: { reason: 'rate_limited', retryAfterSeconds: 12 } });
  });

  it('rejects an unreadable 200 body', async () => {
    const outcome = await requestConnectedRoute(call((() => json(200, { route: { status: 'weird' }, service: SERVICE })) as unknown as typeof fetch));
    expect(outcome).toEqual({ kind: 'failure', failure: { reason: 'invalid_response' } });
  });

  it('reports network failure as unreachable', async () => {
    const outcome = await requestConnectedRoute(call((() => Promise.reject(new TypeError('network'))) as unknown as typeof fetch));
    expect(outcome).toEqual({ kind: 'failure', failure: { reason: 'unreachable' } });
  });

  it('times out at the deadline', async () => {
    const hanging = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as unknown as typeof fetch;
    const outcome = await requestConnectedRoute(call(hanging, { deadlineMs: 20 }));
    expect(outcome).toEqual({ kind: 'failure', failure: { reason: 'timeout' } });
  });

  it('resolves cancelled when the caller aborts, before and during the request', async () => {
    const already = new AbortController();
    already.abort();
    expect(await requestConnectedRoute(call((() => json(200, {})) as unknown as typeof fetch, { signal: already.signal }))).toEqual({ kind: 'cancelled' });

    const later = new AbortController();
    const hanging = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as unknown as typeof fetch;
    const pending = requestConnectedRoute(call(hanging, { signal: later.signal }));
    later.abort();
    expect(await pending).toEqual({ kind: 'cancelled' });
  });
});

describe('parseConnectedRouteBody', () => {
  it('requires an ambiguous result to carry its candidates', () => {
    expect(parseConnectedRouteBody({ route: { status: 'attachment_ambiguous', provenance: PROVENANCE, warnings: [] }, service: SERVICE })).toBeNull();
  });
});

describe('describeConnectedFailure', () => {
  it('never suggests a straight-line route', () => {
    for (const failure of [{ reason: 'unreachable' }, { reason: 'timeout' }, { reason: 'invalid_response' }, { reason: 'service', code: 'unknown' }] as const) {
      expect(describeConnectedFailure(failure)).not.toMatch(/straight/i);
    }
  });
});
