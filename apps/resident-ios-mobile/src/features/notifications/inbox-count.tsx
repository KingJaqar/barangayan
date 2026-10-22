import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { createCoalescer, subscribeToChanges } from '../../data/realtime';
import { residentApi } from '../../data/resident-api';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';

type InboxCountValue = { count: number | null; failed: boolean; refresh: () => void };
const Context = createContext<InboxCountValue | null>(null);

export function useInboxCount() {
  const value = useContext(Context);
  if (!value) throw new Error('Inbox count is not initialized.');
  return value;
}

/**
 * The number of unread inbox entries, for the entries on Home and Settings. It is its own count: the Reports badge and the
 * announcement signals are read-state of other records and are never added to it. Guests have none; while the remote
 * notification gate is closed nothing is requested.
 */
export function InboxCountProvider({ children }: { children: ReactNode }) {
  const { client, config, session } = useResident();
  const userId = session?.user.id;
  const [state, setState] = useState<{ owner?: string; count: number | null; failed: boolean }>({ count: null, failed: false });
  const schedule = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!userId || !releaseGates.remotePush) return;
    const api = residentApi(client, config.barangayId, userId);
    let alive = true;
    let controller: AbortController | undefined;
    async function load() {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const count = await api.inboxUnreadCount(current.signal);
        if (alive && !current.signal.aborted) setState({ owner: userId, count, failed: false });
      } catch {
        // Keep the last confirmed count; never replace it with a false zero.
        if (alive && !current.signal.aborted) setState((previous) => ({ owner: userId, count: previous.owner === userId ? previous.count : null, failed: true }));
      }
    }
    const coalescer = createCoalescer(() => void load());
    schedule.current = coalescer.signal;
    void load();
    // Realtime and foreground returns are only refresh signals; bursts coalesce into one authoritative read.
    const unsubscribe = subscribeToChanges(client, 'inbox-count', [{ table: 'notification_inbox', filter: `recipient_id=eq.${userId}` }], () => coalescer.signal());
    const lifecycle = AppState.addEventListener('change', (next) => { if (next === 'active') coalescer.signal(); });
    return () => {
      alive = false;
      controller?.abort();
      coalescer.cancel();
      lifecycle.remove();
      schedule.current = () => undefined;
      unsubscribe();
    };
  }, [client, config.barangayId, userId]);

  const owned = userId && state.owner === userId ? state : null;
  const value: InboxCountValue = { count: owned?.count ?? null, failed: owned?.failed ?? false, refresh: () => schedule.current() };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
