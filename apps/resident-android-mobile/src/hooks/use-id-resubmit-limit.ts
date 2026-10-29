import { useCallback, useEffect, useState } from 'react';

import { idResubmitDeadline, idResubmitLimit, idResubmitWaitMs, type IdSubmissionHistoryRow } from '@/lib/id-resubmit-limit';
import { supabase } from '@/lib/supabase';

/** Time left before the resident may submit another ID, from their own submission history
 * so it follows the account across devices and reinstalls. `status` reloads the history
 * when staff decide. A submission made in this session starts the hourly window at once,
 * until the next load includes it. A resident with no submission has no limit. The timer
 * wakes at most once a minute and stops at the deadline. */
export function useIdResubmitLimit(userId: string | null, submissionId: string | null | undefined, status: string | null | undefined) {
  const enabled = !!userId && !!submissionId;
  const [loaded, setLoaded] = useState<{ deadline: number; rejectionLock: boolean; failed: boolean } | null>(null);
  const [submittedDeadline, setSubmittedDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !userId) return;
    let active = true;
    supabase.from('id_submissions').select('version, decision, submitted_at, reviewed_at').eq('resident_id', userId).order('version', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        const at = Date.now();
        setNow(at);
        if (!error) setSubmittedDeadline(0);
        setLoaded(error || !data ? { deadline: 0, rejectionLock: false, failed: true } : { ...idResubmitLimit(data as IdSubmissionHistoryRow[], at), failed: false });
      });
    return () => { active = false; };
  }, [enabled, userId, submissionId, status, attempt]);

  const current = enabled ? loaded : null;
  const deadline = Math.max(current?.deadline ?? 0, submittedDeadline);

  useEffect(() => {
    if (deadline <= now) return;
    const timer = setTimeout(() => setNow(Date.now()), (deadline - now) % 60_000 || 60_000);
    return () => clearTimeout(timer);
  }, [deadline, now]);

  const markSubmitted = useCallback(() => {
    const at = Date.now();
    setNow(at);
    setSubmittedDeadline(idResubmitDeadline(at, at));
    setAttempt(count => count + 1);
  }, []);
  const retry = useCallback(() => { setLoaded(null); setAttempt(count => count + 1); }, []);
  /** Checked at press time so a stale render cannot let a second submission through. */
  const blocked = useCallback(() => idResubmitWaitMs(deadline) > 0, [deadline]);

  return {
    waitMs: idResubmitWaitMs(deadline, now),
    rejectionLock: (current?.rejectionLock ?? false) && submittedDeadline === 0,
    loading: enabled && current === null,
    failed: current?.failed ?? false,
    markSubmitted, retry, blocked,
  };
}
