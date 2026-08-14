'use client';

import { FAQ_CATEGORIES, FAQ_CATEGORY_META, type Tables } from '@barangayan/shared';
import { useMemo, useState } from 'react';

import { FaqRow } from './faq-row';

type FaqArticle = Tables<'faq_articles'>;
type Segment = 'all' | 'published' | 'archives';

export function FaqList({ articles }: { articles: FaqArticle[] }) {
  const [segment, setSegment] = useState<Segment>('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const publishedCount = useMemo(
    () => articles.filter((a) => a.deleted_at === null && a.is_active).length,
    [articles],
  );
  const archivesCount = useMemo(
    () => articles.filter((a) => a.deleted_at !== null).length,
    [articles],
  );

  const segments: { key: Segment; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: articles.length },
    { key: 'published', label: 'Published', count: publishedCount },
    { key: 'archives', label: 'Archives', count: archivesCount },
  ];

  const filtered = useMemo(() => {
    let list = articles;

    if (segment === 'published') {
      list = list.filter((a) => a.deleted_at === null && a.is_active);
    } else if (segment === 'archives') {
      list = list.filter((a) => a.deleted_at !== null);
    }

    if (categoryFilter) {
      list = list.filter((a) => a.category === categoryFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.question.toLowerCase().includes(q) ||
          a.answer.toLowerCase().includes(q),
      );
    }

    return list;
  }, [articles, segment, search, categoryFilter]);

  return (
    <div>
      {/* ── 3-segment pill control ───────────────────────────────── */}
      <div className="mb-4 flex items-center gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
        {segments.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSegment(s.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              segment === s.key
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}>
            {s.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs leading-none ${
                segment === s.key
                  ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-600 dark:text-zinc-200'
                  : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
              }`}>
              {s.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Search ───────────────────────────────────────────────── */}
      <div className="relative mb-3">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.636 5.636a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search articles…"
          className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
        />
      </div>

      {/* ── Category filter pills ─────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryFilter(null)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            categoryFilter === null
              ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'
          }`}>
          All Categories
        </button>
        {FAQ_CATEGORIES.map((cat) => {
          const meta = FAQ_CATEGORY_META[cat];
          const isActive = categoryFilter === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(isActive ? null : cat)}
              className="rounded-full px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-100"
              style={
                isActive
                  ? { backgroundColor: meta.color, color: '#fff' }
                  : { backgroundColor: `${meta.color}22`, color: meta.color, opacity: 0.8 }
              }>
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* ── Article list ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {filtered.map((a) => (
          <FaqRow key={a.id} article={a} />
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-500">
            {search || categoryFilter
              ? 'No articles match your filters.'
              : segment === 'archives'
                ? 'No archived articles.'
                : 'No articles yet — create one above.'}
          </p>
        )}
      </div>
    </div>
  );
}
