import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { HistoryResource, type LoadHistoryPage } from '@/lib/history-resource';

/** Optional account scope retains bounded filter windows and stable refresh ownership. */
export function useHistoryPages<T extends { id: string }>(key: string, load: LoadHistoryPage<T>, message: string, scope?: string) {
  type Page = { resource: HistoryResource<T>; dirty: boolean };
  const cache = useMemo(() => ({ scope, pages: new Map<string, Page>(), current: undefined as Page | undefined }), [scope]);
  const page = useMemo(() => {
    const cached = scope === undefined ? undefined : cache.pages.get(key);
    if (cached) return cached;
    const next = { resource: new HistoryResource(key, load, message), dirty: true };
    if (scope !== undefined) cache.pages.set(key, next);
    return next;
  }, [cache, key, load, message, scope]);
  const { resource } = page;
  cache.current = page;
  useEffect(() => {
    resource.activate();
    if (scope !== undefined && (page.dirty || resource.getSnapshot().data === undefined)) {
      page.dirty = false;
      void resource.refresh();
    }
    return resource.cancel;
  }, [page, resource, scope]);
  const actions = useMemo(() => {
    const refresh = (invalidate: boolean) => {
      for (const entry of cache.pages.values()) entry.dirty = entry !== cache.current;
      return invalidate ? cache.current!.resource.invalidate() : cache.current!.resource.refresh();
    };
    return {
      refresh: () => refresh(false), invalidate: () => refresh(true),
      loadMore: () => cache.current!.resource.loadMore(),
      peek: (pageKey: string) => cache.pages.get(pageKey)?.resource.getSnapshot().data,
    };
  }, [cache]);
  const snapshot = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getSnapshot);
  return { ...snapshot, loading: snapshot.data === undefined && !snapshot.error,
    ...(scope === undefined ? { refresh: resource.refresh, invalidate: resource.invalidate, loadMore: resource.loadMore, peek: actions.peek } : actions) };
}
