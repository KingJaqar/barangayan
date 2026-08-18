export type Tab = 'all' | 'checked_in' | 'not_checked_in';

export const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'checked_in', label: 'Checked In' },
  { key: 'not_checked_in', label: 'Not Checked In' },
];

export const RELATION_OPTIONS = ['spouse', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other'];
