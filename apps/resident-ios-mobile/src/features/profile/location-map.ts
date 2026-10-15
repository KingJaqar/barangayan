import type { Json, LatLng, MapBridgeInboundMessage } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import { LEAFLET_CSS, LEAFLET_JS, LEAFLET_LICENSE } from '../../lib/leaflet-assets';

const OSM_TILES = 'https://tile.openstreetmap.org';

const isCoordinate = (lat: unknown, lng: unknown): boolean =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** A stored `{lat, lng}` JSON value, or null if it is anything else. */
export function readPoint(value: Json | null | undefined): LatLng | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { lat, lng } = value;
  return isCoordinate(lat, lng) ? { lat: lat as number, lng: lng as number } : null;
}

/** Boundary geometry from a database `jsonb` value, or null when it is missing or not a polygon. */
export function readBoundary(value: unknown): Polygon | MultiPolygon | null {
  if (!value || typeof value !== 'object') return null;
  const { type, coordinates } = value as { type?: unknown; coordinates?: unknown };
  if ((type !== 'Polygon' && type !== 'MultiPolygon') || !Array.isArray(coordinates) || !coordinates.length) return null;
  return value as Polygon | MultiPolygon;
}

/** Bounding-box centre of a boundary: where the map opens when there is no saved pin. */
export function boundaryCenter(geometry: Polygon | MultiPolygon): LatLng | null {
  const rings = geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const ring of rings) for (const [lng, lat] of ring) {
    if (!isCoordinate(lat, lng)) continue;
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
  }
  return Number.isFinite(minLat) ? { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 } : null;
}

/** One accessible nudge is about 11 m. */
const NUDGE_DEGREES = 0.0001;
export type Direction = 'north' | 'south' | 'east' | 'west';
export function nudge(point: LatLng, direction: Direction): LatLng {
  const lat = point.lat + (direction === 'north' ? NUDGE_DEGREES : direction === 'south' ? -NUDGE_DEGREES : 0);
  const lng = point.lng + (direction === 'east' ? NUDGE_DEGREES : direction === 'west' ? -NUDGE_DEGREES : 0);
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

export type MapEvent = { type: 'ready' } | { type: 'error' } | { type: 'pin'; point: LatLng };
/** Validates a WebView message: anything but the three known shapes with finite coordinates is ignored. */
export function parseMapMessage(raw: unknown): MapEvent | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  let message: unknown;
  try { message = JSON.parse(raw); } catch { return null; }
  if (!message || typeof message !== 'object') return null;
  const { type, payload } = message as { type?: unknown; payload?: unknown };
  if (type === 'MAP_READY') return { type: 'ready' };
  if (type === 'MAP_ERROR') return { type: 'error' };
  if (type === 'PICKER_MOVED' && payload && typeof payload === 'object') {
    const { lat, lng } = payload as { lat?: unknown; lng?: unknown };
    if (isCoordinate(lat, lng)) return { type: 'pin', point: { lat: lat as number, lng: lng as number } };
  }
  return null;
}

/** Script that delivers an inbound bridge message to the page. */
export const deliver = (message: MapBridgeInboundMessage) => `window.receive(${JSON.stringify(JSON.stringify(message))});true;`;

/**
 * The page is built from the bundled Leaflet only. Its content-security policy blocks every
 * network request unless OpenStreetMap tiles are enabled, which only happens when the
 * `mapProviders` release gate has been opened (plan G07).
 */
export function mapHtml(options: { tiles: boolean }): string {
  const images = options.tiles ? `data: ${OSM_TILES}` : 'data:';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src ${images};"/>
<!-- Leaflet ${LEAFLET_LICENSE} -->
<style>${LEAFLET_CSS}</style>
<style>*{box-sizing:border-box;margin:0;padding:0}html,body,#map{width:100%;height:100%;background:#e8eeeb}</style>
</head><body><div id="map"></div>
<script>${LEAFLET_JS}</script>
<script>
(function () {
  function post(message) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
  window.addEventListener('error', function () { post({ type: 'MAP_ERROR' }); });
  var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([0, 0], 2);
  map.attributionControl.setPrefix('Leaflet');
  var boundary = null, pin = null, enabled = false;${options.tiles ? ' var tiles = null;' : ''}
  var icon = L.icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24S24 21 24 12C24 5.4 18.6 0 12 0z" fill="#0D6B59"/><circle cx="12" cy="12" r="5" fill="white"/></svg>'),
    iconSize: [24, 36], iconAnchor: [12, 36]
  });
  function setPin(point) {
    if (!point) { if (pin) { map.removeLayer(pin); pin = null; } return; }
    var latLng = L.latLng(point.lat, point.lng);
    if (pin) { pin.setLatLng(latLng); return; }
    pin = L.marker(latLng, { icon: icon, draggable: true }).addTo(map);
    pin.on('dragend', function () { var p = pin.getLatLng(); post({ type: 'PICKER_MOVED', payload: { lat: p.lat, lng: p.lng } }); });
  }
  map.on('click', function (event) {
    if (enabled) post({ type: 'PICKER_MOVED', payload: { lat: event.latlng.lat, lng: event.latlng.lng } });
  });
  window.receive = function (raw) {
    var message; try { message = JSON.parse(raw); } catch (e) { return; }
    var payload = message.payload;
    if (message.type === 'SET_BOUNDARY') {
      if (boundary) { map.removeLayer(boundary); boundary = null; }
      if (payload && payload.geometry) {
        boundary = L.geoJSON(payload.geometry, { style: { color: '#0D6B59', weight: 3, fillOpacity: 0.08 }, interactive: false }).addTo(map);
        map.fitBounds(boundary.getBounds(), { padding: [16, 16] });
      }
    } else if (message.type === 'SET_PICKER') {
      enabled = !!payload.enabled; setPin(payload.position);
      if (payload.position && !boundary) map.setView([payload.position.lat, payload.position.lng], 17);
    } else if (message.type === 'SET_VIEW') {
      map.setView([payload.lat, payload.lng], payload.zoom);
    }${options.tiles ? `  else if (message.type === 'SET_TILES') {
      if (tiles) { map.removeLayer(tiles); tiles = null; }
      if (payload.enabled) {
        tiles = L.tileLayer('${OSM_TILES}/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      }
    }` : ''}
  };
  post({ type: 'MAP_READY' });
})();
</script></body></html>`;
}
