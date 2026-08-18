export type Tab = 'all' | 'verified' | 'unverified';

export const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'verified', label: 'Verified' },
  { key: 'unverified', label: 'Unverified' },
];
