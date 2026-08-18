'use client';

import { formatDateTime } from '@barangayan/shared';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { formatDriveDate } from '../drive-table';
import { StatusPill } from './applicants-table';
import type { ApplicantRow } from './page';

const STATUS_OPTIONS = ['pending', 'confirmed', 'attended', 'cancelled'] as const;

/** Full-detail modal for an applicant registration — mirrors drive-detail-modal.tsx.
 * `applicant_number` and `priority_score` are server-computed by register_for_drive
 * and stay read-only here in both read and edit mode. */
export function ApplicantDetailModal({
  row,
  onClose,
  onSave,
}: {
  row: ApplicantRow;
  onClose: () => void;
  onSave: (updated: ApplicantRow) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [age, setAge] = useState(row.age);
  const [isPwd, setIsPwd] = useState(String(row.is_pwd));
  const [comorbidities, setComorbidities] = useState(row.comorbidities.join(', '));
  const [priorDoseDate, setPriorDoseDate] = useState(row.prior_dose_date ?? '');
  const [status, setStatus] = useState(row.status);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function saveDetails() {
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const comorbsArray = comorbidities
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const patch = {
      age: Math.trunc(age),
      is_pwd: isPwd === 'true',
      comorbidities: comorbsArray,
      prior_dose_date: priorDoseDate || null,
      status,
    };
    const { error } = await supabase.from('drive_registrations').update(patch).eq('id', row.id);
    setSaving(false);
    if (error) {
      toast.showError(`Failed to save: ${error.message}`);
      return;
    }
    toast.showSuccess('Registration updated.');
    setEditing(false);
    onSave({ ...row, ...patch });
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Applicant details: ${row.applicant_number}`}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-black/10 px-6 py-4 dark:border-white/10">
          <div className="flex-1">
            <h2 className="font-mono text-lg font-bold leading-snug">{row.applicant_number}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <StatusPill status={row.status} />
              {row.is_pwd && (
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  PWD
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Registration Details</p>
              {!editing && (
                <button
                  onClick={() => {
                    setAge(row.age);
                    setIsPwd(String(row.is_pwd));
                    setComorbidities(row.comorbidities.join(', '));
                    setPriorDoseDate(row.prior_dose_date ?? '');
                    setStatus(row.status);
                    setEditing(true);
                  }}
                  className="text-xs font-semibold text-[var(--accent)] hover:underline">
                  Edit
                </button>
              )}
            </div>

            {!editing ? (
              <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Drive</p>
                  <p>
                    {row.medical_drives?.title ?? '—'}
                    {row.medical_drives ? ` · ${formatDriveDate(row.medical_drives.drive_date)} · ${row.medical_drives.location}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Resident</p>
                  <p>{row.profiles?.full_name ?? '—'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Age</p>
                    <p>{row.age}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">PWD</p>
                    <p>{row.is_pwd ? 'Yes' : 'No'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Comorbidities</p>
                  {row.comorbidities.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {row.comorbidities.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p>—</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Prior Dose Date</p>
                  <p>{row.prior_dose_date ? formatDriveDate(row.prior_dose_date) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Priority Score</p>
                  <p>{row.priority_score}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Age</span>
                    <input
                      type="number"
                      min={0}
                      max={130}
                      className={inputClass}
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value))}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">PWD</span>
                    <select className={inputClass} value={isPwd} onChange={(e) => setIsPwd(e.target.value)}>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </label>
                </div>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Comorbidities (comma-separated)</span>
                  <input className={inputClass} value={comorbidities} onChange={(e) => setComorbidities(e.target.value)} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Prior Dose Date</span>
                    <input type="date" className={inputClass} value={priorDoseDate} onChange={(e) => setPriorDoseDate(e.target.value)} />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Status</span>
                    <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ApplicantRow['status'])}>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Applicant # (read-only)</span>
                  <input className={inputClass} value={row.applicant_number} disabled />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Priority Score (read-only)</span>
                  <input className={inputClass} value={row.priority_score} disabled />
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={saveDetails}
                    disabled={saving}
                    className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="rounded-full bg-zinc-200 px-4 py-1.5 text-xs font-semibold dark:bg-zinc-700">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="grid grid-cols-2 gap-3 text-xs text-zinc-500">
            <div>
              <p className="font-semibold uppercase tracking-wide">Registered at</p>
              <p>{formatDateTime(row.created_at)}</p>
            </div>
            {row.updated_at !== row.created_at && (
              <div>
                <p className="font-semibold uppercase tracking-wide">Last updated</p>
                <p>{formatDateTime(row.updated_at)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
