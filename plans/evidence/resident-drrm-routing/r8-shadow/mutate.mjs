import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const F = 'packages/shared/src/lib/flood-shadow.ts';
const H = 'supabase/functions/flood-shadow/handler.ts';
const mutants = [
  ['stale check removed', F, "else if (station.intervalSeconds !== null && now - reading.observedAt > staleIntervals * station.intervalSeconds * 1000) reasons.push('stale');", ""],
  ['range check removed', F, "else if (Math.abs(reading.levelMeters - station.baselineMeters) > rangeMeters) reasons.push('out_of_range');", ""],
  ['jump check removed', F, "if (Math.abs(reading.levelMeters - previous.levelMeters) > allowed) reasons.push('jump');", ""],
  ['outlier check removed', F, "if (deviation >= SENSOR_VALIDATION.outlierFloorMeters && deviation > SENSOR_VALIDATION.outlierScore * robustSd) reasons.push('outlier');", ""],
  ['unknown reading treated as dry (0)', F, "levelMeters: observations.get(s.stationId)?.levelMeters ?? null,", "levelMeters: observations.get(s.stationId)?.levelMeters ?? 0,"],
  ['bridge decks flooded by cells', F, "      if (overFlooded) out.bridgeDecksOverFloodedCells.push(edge.id);\n      continue;", "      if (overFlooded) { out.bridgeDecksOverFloodedCells.push(edge.id); out.floodedEdgeIds.push(edge.id); }\n      continue;"],
  ['DEM accuracy rule removed', F, "else if (toleratedRmseMeters !== null && terrain.verticalRmseMeters > toleratedRmseMeters) reasons.push('accuracy_too_coarse');", ""],
  ['datum rule removed', F, "if (set.stations.some(s => s.datum !== terrain.verticalDatum)) reasons.push('datum_mismatch');", ""],
  ['snapshot id ignores evaluation time', F, "const content = { configVersion: SHADOW_CONFIG_VERSION, evaluatedAt: now, source: feed?.source ?? null, stations, unconfiguredStationIds };\n  return deepFreeze({ snapshotId: sha256Hex(JSON.stringify(content)), ...content });", "const content = { configVersion: SHADOW_CONFIG_VERSION, evaluatedAt: now, source: feed?.source ?? null, stations, unconfiguredStationIds };\n  return deepFreeze({ snapshotId: sha256Hex(JSON.stringify({ ...content, evaluatedAt: 0 })), ...content });"],
  ['unknown edges not reported', F, "else if (outside || cells.some(cell => grid.elevations[cell] === null || grid.elevations[cell] === undefined)) out.unknownEdgeIds.push(edge.id);", ""],
  ['model never degraded', F, "else modelStatus = anyStationUnknown || anyUnknownCoverage ? 'degraded' : 'ok';", "else modelStatus = 'ok';"],
  ['baseline may exclude Critical', F, "else if (typeof baselineMeters === 'number' && criticalMeters > baselineMeters + SENSOR_VALIDATION.rangeMeters) issues.push(`${at}:baseline_excludes_critical`);", ""],
  ['handler: no authorization', H, "if (!deps.authorized(req)) return fail('unauthorized');", ""],
  ['handler: runs without history', H, "if (history === null) {\n      // The temporal and outlier checks cannot run: do not judge readings without them.\n      deps.reportError('history_unavailable');\n      return fail('history_unavailable');\n    }", "if (history === null) history = [];"],
  ['handler: feed failure ignored', H, "    } catch {\n      sourceStatus = 'failed';\n      deps.reportError('feed_failed');\n    }", "    } catch {\n      sourceStatus = 'ok';\n    }"],
  ['handler: grid hash unchecked', H, "if (new TextEncoder().encode(text).byteLength !== entry.bytes || (await sha256Hex(text)) !== entry.sha256) {\n    throw new ShadowPackError('grid_hash_mismatch');\n  }", ""],
];
let killed = 0;
for (const [name, file, from, to] of mutants) {
  const original = readFileSync(file, 'utf8');
  if (!original.includes(from)) { console.log(`SKIP (pattern missing): ${name}`); continue; }
  writeFileSync(file, original.replace(from, to));
  const r = spawnSync('npx', ['vitest', 'run', 'packages/shared/src/lib/flood-shadow.test.ts', 'supabase/functions/flood-shadow'], { encoding: 'utf8', shell: true });
  writeFileSync(file, original);
  const failed = (r.stdout + r.stderr).match(/Tests\s+(\d+) failed/);
  const dead = r.status !== 0;
  if (dead) killed++;
  console.log(`${dead ? 'KILLED  ' : 'SURVIVED'} ${name}${failed ? ` (${failed[1]} failing)` : ''}`);
}
console.log(`${killed}/${mutants.length} killed`);
