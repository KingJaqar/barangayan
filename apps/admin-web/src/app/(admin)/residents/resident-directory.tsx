'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import { RecordArchiveLink, useRecordWorkspace } from '@/components/admin/record-workspace';

import {
  EMPLOYMENT_STATUSES,
  SEXES,
  serviceFoundationOperations,
  type IdSubmissionRow,
  type Database,
  type EmploymentStatus,
  type IdVerificationStatus,
  type Sex,
} from '@barangayan/shared';
import { useEffect, useMemo, useState } from 'react';

import { ProfileTableSummary } from '@/components/admin/profile-table-summary';
import { ProfileTablePanel } from '@/components/admin/profile-table-panel';
import { SegmentedFilter } from '@/components/admin/segmented-filter';
import { useConfiguredTableBrowse } from '@/hooks/use-pilot-table-browse';
import { formatAdminTimestamp } from '@/lib/admin-tables/pilot-config';
import { PROFILE_TABLE_CONFIGS } from '@/lib/admin-tables/profile-config';
import type { BrowseResult, BrowseState } from '@/lib/admin-tables/browse-state';
import type { QueryOutcome, Summary } from '@/lib/admin-tables/queries/browse';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { StatusPill } from '@/components/admin/status-pill';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { ResidentRow } from './types';
import { TABS } from './types';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { Spinner } from '@/components/loading/spinner';
import { formContainerClass, inputClass, submitButtonClass, cancelButtonClass } from '@/components/admin/form-styles';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

type ServiceRequest = {
  id: string;
  reference_number: string;
  status: string;
  created_at: string;
  document_types: { name: string } | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function verificationColor(status: string) {
  if (status === 'verified') return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30';
  if (status === 'pending') return 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30';
  if (status === 'unverified') return 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30';
  return 'text-zinc-600 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800';
}

function idVerifColor(status: IdVerificationStatus | null) {
  if (status === 'verified') return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30';
  if (status === 'pending') return 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30';
  if (status === 'verification_failed') return 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30';
  return 'text-zinc-400 bg-zinc-100 dark:text-zinc-500 dark:bg-zinc-800';
}

function idVerifLabel(status: IdVerificationStatus | null) {
  if (status === 'verified') return 'Verified ID';
  if (status === 'pending') return 'Pending Verification';
  if (status === 'verification_failed') return 'Verification Failed, Try Again';
  return 'No ID';
}

// ─── Add Resident Form ─────────────────────────────────────────────────────────

function AddResidentForm({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobile] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/admin/residents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), fullName: fullName.trim(), mobileNumber, homeAddress }),
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      toast.showError(`Failed to add resident: ${body.error ?? 'Unknown error'}`);
      return;
    }

    toast.showSuccess(`Invite sent to ${email.trim()}.`);
    setEmail('');
    setFullName('');
    setMobile('');
    setHomeAddress('');
    onClose();
    onCreated();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`${formContainerClass} grid-cols-1 sm:grid-cols-2`}
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium">Email *</span>
        <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Full Name *</span>
        <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Mobile Number</span>
        <input className={inputClass} value={mobileNumber} onChange={(e) => setMobile(e.target.value)} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Home Address</span>
        <input className={inputClass} value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} />
      </label>
      <p className="col-span-1 text-xs text-zinc-500 sm:col-span-2">
        The resident receives an email invite to set their own password — no password is ever stored here.
      </p>
      <div className="col-span-1 flex items-center gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={submitting || !email.trim() || !fullName.trim()}
          className={submitButtonClass}
          aria-busy={submitting}>
          <LoadingButtonContent pending={submitting} pendingLabel="Sending invite…">Send Invite</LoadingButtonContent>
        </button>
        <button type="button" onClick={onClose} className={cancelButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Resident Detail Modal ─────────────────────────────────────────────────────

export function ResidentDetailContent({
  resident,
  onClose,
  onIdStatusChange,
}: {
  resident: ResidentRow | null;
  onClose: () => void;
  onIdStatusChange?: (id: string, status: IdVerificationStatus | null) => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const toast = useToast();
  const [requests, setRequests] = useState<ServiceRequest[] | null>(null);
  const [idUrls, setIdUrls] = useState<string[]>([]);
  const [idStatus, setIdStatus] = useState(resident?.id_verification_status ?? null);
  const [idStatusLoading, setIdStatusLoading] = useState(false);
  const [evidence, setEvidence] = useState<IdSubmissionRow | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewingId, setReviewingId] = useState(false);

  // Reset the panel's per-resident state the moment a different resident (or none) is
  // selected, so the previous resident's requests/photos never flash in the new panel.
  // Adjusting state during render is React's recommended way to do this.
  const [prevResidentId, setPrevResidentId] = useState(resident?.id ?? null);
  if (prevResidentId !== (resident?.id ?? null)) {
    setPrevResidentId(resident?.id ?? null);
    setRequests(null);
    setIdUrls([]);
    setIdStatus(resident?.id_verification_status ?? null);
    setEvidence(null); setReviewReason('');
  }

  useEffect(() => {
    if (!resident) return;
    let cancelled = false;

    // Service request history
    supabase
      .from('service_requests')
      .select('id, reference_number, status, created_at, document_types(name)')
      .eq('resident_id', resident.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (!cancelled) setRequests((data as unknown as ServiceRequest[]) ?? []); });

    // Resolve short-lived signed URLs for ID photos — id-documents is a
    // private bucket (government ID photos); getPublicUrl() would silently
    // return a broken URL, and a public bucket would rely on obscurity alone.
    // The render-time reset above already cleared idUrls, so there is nothing to do when
    // this resident has no ID photos on file.
    async function loadEvidence() {
      const { data: row } = resident?.current_id_submission_id
        ? await supabase.from('id_submissions').select('*').eq('id', resident.current_id_submission_id).single()
        : { data: null };
      if (cancelled) return;
      setEvidence(row); setIdUrls([]);
      if (!row) return;
      const { data, error } = await supabase.storage.from('id-documents').createSignedUrls([row.front_path, row.back_path].filter((path): path is string => !!path), 600);
      if (!cancelled && !error && data) setIdUrls(data.map(d => d.signedUrl).filter((u): u is string => !!u));
    }
    loadEvidence();
    return () => { cancelled = true; };
  }, [resident, supabase]);

  // Front-only submissions (migration 0118) have no back_path, so the evidence is complete
  // once every stored side has a signed URL: one photo for front-only, two otherwise.
  const expectedIdPhotos = evidence ? (evidence.back_path ? 2 : 1) : 0;
  const idEvidenceReady = !!evidence && idUrls.length === expectedIdPhotos;

  async function handleIdVerifAction(nextStatus: IdVerificationStatus | null) {
    if (!resident || !evidence) return;
    const decision = nextStatus === 'verified' ? 'verified' : evidence.decision === 'verified' ? 'revoked' : 'verification_failed';
    if (decision !== 'verified' && !reviewReason.trim()) { toast.showError('Enter a rejection or revocation reason.'); return; }
    setIdStatusLoading(true);
    const { error } = await serviceFoundationOperations(supabase).reviewId({ submissionId: evidence.id, decision, ...(reviewReason.trim() ? { reason: reviewReason.trim() } : {}) });
    setIdStatusLoading(false);
    if (error) {
      toast.showError(`Failed to update ID status: ${error.message}`);
      return;
    }
    logAdminAction({
      action: 'status_change',
      entityType: 'resident',
      entityId: resident.id,
      entityLabel: resident.full_name,
      metadata: { previousStatus: idStatus, nextStatus },
    }).catch(() => {});
    const actualStatus = decision === 'verified' ? 'verified' : 'verification_failed';
    setIdStatus(actualStatus);
    setEvidence({ ...evidence, decision });
    onIdStatusChange?.(resident.id, actualStatus);
    toast.showSuccess(
      nextStatus === 'verified'
        ? `${resident.full_name}'s ID has been verified.`
        : nextStatus === 'verification_failed'
          ? `${resident.full_name}'s ID was marked as verification failed — they'll see "Try Again".`
          : nextStatus === 'pending'
            ? `${resident.full_name}'s ID marked as pending review.`
            : `ID verification cleared for ${resident.full_name}.`,
    );
  }

  if (!resident) return null;

  const verStatus = resident.email_verification_status;
  const members = resident.household_members ?? [];

  return (
      <div
        className="mt-6 flex w-full flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex max-h-[40vh] shrink-0 flex-wrap items-start justify-between gap-3 overflow-y-auto border-b border-black/10 p-6 dark:border-white/10">
          <div className="flex min-w-0 flex-[1_1_16rem] items-center gap-4">
            {/* Avatar */}
            {resident.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resident.avatar_url}
                alt={resident.full_name}
                className="h-14 w-14 flex-shrink-0 rounded-full object-cover ring-2 ring-[var(--accent)]/20"
              />
            ) : (
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-lg font-bold text-white">
                {resident.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 break-words">
              <h2 className="text-xl font-bold">{resident.full_name}</h2>
              <p className="mt-0.5 text-sm text-zinc-500">{resident.email ?? 'No email on file'}</p>
              <p className="text-sm text-zinc-500">{resident.mobile_number ?? 'No mobile number'}</p>
            </div>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${verificationColor(verStatus)}`}>{verStatus}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${idVerifColor(idStatus)}`}>{idVerifLabel(idStatus)}</span>
            {resident.location_verified === false && (
              <span
                title="This resident's device location at signup fell outside the barangay boundary. Soft flag only — did not block registration."
                className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                ⚠ Location Outside Boundary
              </span>
            )}
            <button
              onClick={onClose} aria-label="Close details"
              className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Personal details */}
          <section className="border-b border-black/10 p-6 dark:border-white/10">
            <h3 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wide">Personal Details</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-zinc-400">Address</dt>
                <dd className="font-medium">{resident.home_address ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Birthday</dt>
                <dd className="font-medium">{fmtDate(resident.birth_date)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-zinc-400">Verified Location (Settings)</dt>
                <dd className="font-medium">
                  {resident.verified_location ? (
                    <>
                      {resident.verified_location_address ?? 'Verified (no address on file)'}
                      <span className="ml-2 text-xs font-normal text-zinc-400">
                        {(resident.verified_location as { lat: number; lng: number }).lat.toFixed(5)},{' '}
                        {(resident.verified_location as { lat: number; lng: number }).lng.toFixed(5)}
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-400">ID Type</dt>
                <dd className="font-medium">{resident.id_type ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Joined</dt>
                <dd className="font-medium">{formatAdminTimestamp(resident.created_at)}</dd>
              </div>
            </dl>
          </section>

          {/* Household members */}
          <section className="border-b border-black/10 p-6 dark:border-white/10">
            <h3 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wide">Household Members ({members.length})</h3>
            {members.length === 0 ? (
              <p className="text-sm text-zinc-400">No household members recorded.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-lg border border-black/10 px-4 py-3 dark:border-white/10">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{m.name}</p>
                      <p className="text-xs text-zinc-500">
                        {m.relation} · {m.role}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Admin: ID verification actions */}
          <section className="border-b border-black/10 p-6 dark:border-white/10">
            <h3 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wide">ID Verification — Admin Action</h3>
            {resident.id_repair_required && <p role="alert" className="mb-3 text-sm text-red-700">Legacy approval needs repair: complete evidence is missing. Ask the resident to submit both ID sides.</p>}
            {evidence && <p className="mb-3 text-sm">Submission version {evidence.version} · {evidence.id_type} · {evidence.evidence_origin.startsWith('legacy_') ? 'Imported legacy evidence; original submission/review provenance unavailable' : `Submitted ${formatAdminTimestamp(evidence.submitted_at)}`}{evidence.reviewed_at ? ` · Decision ${formatAdminTimestamp(evidence.reviewed_at)} · Reviewer ${evidence.reviewed_by}` : ''}</p>}
            {evidence?.rejection_reason && <p className="mb-3 text-sm">Decision reason: {evidence.rejection_reason}</p>}
            {evidence?.confirmed_details && <dl className="mb-3 space-y-1 text-sm">
              {Object.entries(evidence.confirmed_details).map(([key, value]) => <div key={key}><dt className="inline font-medium">{({ fullName: 'Full name', idNumber: 'ID number', birthDate: 'Birth date', address: 'Address' } as Record<string, string>)[key]}: </dt><dd className="inline">{value || 'Not shown on ID'}</dd></div>)}
            </dl>}
            {!reviewingId && evidence && <button type="button" className="mb-3 rounded-md border px-3 py-2 text-sm" onClick={() => setReviewingId(true)}>Review ID</button>}
            {reviewingId && <><label className="mb-3 block text-sm">Reason for rejection or revocation<textarea className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800" value={reviewReason} onChange={event => setReviewReason(event.target.value)} maxLength={1000} /></label>
              <button type="button" disabled={idStatusLoading} className="mb-3 rounded-md border px-3 py-2 text-sm" onClick={() => { setReviewingId(false); setReviewReason(''); }}>Cancel ID review</button></>}
            <div aria-busy={idStatusLoading} className="flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${idVerifColor(idStatus)}`}>
                Current: {idVerifLabel(idStatus)}
              </span>

              {reviewingId && evidence?.decision === 'pending' && (
                <ConfirmButton
                  label="✅ Mark as Verified"
                  confirmLabel="Confirm verification?"
                  onConfirm={() => handleIdVerifAction('verified')}
                  disabled={idStatusLoading || !idEvidenceReady}
                  title={idUrls.length ? "Mark this resident's ID as verified" : 'No ID document uploaded yet'}
                  className="rounded-full bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                />
              )}

              {reviewingId && evidence?.decision === 'pending' && (
                <ConfirmButton
                  label="❌ Mark as Failed"
                  confirmLabel="Reject this ID? The resident will see 'Verification Failed, Try Again' and can re-upload."
                  onConfirm={() => handleIdVerifAction('verification_failed')}
                  disabled={idStatusLoading || !idEvidenceReady || !reviewReason.trim()}
                  title={idUrls.length ? 'Reject this ID — resident can re-upload to retry' : 'No ID document uploaded yet'}
                  className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                />
              )}

              {reviewingId && evidence?.decision === 'verified' && (
                <ConfirmButton
                  label="↩ Revoke Verification"
                  confirmLabel="Revoke this reviewed ID approval?"
                  onConfirm={() => handleIdVerifAction('pending')}
                  disabled={idStatusLoading || !reviewReason.trim()}
                  title="Revert to pending — resident must re-upload or admin re-verify"
                  className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                />
              )}

            </div>
            {idStatusLoading ? (
              <p aria-hidden="true" className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-500">
                <Spinner size="compact" /> Updating ID status…
              </p>
            ) : null}
            {!idUrls.length && (
              <p className="mt-2 text-xs text-zinc-400">No ID photo uploaded — cannot verify until the resident uploads one.</p>
            )}
          </section>

          {/* ID photos */}
          <section className="border-b border-black/10 p-6 dark:border-white/10">
            <h3 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wide">ID Documents ({idUrls.length})</h3>
            {idUrls.length === 0 ? (
              <p className="text-sm text-zinc-400">No ID documents uploaded.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {idUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`ID document ${i + 1}`}
                      className="h-[396px] w-[613px] rounded-lg border border-black/10 object-contain bg-zinc-50 transition group-hover:opacity-90 dark:border-white/10 dark:bg-zinc-800"
                    />
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* Service request history */}
          <section className="p-6">
            <h3 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wide">Request History</h3>
            {requests === null ? (
              <p className="text-sm text-zinc-400">Loading…</p>
            ) : requests.length === 0 ? (
              <p className="text-sm text-zinc-400">No service requests yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 text-sm dark:border-white/10"
                  >
                    <div>
                      <p className="font-medium">{r.document_types?.name ?? 'Document Request'}</p>
                      <p className="text-xs text-zinc-500">
                        #{r.reference_number} · {formatAdminTimestamp(r.created_at)}
                      </p>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
  );
}

// Sex / Employment Status labels (mirrors resident/profile/profile-form.tsx and the
// mobile Profile screen — kept local to each app rather than shared, same convention
// those two already follow).
const SEX_LABELS: Record<Sex, string> = { male: 'Male', female: 'Female' };

const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  employed: 'Employed',
  unemployed: 'Unemployed',
  student: 'Student',
  self_employed: 'Self-Employed',
  retired: 'Retired',
};

const SEX_OPTIONS = [{ label: '—', value: '' }, ...SEXES.map((s) => ({ label: SEX_LABELS[s], value: s }))];

const EMPLOYMENT_STATUS_OPTIONS = [
  { label: '—', value: '' },
  ...EMPLOYMENT_STATUSES.map((s) => ({ label: EMPLOYMENT_STATUS_LABELS[s], value: s })),
];

// ─── Main Component ────────────────────────────────────────────────────────────

export function ResidentDirectory({ result, summary, requestedState, barangayId }: {
  result: QueryOutcome<BrowseResult<ResidentRow>>; summary: QueryOutcome<Summary>; requestedState: BrowseState;
  barangayId: string;
}) {
  const browse = useConfiguredTableBrowse(PROFILE_TABLE_CONFIGS.residents, requestedState, result, true);
  const { state, value } = browse;
  const activeSort = browse.config.sorts.find(sort => sort.key === state.sort)!;
  const [addOpen, setAddOpen] = useState(false);

  const supabase = createSupabaseBrowserClient();

  async function updateField(r: ResidentRow, patch: ProfileUpdate) {
    const rRecord = r as unknown as Record<string, unknown>;
    const patchRecord = patch as Record<string, unknown>;
    const isNoop = Object.keys(patch).every((key) => rRecord[key] === patchRecord[key]);

    if (isNoop) return { error: null };

    const { data: updated, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', r.id)
      .select('id, full_name, updated_at')
      .maybeSingle();
    if (error) {
      return { error: error.message };
    }
    if (!updated) {
      return { error: 'No resident was updated. Check that you still have access to this barangay.' };
    }
    logAdminAction({
      action: patch.id_verification_status !== undefined ? 'status_change' : 'update',
      entityType: 'resident',
      entityId: updated.id,
      entityLabel: updated.full_name,
      changes: {
        before: Object.fromEntries(Object.keys(patch).map((key) => [key, rRecord[key]])),
        after: patch,
      },
    }).catch(() => {});
    browse.refresh();
    return { error: null, row: updated };
  }

  const lifecycle = useRecordWorkspace<ResidentRow>('residents', browse.refresh, browse.settle, { extra: (row, close) => <ResidentDetailContent resident={row} onClose={close} onIdStatusChange={browse.refresh} /> });

  const columns: EditableDataTableColumn<ResidentRow>[] = [
    {
      id: 'first_name', header: 'First Name', initialWidth: 180, minWidth: 150, wrap: 'break-word',
      render: (r) => <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">{r.full_name.charAt(0).toUpperCase()}</span><span className="font-medium">{r.first_name ?? '—'}</span></div>,
      edit: { type: 'text', getValue: (r) => r.first_name ?? '', onSave: (r, value) => updateField(r, { first_name: String(value).trim() || null }) },
    },
    { id: 'last_name', header: 'Last Name', initialWidth: 140, minWidth: 118, wrap: 'break-word', render: (r) => r.last_name ?? '—', edit: { type: 'text', getValue: (r) => r.last_name ?? '', onSave: (r, value) => updateField(r, { last_name: String(value).trim() || null }) } },
    { id: 'middle_name', header: 'Middle Name', initialWidth: 140, minWidth: 118, wrap: 'break-word', render: (r) => r.middle_name ?? '—', edit: { type: 'text', getValue: (r) => r.middle_name ?? '', onSave: (r, value) => updateField(r, { middle_name: String(value).trim() || null }) } },
    { id: 'suffix', header: 'Suffix', initialWidth: 90, minWidth: 78, wrap: 'nowrap', render: (r) => r.suffix ?? '—', edit: { type: 'text', getValue: (r) => r.suffix ?? '', onSave: (r, value) => updateField(r, { suffix: String(value).trim() || null }) } },
    { id: 'sex', header: 'Sex', initialWidth: 94, minWidth: 82, wrap: 'nowrap', render: (r) => r.sex ? (SEX_LABELS[r.sex as Sex] ?? r.sex) : '—', edit: { type: 'select', options: SEX_OPTIONS, getValue: (r) => r.sex ?? '', onSave: (r, value) => updateField(r, { sex: String(value) || null }), commitOnChange: true } },
    { id: 'email', header: 'Email', initialWidth: 220, minWidth: 170, wrap: 'break-word', render: (r) => <span className="text-zinc-600 dark:text-zinc-400">{r.email ?? '—'}</span>, edit: { type: 'text', getValue: (r) => r.email ?? '', onSave: (r, value) => updateField(r, { email: String(value).trim() || null }) } },
    { id: 'mobile', header: 'Mobile', initialWidth: 142, minWidth: 124, wrap: 'nowrap', render: (r) => <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{r.mobile_number ?? '—'}</span>, edit: { type: 'text', getValue: (r) => r.mobile_number ?? '', onSave: (r, value) => updateField(r, { mobile_number: String(value).trim() || null }) } },
    { id: 'house_no_', header: 'House No.', initialWidth: 110, minWidth: 92, wrap: 'nowrap', render: (r) => r.house_no ?? '—', edit: { type: 'text', getValue: (r) => r.house_no ?? '', onSave: (r, value) => updateField(r, { house_no: String(value).trim() || null }) } },
    { id: 'street', header: 'Street', initialWidth: 180, minWidth: 140, wrap: 'break-word', render: (r) => r.street ?? '—', edit: { type: 'text', getValue: (r) => r.street ?? '', onSave: (r, value) => updateField(r, { street: String(value).trim() || null }) } },
    { id: 'city', header: 'City', initialWidth: 140, minWidth: 112, wrap: 'break-word', render: (r) => r.city ?? '—' },
    { id: 'birthday', header: 'Birthday', initialWidth: 130, minWidth: 118, wrap: 'nowrap', render: (r) => <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{fmtDate(r.birth_date)}</span>, edit: { type: 'date', getValue: (r) => r.birth_date ?? '', onSave: (r, value) => updateField(r, { birth_date: String(value) || null }) } },
    { id: 'employment_status', header: 'Employment Status', initialWidth: 170, minWidth: 142, wrap: 'nowrap', render: (r) => r.employment_status ? (EMPLOYMENT_STATUS_LABELS[r.employment_status as EmploymentStatus] ?? r.employment_status) : '—', edit: { type: 'select', options: EMPLOYMENT_STATUS_OPTIONS, getValue: (r) => r.employment_status ?? '', onSave: (r, value) => updateField(r, { employment_status: String(value) || null }), commitOnChange: true } },
    { id: 'occupation', header: 'Occupation', initialWidth: 170, minWidth: 135, wrap: 'break-word', render: (r) => r.occupation ?? '—', edit: { type: 'text', getValue: (r) => r.occupation ?? '', onSave: (r, value) => updateField(r, { occupation: String(value).trim() || null }) } },
    { id: 'id_type', header: 'ID Type', initialWidth: 150, minWidth: 120, wrap: 'nowrap', render: (r) => r.id_type ?? '—' },
    { id: 'id_status', header: 'ID Status', initialWidth: 180, minWidth: 150, wrap: 'nowrap', render: (r) => <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${idVerifColor(r.id_verification_status)}`}>{r.id_repair_required ? 'Evidence repair required' : idVerifLabel(r.id_verification_status)}</span> },
    { id: 'household', header: 'Household', initialWidth: 100, minWidth: 88, wrap: 'nowrap', render: (r) => <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{r.household_members?.length ?? 0}</span> },
    { id: 'email_verification', header: 'Email Verif.', initialWidth: 135, minWidth: 116, wrap: 'nowrap', render: (r) => <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${verificationColor(r.email_verification_status)}`}>{r.email_verification_status}</span> },
    { id: 'location_verified', header: 'Location Verified', initialWidth: 230, minWidth: 175, wrap: 'break-word', render: (r) => r.verified_location ? <span className="text-green-700 dark:text-green-400">{r.verified_location_address ?? 'Verified (no address on file)'}</span> : <span className="text-zinc-400">Not verified</span> },
    { id: 'joined', header: 'Joined', initialWidth: 176, minWidth: 156, wrap: 'nowrap', render: (r) => <span className="tabular-nums text-zinc-500">{formatAdminTimestamp(r.created_at)}</span> },
    lifecycle.column,
  ];

  return <div  className="min-w-0">
    <RecordArchiveLink name="residents" beforeOpen={browse.settle} />
    <ProfileTableSummary name="residents" summary={summary} onRetry={browse.refresh} />

    {addOpen && <fieldset disabled={browse.pending}><AddResidentForm onCreated={browse.refresh} onClose={() => setAddOpen(false)} /></fieldset>}
    <ProfileTablePanel label="Resident Directory" browse={browse}
      category={<label className="table-browse-field">ID presence <AdminSelect aria-label="ID presence" value={state.filters.verification} onValueChange={nextValue => void browse.commit({ filters: { verification: nextValue } })}>
        <option value="">All ID status</option><option value="with_id">With uploaded ID</option><option value="without_id">Without uploaded ID</option>
      </AdminSelect></label>}
      filters={<SegmentedFilter label="Email verification" value={state.filters.tab}
        options={TABS.map(tab => ({ value: tab.key, label: tab.label }))} onChange={tab => void browse.commit({ filters: { tab } })} />}
      actions={!addOpen && <button type="button" disabled={browse.pending || !barangayId}
        onClick={() => void browse.settle().then(saved => { if (saved) setAddOpen(true); })}>+ Add Resident</button>}>
      <EditableDataTable contextMenuColumnId="actions" rows={value?.rows ?? []} columns={columns} rowKey={row => row.id}
        editHandleRef={browse.editHandle} onEditingChange={browse.onEditingChange}
        sorting={{ descriptor: activeSort, direction: state.dir, choices: browse.config.sorts, onChange: (sort, dir) => void browse.commit({ sort, dir }) }}
        onRowClick={row => lifecycle.open(row)} emptyLabel={browse.pending ? 'Updating results…' : 'No residents found.'}
        resizableColumns density="compact" tableMinWidth={2840} cellOverflow="hidden" />
    </ProfileTablePanel>
    {lifecycle.view}

  </div>;
}
