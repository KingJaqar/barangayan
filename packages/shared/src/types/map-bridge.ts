/**
 * Typed message contract for the mobile app's Leaflet-in-WebView bridge
 * (react-native-webview <-> the locally bundled Leaflet HTML page).
 *
 * Both the RN side (posting into the WebView / handling onMessage) and the bundled
 * HTML page's JS must import and validate against these types instead of matching
 * against raw strings — see the plan's "Pre-Development Technical Risk Mitigations".
 */

import type { MultiPolygon, Polygon } from 'geojson';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Messages sent FROM React Native INTO the WebView (via injectedJavaScript / postMessage). */
export type MapBridgeInboundMessage =
  | { type: 'SET_CENTER'; payload: LatLng }
  | { type: 'SET_VIEW'; payload: LatLng & { zoom: number } }
  | { type: 'SET_MARKERS'; payload: { markers: MapMarker[]; kindColors?: Record<string, string> } }
  /** Draws (or clears, if geometry is null) a barangay's boundary outline and fits the map to it. */
  | { type: 'SET_BOUNDARY'; payload: { geometry: Polygon | MultiPolygon | null } }
  /** Fits the map to show all current markers regardless of any previously set boundary. */
  | { type: 'FIT_ALL' }
  | { type: 'DRAW_ROUTE'; payload: { points: LatLng[] } }
  | { type: 'CLEAR_ROUTE' }
  /**
   * Toggles the location-picker pin (Incident Reports "pin your location" flow — see
   * location-picker-modal.tsx). When `enabled`, a tap anywhere on the map (or a drag of
   * the existing pin) places/moves a draggable marker at that spot and reports it back
   * via PICKER_MOVED. `position` sets/moves the marker without user interaction (e.g. the
   * initial GPS fix, or RN snapping the pin back after a rejected out-of-boundary move).
   * `position: null` removes the marker entirely.
   */
  | { type: 'SET_PICKER'; payload: { enabled: boolean; position: LatLng | null } };

/** Messages sent FROM the WebView's Leaflet page BACK to React Native. */
export type MapBridgeOutboundMessage =
  | { type: 'MAP_READY' }
  | { type: 'MARKER_TAPPED'; payload: { markerId: string } }
  | { type: 'MAP_MOVED'; payload: { center: LatLng; zoom: number } }
  /** The picker pin was placed (tap) or moved (drag) — see SET_PICKER above. */
  | { type: 'PICKER_MOVED'; payload: LatLng };

export interface MapMarker {
  id: string;
  position: LatLng;
  /** e.g. an incident category id or 'evacuation-center' — drives clustering/icon choice. */
  kind: string;
  label?: string;
}
