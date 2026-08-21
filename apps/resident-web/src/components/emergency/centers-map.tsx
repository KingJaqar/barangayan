'use client';

import type { LatLng } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import L from 'leaflet';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';

import { BoundaryFitButton } from '@/components/maps/boundary-fit-button';
import { FullscreenSync } from '@/components/maps/fullscreen-sync';
import { HorizontalCenterPicker, type CenterPickerItem } from '@/components/emergency/horizontal-center-picker';
import { LocateButton } from '@/components/maps/locate-button';
import { MapSearchBar } from '@/components/maps/map-search-bar';
import type { EvacuationCenterWithDistance } from '@/hooks/use-evacuation-centers';
import { useFullscreen } from '@/hooks/use-fullscreen';

const DEFAULT_CENTER = { lat: 14.680291, lng: 121.1187445 } as const;
const DEFAULT_ZOOM = 15;
const FOCUS_ZOOM = 17;

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

/** Recenters the map on the selected evacuation center's pin. The `requestAnimationFrame`
 * defer + `closePopup()` matter: selecting a center also swaps that marker's icon
 * (centerIcon -> selectedCenterIcon), which makes react-leaflet tear down and rebuild the
 * marker's DOM icon. Kicking off `flyTo`'s pan/zoom animation in the same tick as that
 * icon swap — especially with a popup still open and being repositioned by the
 * animation — is what was producing "Cannot read properties of undefined (reading
 * '_leaflet_pos')": Leaflet's animation loop ends up repositioning an icon element that
 * was already detached. Deferring one frame lets the icon swap finish first; closing the
 * popup removes the other thing the animation loop would otherwise try to reposition. */
function FocusOnSelect({ selectedCenter }: { selectedCenter: EvacuationCenterWithDistance | null }) {
  const map = useMap();
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    if (!selectedCenter) return;
    const raf = requestAnimationFrame(() => {
      if (!mountedRef.current) return;
      map.closePopup();
      map.flyTo([selectedCenter.position.lat, selectedCenter.position.lng], Math.max(map.getZoom(), FOCUS_ZOOM), { duration: 0.6 });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedCenter?.id, selectedCenter?.position.lat, selectedCenter?.position.lng]);

  return null;
}

/** Reset button — distinct from the fullscreen toggle (`BoundaryFitButton`, despite its
 * name, is fullscreen-only now). Behavior depends on the current selection: with a center
 * selected ("Show All Centers" not active), it zooms/recenters back onto that center's
 * pin; with nothing selected, it zooms out to fit the whole Ampid I boundary (or all
 * visible centers, or the barangay default, if there's no boundary to fit to). */
function ResetViewButton({
  boundary,
  points,
  selectedCenter,
}: {
  boundary: Polygon | MultiPolygon | null;
  points: LatLng[];
  selectedCenter: EvacuationCenterWithDistance | null;
}) {
  const map = useMap();
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  function handleReset() {
    requestAnimationFrame(() => {
      if (!mountedRef.current) return;
      map.closePopup();
      if (selectedCenter) {
        map.flyTo([selectedCenter.position.lat, selectedCenter.position.lng], FOCUS_ZOOM, { duration: 0.6 });
      } else if (boundary) {
        map.flyToBounds(L.geoJSON(boundary).getBounds().pad(0.1));
      } else if (points.length > 0) {
        map.flyToBounds(
          points.map((p) => [p.lat, p.lng] as [number, number]),
          { padding: [50, 50] },
        );
      } else {
        map.flyTo([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_ZOOM);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleReset}
      title="Reset map view"
      aria-label="Reset map view"
      className="absolute bottom-32 right-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/95 shadow-lg shadow-black/5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40">
      <RotateCcw className="h-4 w-4 text-foreground/80" strokeWidth={2} />
    </button>
  );
}

/**
 * Evacuation centers map — carries the same control set as the main Maps screen's map
 * view (search, native zoom +/-, Reset/boundary-fit, "You"/locate, full screen), plus the
 * Evacuation Centers picker panel docked to the bottom of the same fullscreen-able
 * container, so it stays visible (and full-size) whether or not the map is fullscreened.
 */
export function CentersMap({
  centers,
  userPosition,
  onUserPositionChange,
  selectedCenterId,
  onSelectCenter,
  onShowAll,
  routePoints,
  routeMeta,
  boundary,
}: {
  centers: EvacuationCenterWithDistance[];
  userPosition: LatLng | null;
  onUserPositionChange: (position: LatLng) => void;
  selectedCenterId: string | null;
  onSelectCenter: (id: string) => void;
  onShowAll: () => void;
  routePoints: LatLng[] | null;
  routeMeta: { distanceMeters: number; durationSeconds: number } | null;
  boundary: Polygon | MultiPolygon | null;
}) {
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);

  const visibleCenters = useMemo(() => {
    if (!search.trim()) return centers;
    const q = search.trim().toLowerCase();
    return centers.filter((c) => c.name.toLowerCase().includes(q) || (c.address ?? '').toLowerCase().includes(q));
  }, [centers, search]);

  const fitPoints = userPosition ? [userPosition, ...visibleCenters.map((c) => c.position)] : visibleCenters.map((c) => c.position);
  const pickerItems: CenterPickerItem[] = useMemo(() => visibleCenters.map((c) => ({ id: c.id, name: c.name })), [visibleCenters]);
  const selectedCenter = centers.find((c) => c.id === selectedCenterId) ?? null;

  return (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? 'flex h-screen w-screen flex-col overflow-hidden bg-card'
          : 'flex h-[640px] w-full flex-col overflow-hidden rounded-2xl border border-border shadow-xl shadow-black/5'
      }>
      <div className="relative min-h-0 flex-1">
        <MapContainer center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]} zoom={DEFAULT_ZOOM} className="h-full w-full" zoomControl={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          <MapFitter points={fitPoints} />
          <FocusOnSelect selectedCenter={selectedCenter} />
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
          <ResetViewButton boundary={boundary} points={fitPoints} selectedCenter={selectedCenter} />
          <BoundaryFitButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
        </MapContainer>
      </div>

      <div className="shrink-0 border-t border-border bg-card">
        <button
          type="button"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold">
          Evacuation Centers
          <ChevronDown size={18} className={`shrink-0 text-muted-foreground transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
        </button>

        {pickerOpen ? (
          <div className="flex flex-col gap-2 border-t border-border px-3 pb-3 pt-3">
            {selectedCenter ? (
              <div className="rounded-2xl border border-border bg-background p-3 text-sm">
                <p className="font-semibold">{selectedCenter.name}</p>
                <p className="truncate text-xs text-muted-foreground">{selectedCenter.address ?? 'No address'}</p>
                {routeMeta ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(routeMeta.distanceMeters / 1000).toFixed(1)} km · ~{Math.round(routeMeta.durationSeconds / 60)} min walking (road route)
                  </p>
                ) : userPosition ? (
                  <p className="mt-1 text-xs text-muted-foreground">Fetching walking route…</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Enable location to see a walking route.</p>
                )}
              </div>
            ) : null}

            <HorizontalCenterPicker items={pickerItems} selectedId={selectedCenterId} onSelect={onSelectCenter} onShowAll={onShowAll} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
