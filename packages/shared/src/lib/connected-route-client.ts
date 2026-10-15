/**
 * Client side of the connected route service (DRRM weather-routing plan, phase R7): one POST to
 * the `evacuation-route` Edge Function, with the 10 s deadline of plan section 4, and a typed
 * outcome. Every non-route outcome is a service failure the caller reports in words; it is never
 * turned into a straight line (invariant 7) or a locally computed route on web (invariant 8).
 */
import type { RouteResult } from './evacuation-routing';
import type { RouteServiceErrorCode, RouteServiceProvenance, RouteServiceRequest } from './evacuation-route-service';

/** Plan section 4: route requests have a 10 s client deadline. */
export const CONNECTED_ROUTE_DEADLINE_MS = 10_000;

/** A route result the service computed; `cancelled` and `invalid_conditions` arrive as errors. */
export type ConnectedRouteResult = Exclude<RouteResult, { status: 'cancelled' | 'invalid_conditions' }>;

export type ConnectedRouteFailure =
  | { reason: 'unreachable' }
  | { reason: 'timeout' }
  | { reason: 'rate_limited'; retryAfterSeconds: number | null }
  | { reason: 'service'; code: RouteServiceErrorCode | 'unknown' }
  | { reason: 'invalid_response' };

export type ConnectedRouteOutcome =
  | { kind: 'route'; result: ConnectedRouteResult; service: RouteServiceProvenance }
  | { kind: 'failure'; failure: ConnectedRouteFailure }
  | { kind: 'cancelled' };

const ERROR_CODES: readonly RouteServiceErrorCode[] = [
  'method_not_allowed',
  'payload_too_large',
  'invalid_request',
  'graph_version_mismatch',
  'rate_limited',
  'graph_unavailable',
  'conditions_unavailable',
  'invalid_conditions',
  'graph_not_active',
  'snapshot_outdated',
  'closures_unmapped',
  'deadline_exceeded',
  'cancelled',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Route statuses an HTTP 200 may carry (the service answers the rest with an error body). */
const ROUTE_STATUSES: readonly ConnectedRouteResult['status'][] = [
  'ok',
  'no_route_within_coverage',
  'attachment_ambiguous',
  'restrictions_unmapped',
  'invalid_origin',
  'outside_coverage',
  'no_nearby_path',
  'center_unavailable',
];

/** Checks the fields clients read; the body comes from our own service, not user input. */
export function parseConnectedRouteBody(body: unknown): { result: ConnectedRouteResult; service: RouteServiceProvenance } | null {
  if (!isRecord(body) || !isRecord(body.route) || !isRecord(body.service)) return null;
  const { route, service } = body;
  const status = ROUTE_STATUSES.find(s => s === route.status);
  if (status === undefined || !isRecord(route.provenance) || !Array.isArray(route.warnings)) return null;
  if (typeof service.graphSha256 !== 'string' || typeof service.attribution !== 'string' || typeof service.conditionsRevisedAt !== 'string') return null;
  if (status === 'ok' && (!isRecord(route.best) || !Array.isArray(route.centers))) return null;
  if (status === 'attachment_ambiguous' && !Array.isArray(route.candidates)) return null;
  return { result: route as unknown as ConnectedRouteResult, service: service as unknown as RouteServiceProvenance };
}

export interface ConnectedRouteCall {
  /** Full URL of the `evacuation-route` function. */
  url: string;
  anonKey: string;
  request: RouteServiceRequest;
  /** Aborting resolves to `cancelled` (the caller decided the answer is no longer wanted). */
  signal?: AbortSignal;
  deadlineMs?: number;
  fetchImpl?: typeof fetch;
}

export async function requestConnectedRoute(call: ConnectedRouteCall): Promise<ConnectedRouteOutcome> {
  const { url, anonKey, request, signal, deadlineMs = CONNECTED_ROUTE_DEADLINE_MS, fetchImpl = fetch } = call;
  if (signal?.aborted) return { kind: 'cancelled' };
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deadlineMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    // Origins travel only in the POST body (plan section 4).
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (signal?.aborted) return { kind: 'cancelled' };
      return { kind: 'failure', failure: { reason: timedOut ? 'timeout' : 'invalid_response' } };
    }
    if (response.ok) {
      const parsed = parseConnectedRouteBody(body);
      return parsed === null
        ? { kind: 'failure', failure: { reason: 'invalid_response' } }
        : { kind: 'route', result: parsed.result, service: parsed.service };
    }
    const code = isRecord(body) ? ERROR_CODES.find(c => c === body.error) : undefined;
    if (code === 'rate_limited') {
      const retry = isRecord(body) && typeof body.retryAfterSeconds === 'number' && Number.isFinite(body.retryAfterSeconds) ? body.retryAfterSeconds : null;
      return { kind: 'failure', failure: { reason: 'rate_limited', retryAfterSeconds: retry } };
    }
    return { kind: 'failure', failure: { reason: 'service', code: code ?? 'unknown' } };
  } catch {
    if (signal?.aborted) return { kind: 'cancelled' };
    return { kind: 'failure', failure: { reason: timedOut ? 'timeout' : 'unreachable' } };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** One plain-language sentence for a failed request (plan section 4: failure messages). */
export function describeConnectedFailure(failure: ConnectedRouteFailure): string {
  switch (failure.reason) {
    case 'unreachable':
      return 'The route service could not be reached. Check your internet connection.';
    case 'timeout':
      return 'The route service took too long to answer.';
    case 'rate_limited':
      return 'Too many route requests right now. Please wait a moment and try again.';
    case 'invalid_response':
      return 'The route service sent an answer this app could not read.';
    case 'service':
      switch (failure.code) {
        case 'graph_not_active':
        case 'graph_unavailable':
        case 'graph_version_mismatch':
          return 'Walking routes are not available yet for this area.';
        case 'snapshot_outdated':
        case 'conditions_unavailable':
        case 'invalid_conditions':
        case 'closures_unmapped':
          return 'Current road conditions are not available, so no route is shown.';
        case 'deadline_exceeded':
          return 'The route took too long to calculate. Try again.';
        default:
          return 'The route service had a problem. Try again shortly.';
      }
  }
}
