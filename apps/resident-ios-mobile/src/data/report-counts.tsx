import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useResident } from '../lib/runtime';
import { createCoalescer, subscribeToChanges } from './realtime';
import { residentApi } from './resident-api';

type Counts = { active: number; unreadResolved: number; unreadAnnouncements: number };
type ReportCounts = { counts: Counts | null; failed: boolean; refresh: () => void };
const Context = createContext<ReportCounts | null>(null);

export function useReportCounts() {
  const value = useContext(Context);
  if (!value) throw new Error('Report counts are not initialized.');
  return value;
}

/** Mounted beside the tabs so the Reports signals stay live on every destination. Guests have no counts. */
export function ReportCountsProvider({ children }: { children: ReactNode }) {
  const { client, config, session } = useResident();
  const userId = session?.user.id;
  const [state, setState] = useState<{ owner?: string; counts: Counts | null; failed: boolean }>({ counts: null, failed: false });
  const schedule = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!userId) return;
    const api = residentApi(client, config.barangayId, userId);
    let alive = true;
    let controller: AbortController | undefined;
    async function load() {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const counts = await api.reportCounts(current.signal);
        if (alive && !current.signal.aborted) setState({ owner: userId, counts, failed: false });
      } catch {
        // Keep the last confirmed counts; never replace them with a false zero.
        if (alive && !current.signal.aborted) setState((previous) => ({ owner: userId, counts: previous.owner === userId ? previous.counts : null, failed: true }));
      }
    }
    // Realtime and foreground returns are only refresh signals; bursts coalesce into one authoritative read.
    const coalescer = createCoalescer(() => void load());
    schedule.current = coalescer.signal;
    void load();
    const unsubscribe = subscribeToChanges(client, 'report-counts', [
      { table: 'incidents', filter: `reporter_id=eq.${userId}` },
      { table: 'announcements', filter: `barangay_id=eq.${config.barangayId}` },
      { table: 'announcement_reads', filter: `resident_id=eq.${userId}` },
    ], () => void load());
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
  const value: ReportCounts = { counts: owned?.counts ?? null, failed: owned?.failed ?? false, refresh: () => schedule.current() };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
