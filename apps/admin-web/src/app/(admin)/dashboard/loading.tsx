import { PageSkeleton } from '@/components/loading/page-skeleton';

export default function DashboardLoading() {
  return <PageSkeleton variant="dashboard" label="Loading dashboard" className="mx-auto max-w-6xl" />;
}
