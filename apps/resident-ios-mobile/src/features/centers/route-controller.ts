import {
  CONNECTED_ROUTE_DEADLINE_MS, requestConnectedRoute, type ConnectedRouteFailure, type ConnectedRouteOutcome, type ConnectedRouteResult,
} from '@barangayan/shared/src/lib/connected-route-client';
import type { RouteServiceRequest } from '@barangayan/shared/src/lib/evacuation-route-service';
import type { RouteSummary } from './center-model';

/** Refresh a good answer every 30 s while the screen is visible; back off after failures up to 5 minutes (plan §4, as on web and Android). */
export const ROUTE_REFRESH_MS = 30_000;
export const ROUTE_MAX_BACKOFF_MS = 300_000;
/** After this many failures in a row the controller stops asking by itself; the resident can ask again. */
export const ROUTE_MAX_FAILURES = 5;

/** Where a route starts: the accepted device fix, or a spot the resident placed on the map. */
export type RouteOrigin = { lat: number; lng: number; accuracyMeters: number | null; revision: number; kind: 'device' | 'manual' };
/** A street picked from the chooser; it belongs to one origin and to the graph named in the answer that offered it. */
export type SegmentChoice = { originKey: string; graphVersion: string; edgeId: string };
export type RouteInput = { origin: RouteOrigin; centerId: string | null; segment: SegmentChoice | null };

export function originKey(origin: RouteOrigin): string {
  return `${origin.kind}:${origin.revision}:${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`;
}
/** An answer belongs to exactly one origin revision, center and street choice. */
export function routeKey(input: RouteInput): string {
  const segment = input.segment && input.segment.originKey === originKey(input.origin) ? input.segment : null;
  return JSON.stringify([originKey(input.origin), input.centerId, segment?.graphVersion ?? null, segment?.edgeId ?? null]);
}

export function buildRouteRequest(input: RouteInput, minConditionsRevision: number | null): RouteServiceRequest {
  const segment = input.segment && input.segment.originKey === originKey(input.origin) ? input.segment : null;
  return {
    graphVersion: segment?.graphVersion ?? null,
    origin: { lat: input.origin.lat, lng: input.origin.lng, accuracyMeters: input.origin.accuracyMeters, revision: input.origin.revision },
    originEdgeId: segment?.edgeId ?? null,
    centerId: input.centerId,
    avoidEdgeIds: [],
    minConditionsRevision,
  };
}

export function retryDelayMs(failures: number): number {
  return failures <= 0 ? ROUTE_REFRESH_MS : Math.min(ROUTE_MAX_BACKOFF_MS, ROUTE_REFRESH_MS * 2 ** failures);
}

export type RouteStatus =
  /** The route service is not opened for this build (release gate), or there is no starting point yet. */
  | 'unavailable' | 'idle'
  /** The screen is hidden or the app is in the background; nothing is being asked. */
  | 'paused'
  | 'loading' | 'ready' | 'failed';

export type RouteState = {
  status: RouteStatus;
  /** The newest answer for the current origin revision, center and street choice; never one for an earlier selection. */
  result: ConnectedRouteResult | null;
  failure: ConnectedRouteFailure | null;
  /** The latest refresh failed, so `result` is the previous answer for this selection and nothing new was calculated. */
  stale: boolean;
  /** When this device last received `result` (epoch ms). */
  checkedAt: number | null;
  attribution: string | null;
  ranking: RouteSummary[] | null;
  /** Automatic retries stopped after repeated failures; "Try again" asks once more. */
  gaveUp: boolean;
};

const IDLE: RouteState = { status: 'idle', result: null, failure: null, stale: false, checkedAt: null, attribution: null, ranking: null, gaveUp: false };

type Entry = { key: string; outcome: Extract<ConnectedRouteOutcome, { kind: 'route' }>; checkedAt: number };
type FailureEntry = { key: string; failure: ConnectedRouteFailure; failures: number };

export type RouteDependencies = {
  /** False keeps the controller from ever sending a request (release gate). */
  enabled: boolean;
  fetchRoute: (request: RouteServiceRequest, signal: AbortSignal) => Promise<ConnectedRouteOutcome>;
  schedule: (task: () => void, delayMs: number) => () => void;
  now: () => number;
};

export function liveRouteDependencies(url: string, anonKey: string, enabled: boolean): RouteDependencies {
  return {
    enabled,
    fetchRoute: (request, signal) => requestConnectedRoute({ url, anonKey, request, signal, deadlineMs: CONNECTED_ROUTE_DEADLINE_MS }),
    schedule: (task, delayMs) => { const timer = setTimeout(task, delayMs); return () => clearTimeout(timer); },
    now: Date.now,
  };
}

/** Same answer, same object: an unchanged refresh must not redraw (and refit) the map every 30 s. */
function sameRoute(a: Entry['outcome'], b: Entry['outcome']): boolean {
  return JSON.stringify(a.result) === JSON.stringify(b.result);
}

/**
 * The connected walking route for one screen (plan P14-T04…T06), after the web client's rules: one request in
 * flight, aborted when the origin, center or street choice changes, when the screen is hidden or the app goes to the
 * background, or when it is made inactive on unmount; an answer that arrives after that is discarded. Only an answer for the current key is
 * ever exposed, so old geometry disappears the moment the selection changes. A failure is reported in words and is
 * never turned into a straight line. Starting points live in memory only.
 */
export class RouteController {
  private input: RouteInput | null = null;
  private active = false;
  private entry: Entry | null = null;
  private failureEntry: FailureEntry | null = null;
  private newestRevision: number | null = null;
  private runKey: string | null = null;
  private abort: AbortController | null = null;
  private cancelTimer: (() => void) | null = null;
  private state: RouteState = IDLE;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly deps: RouteDependencies) {}

  getState = (): RouteState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  setInput(input: RouteInput | null): void { this.input = input; this.reconcile(false); }
  setActive(active: boolean): void { this.active = active; this.reconcile(false); }
  /** The resident asked again after a failure. */
  retry(): void { this.reconcile(true); }

  private stop(): void {
    this.abort?.abort();
    this.abort = null;
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.runKey = null;
  }

  private wantedKey(): string | null {
    return this.deps.enabled && this.active && this.input ? routeKey(this.input) : null;
  }

  private reconcile(force: boolean): void {
    const wanted = this.wantedKey();
    if (wanted === null) {
      this.stop();
    } else if (force || this.runKey !== wanted) {
      this.stop();
      if (force && this.failureEntry?.key === wanted) this.failureEntry = { ...this.failureEntry, failures: 0 };
      this.start(wanted);
    }
    this.publish();
  }

  private start(key: string): void {
    const input = this.input;
    if (!input) return;
    this.runKey = key;
    const abort = new AbortController();
    this.abort = abort;
    void this.ask(key, input, abort);
  }

  private async ask(key: string, input: RouteInput, abort: AbortController): Promise<void> {
    const outcome = await this.deps.fetchRoute(buildRouteRequest(input, this.newestRevision), abort.signal);
    // A late answer for a selection the resident has moved on from is dropped, not shown.
    if (abort.signal.aborted || this.runKey !== key || outcome.kind === 'cancelled') return;
    let failures = 0;
    if (outcome.kind === 'route') {
      this.newestRevision = Math.max(this.newestRevision ?? 0, outcome.result.provenance.conditionsRevision);
      const previous = this.entry;
      this.entry = previous && previous.key === key && sameRoute(previous.outcome, outcome) ? { ...previous, checkedAt: this.deps.now() } : { key, outcome, checkedAt: this.deps.now() };
      this.failureEntry = null;
    } else {
      failures = (this.failureEntry?.key === key ? this.failureEntry.failures : 0) + 1;
      this.failureEntry = { key, failure: outcome.failure, failures };
    }
    this.publish();
    if (failures >= ROUTE_MAX_FAILURES) return;
    this.cancelTimer = this.deps.schedule(() => {
      this.cancelTimer = null;
      if (this.runKey !== key) return;
      const next = new AbortController();
      this.abort = next;
      void this.ask(key, input, next);
    }, retryDelayMs(failures));
  }

  private publish(): void {
    this.state = this.compute();
    for (const listener of [...this.listeners]) listener();
  }

  private compute(): RouteState {
    if (!this.deps.enabled) return { ...IDLE, status: 'unavailable' };
    if (!this.input) return IDLE;
    const key = routeKey(this.input);
    const entry = this.entry?.key === key ? this.entry : null;
    const failure = this.failureEntry?.key === key ? this.failureEntry : null;
    const base = { gaveUp: failure !== null && failure.failures >= ROUTE_MAX_FAILURES };
    if (entry) {
      const result = entry.outcome.result;
      const ranking = result.status === 'ok' || result.status === 'no_route_within_coverage'
        ? result.centers.map((summary) => ({ centerId: summary.centerId, distanceMeters: summary.distanceMeters, durationSeconds: summary.durationSeconds }))
        : null;
      return {
        status: this.active ? 'ready' : 'paused', result, ranking, failure: failure?.failure ?? null, stale: failure !== null,
        checkedAt: entry.checkedAt, attribution: entry.outcome.service.attribution, ...base,
      };
    }
    if (failure) return { ...IDLE, status: this.active ? 'failed' : 'paused', failure: failure.failure, ...base };
    return { ...IDLE, status: this.active ? 'loading' : 'paused' };
  }
}
