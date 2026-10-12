'use client';

import type { ConfirmedOrigin, LatLng, LocationFix } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import dynamic from 'next/dynamic';

import { LoadingStatus } from '@/components/shared/loading-status';
import { Skeleton } from '@/components/ui/loading';
import type { EvacuationCenterWithDistance } from '@/hooks/use-evacuation-centers';

// Leaflet touches `window` at import time — must never run during SSR (matches
// admin-web's IncidentMapClient.tsx pattern exactly).
const CentersMap = dynamic(() => import('@/components/emergency/centers-map').then((m) => ({ default: m.CentersMap })), {
  ssr: false,
  loading: () => (
    <>
      <Skeleton pulse={false} className="h-[640px] w-full rounded-2xl border border-border" />
      <LoadingStatus active label="Loading the map…" className="sr-only" />
    </>
  ),
});

export function CentersMapClient(props: {
  centers: EvacuationCenterWithDistance[];
  origin: ConfirmedOrigin | null;
  pendingFix: LocationFix | null;
  locating: boolean;
  onLocate: () => void;
  selectedCenterId: string | null;
  onSelectCenter: (id: string) => void;
  onShowAll: () => void;
  routePoints: LatLng[] | null;
  routeMeta: { distanceMeters: number; durationSeconds: number } | null;
  routeStatus: 'idle' | 'loading' | 'ready' | 'unavailable';
  boundary: Polygon | MultiPolygon | null;
}) {
  return <CentersMap {...props} />;
}
