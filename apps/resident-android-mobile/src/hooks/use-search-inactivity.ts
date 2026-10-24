import { useCallback, useEffect, useRef } from 'react';

/** Restart the search's idle deadline on typing, focus, selection or touch. */
export function useSearchInactivity(active: boolean, onCollapse: () => void) {
  const collapse = useRef(onCollapse);
  collapse.current = onCollapse;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const reset = useCallback(() => {
    clear();
    if (active) timer.current = setTimeout(() => collapse.current(), 15_000);
  }, [active, clear]);
  useEffect(() => { reset(); return clear; }, [reset, clear]);
  return reset;
}
