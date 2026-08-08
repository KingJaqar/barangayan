'use client';

import { DRIVE_TYPE_CONFIG, DRIVE_TYPES, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { DriveDetailModal } from './drive-detail-modal';
import type { DriveRow } from './page';

export function DriveTypeBadge({ type }: { type: string }) {
  const cfg = DRIVE_TYPE_CONFIG[type as keyof typeof DRIVE_TYPE_CONFIG];
  if (!cfg) return <span className="text-zinc-400">{type}</span>;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// `new Date('2026-08-10')` parses as UTC midnight, so formatting it in a
// non-UTC-local server timezone can print the wrong day (the same pitfall the mobile
// Health screen's parseLocalDate avoids). drive_date is a plain YYYY-MM-DD, so build
// the Date from its parts directly rather than routing it through formatDate.
export function formatDriveDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(y, m - 1, d, 12));
}

function currentDateISO() {
  const t = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

function AddDriveForm({ barangayId }: { barangayId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<(typeof DRIVE_TYPES)[number]>('vaccination');
  const [driveDate, setDriveDate] = useState(currentDateISO);
  const [timeStart, setTimeStart] = useState('08:00');
  const [timeEnd, setTimeEnd] = useState('17:00');
  const [location, setLocation] = useState('Barangay Health Center');
  const [eligibleCriteria, setEligibleCriteria] = useState('');
  const [stockLabel, setStockLabel] = useState('Remaining Slots');
  const [stockUnit, setStockUnit] = useState('slots');
  const [stockTotal, setStockTotal] = useState(50);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.showError('Drive title is required.');
      return;
    }
    if (!eligibleCriteria.trim()) {
      toast.showError('Eligibility criteria is required.');
      return;
    }
    if (!Number.isFinite(stockTotal) || stockTotal <= 0) {
      toast.showError('Stock total must be a positive number.');
      return;
    }
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('medical_drives').insert({
      barangay_id: barangayId,
      title: title.trim(),
      type,
      drive_date: driveDate,
      time_start: timeStart,
      time_end: timeEnd,
      location: location.trim() || 'Barangay Health Center',
      eligible_criteria: eligibleCriteria.trim(),
      stock_label: stockLabel.trim() || 'Remaining Slots',
      stock_unit: stockUnit.trim() || 'slots',
      stock_total: Math.trunc(stockTotal),
      stock_remaining: Math.trunc(stockTotal),
      is_active: true,
    });
    setSubmitting(false);
    if (error) {
      toast.showError(`Failed to create drive: ${error.message}`);
      return;
    }
    toast.showSuccess('Medical drive created.');
    setTitle('');
    setType('vaccination');
    setDriveDate(currentDateISO());
    setTimeStart('08:00');
    setTimeEnd('17:00');
    setLocation('Barangay Health Center');
    setEligibleCriteria('');
    setStockLabel('Remaining Slots');
    setStockUnit('slots');
    setStockTotal(50);
    setOpen(false);
    router.refresh();
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={!barangayId}
        className="mb-4 rounded-full bg-[#0F6E5B] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
        + Add Drive
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900 sm:grid-cols-3">
      <label className="text-sm sm:col-span-3">
        <span className="mb-1 block font-medium">Title</span>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Category</span>
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          {DRIVE_TYPES.map((t) => (
            <option key={t} value={t}>
              {DRIVE_TYPE_CONFIG[t].label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Date</span>
        <input type="date" className={inputClass} value={driveDate} onChange={(e) => setDriveDate(e.target.value)} required />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Location</span>
        <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Time Start</span>
        <input type="time" className={inputClass} value={timeStart} onChange={(e) => setTimeStart(e.target.value)} required />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Time End</span>
        <input type="time" className={inputClass} value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} required />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Stock Total</span>
        <input
          type="number"
          min={1}
          className={inputClass}
          value={stockTotal}
          onChange={(e) => setStockTotal(Number(e.target.value))}
          required
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Stock Unit</span>
        <input className={inputClass} value={stockUnit} onChange={(e) => setStockUnit(e.target.value)} placeholder="doses, slots…" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Stock Label</span>
        <input className={inputClass} value={stockLabel} onChange={(e) => setStockLabel(e.target.value)} placeholder="Remaining Slots" />
      </label>
      <label className="text-sm sm:col-span-3">
        <span className="mb-1 block font-medium">Eligibility Criteria</span>
        <input className={inputClass} value={eligibleCriteria} onChange={(e) => setEligibleCriteria(e.target.value)} required />
      </label>
      <div className="flex items-end gap-2 sm:col-span-3">
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="rounded-full bg-[#0F6E5B] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Creating…' : 'Create Drive'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold dark:bg-zinc-700">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Interactive drives table — inline-editable cells for Category, Date, Stock, and
 * Active status (same click-to-edit pattern as Incident Reports' EditableDataTable).
 * Click the Drive cell to open the full-detail modal (title, location, time,
 * eligibility, stock label/unit). Action buttons stop click propagation so they don't
 * also open the modal. */
export function DriveTable({ rows, barangayId }: { rows: DriveRow[]; barangayId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<DriveRow | null>(null);
  // Unique per mount — see incident-reports/incident-table.tsx's channelName comment for why.
  const [channelName] = useState(() => `admin-medical-drives-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_drives' }, () => router.refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, channelName]);

  async function updateField(drive: DriveRow, patch: Partial<Tables<'medical_drives'>>) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('medical_drives').update(patch).eq('id', drive.id);
    if (!error) router.refresh();
    return { error: error?.message ?? null };
  }

  async function removeDrive(drive: DriveRow) {
    const supabase = createSupabaseBrowserClient();
    // No soft_delete RPC exists for medical_drives (unlike incidents) — the 0036 admin
    // update policy covers a plain soft-delete via deleted_at directly.
    const { error } = await supabase.from('medical_drives').update({ deleted_at: new Date().toISOString() }).eq('id', drive.id);
    if (error) {
      toast.showError(`Failed to remove drive: ${error.message}`);
      return;
    }
    toast.showSuccess('Drive removed.');
    router.refresh();
  }

  const columns: EditableDataTableColumn<DriveRow>[] = [
    {
      header: 'Drive',
      className: 'max-w-xs',
      render: (r) => (
        <div>
          <p className="font-semibold leading-snug">{r.title}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">{r.location}</p>
        </div>
      ),
      // Long-form fields (title, location, time, eligibility, stock label/unit) are
      // edited via the detail modal's form rather than a cramped inline text cell.
    },
    {
      header: 'Category',
      render: (r) => <DriveTypeBadge type={r.type} />,
      edit: {
        type: 'select',
        options: DRIVE_TYPES.map((t) => ({ value: t, label: DRIVE_TYPE_CONFIG[t].label })),
        getValue: (r) => r.type,
        onSave: (r, value) => updateField(r, { type: String(value) }),
      },
    },
    {
      header: 'Date',
      render: (r) => formatDriveDate(r.drive_date),
      edit: {
        type: 'date',
        getValue: (r) => r.drive_date,
        onSave: (r, value) => updateField(r, { drive_date: String(value) }),
      },
    },
    {
      header: 'Stock',
      render: (r) => (
        <span
          className={[
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
            r.stock_remaining > 0 ? 'bg-[#0F6E5B]/15 text-[#0F6E5B]' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
          ].join(' ')}>
          {r.stock_remaining}/{r.stock_total} {r.stock_unit}
        </span>
      ),
      edit: {
        type: 'number',
        getValue: (r) => r.stock_remaining,
        onSave: (r, value) => {
          const next = Number(value);
          if (!Number.isFinite(next) || next < 0 || next > r.stock_total) {
            return Promise.resolve({ error: `Enter a number between 0 and ${r.stock_total}.` });
          }
          return updateField(r, { stock_remaining: Math.trunc(next) });
        },
      },
    },
    {
      header: 'Registrations',
      render: (r) => (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          👥 {r.registration_count}
        </span>
      ),
    },
    {
      header: 'Active',
      render: (r) =>
        r.is_active ? (
          <span className="inline-flex items-center rounded-full bg-[#0F6E5B]/15 px-2.5 py-1 text-xs font-semibold text-[#0F6E5B]">Active</span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
            Inactive
          </span>
        ),
      edit: {
        type: 'select',
        options: [
          { value: 'true', label: 'Active' },
          { value: 'false', label: 'Inactive' },
        ],
        getValue: (r) => String(r.is_active),
        onSave: (r, value) => updateField(r, { is_active: value === 'true' }),
      },
    },
    {
      header: 'Actions',
      // Stop propagation so the surrounding EditableDataTable's onRowClick doesn't
      // also fire and reopen the modal underneath these buttons.
      render: (r) => (
        <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setSelected(r)} className="rounded-full px-2 py-1 text-xs font-medium text-[#0F6E5B] hover:underline">
            View
          </button>
          <ConfirmButton
            label="🗑"
            confirmLabel="Remove?"
            onConfirm={() => removeDrive(r)}
            title="Remove"
            className="rounded-full px-2 py-1 text-zinc-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300"
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <AddDriveForm barangayId={barangayId} />
      <EditableDataTable rows={rows} rowKey={(r) => r.id} emptyLabel="No medical drives found." columns={columns} onRowClick={setSelected} />

      {selected && <DriveDetailModal drive={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
