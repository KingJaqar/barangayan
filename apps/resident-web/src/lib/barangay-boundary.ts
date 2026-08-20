import type { MultiPolygon, Polygon } from 'geojson';

import ampid1BoundaryGeoJson from '@/data/ampid1-boundary.json';

/**
 * Ampid I's boundary, bundled at build time (copied from
 * apps/resident-android-mobile/assets/geojson/ampid1-boundary.json — the same
 * high-density trace mobile ships as a static asset) so the Maps and Emergency Centers
 * screens always have a real boundary to draw, regardless of auth state or whether
 * `barangays.boundary` happens to be populated for the current session's barangay.
 *
 * This is deliberately a FALLBACK, not a replacement for `barangays.boundary` (C-045) —
 * the plan's Change-Control Log specifically flagged porting mobile's `useAmpid1Boundary`
 * outright as a multi-tenancy violation (a hardcoded single-barangay boundary). Callers
 * should prefer the DB-fetched boundary for the resident's actual barangay and only fall
 * back to this constant when that query returns null (e.g. no session, or the column
 * isn't populated yet for this environment) — see `withBoundaryFallback` below.
 */
export const AMPID1_BOUNDARY: Polygon =
  (ampid1BoundaryGeoJson as GeoJSON.FeatureCollection).features[0]!.geometry as Polygon;

export function withBoundaryFallback(boundary: Polygon | MultiPolygon | null): Polygon | MultiPolygon {
  return boundary ?? AMPID1_BOUNDARY;
}
