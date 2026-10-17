'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';

type ReadWriteResult = 'confirmed' | 'accepted' | 'rejected' | 'uncertain' | 'skipped';
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
  markIncidentRead: (incidentId: string) => Promise<ReadWriteResult>;
  markIncidentUnread: (incidentId: string) => Promise<ReadWriteResult>;
  markAnnouncementsRead: () => Promise<ReadWriteResult>;
  markAnnouncementRead: (announcementId: string) => Promise<ReadWriteResult>;
  markAnnouncementUnread: (announcementId: string) => Promise<ReadWriteResult>;
}

const UnreadCountsContext = createContext<UnreadCountsValue>({
  activeReportsCount: 0,
  resolvedUnreadCount: 0,
  announcementsUnreadCount: 0,
  unreadAnnouncementIds: [],
  markResolvedRead: async () => {},
  markIncidentRead: async () => 'skipped',
  markIncidentUnread: async () => 'skipped',
  markAnnouncementsRead: async () => 'skipped',
  markAnnouncementRead: async () => 'skipped',
  markAnnouncementUnread: async () => 'skipped',
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
  const current = useRef<symbol | null>(null);
  useEffect(() => {
    current.current = Symbol();
    return () => { current.current = null; };
  }, [userId]);

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
    const owner = current.current;
    return Promise.resolve(supabase
      .from('incidents')
      .select('status, resolved_read_at')
      .is('deleted_at', null)
      .eq('reporter_id', userId))
      .then(({ data, error }) => {
        if (error || !owner || current.current !== owner) return;
        const rows = data ?? [];
        setActiveReportsCount(rows.filter((r) => r.status === 'open' || r.status === 'in_progress').length);
        setResolvedUnreadCount(rows.filter((r) => r.status === 'resolved' && !r.resolved_read_at).length);
      }).catch(() => { /* Retain the last counts on a failed background refresh. */ });
  }, [userId]);

  const refetchAnnouncementCounts = useCallback(() => {
    if (!userId) {
      return Promise.resolve().then(() => {
        setAnnouncementsUnreadCount(0);
        setUnreadAnnouncementIds([]);
      });
    }
    const supabase = createSupabaseBrowserClient();
    const owner = current.current;
    return Promise.all([
      supabase.from('announcements').select('id').is('deleted_at', null),
      supabase.from('announcement_reads').select('announcement_id').eq('resident_id', userId),
    ]).then(([{ data: announcements, error: announcementError }, { data: reads, error: readError }]) => {
      if (announcementError || readError || !owner || current.current !== owner) return;
      const readIds = new Set((reads ?? []).map((r) => r.announcement_id));
      const unreadIds = (announcements ?? []).map((a) => a.id).filter((id) => !readIds.has(id));
      setUnreadAnnouncementIds(unreadIds);
      setAnnouncementsUnreadCount(unreadIds.length);
    }).catch(() => { /* Retain the last counts; a failed refresh is not a failed write. */ });
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
    async (incidentId: string): Promise<ReadWriteResult> => {
      if (!userId) return 'skipped';
      const supabase = createSupabaseBrowserClient();
      const owner = current.current;
      try {
        const readAt = new Date().toISOString();
        const { data, error, status } = await supabase.from('incidents').update({ resolved_read_at: readAt }).eq('id', incidentId).eq('reporter_id', userId).select('id,status,resolved_read_at');
        if (error) return status === 0 ? 'uncertain' : 'rejected';
        if (!owner || current.current !== owner) return 'skipped';
        await refetchIncidentCounts();
        return data?.length === 1 && data[0].id === incidentId && data[0].status === 'resolved' && typeof data[0].resolved_read_at === 'string' ? 'confirmed' : 'accepted';
      } catch { return 'uncertain'; }
    },
    [userId, refetchIncidentCounts],
  );

  const markIncidentUnread = useCallback(
    async (incidentId: string): Promise<ReadWriteResult> => {
      if (!userId) return 'skipped';
      const supabase = createSupabaseBrowserClient();
      const owner = current.current;
      try {
        const { data, error, status } = await supabase.from('incidents').update({ resolved_read_at: null }).eq('id', incidentId).eq('reporter_id', userId).select('id,status,resolved_read_at');
        if (error) return status === 0 ? 'uncertain' : 'rejected';
        if (!owner || current.current !== owner) return 'skipped';
        await refetchIncidentCounts();
        return data?.length === 1 && data[0].id === incidentId && data[0].status === 'resolved' && data[0].resolved_read_at === null ? 'confirmed' : 'accepted';
      } catch { return 'uncertain'; }
    },
    [userId, refetchIncidentCounts],
  );

  const markAnnouncementsRead = useCallback(async (): Promise<ReadWriteResult> => {
    if (!userId || unreadAnnouncementIds.length === 0) return 'skipped';
    const supabase = createSupabaseBrowserClient();
    const owner = current.current;
    const requestedIds = [...unreadAnnouncementIds];
    try {
      const { data, error, status } = await supabase
        .from('announcement_reads')
        .upsert(
          requestedIds.map((announcement_id) => ({ resident_id: userId, announcement_id })),
          { onConflict: 'resident_id,announcement_id' },
        ).select('announcement_id');
      if (error) return status === 0 ? 'uncertain' : 'rejected';
      if (!owner || current.current !== owner) return 'skipped';
      await refetchAnnouncementCounts();
      const returnedIds = new Set(data?.map(row => row.announcement_id));
      return data?.length === requestedIds.length && requestedIds.every(id => returnedIds.has(id)) ? 'confirmed' : 'accepted';
    } catch { return 'uncertain'; }
  }, [userId, unreadAnnouncementIds, refetchAnnouncementCounts]);

  const markAnnouncementRead = useCallback(
    async (announcementId: string): Promise<ReadWriteResult> => {
      if (!userId) return 'skipped';
      const supabase = createSupabaseBrowserClient();
      const owner = current.current;
      try {
        const { data, error, status } = await supabase
          .from('announcement_reads')
          .upsert({ resident_id: userId, announcement_id: announcementId }, { onConflict: 'resident_id,announcement_id' }).select('announcement_id');
        if (error) return status === 0 ? 'uncertain' : 'rejected';
        if (!owner || current.current !== owner) return 'skipped';
        await refetchAnnouncementCounts();
        return data?.length === 1 && data[0].announcement_id === announcementId ? 'confirmed' : 'accepted';
      } catch { return 'uncertain'; }
    },
    [userId, refetchAnnouncementCounts],
  );

  const markAnnouncementUnread = useCallback(
    async (announcementId: string): Promise<ReadWriteResult> => {
      if (!userId) return 'skipped';
      const supabase = createSupabaseBrowserClient();
      const owner = current.current;
      try {
        const { data, error, status } = await supabase.from('announcement_reads').delete().eq('resident_id', userId).eq('announcement_id', announcementId).select('announcement_id');
        if (error) return status === 0 ? 'uncertain' : 'rejected';
        if (!owner || current.current !== owner) return 'skipped';
        await refetchAnnouncementCounts();
        return data?.length === 1 && data[0].announcement_id === announcementId ? 'confirmed' : 'accepted';
      } catch { return 'uncertain'; }
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
