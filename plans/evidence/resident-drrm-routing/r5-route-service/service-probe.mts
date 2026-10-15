/**
 * R5 service probe: drives the real `evacuation-route` function in supabase-edge-runtime
 * against a disposable seeded database, and prints one JSON report.
 *
 * Setup (see README): database `r5_seed` (schema-only clone + 0110–0114 + seed.sql, graph
 * activated, entrances set), PostgREST container `r5_rest`, the /rest/v1 proxy on :54392 and
 * the edge-runtime container settings in R5_EDGE_ENV (the CLI's main service and limits).
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON plans/evidence/resident-drrm-routing/r5-route-service/service-probe.mts
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import {
  ROUTING_PROFILES,
  planEvacuationRoute,
  prepareRoutingGraph,
  type RoutingGraph,
} from '../../../../packages/shared/src/lib/evacuation-routing.ts';
import { parseRouteConditionsSnapshot, selectRouteConditions } from '../../../../packages/shared/src/lib/evacuation-route-service.ts';

const SERVICE = 'http://127.0.0.1:54393/evacuation-route';
const ENV_FILE = process.env.R5_EDGE_ENV;
const MAIN = process.env.R5_EDGE_MAIN;
if (!ENV_FILE || !MAIN) throw new Error('Set R5_EDGE_ENV and R5_EDGE_MAIN');
const ADMIN = 'b5000000-0000-0000-0000-00000000000a';
const env = { ...process.env, MSYS_NO_PATHCONV: '1' };

const graphJson: RoutingGraph = JSON.parse(readFileSync(new URL('../../../../data/routing-packs/ampid-1/pack/graph.json', import.meta.url), 'utf8'));
const prepared = prepareRoutingGraph(graphJson);
if (!prepared.ok) throw new Error('graph invalid');
const graph = prepared.graph;

function docker(...args: string[]): string {
  return execFileSync('docker', args, { env, encoding: 'utf8' });
}

function sql(query: string, asAdmin = false): string {
  const statement = asAdmin
    ? `begin; set local role authenticated; set local request.jwt.claim.sub = '${ADMIN}'; ${query}; commit;`
    : query;
  return docker('exec', 'supabase_db_barangayan', 'psql', '-U', 'postgres', '-d', 'r5_seed', '-v', 'ON_ERROR_STOP=1', '-Atqc', statement).trim();
}

async function startEdge(): Promise<void> {
  try {
    docker('rm', '-f', 'r5_edge');
  } catch {
    // not running
  }
  docker('run', '-d', '--name', 'r5_edge', '--env-file', ENV_FILE as string, '-p', '54393:8081', '-w', '/Users/User/barangayan',
    '-v', 'C:/Users/User/barangayan:/Users/User/barangayan:ro', '-v', `${MAIN}:/root/index.ts:ro`, '--entrypoint', 'sh',
    'public.ecr.aws/supabase/edge-runtime:v1.76.2', '-c', 'exec edge-runtime start --main-service=/root --port=8081 --policy=per_worker');
  // Readiness through an unknown function name: the main service answers it without starting
  // the evacuation-route worker, so the first POST below pays the function's cold start.
  for (let i = 0; i < 240; i++) {
    try {
      const ready = await fetch('http://127.0.0.1:54393/r5-not-a-function');
      await ready.body?.cancel();
      return;
    } catch {
      // runtime still starting
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('edge runtime did not start');
}

interface Reply {
  status: number;
  ms: number;
  body: Record<string, unknown>;
  headers: Headers;
}

async function post(body: unknown, headers: Record<string, string> = {}, signal?: AbortSignal): Promise<Reply> {
  const started = performance.now();
  const response = await fetch(SERVICE, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    signal,
  });
  const json = (await response.json()) as Record<string, unknown>;
  return { status: response.status, ms: performance.now() - started, body: json, headers: response.headers };
}

function route(reply: Reply): Record<string, unknown> {
  return reply.body.route as Record<string, unknown>;
}

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] * 10) / 10;
};

const ORIGIN = { lat: 14.6773, lng: 121.1154, accuracyMeters: 8, revision: 1 };
const origins = Array.from({ length: 25 }, (_, i) => ({ lat: 14.6755 + (i % 5) * 0.0018, lng: 121.1125 + Math.floor(i / 5) * 0.0028, accuracyMeters: 10, revision: i }));
const report: Record<string, unknown> = {};
// Distinct client addresses per scenario keep the per-address limit out of unrelated checks.
let addressCounter = 1;
const nextAddress = () => `198.51.100.${addressCounter++}`;

// --- A. Cold and warm latency (5 fresh runtimes) ----------------------------------------
const cold: number[] = [];
const warm: number[] = [];
for (let run = 0; run < 5; run++) {
  await startEdge();
  const address = nextAddress();
  const first = await post({ origin: ORIGIN }, { 'x-forwarded-for': address });
  if (first.status !== 200) throw new Error(`cold request ${first.status}`);
  cold.push(first.ms);
  for (const origin of origins) warm.push((await post({ origin }, { 'x-forwarded-for': address })).ms);
}
report.latencyMs = { coldFirstRequest: cold.map(ms => Math.round(ms)), warm: { requests: warm.length, p50: percentile(warm, 50), p95: percentile(warm, 95), max: percentile(warm, 100) } };

// --- B. Route correctness: the Deno service equals the Node core on the same snapshot -------
const snapshot = parseRouteConditionsSnapshot(JSON.parse(sql(`select public.get_routing_conditions_snapshot('ampid-1', '${graph.version}')::text`)));
if (snapshot === null) throw new Error('snapshot invalid');
const selection = selectRouteConditions(snapshot, graph, null);
if (!selection.ok) throw new Error(selection.reason);
let agreements = 0;
const agreementAddress = nextAddress();
for (const origin of origins) {
  const served = route(await post({ origin }, { 'x-forwarded-for': agreementAddress }));
  const local = planEvacuationRoute({ graph, conditions: selection.conditions, centers: selection.centers, request: { origin, originEdgeId: null, centerId: null, avoidEdgeIds: [] }, profile: ROUTING_PROFILES['ampid-fine'] });
  if (JSON.stringify(served) !== JSON.stringify(local)) throw new Error(`route differs for origin ${origin.revision}`);
  agreements++;
}
report.nodeDenoAgreement = { origins: agreements, identical: true };

// --- C. Parallel requests --------------------------------------------------------------------
const parallelAddress = nextAddress();
const sequential = new Map<number, string>();
for (const origin of origins) sequential.set(origin.revision, JSON.stringify(route(await post({ origin }, { 'x-forwarded-for': parallelAddress }))));
const started = performance.now();
const parallel = await Promise.all([...origins, ...origins].map(origin => post({ origin }, { 'x-forwarded-for': parallelAddress })));
report.parallel = {
  requests: parallel.length,
  allOk: parallel.every(reply => reply.status === 200),
  sameAsSequential: parallel.every((reply, i) => JSON.stringify(route(reply)) === sequential.get(origins[i % origins.length].revision)),
  wallMs: Math.round(performance.now() - started),
  p95Ms: percentile(parallel.map(reply => reply.ms), 95),
};

// --- D. Oversized and invalid input ------------------------------------------------------------
const badAddress = nextAddress();
const tooMany = Array.from({ length: 201 }, (_, i) => `w${i}:a-b`);
const get = await fetch(`${SERVICE}?lat=${ORIGIN.lat}`);
report.invalidInput = {
  oversizedBody: (await post(JSON.stringify({ origin: ORIGIN, padding: 'x'.repeat(20_000) }), { 'x-forwarded-for': badAddress })).status,
  tooManyAvoided: (await post({ origin: ORIGIN, graphVersion: graph.version, avoidEdgeIds: tooMany }, { 'x-forwarded-for': badAddress })).status,
  malformedJson: (await post('{"origin":', { 'x-forwarded-for': badAddress })).status,
  getWithQuery: get.status,
  otherGraphVersion: (await post({ origin: ORIGIN, graphVersion: 'ampid-1@2026-01-01#000000000000', avoidEdgeIds: ['w1:a-b'] }, { 'x-forwarded-for': badAddress })).status,
};
await get.body?.cancel();

// --- E/F. Snapshot freshness: outdated snapshots, closures, availability ------------------------
const flowAddress = nextAddress();
const base = await post({ origin: ORIGIN }, { 'x-forwarded-for': flowAddress });
const baseRoute = route(base) as { status: string; best: { edgeIds: string[]; centerId: string }; provenance: { conditionsRevision: number } };
const revision0 = baseRoute.provenance.conditionsRevision;
const outdated = await post({ origin: ORIGIN, minConditionsRevision: revision0 + 1 }, { 'x-forwarded-for': flowAddress });

const closedId = baseRoute.best.edgeIds[3];
const closedEdge = graph.edges[graph.edgeIndex.get(closedId) as number];
const geometry = JSON.stringify({ type: 'MultiLineString', coordinates: [closedEdge.geometry] });
const closure = JSON.parse(sql(`select public.publish_road_closure('ampid-1', '${graph.version}', array['${closedId}'], array['${closedEdge.sourceRef}'], '${geometry}'::jsonb, 'R5 probe', 'Probe closure', now())::text`, true).split('\n').find(line => line.startsWith('{')) as string) as { id: string; revision: number };
const afterClosure = route(await post({ origin: ORIGIN, minConditionsRevision: closure.revision }, { 'x-forwarded-for': flowAddress })) as typeof baseRoute;
sql(`select public.reopen_road_closure('${closure.id}', 'Probe reopened')`, true);
const afterReopen = route(await post({ origin: ORIGIN }, { 'x-forwarded-for': flowAddress })) as typeof baseRoute;
sql(`update public.evacuation_centers set availability = 'unavailable' where id = '${baseRoute.best.centerId}'`, true);
const unavailable = route(await post({ origin: ORIGIN }, { 'x-forwarded-for': flowAddress })) as typeof baseRoute & { centerTier: string; warnings: unknown[] };
sql(`update public.evacuation_centers set availability = 'available' where id = '${baseRoute.best.centerId}'`, true);
report.snapshotFreshness = {
  outdatedSnapshot: { status: outdated.status, error: outdated.body.error },
  closure: {
    publishedRevision: closure.revision,
    servedRevision: afterClosure.provenance.conditionsRevision,
    closedEdgeAvoided: !afterClosure.best.edgeIds.includes(closedId),
  },
  reopen: { sameAsBefore: JSON.stringify(afterReopen.best.edgeIds) === JSON.stringify(baseRoute.best.edgeIds) },
  centerUnavailable: { status: unavailable.status, newCenter: unavailable.best?.centerId !== baseRoute.best.centerId, tier: unavailable.centerTier, warnings: unavailable.warnings },
};

// --- G. Graph not active (another graph version activated by an administrator) --------------------
const otherVersion = 'ampid-1@2026-10-14#0123456789ab';
sql(`select public.register_routing_graph_version('ampid-1', '${otherVersion}', false)`, true);
for (const line of sql(`select id || '|' || n.node_id from public.evacuation_centers c join public.evacuation_center_entrance_nodes n on n.center_id = c.id and n.graph_version = '${graph.version}'`).split('\n')) {
  const [centerId, nodeId] = line.split('|');
  sql(`select public.map_evacuation_center_entrance('${centerId}', '${otherVersion}', '${nodeId}')`, true);
}
sql(`select public.register_routing_graph_version('ampid-1', '${otherVersion}', true)`, true);
const inactive = await post({ origin: ORIGIN }, { 'x-forwarded-for': flowAddress });
sql(`select public.register_routing_graph_version('ampid-1', '${graph.version}', true)`, true);
const reactivated = await post({ origin: ORIGIN }, { 'x-forwarded-for': flowAddress });
report.graphNotActive = { status: inactive.status, error: inactive.body.error, afterReactivation: reactivated.status };

// --- H. Per-address rate limit (300 per minute) -------------------------------------------------
while (new Date().getSeconds() > 35) await new Promise(resolve => setTimeout(resolve, 500));
const limited = nextAddress();
const statuses: number[] = [];
const retryAfter = new Set<string>();
for (let batch = 0; batch < 305; batch += 25) {
  const replies = await Promise.all(Array.from({ length: Math.min(25, 305 - batch) }, () => post({ origin: ORIGIN }, { 'x-forwarded-for': limited })));
  for (const reply of replies) {
    statuses.push(reply.status);
    if (reply.status === 429) retryAfter.add(reply.headers.get('retry-after') ?? 'missing');
  }
}
const otherClient = await post({ origin: ORIGIN }, { 'x-forwarded-for': nextAddress() });
const hashes = sql('select client_hash from barangayan_private.routing_rate_limits').split('\n');
report.rateLimit = {
  sent: statuses.length,
  ok: statuses.filter(s => s === 200).length,
  limited: statuses.filter(s => s === 429).length,
  retryAfterValues: [...retryAfter],
  otherAddressStatus: otherClient.status,
  storedRows: hashes.length,
  allStoredKeysAreHex64: hashes.every(h => /^[0-9a-f]{64}$/.test(h)),
};

// --- I. Client cancellation ---------------------------------------------------------------------
const cancelAddress = nextAddress();
let aborted = 0;
await Promise.all(Array.from({ length: 10 }, async (_, i) => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 2 + i);
  try {
    await post({ origin: origins[i] }, { 'x-forwarded-for': cancelAddress }, controller.signal);
  } catch {
    aborted++;
  }
}));
const afterCancel = await post({ origin: ORIGIN }, { 'x-forwarded-for': cancelAddress });
report.cancellation = { abortedByClient: aborted, nextRequestStatus: afterCancel.status };

// --- J. Logs: no coordinates, only fixed event names ---------------------------------------------
const logRun = spawnSync('docker', ['logs', 'r5_edge'], { env, encoding: 'utf8' });
const logs = `${logRun.stdout}\n${logRun.stderr}`;
const coordinatePattern = /14\.6\d{2,}|121\.1\d{2,}/;
report.logs = {
  lines: logs.split('\n').filter(Boolean).length,
  coordinateLike: logs.split('\n').filter(line => coordinatePattern.test(line)),
  errorEvents: [...new Set(logs.split('\n').filter(line => line.includes('evacuation-route:')).map(line => line.trim()))],
};

console.log(JSON.stringify(report, null, 2));
