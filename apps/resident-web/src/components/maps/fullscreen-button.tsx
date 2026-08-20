'use client';

import { Maximize, Minimize } from 'lucide-react';

/** Plain overlay button, not a Leaflet child — the Fullscreen API toggle lives in the
 * parent (useFullscreen on the outer card ref); FullscreenSync (rendered inside
 * MapContainer) is what tells Leaflet to redraw at the new size. */
export function FullscreenButton({ isFullscreen, onToggle }: { isFullscreen: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isFullscreen ? 'Exit full screen' : 'Full screen'}
      aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
      className="absolute right-4 top-16 z-[1000] flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/95 shadow-lg shadow-black/5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40">
      {isFullscreen ? (
        <Minimize className="h-4 w-4 text-foreground/80" strokeWidth={2} />
      ) : (
        <Maximize className="h-4 w-4 text-foreground/80" strokeWidth={2} />
      )}
    </button>
  );
}
