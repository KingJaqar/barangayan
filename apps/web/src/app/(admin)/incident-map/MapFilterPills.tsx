'use client';

import { CheckCircle2 } from 'lucide-react';

interface MapFilterPillsProps {
  categories: { id: string; name: string; color: string; icon: string | null }[];
  activeIds: string[];
  onToggle: (id: string) => void;
  loading?: boolean;
}

export function MapFilterPills({ categories, activeIds, onToggle, loading }: MapFilterPillsProps) {
  if (loading) {
    return (
      <div className="absolute bottom-6 left-4 right-4 z-[1000] flex gap-2 overflow-x-auto pb-1 md:left-4 md:right-auto md:w-auto">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-8 w-24 shrink-0 animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-700/80"
          />
        ))}
      </div>
    );
  }

  if (categories.length === 0) return null;

  return (
    <div className="absolute bottom-6 left-4 right-4 z-[1000] flex gap-2 overflow-x-auto pb-1 md:left-4 md:right-auto md:w-auto">
      {categories.map((cat) => {
        const isActive = activeIds.includes(cat.id);
        return (
          <button
            key={cat.id}
            onClick={() => onToggle(cat.id)}
            className={`group flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
              isActive
                ? 'text-white shadow-md'
                : 'border border-border/60 bg-white/95 text-slate-700 backdrop-blur-sm hover:border-slate-300 hover:shadow-sm dark:bg-zinc-900/95 dark:text-slate-300 dark:hover:border-slate-600'
            }`}
            style={isActive ? { backgroundColor: cat.color } : undefined}
            aria-pressed={isActive}>
            {isActive ? (
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
            ) : (
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
            )}
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
