'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, FileCheck2, Pencil, X } from 'lucide-react';
import { serviceFoundationOperations, type IdSubmissionRow, type IdVerificationStatus } from '@barangayan/shared';
import { logAdminAction } from '@/actions/admin-audit-actions';
import { AdminSelect } from '@/components/admin/dropdown/admin-select';
import { TableDetailDialog } from '@/components/admin/table-detail-dialog';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { useToast } from '@/components/ui/toast';
import { formatAdminTimestamp } from '@/lib/admin-tables/pilot-config';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import styles from '@/components/admin/resident-record.module.css';
import type { ResidentRow } from './types';

export function idStatusLabel(status: IdVerificationStatus | null) {
  return status === 'verified' ? 'Verified ID' : status === 'pending' ? 'Pending Verification'
    : status === 'verification_failed' ? 'Verification Failed, Try Again' : 'No ID';
}

type Props = {
  resident: ResidentRow;
  sectionId?: string;
  onStatusChange?: (id: string, status: IdVerificationStatus | null) => void;
  onBusyChange?: (busy: boolean) => void;
};

/** Both entry points review the current evidence version through the same RPC. */
export function ResidentIdReview({ resident, sectionId, onStatusChange, onBusyChange }: Props) {
  const generatedId = useId();
  const prefix = sectionId ?? generatedId;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const toast = useToast();
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [evidence, setEvidence] = useState<IdSubmissionRow | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [status, setStatus] = useState(resident.id_verification_status);
  const [repairRequired, setRepairRequired] = useState(resident.id_repair_required);
  const [nextStatus, setNextStatus] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const loadKey = `${resident.id}:${resident.current_id_submission_id}:${revision}`;
  const [previousLoadKey, setPreviousLoadKey] = useState(loadKey);
  // Clear old evidence before rendering a new version or retry, not after paint.
  if (previousLoadKey !== loadKey) {
    setPreviousLoadKey(loadKey);
    setLoading(true); setError(null); setPhotoError(false); setEvidence(null); setUrls([]); setNextStatus(''); setReason('');
  }

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let current = true;
    void (async () => {
      try {
        // Refresh first: a resident may have submitted a new ID since this row loaded.
        const profile = await supabase.from('profiles')
          .select('id_verification_status,current_id_submission_id,id_repair_required')
          .eq('id', resident.id).is('deleted_at', null).retry(false).abortSignal(controller.signal).maybeSingle();
        if (profile.error || !profile.data) throw new Error('Could not load current ID status. Please retry.');
        if (!current) return;
        const currentStatus = profile.data.id_verification_status;
        if (currentStatus !== null && currentStatus !== 'pending' && currentStatus !== 'verified' && currentStatus !== 'verification_failed') {
          throw new Error('Could not load a valid ID status. Please retry.');
        }
        setStatus(currentStatus); setRepairRequired(profile.data.id_repair_required);
        if (!profile.data.current_id_submission_id) return;
        const result = await supabase.from('id_submissions').select('*').eq('id', profile.data.current_id_submission_id)
          .eq('resident_id', resident.id).retry(false).abortSignal(controller.signal).maybeSingle();
        if (result.error || !result.data) throw new Error('Could not load current ID evidence. Please retry.');
        if (!current) return;
        setEvidence(result.data);
        const paths = [result.data.front_path, result.data.back_path].filter((path): path is string => !!path);
        const photos = await supabase.storage.from('id-documents').createSignedUrls(paths, 600);
        if (!current) return;
        const signed = (photos.data ?? []).map(photo => photo.signedUrl).filter((url): url is string => !!url);
        setUrls(signed);
        setPhotoError(!!photos.error || !paths.length || signed.length !== paths.length);
      } catch (cause) {
        if (current) setError(cause instanceof Error ? cause.message : 'Could not load ID evidence. Please retry.');
      } finally {
        clearTimeout(timeout);
        if (current) setLoading(false);
      }
    })();
    return () => { current = false; clearTimeout(timeout); controller.abort(); };
  }, [resident.id, resident.current_id_submission_id, revision, supabase]);

  const pending = evidence?.decision === 'pending';
  const verified = evidence?.decision === 'verified';
  const canReview = pending || verified;
  const requiresReason = nextStatus === 'verification_failed';
  const photosReady = !!evidence?.front_path && !photoError && urls.length === (evidence.back_path ? 2 : 1);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || loading || error || !evidence || !canReview
      || !['verified', 'verification_failed'].includes(nextStatus)
      || (verified && nextStatus !== 'verification_failed')
      || (requiresReason && !reason.trim()) || (pending && !photosReady)) return;
    busy.current = true; setSaving(true); onBusyChange?.(true); setError(null);
    const decision = verified ? 'revoked' : nextStatus as 'verified' | 'verification_failed';
    try {
      const result = await serviceFoundationOperations(supabase).reviewId({ submissionId: evidence.id, decision,
        ...(reason.trim() ? { reason: reason.trim() } : {}) });
      if (result.error) throw new Error(result.error.message === 'stale_or_repeated_ID_review'
        ? 'This ID submission changed or was already reviewed. Reload the ID before trying again.' : result.error.message);
      if (result.data !== evidence.id) throw new Error('The ID update could not be confirmed. Reload the ID before trying again.');
      const actualStatus = decision === 'verified' ? 'verified' : 'verification_failed';
      setStatus(actualStatus); setNextStatus(''); setReason('');
      setEvidence({ ...evidence, decision });
      void logAdminAction({ action: 'status_change', entityType: 'resident', entityId: resident.id, entityLabel: resident.full_name,
        metadata: { previousStatus: status, nextStatus: actualStatus, submissionId: evidence.id, decision } }).catch(() => {});
      onStatusChange?.(resident.id, actualStatus);
      toast.showSuccess(decision === 'verified' ? `${resident.full_name}'s ID has been verified.`
        : decision === 'revoked' ? `${resident.full_name}'s ID approval was revoked. Status: Verification Failed, Try Again.`
          : `${resident.full_name}'s ID was marked as verification failed.`);
      setRevision(value => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update ID status. Please reload and try again.');
    } finally {
      busy.current = false; setSaving(false); onBusyChange?.(false);
    }
  }

  return <>
    <section id={`${prefix}-verification`} className={styles.section} aria-busy={loading || saving}>
      <h3 className={styles.sectionHeading}><FileCheck2 size={16} aria-hidden="true" />ID verification <span>Admin review</span></h3>
      <p className="mb-3"><span className={styles.badge}>Current: {idStatusLabel(status)}</span></p>
      {loading && <p role="status">Loading current ID…</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" disabled={saving} className={styles.reviewAction} onClick={() => setRevision(value => value + 1)}>Reload ID</button></div>}
      {!loading && !error && <>
        {repairRequired && <p className={styles.notice}>Evidence repair required. Ask the resident to upload a new ID before approval.</p>}
        {evidence ? <>
          <p className="mb-3 text-sm">Submission version {evidence.version} · {evidence.id_type} · {evidence.evidence_origin.startsWith('legacy_') ? 'Imported legacy evidence; original submission/review provenance unavailable' : `Submitted ${formatAdminTimestamp(evidence.submitted_at)}`}{evidence.reviewed_at ? ` · Decision ${formatAdminTimestamp(evidence.reviewed_at)} · Reviewer ${evidence.reviewed_by}` : ''}</p>
          {evidence.rejection_reason && <p className="mb-3 text-sm">Decision reason: {evidence.rejection_reason}</p>}
          {evidence.confirmed_details && <dl className="mb-3 space-y-1 text-sm">
            {Object.entries(evidence.confirmed_details).map(([key, value]) => <div key={key}><dt className="inline font-medium">{({ fullName: 'Full name', idNumber: 'ID number', birthDate: 'Birth date', address: 'Address' } as Record<string, string>)[key]}: </dt><dd className="inline">{value || 'Not shown on ID'}</dd></div>)}
          </dl>}
          {canReview ? <form className="grid gap-3" onSubmit={event => void save(event)}>
            <label htmlFor={`${prefix}-status`} className="mb-3 block text-sm">Update ID status</label>
            <AdminSelect id={`${prefix}-status`} kind="id" aria-label="Update ID status" value={nextStatus} disabled={saving}
              onValueChange={setNextStatus} options={[
                { value: '', label: 'Choose a new status' },
                ...(pending ? [{ value: 'verified', label: 'Verified ID' }] : []),
                { value: 'verification_failed', label: verified ? 'Verification Failed (revoke approval)' : 'Verification Failed, Try Again' },
              ]} />
            {requiresReason && <label className="my-3 block text-sm">{verified ? 'Reason for revocation' : 'Reason for rejection'}
              <textarea className={styles.reviewReason} value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} required disabled={saving} />
            </label>}
            <button type="submit" className={`${styles.reviewAction} justify-self-start`} disabled={saving || !nextStatus || (requiresReason && !reason.trim()) || (pending && !photosReady)}>
              <LoadingButtonContent pending={saving} pendingLabel="Updating ID status…">Save ID status</LoadingButtonContent>
            </button>
          </form> : <p className={styles.hint}>This submission has already been reviewed. The resident must upload a new ID for another review.</p>}
        </> : <p className={styles.hint}>No current ID submission. Ask the resident to upload an ID before updating its status.</p>}
      </>}
    </section>
    <section id={`${prefix}-documents`} className={styles.section}>
      <h3 className={styles.sectionHeading}><FileCheck2 size={16} aria-hidden="true" />ID documents <span>{urls.length}</span></h3>
      {photoError && <p role="alert">Could not load all ID photos. <button type="button" className={styles.reviewAction} disabled={saving} onClick={() => setRevision(value => value + 1)}>Reload ID photos</button></p>}
      {!loading && !error && !evidence && <p className={styles.empty}>No ID documents uploaded.</p>}
      <div className={styles.documents}>{urls.map((url, index) => <a key={`${evidence?.id}:${index}`} href={url} target="_blank" rel="noreferrer" className={styles.document}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`ID document ${index + 1}`} className={styles.documentImage} />
        <span>ID document {index + 1}<span>Open full size <ArrowUpRight size={13} aria-hidden="true" /></span></span>
      </a>)}</div>
    </section>
  </>;
}

export function ResidentIdStatusCell({ resident, onStatusChange }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const color = resident.id_verification_status === 'verified' ? 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30'
    : resident.id_verification_status === 'pending' ? 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30'
      : resident.id_verification_status === 'verification_failed' ? 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30'
        : 'text-zinc-500 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-800';
  return <div onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
    <button type="button" aria-label={`Update ID status for ${resident.full_name}`} onClick={() => setOpen(true)}
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${color}`}>
      <span className="truncate">{resident.id_repair_required ? 'Evidence repair required' : idStatusLabel(resident.id_verification_status)}</span><Pencil size={12} className="shrink-0" aria-hidden="true" />
    </button>
    {open && <TableDetailDialog label={`Update ID status for ${resident.full_name}`} onClose={() => setOpen(false)} preventClose={saving}>
      <div className="max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-5 text-left text-sm whitespace-normal dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-semibold">{resident.full_name} — ID status</h2>
          <button type="button" aria-label="Close ID review" disabled={saving} onClick={() => setOpen(false)}><X size={20} /></button></div>
        <ResidentIdReview resident={resident} onStatusChange={onStatusChange} onBusyChange={setSaving} />
      </div>
    </TableDetailDialog>}
  </div>;
}
