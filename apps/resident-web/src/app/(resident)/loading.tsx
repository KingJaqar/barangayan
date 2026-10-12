import { PageSkeleton } from '@/components/shared/page-skeleton';

/** Resident group fallback, rendered inside the persistent shell (header and navigation stay interactive). Routes whose geometry differs from a list have their own loading.tsx below. */
export default function Loading() {
  return <PageSkeleton variant="list" label="Loading page…" />;
}
