'use client';

import { useState } from 'react';
import { Megaphone, TriangleAlert } from 'lucide-react';
import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory } from '@barangayan/shared';

import { AnnouncementCard } from '@/components/reports/announcement-card';
import { AnnouncementModal } from '@/components/reports/announcement-modal';
import { useAnnouncements, type AnnouncementRow } from '@/hooks/use-announcements';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

type FilterKey = AnnouncementCategory | 'all';

function SkeletonCard() {
  return (
    <div className="flex h-20 animate-pulse items-stretch overflow-hidden rounded-xl border border-black/8 bg-white dark:border-white/8 dark:bg-zinc-900">
      <div className="w-1 bg-muted" />
      <div className="flex flex-1 flex-col justify-center gap-2 px-3.5 py-3">
        <div className="h-2 w-1/3 rounded-full bg-muted" />
        <div className="h-3 w-4/5 rounded-full bg-muted" />
        <div className="h-2 w-3/5 rounded-full bg-muted" />
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

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <TriangleAlert size={32} className="text-red-500" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <button onClick={onRetry} className="text-sm font-semibold text-[var(--accent)] hover:underline">
        Try again
      </button>
    </div>
  );
}

export function AnnouncementsFeed({ barangayId }: { barangayId: string | null }) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  // Keep selected populated during close animation (same as mobile pattern).
  const [selected, setSelected] = useState<AnnouncementRow | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { announcements, isLoading, error, refetch } = useAnnouncements({
    barangayId,
    category: activeFilter === 'all' ? undefined : activeFilter,
  });
  const { announcementsUnreadCount, markAnnouncementsRead } = useUnreadCounts();

  return (
    <div className="px-4 py-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Announcements</h1>
          <p className="text-sm text-muted-foreground">Barangay news and updates.</p>
        </div>
        {announcementsUnreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAnnouncementsRead()}
            className="text-xs font-semibold text-[var(--accent)] hover:underline">
            Mark all read
          </button>
        )}
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

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-2.5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : announcements.length === 0 ? (
        <EmptyState label={activeFilter === 'all' ? 'No announcements yet.' : `No ${ANNOUNCEMENT_CATEGORY_META[activeFilter as AnnouncementCategory]?.label ?? activeFilter} announcements.`} />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {announcements.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              onPress={() => {
                setSelected(a);
                setModalVisible(true);
              }}
            />
          ))}
        </div>
      )}

      <AnnouncementModal
        visible={modalVisible}
        announcement={selected}
        onClose={() => setModalVisible(false)}
      />
    </div>
  );
}
