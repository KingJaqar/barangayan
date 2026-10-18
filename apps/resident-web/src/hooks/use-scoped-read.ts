'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { beginAttempt, notify } from '@/lib/notify';

type ReadResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

/**
 * Readiness bookkeeping for one identity-scoped read (resident-web feedback plan §3):
 * results and failures are keyed by `identity` (e.g. the barangay or profile id), so a
 * change of identity never shows another identity's rows, and only the newest request
 * may settle state — an older response is dropped. Returned errors and thrown rejections
 * are both kept as `error`. This is bookkeeping only: the caller still owns the query,
 * its filters, and any Realtime subscription (call `refetch` from the subscription).
 *
 * - `isInitialLoading`: no result yet for this identity and no failure (never an empty state).
 * - `isRefreshing`: a result exists and a newer request is in flight; the result stays.
 * - `error` with `isReady`: a refresh failed and the last result is kept.
 */
export function useScopedRead<T>(identity: string, load: () => ReadResult<T>) {
  const [result, setResult] = useState<{ identity: string; data: T } | null>(null);
  const [failure, setFailure] = useState<{ identity: string; message: string; announced: boolean } | null>(null);
  const [fetching, setFetching] = useState<string | null>(null);
  const loadRef = useRef(load);
  const activeRef = useRef(false);
  const generationRef = useRef(0);

  useEffect(() => {
    loadRef.current = load;
  });

  const refetch = useCallback((contentName?: string) => {
    const attempt = contentName ? beginAttempt('read-retry') : null;
    const generation = ++generationRef.current;
    const isCurrent = () => activeRef.current && generation === generationRef.current;
    setFetching(identity);
    setFailure(null);
    function fail(thrown: unknown) {
      if (!isCurrent()) return;
      setFailure({ identity, message: thrown instanceof Error ? thrown.message : 'Request failed', announced: attempt !== null });
      if (attempt) notify.error(`Couldn't refresh ${contentName}. Please try again.`, { id: attempt });
      setFetching(null);
    }
    try { loadRef.current().then(
      ({ data, error }) => {
        if (!isCurrent()) return;
        if (error) {
          setFailure({ identity, message: error.message, announced: attempt !== null });
          if (attempt) notify.error(`Couldn't refresh ${contentName}. Please try again.`, { id: attempt });
        }
        else setResult({ identity, data: data as T });
        setFetching(null);
      },
      fail,
    ); } catch (thrown) { fail(thrown); }
  }, [identity]);

  useEffect(() => {
    const requests = generationRef;
    activeRef.current = true;
    // Microtask-wrapped — see use-unread-counts.tsx's doc comment on
    // react-hooks/set-state-in-effect.
    Promise.resolve().then(() => {
      if (activeRef.current) refetch();
    });
    return () => {
      activeRef.current = false;
      ++requests.current;
    };
  }, [refetch]);

  /** Replaces the current identity's result locally (after a confirmed write). */
  const setData = useCallback(
    (next: T) => {
      setResult({ identity, data: next });
    },
    [identity],
  );

  const isReady = result?.identity === identity;
  const error = failure?.identity === identity ? failure.message : null;
  const isInitialLoading = !isReady && error === null;
  const isRefreshing = isReady && fetching === identity;

  return {
    data: isReady ? result.data : null,
    isReady,
    isInitialLoading,
    isRefreshing,
    error,
    errorAnnounced: failure?.identity === identity && failure.announced,
    refetch,
    setData,
    /** True while `refetch` has a request in flight for this identity. */
    isLoading: isInitialLoading || isRefreshing,
  };
}
