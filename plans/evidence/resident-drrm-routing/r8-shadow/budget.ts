import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadShadowPack } from 'file:///C:/Users/User/AppData/Local/Temp/claude/C--Users-User-barangayan/8bfb9a91-a725-4394-828b-e39d35d15694/scratchpad/repo/supabase/functions/flood-shadow/handler.ts';
import { ROUTING_PROFILES, runFloodBfs } from 'file:///C:/Users/User/AppData/Local/Temp/claude/C--Users-User-barangayan/8bfb9a91-a725-4394-828b-e39d35d15694/scratchpad/repo/packages/shared/src/lib/evacuation-routing.ts';
import { assessFloodGridEligibility, buildSensorSnapshot, compileRoadFlooding, parseSensorStationSet, parseTerrainMetadata, runFloodShadow, mergeSensorHistory } from 'file:///C:/Users/User/AppData/Local/Temp/claude/C--Users-User-barangayan/8bfb9a91-a725-4394-828b-e39d35d15694/scratchpad/repo/packages/shared/src/lib/flood-shadow.ts';
const R = 'C:/Users/User/AppData/Local/Temp/claude/C--Users-User-barangayan/8bfb9a91-a725-4394-828b-e39d35d15694/scratchpad/repo/';
const read = (p: string): unknown => JSON.parse(readFileSync(R + p, 'utf8'));
const sha = async (t: string) => createHash('sha256').update(t).digest('hex');
const t0 = performance.now();
const pack = await loadShadowPack(read('data/routing-packs/ampid-1/pack/graph.json'), read('data/routing-packs/ampid-1/pack/server/grid-ampid-fine.json'), read('data/routing-packs/ampid-1/pack/manifest.json'), sha);
const packLoadMs = performance.now() - t0;
const set = parseSensorStationSet(read('data/routing-packs/ampid-1/source/sensor-stations.json'));
const terrain = parseTerrainMetadata(read('data/routing-packs/ampid-1/source/terrain.json'));
if (!set.ok || !terrain.ok) throw new Error('inputs');
const NOW = Date.parse('2026-10-14T06:00:00Z');
const feed = { source: 'probe', readings: [
  { stationId: 's1', levelMeters: 20.5, observedAt: NOW - 120000, datum: 'TEST-MSL' },
  { stationId: 's2', levelMeters: 21.7, observedAt: NOW - 120000, datum: 'TEST-MSL' }] };
const stats = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return { p50: +s[Math.floor(s.length / 2)].toFixed(3), p95: +s[Math.floor(s.length * 0.95)].toFixed(3), max: +s[s.length - 1].toFixed(3) }; };
const pre: number[] = []; const bfs: number[] = []; const compile: number[] = []; const total: number[] = [];
for (let i = 0; i < 300; i++) {
  const a = performance.now();
  const snapshot = buildSensorSnapshot(set.value, feed, mergeSensorHistory([], feed), NOW);
  const elig = assessFloodGridEligibility(pack.grid, set.value, terrain.value, pack.packStationIds);
  const b = performance.now();
  const stations = set.value.stations.map(s => ({ stationId: s.stationId, lat: s.lat, lng: s.lng, levelMeters: snapshot.stations.find(o => o.stationId === s.stationId)?.levelMeters ?? null, criticalMeters: s.criticalMeters }));
  const r = runFloodBfs(pack.grid, stations, ROUTING_PROFILES['ampid-fine']);
  const c = performance.now();
  if (!r.ok || !elig.eligible) throw new Error('bfs');
  compileRoadFlooding(pack.edges, pack.grid, r.result.floodedCells);
  const d = performance.now();
  pre.push(b - a); bfs.push(c - b); compile.push(d - c);
  const e = performance.now();
  runFloodShadow({ areaId: pack.areaId, graphVersion: pack.graphVersion, edges: pack.edges, grid: pack.grid, gridSha256: pack.gridSha256, packStationIds: pack.packStationIds, stationSet: set.value, terrain: terrain.value, snapshot, sourceStatus: 'ok' });
  total.push(performance.now() - e);
}
const runtime = typeof (globalThis as { Deno?: unknown }).Deno !== 'undefined' ? 'deno' : 'node';
const heapMb = runtime === 'deno' ? (globalThis as unknown as { Deno: { memoryUsage(): { heapUsed: number } } }).Deno.memoryUsage().heapUsed / 1e6 : process.memoryUsage().heapUsed / 1e6;
console.log(JSON.stringify({ runtime, packLoadMs: +packLoadMs.toFixed(1), preprocessing: stats(pre), bfsTraversal: stats(bfs), roadCompilation: stats(compile), wholeRun: stats(total), heapUsedMb: +heapMb.toFixed(1), cells: pack.grid.cols * pack.grid.rows, edges: pack.edges.length }));
