'use client';

import type { CategoryRow } from '@barangayan/shared';
import { CheckCircle2 } from 'lucide-react';

/** Incident-category filter pills. Renders nothing when `categories` is empty — the
 * expected state for a guest visitor, since `incident_categories` has no anon RLS
 * policy (see maps/page.tsx's doc comment); the map itself still works without it. */
export function MapFilterPills({
  categories,
  activeIds,
  onToggle,
}: {
  categories: CategoryRow[];
  activeIds: string[];
  onToggle: (id: string) => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="absolute bottom-6 left-4 right-4 z-[1000] flex gap-2 overflow-x-auto pb-1 md:right-auto">
      {categories.map((cat) => {
        const isActive = activeIds.includes(cat.id);
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onToggle(cat.id)}
            aria-pressed={isActive}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition-all ${
              isActive ? 'text-white' : 'border border-border bg-card/95 text-foreground/80 backdrop-blur-sm hover:border-primary/40'
            }`}
            style={isActive ? { backgroundColor: cat.color } : undefined}>
            {isActive ? (
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
            ) : (
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
            )}
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
