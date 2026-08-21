'use client';

import { DRIVE_TYPES, type DriveType } from '@barangayan/shared';

import { driveTypeConfig } from '@/hooks/use-medical-drives';

export type DriveTypeFilter = DriveType | 'all';

const ALL_KEYS: DriveTypeFilter[] = ['all', ...DRIVE_TYPES];

/** Horizontally-scrollable drive-type filter chips — web counterpart of mobile's HorizontalCategoryNav. */
export function CategoryFilterPills({ active, onSelect }: { active: DriveTypeFilter; onSelect: (k: DriveTypeFilter) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {ALL_KEYS.map((key) => {
        const label = key === 'all' ? 'All' : driveTypeConfig(key).label;
        const color = key === 'all' ? 'var(--accent)' : driveTypeConfig(key).color;
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            style={
              isActive
                ? { backgroundColor: color, color: '#fff' }
                : { borderWidth: 1, borderStyle: 'solid', borderColor: `${color}55`, color, backgroundColor: `${color}0d` }
            }>
            {label}
          </button>
        );
      })}
    </div>
  );
}
