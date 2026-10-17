'use client';

import dynamic from 'next/dynamic';
import type { CategoryRow, EvacuationCenterRow } from '@barangayan/shared';
import type { IncidentRow } from '../incident-reports/page';
import { MapLoading } from './MapLoading';

const MapCanvas = dynamic(() => import('./MapCanvas').then((m) => ({ default: m.MapCanvas })), { ssr: false, loading: MapLoading });

interface IncidentMapClientProps {
  incidents: IncidentRow[];
  categories: CategoryRow[];
  centers: EvacuationCenterRow[];
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
}

export function IncidentMapClient({ incidents, categories, centers, boundary }: IncidentMapClientProps) {
  return (
    <MapCanvas
      incidents={incidents}
      categories={categories}
      centers={centers}
      boundary={boundary}
    />
  );
}
