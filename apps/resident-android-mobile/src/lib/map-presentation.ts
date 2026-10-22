import type { LatLng, MapBridgeInboundMessage, MapBridgeOutboundMessage } from '@barangayan/shared';

/** Android-local presentation commands; the shared routing/picker protocol stays intact. */
export interface MapPresentation {
  selectedMarkerId: string | null;
  padding: { top: number; bottom: number };
  attributionBottom: number;
  reducedMotion: boolean;
  surface: string;
  text: string;
  border: string;
  fontFamily: string;
}

export type LocalMapInboundMessage = MapBridgeInboundMessage
  | { type: 'SET_PRESENTATION'; payload: MapPresentation | null }
  | { type: 'ZOOM'; payload: { delta: 1 | -1 } }
  | { type: 'FIT_BOUNDARY' }
  | { type: 'FLY_TO'; payload: LatLng & { zoom: number } };

type LocalMapOutboundMessage = MapBridgeOutboundMessage | { type: 'BACKGROUND_TAPPED' };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isMapPosition(value: unknown): value is LatLng {
  return record(value) && typeof value.lat === 'number' && Number.isFinite(value.lat)
    && Math.abs(value.lat) <= 90 && typeof value.lng === 'number' && Number.isFinite(value.lng)
    && Math.abs(value.lng) <= 180;
}

/** Native messages are an input boundary, including malformed or obsolete WebView events. */
export function readMapMessage(data: string): LocalMapOutboundMessage | null {
  let value: unknown;
  try { value = JSON.parse(data); } catch { return null; }
  if (!record(value)) return null;
  switch (value.type) {
    case 'MAP_READY': case 'MAP_ERROR': case 'BACKGROUND_TAPPED': return { type: value.type };
    case 'MARKER_TAPPED': return record(value.payload) && typeof value.payload.markerId === 'string'
      ? { type: value.type, payload: { markerId: value.payload.markerId } } : null;
    case 'MAP_TAPPED': case 'PICKER_MOVED': return isMapPosition(value.payload)
      ? { type: value.type, payload: value.payload } : null;
    case 'MAP_MOVED': return record(value.payload) && isMapPosition(value.payload.center)
      && typeof value.payload.zoom === 'number' && Number.isFinite(value.payload.zoom)
      ? { type: value.type, payload: { center: value.payload.center, zoom: value.payload.zoom } } : null;
    default: return null;
  }
}
