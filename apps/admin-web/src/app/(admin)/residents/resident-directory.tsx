'use client';

import { EMPLOYMENT_STATUSES, formatDate, SEXES, type Database, type EmploymentStatus, type Sex } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
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

function idVerifColor(status: 'pending' | 'verified' | null) {
  if (status === 'verified') return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30';
  if (status === 'pending') return 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30';
  return 'text-zinc-400 bg-zinc-100 dark:text-zinc-500 dark:bg-zinc-800';
}

function idVerifLabel(status: 'pending' | 'verified' | null) {
  if (status === 'verified') return 'Verified ID';
  if (status === 'pending') return 'Pending Verification';
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
  onIdStatusChange?: (id: string, status: 'pending' | 'verified' | null) => void;
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

  async function handleIdVerifAction(nextStatus: 'pending' | 'verified' | null) {
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
    setIdStatus(nextStatus);
    onIdStatusChange?.(resident.id, nextStatus);
    toast.showSuccess(
      nextStatus === 'verified'
        ? `${resident.full_name}'s ID has been verified.`
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

// ─── Inline-edit cell ──────────────────────────────────────────────────────────

function EditableCell({
  value,
  onSave,
  display,
  placeholder,
}: {
  value: string;
  onSave: (val: string) => Promise<void>;
  /** Optional formatted display label shown in read mode (edit mode always shows raw value). */
  display?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);

  async function commit() {
    if (text.trim() === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(text.trim());
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          className="w-full rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          disabled={saving}
        />
        {saving && <span className="text-xs text-zinc-400">…</span>}
      </div>
    );
  }

  const label = display ?? value;
  return (
    <button
      onClick={() => {
        setText(value);
        setEditing(true);
      }}
      className="group flex w-full items-center justify-between text-left text-sm hover:text-[var(--accent)]"
      title="Click to edit"
    >
      <span>{label || <span className="text-zinc-400">—</span>}</span>
      <span className="ml-1 hidden text-zinc-300 group-hover:inline">✎</span>
    </button>
  );
}

// ─── Editable Select Cell ──────────────────────────────────────────────────────

/** Inline-editable cell backed by a <select> dropdown. */
function EditableSelectCell({
  value,
  options,
  onSave,
  renderDisplay,
}: {
  value: string;
  options: { label: string; value: string }[];
  onSave: (val: string) => Promise<void>;
  renderDisplay?: (val: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(value);
  const [saving, setSaving] = useState(false);

  async function commit(val: string) {
    if (val === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(val);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <select
          autoFocus
          className="w-full rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          onBlur={() => commit(current)}
          disabled={saving}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {saving && <span className="text-xs text-zinc-400">…</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setCurrent(value);
        setEditing(true);
      }}
      className="group flex w-full items-center justify-between text-left text-sm hover:text-[var(--accent)]"
      title="Click to edit"
    >
      <span>{renderDisplay ? renderDisplay(value) : value || <span className="text-zinc-400">—</span>}</span>
      <span className="ml-1 hidden text-zinc-300 group-hover:inline">✎</span>
    </button>
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

// Drives the <colgroup> and the per-column resize handles below. Order must match the
// <th>/<td> order in the table markup.
const COLUMN_HEADERS = [
  'First Name',
  'Last Name',
  'Middle Name',
  'Suffix',
  'Sex',
  'Email',
  'Mobile',
  'House No.',
  'Street',
  'City',
  'Birthday',
  'Employment Status',
  'Occupation',
  'ID Type',
  'ID Status',
  'Household',
  'Email Verif.',
  'Joined',
  'Actions',
] as const;

// The last column (Actions) is deliberately excluded — see the measuring effect below.
const PINNED_HEADERS = COLUMN_HEADERS.slice(0, -1);

// Same 2px zinc-300/600 dividers the shared EditableDataTable uses under `thickBorders`,
// so this hand-rolled table matches the rest of the admin panel.
const BORDER_CLS = 'border-zinc-300 dark:border-zinc-600';
const CELL_DIVIDER_CLS = `border-r-2 ${BORDER_CLS}`;

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

  // A second, top-of-table scrollbar mirroring the real one below — see
  // components/admin/editable-data-table.tsx for the pattern this mirrors.
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(0);
  const syncingFrom = useRef<'top' | 'bottom' | null>(null);

  useLayoutEffect(() => {
    const bottomEl = bottomScrollRef.current;
    const table = bottomEl?.firstElementChild as HTMLElement | undefined;
    if (!bottomEl || !table) return;
    const updateWidth = () => setTableWidth(table.scrollWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(table);
    return () => observer.disconnect();
  }, [sortedResidents]);

  function handleTopScroll() {
    if (syncingFrom.current === 'bottom') return;
    syncingFrom.current = 'top';
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    syncingFrom.current = null;
  }

  function handleBottomScroll() {
    if (syncingFrom.current === 'top') return;
    syncingFrom.current = 'bottom';
    if (bottomScrollRef.current && topScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
    syncingFrom.current = null;
  }

  // Resizable columns — same approach as components/admin/editable-data-table.tsx: each
  // header starts at its natural auto-layout width (measured before paint, so no flash),
  // then gets pinned via <colgroup> once the table switches to table-layout: fixed.
  //
  // The last column (Actions) is deliberately left out of the auto-measure pass so it acts
  // as a flexible filler soaking up any leftover width — otherwise, once every column has a
  // pinned pixel width, table-layout: fixed leaves a dead strip of empty space after the
  // last column instead of the row lines running edge to edge across the card.
  const thRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    setColWidths((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const header of PINNED_HEADERS) {
        if (next[header] === undefined) {
          const width = thRefs.current[header]?.getBoundingClientRect().width;
          if (width) {
            next[header] = Math.round(width);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, []);

  function startColumnResize(e: React.MouseEvent, header: string) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[header] ?? thRefs.current[header]?.getBoundingClientRect().width ?? 120;

    function onMove(ev: MouseEvent) {
      const next = Math.max(60, Math.round(startWidth + (ev.clientX - startX)));
      setColWidths((prev) => ({ ...prev, [header]: next }));
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const columnsMeasured = PINNED_HEADERS.every((header) => colWidths[header] !== undefined);

  async function updateField(id: string, patch: ProfileUpdate) {
    const { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', id);
    if (error) {
      toast.showError(`Failed to update: ${error.message}`);
      return;
    }
    router.refresh();
  }

  async function archive(resident: ResidentRow) {
    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', resident.id);
    if (error) {
      toast.showError(`Failed to archive: ${error.message}`);
      return;
    }
    toast.showSuccess(`${resident.full_name} archived.`);
    router.refresh();
  }

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

      {/* Section 6: table display */}
      <div>
        <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden" style={{ height: 16 }}>
          <div style={{ width: tableWidth, height: 1 }} />
        </div>
        <div
          ref={bottomScrollRef}
          onScroll={handleBottomScroll}
          className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10"
        >
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
                    className={`relative px-4 py-3 ${header === 'Household' ? 'text-center' : ''} ${
                      colIndex < COLUMN_HEADERS.length - 1 ? CELL_DIVIDER_CLS : ''
                    }`}
                  >
                    {/* The trailing Actions column is deliberately unlabelled. */}
                    <span className="block truncate">{header === 'Actions' ? '' : header}</span>
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
                  <td colSpan={COLUMN_HEADERS.length} className="px-4 py-8 text-center text-zinc-400">
                    No residents found.
                  </td>
                </tr>
              )}
              {sortedResidents.map((r) => (
                <tr
                  key={r.id}
                  className={`cursor-pointer border-b-2 ${BORDER_CLS} bg-white transition last:border-b-0 hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/50`}
                  onClick={() => setSelected(r)}
                >
                  {/* First Name — inline editable, with small avatar thumbnail */}
                  <td className={`overflow-hidden px-4 py-3 font-medium ${CELL_DIVIDER_CLS}`} onClick={(e) => e.stopPropagation()}>
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
                      <EditableCell value={r.first_name ?? ''} onSave={(val) => updateField(r.id, { first_name: val || null })} />
                    </div>
                  </td>

                  {/* Last Name */}
                  <td className={`overflow-hidden px-4 py-3 ${CELL_DIVIDER_CLS}`} onClick={(e) => e.stopPropagation()}>
                    <EditableCell value={r.last_name ?? ''} onSave={(val) => updateField(r.id, { last_name: val || null })} />
                  </td>

                  {/* Middle Name */}
                  <td
                    className={`overflow-hidden px-4 py-3 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.middle_name ?? ''} onSave={(val) => updateField(r.id, { middle_name: val || null })} />
                  </td>

                  {/* Suffix */}
                  <td
                    className={`overflow-hidden px-4 py-3 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.suffix ?? ''} onSave={(val) => updateField(r.id, { suffix: val || null })} />
                  </td>

                  {/* Sex */}
                  <td className={`overflow-hidden px-4 py-3 ${CELL_DIVIDER_CLS}`} onClick={(e) => e.stopPropagation()}>
                    <EditableSelectCell
                      value={r.sex ?? ''}
                      options={SEX_OPTIONS}
                      onSave={(val) => updateField(r.id, { sex: val || null })}
                      renderDisplay={(val) => (val ? (SEX_LABELS[val as Sex] ?? val) : <span className="text-zinc-400">—</span>)}
                    />
                  </td>

                  {/* Email */}
                  <td
                    className={`overflow-hidden px-4 py-3 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.email ?? ''} onSave={(val) => updateField(r.id, { email: val || null })} />
                  </td>

                  {/* Mobile */}
                  <td
                    className={`overflow-hidden px-4 py-3 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.mobile_number ?? ''} onSave={(val) => updateField(r.id, { mobile_number: val || null })} />
                  </td>

                  {/* House No. */}
                  <td
                    className={`truncate px-4 py-3 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.house_no ?? ''} onSave={(val) => updateField(r.id, { house_no: val || null })} />
                  </td>

                  {/* Street */}
                  <td
                    className={`truncate px-4 py-3 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.street ?? ''} onSave={(val) => updateField(r.id, { street: val || null })} />
                  </td>

                  {/* City */}
                  <td
                    className={`truncate px-4 py-3 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.city ?? ''} onSave={(val) => updateField(r.id, { city: val || null })} />
                  </td>

                  {/* Birthday */}
                  <td
                    className={`overflow-hidden px-4 py-3 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell
                      value={r.birth_date ?? ''}
                      onSave={(val) => updateField(r.id, { birth_date: val || null })}
                      display={r.birth_date ? fmtDate(r.birth_date) : undefined}
                      placeholder="YYYY-MM-DD"
                    />
                  </td>

                  {/* Employment Status */}
                  <td className={`overflow-hidden px-4 py-3 ${CELL_DIVIDER_CLS}`} onClick={(e) => e.stopPropagation()}>
                    <EditableSelectCell
                      value={r.employment_status ?? ''}
                      options={EMPLOYMENT_STATUS_OPTIONS}
                      onSave={(val) => updateField(r.id, { employment_status: val || null })}
                      renderDisplay={(val) =>
                        val ? (EMPLOYMENT_STATUS_LABELS[val as EmploymentStatus] ?? val) : <span className="text-zinc-400">—</span>
                      }
                    />
                  </td>

                  {/* Occupation */}
                  <td
                    className={`overflow-hidden px-4 py-3 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableCell value={r.occupation ?? ''} onSave={(val) => updateField(r.id, { occupation: val || null })} />
                  </td>

                  {/* ID Type */}
                  <td
                    className={`overflow-hidden px-4 py-3 text-zinc-600 dark:text-zinc-400 ${CELL_DIVIDER_CLS}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableSelectCell
                      value={r.id_type ?? ''}
                      options={ID_TYPE_OPTIONS}
                      onSave={(val) => updateField(r.id, { id_type: val || null })}
                    />
                  </td>

                  {/* ID Verification status */}
                  <td className={`overflow-hidden px-4 py-3 ${CELL_DIVIDER_CLS}`} onClick={(e) => e.stopPropagation()}>
                    <EditableSelectCell
                      value={r.id_verification_status ?? ''}
                      options={ID_STATUS_OPTIONS}
                      onSave={(val) => updateField(r.id, { id_verification_status: val || null })}
                      renderDisplay={(val) => (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${idVerifColor((val || null) as 'pending' | 'verified' | null)}`}
                        >
                          {idVerifLabel((val || null) as 'pending' | 'verified' | null)}
                        </span>
                      )}
                    />
                  </td>

                  {/* Household count */}
                  <td className={`overflow-hidden px-4 py-3 text-center ${CELL_DIVIDER_CLS}`}>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {r.household_members?.length ?? 0}
                    </span>
                  </td>

                  {/* Email verification status */}
                  <td className={`overflow-hidden px-4 py-3 ${CELL_DIVIDER_CLS}`}>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${verificationColor(r.email_verification_status)}`}>
                      {r.email_verification_status}
                    </span>
                  </td>

                  {/* Joined date */}
                  <td className={`overflow-hidden px-4 py-3 text-zinc-500 ${CELL_DIVIDER_CLS}`}>{formatDate(r.created_at)}</td>

                  {/* Archive action */}
                  <td className="overflow-hidden px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <ResidentDetailModal resident={selected} onClose={() => setSelected(null)} onIdStatusChange={() => router.refresh()} />
      )}
    </div>
  );
}
