'use client';

import { formatDate } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { StatusPill } from '@/components/admin/status-pill';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { ResidentRow } from './page';

// ─── Types ─────────────────────────────────────────────────────────────────────

type HouseholdMember = { id: string; name: string; relation: string; role: string };

type ServiceRequest = {
  id: string;
  reference_number: string;
  status: string;
  created_at: string;
  document_types: { name: string } | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function verificationColor(status: string) {
  if (status === 'verified')   return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30';
  if (status === 'pending')    return 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30';
  if (status === 'unverified') return 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30';
  return 'text-zinc-600 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800';
}

function idVerifColor(status: 'pending' | 'verified' | null) {
  if (status === 'verified') return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30';
  if (status === 'pending')  return 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30';
  return 'text-zinc-400 bg-zinc-100 dark:text-zinc-500 dark:bg-zinc-800';
}

function idVerifLabel(status: 'pending' | 'verified' | null) {
  if (status === 'verified') return 'Verified ID';
  if (status === 'pending')  return 'Pending Verification';
  return 'No ID';
}

// ─── Add Resident Form ─────────────────────────────────────────────────────────

function AddResidentForm({ onCreated }: { onCreated: () => void }) {
  const toast = useToast();
  const [open, setOpen]               = useState(false);
  const [email, setEmail]             = useState('');
  const [fullName, setFullName]       = useState('');
  const [mobileNumber, setMobile]     = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [submitting, setSubmitting]   = useState(false);

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

    if (!res.ok) { toast.showError(`Failed to add resident: ${body.error ?? 'Unknown error'}`); return; }

    toast.showSuccess(`Invite sent to ${email.trim()}.`);
    setEmail(''); setFullName(''); setMobile(''); setHomeAddress('');
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-full bg-[#0F6E5B] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#0d5e4e]">
        + Add Resident
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900 sm:grid-cols-2">
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
          className="rounded-full bg-[#0F6E5B] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Sending invite…' : 'Send Invite'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold dark:bg-zinc-700">
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
  const supabase = createSupabaseBrowserClient();
  const router   = useRouter();
  const toast    = useToast();
  const [requests, setRequests]           = useState<ServiceRequest[] | null>(null);
  const [idUrls, setIdUrls]               = useState<string[]>([]);
  const [idStatus, setIdStatus]           = useState(resident?.id_verification_status ?? null);
  const [idStatusLoading, setIdStatusLoading] = useState(false);

  useEffect(() => {
    if (!resident) { setRequests(null); setIdUrls([]); return; }

    setIdStatus(resident.id_verification_status ?? null);

    // Service request history
    supabase
      .from('service_requests')
      .select('id, reference_number, status, created_at, document_types(name)')
      .eq('resident_id', resident.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRequests((data as unknown as ServiceRequest[]) ?? []));

    // Resolve Storage public URLs for ID photos
    const urls = (resident.id_photo_urls ?? []).map((path) => {
      const { data } = supabase.storage.from('id-documents').getPublicUrl(path);
      return data.publicUrl;
    });
    setIdUrls(urls);
  }, [resident]);

  async function handleIdVerifAction(nextStatus: 'pending' | 'verified' | null) {
    if (!resident) return;
    setIdStatusLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ id_verification_status: nextStatus } as any)
      .eq('id', resident.id);
    setIdStatusLoading(false);
    if (error) { toast.showError(`Failed to update ID status: ${error.message}`); return; }
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
  const members   = resident.household_members ?? [];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}>

        {/* Modal header */}
        <div className="flex items-start justify-between border-b border-black/10 p-6 dark:border-white/10">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            {resident.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resident.avatar_url}
                alt={resident.full_name}
                className="h-14 w-14 flex-shrink-0 rounded-full object-cover ring-2 ring-[#0F6E5B]/20"
              />
            ) : (
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#0F6E5B] text-lg font-bold text-white">
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
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${verificationColor(verStatus)}`}>
              {verStatus}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${idVerifColor(idStatus)}`}>
              {idVerifLabel(idStatus)}
            </span>
            <button onClick={onClose} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
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
            <h3 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wide">
              Household Members ({members.length})
            </h3>
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
                      <p className="text-xs text-zinc-500">{m.relation} · {m.role}</p>
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
            <h3 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wide">
              ID Documents ({idUrls.length})
            </h3>
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
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 text-sm dark:border-white/10">
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
  const [text, setText]       = useState(value);
  const [saving, setSaving]   = useState(false);

  async function commit() {
    if (text.trim() === value) { setEditing(false); return; }
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
          className="w-full rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800"
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          disabled={saving}
        />
        {saving && <span className="text-xs text-zinc-400">…</span>}
      </div>
    );
  }

  const label = display ?? value;
  return (
    <button
      onClick={() => { setText(value); setEditing(true); }}
      className="group flex w-full items-center justify-between text-left text-sm hover:text-[#0F6E5B]"
      title="Click to edit">
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
  const [saving, setSaving]   = useState(false);

  async function commit(val: string) {
    if (val === value) { setEditing(false); return; }
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
          className="w-full rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          onBlur={() => commit(current)}
          disabled={saving}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {saving && <span className="text-xs text-zinc-400">…</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => { setCurrent(value); setEditing(true); }}
      className="group flex w-full items-center justify-between text-left text-sm hover:text-[#0F6E5B]"
      title="Click to edit">
      <span>{renderDisplay ? renderDisplay(value) : (value || <span className="text-zinc-400">—</span>)}</span>
      <span className="ml-1 hidden text-zinc-300 group-hover:inline">✎</span>
    </button>
  );
}

// ID type options (mirrors mobile app list)
const ID_TYPE_OPTIONS = [
  { label: '—', value: '' },
  ...([
    'PhilSys', 'Digital PhilSys', "Driver's License", 'Passport', 'SSS ID',
    "Voter's ID", 'PhilHealth ID', 'PRC ID', 'UMID', 'Postal ID',
    'Senior Citizen ID', 'PWD ID', 'GSIS ID', 'TIN ID', 'Barangay ID', 'Other',
  ].map((t) => ({ label: t, value: t }))),
];

const ID_STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'No ID', value: '' },
  { label: 'Pending Verification', value: 'pending' },
  { label: 'Verified ID', value: 'verified' },
];

// ─── Main Component ────────────────────────────────────────────────────────────

export function ResidentDirectory({
  residents,
  initialQuery,
}: {
  residents: ResidentRow[];
  initialQuery: string;
}) {
  const router = useRouter();
  const toast  = useToast();
  const supabase = createSupabaseBrowserClient();

  const [query, setQuery]       = useState(initialQuery);
  const [selected, setSelected] = useState<ResidentRow | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return residents;
    const needle = query.toLowerCase();
    return residents.filter(
      (r) =>
        r.full_name.toLowerCase().includes(needle) ||
        (r.email ?? '').toLowerCase().includes(needle) ||
        (r.mobile_number ?? '').toLowerCase().includes(needle),
    );
  }, [residents, query]);

  async function updateField(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from('profiles').update(patch as any).eq('id', id);
    if (error) { toast.showError(`Failed to update: ${error.message}`); return; }
    router.refresh();
  }

  async function archive(resident: ResidentRow) {
    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', resident.id);
    if (error) { toast.showError(`Failed to archive: ${error.message}`); return; }
    toast.showSuccess(`${resident.full_name} archived.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Local search + add */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter visible rows by name, email, or mobile…"
          className="w-full max-w-sm rounded-full border border-zinc-300 px-4 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800"
        />
        <AddResidentForm onCreated={() => router.refresh()} />
      </div>

      {/* Data table */}
      <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-white/10 dark:bg-zinc-800/60">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Birthday</th>
              <th className="px-4 py-3">ID Type</th>
              <th className="px-4 py-3">ID Status</th>
              <th className="px-4 py-3 text-center">Household</th>
              <th className="px-4 py-3">Email Verif.</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-zinc-400">
                  No residents found.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer bg-white transition hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
                onClick={() => setSelected(r)}>
                {/* Name — inline editable, with small avatar thumbnail */}
                <td className="px-4 py-3 font-medium" onClick={(e) => e.stopPropagation()}>
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
                        className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#0F6E5B] text-xs font-bold text-white"
                        onClick={() => setSelected(r)}>
                        {r.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <EditableCell
                      value={r.full_name}
                      onSave={(val) => updateField(r.id, { full_name: val })}
                    />
                  </div>
                </td>

                {/* Email */}
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400" onClick={(e) => e.stopPropagation()}>
                  <EditableCell
                    value={r.email ?? ''}
                    onSave={(val) => updateField(r.id, { email: val || null })}
                  />
                </td>

                {/* Mobile */}
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400" onClick={(e) => e.stopPropagation()}>
                  <EditableCell
                    value={r.mobile_number ?? ''}
                    onSave={(val) => updateField(r.id, { mobile_number: val || null })}
                  />
                </td>

                {/* Address */}
                <td className="max-w-[160px] truncate px-4 py-3 text-zinc-600 dark:text-zinc-400" onClick={(e) => e.stopPropagation()}>
                  <EditableCell
                    value={r.home_address ?? ''}
                    onSave={(val) => updateField(r.id, { home_address: val || null })}
                  />
                </td>

                {/* Birthday */}
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400" onClick={(e) => e.stopPropagation()}>
                  <EditableCell
                    value={r.birth_date ?? ''}
                    onSave={(val) => updateField(r.id, { birth_date: val || null })}
                    display={r.birth_date ? fmtDate(r.birth_date) : undefined}
                    placeholder="YYYY-MM-DD"
                  />
                </td>

                {/* ID Type */}
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400" onClick={(e) => e.stopPropagation()}>
                  <EditableSelectCell
                    value={r.id_type ?? ''}
                    options={ID_TYPE_OPTIONS}
                    onSave={(val) => updateField(r.id, { id_type: val || null })}
                  />
                </td>

                {/* ID Verification status */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <EditableSelectCell
                    value={r.id_verification_status ?? ''}
                    options={ID_STATUS_OPTIONS}
                    onSave={(val) => updateField(r.id, { id_verification_status: val || null })}
                    renderDisplay={(val) => (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${idVerifColor((val || null) as 'pending' | 'verified' | null)}`}>
                        {idVerifLabel((val || null) as 'pending' | 'verified' | null)}
                      </span>
                    )}
                  />
                </td>

                {/* Household count */}
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {r.household_members?.length ?? 0}
                  </span>
                </td>

                {/* Email verification status */}
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${verificationColor(r.email_verification_status)}`}>
                    {r.email_verification_status}
                  </span>
                </td>

                {/* Joined date */}
                <td className="px-4 py-3 text-zinc-500">{formatDate(r.created_at)}</td>

                {/* Archive action */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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

      {/* Detail modal */}
      {selected && (
        <ResidentDetailModal
          resident={selected}
          onClose={() => setSelected(null)}
          onIdStatusChange={(_id, _status) => router.refresh()}
        />
      )}
    </div>
  );
}
