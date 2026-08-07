import { StaticPlaceholder } from '@/components/admin/static-placeholder';

// The announcements table already exists (0003 migration) and is read live on mobile
// Home — but the admin write UI (create/edit/publish) is out of scope for this pass.
export default function AnnouncementsPage() {
  return (
    <StaticPlaceholder
      icon="📢"
      title="Announcements"
      description="Creating and publishing barangay announcements from this dashboard is coming in a future update."
    />
  );
}
