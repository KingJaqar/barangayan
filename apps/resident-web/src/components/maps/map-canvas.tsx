'use client';

import type { CategoryRow, MapEvacuationMarker, MapIncidentMarker } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import L from 'leaflet';
import { MapPinOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, LayerGroup, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';

import { BoundaryFitButton } from '@/components/maps/boundary-fit-button';
import { FullscreenSync } from '@/components/maps/fullscreen-sync';
import { LocateButton } from '@/components/maps/locate-button';
import { EvacuationPopupContent, IncidentPopupContent } from '@/components/maps/map-marker-popup';
import { MapFilterPills } from '@/components/maps/map-filter-pills';
import { MapSearchBar } from '@/components/maps/map-search-bar';
import { MapSegmentToggle } from '@/components/maps/map-segment-toggle';
import { useFullscreen } from '@/hooks/use-fullscreen';

const DEFAULT_CENTER = { lat: 14.680291, lng: 121.1187445 } as const;
const DEFAULT_ZOOM = 15;

function createPinIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24S24 21 24 12C24 5.4 18.6 0 12 0z" fill="${color}"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [24, 36], iconAnchor: [12, 36], popupAnchor: [0, -36] });
}

const evacuationIcon = createPinIcon('#10B981');
const userIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;border-radius:9999px;background:#2563EB;border:3px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.15)"></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function MapFitter({
  boundary,
  markers,
}: {
  boundary: Polygon | MultiPolygon | null;
  markers: { position: { lat: number; lng: number } }[];
}) {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (fittedRef.current) return;
    fittedRef.current = true;

    if (boundary) {
      map.fitBounds(L.geoJSON(boundary).getBounds().pad(0.1));
    } else if (markers.length > 0) {
      map.fitBounds(
        markers.map((m) => [m.position.lat, m.position.lng] as [number, number]),
        { padding: [50, 50] },
      );
    } else {
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_ZOOM);
    }
    // Intentionally runs once — re-fitting on every marker/boundary update would fight
    // a resident who has since panned/zoomed manually (BoundaryFitButton covers that).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

/**
 * Barangay-wide incidents + evacuation centers map — new build (mobile no-ops on web
 * today), pattern-referenced from admin-web's incident-map/MapCanvas.tsx but restyled
 * onto resident-web's own tokens/Framer Motion conventions and driven by local
 * component state rather than URL search params (matches this app's own
 * emergency/centers-content.tsx, not admin-web's router.replace pattern — there is no
 * shareable-link requirement here). Clustered incident markers (react-leaflet-cluster)
 * so a barangay with hundreds of reports doesn't render hundreds of overlapping pins at
 * low zoom; evacuation centers are few and fixed, so they stay unclustered.
 *
 * `boundary` always has a real value by the time it reaches here — maps/page.tsx falls
 * back to the bundled Ampid I geometry (lib/barangay-boundary.ts) whenever the DB
 * boundary is null, so the boundary line always draws and "Reset" always has a real
 * barangay outline to fit to.
 */
export function MapCanvas({
  incidentMarkers,
  evacuationMarkers,
  categories,
  boundary,
}: {
  incidentMarkers: MapIncidentMarker[];
  evacuationMarkers: MapEvacuationMarker[];
  categories: CategoryRow[];
  boundary: Polygon | MultiPolygon | null;
}) {
  const [activeTab, setActiveTab] = useState<'incidents' | 'evacuation'>('incidents');
  const [activeCategoryIds, setActiveCategoryIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      Promise.resolve().then(() => setGeoDenied(true));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoDenied(true),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const categoryColorByIncidentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of incidentMarkers) map.set(m.id, m.categoryColor || '#0F6E5B');
    return map;
  }, [incidentMarkers]);

  const visibleIncidentMarkers = useMemo(() => {
    let markers = incidentMarkers;
    if (activeCategoryIds.length > 0) {
      markers = markers.filter((m) => activeCategoryIds.includes(m.kind));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      markers = markers.filter(
        (m) =>
          m.label.toLowerCase().includes(q) ||
          (m.address ?? '').toLowerCase().includes(q) ||
          (m.categoryName ?? '').toLowerCase().includes(q),
      );
    }
    return markers;
  }, [incidentMarkers, activeCategoryIds, search]);

  const visibleEvacuationMarkers = useMemo(() => {
    if (activeTab !== 'evacuation') return [];
    if (!search.trim()) return evacuationMarkers;
    const q = search.trim().toLowerCase();
    return evacuationMarkers.filter((m) => m.label.toLowerCase().includes(q));
  }, [evacuationMarkers, activeTab, search]);

  const allVisibleMarkers = activeTab === 'evacuation' ? visibleEvacuationMarkers : visibleIncidentMarkers;
  const hasMarkers = allVisibleMarkers.length > 0;

  function handleCategoryToggle(id: string) {
    setActiveCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  return (
    <div className="flex flex-col gap-3">
      {geoDenied ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPinOff size={12} /> Location unavailable — showing the barangay view instead.
        </p>
      ) : null}

      <div
        ref={containerRef}
        className={
          isFullscreen
            ? 'relative h-screen w-screen overflow-hidden bg-card'
            : 'relative h-[calc(100vh-220px)] min-h-[480px] w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/5'
        }>
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

          <MapFitter boundary={boundary} markers={allVisibleMarkers} />
          <FullscreenSync isFullscreen={isFullscreen} />

          {boundary ? (
            <GeoJSON
              data={boundary}
              style={{ color: '#DC2626', weight: 3, opacity: 0.95, fillColor: '#DC2626', fillOpacity: 0.04 }}
            />
          ) : null}

          {userPosition ? (
            <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon}>
              <Popup>You are here</Popup>
            </Marker>
          ) : null}

          <LayerGroup>
            {activeTab === 'incidents' ? (
              <MarkerClusterGroup chunkedLoading maxClusterRadius={60} spiderfyOnMaxZoom>
                {visibleIncidentMarkers.map((marker) => (
                  <Marker
                    key={marker.id}
                    position={[marker.position.lat, marker.position.lng]}
                    icon={createPinIcon(categoryColorByIncidentId.get(marker.id) ?? '#0F6E5B')}>
                    <Popup>
                      <IncidentPopupContent marker={marker} />
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            ) : (
              visibleEvacuationMarkers.map((marker) => (
                <Marker key={marker.id} position={[marker.position.lat, marker.position.lng]} icon={evacuationIcon}>
                  <Popup>
                    <EvacuationPopupContent marker={marker} />
                  </Popup>
                </Marker>
              ))
            )}
          </LayerGroup>

          <MapSearchBar
            value={search}
            onChange={setSearch}
            placeholder={activeTab === 'incidents' ? 'Search incidents…' : 'Search evacuation centers…'}
          />
          <MapSegmentToggle activeTab={activeTab} onChange={setActiveTab} />
          {activeTab === 'incidents' ? (
            <MapFilterPills categories={categories} activeIds={activeCategoryIds} onToggle={handleCategoryToggle} />
          ) : null}
          <LocateButton onLocated={setUserPosition} />
          <BoundaryFitButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />

          {!hasMarkers ? (
            <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/95 px-8 py-6 text-center shadow-lg backdrop-blur-sm">
                <p className="text-sm font-medium text-muted-foreground">
                  {activeTab === 'incidents' ? 'No incidents match your filters' : 'No evacuation centers available'}
                </p>
              </div>
            </div>
          ) : null}
        </MapContainer>
      </div>
    </div>
  );
}
