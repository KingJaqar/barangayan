import { StaticPlaceholder } from '@/components/admin/static-placeholder';

// Barangay-wide config UI (against barangays.config jsonb) — no schema decided yet.
// Distinct from the Theme page, which is the admin's own personal appearance setting.
export default function SettingsPage() {
  return (
    <StaticPlaceholder
      icon="⚙"
      title="Settings"
      description="Barangay-wide configuration options are planned for a future update."
    />
  );
}
