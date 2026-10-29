import type { Tables } from '@barangayan/shared';
import { addEventListener } from '@react-native-community/netinfo';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { activeAdvisories, advisoryExpiry } from '@/lib/home-announcement';
import { RefreshResource } from '@/lib/refresh-resource';
import { supabase } from '@/lib/supabase';

type Announcement = Tables<'announcements'>;
async function loadAnnouncements(signal: AbortSignal, alerts: boolean) {
  const now = new Date().toISOString();
  const items: Announcement[] = [];
  // Only currently published active alerts, never full announcement history.
  for (let page = 0; page < 100; page++) {
    if (signal.aborted) throw new Error('Cancelled');
    let query = supabase.from('announcements').select('*', alerts ? { count: 'exact' } : undefined).is('deleted_at', null)
      .lte('published_at', now).order('published_at', { ascending: false }).order('id', { ascending: false });
    if (alerts) query = query.eq('category', 'emergency').gt('alert_expires_at', now).range(items.length, items.length + 99);
    else query = query.limit(1);
    const { data, error, count } = await query.abortSignal(signal).retry(false);
    if (error || !data) throw error ?? new Error('Invalid announcement response');
    items.push(...data);
    if (!alerts || (count !== null && count !== undefined && items.length >= count)) return { items, refreshedAt: new Date().toISOString() };
    if (!data.length || count === null || count === undefined) throw new Error('Incomplete advisory response');
  }
  throw new Error('Advisory response exceeded the safe page limit');
}
const loadNews = (signal: AbortSignal) => loadAnnouncements(signal, false);
const loadAlerts = (signal: AbortSignal) => loadAnnouncements(signal, true);

export function useHomeAnnouncements(scope: string) {
  const newsResource = useMemo(() => new RefreshResource(scope, loadNews, 'Announcements could not be loaded. Please try again.', undefined, 12_000), [scope]);
  const alertResource = useMemo(() => new RefreshResource(scope, loadAlerts, 'Advisories could not be checked. Please try again.', undefined, 12_000), [scope]);
  const news = useSyncExternalStore(newsResource.subscribe, newsResource.getSnapshot, newsResource.getSnapshot);
  const alerts = useSyncExternalStore(alertResource.subscribe, alertResource.getSnapshot, alertResource.getSnapshot);
  const [offline, setOffline] = useState(false);
  const [clock, setClock] = useState(Date.now);
  const refresh = useCallback(() => Promise.all([newsResource.refresh(), alertResource.refresh()]), [newsResource, alertResource]);
  useFocusEffect(useCallback(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const tick = () => {
      clearTimeout(timer);
      if (!active) return;
      const now = Date.now();
      setClock(now);
      const next = Math.min(...[...(alertResource.getSnapshot().data?.items ?? []), ...(newsResource.getSnapshot().data?.items ?? [])].map(advisoryExpiry).filter((value): value is number => value !== null && value > now));
      if (Number.isFinite(next)) timer = setTimeout(tick, Math.min(next - now, 2_147_483_647));
    };
    let network: (() => void) | undefined;
    const start = () => {
      network ??= addEventListener(state => setOffline(state.isConnected === false || state.isInternetReachable === false));
      newsResource.activate(); alertResource.activate(); tick(); void refresh();
    };
    const stop = () => { clearTimeout(timer); network?.(); network = undefined; newsResource.cancel(); alertResource.cancel(); };
    const unsubscribe = alertResource.subscribe(tick);
    const unsubscribeNews = newsResource.subscribe(tick);
    if (active) start();
    const listener = AppState.addEventListener('change', state => { active = state === 'active'; if (active) start(); else stop(); });
    return () => { active = false; stop(); unsubscribe(); unsubscribeNews(); listener.remove(); };
  }, [newsResource, alertResource, refresh]));
  return { news, alerts, clock, active: activeAdvisories(alerts.data?.items ?? [], clock), offline,
    refresh, retryNews: newsResource.refresh, retryAlerts: alertResource.refresh };
}
