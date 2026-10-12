import { PageSkeleton } from '@/components/shared/page-skeleton';

/** Preparedness guide placeholder (overrides the map shape from maps/loading.tsx). */
export default function Loading() {
  return <PageSkeleton variant="list" label="Loading guides…" />;
}
