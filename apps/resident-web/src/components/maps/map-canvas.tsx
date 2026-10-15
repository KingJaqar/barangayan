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
import { matchesMapSearch } from '@/components/maps/map-search';
import { MapSegmentToggle } from '@/components/maps/map-segment-toggle';
import { useFullscreen } from '@/hooks/use-fullscreen';
import styles from './maps.module.css';

const DEFAULT_CENTER = { lat: 14.680291, lng: 121.1187445 } as const;
const DEFAULT_ZOOM = 15;

function createPinIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24S24 21 24 12C24 5.4 18.6 0 12 0z" fill="${color}"/>
    <circle cx="12" cy="12" r="5" fill="var(--card)"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [24, 36], iconAnchor: [12, 36], popupAnchor: [0, -36] });
}

const evacuationIcon = createPinIcon('var(--primary)');
const userIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;border-radius:9999px;background:var(--primary);border:3px solid var(--card);box-shadow:0 0 0 1px var(--border)"></div>`,
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

/** Keep tiles aligned when the responsive toolbar or fullscreen viewport resizes. */
function MapViewportSync() {
  const map = useMap();
  useEffect(() => {
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    });
    observer.observe(map.getContainer());
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [map]);
  return null;
}

/** A standalone popup also works when the matching incident is inside a cluster. */
function SearchSelection({ marker }: { marker: MapIncidentMarker | MapEvacuationMarker }) {
  const map = useMap();
  const popupRef = useRef<L.Popup>(null);
  useEffect(() => {
    map.setView([marker.position.lat, marker.position.lng], Math.max(map.getZoom(), 18), { animate: false });
    popupRef.current?.openOn(map);
  }, [map, marker]);
  return <Popup ref={popupRef} position={[marker.position.lat, marker.position.lng]}>
    {'status' in marker ? <IncidentPopupContent marker={marker} /> : <EvacuationPopupContent marker={marker} />}
  </Popup>;
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
  const [selectedMarker, setSelectedMarker] = useState<MapIncidentMarker | MapEvacuationMarker | null>(null);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  // Why the automatic location request produced no position (null = fine or pending).
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);

  useEffect(() => {
    let active = true;
    const unavailable = 'Location unavailable — showing the barangay view instead.';
    if (!('geolocation' in navigator)) {
      Promise.resolve().then(() => {
        if (active) setGeoNotice(unavailable);
      });
      return () => {
        active = false;
      };
    }
    // getCurrentPosition cannot be cancelled; late callbacks are ignored after unmount.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (active) setUserPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (failure) => {
        if (!active) return;
        setGeoNotice(
          failure.code === 1
            ? "Location is blocked — showing the barangay view. Allow location in your browser's site settings, then use the locate button."
            : unavailable,
        );
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
    return () => {
      active = false;
    };
  }, []);

  const categoryColorByIncidentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of incidentMarkers) map.set(m.id, m.categoryColor || 'var(--primary)');
    return map;
  }, [incidentMarkers]);

  const visibleIncidentMarkers = useMemo(() => {
    let markers = incidentMarkers;
    if (activeCategoryIds.length > 0) {
      markers = markers.filter((m) => activeCategoryIds.includes(m.kind));
    }
    return markers.filter((m) => matchesMapSearch(search, [m.label, m.address, m.categoryName]));
  }, [incidentMarkers, activeCategoryIds, search]);

  const visibleEvacuationMarkers = useMemo(() => {
    if (activeTab !== 'evacuation') return [];
    return evacuationMarkers.filter((m) => matchesMapSearch(search, [m.label]));
  }, [evacuationMarkers, activeTab, search]);

  const allVisibleMarkers = activeTab === 'evacuation' ? visibleEvacuationMarkers : visibleIncidentMarkers;
  const hasMarkers = allVisibleMarkers.length > 0;
  const markerLabel = activeTab === 'incidents'
    ? (allVisibleMarkers.length === 1 ? 'incident' : 'incidents')
    : (allVisibleMarkers.length === 1 ? 'evacuation center' : 'evacuation centers');
  const emptyMessage = activeTab === 'incidents'
    ? 'No incidents match your filters'
    : (search.trim() ? 'No evacuation centers match your search' : 'No evacuation centers available');

  function handleCategoryToggle(id: string) {
    setSelectedMarker(null);
    setActiveCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function clearFilters() {
    setSearch('');
    setActiveCategoryIds([]);
    setSelectedMarker(null);
  }

  return (
    <div className={styles.mapColumn}>
      <div
        ref={containerRef}
        className={`${styles.mapFrame} ${isFullscreen ? styles.fullscreen : ''}`}>
        <div className={styles.toolbar}>
          <MapSegmentToggle activeTab={activeTab} incidentCount={incidentMarkers.length} evacuationCount={evacuationMarkers.length}
            onChange={(tab) => { setActiveTab(tab); setSearch(''); setSelectedMarker(null); }} />
          <MapSearchBar key={activeTab} value={search}
            recommendationLabel={activeTab === 'incidents' ? 'Recent incidents' : 'Evacuation centers to explore'}
            onChange={(value) => { setSearch(value); setSelectedMarker(null); }}
            results={allVisibleMarkers.map((marker) => ({ id: marker.id, label: marker.label,
              detail: 'status' in marker ? [marker.categoryName, marker.address].filter(Boolean).join(' · ') || 'Incident'
                : 'Evacuation center' }))}
            onSelect={(id) => { const marker = allVisibleMarkers.find((item) => item.id === id); if (marker) setSelectedMarker({ ...marker }); }}
            placeholder={activeTab === 'incidents' ? 'Search incidents…' : 'Search evacuation centers…'} />
        </div>
        {activeTab === 'incidents' ? (
          <MapFilterPills categories={categories} activeIds={activeCategoryIds} onToggle={handleCategoryToggle}
            onClear={() => { setActiveCategoryIds([]); setSelectedMarker(null); }} />
        ) : null}
        {search.trim() || (activeTab === 'incidents' && activeCategoryIds.length > 0) ? (
          <div className={styles.filterSummary}>
            <p role="status">{allVisibleMarkers.length} {markerLabel} {allVisibleMarkers.length === 1 ? 'matches' : 'match'}{search.trim() ? ` “${search.trim()}”` : ' your filters'}</p>
            <button type="button" onClick={clearFilters}>Clear filters</button>
          </div>
        ) : null}
        {geoNotice ? (
          <p className={styles.locationNotice}>
            <MapPinOff aria-hidden size={14} className="shrink-0" /> {geoNotice}
          </p>
        ) : null}
        <div className={styles.mapViewport}>
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
            <MapViewportSync />
            <FullscreenSync isFullscreen={isFullscreen} />

            {boundary ? (
              <GeoJSON
                data={boundary}
                style={{ color: 'var(--primary)', weight: 2, opacity: 0.85, fillColor: 'var(--primary)', fillOpacity: 0.04 }}
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
                      icon={createPinIcon(categoryColorByIncidentId.get(marker.id) ?? 'var(--primary)')}>
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

            {selectedMarker ? <SearchSelection key={`${activeTab}-${selectedMarker.id}-${search}`} marker={selectedMarker} /> : null}

            <LocateButton onLocated={setUserPosition} />
            <BoundaryFitButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />

            {!hasMarkers ? (
              <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/95 px-8 py-6 text-center shadow-lg backdrop-blur-sm">
                  <p className="text-sm font-medium text-muted-foreground">
                    {emptyMessage}
                  </p>
                </div>
              </div>
            ) : null}
          </MapContainer>
        <p className={styles.mapCaption} aria-live="polite" aria-atomic="true">
          <span>{allVisibleMarkers.length} {markerLabel} shown</span>
          <span><span className={styles.boundaryKey} /> Barangay boundary</span>
        </p>
        </div>
      </div>
    </div>
  );
}
