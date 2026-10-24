import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { RefreshResource } from '@/lib/refresh-resource';

/** The key includes every private owner and query filter. Changing it creates
 * empty visible state immediately; cleanup cancels the obsolete transport. */
export function useRefreshResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  message: string,
  reconcile?: (previous: T | undefined, next: T) => T,
) {
  const resource = useMemo(() => new RefreshResource(key, load, message, reconcile), [key, load, message, reconcile]);
  useEffect(() => {
    resource.activate();
    return resource.cancel;
  }, [resource]);
  const snapshot = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getSnapshot);
  return { ...snapshot, hasLoaded: snapshot.data !== undefined, loading: snapshot.data === undefined && !snapshot.error,
    refreshing: snapshot.data !== undefined && snapshot.fetching,
    refresh: resource.refresh, invalidate: resource.invalidate };
}
