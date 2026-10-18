'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import { RecordArchiveLink, useRecordWorkspace } from '@/components/admin/record-workspace';
import { ConfirmButton } from '@/components/admin/confirm-button';

import { DRIVE_TYPE_CONFIG, DRIVE_TYPES, type Tables } from '@barangayan/shared';
import { useEffect, useMemo, useState } from 'react';

import { OperationsTableSummary } from '@/components/admin/operations-table-summary';
import { ProfileTablePanel } from '@/components/admin/profile-table-panel';
import { SegmentedFilter } from '@/components/admin/segmented-filter';
import { useConfiguredTableBrowse } from '@/hooks/use-pilot-table-browse';
import { operationsConfig } from '@/lib/admin-tables/operations-config';
import type { BrowseResult, BrowseState } from '@/lib/admin-tables/browse-state';
import type { QueryOutcome, Summary } from '@/lib/admin-tables/queries/browse';
import { logAdminAction } from '@/actions/admin-audit-actions';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { beginAttempt, notify as toast } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { formatDriveDate } from '../drive-table';
import type { ApplicantRow } from './types';
import { REGISTRATION_STATUS_OPTIONS, TABS, registrationStatusLabel } from './types';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { formContainerClass, inputClass, submitButtonClass, cancelButtonClass } from '@/components/admin/form-styles';

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200',
    confirmed: 'bg-[var(--accent)]/15 text-[var(--accent)]',
    attended: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  };
  const label = registrationStatusLabel(status);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] ?? styles.pending}`}>
      {label}
    </span>
  );
}

function formatDateTimeShort(iso: string): { date: string; time: string } {
  const date = new Date(iso);
  return {
    date: new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(date),
    time: new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }).format(date),
  };
}

type DriveOption = { id: string; title: string; drive_date: string };
type ResidentOption = { id: string; full_name: string };

function AddApplicantForm({ onClose, onChanged, drives, residents }: { onClose: () => void; onChanged: () => void; drives: DriveOption[]; residents: ResidentOption[] }) {

  const [driveId, setDriveId] = useState('');
  const [residentId, setResidentId] = useState('');
  const [age, setAge] = useState(30);
  const [isPwd, setIsPwd] = useState('false');
  const [comorbidities, setComorbidities] = useState('');
  const [priorDoseDate, setPriorDoseDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    const toastAttempt = beginAttempt('handleSubmit');
    try {
      e.preventDefault();
      if (!driveId || !residentId) {
        toast.error('Select a drive and a resident.', { id: toastAttempt });
        return;
      }
      setSubmitting(true);
      const supabase = createSupabaseBrowserClient();
      const comorbsArray = comorbidities
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      // admin_register_for_drive (migration 0072) takes an explicit target resident and
      // re-verifies caller is admin + target is in the caller's own barangay server-side —
      // fixes BUG-07, where register_for_drive's auth.uid() silently registered the admin.
      const { error } = await supabase.rpc('admin_register_for_drive', {
        p_target_user_id: residentId,
        p_drive_id: driveId,
        p_age: age,
        p_is_pwd: isPwd === 'true',
        p_comorbidities: comorbsArray,
        p_prior_dose_date: priorDoseDate || undefined,
      });
      setSubmitting(false);
      if (error) {
        toast.error(`Failed to register: ${error.message}`, { id: toastAttempt });
        return;
      }

      // admin_register_for_drive doesn't return the new row's id, so entityId is omitted.
      const residentName = residents.find((r) => r.id === residentId)?.full_name;
      const driveTitle = drives.find((d) => d.id === driveId)?.title;
      logAdminAction({
        action: 'create',
        entityType: 'drive_registration',
        entityLabel: residentName ?? driveTitle ?? 'Drive registration',
        metadata: {
          resident: residentName ?? null,
          drive: driveTitle ?? null,
          age,
          is_pwd: isPwd === 'true',
          comorbidities: comorbsArray,
          prior_dose_date: priorDoseDate || null,
        },
      }).catch(() => {});

      toast.success('Registration created.', { id: toastAttempt });
      setDriveId('');
      setResidentId('');
      setAge(30);
      setIsPwd('false');
      setComorbidities('');
      setPriorDoseDate('');
      onClose();
      onChanged();

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    } finally { setSubmitting(false); }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`${formContainerClass} mb-6 grid-cols-1 sm:grid-cols-3`}
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium">Drive</span>
        <AdminSelect kind="health" className={inputClass} value={driveId} onValueChange={(nextValue) => setDriveId(nextValue)} required>
          <option value="">Select a drive…</option>
          {drives.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title} — {d.drive_date}
            </option>
          ))}
        </AdminSelect>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Resident</span>
        <AdminSelect kind="people" className={inputClass} value={residentId} onValueChange={(nextValue) => setResidentId(nextValue)} required>
          <option value="">Select a resident…</option>
          {residents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </AdminSelect>
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
        <AdminSelect kind="pwd" className={inputClass} value={isPwd} onValueChange={(nextValue) => setIsPwd(nextValue)}>
          <option value="false">No</option>
          <option value="true">Yes</option>
        </AdminSelect>
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
          className={submitButtonClass}
          aria-busy={submitting}>
          <LoadingButtonContent pending={submitting} pendingLabel="Registering…">Register</LoadingButtonContent>
        </button>
        <button type="button" onClick={onClose} className={cancelButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ApplicantsTable({ result, summary, requestedState, barangayId, drives, residents, optionsError }: {
  result: QueryOutcome<BrowseResult<ApplicantRow>>; summary: QueryOutcome<Summary>; requestedState: BrowseState;
  barangayId: string;
  drives: DriveOption[]; residents: ResidentOption[]; optionsError: string | null;
}) {

  const config = useMemo(() => operationsConfig('applicants'), []);
  const browse = useConfiguredTableBrowse(config, requestedState, result, true);
  const { state, value } = browse;
  const activeSort = config.sorts.find(sort => sort.key === state.sort)!;

  const [addOpen, setAddOpen] = useState(false);
  const [channelName] = useState(() => 'admin-applicants-' + Math.random().toString(36).slice(2));
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drive_registrations' }, browse.refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [channelName, browse.refresh]);

  async function updateField(row: ApplicantRow, patch: Partial<Tables<'drive_registrations'>>) {
    // Avoid a database write when a cell was opened and committed unchanged.
    const patchKeys = Object.keys(patch) as (keyof typeof patch)[];
    const changed = patchKeys.some((key) => patch[key] !== row[key]);
    if (!changed) return { error: null };

    const supabase = createSupabaseBrowserClient();
    const { data: updated, error } = await supabase
      .from('drive_registrations')
      .update(patch)
      .eq('id', row.id)
      .select('id, age, is_pwd, comorbidities, prior_dose_date, status, updated_at')
      .maybeSingle();
    if (error) return { error: error.message };
    if (!updated) {
      return { error: 'No registration was updated. Check that you still have access to this barangay.' };
    }

    const isStatusChange = patchKeys.length === 1 && patchKeys[0] === 'status';
    const before = Object.fromEntries(patchKeys.map((key) => [key, row[key]]));
    await logAdminAction({
      action: isStatusChange ? 'status_change' : 'update',
      entityType: 'drive_registration',
      entityId: updated.id,
      entityLabel: row.applicant_number,
      changes: { before, after: patch },
      metadata: {
        applicant_number: row.applicant_number,
        drive: row.medical_drives?.title ?? null,
        resident: row.profiles?.full_name ?? null,
        age: updated.age,
        is_pwd: updated.is_pwd,
        priority_score: row.priority_score,
        registered_at: row.created_at,
      },
    }).catch(() => {});
    browse.refresh();
    return { error: null, row: updated };
  }

  const lifecycle = useRecordWorkspace<ApplicantRow>('applicants', browse.refresh, browse.settle, { editHandle: browse.editHandle,
    actionsMinWidth: 360,
    workflowActions: row => row.status !== 'cancelled' && row.status !== 'attended' ? <ConfirmButton label="Cancel Registration" confirmLabel="Cancel registration?"
      ariaLabel="Cancel Registration" title="Cancel this medical registration" className="inline-flex min-h-9 shrink-0 items-center rounded-md bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:bg-red-950 dark:text-red-200"
      onConfirm={async () => {
    const toastAttempt = beginAttempt('admin-action');
        if (!await browse.settle()) return;
        const result = await updateField(row, { status: 'cancelled' });
        if (result.error) toast.error(`Failed to cancel registration: ${result.error}`, { id: toastAttempt });
        else toast.success('Registration cancelled.', { id: toastAttempt });
      }} /> : null,
  });

  const columns: EditableDataTableColumn<ApplicantRow>[] = [
    {
      id: 'number', header: 'Applicant #', frozen: true,
      initialWidth: 124,
      minWidth: 116,
      wrap: 'nowrap',
      render: (r) => <span className="font-mono text-xs font-medium tabular-nums">{r.applicant_number}</span>,
    },
    {
      id: 'drive', header: 'Drive', frozen: true,
      initialWidth: 230,
      minWidth: 190,
      wrap: 'break-word',
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
      id: 'resident', header: 'Resident',
      initialWidth: 188,
      minWidth: 160,
      wrap: 'break-word',
      render: (r) => <span className="font-medium leading-snug">{r.profiles?.full_name ?? '—'}</span>,
    },
    {
      id: 'email', header: 'Email',
      initialWidth: 240,
      minWidth: 180,
      wrap: 'break-word',
      render: (r) => r.profiles?.email || '—',
    },
    {
      id: 'age', header: 'Age',
      initialWidth: 70,
      minWidth: 66,
      wrap: 'nowrap',
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
      // Keep the inline select and its menu wide enough for icons, labels, and indicators.
      initialWidth: 144,
      minWidth: 144,
      wrap: 'nowrap',
      render: (r) => (r.is_pwd ? 'Yes' : 'No'),
      edit: {
        type: 'select', selectKind: 'pwd',
        options: [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ],
        getValue: (r) => String(r.is_pwd),
        onSave: (r, value) => updateField(r, { is_pwd: value === 'true' }),
      },
    },
    {
      id: 'priority', header: 'Priority Score',
      initialWidth: 112,
      minWidth: 104,
      wrap: 'nowrap',
      render: (r) => (
        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {r.priority_score}
        </span>
      ),
    },
    {
      id: 'status', header: 'Status',
      initialWidth: 140,
      minWidth: 132,
      wrap: 'nowrap',
      render: (r) => <StatusPill status={r.status} />,
      edit: {
        type: 'select', selectKind: 'status',
        options: [...REGISTRATION_STATUS_OPTIONS],
        getValue: (r) => r.status,
        onSave: (r, value) => updateField(r, { status: String(value) as ApplicantRow['status'] }),
        commitOnChange: true,
      },
    },
    {
      id: 'registered', header: 'Registered At',
      initialWidth: 142,
      minWidth: 132,
      wrap: 'nowrap',
      render: (r) => {
        const registeredAt = formatDateTimeShort(r.created_at);
        return (
          <span className="block text-xs leading-tight tabular-nums text-zinc-600 dark:text-zinc-300">
            <span className="block font-medium">{registeredAt.date}</span>
            <span className="mt-0.5 block text-zinc-500 dark:text-zinc-400">{registeredAt.time}</span>
          </span>
        );
      },
    },
    lifecycle.column,
  ];

  return <div >
    <RecordArchiveLink name="applicants" beforeOpen={browse.settle} />
    <OperationsTableSummary name="applicants" summary={summary} onRetry={browse.refresh} />
    <div>{optionsError && <p role="alert" className="mb-4">{optionsError} <button type="button" onClick={browse.refresh}>Retry options</button></p>}</div>
    {addOpen && <fieldset disabled={browse.pending || !!optionsError}><AddApplicantForm drives={drives} residents={residents} onClose={() => setAddOpen(false)} onChanged={browse.refresh} /></fieldset>}
    <ProfileTablePanel label="Medical Applicants" browse={browse}
      category={<label className="table-browse-field">Category
        <AdminSelect kind="health" aria-label="Category" value={state.filters.type} onValueChange={nextValue => void browse.commit({ filters: { type: nextValue } })}>
          <option value="">All categories</option>
          {DRIVE_TYPES.map(type => <option key={type} value={type}>{DRIVE_TYPE_CONFIG[type].label}</option>)}
        </AdminSelect></label>}
      filters={<SegmentedFilter label="Registration status" options={TABS.map(tab => ({ value: tab.key, label: tab.label }))}
        value={state.filters.tab} onChange={tab => void browse.commit({ filters: { tab } })} />}
      actions={<button type="button" onClick={async () => { if (await browse.settle()) setAddOpen(true); }}
        disabled={browse.pending || !barangayId || !!optionsError}>+ Add Registration</button>}>
      <EditableDataTable contextMenuColumnId="actions" rows={value?.rows ?? []} rowKey={row => row.id} columns={columns}
        emptyLabel="No registrations found."
        onRowClick={row => lifecycle.open(row)} resizableColumns  density="compact"
        tableMinWidth={1560} cellOverflow="hidden"
        editHandleRef={browse.editHandle} onEditingChange={browse.onEditingChange}
        sorting={{ descriptor: activeSort, direction: state.dir, choices: config.sorts,
          onChange: (sort, dir) => void browse.commit({ sort, dir }) }} />
    </ProfileTablePanel>
    {lifecycle.view}
  </div>;
}
