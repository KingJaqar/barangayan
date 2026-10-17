import type { ConfirmedOrigin, LatLng } from '@barangayan/shared';
import type { RouteOrigin } from './route-controller';

/**
 * A starting point the resident placed on the map (plan P14-T02, "manual origin"). It stays in force only while the
 * device origin it was placed over is still the current one: accepting a new device fix replaces it, so the latest
 * choice always wins. Both live in memory only.
 */
export type ManualOrigin = { point: LatLng; seq: number; deviceRevision: number | null };

export function placeManualOrigin(point: LatLng, previous: ManualOrigin | null, device: ConfirmedOrigin | null): ManualOrigin {
  return { point, seq: (previous?.seq ?? 0) + 1, deviceRevision: device?.revision ?? null };
}

export function manualIsCurrent(manual: ManualOrigin | null, device: ConfirmedOrigin | null): manual is ManualOrigin {
  return manual !== null && manual.deviceRevision === (device?.revision ?? null);
}

/** The starting point distances and routes are measured from, or null when there is none yet. */
export function activeOrigin(device: ConfirmedOrigin | null, manual: ManualOrigin | null): RouteOrigin | null {
  if (manualIsCurrent(manual, device)) return { lat: manual.point.lat, lng: manual.point.lng, accuracyMeters: null, revision: manual.seq, kind: 'manual' };
  if (device) return { lat: device.lat, lng: device.lng, accuracyMeters: device.accuracyMeters, revision: device.revision, kind: 'device' };
  return null;
}

export function originSummary(origin: RouteOrigin | null): string {
  if (!origin) return 'No starting point yet, so distances are unknown.';
  if (origin.kind === 'manual') return 'Starting point: the spot you placed on the map.';
  return origin.accuracyMeters === null ? 'Starting point: your location.' : `Starting point: your location (within about ${Math.max(1, Math.round(origin.accuracyMeters))} m).`;
}
