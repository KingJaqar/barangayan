'use client';

import type { LatLng } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';

import { BoundaryFitButton } from '@/components/maps/boundary-fit-button';
import { FullscreenSync } from '@/components/maps/fullscreen-sync';
import { LocateButton } from '@/components/maps/locate-button';
import { MapSearchBar } from '@/components/maps/map-search-bar';
import type { EvacuationCenterWithDistance } from '@/hooks/use-evacuation-centers';
import { useFullscreen } from '@/hooks/use-fullscreen';

const DEFAULT_CENTER = { lat: 14.680291, lng: 121.1187445 } as const;
const DEFAULT_ZOOM = 15;

function createIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24S24 21 24 12C24 5.4 18.6 0 12 0z" fill="${color}"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [24, 36], iconAnchor: [12, 36], popupAnchor: [0, -36] });
}

const centerIcon = createIcon('#10B981');
const selectedCenterIcon = createIcon('#0F6E5B');
const userIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;border-radius:9999px;background:#2563EB;border:3px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.15)"></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function MapFitter({ points }: { points: LatLng[] }) {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (fittedRef.current || points.length === 0) return;
    fittedRef.current = true;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], DEFAULT_ZOOM);
    } else {
      map.fitBounds(
        points.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [50, 50] },
      );
    }
  }, [map, points]);

  return null;
}

/**
 * Evacuation centers map — now carries the same control set as the main Maps screen's
 * map view (search, native zoom +/-, Reset/boundary-fit, "You"/locate, full screen), per
 * request, rather than the pared-down version it shipped with initially.
 */
export function CentersMap({
  centers,
  userPosition,
  onUserPositionChange,
  selectedCenterId,
  onSelectCenter,
  routePoints,
  boundary,
}: {
  centers: EvacuationCenterWithDistance[];
  userPosition: LatLng | null;
  onUserPositionChange: (position: LatLng) => void;
  selectedCenterId: string | null;
  onSelectCenter: (id: string) => void;
  routePoints: LatLng[] | null;
  boundary: Polygon | MultiPolygon | null;
}) {
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);

  const visibleCenters = useMemo(() => {
    if (!search.trim()) return centers;
    const q = search.trim().toLowerCase();
    return centers.filter((c) => c.name.toLowerCase().includes(q) || (c.address ?? '').toLowerCase().includes(q));
  }, [centers, search]);

  const fitPoints = userPosition ? [userPosition, ...visibleCenters.map((c) => c.position)] : visibleCenters.map((c) => c.position);

  return (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? 'relative h-screen w-screen overflow-hidden bg-card'
          : 'relative h-[420px] w-full overflow-hidden rounded-2xl border border-border'
      }>
      <MapContainer center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]} zoom={DEFAULT_ZOOM} className="h-full w-full" zoomControl={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapFitter points={fitPoints} />
        <FullscreenSync isFullscreen={isFullscreen} />

        {boundary ? (
          <GeoJSON data={boundary} style={{ color: '#DC2626', weight: 3, opacity: 0.95, fillColor: '#DC2626', fillOpacity: 0.04 }} />
        ) : null}

        {userPosition ? (
          <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon}>
            <Popup>You are here</Popup>
          </Marker>
        ) : null}

        {visibleCenters.map((center) => (
          <Marker
            key={center.id}
            position={[center.position.lat, center.position.lng]}
            icon={center.id === selectedCenterId ? selectedCenterIcon : centerIcon}
            eventHandlers={{ click: () => onSelectCenter(center.id) }}>
            <Popup>
              <p className="font-semibold">{center.name}</p>
              {center.address ? <p className="text-xs">{center.address}</p> : null}
            </Popup>
          </Marker>
        ))}

        {routePoints && routePoints.length > 1 ? (
          <Polyline positions={routePoints.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#0F6E5B', weight: 4, opacity: 0.85 }} />
        ) : null}

        <MapSearchBar value={search} onChange={setSearch} placeholder="Search evacuation centers…" />
        <LocateButton onLocated={onUserPositionChange} />
        <BoundaryFitButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
      </MapContainer>
    </div>
  );
}
