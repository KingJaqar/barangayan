export type Tab = 'upcoming' | 'today' | 'past' | 'inactive' | 'all';

// Same segmented-workflow architecture as the Incident Reports screen
// (apps/admin-web/src/app/(admin)/incident-reports/types.ts): a pill tab bar over a computed
// bucket, plus an "All" catch-all. Medical drives don't have a `status` column like
// incidents — the workflow here is date-driven (Upcoming/Today/Past) plus the
// `is_active` toggle (Inactive), so the tabs are derived rather than a literal column.
export const TABS: { key: Tab; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'today', label: 'Today' },
  { key: 'past', label: 'Past' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'all', label: 'All' },
];
