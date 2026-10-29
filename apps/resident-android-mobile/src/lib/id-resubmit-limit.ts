/** Mirrors publish_id_submission: replacing a pending or verified ID is limited to one
 * per hour. After staff reject, retries are immediate, and the third rejection in a
 * row locks submissions for an hour from the staff decision. The count carries on, so
 * every further third rejection locks again. The first submission is never delayed. */
export const ID_RESUBMIT_WINDOW_MS = 60 * 60_000;
export const ID_REJECTIONS_BEFORE_LOCK = 3;
export const ID_RESUBMIT_BLOCKED_MESSAGE = 'You have reached the ID submission limit. Please try again later.';

export type IdSubmissionHistoryRow = { version: number; decision: string; submitted_at: string; reviewed_at: string | null };

const isRejected = (decision: string) => decision === 'verification_failed' || decision === 'revoked';

/** Absolute time the next submission becomes allowed, or 0 when none is pending.
 * Never later than one window from `now`, so a skewed device clock cannot hold a
 * resident past the ceiling. The server stays the authority. */
export function idResubmitDeadline(since: string | number | null | undefined, now = Date.now()) {
  if (since === null || since === undefined) return 0;
  const start = typeof since === 'number' ? since : Date.parse(since);
  if (!Number.isFinite(start)) return 0;
  const deadline = Math.min(start + ID_RESUBMIT_WINDOW_MS, now + ID_RESUBMIT_WINDOW_MS);
  return deadline > now ? deadline : 0;
}

export function idResubmitLimit(rows: readonly IdSubmissionHistoryRow[], now = Date.now()) {
  const latest = rows.reduce<IdSubmissionHistoryRow | null>((best, row) => (!best || row.version > best.version ? row : best), null);
  if (!latest) return { deadline: 0, rejectionLock: false };
  if (!isRejected(latest.decision)) return { deadline: idResubmitDeadline(latest.submitted_at, now), rejectionLock: false };
  const lastOpen = rows.reduce((highest, row) => (isRejected(row.decision) ? highest : Math.max(highest, row.version)), 0);
  const rejections = rows.filter(row => isRejected(row.decision) && row.version > lastOpen).length;
  if (rejections % ID_REJECTIONS_BEFORE_LOCK !== 0) return { deadline: 0, rejectionLock: false };
  const deadline = idResubmitDeadline(latest.reviewed_at ?? latest.submitted_at, now);
  return { deadline, rejectionLock: deadline > 0 };
}

export function idResubmitWaitMs(deadline: number, now = Date.now()) {
  return Math.max(0, deadline - now);
}

export function idResubmitWaitLabel(waitMs: number) {
  const minutes = Math.ceil(waitMs / 60_000);
  if (minutes <= 1) return 'less than a minute';
  return `${minutes} minutes`;
}
