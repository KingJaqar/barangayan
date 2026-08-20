'use client';

/**
 * Web port of resident-android-mobile's settings/help/index.tsx: same category-filter
 * segmented control, same FaqCard shape, same skeleton/empty/error states. Simplified to
 * the web idiom — no centered "retry" toast modal, just an inline retry button and
 * whatever useFaqArticles' own loading/error state renders.
 */

import { FAQ_CATEGORY_META, type FaqCategory } from '@barangayan/shared';
import { AlertCircle, ChevronRight, HelpCircle, RotateCw } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useFaqArticles, type FaqArticle } from '@/hooks/use-faq-articles';
import { ArticleDrawer } from './article-drawer';

type CategoryFilter = 'all' | FaqCategory;

const CATEGORY_TABS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'general', label: 'General' },
  { key: 'services', label: 'Services' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'health', label: 'Health' },
  { key: 'billing', label: 'Billing' },
  { key: 'account', label: 'Account' },
];

function FaqCard({ article, active, onSelect }: { article: FaqArticle; active: boolean; onSelect: (article: FaqArticle) => void }) {
  const category = article.category as FaqCategory;
  const meta = FAQ_CATEGORY_META[category];

  return (
    <button
      type="button"
      onClick={() => onSelect(article)}
      aria-current={active ? 'true' : undefined}
      className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        active
          ? 'border-[var(--accent)]/40 bg-[var(--accent-tint)]'
          : 'border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900'
      }`}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${meta?.color}1A` }}>
        <HelpCircle size={16} style={{ color: meta?.color }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: meta?.color }}>
          {meta?.label}
        </p>
        <p className="truncate text-sm font-semibold">{article.question}</p>
        <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">{article.answer}</p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-zinc-300 dark:text-zinc-600" />
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-3.5 dark:border-white/10 dark:bg-zinc-900">
      <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
      <div className="flex-1 space-y-2">
        <span className="block h-2.5 w-1/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <span className="block h-3.5 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

export function HelpCenterClient({ barangayId }: { barangayId: string }) {
  const { articles, isLoading, error, refetch } = useFaqArticles(barangayId);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (category === 'all' ? articles : articles.filter((a) => a.category === category)),
    [articles, category],
  );

  // Keep following the same article object across category/list refreshes (e.g. a
  // realtime edit) by id, rather than freezing the stale object the drawer opened with.
  const selectedArticle = selectedId ? (articles.find((a) => a.id === selectedId) ?? null) : null;
  const drawerOpen = selectedId !== null;

  return (
    <div>
      {/* Category filter */}
      <div className="mb-4 flex flex-wrap gap-1.5 border-b border-black/[0.06] pb-4 dark:border-white/[0.06]">
        {CATEGORY_TABS.map(({ key, label }) => {
          const active = category === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
              }`}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Articles — collapses to a single column once the drawer is open so the list
          stays comfortably readable next to it instead of competing for width. */}
      <div className={`grid grid-cols-1 gap-2.5 ${drawerOpen ? '' : 'md:grid-cols-2'}`}>
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center md:col-span-2">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
              <AlertCircle size={26} className="text-red-500" />
            </span>
            <p className="text-sm font-semibold">Unable to load help articles</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Check your connection and try again.</p>
            <button
              type="button"
              onClick={refetch}
              className="mt-1 flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90">
              <RotateCw size={13} /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center md:col-span-2">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <HelpCircle size={26} className="text-zinc-400" />
            </span>
            <p className="text-sm font-semibold">Nothing here yet</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {category === 'all' ? 'No articles available yet.' : 'No articles in this category.'}
            </p>
          </div>
        ) : (
          filtered.map((article) => (
            <FaqCard key={article.id} article={article} active={article.id === selectedId} onSelect={(a) => setSelectedId(a.id)} />
          ))
        )}
      </div>

      <ArticleDrawer article={selectedArticle} open={drawerOpen} onClose={() => setSelectedId(null)} />
    </div>
  );
}
