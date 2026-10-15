/**
 * Builds a pedestrian routing pack (DRRM weather-routing plan, phase R3).
 *
 *   npm run build:routing-pack -- --area ampid-1 --osm <overpass.json> \
 *     --boundary <boundary.geojson> --centers <centers.json> [--stations <stations.json>] \
 *     --out <pack dir> --report <report dir>
 *
 * (The script silences Node's MODULE_TYPELESS_PACKAGE_JSON notice: this package has no
 * "type" field, so Node re-parses the shared `.ts` sources as ES modules.)
 *
 * Writes manifest.json, graph.json, map.json and server/grid-*.json to --out, and report.json
 * plus the DRRM review sheet report.md to --report. Exits non-zero on invalid input, topology
 * errors or a budget ceiling breach; nothing is written in those cases. Omit --stations until
 * station positions are verified (plan section 7).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  OSM_ATTRIBUTION,
  PACK_BUDGETS,
  buildRoutingPack,
  parseBoundaryGeoJson,
  parseOverpassJson,
  parsePackCenters,
  parsePackStations,
  serializeRoutingPack,
  type PackBudget,
  type RoutingPackReport,
  type WayReview,
} from '../src/lib/routing-pack-builder.ts';

function fail(message: string, issues: readonly string[] = []): never {
  process.stderr.write(`${message}\n${issues.map(issue => `  - ${issue}`).join('\n')}${issues.length > 0 ? '\n' : ''}`);
  process.exit(1);
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return fail(`Cannot read JSON from ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function unwrap<T>(label: string, parsed: { ok: true; value: T } | { ok: false; issues: string[] }): T {
  if (!parsed.ok) fail(`Invalid ${label}:`, parsed.issues);
  return parsed.value;
}

const { values } = parseArgs({
  options: {
    area: { type: 'string', default: 'ampid-1' },
    osm: { type: 'string' },
    boundary: { type: 'string' },
    centers: { type: 'string' },
    stations: { type: 'string' },
    out: { type: 'string' },
    report: { type: 'string' },
  },
  strict: true,
});
const { area, osm, boundary, centers, stations, out, report } = values;
if (osm === undefined || boundary === undefined || centers === undefined || out === undefined || report === undefined) {
  fail('Required: --osm, --boundary, --centers, --out, --report (optional: --area, --stations).');
}

const result = buildRoutingPack({
  areaId: area,
  extract: unwrap('Overpass extract', parseOverpassJson(readJson(osm))),
  boundary: unwrap('boundary', parseBoundaryGeoJson(readJson(boundary))),
  centers: unwrap('centers', parsePackCenters(readJson(centers))),
  stations: stations === undefined ? [] : unwrap('stations', parsePackStations(readJson(stations))),
});
if (!result.ok) fail('Pack build failed:', result.issues);

const { files, manifest, budget } = serializeRoutingPack(result.pack);
if (!budget.withinCeilings) fail(`Pack exceeds a hard budget ceiling: graph ${budget.graphBytes} B, device pack ${budget.deviceBytes} B.`);

for (const file of files) {
  const path = join(out, file.path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, file.content);
}
mkdirSync(report, { recursive: true });
writeFileSync(join(report, 'report.json'), `${JSON.stringify({ ...result.pack.report, budget }, null, 2)}\n`);
writeFileSync(join(report, 'report.md'), renderReport(result.pack.report, budget));

process.stdout.write(
  `${manifest.graphVersion}\n` +
    `${result.pack.report.counts.nodes} nodes, ${result.pack.report.counts.edges} edges, graph ${budget.graphBytes} B, device pack ${budget.deviceBytes} B` +
    `${budget.withinTargets ? '' : ' (over target)'}\n` +
    manifest.resources.map(r => `${r.sha256}  ${r.path}`).join('\n') +
    '\n',
);

function meters(value: number | null): string {
  return value === null ? '—' : `${Math.round(value).toLocaleString('en-US')} m`;
}

function cell(value: string | null): string {
  return (value ?? '(unnamed)').replace(/\|/g, '\\|');
}

function wayTable(rows: readonly (WayReview & { reason?: string })[], withReason = false): string {
  if (rows.length === 0) return '_None._\n';
  const head = `| OSM way | Name | Class | Edges | Length |${withReason ? ' Reason |' : ''}\n|---|---|---|---|---|${withReason ? '---|' : ''}\n`;
  return (
    head +
    rows
      .map(r => `| [${r.wayId}](https://www.openstreetmap.org/way/${r.wayId}) | ${cell(r.name)} | ${r.highway} | ${r.edgeCount} | ${meters(r.lengthMeters)} |${withReason ? ` ${r.reason ?? ''} |` : ''}`)
      .join('\n') +
    '\n'
  );
}

function renderReport(r: RoutingPackReport, b: PackBudget): string {
  const centers = r.centers
    .map(
      c =>
        `| ${cell(c.name)} (\`${c.centerId}\`) | ${c.insideBoundary ? 'inside' : '**outside**'} | ${meters(c.distanceToBoundaryMeters)} | ${c.insideCoverage ? 'yes' : '**no**'} | ` +
        `${c.proposedEntranceNodeId === null ? '**none within 50 m**' : `\`${c.proposedEntranceNodeId}\` (${meters(c.entranceDistanceMeters)})${c.entranceOnBoundaryNetwork ? '' : ' — **on a margin-only group, not the Ampid I network**'}`} | ` +
        `${c.unreachableEdgeCount} (${meters(c.unreachableLengthMeters)}) |`,
    )
    .join('\n');
  const components = r.components
    .slice(0, 15)
    .map(
      (c, i) =>
        `| ${i + 1} | ${c.edgeCount} | ${c.insideBoundaryEdgeCount === 0 ? '0 (margin only)' : c.insideBoundaryEdgeCount} | ${meters(c.lengthMeters)} | ` +
        `${c.centerIds.join(', ') || (c.insideBoundaryEdgeCount === 0 ? 'none' : '**none**')} | ${c.names.map(cell).join(', ') || '(unnamed)'} |`,
    )
    .join('\n');
  const crossings = r.crossingsWithoutJunction
    .map(c => `| \`${c.edgeIds[0]}\` × \`${c.edgeIds[1]}\` | [${c.point[1]}, ${c.point[0]}](https://www.openstreetmap.org/?mlat=${c.point[1]}&mlon=${c.point[0]}#map=19/${c.point[1]}/${c.point[0]}) |`)
    .join('\n');
  const barriers = r.barrierNodes
    .map(n => `| [${n.nodeId}](https://www.openstreetmap.org/node/${n.nodeId}) | ${n.barrier} | ${n.verdict} |`)
    .join('\n');
  return `# Routing pack review — ${r.areaId}

Graph version \`${r.graphVersion}\` · OSM data as of ${r.osmBaseTimestamp ?? 'unknown'} · ${OSM_ATTRIBUTION}

Generated by \`packages/shared/scripts/build-routing-pack.mts\`. Every list below is for DRRM review; nothing here is verified until signed off at the end.

## Summary

- ${r.counts.nodes} nodes, ${r.counts.edges} walkable edges, ${meters(r.counts.edgeLengthMeters)} of walkable way; ${r.counts.barriers} water/wall barrier lines; ${r.counts.zeroLengthPiecesJoined} zero-length pieces joined.
- Coverage: boundary + ${r.coverage.marginMeters} m margin (±${r.coverage.toleranceMeters} m), ${r.coverage.rings} ring(s), ${r.coverage.vertices} vertices.
- Budget: graph ${b.graphBytes.toLocaleString('en-US')} B (target ${PACK_BUDGETS.graphTargetBytes.toLocaleString('en-US')}), device pack ${b.deviceBytes.toLocaleString('en-US')} B (target ${PACK_BUDGETS.deviceTargetBytes.toLocaleString('en-US')}) — ${b.withinTargets ? 'within targets' : '**over target**'}.
- Station-to-edge tables: ${r.stations.status}. Terrain (DEM): ${r.terrain}.

## 1. Evacuation centers and entrances

Entrances are the nearest walkable node within 50 m of the stored center position — **proposals only**. Confirm each center's real location and gate, or give the correct one.

| Center | Boundary | To boundary line | In coverage | Proposed entrance | Inside-boundary edges that cannot reach it |
|---|---|---|---|---|---|
${centers}

## 2. Connectivity

Connected groups of walkable ways (largest first, top 15 of ${r.components.length}). A group with edges inside Ampid I and no center is cut off from every evacuation center in the map data. Margin-only groups are neighbouring streets whose links run outside the covered area; they are listed for completeness.

| # | Edges | Inside Ampid I | Length | Centers reachable | Streets |
|---|---|---|---|---|---|
${components}

### Streets inside Ampid I that reach no center

Check each on the ground: is it really cut off (gate, wall, one-way footpath), or is a connection missing from the map?

${wayTable(r.streetsWithoutCenter)}
### Ways that cross without a shared junction

Same-level ways that cross with no common node. Either a real junction is missing from the map (walkers can cross here) or one way is a bridge/underpass that is not tagged as one.

${crossings.length > 0 ? `| Edges | Location (lat, lng) |\n|---|---|\n${crossings}\n` : '_None._\n'}
## 3. Bridges

Confirm each bridge and its approaches are walkable in normal conditions.

${wayTable(r.bridges)}
## 4. Barriers and access assumptions

Barrier nodes on walkable ways (\`blocking\` = treated as closed to walkers; \`passable_private\` = kept open for evacuation, confirm):

${barriers.length > 0 ? `| OSM node | Barrier | Treatment |\n|---|---|---|\n${barriers}\n` : '_None._\n'}
Ways kept walkable on an assumption DRRM must confirm (private roads kept open for evacuation; national roads with no foot tag; unclassified \`road\`):

${wayTable(r.accessReview, true)}
## DRRM sign-off

| Item | Reviewer | Date | Result / corrections |
|---|---|---|---|
| Center locations and entrances (section 1) | | | |
| Cut-off streets and missing junctions (section 2) | | | |
| Bridges and approaches (section 3) | | | |
| Barriers and private-road assumptions (section 4) | | | |
`;
}
