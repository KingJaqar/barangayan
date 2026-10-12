'use client';

import { TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Inline notice for a failed server-component read, so a failure never looks like a
 * successful empty result. "Try again" re-runs the route's server reads with
 * router.refresh() (read-only: it never repeats a write). The button stays pending
 * until the refresh settles; if the read fails again, this notice renders again.
 */
export function ReadFailure({ message, className }: { message: string; className?: string }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-sm', className)}>
      <TriangleAlert aria-hidden size={16} className="shrink-0 text-status-error" />
      <p className="text-muted-foreground">{message}</p>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto px-0 py-0"
        loading={retrying}
        loadingLabel="Trying again…"
        onClick={() => {
          if (retrying) return;
          startRetry(() => router.refresh());
        }}>
        Try again
      </Button>
    </div>
  );
}
