export type Tab = 'open' | 'in_progress' | 'resolved' | 'withdrawn' | 'unresolved' | 'all';

// Same segmented-workflow architecture as the Requests screen (apps/admin-web/src/app/(admin)/requests/types.ts):
// a pill tab bar over a single status column, plus an "All" catch-all. Five stages per the
// Incident Reports spec — Open, In Progress, Resolved, Withdrawn (resident-cancelled),
// Unresolved (admin-cancelled) — mirroring the five values incidents.status now allows (0026).
export const TABS: { key: Tab; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'withdrawn', label: 'Withdrawn' },
  { key: 'unresolved', label: 'Unresolved' },
  { key: 'all', label: 'All' },
];
