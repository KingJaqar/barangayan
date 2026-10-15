/**
 * Typed message contract for the mobile app's Leaflet-in-WebView bridge
 * (react-native-webview <-> the locally bundled Leaflet HTML page).
 *
 * Both the RN side (posting into the WebView / handling onMessage) and the bundled
 * HTML page's JS must import and validate against these types instead of matching
 * against raw strings — see the plan's "Pre-Development Technical Risk Mitigations".
 */

import type { FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';

export interface LatLng {
  lat: number;
  lng: number;
}

/** GeoJSON order ([lng, lat], WGS84), as stored in routing packs. */
export type MapLngLat = readonly [number, number];

/** Messages sent FROM React Native INTO the WebView (via injectedJavaScript / postMessage). */
export type MapBridgeInboundMessage =
  | { type: 'SET_CENTER'; payload: LatLng }
  | { type: 'SET_VIEW'; payload: LatLng & { zoom: number } }
  | { type: 'SET_MARKERS'; payload: { markers: MapMarker[]; kindColors?: Record<string, string> } }
  /** Draws (or clears, if geometry is null) a barangay's boundary outline and fits the map to it. */
  | { type: 'SET_BOUNDARY'; payload: { geometry: Polygon | MultiPolygon | null } }
  /** Fits the map to show all current markers regardless of any previously set boundary. */
  | { type: 'FIT_ALL' }
  /**
   * Draws the route and fits the map to it. `padding` (CSS px) is the map area covered by
   * floating controls at the top and bottom, so the route is framed in the visible part.
   */
  | { type: 'DRAW_ROUTE'; payload: { points: LatLng[]; padding?: { top: number; bottom: number } } }
  | { type: 'CLEAR_ROUTE' }
  /**
   * Draws (or clears, if null) the resident's location marker and accuracy circle.
   * `pending` marks a fix awaiting confirmation, which is not yet the routing origin.
   */
  | { type: 'SET_USER_LOCATION'; payload: { position: LatLng; accuracyMeters: number | null; pending: boolean } | null }
  /**
   * Toggles the location-picker pin (Incident Reports "pin your location" flow — see
   * location-picker-modal.tsx). When `enabled`, a tap anywhere on the map (or a drag of
   * the existing pin) places/moves a draggable marker at that spot and reports it back
   * via PICKER_MOVED. `position` sets/moves the marker without user interaction (e.g. the
   * initial GPS fix, or RN snapping the pin back after a rejected out-of-boundary move).
   * `position: null` removes the marker entirely.
   */
  | { type: 'SET_PICKER'; payload: { enabled: boolean; position: LatLng | null } }
  /**
   * Vector roads and water from the installed routing pack (DRRM routing R6): the offline
   * basemap, drawn from the pack instead of a tile server. null removes it.
   */
  | { type: 'SET_PACK_BASEMAP'; payload: { map: FeatureCollection<Geometry, { layer: string; kind: string | null; walkable: boolean | null }> | null } }
  /** Adds or removes the online OpenStreetMap tile layer. */
  | { type: 'SET_TILES'; payload: { enabled: boolean } }
  /** Verified closures, the resident's own blocked segments and the segment being marked. */
  | { type: 'SET_ROAD_MARKS'; payload: { closures: readonly (readonly MapLngLat[])[]; avoided: readonly (readonly MapLngLat[])[]; selected: readonly MapLngLat[] | null } }
  /** While enabled, a plain map tap is reported as MAP_TAPPED (marking a blocked segment). */
  | { type: 'SET_TAP_MODE'; payload: { enabled: boolean } };

/** Messages sent FROM the WebView's Leaflet page BACK to React Native. */
export type MapBridgeOutboundMessage =
  | { type: 'MAP_READY' }
  | { type: 'MAP_ERROR' }
  | { type: 'MARKER_TAPPED'; payload: { markerId: string } }
  | { type: 'MAP_MOVED'; payload: { center: LatLng; zoom: number } }
  /** The picker pin was placed (tap) or moved (drag) — see SET_PICKER above. */
  | { type: 'PICKER_MOVED'; payload: LatLng }
  /** A plain tap while SET_TAP_MODE is enabled. */
  | { type: 'MAP_TAPPED'; payload: LatLng };

export interface MapMarker {
  id: string;
  position: LatLng;
  /** e.g. an incident category id or 'evacuation-center' — drives clustering/icon choice. */
  kind: string;
  label?: string;
}
