// Coarse admin-vs-staff split for the tabs, distinct from the finer-grained
// OFFICIAL_ROLES (10 values — barangay_captain, kagawad, secretary, …) which stays a
// dropdown filter (see staff-table.tsx) rather than a tab, the same "tabs for the
// primary status dimension, a dropdown for the finer one" split used on every other
// admin screen (e.g. Requests' status tabs + document-type dropdown).
export type Tab = 'all' | 'admin' | 'staff';

export const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'admin', label: 'Admins' },
  { key: 'staff', label: 'Staff' },
];
