'use client';

import type { MultiPolygon, Polygon } from 'geojson';
import dynamic from 'next/dynamic';

// Leaflet touches `window` at import time — must never run during SSR (matches
// map-client-wrapper.tsx / centers-map-client.tsx's pattern elsewhere in this app).
const LocationPickerMap = dynamic(
  () => import('@/components/reports/location-picker-map').then((m) => ({ default: m.LocationPickerMap })),
  {
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse rounded-xl border border-border bg-muted" />,
  },
);

export function LocationPickerMapWrapper(props: {
  position: { lat: number; lng: number } | null;
  boundary: Polygon | MultiPolygon;
  onPositionChange: (point: { lat: number; lng: number }) => void;
}) {
  return <LocationPickerMap {...props} />;
}
