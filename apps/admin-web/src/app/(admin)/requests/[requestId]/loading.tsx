import { PageSkeleton } from '@/components/loading/page-skeleton';

export default function RequestDetailLoading() {
  return <PageSkeleton variant="detail" label="Loading request details" className="mx-auto max-w-3xl" />;
}
