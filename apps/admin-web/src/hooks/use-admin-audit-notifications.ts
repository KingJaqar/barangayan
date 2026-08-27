'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { toNotification, type AdminAuditNotification } from '@/lib/audit-notifications';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { AdminAuditLogRow } from '@barangayan/shared';

export type { AdminAuditNotification } from '@/lib/audit-notifications';
export { CATEGORY_LABELS as NOTIFICATION_CATEGORY_LABELS, MODULE_META, MODULE_ORDER } from '@/lib/audit-notifications';

const PAGE_SIZE = 50;

export function useAdminAuditNotifications(barangayId: string | null) {
  const [notifications, setNotifications] = useState<AdminAuditNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  // Stable supabase reference — recreating the client on every render causes
  // the channel subscription to tear down and re-subscribe.
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const fetchNotifications = useCallback(async () => {
    if (!barangayId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('*')
      .eq('barangay_id', barangayId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!error && data) {
      const rows = data as AdminAuditLogRow[];
      setNotifications(rows.map(toNotification));
      setUnreadCount(rows.filter((r) => !r.is_read).length);
    }
    setLoading(false);
  }, [barangayId, supabase]);

  // Initial fetch.
  useEffect(() => {
    // Data-fetching on mount is a legitimate pattern; eslint-disable is scoped to this call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime — receive new rows as they are inserted.
  useEffect(() => {
    if (!barangayId) return;

    const channel = supabase
      .channel(`admin_audit_log:${barangayId}`)
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
          setNotifications((prev) => [toNotification(row), ...prev].slice(0, PAGE_SIZE));
          if (!row.is_read) setUnreadCount((prev) => prev + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barangayId, supabase]);

  // Mark a single notification as read.
  const markAsRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      await supabase
        .from('admin_audit_log')
        .update({ is_read: true })
        .eq('id', id);
    },
    [supabase],
  );

  // Mark all as read. Whole-barangay, unscoped by any filter — kept simple
  // and unconditional on purpose (unlike the drawer's filter-scoped version).
  const markAllAsRead = useCallback(
    async () => {
      if (!barangayId) return;
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      await supabase
        .from('admin_audit_log')
        .update({ is_read: true })
        .eq('barangay_id', barangayId)
        .eq('is_read', false);
    },
    [barangayId, supabase],
  );

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
