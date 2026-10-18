'use client';

import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useServerReadRetry } from '@/components/shared/read-failure';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Inline recovery view shared by the route error boundaries (app/error.tsx,
 * (resident)/error.tsx, (auth)/error.tsx). "Try again" calls the boundary's Next 16.3
 * `retry()`, which refreshes the route (server components re-fetch, client reads re-run)
 * and re-renders the segment. It never repeats a form submission, payment, upload, or
 * other write: a refresh doesn't replay server actions, and remounted client components
 * start from their initial state. The pending state follows the transition `retry()`
 * runs in, so the button can't be activated twice while the refresh is in flight. If the
 * segment fails again, the boundary shows this view again.
 *
 * The raw error message isn't shown: production server errors carry only a digest, and
 * client errors can include internal details. The digest is shown as a support reference
 * when it exists.
 */
export function RouteError({
  error,
  retry,
  returnHref,
  returnLabel,
  className,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  returnHref: string;
  returnLabel: string;
  className?: string;
}) {
  const { pending: retrying, errorAnnounced, retry: retryRead } = useServerReadRetry(error, 'this page', true);

  return (
    <div className={cn('mx-auto flex w-full max-w-md flex-col items-center gap-4 py-16 text-center', className)}>
      <div className="flex size-14 items-center justify-center rounded-full bg-status-error/10">
        <TriangleAlert aria-hidden size={26} className="text-status-error" />
      </div>
      <div role={errorAnnounced ? undefined : 'alert'} className="flex flex-col gap-1.5">
        <h1 className="text-lg font-bold">This page couldn&apos;t load</h1>
        <p className="text-sm text-muted-foreground">
          Something went wrong while showing this page. Check your connection, then try again. Anything you already
          submitted isn&apos;t sent again.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          loading={retrying}
          loadingLabel="Trying again…"
          onClick={() => {
            if (retrying) return;
            retryRead(retry);
          }}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href={returnHref}>{returnLabel}</Link>
        </Button>
      </div>
      {error.digest ? <p className="text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
    </div>
  );
}
