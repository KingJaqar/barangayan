import type { LatLng } from '../types/map-bridge';

/**
 * Reverse geocoding for the Incident Reports location picker (Module 3) — turns a map
 * pin's { lat, lng } into a human-readable address. Uses OpenStreetMap's Nominatim, the
 * same free/no-API-key service family as the Leaflet tiles and OSRM routing already used
 * elsewhere in this app (map-view.tsx, lib/osrm.ts), so no new API key or paid map vendor
 * is introduced.
 *
 * Nominatim's usage policy caps this at ~1 request/second for a pilot barangay's traffic —
 * fine here since it only fires when a resident places/moves the picker pin, not on every
 * map interaction. A self-hosted Nominatim instance is the production-scale follow-up.
 */

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const GEOCODE_TIMEOUT_MS = 8000;

/**
 * Resolves a point to its full address. Returns null on any failure (network error,
 * timeout, no result) — callers must fall back to showing raw coordinates and let the
 * resident type the address in manually, exactly as the location picker does.
 */
export async function reverseGeocode(point: LatLng): Promise<string | null> {
  const url = `${NOMINATIM_BASE_URL}/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}&zoom=18&addressdetails=0`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        // Nominatim's usage policy explicitly rejects "stock User-Agents as set by
        // http libraries" (https://operations.osmfoundation.org/policies/nominatim/)
        // — without this, every request from the mobile app comes through as a bare
        // "okhttp/x.x" (React Native/Android's default networking stack) and gets a
        // silent 403 "Access denied", which reverseGeocode then turns into a null
        // result — i.e. the address field never fills in, with no visible error.
        // Browsers ignore a custom User-Agent set via fetch (forbidden header name)
        // and fall back to their own — harmless there since real browser UAs +
        // Referer already satisfy Nominatim's policy.
        'User-Agent': 'Barangayan/1.0 (Barangay Ampid I resident app; https://barangayan.app)',
      },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { display_name?: string };
    const address = data.display_name?.trim();
    return address ? address : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
