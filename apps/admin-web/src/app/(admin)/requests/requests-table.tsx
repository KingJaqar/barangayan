'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import { RecordArchiveLink, useRecordWorkspace } from '@/components/admin/record-workspace';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RequestStatusActions } from '@/components/admin/request-status-actions';

import { type Tables } from '@barangayan/shared';
import { useEffect, useState } from 'react';

import { TableBrowsePanel } from '@/components/admin/table-browse-panel';
import { TableBrowseControls } from '@/components/admin/table-browse-controls';
import { TablePagination } from '@/components/admin/table-pagination';
import { SegmentedFilter } from '@/components/admin/segmented-filter';
import { PilotSummary } from '@/components/admin/pilot-summary';
import { usePilotTableBrowse } from '@/hooks/use-pilot-table-browse';
import { pageRange, type BrowseResult, type BrowseState } from '@/lib/admin-tables/browse-state';
import type { QueryOutcome, Summary } from '@/lib/admin-tables/queries/browse';
import { directionLabel } from '@/lib/admin-tables/sort-definitions';
import { formatAdminTimestamp } from '@/lib/admin-tables/pilot-config';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { StatusPill } from '@/components/admin/status-pill';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { ServiceRequest } from './page';
import { TABS } from './types';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { formContainerClass, inputClass, submitButtonClass, cancelButtonClass } from '@/components/admin/form-styles';

interface Resident {
  id: string;
  full_name: string;
}
interface DocumentTypeOption {
  id: string;
  name: string;
  contract_version: number;
}

function currentDateTimeLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function AddRequestForm({
  residents,
  documentTypes,
  barangayId,
  onClose,
  onChanged,
}: {
  residents: Resident[];
  documentTypes: DocumentTypeOption[];
  barangayId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [referenceNumber, setReferenceNumber] = useState('');
  const [residentId, setResidentId] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [status, setStatus] = useState<'submitted' | 'in_progress' | 'ready_for_pickup' | 'completed' | 'cancelled'>('submitted');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'waived'>('pending');
  const [submittedAt, setSubmittedAt] = useState(currentDateTimeLocal);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!residentId || !documentTypeId) {
      toast.showError('Resident and document type are required.');
      return;
    }
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { data: inserted, error } = await supabase
      .from('service_requests')
      .insert({
        resident_id: residentId,
        document_type_id: documentTypeId,
        barangay_id: barangayId,
        ...(referenceNumber.trim() ? { reference_number: referenceNumber.trim().replace(/^#/, '') } : {}),
        status,
        payment_status: paymentStatus,
        created_at: new Date(submittedAt).toISOString(),
        requester_notes: notes || null,
      })
      .select('id')
      .single();
    setSubmitting(false);
    if (error) {
      toast.showError(`Failed to create request: ${error.message}`);
      return;
    }

    logAdminAction({
      action: 'create',
      entityType: 'service_request',
      entityId: inserted?.id,
      entityLabel: referenceNumber.trim() || residents.find((r) => r.id === residentId)?.full_name || 'Service Request',
      metadata: {
        resident: residents.find((r) => r.id === residentId)?.full_name ?? null,
        document_type: documentTypes.find((d) => d.id === documentTypeId)?.name ?? null,
        status,
        payment_status: paymentStatus,
        notes: notes || null,
      },
    }).catch(() => {});

    toast.showSuccess('Request created.');
    setReferenceNumber('');
    setResidentId('');
    setDocumentTypeId('');
    setStatus('submitted');
    setPaymentStatus('pending');
    setSubmittedAt(currentDateTimeLocal());
    setNotes('');
    onClose();
    onChanged();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`${formContainerClass} mb-6 grid-cols-1 sm:grid-cols-4`}
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium">Reference</span>
        <input
          className={inputClass}
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
          placeholder="Auto-generated on save"
        />
        <span className="mt-1 block text-xs text-zinc-500">Leave blank to use the next unique reference.</span>
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
        <span className="mb-1 block font-medium">Document Type</span>
        <AdminSelect kind="document" className={inputClass} value={documentTypeId} onValueChange={(nextValue) => setDocumentTypeId(nextValue)} required>
          <option value="">Select a document type…</option>
          {documentTypes.filter(d => d.contract_version === 1).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </AdminSelect>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Status</span>
        <AdminSelect kind="status" className={inputClass} value={status} onValueChange={(nextValue) => setStatus(nextValue as typeof status)}>
          <option value="submitted">Submitted</option>
          <option value="in_progress">Processing</option>
          <option value="ready_for_pickup">Ready for Pickup</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </AdminSelect>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Payment</span>
        <AdminSelect kind="status" className={inputClass} value={paymentStatus} onValueChange={(nextValue) => setPaymentStatus(nextValue as typeof paymentStatus)}>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="waived">Waived</option>
        </AdminSelect>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Submitted Date</span>
        <input type="datetime-local" className={inputClass} value={submittedAt} onChange={(e) => setSubmittedAt(e.target.value)} required />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Notes (optional)</span>
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Purpose of request" />
      </label>
      <div className="col-span-1 flex items-end gap-2 sm:col-span-4">
        <button
          type="submit"
          disabled={submitting || !residentId || !documentTypeId}
          className={submitButtonClass}
          aria-busy={submitting}>
          <LoadingButtonContent pending={submitting} pendingLabel="Creating…">Create Request</LoadingButtonContent>
        </button>
        <button type="button" onClick={onClose} className={cancelButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function RequestsTable({
  result, summary, requestedState, optionsError, residents, documentTypes, barangayId,
}: {
  result: QueryOutcome<BrowseResult<ServiceRequest>>; summary: QueryOutcome<Summary>; requestedState: BrowseState;
  optionsError: string | null; residents: Resident[]; documentTypes: DocumentTypeOption[]; barangayId: string;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const browse = usePilotTableBrowse('requests', requestedState, result);
  const { state, value } = browse;
  const activeSort = browse.config.sorts.find(sort => sort.key === state.sort)!;
  const range = value ? pageRange(value.total, state.page, state.pageSize) : null;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel('admin-service-requests-' + crypto.randomUUID())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests', filter: 'barangay_id=eq.' + barangayId }, browse.refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [barangayId, browse.refresh]);

  async function updateField(request: ServiceRequest, patch: Partial<Tables<'service_requests'>>) {
    // Avoid both a duplicate submission and an audit entry when a cell is committed unchanged.
    const before: Record<string, unknown> = {};
    let changed = false;
    for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
      before[key] = request[key];
      if (request[key] !== patch[key]) changed = true;
    }

    if (!changed) return { error: null };

    const supabase = createSupabaseBrowserClient();
    const { data: updated, error } = await supabase
      .from('service_requests')
      .update(patch)
      .eq('id', request.id)
      .select('id, reference_number, status, payment_status, resident_id, document_type_id, created_at, requester_notes')
      .maybeSingle();
    if (error) return { error: error.message };
    if (!updated) return { error: 'No request was updated. Check that you still have access to this barangay.' };

    logAdminAction({
      action: patch.status || patch.payment_status ? 'status_change' : 'update',
      entityType: 'service_request',
      entityId: updated.id,
      entityLabel: updated.reference_number,
      changes: { before, after: patch },
    }).catch(() => {});
    browse.refresh();
    return { error: null, row: updated };
  }

  const lifecycle = useRecordWorkspace<ServiceRequest>('requests', browse.refresh, browse.settle, {
    actionsMinWidth: 920,
    workflowActions: row => <>
      <RequestStatusActions requestId={row.id} referenceNumber={row.reference_number} status={row.status}
        paymentStatus={row.payment_status} paymentMethod={row.payment_method} workflowRequest={row} variant="row" onBeforeAction={browse.settle} onChanged={browse.refresh} />
      {row.contract_version === 2 && <Link href={`/requests/${row.id}`}
      className="inline-flex min-h-9 items-center rounded-md bg-[var(--accent)] px-3 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      onClick={event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        void browse.settle().then(saved => { if (saved) router.push(`/requests/${row.id}`); });
      }}>Details</Link>}
    </>,
  });

  const columns: EditableDataTableColumn<ServiceRequest>[] = [
    {
      // Plain text, not a Link — an editable cell can't also be a reliable nav target
      // (the anchor's default navigation fires on click regardless of the edit handler).
      // Navigation moved to the "View" link in Actions instead.
      id: 'reference',
      header: 'Reference',
      initialWidth: 128,
      minWidth: 118,
      wrap: 'nowrap',
      render: (r) => <span className="font-mono text-xs font-medium tabular-nums">#{r.reference_number}</span>,
      edit: {
        canEdit: r => r.contract_version === 1,
        type: 'text',
        getValue: (r) => r.reference_number,
        onSave: async (r, value) => {
          const next = String(value).trim();
          if (!next) return { error: 'Reference number cannot be empty.' };
          return updateField(r, { reference_number: next });
        },
      },
    },
    {
      id: 'resident',
      header: 'Resident',
      initialWidth: 190,
      minWidth: 158,
      wrap: 'break-word',
      render: (r) => <span className="font-medium leading-snug">{r.profiles?.full_name ?? '—'}</span>,
      edit: {
        canEdit: r => r.contract_version === 1 && !optionsError,
        type: 'select',
        options: residents.map((res) => ({ value: res.id, label: res.full_name })),
        getValue: (r) => r.resident_id,
        onSave: (r, value) => updateField(r, { resident_id: String(value) }),
        commitOnChange: true,
      },
    },
    {
      id: 'document',
      header: 'Document',
      initialWidth: 188,
      minWidth: 156,
      wrap: 'break-word',
      render: (r) => <span className="font-medium leading-snug">{r.document_types?.name ?? '—'}</span>,
      edit: {
        canEdit: r => r.contract_version === 1 && !optionsError,
        type: 'select',
        options: documentTypes.map((d) => ({ value: d.id, label: d.name })),
        getValue: (r) => r.document_type_id,
        onSave: (r, value) => updateField(r, { document_type_id: String(value) }),
        commitOnChange: true,
      },
    },
    {
      id: 'status',
      header: 'Status',
      initialWidth: 148,
      minWidth: 136,
      wrap: 'nowrap',
      render: (r) => <StatusPill status={r.status} />,
      edit: {
        canEdit: r => r.contract_version === 1,
        type: 'select',
        options: [
          { value: 'submitted', label: 'Submitted' },
          { value: 'in_progress', label: 'Processing' },
          { value: 'ready_for_pickup', label: 'Ready for Pickup' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
        // Same bare .update({status}) the FSM buttons in RequestStatusActions use — the
        // track_service_request_status trigger (0002/0007) appends a status_history entry
        // on any status-changing UPDATE, so this stays consistent with that audit trail.
        getValue: (r) => r.status,
        onSave: (r, value) => updateField(r, { status: String(value) }),
        commitOnChange: true,
      },
    },
    {
      id: 'payment_status',
      header: 'Payment',
      initialWidth: 116,
      minWidth: 106,
      wrap: 'nowrap',
      render: (r) => <StatusPill status={r.payment_status} />,
      edit: {
        canEdit: r => r.contract_version === 1,
        type: 'select',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'paid', label: 'Paid' },
          { value: 'waived', label: 'Waived' },
        ],
        getValue: (r) => r.payment_status,
        onSave: (r, value) => updateField(r, { payment_status: String(value) }),
        commitOnChange: true,
      },
    },
    {
      id: 'submitted',
      header: 'Submitted',
      initialWidth: 164,
      minWidth: 150,
      wrap: 'nowrap',
      render: (r) => <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-300">{formatAdminTimestamp(r.created_at)}</span>,
      edit: {
        canEdit: r => r.contract_version === 1,
        type: 'datetime',
        getValue: (r) => r.created_at,
        onSave: (r, value) => updateField(r, { created_at: String(value) }),
      },
    },
    {
      id: 'notes',
      header: 'Notes',
      initialWidth: 240,
      minWidth: 190,
      wrap: 'break-word',
      render: (r) => <span className="leading-snug text-zinc-600 dark:text-zinc-300">{r.requester_notes ?? '—'}</span>,
      edit: {
        canEdit: r => r.contract_version === 1,
        type: 'text',
        getValue: (r) => r.requester_notes ?? '',
        onSave: (r, value) => updateField(r, { requester_notes: String(value) || null }),
      },
    },
    lifecycle.column,
  ];

  return <>
    <RecordArchiveLink name="requests" beforeOpen={browse.settle} />
    <PilotSummary name="requests" summary={summary} onRetry={browse.refresh} />
    {optionsError && <div role="alert" className="mb-4 rounded-xl border p-4">{optionsError} <button type="button" onClick={browse.refresh}>Retry options</button></div>}
    {addOpen && <fieldset disabled={!!optionsError || browse.pending}><AddRequestForm residents={residents} documentTypes={documentTypes} barangayId={barangayId} onClose={() => setAddOpen(false)} onChanged={browse.refresh} /></fieldset>}
    <TableBrowsePanel label="Requests" pending={browse.pending} error={browse.error} onRetry={browse.refresh}
      queryIdentity={value?.queryIdentity}
      announcement={value && range ? activeSort.label + ', ' + directionLabel(activeSort, state.dir) + '; Showing ' + range.start + '–' + range.end + ' of ' + value.total : undefined}
      controls={<TableBrowseControls state={state} sorts={browse.config.sorts} searchDraft={browse.searchDraft}
        onSearchChange={browse.changeSearch} onChange={change => void browse.commit(change)}
        category={<div className="table-browse-field"><label htmlFor="requests-document">Document</label>
          <AdminSelect id="requests-document" value={state.filters.doc} disabled={!!optionsError}
            onValueChange={nextValue => void browse.commit({ filters: { doc: nextValue } })}>
            <option value="">All documents</option>
            {state.filters.doc && !documentTypes.some(doc => doc.id === state.filters.doc) && <option value={state.filters.doc}>Selected document</option>}
            {documentTypes.map(doc => <option key={doc.id} value={doc.id}>{doc.name}</option>)}
          </AdminSelect></div>}
        filters={<SegmentedFilter label="Request status" value={state.filters.tab} options={TABS.map(tab => ({ value: tab.key, label: tab.label }))}
          onChange={tab => void browse.commit({ filters: { tab } })} />}
        actions={!addOpen && <button type="button" disabled={!barangayId || !!optionsError || browse.pending}
          onClick={() => void browse.settle().then(saved => { if (saved) setAddOpen(true); })}>+ Add Request</button>} />}
      pagination={value && <TablePagination total={value.total} page={state.page} pageSize={state.pageSize} pending={browse.pending}
        onPageChange={page => void browse.commit({ page })} onPageSizeChange={pageSize => void browse.commit({ pageSize })} />}>
      <EditableDataTable contextMenuColumnId="actions" rows={value?.rows ?? []} rowKey={row => row.id} columns={columns}
        editHandleRef={browse.editHandle} onEditingChange={browse.onEditingChange}
        sorting={{ descriptor: activeSort, direction: state.dir, choices: browse.config.sorts, onChange: (sort, dir) => void browse.commit({ sort, dir }) }}
        emptyLabel={browse.pending ? 'Updating results…' : 'No requests in this view.'}
        resizableColumns density="compact" tableMinWidth={1360}  />
    </TableBrowsePanel>
    {lifecycle.view}
  </>;
}
