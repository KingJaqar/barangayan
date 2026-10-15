import type { FloodGrid, RoutingEdge } from '../../../packages/shared/src/lib/evacuation-routing.ts';
import {
  buildSensorSnapshot,
  mergeSensorHistory,
  parseSensorFeed,
  parseSensorStationSet,
  parseTerrainMetadata,
  runFloodShadow,
  type SensorFeed,
  type SensorHistoryPoint,
  type ShadowSourceStatus,
} from '../../../packages/shared/src/lib/flood-shadow.ts';
import { loadRoutingPack } from '../evacuation-route/handler.ts';

/**
 * BFS shadow run (DRRM weather-routing plan, phase R8): reads the sensor feed, validates it
 * (RRL §7.4), runs the shadow model on the bundled Ampid I grid and stores the report. The
 * result is advisory only; nothing it produces reaches a resident's route.
 */
export interface ShadowPack {
  areaId: string;
  graphVersion: string;
  edges: readonly RoutingEdge[];
  grid: FloodGrid;
  gridSha256: string;
  /** Stations the pack's station-to-edge table was built with. */
  packStationIds: string[];
}

export class ShadowPackError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const GRID_PATH = 'server/grid-ampid-fine.json';

/**
 * Verifies the bundled pack once per worker: the graph through the route service's loader,
 * and the grid against the manifest's byte count and SHA-256.
 */
export async function loadShadowPack(
  graph: unknown,
  grid: unknown,
  manifest: unknown,
  sha256Hex: (text: string) => Promise<string>,
): Promise<ShadowPack> {
  const routing = await loadRoutingPack(graph, manifest, sha256Hex);
  const resources = isRecord(manifest) && Array.isArray(manifest.resources) ? (manifest.resources as unknown[]) : [];
  const entry = resources.find(resource => isRecord(resource) && resource.path === GRID_PATH);
  if (!isRecord(entry) || typeof entry.sha256 !== 'string' || typeof entry.bytes !== 'number') throw new ShadowPackError('manifest_invalid');
  const text = JSON.stringify(grid);
  if (new TextEncoder().encode(text).byteLength !== entry.bytes || (await sha256Hex(text)) !== entry.sha256) {
    throw new ShadowPackError('grid_hash_mismatch');
  }
  if (!isRecord(grid) || !Array.isArray(grid.elevations)) throw new ShadowPackError('grid_invalid');
  return {
    areaId: routing.areaId,
    graphVersion: routing.graph.version,
    edges: routing.graph.edges,
    grid: grid as unknown as FloodGrid,
    gridSha256: entry.sha256,
    packStationIds: [...routing.graph.stationEdges.keys()].sort(),
  };
}

export const FEED_LIMITS = Object.freeze({ maxBytes: 262_144, timeoutMs: 5000 });

/**
 * Fetches the reviewed sensor feed (an HTTPS URL the owner configured) as JSON, bounded in
 * time and size. Throws on any failure; the caller reports the source as failed.
 */
export async function fetchFeedJson(url: string, fetchImpl: typeof fetch, signal: AbortSignal): Promise<unknown> {
  if (!url.startsWith('https://')) throw new Error('feed_url_not_https');
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(FEED_LIMITS.timeoutMs)]),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`feed_status_${response.status}`);
  }
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > FEED_LIMITS.maxBytes) {
    await response.body?.cancel();
    throw new Error('feed_too_large');
  }
  if (response.body === null) throw new Error('feed_empty');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > FEED_LIMITS.maxBytes) {
      await reader.cancel();
      throw new Error('feed_too_large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export interface FloodShadowDependencies {
  pack: () => Promise<ShadowPack>;
  /** Parsed station-set JSON bundled with the function (verification = null until reviewed). */
  stationSet: unknown;
  /** Parsed terrain metadata JSON bundled with the function (terrain = null until licensed). */
  terrain: unknown;
  /** The feed JSON, or null when no source is configured. Throws when the source fails. */
  fetchFeed: (signal: AbortSignal) => Promise<unknown | null>;
  /** `get_flood_shadow_history`: raw readings of the newest runs, newest first. */
  history: (areaId: string, signal: AbortSignal) => Promise<unknown>;
  /** `publish_flood_shadow_run`. */
  publish: (args: PublishArguments, signal: AbortSignal) => Promise<unknown>;
  /** Only the scheduler may run this function. */
  authorized: (request: Request) => boolean;
  now: () => number;
  /** Operational failures only, as fixed event names; never readings or payloads. */
  reportError: (event: string) => void;
}

export interface PublishArguments {
  p_area_id: string;
  p_graph_version: string;
  p_snapshot_id: string;
  p_evaluated_at: string;
  p_model_status: string;
  p_report: unknown;
}

export type ShadowRunStatus = 'published' | 'duplicate' | 'rejected';

export interface ShadowRunResponse {
  status: ShadowRunStatus;
  reason?: string;
  modelStatus: string;
  sourceStatus: ShadowSourceStatus;
  snapshotId: string;
  reportHash: string;
}

type ShadowErrorCode = 'method_not_allowed' | 'unauthorized' | 'pack_unavailable' | 'inputs_invalid' | 'history_unavailable' | 'publish_failed';

const ERRORS: Record<ShadowErrorCode, number> = {
  method_not_allowed: 405,
  unauthorized: 401,
  pack_unavailable: 503,
  inputs_invalid: 503,
  history_unavailable: 503,
  publish_failed: 503,
};

function reply(status: number, body: ShadowRunResponse | { error: ShadowErrorCode }): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

function fail(code: ShadowErrorCode): Response {
  return reply(ERRORS[code], { error: code });
}

/** `get_flood_shadow_history` returns an array (newest run first) of reading arrays. */
export function parseShadowHistory(value: unknown): SensorHistoryPoint[] | null {
  if (!Array.isArray(value)) return null;
  const points: SensorHistoryPoint[] = [];
  for (const run of value) {
    if (run === null) continue;
    if (!Array.isArray(run)) return null;
    for (const item of run) {
      if (!isRecord(item) || typeof item.stationId !== 'string' || typeof item.observedAt !== 'number' || typeof item.levelMeters !== 'number') return null;
      if (!Number.isFinite(item.observedAt) || !Number.isFinite(item.levelMeters)) return null;
      points.push({ stationId: item.stationId, observedAt: item.observedAt, levelMeters: item.levelMeters });
    }
  }
  return points;
}

export function floodShadowHandler(deps: FloodShadowDependencies): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return fail('method_not_allowed');
    if (!deps.authorized(req)) return fail('unauthorized');

    let pack: ShadowPack;
    try {
      pack = await deps.pack();
    } catch {
      deps.reportError('pack_unavailable');
      return fail('pack_unavailable');
    }
    const stationSet = parseSensorStationSet(deps.stationSet);
    const terrain = parseTerrainMetadata(deps.terrain);
    if (!stationSet.ok || !terrain.ok) {
      deps.reportError('inputs_invalid');
      return fail('inputs_invalid');
    }

    let history: SensorHistoryPoint[] | null;
    try {
      history = parseShadowHistory(await deps.history(pack.areaId, req.signal));
    } catch {
      history = null;
    }
    if (history === null) {
      // The temporal and outlier checks cannot run: do not judge readings without them.
      deps.reportError('history_unavailable');
      return fail('history_unavailable');
    }

    let feed: SensorFeed | null = null;
    let sourceStatus: ShadowSourceStatus = 'unconfigured';
    try {
      const raw = await deps.fetchFeed(req.signal);
      if (raw !== null) {
        const parsed = parseSensorFeed(raw);
        if (parsed.ok) {
          feed = parsed.value;
          sourceStatus = 'ok';
        } else {
          sourceStatus = 'invalid';
          deps.reportError('feed_invalid');
        }
      }
    } catch {
      sourceStatus = 'failed';
      deps.reportError('feed_failed');
    }

    const now = deps.now();
    const snapshot = buildSensorSnapshot(stationSet.value, feed, mergeSensorHistory(history, feed), now);
    const report = runFloodShadow({
      areaId: pack.areaId,
      graphVersion: pack.graphVersion,
      edges: pack.edges,
      grid: pack.grid,
      gridSha256: pack.gridSha256,
      packStationIds: pack.packStationIds,
      stationSet: stationSet.value,
      terrain: terrain.value,
      snapshot,
      sourceStatus,
    });

    let outcome: unknown;
    try {
      outcome = await deps.publish(
        {
          p_area_id: report.areaId,
          p_graph_version: report.graphVersion,
          p_snapshot_id: report.snapshotId,
          p_evaluated_at: new Date(report.evaluatedAt).toISOString(),
          p_model_status: report.modelStatus,
          p_report: report,
        },
        req.signal,
      );
    } catch {
      deps.reportError('publish_failed');
      return fail('publish_failed');
    }
    const status = isRecord(outcome) ? outcome.status : undefined;
    if (status !== 'published' && status !== 'duplicate' && status !== 'rejected') {
      deps.reportError('publish_failed');
      return fail('publish_failed');
    }
    const reason = isRecord(outcome) && typeof outcome.reason === 'string' ? outcome.reason : undefined;
    return reply(200, {
      status,
      ...(reason === undefined ? {} : { reason }),
      modelStatus: report.modelStatus,
      sourceStatus,
      snapshotId: report.snapshotId,
      reportHash: report.reportHash,
    });
  };
}
