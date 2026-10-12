'use client';

import type { LatLng, LocationAction, WalkingRoute } from '@barangayan/shared';
import { getWalkingRoute } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import { List, Map as MapIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { CentersMapClient } from '@/components/emergency/centers-map-client';
import { EvacuationCenterCard } from '@/components/emergency/evacuation-center-card';
import { LocationStatusCard } from '@/components/emergency/location-status-card';
import { InlineReadError } from '@/components/shared/inline-read-error';
import { LoadingStatus } from '@/components/shared/loading-status';
import { PendingHint, Skeleton } from '@/components/ui/loading';
import { useDeviceLocation } from '@/hooks/use-device-location';
import { useEvacuationCenters } from '@/hooks/use-evacuation-centers';

type View = 'list' | 'map';

/** Web port of CentersContent (mobile index.tsx) — list/map toggle, nearest-first sort
 * from the confirmed device origin (useDeviceLocation), real OSRM walking route on
 * selection [C-010]. `barangayId` is null for guests — evacuation_centers is publicly
 * readable regardless. `boundary` always has a real value (see emergency/centers/page.tsx
 * — falls back to the bundled Ampid I geometry, same as the main Maps screen). */
export function CentersContent({ barangayId, boundary }: { barangayId: string | null; boundary: Polygon | MultiPolygon | null }) {
  const [view, setView] = useState<View>('list');
  const location = useDeviceLocation();
  const origin = location.state.origin;
  const userPosition = useMemo<LatLng | null>(() => (origin ? { lat: origin.lat, lng: origin.lng } : null), [origin]);
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  // A route belongs to one center + origin revision; results for an older key are ignored.
  const [route, setRoute] = useState<{ key: string; result: WalkingRoute | null } | null>(null);

  const { centers, isInitialLoading, isRefreshing, isReady, error, refetch } = useEvacuationCenters({ barangayId, userPosition });

  const selectedCenter = centers.find((c) => c.id === selectedCenterId) ?? null;
  const routeKey = selectedCenter && origin ? `${selectedCenter.id}:${origin.revision}` : null;
  const centerLat = selectedCenter?.position.lat;
  const centerLng = selectedCenter?.position.lng;

  // Runs when a center is selected or a new origin is accepted, so a position that
  // arrives after the selection still produces a route.
  useEffect(() => {
    if (!routeKey || !origin || centerLat === undefined || centerLng === undefined) return;
    let cancelled = false;
    getWalkingRoute({ lat: origin.lat, lng: origin.lng }, { lat: centerLat, lng: centerLng }).then((result) => {
      if (!cancelled) setRoute({ key: routeKey, result });
    });
    return () => {
      cancelled = true;
    };
  }, [routeKey, origin, centerLat, centerLng]);

  const currentRoute = route && route.key === routeKey ? route : null;
  const routeStatus = !routeKey ? 'idle' : !currentRoute ? 'loading' : currentRoute.result ? 'ready' : 'unavailable';
  const readFailedWithNothing = Boolean(error) && centers.length === 0;

  function selectCenter(id: string) {
    setSelectedCenterId(id);
  }

  function handleShowAll() {
    setSelectedCenterId(null);
  }

  function handleLocationAction(action: LocationAction) {
    switch (action) {
      case 'locate':
      case 'retry':
        location.locate();
        break;
      case 'cancel':
        location.cancel();
        break;
      case 'confirm':
        location.confirm();
        break;
      case 'reject':
        location.reject();
        break;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">Evacuation Centers</h1>
          <PendingHint pending={isRefreshing}>Updating</PendingHint>
        </div>
        <div className="flex gap-1 rounded-full border border-border bg-card p-1">
          <button
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
            <List size={14} /> List
          </button>
          <button
            type="button"
            aria-pressed={view === 'map'}
            onClick={() => setView('map')}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${view === 'map' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
            <MapIcon size={14} /> Map
          </button>
        </div>
      </div>

      <LocationStatusCard state={location.state} onAction={handleLocationAction} />

      {error && !readFailedWithNothing ? (
        <InlineReadError
          tone="warning"
          message="We couldn't refresh evacuation centers. Showing the last loaded list."
          onRetry={refetch}
          retrying={isRefreshing}
        />
      ) : null}

      {isInitialLoading ? (
        <div className="flex flex-col gap-3">
          <LoadingStatus active={isInitialLoading} label="Loading evacuation centers…" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : readFailedWithNothing ? (
        <InlineReadError
          message="We couldn't load evacuation centers. Check your connection, then try again."
          onRetry={refetch}
          retrying={isRefreshing}
        />
      ) : isReady && centers.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No evacuation centers found.</p>
      ) : view === 'map' ? (
        <CentersMapClient
          centers={centers}
          origin={origin}
          pendingFix={location.state.pending?.fix ?? null}
          locating={location.state.activeRequestId !== null}
          onLocate={location.locate}
          selectedCenterId={selectedCenterId}
          onSelectCenter={selectCenter}
          onShowAll={handleShowAll}
          routePoints={currentRoute?.result?.points ?? null}
          routeMeta={currentRoute?.result ?? null}
          routeStatus={routeStatus}
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
