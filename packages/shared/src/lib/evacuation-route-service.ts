/**
 * Connected route service contract (DRRM weather-routing plan, phase R5): the request the
 * `evacuation-route` Edge Function accepts, its responses, and the pure snapshot selection
 * that turns a published conditions snapshot (migration 0113) into routing inputs.
 *
 * Only erasable type imports (with the `.ts` extension, R0 bundling decision), so the Edge
 * Function loads this file by relative path and the apps can share the contract in R7.
 */
import type {
  CenterAvailability,
  CompiledRoutingConditions,
  PreparedRoutingGraph,
  RouteRequest,
  RouteResult,
  RoutingCenter,
} from './evacuation-routing.ts';

export const ROUTE_SERVICE_LIMITS = Object.freeze({
  /** Request body ceiling in bytes; a full avoidance list of pack edge ids fits well inside. */
  maxBodyBytes: 16_384,
  /** Local avoidance marks per request (the per-closure segment ceiling of migration 0113). */
  maxAvoidEdgeIds: 200,
});

/** Same character set and length as barangayan_private.routing_ids_valid (migration 0113). */
const ROUTING_ID_PATTERN = /^[A-Za-z0-9:/._-]{1,160}$/;
/** Same as the routing_graph_versions check (migration 0113). */
const GRAPH_VERSION_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}@[0-9]{4}-[0-9]{2}-[0-9]{2}#[0-9a-f]{12}$/;

const REQUEST_KEYS: readonly string[] = ['graphVersion', 'origin', 'originEdgeId', 'centerId', 'avoidEdgeIds', 'minConditionsRevision'];
const ORIGIN_KEYS: readonly string[] = ['lat', 'lng', 'accuracyMeters', 'revision'];

/** POST body of the `evacuation-route` function. Origins travel only in this body (plan section 4). */
export interface RouteServiceRequest {
  /** Graph that `originEdgeId` and `avoidEdgeIds` refer to; required when either is set. */
  graphVersion: string | null;
  origin: RouteRequest['origin'];
  /** Segment picked from an `attachment_ambiguous` chooser of the same graph. */
  originEdgeId: string | null;
  /** null = automatic: the nearest confirmed-available center by route cost. */
  centerId: string | null;
  /** Local avoidance marks (both directions blocked); never a verified closure. */
  avoidEdgeIds: string[];
  /** Newest conditions revision the client has seen; an older server snapshot is refused. */
  minConditionsRevision: number | null;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRoutingId(value: unknown): value is string {
  return typeof value === 'string' && ROUTING_ID_PATTERN.test(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function optional<T>(record: Record<string, unknown>, key: string, fallback: T): unknown {
  return record[key] === undefined ? fallback : record[key];
}

/**
 * Validates the request shape. Coordinate ranges are left to the routing core, which answers
 * `invalid_origin` so clients can tell a bad origin apart from a malformed request.
 */
export function parseRouteServiceRequest(value: unknown): Parsed<RouteServiceRequest> {
  if (!isRecord(value) || Object.keys(value).some(key => !REQUEST_KEYS.includes(key))) {
    return { ok: false, message: 'Send an origin and the optional route fields only.' };
  }
  const origin = value.origin;
  if (!isRecord(origin) || Object.keys(origin).some(key => !ORIGIN_KEYS.includes(key))) {
    return { ok: false, message: 'Send the origin as lat, lng, accuracyMeters and revision.' };
  }
  const accuracyMeters = optional(origin, 'accuracyMeters', null);
  if (!isFiniteNumber(origin.lat) || !isFiniteNumber(origin.lng) || !(accuracyMeters === null || isFiniteNumber(accuracyMeters))) {
    return { ok: false, message: 'The origin needs numeric coordinates and a numeric or null accuracy.' };
  }
  if (!isRevision(origin.revision)) return { ok: false, message: 'The origin revision must be a whole number of zero or more.' };

  const graphVersion = optional(value, 'graphVersion', null);
  if (graphVersion !== null && !(typeof graphVersion === 'string' && GRAPH_VERSION_PATTERN.test(graphVersion))) {
    return { ok: false, message: 'The graph version is not valid.' };
  }
  const originEdgeId = optional(value, 'originEdgeId', null);
  if (originEdgeId !== null && !isRoutingId(originEdgeId)) return { ok: false, message: 'The chosen street segment id is not valid.' };
  const centerId = optional(value, 'centerId', null);
  if (centerId !== null && !isRoutingId(centerId)) return { ok: false, message: 'The center id is not valid.' };
  const avoidEdgeIds = optional(value, 'avoidEdgeIds', []);
  if (!Array.isArray(avoidEdgeIds) || avoidEdgeIds.length > ROUTE_SERVICE_LIMITS.maxAvoidEdgeIds || !avoidEdgeIds.every(isRoutingId)) {
    return { ok: false, message: `Send at most ${ROUTE_SERVICE_LIMITS.maxAvoidEdgeIds} valid avoided segment ids.` };
  }
  if (graphVersion === null && (originEdgeId !== null || avoidEdgeIds.length > 0)) {
    return { ok: false, message: 'Segment ids need the graph version they belong to.' };
  }
  const minConditionsRevision = optional(value, 'minConditionsRevision', null);
  if (minConditionsRevision !== null && !isRevision(minConditionsRevision)) {
    return { ok: false, message: 'The conditions revision must be a whole number of zero or more.' };
  }

  return {
    ok: true,
    value: {
      graphVersion,
      origin: { lat: origin.lat, lng: origin.lng, accuracyMeters, revision: origin.revision },
      originEdgeId,
      centerId,
      avoidEdgeIds: [...avoidEdgeIds],
      minConditionsRevision,
    },
  };
}

/**
 * The parts of a get_routing_conditions_snapshot result (migration 0113) that routing reads.
 * The full snapshot is described by `routingConditionsSnapshotSchema`; this zod-free parser
 * exists because the Edge Function imports no packages.
 */
export interface RouteConditionsSnapshot {
  areaId: string;
  revision: number;
  revisedAt: string;
  generatedAt: string;
  graphVersion: string | null;
  graphStatus: 'none' | 'active' | 'registered' | 'unregistered';
  /** Active verified closures; `edgeIds` is null when unmapped for the requested graph. */
  closures: { id: string; edgeIds: string[] | null }[];
  centers: RoutingCenter[];
}

const GRAPH_STATUSES: readonly RouteConditionsSnapshot['graphStatus'][] = ['none', 'active', 'registered', 'unregistered'];
const CENTER_AVAILABILITIES: readonly CenterAvailability[] = ['available', 'unknown', 'unavailable'];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/** Returns null for anything that is not a complete schema-1 snapshot. */
export function parseRouteConditionsSnapshot(value: unknown): RouteConditionsSnapshot | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
  const { areaId, revision, revisedAt, generatedAt, graphVersion, graphStatus, closures, centers } = value;
  if (typeof areaId !== 'string' || !isRevision(revision) || typeof revisedAt !== 'string' || typeof generatedAt !== 'string') return null;
  if (!(graphVersion === null || typeof graphVersion === 'string')) return null;
  const status = GRAPH_STATUSES.find(s => s === graphStatus);
  if (status === undefined || !Array.isArray(closures) || !Array.isArray(centers)) return null;

  const parsedClosures: RouteConditionsSnapshot['closures'] = [];
  for (const closure of closures) {
    if (!isRecord(closure) || typeof closure.id !== 'string') return null;
    if (!(closure.edgeIds === null || isStringArray(closure.edgeIds))) return null;
    parsedClosures.push({ id: closure.id, edgeIds: closure.edgeIds === null ? null : [...closure.edgeIds] });
  }

  const parsedCenters: RoutingCenter[] = [];
  for (const center of centers) {
    if (!isRecord(center) || typeof center.id !== 'string' || typeof center.name !== 'string' || typeof center.active !== 'boolean') return null;
    const availability = CENTER_AVAILABILITIES.find(a => a === center.availability);
    if (availability === undefined || !(center.entranceNodeId === null || typeof center.entranceNodeId === 'string')) return null;
    parsedCenters.push({ id: center.id, name: center.name, entranceNodeId: center.entranceNodeId, availability, active: center.active });
  }

  return { areaId, revision, revisedAt, generatedAt, graphVersion, graphStatus: status, closures: parsedClosures, centers: parsedCenters };
}

export type RouteSnapshotRejection = 'graph_not_active' | 'snapshot_outdated' | 'closures_unmapped';

/**
 * Snapshot selection (plan sections 3.8 and 4). Routes only on the area's active graph, never
 * on a snapshot older than one the client has already seen, and never while a verified closure
 * lacks a mapping onto the graph (invariants 3 and 6). Routing is closure-only: no sensor
 * reading, traffic feed or model exclusion is accepted yet (stage 1, `modelStatus: 'unavailable'`).
 */
export function selectRouteConditions(
  snapshot: RouteConditionsSnapshot,
  graph: PreparedRoutingGraph,
  minConditionsRevision: number | null,
): { ok: true; conditions: CompiledRoutingConditions; centers: RoutingCenter[] } | { ok: false; reason: RouteSnapshotRejection } {
  if (snapshot.graphVersion !== graph.version || snapshot.graphStatus !== 'active') return { ok: false, reason: 'graph_not_active' };
  if (minConditionsRevision !== null && snapshot.revision < minConditionsRevision) return { ok: false, reason: 'snapshot_outdated' };
  const closed = new Set<string>();
  for (const closure of snapshot.closures) {
    if (closure.edgeIds === null || closure.edgeIds.some(id => !graph.edgeIndex.has(id))) return { ok: false, reason: 'closures_unmapped' };
    for (const id of closure.edgeIds) closed.add(id);
  }
  return {
    ok: true,
    conditions: {
      graphVersion: graph.version,
      revision: snapshot.revision,
      closedEdgeIds: [...closed].sort(),
      modelExcludedEdgeIds: [],
      stationReadings: [],
      traffic: [],
    },
    centers: snapshot.centers,
  };
}

/** No sensor or model input is accepted before R8/R9, so routing uses verified closures only. */
export type RouteModelStatus = 'unavailable';

/** Snapshot provenance carried with every route (plan section 4). */
export interface RouteServiceProvenance {
  areaId: string;
  /** SHA-256 of the graph resource the route was computed on (pack manifest). */
  graphSha256: string;
  osmBaseTimestamp: string | null;
  /** ODbL attribution clients must show with the route. */
  attribution: string;
  conditionsRevisedAt: string;
  conditionsGeneratedAt: string;
  modelStatus: RouteModelStatus;
}

/**
 * HTTP 200 body. `route.provenance` names the graph, conditions revision, profile, config and
 * origin revision. Cancellation and inconsistent published conditions are returned as errors.
 */
export interface RouteServiceSuccess {
  route: RouteResult;
  service: RouteServiceProvenance;
}

export type RouteServiceErrorCode =
  | 'method_not_allowed'
  | 'payload_too_large'
  | 'invalid_request'
  | 'graph_version_mismatch'
  | 'rate_limited'
  | 'graph_unavailable'
  | 'conditions_unavailable'
  | 'invalid_conditions'
  | RouteSnapshotRejection
  /** The rollout switch is off: the service is paused on purpose (plan 3.8, section 6). */
  | 'service_disabled'
  | 'deadline_exceeded'
  | 'cancelled';

/** Non-200 body. Every error is a service failure for the client; none is a route. */
export interface RouteServiceError {
  error: RouteServiceErrorCode;
  message: string;
  /** `graph_version_mismatch`: the graph the service routes on. */
  graphVersion?: string;
  /** `rate_limited`: also sent as the Retry-After header. */
  retryAfterSeconds?: number;
}
