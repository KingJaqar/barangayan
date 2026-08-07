import { StaticPlaceholder } from '@/components/admin/static-placeholder';

// No vaccination_drives/drive_registrations tables yet — explicitly deferred per the
// 0001 migration's own comment.
export default function HealthPage() {
  return (
    <StaticPlaceholder
      icon="♡"
      title="Health"
      description="Managing vaccination and medical drives from this dashboard is planned for a future module."
    />
  );
}
