'use client';

import type { Tables } from '@barangayan/shared';
import { useMemo, useState } from 'react';

import { EmergencyRow } from './emergency-row';

type EmergencyInformation = Tables<'emergency_information'>;
type CategoryFilter = 'all' | 'guidelines' | 'hotlines';

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'guidelines', label: 'Guidelines' },
  { value: 'hotlines', label: 'Hotlines' },
];

/** Sections 3 (filter + search) and 4 (existing items) of the Emergency Hub page,
 * combined into one client component since the list they filter needs to live
 * alongside its controls to share state. */
export function EmergencyCatalog({ items }: { items: EmergencyInformation[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (q && !item.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, category]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
        />
        <div className="flex shrink-0 gap-1 rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-800">
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setCategory(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                category === f.value
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((item) => (
          <EmergencyRow key={item.id} item={item} />
        ))}
        {filtered.length === 0 && items.length > 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">No entries match your search.</p>
        ) : null}
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">No entries yet — create one above.</p>
        ) : null}
      </div>
    </div>
  );
}
