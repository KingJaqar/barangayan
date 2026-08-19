/**
 * MapView — React Native WebView wrapping a self-contained Leaflet map page.
 *
 * Architecture:
 *   - The WebView loads an inline HTML string (no file server needed).
 *   - Leaflet JS + CSS are loaded from the unpkg CDN. For production offline-first
 *     support, replace the CDN URLs with assets bundled via expo-asset.
 *   - Communication uses the typed bridge from @barangayan/shared/types/map-bridge:
 *       RN → WebView: injectJavaScript(JSON.stringify(MapBridgeInboundMessage))
 *       WebView → RN: window.ReactNativeWebView.postMessage(JSON.stringify(MapBridgeOutboundMessage))
 *   - On web (Expo Web), react-native-webview is unavailable — a styled placeholder
 *     is rendered instead.
 */

import type { LatLng, MapBridgeInboundMessage, MapBridgeOutboundMessage, MapMarker } from '@barangayan/shared';
import { isPointInPolygon } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { ViewStyle } from 'react-native';
import { Platform, StyleSheet, Text, View } from 'react-native';

export interface MapViewHandle {
  fitAll: () => void;
  /** Draws a route polyline (ticket 17 — real OSRM road-following route, or a
   *  straight two-point fallback line) and fits the map to it. */
  drawRoute: (points: LatLng[]) => void;
  /** Removes any route drawn by drawRoute(). */
  clearRoute: () => void;
}

/**
 * Fallback focus when no barangay boundary is loaded yet (e.g. a guest with no profile,
 * or before the boundary fetch resolves) — the bounding-box center of Barangay Ampid I,
 * San Mateo, Rizal, this pilot's only onboarded barangay. This is a UI default, not
 * app logic keyed to a hardcoded barangay id (AGENTS.md §0) — once boundary data loads
 * for any barangay, SET_BOUNDARY overrides this immediately.
 */
const DEFAULT_CENTER: LatLng = { lat: 14.680291, lng: 121.1187445 };
const DEFAULT_ZOOM = 16;

/**
 * Exported so screens can offer a "reset to Ampid I" action (e.g. a "Maps" button
 * that recenters on this pilot barangay) without duplicating the coordinates.
 */
export const AMPID_I_SAN_MATEO_CENTER: LatLng = DEFAULT_CENTER;

// react-native-webview is not available on Expo Web — dynamic import guards the
// native-only require so the web bundle never fails to parse this module.
let WebView: any = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebView = require('react-native-webview').WebView;
}

// ── Leaflet inline HTML ──────────────────────────────────────────────────────
// Self-contained page: loads Leaflet from CDN, exposes a postMessage listener for
// MapBridgeInboundMessage commands, and sends MapBridgeOutboundMessage back via
// window.ReactNativeWebView.postMessage.
//
// Marker colour is determined by `kind`: a category id resolves to the colour in the
// CATEGORY_COLORS map (populated by SET_MARKERS payloads), otherwise the default teal.
const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; }
    /* Push the zoom (+/-) control down so it clears the floating search bar
       (12+44), segment toggle (10+40), filter pills (10+34) and a small gap:
       ≈ 12+44+10+40+10+34+8 = 158px total clearance. */
    .leaflet-top.leaflet-left { margin-top: 158px; }
  </style>
</head>
<body>
  <div id="map"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    // ── State ────────────────────────────────────────────────────────────────
    var map = null;
    var markerLayer = L.layerGroup();
    var boundaryLayer = L.layerGroup();
    var routeLayer = L.layerGroup();
    var pickerLayer = L.layerGroup();
    // The draggable pin placed by SET_PICKER / a picker-mode tap — Incident Reports'
    // "pin your location" flow (location-picker-modal.tsx). Null when no pin is shown.
    var pickerMarker = null;
    // Whether a plain map tap should place/move the picker pin (SET_PICKER payload.enabled).
    var pickerEnabled = false;
    // kind → hex color, populated from SET_MARKERS payload categories
    var kindColors = {};
    // Once a boundary is set, marker updates stop re-fitting the map — the boundary
    // is the intended focus and shouldn't jump around as markers stream in.
    var hasBoundary = false;

    // ── Helpers ──────────────────────────────────────────────────────────────
    function postToRN(msg) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    function colorForKind(kind) {
      return kindColors[kind] || (kind === 'evacuation' ? '#10B981' : '#0F6E5B');
    }

    function makeIcon(color) {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">'
        + '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24S24 21 24 12C24 5.4 18.6 0 12 0z" fill="' + color + '"/>'
        + '<circle cx="12" cy="12" r="5" fill="white"/>'
        + '</svg>';
      return L.icon({
        iconUrl: 'data:image/svg+xml;base64,' + btoa(svg),
        iconSize: [24, 36],
        iconAnchor: [12, 36],
        popupAnchor: [0, -36],
      });
    }

    /** Red pin containing a standing-person silhouette — used for the "You" marker. */
    function makePersonIcon() {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 42" width="28" height="42">'
        // pin body
        + '<path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 28 14 28S28 24.5 28 14C28 6.3 21.7 0 14 0z" fill="#DC2626"/>'
        // head
        + '<circle cx="14" cy="8" r="3.4" fill="white"/>'
        // torso
        + '<rect x="10.5" y="12.5" width="7" height="6" rx="1.5" fill="white"/>'
        // arms
        + '<rect x="7" y="13.5" width="14" height="2" rx="1" fill="white"/>'
        // left leg
        + '<path d="M11.5 18.5 L9.5 25" stroke="white" stroke-width="2.2" stroke-linecap="round"/>'
        // right leg
        + '<path d="M16.5 18.5 L18.5 25" stroke="white" stroke-width="2.2" stroke-linecap="round"/>'
        + '</svg>';
      return L.icon({
        iconUrl: 'data:image/svg+xml;base64,' + btoa(svg),
        iconSize: [28, 42],
        iconAnchor: [14, 42],
        popupAnchor: [0, -42],
      });
    }

    /** Creates or moves the picker pin, wiring its drag handler, and reports the position
     *  back to RN. Shared by the SET_PICKER handler and the map's own click listener below. */
    function placePickerMarker(latlng, report) {
      if (pickerMarker) {
        pickerMarker.setLatLng(latlng);
      } else {
        pickerMarker = L.marker(latlng, { icon: makePickerIcon(), draggable: true });
        pickerMarker.on('dragend', function () {
          var ll = pickerMarker.getLatLng();
          postToRN({ type: 'PICKER_MOVED', payload: { lat: ll.lat, lng: ll.lng } });
        });
        pickerLayer.addLayer(pickerMarker);
      }
      if (report) {
        var pos = pickerMarker.getLatLng();
        postToRN({ type: 'PICKER_MOVED', payload: { lat: pos.lat, lng: pos.lng } });
      }
    }

    /** Distinct pin (blue, larger) for the Incident Reports location picker — visually
     *  different from category markers and the red "You" pin so it reads as "draggable,
     *  editable" rather than "a report on the map". */
    function makePickerIcon() {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 44" width="30" height="44">'
        + '<path d="M15 0C6.7 0 0 6.7 0 15c0 11.25 15 29 15 29S30 26.25 30 15C30 6.7 23.3 0 15 0z" fill="#1D4ED8"/>'
        + '<circle cx="15" cy="15" r="6.5" fill="white"/>'
        + '<circle cx="15" cy="15" r="3" fill="#1D4ED8"/>'
        + '</svg>';
      return L.icon({
        iconUrl: 'data:image/svg+xml;base64,' + btoa(svg),
        iconSize: [30, 44],
        iconAnchor: [15, 44],
        popupAnchor: [0, -44],
      });
    }

    // ── Initialise map ───────────────────────────────────────────────────────
    window.addEventListener('load', function () {
      map = L.map('map', {
        zoomControl: true,
        attributionControl: false,
      }).setView([${DEFAULT_CENTER.lat}, ${DEFAULT_CENTER.lng}], ${DEFAULT_ZOOM}); // default: Barangay Ampid I

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      markerLayer.addTo(map);
      boundaryLayer.addTo(map);
      routeLayer.addTo(map);
      pickerLayer.addTo(map);

      postToRN({ type: 'MAP_READY' });

      map.on('moveend', function () {
        var c = map.getCenter();
        postToRN({ type: 'MAP_MOVED', payload: { center: { lat: c.lat, lng: c.lng }, zoom: map.getZoom() } });
      });

      // Picker mode: a plain tap places/moves the pin (SET_PICKER payload.enabled).
      map.on('click', function (e) {
        if (!pickerEnabled) return;
        placePickerMarker(e.latlng, true);
      });
    });

    // ── Bridge: RN → WebView ─────────────────────────────────────────────────
    window.addEventListener('message', function (event) {
      var msg;
      try { msg = JSON.parse(event.data); } catch (e) { return; }
      handleBridgeMessage(msg);
    });

    // Also handle messages posted via injectJavaScript (some RN versions use this path)
    document.addEventListener('message', function (event) {
      var msg;
      try { msg = JSON.parse(event.data); } catch (e) { return; }
      handleBridgeMessage(msg);
    });

    function handleBridgeMessage(msg) {
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'SET_CENTER': {
          if (map && msg.payload) {
            map.setView([msg.payload.lat, msg.payload.lng], map.getZoom());
          }
          break;
        }
        case 'SET_VIEW': {
          if (map && msg.payload) {
            map.setView([msg.payload.lat, msg.payload.lng], msg.payload.zoom, { animate: true });
          }
          break;
        }
        case 'SET_MARKERS': {
          if (!map || !msg.payload || !Array.isArray(msg.payload.markers)) break;

          // Capture any category colour hints supplied alongside the markers
          if (msg.payload.kindColors) {
            Object.assign(kindColors, msg.payload.kindColors);
          }

          markerLayer.clearLayers();
          msg.payload.markers.forEach(function (m) {
            if (!m || typeof m.position !== 'object') return;
            var icon = m.kind === 'user-location' ? makePersonIcon() : makeIcon(colorForKind(m.kind));
            var marker = L.marker(
              [m.position.lat, m.position.lng],
              { icon: icon }
            );
            if (m.label) marker.bindPopup(m.label);
            marker.on('click', function () {
              postToRN({ type: 'MARKER_TAPPED', payload: { markerId: m.id } });
            });
            markerLayer.addLayer(marker);
          });

          // Fit the map to the new markers — unless a boundary is set, in which case
          // the boundary stays the fixed focus and markers must not shift the view.
          if (!hasBoundary && msg.payload.markers.length > 0) {
            var group = L.featureGroup(markerLayer.getLayers());
            map.fitBounds(group.getBounds().pad(0.2));
          }
          break;
        }
        case 'SET_BOUNDARY': {
          if (!map) break;

          boundaryLayer.clearLayers();
          var geometry = msg.payload && msg.payload.geometry;

          if (geometry) {
            var boundaryFeature = L.geoJSON(geometry, {
              style: {
                color: '#DC2626',
                weight: 3,
                opacity: 0.95,
                fillColor: '#DC2626',
                fillOpacity: 0.04,
              },
            });
            boundaryLayer.addLayer(boundaryFeature);
            hasBoundary = true;
            map.fitBounds(boundaryFeature.getBounds().pad(0.1));
          } else {
            hasBoundary = false;
          }
          break;
        }
        case 'FIT_ALL': {
          if (!map) break;
          hasBoundary = true;
          var allLayers = [];
          boundaryLayer.eachLayer(function (layer) { allLayers.push(layer); });
          markerLayer.eachLayer(function (layer) { allLayers.push(layer); });
          if (allLayers.length > 0) {
            var group = L.featureGroup(allLayers);
            map.fitBounds(group.getBounds().pad(0.2));
          }
          break;
        }
        case 'DRAW_ROUTE': {
          if (!map || !msg.payload || !Array.isArray(msg.payload.points) || msg.payload.points.length < 2) break;

          routeLayer.clearLayers();
          var latLngs = msg.payload.points.map(function (p) { return [p.lat, p.lng]; });
          var line = L.polyline(latLngs, {
            color: '#0F6E5B',
            weight: 5,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          });
          routeLayer.addLayer(line);
          map.fitBounds(line.getBounds().pad(0.15));
          break;
        }
        case 'CLEAR_ROUTE': {
          routeLayer.clearLayers();
          break;
        }
        case 'SET_PICKER': {
          if (!map || !msg.payload) break;
          pickerEnabled = !!msg.payload.enabled;
          var pickerPos = msg.payload.position;
          if (pickerPos) {
            placePickerMarker([pickerPos.lat, pickerPos.lng], false);
          } else if (pickerMarker) {
            pickerLayer.removeLayer(pickerMarker);
            pickerMarker = null;
          }
          break;
        }
      }
    }
  </script>
</body>
</html>
`;

// ── Props ────────────────────────────────────────────────────────────────────

export interface FocusPosition {
  lat: number;
  lng: number;
  zoom: number;
}

export interface MapViewProps {
  markers: MapMarker[];
  center?: LatLng;
  /** Center + zoom to fly the map to a specific position. */
  focusPosition?: FocusPosition;
  /** Map from marker `kind` to hex colour — used for custom icon colours. */
  kindColors?: Record<string, string>;
  /**
   * A barangay's boundary geometry — rendered as a red outline and used to fit the
   * map's view. Takes priority over `center`/marker-based fitting while set.
   */
  boundary?: Polygon | MultiPolygon | null;
  /** Changing this value forces the map to re-fit to the current boundary. */
  boundaryRefitKey?: number;
  /**
   * Incident Reports' "pin your location" mode (location-picker-modal.tsx). When
   * `enabled`, tapping the map or dragging the pin moves it; `position` places/moves
   * the pin programmatically (initial GPS fix, or snapping back a rejected out-of-
   * boundary move). Every accepted move is validated against `boundary` (when set)
   * before `onPickerMoved` fires — moves outside it are rejected and the pin is
   * snapped back to its last accepted position instead.
   */
  picker?: { enabled: boolean; position: LatLng | null };
  /** Fires with the pin's new position once it passes the `boundary` check (if any). */
  onPickerMoved?: (position: LatLng) => void;
  /** Fires when a tap/drag landed outside `boundary` and was rejected. */
  onPickerRejected?: (attemptedPosition: LatLng) => void;
  onMarkerTap?: (markerId: string) => void;
  onMapReady?: () => void;
  style?: ViewStyle;
}

// ── Component ────────────────────────────────────────────────────────────────

const MapViewInner = forwardRef<MapViewHandle, MapViewProps>(({ markers, center, focusPosition, kindColors, boundary, boundaryRefitKey, picker, onPickerMoved, onPickerRejected, onMarkerTap, onMapReady, style }, ref) => {
  const webViewRef = useRef<any>(null);
  const isReadyRef = useRef(false);
  // Last picker position that passed the boundary check — what an out-of-boundary
  // tap/drag snaps back to. Seeded from `picker.position` so the very first fix
  // (already trusted — GPS or a barangay centroid) has somewhere valid to revert to.
  const lastAcceptedPickerPosRef = useRef<LatLng | null>(picker?.position ?? null);

  function sendMessage(msg: MapBridgeInboundMessage) {
    if (!webViewRef.current || !isReadyRef.current) return;
    const js = `
      (function() {
        var event = new MessageEvent('message', { data: ${JSON.stringify(JSON.stringify(msg))} });
        window.dispatchEvent(event);
      })();
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }

  useImperativeHandle(ref, () => ({
    fitAll: () => {
      if (!isReadyRef.current) return;
      sendMessage({ type: 'FIT_ALL' });
    },
    drawRoute: (points: LatLng[]) => {
      if (!isReadyRef.current) return;
      sendMessage({ type: 'DRAW_ROUTE', payload: { points } });
    },
    clearRoute: () => {
      if (!isReadyRef.current) return;
      sendMessage({ type: 'CLEAR_ROUTE' });
    },
  }));

  // Push new markers whenever the prop changes (after the map is ready).
  useEffect(() => {
    if (!isReadyRef.current) return;
    sendMessage({
      type: 'SET_MARKERS',
      payload: { markers, ...(kindColors ? { kindColors } : {}) },
    });
  }, [markers, kindColors]);

  // Re-center whenever the user's location changes.
  useEffect(() => {
    if (!isReadyRef.current || !center) return;
    sendMessage({ type: 'SET_CENTER', payload: center });
  }, [center]);

  // Fly to a specific position + zoom when focusPosition changes.
  useEffect(() => {
    if (!isReadyRef.current || !focusPosition) return;
    sendMessage({ type: 'SET_VIEW', payload: focusPosition });
  }, [focusPosition]);

  // Draw/update the boundary outline whenever it changes.
  useEffect(() => {
    if (!isReadyRef.current) return;
    sendMessage({ type: 'SET_BOUNDARY', payload: { geometry: boundary ?? null } });
  }, [boundary, boundaryRefitKey]);

  // Toggle picker mode / move the pin whenever the prop changes. A position supplied
  // this way (as opposed to a user tap/drag) is trusted as-is — it's what
  // lastAcceptedPickerPosRef snaps back to on a rejected move.
  useEffect(() => {
    if (picker?.position) lastAcceptedPickerPosRef.current = picker.position;
    if (!isReadyRef.current || !picker) return;
    sendMessage({ type: 'SET_PICKER', payload: { enabled: picker.enabled, position: picker.position } });
    // Depending on the primitive fields (not `picker` itself) avoids re-sending on every
    // render when a caller passes an inline object literal, e.g. `picker={{ enabled, position }}`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker?.enabled, picker?.position]);

  // Incoming messages from the WebView.
  function handleMessage(event: { nativeEvent: { data: string } }) {
    let msg: MapBridgeOutboundMessage;
    try {
      msg = JSON.parse(event.nativeEvent.data) as MapBridgeOutboundMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'MAP_READY': {
        isReadyRef.current = true;
        onMapReady?.();
        sendMessage({
          type: 'SET_MARKERS',
          payload: { markers },
          ...(kindColors ? { kindColors } : {}),
        } as MapBridgeInboundMessage & { kindColors?: Record<string, string> });
        if (boundary) {
          sendMessage({ type: 'SET_BOUNDARY', payload: { geometry: boundary } });
        }
        if (center) {
          sendMessage({ type: 'SET_CENTER', payload: center });
        }
        if (picker) {
          sendMessage({ type: 'SET_PICKER', payload: { enabled: picker.enabled, position: picker.position } });
        }
        break;
      }
      case 'MARKER_TAPPED': {
        onMarkerTap?.(msg.payload.markerId);
        break;
      }
      case 'MAP_MOVED': {
        break;
      }
      case 'PICKER_MOVED': {
        const pos = msg.payload;
        if (boundary && !isPointInPolygon(pos, boundary)) {
          // Reject: snap the pin back to the last position that was inside the boundary.
          onPickerRejected?.(pos);
          sendMessage({ type: 'SET_PICKER', payload: { enabled: true, position: lastAcceptedPickerPosRef.current } });
        } else {
          lastAcceptedPickerPosRef.current = pos;
          onPickerMoved?.(pos);
        }
        break;
      }
    }
  }

  // ── Web fallback ─────────────────────────────────────────────────────────
  if (Platform.OS === 'web' || WebView === null) {
    return (
      <View style={[styles.webFallback, style]}>
        <Text style={styles.webFallbackText}>Map unavailable on web</Text>
      </View>
    );
  }

  // ── Native render ────────────────────────────────────────────────────────
  return (
    <WebView
      ref={webViewRef}
      style={[styles.webView, style]}
      source={{ html: LEAFLET_HTML }}
      onMessage={handleMessage}
      originWhitelist={['*']}
      scrollEnabled={false}
      javaScriptEnabled
      domStorageEnabled
      androidHardwareAccelerationDisabled={false}
    />
  );
});

MapViewInner.displayName = 'MapView';

export const MapView = Object.assign(MapViewInner, {
  displayName: 'MapView',
});

const styles = StyleSheet.create({
  webView: {
    flex: 1,
    backgroundColor: '#E4E8E4',
  },
  webFallback: {
    flex: 1,
    backgroundColor: '#E4E8E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webFallbackText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
