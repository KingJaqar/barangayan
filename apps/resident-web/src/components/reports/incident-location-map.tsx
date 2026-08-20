'use client';

import L from 'leaflet';
import { useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { LocateFixed } from 'lucide-react';

const RECENTER_ZOOM = 18;

const pinIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="30" height="45" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24S24 21 24 12C24 5.4 18.6 0 12 0z" fill="#DC2626"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`,
  className: '',
  iconSize: [30, 45],
  iconAnchor: [15, 45],
});

function RecenterButton({ position }: { position: { lat: number; lng: number } }) {
  const map = useMap();
  return (
    <button
      type="button"
      aria-label="Recenter map on pinned location"
      onClick={() => map.flyTo([position.lat, position.lng], RECENTER_ZOOM)}
      className="absolute bottom-2 right-2 z-[1000] flex size-9 items-center justify-center rounded-full bg-white text-[var(--accent)] shadow-md hover:opacity-80 dark:bg-zinc-800">
      <LocateFixed size={17} />
    </button>
  );
}

/**
 * Read-only mini map for the incident detail page — shows exactly where the resident
 * pinned this report. Freely pannable/zoomable (no picker), with a recenter button to
 * fly back to the pin. Mirrors mobile's LocationCard map ([incidentId].tsx).
 */
export function IncidentLocationMap({ position }: { position: { lat: number; lng: number } }) {
  const mapRef = useRef<L.Map | null>(null);

  return (
    <div className="relative h-[270px] w-full overflow-hidden rounded-2xl">
      <MapContainer
        center={[position.lat, position.lng]}
        zoom={RECENTER_ZOOM}
        className="h-full w-full"
        zoomControl={true}
        ref={mapRef}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Marker position={[position.lat, position.lng]} icon={pinIcon} />
        <RecenterButton position={position} />
      </MapContainer>
    </div>
  );
}
