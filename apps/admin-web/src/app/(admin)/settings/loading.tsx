import { PageSkeleton } from '@/components/loading/page-skeleton';

export default function SettingsLoading() {
  return <PageSkeleton variant="settings" label="Loading settings" className="mx-auto max-w-4xl" />;
}
