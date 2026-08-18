import type { LatLng } from '../types/map-bridge';

/**
 * Ticket 17 — real road-following evacuation routing, replacing the
 * Haversine-only straight-line estimate. Uses OSRM's public demo router
 * (the same backend Leaflet Routing Machine talks to) directly over HTTP
 * rather than bundling the LRM JS library into the WebView — one fetch call
 * + drawing the returned line on the Leaflet map already loaded there.
 *
 * The public demo server (router.project-osrm.org) is rate-limited and not
 * meant for production traffic at scale — fine for a pilot barangay's
 * evacuation-center lookups, but a self-hosted OSRM instance is the
 * production-scale follow-up.
 */

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/foot';
const OSRM_TIMEOUT_MS = 6000;

export interface WalkingRoute {
  /** Road-following path, in the same { lat, lng } order the map bridge expects. */
  points: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
}

/**
 * Fetches a real, road-following walking route between two points via OSRM.
 * Returns null on any failure (network error, timeout, no route found) — callers
 * must fall back to haversineDistanceMeters()'s straight-line estimate, exactly
 * as the audit report specified ("offline fallback if the OSRM call times out").
 */
export async function getWalkingRoute(origin: LatLng, destination: LatLng): Promise<WalkingRoute | null> {
  const url =
    `${OSRM_BASE_URL}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?overview=full&geometries=geojson`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      routes?: { distance: number; duration: number; geometry?: { coordinates: [number, number][] } }[];
    };
    const route = data.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (!route || !coordinates || coordinates.length === 0) return null;

    return {
      points: coordinates.map(([lng, lat]) => ({ lat, lng })),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
