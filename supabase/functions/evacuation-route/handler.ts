import {
  ROUTING_PROFILES,
  planEvacuationRouteAsync,
  prepareRoutingGraph,
  type PreparedRoutingGraph,
  type RoutingGraph,
} from '../../../packages/shared/src/lib/evacuation-routing.ts';
import {
  ROUTE_SERVICE_LIMITS,
  parseRouteConditionsSnapshot,
  parseRouteServiceRequest,
  selectRouteConditions,
  type RouteServiceError,
  type RouteServiceErrorCode,
  type RouteServiceSuccess,
} from '../../../packages/shared/src/lib/evacuation-route-service.ts';

/** Connected route service (DRRM weather-routing plan, phase R5), profile `ampid-fine`. */
export interface RoutingPack {
  graph: PreparedRoutingGraph;
  areaId: string;
  graphSha256: string;
  osmBaseTimestamp: string | null;
  attribution: string;
}

export class RoutingPackError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Verifies the bundled pack once per worker: graph.json must reproduce the bytes its manifest
 * hashes (the builder writes `JSON.stringify(graph)`), carry the manifest's graph version and
 * pass the core's graph validation.
 */
export async function loadRoutingPack(graph: unknown, manifest: unknown, sha256Hex: (text: string) => Promise<string>): Promise<RoutingPack> {
  if (!isRecord(manifest) || manifest.schemaVersion !== 1 || typeof manifest.areaId !== 'string' || typeof manifest.graphVersion !== 'string') {
    throw new RoutingPackError('manifest_invalid');
  }
  const { areaId, graphVersion, attribution, osmBaseTimestamp, resources } = manifest;
  if (typeof attribution !== 'string' || !(osmBaseTimestamp === null || typeof osmBaseTimestamp === 'string') || !Array.isArray(resources)) {
    throw new RoutingPackError('manifest_invalid');
  }
  const entry: unknown = resources.find(resource => isRecord(resource) && resource.path === 'graph.json');
  if (!isRecord(entry) || typeof entry.sha256 !== 'string' || typeof entry.bytes !== 'number') throw new RoutingPackError('manifest_invalid');

  const text = JSON.stringify(graph);
  if (new TextEncoder().encode(text).byteLength !== entry.bytes || (await sha256Hex(text)) !== entry.sha256) {
    throw new RoutingPackError('graph_hash_mismatch');
  }
  // The exact bytes the builder produced, so the shape is the builder's RoutingGraph.
  const prepared = prepareRoutingGraph(graph as RoutingGraph);
  if (!prepared.ok) throw new RoutingPackError('graph_invalid');
  if (prepared.graph.version !== graphVersion) throw new RoutingPackError('graph_version_mismatch');
  return { graph: prepared.graph, areaId, graphSha256: entry.sha256, osmBaseTimestamp, attribution };
}

export interface RouteServiceDependencies {
  /** The verified pack; memoized by the caller. */
  pack: () => Promise<RoutingPack>;
  /** get_routing_conditions_snapshot for the pack's area and graph. */
  conditions: (areaId: string, graphVersion: string, signal: AbortSignal) => Promise<unknown>;
  /** Counts one request for the client address; resolves to seconds to wait, 0 when allowed. */
  rateLimit: (clientAddress: string, signal: AbortSignal) => Promise<number>;
  /** Operational failures only, as fixed event names; never request data or coordinates. */
  reportError: (event: string) => void;
  /** Wall-clock ceiling for the route search, keeping CPU under the platform limit. */
  computeDeadlineMs: number;
  /** Awaited between search chunks so the deadline and client disconnects take effect. */
  yieldControl: () => Promise<void>;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Responses carry route geometry near the resident's position: never cached anywhere.
function reply(status: number, body: RouteServiceSuccess | RouteServiceError, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

const ERRORS: Record<RouteServiceErrorCode, { status: number; message: string }> = {
  method_not_allowed: { status: 405, message: 'Use POST to request a route.' },
  payload_too_large: { status: 413, message: 'The route request is too large.' },
  invalid_request: { status: 400, message: 'The route request is not valid.' },
  graph_version_mismatch: { status: 409, message: 'The route service uses a different map version.' },
  rate_limited: { status: 429, message: 'Too many route requests. Retry shortly.' },
  graph_unavailable: { status: 503, message: 'Route map data is unavailable.' },
  conditions_unavailable: { status: 503, message: 'Road conditions could not be loaded.' },
  invalid_conditions: { status: 503, message: 'Published road conditions are inconsistent.' },
  graph_not_active: { status: 503, message: 'The route service map is not the active map for this area.' },
  snapshot_outdated: { status: 503, message: 'The route service has older road conditions than this device.' },
  closures_unmapped: { status: 503, message: 'A verified road closure is not mapped onto the route map.' },
  deadline_exceeded: { status: 503, message: 'Route calculation took too long.' },
  // Non-standard 499 (client closed request): the response is never read.
  cancelled: { status: 499, message: 'The route request was cancelled.' },
};

function fail(code: RouteServiceErrorCode, extra: Partial<RouteServiceError> = {}, headers: Record<string, string> = {}): Response {
  const { status, message } = ERRORS[code];
  return reply(status, { error: code, message, ...extra }, headers);
}

/** Reads at most `max` bytes; null when the body is larger. */
async function readBody(req: Request, max: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) return null;
  if (req.body === null) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

const IP_ADDRESS = /^[0-9A-Fa-f:.]{2,45}$/;

/**
 * Client address for the per-address limit: the platform's `cf-connecting-ip`, else the first
 * `x-forwarded-for` entry. null when neither looks like an address; such requests are not
 * rate-limited, because one shared bucket could throttle every resident during an emergency.
 */
export function clientAddress(headers: Headers): string | null {
  const candidates = [headers.get('cf-connecting-ip'), headers.get('x-forwarded-for')?.split(',')[0]];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value !== undefined && IP_ADDRESS.test(value)) return value;
  }
  return null;
}

export function evacuationRouteHandler(deps: RouteServiceDependencies): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return fail('method_not_allowed');

    let body: string | null;
    try {
      body = await readBody(req, ROUTE_SERVICE_LIMITS.maxBodyBytes);
    } catch {
      return fail('invalid_request');
    }
    if (body === null) return fail('payload_too_large');
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return fail('invalid_request');
    }
    const parsed = parseRouteServiceRequest(json);
    if (!parsed.ok) return fail('invalid_request', { message: parsed.message });
    const request = parsed.value;

    let pack: RoutingPack;
    try {
      pack = await deps.pack();
    } catch {
      deps.reportError('graph_unavailable');
      return fail('graph_unavailable');
    }
    if (request.graphVersion !== null && request.graphVersion !== pack.graph.version) {
      return fail('graph_version_mismatch', { graphVersion: pack.graph.version });
    }

    const address = clientAddress(req.headers);
    if (address !== null) {
      let retryAfterSeconds = 0;
      try {
        retryAfterSeconds = await deps.rateLimit(address, req.signal);
      } catch {
        // Fail open: an unavailable limiter must not take emergency routing down with it.
        if (req.signal.aborted) return fail('cancelled');
        deps.reportError('rate_limiter_unavailable');
      }
      if (retryAfterSeconds > 0) {
        return fail('rate_limited', { retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });
      }
    }

    let snapshotJson: unknown;
    try {
      snapshotJson = await deps.conditions(pack.areaId, pack.graph.version, req.signal);
    } catch {
      if (req.signal.aborted) return fail('cancelled');
      deps.reportError('conditions_unavailable');
      return fail('conditions_unavailable');
    }
    const snapshot = parseRouteConditionsSnapshot(snapshotJson);
    if (snapshot === null) {
      deps.reportError('conditions_malformed');
      return fail('conditions_unavailable');
    }
    const selection = selectRouteConditions(snapshot, pack.graph, request.minConditionsRevision);
    if (!selection.ok) {
      if (selection.reason !== 'snapshot_outdated') deps.reportError(selection.reason);
      return fail(selection.reason);
    }

    const deadline = AbortSignal.timeout(deps.computeDeadlineMs);
    const route = await planEvacuationRouteAsync(
      {
        graph: pack.graph,
        conditions: selection.conditions,
        centers: selection.centers,
        request: {
          origin: request.origin,
          originEdgeId: request.originEdgeId,
          centerId: request.centerId,
          avoidEdgeIds: request.avoidEdgeIds,
        },
        profile: ROUTING_PROFILES['ampid-fine'],
      },
      { cancel: AbortSignal.any([req.signal, deadline]), yieldControl: deps.yieldControl },
    );
    if (route.status === 'cancelled') return fail(req.signal.aborted ? 'cancelled' : 'deadline_exceeded');
    if (route.status === 'invalid_conditions') {
      deps.reportError('conditions_inconsistent');
      return fail('invalid_conditions');
    }
    return reply(200, {
      route,
      service: {
        areaId: pack.areaId,
        graphSha256: pack.graphSha256,
        osmBaseTimestamp: pack.osmBaseTimestamp,
        attribution: pack.attribution,
        conditionsRevisedAt: snapshot.revisedAt,
        conditionsGeneratedAt: snapshot.generatedAt,
        modelStatus: 'unavailable',
      },
    });
  };
}
