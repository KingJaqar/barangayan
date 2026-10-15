'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, useTransition, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Archive, Eye, RotateCcw, Trash2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { mutateAdminRecord } from '@/actions/admin-record-actions';
import { editableFields, fieldValue, RECORD_CONFIG, recordLabel, validateRecordPatch, type RecordData, type RecordField } from '@/lib/admin-tables/record-config';
import type { AdminRecordDatabase } from '@/lib/admin-tables/record-schema';
import type { TableName } from '@/lib/admin-tables/table-configs';
import type { EditableDataTableColumn } from './editable-data-table';
import { ContentSideSheet } from './content-create-panel';
import { TableDetailDialog } from './table-detail-dialog';
import { useToast } from '@/components/ui/toast';
import styles from './content-forms.module.css';
import { formatCentavosAsPHP } from '@barangayan/shared';

const buttonClass = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800';

export { RecordArchiveLink } from './record-archive-link';

export function useRecordWorkspace<T extends { id: string }>(name: TableName, onChanged: () => void, settle: () => Promise<boolean>, options?: {
  currentUserId?: string; extra?: (row: T, close: () => void) => ReactNode; archived?: boolean;
  workflowActions?: (row: T) => ReactNode; actionsMinWidth?: number;
}) {
  const [selection, setSelection] = useState<{ id: string; mode: 'details' | 'archive' | 'restore' | 'delete' } | null>(null);
  const generation = useRef(0);
  const open = useCallback(async (row: T, mode: 'details' | 'archive' | 'restore' | 'delete' = 'details') => {
    const current = ++generation.current;
    if (await settle() && current === generation.current) setSelection({ id: row.id, mode });
  }, [settle]);
  const close = () => { generation.current++; setSelection(null); };
  const actionsWidth = options?.actionsMinWidth ?? 180;
  const column: EditableDataTableColumn<T> = { id: 'actions', header: 'Actions', initialWidth: actionsWidth, minWidth: actionsWidth, wrap: 'nowrap', overflow: 'visible',
    render: row => <RecordRowActions onDetails={() => void open(row)} onArchive={() => void open(row, options?.archived ? 'restore' : 'archive')} onDelete={() => void open(row, 'delete')} archived={options?.archived}
      workflowActions={options?.workflowActions?.(row)} recordName={recordLabel(row as unknown as RecordData)}
      protectedRecord={!!options?.currentUserId && (row as unknown as RecordData).profile_id === options.currentUserId} /> };
  return { column, open: (row: T) => void open(row), view: selection && <RecordSheet key={`${selection.id}:${selection.mode}`} name={name} id={selection.id}
    initialMode={selection.mode} onClose={close} onChanged={onChanged} currentUserId={options?.currentUserId}
    extra={options?.extra ? row => options.extra!(row as unknown as T, close) : undefined} /> };
}

export function RecordRowActions({ onDetails, onArchive, onDelete, protectedRecord = false, archived = false, workflowActions, recordName }: {
  onDetails: () => void; onArchive: () => void; onDelete: () => void; protectedRecord?: boolean; archived?: boolean;
  workflowActions?: ReactNode; recordName?: string;
}) {
  const iconClass = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-zinc-900';
  const title = (action: string) => recordName ? `${action}: ${recordName}` : action;
  return <div className="flex flex-nowrap items-center gap-3" onClick={event => event.stopPropagation()}>
    {workflowActions}
    <div className="flex shrink-0 items-center gap-2" role="group" aria-label="Record actions">
      <button type="button" aria-label="View Details" title={title('View Details')} onClick={onDetails}
        className={`${iconClass} border-blue-300 bg-blue-50 text-blue-800 hover:border-blue-400 hover:bg-blue-100 focus-visible:ring-blue-600 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900`}><Eye size={20} strokeWidth={2} aria-hidden="true" /></button>
      <button type="button" aria-label={archived ? 'Restore' : 'Archive'} onClick={onArchive} disabled={protectedRecord}
        title={protectedRecord ? 'You cannot archive your own staff record.' : title(archived ? 'Restore to active records' : 'Archive record')}
        className={`${iconClass} border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100 focus-visible:ring-amber-600 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900`}>
        {archived ? <RotateCcw size={20} strokeWidth={2} aria-hidden="true" /> : <Archive size={20} strokeWidth={2} aria-hidden="true" />}</button>
      <button type="button" aria-label="Delete" onClick={onDelete} disabled={protectedRecord}
        title={protectedRecord ? 'You cannot delete your own staff record.' : title('Permanently delete record')}
        className={`${iconClass} border-red-300 bg-red-50 text-red-700 hover:border-red-400 hover:bg-red-100 focus-visible:ring-red-600 dark:border-red-700 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900`}><Trash2 size={20} strokeWidth={2} aria-hidden="true" /></button>
    </div>
  </div>;
}

export function RecordSheet({ name, id, initialMode = 'details', onClose, onChanged, currentUserId, extra }: {
  name: TableName; id: string; initialMode?: 'details' | 'archive' | 'restore' | 'delete'; onClose: () => void;
  onChanged: () => void; currentUserId?: string; extra?: (row: RecordData) => ReactNode;
}) {
  const sheetId = useId();
  const toast = useToast();
  const [row, setRow] = useState<RecordData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<'archive' | 'restore' | 'delete' | null>(initialMode === 'details' ? null : initialMode);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let current = true;
    const db = createSupabaseBrowserClient() as unknown as SupabaseClient<AdminRecordDatabase>;
    void (async () => {
      try {
        const result = await db.from(`admin_${name}_records`).select('row,f_archived').eq('id', id).retry(false).abortSignal(controller.signal).maybeSingle();
        if (!current) return;
        if (result.error) throw new Error('Could not load current details. Please retry.');
        if (!result.data) throw new Error('This record is unavailable or your access changed.');
        const value = result.data.row as unknown as RecordData;
        if (value.id !== id) throw new Error('Could not load this record.');
        setRow({ ...value, deleted_at: result.data.f_archived ? String(value.deleted_at ?? 'archived') : null }); setLoadError(null);
      } catch (cause) { if (current) setLoadError(cause instanceof Error ? cause.message : 'Could not load details. Please retry.'); }
      finally { clearTimeout(timeout); }
    })();
    return () => { current = false; controller.abort(); clearTimeout(timeout); };
  }, [name, id, revision]);

  const fields = row ? editableFields(name, row) : [];
  const protectedRecord = name === 'staff' && row?.profile_id === currentUserId;
  function close() { if (!busy.current) onClose(); }
  function edit() {
    if (!row) return;
    setDraft(Object.fromEntries(fields.map(field => [field.key, fieldValue(row, field) ?? (field.type === 'boolean' ? false : field.type === 'list' ? [] : '')])));
    setError(null); setSuccess(null); setEditing(true);
  }
  function mutate(operation: 'save' | 'archive' | 'restore' | 'delete') {
    if (!row || busy.current) return;
    let patch: Record<string, unknown> = {};
    try { if (operation === 'save') patch = validateRecordPatch(name, row, draft); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Check your changes.'); return; }
    busy.current = true; setError(null);
    startTransition(async () => {
      try {
        const result = await mutateAdminRecord(name, row.id, operation, row.updated_at ?? '', patch);
        if (result.error) { setError(result.error); toast.showError(result.error); return; }
        toast.showSuccess(operation === 'save' ? 'Changes saved.' : operation === 'delete' ? 'Record permanently deleted.' : operation === 'archive' ? 'Record archived.' : 'Record restored.');
        onChanged();
        if (operation === 'save') { setSuccess('Changes saved.'); setEditing(false); setRow(null); setRevision(value => value + 1); }
        else onClose();
      } catch { setError('The action could not be completed. Please retry.'); toast.showError('The action could not be completed. Please retry.'); }
      finally { busy.current = false; }
    });
  }
  const title = row ? recordLabel(row) : 'Record details';
  const form = <div className={styles.form}>
    {loadError ? <div role="alert"><p>{loadError}</p><button type="button" className={buttonClass} onClick={() => { setLoadError(null); setRow(null); setRevision(value => value + 1); }}>Retry details</button></div>
      : !row ? <p role="status">Loading current details…</p> : <>
        {row.deleted_at && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">Archived record</p>}
        {success && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{success}</p>}
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
        {editing ? <form onSubmit={event => { event.preventDefault(); mutate('save'); }}>
          <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
            {fields.map(field => <RecordInput key={field.key} field={field} value={draft[field.key]} onChange={value => setDraft(current => ({ ...current, [field.key]: value }))} />)}
          </fieldset>
          <div className={styles.actions}><button type="submit" disabled={pending} className={styles.createButton}>{pending ? 'Saving…' : 'Save'}</button>
            <button type="button" disabled={pending} className={styles.secondaryButton} onClick={() => { setEditing(false); setDraft({}); setError(null); }}>Cancel</button></div>
        </form> : <>
          <RecordDetails name={name} row={row} />
          {extra?.(row)}
          {name === 'requests' && <Link href={`/requests/${id}`} className={`${buttonClass} mt-4`}>Open request review</Link>}
          <div className={styles.actions}>
            <button type="button" className={styles.createButton} disabled={pending || protectedRecord || !fields.length} onClick={edit}>Edit</button>
            {!fields.length && <p className="text-xs text-zinc-500">{name === 'requests' ? 'Use request review to change workflow details.' : 'Completed payment amounts are kept as ledger records.'}</p>}
            <button type="button" className={styles.secondaryButton} disabled={pending || protectedRecord} onClick={() => { setError(null); setConfirmation(row.deleted_at ? 'restore' : 'archive'); }}>{row.deleted_at ? 'Restore' : 'Archive'}</button>
            <button type="button" className={`${styles.secondaryButton} text-red-600`} disabled={pending || protectedRecord} onClick={() => { setError(null); setConfirmation('delete'); }}>Delete</button>
          </div>
        </>}
      </>}
  </div>;
  return <>
    <ContentSideSheet id={sheetId} open onClose={close} form={{ label: 'View Details', title, description: RECORD_CONFIG[name].label + ' · Record details', content: form }} />
    {confirmation && row && !loadError && <TableDetailDialog label={`${confirmation} record`} preventClose={pending} onClose={() => { if (!busy.current) setConfirmation(null); }}>
      <div className="rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">{confirmation === 'delete' ? 'Permanently delete' : confirmation === 'restore' ? 'Restore' : 'Archive'} {recordLabel(row)}?</h2>
        <p className="mt-3 text-sm">{confirmation === 'delete' ? 'This permanently removes the record from the database. This action cannot be undone. Related-record constraints may prevent deletion.'
          : confirmation === 'archive' ? 'This record will leave the active list. You can restore it from the archive.' : 'This record will return to the active list.'}</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex gap-3"><button type="button" className={`${buttonClass} ${confirmation === 'delete' ? 'bg-red-600 text-white hover:bg-red-700' : ''}`}
          disabled={pending || protectedRecord} onClick={() => mutate(confirmation)}>{pending ? 'Working…' : confirmation === 'delete' ? 'Delete permanently' : confirmation === 'restore' ? 'Restore record' : 'Archive record'}</button>
          <button type="button" className={buttonClass} disabled={pending} onClick={() => { setConfirmation(null); setError(null); }}>Cancel</button></div>
      </div>
    </TableDetailDialog>}
  </>;
}

function RecordInput({ field, value, onChange }: { field: RecordField; value: unknown; onChange: (value: unknown) => void }) {
  const id = useId();
  const display = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  return <label htmlFor={id} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}><span className="block">{field.label}{field.required ? ' *' : ''}</span>
    {field.type === 'boolean' ? <AdminSelect kind="status" id={id} value={String(value)} onValueChange={nextValue => onChange(nextValue === 'true')}><option value="false">No</option><option value="true">Yes</option></AdminSelect>
      : field.type === 'select' ? <AdminSelect id={id} value={display} required={field.required} onValueChange={nextValue => onChange(nextValue)}><option value="">Select…</option>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</AdminSelect>
      : field.type === 'textarea' ? <textarea id={id} rows={4} value={display} required={field.required} onChange={event => onChange(event.target.value)} />
      : <input id={id} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'}
        required={field.required} min={field.min} max={field.max} step={field.type === 'number' ? 1 : undefined} value={field.type === 'time' ? display.slice(0, 5) : display}
        onChange={event => onChange(field.type === 'number' ? (event.target.value === '' ? '' : Number(event.target.value)) : field.type === 'list' ? event.target.value.split(',') : event.target.value)} />}
  </label>;
}

const label = (key: string) => key.replaceAll('_', ' ').replace(/^\w/, char => char.toUpperCase());
function DetailValue({ value }: { value: unknown }): ReactNode {
  if (value === null || value === undefined || value === '') return <span className="text-zinc-500">—</span>;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? <ul className="space-y-2">{value.map((item, index) => <li key={index}><DetailValue value={item} /></li>)}</ul> : 'None';
  if (typeof value === 'object') return <dl className="space-y-2">{Object.entries(value).map(([key, item]) => <div key={key}><dt className="text-xs text-zinc-500">{label(key)}</dt><dd><DetailValue value={item} /></dd></div>)}</dl>;
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) return <a href={value} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline">Open attachment or link</a>;
  return String(value);
}
const detailFields: Record<TableName, [string, string][]> = {
  requests: [['reference_number', 'Reference'], ['resident_name', 'Resident'], ['document_name', 'Document type'], ['submission_payload', 'Submitted information'],
    ['assessed_amount_centavos', 'Document fee'], ['pickup_date', 'Pickup date']],
  transactions: [['request_reference', 'Request reference'], ['resident_name', 'Resident'], ['document_name', 'Document type'], ['collector_name', 'Collected by'],
    ['document_fee_centavos', 'Document fee'], ['paid_at', 'Paid on'], ['refund_status', 'Refund status'], ['refund_amount_centavos', 'Refund amount'], ['refund_reason', 'Refund reason'], ['refunded_at', 'Refunded on'], ['refund_transfer_link', 'Refund claim link']],
  residents: [['full_name', 'Full name'], ['home_address', 'Address'], ['email_verification_status', 'Email verification'], ['id_type', 'ID type'], ['id_verification_status', 'ID verification'], ['verified_location_address', 'Verified location']],
  incidents: [['reporter_name', 'Reporter'], ['category_name', 'Category'], ['confirmation_count', 'Resident confirmations'], ['location', 'Coordinates'], ['photo_urls', 'Photos']],
  health: [['registration_count', 'Registrations']],
  applicants: [['applicant_number', 'Applicant number'], ['resident_name', 'Resident'], ['drive_title', 'Medical drive'], ['drive_date', 'Drive date'], ['drive_location', 'Drive location'], ['priority_score', 'Priority score']],
  households: [['resident_name', 'Head of household'], ['is_checked_in', 'Checked in'], ['checked_in_at', 'Check-in date'], ['checked_in_center_name', 'Evacuation center']],
  staff: [['email', 'Email']],
};
function RecordDetails({ name, row }: { name: TableName; row: RecordData }) {
  const profile = (row.profile ?? row.profiles) as Record<string, unknown> | undefined;
  const request = row.service_requests as Record<string, unknown> | undefined;
  const requestProfile = request?.profiles as Record<string, unknown> | undefined;
  const document = (request?.document_types ?? row.document_types) as Record<string, unknown> | undefined;
  const drive = row.medical_drives as Record<string, unknown> | undefined;
  const values = { ...row, resident_name: profile?.full_name ?? requestProfile?.full_name, reporter_name: profile?.full_name,
    document_name: document?.name, request_reference: request?.reference_number, collector_name: (row.collector as Record<string, unknown> | undefined)?.full_name,
    category_name: (row.incident_categories as Record<string, unknown> | undefined)?.name, email: row.email ?? profile?.email,
    drive_title: drive?.title, drive_date: drive?.drive_date, drive_location: drive?.location } as Record<string, unknown>;
  const entries = [...RECORD_CONFIG[name].fields.map(field => [field.key, field.label, fieldValue(row, field)] as const),
    ...detailFields[name].map(([key, title]) => [key, title, values[key]] as const),
    ['created_at', 'Created on', row.created_at], ['updated_at', 'Last updated', row.updated_at]];
  return <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">{entries.map(([key, title, value]) => <div key={String(key)} className="min-w-0">
    <dt className="mb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{String(title)}</dt><dd className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
      <DetailValue value={String(key).endsWith('_centavos') && typeof value === 'number' ? formatCentavosAsPHP(value) :
        (key === 'created_at' || key === 'updated_at' || key === 'paid_at' || key === 'refunded_at' || key === 'checked_in_at') && typeof value === 'string' && !Number.isNaN(Date.parse(value))
          ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value)) : value} /></dd>
  </div>)}</dl>;
}
