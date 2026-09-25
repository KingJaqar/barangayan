'use client';

import { Check, LayoutGrid, LayoutList, List, Newspaper, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DEFAULT_AUDIT_LOG_FILTERS, hasActiveFilters, useAuditLogBrowser } from '@/hooks/use-audit-log-browser';
import { useMountTransition } from '@/hooks/use-mount-transition';
import { ACTION_VERBS, MODULE_META, MODULE_ORDER, type AdminAuditNotification, type ModuleKey } from '@/lib/audit-notifications';
import { THEMED_SCROLLBAR_CLASS } from '@/lib/scrollbar';

import { DateRangePicker } from './date-range-picker';
import { NotificationDetailPanel } from './notification-detail-panel';
import { NotificationItem, type NotificationItemVariant } from './notification-item';
import { ScrollableChipRow } from './scrollable-chip-row';

import type { AdminAuditAction } from '@barangayan/shared';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { Spinner } from '@/components/loading/spinner';

interface NotificationsDrawerProps {
  /** Target open/closed state — drives the enter/exit slide+fade animation. */
  open: boolean;
  /** User asked to close (X, backdrop, Escape) — parent should flip `open` to false. */
  onClose: () => void;
  /** The exit animation has fully finished — parent may now unmount this component. */
  onClosed: () => void;
  barangayId: string;
  barangayName: string;
  /** Bell hook's refetch — called after the drawer mutates read-state so the
   * bell's badge/list resync without a real-time UPDATE subscription. */
  onSynced: () => void;
}

const WIDTH_STORAGE_KEY = 'admin-notifications-drawer-width-vw';
const DEFAULT_WIDTH_VW = 80;
const MIN_WIDTH_VW = 40;
const MAX_WIDTH_VW = 95;
const SMALL_SCREEN_BREAKPOINT = 1024;

// Smooth, slightly-decelerated ease-out — noticeably softer than a linear or
// default-ease transition for a panel this large.
const SLIDE_TRANSITION = 'transition-transform duration-[380ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none will-change-transform';
const FADE_TRANSITION = 'transition-opacity duration-300 ease-out motion-reduce:transition-none';

const ACTION_OPTIONS: AdminAuditAction[] = ['create', 'update', 'delete', 'status_change', 'login', 'logout'];

const LAYOUTS: { key: NotificationItemVariant; label: string; icon: typeof LayoutList }[] = [
  { key: 'details', label: 'Details', icon: LayoutList },
  { key: 'list', label: 'List', icon: List },
  { key: 'tiles', label: 'Tiles', icon: LayoutGrid },
  { key: 'content', label: 'Content', icon: Newspaper },
];

type ColumnCount = 1 | 2 | 3 | 4;
const COLUMN_OPTIONS: ColumnCount[] = [1, 2, 3, 4];
/** Per-variant default column count, applied whenever the layout view changes. */
const DEFAULT_COLUMNS: Record<NotificationItemVariant, ColumnCount> = {
  details: 1,
  list: 1,
  tiles: 3,
  content: 1,
};
const COLUMNS_CLASS: Record<ColumnCount, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  }).format(d);
}

export function NotificationsDrawer({ open, onClose, onClosed, barangayId, barangayName, onSynced }: NotificationsDrawerProps) {
  const router = useRouter();
  const [variant, setVariant] = useState<NotificationItemVariant>('details');
  const [columns, setColumns] = useState<ColumnCount>(DEFAULT_COLUMNS.details);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  // Lazy init (not an effect) so a previously-dragged width is picked up on
  // the very first render instead of flashing the default then correcting.
  const [widthVw, setWidthVw] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_WIDTH_VW; // SSR pass — no localStorage yet
    try {
      const stored = window.localStorage.getItem(WIDTH_STORAGE_KEY);
      const n = stored ? Number(stored) : NaN;
      if (Number.isFinite(n) && n >= MIN_WIDTH_VW && n <= MAX_WIDTH_VW) return n;
    } catch {
      // localStorage unavailable — fall back to the default width silently.
    }
    return DEFAULT_WIDTH_VW;
  });

  const { rendered, visible, onTransitionEnd } = useMountTransition(open, onClosed);

  const {
    filters,
    setFilters,
    notifications,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useAuditLogBrowser(barangayId, open, onSynced);

  // Persist width across sessions (the initial value is restored via the lazy
  // useState initializer above, not an effect — see its comment).
  useEffect(() => {
    try {
      window.localStorage.setItem(WIDTH_STORAGE_KEY, String(widthVw));
    } catch {
      // Ignore — width just won't persist across sessions.
    }
  }, [widthVw]);

  // Small-screen fallback: below the breakpoint, the drawer takes full width
  // (20% of a phone/tablet screen is unusable for a side-by-side detail strip).
  useEffect(() => {
    function check() {
      setIsSmallScreen(window.innerWidth < SMALL_SCREEN_BREAKPOINT);
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Debounce the search box so every keystroke doesn't trigger a full requery.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters((f) => (f.search === searchDraft ? f : { ...f, search: searchDraft }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchDraft, setFilters]);

  // Escape closes the drawer (and, since the detail panel only exists inside
  // this tree, the detail panel along with it).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Closing the drawer also starts the detail panel's own exit animation (so
  // the two slide out together instead of the detail panel just vanishing
  // the instant the drawer itself finishes unmounting).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setDetailOpen(false);
  }, [open]);

  const effectiveWidthVw = isSmallScreen ? 100 : widthVw;
  // `selectedId` is deliberately NOT cleared by the detail panel's "close" —
  // that only flips `detailOpen` to false, which starts the panel's exit
  // animation. `selectedId` (and so its notification's content) keeps
  // rendering throughout the slide-out, and only clears once the panel
  // reports its exit transition actually finished (see the panel's
  // `onClosed` below) — otherwise the content would blank out instantly
  // instead of sliding away with something still visible in it.
  const selected = notifications.find((n) => n.id === selectedId);

  function selectVariant(key: NotificationItemVariant) {
    setVariant(key);
    setColumns(DEFAULT_COLUMNS[key]);
  }

  function toggleModule(key: ModuleKey) {
    setFilters((f) => {
      const next = new Set(f.modules);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...f, modules: next };
    });
  }

  function toggleAction(action: AdminAuditAction) {
    setFilters((f) => {
      const next = new Set(f.actionTypes);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return { ...f, actionTypes: next };
    });
  }

  async function handleItemClick(n: AdminAuditNotification) {
    if (!n.is_read) await markAsRead(n.id);
    setSelectedId(n.id);
    setDetailOpen(true);
  }

  function handleOpen() {
    if (!selected?.href) return;
    router.push(selected.href);
    onClose();
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidthPx = (widthVw / 100) * window.innerWidth;

    function onMove(ev: MouseEvent) {
      // Panel is right-anchored — dragging the handle left (negative deltaX)
      // should widen it, so width grows as the pointer moves left of startX.
      const deltaPx = startX - ev.clientX;
      const nextPx = startWidthPx + deltaPx;
      const nextVw = Math.min(MAX_WIDTH_VW, Math.max(MIN_WIDTH_VW, (nextPx / window.innerWidth) * 100));
      setWidthVw(nextVw);
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  if (!rendered) return null;

  // Grouped-by-day rendering for the 'content' layout only.
  const groupedContent: { label: string; items: AdminAuditNotification[] }[] = [];
  if (variant === 'content') {
    for (const n of notifications) {
      const label = dayLabel(n.created_at);
      const lastGroup = groupedContent[groupedContent.length - 1];
      if (lastGroup && lastGroup.label === label) lastGroup.items.push(n);
      else groupedContent.push({ label, items: [n] });
    }
  }

  const gridClass = `grid gap-3 p-4 ${COLUMNS_CLASS[columns]}`;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div
        className={`absolute inset-0 bg-black/50 ${FADE_TRANSITION} ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      <div
        className={`relative flex h-full flex-col border-l border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-950 ${SLIDE_TRANSITION} ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: `${effectiveWidthVw}vw` }}
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={onTransitionEnd}
      >
        {/* Drag handle — hidden on small screens where width is forced to 100vw. */}
        {!isSmallScreen ? (
          <div
            onMouseDown={startResize}
            className="absolute left-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize select-none hover:bg-[var(--accent)]/40 active:bg-[var(--accent)]"
          />
        ) : null}

        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
          <div>
            <span className="text-lg font-semibold">Notifications</span>
            <p className="text-xs text-zinc-400">
              Shared with every admin in {barangayName} — actions from any admin account appear here.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10"
            >
              <Check className="size-3.5" />
              Mark all as read
            </button>
            <button onClick={onClose} className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Search + layout switcher */}
        <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-6 py-3 dark:border-white/10">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search notifications…"
              className="w-full rounded-full border border-zinc-300 bg-zinc-50 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          {/* Layout view */}
          <div className="flex items-center gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
            {LAYOUTS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => selectVariant(key)}
                title={label}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  variant === key ? 'bg-white text-[var(--accent)] shadow-sm dark:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Column count — independent of layout view, applies to all 4 views */}
          <div className="flex items-center gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900" title="Columns">
            {COLUMN_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setColumns(n)}
                title={`${n} column${n > 1 ? 's' : ''}`}
                className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  columns === n ? 'bg-white text-[var(--accent)] shadow-sm dark:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Detailed filters */}
        <div className="space-y-3 border-b border-black/10 px-6 py-3 dark:border-white/10">
          {/* Module chips — multi-select, horizontally scrollable */}
          <ScrollableChipRow className="pb-1" edgeFromClassName="from-white dark:from-zinc-950">
            {MODULE_ORDER.map((key) => (
              <FilterChip key={key} active={filters.modules.has(key)} onClick={() => toggleModule(key)}>
                {MODULE_META[key].icon} {MODULE_META[key].label}
              </FilterChip>
            ))}
          </ScrollableChipRow>

          <div className="flex flex-wrap items-center gap-3">
            {/* Read state */}
            <div className="flex items-center gap-1 rounded-full bg-zinc-100 p-1 text-xs dark:bg-zinc-900">
              {(['all', 'unread', 'read'] as const).map((rs) => (
                <button
                  key={rs}
                  onClick={() => setFilters((f) => ({ ...f, readState: rs }))}
                  className={`rounded-full px-2.5 py-1 font-medium capitalize transition-colors ${
                    filters.readState === rs ? 'bg-white text-[var(--accent)] shadow-sm dark:bg-zinc-800' : 'text-zinc-500'
                  }`}
                >
                  {rs}
                </button>
              ))}
            </div>

            {/* Action-type chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {ACTION_OPTIONS.map((action) => (
                <FilterChip key={action} active={filters.actionTypes.has(action)} onClick={() => toggleAction(action)}>
                  {ACTION_VERBS[action]}
                </FilterChip>
              ))}
            </div>

            {/* Date range — calendar popover with its own Reset/Save */}
            <div className="ml-auto flex items-center gap-2">
              <DateRangePicker
                value={{ from: filters.dateFrom, to: filters.dateTo }}
                onChange={(next) => setFilters((f) => ({ ...f, dateFrom: next.from, dateTo: next.to }))}
              />
              {hasActiveFilters(filters) ? (
                <button
                  onClick={() => setFilters(DEFAULT_AUDIT_LOG_FILTERS)}
                  className="rounded-full px-2 py-1 text-xs font-medium text-zinc-400 hover:text-red-600"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* List */}
        <div className={`flex-1 overflow-y-auto ${THEMED_SCROLLBAR_CLASS}`}>
          {error ? (
            <p className="px-6 py-6 text-center text-sm text-red-600">{error}</p>
          ) : loading ? (
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="flex items-center justify-center gap-2 px-6 py-10 text-center text-sm text-zinc-400">
              <Spinner size="regular" /> Loading notifications…
            </p>
          ) : notifications.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-zinc-400">
              {hasActiveFilters(filters) ? 'No notifications match these filters.' : 'No notifications yet.'}
            </p>
          ) : variant === 'content' ? (
            <div className="space-y-4 p-4">
              {groupedContent.map((group) => (
                <div key={group.label}>
                  <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{group.label}</h3>
                  <div className={`grid gap-2 ${COLUMNS_CLASS[columns]}`}>
                    {group.items.map((n) => (
                      <NotificationItem key={n.id} notification={n} variant="content" selected={n.id === selectedId} onClick={() => handleItemClick(n)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={gridClass}>
              {notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} variant={variant} selected={n.id === selectedId} onClick={() => handleItemClick(n)} />
              ))}
            </div>
          )}

          {!loading && !error && hasMore ? (
            <div className="p-4 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                aria-busy={loadingMore}
                className="rounded-full bg-zinc-100 px-5 py-2 text-sm font-semibold text-zinc-600 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
              >
                <LoadingButtonContent pending={loadingMore} pendingLabel="Loading…">
                  Load more
                </LoadingButtonContent>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {selected ? (
        <NotificationDetailPanel
          notification={selected}
          open={detailOpen}
          widthVw={100 - effectiveWidthVw}
          fullOverlay={isSmallScreen}
          onClose={() => setDetailOpen(false)}
          onClosed={() => setSelectedId(null)}
          onOpen={handleOpen}
        />
      ) : null}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-[var(--accent)] text-white'
          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
      }`}
    >
      {children}
    </button>
  );
}
