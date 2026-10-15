import { useEffect, useRef } from 'react';

/**
 * The latest value, readable from timers, listeners and async callbacks without making them
 * re-subscribe. It updates after each commit, never during render.
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; });
  return ref;
}
