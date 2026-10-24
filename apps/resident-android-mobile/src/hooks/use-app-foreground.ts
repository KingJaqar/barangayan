import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

const listeners = new Set<() => void>();
let subscription: ReturnType<typeof AppState.addEventListener> | null = null;
const foreground = () => AppState.currentState === 'active';
const serverForeground = () => false;

function subscribe(listener: () => void) {
  listeners.add(listener);
  subscription ??= AppState.addEventListener('change', () => listeners.forEach(notify => notify()));
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      subscription?.remove();
      subscription = null;
    }
  };
}

/** One native listener shared by optional foreground work; no polling while backgrounded. */
export function useAppForeground() {
  return useSyncExternalStore(subscribe, foreground, serverForeground);
}
