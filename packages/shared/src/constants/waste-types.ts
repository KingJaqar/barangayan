export const WASTE_TYPES = [
  'biodegradable',
  'recyclable',
  'residual',
  'special',
  'bulk',
] as const;

export type WasteType = (typeof WASTE_TYPES)[number];

export const WASTE_TYPE_CONFIG: Record<WasteType, { label: string; color: string }> = {
  biodegradable: { label: 'Biodegradable', color: '#22C55E' },
  recyclable: { label: 'Recyclable', color: '#3B82F6' },
  residual: { label: 'Residual', color: '#6B7280' },
  special: { label: 'Special Waste', color: '#EF4444' },
  bulk: { label: 'Bulk Waste', color: '#F97316' },
};

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
