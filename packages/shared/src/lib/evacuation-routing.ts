/**
 * Pure evacuation-routing core (DRRM weather-routing plan, phase R2).
 *
 * Implements the two algorithms of the RRL (Piamonte, Curada & Zaragoza 2026, "Project
 * Bantay", DOI 10.2991/978-94-6239-638-8_33): multi-source BFS flood propagation over a
 * 4-connected elevation grid (Algorithm 1) and min-heap Dijkstra that returns at the first
 * extracted shelter (Algorithm 2), with the edge weight w(e) = d(e)·(1 + α·f(e) + β·t(e)).
 * The plan's deviations (D1–D11, section 3.7) are marked where they apply.
 *
 * Deliberately import-free (R0 bundling decision): Edge Functions import this file by
 * relative path with its `.ts` extension, and Android runs the same file for offline
 * routing. Keep it to erasable TypeScript syntax and plain code-unit string comparison (no
 * `localeCompare`), so Node, Deno and Hermes break ties identically.
 */

// ---------------------------------------------------------------------------------------
// Versioned configuration (plan 3.2): profile values live here, not in code branches.
// ---------------------------------------------------------------------------------------

export const ROUTING_CONFIG_VERSION = '2026-10-12.r2';

export type RoutingProfileId = 'ampid-fine' | 'rrl-reference';

export interface RoutingProfile {
  id: RoutingProfileId;
  /** Flood-grid cell edge. The RRL uses ≈500 m; production uses 50 m (D10). */
  cellSizeMeters: number;
  /** Flood-risk coefficient α (RRL §2.5). */
  alpha: number;
  /** Traffic coefficient β (RRL §2.5). */
  beta: number;
  /** Upper bound of t(e). Illegible in the RRL text; [0, 1] is assumed until the PDF check (plan 3.1). */
  trafficMax: number;
  /** A station applies to an edge within this distance of the segment geometry (RRL §2.5). */
  sensorRadiusMeters: number;
  /** Duration only, never optimization cost (plan 3.5). */
  walkingSpeedMps: number;
  stairsSpeedMps: number;
  /** Origins further than this from every eligible segment are not attached (plan section 2). */
  attachRadiusMeters: number;
}

const RRL_AND_PEDESTRIAN_CONSTANTS = {
  alpha: 10,
  beta: 0.5,
  trafficMax: 1,
  sensorRadiusMeters: 2000,
  walkingSpeedMps: 1.2,
  stairsSpeedMps: 0.6,
  attachRadiusMeters: 50,
} as const;

export const ROUTING_PROFILES: Readonly<Record<RoutingProfileId, Readonly<RoutingProfile>>> = Object.freeze({
  'ampid-fine': Object.freeze({ id: 'ampid-fine', cellSizeMeters: 50, ...RRL_AND_PEDESTRIAN_CONSTANTS }),
  'rrl-reference': Object.freeze({ id: 'rrl-reference', cellSizeMeters: 500, ...RRL_AND_PEDESTRIAN_CONSTANTS }),
});

// ---------------------------------------------------------------------------------------
// Geometry helpers. Coordinates are GeoJSON order ([lng, lat], WGS84) everywhere.
// ---------------------------------------------------------------------------------------

export type LngLat = readonly [number, number];

export interface RoutingPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6_371_000;
const DEG = Math.PI / 180;
/** Two points closer than this are the same place (endpoint matching, snapping onto a node). */
const SAME_POINT_METERS = 1;

interface XY {
  x: number;
  y: number;
}

/**
 * cos(degrees) by Taylor series in plain IEEE arithmetic (error < 1e-15 for |degrees| ≤ 90).
 * Engines may differ in the last bit of `Math.cos` (measured in R2: Node 24 vs Supabase
 * edge-runtime 1.76.2), which would let one snapshot attach an origin differently on the
 * server and on Android. `+`, `*`, `/` and `Math.sqrt` are exactly rounded everywhere.
 */
function cosDegrees(degrees: number): number {
  const x2 = degrees * DEG * (degrees * DEG);
  let term = 1;
  let sum = 1;
  for (let k = 1; k <= 11; k++) {
    term *= -x2 / ((2 * k - 1) * (2 * k));
    sum += term;
  }
  return sum;
}

/** Local equirectangular projection in meters; accurate to well under 1 % at barangay scale. */
function toXY(lng: number, lat: number, refLat: number): XY {
  return { x: lng * DEG * EARTH_RADIUS_METERS * cosDegrees(refLat), y: lat * DEG * EARTH_RADIUS_METERS };
}

function fromXY(p: XY, refLat: number): RoutingPoint {
  return { lat: p.y / (DEG * EARTH_RADIUS_METERS), lng: p.x / (DEG * EARTH_RADIUS_METERS * cosDegrees(refLat)) };
}

function distanceXY(a: XY, b: XY): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function isValidLngLat(lng: number, lat: number): boolean {
  return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

interface PolylineProjection {
  /** Nearest point on the polyline. */
  point: XY;
  distance: number;
  /** Index of the segment holding the nearest point. */
  segment: number;
  /** Share of the polyline's projected length before the nearest point, 0..1. */
  share: number;
}

function projectOntoPolyline(p: XY, line: readonly XY[]): PolylineProjection {
  let total = 0;
  const segmentLengths: number[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const length = distanceXY(line[i], line[i + 1]);
    segmentLengths.push(length);
    total += length;
  }
  let best: PolylineProjection = { point: line[0], distance: Infinity, segment: 0, share: 0 };
  let before = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    const length = segmentLengths[i];
    const t = length === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (length * length)));
    const point = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    const distance = distanceXY(p, point);
    if (distance < best.distance) {
      best = { point, distance, segment: i, share: total === 0 ? 0 : (before + t * length) / total };
    }
    before += length;
  }
  return best;
}

function polylineLengthXY(line: readonly XY[]): number {
  let total = 0;
  for (let i = 0; i + 1 < line.length; i++) total += distanceXY(line[i], line[i + 1]);
  return total;
}

function orientation(a: XY, b: XY, c: XY): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function withinBox(a: XY, b: XY, c: XY): boolean {
  return Math.min(a.x, b.x) <= c.x && c.x <= Math.max(a.x, b.x) && Math.min(a.y, b.y) <= c.y && c.y <= Math.max(a.y, b.y);
}

function segmentsIntersect(p1: XY, p2: XY, q1: XY, q2: XY): boolean {
  const d1 = orientation(q1, q2, p1);
  const d2 = orientation(q1, q2, p2);
  const d3 = orientation(p1, p2, q1);
  const d4 = orientation(p1, p2, q2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return (
    (d1 === 0 && withinBox(q1, q2, p1)) ||
    (d2 === 0 && withinBox(q1, q2, p2)) ||
    (d3 === 0 && withinBox(p1, p2, q1)) ||
    (d4 === 0 && withinBox(p1, p2, q2))
  );
}

/** Even-odd ray casting over GeoJSON polygon rings (outer ring plus holes). */
function insideRings(lng: number, lat: number, rings: ReadonlyArray<readonly LngLat[]>): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** The router's coverage test: inside GeoJSON polygon rings (even-odd, so holes are outside). */
export function isInsideCoverage(point: RoutingPoint, rings: ReadonlyArray<readonly LngLat[]>): boolean {
  return insideRings(point.lng, point.lat, rings);
}

/** Shortest distance in meters from `point` to a [lng, lat] polyline. */
export function distanceToPolylineMeters(point: RoutingPoint, geometry: readonly LngLat[]): number {
  const line = geometry.map(([lng, lat]) => toXY(lng, lat, point.lat));
  return projectOntoPolyline(toXY(point.lng, point.lat, point.lat), line).distance;
}

// ---------------------------------------------------------------------------------------
// Pedestrian graph (built offline per pack; plan section 2) and validation.
// ---------------------------------------------------------------------------------------

/** Pedestrian direction rules only; vehicle one-way tags do not bind walkers. */
export type PedestrianAccess = 'both' | 'forward' | 'backward' | 'none';

export interface RoutingNode {
  id: string;
  lat: number;
  lng: number;
}

export interface RoutingEdge {
  id: string;
  /** Node at geometry[0]. */
  from: string;
  /** Node at the last geometry point. */
  to: string;
  /** [lng, lat] points from `from` to `to`. */
  geometry: readonly LngLat[];
  lengthMeters: number;
  name: string | null;
  pedestrianAccess: PedestrianAccess;
  stairs: boolean;
  bridge: boolean;
  /** Stable source reference (OSM way and segment) used to remap restrictions across packs. */
  sourceRef: string;
}

/** Water or a wall: an origin is never attached across one (plan section 2). */
export interface RoutingBarrier {
  id: string;
  geometry: readonly LngLat[];
}

export interface StationEdgeApplicability {
  stationId: string;
  /** Edges whose geometry lies within the profile's sensor radius of the station (RRL §2.5). */
  edgeIds: readonly string[];
}

export interface RoutingGraph {
  version: string;
  /** Covered area (Ampid I boundary plus margin) as GeoJSON Polygon rings. */
  coverage: ReadonlyArray<readonly LngLat[]>;
  nodes: readonly RoutingNode[];
  edges: readonly RoutingEdge[];
  barriers: readonly RoutingBarrier[];
  stationEdges: readonly StationEdgeApplicability[];
}

/** One file of a routing pack. Hashes detect corruption; a trusted origin is still required (plan section 4). */
export interface RoutingPackResource {
  path: string;
  bytes: number;
  sha256: string;
  /** Devices download `device` resources; flood grids stay on the server (plan section 2). */
  audience: 'device' | 'server';
}

export interface RoutingPackManifest {
  schemaVersion: 1;
  areaId: string;
  graphVersion: string;
  configVersion: string;
  /** OSM database time of the source extract; null when the extract does not state it. */
  osmBaseTimestamp: string | null;
  boundarySha256: string;
  coverageMarginMeters: number;
  /** ODbL attribution the map must display. */
  attribution: string;
  /** Station-to-edge tables stay empty until verified station positions exist (plan 3.8 stage 2). */
  stations: 'unavailable' | 'verified';
  /** No licensed DEM yet: every flood-grid elevation is unknown (plan 3.2, R8). */
  terrain: 'unavailable';
  resources: RoutingPackResource[];
}

export type GraphIssueCode =
  | 'invalid_version'
  | 'empty_graph'
  | 'invalid_node'
  | 'duplicate_node'
  | 'duplicate_edge'
  | 'unknown_node'
  | 'self_loop'
  | 'invalid_access'
  | 'invalid_length'
  | 'invalid_geometry'
  | 'endpoint_mismatch'
  | 'length_mismatch'
  | 'invalid_source_ref'
  | 'invalid_coverage'
  | 'invalid_barrier'
  | 'invalid_station_edges';

export interface GraphIssue {
  code: GraphIssueCode;
  /** Id of the offending node, edge, barrier or station; '' for graph-level issues. */
  ref: string;
}

/** A validated graph in canonical (id-sorted) order, so results never depend on input order. */
export interface PreparedRoutingGraph {
  readonly version: string;
  readonly nodes: readonly RoutingNode[];
  readonly edges: readonly RoutingEdge[];
  readonly nodeIndex: ReadonlyMap<string, number>;
  readonly edgeIndex: ReadonlyMap<string, number>;
  readonly edgeFrom: Int32Array;
  readonly edgeTo: Int32Array;
  /** Edge indices touching each node, ascending. */
  readonly adjacency: ReadonlyArray<readonly number[]>;
  readonly coverage: ReadonlyArray<readonly LngLat[]>;
  readonly barriers: readonly RoutingBarrier[];
  readonly stationEdges: ReadonlyMap<string, readonly number[]>;
}

const PEDESTRIAN_ACCESS: readonly PedestrianAccess[] = ['both', 'forward', 'backward', 'none'];
/** Declared lengths may differ from projected geometry by this share (plus 1 m) before rejection. */
const LENGTH_TOLERANCE = 0.05;

function validLine(geometry: readonly LngLat[], minPoints: number): boolean {
  return Array.isArray(geometry) && geometry.length >= minPoints && geometry.every(p => Array.isArray(p) && p.length === 2 && isValidLngLat(p[0], p[1]));
}

/** Validates a pack graph; rejects incomplete topology and non-finite coordinates (plan section 2). */
export function prepareRoutingGraph(graph: RoutingGraph): { ok: true; graph: PreparedRoutingGraph } | { ok: false; issues: GraphIssue[] } {
  const issues: GraphIssue[] = [];
  if (typeof graph.version !== 'string' || graph.version === '') issues.push({ code: 'invalid_version', ref: '' });
  if (graph.edges.length === 0) issues.push({ code: 'empty_graph', ref: '' });

  const nodes = [...graph.nodes].sort((a, b) => compareIds(a.id, b.id));
  const nodeIndex = new Map<string, number>();
  nodes.forEach((node, i) => {
    if (typeof node.id !== 'string' || node.id === '' || !isValidLngLat(node.lng, node.lat)) issues.push({ code: 'invalid_node', ref: String(node.id) });
    if (nodeIndex.has(node.id)) issues.push({ code: 'duplicate_node', ref: node.id });
    else nodeIndex.set(node.id, i);
  });

  const edges = [...graph.edges].sort((a, b) => compareIds(a.id, b.id));
  const edgeIndex = new Map<string, number>();
  const edgeFrom = new Int32Array(edges.length);
  const edgeTo = new Int32Array(edges.length);
  edges.forEach((edge, i) => {
    if (edgeIndex.has(edge.id)) issues.push({ code: 'duplicate_edge', ref: edge.id });
    else edgeIndex.set(edge.id, i);
    const from = nodeIndex.get(edge.from);
    const to = nodeIndex.get(edge.to);
    if (from === undefined || to === undefined) {
      issues.push({ code: 'unknown_node', ref: edge.id });
      return;
    }
    edgeFrom[i] = from;
    edgeTo[i] = to;
    if (from === to) issues.push({ code: 'self_loop', ref: edge.id });
    if (!PEDESTRIAN_ACCESS.includes(edge.pedestrianAccess)) issues.push({ code: 'invalid_access', ref: edge.id });
    if (typeof edge.sourceRef !== 'string' || edge.sourceRef === '') issues.push({ code: 'invalid_source_ref', ref: edge.id });
    if (!Number.isFinite(edge.lengthMeters) || edge.lengthMeters <= 0) issues.push({ code: 'invalid_length', ref: edge.id });
    if (!validLine(edge.geometry, 2)) {
      issues.push({ code: 'invalid_geometry', ref: edge.id });
      return;
    }
    const fromNode = nodes[from];
    const toNode = nodes[to];
    const refLat = fromNode.lat;
    const line = edge.geometry.map(([lng, lat]) => toXY(lng, lat, refLat));
    // Catches swapped [lat, lng] order as well as dangling geometry.
    if (
      distanceXY(line[0], toXY(fromNode.lng, fromNode.lat, refLat)) > SAME_POINT_METERS ||
      distanceXY(line[line.length - 1], toXY(toNode.lng, toNode.lat, refLat)) > SAME_POINT_METERS
    ) {
      issues.push({ code: 'endpoint_mismatch', ref: edge.id });
      return;
    }
    const projected = polylineLengthXY(line);
    if (Number.isFinite(edge.lengthMeters) && Math.abs(edge.lengthMeters - projected) > 1 + LENGTH_TOLERANCE * projected) {
      issues.push({ code: 'length_mismatch', ref: edge.id });
    }
  });

  if (!Array.isArray(graph.coverage) || graph.coverage.length === 0 || !graph.coverage.every(ring => validLine(ring, 4))) {
    issues.push({ code: 'invalid_coverage', ref: '' });
  }
  for (const barrier of graph.barriers) {
    if (!validLine(barrier.geometry, 2)) issues.push({ code: 'invalid_barrier', ref: barrier.id });
  }

  const stationEdges = new Map<string, readonly number[]>();
  for (const entry of graph.stationEdges) {
    const indices = entry.edgeIds.map(id => edgeIndex.get(id));
    if (entry.stationId === '' || stationEdges.has(entry.stationId) || indices.some(i => i === undefined)) {
      issues.push({ code: 'invalid_station_edges', ref: entry.stationId });
      continue;
    }
    stationEdges.set(entry.stationId, indices.filter((i): i is number => i !== undefined).sort((a, b) => a - b));
  }

  if (issues.length > 0) return { ok: false, issues };

  const adjacency: number[][] = nodes.map(() => []);
  for (let i = 0; i < edges.length; i++) {
    adjacency[edgeFrom[i]].push(i);
    adjacency[edgeTo[i]].push(i);
  }

  return {
    ok: true,
    graph: {
      version: graph.version,
      nodes,
      edges,
      nodeIndex,
      edgeIndex,
      edgeFrom,
      edgeTo,
      adjacency,
      coverage: graph.coverage,
      barriers: [...graph.barriers].sort((a, b) => compareIds(a.id, b.id)),
      stationEdges,
    },
  };
}

/**
 * Edges whose geometry lies within the profile's sensor radius of a station (RRL §2.5:
 * distance to the segment geometry, not to its endpoints). Pack builders store the result as
 * `RoutingGraph.stationEdges`.
 */
export function stationApplicableEdgeIds(edges: readonly RoutingEdge[], station: RoutingPoint, profile: RoutingProfile): string[] {
  return edges
    .filter(edge => distanceToPolylineMeters(station, edge.geometry) <= profile.sensorRadiusMeters)
    .map(edge => edge.id)
    .sort(compareIds);
}

// ---------------------------------------------------------------------------------------
// Conditions: closures, exclusions, sensor risk f(e) and traffic t(e) (plan 3.5).
// ---------------------------------------------------------------------------------------

export interface StationReading {
  stationId: string;
  /** Accepted water level in the threshold datum; null when missing, stale or rejected (unknown, never dry). */
  levelMeters: number | null;
  alertMeters: number;
  alarmMeters: number;
  criticalMeters: number;
  /** Observation time (ms since epoch), kept separate from publication time. */
  observedAt: number;
}

export interface CompiledRoutingConditions {
  graphVersion: string;
  /** Monotonic routing-area revision of the published snapshot. */
  revision: number;
  /** DRRM-verified closures: hard blocks in both directions. */
  closedEdgeIds: readonly string[];
  /** Accepted model exclusions (BFS stage 4). Empty until activation (plan 3.8). */
  modelExcludedEdgeIds: readonly string[];
  /** Accepted station readings (stage 2). Empty until station data is verified. */
  stationReadings: readonly StationReading[];
  /** t(e) from a verified feed; edges not listed use t = 0 (plan 3.5). */
  traffic: ReadonlyArray<{ edgeId: string; value: number }>;
}

export type StationLevel = 'alert' | 'alarm' | 'critical';

/**
 * RRL §2.5 risk term for one station: ((w − w_alert) / (w_critical − w_alert))², with the ratio
 * clamped to [0, 1] first (D4). Returns null when the reading is unknown or its thresholds
 * are not ordered alert ≤ alarm ≤ critical with alert < critical.
 */
export function stationRiskFactor(reading: StationReading): number | null {
  const { levelMeters: level, alertMeters: alert, alarmMeters: alarm, criticalMeters: critical } = reading;
  if (level === null || !Number.isFinite(level) || !Number.isFinite(alert) || !Number.isFinite(alarm) || !Number.isFinite(critical)) return null;
  if (!(alert <= alarm && alarm <= critical && alert < critical)) return null;
  const ratio = Math.min(1, Math.max(0, (level - alert) / (critical - alert)));
  return ratio * ratio;
}

/** Display class only (RRL §6.1); never an extra BFS seed. */
export function stationLevel(reading: StationReading): StationLevel | null {
  if (stationRiskFactor(reading) === null || reading.levelMeters === null) return null;
  if (reading.levelMeters >= reading.criticalMeters) return 'critical';
  if (reading.levelMeters >= reading.alarmMeters) return 'alarm';
  if (reading.levelMeters >= reading.alertMeters) return 'alert';
  return null;
}

/** RRL §2.5: w(e) = d(e)·(1 + α·f(e) + β·t(e)). */
export function rrlEdgeWeight(lengthMeters: number, risk: number, traffic: number, profile: RoutingProfile): number {
  return lengthMeters * (1 + profile.alpha * risk + profile.beta * traffic);
}

export type RouteWarning =
  | { code: 'station_level'; stationId: string; level: StationLevel; observedAt: number }
  | { code: 'station_unknown'; stationId: string }
  | { code: 'unknown_center_availability'; centerId: string };

/** Everything the search reads, captured once so later input changes cannot leak in (plan 3.5). */
interface FrozenConditions {
  /** 1 = hard-blocked in both directions (verified closure, local avoidance, model exclusion). */
  blocked: Uint8Array;
  risk: Float64Array;
  traffic: Float64Array;
  weight: Float64Array;
  length: Float64Array;
  seconds: Float64Array;
  warnings: RouteWarning[];
}

function conditionIssues(graph: PreparedRoutingGraph, conditions: CompiledRoutingConditions, profile: RoutingProfile): string[] {
  const issues: string[] = [];
  if (conditions.graphVersion !== graph.version) issues.push('graph_version_mismatch');
  if (!Number.isInteger(conditions.revision) || conditions.revision < 0) issues.push('invalid_revision');
  const seen = new Set<string>();
  for (const reading of conditions.stationReadings) {
    if (seen.has(reading.stationId)) issues.push(`duplicate_station_reading:${reading.stationId}`);
    seen.add(reading.stationId);
  }
  const trafficEdges = new Set<string>();
  for (const { edgeId, value } of conditions.traffic) {
    if (trafficEdges.has(edgeId)) issues.push(`duplicate_traffic:${edgeId}`);
    trafficEdges.add(edgeId);
    if (!Number.isFinite(value) || value < 0 || value > profile.trafficMax) issues.push(`invalid_traffic:${edgeId}`);
  }
  return issues;
}

function unmappedRestrictions(graph: PreparedRoutingGraph, conditions: CompiledRoutingConditions, avoidEdgeIds: readonly string[]): string[] {
  const ids = [...conditions.closedEdgeIds, ...conditions.modelExcludedEdgeIds, ...avoidEdgeIds, ...conditions.traffic.map(t => t.edgeId)];
  return [...new Set(ids.filter(id => !graph.edgeIndex.has(id)))].sort(compareIds);
}

function freezeConditions(
  graph: PreparedRoutingGraph,
  conditions: CompiledRoutingConditions,
  avoidEdgeIds: readonly string[],
  profile: RoutingProfile,
): FrozenConditions {
  const count = graph.edges.length;
  const blocked = new Uint8Array(count);
  // Precedence (plan 3.5): pedestrian rules (direction checks in the search) → verified
  // closures → local avoidance → accepted model exclusions all hard-block; risk only penalizes.
  for (const id of [...conditions.closedEdgeIds, ...avoidEdgeIds, ...conditions.modelExcludedEdgeIds]) {
    blocked[graph.edgeIndex.get(id) as number] = 1;
  }

  const traffic = new Float64Array(count);
  for (const { edgeId, value } of conditions.traffic) traffic[graph.edgeIndex.get(edgeId) as number] = value;

  const risk = new Float64Array(count);
  const warnings: RouteWarning[] = [];
  const readings = [...conditions.stationReadings].sort((a, b) => compareIds(a.stationId, b.stationId));
  for (const reading of readings) {
    const applicable = graph.stationEdges.get(reading.stationId);
    if (applicable === undefined || applicable.length === 0) continue;
    const factor = stationRiskFactor(reading);
    if (factor === null) {
      warnings.push({ code: 'station_unknown', stationId: reading.stationId });
      continue;
    }
    const level = stationLevel(reading);
    if (level !== null) warnings.push({ code: 'station_level', stationId: reading.stationId, level, observedAt: reading.observedAt });
    // D9: a critical station penalizes (f = 1) but does not remove edges; only BFS-flooded
    // edges (model exclusions) are infinite-weight.
    for (const e of applicable) risk[e] = Math.max(risk[e], factor);
  }

  const weight = new Float64Array(count);
  const length = new Float64Array(count);
  const seconds = new Float64Array(count);
  graph.edges.forEach((edge, e) => {
    length[e] = edge.lengthMeters;
    weight[e] = rrlEdgeWeight(edge.lengthMeters, risk[e], traffic[e], profile);
    seconds[e] = edge.lengthMeters / (edge.stairs ? profile.stairsSpeedMps : profile.walkingSpeedMps);
  });
  return { blocked, risk, traffic, weight, length, seconds, warnings };
}

function canTraverse(edge: RoutingEdge, forward: boolean): boolean {
  return edge.pedestrianAccess === 'both' || edge.pedestrianAccess === (forward ? 'forward' : 'backward');
}

// ---------------------------------------------------------------------------------------
// Origin attachment (plan section 2): temporary split of an eligible segment within 50 m.
// ---------------------------------------------------------------------------------------

export interface AttachmentCandidate {
  edgeId: string;
  name: string | null;
  /** Where the origin meets the segment. */
  point: RoutingPoint;
  /** Unverified connector from the GPS marker; never drawn as part of the route. */
  distanceMeters: number;
}

interface Attachment extends AttachmentCandidate {
  edge: number;
  segment: number;
  share: number;
  xy: XY;
  /** Graph node when the attachment point is within SAME_POINT_METERS of an edge end, else -1. */
  endNode: number;
  /** Hard-blocked segments count as nearby roads but are never attached to. */
  blocked: boolean;
}

const MAX_ATTACHMENT_CANDIDATES = 5;

function attachmentCandidates(graph: PreparedRoutingGraph, frozen: FrozenConditions, origin: RoutingPoint, profile: RoutingProfile): Attachment[] {
  const refLat = origin.lat;
  const o = toXY(origin.lng, origin.lat, refLat);
  const barriers = graph.barriers.map(b => b.geometry.map(([lng, lat]) => toXY(lng, lat, refLat)));
  const candidates: Attachment[] = [];
  graph.edges.forEach((edge, e) => {
    if (edge.pedestrianAccess === 'none') return;
    const line = edge.geometry.map(([lng, lat]) => toXY(lng, lat, refLat));
    const projection = projectOntoPolyline(o, line);
    if (projection.distance > profile.attachRadiusMeters) return;
    // Never snap through water or a barrier.
    const crosses = barriers.some(barrier => {
      for (let i = 0; i + 1 < barrier.length; i++) {
        if (segmentsIntersect(o, projection.point, barrier[i], barrier[i + 1])) return true;
      }
      return false;
    });
    if (crosses) return;
    const lengthBefore = projection.share * edge.lengthMeters;
    const endNode =
      lengthBefore <= SAME_POINT_METERS ? graph.edgeFrom[e] : edge.lengthMeters - lengthBefore <= SAME_POINT_METERS ? graph.edgeTo[e] : -1;
    candidates.push({
      edgeId: edge.id,
      name: edge.name,
      point: fromXY(projection.point, refLat),
      distanceMeters: projection.distance,
      edge: e,
      segment: projection.segment,
      share: projection.share,
      xy: projection.point,
      endNode,
      blocked: frozen.blocked[e] === 1,
    });
  });
  return candidates.sort((a, b) => a.distanceMeters - b.distanceMeters || compareIds(a.edgeId, b.edgeId));
}

/**
 * True when another street lies within the fix's accuracy radius: GPS accuracy is comparable
 * to street spacing here, so the resident chooses instead of the app guessing (plan section 2).
 * A segment of the same named street, one meeting the nearest candidate at the same point (an
 * intersection), or one whose nearest point is an end of the nearest segment, is not a second
 * street.
 */
function isAmbiguous(graph: PreparedRoutingGraph, candidates: readonly Attachment[], accuracyMeters: number | null, profile: RoutingProfile): boolean {
  const nearest = candidates[0];
  if (nearest === undefined) return false;
  const radius = Math.max(nearest.distanceMeters, Math.min(profile.attachRadiusMeters, accuracyMeters ?? profile.attachRadiusMeters));
  return candidates.some(
    c =>
      c.distanceMeters <= radius &&
      !(c.name !== null && c.name === nearest.name) &&
      distanceXY(c.xy, nearest.xy) > SAME_POINT_METERS &&
      !(c.endNode !== -1 && (c.endNode === graph.edgeFrom[nearest.edge] || c.endNode === graph.edgeTo[nearest.edge])),
  );
}

/** Nearest candidate per street, for the chooser. */
function chooserCandidates(candidates: readonly Attachment[]): AttachmentCandidate[] {
  const seen = new Set<string>();
  const result: AttachmentCandidate[] = [];
  for (const c of candidates) {
    const key = c.name === null ? `edge:${c.edgeId}` : `name:${c.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ edgeId: c.edgeId, name: c.name, point: c.point, distanceMeters: c.distanceMeters });
    if (result.length === MAX_ATTACHMENT_CANDIDATES) break;
  }
  return result;
}

/** A search source: a graph node reached from the attachment point along part of one edge. */
interface Seed {
  node: number;
  /** Attached edge, or -1 when the origin meets the graph exactly at `node`. */
  edge: number;
  /** Share of the attached edge between the attachment point and `node`. */
  share: number;
  /** [lng, lat] points from the attachment point to `node`. */
  geometry: LngLat[];
}

function seedsFor(graph: PreparedRoutingGraph, attachment: Attachment): Seed[] {
  const edge = graph.edges[attachment.edge];
  const from = graph.edgeFrom[attachment.edge];
  const to = graph.edgeTo[attachment.edge];
  const start: LngLat = [attachment.point.lng, attachment.point.lat];
  if (attachment.endNode !== -1) {
    const node = graph.nodes[attachment.endNode];
    return [{ node: attachment.endNode, edge: -1, share: 0, geometry: [[node.lng, node.lat]] }];
  }
  const seeds: Seed[] = [];
  if (canTraverse(edge, true)) {
    seeds.push({ node: to, edge: attachment.edge, share: 1 - attachment.share, geometry: [start, ...edge.geometry.slice(attachment.segment + 1)] });
  }
  if (canTraverse(edge, false)) {
    seeds.push({ node: from, edge: attachment.edge, share: attachment.share, geometry: [start, ...edge.geometry.slice(0, attachment.segment + 1).reverse()] });
  }
  return seeds;
}

// ---------------------------------------------------------------------------------------
// Dijkstra (RRL Algorithm 2 with the heap fix, D1) as a resumable generator: it yields every
// SEARCH_YIELD_EVERY extractions so callers can cooperate with the JS thread and cancel.
// ---------------------------------------------------------------------------------------

const SEARCH_YIELD_EVERY = 256;

/** Binary min-heap on (cost, node); equal costs pop the lower canonical node index first. */
class MinHeap {
  private costs: number[] = [];
  private nodes: number[] = [];

  get size(): number {
    return this.costs.length;
  }

  private less(i: number, j: number): boolean {
    const ci = this.costs[i];
    const cj = this.costs[j];
    return ci < cj || (ci === cj && this.nodes[i] < this.nodes[j]);
  }

  private swap(i: number, j: number): void {
    const c = this.costs[i];
    this.costs[i] = this.costs[j];
    this.costs[j] = c;
    const n = this.nodes[i];
    this.nodes[i] = this.nodes[j];
    this.nodes[j] = n;
  }

  push(cost: number, node: number): void {
    this.costs.push(cost);
    this.nodes.push(node);
    let i = this.costs.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  /** Caller checks `size` first. */
  pop(): { cost: number; node: number } {
    const top = { cost: this.costs[0], node: this.nodes[0] };
    const lastCost = this.costs.pop() as number;
    const lastNode = this.nodes.pop() as number;
    if (this.costs.length > 0) {
      this.costs[0] = lastCost;
      this.nodes[0] = lastNode;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.costs.length && this.less(left, smallest)) smallest = left;
        if (right < this.costs.length && this.less(right, smallest)) smallest = right;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }
}

interface SearchTree {
  cost: Float64Array;
  /** Edge used to reach each node; -1 for seeds and unreached nodes. */
  prevEdge: Int32Array;
  /** Seed that starts the path to each node (valid where `cost` is finite). */
  seedOf: Int32Array;
  extracted: Uint8Array;
}

function* search(
  graph: PreparedRoutingGraph,
  frozen: FrozenConditions,
  seeds: readonly Seed[],
  objective: Float64Array,
  targets: ReadonlySet<number>,
  stopAtFirstTarget: boolean,
): Generator<void, { tree: SearchTree; firstTarget: number }, void> {
  const n = graph.nodes.length;
  const tree: SearchTree = {
    cost: new Float64Array(n).fill(Infinity),
    prevEdge: new Int32Array(n).fill(-1),
    seedOf: new Int32Array(n).fill(-1),
    extracted: new Uint8Array(n),
  };
  const heap = new MinHeap();
  seeds.forEach((seed, i) => {
    const cost = seed.edge === -1 ? 0 : seed.share * objective[seed.edge];
    if (cost < tree.cost[seed.node]) {
      tree.cost[seed.node] = cost;
      tree.seedOf[seed.node] = i;
      heap.push(cost, seed.node);
    }
  });

  let remaining = targets.size;
  let pops = 0;
  while (heap.size > 0) {
    if (++pops % SEARCH_YIELD_EVERY === 0) yield;
    const { cost, node: u } = heap.pop();
    if (tree.extracted[u] === 1 || cost > tree.cost[u]) continue; // stale entry
    tree.extracted[u] = 1;
    if (targets.has(u)) {
      // First extracted shelter = minimum cost (RRL Algorithm 2).
      if (stopAtFirstTarget) return { tree, firstTarget: u };
      if (--remaining === 0) break;
    }
    for (const e of graph.adjacency[u]) {
      if (frozen.blocked[e] === 1) continue;
      const forward = graph.edgeFrom[e] === u;
      if (!canTraverse(graph.edges[e], forward)) continue;
      const v = forward ? graph.edgeTo[e] : graph.edgeFrom[e];
      const c = cost + objective[e];
      if (c < tree.cost[v]) {
        tree.cost[v] = c;
        tree.prevEdge[v] = e;
        tree.seedOf[v] = tree.seedOf[u];
        heap.push(c, v); // D1: the RRL pseudocode omits this push.
      }
    }
  }
  return { tree, firstTarget: -1 };
}

// ---------------------------------------------------------------------------------------
// Route assembly: reconstruction, metrics and written itinerary.
// ---------------------------------------------------------------------------------------

export type ItineraryKind = 'path' | 'bridge' | 'stairs';

export interface ItineraryStep {
  /** Street name; null for an unnamed path. */
  name: string | null;
  kind: ItineraryKind;
  distanceMeters: number;
  durationSeconds: number;
  edgeIds: string[];
}

export interface RoutePath {
  centerId: string;
  /** Traversed edges in order; the first may be traversed partially from the attachment point. */
  edgeIds: string[];
  /** [lng, lat] from the attachment point to the center entrance. */
  geometry: LngLat[];
  distanceMeters: number;
  /** distance / walking speed (stairs slower); shown separately from the optimization cost. */
  durationSeconds: number;
  /** RRL weighted cost Σ w(e). */
  cost: number;
  itinerary: ItineraryStep[];
}

function itineraryKind(edge: RoutingEdge): ItineraryKind {
  return edge.bridge ? 'bridge' : edge.stairs ? 'stairs' : 'path';
}

function buildPath(graph: PreparedRoutingGraph, frozen: FrozenConditions, seeds: readonly Seed[], tree: SearchTree, target: number, centerId: string): RoutePath {
  const steps: { edge: number; forward: boolean }[] = [];
  let node = target;
  while (tree.prevEdge[node] !== -1) {
    const edge = tree.prevEdge[node];
    const forward = graph.edgeTo[edge] === node;
    steps.push({ edge, forward });
    node = forward ? graph.edgeFrom[edge] : graph.edgeTo[edge];
  }
  steps.reverse();
  const seed = seeds[tree.seedOf[node]];

  const parts: { edge: number; share: number }[] = [];
  if (seed.edge !== -1) parts.push({ edge: seed.edge, share: seed.share });
  for (const step of steps) parts.push({ edge: step.edge, share: 1 });

  const geometry: LngLat[] = [...seed.geometry];
  for (const step of steps) {
    const points = graph.edges[step.edge].geometry;
    const oriented = step.forward ? points : [...points].reverse();
    geometry.push(...oriented.slice(1));
  }

  const itinerary: ItineraryStep[] = [];
  let distanceMeters = 0;
  let durationSeconds = 0;
  let cost = 0;
  for (const part of parts) {
    const edge = graph.edges[part.edge];
    const distance = part.share * frozen.length[part.edge];
    const duration = part.share * frozen.seconds[part.edge];
    distanceMeters += distance;
    durationSeconds += duration;
    cost += part.share * frozen.weight[part.edge];
    const kind = itineraryKind(edge);
    const last = itinerary[itinerary.length - 1];
    if (last !== undefined && last.name === edge.name && last.kind === kind) {
      last.distanceMeters += distance;
      last.durationSeconds += duration;
      last.edgeIds.push(edge.id);
    } else {
      itinerary.push({ name: edge.name, kind, distanceMeters: distance, durationSeconds: duration, edgeIds: [edge.id] });
    }
  }

  return { centerId, edgeIds: parts.map(p => graph.edges[p.edge].id), geometry, distanceMeters, durationSeconds, cost, itinerary };
}

// ---------------------------------------------------------------------------------------
// Evacuation planning: request, result and drivers.
// ---------------------------------------------------------------------------------------

export type CenterAvailability = 'available' | 'unknown' | 'unavailable';

export interface RoutingCenter {
  id: string;
  name: string;
  /** Reviewed entrance node in this graph; null (or a node not in the graph) = unroutable. */
  entranceNodeId: string | null;
  /** Separate from `active`; occupancy alone never promises capacity. */
  availability: CenterAvailability;
  /** False for deactivated or deleted (tombstoned) centers. */
  active: boolean;
}

export interface RouteRequest {
  origin: { lat: number; lng: number; accuracyMeters: number | null; revision: number };
  /** Segment the resident picked from the attachment chooser; null to attach automatically. */
  originEdgeId: string | null;
  /** null = automatic: the nearest confirmed-available center by route cost. */
  centerId: string | null;
  /** Local avoidance marks: blocked in both directions, never a verified closure. */
  avoidEdgeIds: readonly string[];
}

export interface RouteProvenance {
  graphVersion: string;
  conditionsRevision: number;
  profileId: RoutingProfileId;
  configVersion: string;
  originRevision: number;
}

export type CenterExclusion = 'inactive' | 'unavailable' | 'no_entrance';

export interface CenterRouteSummary {
  centerId: string;
  availability: CenterAvailability;
  excluded: CenterExclusion | null;
  /** null when excluded or no safe path reaches it. */
  distanceMeters: number | null;
  durationSeconds: number | null;
  cost: number | null;
}

/** Why the recommended route is longer than the shortest safe one. */
export type RouteAvoidance = 'sensor_risk' | 'traffic';

export type RouteResult =
  | {
      status: 'ok';
      provenance: RouteProvenance;
      attachment: AttachmentCandidate;
      /** Destination tier: confirmed-available centers first, unknown-availability only as a fallback. */
      centerTier: 'available' | 'unknown';
      /** Minimum RRL weight. */
      best: RoutePath;
      /** Minimum distance over the same safe edges; null when it is the best route or no shorter. */
      shortest: RoutePath | null;
      shortestAvoids: RouteAvoidance[];
      /** One-to-many walking distances, reachable centers first by route cost. */
      centers: CenterRouteSummary[];
      warnings: RouteWarning[];
    }
  | {
      status: 'no_route_within_coverage';
      provenance: RouteProvenance;
      /** null when every nearby segment is blocked. */
      attachment: AttachmentCandidate | null;
      centers: CenterRouteSummary[];
      warnings: RouteWarning[];
    }
  | { status: 'attachment_ambiguous'; provenance: RouteProvenance; candidates: AttachmentCandidate[]; warnings: RouteWarning[] }
  | { status: 'invalid_conditions'; provenance: RouteProvenance; issues: string[]; warnings: RouteWarning[] }
  | { status: 'restrictions_unmapped'; provenance: RouteProvenance; unmappedEdgeIds: string[]; warnings: RouteWarning[] }
  | {
      status: 'invalid_origin' | 'outside_coverage' | 'no_nearby_path' | 'center_unavailable' | 'cancelled';
      provenance: RouteProvenance;
      warnings: RouteWarning[];
    };

export interface PlanRouteInput {
  graph: PreparedRoutingGraph;
  conditions: CompiledRoutingConditions;
  centers: readonly RoutingCenter[];
  request: RouteRequest;
  profile: RoutingProfile;
}

/** Structurally satisfied by `AbortSignal`. */
export interface CancellationToken {
  readonly aborted: boolean;
}

function provenanceOf(input: PlanRouteInput): RouteProvenance {
  return {
    graphVersion: input.graph.version,
    conditionsRevision: input.conditions.revision,
    profileId: input.profile.id,
    configVersion: ROUTING_CONFIG_VERSION,
    originRevision: input.request.origin.revision,
  };
}

function centerExclusion(graph: PreparedRoutingGraph, center: RoutingCenter): CenterExclusion | null {
  if (!center.active) return 'inactive';
  if (center.availability === 'unavailable') return 'unavailable';
  if (center.entranceNodeId === null || !graph.nodeIndex.has(center.entranceNodeId)) return 'no_entrance';
  return null;
}

/** Node → center id; centers sharing an entrance resolve to the lowest id. */
function targetMap(graph: PreparedRoutingGraph, centers: readonly RoutingCenter[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const center of centers) {
    const node = graph.nodeIndex.get(center.entranceNodeId as string) as number;
    if (!map.has(node)) map.set(node, center.id);
  }
  return map;
}

function unreachedSummary(center: RoutingCenter, excluded: CenterExclusion | null): CenterRouteSummary {
  return { centerId: center.id, availability: center.availability, excluded, distanceMeters: null, durationSeconds: null, cost: null };
}

function samePath(a: RoutePath, b: RoutePath): boolean {
  return a.edgeIds.length === b.edgeIds.length && a.edgeIds.every((id, i) => id === b.edgeIds[i]);
}

function* planSteps(input: PlanRouteInput): Generator<void, RouteResult, void> {
  const { graph, conditions, request, profile } = input;
  const provenance = provenanceOf(input);
  const { lat, lng, accuracyMeters } = request.origin;
  if (!isValidLngLat(lng, lat) || !(accuracyMeters === null || (Number.isFinite(accuracyMeters) && accuracyMeters >= 0))) {
    return { status: 'invalid_origin', provenance, warnings: [] };
  }

  const issues = conditionIssues(graph, conditions, profile);
  const centerIds = new Set<string>();
  for (const center of input.centers) {
    if (centerIds.has(center.id)) issues.push(`duplicate_center:${center.id}`);
    centerIds.add(center.id);
  }
  if (issues.length > 0) return { status: 'invalid_conditions', provenance, issues, warnings: [] };

  // A restriction the graph cannot represent must never be silently dropped (invariant 6).
  const unmapped = unmappedRestrictions(graph, conditions, request.avoidEdgeIds);
  if (unmapped.length > 0) return { status: 'restrictions_unmapped', provenance, unmappedEdgeIds: unmapped, warnings: [] };

  const frozen = freezeConditions(graph, conditions, request.avoidEdgeIds, profile);
  const warnings = [...frozen.warnings];

  const centers = [...input.centers].sort((a, b) => compareIds(a.id, b.id));
  const routable = centers.filter(c => centerExclusion(graph, c) === null);
  let selected: RoutingCenter | null = null;
  if (request.centerId !== null) {
    selected = routable.find(c => c.id === request.centerId) ?? null;
    if (selected === null) return { status: 'center_unavailable', provenance, warnings };
  } else if (routable.length === 0) {
    return { status: 'center_unavailable', provenance, warnings };
  }

  if (!insideRings(lng, lat, graph.coverage)) return { status: 'outside_coverage', provenance, warnings };

  const nearby = attachmentCandidates(graph, frozen, { lat, lng }, profile);
  if (nearby.length === 0) return { status: 'no_nearby_path', provenance, warnings };
  const candidates = nearby.filter(c => !c.blocked);
  if (candidates.length === 0) {
    const centersSummary = centers.map(center => unreachedSummary(center, centerExclusion(graph, center)));
    return { status: 'no_route_within_coverage', provenance, attachment: null, centers: centersSummary, warnings };
  }
  let attachment: Attachment | undefined;
  if (request.originEdgeId !== null) {
    attachment = candidates.find(c => c.edgeId === request.originEdgeId);
  } else if (!isAmbiguous(graph, candidates, accuracyMeters, profile)) {
    attachment = candidates[0];
  }
  if (attachment === undefined) {
    return { status: 'attachment_ambiguous', provenance, candidates: chooserCandidates(candidates), warnings };
  }
  const publicAttachment: AttachmentCandidate = {
    edgeId: attachment.edgeId,
    name: attachment.name,
    point: attachment.point,
    distanceMeters: attachment.distanceMeters,
  };
  const seeds = seedsFor(graph, attachment);

  // One-to-many run for the Centers list (no early exit).
  const allTargets = targetMap(graph, routable);
  const ranking = yield* search(graph, frozen, seeds, frozen.weight, new Set(allTargets.keys()), false);
  const summaries: CenterRouteSummary[] = centers.map(center => {
    const excluded = centerExclusion(graph, center);
    const node = excluded === null ? (graph.nodeIndex.get(center.entranceNodeId as string) as number) : -1;
    if (node === -1 || !Number.isFinite(ranking.tree.cost[node])) return unreachedSummary(center, excluded);
    const path = buildPath(graph, frozen, seeds, ranking.tree, node, center.id);
    return { centerId: center.id, availability: center.availability, excluded, distanceMeters: path.distanceMeters, durationSeconds: path.durationSeconds, cost: path.cost };
  });
  summaries.sort((a, b) => {
    if (a.cost === null || b.cost === null) return a.cost === b.cost ? compareIds(a.centerId, b.centerId) : a.cost === null ? 1 : -1;
    return a.cost - b.cost || compareIds(a.centerId, b.centerId);
  });

  // Best route: confirmed-available centers first; unknown availability only if none is reachable.
  const tiers: { tier: 'available' | 'unknown'; centers: RoutingCenter[] }[] =
    selected !== null
      ? [{ tier: selected.availability === 'available' ? 'available' : 'unknown', centers: [selected] }]
      : [
          { tier: 'available', centers: routable.filter(c => c.availability === 'available') },
          { tier: 'unknown', centers: routable.filter(c => c.availability === 'unknown') },
        ];
  for (const { tier, centers: tierCenters } of tiers) {
    if (tierCenters.length === 0) continue;
    const targets = targetMap(graph, tierCenters);
    const targetNodes = new Set(targets.keys());
    const bestRun = yield* search(graph, frozen, seeds, frozen.weight, targetNodes, true);
    if (bestRun.firstTarget === -1) continue;
    const best = buildPath(graph, frozen, seeds, bestRun.tree, bestRun.firstTarget, targets.get(bestRun.firstTarget) as string);
    const shortRun = yield* search(graph, frozen, seeds, frozen.length, targetNodes, true);
    const shortestPath = buildPath(graph, frozen, seeds, shortRun.tree, shortRun.firstTarget, targets.get(shortRun.firstTarget) as string);
    const shortest = samePath(best, shortestPath) || shortestPath.distanceMeters >= best.distanceMeters ? null : shortestPath;
    const bestEdges = new Set(best.edgeIds);
    const shortestAvoids: RouteAvoidance[] = [];
    if (shortest !== null) {
      const extra = shortest.edgeIds.filter(id => !bestEdges.has(id)).map(id => graph.edgeIndex.get(id) as number);
      if (extra.some(e => frozen.risk[e] > 0)) shortestAvoids.push('sensor_risk');
      if (extra.some(e => frozen.traffic[e] > 0)) shortestAvoids.push('traffic');
    }
    if (tier === 'unknown') warnings.push({ code: 'unknown_center_availability', centerId: best.centerId });
    return { status: 'ok', provenance, attachment: publicAttachment, centerTier: tier, best, shortest, shortestAvoids, centers: summaries, warnings };
  }
  // Never a straight-line fallback (invariant 7).
  return { status: 'no_route_within_coverage', provenance, attachment: publicAttachment, centers: summaries, warnings };
}

/** Plans a route synchronously; `cancel` is checked between search chunks. */
export function planEvacuationRoute(input: PlanRouteInput, cancel?: CancellationToken): RouteResult {
  const steps = planSteps(input);
  for (;;) {
    if (cancel?.aborted) return { status: 'cancelled', provenance: provenanceOf(input), warnings: [] };
    const step = steps.next();
    if (step.done) return step.value;
  }
}

/**
 * Plans a route, awaiting `yieldControl` between search chunks so the JS thread stays
 * responsive (Hermes, plan section 4) and `cancel` takes effect promptly.
 */
export async function planEvacuationRouteAsync(
  input: PlanRouteInput,
  options: { cancel?: CancellationToken; yieldControl: () => Promise<void> },
): Promise<RouteResult> {
  const steps = planSteps(input);
  for (;;) {
    if (options.cancel?.aborted) return { status: 'cancelled', provenance: provenanceOf(input), warnings: [] };
    const step = steps.next();
    if (step.done) return step.value;
    await options.yieldControl();
  }
}

// ---------------------------------------------------------------------------------------
// BFS flood propagation (RRL Algorithm 1, plan 3.3). Server-side only; output is extent only.
// ---------------------------------------------------------------------------------------

export interface FloodGrid {
  cellSizeMeters: number;
  cols: number;
  rows: number;
  /** South-west corner of cell 0; row 0 is the southernmost row, cells are row-major. */
  originLat: number;
  originLng: number;
  /** DEM elevation per cell in the gauge datum; null where terrain is missing (unknown, not dry). */
  elevations: ReadonlyArray<number | null>;
}

export interface FloodStation {
  stationId: string;
  lat: number;
  lng: number;
  /** Datum-verified water-surface elevation; null when unknown. */
  levelMeters: number | null;
  criticalMeters: number;
}

export type FloodStationIgnoredReason = 'invalid_position' | 'outside_grid' | 'reading_unknown' | 'below_critical';

export interface FloodBfsResult {
  /** Reached cells, ascending. Extent only: queue depth is never a time estimate. */
  floodedCells: number[];
  /** Cells next to the flood front whose terrain is missing, ascending. */
  unknownCells: number[];
  /** Seeds in processing order (descending surface, then station id). */
  seeds: { stationId: string; cell: number; surfaceMeters: number }[];
  ignored: { stationId: string; reason: FloodStationIgnoredReason }[];
}

function floodGridIssues(grid: FloodGrid, stations: readonly FloodStation[], profile: RoutingProfile): string[] {
  const issues: string[] = [];
  if (grid.cellSizeMeters !== profile.cellSizeMeters) issues.push('cell_size_mismatch');
  if (!Number.isInteger(grid.cols) || !Number.isInteger(grid.rows) || grid.cols <= 0 || grid.rows <= 0) issues.push('invalid_dimensions');
  else if (grid.elevations.length !== grid.cols * grid.rows) issues.push('elevation_count_mismatch');
  if (!isValidLngLat(grid.originLng, grid.originLat)) issues.push('invalid_origin');
  if (grid.elevations.some(e => e !== null && !Number.isFinite(e))) issues.push('invalid_elevation');
  const ids = new Set<string>();
  for (const station of stations) {
    if (ids.has(station.stationId)) issues.push(`duplicate_station:${station.stationId}`);
    ids.add(station.stationId);
  }
  return issues;
}

/** Cell containing a point, or -1 outside the grid. */
export function floodGridCellAt(grid: FloodGrid, point: RoutingPoint): number {
  const origin = toXY(grid.originLng, grid.originLat, grid.originLat);
  const p = toXY(point.lng, point.lat, grid.originLat);
  const col = Math.floor((p.x - origin.x) / grid.cellSizeMeters);
  const row = Math.floor((p.y - origin.y) / grid.cellSizeMeters);
  return col < 0 || row < 0 || col >= grid.cols || row >= grid.rows ? -1 : row * grid.cols + col;
}

/**
 * Every grid cell a polyline touches (grid-line DDA over each segment), ascending and
 * unique, in the same frame as `floodGridCellAt`. A line passing exactly through a cell
 * corner counts all four cells, and `outside` is true when any part leaves the grid. Used to
 * decide whether an edge's full geometry crosses a flooded cell (plan 3.4).
 */
export function floodGridCellsOnPolyline(grid: FloodGrid, geometry: readonly LngLat[]): { cells: number[]; outside: boolean } {
  const origin = toXY(grid.originLng, grid.originLat, grid.originLat);
  const points = geometry.map(([lng, lat]) => {
    const p = toXY(lng, lat, grid.originLat);
    return { x: (p.x - origin.x) / grid.cellSizeMeters, y: (p.y - origin.y) / grid.cellSizeMeters };
  });
  const cells = new Set<number>();
  let outside = false;
  const visit = (col: number, row: number): void => {
    if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) outside = true;
    else cells.add(row * grid.cols + col);
  };

  if (points.length === 1) visit(Math.floor(points[0].x), Math.floor(points[0].y));
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    let col = Math.floor(a.x);
    let row = Math.floor(a.y);
    const endCol = Math.floor(b.x);
    const endRow = Math.floor(b.y);
    visit(col, row);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const stepCol = dx > 0 ? 1 : -1;
    const stepRow = dy > 0 ? 1 : -1;
    const deltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
    const deltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
    let nextX = dx === 0 ? Infinity : (dx > 0 ? col + 1 - a.x : a.x - col) * deltaX;
    let nextY = dy === 0 ? Infinity : (dy > 0 ? row + 1 - a.y : a.y - row) * deltaY;
    const maxSteps = Math.abs(endCol - col) + Math.abs(endRow - row) + 2;
    for (let step = 0; step < maxSteps && (col !== endCol || row !== endRow); step++) {
      if (nextX < nextY) {
        col += stepCol;
        nextX += deltaX;
      } else if (nextY < nextX) {
        row += stepRow;
        nextY += deltaY;
      } else {
        visit(col + stepCol, row);
        visit(col, row + stepRow);
        col += stepCol;
        row += stepRow;
        nextX += deltaX;
        nextY += deltaY;
      }
      visit(col, row);
    }
  }
  return { cells: [...cells].sort((x, y) => x - y), outside };
}

/**
 * Multi-source FIFO BFS over 4-connected cells. Seeds are cells holding stations at or above
 * Critical. Seeds run in descending surface order with one shared `visited` set (D2), so the
 * result is the union of per-seed fills regardless of input order. `can_flood(n, s)` is
 * `elevation(n) ≤ s` (D3, pending DRRM confirmation). Seed cells are marked flooded: the
 * gauge itself reports water there.
 */
export function runFloodBfs(
  grid: FloodGrid,
  stations: readonly FloodStation[],
  profile: RoutingProfile,
): { ok: true; result: FloodBfsResult } | { ok: false; issues: string[] } {
  const issues = floodGridIssues(grid, stations, profile);
  if (issues.length > 0) return { ok: false, issues };

  const seeds: FloodBfsResult['seeds'] = [];
  const ignored: FloodBfsResult['ignored'] = [];
  for (const station of [...stations].sort((a, b) => compareIds(a.stationId, b.stationId))) {
    if (!isValidLngLat(station.lng, station.lat)) {
      ignored.push({ stationId: station.stationId, reason: 'invalid_position' });
      continue;
    }
    const cell = floodGridCellAt(grid, station);
    if (cell === -1) ignored.push({ stationId: station.stationId, reason: 'outside_grid' });
    else if (station.levelMeters === null || !Number.isFinite(station.levelMeters) || !Number.isFinite(station.criticalMeters)) {
      ignored.push({ stationId: station.stationId, reason: 'reading_unknown' });
    } else if (station.levelMeters < station.criticalMeters) ignored.push({ stationId: station.stationId, reason: 'below_critical' });
    else seeds.push({ stationId: station.stationId, cell, surfaceMeters: station.levelMeters });
  }
  seeds.sort((a, b) => b.surfaceMeters - a.surfaceMeters || compareIds(a.stationId, b.stationId));

  const count = grid.cols * grid.rows;
  const visited = new Uint8Array(count);
  const unknown = new Uint8Array(count);
  const queue = new Int32Array(count);
  for (const seed of seeds) {
    if (visited[seed.cell] === 1) continue;
    visited[seed.cell] = 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = seed.cell;
    while (head < tail) {
      const current = queue[head++];
      const row = Math.floor(current / grid.cols);
      const col = current - row * grid.cols;
      const neighbors = [
        row + 1 < grid.rows ? current + grid.cols : -1,
        row > 0 ? current - grid.cols : -1,
        col + 1 < grid.cols ? current + 1 : -1,
        col > 0 ? current - 1 : -1,
      ];
      for (const n of neighbors) {
        if (n === -1 || visited[n] === 1) continue;
        const elevation = grid.elevations[n];
        if (elevation === null || elevation === undefined) {
          unknown[n] = 1;
          continue;
        }
        if (elevation <= seed.surfaceMeters) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
    }
  }

  const floodedCells: number[] = [];
  const unknownCells: number[] = [];
  for (let i = 0; i < count; i++) {
    if (visited[i] === 1) floodedCells.push(i);
    else if (unknown[i] === 1) unknownCells.push(i);
  }
  return { ok: true, result: { floodedCells, unknownCells, seeds, ignored } };
}

// ---------------------------------------------------------------------------------------
// Stable segment mappings across graph versions (restrictions must survive updates, plan 4).
// Used by the pack builder (R3) and by Android pack activation (R6).
// ---------------------------------------------------------------------------------------

export interface EdgeMapping {
  edgeId: string;
  /** same: identical id and geometry; remapped: successors cover the old segment; unresolved: needs review. */
  status: 'same' | 'remapped' | 'unresolved';
  successorIds: string[];
}

function wayOf(edge: RoutingEdge): string {
  return edge.sourceRef.split('/')[1] ?? '';
}

/** Same-place tolerance when mapping edges across graph versions. */
const REMAP_TOLERANCE_METERS = 1;

function within(points: readonly LngLat[], line: readonly LngLat[], tolerance: number): boolean {
  return points.every(([lng, lat]) => distanceToPolylineMeters({ lat, lng }, line) <= tolerance);
}

/**
 * Maps every edge of `previous` onto `next`. Successors are edges of the same OSM way that lie
 * on the old segment (it was split) or contain it (a junction was removed). A segment whose
 * successors do not cover it is unresolved, so a restriction on it keeps the previous graph
 * active instead of being dropped (plan section 4).
 */
export function mapEdgesAcrossGraphs(previous: RoutingGraph, next: RoutingGraph): EdgeMapping[] {
  const nextById = new Map(next.edges.map(edge => [edge.id, edge]));
  const nextByWay = new Map<string, RoutingEdge[]>();
  for (const edge of next.edges) {
    const list = nextByWay.get(wayOf(edge)) ?? [];
    list.push(edge);
    nextByWay.set(wayOf(edge), list);
  }
  return [...previous.edges]
    .sort((a, b) => compareIds(a.id, b.id))
    .map(old => {
      const same = nextById.get(old.id);
      if (same !== undefined && within(old.geometry, same.geometry, REMAP_TOLERANCE_METERS) && within(same.geometry, old.geometry, REMAP_TOLERANCE_METERS)) {
        return { edgeId: old.id, status: 'same', successorIds: [old.id] };
      }
      const candidates = nextByWay.get(wayOf(old)) ?? [];
      const contained = candidates.filter(edge => within(edge.geometry, old.geometry, REMAP_TOLERANCE_METERS));
      const containing = candidates.filter(edge => !contained.includes(edge) && within(old.geometry, edge.geometry, REMAP_TOLERANCE_METERS));
      const successorIds = [...contained, ...containing].map(edge => edge.id).sort(compareIds);
      const coveredMeters = contained.reduce((sum, edge) => sum + edge.lengthMeters, 0);
      const covered = containing.length > 0 || coveredMeters >= old.lengthMeters - REMAP_TOLERANCE_METERS;
      return { edgeId: old.id, status: covered && successorIds.length > 0 ? 'remapped' : 'unresolved', successorIds };
    });
}
