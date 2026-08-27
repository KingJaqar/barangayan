'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { entityTypeToModule, MODULE_ENTITY_TYPES, toNotification, type AdminAuditNotification, type ModuleKey } from '@/lib/audit-notifications';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { AdminAuditAction, AdminAuditLogRow, AdminEntityType } from '@barangayan/shared';

export interface AuditLogFilters {
  modules: Set<ModuleKey>;
  actionTypes: Set<AdminAuditAction>;
  readState: 'all' | 'unread' | 'read';
  /** yyyy-mm-dd, or '' for unbounded — matches a plain <input type="date"> value. */
  dateFrom: string;
  dateTo: string;
  search: string;
}

export const DEFAULT_AUDIT_LOG_FILTERS: AuditLogFilters = {
  modules: new Set(),
  actionTypes: new Set(),
  readState: 'all',
  dateFrom: '',
  dateTo: '',
  search: '',
};

export function hasActiveFilters(filters: AuditLogFilters): boolean {
  return (
    filters.modules.size > 0 ||
    filters.actionTypes.size > 0 ||
    filters.readState !== 'all' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    filters.search.trim() !== ''
  );
}

const PAGE_SIZE = 30;

interface Cursor {
  createdAt: string;
  id: string;
}

/**
 * Pure predicate mirroring the server-side query below — used to decide
 * whether a realtime INSERT belongs in the currently-filtered list. Keeping
 * this as the one place that encodes "does this row match these filters"
 * (rather than re-deriving similar logic at the realtime callback) is what
 * keeps the live feed and the fetched pages from silently drifting apart.
 */
export function matchesFilters(row: AdminAuditLogRow, filters: AuditLogFilters): boolean {
  if (filters.modules.size > 0 && !filters.modules.has(entityTypeToModule(row))) return false;
  if (filters.actionTypes.size > 0 && !filters.actionTypes.has(row.action)) return false;
  if (filters.readState === 'unread' && row.is_read) return false;
  if (filters.readState === 'read' && !row.is_read) return false;
  if (filters.dateFrom && row.created_at < `${filters.dateFrom}T00:00:00`) return false;
  if (filters.dateTo && row.created_at > `${filters.dateTo}T23:59:59.999`) return false;
  const needle = filters.search.trim().toLowerCase();
  if (needle && !(row.entity_label ?? '').toLowerCase().includes(needle)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Query building — shared between the paginated SELECT and the filter-scoped
// "mark all as read" UPDATE, via a generic helper so the module/action/date/
// search clauses are written exactly once. (`readState` is applied by each
// caller separately since the UPDATE always forces `is_read = false`.)
// ---------------------------------------------------------------------------

interface CommonFilterable<T> {
  in(column: string, values: readonly unknown[]): T;
  or(filters: string): T;
  gte(column: string, value: string): T;
  lte(column: string, value: string): T;
  ilike(column: string, pattern: string): T;
}

function applyCommonFilters<T extends CommonFilterable<T>>(query: T, filters: AuditLogFilters): T {
  let q = query;

  if (filters.modules.size > 0) {
    const entityTypes = new Set<AdminEntityType>();
    filters.modules.forEach((moduleKey) => MODULE_ENTITY_TYPES[moduleKey].forEach((et) => entityTypes.add(et)));
    q = q.in('entity_type', Array.from(entityTypes));

    // `incident` rows are shared between Incident Reports and Waste Management
    // (same table, split by metadata.source). Only need to refine when exactly
    // one of the two is selected — if both are picked, their combined
    // entity-type set already covers every incident row, no refinement needed.
    const hasIncidentReports = filters.modules.has('incident-reports');
    const hasWasteManagement = filters.modules.has('waste-management');
    if (hasIncidentReports && !hasWasteManagement) {
      // Legacy/no-metadata incident rows must count as "Incident Reports", not
      // be silently dropped — NOT(x = 'waste_management') is NULL (excluded)
      // for rows where metadata->>source is null, so it's spelled out explicitly.
      q = q.or('entity_type.neq.incident,metadata->>source.is.null,metadata->>source.neq.waste_management');
    } else if (hasWasteManagement && !hasIncidentReports) {
      q = q.or('entity_type.neq.incident,metadata->>source.eq.waste_management');
    }
  }

  if (filters.actionTypes.size > 0) q = q.in('action', Array.from(filters.actionTypes));
  if (filters.dateFrom) q = q.gte('created_at', `${filters.dateFrom}T00:00:00`);
  if (filters.dateTo) q = q.lte('created_at', `${filters.dateTo}T23:59:59.999`);
  if (filters.search.trim()) q = q.ilike('entity_label', `%${filters.search.trim()}%`);

  return q;
}

function buildSelectQuery(supabase: ReturnType<typeof createSupabaseBrowserClient>, barangayId: string, filters: AuditLogFilters) {
  let q = applyCommonFilters(supabase.from('admin_audit_log').select('*').eq('barangay_id', barangayId), filters);
  if (filters.readState === 'unread') q = q.eq('is_read', false);
  if (filters.readState === 'read') q = q.eq('is_read', true);
  return q;
}

function buildMarkAllAsReadQuery(supabase: ReturnType<typeof createSupabaseBrowserClient>, barangayId: string, filters: AuditLogFilters) {
  return applyCommonFilters(
    supabase.from('admin_audit_log').update({ is_read: true }).eq('barangay_id', barangayId),
    filters,
  ).eq('is_read', false);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Data layer for the notifications drawer — separate from the bell's
 * `useAdminAuditNotifications` because it needs server-side filtering,
 * keyset pagination over a much larger window, and its own realtime
 * subscription, none of which the bell's fixed last-50 feed needs. Only
 * fetches/subscribes while `enabled` (i.e. the drawer is actually open).
 */
export function useAuditLogBrowser(barangayId: string | null, enabled: boolean, onSynced?: () => void) {
  const [filters, setFilters] = useState<AuditLogFilters>(DEFAULT_AUDIT_LOG_FILTERS);
  const [notifications, setNotifications] = useState<AdminAuditNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const cursorRef = useRef<Cursor | null>(null);
  // Stale-response guard: only the most recently issued fetch is allowed to
  // apply its result — rapid filter changes otherwise risk a slower earlier
  // response landing after (and clobbering) a newer one.
  const requestIdRef = useRef(0);

  const runFetch = useCallback(
    async (opts: { reset: boolean }) => {
      if (!barangayId || !enabled) return;
      const myRequestId = ++requestIdRef.current;

      if (opts.reset) {
        setLoading(true);
        setNotifications([]);
        cursorRef.current = null;
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      let q = buildSelectQuery(supabase, barangayId, filters)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      const cursor = opts.reset ? null : cursorRef.current;
      if (cursor) {
        q = q.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
      }
      q = q.limit(PAGE_SIZE);

      const { data, error: fetchError } = await q;

      if (myRequestId !== requestIdRef.current) return; // superseded by a newer fetch — discard

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const rows = (data ?? []) as AdminAuditLogRow[];
      const mapped = rows.map(toNotification);
      setNotifications((prev) => (opts.reset ? mapped : [...prev, ...mapped]));
      setHasMore(rows.length === PAGE_SIZE);
      if (rows.length > 0) {
        const last = rows[rows.length - 1];
        cursorRef.current = { createdAt: last.created_at, id: last.id };
      }
      setLoading(false);
      setLoadingMore(false);
    },
    [barangayId, enabled, filters, supabase],
  );

  // Any filter change (or the drawer opening) resets pagination and refetches
  // page 1 — reusing the old cursor against a new filter set would otherwise
  // silently return an empty/truncated page.
  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runFetch({ reset: true });
    // runFetch already depends on [barangayId, enabled, filters, supabase]; this
    // effect intentionally mirrors that same list so it reruns exactly when
    // those inputs change (not on every `runFetch` identity change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, barangayId, filters, supabase]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    runFetch({ reset: false });
  }, [loading, loadingMore, hasMore, runFetch]);

  // Realtime — only while the drawer is open, on its own channel name so it
  // never collides with the bell's `admin_audit_log:${barangayId}` channel.
  useEffect(() => {
    if (!enabled || !barangayId) return;

    const channel = supabase
      .channel(`admin_audit_log_browser:${barangayId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_audit_log',
          filter: `barangay_id=eq.${barangayId}`,
        },
        (payload) => {
          const row = payload.new as AdminAuditLogRow;
          if (!matchesFilters(row, filters)) return;
          setNotifications((prev) => [toNotification(row), ...prev]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, barangayId, filters, supabase]);

  const markAsRead = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      await supabase.from('admin_audit_log').update({ is_read: true }).eq('id', id);
      onSynced?.();
    },
    [supabase, onSynced],
  );

  /** Filter-scoped: marks read everything the *active filters* currently
   * match, not the whole barangay — e.g. filtering to "Unread + Requests"
   * only clears Requests. Intentionally different from the bell popover's
   * unscoped "Mark all as read", which is left as-is. */
  const markAllAsRead = useCallback(async () => {
    if (!barangayId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await buildMarkAllAsReadQuery(supabase, barangayId, filters);
    onSynced?.();
  }, [barangayId, filters, supabase, onSynced]);

  return {
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
    refetch: () => runFetch({ reset: true }),
  };
}
