'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayerGroup, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapSearchBar } from './MapSearchBar';
import { MapSegmentToggle } from './MapSegmentToggle';
import { MapFilterPills } from './MapFilterPills';
import { IncidentPopupContent, EvacuationPopupContent } from './MapMarkerPopup';
import { BoundaryFitButton } from './BoundaryFitButton';
import type { IncidentRow } from '../incident-reports/page';
import type { MapIncidentMarker, MapEvacuationMarker, CategoryRow, EvacuationCenterRow } from '@barangayan/shared';

const DEFAULT_CENTER = { lat: 14.680291, lng: 121.1187445 } as const;
const DEFAULT_ZOOM = 16;

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

  const activeTab = urlTab;
  const activeCategoryIds = urlCategoryIds;
  const [localSearch, setLocalSearch] = useState(urlQuery);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Sync search input when URL changes (e.g. browser back/forward).
    // This is a legitimate external-state-to-local-state sync pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalSearch(urlQuery);
  }, [urlQuery]);

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
    if (localSearch.trim()) {
      const q = localSearch.trim().toLowerCase();
      markers = markers.filter((m) => {
        const incident = incidents.find((i) => i.id === m.id);
        if (!incident) return false;
        const category = categories.find((c) => c.id === incident.category_id);
        const reporter = incident.profiles?.full_name ?? '';
        return (
          incident.title.toLowerCase().includes(q) ||
          (incident.description ?? '').toLowerCase().includes(q) ||
          (category?.name ?? '').toLowerCase().includes(q) ||
          reporter.toLowerCase().includes(q)
        );
      });
    }
    return markers;
  }, [incidentMarkers, activeCategoryIds, localSearch, incidents, categories]);

  const visibleEvacuationMarkers = useMemo(() => {
    if (activeTab !== 'evacuation') return [];
    return evacuationMarkers;
  }, [evacuationMarkers, activeTab]);

  const allVisibleMarkers = useMemo(() => {
    return activeTab === 'evacuation' ? visibleEvacuationMarkers : visibleIncidentMarkers;
  }, [activeTab, visibleIncidentMarkers, visibleEvacuationMarkers]);

  const createIcon = (color: string, isEvacuation = false) => {
    const pinColor = isEvacuation ? '#10B981' : color || '#0F6E5B';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24S24 21 24 12C24 5.4 18.6 0 12 0z" fill="${pinColor}"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>`;
    return L.divIcon({
      html: svg,
      className: 'custom-map-marker',
      iconSize: [24, 36],
      iconAnchor: [12, 36],
      popupAnchor: [0, -36],
    });
  };

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set('q', value.trim());
      } else {
        params.delete('q');
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    }, 300);
  };

  const handleTabChange = (tab: 'incidents' | 'evacuation') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleCategoryToggle = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.get('category')?.split(',').filter(Boolean) ?? [];
    const next = current.includes(id) ? current.filter((cid) => cid !== id) : [...current, id];
    if (next.length > 0) {
      params.set('category', next.join(','));
    } else {
      params.delete('category');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const hasMarkers = allVisibleMarkers.length > 0;

  return (
    <div className="relative h-[calc(100vh-160px)] min-h-[500px] w-full overflow-hidden rounded-2xl border border-border/60 bg-white shadow-xl shadow-black/5 dark:border-white/10 dark:bg-zinc-900">
      <MapContainer
        center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        zoomControl={true}
        fadeAnimation={true}
        zoomAnimation={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapFitter boundary={boundary} markers={allVisibleMarkers} defaultCenter={DEFAULT_CENTER} defaultZoom={DEFAULT_ZOOM} />

        {boundary && (
          <GeoJSON
            data={boundary}
            style={{
              color: '#DC2626',
              weight: 3,
              opacity: 0.95,
              fillColor: '#DC2626',
              fillOpacity: 0.04,
            }}
          />
        )}

        <LayerGroup>
          {activeTab === 'incidents' &&
            visibleIncidentMarkers.map((marker) => (
              <Marker
                key={marker.id}
                position={[marker.position.lat, marker.position.lng]}
                icon={createIcon(marker.categoryColor || '#0F6E5B')}>
                <Popup>
                  <IncidentPopupContent marker={marker} />
                </Popup>
              </Marker>
            ))}
          {activeTab === 'evacuation' &&
            visibleEvacuationMarkers.map((marker) => (
              <Marker
                key={marker.id}
                position={[marker.position.lat, marker.position.lng]}
                icon={createIcon('', true)}>
                <Popup>
                  <EvacuationPopupContent marker={marker} />
                </Popup>
              </Marker>
            ))}
        </LayerGroup>

        <MapSearchBar value={localSearch} onChange={handleSearchChange} />
        <MapSegmentToggle activeTab={activeTab} onChange={handleTabChange} />
        <MapFilterPills
          categories={categories}
          activeIds={activeCategoryIds}
          onToggle={handleCategoryToggle}
        />
        <BoundaryFitButton
          boundary={boundary}
          markers={allVisibleMarkers}
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
        />

        {!hasMarkers && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-white/90 px-8 py-6 shadow-lg backdrop-blur-sm dark:bg-zinc-900/90 dark:border-white/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-slate-400"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12h8" />
                  <path d="M12 8v8" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {activeTab === 'incidents'
                  ? 'No incidents match your filters'
                  : 'No evacuation centers available'}
              </p>
            </div>
          </div>
        )}
      </MapContainer>
    </div>
  );
}
