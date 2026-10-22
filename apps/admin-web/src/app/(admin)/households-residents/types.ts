export type Tab = 'all' | 'checked_in' | 'not_checked_in';

export const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'checked_in', label: 'Checked In' },
  { key: 'not_checked_in', label: 'No Active Stay' },
];

export const RELATION_OPTIONS = ['spouse', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other'];

export type HouseholdMemberRow = {
  id: string;
  profile_id: string;
  name: string;
  relation: string;
  role: string;
  is_checked_in: boolean;
  checked_in_at: string | null;
  checked_in_center_name: string | null;
  created_at: string;
  updated_at: string;
  profiles: { full_name: string; email: string | null; mobile_number: string | null; home_address: string | null } | null;
};
