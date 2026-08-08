'use client';

import { formatDateTime } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { DriveTypeBadge, formatDriveDate } from './drive-table';
import type { DriveRow } from './page';

/** "HH:MM:SS" (or "HH:MM") -> "8:00 AM" */
function fmt12h(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${period}`;
}

/** Full-detail modal — the long-form fields (location, time window, eligibility,
 * stock label/unit) that don't fit a table cell. Category, Date, Stock counts, and
 * Active are all edited inline in the table itself (click any cell), so this modal
 * focuses on those and a read-only summary of the rest. Closes on Escape or backdrop
 * click — mirrors incident-reports/incident-detail-modal.tsx. */
export function DriveDetailModal({ drive, onClose }: { drive: DriveRow; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(drive.title);
  const [location, setLocation] = useState(drive.location);
  const [timeStart, setTimeStart] = useState(drive.time_start.slice(0, 5));
  const [timeEnd, setTimeEnd] = useState(drive.time_end.slice(0, 5));
  const [eligibleCriteria, setEligibleCriteria] = useState(drive.eligible_criteria);
  const [stockLabel, setStockLabel] = useState(drive.stock_label);
  const [stockUnit, setStockUnit] = useState(drive.stock_unit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function saveDetails() {
    if (!title.trim()) {
      toast.showError('Title cannot be empty.');
      return;
    }
    if (!eligibleCriteria.trim()) {
      toast.showError('Eligibility criteria cannot be empty.');
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('medical_drives')
      .update({
        title: title.trim(),
        location: location.trim() || 'Barangay Health Center',
        time_start: timeStart,
        time_end: timeEnd,
        eligible_criteria: eligibleCriteria.trim(),
        stock_label: stockLabel.trim() || 'Remaining Slots',
        stock_unit: stockUnit.trim() || 'slots',
      })
      .eq('id', drive.id);
    setSaving(false);
    if (error) {
      toast.showError(`Failed to save: ${error.message}`);
      return;
    }
    toast.showSuccess('Drive details updated.');
    setEditing(false);
    router.refresh();
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Drive details: ${drive.title}`}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-black/10 px-6 py-4 dark:border-white/10">
          <div className="flex-1">
            {!editing ? (
              <h2 className="text-lg font-bold leading-snug">{drive.title}</h2>
            ) : (
              <input autoFocus className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Drive title" />
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <DriveTypeBadge type={drive.type} />
              {drive.is_active ? (
                <span className="inline-flex items-center rounded-full bg-[#0F6E5B]/15 px-2.5 py-1 text-xs font-semibold text-[#0F6E5B]">Active</span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
                  Inactive
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                👥 {drive.registration_count} registered
              </span>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Drive Details</p>
              {!editing && (
                <button
                  onClick={() => {
                    setTitle(drive.title);
                    setLocation(drive.location);
                    setTimeStart(drive.time_start.slice(0, 5));
                    setTimeEnd(drive.time_end.slice(0, 5));
                    setEligibleCriteria(drive.eligible_criteria);
                    setStockLabel(drive.stock_label);
                    setStockUnit(drive.stock_unit);
                    setEditing(true);
                  }}
                  className="text-xs font-semibold text-[#0F6E5B] hover:underline">
                  Edit
                </button>
              )}
            </div>

            {!editing ? (
              <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Location</p>
                  <p>{drive.location}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Time</p>
                  <p>
                    {fmt12h(drive.time_start)} – {fmt12h(drive.time_end)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Eligibility Criteria</p>
                  <p className="leading-relaxed">{drive.eligible_criteria}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Stock Label / Unit</p>
                  <p>
                    {drive.stock_label} ({drive.stock_unit})
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Location</span>
                  <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Time Start</span>
                    <input type="time" className={inputClass} value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Time End</span>
                    <input type="time" className={inputClass} value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
                  </label>
                </div>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Eligibility Criteria</span>
                  <textarea
                    className={`${inputClass} min-h-20 resize-y`}
                    value={eligibleCriteria}
                    onChange={(e) => setEligibleCriteria(e.target.value)}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Stock Label</span>
                    <input className={inputClass} value={stockLabel} onChange={(e) => setStockLabel(e.target.value)} />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Stock Unit</span>
                    <input className={inputClass} value={stockUnit} onChange={(e) => setStockUnit(e.target.value)} />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveDetails}
                    disabled={saving}
                    className="rounded-full bg-[#0F6E5B] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
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
            <p className="mt-2 text-xs text-zinc-400">
              To change the category, date, stock counts, or active status, use the matching cell in the table.
            </p>
          </div>

          {/* Timeline */}
          <div className="grid grid-cols-2 gap-3 text-xs text-zinc-500">
            <div>
              <p className="font-semibold uppercase tracking-wide">Drive Date</p>
              <p>{formatDriveDate(drive.drive_date)}</p>
            </div>
            {drive.updated_at !== drive.created_at && (
              <div>
                <p className="font-semibold uppercase tracking-wide">Last updated</p>
                <p>{formatDateTime(drive.updated_at)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
