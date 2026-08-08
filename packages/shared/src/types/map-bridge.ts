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
  | { type: 'SET_MARKERS'; payload: { markers: MapMarker[]; kindColors?: Record<string, string> } }
  /** Draws (or clears, if geometry is null) a barangay's boundary outline and fits the map to it. */
  | { type: 'SET_BOUNDARY'; payload: { geometry: Polygon | MultiPolygon | null } }
  | { type: 'DRAW_ROUTE'; payload: { points: LatLng[] } }
  | { type: 'CLEAR_ROUTE' };

/** Messages sent FROM the WebView's Leaflet page BACK to React Native. */
export type MapBridgeOutboundMessage =
  | { type: 'MAP_READY' }
  | { type: 'MARKER_TAPPED'; payload: { markerId: string } }
  | { type: 'MAP_MOVED'; payload: { center: LatLng; zoom: number } };

export interface MapMarker {
  id: string;
  position: LatLng;
  /** e.g. an incident category id or 'evacuation-center' — drives clustering/icon choice. */
  kind: string;
  label?: string;
}
