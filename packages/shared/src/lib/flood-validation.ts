/**
 * Replay, comparison and scoring tooling for the BFS shadow model (DRRM weather-routing plan,
 * phase R9a). It computes the plan's validation measures (precision, recall, IoU, road-level
 * false positives/negatives, sensitivity to a terrain offset) from inputs it is given. It
 * produces no thresholds or accuracy claims of its own: real numbers need held-out flood
 * events with ground truth (R9b), which do not exist in the repository.
 *
 * Server-side tooling; imports the R8 shadow core by relative `.ts` path.
 */
import type { FloodGrid, RoutingEdge } from './evacuation-routing.ts';
import {
  buildSensorSnapshot,
  mergeSensorHistory,
  runFloodShadow,
  type SensorFeed,
  type SensorHistoryPoint,
  type SensorStationSet,
  type ShadowReport,
  type ShadowSourceStatus,
  type TerrainMetadata,
} from './flood-shadow.ts';

// ---------------------------------------------------------------------------------------
// Extent comparison
// ---------------------------------------------------------------------------------------

export interface ExtentMetrics<T> {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  /** TP / (TP + FP); null when the model flagged nothing (no ratio to report, not 0 or 1). */
  precision: number | null;
  /** TP / (TP + FN); null when nothing was observed flooded. */
  recall: number | null;
  /** TP / (TP + FP + FN); null when both extents are empty. */
  iou: number | null;
  falsePositiveIds: T[];
  /** Observed flooded, modelled dry: the dangerous misses. */
  falseNegativeIds: T[];
  /** Units the model could not judge; excluded from the counts above. */
  unknownCount: number;
  /** Observed flooded where the model had no judgement: reported, never counted as hits. */
  unknownObservedIds: T[];
}

function ascending<T>(a: T, b: T): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Compares a modelled extent with an observed one over a universe of units (grid cells or
 * edge ids). Units in `unknown` are excluded from the confusion counts and reported. Units
 * outside the universe are ignored.
 */
export function compareExtents<T extends string | number>(
  modelled: Iterable<T>,
  observed: Iterable<T>,
  universe: Iterable<T>,
  unknown: Iterable<T> = [],
): ExtentMetrics<T> {
  const all = new Set(universe);
  const unknownSet = new Set([...unknown].filter(u => all.has(u)));
  const modelledSet = new Set([...modelled].filter(u => all.has(u) && !unknownSet.has(u)));
  const observedAll = new Set([...observed].filter(u => all.has(u)));
  let tp = 0;
  let tn = 0;
  const fp: T[] = [];
  const fn: T[] = [];
  for (const unit of all) {
    if (unknownSet.has(unit)) continue;
    const m = modelledSet.has(unit);
    const o = observedAll.has(unit);
    if (m && o) tp++;
    else if (m) fp.push(unit);
    else if (o) fn.push(unit);
    else tn++;
  }
  const ratio = (num: number, den: number): number | null => (den === 0 ? null : num / den);
  return {
    truePositives: tp,
    falsePositives: fp.length,
    falseNegatives: fn.length,
    trueNegatives: tn,
    precision: ratio(tp, tp + fp.length),
    recall: ratio(tp, tp + fn.length),
    iou: ratio(tp, tp + fp.length + fn.length),
    falsePositiveIds: fp.sort(ascending),
    falseNegativeIds: fn.sort(ascending),
    unknownCount: unknownSet.size,
    unknownObservedIds: [...unknownSet].filter(u => observedAll.has(u)).sort(ascending),
  };
}

/**
 * Road-level score of one shadow report against observed flooded edges. Bridge decks are
 * unassessed by design (plan 3.4) and count as unknown alongside terrain-unknown edges.
 */
export function scoreReportRoads(report: ShadowReport, edges: readonly RoutingEdge[], observedFloodedEdgeIds: Iterable<string>): ExtentMetrics<string> {
  return compareExtents(
    report.roads.floodedEdgeIds,
    observedFloodedEdgeIds,
    edges.map(e => e.id),
    [...report.roads.unknownEdgeIds, ...report.roads.bridgeDeckEdgeIds],
  );
}

/** Cell-level score of one shadow report against observed flooded cells. */
export function scoreReportCells(report: ShadowReport, observedFloodedCells: Iterable<number>): ExtentMetrics<number> {
  const universe = Array.from({ length: report.gridCells }, (_, i) => i);
  return compareExtents(report.floodedCells, observedFloodedCells, universe, report.unknownFrontierCells);
}

// ---------------------------------------------------------------------------------------
// Report comparison (stage 3: differences between shadow output and what residents see)
// ---------------------------------------------------------------------------------------

export interface ReportDifference {
  modelStatus: { before: ShadowReport['modelStatus']; after: ShadowReport['modelStatus'] } | null;
  floodedCellsAdded: number[];
  floodedCellsRemoved: number[];
  floodedEdgesAdded: string[];
  floodedEdgesRemoved: string[];
  unknownEdgesAdded: string[];
  unknownEdgesRemoved: string[];
}

function diff<T>(before: readonly T[], after: readonly T[]): { added: T[]; removed: T[] } {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: after.filter(x => !b.has(x)).sort(ascending),
    removed: before.filter(x => !a.has(x)).sort(ascending),
  };
}

/** What changed from one report to the next (for logging; never a routing input). */
export function compareShadowReports(before: ShadowReport, after: ShadowReport): ReportDifference {
  const cells = diff(before.floodedCells, after.floodedCells);
  const flooded = diff(before.roads.floodedEdgeIds, after.roads.floodedEdgeIds);
  const unknown = diff(before.roads.unknownEdgeIds, after.roads.unknownEdgeIds);
  return {
    modelStatus: before.modelStatus === after.modelStatus ? null : { before: before.modelStatus, after: after.modelStatus },
    floodedCellsAdded: cells.added,
    floodedCellsRemoved: cells.removed,
    floodedEdgesAdded: flooded.added,
    floodedEdgesRemoved: flooded.removed,
    unknownEdgesAdded: unknown.added,
    unknownEdgesRemoved: unknown.removed,
  };
}

// ---------------------------------------------------------------------------------------
// Replay of an event (a time series of feeds) through the shadow model
// ---------------------------------------------------------------------------------------

export interface ReplayInputs {
  areaId: string;
  graphVersion: string;
  edges: readonly RoutingEdge[];
  grid: FloodGrid;
  gridSha256: string;
  packStationIds: readonly string[];
  stationSet: SensorStationSet;
  terrain: TerrainMetadata | null;
}

export interface ReplayStep {
  /** Evaluation time of this step, ms since epoch; steps must be strictly increasing. */
  evaluatedAt: number;
  /** Readings available at that time; null = the source failed at that step. */
  feed: SensorFeed | null;
}

/**
 * Replays steps in order exactly as the scheduled function would: each step validates its
 * readings against the history of all earlier steps (and its own feed), so temporal and
 * outlier checks behave as in production. Deterministic: equal inputs give equal reports.
 */
export function replayShadowEvent(inputs: ReplayInputs, steps: readonly ReplayStep[]): ShadowReport[] {
  for (let i = 1; i < steps.length; i++) {
    if (!(steps[i].evaluatedAt > steps[i - 1].evaluatedAt)) throw new RangeError('replay steps must have strictly increasing evaluatedAt');
  }
  let history: SensorHistoryPoint[] = [];
  return steps.map(step => {
    const merged = mergeSensorHistory(history, step.feed);
    const snapshot = buildSensorSnapshot(inputs.stationSet, step.feed, merged, step.evaluatedAt);
    const sourceStatus: ShadowSourceStatus = step.feed === null ? 'failed' : 'ok';
    const report = runFloodShadow({ ...inputs, snapshot, sourceStatus });
    history = mergeSensorHistory(history, step.feed);
    return report;
  });
}

// ---------------------------------------------------------------------------------------
// Calibration sensitivity: how much the extent moves when the terrain shifts
// ---------------------------------------------------------------------------------------

export interface SensitivityRow {
  /** Meters added to every known elevation (positive = higher ground). */
  offsetMeters: number;
  modelStatus: ShadowReport['modelStatus'];
  floodedCells: number;
  floodedEdges: number;
}

/**
 * Re-runs one step with the whole terrain shifted by each offset, the simplest test of how
 * a vertical datum or DEM error moves the modelled extent. Unknown cells stay unknown.
 */
export function terrainOffsetSensitivity(inputs: ReplayInputs, step: ReplayStep, offsetsMeters: readonly number[], history: readonly SensorHistoryPoint[] = []): SensitivityRow[] {
  const merged = mergeSensorHistory(history, step.feed);
  const snapshot = buildSensorSnapshot(inputs.stationSet, step.feed, merged, step.evaluatedAt);
  return offsetsMeters.map(offset => {
    const grid: FloodGrid = { ...inputs.grid, elevations: inputs.grid.elevations.map(e => (e === null ? null : e + offset)) };
    const report = runFloodShadow({ ...inputs, grid, snapshot, sourceStatus: step.feed === null ? 'failed' : 'ok' });
    return { offsetMeters: offset, modelStatus: report.modelStatus, floodedCells: report.floodedCells.length, floodedEdges: report.roads.floodedEdgeIds.length };
  });
}
