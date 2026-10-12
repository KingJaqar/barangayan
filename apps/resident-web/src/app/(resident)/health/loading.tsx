import { PageSkeleton } from '@/components/shared/page-skeleton';

/** Health segment placeholder, below the segment nav. */
export default function Loading() {
  return <PageSkeleton variant="list" label="Loading health services…" />;
}
