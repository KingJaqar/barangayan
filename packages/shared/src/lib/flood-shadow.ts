/**
 * Sensor ingestion and BFS shadow model (DRRM weather-routing plan, phase R8).
 *
 * Pure and server-side: validates station readings with the RRL §7.4 checks, freezes them
 * into an immutable snapshot, decides whether the flood grid may be trusted, runs the RRL's
 * BFS (`runFloodBfs`), and compiles flooded roads. The result is a **shadow report**: it is
 * stored and compared, never applied to a resident's route (plan 3.8 stages 3-4). Missing,
 * stale or flagged inputs are unknown, never dry.
 *
 * Runtime-agnostic and free of Node APIs, so Edge Functions import it by relative path
 * with the `.ts` extension (R0 bundling decision).
 */
import {
  ROUTING_PROFILES,
  floodGridCellsOnPolyline,
  runFloodBfs,
  type FloodGrid,
  type FloodStation,
  type RoutingEdge,
  type RoutingProfile,
} from './evacuation-routing.ts';

export const SHADOW_CONFIG_VERSION = '2026-10-14.r8';

/**
 * Validator constants. RRL §7.4 names the ±5 m range check and the 2 m / 30 s temporal check;
 * the rest are this plan's (staleness, plan 3.6) or provisional shadow-only values pending
 * PAGASA/DRRM review: the RRL only says "statistical outliers" and gives no parameters.
 */
export const SENSOR_VALIDATION = Object.freeze({
  /** RRL §7.4: reading within ±5 m of the station's historical baseline. */
  rangeMeters: 5,
  /** RRL §7.4: a change above this within one window is flagged. */
  maxChangeMeters: 2,
  /** RRL §7.4 window; scaled up to the station's declared cadence when that is longer. */
  changeWindowSeconds: 30,
  /** Plan 3.6: a reading is stale after this many declared intervals. */
  staleIntervals: 10,
  /** A reading timestamped further ahead than this is rejected (clock fault). */
  maxFutureSkewSeconds: 60,
  /** Recent readings needed before the statistical outlier test applies. */
  minHistoryForOutliers: 6,
  /** Robust z-score (|x - median| / (1.4826·MAD)) above which a reading is an outlier. */
  outlierScore: 3.5,
  /** Provisional: an outlier must also deviate from the recent median by at least this much. */
  outlierFloorMeters: 1,
  /** Recent readings kept per station for the temporal and outlier checks. */
  historyLimit: 12,
});

/**
 * Plan 3.2: a DEM justifies BFS only when its vertical error is small against the gauge level
 * spacing. Provisional ratio (the plan gives no number); DRRM/owner confirm before stage 3.
 */
export const TERRAIN_ACCURACY_SPAN_FRACTION = 0.25;

// ---------------------------------------------------------------------------------------
// Inputs: station set, terrain metadata, source feed
// ---------------------------------------------------------------------------------------

export interface SensorStationConfig {
  stationId: string;
  name: string;
  lat: number;
  lng: number;
  alertMeters: number;
  alarmMeters: number;
  criticalMeters: number;
  /** Historical baseline for the range check; null until supplied (then readings stay unknown). */
  baselineMeters: number | null;
  /** Vertical datum of thresholds and readings (for example "PHILVIDEM"); compared as text. */
  datum: string;
  /** Declared reading interval; null until confirmed against the source (then readings stay unknown). */
  intervalSeconds: number | null;
}

export interface SensorStationSet {
  /** Who verified positions and thresholds against which source, and when; null = not verified. */
  verification: { source: string; verifiedOn: string; reviewer: string } | null;
  stations: SensorStationConfig[];
}

export interface TerrainMetadata {
  source: string;
  licensed: boolean;
  /** Vertical datum of the grid elevations; must equal every station's datum. */
  verticalDatum: string;
  /** Documented vertical error (RMSE, meters); null when the provider states none. */
  verticalRmseMeters: number | null;
}

export interface RawSensorReading {
  stationId: string;
  levelMeters: number;
  /** Observation time, ms since epoch (kept separate from fetch time). */
  observedAt: number;
  datum: string;
}

export interface SensorFeed {
  source: string;
  readings: RawSensorReading[];
}

/** A raw reading kept between runs for the temporal and outlier checks. */
export interface SensorHistoryPoint {
  stationId: string;
  observedAt: number;
  levelMeters: number;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; issues: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown, max = 200): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= max;
}

const ID_PATTERN = /^[A-Za-z0-9:/._-]{1,80}$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const MAX_STATIONS = 50;
const MAX_FEED_READINGS = 200;

function parseIsoMs(value: unknown): number | null {
  if (typeof value !== 'string' || !ISO_PATTERN.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * `{ schemaVersion: 1, verification: {source, verifiedOn, reviewer} | null, stations: [...] }`.
 * Threshold order (alert ≤ alarm ≤ critical, alert < critical) and coordinates are checked
 * here, so every accepted station has usable thresholds. A baseline more than the range
 * check's 5 m below Critical is refused: it would flag real Critical readings as faulty.
 */
export function parseSensorStationSet(value: unknown): Parsed<SensorStationSet> {
  const issues: string[] = [];
  if (!isRecord(value) || value.schemaVersion !== 1) return { ok: false, issues: ['schema_version'] };
  let verification: SensorStationSet['verification'] = null;
  if (value.verification !== null) {
    const v = value.verification;
    if (!isRecord(v) || !isNonEmptyString(v.source) || !isNonEmptyString(v.reviewer) || typeof v.verifiedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.verifiedOn)) {
      issues.push('verification_invalid');
    } else verification = { source: v.source, verifiedOn: v.verifiedOn, reviewer: v.reviewer };
  }
  if (!Array.isArray(value.stations) || value.stations.length > MAX_STATIONS) return { ok: false, issues: [...issues, 'stations_invalid'] };
  const stations: SensorStationConfig[] = [];
  const ids = new Set<string>();
  value.stations.forEach((item: unknown, index) => {
    const at = `stations[${index}]`;
    if (!isRecord(item) || typeof item.stationId !== 'string' || !ID_PATTERN.test(item.stationId)) {
      issues.push(`${at}:invalid`);
      return;
    }
    if (ids.has(item.stationId)) issues.push(`${at}:duplicate_id`);
    ids.add(item.stationId);
    const { lat, lng, alertMeters, alarmMeters, criticalMeters, baselineMeters, intervalSeconds } = item;
    if (!isNonEmptyString(item.name) || !isNonEmptyString(item.datum, 40)) issues.push(`${at}:text_invalid`);
    else if (!isFiniteNumber(lat) || !isFiniteNumber(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) issues.push(`${at}:position_invalid`);
    else if (!isFiniteNumber(alertMeters) || !isFiniteNumber(alarmMeters) || !isFiniteNumber(criticalMeters)) issues.push(`${at}:thresholds_invalid`);
    else if (!(alertMeters <= alarmMeters && alarmMeters <= criticalMeters && alertMeters < criticalMeters)) issues.push(`${at}:thresholds_unordered`);
    else if (!(baselineMeters === null || isFiniteNumber(baselineMeters))) issues.push(`${at}:baseline_invalid`);
    else if (!(intervalSeconds === null || (isFiniteNumber(intervalSeconds) && intervalSeconds > 0 && intervalSeconds <= 86_400))) issues.push(`${at}:interval_invalid`);
    // The ±5 m range check must admit a genuine Critical reading, or the validator would drop
    // exactly the readings BFS exists for.
    else if (typeof baselineMeters === 'number' && criticalMeters > baselineMeters + SENSOR_VALIDATION.rangeMeters) issues.push(`${at}:baseline_excludes_critical`);
    else {
      stations.push({
        stationId: item.stationId,
        name: item.name as string,
        lat,
        lng,
        alertMeters,
        alarmMeters,
        criticalMeters,
        baselineMeters: baselineMeters as number | null,
        datum: item.datum as string,
        intervalSeconds: intervalSeconds as number | null,
      });
    }
  });
  if (issues.length > 0) return { ok: false, issues };
  stations.sort((a, b) => (a.stationId < b.stationId ? -1 : a.stationId > b.stationId ? 1 : 0));
  return { ok: true, value: { verification, stations } };
}

/** `{ schemaVersion: 1, terrain: { source, licensed, verticalDatum, verticalRmseMeters } | null }`. */
export function parseTerrainMetadata(value: unknown): Parsed<TerrainMetadata | null> {
  if (!isRecord(value) || value.schemaVersion !== 1) return { ok: false, issues: ['schema_version'] };
  if (value.terrain === null) return { ok: true, value: null };
  const t = value.terrain;
  if (!isRecord(t) || !isNonEmptyString(t.source) || typeof t.licensed !== 'boolean' || !isNonEmptyString(t.verticalDatum, 40)) {
    return { ok: false, issues: ['terrain_invalid'] };
  }
  const rmse = t.verticalRmseMeters;
  if (!(rmse === null || (isFiniteNumber(rmse) && rmse >= 0))) return { ok: false, issues: ['terrain_rmse_invalid'] };
  return { ok: true, value: { source: t.source, licensed: t.licensed, verticalDatum: t.verticalDatum, verticalRmseMeters: rmse as number | null } };
}

/**
 * The reviewed feed contract any permitted source adapter produces:
 * `{ schemaVersion: 1, source, readings: [{ stationId, levelMeters, observedAt (ISO), datum }] }`.
 * A live PAGASA adapter is not built: its access terms and format are unverified (R8 notes).
 */
export function parseSensorFeed(value: unknown): Parsed<SensorFeed> {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isNonEmptyString(value.source) || !Array.isArray(value.readings)) {
    return { ok: false, issues: ['feed_shape'] };
  }
  if (value.readings.length > MAX_FEED_READINGS) return { ok: false, issues: ['feed_too_large'] };
  const issues: string[] = [];
  const readings: RawSensorReading[] = [];
  value.readings.forEach((item: unknown, index) => {
    const observedAt = isRecord(item) ? parseIsoMs(item.observedAt) : null;
    if (!isRecord(item) || typeof item.stationId !== 'string' || !ID_PATTERN.test(item.stationId) || !isFiniteNumber(item.levelMeters) || observedAt === null || !isNonEmptyString(item.datum, 40)) {
      issues.push(`readings[${index}]:invalid`);
      return;
    }
    readings.push({ stationId: item.stationId, levelMeters: item.levelMeters, observedAt, datum: item.datum });
  });
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: { source: value.source, readings } };
}

// ---------------------------------------------------------------------------------------
// RRL §7.4 validators and the immutable snapshot
// ---------------------------------------------------------------------------------------

export type ReadingRejection =
  | 'missing'
  | 'datum_mismatch'
  | 'cadence_unverified'
  | 'baseline_unverified'
  | 'future'
  | 'stale'
  | 'out_of_range'
  | 'jump'
  | 'outlier';

export interface StationObservation {
  stationId: string;
  /** accepted: usable as a BFS seed input; unknown: never treated as dry. */
  status: 'accepted' | 'unknown';
  /** Accepted level only; null whenever the reading is unknown. */
  levelMeters: number | null;
  /** The raw reading (accepted or not) for reporting and the next run's history. */
  rawLevelMeters: number | null;
  observedAt: number | null;
  reasons: ReadingRejection[];
}

export interface SensorSnapshot {
  /** SHA-256 of the canonical snapshot content: the same inputs and time give the same id. */
  readonly snapshotId: string;
  /** Evaluation time (ms): staleness is relative to it. */
  readonly evaluatedAt: number;
  readonly source: string | null;
  readonly configVersion: string;
  readonly stations: readonly Readonly<StationObservation>[];
  /** Feed readings for stations that are not configured; ignored and reported. */
  readonly unconfiguredStationIds: readonly string[];
}

function median(sorted: readonly number[]): number {
  const n = sorted.length;
  return n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function byObservedAtDescending(a: SensorHistoryPoint, b: SensorHistoryPoint): number {
  return b.observedAt - a.observedAt;
}

/**
 * Applies RRL §7.4 to one reading. `history` holds this station's earlier raw readings;
 * the newest one older than the reading drives the temporal check. A reading stays unknown
 * when it cannot be judged (no baseline, no confirmed cadence): missing information is
 * never a pass.
 */
export function validateStationReading(
  station: SensorStationConfig,
  reading: RawSensorReading | null,
  history: readonly SensorHistoryPoint[],
  now: number,
): StationObservation {
  if (reading === null) {
    return { stationId: station.stationId, status: 'unknown', levelMeters: null, rawLevelMeters: null, observedAt: null, reasons: ['missing'] };
  }
  const reasons: ReadingRejection[] = [];
  const { staleIntervals, maxFutureSkewSeconds, rangeMeters, maxChangeMeters, changeWindowSeconds } = SENSOR_VALIDATION;

  if (reading.datum !== station.datum) reasons.push('datum_mismatch');
  if (station.intervalSeconds === null) reasons.push('cadence_unverified');
  if (reading.observedAt > now + maxFutureSkewSeconds * 1000) reasons.push('future');
  else if (station.intervalSeconds !== null && now - reading.observedAt > staleIntervals * station.intervalSeconds * 1000) reasons.push('stale');

  if (station.baselineMeters === null) reasons.push('baseline_unverified');
  else if (Math.abs(reading.levelMeters - station.baselineMeters) > rangeMeters) reasons.push('out_of_range');

  const earlier = history
    .filter(point => point.stationId === station.stationId && point.observedAt < reading.observedAt)
    .sort(byObservedAtDescending);
  if (earlier.length > 0) {
    const previous = earlier[0];
    const windowSeconds = Math.max(changeWindowSeconds, station.intervalSeconds ?? 0);
    const elapsedSeconds = (reading.observedAt - previous.observedAt) / 1000;
    const allowed = maxChangeMeters * Math.max(1, elapsedSeconds / windowSeconds);
    if (Math.abs(reading.levelMeters - previous.levelMeters) > allowed) reasons.push('jump');
  }
  const recent = earlier.slice(0, SENSOR_VALIDATION.historyLimit).map(point => point.levelMeters).sort((a, b) => a - b);
  if (recent.length >= SENSOR_VALIDATION.minHistoryForOutliers) {
    const centre = median(recent);
    const deviations = recent.map(level => Math.abs(level - centre)).sort((a, b) => a - b);
    const robustSd = 1.4826 * median(deviations);
    const deviation = Math.abs(reading.levelMeters - centre);
    if (deviation >= SENSOR_VALIDATION.outlierFloorMeters && deviation > SENSOR_VALIDATION.outlierScore * robustSd) reasons.push('outlier');
  }

  const accepted = reasons.length === 0;
  return {
    stationId: station.stationId,
    status: accepted ? 'accepted' : 'unknown',
    levelMeters: accepted ? reading.levelMeters : null,
    rawLevelMeters: reading.levelMeters,
    observedAt: reading.observedAt,
    reasons,
  };
}

// --- SHA-256 (sync, so the whole core stays synchronous and identical on every runtime) ---

const SHA_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be,
  0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa,
  0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85,
  0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
  0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return bytes;
}

/** SHA-256 of a string's UTF-8 bytes, lowercase hex. */
export function sha256Hex(text: string): string {
  const bytes = utf8Bytes(text);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  bytes.push((high >>> 24) & 255, (high >>> 16) & 255, (high >>> 8) & 255, high & 255, (low >>> 24) & 255, (low >>> 16) & 255, (low >>> 8) & 255, low & 255);

  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      w[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + SHA_K[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  return [...h].map(word => word.toString(16).padStart(8, '0')).join('');
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * Freezes one evaluation of the station set against a feed: every configured station gets an
 * observation (a station without a reading is `missing`, never dry), duplicate readings keep
 * the newest, and readings of unconfigured stations are reported but unused. A feed that
 * failed or was never configured is `null`.
 */
export function buildSensorSnapshot(
  set: SensorStationSet,
  feed: SensorFeed | null,
  history: readonly SensorHistoryPoint[],
  now: number,
): SensorSnapshot {
  const configured = new Set(set.stations.map(s => s.stationId));
  const newest = new Map<string, RawSensorReading>();
  for (const reading of feed?.readings ?? []) {
    const current = newest.get(reading.stationId);
    if (current === undefined || reading.observedAt > current.observedAt) newest.set(reading.stationId, reading);
  }
  const ordered = [...set.stations].sort((x, y) => (x.stationId < y.stationId ? -1 : x.stationId > y.stationId ? 1 : 0));
  const stations = ordered.map(station => validateStationReading(station, newest.get(station.stationId) ?? null, history, now));
  const unconfiguredStationIds = [...newest.keys()].filter(id => !configured.has(id)).sort();
  const content = { configVersion: SHADOW_CONFIG_VERSION, evaluatedAt: now, source: feed?.source ?? null, stations, unconfiguredStationIds };
  return deepFreeze({ snapshotId: sha256Hex(JSON.stringify(content)), ...content });
}

/**
 * Merges readings from previous runs and the current feed into the history the validators
 * read: unique by station and observation time, newest first, bounded per station.
 */
export function mergeSensorHistory(previous: readonly SensorHistoryPoint[], feed: SensorFeed | null): SensorHistoryPoint[] {
  const byKey = new Map<string, SensorHistoryPoint>();
  const add = (point: SensorHistoryPoint): void => {
    byKey.set(`${point.stationId}\u0000${point.observedAt}`, { stationId: point.stationId, observedAt: point.observedAt, levelMeters: point.levelMeters });
  };
  previous.forEach(add);
  (feed?.readings ?? []).forEach(r => add({ stationId: r.stationId, observedAt: r.observedAt, levelMeters: r.levelMeters }));
  const perStation = new Map<string, SensorHistoryPoint[]>();
  for (const point of byKey.values()) {
    const list = perStation.get(point.stationId) ?? [];
    list.push(point);
    perStation.set(point.stationId, list);
  }
  const merged: SensorHistoryPoint[] = [];
  for (const id of [...perStation.keys()].sort()) {
    merged.push(...(perStation.get(id) ?? []).sort(byObservedAtDescending).slice(0, SENSOR_VALIDATION.historyLimit));
  }
  return merged;
}

// ---------------------------------------------------------------------------------------
// Grid eligibility (plan 3.2, 3.3: datum, terrain, accuracy against the gauge spacing)
// ---------------------------------------------------------------------------------------

export type GridIneligibleReason =
  | 'no_stations'
  | 'stations_unverified'
  | 'stations_not_in_pack'
  | 'terrain_missing'
  | 'terrain_unlicensed'
  | 'datum_mismatch'
  | 'accuracy_unknown'
  | 'accuracy_too_coarse'
  | 'no_known_elevation'
  | 'grid_invalid';

export interface GridEligibility {
  eligible: boolean;
  reasons: GridIneligibleReason[];
  /** Share of grid cells with a known elevation, 0..1. */
  knownElevationShare: number;
  /** Smallest Alert→Critical span among stations, the DEM accuracy yardstick; null without stations. */
  minThresholdSpanMeters: number | null;
  /** Largest vertical RMSE the rule tolerates for this span; null without stations. */
  toleratedRmseMeters: number | null;
}

/**
 * Decides whether BFS may be computed (even in shadow) from this grid. All reasons are
 * collected so DRRM sees everything missing at once. `packStationIds` are the stations the
 * routing pack was built with (verified positions); the set must match them.
 */
export function assessFloodGridEligibility(
  grid: FloodGrid,
  set: SensorStationSet,
  terrain: TerrainMetadata | null,
  packStationIds: readonly string[],
): GridEligibility {
  const reasons: GridIneligibleReason[] = [];
  if (set.stations.length === 0) reasons.push('no_stations');
  if (set.verification === null) reasons.push('stations_unverified');
  const expected = [...packStationIds].sort().join('\u0000');
  const actual = set.stations.map(s => s.stationId).sort().join('\u0000');
  if (set.stations.length > 0 && expected !== actual) reasons.push('stations_not_in_pack');

  const expectedCells = grid.cols * grid.rows;
  const gridValid =
    Number.isInteger(grid.cols) && Number.isInteger(grid.rows) && grid.cols > 0 && grid.rows > 0 && grid.elevations.length === expectedCells;
  if (!gridValid) reasons.push('grid_invalid');
  const known = gridValid ? grid.elevations.reduce<number>((count, e) => count + (e !== null && Number.isFinite(e) ? 1 : 0), 0) : 0;
  const knownElevationShare = expectedCells > 0 && gridValid ? known / expectedCells : 0;
  if (gridValid && known === 0) reasons.push('no_known_elevation');

  const spans = set.stations.map(s => s.criticalMeters - s.alertMeters);
  const minThresholdSpanMeters = spans.length > 0 ? Math.min(...spans) : null;
  const toleratedRmseMeters = minThresholdSpanMeters === null ? null : minThresholdSpanMeters * TERRAIN_ACCURACY_SPAN_FRACTION;

  if (terrain === null) reasons.push('terrain_missing');
  else {
    if (!terrain.licensed) reasons.push('terrain_unlicensed');
    if (set.stations.some(s => s.datum !== terrain.verticalDatum)) reasons.push('datum_mismatch');
    if (terrain.verticalRmseMeters === null) reasons.push('accuracy_unknown');
    else if (toleratedRmseMeters !== null && terrain.verticalRmseMeters > toleratedRmseMeters) reasons.push('accuracy_too_coarse');
  }
  return { eligible: reasons.length === 0, reasons, knownElevationShare, minThresholdSpanMeters, toleratedRmseMeters };
}

// ---------------------------------------------------------------------------------------
// Road compilation (plan 3.4) and the shadow report
// ---------------------------------------------------------------------------------------

export interface CompiledRoadFlooding {
  /** Edges whose full geometry touches a BFS-flooded cell (bridge decks excluded). */
  floodedEdgeIds: string[];
  /** Edges touching terrain-unknown cells or leaving the grid: not dry, not flooded. */
  unknownEdgeIds: string[];
  /** Bridge decks: river cells beneath do not establish deck flooding, so none is assessed. */
  bridgeDeckEdgeIds: string[];
  /** Bridge decks lying over flooded cells, listed for DRRM review only. */
  bridgeDecksOverFloodedCells: string[];
}

/**
 * Compiles per-edge status from the grid and BFS result. An edge is flooded when any cell its
 * geometry crosses is flooded; terrain-unknown cells make it unknown instead. Bridge decks are
 * never flooded by cells alone (the RRL gives no cell-to-road mapping, plan D5); their
 * approaches are ordinary edges and are assessed as such.
 */
export function compileRoadFlooding(
  edges: readonly RoutingEdge[],
  grid: FloodGrid,
  floodedCells: readonly number[],
): CompiledRoadFlooding {
  const flooded = new Set(floodedCells);
  const out: CompiledRoadFlooding = { floodedEdgeIds: [], unknownEdgeIds: [], bridgeDeckEdgeIds: [], bridgeDecksOverFloodedCells: [] };
  for (const edge of [...edges].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const { cells, outside } = floodGridCellsOnPolyline(grid, edge.geometry);
    const overFlooded = cells.some(cell => flooded.has(cell));
    if (edge.bridge) {
      out.bridgeDeckEdgeIds.push(edge.id);
      if (overFlooded) out.bridgeDecksOverFloodedCells.push(edge.id);
      continue;
    }
    if (overFlooded) out.floodedEdgeIds.push(edge.id);
    else if (outside || cells.some(cell => grid.elevations[cell] === null || grid.elevations[cell] === undefined)) out.unknownEdgeIds.push(edge.id);
  }
  return out;
}

export type ShadowIgnoredReason =
  | 'out_of_grid'
  | 'invalid_position'
  | 'below_critical'
  | 'missing'
  | 'stale'
  | 'flagged'
  | 'unverified_input';

export type ShadowModelStatus = 'unavailable' | 'degraded' | 'ok';

export type ShadowSourceStatus = 'ok' | 'unconfigured' | 'failed' | 'invalid';

export interface ShadowRunInput {
  areaId: string;
  graphVersion: string;
  edges: readonly RoutingEdge[];
  grid: FloodGrid;
  /** SHA-256 of the grid resource from the verified manifest. */
  gridSha256: string;
  /** Station ids the pack's station-to-edge table was built with. */
  packStationIds: readonly string[];
  stationSet: SensorStationSet;
  terrain: TerrainMetadata | null;
  snapshot: SensorSnapshot;
  sourceStatus: ShadowSourceStatus;
  profile?: RoutingProfile;
}

export interface ShadowReport {
  schemaVersion: 1;
  areaId: string;
  graphVersion: string;
  profile: RoutingProfile['id'];
  configVersion: string;
  gridSha256: string;
  snapshotId: string;
  evaluatedAt: number;
  sourceStatus: ShadowSourceStatus;
  /** Always `none`: sensor penalties and BFS exclusions stay disabled for residents (plan 3.8). */
  residentInfluence: 'none';
  modelStatus: ShadowModelStatus;
  eligibility: GridEligibility;
  /** Oldest and newest observation among accepted readings; null when none were accepted. */
  inputObservedAt: { oldest: number; newest: number } | null;
  stations: StationObservation[];
  unconfiguredStationIds: string[];
  seeds: { stationId: string; cell: number; surfaceMeters: number }[];
  ignored: { stationId: string; reason: ShadowIgnoredReason }[];
  floodedCells: number[];
  /** Frontier cells next to the flood whose terrain is missing. */
  unknownFrontierCells: number[];
  /** Cells without terrain, the share of the grid that BFS cannot judge. */
  unknownTerrainCells: number;
  gridCells: number;
  roads: CompiledRoadFlooding;
  /** Raw readings of this run, replayed as the next run's validator history. */
  readings: SensorHistoryPoint[];
  /** SHA-256 of the report without this field; equal inputs give an equal hash. */
  reportHash: string;
}

function ignoredReasonFor(observation: StationObservation | undefined): ShadowIgnoredReason {
  if (observation === undefined) return 'missing';
  if (observation.reasons.includes('missing')) return 'missing';
  if (observation.reasons.includes('stale') || observation.reasons.includes('future')) return 'stale';
  if (observation.reasons.some(r => r === 'out_of_range' || r === 'jump' || r === 'outlier')) return 'flagged';
  return 'unverified_input';
}

/**
 * Runs the shadow model for one frozen snapshot. Deterministic: the same inputs give a
 * byte-identical report (and `reportHash`). Never throws on missing inputs; they make the
 * model unavailable and are reported.
 */
export function runFloodShadow(input: ShadowRunInput): ShadowReport {
  const profile = input.profile ?? ROUTING_PROFILES['ampid-fine'];
  const { snapshot, grid } = input;
  let eligibility = assessFloodGridEligibility(grid, input.stationSet, input.terrain, input.packStationIds);
  const observations = new Map(snapshot.stations.map(o => [o.stationId, o]));
  const gridCells = grid.cols * grid.rows;
  const accepted = snapshot.stations.filter(o => o.status === 'accepted' && o.observedAt !== null);
  const inputObservedAt =
    accepted.length === 0
      ? null
      : {
          oldest: Math.min(...accepted.map(o => o.observedAt as number)),
          newest: Math.max(...accepted.map(o => o.observedAt as number)),
        };

  let seeds: ShadowReport['seeds'] = [];
  let ignored: ShadowReport['ignored'] = [];
  let floodedCells: number[] = [];
  let unknownFrontierCells: number[] = [];
  let roads: CompiledRoadFlooding = { floodedEdgeIds: [], unknownEdgeIds: [], bridgeDeckEdgeIds: [], bridgeDecksOverFloodedCells: [] };
  let unknownTerrainCells = gridCells;
  let modelStatus: ShadowModelStatus = 'unavailable';

  if (eligibility.eligible) {
    unknownTerrainCells = grid.elevations.reduce<number>((count, e) => count + (e === null || !Number.isFinite(e) ? 1 : 0), 0);
    const stations: FloodStation[] = input.stationSet.stations.map(s => ({
      stationId: s.stationId,
      lat: s.lat,
      lng: s.lng,
      levelMeters: observations.get(s.stationId)?.levelMeters ?? null,
      criticalMeters: s.criticalMeters,
    }));
    const bfs = runFloodBfs(grid, stations, profile);
    if (bfs.ok) {
      seeds = bfs.result.seeds;
      floodedCells = bfs.result.floodedCells;
      unknownFrontierCells = bfs.result.unknownCells;
      ignored = bfs.result.ignored.map(item => ({
        stationId: item.stationId,
        reason:
          item.reason === 'reading_unknown'
            ? ignoredReasonFor(observations.get(item.stationId))
            : item.reason === 'outside_grid'
              ? 'out_of_grid'
              : item.reason,
      }));
      roads = compileRoadFlooding(input.edges, grid, floodedCells);
      const anyStationUnknown = snapshot.stations.some(o => o.status === 'unknown');
      const anyUnknownCoverage =
        unknownTerrainCells > 0 || roads.unknownEdgeIds.length > 0 || ignored.some(i => i.reason === 'out_of_grid') || snapshot.unconfiguredStationIds.length > 0;
      if (accepted.length === 0) modelStatus = 'unavailable';
      else modelStatus = anyStationUnknown || anyUnknownCoverage ? 'degraded' : 'ok';
    } else {
      eligibility = { ...eligibility, eligible: false, reasons: [...eligibility.reasons, 'grid_invalid'] };
      unknownTerrainCells = gridCells;
    }
  }

  const readings: SensorHistoryPoint[] = snapshot.stations
    .filter(o => o.rawLevelMeters !== null && o.observedAt !== null)
    .map(o => ({ stationId: o.stationId, observedAt: o.observedAt as number, levelMeters: o.rawLevelMeters as number }));

  const body = {
    schemaVersion: 1 as const,
    areaId: input.areaId,
    graphVersion: input.graphVersion,
    profile: profile.id,
    configVersion: SHADOW_CONFIG_VERSION,
    gridSha256: input.gridSha256,
    snapshotId: snapshot.snapshotId,
    evaluatedAt: snapshot.evaluatedAt,
    sourceStatus: input.sourceStatus,
    residentInfluence: 'none' as const,
    modelStatus,
    eligibility,
    inputObservedAt,
    stations: snapshot.stations.map(o => ({ ...o, reasons: [...o.reasons] })),
    unconfiguredStationIds: [...snapshot.unconfiguredStationIds],
    seeds,
    ignored,
    floodedCells,
    unknownFrontierCells,
    unknownTerrainCells,
    gridCells,
    roads,
    readings,
  };
  return { ...body, reportHash: sha256Hex(JSON.stringify(body)) };
}
