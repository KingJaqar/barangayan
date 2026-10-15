/**
 * Durable offline routing store (DRRM weather-routing plan, phase R6).
 *
 * Keeps the active and previous routing packs, the latest compatible conditions snapshot and
 * the resident's local avoidance marks in document storage, independent of the 30-minute
 * emergency cache. A new pack is staged and verified before a journaled pointer switch, so a
 * crash at any step recovers deterministically. Storage is injected, so this module stays
 * free of native code and runs under vitest.
 */
import { routingConditionsSnapshotSchema, type RoutingConditionsSnapshot } from '@barangayan/shared';
import {
  ROUTING_CONFIG_VERSION,
  distanceToPolylineMeters,
  mapEdgesAcrossGraphs,
  prepareRoutingGraph,
  type CompiledRoutingConditions,
  type PreparedRoutingGraph,
  type RoutingCenter,
  type RoutingEdge,
  type RoutingGraph,
  type RoutingPackManifest,
  type RoutingPackResource,
} from '@barangayan/shared/src/lib/evacuation-routing';
import {
  ROUTE_SERVICE_LIMITS,
  parseRouteConditionsSnapshot,
  selectRouteConditions,
  type RouteSnapshotRejection,
} from '@barangayan/shared/src/lib/evacuation-route-service';
import type { FeatureCollection, Geometry } from 'geojson';

/** The only routing area (plan: Barangay Ampid I). */
export const ROUTING_AREA_ID = 'ampid-1';

/**
 * Paths are relative to the area's storage root and '/'-separated. `writeText` replaces a
 * file atomically: the complete text is written to `<path>.tmp` before it replaces `<path>`,
 * and `readText` falls back to that temporary file when the replacement was interrupted.
 */
export interface RoutingStorage {
  readText(path: string): Promise<string | null>;
  writeText(path: string, text: string): Promise<void>;
  removeFile(path: string): Promise<void>;
  removeDirectory(path: string): Promise<void>;
  /** Moves a directory, replacing any existing destination. */
  moveDirectory(from: string, to: string): Promise<void>;
  /** Moves a file, replacing any existing destination. */
  moveFile(from: string, to: string): Promise<void>;
  /** Entry names in a directory; empty when it does not exist. */
  list(directory: string): Promise<string[]>;
  /** Lowercase hex SHA-256 of the text's UTF-8 bytes. */
  sha256(text: string): Promise<string>;
}

// ---------------------------------------------------------------------------------------
// Pack verification
// ---------------------------------------------------------------------------------------

export interface PackFiles {
  manifest: string;
  graph: string;
  map: string;
}

export interface PackMapProperties {
  layer: 'road' | 'water' | 'boundary' | 'coverage';
  kind: string | null;
  name: string | null;
  walkable: boolean | null;
}

/** Vector roads, water and outlines of the pack (R3 `map.json`): the offline basemap. */
export type PackMap = FeatureCollection<Geometry, PackMapProperties>;

export interface LoadedPack {
  manifest: RoutingPackManifest;
  graph: PreparedRoutingGraph;
  map: PackMap;
}

export type PackRejection =
  | 'missing'
  | 'manifest_invalid'
  | 'area_mismatch'
  | 'config_incompatible'
  | 'resource_mismatch'
  | 'graph_invalid'
  | 'map_invalid';

const DEVICE_RESOURCES = ['graph.json', 'map.json'] as const;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Byte length of the text encoded as UTF-8 (lone surrogates count as U+FFFD, like TextEncoder). */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

function parseResource(value: unknown): RoutingPackResource | null {
  if (!isRecord(value) || typeof value.path !== 'string' || typeof value.sha256 !== 'string' || !SHA256_PATTERN.test(value.sha256)) return null;
  if (typeof value.bytes !== 'number' || !Number.isSafeInteger(value.bytes) || value.bytes < 0) return null;
  if (value.audience !== 'device' && value.audience !== 'server') return null;
  return { path: value.path, bytes: value.bytes, sha256: value.sha256, audience: value.audience };
}

export function parsePackManifest(text: string): RoutingPackManifest | null {
  const value = parseJson(text);
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
  const { areaId, graphVersion, configVersion, osmBaseTimestamp, boundarySha256, coverageMarginMeters, attribution, stations, terrain, resources } = value;
  if (typeof areaId !== 'string' || typeof graphVersion !== 'string' || graphVersion === '' || typeof configVersion !== 'string') return null;
  if (!(osmBaseTimestamp === null || typeof osmBaseTimestamp === 'string') || typeof boundarySha256 !== 'string' || typeof attribution !== 'string') return null;
  if (typeof coverageMarginMeters !== 'number' || (stations !== 'unavailable' && stations !== 'verified') || terrain !== 'unavailable') return null;
  if (!Array.isArray(resources)) return null;
  const parsed: RoutingPackResource[] = [];
  for (const resource of resources) {
    const entry = parseResource(resource);
    if (entry === null) return null;
    parsed.push(entry);
  }
  return {
    schemaVersion: 1,
    areaId,
    graphVersion,
    configVersion,
    osmBaseTimestamp,
    boundarySha256,
    coverageMarginMeters,
    attribution,
    stations,
    terrain,
    resources: parsed,
  };
}

function isPackMap(value: unknown): value is PackMap {
  return isRecord(value) && value.type === 'FeatureCollection' && Array.isArray(value.features);
}

/**
 * Verifies exact resource bytes (length and SHA-256 from the manifest), schema, the area and
 * routing config this build runs, and the graph itself (plan section 4). Hashes detect
 * corruption; the trusted origin is the app bundle.
 */
export async function verifyPack(
  files: PackFiles,
  sha256: (text: string) => Promise<string>,
  areaId: string,
): Promise<{ ok: true; pack: LoadedPack } | { ok: false; reason: PackRejection }> {
  const manifest = parsePackManifest(files.manifest);
  if (manifest === null) return { ok: false, reason: 'manifest_invalid' };
  if (manifest.areaId !== areaId) return { ok: false, reason: 'area_mismatch' };
  if (manifest.configVersion !== ROUTING_CONFIG_VERSION) return { ok: false, reason: 'config_incompatible' };
  for (const path of DEVICE_RESOURCES) {
    const entry = manifest.resources.find(resource => resource.path === path && resource.audience === 'device');
    if (entry === undefined) return { ok: false, reason: 'manifest_invalid' };
    const text = path === 'graph.json' ? files.graph : files.map;
    if (utf8ByteLength(text) !== entry.bytes || (await sha256(text)) !== entry.sha256) return { ok: false, reason: 'resource_mismatch' };
  }
  const graphJson = parseJson(files.graph);
  if (!isRecord(graphJson) || !Array.isArray(graphJson.nodes) || !Array.isArray(graphJson.edges)) return { ok: false, reason: 'graph_invalid' };
  // The bytes match the builder's output, so the shape is the builder's RoutingGraph;
  // prepareRoutingGraph re-validates topology and coordinates.
  const prepared = prepareRoutingGraph(graphJson as unknown as RoutingGraph);
  if (!prepared.ok || prepared.graph.version !== manifest.graphVersion) return { ok: false, reason: 'graph_invalid' };
  const map = parseJson(files.map);
  if (!isPackMap(map)) return { ok: false, reason: 'map_invalid' };
  return { ok: true, pack: { manifest, graph: prepared.graph, map } };
}

// ---------------------------------------------------------------------------------------
// Conditions (latest compatible snapshot)
// ---------------------------------------------------------------------------------------

export interface StoredConditions {
  schemaVersion: 1;
  /** When this device last received the snapshot; separate from its publication time. */
  storedAt: string;
  snapshot: RoutingConditionsSnapshot;
}

export function parseStoredConditions(text: string | null): StoredConditions | null {
  if (text === null) return null;
  const value = parseJson(text);
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.storedAt !== 'string') return null;
  const snapshot = routingConditionsSnapshotSchema.safeParse(value.snapshot);
  return snapshot.success ? { schemaVersion: 1, storedAt: value.storedAt, snapshot: snapshot.data } : null;
}

export type ConditionsRejection = 'invalid' | 'other_area' | 'other_graph' | 'older';

/**
 * Accepts a get_routing_conditions_snapshot response for `graphVersion`. A malformed response
 * never replaces stored conditions (failed ingestion never publishes an empty replacement), and
 * an older revision never overwrites a newer one (invariant 5).
 */
export function acceptConditions(
  stored: StoredConditions | null,
  raw: unknown,
  areaId: string,
  graphVersion: string,
  now: Date,
): { ok: true; stored: StoredConditions } | { ok: false; reason: ConditionsRejection } {
  const parsed = routingConditionsSnapshotSchema.safeParse(raw);
  if (!parsed.success || parseRouteConditionsSnapshot(parsed.data) === null) return { ok: false, reason: 'invalid' };
  const snapshot = parsed.data;
  if (snapshot.areaId !== areaId) return { ok: false, reason: 'other_area' };
  if (snapshot.graphVersion !== graphVersion) return { ok: false, reason: 'other_graph' };
  if (stored !== null && stored.snapshot.graphVersion === graphVersion && stored.snapshot.revision > snapshot.revision) {
    return { ok: false, reason: 'older' };
  }
  return { ok: true, stored: { schemaVersion: 1, storedAt: now.toISOString(), snapshot } };
}

// ---------------------------------------------------------------------------------------
// Local avoidance (plan section 4)
// ---------------------------------------------------------------------------------------

/** A resident's own blocked segment: both directions, this phone only, never a verified closure. */
export interface LocalAvoidanceRecord {
  id: string;
  areaId: string;
  /** Graph the edges belong to. */
  graphVersion: string;
  /** Copies of the blocked graph edges (source references and geometry) so the mark can be remapped onto any later graph. */
  edges: RoutingEdge[];
  name: string | null;
  createdAt: string;
}

interface AvoidanceFile {
  schemaVersion: 1;
  records: LocalAvoidanceRecord[];
}

function isRoutingEdge(value: unknown): value is RoutingEdge {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.from === 'string' &&
    typeof value.to === 'string' &&
    Array.isArray(value.geometry) &&
    value.geometry.every(point => Array.isArray(point) && point.length === 2 && point.every(n => typeof n === 'number' && Number.isFinite(n))) &&
    typeof value.lengthMeters === 'number' &&
    (value.name === null || typeof value.name === 'string') &&
    typeof value.pedestrianAccess === 'string' &&
    typeof value.stairs === 'boolean' &&
    typeof value.bridge === 'boolean' &&
    typeof value.sourceRef === 'string'
  );
}

function isAvoidanceRecord(value: unknown): value is LocalAvoidanceRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.areaId === 'string' &&
    typeof value.graphVersion === 'string' &&
    Array.isArray(value.edges) &&
    value.edges.length > 0 &&
    value.edges.every(isRoutingEdge) &&
    (value.name === null || typeof value.name === 'string') &&
    typeof value.createdAt === 'string'
  );
}

/** null when the file exists but cannot be read as a whole (it is then preserved, never overwritten). */
export function parseAvoidance(text: string | null): LocalAvoidanceRecord[] | null {
  if (text === null) return [];
  const value = parseJson(text);
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.records) || !value.records.every(isAvoidanceRecord)) return null;
  return value.records;
}

export function serializeAvoidance(records: readonly LocalAvoidanceRecord[]): string {
  const file: AvoidanceFile = { schemaVersion: 1, records: [...records] };
  return JSON.stringify(file);
}

/** All marked edge ids, so they fit one connected route request as well (R5 limit). */
export function avoidedEdgeIds(records: readonly LocalAvoidanceRecord[]): string[] {
  return [...new Set(records.flatMap(record => record.edges.map(edge => edge.id)))].sort();
}

export const MAX_AVOIDED_SEGMENTS = ROUTE_SERVICE_LIMITS.maxAvoidEdgeIds;

function graphView(graph: PreparedRoutingGraph): RoutingGraph {
  return { version: graph.version, coverage: graph.coverage, nodes: graph.nodes, edges: graph.edges, barriers: graph.barriers, stationEdges: [] };
}

/**
 * Maps every mark onto `graph` by its stored source references and geometry. A mark whose
 * segments are not fully covered stays unchanged and is reported, never dropped (plan section 4).
 */
export function remapAvoidance(
  records: readonly LocalAvoidanceRecord[],
  graph: PreparedRoutingGraph,
): { records: LocalAvoidanceRecord[]; unresolvedIds: string[] } {
  const view = graphView(graph);
  const unresolvedIds: string[] = [];
  const remapped = records.map(record => {
    if (record.graphVersion === graph.version) {
      if (!record.edges.every(edge => graph.edgeIndex.has(edge.id))) unresolvedIds.push(record.id);
      return record;
    }
    const previous: RoutingGraph = { version: record.graphVersion, coverage: [], nodes: [], edges: record.edges, barriers: [], stationEdges: [] };
    const mappings = mapEdgesAcrossGraphs(previous, view);
    if (mappings.some(mapping => mapping.status === 'unresolved')) {
      unresolvedIds.push(record.id);
      return record;
    }
    const successorIds = [...new Set(mappings.flatMap(mapping => mapping.successorIds))].sort();
    const edges = successorIds.map(id => graph.edges[graph.edgeIndex.get(id) as number]);
    return { ...record, graphVersion: graph.version, edges };
  });
  return { records: remapped, unresolvedIds };
}

// ---------------------------------------------------------------------------------------
// Routing inputs from the store
// ---------------------------------------------------------------------------------------

export type LocalConditionsProblem = 'no_conditions' | RouteSnapshotRejection;

/**
 * Compiles the stored snapshot for the active graph (closure-only, stage 1). Refuses a snapshot
 * for another graph, a graph the area has not activated, or an unmapped verified closure.
 */
export function localRoutingInputs(
  graph: PreparedRoutingGraph,
  stored: RoutingConditionsSnapshot | null,
): { ok: true; conditions: CompiledRoutingConditions; centers: RoutingCenter[] } | { ok: false; problem: LocalConditionsProblem } {
  if (stored === null) return { ok: false, problem: 'no_conditions' };
  const snapshot = parseRouteConditionsSnapshot(stored);
  if (snapshot === null) return { ok: false, problem: 'no_conditions' };
  const selection = selectRouteConditions(snapshot, graph, null);
  if (!selection.ok) return { ok: false, problem: selection.reason };
  return { ok: true, conditions: selection.conditions, centers: selection.centers };
}

// ---------------------------------------------------------------------------------------
// Store state, journal and recovery
// ---------------------------------------------------------------------------------------

export interface PackPointer {
  graphVersion: string;
  /** e.g. `packs/ampid-1@2026-10-12_fc7101b6227d` */
  dir: string;
}

export interface StoreJournal {
  candidate: PackPointer;
  /** staging: files may be partial; staged: verified copy in place; committed: pointer switched. */
  phase: 'staging' | 'staged' | 'committed';
}

export interface RoutingStoreState {
  schemaVersion: 1;
  areaId: string;
  active: PackPointer | null;
  previous: PackPointer | null;
  journal: StoreJournal | null;
}

export const STORE_FILES = {
  state: 'state.json',
  conditions: 'conditions.json',
  conditionsNext: 'conditions.next.json',
  avoidance: 'avoidance.json',
  avoidanceNext: 'avoidance.next.json',
  packs: 'packs',
  staging: 'staging',
} as const;

export function packDirectoryName(graphVersion: string): string {
  return graphVersion.replace(/[^A-Za-z0-9._-]/g, '_');
}

function pointerFor(graphVersion: string, root: 'packs' | 'staging'): PackPointer {
  return { graphVersion, dir: `${root}/${packDirectoryName(graphVersion)}` };
}

function isPointer(value: unknown): value is PackPointer {
  return isRecord(value) && typeof value.graphVersion === 'string' && typeof value.dir === 'string' && value.dir.startsWith('packs/');
}

export function emptyState(areaId: string): RoutingStoreState {
  return { schemaVersion: 1, areaId, active: null, previous: null, journal: null };
}

export function parseState(text: string | null, areaId: string): RoutingStoreState | null {
  if (text === null) return null;
  const value = parseJson(text);
  if (!isRecord(value) || value.schemaVersion !== 1 || value.areaId !== areaId) return null;
  const { active, previous, journal } = value;
  if (!(active === null || isPointer(active)) || !(previous === null || isPointer(previous))) return null;
  let parsedJournal: StoreJournal | null = null;
  if (journal !== null) {
    if (!isRecord(journal) || !isPointer(journal.candidate)) return null;
    if (journal.phase !== 'staging' && journal.phase !== 'staged' && journal.phase !== 'committed') return null;
    parsedJournal = { candidate: journal.candidate, phase: journal.phase };
  }
  return { schemaVersion: 1, areaId, active, previous, journal: parsedJournal };
}

async function writeState(storage: RoutingStorage, state: RoutingStoreState): Promise<void> {
  await storage.writeText(STORE_FILES.state, JSON.stringify(state));
}

async function promote(storage: RoutingStorage, next: string, target: string): Promise<void> {
  const text = await storage.readText(next);
  if (text === null) return;
  await storage.writeText(target, text);
  await storage.removeFile(next);
}

async function prunePacks(storage: RoutingStorage, state: RoutingStoreState): Promise<void> {
  const keep = new Set([state.active?.dir, state.previous?.dir]);
  for (const name of await storage.list(STORE_FILES.packs)) {
    const dir = `${STORE_FILES.packs}/${name}`;
    if (!keep.has(dir)) await storage.removeDirectory(dir);
  }
}

/**
 * Finishes or undoes an interrupted activation (plan section 4: recover deterministically).
 * Before the pointer switch is durable the active pack stays and everything the candidate
 * staged is discarded; after it, the files that belong to the switch are promoted.
 */
export async function recoverStore(storage: RoutingStorage, areaId: string): Promise<RoutingStoreState> {
  const state = parseState(await storage.readText(STORE_FILES.state), areaId) ?? emptyState(areaId);
  const journal = state.journal;
  if (journal !== null) {
    if (journal.phase === 'committed') {
      await promote(storage, STORE_FILES.avoidanceNext, STORE_FILES.avoidance);
      await promote(storage, STORE_FILES.conditionsNext, STORE_FILES.conditions);
    } else {
      await storage.removeFile(STORE_FILES.avoidanceNext);
      await storage.removeFile(STORE_FILES.conditionsNext);
      if (journal.candidate.dir !== state.active?.dir && journal.candidate.dir !== state.previous?.dir) {
        await storage.removeDirectory(journal.candidate.dir);
      }
    }
  }
  const recovered: RoutingStoreState = { ...state, journal: null };
  await storage.removeDirectory(STORE_FILES.staging);
  await writeState(storage, recovered);
  await prunePacks(storage, recovered);
  return recovered;
}

export async function readPackFiles(storage: RoutingStorage, dir: string): Promise<PackFiles | null> {
  const [manifest, graph, map] = await Promise.all([
    storage.readText(`${dir}/manifest.json`),
    storage.readText(`${dir}/graph.json`),
    storage.readText(`${dir}/map.json`),
  ]);
  return manifest === null || graph === null || map === null ? null : { manifest, graph, map };
}

export async function loadPackAt(
  storage: RoutingStorage,
  pointer: PackPointer,
  areaId: string,
): Promise<{ ok: true; pack: LoadedPack } | { ok: false; reason: PackRejection }> {
  const files = await readPackFiles(storage, pointer.dir);
  if (files === null) return { ok: false, reason: 'missing' };
  const verified = await verifyPack(files, text => storage.sha256(text), areaId);
  if (verified.ok && verified.pack.graph.version !== pointer.graphVersion) return { ok: false, reason: 'graph_invalid' };
  return verified;
}

export type ActivationDeferral = 'conditions_unavailable' | RouteSnapshotRejection | 'avoidance_unresolved';

export type ActivationResult =
  | {
      status: 'activated';
      state: RoutingStoreState;
      pack: LoadedPack;
      avoidance: LocalAvoidanceRecord[];
      /** Marks that could not be mapped onto the new graph (only when nothing was active before). */
      unresolvedAvoidanceIds: string[];
      conditions: StoredConditions | null;
    }
  | { status: 'deferred'; reason: ActivationDeferral; unresolvedAvoidanceIds: string[] }
  | { status: 'rejected'; reason: PackRejection };

export interface ActivationInput {
  storage: RoutingStorage;
  areaId: string;
  state: RoutingStoreState;
  candidate: PackFiles;
  /** The verified active pack; null on first install or when no installed pack is usable. */
  current: LoadedPack | null;
  avoidance: readonly LocalAvoidanceRecord[];
  conditions: StoredConditions | null;
  /** get_routing_conditions_snapshot for the candidate graph; rejects when unavailable. */
  fetchConditions: (graphVersion: string) => Promise<unknown>;
  now: () => Date;
}

/**
 * Stages, verifies and activates a candidate pack. While a pack is active, activation needs
 * mappings for every known verified closure (a snapshot of the candidate graph that the area
 * has activated, with every closure mapped) and every local avoidance mark; otherwise it is
 * deferred and the current pack stays active (plan section 4).
 */
export async function activatePack(input: ActivationInput): Promise<ActivationResult> {
  const { storage, areaId } = input;
  const verified = await verifyPack(input.candidate, text => storage.sha256(text), areaId);
  if (!verified.ok) return { status: 'rejected', reason: verified.reason };
  const candidatePack = verified.pack;
  const graphVersion = candidatePack.graph.version;

  const remap = remapAvoidance(input.avoidance, candidatePack.graph);
  let nextConditions: StoredConditions | null = null;
  if (input.current !== null) {
    if (remap.unresolvedIds.length > 0) return { status: 'deferred', reason: 'avoidance_unresolved', unresolvedAvoidanceIds: remap.unresolvedIds };
    if (input.conditions !== null) {
      let raw: unknown;
      try {
        raw = await input.fetchConditions(graphVersion);
      } catch {
        return { status: 'deferred', reason: 'conditions_unavailable', unresolvedAvoidanceIds: [] };
      }
      const accepted = acceptConditions(null, raw, areaId, graphVersion, input.now());
      if (!accepted.ok) return { status: 'deferred', reason: 'conditions_unavailable', unresolvedAvoidanceIds: [] };
      const snapshot = parseRouteConditionsSnapshot(accepted.stored.snapshot);
      const selection = snapshot === null ? null : selectRouteConditions(snapshot, candidatePack.graph, input.conditions.snapshot.revision);
      if (selection === null) return { status: 'deferred', reason: 'conditions_unavailable', unresolvedAvoidanceIds: [] };
      if (!selection.ok) return { status: 'deferred', reason: selection.reason, unresolvedAvoidanceIds: [] };
      nextConditions = accepted.stored;
    }
  }

  const staging = pointerFor(graphVersion, 'staging');
  const target = pointerFor(graphVersion, 'packs');
  const journaled: RoutingStoreState = { ...input.state, journal: { candidate: target, phase: 'staging' } };
  await writeState(storage, journaled);
  await storage.removeDirectory(staging.dir);
  await storage.writeText(`${staging.dir}/graph.json`, input.candidate.graph);
  await storage.writeText(`${staging.dir}/map.json`, input.candidate.map);
  await storage.writeText(`${staging.dir}/manifest.json`, input.candidate.manifest);
  const changedAvoidance = remap.records.some((record, i) => record !== input.avoidance[i]);
  if (changedAvoidance) await storage.writeText(STORE_FILES.avoidanceNext, serializeAvoidance(remap.records));
  if (nextConditions !== null) await storage.writeText(STORE_FILES.conditionsNext, JSON.stringify(nextConditions));

  // Verify what actually reached storage, not what was meant to be written.
  const staged = await readPackFiles(storage, staging.dir);
  const stagedCheck = staged === null ? null : await verifyPack(staged, text => storage.sha256(text), areaId);
  if (stagedCheck === null || !stagedCheck.ok) {
    await storage.removeDirectory(staging.dir);
    await storage.removeFile(STORE_FILES.avoidanceNext);
    await storage.removeFile(STORE_FILES.conditionsNext);
    await writeState(storage, input.state);
    return { status: 'rejected', reason: stagedCheck?.ok === false ? stagedCheck.reason : 'missing' };
  }

  await writeState(storage, { ...input.state, journal: { candidate: target, phase: 'staged' } });
  if (target.dir !== input.state.active?.dir && target.dir !== input.state.previous?.dir) await storage.removeDirectory(target.dir);
  await storage.moveDirectory(staging.dir, target.dir);

  const previous = input.state.active !== null && input.state.active.dir !== target.dir ? input.state.active : input.state.previous;
  const committed: RoutingStoreState = { schemaVersion: 1, areaId, active: target, previous, journal: { candidate: target, phase: 'committed' } };
  await writeState(storage, committed);
  await promote(storage, STORE_FILES.avoidanceNext, STORE_FILES.avoidance);
  await promote(storage, STORE_FILES.conditionsNext, STORE_FILES.conditions);
  const done: RoutingStoreState = { ...committed, journal: null };
  await writeState(storage, done);
  await prunePacks(storage, done);

  return {
    status: 'activated',
    state: done,
    pack: stagedCheck.pack,
    avoidance: remap.records,
    unresolvedAvoidanceIds: remap.unresolvedIds,
    conditions: nextConditions ?? input.conditions,
  };
}

// ---------------------------------------------------------------------------------------
// Opening the store on app start
// ---------------------------------------------------------------------------------------

export type PackRepair = 'none' | 'installed' | 'reinstalled' | 'rolled_back';

export interface OpenedStore {
  state: RoutingStoreState;
  /** null only when neither the installed packs nor the bundled pack verify. */
  pack: LoadedPack | null;
  packProblem: PackRejection | null;
  repair: PackRepair;
  avoidance: LocalAvoidanceRecord[];
  /** Marks that do not map onto the active graph; they stay stored and block routing until reviewed. */
  unresolvedAvoidanceIds: string[];
  /** The avoidance file existed but could not be read; it was set aside, not deleted. */
  avoidanceUnreadable: boolean;
  conditions: StoredConditions | null;
}

export interface OpenStoreInput {
  storage: RoutingStorage;
  areaId: string;
  /** The pack shipped in the app bundle: the trusted source for first install and repair. */
  bundled: () => PackFiles;
  now: () => Date;
}

/**
 * Recovers any interrupted activation, then loads the active pack. A corrupt active pack is
 * reinstalled from the bundle when the bundle carries the same graph, otherwise the previous
 * pack is restored; restrictions and avoidance marks are kept either way (plan section 4).
 */
export async function openStore(input: OpenStoreInput): Promise<OpenedStore> {
  const { storage, areaId } = input;
  let state = await recoverStore(storage, areaId);

  let avoidance = parseAvoidance(await storage.readText(STORE_FILES.avoidance));
  let avoidanceUnreadable = false;
  if (avoidance === null) {
    await storage.moveFile(STORE_FILES.avoidance, `avoidance.unreadable-${input.now().getTime()}.json`);
    avoidance = [];
    avoidanceUnreadable = true;
  }
  const conditions = parseStoredConditions(await storage.readText(STORE_FILES.conditions));

  let pack: LoadedPack | null = null;
  let packProblem: PackRejection | null = null;
  let repair: PackRepair = 'none';
  let unresolvedAvoidanceIds: string[] = [];

  if (state.active !== null) {
    const loaded = await loadPackAt(storage, state.active, areaId);
    if (loaded.ok) pack = loaded.pack;
    else packProblem = loaded.reason;
  }

  if (pack === null) {
    const bundled = input.bundled();
    const bundledVersion = parsePackManifest(bundled.manifest)?.graphVersion ?? null;
    const previous = state.previous;
    if (state.active !== null && bundledVersion !== state.active.graphVersion && previous !== null) {
      const restored = await loadPackAt(storage, previous, areaId);
      if (restored.ok) {
        state = { schemaVersion: 1, areaId, active: previous, previous: null, journal: null };
        await writeState(storage, state);
        await prunePacks(storage, state);
        pack = restored.pack;
        packProblem = null;
        repair = 'rolled_back';
      }
    }
    if (pack === null) {
      const installed = await activatePack({
        storage,
        areaId,
        state,
        candidate: bundled,
        current: null,
        avoidance,
        conditions,
        fetchConditions: () => Promise.reject(new Error('not needed without an active pack')),
        now: input.now,
      });
      if (installed.status === 'activated') {
        repair = state.active === null ? 'installed' : 'reinstalled';
        state = installed.state;
        pack = installed.pack;
        avoidance = installed.avoidance;
        packProblem = null;
      } else if (installed.status === 'rejected') {
        packProblem = installed.reason;
      }
    }
  }

  if (pack !== null) {
    const remap = remapAvoidance(avoidance, pack.graph);
    const before = avoidance;
    if (remap.records.some((record, i) => record !== before[i])) await storage.writeText(STORE_FILES.avoidance, serializeAvoidance(remap.records));
    avoidance = remap.records;
    unresolvedAvoidanceIds = remap.unresolvedIds;
  }

  return { state, pack, packProblem, repair, avoidance, unresolvedAvoidanceIds, avoidanceUnreadable, conditions };
}

// ---------------------------------------------------------------------------------------
// Marking a segment
// ---------------------------------------------------------------------------------------

/** Taps further than this from every segment select nothing. */
export const SEGMENT_PICK_RADIUS_METERS = 25;

/** The segment nearest to a map tap, within SEGMENT_PICK_RADIUS_METERS. */
export function nearestEdge(graph: PreparedRoutingGraph, point: { lat: number; lng: number }): RoutingEdge | null {
  let best: RoutingEdge | null = null;
  let bestDistance = SEGMENT_PICK_RADIUS_METERS;
  for (const edge of graph.edges) {
    const distance = distanceToPolylineMeters(point, edge.geometry);
    if (distance <= bestDistance) {
      best = edge;
      bestDistance = distance;
    }
  }
  return best;
}

export type AddAvoidanceResult =
  | { ok: true; records: LocalAvoidanceRecord[] }
  | { ok: false; reason: 'unknown_segment' | 'already_marked' | 'limit_reached' };

export function addAvoidance(
  records: readonly LocalAvoidanceRecord[],
  graph: PreparedRoutingGraph,
  edgeId: string,
  id: string,
  now: Date,
): AddAvoidanceResult {
  const index = graph.edgeIndex.get(edgeId);
  if (index === undefined) return { ok: false, reason: 'unknown_segment' };
  if (avoidedEdgeIds(records).includes(edgeId)) return { ok: false, reason: 'already_marked' };
  if (avoidedEdgeIds(records).length >= MAX_AVOIDED_SEGMENTS) return { ok: false, reason: 'limit_reached' };
  const edge = graph.edges[index];
  const record: LocalAvoidanceRecord = {
    id,
    areaId: ROUTING_AREA_ID,
    graphVersion: graph.version,
    edges: [edge],
    name: edge.name,
    createdAt: now.toISOString(),
  };
  return { ok: true, records: [...records, record] };
}
