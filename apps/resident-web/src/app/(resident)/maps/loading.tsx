import { PageSkeleton } from '@/components/shared/page-skeleton';

/** Map placeholder with a steady (non-pulsing) viewport; directory and preparedness override it with list shapes. */
export default function Loading() {
  return <PageSkeleton variant="map" label="Loading map…" />;
}
