import { PageSkeleton } from '@/components/shared/page-skeleton';

/** Services segment placeholder, below the segment nav and verification notice. */
export default function Loading() {
  return <PageSkeleton variant="list" label="Loading services…" />;
}
