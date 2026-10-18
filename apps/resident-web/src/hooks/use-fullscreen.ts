'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { beginAttempt, notify } from '@/lib/notify';

/**
 * Wraps the real Fullscreen API (not a CSS-only "looks bigger" fake) around a
 * container ref, for the Maps and Emergency Centers map cards. `isFullscreen` tracks
 * `document.fullscreenElement` directly via the `fullscreenchange` event, so it stays
 * correct even when the browser exits fullscreen on its own (Esc key, tab switch).
 */
export function useFullscreen(containerRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, [containerRef]);

  const toggle = useCallback(async () => {
    const el = containerRef.current;
    if (!el || pending.current) return;
    pending.current = true;
    const attempt = beginAttempt('map-fullscreen');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      notify.error("Couldn't change fullscreen mode. You can continue using the map.", { id: attempt });
    } finally { pending.current = false; }
  }, [containerRef]);

  return { isFullscreen, toggle };
}
