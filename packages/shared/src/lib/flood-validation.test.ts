import { describe, expect, it } from 'vitest';
import type { FloodGrid, LngLat, RoutingEdge } from './evacuation-routing.ts';
import type { RawSensorReading, SensorFeed, SensorStationConfig, SensorStationSet, TerrainMetadata } from './flood-shadow.ts';
import {
  compareExtents,
  compareShadowReports,
  replayShadowEvent,
  scoreReportCells,
  scoreReportRoads,
  terrainOffsetSensitivity,
  type ReplayInputs,
} from './flood-validation.ts';

// Synthetic fixtures only: no real gauge, terrain or flood-event data exists yet (R9b).
const ORIGIN_LAT = 14.67;
const ORIGIN_LNG = 121.11;
const METERS_PER_DEGREE = (Math.PI / 180) * 6_371_000;
const COS = Math.cos((ORIGIN_LAT * Math.PI) / 180);
const NOW = Date.parse('2026-10-15T06:00:00Z');
const MINUTE = 60_000;

function atCells(x: number, y: number): LngLat {
  return [ORIGIN_LNG + (x * 50) / (METERS_PER_DEGREE * COS), ORIGIN_LAT + (y * 50) / METERS_PER_DEGREE];
}

function makeGrid(elevation: (col: number, row: number) => number | null): FloodGrid {
  const elevations: (number | null)[] = [];
  for (let row = 0; row < 10; row++) for (let col = 0; col < 10; col++) elevations.push(elevation(col, row));
  return { cellSizeMeters: 50, cols: 10, rows: 10, originLat: ORIGIN_LAT, originLng: ORIGIN_LNG, elevations };
}

function station(id: string, col: number, row: number): SensorStationConfig {
  const [lng, lat] = atCells(col + 0.5, row + 0.5);
  return { stationId: id, name: id, lat, lng, alertMeters: 18, alarmMeters: 19, criticalMeters: 20, baselineMeters: 17, datum: 'TEST-MSL', intervalSeconds: 600 };
}

function edge(id: string, points: LngLat[], bridge = false): RoutingEdge {
  return { id, from: `${id}-a`, to: `${id}-b`, geometry: points, lengthMeters: 100, name: id, pedestrianAccess: 'both', stairs: false, bridge, sourceRef: `way/1/${id}` };
}

const TERRAIN: TerrainMetadata = { source: 'fixture', licensed: true, verticalDatum: 'TEST-MSL', verticalRmseMeters: 0.2 };
const SET: SensorStationSet = { verification: { source: 'fixture', verifiedOn: '2026-10-15', reviewer: 'tests' }, stations: [station('a', 1, 1)] };
const EDGES = [
  edge('west', [atCells(0.5, 2.5), atCells(4.5, 2.5)]),
  edge('east', [atCells(5.5, 2.5), atCells(9.5, 2.5)]),
  edge('deck', [atCells(2.5, 6.5), atCells(2.5, 7.5)], true),
];

// Low ground west of a 25 m ridge on column 5.
const INPUTS: ReplayInputs = {
  areaId: 'test',
  graphVersion: 'test@2026-10-15#aaaaaaaaaaaa',
  edges: EDGES,
  grid: makeGrid(col => (col === 5 ? 25 : 10)),
  gridSha256: 'f'.repeat(64),
  packStationIds: ['a'],
  stationSet: SET,
  terrain: TERRAIN,
};

function feed(level: number, at: number): SensorFeed {
  const reading: RawSensorReading = { stationId: 'a', levelMeters: level, observedAt: at, datum: 'TEST-MSL' };
  return { source: 'fixture', readings: [reading] };
}

describe('compareExtents', () => {
  it('counts the confusion matrix and its ratios', () => {
    const m = compareExtents(['a', 'b', 'c'], ['b', 'c', 'd'], ['a', 'b', 'c', 'd', 'e']);
    expect(m).toMatchObject({ truePositives: 2, falsePositives: 1, falseNegatives: 1, trueNegatives: 1, falsePositiveIds: ['a'], falseNegativeIds: ['d'] });
    expect(m.precision).toBeCloseTo(2 / 3);
    expect(m.recall).toBeCloseTo(2 / 3);
    expect(m.iou).toBeCloseTo(2 / 4);
  });

  it('reports no ratio (null, never 0 or 1) when there is nothing to divide by', () => {
    const m = compareExtents<string>([], [], ['a', 'b']);
    expect(m).toMatchObject({ precision: null, recall: null, iou: null, trueNegatives: 2 });
    expect(compareExtents(['a'], [], ['a']).recall).toBeNull();
    expect(compareExtents([], ['a'], ['a']).precision).toBeNull();
  });

  it('excludes units the model could not judge and reports observed floods among them', () => {
    const m = compareExtents(['a'], ['a', 'u'], ['a', 'u', 'v'], ['u', 'v']);
    expect(m).toMatchObject({ truePositives: 1, falseNegatives: 0, unknownCount: 2, unknownObservedIds: ['u'] });
    expect(m.recall).toBe(1);
  });

  it('ignores units outside the universe and sorts numeric ids numerically', () => {
    const m = compareExtents([10, 2, 99], [], [2, 10, 3]);
    expect(m.falsePositiveIds).toEqual([2, 10]);
  });
});

describe('replayShadowEvent', () => {
  const steps = [
    { evaluatedAt: NOW, feed: feed(19.5, NOW - MINUTE) },
    { evaluatedAt: NOW + 10 * MINUTE, feed: feed(20.5, NOW + 9 * MINUTE) },
    { evaluatedAt: NOW + 20 * MINUTE, feed: null },
  ];

  it('runs each step with the history of the earlier ones and is deterministic', () => {
    const reports = replayShadowEvent(INPUTS, steps);
    expect(reports.map(r => [r.modelStatus, r.seeds.length, r.sourceStatus])).toEqual([
      ['ok', 0, 'ok'],
      ['ok', 1, 'ok'],
      ['unavailable', 0, 'failed'],
    ]);
    expect(replayShadowEvent(INPUTS, steps).map(r => r.reportHash)).toEqual(reports.map(r => r.reportHash));
  });

  it('applies the temporal check across steps (history is chained)', () => {
    const jump = replayShadowEvent(INPUTS, [
      { evaluatedAt: NOW, feed: feed(17.0, NOW - MINUTE) },
      { evaluatedAt: NOW + 5 * MINUTE, feed: feed(20.5, NOW + 4 * MINUTE) },
    ]);
    expect(jump[1].stations[0].reasons).toEqual(['jump']);
    expect(jump[1].seeds).toEqual([]);
  });

  it('refuses steps that do not move forward in time', () => {
    expect(() => replayShadowEvent(INPUTS, [steps[1], steps[0]])).toThrow(RangeError);
  });
});

describe('scoring and comparing reports', () => {
  const [below, critical] = replayShadowEvent(INPUTS, [
    { evaluatedAt: NOW, feed: feed(19.5, NOW - MINUTE) },
    { evaluatedAt: NOW + 10 * MINUTE, feed: feed(20.5, NOW + 9 * MINUTE) },
  ]);

  it('scores roads with bridge decks counted as unknown, not as hits or misses', () => {
    const m = scoreReportRoads(critical, EDGES, ['west', 'deck']);
    expect(m).toMatchObject({ truePositives: 1, falsePositives: 0, falseNegatives: 0, trueNegatives: 1, unknownCount: 1, unknownObservedIds: ['deck'] });
  });

  it('reports an observed flooded road the model missed as a false negative', () => {
    const m = scoreReportRoads(below, EDGES, ['west']);
    expect(m.falseNegativeIds).toEqual(['west']);
    expect(m.recall).toBe(0);
  });

  it('scores cells against an observed extent', () => {
    const observed = Array.from({ length: 100 }, (_, i) => i).filter(i => i % 10 < 5);
    const m = scoreReportCells(critical, observed);
    expect(m).toMatchObject({ truePositives: 50, falsePositives: 0, falseNegatives: 0, iou: 1 });
  });

  it('lists what changed between two reports', () => {
    const d = compareShadowReports(below, critical);
    expect(d.modelStatus).toBeNull();
    expect(d.floodedCellsAdded).toHaveLength(50);
    expect(d.floodedEdgesAdded).toEqual(['west']);
    expect(d.floodedEdgesRemoved).toEqual([]);
    expect(compareShadowReports(critical, below).floodedEdgesRemoved).toEqual(['west']);
  });
});

describe('terrainOffsetSensitivity', () => {
  it('shrinks the modelled extent as the terrain rises and keeps unknown cells unknown', () => {
    const step = { evaluatedAt: NOW, feed: feed(20.5, NOW - MINUTE) };
    const rows = terrainOffsetSensitivity(INPUTS, step, [-1, 0, 5, 11]);
    expect(rows.map(r => r.offsetMeters)).toEqual([-1, 0, 5, 11]);
    for (let i = 1; i < rows.length; i++) expect(rows[i].floodedCells).toBeLessThanOrEqual(rows[i - 1].floodedCells);
    // +11 m lifts the low ground to 21 m, above the 20.5 m surface: only the seed cell is wet.
    expect(rows[3].floodedCells).toBe(1);
    expect(rows[1].floodedEdges).toBe(1);
  });
});
