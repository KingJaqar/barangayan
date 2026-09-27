import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useResident } from '../lib/runtime';
import { residentError } from '../lib/errors';

/** No private persistence; old account results are cancelled and never rendered. */
export function useResource<T>(key: string, read: (signal: AbortSignal) => Promise<T>) {
  const { session, epoch } = useResident();
  const scope = `${epoch}:${session?.user.id ?? 'guest'}:${key}`;
  const load = useRef(read);
  load.current = read;
  const active = useRef<AbortController | null>(null);
  const [result, setResult] = useState<{ scope: string; data?: T; error?: string; loading: boolean }>({ scope, loading: true });
  const refresh = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setResult((previous) => ({ scope, data: previous.scope === scope ? previous.data : undefined, loading: true }));
    try {
      const data = await load.current(controller.signal);
      if (!controller.signal.aborted) setResult({ scope, data, loading: false });
    } catch (error) {
      if (!controller.signal.aborted) setResult((previous) => ({ ...previous, scope, loading: false, error: residentError(error) }));
    }
  }, [scope]);
  useEffect(() => {
    void refresh();
    const lifecycle = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { active.current?.abort(); lifecycle.remove(); };
  }, [refresh]);
  return { ...(result.scope === scope ? result : { scope, loading: true }), refresh };
}
