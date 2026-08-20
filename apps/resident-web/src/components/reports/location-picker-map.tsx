'use client';

import type { MultiPolygon, Polygon } from 'geojson';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { GeoJSON, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

const DEFAULT_ZOOM = 17;

const pickerIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="30" height="45" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24S24 21 24 12C24 5.4 18.6 0 12 0z" fill="#DC2626"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`,
  className: '',
  iconSize: [30, 45],
  iconAnchor: [15, 45],
});

/** Places/moves the pin on click, flagging `skipNextFlyRef` so the resulting position
 * update doesn't also trigger ViewSync's flyTo — the map is already where the resident
 * clicked, re-flying to it would just be a pointless animation. */
function ClickHandler({
  onMove,
  skipNextFlyRef,
}: {
  onMove: (point: { lat: number; lng: number }) => void;
  skipNextFlyRef: React.MutableRefObject<boolean>;
}) {
  useMapEvents({
    click(e) {
      skipNextFlyRef.current = true;
      onMove({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Flies the view to `position` whenever it changes for a reason other than the map's
 * own click/drag handlers (e.g. the "Use My Location" button outside the map) — those
 * set `skipNextFlyRef` first so this effect no-ops for self-caused moves. */
function ViewSync({
  position,
  skipNextFlyRef,
}: {
  position: { lat: number; lng: number } | null;
  skipNextFlyRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();
  const prevKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!position) return;
    const key = `${position.lat},${position.lng}`;
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    if (skipNextFlyRef.current) {
      skipNextFlyRef.current = false;
      return;
    }
    map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), DEFAULT_ZOOM));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  return null;
}

/** Fits the map to the barangay boundary once on mount, unless a starting position was
 * already supplied (previous pick / geolocation fix) — then it centers there instead. */
function InitialView({
  boundary,
  position,
}: {
  boundary: Polygon | MultiPolygon;
  position: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (fittedRef.current) return;
    fittedRef.current = true;

    if (position) {
      map.setView([position.lat, position.lng], DEFAULT_ZOOM);
    } else {
      map.fitBounds(L.geoJSON(boundary).getBounds().pad(0.1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

export interface LocationPickerMapProps {
  position: { lat: number; lng: number } | null;
  boundary: Polygon | MultiPolygon;
  onPositionChange: (point: { lat: number; lng: number }) => void;
}

/**
 * Report an Incident's location picker — tap or drag the pin anywhere on the map to set
 * the incident's exact coordinates; the parent form (new-report-form.tsx) reverse-
 * geocodes whatever position this reports up, same as it already does for the "Use My
 * Location" button. No hard boundary rejection like mobile's LocationPickerModal (that
 * relies on native WebView bridge validation); the boundary line here is drawn for
 * visual reference and initial framing only.
 */
export function LocationPickerMap({ position, boundary, onPositionChange }: LocationPickerMapProps) {
  const skipNextFlyRef = useRef(false);

  return (
    <div className="h-64 w-full overflow-hidden rounded-xl border border-border">
      <MapContainer center={[14.680291, 121.1187445]} zoom={DEFAULT_ZOOM} className="h-full w-full" zoomControl={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <InitialView boundary={boundary} position={position} />
        <ViewSync position={position} skipNextFlyRef={skipNextFlyRef} />
        <ClickHandler onMove={onPositionChange} skipNextFlyRef={skipNextFlyRef} />

        <GeoJSON data={boundary} style={{ color: '#DC2626', weight: 2, opacity: 0.7, fillColor: '#DC2626', fillOpacity: 0.03 }} />

        {position ? (
          <Marker
            position={[position.lat, position.lng]}
            icon={pickerIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                skipNextFlyRef.current = true;
                const marker = e.target as L.Marker;
                const latlng = marker.getLatLng();
                onPositionChange({ lat: latlng.lat, lng: latlng.lng });
              },
            }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
