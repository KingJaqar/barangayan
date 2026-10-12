'use client';

import { useState } from 'react';
import { Megaphone, RotateCw, TriangleAlert } from 'lucide-react';
import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory } from '@barangayan/shared';

import { AnnouncementCard } from '@/components/reports/announcement-card';
import { FadeIn } from '@/components/shared/fade-in';
import { LoadingStatus } from '@/components/shared/loading-status';
import { PendingHint, Skeleton } from '@/components/ui/loading';
import { AnnouncementModal } from '@/components/reports/announcement-modal';
import { useAnnouncements, type AnnouncementRow } from '@/hooks/use-announcements';
import { useUnreadCounts } from '@/hooks/use-unread-counts';
import { MOTION } from '@/lib/motion';

type FilterKey = AnnouncementCategory | 'all';

function SkeletonCard() {
  return (
    <div aria-hidden className="rw-hint flex h-20 items-stretch overflow-hidden rounded-xl border border-black/8 bg-white dark:border-white/8 dark:bg-zinc-900">
      <Skeleton className="w-1 rounded-none" />
      <div className="flex flex-1 flex-col justify-center gap-2 px-3.5 py-3">
        <Skeleton className="h-2 w-1/3 rounded-full" />
        <Skeleton className="h-3 w-4/5 rounded-full" />
        <Skeleton className="h-2 w-3/5 rounded-full" />
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-muted">
        <Megaphone size={34} className="text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

// Plain copy instead of the raw service message; the hook still exposes the original.
const LOAD_ERROR = "We couldn't load announcements. Check your connection, then try again.";

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <TriangleAlert aria-hidden size={32} className="text-red-500" />
      <p role="alert" className="text-sm text-muted-foreground">
        {LOAD_ERROR}
      </p>
      <button type="button" onClick={onRetry} className="text-sm font-semibold text-[var(--accent)] hover:underline">
        Try again
      </button>
    </div>
  );
}

/** A failed refresh keeps the last loaded list and says it may be out of date. */
function RefreshWarning({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="status" className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-status-warning/40 bg-status-warning/10 px-3.5 py-2.5 text-sm">
      <TriangleAlert aria-hidden size={16} className="shrink-0 text-status-warning" />
      <span className="flex-1">Couldn&apos;t update announcements. Showing the last loaded list, which may be out of date.</span>
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline">
        <RotateCw aria-hidden size={14} /> Try again
      </button>
    </div>
  );
}

export function AnnouncementsFeed({ barangayId }: { barangayId: string | null }) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  // Keep selected populated during close animation (same as mobile pattern).
  const [selected, setSelected] = useState<AnnouncementRow | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { announcements, isInitialLoading, isRefreshing, isReady, error, refetch } = useAnnouncements({
    barangayId,
    category: activeFilter === 'all' ? undefined : activeFilter,
  });
  // Card entrances play only for the cards in a filter's first result. A Realtime/retry
  // refresh keeps mounted cards as they are, and cards that arrive in a refresh render
  // steady. Recorded during render (React's "previous renders" pattern) so the first
  // ready paint already has it.
  const [entrance, setEntrance] = useState<{ filter: FilterKey; ids: ReadonlySet<string> } | null>(null);
  if (isReady && entrance?.filter !== activeFilter) {
    setEntrance({ filter: activeFilter, ids: new Set(announcements.map((a) => a.id)) });
  }
  const entranceIds = entrance?.filter === activeFilter ? entrance.ids : null;
  const { announcementsUnreadCount, markAnnouncementsRead } = useUnreadCounts();

  return (
    <div className="px-4 py-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Announcements</h1>
          <p className="text-sm text-muted-foreground">Barangay news and updates.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Quiet refresh hint: decorative, shown only after 120 ms, never announced. */}
          <PendingHint pending={isRefreshing} className="gap-1.5 text-xs text-muted-foreground">
            <RotateCw size={12} className="rw-spinner" /> Updating
          </PendingHint>
          {announcementsUnreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAnnouncementsRead()}
              className="text-xs font-semibold text-[var(--accent)] hover:underline">
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Category filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeFilter === 'all'
              ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}>
          All
        </button>
        {ANNOUNCEMENT_CATEGORIES.map((cat) => {
          const { label, color } = ANNOUNCEMENT_CATEGORY_META[cat];
          const isActive = activeFilter === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveFilter(cat)}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              style={
                isActive
                  ? { backgroundColor: color, borderColor: color, color: '#fff' }
                  : { borderColor: '#D4D4D8', color }
              }>
              {label}
            </button>
          );
        })}
      </div>

      {/* Content. The status sits outside (after) the busy region so its announcement isn't
          deferred and real content never shifts when it disappears. Only a first load for
          the current filter replaces content; a refresh keeps the loaded list (including an
          empty one) and shows the small "Updating" hint in the header. */}
      {isReady && error ? <RefreshWarning onRetry={refetch} /> : null}
      <div aria-busy={isInitialLoading || undefined}>
        {isInitialLoading ? (
          <div className="flex flex-col gap-2.5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : !isReady ? (
          <ErrorState onRetry={refetch} />
        ) : announcements.length === 0 ? (
          <EmptyState label={activeFilter === 'all' ? 'No announcements yet.' : `No ${ANNOUNCEMENT_CATEGORY_META[activeFilter as AnnouncementCategory]?.label ?? activeFilter} announcements.`} />
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {announcements.map((a, index) => (
              <FadeIn key={a.id} index={entranceIds?.has(a.id) ? index : MOTION.staggerLimit} className="flex">
                <AnnouncementCard
                  announcement={a}
                  onPress={() => {
                    setSelected(a);
                    setModalVisible(true);
                  }}
                />
              </FadeIn>
            ))}
          </div>
        )}
      </div>
      <LoadingStatus active={isInitialLoading} label="Loading announcements…" className="mt-3" />

      <AnnouncementModal
        visible={modalVisible}
        announcement={selected}
        onClose={() => setModalVisible(false)}
      />
    </div>
  );
}
