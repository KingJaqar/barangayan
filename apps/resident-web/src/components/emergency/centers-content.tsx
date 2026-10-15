'use client';

import type { LatLng, LocationAction } from '@barangayan/shared';
import type { AttachmentCandidate } from '@barangayan/shared/src/lib/evacuation-routing';
import type { MultiPolygon, Polygon } from 'geojson';
import { List, Map as MapIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { CentersMapClient } from '@/components/emergency/centers-map-client';
import { EvacuationCenterCard } from '@/components/emergency/evacuation-center-card';
import { EmergencyPageHeader } from '@/components/emergency/emergency-page-header';
import { LocationStatusCard } from '@/components/emergency/location-status-card';
import { RouteStatusCard } from '@/components/emergency/route-status-card';
import { InlineReadError } from '@/components/shared/inline-read-error';
import { LoadingStatus } from '@/components/shared/loading-status';
import { PendingHint, Skeleton } from '@/components/ui/loading';
import { useConnectedRoute, type SegmentChoice } from '@/hooks/use-connected-route';
import { useDeviceLocation } from '@/hooks/use-device-location';
import { useEvacuationCenters } from '@/hooks/use-evacuation-centers';
import styles from './emergency.module.css';
import stickyStyles from '@/components/shared/sticky-tabs.module.css';

type View = 'list' | 'map';

/** Web port of CentersContent (mobile index.tsx) — list/map toggle, centers ranked by walking
 * distance from the confirmed device origin (useDeviceLocation), and the server-calculated
 * walking route on selection (useConnectedRoute, DRRM routing plan R7). `barangayId` is null
 * for guests — evacuation_centers is publicly readable regardless. `boundary` always has a
 * real value (see emergency/centers/page.tsx — falls back to the bundled Ampid I geometry,
 * same as the main Maps screen). */
export function CentersContent({ barangayId, boundary }: { barangayId: string | null; boundary: Polygon | MultiPolygon | null }) {
  const [view, setView] = useState<View>('list');
  const location = useDeviceLocation();
  const origin = location.state.origin;
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  // A street picked from the attachment chooser belongs to one origin revision.
  const [choice, setChoice] = useState<(SegmentChoice & { revision: number }) | null>(null);
  const segment = choice !== null && origin !== null && choice.revision === origin.revision ? choice : null;
  const connected = useConnectedRoute({ origin, centerId: selectedCenterId, segment });

  const { centers: fetchedCenters, isInitialLoading, isRefreshing, isReady, error, refetch } = useEvacuationCenters({ barangayId });

  // Walking distance and order come from the route service; without them no distance is shown
  // rather than a straight-line estimate.
  const centers = useMemo(() => {
    const ranking = connected.ranking;
    if (ranking === null) return fetchedCenters;
    const order = new Map(ranking.map((summary, index) => [summary.centerId, index]));
    return fetchedCenters
      .map((center) => {
        const summary = ranking.find((s) => s.centerId === center.id);
        if (!summary || summary.distanceMeters === null || summary.durationSeconds === null) {
          return { ...center, distanceMeters: undefined, estimatedMinutes: undefined };
        }
        return {
          ...center,
          distanceMeters: summary.distanceMeters,
          estimatedMinutes: Math.max(1, Math.round(summary.durationSeconds / 60)),
        };
      })
      .sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
  }, [fetchedCenters, connected.ranking]);

  // Ages in the status card are refreshed once a minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Only the route to the selected center is drawn; a result for another center is never shown.
  const selectedRoute =
    selectedCenterId !== null && connected.result !== null && connected.result.status === 'ok' && connected.result.best.centerId === selectedCenterId
      ? connected.result.best
      : null;
  const routePoints = useMemo<LatLng[] | null>(
    () => (selectedRoute ? selectedRoute.geometry.map(([lng, lat]) => ({ lat, lng })) : null),
    [selectedRoute],
  );
  const routeStatus: 'idle' | 'loading' | 'ready' | 'unavailable' =
    selectedCenterId === null || origin === null
      ? 'idle'
      : selectedRoute !== null
        ? 'ready'
        : connected.status === 'loading'
          ? 'loading'
          : 'unavailable';
  const readFailedWithNothing = Boolean(error) && centers.length === 0;

  function handleChooseSegment(candidate: AttachmentCandidate, graphVersion: string) {
    if (origin === null) return;
    setChoice({ revision: origin.revision, graphVersion, edgeId: candidate.edgeId });
  }

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
    <div className={styles.content}>
      <EmergencyPageHeader title="Evacuation Centers" />
      <div className={`${styles.toolbar} ${stickyStyles.secondary}`}>
        <div className={styles.toolbarTitle}>
          <h2>Center directory</h2>
          {isReady ? <span className={styles.count}>{centers.length} centers</span> : null}
          <PendingHint pending={isRefreshing}>Updating</PendingHint>
        </div>
        <div className={styles.viewToggle} role="group" aria-label="Center view">
          <button
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={styles.viewButton}>
            <List size={14} /> List
          </button>
          <button
            type="button"
            aria-pressed={view === 'map'}
            onClick={() => setView('map')}
            className={styles.viewButton}>
            <MapIcon size={14} /> Map
          </button>
        </div>
      </div>

      <LocationStatusCard state={location.state} onAction={handleLocationAction} />
      <RouteStatusCard state={connected} now={now} onChooseSegment={handleChooseSegment} onRetry={connected.retry} />

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
        <p className={styles.empty}>No evacuation centers found.</p>
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
          routePoints={routePoints}
          routeMeta={selectedRoute}
          routeStatus={routeStatus}
          boundary={boundary}
        />
      ) : (
        <div className={styles.centerGrid}>
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
