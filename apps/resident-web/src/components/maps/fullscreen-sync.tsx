'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/** Leaflet caches its container's pixel size and doesn't notice the Fullscreen API
 * resizing it out from under it — without this, tiles stay clipped to the old size
 * until the next manual pan/zoom. Small delay so it fires after the browser's
 * fullscreen transition actually finishes, not mid-animation. */
export function FullscreenSync({ isFullscreen }: { isFullscreen: boolean }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(timer);
  }, [map, isFullscreen]);

  return null;
}
