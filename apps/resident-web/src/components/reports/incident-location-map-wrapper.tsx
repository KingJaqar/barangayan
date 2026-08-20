'use client';

import dynamic from 'next/dynamic';

// Leaflet touches `window` at import time — must never run during SSR (matches
// location-picker-map-wrapper.tsx's pattern elsewhere in this app).
const IncidentLocationMap = dynamic(
  () => import('@/components/reports/incident-location-map').then((m) => ({ default: m.IncidentLocationMap })),
  {
    ssr: false,
    loading: () => <div className="h-[270px] w-full animate-pulse rounded-2xl bg-muted" />,
  },
);

export function IncidentLocationMapWrapper(props: { position: { lat: number; lng: number } }) {
  return <IncidentLocationMap {...props} />;
}
