'use client';

import {
  EMPLOYMENT_STATUSES,
  formatDate,
  SEXES,
  type Database,
  type EmploymentStatus,
  type IdVerificationStatus,
  type Sex,
} from '@barangayan/shared';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { StatusPill } from '@/components/admin/status-pill';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { ResidentRow } from './page';
import { TABS, type Tab } from './types';

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

const inputCls =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

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
      className="grid grid-cols-1 gap-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900 sm:grid-cols-2"
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium">Email *</span>
        <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Full Name *</span>
        <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Mobile Number</span>
        <input className={inputCls} value={mobileNumber} onChange={(e) => setMobile(e.target.value)} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Home Address</span>
        <input className={inputCls} value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} />
      </label>
      <p className="col-span-1 text-xs text-zinc-500 sm:col-span-2">
        The resident receives an email invite to set their own password — no password is ever stored here.
      </p>
      <div className="col-span-1 flex items-center gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={submitting || !email.trim() || !fullName.trim()}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? 'Sending invite…' : 'Send Invite'}
        </button>
        <button type="button" onClick={onClose} className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold dark:bg-zinc-700">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Resident Detail Modal ─────────────────────────────────────────────────────

function ResidentDetailModal({
  resident,
  onClose,
  onIdStatusChange,
}: {
  resident: ResidentRow | null;
  onClose: () => void;
  onIdStatusChange?: (id: string, status: IdVerificationStatus | null) => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const toast = useToast();
  const [requests, setRequests] = useState<ServiceRequest[] | null>(null);
  const [idUrls, setIdUrls] = useState<string[]>([]);
  const [idStatus, setIdStatus] = useState(resident?.id_verification_status ?? null);
  const [idStatusLoading, setIdStatusLoading] = useState(false);

  // Reset the panel's per-resident state the moment a different resident (or none) is
  // selected, so the previous resident's requests/photos never flash in the new panel.
  // Adjusting state during render is React's recommended way to do this.
  const [prevResidentId, setPrevResidentId] = useState(resident?.id ?? null);
  if (prevResidentId !== (resident?.id ?? null)) {
    setPrevResidentId(resident?.id ?? null);
    setRequests(null);
    setIdUrls([]);
    setIdStatus(resident?.id_verification_status ?? null);
  }

  useEffect(() => {
    if (!resident) return;

    // Service request history
    supabase
      .from('service_requests')
      .select('id, reference_number, status, created_at, document_types(name)')
      .eq('resident_id', resident.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRequests((data as unknown as ServiceRequest[]) ?? []));

    // Resolve short-lived signed URLs for ID photos — id-documents is a
    // private bucket (government ID photos); getPublicUrl() would silently
    // return a broken URL, and a public bucket would rely on obscurity alone.
    // The render-time reset above already cleared idUrls, so there is nothing to do when
    // this resident has no ID photos on file.
    const paths = resident.id_photo_urls ?? [];
    if (paths.length === 0) return;

    supabase.storage
      .from('id-documents')
      .createSignedUrls(paths, 60 * 10) // 10 minutes
      .then(({ data, error }) => {
        if (error || !data) {
          setIdUrls([]);
          return;
        }
        setIdUrls(data.map((d) => d.signedUrl).filter((u): u is string => !!u));
      });
  }, [resident, supabase]);

  async function handleIdVerifAction(nextStatus: IdVerificationStatus | null) {
    if (!resident) return;
    setIdStatusLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ id_verification_status: nextStatus })
      .eq('id', resident.id);
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
    setIdStatus(nextStatus);
    onIdStatusChange?.(resident.id, nextStatus);
    toast.showSuccess(
      nextStatus === 'verified'
        ? `${resident.full_name}'s ID has been verified.`
        : nextStatus === 'verification_failed'
          ? `${resident.full_name}'s ID was marked as verification failed — they'll see "Try Again".`
          : nextStatus === 'pending'
            ? `${resident.full_name}'s ID marked as pending review.`
            : `ID verification cleared for ${resident.full_name}.`,
    );
    router.refresh();
  }

  if (!resident) return null;

  const verStatus = resident.email_verification_status;
  const members = resident.household_members ?? [];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-start justify-between border-b border-black/10 p-6 dark:border-white/10">
          <div className="flex items-center gap-4">
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
            <div>
              <h2 className="text-xl font-bold">{resident.full_name}</h2>
              <p className="mt-0.5 text-sm text-zinc-500">{resident.email ?? 'No email on file'}</p>
              <p className="text-sm text-zinc-500">{resident.mobile_number ?? 'No mobile number'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              onClick={onClose}
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
                <dd className="font-medium">{formatDate(resident.created_at)}</dd>
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
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${idVerifColor(idStatus)}`}>
                Current: {idVerifLabel(idStatus)}
              </span>

              {idStatus !== 'verified' && (
                <ConfirmButton
                  label="✅ Mark as Verified"
                  confirmLabel="Confirm verification?"
                  onConfirm={() => handleIdVerifAction('verified')}
                  disabled={idStatusLoading || !idUrls.length}
                  title={idUrls.length ? "Mark this resident's ID as verified" : 'No ID document uploaded yet'}
                  className="rounded-full bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                />
              )}

              {idStatus !== 'verified' && idStatus !== 'verification_failed' && (
                <ConfirmButton
                  label="❌ Mark as Failed"
                  confirmLabel="Reject this ID? The resident will see 'Verification Failed, Try Again' and can re-upload."
                  onConfirm={() => handleIdVerifAction('verification_failed')}
                  disabled={idStatusLoading || !idUrls.length}
                  title={idUrls.length ? 'Reject this ID — resident can re-upload to retry' : 'No ID document uploaded yet'}
                  className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                />
              )}

              {idStatus === 'verification_failed' && (
                <ConfirmButton
                  label="↩ Reset to Pending"
                  confirmLabel="Give this resident another review pass?"
                  onConfirm={() => handleIdVerifAction('pending')}
                  disabled={idStatusLoading}
                  title="Revert to pending — for re-reviewing without waiting on a re-upload"
                  className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                />
              )}

              {idStatus === 'verified' && (
                <ConfirmButton
                  label="↩ Revoke Verification"
                  confirmLabel="Revoke and set to pending?"
                  onConfirm={() => handleIdVerifAction('pending')}
                  disabled={idStatusLoading}
                  title="Revert to pending — resident must re-upload or admin re-verify"
                  className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                />
              )}

              {idStatus !== null && (
                <ConfirmButton
                  label="✕ Clear Status"
                  confirmLabel="Clear ID status entirely?"
                  onConfirm={() => handleIdVerifAction(null)}
                  disabled={idStatusLoading}
                  title="Reset to no-ID state"
                  className="rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                />
              )}
            </div>
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
                        #{r.reference_number} · {formatDate(r.created_at)}
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
    </div>
  );
}

// ID type options (mirrors mobile app list)
const ID_TYPE_OPTIONS = [
  { label: '—', value: '' },
  ...[
    'PhilSys',
    'Digital PhilSys',
    "Driver's License",
    'Passport',
    'SSS ID',
    "Voter's ID",
    'PhilHealth ID',
    'PRC ID',
    'UMID',
    'Postal ID',
    'Senior Citizen ID',
    'PWD ID',
    'GSIS ID',
    'TIN ID',
    'Barangay ID',
    'Other',
  ].map((t) => ({ label: t, value: t })),
];

const ID_STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'No ID', value: '' },
  { label: 'Pending Verification', value: 'pending' },
  { label: 'Verified ID', value: 'verified' },
  { label: 'Verification Failed, Try Again', value: 'verification_failed' },
];

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

export function ResidentDirectory({
  residents,
  tab,
  q,
  verification,
}: {
  residents: ResidentRow[];
  tab: Tab;
  q: string;
  verification: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const supabase = createSupabaseBrowserClient();

  const [selected, setSelected] = useState<ResidentRow | null>(null);
  const [nameOrder, setNameOrder] = useState<'asc' | 'desc'>('asc');
  const [addOpen, setAddOpen] = useState(false);
  const [searchText, setSearchText] = useState(q);

  // Re-sync the box with the URL when the server sends a different `q` (back/forward, or a
  // navigation from elsewhere). Adjusting state during render is React's recommended way to
  // do this — an effect would render the stale value first, then immediately render again.
  const [prevQ, setPrevQ] = useState(q);
  if (prevQ !== q) {
    setPrevQ(q);
    setSearchText(q);
  }

  // Keep the latest tab/verification around for the debounced search effect below,
  // without making that effect re-fire (and re-push a redundant URL) whenever tab/
  // verification change on their own — those already navigate immediately through
  // their own handlers.
  const tabRef = useRef(tab);
  const verificationRef = useRef(verification);
  useEffect(() => {
    tabRef.current = tab;
    verificationRef.current = verification;
  }, [tab, verification]);

  function navigate(next: { tab?: string; q?: string; verification?: string }) {
    const nextQ = next.q ?? q;
    const nextVerification = next.verification ?? verification;
    const params = new URLSearchParams({
      tab: next.tab ?? tab,
      ...(nextQ ? { q: nextQ } : {}),
      ...(nextVerification ? { verification: nextVerification } : {}),
    });
    router.push(`/residents?${params.toString()}`);
  }

  // Real-time search: push the URL (and let the server re-filter) a short moment after
  // the user stops typing, instead of waiting for a submit click.
  useEffect(() => {
    if (searchText === q) return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({
        tab: tabRef.current,
        ...(searchText ? { q: searchText } : {}),
        ...(verificationRef.current ? { verification: verificationRef.current } : {}),
      });
      router.push(`/residents?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const sortedResidents = [...residents].sort((a, b) => a.full_name.localeCompare(b.full_name) * (nameOrder === 'asc' ? 1 : -1));

  async function updateField(r: ResidentRow, patch: ProfileUpdate) {
    const rRecord = r as unknown as Record<string, unknown>;
    const patchRecord = patch as Record<string, unknown>;
    const isNoop = Object.keys(patch).every((key) => rRecord[key] === patchRecord[key]);

    if (isNoop) return { error: null };

    const { data: updated, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', r.id)
      .select('id, full_name')
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
    router.refresh();
    return { error: null, row: updated };
  }

  async function archive(resident: ResidentRow) {
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', resident.id)
      .select('id, full_name')
      .maybeSingle();
    if (error) {
      toast.showError(`Failed to archive: ${error.message}`);
      return;
    }
    if (!updated) {
      toast.showError('Failed to archive: no resident was updated. Check that you still have access to this barangay.');
      return;
    }
    logAdminAction({
      action: 'delete',
      entityType: 'resident',
      entityId: updated.id,
      entityLabel: updated.full_name,
      metadata: { full_name: resident.full_name, email: resident.email, mobile_number: resident.mobile_number },
    }).catch(() => {});
    toast.showSuccess(`${updated.full_name} archived.`);
    router.refresh();
  }

  const columns: EditableDataTableColumn<ResidentRow>[] = [
    {
      header: 'First Name', initialWidth: 180, minWidth: 150, wrap: 'break-word',
      render: (r) => <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">{r.full_name.charAt(0).toUpperCase()}</span><span className="font-medium">{r.first_name ?? '—'}</span></div>,
      edit: { type: 'text', getValue: (r) => r.first_name ?? '', onSave: (r, value) => updateField(r, { first_name: String(value).trim() || null }) },
    },
    { header: 'Last Name', initialWidth: 140, minWidth: 118, wrap: 'break-word', render: (r) => r.last_name ?? '—', edit: { type: 'text', getValue: (r) => r.last_name ?? '', onSave: (r, value) => updateField(r, { last_name: String(value).trim() || null }) } },
    { header: 'Middle Name', initialWidth: 140, minWidth: 118, wrap: 'break-word', render: (r) => r.middle_name ?? '—', edit: { type: 'text', getValue: (r) => r.middle_name ?? '', onSave: (r, value) => updateField(r, { middle_name: String(value).trim() || null }) } },
    { header: 'Suffix', initialWidth: 90, minWidth: 78, wrap: 'nowrap', render: (r) => r.suffix ?? '—', edit: { type: 'text', getValue: (r) => r.suffix ?? '', onSave: (r, value) => updateField(r, { suffix: String(value).trim() || null }) } },
    { header: 'Sex', initialWidth: 94, minWidth: 82, wrap: 'nowrap', render: (r) => r.sex ? (SEX_LABELS[r.sex as Sex] ?? r.sex) : '—', edit: { type: 'select', options: SEX_OPTIONS, getValue: (r) => r.sex ?? '', onSave: (r, value) => updateField(r, { sex: String(value) || null }), commitOnChange: true } },
    { header: 'Email', initialWidth: 220, minWidth: 170, wrap: 'break-word', render: (r) => <span className="text-zinc-600 dark:text-zinc-400">{r.email ?? '—'}</span>, edit: { type: 'text', getValue: (r) => r.email ?? '', onSave: (r, value) => updateField(r, { email: String(value).trim() || null }) } },
    { header: 'Mobile', initialWidth: 142, minWidth: 124, wrap: 'nowrap', render: (r) => <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{r.mobile_number ?? '—'}</span>, edit: { type: 'text', getValue: (r) => r.mobile_number ?? '', onSave: (r, value) => updateField(r, { mobile_number: String(value).trim() || null }) } },
    { header: 'House No.', initialWidth: 110, minWidth: 92, wrap: 'nowrap', render: (r) => r.house_no ?? '—', edit: { type: 'text', getValue: (r) => r.house_no ?? '', onSave: (r, value) => updateField(r, { house_no: String(value).trim() || null }) } },
    { header: 'Street', initialWidth: 180, minWidth: 140, wrap: 'break-word', render: (r) => r.street ?? '—', edit: { type: 'text', getValue: (r) => r.street ?? '', onSave: (r, value) => updateField(r, { street: String(value).trim() || null }) } },
    { header: 'City', initialWidth: 140, minWidth: 112, wrap: 'break-word', render: (r) => r.city ?? '—', edit: { type: 'text', getValue: (r) => r.city ?? '', onSave: (r, value) => updateField(r, { city: String(value).trim() || null }) } },
    { header: 'Birthday', initialWidth: 130, minWidth: 118, wrap: 'nowrap', render: (r) => <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{fmtDate(r.birth_date)}</span>, edit: { type: 'date', getValue: (r) => r.birth_date ?? '', onSave: (r, value) => updateField(r, { birth_date: String(value) || null }) } },
    { header: 'Employment Status', initialWidth: 170, minWidth: 142, wrap: 'nowrap', render: (r) => r.employment_status ? (EMPLOYMENT_STATUS_LABELS[r.employment_status as EmploymentStatus] ?? r.employment_status) : '—', edit: { type: 'select', options: EMPLOYMENT_STATUS_OPTIONS, getValue: (r) => r.employment_status ?? '', onSave: (r, value) => updateField(r, { employment_status: String(value) || null }), commitOnChange: true } },
    { header: 'Occupation', initialWidth: 170, minWidth: 135, wrap: 'break-word', render: (r) => r.occupation ?? '—', edit: { type: 'text', getValue: (r) => r.occupation ?? '', onSave: (r, value) => updateField(r, { occupation: String(value).trim() || null }) } },
    { header: 'ID Type', initialWidth: 150, minWidth: 120, wrap: 'nowrap', render: (r) => r.id_type ?? '—', edit: { type: 'select', options: ID_TYPE_OPTIONS, getValue: (r) => r.id_type ?? '', onSave: (r, value) => updateField(r, { id_type: String(value) || null }), commitOnChange: true } },
    { header: 'ID Status', initialWidth: 180, minWidth: 150, wrap: 'nowrap', render: (r) => <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${idVerifColor(r.id_verification_status)}`}>{idVerifLabel(r.id_verification_status)}</span>, edit: { type: 'select', options: ID_STATUS_OPTIONS, getValue: (r) => r.id_verification_status ?? '', onSave: (r, value) => updateField(r, { id_verification_status: String(value) || null }), commitOnChange: true } },
    { header: 'Household', initialWidth: 100, minWidth: 88, wrap: 'nowrap', render: (r) => <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{r.household_members?.length ?? 0}</span> },
    { header: 'Email Verif.', initialWidth: 135, minWidth: 116, wrap: 'nowrap', render: (r) => <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${verificationColor(r.email_verification_status)}`}>{r.email_verification_status}</span> },
    { header: 'Location Verified', initialWidth: 230, minWidth: 175, wrap: 'break-word', render: (r) => r.verified_location ? <span className="text-green-700 dark:text-green-400">{r.verified_location_address ?? 'Verified (no address on file)'}</span> : <span className="text-zinc-400">Not verified</span> },
    { header: 'Joined', initialWidth: 128, minWidth: 116, wrap: 'nowrap', render: (r) => <span className="tabular-nums text-zinc-500">{formatDate(r.created_at)}</span> },
    { header: 'Actions', initialWidth: 96, minWidth: 88, wrap: 'nowrap', overflow: 'visible', render: (r) => <div onClick={(e) => e.stopPropagation()}><ConfirmButton label={<Trash2 aria-hidden="true" className="h-4 w-4" />} ariaLabel={`Archive ${r.full_name}`} confirmLabel="Archive?" onConfirm={() => archive(r)} title={`Archive ${r.full_name}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:bg-red-900/30 dark:hover:text-red-300 dark:focus-visible:ring-offset-zinc-900" /></div> },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Section 3: sort/filter/search (left) + Section 5: add button (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setNameOrder((current) => (current === 'asc' ? 'desc' : 'asc'))}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)] dark:border-zinc-700"
          >
            Name {nameOrder === 'asc' ? '↑' : '↓'}
          </button>

          <select
            value={verification}
            onChange={(e) => navigate({ verification: e.target.value })}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">All ID status</option>
            <option value="with_id">With uploaded ID</option>
            <option value="without_id">Without uploaded ID</option>
          </select>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ q: searchText });
            }}
            className="flex items-center gap-2"
          >
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search name, email, mobile, ID type…"
              className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800 sm:min-w-[260px]"
            />
            <button
              type="submit"
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)] dark:border-zinc-700"
            >
              Search
            </button>
          </form>
        </div>

        {!addOpen && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
          >
            + Add Resident
          </button>
        )}
      </div>

      {/* Section 4: segmented tabs, beneath the sort/filter/search + add row */}
      <div className="flex gap-1 rounded-full bg-zinc-200 p-1 dark:bg-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => navigate({ tab: t.key })}
            className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white shadow dark:bg-zinc-700'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {addOpen && <AddResidentForm onCreated={() => router.refresh()} onClose={() => setAddOpen(false)} />}

      {/* Legacy table markup kept here temporarily while this change is reviewed.
      <TableScrollArea>
        <table
          // w-full only kicks in once the pinned columns are measured and the table is
          // on fixed layout — applying it earlier would stretch the very widths
          // startColumnResize is trying to capture as "natural".
          className={`text-sm ${columnsMeasured ? 'w-full' : ''}`}
          style={columnsMeasured ? { tableLayout: 'fixed' } : undefined}
        >
          <colgroup>
            {COLUMN_HEADERS.map((header) => (
              <col key={header} style={colWidths[header] ? { width: colWidths[header] } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr
              className={`border-b-2 ${BORDER_CLS} bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60`}
            >
              {COLUMN_HEADERS.map((header, colIndex) => (
                <th
                  key={header}
                  ref={(el) => {
                    thRefs.current[header] = el;
                  }}
                  style={colIndex === COLUMN_HEADERS.length - 1 ? { minWidth: LAST_COLUMN_MIN_WIDTH } : undefined}
                  className={`relative px-5 py-3.5 ${header === 'Household' ? 'text-center' : ''} ${
                    colIndex < COLUMN_HEADERS.length - 1 ? CELL_DIVIDER_CLS : ''
                  }`}
                >
                  {/* The trailing Actions column is deliberately unlabelled. * /}
                  <span className="block truncate" title={header === 'Actions' ? undefined : header}>
                    {header === 'Actions' ? '' : header}
                  </span>
                  <div
                    onMouseDown={(e) => startColumnResize(e, header)}
                    title="Drag to resize"
                    className="absolute inset-y-0 right-0 w-1.5 cursor-col-resize select-none hover:bg-[var(--accent)]/40 active:bg-[var(--accent)]"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedResidents.length === 0 && (
              <tr>
                <td colSpan={COLUMN_HEADERS.length} className="px-5 py-8 text-center text-zinc-400">
                  No residents found.
                </td>
              </tr>
            )}
            {sortedResidents.map((r, rowIndex) => (
              <tr
                key={r.id}
                className={`cursor-pointer border-b-2 ${BORDER_CLS} transition last:border-b-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 ${
                  rowIndex % 2 === 1 ? 'bg-zinc-50/60 dark:bg-zinc-900/40' : 'bg-white dark:bg-zinc-900'
                }`}
                onClick={() => setSelected(r)}
              >
                  {/* First Name — inline editable, with small avatar thumbnail * /}
                  <td className={`overflow-hidden px-5 py-3.5 font-medium ${CELL_DIVIDER_CLS}`} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2.5">
                      {r.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.avatar_url}
                          alt=""
                          className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                          onClick={() => setSelected(r)}
                        />
                      ) : (
                        <div
                          className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white"
                          onClick={() => setSelected(r)}
                        >
                          {r.full_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <EditableCell value={r.first_name ?? ''} onSave={(val) => updateField(r,{ first_name: val || null })} />
                    </div>
                  </td>

                  {/* Last Name * /}
                  <td className={`overflow-hidden px-5 py-3.5 ${CELL_DIVIDER_CLS}`} onClick={(e) => e.stopPropagation()}>
                    <EditableCell value={r.last_name ?? ''} onSave={(val) => updateField(r,{ last_name: val || null })} />
                  </td>

                  {/* Middle Name * /}
                  <td
                    className={`overflow-hidden px-5 py-3.5 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.middle_name ?? ''} onSave={(val) => updateField(r,{ middle_name: val || null })} />
                  </td>

                  {/* Suffix * /}
                  <td
                    className={`overflow-hidden px-5 py-3.5 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.suffix ?? ''} onSave={(val) => updateField(r,{ suffix: val || null })} />
                  </td>

                  {/* Sex * /}
                  <td className={`overflow-hidden px-5 py-3.5 ${CELL_DIVIDER_CLS}`} onClick={(e) => e.stopPropagation()}>
                    <EditableSelectCell
                      value={r.sex ?? ''}
                      options={SEX_OPTIONS}
                      onSave={(val) => updateField(r,{ sex: val || null })}
                      renderDisplay={(val) => (val ? (SEX_LABELS[val as Sex] ?? val) : <span className="text-zinc-400">—</span>)}
                    />
                  </td>

                  {/* Email * /}
                  <td
                    className={`overflow-hidden px-5 py-3.5 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.email ?? ''} onSave={(val) => updateField(r,{ email: val || null })} />
                  </td>

                  {/* Mobile * /}
                  <td
                    className={`overflow-hidden px-5 py-3.5 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.mobile_number ?? ''} onSave={(val) => updateField(r,{ mobile_number: val || null })} />
                  </td>

                  {/* House No. * /}
                  <td
                    className={`truncate px-5 py-3.5 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.house_no ?? ''} onSave={(val) => updateField(r,{ house_no: val || null })} />
                  </td>

                  {/* Street * /}
                  <td
                    className={`truncate px-5 py-3.5 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.street ?? ''} onSave={(val) => updateField(r,{ street: val || null })} />
                  </td>

                  {/* City * /}
                  <td
                    className={`truncate px-5 py-3.5 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.city ?? ''} onSave={(val) => updateField(r,{ city: val || null })} />
                  </td>

                  {/* Birthday * /}
                  <td
                    className={`overflow-hidden px-5 py-3.5 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell
                      value={r.birth_date ?? ''}
                      onSave={(val) => updateField(r,{ birth_date: val || null })}
                      display={r.birth_date ? fmtDate(r.birth_date) : undefined}
                      placeholder="YYYY-MM-DD"
                    />
                  </td>

                  {/* Employment Status * /}
                  <td className={`overflow-hidden px-5 py-3.5 ${CELL_DIVIDER_CLS}`} onClick={(e) => e.stopPropagation()}>
                    <EditableSelectCell
                      value={r.employment_status ?? ''}
                      options={EMPLOYMENT_STATUS_OPTIONS}
                      onSave={(val) => updateField(r,{ employment_status: val || null })}
                      renderDisplay={(val) =>
                        val ? (EMPLOYMENT_STATUS_LABELS[val as EmploymentStatus] ?? val) : <span className="text-zinc-400">—</span>
                      }
                    />
                  </td>

                  {/* Occupation * /}
                  <td
                    className={`overflow-hidden px-5 py-3.5 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.occupation ?? ''} onSave={(val) => updateField(r,{ occupation: val || null })} />
                  </td>

                  {/* ID Type * /}
                  <td
                    className={`overflow-hidden px-5 py-3.5 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableSelectCell
                      value={r.id_type ?? ''}
                      options={ID_TYPE_OPTIONS}
                      onSave={(val) => updateField(r,{ id_type: val || null })}
                    />
                  </td>

                  {/* ID Verification status * /}
                  <td className={`overflow-hidden px-5 py-3.5 ${CELL_DIVIDER_CLS}`} onClick={(e) => e.stopPropagation()}>
                    <EditableSelectCell
                      value={r.id_verification_status ?? ''}
                      options={ID_STATUS_OPTIONS}
                      onSave={(val) => updateField(r,{ id_verification_status: val || null })}
                      renderDisplay={(val) => (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${idVerifColor((val || null) as IdVerificationStatus | null)}`}
                        >
                          {idVerifLabel((val || null) as IdVerificationStatus | null)}
                        </span>
                      )}
                    />
                  </td>

                  {/* Household count * /}
                  <td className={`overflow-hidden px-5 py-3.5 text-center ${CELL_DIVIDER_CLS}`}>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {r.household_members?.length ?? 0}
                    </span>
                  </td>

                  {/* Email verification status * /}
                  <td className={`overflow-hidden px-5 py-3.5 ${CELL_DIVIDER_CLS}`}>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${verificationColor(r.email_verification_status)}`}>
                      {r.email_verification_status}
                    </span>
                  </td>

                  {/* Location Verified — resident-initiated pin from Settings > Location
                      Verification (mobile), migrations 0090/0091. Distinct from the
                      "⚠ Location Outside Boundary" flag above, which is the one-time
                      signup-time GPS check (0075/0078). * /}
                  <td className={`overflow-hidden truncate px-5 py-3.5 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`} title={r.verified_location_address ?? undefined}>
                    {r.verified_location ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-green-600 dark:text-green-400">📍</span>
                        <span className="truncate">{r.verified_location_address ?? 'Verified (no address on file)'}</span>
                      </span>
                    ) : (
                      <span className="text-zinc-400">Not verified</span>
                    )}
                  </td>

                  {/* Joined date * /}
                  <td className={`overflow-hidden px-5 py-3.5 text-zinc-500 ${CELL_DIVIDER_CLS}`}>{formatDate(r.created_at)}</td>

                  {/* Archive action * /}
                  <td
                    className="overflow-hidden px-5 py-3.5"
                    style={{ minWidth: LAST_COLUMN_MIN_WIDTH }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ConfirmButton
                      label="🗑"
                      confirmLabel="Archive?"
                      onConfirm={() => archive(r)}
                      title="Archive resident"
                      className="rounded-full px-2 py-1 text-zinc-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
        </table>
      </TableScrollArea> */}
      <EditableDataTable
        columns={columns}
        rows={sortedResidents}
        rowKey={(resident) => resident.id}
        emptyLabel="No residents found."
        onRowClick={setSelected}
        resizableColumns
        density="compact"
        tableMinWidth={2840}
        cellOverflow="hidden"
      />

      {/* Detail modal */}
      {selected && (
        <ResidentDetailModal resident={selected} onClose={() => setSelected(null)} onIdStatusChange={() => router.refresh()} />
      )}
    </div>
  );
}
