'use client';

import type { LatLng } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import dynamic from 'next/dynamic';

import type { EvacuationCenterWithDistance } from '@/hooks/use-evacuation-centers';

// Leaflet touches `window` at import time — must never run during SSR (matches
// admin-web's IncidentMapClient.tsx pattern exactly).
const CentersMap = dynamic(() => import('@/components/emergency/centers-map').then((m) => ({ default: m.CentersMap })), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-2xl border border-border bg-muted" />,
});

export function CentersMapClient(props: {
  centers: EvacuationCenterWithDistance[];
  userPosition: LatLng | null;
  onUserPositionChange: (position: LatLng) => void;
  selectedCenterId: string | null;
  onSelectCenter: (id: string) => void;
  routePoints: LatLng[] | null;
  boundary: Polygon | MultiPolygon | null;
}) {
  return <CentersMap {...props} />;
}
