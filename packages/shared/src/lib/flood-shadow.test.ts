import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROUTING_PROFILES, floodGridCellsOnPolyline, type FloodGrid, type LngLat, type RoutingEdge, type RoutingGraph } from './evacuation-routing.ts';
import {
  SENSOR_VALIDATION,
  assessFloodGridEligibility,
  buildSensorSnapshot,
  compileRoadFlooding,
  mergeSensorHistory,
  parseSensorFeed,
  parseSensorStationSet,
  parseTerrainMetadata,
  runFloodShadow,
  sha256Hex,
  validateStationReading,
  type RawSensorReading,
  type SensorFeed,
  type SensorStationConfig,
  type SensorStationSet,
  type TerrainMetadata,
} from './flood-shadow.ts';

// ---------------------------------------------------------------------------------------
// Fixtures: a 10 × 10 grid of 50 m cells; helpers convert cell coordinates to lat/lng.
// ---------------------------------------------------------------------------------------

const ORIGIN_LAT = 14.67;
const ORIGIN_LNG = 121.11;
const METERS_PER_DEGREE = (Math.PI / 180) * 6_371_000;
const COS = Math.cos((ORIGIN_LAT * Math.PI) / 180);

/** Point at cell-unit coordinates (x east, y north) of the grid origin. */
function atCells(x: number, y: number): LngLat {
  return [ORIGIN_LNG + (x * 50) / (METERS_PER_DEGREE * COS), ORIGIN_LAT + (y * 50) / METERS_PER_DEGREE];
}

function makeGrid(elevation: (col: number, row: number) => number | null, cols = 10, rows = 10): FloodGrid {
  const elevations: (number | null)[] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) elevations.push(elevation(col, row));
  return { cellSizeMeters: 50, cols, rows, originLat: ORIGIN_LAT, originLng: ORIGIN_LNG, elevations };
}

const NOW = Date.parse('2026-10-14T06:00:00Z');
const MINUTE = 60_000;

function station(id: string, col: number, row: number, overrides: Partial<SensorStationConfig> = {}): SensorStationConfig {
  const [lng, lat] = atCells(col + 0.5, row + 0.5);
  return {
    stationId: id,
    name: `Station ${id}`,
    lat,
    lng,
    alertMeters: 18,
    alarmMeters: 19,
    criticalMeters: 20,
    baselineMeters: 17,
    datum: 'TEST-MSL',
    intervalSeconds: 600,
    ...overrides,
  };
}

function verifiedSet(stations: SensorStationConfig[]): SensorStationSet {
  return { verification: { source: 'fixture', verifiedOn: '2026-10-14', reviewer: 'tests' }, stations };
}

const TERRAIN: TerrainMetadata = { source: 'fixture-lidar', licensed: true, verticalDatum: 'TEST-MSL', verticalRmseMeters: 0.2 };

function reading(stationId: string, levelMeters: number, ageMinutes = 1, datum = 'TEST-MSL'): RawSensorReading {
  return { stationId, levelMeters, observedAt: NOW - ageMinutes * MINUTE, datum };
}

function feed(...readings: RawSensorReading[]): SensorFeed {
  return { source: 'fixture-feed', readings };
}

function edge(id: string, points: LngLat[], bridge = false): RoutingEdge {
  return {
    id,
    from: `${id}-a`,
    to: `${id}-b`,
    geometry: points,
    lengthMeters: 100,
    name: id,
    pedestrianAccess: 'both',
    stairs: false,
    bridge,
    sourceRef: `way/1/${id}`,
  };
}

// ---------------------------------------------------------------------------------------
// SHA-256 and cell walk
// ---------------------------------------------------------------------------------------

describe('sha256Hex', () => {
  it('matches Node crypto for empty, ASCII, multi-block and non-ASCII input', () => {
    const samples = ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'x'.repeat(1000), 'Ampid I — Lüneburg ₱ 🌊 𝒳'];
    for (const sample of samples) {
      expect(sha256Hex(sample)).toBe(createHash('sha256').update(sample, 'utf8').digest('hex'));
    }
  });
});

describe('floodGridCellsOnPolyline', () => {
  const grid = makeGrid(() => 0);

  it('lists the cells a horizontal and a diagonal line cross, ascending', () => {
    expect(floodGridCellsOnPolyline(grid, [atCells(0.5, 2.5), atCells(3.5, 2.5)])).toEqual({ cells: [20, 21, 22, 23], outside: false });
    expect(floodGridCellsOnPolyline(grid, [atCells(0.2, 0.5), atCells(2.8, 1.5)]).cells).toEqual([0, 1, 11, 12]);
  });

  it('is independent of direction', () => {
    const line = [atCells(8.7, 1.2), atCells(1.1, 7.9), atCells(4.4, 4.4)];
    const forward = floodGridCellsOnPolyline(grid, line);
    const backward = floodGridCellsOnPolyline(grid, [...line].reverse());
    expect(backward).toEqual(forward);
  });

  it('keeps both end cells of a line through a cell corner', () => {
    const { cells } = floodGridCellsOnPolyline(grid, [atCells(0.5, 0.5), atCells(1.5, 1.5)]);
    expect(cells).toEqual(expect.arrayContaining([0, 11]));
    expect(cells.length).toBeGreaterThanOrEqual(3);
  });

  it('flags a line leaving the grid and keeps the cells inside', () => {
    const result = floodGridCellsOnPolyline(grid, [atCells(8.5, 5.5), atCells(11.5, 5.5)]);
    expect(result.outside).toBe(true);
    expect(result.cells).toEqual([58, 59]);
  });

  it('agrees with an exact segment-box oracle on random lines', () => {
    let seed = 12345;
    const random = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let run = 0; run < 200; run++) {
      const a = { x: random() * 10, y: random() * 10 };
      const b = { x: random() * 10, y: random() * 10 };
      const expected = new Set<number>();
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          // Liang-Barsky clip of segment a-b against the cell box [col, col+1] × [row, row+1].
          let t0 = 0;
          let t1 = 1;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const checks: [number, number][] = [
            [-dx, a.x - col],
            [dx, col + 1 - a.x],
            [-dy, a.y - row],
            [dy, row + 1 - a.y],
          ];
          let hit = true;
          for (const [p, q] of checks) {
            if (p === 0) {
              if (q < 0) hit = false;
            } else {
              const r = q / p;
              if (p < 0) t0 = Math.max(t0, r);
              else t1 = Math.min(t1, r);
            }
          }
          if (hit && t0 <= t1) expected.add(row * 10 + col);
        }
      }
      const { cells } = floodGridCellsOnPolyline(grid, [atCells(a.x, a.y), atCells(b.x, b.y)]);
      expect(cells).toEqual([...expected].sort((x, y) => x - y));
    }
  });
});

// ---------------------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------------------

describe('input parsers', () => {
  const goodStation = {
    stationId: 'sm1',
    name: 'San Mateo-1',
    lat: 14.69,
    lng: 121.12,
    alertMeters: 18,
    alarmMeters: 19,
    criticalMeters: 20,
    baselineMeters: null,
    datum: 'MSL',
    intervalSeconds: null,
  };

  it('accepts a station set, sorts it and keeps unverified provenance null', () => {
    const parsed = parseSensorStationSet({ schemaVersion: 1, verification: null, stations: [{ ...goodStation, stationId: 'z' }, goodStation] });
    expect(parsed.ok && parsed.value.verification).toBeNull();
    expect(parsed.ok && parsed.value.stations.map(s => s.stationId)).toEqual(['sm1', 'z']);
  });

  it.each([
    ['wrong schema', { schemaVersion: 2, verification: null, stations: [] }],
    ['unordered thresholds', { schemaVersion: 1, verification: null, stations: [{ ...goodStation, alarmMeters: 17 }] }],
    ['equal alert and critical', { schemaVersion: 1, verification: null, stations: [{ ...goodStation, alertMeters: 20, alarmMeters: 20 }] }],
    ['non-finite coordinate', { schemaVersion: 1, verification: null, stations: [{ ...goodStation, lat: Number.NaN }] }],
    ['duplicate ids', { schemaVersion: 1, verification: null, stations: [goodStation, goodStation] }],
    ['zero interval', { schemaVersion: 1, verification: null, stations: [{ ...goodStation, intervalSeconds: 0 }] }],
    ['verification without reviewer', { schemaVersion: 1, verification: { source: 's', verifiedOn: '2026-10-14', reviewer: '' }, stations: [] }],
    ['baseline too low to admit Critical readings', { schemaVersion: 1, verification: null, stations: [{ ...goodStation, baselineMeters: 14.9 }] }],
    ['bad id', { schemaVersion: 1, verification: null, stations: [{ ...goodStation, stationId: 'has space' }] }],
  ])('rejects a station set with %s', (_label, value) => {
    expect(parseSensorStationSet(value).ok).toBe(false);
  });

  it('parses terrain metadata and the explicit "no terrain" marker', () => {
    expect(parseTerrainMetadata({ schemaVersion: 1, terrain: null })).toEqual({ ok: true, value: null });
    expect(parseTerrainMetadata({ schemaVersion: 1, terrain: { source: 'x', licensed: true, verticalDatum: 'MSL', verticalRmseMeters: 0.3 } }).ok).toBe(true);
    expect(parseTerrainMetadata({ schemaVersion: 1, terrain: { source: 'x', licensed: 'yes', verticalDatum: 'MSL', verticalRmseMeters: 0.3 } }).ok).toBe(false);
    expect(parseTerrainMetadata({ schemaVersion: 1, terrain: { source: 'x', licensed: true, verticalDatum: 'MSL', verticalRmseMeters: -1 } }).ok).toBe(false);
  });

  it('parses a feed with ISO timestamps and refuses malformed readings', () => {
    const ok = parseSensorFeed({ schemaVersion: 1, source: 'relay', readings: [{ stationId: 'sm1', levelMeters: 17.5, observedAt: '2026-10-14T06:00:00+08:00', datum: 'MSL' }] });
    expect(ok.ok && ok.value.readings[0].observedAt).toBe(Date.parse('2026-10-13T22:00:00Z'));
    const bad = (reading: unknown) => parseSensorFeed({ schemaVersion: 1, source: 'relay', readings: [reading] }).ok;
    expect(bad({ stationId: 'sm1', levelMeters: '17.5', observedAt: '2026-10-14T06:00:00Z', datum: 'MSL' })).toBe(false);
    expect(bad({ stationId: 'sm1', levelMeters: 17.5, observedAt: '14 Oct 2026', datum: 'MSL' })).toBe(false);
    expect(bad({ stationId: 'sm1', levelMeters: Number.POSITIVE_INFINITY, observedAt: '2026-10-14T06:00:00Z', datum: 'MSL' })).toBe(false);
    expect(parseSensorFeed({ schemaVersion: 1, source: 'relay', readings: Array.from({ length: 201 }, () => ({})) }).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------
// RRL §7.4 validators
// ---------------------------------------------------------------------------------------

describe('validateStationReading', () => {
  const s = station('a', 0, 0);

  it('accepts a fresh, in-range reading with no history', () => {
    const result = validateStationReading(s, reading('a', 16), [], NOW);
    expect(result).toMatchObject({ status: 'accepted', levelMeters: 16, rawLevelMeters: 16, reasons: [] });
  });

  it('treats a missing reading as unknown, never dry', () => {
    expect(validateStationReading(s, null, [], NOW)).toMatchObject({ status: 'unknown', levelMeters: null, reasons: ['missing'] });
  });

  it('rejects a datum mismatch', () => {
    expect(validateStationReading(s, reading('a', 16, 1, 'OTHER'), [], NOW).reasons).toEqual(['datum_mismatch']);
  });

  it('applies the ±5 m range check inclusively', () => {
    expect(validateStationReading(s, reading('a', 22), [], NOW).status).toBe('accepted');
    expect(validateStationReading(s, reading('a', 22.01), [], NOW).reasons).toEqual(['out_of_range']);
    expect(validateStationReading(s, reading('a', 11.99), [], NOW).reasons).toEqual(['out_of_range']);
  });

  it('applies staleness at ten declared intervals', () => {
    expect(validateStationReading(s, reading('a', 16, 100), [], NOW).status).toBe('accepted');
    expect(validateStationReading(s, reading('a', 16, 101), [], NOW).reasons).toEqual(['stale']);
  });

  it('rejects a reading from the future but tolerates small clock skew', () => {
    expect(validateStationReading(s, { ...reading('a', 16), observedAt: NOW + 30_000 }, [], NOW).status).toBe('accepted');
    expect(validateStationReading(s, { ...reading('a', 16), observedAt: NOW + 5 * MINUTE }, [], NOW).reasons).toEqual(['future']);
  });

  it('cannot judge a reading without a verified cadence or baseline, so it stays unknown', () => {
    expect(validateStationReading(station('a', 0, 0, { intervalSeconds: null }), reading('a', 16), [], NOW).reasons).toEqual(['cadence_unverified']);
    expect(validateStationReading(station('a', 0, 0, { baselineMeters: null }), reading('a', 16), [], NOW).reasons).toEqual(['baseline_unverified']);
  });

  it('flags a change above 2 m within one cadence window and scales longer gaps', () => {
    const previous = { stationId: 'a', observedAt: NOW - 11 * MINUTE, levelMeters: 15 };
    // Declared cadence 600 s: 10 min after the previous reading the allowance is 2 m.
    expect(validateStationReading(s, reading('a', 16.9, 1), [{ ...previous, observedAt: NOW - 11 * MINUTE }], NOW).reasons).toEqual([]);
    expect(validateStationReading(s, reading('a', 17.5, 1), [{ ...previous, observedAt: NOW - 3 * MINUTE }], NOW).reasons).toEqual(['jump']);
    // A 30-minute gap triples the allowance: 5 m is within 6 m, 7 m is not.
    expect(validateStationReading(s, reading('a', 20, 1), [{ ...previous, observedAt: NOW - 31 * MINUTE }], NOW).reasons).toEqual([]);
  });

  it('uses the 30 s window when no longer cadence is declared', () => {
    const fast = station('a', 0, 0, { intervalSeconds: 30 });
    const previous = { stationId: 'a', observedAt: NOW - 30_000 - 5_000, levelMeters: 15 };
    expect(validateStationReading(fast, { ...reading('a', 17.5), observedAt: NOW - 5_000 }, [previous], NOW).reasons).toEqual(['jump']);
    expect(validateStationReading(fast, { ...reading('a', 16.5), observedAt: NOW - 5_000 }, [previous], NOW).reasons).toEqual([]);
  });

  it('flags a statistical outlier against a steady recent history, but not a gradual rise', () => {
    const steady = Array.from({ length: SENSOR_VALIDATION.minHistoryForOutliers }, (_, i) => ({
      stationId: 'a',
      observedAt: NOW - (20 + i * 10) * MINUTE,
      levelMeters: 15 + (i % 2) * 0.05,
    }));
    // 1.9 m above the median passes the 2 m jump check but is a robust outlier.
    const outlier = validateStationReading(s, reading('a', 16.95, 10), steady, NOW);
    expect(outlier.reasons).toEqual(['outlier']);
    expect(validateStationReading(s, reading('a', 15.4, 10), steady, NOW).status).toBe('accepted');

    const rising = Array.from({ length: 8 }, (_, i) => ({ stationId: 'a', observedAt: NOW - (90 - i * 10) * MINUTE, levelMeters: 15 + i * 0.3 }));
    expect(validateStationReading(s, reading('a', 17.4, 10), rising, NOW).status).toBe('accepted');
  });

  it('ignores history of other stations and of later times', () => {
    const history = [
      { stationId: 'other', observedAt: NOW - 2 * MINUTE, levelMeters: 5 },
      { stationId: 'a', observedAt: NOW + MINUTE, levelMeters: 5 },
    ];
    expect(validateStationReading(s, reading('a', 16), history, NOW).status).toBe('accepted');
  });
});

// ---------------------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------------------

describe('buildSensorSnapshot', () => {
  const set = verifiedSet([station('a', 0, 0), station('b', 5, 5)]);

  it('has one observation per configured station and reports unconfigured readings', () => {
    const snapshot = buildSensorSnapshot(set, feed(reading('a', 16), reading('zzz', 16)), [], NOW);
    expect(snapshot.stations.map(o => [o.stationId, o.status])).toEqual([['a', 'accepted'], ['b', 'unknown']]);
    expect(snapshot.stations[1].reasons).toEqual(['missing']);
    expect(snapshot.unconfiguredStationIds).toEqual(['zzz']);
  });

  it('is deterministic, order independent and sensitive to inputs and time', () => {
    const one = buildSensorSnapshot(set, feed(reading('a', 16), reading('b', 17)), [], NOW);
    const two = buildSensorSnapshot(set, feed(reading('b', 17), reading('a', 16)), [], NOW);
    expect(two).toEqual(one);
    expect(one.snapshotId).toMatch(/^[0-9a-f]{64}$/);
    expect(buildSensorSnapshot(set, feed(reading('a', 16.1), reading('b', 17)), [], NOW).snapshotId).not.toBe(one.snapshotId);
    expect(buildSensorSnapshot(set, feed(reading('a', 16), reading('b', 17)), [], NOW + 1000).snapshotId).not.toBe(one.snapshotId);
  });

  it('keeps the newest of duplicate readings', () => {
    const snapshot = buildSensorSnapshot(set, feed(reading('a', 16, 5), reading('a', 17, 1)), [], NOW);
    expect(snapshot.stations[0].levelMeters).toBe(17);
  });

  it('is immutable', () => {
    const snapshot = buildSensorSnapshot(set, feed(reading('a', 16)), [], NOW);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.stations)).toBe(true);
    expect(Object.isFrozen(snapshot.stations[0])).toBe(true);
    expect(() => {
      (snapshot.stations[0] as { status: string }).status = 'unknown';
    }).toThrow(TypeError);
  });

  it('treats a failed source as every station unknown', () => {
    const snapshot = buildSensorSnapshot(set, null, [], NOW);
    expect(snapshot.source).toBeNull();
    expect(snapshot.stations.every(o => o.status === 'unknown' && o.levelMeters === null)).toBe(true);
  });
});

describe('mergeSensorHistory', () => {
  it('deduplicates by station and time, newest first, bounded per station', () => {
    const previous = Array.from({ length: 20 }, (_, i) => ({ stationId: 'a', observedAt: NOW - (i + 5) * MINUTE, levelMeters: 15 }));
    const merged = mergeSensorHistory(previous, feed(reading('a', 16, 1), reading('a', 15, 5)));
    expect(merged).toHaveLength(SENSOR_VALIDATION.historyLimit);
    expect(merged[0].observedAt).toBe(NOW - MINUTE);
    expect(merged.filter(p => p.observedAt === NOW - 5 * MINUTE)).toHaveLength(1);
    expect(mergeSensorHistory(previous, null).length).toBe(SENSOR_VALIDATION.historyLimit);
  });
});

// ---------------------------------------------------------------------------------------
// Grid eligibility
// ---------------------------------------------------------------------------------------

describe('assessFloodGridEligibility', () => {
  const grid = makeGrid(() => 12);
  const set = verifiedSet([station('a', 0, 0), station('b', 5, 5)]);
  const ids = ['a', 'b'];

  it('is eligible with verified stations, licensed matching-datum terrain and fine accuracy', () => {
    const result = assessFloodGridEligibility(grid, set, TERRAIN, ids);
    expect(result).toMatchObject({ eligible: true, reasons: [], knownElevationShare: 1, minThresholdSpanMeters: 2, toleratedRmseMeters: 0.5 });
  });

  it('lists every missing input at once', () => {
    const result = assessFloodGridEligibility(makeGrid(() => null), { verification: null, stations: [] }, null, []);
    expect(result.reasons).toEqual(['no_stations', 'stations_unverified', 'no_known_elevation', 'terrain_missing']);
    expect(result.eligible).toBe(false);
    expect(result.knownElevationShare).toBe(0);
  });

  it('rejects unlicensed, datum-mismatched, unmeasured and coarse terrain', () => {
    expect(assessFloodGridEligibility(grid, set, { ...TERRAIN, licensed: false }, ids).reasons).toEqual(['terrain_unlicensed']);
    expect(assessFloodGridEligibility(grid, set, { ...TERRAIN, verticalDatum: 'OTHER' }, ids).reasons).toEqual(['datum_mismatch']);
    expect(assessFloodGridEligibility(grid, set, { ...TERRAIN, verticalRmseMeters: null }, ids).reasons).toEqual(['accuracy_unknown']);
    // An SRTM-class error against a 2 m Alert→Critical span.
    expect(assessFloodGridEligibility(grid, set, { ...TERRAIN, verticalRmseMeters: 5 }, ids).reasons).toEqual(['accuracy_too_coarse']);
    // Exactly the tolerated error is accepted.
    expect(assessFloodGridEligibility(grid, set, { ...TERRAIN, verticalRmseMeters: 0.5 }, ids).eligible).toBe(true);
  });

  it('uses the tightest station span as the yardstick', () => {
    const tight = verifiedSet([station('a', 0, 0, { alertMeters: 19.5, alarmMeters: 19.8 }), station('b', 5, 5)]);
    const result = assessFloodGridEligibility(grid, tight, { ...TERRAIN, verticalRmseMeters: 0.2 }, ids);
    expect(result.minThresholdSpanMeters).toBeCloseTo(0.5);
    expect(result.reasons).toEqual(['accuracy_too_coarse']);
  });

  it('requires the station set to match the pack the grid was built with', () => {
    expect(assessFloodGridEligibility(grid, set, TERRAIN, ['a']).reasons).toEqual(['stations_not_in_pack']);
  });

  it('rejects a grid with the wrong elevation count', () => {
    const broken: FloodGrid = { ...grid, elevations: grid.elevations.slice(1) };
    expect(assessFloodGridEligibility(broken, set, TERRAIN, ids).reasons).toContain('grid_invalid');
  });
});

// ---------------------------------------------------------------------------------------
// Road compilation
// ---------------------------------------------------------------------------------------

describe('compileRoadFlooding', () => {
  const grid = makeGrid((col, row) => (col === 9 && row === 9 ? null : 10));
  const flooded = [22, 23];

  it('floods an edge whose full geometry touches a flooded cell, even only at its tail', () => {
    const road = edge('r', [atCells(0.5, 2.5), atCells(2.5, 2.5)]);
    const clipped = edge('clip', [atCells(0.5, 0.5), atCells(1.5, 2.5), atCells(2.2, 2.9)]);
    const dry = edge('dry', [atCells(0.5, 5.5), atCells(4.5, 5.5)]);
    expect(compileRoadFlooding([road, clipped, dry], grid, flooded).floodedEdgeIds).toEqual(['clip', 'r']);
  });

  it('never floods a bridge deck from cells beneath it, and lists it for review', () => {
    const deck = edge('deck', [atCells(2.5, 1.5), atCells(2.5, 3.5)], true);
    const result = compileRoadFlooding([deck], grid, flooded);
    expect(result).toMatchObject({ floodedEdgeIds: [], bridgeDeckEdgeIds: ['deck'], bridgeDecksOverFloodedCells: ['deck'] });
  });

  it('marks edges over terrain-unknown cells or off the grid unknown, not dry', () => {
    const over = edge('over', [atCells(8.5, 9.5), atCells(9.5, 9.5)]);
    const off = edge('off', [atCells(5.5, 5.5), atCells(12, 5.5)]);
    const result = compileRoadFlooding([over, off], grid, flooded);
    expect(result.unknownEdgeIds).toEqual(['off', 'over']);
    expect(result.floodedEdgeIds).toEqual([]);
  });

  it('is independent of edge input order', () => {
    const a = edge('a', [atCells(0.5, 2.5), atCells(2.5, 2.5)]);
    const b = edge('b', [atCells(0.5, 6.5), atCells(2.5, 6.5)]);
    expect(compileRoadFlooding([b, a], grid, flooded)).toEqual(compileRoadFlooding([a, b], grid, flooded));
  });
});

// ---------------------------------------------------------------------------------------
// Shadow run
// ---------------------------------------------------------------------------------------

describe('runFloodShadow', () => {
  // Low ground (10 m) everywhere except a 25 m ridge along column 5.
  const grid = makeGrid(col => (col === 5 ? 25 : 10));
  const roads = [
    edge('west', [atCells(0.5, 2.5), atCells(4.5, 2.5)]),
    edge('east', [atCells(5.5, 2.5), atCells(9.5, 2.5)]),
  ];

  function run(set: SensorStationSet, readings: RawSensorReading[], overrides: Partial<Parameters<typeof runFloodShadow>[0]> = {}, sourceFeed: SensorFeed | null = feed(...readings)) {
    const snapshot = buildSensorSnapshot(set, sourceFeed, [], NOW);
    return runFloodShadow({
      areaId: 'ampid-1',
      graphVersion: 'ampid-1@2026-10-12#fc7101b6227d',
      edges: roads,
      grid,
      gridSha256: 'f'.repeat(64),
      packStationIds: set.stations.map(s => s.stationId),
      stationSet: set,
      terrain: TERRAIN,
      snapshot,
      sourceStatus: sourceFeed === null ? 'failed' : 'ok',
      ...overrides,
    });
  }

  it('seeds a station at Critical, floods the low ground up to the ridge and flags the roads', () => {
    const set = verifiedSet([station('a', 1, 1)]);
    const report = run(set, [reading('a', 20)]);
    expect(report.modelStatus).toBe('ok');
    expect(report.seeds).toEqual([{ stationId: 'a', cell: 11, surfaceMeters: 20 }]);
    // Columns 0-4 flood (elevation 10 ≤ 20); the 25 m ridge blocks the east side.
    expect(report.floodedCells).toHaveLength(50);
    expect(report.floodedCells.every(cell => cell % 10 < 5)).toBe(true);
    expect(report.roads.floodedEdgeIds).toEqual(['west']);
    expect(report.residentInfluence).toBe('none');
    expect(report.inputObservedAt).toEqual({ oldest: NOW - MINUTE, newest: NOW - MINUTE });
  });

  it('does not seed below Critical and says so', () => {
    const report = run(verifiedSet([station('a', 1, 1)]), [reading('a', 19.5)]);
    expect(report.seeds).toEqual([]);
    expect(report.ignored).toEqual([{ stationId: 'a', reason: 'below_critical' }]);
    expect(report.floodedCells).toEqual([]);
    expect(report.modelStatus).toBe('ok');
  });

  it('reports stale, flagged, missing and out-of-grid stations and degrades the model', () => {
    const set = verifiedSet([
      station('fresh', 1, 1),
      station('stale', 2, 1),
      station('flagged', 3, 1),
      station('missing', 4, 1),
      { ...station('away', 0, 0), ...{ lat: 14.9, lng: 121.5 } },
    ]);
    const report = run(set, [reading('fresh', 20.5), reading('stale', 20.5, 500), reading('flagged', 26), reading('away', 20.5)]);
    const reasons = Object.fromEntries(report.ignored.map(i => [i.stationId, i.reason]));
    expect(reasons).toEqual({ stale: 'stale', flagged: 'flagged', missing: 'missing', away: 'out_of_grid' });
    expect(report.seeds.map(s => s.stationId)).toEqual(['fresh']);
    expect(report.modelStatus).toBe('degraded');
  });

  it('unions multiple seeds with different surfaces regardless of input order', () => {
    // A 20.25 m ridge: the 20.5 m seed crosses it, the 20 m seed alone does not.
    const lowRidge = makeGrid(col => (col === 5 ? 20.25 : 10));
    const a = station('hi', 9, 5);
    const b = station('lo', 0, 5);
    const forward = run(verifiedSet([a, b]), [reading('hi', 20.5), reading('lo', 20)], { grid: lowRidge });
    const reversed = run(verifiedSet([b, a]), [reading('lo', 20), reading('hi', 20.5)], { grid: lowRidge });
    expect(forward.floodedCells).toHaveLength(100);
    expect(reversed).toEqual(forward);
    expect(forward.seeds.map(s => s.stationId)).toEqual(['hi', 'lo']);
  });

  it('is byte-reproducible for equal inputs and changes its hash with the readings', () => {
    const set = verifiedSet([station('a', 1, 1)]);
    const first = run(set, [reading('a', 20)]);
    const second = run(set, [reading('a', 20)]);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.reportHash).toMatch(/^[0-9a-f]{64}$/);
    expect(run(set, [reading('a', 21)]).reportHash).not.toBe(first.reportHash);
  });

  it('keeps the model unavailable (and runs no BFS) while terrain is missing or the station set is unverified', () => {
    const set = verifiedSet([station('a', 1, 1)]);
    const noTerrain = run(set, [reading('a', 20)], { terrain: null });
    expect(noTerrain.modelStatus).toBe('unavailable');
    expect(noTerrain.eligibility.reasons).toEqual(['terrain_missing']);
    expect(noTerrain.floodedCells).toEqual([]);
    expect(noTerrain.roads.floodedEdgeIds).toEqual([]);
    expect(noTerrain.stations[0].status).toBe('accepted');

    const unverified = run({ ...set, verification: null }, [reading('a', 20)]);
    expect(unverified.modelStatus).toBe('unavailable');
    expect(unverified.eligibility.reasons).toEqual(['stations_unverified']);
  });

  it('is unavailable, with every station unknown, when the source failed', () => {
    const report = run(verifiedSet([station('a', 1, 1)]), [], {}, null);
    expect(report.modelStatus).toBe('unavailable');
    expect(report.sourceStatus).toBe('failed');
    expect(report.stations[0]).toMatchObject({ status: 'unknown', levelMeters: null });
    expect(report.readings).toEqual([]);
  });

  it('degrades the model over unknown terrain and reports the unknown edges and cells', () => {
    const holed = makeGrid(col => (col === 7 ? null : 10));
    const beyond = edge('beyond', [atCells(7.5, 2.5), atCells(9.5, 2.5)]);
    const report = run(verifiedSet([station('a', 1, 1)]), [reading('a', 20)], { grid: holed, edges: [beyond] });
    expect(report.modelStatus).toBe('degraded');
    expect(report.unknownTerrainCells).toBe(10);
    expect(report.unknownFrontierCells.every(cell => cell % 10 === 7)).toBe(true);
    expect(report.roads.unknownEdgeIds).toEqual(['beyond']);
    // Unknown terrain stops the front: it is not assumed passable.
    expect(report.floodedCells.every(cell => cell % 10 < 7)).toBe(true);
  });

  it('feeds raw readings of flagged stations into the next run, so history sees them', () => {
    const report = run(verifiedSet([station('a', 1, 1)]), [reading('a', 26)]);
    expect(report.stations[0].status).toBe('unknown');
    expect(report.readings).toEqual([{ stationId: 'a', observedAt: NOW - MINUTE, levelMeters: 26 }]);
  });

  it('reports a grid the BFS cannot use as unavailable instead of throwing', () => {
    const wrongCell: FloodGrid = { ...grid, cellSizeMeters: 500 };
    const report = run(verifiedSet([station('a', 1, 1)]), [reading('a', 20)], { grid: wrongCell });
    expect(report.modelStatus).toBe('unavailable');
    expect(report.eligibility.eligible).toBe(false);
    expect(report.eligibility.reasons).toContain('grid_invalid');
  });
});

describe('with the real Ampid I pack', () => {
  const packDir = new URL('../../../../data/routing-packs/ampid-1/pack/', import.meta.url);
  const graph = JSON.parse(readFileSync(new URL('graph.json', packDir), 'utf8')) as RoutingGraph;
  const grid = JSON.parse(readFileSync(new URL('server/grid-ampid-fine.json', packDir), 'utf8')) as FloodGrid;

  it('has no terrain or stations, so the shadow model is unavailable and says why', () => {
    const set: SensorStationSet = { verification: null, stations: [] };
    const snapshot = buildSensorSnapshot(set, null, [], NOW);
    const report = runFloodShadow({
      areaId: 'ampid-1',
      graphVersion: graph.version,
      edges: graph.edges,
      grid,
      gridSha256: 'a'.repeat(64),
      packStationIds: [],
      stationSet: set,
      terrain: null,
      snapshot,
      sourceStatus: 'unconfigured',
    });
    expect(grid.cellSizeMeters).toBe(ROUTING_PROFILES['ampid-fine'].cellSizeMeters);
    expect(report.modelStatus).toBe('unavailable');
    expect(report.eligibility.reasons).toEqual(['no_stations', 'stations_unverified', 'no_known_elevation', 'terrain_missing']);
    expect(report.floodedCells).toEqual([]);
    expect(report.unknownTerrainCells).toBe(grid.cols * grid.rows);
  });

  it('compiles every real edge to a status without throwing, all unknown without terrain', () => {
    const compiled = compileRoadFlooding(graph.edges, grid, []);
    expect(compiled.floodedEdgeIds).toEqual([]);
    expect(compiled.unknownEdgeIds.length + compiled.bridgeDeckEdgeIds.length).toBe(graph.edges.length);
  });
});
