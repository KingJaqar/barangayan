import type { Tables } from '@barangayan/shared';

export type Tab = 'open' | 'in_progress' | 'resolved' | 'withdrawn' | 'unresolved' | 'all';

// Same segmented-workflow architecture as the Requests screen (apps/admin-web/src/app/(admin)/requests/types.ts):
// a pill tab bar over a single status column, plus an "All" catch-all. Five stages per the
// Incident Reports spec — Open, In Progress, Resolved, Withdrawn (resident-cancelled),
// Unresolved (admin-cancelled) — mirroring the five values incidents.status now allows (0026).
export const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'withdrawn', label: 'Withdrawn' },
  { key: 'unresolved', label: 'Unresolved' },
];

export type IncidentRow = Tables<'incidents'> & {
  incident_categories: Pick<Tables<'incident_categories'>, 'name' | 'color' | 'icon'> | null;
  profiles: Pick<Tables<'profiles'>, 'full_name' | 'email' | 'mobile_number' | 'home_address'> | null;
};
