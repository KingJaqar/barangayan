import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { floodShadowHandler, loadShadowPack } from 'file:///C:/Users/User/AppData/Local/Temp/claude/C--Users-User-barangayan/8bfb9a91-a725-4394-828b-e39d35d15694/scratchpad/repo/supabase/functions/flood-shadow/handler.ts';

const R = 'C:/Users/User/AppData/Local/Temp/claude/C--Users-User-barangayan/8bfb9a91-a725-4394-828b-e39d35d15694/scratchpad/repo/';
const read = (p: string): unknown => JSON.parse(readFileSync(R + p, 'utf8'));
const sha = async (t: string) => createHash('sha256').update(t).digest('hex');
const pack = await loadShadowPack(read('data/routing-packs/ampid-1/pack/graph.json'), read('data/routing-packs/ampid-1/pack/server/grid-ampid-fine.json'), read('data/routing-packs/ampid-1/pack/manifest.json'), sha);
const NOW = Date.parse('2026-10-14T06:00:00Z');
const at = (min: number) => new Date(NOW - min * 60_000).toISOString();
const feeds: Record<string, unknown> = {
  critical: { schemaVersion: 1, source: 'probe', readings: [
    { stationId: 's1', levelMeters: 20.5, observedAt: at(2), datum: 'TEST-MSL' },
    { stationId: 's2', levelMeters: 19.2, observedAt: at(2), datum: 'TEST-MSL' } ] },
  flagged: { schemaVersion: 1, source: 'probe', readings: [
    { stationId: 's1', levelMeters: 20.5, observedAt: at(2), datum: 'TEST-MSL' },
    { stationId: 's2', levelMeters: 31, observedAt: at(2), datum: 'TEST-MSL' } ] },
  both: { schemaVersion: 1, source: 'probe', readings: [
    { stationId: 's1', levelMeters: 20.5, observedAt: at(2), datum: 'TEST-MSL' },
    { stationId: 's2', levelMeters: 21.7, observedAt: at(2), datum: 'TEST-MSL' } ] },
};
const out: Record<string, unknown> = {};
for (const [name, feed] of Object.entries(feeds)) {
  let published: { p_report: { reportHash: string; modelStatus: string; floodedCells: number[]; seeds: unknown[]; roads: { floodedEdgeIds: string[]; unknownEdgeIds: string[] } } } | null = null;
  const handler = floodShadowHandler({
    pack: async () => pack,
    stationSet: read('data/routing-packs/ampid-1/source/sensor-stations.json'),
    terrain: read('data/routing-packs/ampid-1/source/terrain.json'),
    fetchFeed: async () => feed,
    history: async () => [],
    publish: async (args: unknown) => { published = args as typeof published; return { status: 'published', id: 'x' }; },
    authorized: () => true,
    now: () => NOW,
    reportError: () => {},
  });
  await handler(new Request('http://localhost/', { method: 'POST' }));
  const r = published!.p_report;
  out[name] = {
    hash: r.reportHash,
    modelStatus: r.modelStatus,
    flooded: r.floodedCells.length,
    seeds: r.seeds.length,
    floodedEdges: r.roads.floodedEdgeIds.length,
    unknownEdges: r.roads.unknownEdgeIds.length,
    bodyHash: createHash('sha256').update(JSON.stringify(r)).digest('hex').slice(0, 16),
  };
}
console.log(JSON.stringify(out, null, 1));
