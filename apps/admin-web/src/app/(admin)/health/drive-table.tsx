'use client';

import { DRIVE_TYPE_CONFIG, DRIVE_TYPES, type Tables } from '@barangayan/shared';
import { Eye, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { OperationsTableSummary } from '@/components/admin/operations-table-summary';
import { ProfileTablePanel } from '@/components/admin/profile-table-panel';
import { SegmentedFilter } from '@/components/admin/segmented-filter';
import { useConfiguredTableBrowse } from '@/hooks/use-pilot-table-browse';
import { useProfileTableDetail } from '@/hooks/use-profile-table-detail';
import { operationsConfig } from '@/lib/admin-tables/operations-config';
import type { BrowseResult, BrowseState } from '@/lib/admin-tables/browse-state';
import type { QueryOutcome, Summary } from '@/lib/admin-tables/queries/browse';
import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { DriveDetailModal } from './drive-detail-modal';
import type { DriveRow } from './types';
import { TABS } from './types';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { formContainerClass, inputClass, submitButtonClass, cancelButtonClass } from '@/components/admin/form-styles';

export function DriveTypeBadge({ type }: { type: string }) {
  const cfg = DRIVE_TYPE_CONFIG[type as keyof typeof DRIVE_TYPE_CONFIG];
  if (!cfg) return <span className="text-zinc-400">{type}</span>;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}
    >
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

function AddDriveForm({ barangayId, onClose, onChanged }: { barangayId: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
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
    const { data, error } = await supabase
      .from('medical_drives')
      .insert({
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
      })
      .select(
        'id, title, type, drive_date, time_start, time_end, location, eligible_criteria, stock_label, stock_unit, stock_total, stock_remaining, is_active',
      )
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.showError(`Failed to create drive: ${error?.message ?? 'The created drive could not be confirmed.'}`);
      return;
    }

    logAdminAction({
      action: 'create',
      entityType: 'medical_drive',
      entityId: data?.id,
      entityLabel: title.trim(),
      metadata: {
        title: title.trim(),
        type,
        drive_date: driveDate,
        time_start: timeStart,
        time_end: timeEnd,
        location: location.trim() || 'Barangay Health Center',
        eligible_criteria: eligibleCriteria.trim(),
        stock_total: Math.trunc(stockTotal),
      },
    }).catch(() => {});

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
    onClose();
    onChanged();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`${formContainerClass} mb-6 grid-cols-1 sm:grid-cols-3`}
    >
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
          className={submitButtonClass}
          aria-busy={submitting}>
          <LoadingButtonContent pending={submitting} pendingLabel="Creating…">Create Drive</LoadingButtonContent>
        </button>
        <button type="button" onClick={onClose} className={cancelButtonClass}>
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
export function DriveTable({ result, summary, requestedState, barangayId }: {
  result: QueryOutcome<BrowseResult<DriveRow>>; summary: QueryOutcome<Summary>; requestedState: BrowseState;
  barangayId: string;
}) {
  const toast = useToast();
  const config = useMemo(() => operationsConfig('health'), []);
  const browse = useConfiguredTableBrowse(config, requestedState, result, true);
  const { state, value } = browse;
  const activeSort = config.sorts.find(sort => sort.key === state.sort)!;
  const { selected: selectedDetail, status: detailStatus, open: openDetail, close: closeDetail, retry: retryDetail, containerRef } = useProfileTableDetail<DriveRow>('health', result, browse.settle);
  const [addOpen, setAddOpen] = useState(false);
  const [channelName] = useState(() => 'admin-health-' + Math.random().toString(36).slice(2));
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_drives' }, browse.refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [channelName, browse.refresh]);

  async function updateField(drive: DriveRow, patch: Partial<Tables<'medical_drives'>>) {
    // Skip logging (but still write) when nothing actually changed — e.g. a cell
    // clicked into and blurred without editing.
    const patchKeys = Object.keys(patch) as (keyof typeof patch)[];
    const changed = patchKeys.some((key) => patch[key] !== drive[key]);

    if (!changed) return { error: null };

    const supabase = createSupabaseBrowserClient();
    const { data: updated, error } = await supabase
      .from('medical_drives')
      .update(patch)
      .eq('id', drive.id)
      .select('id, type, drive_date, stock_remaining, is_active')
      .maybeSingle();
    if (error) return { error: error.message };
    if (!updated) return { error: 'No medical drive was updated. Check that you still have access to this barangay.' };

    browse.refresh();
    const isStatusChange = patchKeys.length === 1 && patchKeys[0] === 'is_active';
    const before = Object.fromEntries(patchKeys.map((key) => [key, drive[key]]));
    logAdminAction({
      action: isStatusChange ? 'status_change' : 'update',
      entityType: 'medical_drive',
      entityId: updated.id,
      entityLabel: drive.title,
      changes: { before, after: patch },
    }).catch(() => {});
    return { error: null };
  }

  async function removeDrive(drive: DriveRow) {
    if (!await browse.settle()) return;
    const supabase = createSupabaseBrowserClient();
    // No soft_delete RPC exists for medical_drives (unlike incidents) — the 0036 admin
    // update policy covers a plain soft-delete via deleted_at directly.
    const { data: removed, error } = await supabase
      .from('medical_drives')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', drive.id)
      .select('id')
      .maybeSingle();
    if (error) {
      toast.showError(`Failed to remove drive: ${error.message}`);
      return;
    }
    if (!removed) {
      toast.showError('Failed to remove drive: no medical drive was updated. Check that you still have access to this barangay.');
      return;
    }

    logAdminAction({
      action: 'delete',
      entityType: 'medical_drive',
      entityId: drive.id,
      entityLabel: drive.title,
      metadata: {
        title: drive.title,
        type: drive.type,
        drive_date: drive.drive_date,
        location: drive.location,
      },
    }).catch(() => {});

    toast.showSuccess('Drive removed.');
    browse.refresh();
  }

  const columns: EditableDataTableColumn<DriveRow>[] = [
    {
      id: 'title', header: 'Drive',
      initialWidth: 270,
      minWidth: 220,
      wrap: 'break-word',
      className: 'leading-snug',
      render: (r) => (
        <div>
          <p className="font-semibold leading-snug">{r.title}</p>
          <p className="mt-0.5 text-xs leading-snug text-zinc-500 dark:text-zinc-400">{r.location}</p>
        </div>
      ),
      // Long-form fields (title, location, time, eligibility, stock label/unit) are
      // edited via the detail modal's form rather than a cramped inline text cell.
    },
    {
      id: 'category', header: 'Category',
      initialWidth: 150,
      minWidth: 136,
      wrap: 'nowrap',
      render: (r) => <DriveTypeBadge type={r.type} />,
      edit: {
        type: 'select',
        options: DRIVE_TYPES.map((t) => ({ value: t, label: DRIVE_TYPE_CONFIG[t].label })),
        getValue: (r) => r.type,
        onSave: (r, value) => updateField(r, { type: value as (typeof DRIVE_TYPES)[number] }),
        commitOnChange: true,
      },
    },
    {
      id: 'drive_date', header: 'Drive date',
      initialWidth: 142,
      minWidth: 132,
      wrap: 'nowrap',
      render: (r) => formatDriveDate(r.drive_date),
      edit: {
        type: 'date',
        getValue: (r) => r.drive_date,
        onSave: (r, value) => updateField(r, { drive_date: String(value) }),
      },
    },
    {
      id: 'stock', header: 'Stock',
      initialWidth: 160,
      minWidth: 144,
      wrap: 'nowrap',
      render: (r) => (
        <span
          className={[
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
            r.stock_remaining > 0 ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
          ].join(' ')}
        >
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
      id: 'registrations', header: 'Registrations',
      initialWidth: 138,
      minWidth: 126,
      wrap: 'nowrap',
      render: (r) => (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <span aria-hidden="true">👥 </span><span className="tabular-nums">{r.registration_count}</span>
        </span>
      ),
    },
    {
      id: 'active', header: 'Active',
      initialWidth: 118,
      minWidth: 108,
      wrap: 'nowrap',
      render: (r) =>
        r.is_active ? (
          <span className="inline-flex items-center rounded-full bg-[var(--accent)]/15 px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
            Active
          </span>
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
        commitOnChange: true,
      },
    },
    {
      header: 'Actions',
      initialWidth: 112,
      minWidth: 104,
      wrap: 'nowrap',
      overflow: 'visible',
      // Stop propagation so the surrounding EditableDataTable's onRowClick doesn't
      // also fire and reopen the modal underneath these buttons.
      render: (r) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={event => void openDetail(r, event.currentTarget)}
            title={`View ${r.title}`}
            aria-label={`View ${r.title}`}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            <Eye aria-hidden="true" className="h-4 w-4" />
          </button>
          <ConfirmButton
            label={<Trash2 aria-hidden="true" className="h-4 w-4" />}
            confirmLabel="Remove?"
            onConfirm={() => removeDrive(r)}
            title={`Remove ${r.title}`}
            ariaLabel={`Remove ${r.title}`}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:bg-red-900/30 dark:hover:text-red-300 dark:focus-visible:ring-offset-zinc-900"
          />
        </div>
      ),
    },
  ];

  return <div ref={containerRef}>
    <OperationsTableSummary name="health" summary={summary} onRetry={browse.refresh} />
    
    {addOpen && <fieldset disabled={browse.pending}><AddDriveForm barangayId={barangayId} onClose={() => setAddOpen(false)} onChanged={browse.refresh} /></fieldset>}
    <ProfileTablePanel label="Medical drives" browse={browse} 
      category={<label className="table-browse-field">Category
        <select aria-label="Category" value={state.filters.type} onChange={event => void browse.commit({ filters: { type: event.target.value } })}>
          <option value="">All categories</option>
          {DRIVE_TYPES.map(type => <option key={type} value={type}>{DRIVE_TYPE_CONFIG[type].label}</option>)}
        </select></label>}
      filters={<SegmentedFilter label="Drive schedule" options={TABS.map(tab => ({ value: tab.key, label: tab.label }))}
        value={state.filters.tab} onChange={tab => void browse.commit({ filters: { tab } })} />}
      actions={<button type="button" onClick={async () => { if (await browse.settle()) setAddOpen(true); }}
        disabled={browse.pending || !barangayId}>+ Add Drive</button>}>
      <EditableDataTable rows={value?.rows ?? []} rowKey={row => row.id} columns={columns}
        emptyLabel="No medical drives found."
        onRowClick={(row, trigger) => void openDetail(row, trigger)} resizableColumns pinLastColumn density="compact"
        tableMinWidth={900} cellOverflow="hidden"
        editHandleRef={browse.editHandle} onEditingChange={browse.onEditingChange}
        sorting={{ descriptor: activeSort, direction: state.dir, choices: config.sorts,
          onChange: (sort, dir) => void browse.commit({ sort, dir }) }} />
    </ProfileTablePanel>
    {selectedDetail && <DriveDetailModal drive={selectedDetail} key={selectedDetail.id}
      detailStatus={detailStatus} onRetry={retryDetail} onClose={closeDetail}
      onChanged={browse.refresh} onEditingChange={browse.onEditingChange} />}
  </div>;
}
