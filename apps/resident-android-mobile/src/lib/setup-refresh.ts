import type { ResidentSetupFailure, ResidentSetupLoad } from '@barangayan/shared';

export type OwnedSetup = { uid: string; value: ResidentSetupLoad } | null;

/** A refresh over this user's earlier server-confirmed status keeps it while
 * reloading, so a transient loading state cannot unmount Settings. */
export function isBackgroundRefresh(previous: OwnedSetup, uid: string) {
  return previous?.uid === uid && previous.value.state === 'ready';
}

/** A failed background read keeps the confirmed status and reports a retryable
 * refresh error. Deleted/forbidden or expired sessions never keep earlier access. */
export function refreshFailureOutcome(background: boolean, failure: ResidentSetupFailure):
  { type: 'keep_status'; message: string } | { type: 'replace_with_error' } {
  if (background && failure.kind !== 'forbidden' && failure.kind !== 'session_expired') return { type: 'keep_status', message: failure.message };
  return { type: 'replace_with_error' };
}

/** Bounded backoff for safe account reads such as the profile. Production can reject the
 * first request of a just-issued session (observed HTTP 401 right after a Google exchange),
 * so a read retries twice before reporting a refresh error. */
const SAFE_READ_RETRY_DELAYS_MS = [1000, 3000];
export function safeReadRetryDelay(attempt: number): number | null {
  return SAFE_READ_RETRY_DELAYS_MS[attempt] ?? null;
}
