import { useSyncExternalStore } from 'react';

let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();
const snapshot = () => now;
const serverSnapshot = () => 0;
const inactive = () => () => {};

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    now = performance.now();
    timer = setInterval(() => {
      now = performance.now();
      listeners.forEach(notify => notify());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** A single clock for visible SLA cards. The last owner stops it; return catches up once. */
export function useVisibleClock(active: boolean) {
  return useSyncExternalStore(active ? subscribe : inactive, snapshot, serverSnapshot);
}
