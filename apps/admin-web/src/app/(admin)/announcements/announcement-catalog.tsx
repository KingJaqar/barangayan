'use client';

import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CATEGORY_META, type Tables } from '@barangayan/shared';
import { useMemo, useState } from 'react';

import { AnnouncementRow } from './announcement-row';

type Announcement = Tables<'announcements'>;
type CategoryFilter = 'all' | (typeof ANNOUNCEMENT_CATEGORIES)[number];

/** Sections 3 (filter + search) and 4 (existing items) of the Announcements page,
 * combined into one client component since the list they filter needs to live
 * alongside its controls to share state. */
export function AnnouncementCatalog({ announcements }: { announcements: Announcement[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return announcements.filter((a) => {
      if (category !== 'all' && a.category !== category) return false;
      if (q && !a.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [announcements, query, category]);

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
        <div className="flex shrink-0 flex-wrap gap-1 rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              category === 'all'
                ? 'bg-[var(--accent)] text-white'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}>
            All
          </button>
          {ANNOUNCEMENT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                category === cat
                  ? 'text-white'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
              style={category === cat ? { backgroundColor: ANNOUNCEMENT_CATEGORY_META[cat].color } : undefined}>
              {ANNOUNCEMENT_CATEGORY_META[cat].label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((a) => (
          <AnnouncementRow key={a.id} announcement={a} />
        ))}
        {filtered.length === 0 && announcements.length > 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">No announcements match your search.</p>
        ) : null}
        {announcements.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">No announcements yet — create one above.</p>
        ) : null}
      </div>
    </div>
  );
}
