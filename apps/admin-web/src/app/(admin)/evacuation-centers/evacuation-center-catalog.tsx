'use client';

import type { Tables } from '@barangayan/shared';
import { useMemo, useState } from 'react';

import { EvacuationCenterRow } from './evacuation-center-row';

type EvacuationCenter = Tables<'evacuation_centers'>;
type StatusFilter = 'all' | 'active' | 'inactive';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

/** Sections 3 (filter + search) and 4 (existing items) of the Evacuation Centers page,
 * combined into one client component since the list they filter needs to live
 * alongside its controls to share state. */
export function EvacuationCenterCatalog({ centers }: { centers: EvacuationCenter[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return centers.filter((c) => {
      if (status === 'active' && !c.is_active) return false;
      if (status === 'inactive' && c.is_active) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [centers, query, status]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
        />
        <div className="flex shrink-0 gap-1 rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-800">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                status === f.value
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((center) => (
          <EvacuationCenterRow key={center.id} center={center} />
        ))}
        {filtered.length === 0 && centers.length > 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">No centers match your search.</p>
        ) : null}
        {centers.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">No evacuation centers yet — create one above.</p>
        ) : null}
      </div>
    </div>
  );
}
