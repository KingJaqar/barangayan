'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { entityTypeToCategory, type AdminAuditLogCategory, type AdminAuditLogRow } from '@barangayan/shared';

// ---------------------------------------------------------------------------
// Display helpers (presentation layer — emoji stays here, not in the DB)
// ---------------------------------------------------------------------------

const ENTITY_ICONS: Record<string, string> = {
  service_request: '📋',
  announcement: '📢',
  incident: '⚠️',
  resident: '👤',
  waste_zone: '♻️',
  waste_schedule: '♻️',
  medical_drive: '🏥',
  drive_registration: '🏥',
  evacuation_center: '🏠',
  document_type: '📄',
  faq_article: '❓',
  emergency_information: '🚨',
  payment: '💳',
  staff: '👔',
  system: '🔒',
};

const ACTION_VERBS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  status_change: 'Status changed',
  login: 'Logged in',
  logout: 'Logged out',
};

export interface AdminAuditNotification extends AdminAuditLogRow {
  /** Formatted label for display, e.g. "📋 Created: Request #REQ-001" */
  displayLabel: string;
  /** Relative time string, e.g. "3 minutes ago" */
  relativeTime: string;
  /** Route to navigate to when clicked (null for non-linkable events) */
  href: string | null;
  /** Notification-preferences category this entity_type rolls up to, for filtering */
  category: keyof AdminAuditLogCategory;
}

export const NOTIFICATION_CATEGORY_LABELS: Record<keyof AdminAuditLogCategory, string> = {
  service_requests: 'Service Requests',
  announcements: 'Announcements',
  incidents: 'Incident Reports',
  residents: 'Residents',
  waste_management: 'Waste Management',
  health: 'Health Drives',
  evacuation_centers: 'Evacuation Centers',
  staff: 'Staff',
  system: 'System',
};

function buildDisplayLabel(row: AdminAuditLogRow): string {
  const icon = ENTITY_ICONS[row.entity_type] ?? '📝';
  const verb = ACTION_VERBS[row.action] ?? row.action;
  const label = row.entity_label ?? row.entity_type;
  const adminName = (row.metadata as Record<string, unknown> | null)?.admin_name as string | undefined;
  const byLine = adminName ? ` — ${adminName}` : '';
  return `${icon} ${verb}: ${label}${byLine}`;
}

function buildHref(row: AdminAuditLogRow): string | null {
  const id = row.entity_id;
  switch (row.entity_type) {
    case 'service_request':
      return id ? `/requests/${id}` : '/requests';
    case 'announcement':
      return '/announcements';
    case 'incident':
      return '/incident-reports';
    case 'resident':
      return id ? `/residents?q=${id}` : '/residents';
    case 'waste_zone':
    case 'waste_schedule':
      return '/waste-management';
    case 'medical_drive':
    case 'drive_registration':
      return '/health';
    case 'evacuation_center':
      return '/evacuation-centers';
    case 'document_type':
      return '/services';
    case 'faq_article':
      return '/faq';
    case 'emergency_information':
      return '/hub';
    case 'payment':
      return '/transactions';
    case 'staff':
      return '/staff';
    case 'system':
    default:
      return null;
  }
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatRelativeTime(dateStr: string): string {
  const diffMs = new Date(dateStr).getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, 'hour');
  return rtf.format(diffDay, 'day');
}

function toNotification(row: AdminAuditLogRow): AdminAuditNotification {
  return {
    ...row,
    displayLabel: buildDisplayLabel(row),
    relativeTime: formatRelativeTime(row.created_at),
    href: buildHref(row),
    category: entityTypeToCategory(row.entity_type),
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

export function useAdminAuditNotifications(barangayId: string | null) {
  const [notifications, setNotifications] = useState<AdminAuditNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  // Stable supabase reference — recreating the client on every render causes
  // the channel subscription to tear down and re-subscribe.
  const supabaseRef = useRef(createSupabaseBrowserClient());
  const supabase = supabaseRef.current;

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

  // Mark all as read.
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
