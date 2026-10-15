import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const A = 'packages/shared/src/lib/model-activation.ts';
const X = 'packages/shared/src/lib/model-exclusions.ts';
const V = 'packages/shared/src/lib/flood-validation.ts';
const mutants = [
  ['stage order not enforced', A, "if (!earlierEnabled) issues.push({ code: 'stage_order', stage });", ''],
  ['acceptance not required', A, "if (entry.acceptanceRef === null || entry.acceptanceRef.trim() === '') issues.push({ code: 'missing_acceptance', stage });", ''],
  ['stale model still influences', A, "    if (health === 'stale') {\n      withheld.push({ stage, reason: 'model_stale' });\n      return false;\n    }", ''],
  ['staleness never detected', A, "if (now - latest.evaluatedAt > MODEL_STALE_INTERVALS * runIntervalSeconds * 1000) return 'stale';", ''],
  ['missing interval treated as fresh', A, "if (latest === null || runIntervalSeconds === null || !(runIntervalSeconds > 0) || !Number.isFinite(latest.evaluatedAt)) return 'unavailable';", "if (latest === null) return 'unavailable';"],
  ['expiry drops exclusions', X, "        current.set(id, { ...e, state: 'holdover' });\n        change.heldOver.push(id);\n      }\n    }\n    change.heldOver.sort();\n    return { state: toState(state.evaluatedAt, current), change };", "        current.delete(id);\n      }\n    }\n    return { state: toState(state.evaluatedAt, current), change };"],
  ['degraded revision clears', X, "if (event.modelStatus === 'ok') {", "if (event.modelStatus === 'ok' || event.modelStatus === 'degraded') {"],
  ['older revision accepted', X, "if (!(event.evaluatedAt > state.evaluatedAt)) return { state, change: { ...change, outcome: 'ignored_not_newer' } };", ''],
  ['clearance without reviewer', X, "if (event.reviewer.trim() === '') return { state, change: { ...change, outcome: 'ignored_no_reviewer' } };", ''],
  ['closures dropped from blocks', X, "closedEdgeIds.forEach(id => add(id, 'closure'));", ''],
  ['unknown counted as dry', V, "    if (unknownSet.has(unit)) continue;\n", ''],
  ['0/0 reported as 0', V, "(den === 0 ? null : num / den)", "(den === 0 ? 0 : num / den)"],
  ['replay history not chained', V, "    history = mergeSensorHistory(history, step.feed);\n", ''],
  ['bridge decks scored as dry', V, "[...report.roads.unknownEdgeIds, ...report.roads.bridgeDeckEdgeIds],", "report.roads.unknownEdgeIds,"],
];
let killed = 0;
for (const [name, file, from, to] of mutants) {
  const original = readFileSync(file, 'utf8');
  if (!original.includes(from)) { console.log('SKIP (pattern missing):', name); continue; }
  writeFileSync(file, original.replace(from, to));
  const r = spawnSync('npx vitest run src/lib/model-activation.test.ts src/lib/model-exclusions.test.ts src/lib/flood-validation.test.ts', { cwd: 'packages/shared', encoding: 'utf8', shell: true });
  writeFileSync(file, original);
  const failed = (r.stdout + r.stderr).match(/Tests\s+(\d+) failed/);
  if (r.status !== 0) killed++;
  console.log(`${r.status !== 0 ? 'KILLED  ' : 'SURVIVED'} ${name}${failed ? ` (${failed[1]} failing)` : ''}`);
}
console.log(`${killed}/${mutants.length} killed`);
