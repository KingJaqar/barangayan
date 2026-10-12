'use client';

import { RotateCw, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Inline recovery notice for a failed client-side read. Pair it with the hook's own
 * `refetch` (a read-only retry — it never repeats a write).
 *
 * - `tone="error"` replaces content that never loaded; it is announced once (role alert).
 * - `tone="warning"` sits above a retained, same-identity result whose refresh failed, so
 *   the content is not presented as current (role status).
 * Failed reads do not toast: this notice is the persistent, single report.
 */
export function InlineReadError({
  message,
  onRetry,
  retrying = false,
  tone = 'error',
  className,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
  tone?: 'error' | 'warning';
  className?: string;
}) {
  const isWarning = tone === 'warning';
  return (
    <div
      role={isWarning ? 'status' : 'alert'}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 text-sm',
        isWarning
          ? 'rounded-xl border border-status-warning/40 bg-status-warning/10 px-3.5 py-2.5'
          : 'flex-col justify-center rounded-2xl border border-border bg-card px-4 py-6 text-center',
        className,
      )}>
      <TriangleAlert aria-hidden size={isWarning ? 16 : 24} className={cn('shrink-0', isWarning ? 'text-status-warning' : 'text-status-error')} />
      <p className={cn(isWarning ? 'flex-1' : 'text-muted-foreground')}>{message}</p>
      <Button
        type="button"
        variant={isWarning ? 'link' : 'outline'}
        size="sm"
        className={isWarning ? 'h-auto px-0 py-0' : undefined}
        loading={retrying}
        loadingLabel="Trying again…"
        onClick={() => {
          if (!retrying) onRetry();
        }}>
        <RotateCw aria-hidden size={14} /> Try again
      </Button>
    </div>
  );
}
