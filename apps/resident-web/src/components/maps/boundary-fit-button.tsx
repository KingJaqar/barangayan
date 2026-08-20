'use client';

import { Maximize, Minimize } from 'lucide-react';

/** Bottom-right fullscreen toggle button — uses the real Fullscreen API via the
 * `isFullscreen`/`onToggle` props wired up by `useFullscreen` on the outer container ref. */
export function BoundaryFitButton({
  isFullscreen,
  onToggle,
}: {
  isFullscreen: boolean;
  onToggle: () => void;
  // Legacy props kept for call-site compatibility — no longer used.
  boundary?: unknown;
  markers?: unknown;
  defaultCenter?: unknown;
  defaultZoom?: unknown;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isFullscreen ? 'Exit full screen' : 'Full screen'}
      aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
      className="absolute bottom-6 right-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/95 shadow-lg shadow-black/5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40">
      {isFullscreen ? (
        <Minimize className="h-4 w-4 text-foreground/80" strokeWidth={2} />
      ) : (
        <Maximize className="h-4 w-4 text-foreground/80" strokeWidth={2} />
      )}
    </button>
  );
}
