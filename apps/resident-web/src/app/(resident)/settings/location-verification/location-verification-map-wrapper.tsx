'use client';

import type { LatLng } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import dynamic from 'next/dynamic';

// Leaflet touches `window` at import time — must never run during SSR (matches
// components/reports/location-picker-map-wrapper.tsx's pattern elsewhere in this app).
const LocationVerificationMap = dynamic(
  () => import('./location-verification-map').then((m) => ({ default: m.LocationVerificationMap })),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
  },
);

export function LocationVerificationMapWrapper(props: {
  position: LatLng | null;
  boundary: Polygon | MultiPolygon;
  onPositionChange: (point: LatLng) => void;
  onRejected: () => void;
}) {
  return <LocationVerificationMap {...props} />;
}
