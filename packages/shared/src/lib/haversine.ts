import type { LatLng } from '../types/map-bridge';

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance between two points, in meters.
 * Algorithm: Haversine Formula (AGENTS.md §3 — Module 4 evacuation routing).
 *
 * Used both as the nearest-neighbor pre-filter before an OSRM road-routing call, and as
 * the offline fallback (straight-line distance sort) if the OSRM call times out.
 */
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/** Sorts candidates by straight-line distance from `origin`, nearest first. */
export function sortByDistanceFrom<T extends { position: LatLng }>(
  origin: LatLng,
  candidates: T[],
): (T & { distanceMeters: number })[] {
  return candidates
    .map((c) => ({ ...c, distanceMeters: haversineDistanceMeters(origin, c.position) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}
