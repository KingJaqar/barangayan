'use client';

import { formatDate, formatDateTime, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { StatusPill } from '@/components/admin/status-pill';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Resident = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'mobile_number' | 'home_address' | 'created_at'>;
type ResidentRequest = Pick<Tables<'service_requests'>, 'id' | 'reference_number' | 'status' | 'created_at'> & {
  document_types: Pick<Tables<'document_types'>, 'name'> | null;
};

function AddResidentForm({ onCreated }: { onCreated: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
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
    setMobileNumber('');
    setHomeAddress('');
    setOpen(false);
    onCreated();
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-full bg-[#0F6E5B] px-4 py-1.5 text-sm font-semibold text-white">
        + Add Resident
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900 sm:grid-cols-2">
      <label className="text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Full Name</span>
        <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Mobile Number (optional)</span>
        <input className={inputClass} value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Home Address (optional)</span>
        <input className={inputClass} value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} />
      </label>
      <p className="col-span-1 text-xs text-zinc-500 sm:col-span-2">
        The resident gets an email invite to set their own password — no password is ever shown here.
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

export function ResidentDirectory({ residents, initialQuery }: { residents: Resident[]; initialQuery: string }) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState<Resident | null>(null);
  const [requests, setRequests] = useState<ResidentRequest[] | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return residents;
    const needle = query.toLowerCase();
    return residents.filter((r) => r.full_name.toLowerCase().includes(needle));
  }, [residents, query]);

  useEffect(() => {
    if (!selected) return;
    const supabase = createSupabaseBrowserClient();
    supabase
      .from('service_requests')
      .select('id, reference_number, status, created_at, document_types(name)')
      .eq('resident_id', selected.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRequests((data as unknown as ResidentRequest[]) ?? []));
  }, [selected]);

  function selectResident(resident: Resident) {
    setRequests(null);
    setSelected(resident);
  }

  function closeResident() {
    setSelected(null);
    setRequests(null);
  }

  async function updateField(resident: Resident, patch: Partial<Tables<'profiles'>>) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('profiles').update(patch).eq('id', resident.id);
    if (!error) router.refresh();
    return { error: error?.message ?? null };
  }

  async function archive(resident: Resident) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', resident.id);
    if (error) {
      toast.showError(`Failed to archive resident: ${error.message}`);
      return;
    }
    toast.showSuccess(`${resident.full_name} archived.`);
    router.refresh();
  }

  const columns: EditableDataTableColumn<Resident>[] = [
    {
      header: 'Name',
      render: (r) => r.full_name,
      edit: { type: 'text', getValue: (r) => r.full_name, onSave: (r, value) => updateField(r, { full_name: String(value) }) },
    },
    {
      header: 'Mobile',
      render: (r) => r.mobile_number ?? '—',
      edit: {
        type: 'text',
        getValue: (r) => r.mobile_number ?? '',
        onSave: (r, value) => updateField(r, { mobile_number: String(value) || null }),
      },
    },
    {
      header: 'Address',
      render: (r) => r.home_address ?? '—',
      edit: {
        type: 'text',
        getValue: (r) => r.home_address ?? '',
        onSave: (r, value) => updateField(r, { home_address: String(value) || null }),
      },
    },
    { header: 'Joined', render: (r) => formatDate(r.created_at) },
    {
      header: '',
      render: (r) => (
        <ConfirmButton
          label="🗑"
          confirmLabel="Archive?"
          onConfirm={() => archive(r)}
          title="Archive"
          className="rounded-full px-2 py-1 text-zinc-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300"
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="w-full max-w-sm rounded-full border border-zinc-300 px-4 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800"
        />
        <AddResidentForm onCreated={() => router.refresh()} />
      </div>

      <EditableDataTable
        rows={filtered}
        rowKey={(r) => r.id}
        emptyLabel="No residents found."
        onRowClick={(r) => selectResident(r)}
        columns={columns}
      />

      {selected ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={closeResident}>
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">{selected.full_name}</h2>
                <p className="text-sm text-zinc-500">{selected.mobile_number ?? 'No mobile number'}</p>
                <p className="text-sm text-zinc-500">{selected.home_address ?? 'No address on file'}</p>
              </div>
              <button onClick={closeResident} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                ✕
              </button>
            </div>

            <h3 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Request History</h3>
            {requests === null ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : requests.length === 0 ? (
              <p className="text-sm text-zinc-500">No requests yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {requests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10">
                    <div>
                      <p className="font-medium">{r.document_types?.name ?? 'Document Request'}</p>
                      <p className="text-xs text-zinc-500">
                        #{r.reference_number} · {formatDateTime(r.created_at)}
                      </p>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
