/**
 * MapView — React Native WebView wrapping a self-contained Leaflet map page.
 *
 * Architecture:
 *   - The WebView loads an inline HTML string (no file server needed).
 *   - Leaflet JS + CSS are inlined from the app bundle (leaflet-assets.ts), so the page
 *     makes no script/style CDN requests (DRRM routing plan R6). Online OpenStreetMap tiles
 *     are optional (`showTiles`); the Centers map draws the routing pack's vector roads
 *     instead when offline.
 *   - Communication uses the typed bridge from @barangayan/shared/types/map-bridge:
 *       RN → WebView: injectJavaScript(JSON.stringify(MapBridgeInboundMessage))
 *       WebView → RN: window.ReactNativeWebView.postMessage(JSON.stringify(MapBridgeOutboundMessage))
 *   - On web (Expo Web), react-native-webview is unavailable — a styled placeholder
 *     is rendered instead.
 */

import type { LatLng, MapBridgeInboundMessage, MapLngLat, MapMarker } from '@barangayan/shared';
import { isPointInPolygon } from '@barangayan/shared';
import type { FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { ViewStyle } from 'react-native';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type NativeWebView from 'react-native-webview';
import { mountDiagnosticOwner, navigationDiagnosticsAvailable, recordNavigationDiagnostic } from '@/lib/navigation-diagnostics';

import { LEAFLET_CSS, LEAFLET_JS, LEAFLET_LICENSE } from '@/components/leaflet-assets';
import { isMapPosition, readMapMessage, type LocalMapInboundMessage, type MapPresentation } from '@/lib/map-presentation';

export interface MapViewHandle {
  fitAll: () => void;
  fitBoundary: () => void;
  flyTo: (position: FocusPosition) => void;
  zoomIn: () => void;
  zoomOut: () => void;
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
let WebView: typeof NativeWebView | null = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebView = require('react-native-webview').WebView;
}

// ── Leaflet inline HTML ──────────────────────────────────────────────────────
// Self-contained page: inlines the bundled Leaflet, exposes a postMessage listener for
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
  <!-- Leaflet ${LEAFLET_LICENSE} -->
  <style>${LEAFLET_CSS}</style>
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

  <script>${LEAFLET_JS}</script>
  <script>
    window.addEventListener('error', function () {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_ERROR' }));
    });
    // ── State ────────────────────────────────────────────────────────────────
    var map = null;
    var markerLayer = L.layerGroup();
    var boundaryLayer = L.layerGroup();
    var routeLayer = L.layerGroup();
    var pickerLayer = L.layerGroup();
    var userLayer = L.layerGroup();
    var basemapLayer = L.layerGroup();
    var roadMarksLayer = L.layerGroup();
    var tileLayer = null;
    // Off until React Native sends SET_TILES after MAP_READY, so a map that must stay offline
    // never requests a tile while loading.
    var tilesEnabled = false;
    // SET_TAP_MODE: report plain taps as MAP_TAPPED (marking a blocked segment).
    var tapEnabled = false;
    // Created on load: the pack basemap draws in its own pane below routes, marks and markers.
    var basemapRenderer = null;
    var marksRenderer = null;
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
    var presentation = null;
    var markerEntries = [];
    var currentUserLocation = null;
    var presentationFitted = false;
    var zoomTarget = null;

    // ── Helpers ──────────────────────────────────────────────────────────────
    function postToRN(msg) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    function colorForKind(kind) {
      var color = kindColors[kind];
      return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)
        ? color : (kind === 'evacuation' ? '#10B981' : '#0F6E5B');
    }

    function presentationIcon(kind, selected) {
      if (!presentation) return kind === 'user-location' ? makePersonIcon() : makeIcon(colorForKind(kind));
      var width = selected ? 40 : 30;
      var height = Math.round(width * 1.3);
      return L.divIcon({ className: 'map-pin', iconSize: [width, height], iconAnchor: [width / 2, height],
        html: '<svg width="' + width + '" height="' + height + '" viewBox="0 0 30 39" xmlns="http://www.w3.org/2000/svg"><path d="M15 1C7.3 1 1 7.2 1 14.8 1 25.4 15 38 15 38s14-12.6 14-23.2C29 7.2 22.7 1 15 1z" fill="' + colorForKind(kind) + '" stroke="#FFFFFF" stroke-width="2"/><circle cx="15" cy="14.5" r="5.5" fill="#FFFFFF"/></svg>' });
    }

    function updateMarkerPresentation() {
      markerEntries.forEach(function (entry) {
        var selected = !!presentation && presentation.selectedMarkerId === entry.id;
        entry.marker.setIcon(presentationIcon(entry.kind, selected));
        entry.marker.setZIndexOffset(selected ? 1000 : 0);
      });
    }

    function drawUserLocation() {
      userLayer.clearLayers();
      var loc = currentUserLocation;
      if (!map || !loc || !loc.position) return;
      var point = [loc.position.lat, loc.position.lng];
      if (typeof loc.accuracyMeters === 'number' && loc.accuracyMeters > 0) {
        userLayer.addLayer(L.circle(point, { radius: loc.accuracyMeters,
          color: loc.pending ? '#B45309' : '#2563EB', weight: 1, fillOpacity: 0.12,
          dashArray: loc.pending ? '4 4' : null, interactive: false }));
      }
      if (presentation) {
        userLayer.addLayer(L.circleMarker(point, { radius: 18, stroke: false, fillColor: '#2F66CC', fillOpacity: 0.18, interactive: false }));
        userLayer.addLayer(L.circleMarker(point, { radius: 8, color: '#FFFFFF', weight: 3, fillColor: '#2F66CC', fillOpacity: 1, interactive: false }));
      } else {
        userLayer.addLayer(L.marker(point, { icon: makePersonIcon(), opacity: loc.pending ? 0.6 : 1, interactive: false }));
      }
    }

    function fitPresentationBounds(bounds, fly) {
      var top = presentation ? Math.max(0, presentation.padding.top) : 0;
      var bottom = presentation ? Math.max(0, presentation.padding.bottom) : 0;
      var room = Math.max(0, map.getSize().y - 120);
      if (top + bottom > room) { var scale = room / (top + bottom); top *= scale; bottom *= scale; }
      var options = { paddingTopLeft: [30, top], paddingBottomRight: [30, bottom],
        animate: !presentation || !presentation.reducedMotion, duration: 0.5 };
      map.stop();
      if (fly && options.animate) map.flyToBounds(bounds, options);
      else map.fitBounds(bounds, options);
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
      if (presentation) return presentationIcon('picker', true);
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
        attributionControl: true,
      }).setView([${DEFAULT_CENTER.lat}, ${DEFAULT_CENTER.lng}], ${DEFAULT_ZOOM}); // default: Barangay Ampid I
      // OpenStreetMap data (tiles and routing packs) is ODbL: attribution must stay visible.
      map.attributionControl.setPrefix(false);
      map.attributionControl.addAttribution('© OpenStreetMap contributors');

      tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).on('tileerror', function () { postToRN({ type: 'MAP_ERROR' }); });
      if (tilesEnabled) tileLayer.addTo(map);

      map.createPane('packBasemap');
      map.getPane('packBasemap').style.zIndex = 350;
      basemapRenderer = L.canvas({ pane: 'packBasemap', padding: 0.5 });
      marksRenderer = L.canvas({ padding: 0.5 });
      basemapLayer.addTo(map);
      roadMarksLayer.addTo(map);
      markerLayer.addTo(map);
      boundaryLayer.addTo(map);
      routeLayer.addTo(map);
      pickerLayer.addTo(map);
      userLayer.addTo(map);

      postToRN({ type: 'MAP_READY' });

      map.on('moveend', function () {
        if (zoomTarget !== null && Math.abs(map.getZoom() - zoomTarget) < 0.01) zoomTarget = null;
        var c = map.getCenter();
        postToRN({ type: 'MAP_MOVED', payload: { center: { lat: c.lat, lng: c.lng }, zoom: map.getZoom() } });
      });
      map.on('dragstart', function () { zoomTarget = null; });

      // Picker mode: a plain tap places/moves the pin (SET_PICKER payload.enabled).
      map.on('click', function (e) {
        if (tapEnabled) {
          postToRN({ type: 'MAP_TAPPED', payload: { lat: e.latlng.lat, lng: e.latlng.lng } });
          return;
        }
        if (pickerEnabled) { placePickerMarker(e.latlng, true); return; }
        if (presentation) postToRN({ type: 'BACKGROUND_TAPPED' });
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
        case 'SET_PRESENTATION': {
          presentation = msg.payload;
          if (!map) break;
          if (presentation) map.zoomControl.remove();
          else map.zoomControl.addTo(map);
          var attribution = map.attributionControl.getContainer();
          attribution.style.marginBottom = presentation ? Math.max(0, presentation.attributionBottom) + 'px' : '';
          attribution.style.backgroundColor = presentation ? presentation.surface : '';
          attribution.style.color = presentation ? presentation.text : '';
          attribution.style.fontFamily = presentation ? presentation.fontFamily : '';
          attribution.style.border = presentation ? '1px solid ' + presentation.border : '';
          updateMarkerPresentation();
          if (pickerMarker) pickerMarker.setIcon(makePickerIcon());
          drawUserLocation();
          // Layout/theme/selection changes never fit the map or dispatch domain events.
          break;
        }
        case 'ZOOM': {
          if (map && msg.payload) {
            var nextZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), (zoomTarget === null ? map.getZoom() : zoomTarget) + msg.payload.delta));
            map.stop(); zoomTarget = nextZoom;
            if (presentation && presentation.reducedMotion) map.setZoom(nextZoom, { animate: false });
            else map.flyTo(map.getCenter(), nextZoom, { duration: 0.5 });
          }
          break;
        }
        case 'FLY_TO': {
          if (!map || !msg.payload) break;
          zoomTarget = null;
          map.stop();
          var target = [msg.payload.lat, msg.payload.lng];
          if (presentation && presentation.reducedMotion) map.setView(target, msg.payload.zoom, { animate: false });
          else map.flyTo(target, msg.payload.zoom, { duration: 0.5 });
          break;
        }
        case 'FIT_BOUNDARY': {
          if (!map) break;
          zoomTarget = null;
          var layers = boundaryLayer.getLayers();
          if (layers.length) fitPresentationBounds(L.featureGroup(layers).getBounds(), true);
          else map.setView([${DEFAULT_CENTER.lat}, ${DEFAULT_CENTER.lng}], ${DEFAULT_ZOOM}, { animate: !presentation || !presentation.reducedMotion });
          break;
        }
        case 'SET_CENTER': {
          if (map && msg.payload) {
            map.setView([msg.payload.lat, msg.payload.lng], map.getZoom());
          }
          break;
        }
        case 'SET_VIEW': {
          if (map && msg.payload) {
            map.setView([msg.payload.lat, msg.payload.lng], msg.payload.zoom, { animate: !presentation || !presentation.reducedMotion });
          }
          break;
        }
        case 'SET_MARKERS': {
          if (!map || !msg.payload || !Array.isArray(msg.payload.markers)) break;

          // The payload is the current set of hints, including removed categories.
          kindColors = msg.payload.kindColors || {};

          markerLayer.clearLayers();
          markerEntries = [];
          if (pickerMarker && presentation) pickerMarker.setIcon(makePickerIcon());
          msg.payload.markers.forEach(function (m) {
            if (!m || !m.position || !Number.isFinite(m.position.lat) || Math.abs(m.position.lat) > 90
              || !Number.isFinite(m.position.lng) || Math.abs(m.position.lng) > 180) return;
            var selected = !!presentation && presentation.selectedMarkerId === m.id;
            var icon = presentationIcon(m.kind, selected);
            var marker = L.marker(
              [m.position.lat, m.position.lng],
              { icon: icon, bubblingMouseEvents: false, title: m.label || '', zIndexOffset: selected ? 1000 : 0 }
            );
            if (m.label && !presentation) {
              // Leaflet treats string popup content as HTML. Incident titles are
              // resident-controlled, so pass a text node container instead.
              var popupContent = document.createElement('div');
              popupContent.textContent = String(m.label);
              marker.bindPopup(popupContent);
            }
            marker.on('click', function () {
              postToRN({ type: 'MARKER_TAPPED', payload: { markerId: m.id } });
            });
            markerLayer.addLayer(marker);
            markerEntries.push({ marker: marker, id: m.id, kind: m.kind });
          });

          // Fit the map to the new markers — unless a boundary is set, in which case
          // the boundary stays the fixed focus and markers must not shift the view.
          if (!hasBoundary && markerEntries.length > 0 && (!presentation || !presentationFitted)) {
            var group = L.featureGroup(markerLayer.getLayers());
            if (presentation) { fitPresentationBounds(group.getBounds().pad(0.2), false); presentationFitted = true; }
            else map.fitBounds(group.getBounds().pad(0.2));
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
            if (presentation) fitPresentationBounds(boundaryFeature.getBounds().pad(0.1), false);
            else map.fitBounds(boundaryFeature.getBounds().pad(0.1));
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
          // Frame the route in the part of the map not covered by floating controls; if they
          // leave less than 120 px, shrink both paddings so the route stays visible.
          var pad = msg.payload.padding;
          var top = pad && pad.top > 0 ? pad.top : 0;
          var bottom = pad && pad.bottom > 0 ? pad.bottom : 0;
          var height = map.getSize().y;
          if (top + bottom > height - 120) {
            var scale = Math.max(0, height - 120) / (top + bottom);
            top = top * scale;
            bottom = bottom * scale;
          }
          map.fitBounds(line.getBounds(), {
            paddingTopLeft: [24, top + 24],
            paddingBottomRight: [24, bottom + 24],
            maxZoom: 18,
          });
          break;
        }
        case 'CLEAR_ROUTE': {
          routeLayer.clearLayers();
          break;
        }
        case 'SET_USER_LOCATION': {
          if (!map) break;
          currentUserLocation = msg.payload;
          drawUserLocation();
          break;
        }
        case 'SET_TILES': {
          tilesEnabled = !!(msg.payload && msg.payload.enabled);
          if (!map || !tileLayer) break;
          if (tilesEnabled && !map.hasLayer(tileLayer)) tileLayer.addTo(map);
          if (!tilesEnabled && map.hasLayer(tileLayer)) map.removeLayer(tileLayer);
          break;
        }
        case 'SET_PACK_BASEMAP': {
          basemapLayer.clearLayers();
          var packMap = msg.payload && msg.payload.map;
          if (!map || !packMap || !Array.isArray(packMap.features)) break;
          basemapLayer.addLayer(L.geoJSON(packMap, {
            filter: function (f) { return f.properties && (f.properties.layer === 'road' || f.properties.layer === 'water'); },
            renderer: basemapRenderer,
            pane: 'packBasemap',
            interactive: false,
            style: function (f) {
              var p = f.properties;
              if (p.layer === 'water') {
                return { color: '#60A5FA', weight: 2, opacity: 0.9, fillColor: '#BFDBFE', fillOpacity: 0.7 };
              }
              var major = p.kind === 'primary' || p.kind === 'secondary' || p.kind === 'tertiary' || p.kind === 'secondary_link';
              return {
                color: p.walkable ? (major ? '#6B7280' : '#9CA3AF') : '#D1D5DB',
                weight: major ? 5 : 3,
                opacity: 0.95,
                dashArray: p.walkable ? null : '4 4',
              };
            },
          }));
          break;
        }
        case 'SET_ROAD_MARKS': {
          roadMarksLayer.clearLayers();
          var marks = msg.payload;
          if (!map || !marks) break;
          var addLines = function (lines, style) {
            (lines || []).forEach(function (line) {
              if (!Array.isArray(line) || line.length < 2) return;
              roadMarksLayer.addLayer(L.polyline(line.map(function (p) { return [p[1], p[0]]; }), Object.assign({ renderer: marksRenderer, interactive: false, lineCap: 'round' }, style)));
            });
          };
          addLines(marks.closures, { color: '#DC2626', weight: 7, opacity: 0.9 });
          addLines(marks.avoided, { color: '#7C3AED', weight: 7, opacity: 0.85, dashArray: '8 6' });
          if (marks.selected) addLines([marks.selected], { color: '#F59E0B', weight: 9, opacity: 0.95 });
          break;
        }
        case 'SET_TAP_MODE': {
          tapEnabled = !!(msg.payload && msg.payload.enabled);
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

export interface MapUserLocation {
  position: LatLng;
  accuracyMeters: number | null;
  pending: boolean;
}

export interface MapViewProps {
  /** Opt-in chrome and selection for resident Maps. Other callers retain their presentation. */
  presentation?: MapPresentation;
  /** Presentation dismissal only; never called for picker, marker or routing taps. */
  onBackgroundTap?: () => void;
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
  /** Registration is advisory; Settings keeps the default hard constraint. */
  constrainPicker?: boolean;
  /** Fires with the pin's new position once it passes the `boundary` check (if any). */
  onPickerMoved?: (position: LatLng) => void;
  /** Fires when a tap/drag landed outside `boundary` and was rejected. */
  onPickerRejected?: (attemptedPosition: LatLng) => void;
  /** The resident's location marker and accuracy circle; `pending` = awaiting confirmation. */
  userLocation?: MapUserLocation | null;
  onMarkerTap?: (markerId: string) => void;
  onMapReady?: () => void;
  onMapError?: () => void;
  /** Overrides the default 158px top clearance of Leaflet's zoom (+/-) control. */
  zoomControlTop?: number;
  /** Online OpenStreetMap tiles (default on). Off = no tile requests at all. */
  showTiles?: boolean;
  /** Vector roads and water from the installed routing pack, drawn as the offline basemap. */
  packMap?: FeatureCollection<Geometry, { layer: string; kind: string | null; walkable: boolean | null }> | null;
  /** Verified closures, the resident's blocked segments and the segment being marked ([lng, lat] lines). */
  roadMarks?: { closures: readonly (readonly MapLngLat[])[]; avoided: readonly (readonly MapLngLat[])[]; selected: readonly MapLngLat[] | null } | null;
  /** Route polyline, fitted into view when it changes; null clears it. */
  route?: LatLng[] | null;
  /** Map area (px) covered by floating controls at the top and bottom; the route is fitted between them. */
  routePadding?: { top: number; bottom: number };
  /** While set, plain taps are reported here instead of placing the picker pin. */
  onMapTap?: ((position: LatLng) => void) | null;
  style?: ViewStyle;
}

function userLocationMessage(location: MapUserLocation | null | undefined): MapBridgeInboundMessage {
  return {
    type: 'SET_USER_LOCATION',
    payload: location
      ? { position: location.position, accuracyMeters: location.accuracyMeters, pending: location.pending }
      : null,
  };
}

// Map state is plain JSON data. Compare before serializing so equal network rows,
// geometry and inline presentation objects do not rebuild Leaflet layers/icons.
function sameMapState(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => sameMapState(value, right[index]));
  }
  if (Array.isArray(left) || Array.isArray(right)) return false;
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) return false;
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every(key => Object.hasOwn(b, key) && sameMapState(a[key], b[key]));
}

// ── Component ────────────────────────────────────────────────────────────────

const MapViewInner = forwardRef<MapViewHandle, MapViewProps>(({ markers, center, focusPosition, kindColors, boundary, boundaryRefitKey, picker, constrainPicker = true, onPickerMoved, onPickerRejected, userLocation, onMarkerTap, onMapReady, onMapError, zoomControlTop, showTiles = true, packMap = null, roadMarks = null, route = null, routePadding, onMapTap = null, presentation, onBackgroundTap, style }, ref) => {
  const webViewRef = useRef<NativeWebView>(null);
  const isReadyRef = useRef(false);
  const sentStateRef = useRef(new Map<LocalMapInboundMessage['type'], LocalMapInboundMessage>());
  const boundaryRefitRef = useRef(boundaryRefitKey);
  useEffect(() => mountDiagnosticOwner('map'), []);
  // Read when a route is drawn; changing the padding alone does not refit (the resident may have panned).
  const routePaddingRef = useRef(routePadding);
  routePaddingRef.current = routePadding;
  // Last picker position that passed the boundary check — what an out-of-boundary
  // tap/drag snaps back to. Seeded from `picker.position` so the very first fix
  // (already trusted — GPS or a barangay centroid) has somewhere valid to revert to.
  const lastAcceptedPickerPosRef = useRef<LatLng | null>(picker?.position ?? null);

  function resetDocument() {
    isReadyRef.current = false;
    sentStateRef.current.clear();
  }

  function sendMessage(msg: LocalMapInboundMessage, force = false) {
    if (!webViewRef.current || !isReadyRef.current) return;
    const stateful = msg.type === 'SET_MARKERS' || msg.type === 'SET_BOUNDARY' || msg.type === 'SET_PRESENTATION';
    if (stateful && !force && sameMapState(sentStateRef.current.get(msg.type), msg)) return;
    const js = `
      (function() {
        var event = new MessageEvent('message', { data: ${JSON.stringify(JSON.stringify(msg))} });
        window.dispatchEvent(event);
      })();
      true;
    `;
    webViewRef.current.injectJavaScript(js);
    if (stateful) sentStateRef.current.set(msg.type, msg);
    if (navigationDiagnosticsAvailable) recordNavigationDiagnostic('map-send', 'map', { message: msg.type, count: js.length });
  }

  useImperativeHandle(ref, () => ({
    fitAll: () => {
      if (!isReadyRef.current) return;
      sendMessage({ type: 'FIT_ALL' });
    },
    fitBoundary: () => sendMessage({ type: 'FIT_BOUNDARY' }),
    flyTo: position => {
      if (isMapPosition(position) && Number.isFinite(position.zoom) && position.zoom >= 0 && position.zoom <= 19) {
        sendMessage({ type: 'FLY_TO', payload: position });
      }
    },
    zoomIn: () => sendMessage({ type: 'ZOOM', payload: { delta: 1 } }),
    zoomOut: () => sendMessage({ type: 'ZOOM', payload: { delta: -1 } }),
  }));

  useEffect(() => { sendMessage({ type: 'SET_PRESENTATION', payload: presentation ?? null }); }, [presentation]);

  const tapMode = onMapTap !== null;
  useEffect(() => {
    if (!isReadyRef.current) return;
    sendMessage({ type: 'SET_TILES', payload: { enabled: showTiles } });
  }, [showTiles]);

  useEffect(() => {
    if (!isReadyRef.current) return;
    sendMessage({ type: 'SET_PACK_BASEMAP', payload: { map: packMap } });
  }, [packMap]);

  useEffect(() => {
    if (!isReadyRef.current) return;
    sendMessage({ type: 'SET_ROAD_MARKS', payload: roadMarks ?? { closures: [], avoided: [], selected: null } });
  }, [roadMarks]);

  useEffect(() => {
    if (!isReadyRef.current) return;
    sendMessage({ type: 'SET_TAP_MODE', payload: { enabled: tapMode } });
  }, [tapMode]);

  useEffect(() => {
    if (!isReadyRef.current) return;
    sendMessage(route && route.length >= 2 ? { type: 'DRAW_ROUTE', payload: { points: route, padding: routePaddingRef.current } } : { type: 'CLEAR_ROUTE' });
  }, [route]);

  // References may change after an equal response; only changed state crosses the bridge.
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
    const refit = boundaryRefitRef.current !== boundaryRefitKey;
    boundaryRefitRef.current = boundaryRefitKey;
    if (!isReadyRef.current) return;
    sendMessage({ type: 'SET_BOUNDARY', payload: { geometry: boundary ?? null } }, refit);
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

  // Keyed on primitives so an inline object from the caller doesn't resend every render.
  const userLat = userLocation?.position.lat;
  const userLng = userLocation?.position.lng;
  const userAccuracy = userLocation?.accuracyMeters ?? null;
  const userPending = userLocation?.pending ?? false;
  useEffect(() => {
    if (!isReadyRef.current) return;
    sendMessage(userLocationMessage(userLocation));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLat, userLng, userAccuracy, userPending]);

  // Incoming messages from the WebView.
  function handleMessage(event: { nativeEvent: { data: string } }) {
    const msg = readMapMessage(event.nativeEvent.data);
    if (!msg) return;

    switch (msg.type) {
      case 'MAP_ERROR': { onMapError?.(); break; }
      case 'MAP_READY': {
        if (navigationDiagnosticsAvailable) recordNavigationDiagnostic('map-ready', 'map');
        if (isReadyRef.current) break;
        isReadyRef.current = true;
        if (presentation) sendMessage({ type: 'SET_PRESENTATION', payload: presentation });
        sendMessage({ type: 'SET_TILES', payload: { enabled: showTiles } });
        if (packMap) sendMessage({ type: 'SET_PACK_BASEMAP', payload: { map: packMap } });
        if (roadMarks) sendMessage({ type: 'SET_ROAD_MARKS', payload: roadMarks });
        if (tapMode) sendMessage({ type: 'SET_TAP_MODE', payload: { enabled: true } });
        sendMessage({
          type: 'SET_MARKERS',
          payload: { markers, ...(kindColors ? { kindColors } : {}) },
        });
        if (boundary) {
          sendMessage({ type: 'SET_BOUNDARY', payload: { geometry: boundary } });
        }
        if (center) {
          sendMessage({ type: 'SET_CENTER', payload: center });
        }
        if (focusPosition) sendMessage({ type: 'SET_VIEW', payload: focusPosition });
        if (picker) {
          sendMessage({ type: 'SET_PICKER', payload: { enabled: picker.enabled, position: picker.position } });
        }
        // A map that becomes ready after a fix arrived still receives the latest location.
        if (userLocation) {
          sendMessage(userLocationMessage(userLocation));
        }
        if (route && route.length >= 2) sendMessage({ type: 'DRAW_ROUTE', payload: { points: route, padding: routePaddingRef.current } });
        onMapReady?.();
        break;
      }
      case 'MAP_TAPPED': {
        if (onMapTap) onMapTap(msg.payload);
        break;
      }
      case 'BACKGROUND_TAPPED': {
        if (presentation && !tapMode && !picker?.enabled) onBackgroundTap?.();
        break;
      }
      case 'MARKER_TAPPED': {
        if (markers.some(marker => marker.id === msg.payload.markerId)) onMarkerTap?.(msg.payload.markerId);
        break;
      }
      case 'MAP_MOVED': {
        break;
      }
      case 'PICKER_MOVED': {
        if (!picker?.enabled || tapMode) break;
        const pos = msg.payload;
        if (constrainPicker && boundary && !isPointInPolygon(pos, boundary)) {
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
      <View style={[styles.webFallback, presentation && { backgroundColor: presentation.surface }, style]}>
        <Text style={[styles.webFallbackText, presentation && { color: presentation.text, fontFamily: presentation.fontFamily }]}>Map unavailable on web</Text>
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
      onLoadStart={() => {
        resetDocument();
        if (navigationDiagnosticsAvailable) recordNavigationDiagnostic('map-load', 'map');
      }}
      onError={() => { resetDocument(); onMapError?.(); }}
      onRenderProcessGone={() => { resetDocument(); onMapError?.(); }}
      injectedJavaScript={
        zoomControlTop !== undefined
          ? `(function(){var s=document.createElement('style');s.textContent='.leaflet-top.leaflet-left{margin-top:${Math.round(zoomControlTop)}px !important;}';document.head.appendChild(s);})();true;`
          : undefined
      }
      originWhitelist={['*']}
      scrollEnabled={false}
      // Lets Leaflet's own pan/pinch-zoom gestures inside the WebView win the touch
      // responder over an ancestor ScrollView (e.g. the incident detail screen's Location
      // card) instead of the outer list "stealing" the drag as a page-scroll — without
      // this, dragging the map on Android feels stuck/jumpy whenever MapView is nested
      // inside a scrollable parent. No effect when there's no scrollable ancestor (the
      // Maps tab, the full-screen location picker).
      nestedScrollEnabled
      javaScriptEnabled
      domStorageEnabled
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
