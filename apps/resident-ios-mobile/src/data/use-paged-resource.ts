import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useResident } from '../lib/runtime';
import { PagedList, type PageRead } from './pagination';
import { subscribeToChanges, type ChangeSource } from './realtime';

/**
 * One incrementally paged list bound to the current account (plan P02-T03). Changing the
 * key (search/filter) or the signed-in account replaces the query and drops late replies
 * from the previous one. Returning to the foreground and realtime signals reload the
 * first page; nothing is persisted.
 */
export function usePagedResource<T extends { id: string }>(key: string, read: PageRead<T>, changes: ChangeSource[] = []) {
  const { client, session, epoch } = useResident();
  const owner = `${epoch}:${session?.user.id ?? 'guest'}`;
  const scope = `${owner}:${key}`;
  const latest = useRef({ read, changes });
  // The query itself is created in the effect below; until then the list reads nothing.
  const [list] = useState(() => new PagedList<T>(async () => []));
  const state = useSyncExternalStore(list.subscribe, list.getState);
  const changeKey = changes.map((source) => `${source.table}?${source.filter ?? ''}`).join('|');

  // Declared first so later effects in this commit see the current read/changes.
  useEffect(() => { latest.current = { read, changes }; });
  useEffect(() => {
    void list.replace((range, signal) => latest.current.read(range, signal));
    const lifecycle = AppState.addEventListener('change', (next) => { if (next === 'active') void list.reload(); });
    return () => { lifecycle.remove(); list.cancel(); };
  }, [list, scope]);
  useEffect(() => {
    if (!changeKey) return;
    // Keyed by owner and sources, not the search text, so typing does not resubscribe.
    return subscribeToChanges(client, 'list', latest.current.changes, () => void list.reload());
  }, [client, list, changeKey, owner]);

  return { state, reload: () => list.reload(), loadMore: () => list.loadMore(), retry: () => list.retry() };
}

/** Holds a value until it stops changing for `delay` ms (handoff P1 search: 250–300 ms). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
