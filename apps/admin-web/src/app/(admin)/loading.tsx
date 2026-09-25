import { PageSkeleton } from '@/components/loading/page-skeleton';

export default function AdminLoading() {
  return <PageSkeleton variant="table" label="Loading admin page" className="mx-auto max-w-6xl" />;
}
