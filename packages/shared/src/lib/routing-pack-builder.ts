/**
 * Routing pack builder (DRRM weather-routing plan, phase R3). Offline and Node-only: devices
 * and Edge Functions never import this file, only the packs it writes.
 *
 * Turns an Overpass JSON extract of OpenStreetMap into the pedestrian routing pack for one
 * covered area (boundary plus a connectivity margin): the `RoutingGraph` the routing core
 * validates, a simplified vector map for offline display, server-side flood grids for both
 * profiles from one builder, station-to-edge tables, a manifest with resource hashes, and the
 * review report DRRM signs off (connectivity, entrances, bridges, barriers, access
 * assumptions). The same inputs always produce byte-identical files, whatever the element
 * order of the extract.
 */
import { createHash } from 'node:crypto';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import {
  ROUTING_CONFIG_VERSION,
  ROUTING_PROFILES,
  distanceToPolylineMeters,
  isInsideCoverage,
  prepareRoutingGraph,
  stationApplicableEdgeIds,
  type FloodGrid,
  type LngLat,
  type PedestrianAccess,
  type RoutingBarrier,
  type RoutingEdge,
  type RoutingGraph,
  type RoutingNode,
  type RoutingPackManifest,
  type RoutingPackResource,
  type RoutingPoint,
  type RoutingProfile,
  type RoutingProfileId,
  type StationEdgeApplicability,
} from './evacuation-routing.ts';

/** Connectivity margin around the boundary (plan section 2); not a second barangay. */
export const COVERAGE_MARGIN_METERS = 150;
/** Raster step and simplification tolerance of the coverage buffer; together they bound its error. */
const COVERAGE_STEP_METERS = 5;
const COVERAGE_SIMPLIFY_METERS = 2;
/** Worst-case distance between the stored coverage edge and the exact 150 m buffer. */
export const COVERAGE_TOLERANCE_METERS = 6;
/** Display geometry only; routing geometry is never simplified. */
const MAP_SIMPLIFY_METERS = 1;
/** Pieces shorter than this join their end nodes instead of becoming edges. */
const ZERO_LENGTH_METERS = 0.01;

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors (ODbL 1.0)';

/** Plan section 2: routing graph target 1 MB (ceiling 5 MB); complete device pack target 5 MB (ceiling 20 MB). */
export const PACK_BUDGETS = Object.freeze({
  graphTargetBytes: 1_000_000,
  graphCeilingBytes: 5_000_000,
  deviceTargetBytes: 5_000_000,
  deviceCeilingBytes: 20_000_000,
});

const FINE: RoutingProfile = ROUTING_PROFILES['ampid-fine'];
const DEG = Math.PI / 180;
const METERS_PER_DEGREE = 6_371_000 * DEG;

// ---------------------------------------------------------------------------------------
// Inputs and their validation (untrusted files at the CLI boundary).
// ---------------------------------------------------------------------------------------

export type OsmTags = Readonly<Record<string, string>>;

export interface OsmNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: OsmTags;
}

export interface OsmWay {
  type: 'way';
  id: number;
  nodes: readonly number[];
  tags?: OsmTags;
}

export interface OsmRelationMember {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role: string;
}

export interface OsmRelation {
  type: 'relation';
  id: number;
  members: readonly OsmRelationMember[];
  tags?: OsmTags;
}

export type OsmElement = OsmNode | OsmWay | OsmRelation;

export interface OsmExtract {
  /** `osm3s.timestamp_osm_base` of an Overpass response. */
  timestampOsmBase: string | null;
  elements: readonly OsmElement[];
}

export interface PackCenter {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** Verified station position (plan section 7); the list is empty until one exists. */
export interface PackStation {
  stationId: string;
  lat: number;
  lng: number;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; issues: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOsmId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isLat(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 90;
}

function isLng(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 180;
}

function parseTags(value: unknown): OsmTags | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value) || !Object.values(value).every(v => typeof v === 'string')) return null;
  return value as OsmTags;
}

const MEMBER_TYPES = new Set(['node', 'way', 'relation']);

/** Validates an Overpass `[out:json]` response (`out body` with `>` recursion). */
export function parseOverpassJson(value: unknown): Parsed<OsmExtract> {
  if (!isRecord(value) || !Array.isArray(value.elements)) return { ok: false, issues: ['not_an_overpass_json_response'] };
  const issues: string[] = [];
  const seen = new Set<string>();
  const elements: OsmElement[] = [];
  value.elements.forEach((raw: unknown, index) => {
    const at = `element[${index}]`;
    if (!isRecord(raw) || !isOsmId(raw.id) || typeof raw.type !== 'string') {
      issues.push(`${at}:invalid`);
      return;
    }
    const key = `${raw.type}/${raw.id}`;
    if (seen.has(key)) issues.push(`${key}:duplicate`);
    seen.add(key);
    const tags = parseTags(raw.tags);
    if (tags === null) {
      issues.push(`${key}:invalid_tags`);
      return;
    }
    if (raw.type === 'node') {
      if (!isLat(raw.lat) || !isLng(raw.lon)) issues.push(`${key}:invalid_coordinates`);
      else elements.push({ type: 'node', id: raw.id, lat: raw.lat, lon: raw.lon, tags });
    } else if (raw.type === 'way') {
      const refs = raw.nodes;
      if (!Array.isArray(refs) || refs.length < 2 || !refs.every(isOsmId)) issues.push(`${key}:invalid_nodes`);
      else elements.push({ type: 'way', id: raw.id, nodes: refs, tags });
    } else if (raw.type === 'relation') {
      const members = raw.members;
      if (
        !Array.isArray(members) ||
        !members.every(m => isRecord(m) && typeof m.type === 'string' && MEMBER_TYPES.has(m.type) && isOsmId(m.ref) && typeof m.role === 'string')
      ) {
        issues.push(`${key}:invalid_members`);
      } else {
        elements.push({ type: 'relation', id: raw.id, members: members as OsmRelationMember[], tags });
      }
    } else {
      issues.push(`${key}:unsupported_type`);
    }
  });
  const osm3s = value.osm3s;
  const timestamp = isRecord(osm3s) && typeof osm3s.timestamp_osm_base === 'string' ? osm3s.timestamp_osm_base : null;
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: { timestampOsmBase: timestamp, elements } };
}

/** Outer ring of a GeoJSON Polygon, Feature or single-feature FeatureCollection. */
export function parseBoundaryGeoJson(value: unknown): Parsed<LngLat[]> {
  let geometry: unknown = value;
  if (isRecord(geometry) && geometry.type === 'FeatureCollection') {
    const features = geometry.features;
    if (!Array.isArray(features) || features.length !== 1) return { ok: false, issues: ['boundary_needs_exactly_one_feature'] };
    geometry = features[0];
  }
  if (isRecord(geometry) && geometry.type === 'Feature') geometry = geometry.geometry;
  if (!isRecord(geometry) || geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates)) return { ok: false, issues: ['boundary_not_a_polygon'] };
  const ring: unknown = geometry.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) return { ok: false, issues: ['boundary_ring_too_short'] };
  if (!ring.every(p => Array.isArray(p) && p.length >= 2 && isLng(p[0]) && isLat(p[1]))) return { ok: false, issues: ['boundary_invalid_coordinates'] };
  const points = ring.map(p => [p[0], p[1]] as LngLat);
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) return { ok: false, issues: ['boundary_ring_not_closed'] };
  return { ok: true, value: points };
}

function parsePointList<T>(value: unknown, listKey: string, idKey: string, build: (id: string, item: Record<string, unknown>) => T): Parsed<T[]> {
  const list = isRecord(value) ? value[listKey] : undefined;
  if (!Array.isArray(list)) return { ok: false, issues: [`missing_${listKey}`] };
  const issues: string[] = [];
  const ids = new Set<string>();
  const items: T[] = [];
  list.forEach((item: unknown, index) => {
    const id = isRecord(item) ? item[idKey] : undefined;
    if (!isRecord(item) || typeof id !== 'string' || id === '' || !isLat(item.lat) || !isLng(item.lng)) {
      issues.push(`${listKey}[${index}]:invalid`);
      return;
    }
    if (ids.has(id)) issues.push(`${listKey}[${index}]:duplicate_id`);
    ids.add(id);
    items.push(build(id, item));
  });
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: items };
}

/** `{ "centers": [{ "id", "name", "lat", "lng" }] }`. */
export function parsePackCenters(value: unknown): Parsed<PackCenter[]> {
  const parsed = parsePointList(value, 'centers', 'id', (id, item) => ({
    id,
    name: typeof item.name === 'string' ? item.name : '',
    lat: item.lat as number,
    lng: item.lng as number,
  }));
  if (parsed.ok && parsed.value.some(c => c.name === '')) return { ok: false, issues: ['centers:missing_name'] };
  return parsed;
}

/** `{ "stations": [{ "stationId", "lat", "lng" }] }` — verified positions only. */
export function parsePackStations(value: unknown): Parsed<PackStation[]> {
  return parsePointList(value, 'stations', 'stationId', (stationId, item) => ({ stationId, lat: item.lat as number, lng: item.lng as number }));
}

// ---------------------------------------------------------------------------------------
// Planar helpers (local equirectangular meters; ample at barangay scale).
// ---------------------------------------------------------------------------------------

interface XY {
  x: number;
  y: number;
}

function projector(refLat: number): { toXY: (p: LngLat) => XY; toLngLat: (p: XY) => LngLat } {
  const kx = METERS_PER_DEGREE * Math.cos(refLat * DEG);
  return {
    toXY: ([lng, lat]) => ({ x: lng * kx, y: lat * METERS_PER_DEGREE }),
    toLngLat: ({ x, y }) => [x / kx, y / METERS_PER_DEGREE],
  };
}

function round7(value: number): number {
  return Math.round(value * 1e7) / 1e7;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function pointSegmentDistance(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function lineLengthMeters(geometry: readonly LngLat[]): number {
  const { toXY } = projector(geometry[0][1]);
  let total = 0;
  for (let i = 0; i + 1 < geometry.length; i++) {
    const a = toXY(geometry[i]);
    const b = toXY(geometry[i + 1]);
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** Douglas–Peucker on an open polyline; keeps both ends. */
function simplifyLine(points: readonly XY[], tolerance: number): XY[] {
  if (points.length <= 2) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let farthest = -1;
    let farthestDistance = tolerance;
    for (let i = first + 1; i < last; i++) {
      const d = pointSegmentDistance(points[i], points[first], points[last]);
      if (d > farthestDistance) {
        farthest = i;
        farthestDistance = d;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

function simplifyLngLat(geometry: readonly LngLat[], tolerance: number): LngLat[] {
  const { toXY, toLngLat } = projector(geometry[0][1]);
  return simplifyLine(geometry.map(toXY), tolerance).map(p => {
    const [lng, lat] = toLngLat(p);
    return [round7(lng), round7(lat)] as LngLat;
  });
}

// ---------------------------------------------------------------------------------------
// Coverage: boundary buffered by the connectivity margin (plan section 2).
// ---------------------------------------------------------------------------------------

/**
 * Rasterizes "inside the boundary or within `margin` of it" on a 5 m grid, traces the cell
 * union's outline (outer ring counter-clockwise, holes clockwise) and simplifies it by 2 m.
 * The result is within COVERAGE_TOLERANCE_METERS of the exact buffer.
 */
export function bufferBoundary(boundary: readonly LngLat[], marginMeters: number): LngLat[][] {
  const refLat = boundary.reduce((sum, p) => sum + p[1], 0) / boundary.length;
  const { toXY, toLngLat } = projector(refLat);
  const ring = boundary.map(toXY);
  const step = COVERAGE_STEP_METERS;
  const pad = marginMeters + 2 * step;
  const x0 = Math.floor((Math.min(...ring.map(p => p.x)) - pad) / step) * step;
  const y0 = Math.floor((Math.min(...ring.map(p => p.y)) - pad) / step) * step;
  const nx = Math.ceil((Math.max(...ring.map(p => p.x)) + pad - x0) / step);
  const ny = Math.ceil((Math.max(...ring.map(p => p.y)) + pad - y0) / step);

  const inside = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const y = y0 + (j + 0.5) * step;
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * step;
      let within = false;
      let near = false;
      for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
        const pa = ring[a];
        const pb = ring[b];
        if (pa.y > y !== pb.y > y && x < ((pb.x - pa.x) * (y - pa.y)) / (pb.y - pa.y) + pa.x) within = !within;
        if (!near && pointSegmentDistance({ x, y }, pa, pb) <= marginMeters) near = true;
      }
      if (within || near) inside[j * nx + i] = 1;
    }
  }

  // Directed outline edges with the inside cell on the left, keyed by start corner.
  const isIn = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < ny && inside[j * nx + i] === 1;
  const next = new Map<string, [number, number]>();
  const addEdge = (from: [number, number], to: [number, number]) => {
    const key = `${from[0]},${from[1]}`;
    if (next.has(key)) throw new Error('coverage_outline_ambiguous_corner');
    next.set(key, to);
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!isIn(i, j)) continue;
      if (!isIn(i, j - 1)) addEdge([i, j], [i + 1, j]);
      if (!isIn(i + 1, j)) addEdge([i + 1, j], [i + 1, j + 1]);
      if (!isIn(i, j + 1)) addEdge([i + 1, j + 1], [i, j + 1]);
      if (!isIn(i - 1, j)) addEdge([i, j + 1], [i, j]);
    }
  }

  const loops: XY[][] = [];
  for (const startKey of [...next.keys()].sort()) {
    if (!next.has(startKey)) continue;
    const [si, sj] = startKey.split(',').map(Number);
    const loop: XY[] = [];
    let key = startKey;
    let corner: [number, number] = [si, sj];
    for (;;) {
      const to = next.get(key);
      if (to === undefined) break;
      next.delete(key);
      loop.push({ x: x0 + corner[0] * step, y: y0 + corner[1] * step });
      corner = to;
      key = `${to[0]},${to[1]}`;
    }
    loops.push(loop);
  }

  const signedArea = (loop: readonly XY[]) => loop.reduce((sum, p, k) => {
    const q = loop[(k + 1) % loop.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0) / 2;
  const outers = loops.filter(loop => signedArea(loop) > 0);
  if (outers.length !== 1) throw new Error('coverage_not_one_area');
  const holes = loops.filter(loop => signedArea(loop) < 0);

  return [outers[0], ...holes].map(loop => {
    // Close the ring at its first corner, simplify, and emit [lng, lat] with the closing vertex.
    const simplified = simplifyLine([...loop, loop[0]], COVERAGE_SIMPLIFY_METERS);
    return simplified.map(p => {
      const [lng, lat] = toLngLat(p);
      return [round7(lng), round7(lat)] as LngLat;
    });
  });
}

/** Meters from a point to the boundary line (0 on it), and whether it lies inside. */
function boundaryRelation(point: RoutingPoint, boundary: readonly LngLat[]): { inside: boolean; distanceMeters: number } {
  return { inside: isInsideCoverage(point, [boundary]), distanceMeters: distanceToPolylineMeters(point, boundary) };
}

// ---------------------------------------------------------------------------------------
// OSM interpretation: pedestrian rules (plan section 2) and attachment barriers.
// ---------------------------------------------------------------------------------------

/** Highway classes walkable by default. Cycleways and bridleways need an explicit foot tag. */
const WALKABLE_HIGHWAYS = new Set([
  'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link',
  'unclassified', 'residential', 'living_street', 'service', 'road', 'track',
  'pedestrian', 'footway', 'path', 'steps', 'corridor',
]);
const FOOT_ONLY_ONEWAY = new Set(['pedestrian', 'footway', 'path', 'steps', 'corridor']);
const FOOT_YES = new Set(['yes', 'designated', 'permissive']);
const FOOT_NO = new Set(['no', 'use_sidepath']);
const PRIVATE = new Set(['private', 'customers', 'destination']);
/** Highway classes flagged for DRRM review even when walkable (assumed defaults). */
const REVIEW_HIGHWAYS = new Set(['trunk', 'trunk_link', 'road']);
const RESIDENTIAL_HIGHWAYS = new Set(['residential', 'living_street', 'unclassified', 'service', 'tertiary', 'secondary', 'primary', 'pedestrian', 'footway', 'path', 'steps', 'track', 'road']);
const WATERWAY_BARRIERS = new Set(['river', 'stream', 'canal', 'drain', 'ditch']);
const LINEAR_BARRIERS = new Set(['wall', 'fence', 'retaining_wall', 'city_wall', 'hedge']);

export type AccessReviewReason = 'private_access' | 'assumed_trunk_foot_access' | 'unknown_road_class';

interface WayRules {
  access: PedestrianAccess;
  review: AccessReviewReason | null;
}

function tagOf(tags: OsmTags | undefined, key: string): string | undefined {
  return tags?.[key];
}

/** Pedestrian access of a highway way, or null when walkers are not allowed on it at all. */
function pedestrianRules(tags: OsmTags | undefined): WayRules | null {
  const highway = tagOf(tags, 'highway');
  if (highway === undefined) return null;
  const foot = tagOf(tags, 'foot');
  const access = tagOf(tags, 'access');
  const footAllowed = foot !== undefined && FOOT_YES.has(foot);
  if (foot !== undefined && FOOT_NO.has(foot)) return null;
  if (!WALKABLE_HIGHWAYS.has(highway) && !(footAllowed && (highway === 'cycleway' || highway === 'bridleway'))) return null;
  if (access === 'no' && !footAllowed && foot !== 'private') return null;

  const isPrivate = (foot !== undefined && PRIVATE.has(foot)) || (!footAllowed && access !== undefined && PRIVATE.has(access));
  const review: AccessReviewReason | null = isPrivate
    ? 'private_access'
    : highway === 'road'
      ? 'unknown_road_class'
      : REVIEW_HIGHWAYS.has(highway) && !footAllowed
        ? 'assumed_trunk_foot_access'
        : null;

  // Vehicle one-way tags do not bind walkers; `oneway` binds them only on foot-only ways.
  const oneway = tagOf(tags, 'oneway:foot') ?? (FOOT_ONLY_ONEWAY.has(highway) ? tagOf(tags, 'oneway') : undefined);
  const direction: PedestrianAccess = oneway === 'yes' || oneway === '1' || oneway === 'true' ? 'forward' : oneway === '-1' || oneway === 'reverse' ? 'backward' : 'both';
  return { access: direction, review };
}

export type BarrierNodeVerdict = 'blocking' | 'passable' | 'passable_private';

/** A barrier node blocks walkers when foot or general access is denied, it is locked, or it is a wall. */
function barrierNodeVerdict(tags: OsmTags | undefined): BarrierNodeVerdict | null {
  const barrier = tagOf(tags, 'barrier');
  if (barrier === undefined || barrier === 'no') return null;
  const foot = tagOf(tags, 'foot');
  const access = tagOf(tags, 'access');
  const footAllowed = foot !== undefined && FOOT_YES.has(foot);
  if (LINEAR_BARRIERS.has(barrier) && !footAllowed) return 'blocking';
  if (tagOf(tags, 'locked') === 'yes' && !footAllowed) return 'blocking';
  if (foot !== undefined && FOOT_NO.has(foot)) return 'blocking';
  if (access === 'no' && !footAllowed && foot !== 'private') return 'blocking';
  if ((foot !== undefined && PRIVATE.has(foot)) || (!footAllowed && access !== undefined && PRIVATE.has(access))) return 'passable_private';
  return 'passable';
}

function isUnderground(tags: OsmTags | undefined): boolean {
  const tunnel = tagOf(tags, 'tunnel');
  const location = tagOf(tags, 'location');
  return (tunnel !== undefined && tunnel !== 'no') || location === 'underground';
}

function isWaterArea(tags: OsmTags | undefined): boolean {
  return tagOf(tags, 'natural') === 'water' || tagOf(tags, 'waterway') === 'riverbank' || tagOf(tags, 'landuse') === 'reservoir';
}

/** Lines an origin is never attached across: open waterways, water areas and walls. */
function isBarrierWay(tags: OsmTags | undefined): boolean {
  const waterway = tagOf(tags, 'waterway');
  const barrier = tagOf(tags, 'barrier');
  return (
    (waterway !== undefined && WATERWAY_BARRIERS.has(waterway) && !isUnderground(tags)) ||
    isWaterArea(tags) ||
    (barrier !== undefined && LINEAR_BARRIERS.has(barrier))
  );
}

/** Grade key: ways cross at grade only when bridge/tunnel/layer agree. */
function gradeOf(tags: OsmTags | undefined): string {
  const bridge = tagOf(tags, 'bridge');
  const layer = tagOf(tags, 'layer') ?? '0';
  return `${bridge !== undefined && bridge !== 'no' ? 'bridge' : isUnderground(tags) ? 'tunnel' : 'ground'}:${layer}`;
}

// ---------------------------------------------------------------------------------------
// Pack and report types.
// ---------------------------------------------------------------------------------------

export interface MapFeatureProperties {
  layer: 'road' | 'water' | 'boundary' | 'coverage';
  /** OSM class (`highway` or water kind); null for the outlines. */
  kind: string | null;
  name: string | null;
  /** Roads only: whether the routing graph lets walkers use it. */
  walkable: boolean | null;
}

export type PackMap = FeatureCollection<Geometry, MapFeatureProperties>;

export interface CenterReview {
  centerId: string;
  name: string;
  insideBoundary: boolean;
  distanceToBoundaryMeters: number;
  insideCoverage: boolean;
  /** Nearest walkable node within the attachment radius; a proposal until DRRM confirms the entrance. */
  proposedEntranceNodeId: string | null;
  entranceDistanceMeters: number | null;
  /** False when the proposed entrance lies on ways that never enter the boundary (a margin island). */
  entranceOnBoundaryNetwork: boolean | null;
  /** Walkable edges inside the boundary from which this center cannot be reached. */
  unreachableEdgeCount: number;
  unreachableLengthMeters: number;
}

export interface ComponentReview {
  edgeCount: number;
  /** 0 = the group lies only in the margin (its links run outside coverage), not in the barangay. */
  insideBoundaryEdgeCount: number;
  lengthMeters: number;
  centerIds: string[];
  /** Up to five street names for orientation. */
  names: string[];
}

export interface WayReview {
  wayId: number;
  name: string | null;
  highway: string;
  edgeCount: number;
  lengthMeters: number;
}

export interface BarrierNodeReview {
  nodeId: number;
  barrier: string;
  verdict: BarrierNodeVerdict;
}

export interface RoutingPackReport {
  areaId: string;
  graphVersion: string;
  osmBaseTimestamp: string | null;
  counts: { nodes: number; edges: number; edgeLengthMeters: number; barriers: number; zeroLengthPiecesJoined: number };
  coverage: { marginMeters: number; toleranceMeters: number; rings: number; vertices: number };
  centers: CenterReview[];
  /** Connected walkable components, largest first. */
  components: ComponentReview[];
  /** Ways inside the boundary with edges that cannot reach any center. */
  streetsWithoutCenter: WayReview[];
  bridges: (WayReview & { edgeIds: string[] })[];
  /** Barrier nodes on walkable ways inside coverage; `blocking` ones split the way into dead ends. */
  barrierNodes: BarrierNodeReview[];
  accessReview: (WayReview & { reason: AccessReviewReason })[];
  /** Same-grade walkable ways that cross without a shared node: probable missing junctions. */
  crossingsWithoutJunction: { edgeIds: [string, string]; point: LngLat }[];
  stations: { status: 'unavailable' | 'verified'; applicableEdges: { stationId: string; edgeCount: number }[] };
  terrain: 'unavailable';
}

export interface RoutingPack {
  areaId: string;
  osmBaseTimestamp: string | null;
  boundarySha256: string;
  graph: RoutingGraph;
  map: PackMap;
  grids: Record<RoutingProfileId, FloodGrid>;
  report: RoutingPackReport;
}

export interface BuildRoutingPackInput {
  areaId: string;
  extract: OsmExtract;
  boundary: readonly LngLat[];
  centers: readonly PackCenter[];
  stations: readonly PackStation[];
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

// ---------------------------------------------------------------------------------------
// Topology: clip to coverage, split at shared nodes and barriers, assemble the graph.
// ---------------------------------------------------------------------------------------

interface WalkableWay {
  way: OsmWay;
  refs: number[];
  rules: WayRules;
  highway: string;
  name: string | null;
  stairs: boolean;
  bridge: boolean;
  grade: string;
}

interface EdgeMeta {
  wayId: number;
  highway: string;
  grade: string;
  review: AccessReviewReason | null;
}

/** Consecutive duplicate references removed (they carry no geometry). */
function dedupeRefs(refs: readonly number[]): number[] {
  return refs.filter((ref, i) => i === 0 || ref !== refs[i - 1]);
}

/** Maximal runs of consecutive indices whose node lies inside coverage, each ≥ 2 points. */
function insideRuns(refs: readonly number[], inside: (ref: number) => boolean): [number, number][] {
  const runs: [number, number][] = [];
  let i = 0;
  while (i < refs.length) {
    if (!inside(refs[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < refs.length && inside(refs[j + 1])) j++;
    if (j > i) runs.push([i, j]);
    i = j + 1;
  }
  return runs;
}

class UnionFind {
  private parent = new Map<string, string>();

  find(id: string): string {
    let root = id;
    while (this.parent.has(root)) root = this.parent.get(root) as string;
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    // The lower id represents the merged node, so the result does not depend on order.
    if (compareIds(ra, rb) < 0) this.parent.set(rb, ra);
    else this.parent.set(ra, rb);
  }
}

/** Proper crossing point of segments ab and cd (endpoints excluded), or null. */
function crossingPoint(a: XY, b: XY, c: XY, d: XY): XY | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denominator = rx * sy - ry * sx;
  if (denominator === 0) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denominator;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denominator;
  const eps = 1e-9;
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null;
  return { x: a.x + t * rx, y: a.y + t * ry };
}

export function buildRoutingPack(input: BuildRoutingPackInput): { ok: true; pack: RoutingPack } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const nodesById = new Map<number, OsmNode>();
  const ways: OsmWay[] = [];
  const relations: OsmRelation[] = [];
  for (const element of input.extract.elements) {
    if (element.type === 'node') nodesById.set(element.id, element);
    else if (element.type === 'way') ways.push(element);
    else relations.push(element);
  }
  ways.sort((a, b) => a.id - b.id);
  relations.sort((a, b) => a.id - b.id);
  const waysById = new Map(ways.map(way => [way.id, way]));

  // Incomplete references fail the build (plan section 2) rather than silently losing roads.
  const waterMembers = new Set<number>();
  for (const relation of relations) {
    if (!isWaterArea(relation.tags)) continue;
    for (const member of relation.members) {
      if (member.type !== 'way' || member.role !== 'outer') continue;
      if (waysById.has(member.ref)) waterMembers.add(member.ref);
      else issues.push(`missing_way:r${relation.id}:w${member.ref}`);
    }
  }
  const usedWays = ways.filter(way => tagOf(way.tags, 'highway') !== undefined || isBarrierWay(way.tags) || waterMembers.has(way.id));
  for (const way of usedWays) {
    for (const ref of way.nodes) if (!nodesById.has(ref)) issues.push(`missing_node:w${way.id}:n${ref}`);
  }
  if (issues.length > 0) return { ok: false, issues };

  let coverage: LngLat[][];
  try {
    coverage = bufferBoundary(input.boundary, COVERAGE_MARGIN_METERS);
  } catch (error) {
    return { ok: false, issues: [error instanceof Error ? error.message : 'coverage_failed'] };
  }

  const coordinateOf = (ref: number): LngLat => {
    const node = nodesById.get(ref) as OsmNode;
    return [round7(node.lon), round7(node.lat)];
  };
  const insideCache = new Map<number, boolean>();
  const inCoverage = (ref: number): boolean => {
    let inside = insideCache.get(ref);
    if (inside === undefined) {
      const [lng, lat] = coordinateOf(ref);
      inside = isInsideCoverage({ lat, lng }, coverage);
      insideCache.set(ref, inside);
    }
    return inside;
  };
  // Walkable ways and their split points.
  const walkable: WalkableWay[] = [];
  for (const way of ways) {
    const rules = pedestrianRules(way.tags);
    if (rules === null) continue;
    const highway = tagOf(way.tags, 'highway') as string;
    const bridge = tagOf(way.tags, 'bridge');
    walkable.push({
      way,
      refs: dedupeRefs(way.nodes),
      rules,
      highway,
      name: tagOf(way.tags, 'name') ?? tagOf(way.tags, 'ref') ?? null,
      stairs: highway === 'steps',
      bridge: bridge !== undefined && bridge !== 'no',
      grade: gradeOf(way.tags),
    });
  }

  const useCount = new Map<number, number>();
  for (const { refs } of walkable) {
    const closed = refs[0] === refs[refs.length - 1];
    for (const ref of closed ? refs.slice(1) : refs) useCount.set(ref, (useCount.get(ref) ?? 0) + 1);
  }
  const barrierNodes = new Map<number, BarrierNodeReview>();
  for (const ref of useCount.keys()) {
    const tags = nodesById.get(ref)?.tags;
    const verdict = barrierNodeVerdict(tags);
    if (verdict !== null && inCoverage(ref)) barrierNodes.set(ref, { nodeId: ref, barrier: tagOf(tags, 'barrier') as string, verdict });
  }
  const blocking = (ref: number) => barrierNodes.get(ref)?.verdict === 'blocking';
  const isCut = (ref: number) => (useCount.get(ref) ?? 0) >= 2 || blocking(ref);

  // Pieces between cut points inside coverage.
  interface Piece {
    w: WalkableWay;
    a: number;
    b: number;
  }
  const pieces: Piece[] = [];
  const addPiece = (w: WalkableWay, a: number, b: number) => {
    if (w.refs[a] === w.refs[b]) {
      // A closed loop between two cuts: split at its middle vertex so no edge is a self-loop.
      if (b - a < 2) return;
      const m = (a + b) >> 1;
      addPiece(w, a, m);
      addPiece(w, m, b);
      return;
    }
    pieces.push({ w, a, b });
  };
  for (const w of walkable) {
    for (const [first, last] of insideRuns(w.refs, inCoverage)) {
      let start = first;
      for (let k = first + 1; k <= last; k++) {
        if (k === last || isCut(w.refs[k])) {
          addPiece(w, start, k);
          start = k;
        }
      }
    }
  }

  // A blocking barrier gives every piece its own dead-end terminal, so nothing passes through it.
  const terminalId = (w: WalkableWay, index: number, arriving: boolean): string => {
    const ref = w.refs[index];
    return blocking(ref) ? `n${ref}:w${w.way.id}:${index}${arriving ? 'a' : 'b'}` : `n${ref}`;
  };

  const joins = new UnionFind();
  const nodeCoordinates = new Map<string, LngLat>();
  interface RawEdge {
    id: string;
    from: string;
    to: string;
    geometry: LngLat[];
    lengthMeters: number;
    w: WalkableWay;
  }
  const rawEdges: RawEdge[] = [];
  const usedIds = new Map<string, number>();
  let zeroLengthPiecesJoined = 0;
  for (const { w, a, b } of pieces) {
    const from = terminalId(w, a, false);
    const to = terminalId(w, b, true);
    const geometry = w.refs.slice(a, b + 1).map(coordinateOf);
    nodeCoordinates.set(from, geometry[0]);
    nodeCoordinates.set(to, geometry[geometry.length - 1]);
    const lengthMeters = lineLengthMeters(geometry);
    if (lengthMeters < ZERO_LENGTH_METERS) {
      joins.union(from, to);
      zeroLengthPiecesJoined++;
      continue;
    }
    const baseId = `w${w.way.id}:${w.refs[a]}-${w.refs[b]}`;
    const seen = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, seen + 1);
    rawEdges.push({ id: seen === 0 ? baseId : `${baseId}:${seen}`, from, to, geometry, lengthMeters, w });
  }

  const edgeMeta = new Map<string, EdgeMeta>();
  const edges: RoutingEdge[] = [];
  for (const raw of rawEdges) {
    const from = joins.find(raw.from);
    const to = joins.find(raw.to);
    if (from === to) {
      issues.push(`edge_collapsed_by_join:${raw.id}`);
      continue;
    }
    const geometry = [...raw.geometry];
    geometry[0] = nodeCoordinates.get(from) as LngLat;
    geometry[geometry.length - 1] = nodeCoordinates.get(to) as LngLat;
    edges.push({
      id: raw.id,
      from,
      to,
      geometry,
      lengthMeters: round2(raw.lengthMeters),
      name: raw.w.name,
      pedestrianAccess: raw.w.rules.access,
      stairs: raw.w.stairs,
      bridge: raw.w.bridge,
      sourceRef: `osm:way/${raw.w.way.id}/${raw.id.slice(raw.id.indexOf(':') + 1)}`,
    });
    edgeMeta.set(raw.id, { wayId: raw.w.way.id, highway: raw.w.highway, grade: raw.w.grade, review: raw.w.rules.review });
  }
  edges.sort((x, y) => compareIds(x.id, y.id));

  const nodeIds = new Set<string>();
  for (const edge of edges) nodeIds.add(edge.from).add(edge.to);
  const nodes: RoutingNode[] = [...nodeIds].sort(compareIds).map(id => {
    const [lng, lat] = nodeCoordinates.get(id) as LngLat;
    return { id, lat, lng };
  });

  // Attachment barriers: water and walls near the coverage (plan section 2: never snap through them).
  const coverageBox = boxOf(coverage[0], FINE.attachRadiusMeters + 10);
  const barriers: RoutingBarrier[] = [];
  for (const way of usedWays) {
    if (!isBarrierWay(way.tags) && !waterMembers.has(way.id)) continue;
    const parts = clipLineToBox(dedupeRefs(way.nodes).map(coordinateOf), coverageBox);
    parts.forEach((geometry, k) => barriers.push({ id: parts.length === 1 ? `w${way.id}` : `w${way.id}:${k}`, geometry }));
  }

  const stations = [...input.stations].sort((x, y) => compareIds(x.stationId, y.stationId));
  const stationEdges: StationEdgeApplicability[] = stations.map(station => ({
    stationId: station.stationId,
    edgeIds: stationApplicableEdgeIds(edges, station, FINE),
  }));

  const unversioned: RoutingGraph = { version: '', coverage, nodes, edges, barriers, stationEdges };
  const osmDate = input.extract.timestampOsmBase?.slice(0, 10) ?? 'undated';
  const version = `${input.areaId}@${osmDate}#${sha256(ROUTING_CONFIG_VERSION + JSON.stringify(unversioned)).slice(0, 12)}`;
  const graph: RoutingGraph = { ...unversioned, version };
  const prepared = prepareRoutingGraph(graph);
  if (!prepared.ok) return { ok: false, issues: prepared.issues.map(issue => `graph_${issue.code}:${issue.ref}`) };

  const map = buildMap(input.boundary, coverage, usedWays, waterMembers, coordinateOf, inCoverage, coverageBox, edges);
  const domainPoints: LngLat[] = [...coverage[0], ...stations.map(s => [s.lng, s.lat] as LngLat)];
  const grids = {
    'ampid-fine': buildFloodGrid(ROUTING_PROFILES['ampid-fine'], domainPoints),
    'rrl-reference': buildFloodGrid(ROUTING_PROFILES['rrl-reference'], domainPoints),
  };
  const report = buildReport({
    input,
    graph,
    edgeMeta,
    barrierNodes: [...barrierNodes.values()].sort((a, b) => a.nodeId - b.nodeId),
    zeroLengthPiecesJoined,
    stationEdges,
  });

  return {
    ok: true,
    pack: {
      areaId: input.areaId,
      osmBaseTimestamp: input.extract.timestampOsmBase,
      boundarySha256: sha256(JSON.stringify(input.boundary)),
      graph,
      map,
      grids,
      report,
    },
  };
}

interface Box {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

function boxOf(points: readonly LngLat[], padMeters: number): Box {
  const lats = points.map(p => p[1]);
  const lngs = points.map(p => p[0]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const padLat = padMeters / METERS_PER_DEGREE;
  const padLng = padMeters / (METERS_PER_DEGREE * Math.cos(midLat * DEG));
  return { minLng: Math.min(...lngs) - padLng, minLat: Math.min(...lats) - padLat, maxLng: Math.max(...lngs) + padLng, maxLat: Math.max(...lats) + padLat };
}

/**
 * Liang–Barsky clip of a polyline to a box; returns the inside pieces (≥ 2 points each). Long
 * water segments can cross the area with both nodes outside it, so vertex tests are not enough.
 */
function clipLineToBox(line: readonly LngLat[], box: Box): LngLat[][] {
  const parts: LngLat[][] = [];
  let current: LngLat[] = [];
  const flush = () => {
    if (current.length >= 2) parts.push(current);
    current = [];
  };
  for (let i = 0; i + 1 < line.length; i++) {
    const [x0, y0] = line[i];
    const [x1, y1] = line[i + 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    let t0 = 0;
    let t1 = 1;
    let visible = true;
    for (const [p, q] of [[-dx, x0 - box.minLng], [dx, box.maxLng - x0], [-dy, y0 - box.minLat], [dy, box.maxLat - y0]] as const) {
      if (p === 0) {
        if (q < 0) visible = false;
      } else {
        const r = q / p;
        if (p < 0) t0 = Math.max(t0, r);
        else t1 = Math.min(t1, r);
      }
    }
    if (!visible || t0 > t1) {
      flush();
      continue;
    }
    const point = (t: number): LngLat => [round7(x0 + t * dx), round7(y0 + t * dy)];
    if (current.length === 0) current.push(point(t0));
    current.push(point(t1));
    if (t1 < 1) flush();
  }
  flush();
  return parts;
}

// ---------------------------------------------------------------------------------------
// Server-side flood grids (plan 3.2, 3.3): one builder for both profiles.
// ---------------------------------------------------------------------------------------

/**
 * Grid over the coverage and every verified station, padded by one cell, with the south-west
 * corner as origin (`FloodGrid` convention). Elevations are unknown (null) until a licensed DEM
 * passes the vertical-accuracy rule; BFS then reports unknown coverage, never dry ground.
 */
function buildFloodGrid(profile: RoutingProfile, points: readonly LngLat[]): FloodGrid {
  const box = boxOf(points, profile.cellSizeMeters);
  const originLat = round7(box.minLat);
  const originLng = round7(box.minLng);
  const { toXY } = projector(originLat);
  const origin = toXY([originLng, originLat]);
  const corner = toXY([box.maxLng, box.maxLat]);
  const cols = Math.ceil((corner.x - origin.x) / profile.cellSizeMeters);
  const rows = Math.ceil((corner.y - origin.y) / profile.cellSizeMeters);
  return { cellSizeMeters: profile.cellSizeMeters, cols, rows, originLat, originLng, elevations: new Array<null>(cols * rows).fill(null) };
}

// ---------------------------------------------------------------------------------------
// Offline display map: vector roads and water from the same extract (no tile prefetch).
// ---------------------------------------------------------------------------------------

function buildMap(
  boundary: readonly LngLat[],
  coverage: readonly LngLat[][],
  ways: readonly OsmWay[],
  waterMembers: ReadonlySet<number>,
  coordinateOf: (ref: number) => LngLat,
  inCoverage: (ref: number) => boolean,
  waterBox: Box,
  edges: readonly RoutingEdge[],
): PackMap {
  const walkableWays = new Set(edges.map(edge => edge.sourceRef.split('/')[1]));
  const features: Feature<Geometry, MapFeatureProperties>[] = [
    { type: 'Feature', properties: { layer: 'coverage', kind: null, name: null, walkable: null }, geometry: { type: 'Polygon', coordinates: coverage.map(r => r.map(p => [...p])) } },
    { type: 'Feature', properties: { layer: 'boundary', kind: null, name: null, walkable: null }, geometry: { type: 'Polygon', coordinates: [boundary.map(p => [...p])] } },
  ];
  const line = (way: OsmWay, geometry: readonly LngLat[], properties: MapFeatureProperties) => {
    features.push({
      type: 'Feature',
      properties: { ...properties, name: tagOf(way.tags, 'name') ?? null },
      geometry: { type: 'LineString', coordinates: simplifyLngLat(geometry, MAP_SIMPLIFY_METERS).map(p => [...p]) },
    });
  };
  for (const way of ways) {
    const highway = tagOf(way.tags, 'highway');
    const waterway = tagOf(way.tags, 'waterway');
    const refs = dedupeRefs(way.nodes);
    if (highway !== undefined) {
      // Roads are clipped like the graph (runs of inside nodes) so the map never shows more than routing knows.
      const walkable = walkableWays.has(String(way.id));
      for (const [first, last] of insideRuns(refs, inCoverage)) {
        line(way, refs.slice(first, last + 1).map(coordinateOf), { layer: 'road', kind: highway, name: null, walkable });
      }
      continue;
    }
    const kind = isWaterArea(way.tags) || waterMembers.has(way.id) ? 'area' : waterway !== undefined && WATERWAY_BARRIERS.has(waterway) && !isUnderground(way.tags) ? waterway : null;
    if (kind === null) continue;
    for (const part of clipLineToBox(refs.map(coordinateOf), waterBox)) line(way, part, { layer: 'water', kind, name: null, walkable: null });
  }
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------------------
// Review report for DRRM (connectivity, entrances, bridges, barriers, access assumptions).
// ---------------------------------------------------------------------------------------

function canWalk(edge: RoutingEdge, forward: boolean): boolean {
  return edge.pedestrianAccess === 'both' || edge.pedestrianAccess === (forward ? 'forward' : 'backward');
}

function buildReport(args: {
  input: BuildRoutingPackInput;
  graph: RoutingGraph;
  edgeMeta: ReadonlyMap<string, EdgeMeta>;
  barrierNodes: BarrierNodeReview[];
  zeroLengthPiecesJoined: number;
  stationEdges: readonly StationEdgeApplicability[];
}): RoutingPackReport {
  const { input, graph, edgeMeta } = args;
  const edges = graph.edges.filter(edge => edge.pedestrianAccess !== 'none');
  const incident = new Map<string, number[]>();
  edges.forEach((edge, e) => {
    for (const node of [edge.from, edge.to]) {
      const list = incident.get(node) ?? [];
      list.push(e);
      incident.set(node, list);
    }
  });
  const nodeById = new Map(graph.nodes.map(node => [node.id, node]));
  const insideBoundary = edges.map(edge => edge.geometry.some(([lng, lat]) => isInsideCoverage({ lat, lng }, [input.boundary])));

  // Nodes from which a walker can reach `target`, following pedestrian directions backwards.
  const reachingNodes = (target: string): Set<string> => {
    const seen = new Set([target]);
    const queue = [target];
    for (let head = 0; head < queue.length; head++) {
      const v = queue[head];
      for (const e of incident.get(v) ?? []) {
        const edge = edges[e];
        if (edge.to === v && canWalk(edge, true) && !seen.has(edge.from)) {
          seen.add(edge.from);
          queue.push(edge.from);
        }
        if (edge.from === v && canWalk(edge, false) && !seen.has(edge.to)) {
          seen.add(edge.to);
          queue.push(edge.to);
        }
      }
    }
    return seen;
  };
  // An origin on an edge leaves through whichever end its direction allows.
  const edgeReaches = (edge: RoutingEdge, nodesReaching: ReadonlySet<string>) =>
    (canWalk(edge, true) && nodesReaching.has(edge.to)) || (canWalk(edge, false) && nodesReaching.has(edge.from));

  // Undirected components, and how much of each lies inside the boundary.
  const componentOf = new Int32Array(edges.length).fill(-1);
  const componentMembers: number[][] = [];
  edges.forEach((_, start) => {
    if (componentOf[start] !== -1) return;
    const id = componentMembers.length;
    const stack = [start];
    componentOf[start] = id;
    const members: number[] = [];
    while (stack.length > 0) {
      const e = stack.pop() as number;
      members.push(e);
      for (const node of [edges[e].from, edges[e].to]) {
        for (const other of incident.get(node) ?? []) {
          if (componentOf[other] === -1) {
            componentOf[other] = id;
            stack.push(other);
          }
        }
      }
    }
    componentMembers.push(members);
  });
  const componentInside = componentMembers.map(members => members.filter(e => insideBoundary[e]).length);

  const reachesAny = new Uint8Array(edges.length);
  const edgeCenters: string[][] = edges.map(() => []);
  const centers = [...input.centers].sort((a, b) => compareIds(a.id, b.id));
  const centerReviews: CenterReview[] = centers.map(center => {
    const relation = boundaryRelation(center, input.boundary);
    const { toXY } = projector(center.lat);
    const at = toXY([center.lng, center.lat]);
    let entrance: { id: string; distance: number } | null = null;
    for (const nodeId of [...incident.keys()].sort(compareIds)) {
      const node = nodeById.get(nodeId) as RoutingNode;
      const p = toXY([node.lng, node.lat]);
      const distance = Math.hypot(p.x - at.x, p.y - at.y);
      if (distance <= FINE.attachRadiusMeters && (entrance === null || distance < entrance.distance)) {
        entrance = { id: nodeId, distance };
      }
    }
    let unreachableEdgeCount = 0;
    let unreachableLengthMeters = 0;
    const reaching = entrance === null ? new Set<string>() : reachingNodes(entrance.id);
    edges.forEach((edge, e) => {
      if (entrance !== null && edgeReaches(edge, reaching)) {
        reachesAny[e] = 1;
        edgeCenters[e].push(center.id);
      } else if (insideBoundary[e]) {
        unreachableEdgeCount++;
        unreachableLengthMeters += edge.lengthMeters;
      }
    });
    return {
      centerId: center.id,
      name: center.name,
      insideBoundary: relation.inside,
      distanceToBoundaryMeters: round2(relation.distanceMeters),
      insideCoverage: isInsideCoverage(center, graph.coverage),
      proposedEntranceNodeId: entrance?.id ?? null,
      entranceDistanceMeters: entrance === null ? null : round2(entrance.distance),
      entranceOnBoundaryNetwork: entrance === null ? null : componentInside[componentOf[(incident.get(entrance.id) as number[])[0]]] > 0,
      unreachableEdgeCount,
      unreachableLengthMeters: round2(unreachableLengthMeters),
    };
  });

  const components: ComponentReview[] = componentMembers.map((members, id) => ({
    edgeCount: members.length,
    insideBoundaryEdgeCount: componentInside[id],
    lengthMeters: round2(members.reduce((s, e) => s + edges[e].lengthMeters, 0)),
    centerIds: [...new Set(members.flatMap(e => edgeCenters[e]))].sort(compareIds),
    names: [...new Set(members.map(e => edges[e].name).filter((n): n is string => n !== null))].sort(compareIds).slice(0, 5),
  }));
  components.sort((a, b) => b.lengthMeters - a.lengthMeters || b.edgeCount - a.edgeCount || compareIds(a.names.join(), b.names.join()));

  const byWay = (filter: (edge: RoutingEdge, e: number) => boolean): (WayReview & { edgeIds: string[]; meta: EdgeMeta })[] => {
    const groups = new Map<number, WayReview & { edgeIds: string[]; meta: EdgeMeta }>();
    edges.forEach((edge, e) => {
      if (!filter(edge, e)) return;
      const meta = edgeMeta.get(edge.id) as EdgeMeta;
      const group = groups.get(meta.wayId) ?? { wayId: meta.wayId, name: edge.name, highway: meta.highway, edgeCount: 0, lengthMeters: 0, edgeIds: [], meta };
      group.edgeCount++;
      group.lengthMeters = round2(group.lengthMeters + edge.lengthMeters);
      group.edgeIds.push(edge.id);
      groups.set(meta.wayId, group);
    });
    return [...groups.values()].sort((a, b) => a.wayId - b.wayId);
  };
  const wayReview = (g: WayReview): WayReview => ({ wayId: g.wayId, name: g.name, highway: g.highway, edgeCount: g.edgeCount, lengthMeters: g.lengthMeters });

  const streetsWithoutCenter = byWay((edge, e) => insideBoundary[e] && reachesAny[e] === 0 && RESIDENTIAL_HIGHWAYS.has((edgeMeta.get(edge.id) as EdgeMeta).highway)).map(wayReview);
  const bridges = byWay(edge => edge.bridge).map(g => ({ ...wayReview(g), edgeIds: g.edgeIds }));
  const accessReview = byWay(edge => (edgeMeta.get(edge.id) as EdgeMeta).review !== null).map(g => ({
    ...wayReview(g),
    reason: g.meta.review as AccessReviewReason,
  }));

  // Same-grade crossings without a shared node.
  const { toXY, toLngLat } = projector(graph.nodes[0]?.lat ?? 0);
  const segments = graph.edges.flatMap(edge => {
    const grade = (edgeMeta.get(edge.id) as EdgeMeta).grade;
    const points = edge.geometry.map(toXY);
    return points.slice(1).map((b, i) => ({ edge, grade, a: points[i], b }));
  });
  const crossings = new Map<string, { edgeIds: [string, string]; point: LngLat }>();
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    for (let j = i + 1; j < segments.length; j++) {
      const t = segments[j];
      if (s.edge === t.edge || s.grade !== t.grade) continue;
      if (Math.max(s.a.x, s.b.x) < Math.min(t.a.x, t.b.x) || Math.max(t.a.x, t.b.x) < Math.min(s.a.x, s.b.x)) continue;
      if (Math.max(s.a.y, s.b.y) < Math.min(t.a.y, t.b.y) || Math.max(t.a.y, t.b.y) < Math.min(s.a.y, s.b.y)) continue;
      const point = crossingPoint(s.a, s.b, t.a, t.b);
      if (point === null) continue;
      const pair = [s.edge.id, t.edge.id].sort(compareIds) as [string, string];
      const key = pair.join('|');
      if (!crossings.has(key)) {
        const [lng, lat] = toLngLat(point);
        crossings.set(key, { edgeIds: pair, point: [round7(lng), round7(lat)] });
      }
    }
  }

  return {
    areaId: input.areaId,
    graphVersion: graph.version,
    osmBaseTimestamp: input.extract.timestampOsmBase,
    counts: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      edgeLengthMeters: round2(graph.edges.reduce((sum, edge) => sum + edge.lengthMeters, 0)),
      barriers: graph.barriers.length,
      zeroLengthPiecesJoined: args.zeroLengthPiecesJoined,
    },
    coverage: {
      marginMeters: COVERAGE_MARGIN_METERS,
      toleranceMeters: COVERAGE_TOLERANCE_METERS,
      rings: graph.coverage.length,
      vertices: graph.coverage.reduce((sum, ring) => sum + ring.length, 0),
    },
    centers: centerReviews,
    components,
    streetsWithoutCenter,
    bridges,
    barrierNodes: args.barrierNodes,
    accessReview,
    crossingsWithoutJunction: [...crossings.values()].sort((a, b) => compareIds(a.edgeIds.join('|'), b.edgeIds.join('|'))),
    stations: {
      status: args.stationEdges.length > 0 ? 'verified' : 'unavailable',
      applicableEdges: args.stationEdges.map(entry => ({ stationId: entry.stationId, edgeCount: entry.edgeIds.length })),
    },
    terrain: 'unavailable',
  };
}

// ---------------------------------------------------------------------------------------
// Serialization: canonical files, manifest and budgets.
// ---------------------------------------------------------------------------------------

export interface PackFile {
  path: string;
  content: string;
  audience: RoutingPackResource['audience'];
}

export interface PackBudget {
  graphBytes: number;
  deviceBytes: number;
  withinTargets: boolean;
  withinCeilings: boolean;
}

export function serializeRoutingPack(pack: RoutingPack): { files: PackFile[]; manifest: RoutingPackManifest; budget: PackBudget } {
  const resources: PackFile[] = [
    { path: 'graph.json', content: JSON.stringify(pack.graph), audience: 'device' },
    { path: 'map.json', content: JSON.stringify(pack.map), audience: 'device' },
    { path: 'server/grid-ampid-fine.json', content: JSON.stringify(pack.grids['ampid-fine']), audience: 'server' },
    { path: 'server/grid-rrl-reference.json', content: JSON.stringify(pack.grids['rrl-reference']), audience: 'server' },
  ];
  const manifest: RoutingPackManifest = {
    schemaVersion: 1,
    areaId: pack.areaId,
    graphVersion: pack.graph.version,
    configVersion: ROUTING_CONFIG_VERSION,
    osmBaseTimestamp: pack.osmBaseTimestamp,
    boundarySha256: pack.boundarySha256,
    coverageMarginMeters: COVERAGE_MARGIN_METERS,
    attribution: OSM_ATTRIBUTION,
    stations: pack.report.stations.status,
    terrain: 'unavailable',
    resources: resources.map(file => ({ path: file.path, bytes: Buffer.byteLength(file.content), sha256: sha256(file.content), audience: file.audience })),
  };
  const manifestFile: PackFile = { path: 'manifest.json', content: `${JSON.stringify(manifest, null, 2)}\n`, audience: 'device' };
  const files = [manifestFile, ...resources];
  const graphBytes = Buffer.byteLength(resources[0].content);
  const deviceBytes = files.filter(f => f.audience === 'device').reduce((sum, f) => sum + Buffer.byteLength(f.content), 0);
  return {
    files,
    manifest,
    budget: {
      graphBytes,
      deviceBytes,
      withinTargets: graphBytes <= PACK_BUDGETS.graphTargetBytes && deviceBytes <= PACK_BUDGETS.deviceTargetBytes,
      withinCeilings: graphBytes <= PACK_BUDGETS.graphCeilingBytes && deviceBytes <= PACK_BUDGETS.deviceCeilingBytes,
    },
  };
}

// ---------------------------------------------------------------------------------------
// Stable segment mappings across graph versions live in the import-free core, which Android
// also runs when it activates a new pack (plan R6).
// ---------------------------------------------------------------------------------------

export { mapEdgesAcrossGraphs, type EdgeMapping } from './evacuation-routing.ts';
