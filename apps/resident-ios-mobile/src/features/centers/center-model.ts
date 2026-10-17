import { haversineDistanceMeters, type LatLng } from '@barangayan/shared';
import type { IconName } from '@expo/ui';
import type { z } from 'zod';
import type { centerRow } from '../../data/schemas';
import { formatRelativeTime } from '../../lib/format';
import { readPoint } from '../profile/location-map';

export type CenterRow = z.infer<typeof centerRow>;

/** Android's walking pace for estimates: 72 m per minute (about 1.2 m/s). */
export const WALKING_METERS_PER_MINUTE = 72;

export type OccupancyLevel = 'unknown' | 'normal' | 'high' | 'full';
export type Occupancy = {
  current: number;
  capacity: number | null;
  /** Whole percent of capacity; null when the capacity is not reported, which is never read as zero. */
  percent: number | null;
  level: OccupancyLevel;
  /** Headline: `FULL`, `45%` or `Capacity not reported`. */
  headline: string;
  /** `450 of 1,000 reported occupants`, or the count alone when the capacity is unknown. */
  detail: string;
};

const number = (value: number) => value.toLocaleString('en-US');

/** Normal below 80 %, high from 80 %, full from 100 % (Android's thresholds); no capacity means unknown. */
export function occupancyOf(current: number, capacity: number | null): Occupancy {
  if (capacity === null || capacity <= 0) {
    return { current, capacity: null, percent: null, level: 'unknown', headline: 'Capacity not reported', detail: `${number(current)} reported occupants` };
  }
  const percent = Math.round((current / capacity) * 100);
  const level: OccupancyLevel = percent >= 100 ? 'full' : percent >= 80 ? 'high' : 'normal';
  return { current, capacity, percent, level, headline: level === 'full' ? 'FULL' : `${percent}%`, detail: `${number(current)} of ${number(capacity)} reported occupants` };
}

export type Facility = { key: string; label: string; symbol: IconName };
const FACILITIES: Record<string, { label: string; symbol: IconName }> = {
  medical_desk: { label: 'Medical desk', symbol: 'cross.case' },
  medical: { label: 'Medical', symbol: 'cross.case' },
  pet_friendly: { label: 'Pet friendly', symbol: 'pawprint' },
  generator: { label: 'Generator', symbol: 'bolt' },
  catering: { label: 'Catering', symbol: 'fork.knife' },
  children: { label: 'Children', symbol: 'person.2' },
  toilets: { label: 'Toilets', symbol: 'drop' },
  internet: { label: 'Internet', symbol: 'wifi' },
};
const MAX_FACILITY_LABEL = 32;

/** Known keys get Android's labels; an operator-entered key it does not know is shown readably instead of being dropped. Duplicates collapse. */
export function facilitiesOf(keys: readonly string[]): Facility[] {
  const seen = new Set<string>();
  const result: Facility[] = [];
  for (const raw of keys) {
    const key = raw.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const known = FACILITIES[key];
    if (known) { result.push({ key, ...known }); continue; }
    const words = key.replace(/[_-]+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
    if (!words) continue;
    result.push({ key, label: (words.charAt(0).toUpperCase() + words.slice(1)).slice(0, MAX_FACILITY_LABEL), symbol: 'checkmark.circle' });
  }
  return result;
}

export type CenterAvailability = 'available' | 'unknown' | 'unavailable';
/** A value the app does not recognise is read as not confirmed, never as open. */
export function availabilityOf(value: string): CenterAvailability {
  return value === 'available' || value === 'unavailable' ? value : 'unknown';
}
export const AVAILABILITY_LABEL: Record<CenterAvailability, string> = {
  available: 'Confirmed available', unknown: 'Availability not confirmed', unavailable: 'Reported unavailable',
};

export type CenterRecord = {
  id: string;
  name: string;
  address: string | null;
  contactNumber: string | null;
  /** Null when the stored pin is unusable: the center stays in the list but cannot be mapped or measured. */
  position: LatLng | null;
  occupancy: Occupancy;
  facilities: Facility[];
  verified: boolean;
  availability: CenterAvailability;
  updatedAt: string;
};

export function centerRecordsFrom(rows: readonly CenterRow[]): CenterRecord[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address?.trim() || null,
    contactNumber: row.contact_number?.trim() || null,
    position: readPoint(row.position),
    occupancy: occupancyOf(row.current_occupancy, row.capacity),
    facilities: facilitiesOf(row.facilities),
    verified: row.verified,
    availability: availabilityOf(row.availability),
    updatedAt: row.updated_at,
  }));
}

/** `120 m` below a kilometre (rounded to 10 m, at least 10), otherwise `1.2 km`. */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.max(10, Math.round(meters / 10) * 10)} m` : `${(meters / 1000).toFixed(1)} km`;
}

/** Straight-line distance and a walking time at Android's pace. It is an estimate of the gap, not of any route. */
export type Estimate = { distanceMeters: number; minutes: number };
export function estimateBetween(origin: LatLng | null, position: LatLng | null): Estimate | null {
  if (!origin || !position) return null;
  const distanceMeters = haversineDistanceMeters(origin, position);
  if (!Number.isFinite(distanceMeters)) return null;
  return { distanceMeters, minutes: Math.max(1, Math.round(distanceMeters / WALKING_METERS_PER_MINUTE)) };
}

/** What the route service said about one center: a walking distance, or that no open walking route reaches it. */
export type RouteSummary = { centerId: string; distanceMeters: number | null; durationSeconds: number | null };

export type DistanceDisplay =
  | { kind: 'walking'; meters: number; minutes: number; text: string }
  | { kind: 'estimate'; meters: number; minutes: number; text: string }
  | { kind: 'unreachable'; text: string }
  | { kind: 'unknown'; text: string };

/**
 * The distance a card shows. A walking figure from the route service wins; a center the service cannot reach says
 * so rather than falling back to a misleading straight line (Android's rule); otherwise the labelled straight-line
 * estimate; without an origin or pin the distance is unknown, never zero.
 */
export function distanceDisplay(record: CenterRecord, origin: LatLng | null, summaries: ReadonlyMap<string, RouteSummary> | null): DistanceDisplay {
  const summary = summaries?.get(record.id);
  if (summary) {
    if (summary.distanceMeters === null || summary.durationSeconds === null) return { kind: 'unreachable', text: 'No open walking route' };
    const minutes = Math.max(1, Math.round(summary.durationSeconds / 60));
    return { kind: 'walking', meters: summary.distanceMeters, minutes, text: `${formatDistance(summary.distanceMeters)} walking · about ${minutes} min` };
  }
  const estimate = estimateBetween(origin, record.position);
  if (!estimate) return { kind: 'unknown', text: origin ? 'Distance unknown: no map location' : 'Distance unknown: location not set' };
  return { kind: 'estimate', meters: estimate.distanceMeters, minutes: estimate.minutes, text: `About ${formatDistance(estimate.distanceMeters)} in a straight line · about ${estimate.minutes} min walk (estimate)` };
}

/** A few words for a compact control such as the center picker; null when there is no distance to give. */
export function shortDistance(display: DistanceDisplay): string | null {
  if (display.kind === 'walking') return `${formatDistance(display.meters)} walk`;
  if (display.kind === 'estimate') return `about ${formatDistance(display.meters)}, straight line`;
  return display.kind === 'unreachable' ? display.text : null;
}

function distanceKey(display: DistanceDisplay): number {
  return display.kind === 'walking' || display.kind === 'estimate' ? display.meters : Number.POSITIVE_INFINITY;
}

/** Name search (case-insensitive, trimmed); a blank term keeps every center. */
export function searchCenters(records: readonly CenterRecord[], term: string): CenterRecord[] {
  const needle = term.trim().toLocaleLowerCase();
  return needle ? records.filter((record) => record.name.toLocaleLowerCase().includes(needle)) : [...records];
}

/**
 * Nearest-first ordering by the distance each card shows; centers without a distance go last in name order.
 * Without nearest-first, or without an origin, the name order is kept.
 */
export function orderCenters(records: readonly CenterRecord[], options: { nearestFirst: boolean; origin: LatLng | null; summaries: ReadonlyMap<string, RouteSummary> | null }): CenterRecord[] {
  const byName = [...records].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  if (!options.nearestFirst || !options.origin) return byName;
  const keyed = byName.map((record) => ({ record, key: distanceKey(distanceDisplay(record, options.origin, options.summaries)) }));
  return keyed.sort((a, b) => (a.key === b.key ? 0 : a.key < b.key ? -1 : 1)).map((item) => item.record);
}

/** `formatRelativeTime` for the middle of a sentence: only "Just now" needs its capital removed. */
export function relativeAge(iso: string, now: number): string {
  const age = formatRelativeTime(iso, new Date(now));
  return age === 'Just now' ? 'just now' : age;
}

/** When the operational facts last changed, in words; an unparsable stamp says so rather than showing a date. */
export function updatedLabel(updatedAt: string, now: number): string {
  return `Occupancy updated ${relativeAge(updatedAt, now)}`;
}

/** Apple Maps walking directions to the center; the resident opens it and Apple Maps asks for the starting point itself. Null without a usable pin. */
export function externalDirectionsUrl(record: CenterRecord): string | null {
  if (!record.position) return null;
  const { lat, lng } = record.position;
  return `https://maps.apple.com/?daddr=${lat.toFixed(6)},${lng.toFixed(6)}&dirflg=w`;
}
