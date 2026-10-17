'use client';

import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import styles from './incident-map.module.css';

interface MapFilterPillsProps {
  categories: { id: string; name: string; color: string; icon: string | null }[];
  activeIds: string[];
  onToggle: (id: string) => void;
  loading?: boolean;
}

export function MapFilterPills({ categories, activeIds, onToggle, loading }: MapFilterPillsProps) {
  if (loading) return <div className={styles.filters} aria-label="Loading categories">{[1, 2, 3].map(i => <div key={i} className={styles.filterSkeleton} />)}</div>;
  if (categories.length === 0) return null;

  return (
    <div className={styles.filterRow}>
      <span className="sr-only">Categories</span>
      <div className={styles.filters} role="group" aria-label="Incident categories">
        {categories.map(cat => (
          <button type="button" key={cat.id} onClick={() => onToggle(cat.id)} className={styles.filter}
            style={{ '--category-color': cat.color } as CSSProperties} aria-pressed={activeIds.includes(cat.id)}>
            <span className={styles.categoryDot} />
            {cat.name}
            {activeIds.includes(cat.id) && <Check size={12} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
}
