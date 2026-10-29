import { describe, expect, it } from 'vitest';
import { ID_RESUBMIT_WINDOW_MS, idResubmitDeadline, idResubmitLimit, idResubmitWaitLabel, idResubmitWaitMs, type IdSubmissionHistoryRow } from './id-resubmit-limit';

const now = Date.parse('2026-10-28T10:00:00Z');
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const row = (version: number, decision: string, submittedMinutesAgo: number, reviewedMinutesAgo: number | null = null): IdSubmissionHistoryRow =>
  ({ version, decision, submitted_at: minutesAgo(submittedMinutesAgo), reviewed_at: reviewedMinutesAgo === null ? null : minutesAgo(reviewedMinutesAgo) });
const rejected = (version: number, reviewedMinutesAgo: number) => row(version, 'verification_failed', reviewedMinutesAgo + 5, reviewedMinutesAgo);

describe('single timestamp deadline', () => {
  it('never delays a missing or unreadable timestamp', () => {
    for (const value of [null, undefined, '', 'not a date']) expect(idResubmitDeadline(value, now)).toBe(0);
  });
  it('blocks for one hour and then clears', () => {
    const deadline = idResubmitDeadline(minutesAgo(20), now);
    expect(idResubmitWaitMs(deadline, now)).toBe(40 * 60_000);
    expect(idResubmitDeadline(minutesAgo(60), now)).toBe(0);
    expect(idResubmitWaitMs(deadline, now + 41 * 60_000)).toBe(0);
  });
  it('accepts a device-clock time and caps a future server time at one window', () => {
    expect(idResubmitWaitMs(idResubmitDeadline(now, now), now)).toBe(ID_RESUBMIT_WINDOW_MS);
    expect(idResubmitWaitMs(idResubmitDeadline(new Date(now + 5 * 3_600_000).toISOString(), now), now)).toBe(ID_RESUBMIT_WINDOW_MS);
  });
});

describe('submission history limit', () => {
  it('has no limit before the first submission', () => {
    expect(idResubmitLimit([], now)).toEqual({ deadline: 0, rejectionLock: false });
  });

  it('limits replacing a pending or verified ID to one per hour', () => {
    for (const decision of ['pending', 'verified']) {
      const { deadline, rejectionLock } = idResubmitLimit([row(1, decision, 20)], now);
      expect(idResubmitWaitMs(deadline, now)).toBe(40 * 60_000);
      expect(rejectionLock).toBe(false);
      expect(idResubmitLimit([row(1, decision, 61)], now).deadline).toBe(0);
    }
  });

  it('lets a resident retry at once after the first and second rejection', () => {
    expect(idResubmitLimit([rejected(1, 1)], now)).toEqual({ deadline: 0, rejectionLock: false });
    expect(idResubmitLimit([rejected(1, 10), rejected(2, 1)], now)).toEqual({ deadline: 0, rejectionLock: false });
  });

  it('locks for an hour from the staff decision after the third rejection', () => {
    const rows = [rejected(1, 30), rejected(2, 20), rejected(3, 10)];
    const { deadline, rejectionLock } = idResubmitLimit(rows, now);
    expect(rejectionLock).toBe(true);
    expect(idResubmitWaitMs(deadline, now)).toBe(50 * 60_000);
    expect(idResubmitLimit([rejected(1, 130), rejected(2, 120), rejected(3, 61)], now)).toEqual({ deadline: 0, rejectionLock: false });
  });

  it('counts a revoked approval as a rejection', () => {
    const rows = [rejected(1, 30), rejected(2, 20), row(3, 'revoked', 15, 10)];
    expect(idResubmitLimit(rows, now).rejectionLock).toBe(true);
  });

  it('carries on: retries are free again after the lock and the sixth rejection locks again', () => {
    const afterFirstLock = [rejected(1, 300), rejected(2, 290), rejected(3, 280), rejected(4, 1)];
    expect(idResubmitLimit(afterFirstLock, now)).toEqual({ deadline: 0, rejectionLock: false });
    const sixth = [...afterFirstLock.slice(0, 3), rejected(4, 100), rejected(5, 50), rejected(6, 10)];
    expect(idResubmitLimit(sixth, now).rejectionLock).toBe(true);
  });

  it('does not count rejections from before an approved or still-pending version', () => {
    const rows = [rejected(1, 300), rejected(2, 290), row(3, 'verified', 250, 240), rejected(4, 5)];
    expect(idResubmitLimit(rows, now)).toEqual({ deadline: 0, rejectionLock: false });
    const superseded = [rejected(1, 300), row(2, 'pending', 290), rejected(3, 5)];
    expect(idResubmitLimit(superseded, now)).toEqual({ deadline: 0, rejectionLock: false });
  });

  it('is independent of row order', () => {
    const rows = [rejected(3, 10), rejected(1, 30), rejected(2, 20)];
    expect(idResubmitLimit(rows, now).rejectionLock).toBe(true);
  });
});

describe('wait label', () => {
  it('shows whole minutes', () => {
    expect(idResubmitWaitLabel(40 * 60_000)).toBe('40 minutes');
    expect(idResubmitWaitLabel(40 * 60_000 - 1)).toBe('40 minutes');
    expect(idResubmitWaitLabel(2 * 60_000 - 1)).toBe('2 minutes');
    expect(idResubmitWaitLabel(60_000)).toBe('less than a minute');
    expect(idResubmitWaitLabel(1)).toBe('less than a minute');
  });
});
