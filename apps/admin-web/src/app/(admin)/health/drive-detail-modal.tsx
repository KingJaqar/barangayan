'use client';

import { formatAdminTimestamp as formatDateTime } from '@/lib/admin-tables/pilot-config';
import { useEffect, useRef, useState } from 'react';

import { TableDetailDialog, TableDetailState } from '@/components/admin/table-detail-dialog';
import { logAdminAction } from '@/actions/admin-audit-actions';
import { beginAttempt, notify as toast } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { DriveTypeBadge, formatDriveDate } from './drive-table';
import type { DriveRow } from './types';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';

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
export function DriveDetailModal({ drive, onClose, onChanged, onEditingChange, detailStatus, onRetry }: {
  drive: DriveRow; onClose: () => void; onChanged: () => void; onEditingChange: (editing: boolean) => void;
  detailStatus: 'loading' | 'ready' | 'error' | 'unavailable'; onRetry: () => void;
}) {

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(drive.title);
  const [location, setLocation] = useState(drive.location);
  const [timeStart, setTimeStart] = useState(drive.time_start.slice(0, 5));
  const [timeEnd, setTimeEnd] = useState(drive.time_end.slice(0, 5));
  const [eligibleCriteria, setEligibleCriteria] = useState(drive.eligible_criteria);
  const [stockLabel, setStockLabel] = useState(drive.stock_label);
  const [stockUnit, setStockUnit] = useState(drive.stock_unit);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    onEditingChange(editing);
    return () => onEditingChange(false);
  }, [editing, onEditingChange]);

  async function saveDetails() {
    const toastAttempt = beginAttempt('saveDetails');
    if (savingRef.current) return;
    if (!title.trim()) {
      toast.error('Title cannot be empty.', { id: toastAttempt });
      return;
    }
    if (!eligibleCriteria.trim()) {
      toast.error('Eligibility criteria cannot be empty.', { id: toastAttempt });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const newValues = {
      title: title.trim(),
      location: location.trim() || 'Barangay Health Center',
      time_start: timeStart,
      time_end: timeEnd,
      eligible_criteria: eligibleCriteria.trim(),
      stock_label: stockLabel.trim() || 'Remaining Slots',
      stock_unit: stockUnit.trim() || 'slots',
    };
    let result;
    try { result = await supabase.from('medical_drives').update(newValues).eq('id', drive.id).select('id').maybeSingle(); }
    catch (cause) {
      savingRef.current = false; setSaving(false);
      toast.error(`Failed to save: ${cause instanceof Error ? cause.message : 'The update could not be completed.'}`, { id: toastAttempt }); return;
    }
    savingRef.current = false; setSaving(false);
    const { error, data: updated } = result;
    if (error || !updated) {
      toast.error(`Failed to save: ${error?.message ?? 'No record was updated. Check your access.'}`, { id: toastAttempt });
      return;
    }

    logAdminAction({
      action: 'update',
      entityType: 'medical_drive',
      entityId: drive.id,
      entityLabel: newValues.title,
      changes: {
        before: {
          title: drive.title,
          location: drive.location,
          time_start: drive.time_start,
          time_end: drive.time_end,
          eligible_criteria: drive.eligible_criteria,
          stock_label: drive.stock_label,
          stock_unit: drive.stock_unit,
        },
        after: newValues,
      },
    }).catch(() => {});

    toast.success('Drive details updated.', { id: toastAttempt });
    setEditing(false);
    onChanged();
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <TableDetailDialog label={`Drive details: ${drive.title}`}
      preventClose={saving} onClose={() => { if (!savingRef.current) onClose(); }}>
      {detailStatus !== 'ready' && !editing ? <TableDetailState status={detailStatus} onClose={onClose} onRetry={onRetry} /> :
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
        {/* Header */}
        <div className="flex max-h-[40vh] shrink-0 items-start justify-between gap-3 overflow-y-auto border-b border-black/10 px-6 py-4 dark:border-white/10">
          <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
            {!editing ? (
              <h2 className="text-lg font-bold leading-snug">{drive.title}</h2>
            ) : (
              <input autoFocus className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Drive title" />
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <DriveTypeBadge type={drive.type} />
              {drive.is_active ? (
                <span className="inline-flex items-center rounded-full bg-[var(--accent)]/15 px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">Active</span>
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
            disabled={saving}
            aria-label="Close"
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto break-words [overflow-wrap:anywhere] px-6 py-4">
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
                  className="text-xs font-semibold text-[var(--accent)] hover:underline">
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
                    className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    aria-busy={saving}>
                    <LoadingButtonContent pending={saving} pendingLabel="Saving…">Save</LoadingButtonContent>
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

          <div className="mb-3 text-xs text-zinc-500"><p className="font-semibold uppercase tracking-wide">Date created</p>
            <p>{formatDateTime(drive.created_at)}</p></div>
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
      </div>}
    </TableDetailDialog>
  );
}
