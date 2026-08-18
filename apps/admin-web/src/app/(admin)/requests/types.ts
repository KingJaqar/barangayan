export type Tab = 'active' | 'processing' | 'delivery' | 'completed' | 'cancelled' | 'all';

export const TABS: { key: Tab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'processing', label: 'Processing' },
  { key: 'delivery', label: 'Out for Delivery' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];
