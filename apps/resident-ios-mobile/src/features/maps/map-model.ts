import { formatDate, haversineDistanceMeters, type LatLng, type MapMarker } from '@barangayan/shared';
import { incidentStatusLabel } from '../../data/report-filters';
import type { MapIncident } from '../../data/resident-api';
import type { z } from 'zod';
import type { centerRow } from '../../data/schemas';
import { safeColor } from '../emergency/content';
import { formatDistance } from '../centers/center-model';
import { readPoint } from '../profile/location-map';

export type MapLayer = 'incidents' | 'centers';
export const LAYER_OPTIONS: readonly { value: MapLayer; label: string }[] = [{ value: 'incidents', label: 'Incidents' }, { value: 'centers', label: 'Evacuation' }];

const INCIDENT_KIND_FALLBACK = '#0D6B59';
export const CENTER_COLOR = '#10B981';
export const CENTER_KIND = 'evacuation';

/** One place on the map and in the list beside it; the list is the accessible equivalent of the markers. */
export type MapRecord = {
  id: string;
  layer: MapLayer;
  title: string;
  detail: string;
  position: LatLng;
  /** Marker colour key: the category id for a concern, `evacuation` for a center. */
  kind: string;
  color: string;
  /** The concern category, for the chips; null for a center or an uncategorised concern. */
  categoryId: string | null;
  distanceMeters?: number;
};

/** Own concerns that have a usable pin; `unplaced` counts the ones without, which are reported instead of dropped silently. */
export function incidentRecords(rows: readonly MapIncident[]): { records: MapRecord[]; unplaced: number } {
  const records: MapRecord[] = [];
  let unplaced = 0;
  for (const row of rows) {
    const position = readPoint(row.location);
    if (!position) { unplaced++; continue; }
    const category = row.incident_categories?.name ?? 'Uncategorized';
    records.push({
      id: row.id, layer: 'incidents', title: row.title, detail: `${category} · ${incidentStatusLabel(row.status)} · ${formatDate(row.created_at)}`,
      position, kind: row.category_id ?? 'incident', color: safeColor(row.incident_categories?.color ?? '') ?? INCIDENT_KIND_FALLBACK, categoryId: row.category_id,
    });
  }
  return { records, unplaced };
}

export function centerRecords(rows: readonly z.infer<typeof centerRow>[]): { records: MapRecord[]; unplaced: number } {
  const records: MapRecord[] = [];
  let unplaced = 0;
  for (const row of rows) {
    const position = readPoint(row.position);
    if (!position) { unplaced++; continue; }
    const occupancy = `${row.current_occupancy} of ${row.capacity ?? 'unknown'} reported occupants`;
    records.push({ id: row.id, layer: 'centers', title: row.name, detail: [row.address, occupancy].filter(Boolean).join(' · '), position, kind: CENTER_KIND, color: CENTER_COLOR, categoryId: null });
  }
  return { records, unplaced };
}

/** Search matches the title and detail text; a category filter applies to concerns only, and none selected means all. */
export function filterRecords(records: readonly MapRecord[], options: { search: string; categoryIds: readonly string[] }): MapRecord[] {
  const term = options.search.trim().toLocaleLowerCase();
  return records.filter((record) => {
    if (options.categoryIds.length > 0 && record.layer === 'incidents' && (record.categoryId === null || !options.categoryIds.includes(record.categoryId))) return false;
    return !term || record.title.toLocaleLowerCase().includes(term) || record.detail.toLocaleLowerCase().includes(term);
  });
}

/** Adds the distance from the confirmed origin and orders nearest first; without an origin the order is kept. */
export function withDistance(records: readonly MapRecord[], origin: LatLng | null): MapRecord[] {
  if (!origin) return [...records];
  return records.map((record) => ({ ...record, distanceMeters: haversineDistanceMeters(origin, record.position) })).sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
}

export function distanceLabel(meters: number): string {
  return `About ${formatDistance(meters)} away in a straight line`;
}

/** The bridge payload: ids and pins only, so no resident text ever enters the map page. */
export function bridgeMarkers(records: readonly MapRecord[]): { markers: MapMarker[]; kindColors: Record<string, string> } {
  const kindColors: Record<string, string> = {};
  for (const record of records) kindColors[record.kind] = record.color;
  return { markers: records.map((record) => ({ id: record.id, position: record.position, kind: record.kind })), kindColors };
}

/** Toggles a category chip: tapping a selected one clears it. */
export function toggleCategory(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id];
}
