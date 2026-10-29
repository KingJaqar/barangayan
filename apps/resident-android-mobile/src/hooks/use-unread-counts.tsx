import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useRefreshResource } from '@/hooks/use-refresh-resource';
import { REALTIME_BURST_MS, coalesce } from '@/lib/burst';
import { loadHubSummary, loadUnreadAnnouncementIds, markScopeRead as markScopeReadRemote, setInboxRead } from '@/lib/notification-hub-data';
import { totalUnread, type HubView } from '@/lib/notification-hub';
import { supabase } from '@/lib/supabase';
import { uniqueChannelName } from '@/lib/realtime-channel';

interface UnreadCountsValue {
  readStateError: boolean;
  retryReadState: () => void;
  /** Live status count — the resident's own open + in_progress incidents. Not an
   * unread/notification count, so there's no mark-as-read for it. */
  activeReportsCount: number;
  /** The resident's own resolved incidents they haven't acknowledged yet. */
  resolvedUnreadCount: number;
  /** Everything unread in the Announcements hub: barangay announcements plus Account and System
   * notifications, counted by the server (`notification_hub_summary`). Drives the header bell. */
  announcementsUnreadCount: number;
  /** Ids of announcements not yet marked read by this resident — lets a single
   * AnnouncementCard check its own read state without a separate query. */
  unreadAnnouncementIds: string[];
  /** Marks every currently-unread resolved incident as read (bulk, per the Resolved
   * Reports segment's single "Mark all as read" button). */
  markResolvedRead: () => Promise<void>;
  /** Marks a single resolved incident read — the per-card "mark as read" icon. */
  markIncidentRead: (incidentId: string) => Promise<void>;
  /** Marks a single resolved incident unread again — the per-card "mark as unread" icon. */
  markIncidentUnread: (incidentId: string) => Promise<void>;
  /** Marks every unread item of a hub view/chip read in one server snapshot (announcements and inbox rows together). */
  markHubScopeRead: (view: HubView, chip: string) => Promise<void>;
  /** Marks one Account/System inbox row read or unread again; only its read marker changes. */
  markInboxRead: (notificationId: string, read: boolean) => Promise<void>;
  /** Marks a single announcement read — the per-card "mark as read" icon. */
  markAnnouncementRead: (announcementId: string) => Promise<void>;
  /** Marks a single announcement unread again — the per-card "mark as unread" icon. */
  markAnnouncementUnread: (announcementId: string) => Promise<void>;
}

const UnreadCountsContext = createContext<UnreadCountsValue>({
  readStateError: false,
  retryReadState: () => {},
  activeReportsCount: 0,
  resolvedUnreadCount: 0,
  announcementsUnreadCount: 0,
  unreadAnnouncementIds: [],
  markResolvedRead: async () => {},
  markIncidentRead: async () => {},
  markIncidentUnread: async () => {},
  markHubScopeRead: async () => {},
  markInboxRead: async () => {},
  markAnnouncementRead: async () => {},
  markAnnouncementUnread: async () => {},
});

/**
 * Single source of truth for the Reports tab's incident badges and the shared header
 * bell's announcement count. Mounted once in (app)/_layout.tsx — alongside AppTabs, not
 * inside the Reports screen — so the counts (and their Realtime subscriptions) stay live
 * while the resident is on any tab, not just while Reports is focused.
 */
export function UnreadCountsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  // Announcement ids not yet marked read by this resident — each announcement row checks its own state here.
  const [unreadAnnouncementIds, setUnreadAnnouncementIds] = useState<string[]>([]);
  const [announcementCountsError, setAnnouncementCountsError] = useState(false);

  const loadIncidentCounts = useCallback(async (signal: AbortSignal) => {
    if (!userId) return { active: 0, resolved: 0 };
    const [active, resolved] = await Promise.all([
      supabase.from('incidents').select('id', { count: 'exact', head: true })
        .eq('reporter_id', userId).is('deleted_at', null).in('status', ['open', 'in_progress']).abortSignal(signal),
      supabase.from('incidents').select('id', { count: 'exact', head: true })
        .eq('reporter_id', userId).is('deleted_at', null).eq('status', 'resolved').is('resolved_read_at', null).abortSignal(signal),
    ]);
    if (active.error || resolved.error || active.count === null || resolved.count === null) {
      throw new Error('Could not refresh report counts.');
    }
    return { active: active.count, resolved: resolved.count };
  }, [userId]);
  const incidentCounts = useRefreshResource(userId ?? 'guest', loadIncidentCounts, 'Could not refresh report counts.');
  const refetchIncidentCounts = incidentCounts.invalidate;
  const activeReportsCount = incidentCounts.data?.active ?? 0;
  const resolvedUnreadCount = incidentCounts.data?.resolved ?? 0;

  const loadHubUnread = useCallback(async (signal: AbortSignal) => {
    if (!userId) return null;
    return totalUnread(await loadHubSummary(signal, 'all', 'all'));
  }, [userId]);
  const hubUnread = useRefreshResource(userId ?? 'guest', loadHubUnread, 'Could not refresh notification counts.');
  const refetchHubUnread = hubUnread.invalidate;
  const announcementsUnreadCount = hubUnread.data ?? 0;

  const refetchAnnouncementCounts = useCallback(() => {
    setAnnouncementCountsError(false);
    void refetchHubUnread();
    if (!userId) {
      setUnreadAnnouncementIds([]);
      return;
    }
    loadUnreadAnnouncementIds(userId).then(setUnreadAnnouncementIds, () => setAnnouncementCountsError(true));
  }, [userId, refetchHubUnread]);

  useEffect(() => {
    refetchIncidentCounts();
    refetchAnnouncementCounts();

    if (!userId) return;

    // A bulk read reports one event per changed row; recount once per burst.
    const countsChanged = coalesce(refetchAnnouncementCounts, REALTIME_BURST_MS);

    const channels = [
      supabase
        .channel(uniqueChannelName(`unread-counts:incidents:${userId}`))
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'incidents', filter: `reporter_id=eq.${userId}` },
          refetchIncidentCounts,
        )
        // Realtime drops DELETE events on filtered subscriptions, so a permanent delete needs an
        // unfiltered listener (payload carries only the id); recount on any delete.
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'incidents' }, refetchIncidentCounts)
        .subscribe(),

      supabase
        .channel(uniqueChannelName(`unread-counts:announcements`))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, countsChanged.call)
        .subscribe(),

      supabase
        .channel(uniqueChannelName(`unread-counts:announcement-reads:${userId}`))
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'announcement_reads', filter: `resident_id=eq.${userId}` },
          countsChanged.call,
        )
        .subscribe(),

      supabase
        .channel(uniqueChannelName(`unread-counts:notification-inbox:${userId}`))
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notification_inbox', filter: `recipient_id=eq.${userId}` },
          countsChanged.call,
        )
        .subscribe(),
    ];

    return () => {
      countsChanged.cancel();
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [userId, refetchIncidentCounts, refetchAnnouncementCounts]);

  const markResolvedRead = useCallback(async () => {
    if (!userId) return;
    const { error } = await supabase
      .from('incidents')
      .update({ resolved_read_at: new Date().toISOString() })
      .eq('reporter_id', userId)
      .eq('status', 'resolved')
      .is('resolved_read_at', null);
    if (error) throw new Error('Read status could not be saved.');
    refetchIncidentCounts();
  }, [userId, refetchIncidentCounts]);

  // Single-item counterparts of markResolvedRead — the per-card "mark as read" / "mark
  // as unread" icons on a resolved IncidentCard. `resolved_read_at` lives on the
  // incident row itself (not a join table, since only the reporter ever sees their own
  // report — see 0080's comment), so these are plain single-row updates; RLS scopes them
  // to the caller's own resolved incidents (0085_resident_mark_resolved_incident_read.sql).
  const markIncidentRead = useCallback(
    async (incidentId: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from('incidents')
        .update({ resolved_read_at: new Date().toISOString() })
        .eq('id', incidentId)
        .eq('reporter_id', userId);
      if (error) throw new Error('Read status could not be saved.');
      refetchIncidentCounts();
    },
    [userId, refetchIncidentCounts],
  );

  const markIncidentUnread = useCallback(
    async (incidentId: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from('incidents')
        .update({ resolved_read_at: null })
        .eq('id', incidentId)
        .eq('reporter_id', userId);
      if (error) throw new Error('Read status could not be saved.');
      refetchIncidentCounts();
    },
    [userId, refetchIncidentCounts],
  );

  // The count is re-read even when the write fails, so an ambiguous failure shows the server's actual state.
  const markHubScopeRead = useCallback(async (view: HubView, chip: string) => {
    if (!userId) return;
    try { await markScopeReadRemote(view, chip); } finally { refetchAnnouncementCounts(); }
  }, [userId, refetchAnnouncementCounts]);

  const markInboxRead = useCallback(async (notificationId: string, read: boolean) => {
    if (!userId) return;
    try { await setInboxRead(notificationId, userId, read); } finally { refetchAnnouncementCounts(); }
  }, [userId, refetchAnnouncementCounts]);

  // Single-item counterparts of the bulk action above — the "mark as read" / "mark as
  // unread" icons on each announcement row. Both just upsert/delete the one
  // announcement_reads row for this resident + announcement; RLS already scopes writes
  // to the caller's own resident_id (0080_reports_unread_counts.sql).
  const markAnnouncementRead = useCallback(
    async (announcementId: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from('announcement_reads')
        .upsert(
          { resident_id: userId, announcement_id: announcementId },
          { onConflict: 'resident_id,announcement_id' },
        );
      if (error) throw new Error('Read status could not be saved.');
      refetchAnnouncementCounts();
    },
    [userId, refetchAnnouncementCounts],
  );

  const markAnnouncementUnread = useCallback(
    async (announcementId: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from('announcement_reads')
        .delete()
        .eq('resident_id', userId)
        .eq('announcement_id', announcementId);
      if (error) throw new Error('Read status could not be saved.');
      refetchAnnouncementCounts();
    },
    [userId, refetchAnnouncementCounts],
  );

  return (
    <UnreadCountsContext.Provider
      value={{
        readStateError: !!incidentCounts.error || announcementCountsError || !!hubUnread.error,
        retryReadState: () => { refetchIncidentCounts(); refetchAnnouncementCounts(); },
        activeReportsCount,
        resolvedUnreadCount,
        announcementsUnreadCount,
        unreadAnnouncementIds,
        markResolvedRead,
        markIncidentRead,
        markIncidentUnread,
        markHubScopeRead,
        markInboxRead,
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
