'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { MapPin } from 'lucide-react';
import styles from './incident-map.module.css';
import { MapContainer, TileLayer, Marker, Popup, LayerGroup, GeoJSON, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapSearchBar } from './MapSearchBar';
import { MapSegmentToggle } from './MapSegmentToggle';
import { MapFilterPills } from './MapFilterPills';
import { IncidentPopupContent, EvacuationPopupContent } from './MapMarkerPopup';
import { MapViewportControls } from './MapViewportControls';
import { Spinner } from '@/components/loading/spinner';
import { matchesMapQuery } from './map-search';
import type { IncidentRow } from '../incident-reports/page';
import type { MapIncidentMarker, MapEvacuationMarker, CategoryRow, EvacuationCenterRow } from '@barangayan/shared';

const DEFAULT_CENTER = { lat: 14.680291, lng: 121.1187445 } as const;
const DEFAULT_ZOOM = 16;
type ClusterHandle = L.FeatureGroup & { zoomToShowLayer: (marker: L.Marker, onVisible: () => void) => void };

function subscribeToMotion(callback: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
const readReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function subscribeToCompactLayout(callback: () => void) {
  const media = window.matchMedia('(max-width: 700px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
const readCompactLayout = () => window.matchMedia('(max-width: 700px)').matches;

function MapFitter({
  boundary,
  markers,
  defaultCenter,
  defaultZoom,
}: {
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  markers: { position: { lat: number; lng: number } }[];
  defaultCenter: { lat: number; lng: number };
  defaultZoom: number;
}) {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    if (fittedRef.current) return;
    fittedRef.current = true;

    if (boundary) {
      const layer = L.geoJSON(boundary);
      map.fitBounds(layer.getBounds().pad(0.1));
    } else if (markers.length > 0) {
      const latLngs = markers.map((m) => [m.position.lat, m.position.lng] as [number, number]);
      map.fitBounds(latLngs, { padding: [50, 50] });
    } else {
      map.setView([defaultCenter.lat, defaultCenter.lng], defaultZoom);
    }
  }, [map, boundary, markers, defaultCenter, defaultZoom]);

  return null;
}

export function MapCanvas({
  incidents,
  categories,
  centers,
  boundary,
}: {
  incidents: IncidentRow[];
  categories: CategoryRow[];
  centers: EvacuationCenterRow[];
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlTab = searchParams.get('tab') === 'evacuation' ? 'evacuation' : 'incidents';
  const urlCategoryIds = useMemo(() => searchParams.get('category')?.split(',').filter(Boolean) ?? [], [searchParams]);
  const urlQuery = searchParams.get('q') ?? '';
  const urlState = searchParams.toString();
  const latestParamsRef = useRef(urlState);

  const activeTab = urlTab;
  const activeCategoryIds = urlCategoryIds;
  const [localSearch, setLocalSearch] = useState(urlQuery);
  const deferredSearch = useDeferredValue(localSearch);
  const [navigationPending, startNavigation] = useTransition();
  const [tilesLoading, setTilesLoading] = useState(false);
  const [selection, setSelection] = useState<{ id: string } | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const markerRefs = useRef(new Map<string, L.Marker>());
  const clusterRef = useRef<ClusterHandle | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeToMotion, readReducedMotion, () => true);
  const compactLayout = useSyncExternalStore(subscribeToCompactLayout, readCompactLayout, () => false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, []);

  useEffect(() => {
    if (navigationPending) return;
    latestParamsRef.current = urlState;
    if (searchTimerRef.current) return;
    // Keep back/forward navigation in sync without replacing pending input.
    setLocalSearch(urlQuery);
  }, [urlQuery, urlState, navigationPending]);

  const incidentMarkers = useMemo<MapIncidentMarker[]>(() => {
    return incidents
      .filter((inc) => {
        const loc = inc.location as { lat?: unknown; lng?: unknown } | null;
        return loc !== null && typeof loc === 'object' && typeof loc.lat === 'number' && typeof loc.lng === 'number';
      })
      .map((inc) => {
        const loc = inc.location as { lat: number; lng: number };
        const category = categories.find((c) => c.id === inc.category_id);
        return {
          id: inc.id,
          position: { lat: loc.lat, lng: loc.lng },
          kind: inc.category_id ?? 'incident',
          label: inc.title,
          status: inc.status,
          categoryColor: category?.color,
          categoryName: category?.name,
          address: inc.address,
        };
      });
  }, [incidents, categories]);

  const evacuationMarkers = useMemo<MapEvacuationMarker[]>(() => {
    return centers
      .filter((c) => {
        const pos = c.position as { lat?: unknown; lng?: unknown } | null;
        return pos !== null && typeof pos === 'object' && typeof pos.lat === 'number' && typeof pos.lng === 'number';
      })
      .map((c) => {
        const pos = c.position as { lat: number; lng: number };
        return {
          id: c.id,
          position: { lat: pos.lat, lng: pos.lng },
          kind: 'evacuation',
          label: c.name,
          capacity: c.capacity,
          currentOccupancy: c.current_occupancy,
        };
      });
  }, [centers]);

  const visibleIncidentMarkers = useMemo(() => {
    let markers = incidentMarkers;
    if (activeCategoryIds.length > 0) {
      markers = markers.filter((m) => activeCategoryIds.includes(m.kind));
    }
    if (deferredSearch.trim()) {
      markers = markers.filter((m) => {
        const incident = incidents.find((i) => i.id === m.id);
        if (!incident) return false;
        const category = categories.find((c) => c.id === incident.category_id);
        const reporter = incident.profiles?.full_name ?? '';
        return matchesMapQuery([incident.title, incident.description, incident.address,
          incident.specific_area_details, incident.status.replaceAll('_', ' '), category?.name, reporter], deferredSearch);
      });
    }
    return markers;
  }, [incidentMarkers, activeCategoryIds, deferredSearch, incidents, categories]);

  const visibleEvacuationMarkers = useMemo(() => {
    if (activeTab !== 'evacuation') return [];
    return evacuationMarkers.filter(marker => matchesMapQuery([marker.label, centers.find(center => center.id === marker.id)?.address], deferredSearch));
  }, [evacuationMarkers, activeTab, deferredSearch, centers]);

  const allVisibleMarkers = useMemo(() => {
    return activeTab === 'evacuation' ? visibleEvacuationMarkers : visibleIncidentMarkers;
  }, [activeTab, visibleIncidentMarkers, visibleEvacuationMarkers]);

  useEffect(() => {
    if (!selection) return;
    const map = mapRef.current;
    const marker = markerRefs.current.get(selection.id);
    if (!map || !marker) return;
    let current = true;
    const open = () => { if (current) marker.openPopup(); };
    if (clusterRef.current?.hasLayer(marker)) {
      clusterRef.current.zoomToShowLayer(marker, open);
    } else {
      const position = marker.getLatLng();
      const zoom = Math.max(map.getZoom(), 17);
      if (map.getCenter().equals(position) && map.getZoom() === zoom) open();
      else {
        map.once('moveend', open);
        map.flyTo(position, zoom, { animate: !reducedMotion, duration: 0.5 });
      }
    }
    return () => { current = false; map.off('moveend', open); };
  }, [selection, reducedMotion]);

  const createIcon = (color?: string, evacuation = false) => {
    // Set category color through the DOM; the SVG inherits the active theme otherwise.
    const pin = document.createElement('div');
    pin.className = styles.pin;
    if (color) pin.style.setProperty('--category-color', color);
    pin.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" width="28" height="40">
      <path d="M14 1C6.8 1 1 6.8 1 14c0 9 13 25 13 25S27 23 27 14C27 6.8 21.2 1 14 1z" fill="currentColor" stroke="var(--background)" stroke-width="1.5"/>
      ${evacuation ? '<path d="m7 13 7-5 7 5v8h-5v-5h-4v5H7z" fill="var(--background)"/>' : '<circle cx="14" cy="14" r="5" fill="var(--background)"/>'}
    </svg>`;
    return L.divIcon({
      html: pin,
      className: 'custom-map-marker',
      iconSize: [28, 40],
      iconAnchor: [14, 40],
      popupAnchor: [0, -40],
    });
  };

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      searchTimerRef.current = null;
      const params = new URLSearchParams(latestParamsRef.current);
      if (value.trim()) {
        params.set('q', value.trim());
      } else {
        params.delete('q');
      }
      navigate(params);
    }, 300);
  };

  function navigate(params: URLSearchParams) {
    latestParamsRef.current = params.toString();
    startNavigation(() => router.replace(`?${params.toString()}`, { scroll: false }));
  }

  const currentParams = () => {
    // A pending search must not overwrite a layer or category change.
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = null;
    const params = new URLSearchParams(latestParamsRef.current);
    if (localSearch.trim()) params.set('q', localSearch.trim());
    else params.delete('q');
    return params;
  };

  const handleTabChange = (tab: 'incidents' | 'evacuation') => {
    setSelection(null);
    const params = currentParams();
    params.set('tab', tab);
    navigate(params);
  };

  const handleCategoryToggle = (id: string) => {
    setSelection(null);
    const params = currentParams();
    const current = params.get('category')?.split(',').filter(Boolean) ?? [];
    const next = current.includes(id) ? current.filter((cid) => cid !== id) : [...current, id];
    if (next.length > 0) {
      params.set('category', next.join(','));
    } else {
      params.delete('category');
    }
    navigate(params);
  };

  const hasMarkers = allVisibleMarkers.length > 0;
  const pending = navigationPending || deferredSearch !== localSearch || tilesLoading;
  const searchableRecords = activeTab === 'evacuation' ? evacuationMarkers
    : incidentMarkers.filter(marker => activeCategoryIds.length === 0 || activeCategoryIds.includes(marker.kind));

  return (
    <section ref={viewportRef} className={styles.workspace} aria-label="Community map">
      <div className={styles.mapFrame}>
        <div className={styles.mapControls} data-map-controls>
          <div className={styles.toolbar}>
            <MapSegmentToggle activeTab={activeTab} onChange={handleTabChange} />
            <MapSearchBar key={activeTab} value={localSearch} onChange={handleSearchChange} layer={activeTab}
              records={searchableRecords} onSelect={(id, title) => { handleSearchChange(title); setSelection({ id }); }} />
          </div>
          {activeTab === 'incidents' && <MapFilterPills categories={categories} activeIds={activeCategoryIds} onToggle={handleCategoryToggle} />}
        </div>
        <MapContainer
          ref={mapRef}
          center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
          zoom={DEFAULT_ZOOM}
          className={styles.map}
          zoomControl={true}
          fadeAnimation={!reducedMotion}
          zoomAnimation={!reducedMotion}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            eventHandlers={{ loading: () => setTilesLoading(true), load: () => setTilesLoading(false) }}
          />

          <MapFitter boundary={boundary} markers={allVisibleMarkers} defaultCenter={DEFAULT_CENTER} defaultZoom={DEFAULT_ZOOM} />

          {boundary && (
            <GeoJSON
              data={boundary}
              style={{
                color: 'var(--accent)',
                weight: 3,
                dashArray: '6 5',
                opacity: 0.95,
                fillColor: 'var(--accent)',
                fillOpacity: 0.025,
              }}
            />
          )}

          <LayerGroup>
            {activeTab === 'incidents' && (
              // Previously one unbounded <Marker> per incident — clustered so a barangay
              // with hundreds of reports doesn't render hundreds of overlapping pins at
              // low zoom. Evacuation centers are few and fixed, so they stay uncustered.
              <MarkerClusterGroup ref={clusterRef} animate={!reducedMotion} chunkedLoading maxClusterRadius={60} spiderfyOnMaxZoom>
                {visibleIncidentMarkers.map((marker) => (
                  <Marker
                    key={marker.id}
                    ref={instance => { if (instance) markerRefs.current.set(marker.id, instance); else markerRefs.current.delete(marker.id); }}
                    title={marker.label}
                    alt={marker.label}
                    position={[marker.position.lat, marker.position.lng]}
                    icon={createIcon(marker.categoryColor)}>
                    <Popup autoPanPaddingTopLeft={[compactLayout ? 8 : 16, compactLayout ? 350 : 150]} autoPanPaddingBottomRight={[compactLayout ? 8 : 64, 80]}>
                      <IncidentPopupContent marker={marker} />
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            )}
            {activeTab === 'evacuation' &&
              visibleEvacuationMarkers.map((marker) => (
                <Marker
                  key={marker.id}
                  ref={instance => { if (instance) markerRefs.current.set(marker.id, instance); else markerRefs.current.delete(marker.id); }}
                  title={marker.label}
                  alt={marker.label}
                  position={[marker.position.lat, marker.position.lng]}
                  icon={createIcon(undefined, true)}>
                  <Popup autoPanPaddingTopLeft={[compactLayout ? 8 : 16, compactLayout ? 350 : 150]} autoPanPaddingBottomRight={[compactLayout ? 8 : 64, 80]}>
                    <EvacuationPopupContent marker={marker} />
                  </Popup>
                </Marker>
              ))}
          </LayerGroup>

          <MapViewportControls
            viewport={viewportRef}
            boundary={boundary}
            markers={allVisibleMarkers}
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={DEFAULT_ZOOM}
          />

        </MapContainer>
        <div className={styles.mapActivity} data-active={pending || undefined} role="status" aria-live="polite">
          {pending && <><Spinner size="compact" /> {tilesLoading && !navigationPending ? 'Loading map details…' : 'Updating map…'}</>}
        </div>
        {!hasMarkers && !pending && (
          <div className={styles.empty}>
            <div className={styles.emptyCard} role="status">
              <MapPin size={26} aria-hidden="true" />
              <p>{activeTab === 'incidents' ? 'No incidents match your filters' : 'No evacuation centers available'}</p>
              <span>{activeTab === 'incidents' ? 'Try another search or adjust your categories to explore the map.' : 'Centers with a mapped location will appear here.'}</span>
            </div>
          </div>
        )}
      <footer className={styles.footer}>
        <p role="status"><strong>{allVisibleMarkers.length}</strong> {activeTab === 'incidents' ? 'of ' + incidentMarkers.length + ' mapped incidents' : 'mapped evacuation centers'} in this layer</p>
        {boundary && <span className={styles.legend}><span className={styles.boundaryLine} aria-hidden="true" /> Barangay boundary</span>}
      </footer>
      </div>
    </section>
  );
}
