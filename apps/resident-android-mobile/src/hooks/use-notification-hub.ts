import { ANNOUNCEMENT_CATEGORIES } from '@barangayan/shared';
import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useHistoryPages } from '@/hooks/use-history-pages';
import { useRefreshResource } from '@/hooks/use-refresh-resource';
import { REALTIME_BURST_MS, coalesce } from '@/lib/burst';
import { hubSources, visibleHubSources, type HubSource, type HubSummary, type HubView } from '@/lib/notification-hub';
import { loadAnnouncementPage, loadHubSummary, loadInboxPage, type Announcement, type InboxItem } from '@/lib/notification-hub-data';
import { uniqueChannelName } from '@/lib/realtime-channel';
import { supabase } from '@/lib/supabase';

const MESSAGES = {
  barangay: 'Announcements could not be loaded. Please try again.',
  account: 'Account notifications could not be loaded. Please try again.',
  system: 'System notices could not be loaded. Please try again.',
  summary: 'Unread counts could not be refreshed.',
} as const;
const NONE = { rows: [], total: 0 };

/**
 * The Announcements hub's data: the scope summary plus one independently paged window per listed source (Barangay is a
 * direct RLS query, Account/System use the owner-scoped keyset RPC). A source outside the selected view/chip loads
 * nothing. Realtime only invalidates; nothing here writes.
 */
export function useNotificationHub(view: HubView, chip: string) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const scope = userId ?? 'guest';
  const listed = visibleHubSources(hubSources(view, chip), userId !== null);
  const has = { barangay: listed.includes('barangay'), account: listed.includes('account'), system: listed.includes('system') };
  const category = (ANNOUNCEMENT_CATEGORIES as readonly string[]).includes(chip) ? chip : null;

  const loadBarangay = useCallback((signal: AbortSignal, after: Announcement | undefined, count: boolean) =>
    has.barangay ? loadAnnouncementPage(signal, category, after, count) : Promise.resolve(NONE),
  [has.barangay, category]);
  const loadAccount = useCallback((signal: AbortSignal, after: InboxItem | undefined, count: boolean) =>
    has.account ? loadInboxPage(signal, 'account', view, chip, after, count) : Promise.resolve(NONE),
  [has.account, view, chip]);
  const loadSystem = useCallback((signal: AbortSignal, after: InboxItem | undefined, count: boolean) =>
    has.system ? loadInboxPage(signal, 'system', view, chip, after, count) : Promise.resolve(NONE),
  [has.system, view, chip]);
  const loadSummary = useCallback(async (signal: AbortSignal): Promise<HubSummary | null> => userId ? loadHubSummary(signal, view, chip) : null,
  [userId, view, chip]);

  const pageKey = (source: HubSource) => JSON.stringify([source, view, chip, has[source]]);
  const barangay = useHistoryPages(pageKey('barangay'), loadBarangay, MESSAGES.barangay, scope);
  const account = useHistoryPages(pageKey('account'), loadAccount, MESSAGES.account, scope);
  const system = useHistoryPages(pageKey('system'), loadSystem, MESSAGES.system, scope);
  const summary = useRefreshResource(JSON.stringify([scope, view, chip]), loadSummary, MESSAGES.summary);

  const { refresh: refreshSummary, invalidate: invalidateSummary } = summary;
  const { refresh: refreshBarangay, invalidate: invalidateBarangay } = barangay;
  const { refresh: refreshAccount, invalidate: invalidateAccount } = account;
  const { refresh: refreshSystem, invalidate: invalidateSystem } = system;
  // A resource only loads when asked; the summary has no list hook to ask for it.
  useEffect(() => { void refreshSummary(); }, [refreshSummary]);

  const refreshAll = useCallback(() => Promise.all([refreshSummary(), refreshBarangay(), refreshAccount(), refreshSystem()]).then(() => undefined),
  [refreshSummary, refreshBarangay, refreshAccount, refreshSystem]);
  const invalidateAll = useCallback(() => Promise.all([invalidateSummary(), invalidateBarangay(), invalidateAccount(), invalidateSystem()]).then(() => undefined),
  [invalidateSummary, invalidateBarangay, invalidateAccount, invalidateSystem]);

  const onChange = useRef(invalidateAll);
  useEffect(() => { onChange.current = invalidateAll; }, [invalidateAll]);
  useEffect(() => {
    // One event per changed row: a bulk read refetches the hub once, not once per row.
    const burst = coalesce(() => { void onChange.current(); }, REALTIME_BURST_MS);
    const invalidate = burst.call;
    let channel = supabase.channel(uniqueChannelName(`announcement-hub:${scope}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, invalidate);
    if (userId) {
      channel = channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_reads', filter: `resident_id=eq.${userId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_inbox', filter: `recipient_id=eq.${userId}` }, invalidate);
    }
    channel.subscribe();
    return () => { burst.cancel(); void supabase.removeChannel(channel); };
  }, [scope, userId]);

  return {
    signedIn: userId !== null,
    listed,
    summary: summary.data ?? null,
    summaryError: summary.error,
    groups: { barangay, account, system },
    refreshAll,
    invalidateAll,
  };
}
