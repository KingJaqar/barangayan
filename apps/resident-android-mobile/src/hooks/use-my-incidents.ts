import type { Tables } from '@barangayan/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import type { IncidentStatus } from '@/constants/incident-status';
import { useAuth } from '@/hooks/use-auth';
import { useHistoryPages } from '@/hooks/use-history-pages';
import { HISTORY_PAGE_SIZE, historyBefore } from '@/lib/history-resource';
import { supabase } from '@/lib/supabase';
import { uniqueChannelName } from '@/lib/realtime-channel';

export type MyIncidentRow = Tables<'incidents'> & {
  incident_categories: {
    name: string;
    icon: string | null;
    color: string;
  } | null;
};

export type MyIncidentSummary = Pick<MyIncidentRow,
  'id' | 'title' | 'description' | 'status' | 'created_at' | 'photo_urls' | 'confirmation_count' | 'resolved_read_at' | 'incident_categories'>;

/** Full detail rows remain separate; the history only fetches its card fields. */
export function useMyIncidents(options: { status?: IncidentStatus | IncidentStatus[] } = {}) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const statusKey = Array.isArray(options.status) ? [...new Set(options.status)].sort().join(',') : options.status ?? '';
  const [instanceId] = useState(() => Math.random().toString(36).slice(2));
  const load = useCallback(async (signal: AbortSignal, after: MyIncidentSummary | undefined, count: boolean) => {
    if (!userId) return { rows: [], total: 0 };
    let query = supabase.from('incidents')
      .select('id, title, description, status, created_at, photo_urls, confirmation_count, resolved_read_at, incident_categories(name, icon, color)', count ? { count: 'exact' } : undefined)
      .eq('reporter_id', userId).is('deleted_at', null)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .limit(HISTORY_PAGE_SIZE).abortSignal(signal);
    if (statusKey) query = query.in('status', statusKey.split(','));
    if (after) query = query.or(historyBefore('created_at', after.created_at, after.id));
    const { data, error, count: total } = await query;
    if (error) throw error;
    return { rows: data ?? [], total };
  }, [userId, statusKey]);
  const history = useHistoryPages(JSON.stringify([userId, statusKey]), load, 'Could not load your reports. Reconnect and try again.');
  const { refresh, invalidate } = history;
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let subscribed = false;
    const channel = supabase.channel(uniqueChannelName('my-incidents:' + userId + ':' + instanceId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents', filter: 'reporter_id=eq.' + userId },
        () => { if (active) void invalidate(); })
      .subscribe(status => {
        if (!active || status !== 'SUBSCRIBED') return;
        if (subscribed) void invalidate(); else void refresh();
        subscribed = true;
      });
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [userId, instanceId, refresh, invalidate]);
  return { incidents: history.data?.rows ?? [], total: history.data?.total ?? 0,
    hasMore: history.data?.hasMore ?? false, isLoading: history.loading, fetching: history.fetching,
    error: history.error, refetch: refresh, loadMore: history.loadMore };
}
