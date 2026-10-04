import type { LatLng } from '../types/map-bridge';
import type { Polygon, MultiPolygon } from 'geojson';

/**
 * Ray-casting point-in-polygon test (even-odd rule) — Module 3's named
 * "Point-in-Polygon" algorithm for registration geofencing (AGENTS.md §3).
 * Standard ray-casting; no PostGIS/turf dependency needed for a client-side
 * advisory check like this one.
 *
 * Includes boundary edges and excludes polygon-hole interiors, matching the
 * server registration and Settings checks.
 */
function pointInRing(point: LatLng, ring: number[][]): 0 | 1 | 2 {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, yi = ring[i]![1]!;
    const xj = ring[j]![0]!, yj = ring[j]![1]!;
    if ((point.lng-xi)*(yj-yi)===(point.lat-yi)*(xj-xi)
      && point.lng>=Math.min(xi,xj) && point.lng<=Math.max(xi,xj)
      && point.lat>=Math.min(yi,yj) && point.lat<=Math.max(yi,yj)) return 2;
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside ? 1 : 0;
}

/**
 * Tests whether `point` falls inside a GeoJSON Polygon or MultiPolygon.
 * GeoJSON coordinates are [lng, lat] — callers pass a { lat, lng } point,
 * this handles the axis order internally.
 */
export function isPointInPolygon(point: LatLng, geometry: Polygon | MultiPolygon): boolean {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || Math.abs(point.lat)>90 || Math.abs(point.lng)>180) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(polygon => {
    const outer = pointInRing(point, polygon[0] ?? []);
    if (outer === 2) return true;
    if (outer === 0) return false;
    for (const hole of polygon.slice(1)) {
      const result = pointInRing(point, hole);
      if (result === 2) return true;
      if (result === 1) return false;
    }
    return true;
  });
}
