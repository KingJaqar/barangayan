'use client';

import { DRIVE_TYPES, type DriveType } from '@barangayan/shared';
import type { CSSProperties } from 'react';

import { driveTypeConfig } from '@/hooks/use-medical-drives';

import styles from './health.module.css';

export type DriveTypeFilter = DriveType | 'all';

const ALL_KEYS: DriveTypeFilter[] = ['all', ...DRIVE_TYPES];

/** Wrapping category filters keep every drive type accessible at narrow widths. */
export function CategoryFilterPills({ active, onSelect }: { active: DriveTypeFilter; onSelect: (k: DriveTypeFilter) => void }) {
  return (
    <div className={styles.filters} role="group" aria-label="Filter drives by category">
      {ALL_KEYS.map((key) => {
        const label = key === 'all' ? 'All' : driveTypeConfig(key).label;
        const color = key === 'all' ? 'var(--accent)' : driveTypeConfig(key).color;
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={`${styles.filter} ${styles.categoryFilter}`}
            style={{ '--drive-color': color } as CSSProperties}
            aria-pressed={isActive}>
            {label}
          </button>
        );
      })}
    </div>
  );
}
