/** A bulk read changes many rows and Realtime reports each row separately; handlers that refetch on every event would
 * issue one burst of requests per row. */
export const REALTIME_BURST_MS = 300;

/** Runs `action` once, `wait` ms after the first call of a burst; calls made while it waits are absorbed. */
export function coalesce(action: () => void, wait: number): { call: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    call: () => { timer ??= setTimeout(() => { timer = undefined; action(); }, wait); },
    cancel: () => { clearTimeout(timer); timer = undefined; },
  };
}
