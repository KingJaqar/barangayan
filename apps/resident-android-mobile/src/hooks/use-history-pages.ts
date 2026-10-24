import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { HistoryResource, type LoadHistoryPage } from '@/lib/history-resource';

export function useHistoryPages<T extends { id: string }>(key: string, load: LoadHistoryPage<T>, message: string) {
  const resource = useMemo(() => new HistoryResource(key, load, message), [key, load, message]);
  useEffect(() => { resource.activate(); return resource.cancel; }, [resource]);
  const snapshot = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getSnapshot);
  return { ...snapshot, loading: snapshot.data === undefined && !snapshot.error,
    refresh: resource.refresh, invalidate: resource.invalidate, loadMore: resource.loadMore };
}
