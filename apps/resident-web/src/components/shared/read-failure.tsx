'use client';

import { TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { beginAttempt, notify, type OperationId } from '@/lib/notify';

interface RetryAttempt {
  owner: string;
  result: string | Error;
  href: string;
  contentName: string;
  id: OperationId;
  delivered: boolean;
}

const ReadRetryContext = createContext<{
  pending: boolean;
  announcedResult: string | Error | null;
  begin: (owner: string, result: string | Error, contentName: string, action: () => void) => void;
  failed: (owner: string, result: string | Error, boundary: boolean) => void;
} | null>(null);

/** Lives above route boundaries so their fallback can unmount during retry. */
export function ReadRetryProvider({ children }: { children: ReactNode }) {
  const [pending, startRetry] = useTransition();
  const [announcedResult, setAnnouncedResult] = useState<string | Error | null>(null);
  const attempt = useRef<RetryAttempt | null>(null);
  const begin = useCallback((owner: string, result: string | Error, contentName: string, action: () => void) => {
    if (attempt.current) return;
    attempt.current = { owner, result, contentName, href: window.location.href, id: beginAttempt('server-read-retry'), delivered: false };
    startRetry(action);
  }, []);
  const failed = useCallback((owner: string, result: string | Error, boundary: boolean) => {
    const current = attempt.current;
    if (!current || current.delivered || current.href !== window.location.href || current.result === result) return;
    if (current.owner !== owner && !boundary) return;
    current.delivered = true;
    if (notify.error(`Couldn't refresh ${current.contentName}. Please try again.`, { id: current.id })) setAnnouncedResult(result);
  }, []);
  // Child layout effects report an actual new failure before a settled transition
  // discards its receipt. Success, cancelled navigation and background work stay quiet.
  useEffect(() => { if (!pending) attempt.current = null; }, [pending]);
  const value = useMemo(() => ({ pending, announcedResult, begin, failed }), [pending, announcedResult, begin, failed]);
  return <ReadRetryContext.Provider value={value}>{children}</ReadRetryContext.Provider>;
}

export function useServerReadRetry(result: string | Error, contentName: string, boundary = false) {
  const context = useContext(ReadRetryContext);
  if (!context) throw new Error('Server read retries require ReadRetryProvider.');
  const { pending, announcedResult, begin, failed } = context;
  const owner = useId();
  useLayoutEffect(() => { failed(owner, result, boundary); }, [failed, owner, result, boundary]);
  return { pending, errorAnnounced: announcedResult === result, retry: (action: () => void) => begin(owner, result, contentName, action) };
}

/** Retains the existing account fallback's link presentation and modified clicks. */
export function ReadRetryLink({ href, resultId, contentName }: { href: string; resultId: string; contentName: string }) {
  const router = useRouter();
  const { pending, retry } = useServerReadRetry(resultId, contentName);
  return <a className="underline" href={href} aria-disabled={pending || undefined} aria-busy={pending || undefined} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!pending) retry(() => router.refresh());
  }}>Try again</a>;
}

/**
 * Inline notice for a failed server-component read, so a failure never looks like a
 * successful empty result. "Try again" re-runs the route's server reads with
 * router.refresh() (read-only: it never repeats a write). The button stays pending
 * until the refresh settles; if the read fails again, this notice renders again.
 */
export function ReadFailure({ message, className, resultId, contentName }: {
  message: string; className?: string; resultId: string; contentName: string;
}) {
  const router = useRouter();
  const { pending: retrying, retry } = useServerReadRetry(resultId, contentName);

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
          retry(() => router.refresh());
        }}>
        Try again
      </Button>
    </div>
  );
}
