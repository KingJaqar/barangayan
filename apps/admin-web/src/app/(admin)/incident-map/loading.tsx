import { PageSkeleton } from '@/components/loading/page-skeleton';

export default function IncidentMapLoading() {
  return <PageSkeleton variant="map" label="Loading incident map" className="mx-auto max-w-7xl" />;
}
