import { PageSkeleton } from '@/components/shared/page-skeleton';

/** Home dashboard placeholder (stat tiles and two panels). */
export default function Loading() {
  return <PageSkeleton variant="home" label="Loading home…" />;
}
