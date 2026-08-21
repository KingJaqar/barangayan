'use client';

import type { LatLng } from '@barangayan/shared';
import { getWalkingRoute } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import { List, Map as MapIcon, MapPinOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { CentersMapClient } from '@/components/emergency/centers-map-client';
import { EvacuationCenterCard } from '@/components/emergency/evacuation-center-card';
import { useEvacuationCenters } from '@/hooks/use-evacuation-centers';

type View = 'list' | 'map';

/** Web port of CentersContent (mobile index.tsx) — list/map toggle, nearest-first sort
 * via the browser Geolocation API, real OSRM walking route on selection [C-010].
 * `barangayId` is null for guests — evacuation_centers is publicly readable regardless.
 * `boundary` always has a real value (see emergency/centers/page.tsx — falls back to
 * the bundled Ampid I geometry, same as the main Maps screen). */
export function CentersContent({ barangayId, boundary }: { barangayId: string | null; boundary: Polygon | MultiPolygon | null }) {
  const [view, setView] = useState<View>('list');
  const [userPosition, setUserPosition] = useState<LatLng | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [routePoints, setRoutePoints] = useState<LatLng[] | null>(null);
  const [routeMeta, setRouteMeta] = useState<{ distanceMeters: number; durationSeconds: number } | null>(null);

  const { centers, isLoading, error } = useEvacuationCenters({ barangayId, userPosition });

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      // Routed through a microtask, not a direct setState — react-hooks/set-state-in-effect
      // flags any setState reachable synchronously from an effect body (see
      // use-unread-counts.tsx's identical pattern/rationale).
      Promise.resolve().then(() => setGeoDenied(true));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoDenied(true),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  async function selectCenter(id: string) {
    setSelectedCenterId(id);
    setRoutePoints(null);
    setRouteMeta(null);
    if (!userPosition) return;
    const center = centers.find((c) => c.id === id);
    if (!center) return;
    const route = await getWalkingRoute(userPosition, center.position);
    if (route) {
      setRoutePoints(route.points);
      setRouteMeta({ distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds });
    }
  }

  function handleShowAll() {
    setSelectedCenterId(null);
    setRoutePoints(null);
    setRouteMeta(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Evacuation Centers</h1>
          {geoDenied ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPinOff size={12} /> Location unavailable — showing centers unsorted.
            </p>
          ) : null}
        </div>
        <div className="flex gap-1 rounded-full border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
            <List size={14} /> List
          </button>
          <button
            type="button"
            onClick={() => setView('map')}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${view === 'map' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
            <MapIcon size={14} /> Map
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Unable to load evacuation centers.</p>
      ) : centers.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No evacuation centers found.</p>
      ) : view === 'map' ? (
        <CentersMapClient
          centers={centers}
          userPosition={userPosition}
          onUserPositionChange={setUserPosition}
          selectedCenterId={selectedCenterId}
          onSelectCenter={selectCenter}
          onShowAll={handleShowAll}
          routePoints={routePoints}
          routeMeta={routeMeta}
          boundary={boundary}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {centers.map((center) => (
            <EvacuationCenterCard
              key={center.id}
              name={center.name}
              address={center.address}
              distanceKm={center.distanceMeters != null ? center.distanceMeters / 1000 : null}
              estimatedMinutes={center.estimatedMinutes ?? null}
              currentOccupancy={center.current_occupancy}
              capacity={center.capacity}
              facilities={center.facilities}
              verified={center.verified}
              selected={center.id === selectedCenterId}
              onClick={() => {
                selectCenter(center.id);
                setView('map');
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
