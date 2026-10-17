import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { secondsRemaining } from './countdown';

/**
 * Seconds left until `expiresAt`, or null with no expiry. It ticks once a second only while
 * the app is in the foreground and recomputes from the clock on return, so no hidden timer runs.
 */
export function useCountdown(expiresAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (expiresAt === null) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => { if (timer) clearInterval(timer); timer = undefined; };
    const run = () => {
      stop();
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), 1000);
    };
    if (AppState.currentState === 'active') run();
    const lifecycle = AppState.addEventListener('change', (state) => { if (state === 'active') run(); else stop(); });
    return () => { stop(); lifecycle.remove(); };
  }, [expiresAt]);
  return expiresAt === null ? null : secondsRemaining(expiresAt, now);
}
