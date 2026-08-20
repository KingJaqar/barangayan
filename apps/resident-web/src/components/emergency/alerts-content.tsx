'use client';

import { formatDateTime } from '@barangayan/shared';
import { CalendarDays, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useAnnouncements } from '@/hooks/use-announcements';

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
  const { announcements, isLoading, error } = useAnnouncements({ barangayId, category: 'emergency' });

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-status-error text-white">
          <TriangleAlert size={14} />
        </span>
        <h1 className="text-lg font-bold">Emergency Alerts</h1>
        {!isLoading ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{filteredAlerts.length}</span> : null}
      </div>

      {isLoading ? (
        <div className="h-16 animate-pulse rounded-2xl bg-muted" />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterMode(f.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filterMode === f.key ? 'bg-status-error text-white' : 'bg-muted text-muted-foreground'}`}>
                {f.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowCustomFilter((prev) => !prev)}
            className="flex items-center gap-2 self-start text-xs font-medium text-muted-foreground">
            <CalendarDays size={14} />
            Filter by specific date
            {activeCustomFilterCount > 0 ? (
              <span className="rounded-full bg-status-error px-1.5 py-0.5 text-[10px] font-bold text-white">{activeCustomFilterCount}</span>
            ) : null}
          </button>

          {showCustomFilter ? (
            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Month</label>
                <input
                  value={monthInput}
                  onChange={(e) => setMonthInput(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                  placeholder="e.g. January"
                  className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Day</label>
                <input
                  value={dayInput}
                  onChange={(e) => setDayInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 15"
                  inputMode="numeric"
                  className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Year</label>
                <input
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
      )}

      {error ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Unable to load emergency alerts.</p>
      ) : !isLoading && filteredAlerts.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No emergency alerts found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredAlerts.map((alert) => (
            <div key={alert.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="font-semibold">{alert.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{alert.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(alert.published_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
