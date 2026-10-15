'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { MailCheck, Megaphone, RotateCw, TriangleAlert } from 'lucide-react';
import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory } from '@barangayan/shared';
import { toast } from 'sonner';

import { AnnouncementCard } from '@/components/reports/announcement-card';
import { FadeIn } from '@/components/shared/fade-in';
import { LoadingStatus } from '@/components/shared/loading-status';
import { PendingHint, Skeleton } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { AnnouncementModal } from '@/components/reports/announcement-modal';
import { useAnnouncements, type AnnouncementRow } from '@/hooks/use-announcements';
import { useUnreadCounts } from '@/hooks/use-unread-counts';
import { MOTION } from '@/lib/motion';
import styles from '@/components/reports/announcements.module.css';

type FilterKey = AnnouncementCategory | 'all';

function SkeletonCard() {
  return (
    <div aria-hidden className={`rw-hint ${styles.skeletonCard}`}>
      <div className="flex flex-1 flex-col justify-center gap-3">
        <Skeleton className="h-2 w-1/3 rounded-full" />
        <Skeleton className="h-3 w-4/5 rounded-full" />
        <Skeleton className="h-2 w-3/5 rounded-full" />
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className={styles.emptyState}>
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
      <TriangleAlert aria-hidden size={32} className="text-status-error" />
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
  const resultsRef = useRef<HTMLDivElement>(null);
  const [filterTransition, setFilterTransition] = useState<{ previousHeight: number } | null>(null);
  // Keep selected populated during close animation (same as mobile pattern).
  const [selected, setSelected] = useState<AnnouncementRow | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const { announcements, isInitialLoading, isRefreshing, isReady, error, refetch } = useAnnouncements({
    barangayId,
    category: activeFilter === 'all' ? undefined : activeFilter,
  });
  // Reveal only the first page load. Filtering must not replay the upward entrance,
  // including when returning to All; Realtime/retry updates also stay steady.
  const [entranceIds, setEntranceIds] = useState<ReadonlySet<string> | null>(null);
  if (isReady && entranceIds === null) {
    setEntranceIds(new Set(announcements.map((a) => a.id)));
  }
  const { announcementsUnreadCount, markAnnouncementsRead } = useUnreadCounts();

  function handleFilterChange(filter: FilterKey) {
    if (filter === activeFilter) return;
    // Preserve the current list footprint while the new category is fetched so an
    // intermediate skeleton cannot collapse the scroll range or move the controls.
    setFilterTransition({ previousHeight: resultsRef.current?.getBoundingClientRect().height ?? 0 });
    setActiveFilter(filter);
  }

  async function handleMarkAllRead() {
    if (markingAllRead || announcementsUnreadCount === 0) return;
    setMarkingAllRead(true);
    try {
      await markAnnouncementsRead();
    } catch {
      toast.error("Couldn't mark announcements as read. Please try again.");
    } finally {
      setMarkingAllRead(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className="sr-only">Announcements</h1>

      {/* Category filters and read controls */}
      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Announcement categories">
          <button
            type="button"
            onClick={() => handleFilterChange('all')}
            aria-pressed={activeFilter === 'all'}
            className={styles.filter}>
            All
          </button>
          {ANNOUNCEMENT_CATEGORIES.map((cat) => {
            const { label, color } = ANNOUNCEMENT_CATEGORY_META[cat];
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleFilterChange(cat)}
                aria-pressed={activeFilter === cat}
                className={`${styles.filter} ${styles.categoryTheme}`}
                style={{ '--announcement-category': color } as CSSProperties}>
                <span className={styles.filterDot} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
        <div className={styles.toolbarActions}>
          {/* Quiet refresh hint: decorative, shown only after 120 ms, never announced. */}
          <PendingHint pending={isRefreshing} className="gap-1.5 text-xs text-muted-foreground">
            <RotateCw size={12} className="rw-spinner" /> Updating
          </PendingHint>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={styles.markAll}
            disabled={announcementsUnreadCount === 0}
            loading={markingAllRead}
            loadingLabel="Marking as read…"
            onClick={() => void handleMarkAllRead()}>
            <MailCheck aria-hidden size={16} />
            Mark all as read
          </Button>
        </div>
      </div>

      <span className={styles.resultsLabel}>
        {isReady ? `${announcements.length} ${announcements.length === 1 ? 'announcement' : 'announcements'}` : 'Barangay updates'}
      </span>

      {/* Content. The status sits outside (after) the busy region so its announcement isn't
          deferred and real content never shifts when it disappears. Only a first load for
          the current filter replaces content; a refresh keeps the loaded list (including an
          empty one) and shows the small "Updating" hint in the header. */}
      {isReady && error ? <RefreshWarning onRetry={refetch} /> : null}
      <div
        ref={resultsRef}
        className={styles.results}
        style={isInitialLoading && filterTransition ? { minHeight: filterTransition.previousHeight } : undefined}
        aria-busy={isInitialLoading || undefined}>
        {isInitialLoading ? (
          <div className={styles.grid}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : !isReady ? (
          <ErrorState onRetry={refetch} />
        ) : announcements.length === 0 ? (
          <EmptyState label={activeFilter === 'all' ? 'No announcements yet.' : `No ${ANNOUNCEMENT_CATEGORY_META[activeFilter as AnnouncementCategory]?.label ?? activeFilter} announcements.`} />
        ) : (
          <div className={styles.grid}>
            {announcements.map((a, index) => (
              <FadeIn key={a.id} index={!filterTransition && entranceIds?.has(a.id) ? index : MOTION.staggerLimit} className={styles.cell}>
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
