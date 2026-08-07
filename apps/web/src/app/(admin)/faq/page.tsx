import { StaticPlaceholder } from '@/components/admin/static-placeholder';

// No faq_articles table exists yet — the mobile Settings > Help Center screen currently
// reads static local content, not a database table.
export default function FaqPage() {
  return (
    <StaticPlaceholder
      icon="❓"
      title="FAQ Content"
      description="Editing the Help Center's FAQ content from this dashboard is planned for a future update."
    />
  );
}
