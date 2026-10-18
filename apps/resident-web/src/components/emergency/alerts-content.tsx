'use client';

import { formatDateTime } from '@barangayan/shared';
import { Bell, CalendarDays, ChevronDown, RotateCw, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';

import { InlineReadError } from '@/components/shared/inline-read-error';
import { LoadingStatus } from '@/components/shared/loading-status';
import { PendingHint, Skeleton } from '@/components/ui/loading';
import { useAnnouncements } from '@/hooks/use-announcements';
import { EmergencyPageHeader } from '@/components/emergency/emergency-page-header';
import styles from './emergency.module.css';
import stickyStyles from '@/components/shared/sticky-tabs.module.css';

type FilterMode = 'all' | 'today' | 'lastWeek' | 'lastMonth' | 'lastYear';

const FILTERS: { key: FilterMode; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'lastWeek', label: 'Last Week' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'lastYear', label: 'Last Year' },
];

const MONTH_MAP: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Web port of AlertsContent (mobile index.tsx) — same time-window segmented filter +
 * custom month/day/year filter, re-implemented without Reanimated (per
 * [[reanimated-entering-web-bug]] — plain CSS transitions instead). Backed by
 * useAnnouncements({ category: 'emergency' }), which also backs Phase 6's unfiltered
 * feed (resolves the plan's CC-004). `barangayId` is null for guests — announcements are
 * publicly readable regardless (matches /home's guest branch). */
export function AlertsContent({ barangayId }: { barangayId: string | null }) {
  const { announcements, isInitialLoading, isRefreshing, isReady, error, errorAnnounced, refetch } = useAnnouncements({ barangayId, category: 'emergency' });

  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showCustomFilter, setShowCustomFilter] = useState(false);
  const [monthInput, setMonthInput] = useState('');
  const [dayInput, setDayInput] = useState('');
  const [yearInput, setYearInput] = useState('');

  const filteredAlerts = useMemo(() => {
    return announcements.filter((alert) => {
      const publishedDate = new Date(alert.published_at);
      const now = new Date();

      const month = monthInput.trim() ? (MONTH_MAP[monthInput.toLowerCase().trim()] ?? null) : null;
      const day = dayInput.trim() ? parseInt(dayInput, 10) : null;
      const year = yearInput.trim() ? parseInt(yearInput, 10) : null;

      if (month !== null && publishedDate.getMonth() + 1 !== month) return false;
      if (day !== null && !Number.isNaN(day) && publishedDate.getDate() !== day) return false;
      if (year !== null && !Number.isNaN(year) && publishedDate.getFullYear() !== year) return false;

      if (filterMode === 'today') return isSameDay(publishedDate, now);
      if (filterMode === 'lastWeek') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return publishedDate >= weekAgo;
      }
      if (filterMode === 'lastMonth') {
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        return publishedDate >= monthAgo;
      }
      if (filterMode === 'lastYear') {
        const yearAgo = new Date(now);
        yearAgo.setDate(yearAgo.getDate() - 365);
        return publishedDate >= yearAgo;
      }
      return true;
    });
  }, [announcements, filterMode, monthInput, dayInput, yearInput]);

  const activeCustomFilterCount = [monthInput, dayInput, yearInput].filter((v) => v.trim().length > 0).length;

  return (
    <div className={styles.content}>
      <EmergencyPageHeader title="Emergency Alerts" />
      <div className={styles.toolbar}>
        <div className={styles.toolbarTitle}>
          <h2>Emergency updates</h2>
          {isReady ? <span className={styles.count}>{filteredAlerts.length} {filteredAlerts.length === 1 ? 'alert' : 'alerts'}</span> : null}
        </div>
        {/* Quiet refresh hint: decorative, shown only after 120 ms, never announced. */}
        <PendingHint pending={isRefreshing} className="ml-auto gap-1.5 text-xs text-muted-foreground">
          <RotateCw size={12} className="rw-spinner" /> Updating
        </PendingHint>
      </div>

      {isReady && error ? (
        <InlineReadError announce={!errorAnnounced}
          tone="warning"
          message="Couldn't update emergency alerts. Showing the last loaded alerts, which may be out of date."
          onRetry={() => refetch('emergency alerts')}
        />
      ) : null}

      {isReady ? (
        <>
          <div className={`${styles.toolbar} ${stickyStyles.secondary}`}>
            <div className={styles.filters} role="group" aria-label="Alert date range">
              {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilterMode(f.key)}
                    aria-pressed={filterMode === f.key}
                    className={styles.filterButton}>
                    {f.label}
                  </button>
                ))}
              </div>

            <button
              type="button"
              onClick={() => setShowCustomFilter((prev) => !prev)}
              aria-expanded={showCustomFilter}
              aria-controls="emergency-custom-date"
              className={styles.dateToggle}>
              <CalendarDays size={14} />
              Filter by specific date
              {activeCustomFilterCount > 0 ? (
                <span className={styles.count}>{activeCustomFilterCount}</span>
              ) : null}
              <ChevronDown size={14} className={`transition-transform ${showCustomFilter ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          </div>

          {showCustomFilter ? (
            <div id="emergency-custom-date" className={styles.customDate}>
              <div className="flex flex-col gap-1">
                <label htmlFor="emergency-month" className="text-xs font-semibold text-muted-foreground">Month</label>
                <input
                  id="emergency-month"
                  value={monthInput}
                  onChange={(e) => setMonthInput(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                  placeholder="e.g. January"
                  className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="emergency-day" className="text-xs font-semibold text-muted-foreground">Day</label>
                <input
                  id="emergency-day"
                  value={dayInput}
                  onChange={(e) => setDayInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 15"
                  inputMode="numeric"
                  className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="emergency-year" className="text-xs font-semibold text-muted-foreground">Year</label>
                <input
                  id="emergency-year"
                  value={yearInput}
                  onChange={(e) => setYearInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 2026"
                  inputMode="numeric"
                  className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {isInitialLoading ? (
        <div aria-busy className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : !isReady ? (
        <InlineReadError announce={!errorAnnounced} message="We couldn't load emergency alerts. Check your connection, then try again." onRetry={() => refetch('emergency alerts')} />
      ) : filteredAlerts.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}><Bell size={26} strokeWidth={1.5} aria-hidden="true" /></span>
          <p>No emergency alerts found.</p>
          <p className="text-xs">Try another date range to view more updates.</p>
        </div>
      ) : (
        <div className={styles.alertList}>
          {filteredAlerts.map((alert) => (
            <article key={alert.id} className={styles.alert}>
              <div className={styles.alertMeta}>
                <span className={styles.alertLabel}><TriangleAlert size={12} aria-hidden="true" /> Emergency alert</span>
                <time dateTime={alert.published_at} className={styles.alertDate}>{formatDateTime(alert.published_at)}</time>
              </div>
              <h3>{alert.title}</h3>
              <p className={styles.alertBody}>{alert.body}</p>
            </article>
          ))}
        </div>
      )}
      <LoadingStatus active={isInitialLoading} label="Loading emergency alerts…" />
    </div>
  );
}
