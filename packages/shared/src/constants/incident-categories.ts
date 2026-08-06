/**
 * Seed/demo defaults for `supabase/seed.sql` only — a starting point for a newly
 * onboarded barangay's admin config UI, not a hardcoded runtime list. Each barangay's
 * actual categories always come from its own `incident_categories` rows.
 */
export const SEED_INCIDENT_CATEGORIES = [
  { name: 'Damaged light post', isTrashRelated: false },
  { name: 'Uneven/damaged road', isTrashRelated: false },
  { name: 'Blocked drainage', isTrashRelated: true },
  { name: 'Illegal dumping', isTrashRelated: true },
  { name: 'Flooding', isTrashRelated: false },
] as const;
