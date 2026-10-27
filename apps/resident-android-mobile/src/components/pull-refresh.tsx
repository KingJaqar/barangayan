import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

/** Above `useAnnouncements`' 12 s abort and below `RefreshResource`'s 30 s abort. */
export const PULL_REFRESH_CEILING_MS = 20_000;

type PullRefreshHandler = () => unknown;
type Register = (handler: PullRefreshHandler) => () => void;

const NO_HANDLERS: readonly PullRefreshHandler[] = [];
const PullRefreshRegistry = createContext<Register | null>(null);

/** Themed control for a scroller's `refreshControl` prop. ScrollView injects `style` and children on Android. */
export function PullRefreshControl({ refreshing, onRefresh, ...rest }: RefreshControlProps) {
  const { resident } = useTheme();
  return <RefreshControl {...rest} refreshing={refreshing} onRefresh={onRefresh}
    colors={[resident.accentText]} progressBackgroundColor={resident.card} />;
}

/** One refresh at a time. `handlers` run together with whatever the mounted children registered;
 * a rejection never reaches the gesture and the spinner always ends by the ceiling. */
export function usePullRefresh(handlers: readonly PullRefreshHandler[] = NO_HANDLERS) {
  const [refreshing, setRefreshing] = useState(false);
  const owned = useRef(handlers);
  const registered = useRef(new Set<PullRefreshHandler>());
  const flight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);

  useEffect(() => { owned.current = handlers; });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, []);

  const register = useCallback<Register>(handler => {
    const entry: PullRefreshHandler = () => handler();
    registered.current.add(entry);
    return () => { registered.current.delete(entry); };
  }, []);

  const onRefresh = useCallback(() => {
    if (flight.current) return;
    flight.current = true;
    setRefreshing(true);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      flight.current = false;
      if (mounted.current) setRefreshing(false);
    };
    timer.current = setTimeout(finish, PULL_REFRESH_CEILING_MS);
    const runs = [...owned.current, ...registered.current].map(handler =>
      new Promise<unknown>(resolve => { resolve(handler()); }));
    void Promise.allSettled(runs).then(finish);
  }, []);

  return { refreshing, onRefresh, register };
}

export function PullRefreshScope({ register, children }: { register: Register; children: ReactNode }) {
  return <PullRefreshRegistry.Provider value={register}>{children}</PullRefreshRegistry.Provider>;
}

/** Registers once per mount; the latest `handler` runs. A no-op outside a `PullRefreshScope`. */
export function useRegisterPullRefresh(handler: PullRefreshHandler) {
  const register = useContext(PullRefreshRegistry);
  const latest = useRef(handler);
  useEffect(() => { latest.current = handler; });
  useEffect(() => register?.(() => latest.current()), [register]);
}
