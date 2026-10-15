import graph from '../../../data/routing-packs/ampid-1/pack/graph.json' with { type: 'json' };
import grid from '../../../data/routing-packs/ampid-1/pack/server/grid-ampid-fine.json' with { type: 'json' };
import manifest from '../../../data/routing-packs/ampid-1/pack/manifest.json' with { type: 'json' };
import stationSet from '../../../data/routing-packs/ampid-1/source/sensor-stations.json' with { type: 'json' };
import terrain from '../../../data/routing-packs/ampid-1/source/terrain.json' with { type: 'json' };
import { fetchFeedJson, floodShadowHandler, loadShadowPack, type ShadowPack } from './handler.ts';

// Scheduled, area-bounded BFS shadow run (plan R8). Invoked by the project's scheduler with
// the service-role key; the report is advisory and never reaches a resident's route.
const UPSTREAM_TIMEOUT_MS = 4000;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const url = requiredEnv('SUPABASE_URL');
const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
// Reviewed sensor feed (HTTPS JSON in the shape parseSensorFeed accepts). Unset = no source.
const feedUrl = Deno.env.get('FLOOD_SENSOR_FEED_URL') ?? null;
const encoder = new TextEncoder();

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison of the presented bearer token with the service-role key. */
function authorized(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const presented = encoder.encode(header.startsWith('Bearer ') ? header.slice(7) : '');
  const expected = encoder.encode(serviceKey);
  let difference = presented.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) difference |= (presented[i] ?? 0) ^ expected[i];
  return difference === 0;
}

async function rpc(name: string, args: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.any([signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`${name} returned ${response.status}`);
  }
  return await response.json();
}

let pack: Promise<ShadowPack> | null = null;

Deno.serve(floodShadowHandler({
  pack: () => (pack ??= loadShadowPack(graph, grid, manifest, sha256Hex)),
  stationSet,
  terrain,
  fetchFeed: signal => (feedUrl === null ? Promise.resolve(null) : fetchFeedJson(feedUrl, fetch, signal)),
  history: (areaId, signal) => rpc('get_flood_shadow_history', { p_area_id: areaId, p_limit: 12 }, signal),
  publish: (args, signal) => rpc('publish_flood_shadow_run', { ...args }, signal),
  authorized,
  now: () => Date.now(),
  reportError: event => console.error(`flood-shadow: ${event}`),
}));
