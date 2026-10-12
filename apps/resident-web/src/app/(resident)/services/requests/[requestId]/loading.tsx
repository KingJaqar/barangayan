import { PageSkeleton } from '@/components/shared/page-skeleton';

/** Route-specific fallback below the services segment nav (RW-LT-06). */
export default function Loading() {
  return <PageSkeleton variant="detail" label="Loading request…" />;
}
