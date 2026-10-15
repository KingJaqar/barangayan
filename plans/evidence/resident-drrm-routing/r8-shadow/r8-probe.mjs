// NOTE: scratch-path script kept as evidence; adjust SCRATCH/paths to rerun.
// R8 real-runtime probe: runs the flood-shadow function in supabase-edge-runtime 1.76.2
// against the disposable database r8_disposable (through PostgREST) and compares the stored
// report with the same flow run in Node. Scratch-only; nothing here is committed.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';

const REPO = 'C:/Users/User/barangayan';
const S = process.env.SCRATCH;
const env = { ...process.env, MSYS_NO_PATHCONV: '1' };
const keys = Object.fromEntries(readFileSync(path.join(S, 'keys.env'), 'utf8').split('\n').filter(Boolean).map(l => {
  const i = l.indexOf('=');
  return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
}));
const docker = (...a) => execFileSync('docker', a, { env, encoding: 'utf8' });
const psql = q => docker('exec', 'supabase_db_barangayan', 'psql', '-U', 'postgres', '-d', 'r8_disposable', '-Atqc', q).trim();
const sha = t => createHash('sha256').update(t).digest('hex');

// ---- scratch copy of the code under test with eligible inputs -------------------------
const R = path.join(S, 'repo');
rmSync(R, { recursive: true, force: true });
for (const rel of [
  'supabase/functions/flood-shadow/handler.ts',
  'supabase/functions/flood-shadow/index.ts',
  'supabase/functions/evacuation-route/handler.ts',
  'packages/shared/src/lib/evacuation-routing.ts',
  'packages/shared/src/lib/flood-shadow.ts',
  'packages/shared/src/lib/evacuation-route-service.ts',
]) {
  mkdirSync(path.dirname(path.join(R, rel)), { recursive: true });
  cpSync(path.join(REPO, rel), path.join(R, rel));
}
const R0 = path.join(S, 'repo-real');
rmSync(R0, { recursive: true, force: true });
for (const rel of [
  'supabase/functions/flood-shadow/handler.ts', 'supabase/functions/flood-shadow/index.ts', 'supabase/functions/evacuation-route/handler.ts',
  'packages/shared/src/lib/evacuation-routing.ts', 'packages/shared/src/lib/flood-shadow.ts', 'packages/shared/src/lib/evacuation-route-service.ts',
  'data/routing-packs/ampid-1/pack/graph.json', 'data/routing-packs/ampid-1/pack/manifest.json', 'data/routing-packs/ampid-1/pack/server/grid-ampid-fine.json',
  'data/routing-packs/ampid-1/source/sensor-stations.json', 'data/routing-packs/ampid-1/source/terrain.json',
]) {
  mkdirSync(path.dirname(path.join(R0, rel)), { recursive: true });
  cpSync(path.join(REPO, rel), path.join(R0, rel));
}
const packRel = 'data/routing-packs/ampid-1/pack';
mkdirSync(path.join(R, packRel, 'server'), { recursive: true });
mkdirSync(path.join(R, 'data/routing-packs/ampid-1/source'), { recursive: true });

const { stationApplicableEdgeIds, ROUTING_PROFILES } = await import(`file:///${REPO}/packages/shared/src/lib/evacuation-routing.ts`);
const graph = JSON.parse(readFileSync(`${REPO}/${packRel}/graph.json`, 'utf8'));
const grid = JSON.parse(readFileSync(`${REPO}/${packRel}/server/grid-ampid-fine.json`, 'utf8'));
const manifest = JSON.parse(readFileSync(`${REPO}/${packRel}/manifest.json`, 'utf8'));

const stations = [
  { stationId: 's1', name: 'S1', lat: 14.676, lng: 121.114, alertMeters: 18, alarmMeters: 19, criticalMeters: 20, baselineMeters: 17, datum: 'TEST-MSL', intervalSeconds: 600 },
  { stationId: 's2', name: 'S2', lat: 14.679, lng: 121.117, alertMeters: 18, alarmMeters: 19, criticalMeters: 20, baselineMeters: 17, datum: 'TEST-MSL', intervalSeconds: 600 },
  { stationId: 's3', name: 'S3 far', lat: 14.7, lng: 121.15, alertMeters: 18, alarmMeters: 19, criticalMeters: 20, baselineMeters: 17, datum: 'TEST-MSL', intervalSeconds: 600 },
];
graph.stationEdges = stations.map(s => ({ stationId: s.stationId, edgeIds: stationApplicableEdgeIds(graph.edges, s, ROUTING_PROFILES['ampid-fine']) }));
grid.elevations = grid.elevations.map((_, i) => {
  const col = i % grid.cols;
  return col >= 40 ? null : Math.round((19 + 0.1 * col) * 100) / 100;
});
const graphText = JSON.stringify(graph);
const gridText = JSON.stringify(grid);
const m = JSON.parse(JSON.stringify(manifest));
m.stations = 'verified';
for (const r of m.resources) {
  if (r.path === 'graph.json') [r.bytes, r.sha256] = [Buffer.byteLength(graphText), sha(graphText)];
  if (r.path === 'server/grid-ampid-fine.json') [r.bytes, r.sha256] = [Buffer.byteLength(gridText), sha(gridText)];
}
writeFileSync(path.join(R, packRel, 'graph.json'), graphText);
writeFileSync(path.join(R, packRel, 'server/grid-ampid-fine.json'), gridText);
writeFileSync(path.join(R, packRel, 'manifest.json'), JSON.stringify(m));
writeFileSync(path.join(R, 'data/routing-packs/ampid-1/source/sensor-stations.json'),
  JSON.stringify({ schemaVersion: 1, verification: { source: 'probe', verifiedOn: '2026-10-14', reviewer: 'probe' }, stations }));
writeFileSync(path.join(R, 'data/routing-packs/ampid-1/source/terrain.json'),
  JSON.stringify({ schemaVersion: 1, terrain: { source: 'probe-dem', licensed: true, verticalDatum: 'TEST-MSL', verticalRmseMeters: 0.2 } }));

// Probe-only patch of the Deno entry: inline feed and fixed clock (the code under test is
// otherwise byte-identical: handler.ts and the shared modules are copied unchanged).
const indexPath = path.join(R, 'supabase/functions/flood-shadow/index.ts');
let index = readFileSync(indexPath, 'utf8');
index = index
  .replace("fetchFeed: signal => (feedUrl === null ? Promise.resolve(null) : fetchFeedJson(feedUrl, fetch, signal)),",
    "fetchFeed: _signal => Promise.resolve(Deno.env.get('PROBE_FEED') ? JSON.parse(Deno.env.get('PROBE_FEED') as string) : null),")
  .replace('now: () => Date.now(),', "now: () => (Deno.env.get('PROBE_NOW') ? Number(Deno.env.get('PROBE_NOW')) : Date.now()),")
  .replace("import { fetchFeedJson, floodShadowHandler,", "import { floodShadowHandler,");
writeFileSync(indexPath, index);

// ---- infrastructure ---------------------------------------------------------------------
const main = `Deno.serve(async (req) => {
  const name = new URL(req.url).pathname.split('/').filter(Boolean)[0];
  if (name !== 'flood-shadow') return new Response('not found', { status: 404 });
  const worker = await EdgeRuntime.userWorkers.create({
    servicePath: process.env.PROBE_REPO ? '' : '/repo/supabase/functions/flood-shadow',
    memoryLimitMb: 256, workerTimeoutMs: 120000, noModuleCache: false, importMapPath: null,
    envVars: Object.entries(Deno.env.toObject()), forceCreate: false, netAccessDisabled: false,
    cpuTimeSoftLimitMs: 1000, cpuTimeHardLimitMs: 2000,
  });
  return await worker.fetch(req);
});`.replace("process.env.PROBE_REPO ? '' : ", '');
mkdirSync(path.join(S, 'main'), { recursive: true });
writeFileSync(path.join(S, 'main/index.ts'), main);

try { docker('rm', '-f', 'r8_rest'); } catch { /* none */ }
docker('run', '-d', '--name', 'r8_rest', '--network', 'supabase_network_barangayan', '-p', '54396:3000',
  '-e', 'PGRST_DB_URI=postgres://authenticator:postgres@supabase_db_barangayan:5432/r8_disposable',
  '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', `PGRST_JWT_SECRET=${keys.JWT_SECRET}`,
  'public.ecr.aws/supabase/postgrest:v14.5');

async function waitFor(url, init) {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(url, init); await r.body?.cancel(); return; } catch { await new Promise(r2 => setTimeout(r2, 500)); }
  }
  throw new Error('not ready: ' + url);
}
await waitFor('http://127.0.0.1:54396/');

async function runEdge(label, envExtra, repoDir, port) {
  try { docker('rm', '-f', 'r8_edge'); } catch { /* none */ }
  const args = ['run', '-d', '--name', 'r8_edge', '-p', `${port}:8081`,
    '-e', 'SUPABASE_URL=http://host.docker.internal:54397', '-e', `SUPABASE_SERVICE_ROLE_KEY=${keys.SERVICE_ROLE_KEY}`,
    ...Object.entries(envExtra).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
    '-v', `${repoDir}:/repo:ro`, '-v', `${path.join(S, 'main')}:/root:ro`, '--entrypoint', 'sh',
    'public.ecr.aws/supabase/edge-runtime:v1.76.2', '-c', 'exec edge-runtime start --main-service=/root --port=8081 --policy=per_worker'];
  docker(...args);
  await waitFor(`http://127.0.0.1:${port}/not-a-function`);
  const started = performance.now();
  const response = await fetch(`http://127.0.0.1:${port}/flood-shadow`, { method: 'POST', headers: { authorization: `Bearer ${keys.SERVICE_ROLE_KEY}` } });
  const body = await response.json();
  return { label, status: response.status, ms: Math.round(performance.now() - started), body };
}

const results = [];
const base = Date.now();
const feedA = { schemaVersion: 1, source: 'probe', readings: [
  { stationId: 's1', levelMeters: 20.5, observedAt: new Date(base - 8 * 60_000).toISOString(), datum: 'TEST-MSL' },
  { stationId: 's2', levelMeters: 19.2, observedAt: new Date(base - 8 * 60_000).toISOString(), datum: 'TEST-MSL' },
] };
const feedB = { schemaVersion: 1, source: 'probe', readings: [
  { stationId: 's1', levelMeters: 20.5, observedAt: new Date(base - 5 * 60_000).toISOString(), datum: 'TEST-MSL' },
  { stationId: 's2', levelMeters: 31, observedAt: new Date(base - 5 * 60_000).toISOString(), datum: 'TEST-MSL' },
] };
const nowA = base - 6 * 60_000;
const nowB = base - 3 * 60_000;

results.push(await runEdge('A: eligible scratch inputs, s1 critical', { PROBE_FEED: JSON.stringify(feedA), PROBE_NOW: String(nowA) }, R, 54398));
results.push(await runEdge('B: s2 reading flagged', { PROBE_FEED: JSON.stringify(feedB), PROBE_NOW: String(nowB) }, R, 54398));
results.push(await runEdge('C: REAL bundled inputs (no stations, no terrain), real clock', {}, R0, 54398));
results.push(await runEdge('D: scenario A again, older than C', { PROBE_FEED: JSON.stringify(feedA), PROBE_NOW: String(nowA) }, R, 54398));
results.push(await runEdge('E: scenario B again (same snapshot)', { PROBE_FEED: JSON.stringify(feedB), PROBE_NOW: String(nowB) }, R, 54398));

const stored = JSON.parse(psql(`select coalesce(jsonb_agg(jsonb_build_object('model', model_status, 'snapshot', snapshot_id, 'hash', report->>'reportHash', 'evaluatedAt', evaluated_at) order by evaluated_at), '[]') from flood_shadow_runs`));
console.log(JSON.stringify({ results, stored }, null, 2));
const reportA = JSON.parse(psql(`select report from flood_shadow_runs where evaluated_at = to_timestamp(${nowA}/1000.0) at time zone 'UTC' limit 1`) || 'null');
writeFileSync(path.join(S, 'stored-report-a.json'), JSON.stringify(reportA));
const reportB = JSON.parse(psql(`select report from flood_shadow_runs order by evaluated_at limit 2 offset 1`.replace('limit 2 offset 1', 'limit 1 offset 1')) || 'null');
writeFileSync(path.join(S, 'stored-report-b.json'), JSON.stringify(reportB));
writeFileSync(path.join(S, 'probe-meta.json'), JSON.stringify({ nowA, nowB, feedA, feedB }));

try { docker('rm', '-f', 'r8_edge'); docker('rm', '-f', 'r8_rest'); } catch { /* ignore */ }
