'use client';

import { useEffect, useState } from 'react';
import { loadRequestReview } from '@/actions/request-review-actions';
import { RequestReview } from './request-review';

type ReviewData = NonNullable<Awaited<ReturnType<typeof loadRequestReview>>>;

export function RequestRecordReview({ requestId, onChanged }: { requestId: string; onChanged: () => void }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void loadRequestReview(requestId).then(result => {
      if (!active) return;
      if (!result) { setError('This request is unavailable or your access changed.'); return; }
      setData(result);
    }).catch(() => {
      if (active) setError('Could not load request review. Please retry.');
    });
    return () => { active = false; };
  }, [requestId, revision]);
  function reload() {
    setData(null);
    setError('');
    setRevision(value => value + 1);
  }
  if (error) return <div role="alert" className="my-4 text-sm"><p>{error}</p><button type="button" className="mt-2 text-[var(--accent)] underline" onClick={reload}>Retry request review</button></div>;
  if (!data) return <p role="status" className="my-4 text-sm">Loading request review…</p>;
  return <RequestReview key={revision} data={data} embedded onChanged={() => { reload(); onChanged(); }} />;
}
