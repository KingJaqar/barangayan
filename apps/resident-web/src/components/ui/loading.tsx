import type * as React from 'react';

import { cn } from '../../lib/utils';

/**
 * Server-compatible loading primitives (no client boundary). Animation, the 120 ms
 * decorative reveal delay, and reduced-motion handling live in app/globals.css
 * (`rw-hint`, `rw-spinner`, `rw-skeleton`), so nothing here needs a timer.
 */

/**
 * Decorative fixed-size spinner that inherits the current text color. Always
 * aria-hidden: pair it with a visible label, a LoadingStatus, or an accessible control
 * name. `delayed` (default) hides it for the first 120 ms so fast operations never
 * flash it.
 */
export function Spinner({ className, delayed = true }: { className?: string; delayed?: boolean }) {
  const ring = (
    <span
      data-slot="spinner"
      className={cn('rw-spinner inline-block size-4 shrink-0 rounded-full border-2 border-current border-t-transparent', className)}
    />
  );
  return (
    <span aria-hidden className={cn('inline-flex shrink-0', delayed && 'rw-hint')}>
      {ring}
    </span>
  );
}

/**
 * Theme-aware placeholder shape, hidden from assistive technology (announce loading
 * with LoadingStatus instead). It stays invisible for the first 120 ms, then shows a
 * low-contrast 1.6 s opacity pulse; `pulse={false}` keeps it steady (maps, QR codes).
 */
export function Skeleton({ className, pulse = true, ...props }: React.ComponentProps<'div'> & { pulse?: boolean }) {
  return (
    <div
      aria-hidden
      data-slot="skeleton"
      className={cn(pulse ? 'rw-skeleton' : 'rw-skeleton-static', 'rounded-md', className)}
      {...props}
    />
  );
}

/**
 * Display-only hint for an existing pending flag: renders nothing when idle and reveals
 * its decoration (a Spinner by default) only after 120 ms. It never changes the
 * operation; disabled state, labels, and aria-busy stay with the owning control.
 */
export function PendingHint({ pending, className, children }: { pending: boolean; className?: string; children?: React.ReactNode }) {
  if (!pending) return null;
  return (
    <span aria-hidden className={cn('rw-hint inline-flex shrink-0 items-center', className)}>
      {children ?? <Spinner delayed={false} />}
    </span>
  );
}
