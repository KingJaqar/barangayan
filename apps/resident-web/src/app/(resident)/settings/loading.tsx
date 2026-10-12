import { PageSkeleton } from '@/components/shared/page-skeleton';

/** Settings content placeholder, below the settings sidebar so it stays usable. */
export default function Loading() {
  return <PageSkeleton variant="settings" label="Loading settings…" />;
}
