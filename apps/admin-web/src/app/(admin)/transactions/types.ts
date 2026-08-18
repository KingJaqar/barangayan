export type Tab = 'all' | 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

export const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'paid', label: 'Paid' },
  { key: 'failed', label: 'Failed' },
  { key: 'expired', label: 'Expired' },
  { key: 'refunded', label: 'Refunded' },
];
