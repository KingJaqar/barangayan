'use client';

import type { Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { formatDriveDate } from '../drive-table';
import { ApplicantDetailModal } from './applicant-detail-modal';
import type { ApplicantRow } from './page';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'attended', label: 'Attended' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200',
    confirmed: 'bg-[#0F6E5B]/15 text-[#0F6E5B]',
    attended: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] ?? styles.pending}`}>{label}</span>
  );
}

function formatDateTimeShort(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

type DriveOption = { id: string; title: string; drive_date: string };
type ResidentOption = { id: string; full_name: string };

function AddApplicantForm() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [drives, setDrives] = useState<DriveOption[]>([]);
  const [residents, setResidents] = useState<ResidentOption[]>([]);
  const [driveId, setDriveId] = useState('');
  const [residentId, setResidentId] = useState('');
  const [age, setAge] = useState(30);
  const [isPwd, setIsPwd] = useState('false');
  const [comorbidities, setComorbidities] = useState('');
  const [priorDoseDate, setPriorDoseDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const supabase = createSupabaseBrowserClient();
    supabase
      .from('medical_drives')
      .select('id, title, drive_date')
      .eq('is_active', true)
      .is('deleted_at', null)
      .then(({ data }) => setDrives((data ?? []) as DriveOption[]));
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'resident')
      .order('full_name')
      .then(({ data }) => setResidents((data ?? []) as ResidentOption[]));
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!driveId || !residentId) {
      toast.showError('Select a drive and a resident.');
      return;
    }
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const comorbsArray = comorbidities
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    // The register_for_drive RPC uses auth.uid() internally as the registrant, so this
    // creates the registration under the signed-in admin's own account rather than the
    // selected resident's — acceptable for now since drive_registrations has no
    // "registered_by" field; the resident dropdown is kept for future admin-on-behalf-of
    // support once the RPC accepts an explicit target user.
    const { error } = await supabase.rpc('register_for_drive', {
      p_drive_id: driveId,
      p_age: age,
      p_is_pwd: isPwd === 'true',
      p_comorbidities: comorbsArray,
      p_prior_dose_date: priorDoseDate || null,
    });
    setSubmitting(false);
    if (error) {
      toast.showError(`Failed to register: ${error.message}`);
      return;
    }
    toast.showSuccess('Registration created.');
    setDriveId('');
    setResidentId('');
    setAge(30);
    setIsPwd('false');
    setComorbidities('');
    setPriorDoseDate('');
    setOpen(false);
    router.refresh();
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mb-4 rounded-full bg-[#0F6E5B] px-4 py-1.5 text-sm font-semibold text-white">
        + Add Registration
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900 sm:grid-cols-3">
      <label className="text-sm">
        <span className="mb-1 block font-medium">Drive</span>
        <select className={inputClass} value={driveId} onChange={(e) => setDriveId(e.target.value)} required>
          <option value="">Select a drive…</option>
          {drives.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title} — {d.drive_date}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Resident</span>
        <select className={inputClass} value={residentId} onChange={(e) => setResidentId(e.target.value)} required>
          <option value="">Select a resident…</option>
          {residents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Age</span>
        <input
          type="number"
          min={0}
          max={130}
          className={inputClass}
          value={age}
          onChange={(e) => setAge(Number(e.target.value))}
          required
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Is PWD</span>
        <select className={inputClass} value={isPwd} onChange={(e) => setIsPwd(e.target.value)}>
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Comorbidities</span>
        <input
          className={inputClass}
          value={comorbidities}
          onChange={(e) => setComorbidities(e.target.value)}
          placeholder="diabetes, hypertension"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Prior Dose Date</span>
        <input type="date" className={inputClass} value={priorDoseDate} onChange={(e) => setPriorDoseDate(e.target.value)} />
      </label>
      <div className="flex items-end gap-2 sm:col-span-3">
        <button
          type="submit"
          disabled={submitting || !driveId || !residentId}
          className="rounded-full bg-[#0F6E5B] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Registering…' : 'Register'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold dark:bg-zinc-700">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ApplicantsTable({ rows }: { rows: ApplicantRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<ApplicantRow | null>(null);
  // Unique per mount — see drive-table.tsx's channelName comment for why.
  const [channelName] = useState(() => `admin-drive-registrations-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drive_registrations' }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, router]);

  async function updateField(row: ApplicantRow, patch: Partial<Tables<'drive_registrations'>>) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('drive_registrations').update(patch).eq('id', row.id);
    if (!error) router.refresh();
    return { error: error?.message ?? null };
  }

  async function cancelRegistration(row: ApplicantRow) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('drive_registrations').update({ status: 'cancelled' }).eq('id', row.id);
    if (error) {
      toast.showError(`Failed to cancel: ${error.message}`);
      return;
    }
    toast.showSuccess('Registration cancelled.');
    router.refresh();
  }

  const columns: EditableDataTableColumn<ApplicantRow>[] = [
    {
      header: 'Applicant #',
      render: (r) => <span className="font-mono text-xs">{r.applicant_number}</span>,
    },
    {
      header: 'Drive',
      className: 'max-w-xs',
      render: (r) => (
        <div>
          <p className="font-semibold leading-snug">{r.medical_drives?.title ?? '—'}</p>
          {r.medical_drives && (
            <span className="mt-0.5 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {formatDriveDate(r.medical_drives.drive_date)}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Resident',
      render: (r) => r.profiles?.full_name ?? '—',
    },
    {
      header: 'Age',
      render: (r) => r.age,
      edit: {
        type: 'number',
        getValue: (r) => r.age,
        onSave: (r, value) => {
          const next = Number(value);
          if (!Number.isFinite(next) || next < 0 || next > 130) {
            return Promise.resolve({ error: 'Enter an age between 0 and 130.' });
          }
          return updateField(r, { age: Math.trunc(next) });
        },
      },
    },
    {
      header: 'PWD',
      render: (r) => (r.is_pwd ? 'Yes' : 'No'),
      edit: {
        type: 'select',
        options: [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ],
        getValue: (r) => String(r.is_pwd),
        onSave: (r, value) => updateField(r, { is_pwd: value === 'true' }),
      },
    },
    {
      header: 'Priority Score',
      render: (r) => (
        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {r.priority_score}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (r) => <StatusPill status={r.status} />,
      edit: {
        type: 'select',
        options: STATUS_OPTIONS,
        getValue: (r) => r.status,
        onSave: (r, value) => updateField(r, { status: String(value) as ApplicantRow['status'] }),
      },
    },
    {
      header: 'Registered At',
      render: (r) => formatDateTimeShort(r.created_at),
    },
    {
      header: 'Actions',
      render: (r) => (
        <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setSelected(r)} className="rounded-full px-2 py-1 text-xs font-medium text-[#0F6E5B] hover:underline">
            View
          </button>
          <ConfirmButton
            label="🚫"
            confirmLabel="Cancel?"
            onConfirm={() => cancelRegistration(r)}
            title="Cancel registration"
            className="rounded-full px-2 py-1 text-zinc-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300"
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <AddApplicantForm />
      <EditableDataTable rows={rows} rowKey={(r) => r.id} emptyLabel="No registrations found." columns={columns} onRowClick={setSelected} />

      {selected && (
        <ApplicantDetailModal
          row={selected}
          onClose={() => setSelected(null)}
          onSave={(updated) => setSelected(updated)}
        />
      )}
    </>
  );
}
