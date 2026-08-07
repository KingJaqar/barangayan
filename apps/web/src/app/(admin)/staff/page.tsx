import { StaticPlaceholder } from '@/components/admin/static-placeholder';

// Admin account management needs a decision on invite flow — out of scope this pass,
// matches the plan's original "Admin account creation UI" deferral.
export default function StaffPage() {
  return (
    <StaticPlaceholder
      icon="🗓"
      title="Staff Member"
      description="Inviting and managing other admin accounts is planned for a future update."
    />
  );
}
