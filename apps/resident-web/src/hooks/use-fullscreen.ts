'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';

/**
 * Wraps the real Fullscreen API (not a CSS-only "looks bigger" fake) around a
 * container ref, for the Maps and Emergency Centers map cards. `isFullscreen` tracks
 * `document.fullscreenElement` directly via the `fullscreenchange` event, so it stays
 * correct even when the browser exits fullscreen on its own (Esc key, tab switch).
 */
export function useFullscreen(containerRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, [containerRef]);

  const toggle = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  }, [containerRef]);

  return { isFullscreen, toggle };
}
