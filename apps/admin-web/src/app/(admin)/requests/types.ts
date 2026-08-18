export type Tab = 'active' | 'processing' | 'pickup' | 'completed' | 'cancelled' | 'all';

export const TABS: { key: Tab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'processing', label: 'Processing' },
  { key: 'pickup', label: 'Ready for Pickup' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];
