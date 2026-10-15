import graph from '../../../data/routing-packs/ampid-1/pack/graph.json' with { type: 'json' };
import manifest from '../../../data/routing-packs/ampid-1/pack/manifest.json' with { type: 'json' };
import { evacuationRouteHandler, loadRoutingPack, rolloutFlagState, type RoutingPack } from './handler.ts';

// Public emergency routing (plan R5): no sign-in required (invariant 9). Deployed with
// verify_jwt = false (config.toml) and limited per hashed client address instead.
const ROUTE_REQUESTS_PER_MINUTE = 300;
const UPSTREAM_TIMEOUT_MS = 4000;
const COMPUTE_DEADLINE_MS = 1000;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const url = requiredEnv('SUPABASE_URL');
const anonKey = requiredEnv('SUPABASE_ANON_KEY');
const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const encoder = new TextEncoder();

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

// Client addresses are stored only as keyed hashes; the key never reaches the database.
let addressKey: Promise<CryptoKey> | null = null;
async function addressHash(address: string): Promise<string> {
  addressKey ??= crypto.subtle.importKey('raw', encoder.encode(serviceKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', await addressKey, encoder.encode(address)));
}

async function rpc(name: string, args: Record<string, unknown>, key: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.any([signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`${name} returned ${response.status}`);
  }
  return await response.json();
}

// Rollout switch: the function secret EVACUATION_ROUTE_ENABLED (see rolloutFlagState). Read on
// every request, because Supabase applies a changed secret without a redeploy.
let flagReported = false;
function routeServiceEnabled(): boolean {
  const state = rolloutFlagState(Deno.env.get('EVACUATION_ROUTE_ENABLED'));
  if (!state.valid && !flagReported) {
    flagReported = true;
    console.error('evacuation-route: rollout_flag_invalid');
  }
  return state.enabled;
}

let pack: Promise<RoutingPack> | null = null;

Deno.serve(evacuationRouteHandler({
  enabled: routeServiceEnabled,
  pack: () => (pack ??= loadRoutingPack(graph, manifest, sha256Hex)),
  conditions: (areaId, graphVersion, signal) =>
    rpc('get_routing_conditions_snapshot', { p_area_id: areaId, p_graph_version: graphVersion }, anonKey, signal),
  rateLimit: async (address, signal) => {
    const retryAfterSeconds = await rpc(
      'consume_routing_rate_limit',
      { p_client_hash: await addressHash(address), p_limit: ROUTE_REQUESTS_PER_MINUTE },
      serviceKey,
      signal,
    );
    if (typeof retryAfterSeconds !== 'number' || !Number.isInteger(retryAfterSeconds) || retryAfterSeconds < 0) {
      throw new Error('consume_routing_rate_limit returned an invalid result');
    }
    return retryAfterSeconds;
  },
  reportError: event => console.error(`evacuation-route: ${event}`),
  computeDeadlineMs: COMPUTE_DEADLINE_MS,
  yieldControl: () => new Promise(resolve => setTimeout(resolve, 0)),
}));
