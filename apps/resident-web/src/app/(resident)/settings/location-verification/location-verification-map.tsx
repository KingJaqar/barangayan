'use client';

/**
 * Settings > Location Verification's Leaflet map — pattern-referenced from
 * components/reports/location-picker-map.tsx (same pin icon, same fly-to-on-external-
 * change / skip-fly-on-self-caused-move dance), but adds hard boundary-rejection on both
 * click and drag: dropping or dragging the pin outside the barangay boundary snaps it
 * back and reports `onRejected()` instead of moving it, mirroring the native app's
 * MapView (apps/resident-android-mobile/src/components/map-view.tsx, isPointInPolygon
 * check) rather than the Incident Reports picker's soft/visual-only boundary line.
 */
import type { LatLng } from '@barangayan/shared';
import { isPointInPolygon } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { GeoJSON, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

const DEFAULT_ZOOM = 17;
const DEFAULT_CENTER: LatLng = { lat: 14.680291, lng: 121.1187445 }; // Ampid I, San Mateo

const pickerIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="30" height="45" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24S24 21 24 12C24 5.4 18.6 0 12 0z" fill="#DC2626"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`,
  className: '',
  iconSize: [30, 45],
  iconAnchor: [15, 45],
});

/** Places/moves the pin on click if it lands inside the boundary; otherwise reports a
 * rejection and leaves the pin where it was. Flags `skipNextFlyRef` on an accepted move
 * so ViewSync doesn't also re-fly to a spot the map is already centered on. */
function ClickHandler({
  boundary,
  onMove,
  onRejected,
  skipNextFlyRef,
}: {
  boundary: Polygon | MultiPolygon;
  onMove: (point: LatLng) => void;
  onRejected: () => void;
  skipNextFlyRef: React.MutableRefObject<boolean>;
}) {
  useMapEvents({
    click(e) {
      const point = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (!isPointInPolygon(point, boundary)) {
        onRejected();
        return;
      }
      skipNextFlyRef.current = true;
      onMove(point);
    },
  });
  return null;
}

/** Flies the view to `position` whenever it changes for a reason other than the map's
 * own click/drag handlers (e.g. the "Detect Your Location" button) — those set
 * `skipNextFlyRef` first so this effect no-ops for self-caused moves. */
function ViewSync({ position, skipNextFlyRef }: { position: LatLng | null; skipNextFlyRef: React.MutableRefObject<boolean> }) {
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
 * already supplied (previous save / geolocation fix) — then it centers there instead. */
function InitialView({ boundary, position }: { boundary: Polygon | MultiPolygon; position: LatLng | null }) {
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

export interface LocationVerificationMapProps {
  position: LatLng | null;
  boundary: Polygon | MultiPolygon;
  onPositionChange: (point: LatLng) => void;
  onRejected: () => void;
}

export function LocationVerificationMap({ position, boundary, onPositionChange, onRejected }: LocationVerificationMapProps) {
  const skipNextFlyRef = useRef(false);

  return (
    <MapContainer
      center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
      zoom={DEFAULT_ZOOM}
      className="h-full w-full"
      zoomControl={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      <InitialView boundary={boundary} position={position} />
      <ViewSync position={position} skipNextFlyRef={skipNextFlyRef} />
      <ClickHandler boundary={boundary} onMove={onPositionChange} onRejected={onRejected} skipNextFlyRef={skipNextFlyRef} />

      <GeoJSON data={boundary} style={{ color: '#DC2626', weight: 2, opacity: 0.7, fillColor: '#DC2626', fillOpacity: 0.03 }} />

      {position ? (
        <Marker
          position={[position.lat, position.lng]}
          icon={pickerIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target as L.Marker;
              const latlng = marker.getLatLng();
              const point = { lat: latlng.lat, lng: latlng.lng };
              if (!isPointInPolygon(point, boundary)) {
                // Snap the pin back — the boundary is a hard constraint here (unlike the
                // Incident Reports picker's visual-only line).
                marker.setLatLng([position.lat, position.lng]);
                onRejected();
                return;
              }
              skipNextFlyRef.current = true;
              onPositionChange(point);
            },
          }}
        />
      ) : null}
    </MapContainer>
  );
}
