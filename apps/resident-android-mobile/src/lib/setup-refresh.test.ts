import { describe, expect, it } from 'vitest';
import { residentSetupFailure, type ResidentSetupLoad } from '@barangayan/shared';
import { isBackgroundRefresh, refreshFailureOutcome, safeReadRetryDelay } from './setup-refresh';

const ready: ResidentSetupLoad = { state: 'ready', status: { registrationOrigin: 'google', profileComplete: false, passwordSet: false, hasGoogleIdentity: true } };

describe('background setup-status refresh (Settings stays mounted)', () => {
  it('only a ready status for the same user refreshes in the background', () => {
    expect(isBackgroundRefresh({ uid: 'a', value: ready }, 'a')).toBe(true);
    expect(isBackgroundRefresh({ uid: 'b', value: ready }, 'a')).toBe(false);
    expect(isBackgroundRefresh({ uid: 'a', value: { state: 'loading' } }, 'a')).toBe(false);
    expect(isBackgroundRefresh({ uid: 'a', value: { state: 'error', failure: residentSetupFailure({ name: 'AbortError' }) } }, 'a')).toBe(false);
    expect(isBackgroundRefresh(null, 'a')).toBe(false);
  });

  it('keeps the confirmed status on a transient failure and reports a retryable refresh error', () => {
    for (const cause of [{ name: 'AbortError' }, { code: 'PGRST000' }, { status: 429 }, {}]) {
      const failure = residentSetupFailure(cause);
      expect(refreshFailureOutcome(true, failure)).toEqual({ type: 'keep_status', message: failure.message });
    }
  });

  it('deleted/forbidden or expired sessions never keep earlier access, and a first load never invents one', () => {
    expect(refreshFailureOutcome(true, residentSetupFailure({ code: '42501' }))).toEqual({ type: 'replace_with_error' });
    expect(refreshFailureOutcome(true, residentSetupFailure({ code: 'session_not_found' }))).toEqual({ type: 'replace_with_error' });
    expect(refreshFailureOutcome(false, residentSetupFailure({ name: 'AbortError' }))).toEqual({ type: 'replace_with_error' });
  });
});
describe('safe account reads retry with bounded backoff', () => {
  it('retries twice with increasing delays, then stops', () => {
    expect(safeReadRetryDelay(0)).toBe(1000);
    expect(safeReadRetryDelay(1)).toBe(3000);
    expect(safeReadRetryDelay(2)).toBeNull();
    expect(safeReadRetryDelay(5)).toBeNull();
  });
});
