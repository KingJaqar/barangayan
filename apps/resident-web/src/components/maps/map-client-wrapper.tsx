'use client';

import type { CategoryRow, MapEvacuationMarker, MapIncidentMarker } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import dynamic from 'next/dynamic';

// Leaflet touches `window` at import time — must never run during SSR (matches
// admin-web's IncidentMapClient.tsx / this app's own centers-map-client.tsx pattern).
const MapCanvas = dynamic(() => import('@/components/maps/map-canvas').then((m) => ({ default: m.MapCanvas })), {
  ssr: false,
  loading: () => <div className="h-[calc(100vh-220px)] min-h-[480px] w-full animate-pulse rounded-2xl border border-border bg-muted" />,
});

export function MapClientWrapper(props: {
  incidentMarkers: MapIncidentMarker[];
  evacuationMarkers: MapEvacuationMarker[];
  categories: CategoryRow[];
  boundary: Polygon | MultiPolygon | null;
}) {
  return <MapCanvas {...props} />;
}
