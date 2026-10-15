/**
 * R8 reproducible shadow output for the REAL bundled inputs (Ampid I pack, station set and
 * terrain metadata as committed). Writes the report with a fixed evaluation time so two runs
 * are byte-identical, and prints the input-readiness table.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON plans/evidence/resident-drrm-routing/r8-shadow/shadow-report.mts <out.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  buildSensorSnapshot,
  mergeSensorHistory,
  parseSensorStationSet,
  parseTerrainMetadata,
  runFloodShadow,
} from '../../../../packages/shared/src/lib/flood-shadow.ts';
import type { FloodGrid, RoutingGraph } from '../../../../packages/shared/src/lib/evacuation-routing.ts';

const root = new URL('../../../../', import.meta.url);
const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const graph = read('data/routing-packs/ampid-1/pack/graph.json') as RoutingGraph;
const grid = read('data/routing-packs/ampid-1/pack/server/grid-ampid-fine.json') as FloodGrid;
const manifest = read('data/routing-packs/ampid-1/pack/manifest.json') as { resources: { path: string; sha256: string }[] };
const stationSet = parseSensorStationSet(read('data/routing-packs/ampid-1/source/sensor-stations.json'));
const terrain = parseTerrainMetadata(read('data/routing-packs/ampid-1/source/terrain.json'));
if (!stationSet.ok || !terrain.ok) throw new Error('bundled inputs are invalid');

const NOW = Date.parse('2026-10-14T00:00:00Z');
const snapshot = buildSensorSnapshot(stationSet.value, null, mergeSensorHistory([], null), NOW);
const report = runFloodShadow({
  areaId: 'ampid-1',
  graphVersion: graph.version,
  edges: graph.edges,
  grid,
  gridSha256: manifest.resources.find(r => r.path === 'server/grid-ampid-fine.json')?.sha256 ?? '',
  packStationIds: graph.stationEdges.map(s => s.stationId),
  stationSet: stationSet.value,
  terrain: terrain.value,
  snapshot,
  sourceStatus: 'unconfigured',
});
const out = process.argv[2];
if (out) writeFileSync(out, `${JSON.stringify(report, null, 1)}\n`);
console.log(JSON.stringify({
  modelStatus: report.modelStatus,
  sourceStatus: report.sourceStatus,
  eligibility: report.eligibility,
  stations: report.stations.length,
  unknownTerrainCells: report.unknownTerrainCells,
  gridCells: report.gridCells,
  unknownEdges: report.roads.unknownEdgeIds.length,
  bridgeDecks: report.roads.bridgeDeckEdgeIds.length,
  reportHash: report.reportHash,
}, null, 1));
