import type { LatLng } from '../types/map-bridge';
import type { Polygon, MultiPolygon } from 'geojson';

/**
 * Ray-casting point-in-polygon test (even-odd rule) — Module 3's named
 * "Point-in-Polygon" algorithm for registration geofencing (AGENTS.md §3).
 * Standard ray-casting; no PostGIS/turf dependency needed for a client-side
 * advisory check like this one.
 *
 * Ignores polygon holes (interior rings beyond index 0) — barangay boundaries
 * are simple single-ring polygons in this project, and a hole would only ever
 * matter for a "resident lives in a lake in the middle of the barangay" case.
 */
function pointInRing(point: LatLng, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, yi = ring[i]![1]!;
    const xj = ring[j]![0]!, yj = ring[j]![1]!;
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Tests whether `point` falls inside a GeoJSON Polygon or MultiPolygon.
 * GeoJSON coordinates are [lng, lat] — callers pass a { lat, lng } point,
 * this handles the axis order internally.
 */
export function isPointInPolygon(point: LatLng, geometry: Polygon | MultiPolygon): boolean {
  if (geometry.type === 'Polygon') {
    return pointInRing(point, geometry.coordinates[0] ?? []);
  }
  return geometry.coordinates.some((polygon) => pointInRing(point, polygon[0] ?? []));
}
