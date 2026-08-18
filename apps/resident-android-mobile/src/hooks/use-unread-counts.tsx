import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { uniqueChannelName } from '@/lib/realtime-channel';

interface UnreadCountsValue {
  /** Live status count — the resident's own open + in_progress incidents. Not an
   * unread/notification count, so there's no mark-as-read for it. */
  activeReportsCount: number;
  /** The resident's own resolved incidents they haven't acknowledged yet. */
  resolvedUnreadCount: number;
  /** Announcements for the resident's barangay they haven't acknowledged yet. Also
   * drives the Home screen bell — same number, same source of truth. */
  announcementsUnreadCount: number;
  /** Marks every currently-unread resolved incident as read (bulk, per the Resolved
   * Reports segment's single "Mark all as read" button). */
  markResolvedRead: () => Promise<void>;
  /** Marks every currently-unread announcement as read (bulk — shared by the
   * Announcements segment's button and, implicitly, the Home bell it clears). */
  markAnnouncementsRead: () => Promise<void>;
}

const UnreadCountsContext = createContext<UnreadCountsValue>({
  activeReportsCount: 0,
  resolvedUnreadCount: 0,
  announcementsUnreadCount: 0,
  markResolvedRead: async () => {},
  markAnnouncementsRead: async () => {},
});

/**
 * Single source of truth for the Reports bottom-tab's three live badges and the Home
 * bell's announcement count. Mounted once in (app)/_layout.tsx — alongside AppTabs, not
 * inside the Reports screen — so the counts (and their Realtime subscriptions) stay live
 * while the resident is on any tab, not just while Reports is focused.
 */
export function UnreadCountsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [activeReportsCount, setActiveReportsCount] = useState(0);
  const [resolvedUnreadCount, setResolvedUnreadCount] = useState(0);
  const [announcementsUnreadCount, setAnnouncementsUnreadCount] = useState(0);
  // Announcement ids not yet marked read by this resident — kept around so
  // markAnnouncementsRead() knows exactly which ids to upsert without a second round-trip.
  const [unreadAnnouncementIds, setUnreadAnnouncementIds] = useState<string[]>([]);

  const refetchIncidentCounts = useCallback(() => {
    if (!userId) {
      setActiveReportsCount(0);
      setResolvedUnreadCount(0);
      return;
    }
    supabase
      .from('incidents')
      .select('status, resolved_read_at')
      .is('deleted_at', null)
      .eq('reporter_id', userId)
      .then(({ data }) => {
        const rows = data ?? [];
        setActiveReportsCount(
          rows.filter((r) => r.status === 'open' || r.status === 'in_progress').length,
        );
        setResolvedUnreadCount(
          rows.filter((r) => r.status === 'resolved' && !r.resolved_read_at).length,
        );
      });
  }, [userId]);

  const refetchAnnouncementCounts = useCallback(() => {
    if (!userId) {
      setAnnouncementsUnreadCount(0);
      setUnreadAnnouncementIds([]);
      return;
    }
    Promise.all([
      supabase.from('announcements').select('id').is('deleted_at', null),
      supabase.from('announcement_reads').select('announcement_id').eq('resident_id', userId),
    ]).then(([{ data: announcements }, { data: reads }]) => {
      const readIds = new Set((reads ?? []).map((r) => r.announcement_id));
      const unreadIds = (announcements ?? [])
        .map((a) => a.id)
        .filter((id) => !readIds.has(id));
      setUnreadAnnouncementIds(unreadIds);
      setAnnouncementsUnreadCount(unreadIds.length);
    });
  }, [userId]);

  useEffect(() => {
    refetchIncidentCounts();
    refetchAnnouncementCounts();

    if (!userId) return;

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
    await supabase
      .from('incidents')
      .update({ resolved_read_at: new Date().toISOString() })
      .eq('reporter_id', userId)
      .eq('status', 'resolved')
      .is('resolved_read_at', null);
    refetchIncidentCounts();
  }, [userId, refetchIncidentCounts]);

  const markAnnouncementsRead = useCallback(async () => {
    if (!userId || unreadAnnouncementIds.length === 0) return;
    await supabase
      .from('announcement_reads')
      .upsert(
        unreadAnnouncementIds.map((announcement_id) => ({ resident_id: userId, announcement_id })),
        { onConflict: 'resident_id,announcement_id' },
      );
    refetchAnnouncementCounts();
  }, [userId, unreadAnnouncementIds, refetchAnnouncementCounts]);

  return (
    <UnreadCountsContext.Provider
      value={{
        activeReportsCount,
        resolvedUnreadCount,
        announcementsUnreadCount,
        markResolvedRead,
        markAnnouncementsRead,
      }}>
      {children}
    </UnreadCountsContext.Provider>
  );
}

export function useUnreadCounts() {
  return useContext(UnreadCountsContext);
}
