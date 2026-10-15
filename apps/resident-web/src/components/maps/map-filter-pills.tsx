'use client';

import type { CategoryRow } from '@barangayan/shared';
import { Check } from 'lucide-react';
import styles from './maps.module.css';

/** Incident-category filter pills. Renders nothing when `categories` is empty — the
 * expected state for a guest visitor, since `incident_categories` has no anon RLS
 * policy (see maps/page.tsx's doc comment); the map itself still works without it. */
export function MapFilterPills({
  categories,
  activeIds,
  onToggle,
  onClear,
}: {
  categories: CategoryRow[];
  activeIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div className={styles.filters} role="group" aria-label="Filter incidents by category">
      <span className={styles.filterLabel}>Categories</span>
      <button type="button" className={styles.filter} aria-pressed={activeIds.length === 0} onClick={onClear}>
        All categories
        {activeIds.length === 0 ? <Check size={14} aria-hidden /> : null}
      </button>
      {categories.map((cat) => {
        const isActive = activeIds.includes(cat.id);
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onToggle(cat.id)}
            aria-pressed={isActive}
            className={styles.filter}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden />
            {cat.name}
            {isActive ? (
              <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
