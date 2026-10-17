'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Clock3, TriangleAlert } from 'lucide-react';
import { idVerificationState, type Tables } from '@barangayan/shared';
import { Button } from '@/components/ui/button';
import { InlineReadError } from '@/components/shared/inline-read-error';
import { LoadingStatus } from '@/components/shared/loading-status';
import { useSettingsIdStatus } from '../settings-id-status';
import { scrollSettingsContentToTop } from '../settings-content';
import { detailFields, detailLabels } from './draft';
import { abortable, createIdClient } from './transport';

type Evidence = Pick<Tables<'id_submissions'>, 'id_type' | 'front_path' | 'confirmed_details'>;
type Result = { evidence: Evidence; photoUrl: string | null } | { error: true };

export function SavedId({ userId, submissionId, lastSubmittedId, onReplace }: { userId: string; submissionId: string; lastSubmittedId: string | null; onReplace: () => void }) {
  const status = useSettingsIdStatus();
  const { isOwner } = status;
  const state = idVerificationState(status.profile);
  const verified = !status.loading && !status.error && state === 'verified';
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [photoFailed, setPhotoFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    scrollSettingsContentToTop(heading.current);
  }, [submissionId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let mounted = true;
    const current = () => mounted && isOwner(userId);
    void (async () => {
      try {
        const client = createIdClient(controller.signal);
        const { data: { user }, error: authError } = await abortable(client.auth.getUser(), controller.signal);
        if (authError || !user || user.is_anonymous || user.id !== userId || !current()) throw new Error('session');
        const { data, error } = await abortable(client.from('id_submissions')
          .select('id_type, front_path, confirmed_details').eq('id', submissionId).eq('resident_id', userId).maybeSingle(), controller.signal);
        if (error || !data) throw new Error('read');
        // Only sign the owned photo associated with this saved submission.
        let photoUrl: string | null = null;
        if (data.front_path.startsWith(`${userId}/`)) {
          try {
            const photo = await abortable(client.storage.from('id-documents').createSignedUrl(data.front_path, 600), controller.signal);
            if (!photo.error) photoUrl = photo.data.signedUrl;
          } catch { /* Keep the saved details available when the photo cannot load. */ }
        }
        if (current()) setResult({ evidence: data, photoUrl });
      } catch {
        if (current()) setResult({ error: true });
      } finally { clearTimeout(timer); }
    })();
    return () => { mounted = false; controller.abort(); clearTimeout(timer); };
  }, [userId, submissionId, isOwner, attempt]);

  function retry() { setResult(null); setPhotoFailed(false); setAttempt(previous => previous + 1); }

  return <div className="mx-auto max-w-2xl space-y-6 px-4 py-5 sm:px-6 sm:py-8">
    <div>
      <h1 ref={heading} tabIndex={-1} className="scroll-mt-6 text-2xl font-bold tracking-tight outline-none">{verified ? 'Valid ID' : 'ID submitted'}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{verified ? 'View your verified ID and the details saved with it.' : 'View your submitted ID and the details saved with it.'}</p>
    </div>
    {status.loading ? <LoadingStatus active label="Checking verification status…" /> : status.error ?
      <InlineReadError message={lastSubmittedId ? 'Your ID was submitted. Verification status is temporarily unavailable.' : status.error} onRetry={() => void status.refresh()} /> : verified ? <div role="status" className="rounded-xl border border-emerald-600/25 bg-emerald-600/10 p-4">
      <div><p className="font-semibold">Your valid ID has been verified</p><p className="mt-1 text-sm text-muted-foreground">You can use this ID for service requests.</p></div>
    </div> : <div role={lastSubmittedId === submissionId && (state === 'pending' || state === 'missing') ? undefined : 'status'} className="flex items-start gap-3 rounded-xl border border-status-warning/40 bg-status-warning/10 p-4">
      {state === 'pending' ? <Clock3 aria-hidden className="mt-0.5 size-5 shrink-0 text-status-warning" /> : <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-status-warning" />}
      <div><p className="font-semibold">{state === 'pending' ? 'Valid ID is pending verification' : state === 'failed' ? 'Your current ID needs attention.' : 'Verification status needs to be checked'}</p>
        <p className="mt-1 text-sm text-muted-foreground">{state === 'pending' ? 'Your ID has been submitted for staff review. You can use it for service requests once it has been verified.' : state === 'failed' ? 'Review the reason below and submit a replacement for staff review.' : 'Your ID was submitted. Check with your barangay for its current verification status.'}</p>
        {status.reason ? <p className="mt-2 whitespace-pre-wrap break-words text-sm">Reason: {status.reason}</p> : null}
      </div>
    </div>}
    {!status.loading && !status.error && lastSubmittedId && lastSubmittedId !== submissionId ? <p role="status" className="text-sm">A newer ID submission is now current. The verification status above applies to that submission.</p> : null}
    {!result ? <LoadingStatus active label={verified ? 'Loading your verified ID…' : 'Loading your submitted ID…'} /> : 'error' in result ?
      <InlineReadError message={verified ? 'Your ID is verified, but its saved details and photo could not be loaded.' : 'Your submitted ID details and photo could not be loaded.'} onRetry={retry} /> : <>
        <section aria-labelledby="verified-id-details" className="rounded-2xl border border-border p-5 sm:p-6">
          <h2 id="verified-id-details" className="font-semibold">ID details</h2>
          <dl className="mt-5 grid min-w-0 gap-5 sm:grid-cols-2">
            <div className="min-w-0"><dt className="text-sm text-muted-foreground">ID type</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">{result.evidence.id_type}</dd></div>
            {detailFields.map(field => <div key={field} className={field === 'address' ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
              <dt className="text-sm text-muted-foreground">{detailLabels[field]}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">{result.evidence.confirmed_details?.[field] || (result.evidence.confirmed_details ? 'Not shown on ID' : 'Not recorded')}</dd>
            </div>)}
          </dl>
        </section>
        <section aria-labelledby="verified-id-photo" className="space-y-3">
          <h2 id="verified-id-photo" className="font-semibold">ID photo</h2>
          {result.photoUrl && !photoFailed ? <Image unoptimized src={result.photoUrl} alt={verified ? 'Front of your verified valid ID' : 'Front of your submitted valid ID'} width={800} height={500} referrerPolicy="no-referrer" onError={() => setPhotoFailed(true)} className="max-h-96 w-full rounded-xl border border-border bg-muted/30 object-contain" /> :
            <InlineReadError message={verified ? 'Your ID photo could not be loaded. Your ID is still verified.' : 'Your submitted ID photo could not be loaded.'} onRetry={retry} />}
        </section>
      </>}
    {!status.loading && !status.error && status.access ? <div className="space-y-3 border-t border-border pt-5">
      <p className="text-sm leading-6 text-muted-foreground">{verified ? 'If you need to replace this ID, your new submission will require staff verification before it can be used for service requests.' : 'If you need to correct this submission, you can submit a replacement ID for staff review.'}</p>
      <Button variant="outline" onClick={onReplace}>Submit a replacement ID</Button>
    </div> : null}
  </div>;
}
