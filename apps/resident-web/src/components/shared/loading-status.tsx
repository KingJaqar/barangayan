'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';

import { Spinner } from '@/components/ui/loading';
import { MOTION } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * True once the calling component has stayed mounted for `afterMs` (default 10 s).
 * Mount it only while a foreground operation is pending; unmounting clears the timer.
 * Elapsed time is a display condition only — never treat it as failure or expiry.
 */
export function useTakingLonger(afterMs: number = MOTION.slowOperationMs): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setElapsed(true), afterMs);
    return () => window.clearTimeout(id);
  }, [afterMs]);
  return elapsed;
}

function ActiveStatus({ label, slowAfterMs }: { label: string; slowAfterMs?: number }) {
  const slow = useTakingLonger(slowAfterMs);
  return (
    <span className="rw-hint inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner delayed={false} />
      <span>
        {label}
        {slow ? ' Taking longer than usual.' : null}
      </span>
    </span>
  );
}

/**
 * One polite loading announcement for a region. Render it persistently (outside the
 * region that carries aria-busy, so the announcement is not deferred) and toggle
 * `active` from the existing pending state. The text enters the live region
 * immediately; only its visual appearance waits 120 ms. After 10 s of continuous
 * pending it adds "Taking longer than usual." without changing the operation state.
 */
export function LoadingStatus({
  active,
  label,
  className,
  slowAfterMs,
}: {
  active: boolean;
  label: string;
  className?: string;
  slowAfterMs?: number;
}) {
  return (
    <div role="status" data-slot="loading-status" className={cn(active ? null : 'sr-only', className)}>
      {active ? <ActiveStatus label={label} slowAfterMs={slowAfterMs} /> : null}
    </div>
  );
}

/**
 * Swaps to `slowLabel` after 10 s of continuous pending. Mount it only while the
 * operation is pending (unmounting clears the timer); elapsed time never changes the
 * operation's state.
 */
export function PendingText({ label, slowLabel }: { label: React.ReactNode; slowLabel: React.ReactNode }) {
  return <>{useTakingLonger() ? slowLabel : label}</>;
}
