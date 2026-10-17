import type { ConnectedRouteFailure, ConnectedRouteOutcome, ConnectedRouteResult } from '@barangayan/shared/src/lib/connected-route-client';
import type { RouteServiceRequest } from '@barangayan/shared/src/lib/evacuation-route-service';
import { describe, expect, it } from 'vitest';
import { describeRoute } from '../src/features/centers/route-copy';
import {
  buildRouteRequest, originKey, retryDelayMs, RouteController, routeKey, ROUTE_MAX_BACKOFF_MS, ROUTE_MAX_FAILURES, ROUTE_REFRESH_MS,
  type RouteDependencies, type RouteInput, type RouteOrigin,
} from '../src/features/centers/route-controller';

const CENTER_A = '00000000-0000-4000-8000-00000000000a';
const CENTER_B = '00000000-0000-4000-8000-00000000000b';
const device = (revision: number, patch: Partial<RouteOrigin> = {}): RouteOrigin => ({ lat: 14.6811, lng: 121.1172, accuracyMeters: 12, revision, kind: 'device', ...patch });
const input = (patch: Partial<RouteInput> = {}): RouteInput => ({ origin: device(1), centerId: CENTER_A, segment: null, ...patch });

function okResult(centerId: string, conditionsRevision = 5, distanceMeters = 650): ConnectedRouteResult {
  return {
    status: 'ok', provenance: { graphVersion: 'ampid-1@2026-10-12#abcdef012345', conditionsRevision, profileId: 'walk', configVersion: '1', originRevision: 1 },
    best: { centerId, edgeIds: ['e1'], geometry: [[121.1172, 14.6811], [121.1175, 14.6815]], distanceMeters, durationSeconds: 540, cost: 1, itinerary: [] },
    shortest: null, shortestAvoids: [], centers: [{ centerId, availability: 'available', excluded: null, distanceMeters, durationSeconds: 540, cost: 1 }], warnings: [],
  } as unknown as ConnectedRouteResult;
}
const route = (result: ConnectedRouteResult): ConnectedRouteOutcome => ({
  kind: 'route', result,
  service: { areaId: 'ampid-1', graphSha256: 'x', osmBaseTimestamp: null, attribution: '© OpenStreetMap contributors', conditionsRevisedAt: '2026-10-16T00:00:00Z', conditionsGeneratedAt: '2026-10-16T00:00:00Z', modelStatus: 'unavailable' },
});
const failure = (value: ConnectedRouteFailure): ConnectedRouteOutcome => ({ kind: 'failure', failure: value });

type Pending = { request: RouteServiceRequest; signal: AbortSignal; resolve: (outcome: ConnectedRouteOutcome) => void };
function harness(enabled = true) {
  const pending: Pending[] = [];
  const timers: { task: () => void; delayMs: number; cancelled: boolean }[] = [];
  let clock = 1_000_000;
  const deps: RouteDependencies = {
    enabled,
    fetchRoute: (request, signal) => new Promise((resolve) => { pending.push({ request, signal, resolve }); }),
    schedule: (task, delayMs) => { const timer = { task, delayMs, cancelled: false }; timers.push(timer); return () => { timer.cancelled = true; }; },
    now: () => clock,
  };
  const controller = new RouteController(deps);
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
  return { controller, pending, timers, flush, advance: (ms: number) => { clock += ms; }, live: () => timers.filter((timer) => !timer.cancelled),
    /** Runs the newest timer that has not been cancelled or fired. */
    fire: () => { const timer = timers.filter((item) => !item.cancelled).at(-1); if (!timer) throw new Error('no timer'); timer.cancelled = true; timer.task(); } };
}

describe('route request and keys (P14-T04/T05)', () => {
  it('sends the origin, the chosen center and nothing else about the resident', () => {
    expect(buildRouteRequest(input(), null)).toEqual({
      graphVersion: null, origin: { lat: 14.6811, lng: 121.1172, accuracyMeters: 12, revision: 1 }, originEdgeId: null, centerId: CENTER_A, avoidEdgeIds: [], minConditionsRevision: null,
    });
  });
  it('keys an answer on origin revision and position, center and street choice', () => {
    const base = routeKey(input());
    expect(routeKey(input({ origin: device(2) }))).not.toBe(base);
    expect(routeKey(input({ origin: device(1, { lat: 14.7 }) }))).not.toBe(base);
    expect(routeKey(input({ origin: device(1, { kind: 'manual' }) }))).not.toBe(base);
    expect(routeKey(input({ centerId: CENTER_B }))).not.toBe(base);
    expect(routeKey(input({ centerId: null }))).not.toBe(base);
    const segment = { originKey: originKey(device(1)), graphVersion: 'g@2026-10-12#abcdef012345', edgeId: 'e9' };
    expect(routeKey(input({ segment }))).not.toBe(base);
    expect(buildRouteRequest(input({ segment }), 7)).toMatchObject({ graphVersion: segment.graphVersion, originEdgeId: 'e9', minConditionsRevision: 7 });
  });
  it('ignores a street choice made for another starting point', () => {
    const stale = { originKey: originKey(device(1)), graphVersion: 'g@2026-10-12#abcdef012345', edgeId: 'e9' };
    const next = input({ origin: device(2), segment: stale });
    expect(routeKey(next)).toBe(routeKey(input({ origin: device(2) })));
    expect(buildRouteRequest(next, null)).toMatchObject({ graphVersion: null, originEdgeId: null });
  });
  it('backs off from 30 s after a failure up to five minutes', () => {
    expect(retryDelayMs(0)).toBe(ROUTE_REFRESH_MS);
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(2)).toBe(120_000);
    expect(retryDelayMs(10)).toBe(ROUTE_MAX_BACKOFF_MS);
  });
});

describe('route controller lifecycle (P14-T05, P14-T06, T24)', () => {
  it('never asks while the release gate is closed', async () => {
    const h = harness(false);
    h.controller.setActive(true);
    h.controller.setInput(input());
    await h.flush();
    expect(h.pending).toHaveLength(0);
    expect(h.controller.getState().status).toBe('unavailable');
    expect(describeRoute(h.controller.getState(), { now: 0, hasStartingPoint: true, selectedId: CENTER_A }).lines[0].text).toContain('straight-line estimates');
  });
  it('asks nothing without a starting point or while the screen is hidden or the app is in the background', async () => {
    const h = harness();
    h.controller.setActive(true);
    await h.flush();
    expect(h.pending).toHaveLength(0);
    expect(h.controller.getState().status).toBe('idle');
    h.controller.setInput(input());
    h.controller.setActive(false);
    await h.flush();
    expect(h.pending).toHaveLength(1);
    expect(h.pending[0].signal.aborted).toBe(true);
    expect(h.controller.getState().status).toBe('paused');
  });
  it('shows loading, then the route for the selected center, and refreshes every 30 s', async () => {
    const h = harness();
    h.controller.setActive(true);
    h.controller.setInput(input());
    expect(h.controller.getState().status).toBe('loading');
    h.pending[0].resolve(route(okResult(CENTER_A)));
    await h.flush();
    const state = h.controller.getState();
    expect(state.status).toBe('ready');
    expect(state.result?.status).toBe('ok');
    expect(state.ranking).toEqual([{ centerId: CENTER_A, distanceMeters: 650, durationSeconds: 540 }]);
    expect(state.attribution).toContain('OpenStreetMap');
    expect(h.live().map((timer) => timer.delayMs)).toEqual([ROUTE_REFRESH_MS]);
  });
  it('keeps the same result object when a refresh returns the same route, so the map is not redrawn', async () => {
    const h = harness();
    h.controller.setActive(true);
    h.controller.setInput(input());
    h.pending[0].resolve(route(okResult(CENTER_A)));
    await h.flush();
    const first = h.controller.getState().result;
    h.advance(30_000);
    h.fire();
    await h.flush();
    h.pending[1].resolve(route(okResult(CENTER_A)));
    await h.flush();
    expect(h.controller.getState().result).toBe(first);
    expect(h.controller.getState().checkedAt).toBe(1_030_000);
  });
  it('drops a late answer for a center the resident has moved on from and clears the old geometry at once', async () => {
    const h = harness();
    h.controller.setActive(true);
    h.controller.setInput(input());
    h.pending[0].resolve(route(okResult(CENTER_A)));
    await h.flush();
    expect(h.controller.getState().result).not.toBeNull();
    h.controller.setInput(input({ centerId: CENTER_B }));
    expect(h.controller.getState().result).toBeNull();
    expect(h.controller.getState().status).toBe('loading');
    h.controller.setInput(input({ centerId: CENTER_A }));
    // the request for B is superseded; its answer arrives late
    h.pending[1].resolve(route(okResult(CENTER_B, 9)));
    await h.flush();
    expect(h.pending[1].signal.aborted).toBe(true);
    h.pending[2].resolve(route(okResult(CENTER_A, 5)));
    await h.flush();
    const state = h.controller.getState();
    expect(state.result && state.result.status === 'ok' && state.result.best.centerId).toBe(CENTER_A);
  });
  it('drops an answer for an earlier origin revision', async () => {
    const h = harness();
    h.controller.setActive(true);
    h.controller.setInput(input({ origin: device(1) }));
    h.controller.setInput(input({ origin: device(2) }));
    expect(h.pending).toHaveLength(2);
    h.pending[0].resolve(route(okResult(CENTER_A)));
    await h.flush();
    expect(h.controller.getState().status).toBe('loading');
    expect(h.controller.getState().result).toBeNull();
  });
  it('ignores an answer that arrives after the app went to the background', async () => {
    const h = harness();
    h.controller.setActive(true);
    h.controller.setInput(input());
    h.controller.setActive(false);
    h.pending[0].resolve(route(okResult(CENTER_A)));
    await h.flush();
    expect(h.controller.getState().result).toBeNull();
    expect(h.live()).toHaveLength(0);
  });
  it('asks again when the app comes back and never accepts an older conditions revision', async () => {
    const h = harness();
    h.controller.setActive(true);
    h.controller.setInput(input());
    h.pending[0].resolve(route(okResult(CENTER_A, 12)));
    await h.flush();
    h.controller.setActive(false);
    expect(h.live()).toHaveLength(0);
    h.controller.setActive(true);
    expect(h.pending).toHaveLength(2);
    expect(h.pending[1].request.minConditionsRevision).toBe(12);
  });
  it('treats a cancelled request as no answer', async () => {
    const h = harness();
    h.controller.setActive(true);
    h.controller.setInput(input());
    h.pending[0].resolve({ kind: 'cancelled' });
    await h.flush();
    expect(h.controller.getState().status).toBe('loading');
    expect(h.live()).toHaveLength(0);
  });
  it('reports a failure in words, keeps the previous route as stale, and backs off', async () => {
    const h = harness();
    h.controller.setActive(true);
    h.controller.setInput(input());
    h.pending[0].resolve(failure({ reason: 'unreachable' }));
    await h.flush();
    expect(h.controller.getState().status).toBe('failed');
    expect(h.live().map((timer) => timer.delayMs)).toEqual([60_000]);
    const text = describeRoute(h.controller.getState(), { now: 0, hasStartingPoint: true, selectedId: CENTER_A });
    expect(text.lines.map((line) => line.text).join(' ')).toContain('could not be reached');
    expect(text.lines.map((line) => line.text).join(' ')).toContain('straight-line estimates');
    expect(text.summary).toBeNull();
    expect(text.retryable).toBe(true);

    h.fire();
    h.pending[1].resolve(route(okResult(CENTER_A)));
    await h.flush();
    expect(h.controller.getState().status).toBe('ready');
    h.fire();
    await h.flush();
    h.pending[2].resolve(failure({ reason: 'timeout' }));
    await h.flush();
    const stale = h.controller.getState();
    expect(stale.stale).toBe(true);
    expect(stale.result).not.toBeNull();
    expect(describeRoute(stale, { now: 1_000_000, hasStartingPoint: true, selectedId: CENTER_A }).lines[0].text).toContain('Showing the last route received');
  });
  it('stops retrying by itself after repeated failures and retries once when asked', async () => {
    const h = harness();
    h.controller.setActive(true);
    h.controller.setInput(input());
    for (let attempt = 0; attempt < ROUTE_MAX_FAILURES; attempt++) {
      h.pending[attempt].resolve(failure({ reason: 'service', code: 'unknown' }));
      await h.flush();
      if (attempt < ROUTE_MAX_FAILURES - 1) h.fire();
    }
    expect(h.pending).toHaveLength(ROUTE_MAX_FAILURES);
    expect(h.live()).toHaveLength(0);
    expect(h.controller.getState().gaveUp).toBe(true);
    h.controller.retry();
    expect(h.pending).toHaveLength(ROUTE_MAX_FAILURES + 1);
    expect(h.controller.getState().gaveUp).toBe(false);
  });
  it('stops everything when the starting point is removed', async () => {
    const h = harness();
    h.controller.setActive(true);
    h.controller.setInput(input());
    h.controller.setInput(null);
    expect(h.pending[0].signal.aborted).toBe(true);
    expect(h.controller.getState().status).toBe('idle');
  });
  it('notifies subscribers and stops after unsubscribe', async () => {
    const h = harness();
    let calls = 0;
    const off = h.controller.subscribe(() => { calls++; });
    h.controller.setActive(true);
    h.controller.setInput(input());
    expect(calls).toBeGreaterThan(0);
    const seen = calls;
    off();
    h.controller.setInput(input({ centerId: CENTER_B }));
    expect(calls).toBe(seen);
  });
});

describe('route card wording (A24-019…023, no safety claim)', () => {
  const ready = (result: ConnectedRouteResult) => {
    const h = harness();
    h.controller.setActive(true);
    h.controller.setInput(input());
    h.pending[0].resolve(route(result));
    return h.flush().then(() => h.controller.getState());
  };
  it('summarises the walking route for the selected center and never promises safety', async () => {
    const state = await ready(okResult(CENTER_A));
    const description = describeRoute(state, { now: 1_000_000, hasStartingPoint: true, selectedId: CENTER_A });
    expect(description.summary).toBe('Walking route: 650 m, about 9 min');
    expect(description.lines.map((line) => line.text).join(' ')).toContain('cannot confirm that a route is safe');
    expect(description.attribution).toContain('OpenStreetMap');
  });
  it('shows no route summary for a center other than the one routed', async () => {
    const state = await ready(okResult(CENTER_B));
    expect(describeRoute(state, { now: 1_000_000, hasStartingPoint: true, selectedId: CENTER_A }).summary).toBeNull();
  });
  it('explains an unreachable center and keeps the distance an estimate', async () => {
    const state = await ready({ status: 'no_route_within_coverage', provenance: okResult(CENTER_A).provenance, attachment: null, centers: [], warnings: [] } as unknown as ConnectedRouteResult);
    const description = describeRoute(state, { now: 1_000_000, hasStartingPoint: true, selectedId: CENTER_A });
    expect(description.lines.map((line) => line.text).join(' ')).toContain('No open walking route reaches this center');
    expect(description.lines.map((line) => line.text).join(' ')).toContain('straight-line estimates');
    expect(description.summary).toBeNull();
  });
  it('offers the street chooser when the starting point is ambiguous', async () => {
    const candidates = [{ edgeId: 'e1', name: 'Main St', distanceMeters: 8 }, { edgeId: 'e2', name: null, distanceMeters: 20 }];
    const state = await ready({ status: 'attachment_ambiguous', provenance: okResult(CENTER_A).provenance, candidates, warnings: [] } as unknown as ConnectedRouteResult);
    const description = describeRoute(state, { now: 1_000_000, hasStartingPoint: true, selectedId: CENTER_A });
    expect(description.candidates).toHaveLength(2);
    expect(description.graphVersion).toBe('ampid-1@2026-10-12#abcdef012345');
  });
  it('says what to do without a starting point', () => {
    const state = harness().controller.getState();
    expect(describeRoute(state, { now: 0, hasStartingPoint: false, selectedId: null }).lines[0].text).toContain('Use your location or place a starting point');
  });
});
