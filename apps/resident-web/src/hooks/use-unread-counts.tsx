'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';

interface UnreadCountsValue {
  /** Live status count — the resident's own open + in_progress incidents. Not an
   * unread/notification count, so there's no mark-as-read for it. */
  activeReportsCount: number;
  /** The resident's own resolved incidents they haven't acknowledged yet. */
  resolvedUnreadCount: number;
  /** Announcements for the resident's barangay they haven't acknowledged yet. Also
   * drives the Home page's bell — same number, same source of truth. */
  announcementsUnreadCount: number;
  /** Ids of announcements not yet marked read by this resident. */
  unreadAnnouncementIds: string[];
  markResolvedRead: () => Promise<void>;
  markIncidentRead: (incidentId: string) => Promise<void>;
  markIncidentUnread: (incidentId: string) => Promise<void>;
  markAnnouncementsRead: () => Promise<void>;
  markAnnouncementRead: (announcementId: string) => Promise<void>;
  markAnnouncementUnread: (announcementId: string) => Promise<void>;
}

const UnreadCountsContext = createContext<UnreadCountsValue>({
  activeReportsCount: 0,
  resolvedUnreadCount: 0,
  announcementsUnreadCount: 0,
  unreadAnnouncementIds: [],
  markResolvedRead: async () => {},
  markIncidentRead: async () => {},
  markIncidentUnread: async () => {},
  markAnnouncementsRead: async () => {},
  markAnnouncementRead: async () => {},
  markAnnouncementUnread: async () => {},
});

/**
 * Web counterpart of apps/resident-android-mobile/src/hooks/use-unread-counts.tsx —
 * same three tables (C-004 incidents.resolved_read_at, C-007 announcements, C-008
 * announcement_reads), same realtime-channel pattern (uniqueChannelName(), never a bare
 * fixed topic — see lib/realtime-channel.ts's doc comment on why a second .subscribe()
 * on a collided topic throws).
 *
 * Mounted once in (resident)/layout.tsx so the counts (and their subscriptions) stay
 * live across every tab, not just while a Reports-adjacent page is focused.
 */
export function UnreadCountsProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [activeReportsCount, setActiveReportsCount] = useState(0);
  const [resolvedUnreadCount, setResolvedUnreadCount] = useState(0);
  const [announcementsUnreadCount, setAnnouncementsUnreadCount] = useState(0);
  const [unreadAnnouncementIds, setUnreadAnnouncementIds] = useState<string[]>([]);

  // Both refetchers always resolve through a .then() callback, even the "no user"
  // case (a resolved Promise instead of an early synchronous setState) — the effect
  // below calls these directly on mount/userId-change, and react-hooks/set-state-in-
  // effect flags any setState reachable synchronously from an effect body. Routing
  // every branch through a microtask keeps every count update async, matching how the
  // realtime-driven refetches already behave.
  const refetchIncidentCounts = useCallback(() => {
    if (!userId) {
      Promise.resolve().then(() => {
        setActiveReportsCount(0);
        setResolvedUnreadCount(0);
      });
      return;
    }
    const supabase = createSupabaseBrowserClient();
    supabase
      .from('incidents')
      .select('status, resolved_read_at')
      .is('deleted_at', null)
      .eq('reporter_id', userId)
      .then(({ data }) => {
        const rows = data ?? [];
        setActiveReportsCount(rows.filter((r) => r.status === 'open' || r.status === 'in_progress').length);
        setResolvedUnreadCount(rows.filter((r) => r.status === 'resolved' && !r.resolved_read_at).length);
      });
  }, [userId]);

  const refetchAnnouncementCounts = useCallback(() => {
    if (!userId) {
      Promise.resolve().then(() => {
        setAnnouncementsUnreadCount(0);
        setUnreadAnnouncementIds([]);
      });
      return;
    }
    const supabase = createSupabaseBrowserClient();
    Promise.all([
      supabase.from('announcements').select('id').is('deleted_at', null),
      supabase.from('announcement_reads').select('announcement_id').eq('resident_id', userId),
    ]).then(([{ data: announcements }, { data: reads }]) => {
      const readIds = new Set((reads ?? []).map((r) => r.announcement_id));
      const unreadIds = (announcements ?? []).map((a) => a.id).filter((id) => !readIds.has(id));
      setUnreadAnnouncementIds(unreadIds);
      setAnnouncementsUnreadCount(unreadIds.length);
    });
  }, [userId]);

  useEffect(() => {
    refetchIncidentCounts();
    refetchAnnouncementCounts();

    if (!userId) return;

    const supabase = createSupabaseBrowserClient();
    const channels = [
      supabase
        .channel(uniqueChannelName(`unread-counts:incidents:${userId}`))
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'incidents', filter: `reporter_id=eq.${userId}` },
          refetchIncidentCounts,
        )
        .subscribe(),

      supabase
        .channel(uniqueChannelName(`unread-counts:announcements`))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, refetchAnnouncementCounts)
        .subscribe(),

      supabase
        .channel(uniqueChannelName(`unread-counts:announcement-reads:${userId}`))
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'announcement_reads', filter: `resident_id=eq.${userId}` },
          refetchAnnouncementCounts,
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [userId, refetchIncidentCounts, refetchAnnouncementCounts]);

  const markResolvedRead = useCallback(async () => {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from('incidents')
      .update({ resolved_read_at: new Date().toISOString() })
      .eq('reporter_id', userId)
      .eq('status', 'resolved')
      .is('resolved_read_at', null);
    refetchIncidentCounts();
  }, [userId, refetchIncidentCounts]);

  const markIncidentRead = useCallback(
    async (incidentId: string) => {
      if (!userId) return;
      const supabase = createSupabaseBrowserClient();
      await supabase.from('incidents').update({ resolved_read_at: new Date().toISOString() }).eq('id', incidentId).eq('reporter_id', userId);
      refetchIncidentCounts();
    },
    [userId, refetchIncidentCounts],
  );

  const markIncidentUnread = useCallback(
    async (incidentId: string) => {
      if (!userId) return;
      const supabase = createSupabaseBrowserClient();
      await supabase.from('incidents').update({ resolved_read_at: null }).eq('id', incidentId).eq('reporter_id', userId);
      refetchIncidentCounts();
    },
    [userId, refetchIncidentCounts],
  );

  const markAnnouncementsRead = useCallback(async () => {
    if (!userId || unreadAnnouncementIds.length === 0) return;
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from('announcement_reads')
      .upsert(
        unreadAnnouncementIds.map((announcement_id) => ({ resident_id: userId, announcement_id })),
        { onConflict: 'resident_id,announcement_id' },
      );
    refetchAnnouncementCounts();
  }, [userId, unreadAnnouncementIds, refetchAnnouncementCounts]);

  const markAnnouncementRead = useCallback(
    async (announcementId: string) => {
      if (!userId) return;
      const supabase = createSupabaseBrowserClient();
      await supabase
        .from('announcement_reads')
        .upsert({ resident_id: userId, announcement_id: announcementId }, { onConflict: 'resident_id,announcement_id' });
      refetchAnnouncementCounts();
    },
    [userId, refetchAnnouncementCounts],
  );

  const markAnnouncementUnread = useCallback(
    async (announcementId: string) => {
      if (!userId) return;
      const supabase = createSupabaseBrowserClient();
      await supabase.from('announcement_reads').delete().eq('resident_id', userId).eq('announcement_id', announcementId);
      refetchAnnouncementCounts();
    },
    [userId, refetchAnnouncementCounts],
  );

  return (
    <UnreadCountsContext.Provider
      value={{
        activeReportsCount,
        resolvedUnreadCount,
        announcementsUnreadCount,
        unreadAnnouncementIds,
        markResolvedRead,
        markIncidentRead,
        markIncidentUnread,
        markAnnouncementsRead,
        markAnnouncementRead,
        markAnnouncementUnread,
      }}>
      {children}
    </UnreadCountsContext.Provider>
  );
}

export function useUnreadCounts() {
  return useContext(UnreadCountsContext);
}
