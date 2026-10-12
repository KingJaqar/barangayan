import { PageSkeleton } from '@/components/shared/page-skeleton';

/** Emergency segment placeholder, below the segment nav so switching segments keeps the nav usable. */
export default function Loading() {
  return <PageSkeleton variant="list" label="Loading emergency information…" />;
}
